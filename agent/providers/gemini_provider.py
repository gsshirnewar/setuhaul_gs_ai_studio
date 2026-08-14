"""Gemini provider adapter for the chat agent.

Translates OpenAI-style messages and tool schemas into the Google GenAI SDK
format, and converts Gemini function-call responses back into OpenAI-style
objects so the rest of the agent loop stays unchanged.
"""

import json
from typing import Any, Dict, List

from google import genai
from google.genai import types
from google.genai import errors as genai_errors
import os


class GeminiProvider:
    """Thin wrapper around google.genai.Client with OpenAI-compatible interface."""

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        try:
            self.client = genai.Client(api_key=api_key)
        except Exception as exc:
            raise ImportError(f"Failed to initialize google-genai client: {exc}") from exc
        self.model = model
        # If the configured model is a short name (not starting with 'models/'),
        # try to resolve it to a full model id visible to this API key.
        if not str(self.model).startswith("models/"):
            try:
                available = [m.name for m in self.client.models.list()]
                # Try exact match on suffix (e.g., 'gemini-2.5-flash' -> 'models/gemini-2.5-flash')
                match = None
                for name in available:
                    if name.endswith(self.model) or self.model in name:
                        match = name
                        break
                if match:
                    self.model = match
            except Exception:
                # If listing models fails, don't crash here; validation may be
                # performed later if enabled. Leave self.model as-is.
                pass
        # Optional fail-fast validation: when set to a truthy value, the provider
        # will check that the model is visible to the API key on initialization.
        # This network call is opt-in to avoid surprising unit tests.
        validate = os.environ.get("LLM_VALIDATE_MODEL_ON_INIT", "").strip().lower()
        if validate in ("1", "true", "yes"):
            try:
                self._validate_model_presence()
            except genai_errors.ClientError as exc:
                raise RuntimeError(
                    f"Gemini model validation failed for model '{self.model}': {exc}. "
                    "Ensure your GEMINI_API_KEY is valid and the Generative Language API is enabled."
                ) from exc

    # -----------------------------------------------------------------------
    # Schema conversion
    # -----------------------------------------------------------------------
    @staticmethod
    def _to_gemini_schema(openai_schema: Dict[str, Any]) -> types.Schema:
        """Convert an OpenAI JSON-schema dict into a Gemini Schema object."""
        gemini_type = openai_schema.get("type", "object")
        if gemini_type == "object":
            properties = {}
            for name, prop in openai_schema.get("properties", {}).items():
                properties[name] = GeminiProvider._to_gemini_schema(prop)
            return types.Schema(
                type=gemini_type,
                properties=properties,
                required=openai_schema.get("required", []),
                description=openai_schema.get("description", ""),
            )
        if gemini_type == "array":
            return types.Schema(
                type=gemini_type,
                items=GeminiProvider._to_gemini_schema(openai_schema.get("items", {})),
                description=openai_schema.get("description", ""),
            )
        if gemini_type == "string":
            return types.Schema(
                type=gemini_type,
                description=openai_schema.get("description", ""),
                enum=openai_schema.get("enum"),
            )
        return types.Schema(
            type=gemini_type,
            description=openai_schema.get("description", ""),
        )

    @staticmethod
    def _to_gemini_tools(openai_tools: List[Dict[str, Any]]) -> List[types.Tool]:
        """Convert OpenAI tools list into Gemini Tool declarations."""
        declarations = []
        for tool in openai_tools:
            fn = tool["function"]
            params_schema = GeminiProvider._to_gemini_schema(fn.get("parameters", {}))
            declarations.append(
                types.FunctionDeclaration(
                    name=fn["name"],
                    description=fn["description"],
                    parameters=params_schema,
                )
            )
        return [types.Tool(function_declarations=declarations)]

    # -----------------------------------------------------------------------
    # Message conversion
    # -----------------------------------------------------------------------
    @staticmethod
    def _to_gemini_messages(openai_messages: List[Dict[str, Any]]) -> List[types.Content]:
        """Convert OpenAI chat messages to Gemini Content objects.

        Gemini does not support a separate 'system' role, so system messages
        are prepended to the first user message.
        """
        contents: List[types.Content] = []
        system_prefix = ""
        # Map OpenAI tool_call_id -> function name so tool-result messages can
        # supply the function_response name even when the message omits it.
        tool_call_names: Dict[str, str] = {}
        for msg in openai_messages:
            if msg.get("role") == "assistant":
                for tc in msg.get("tool_calls", []):
                    tool_call_names[tc.get("id")] = tc.get("function", {}).get("name", "")

        for msg in openai_messages:
            role = msg.get("role")
            content = msg.get("content")
            if role == "system":
                system_prefix += f"{content}\n\n"
                continue
            if role == "user":
                text = content if content else ""
                if system_prefix:
                    text = system_prefix + text
                    system_prefix = ""
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=text)],
                    )
                )
            elif role == "assistant":
                parts: List[types.Part] = []
                if content:
                    parts.append(types.Part.from_text(text=content))
                for tc in msg.get("tool_calls", []):
                    parts.append(
                        types.Part.from_function_call(
                            name=tc["function"]["name"],
                            args=json.loads(tc["function"]["arguments"]),
                        )
                    )
                contents.append(types.Content(role="model", parts=parts))
            elif role == "tool":
                fn_name = msg.get("name") or tool_call_names.get(msg.get("tool_call_id"), "")
                if not fn_name:
                    # Gemini rejects an empty function_response name; fall back
                    # to a safe placeholder so the request does not fail.
                    fn_name = "unknown_tool"
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=fn_name,
                                response={"output": msg["content"]},
                            )
                        ],
                    )
                )
        return contents

    # -----------------------------------------------------------------------
    # Response conversion
    # -----------------------------------------------------------------------
    @staticmethod
    def _to_openai_response(response: types.GenerateContentResponse) -> Any:
        """Convert a Gemini response into an OpenAI-style choice object."""
        candidate = response.candidates[0]
        content = candidate.content
        text_parts = [p.text for p in content.parts if p.text]
        function_calls = [
            p.function_call for p in content.parts if p.function_call
        ]

        if function_calls:
            tool_calls = []
            for i, fc in enumerate(function_calls):
                tool_calls.append(
                    _SimpleNamespace(
                        id=f"call_{i+1}",
                        function=_SimpleNamespace(
                            name=fc.name,
                            arguments=json.dumps(dict(fc.args)),
                        ),
                    )
                )
            return _SimpleNamespace(
                choices=[
                    _SimpleNamespace(
                        message=_SimpleNamespace(
                            content=None,
                            tool_calls=tool_calls,
                        )
                    )
                ]
            )

        return _SimpleNamespace(
            choices=[
                _SimpleNamespace(
                    message=_SimpleNamespace(
                        content="\n".join(text_parts),
                        tool_calls=None,
                    )
                )
            ]
        )

    # -----------------------------------------------------------------------
    # Public API matching openai.chat.completions.create
    # -----------------------------------------------------------------------
    class _Completions:
        def __init__(self, provider: "GeminiProvider"):
            self._provider = provider

        def create(
            self,
            *,
            model: str,
            messages: List[Dict[str, Any]],
            tools: List[Dict[str, Any]],
            tool_choice: str = "auto",
            **kwargs: Any,
        ) -> Any:
            contents = GeminiProvider._to_gemini_messages(messages)
            gemini_tools = GeminiProvider._to_gemini_tools(tools)
            config = types.GenerateContentConfig(
                tools=gemini_tools,
                tool_config=types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(
                        mode="AUTO",
                    )
                ),
            )
            try:
                response = self._provider.client.models.generate_content(
                    model=self._provider.model,
                    contents=contents,
                    config=config,
                )
            except genai_errors.ClientError as exc:
                # Surface a clearer, actionable error when the API returns a
                # client error (invalid key, model not found, permissions, etc.).
                status = getattr(exc, "status_code", None)
                body = getattr(exc, "args", None)
                raise RuntimeError(
                    f"Gemini API request failed (status={status}). "
                    f"Check GEMINI_API_KEY, model '{self._provider.model}', and that the Generative Language API is enabled. "
                    f"Original error: {body}"
                ) from exc
            return GeminiProvider._to_openai_response(response)

        def _validate_model_presence(self) -> None:
            """Check that the configured model is listed for this API key.

            Raises ClientError when the underlying client reports an auth/model error.
            """
            models = self._provider.client.models.list()
            names = [m.name for m in models]
            if self._provider.model not in names and not any(self._provider.model in n for n in names):
                raise genai_errors.ClientError(
                    404,
                    {"message": f"Model '{self._provider.model}' not visible to API key", "status": "NOT_FOUND"},
                )

    @property
    def chat(self) -> Any:
        return _SimpleNamespace(completions=self._Completions(self))


class _SimpleNamespace:
    """Tiny namespace for OpenAI-style dot access."""

    def __init__(self, **kwargs: Any):
        self.__dict__.update(kwargs)
