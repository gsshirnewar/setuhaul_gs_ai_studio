"""Chat agent driver: conversation loop using the OpenAI tool-calling API.

Reads OPENAI_API_KEY, OPENAI_MODEL, and optional OPENAI_BASE_URL from
environment variables (or Streamlit secrets when running in the UI). The
optional base_url lets you use OpenRouter or any other OpenAI-compatible
provider without code changes. Never makes a network call during pytest.

Mock mode: when USE_MOCK_AGENT is set to "true" (env var or Streamlit secret),
run_agent_turn bypasses the LLM and dispatches tools deterministically from the
user's message keywords. This lets the full UI be tested without an API key or
network access.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional

from agent.system_prompt import SYSTEM_PROMPT
from agent.tools import TOOL_SCHEMAS, dispatch
from db import repository as repo

# Load environment variables from a local .env file when present. This lets
# developers put `GEMINI_API_KEY` and `OPENAI_MODEL` in a `.env` file for local
# testing without relying on shell env or Streamlit secrets. `python-dotenv`
# is included in requirements.
try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass


# ---------------------------------------------------------------------------
# Provider configuration (one place to change key / model / base_url)
# ---------------------------------------------------------------------------

def _mock_mode_enabled() -> bool:
    """Check env var or Streamlit secret for mock-agent mode."""
    value = os.environ.get("USE_MOCK_AGENT", "").strip().lower()
    if value in ("1", "true", "yes"):
        return True
    try:
        import streamlit as st  # type: ignore
        if hasattr(st, "secrets"):
            secret = st.secrets.get("USE_MOCK_AGENT", "")
            if str(secret).strip().lower() in ("1", "true", "yes"):
                return True
    except Exception:
        pass
    return False

def _get_llm_client():
    """Return a configured LLM client and selected model.

    This function supports either the OpenAI-compatible client (legacy)
    or the Google Gemini provider. It reads keys from environment variables
    or Streamlit secrets and raises a clear error when the key is absent so
    smoke-tests can check configuration without making a network call.
    """
    # Streamlit secrets may override env vars when running in the UI.
    env = dict(os.environ)
    try:
        import streamlit as st  # type: ignore
        if hasattr(st, "secrets"):
            for k, v in st.secrets.items():
                if v is not None:
                    env.setdefault(k, v)
    except Exception:
        pass

    # This application only supports Google Gemini as the LLM provider.
    # Require an explicit Gemini API key and a model. The model may be set
    # via `OPENAI_MODEL` (keeps backwards compatibility with existing env
    # names); otherwise default to a sensible Gemini identifier.
    api_key = env.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. Export it as an environment variable or add it to .streamlit/secrets.toml."
        )

    model = env.get("OPENAI_MODEL") or env.get("MODEL") or "models/gemini-flash-latest"

    # Import lazily so tests without google-genai still run.
    try:
        from agent.providers.gemini_provider import GeminiProvider
    except Exception as exc:
        raise ImportError(f"Gemini provider not available: {exc}")

    return GeminiProvider(api_key=api_key, model=model), model


# ---------------------------------------------------------------------------
# OpenAI function-call schema builder
# ---------------------------------------------------------------------------

def _build_openai_tools() -> List[Dict[str, Any]]:
    """Convert TOOL_SCHEMAS into the OpenAI tools list format."""
    result = []
    for name, schema in TOOL_SCHEMAS.items():
        params = schema.get("parameters", {})
        required = schema.get("required", [])
        result.append({
            "type": "function",
            "function": {
                "name": name,
                "description": schema["description"],
                "parameters": {
                    "type": "object",
                    "properties": params,
                    "required": required,
                },
            },
        })
    return result


_OPENAI_TOOLS = _build_openai_tools()


# ---------------------------------------------------------------------------
# Conversation loop
# ---------------------------------------------------------------------------

def _mock_run_agent_turn(
    driver_id: str,
    thread_id: Optional[str],
    user_message: str,
    history: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """Deterministic mock agent: maps keywords to tools and returns a safe reply.

    No network call. Useful for UI smoke-testing without an API key.
    """
    import json
    from datetime import datetime, timedelta, timezone

    text = user_message.lower()
    tool_calls_made = []
    history = list(history or [])
    history.append({"role": "user", "content": user_message})

    def run_tool(tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        tool_calls_made.append(tool_name)
        result = dispatch(tool_name, tool_input, driver_id=driver_id, thread_id=thread_id)
        history.append({"role": "tool", "name": tool_name, "content": json.dumps(result)})
        return result

    # Resolve context first.
    context = run_tool("get_my_current_context", {})

    if context["status"] == "escalate":
        reply = "I don't see any active shipments assigned to you right now. I've escalated this to the operations team."
    elif context["status"] == "needs_information":
        choices = "\n".join(f"- {c['order_reference']} to {c['destination_facility']} (ETA {c['expected_eta']})" for c in context["choices"])
        reply = f"You have multiple active shipments. Which order are you referring to?\n{choices}"
    elif "delay" in text or "late" in text or "eta" in text or "arriv" in text:
        # Accept a simple ETA string like "12:30" and assume today for the demo.
        m = re.search(r"(\d{1,2}):(\d{2})", user_message)
        if m:
            hour, minute = int(m.group(1)), int(m.group(2))
            now = datetime.now(timezone.utc)
            eta = now.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()
        else:
            eta = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        result = run_tool("report_delay_or_eta", {"declared_eta_ts": eta, "confidence_code": "MEDIUM", "delay_reason_code": "TRAFFIC"})
        if result.get("exception_created"):
            reply = f"Thanks — I've recorded your new ETA ({eta}) and opened an exception for the operations team."
        else:
            reply = f"Thanks — I've recorded your new ETA ({eta})."
    elif "status" in text:
        status = run_tool("get_my_exception_or_appointment_status", {})
        shipments = status.get("shipments", [])
        if shipments and shipments[0].get("appointment"):
            appt = shipments[0]["appointment"]
            if appt["is_warehouse_confirmed"]:
                reply = f"Your booking is confirmed with warehouse reference {appt['warehouse_confirmation_ref']}."
            elif appt["appointment_status"] == "PENDING_CONFIRMATION":
                reply = "Your booking request is pending warehouse confirmation — capacity is reserved, but it is not confirmed yet."
            else:
                reply = f"Current appointment status: {appt['appointment_status']}."
        else:
            reply = "You don't have an active appointment right now."
    elif re.search(r"\b(book|confirm|take)\b", text):
        # Pick the first feasible option in mock mode (driver already saw options).
        opts = run_tool("get_fresh_feasible_options", {})
        if opts.get("status") == "escalate" or not opts.get("options"):
            reply = "I can't find any options to book. Let me escalate to a coordinator."
        else:
            chosen = opts["options"][0]
            result = run_tool("select_slot", {"slot_id": chosen["slot_id"]})
            if result["status"] == "pending_confirmation":
                reply = (
                    f"Your slot request ({chosen['slot_start_ts']}–{chosen['slot_end_ts']} "
                    f"at dock {chosen['dock_code']}) has been sent to the warehouse. "
                    "Capacity is now reserved pending their confirmation."
                )
            elif result["status"] == "conflict":
                reply = "That slot was just taken. Let me get you fresh options."
                fresh = run_tool("get_fresh_feasible_options", {})
                if fresh.get("options"):
                    lines = [f"{i+1}. {o['slot_start_ts']}–{o['slot_end_ts']} at dock {o['dock_code']}" for i, o in enumerate(fresh["options"][:5])]
                    reply += "\n\nFresh options:\n" + "\n".join(lines)
            else:
                reply = "I couldn't book that slot. A coordinator will help you."
    elif "option" in text or "slot" in text or "available" in text:
        options = run_tool("get_fresh_feasible_options", {})
        if options["status"] == "escalate":
            reply = "I'm unable to find any feasible slots right now. I'm escalating this to a coordinator."
        elif options.get("options"):
            lines = [f"{i+1}. {o['slot_start_ts']}–{o['slot_end_ts']} at dock {o['dock_code']} ({'manual approval needed' if o.get('needs_manual_approval') else 'auto'})" for i, o in enumerate(options["options"][:5])]
            reply = "Here are current available slots:\n" + "\n".join(lines) + "\n\nShowing options does not reserve any slot. Please confirm which one you want."
        else:
            reply = "I couldn't find any available slots right now. A coordinator will help you."
    else:
        reply = "I can help you report a delay, check your booking status, or request a dock slot. What would you like to do?"

    history.append({"role": "assistant", "content": reply})
    return {
        "reply": reply,
        "history": history,
        "tool_calls_made": tool_calls_made,
    }


def run_agent_turn(
    driver_id: str,
    thread_id: Optional[str],
    user_message: str,
    history: Optional[List[Dict[str, Any]]] = None,
    external_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Process one driver message and return the agent's response.

    Args:
        driver_id: Trusted from the server session; never from the driver's text.
        thread_id: Chat thread for message persistence (may be None).
        user_message: The driver's latest message.
        history: Previous messages in OpenAI format (system + assistant + user turns).
                 Pass [] or None for the first turn; the caller is responsible for
                 persisting and re-supplying it between turns.
        external_message_id: Gateway dedup ID if available.

    Returns:
        {
            'reply': str,          # final driver-facing text
            'history': [...],      # updated history to pass on the next call
            'tool_calls_made': [...],  # tool names called in this turn (for logging)
        }
    """
    if _mock_mode_enabled():
        return _mock_run_agent_turn(driver_id, thread_id, user_message, history)

    client, model = _get_llm_client()

    # Persist incoming driver message.
    if thread_id:
        repo.persist_chat_message(
            thread_id, "DRIVER", driver_id, user_message,
            external_message_id=external_message_id,
        )

    messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    tool_calls_made: List[str] = []

    # Tool-calling loop: keep running until the model returns a plain text reply.
    while True:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=_OPENAI_TOOLS,
            tool_choice="auto",
        )
        msg = response.choices[0].message

        if msg.tool_calls:
            # Serialize the assistant's tool-call request as a plain dict.
            tc_list = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in msg.tool_calls
            ]
            messages.append({"role": "assistant", "content": None, "tool_calls": tc_list})

            # Execute each tool call in order.
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                try:
                    tool_input = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    tool_input = {}

                tool_calls_made.append(tool_name)

                tool_result = dispatch(
                    tool_name,
                    tool_input,
                    driver_id=driver_id,
                    thread_id=thread_id,
                    external_message_id=None,
                )

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": tool_name,
                    "content": json.dumps(tool_result),
                })

        else:
            # Model returned a final text reply.
            reply = msg.content or ""
            messages.append({"role": "assistant", "content": reply})

            # Strip the leading system message from persisted history.
            updated_history = messages[1:]

            # Persist outgoing agent message.
            if thread_id:
                repo.persist_chat_message(
                    thread_id, "AGENT", "agent", reply,
                )

            return {
                "reply": reply,
                "history": updated_history,
                "tool_calls_made": tool_calls_made,
            }


def verify_client_configuration() -> Dict[str, Any]:
    """Check that the provider is configured correctly without making a network call.

    Returns a result dict suitable for a smoke test. A network call is NOT made;
    this only checks that the key is present and the openai package is importable.
    """
    try:
        client, model = _get_llm_client()
        return {
            "configured": True,
            "model": model,
            "key_present": True,
            "message": f"LLM client ready. Model: {model}.",
        }
    except EnvironmentError as exc:
        return {
            "configured": False,
            "key_present": False,
            "message": str(exc),
        }
    except ImportError as exc:
        return {
            "configured": False,
            "key_present": False,
            "message": f"Gemini provider not available (missing dependency): {exc}",
        }
