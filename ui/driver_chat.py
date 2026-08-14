"""Driver chat page: renders the driver-facing conversation UI.

All business logic and database access go through agent.agent.run_agent_turn.
This file contains only display and session-state management.
"""

import streamlit as st

from agent.agent import run_agent_turn, verify_client_configuration
from db import repository as repo

# Drivers available in developer mode.  In production this would come from auth.
_DEMO_DRIVERS = {
    "DRV006 — SHP1006 (delay scenario, confirmed slot)": "DRV006",
    "DRV012 — SHP1012 (in-transit, rebooking needed)":  "DRV012",
    "DRV004 — two active shipments (ambiguity scenario)": "DRV004",
    "DRV015 — SHP1015 (reefer, maintenance conflict)":  "DRV015",
    "DRV007 — SHP1016 (heavy dock)":                    "DRV007",
}

# Status badge text — surfaces booking state unambiguously in the UI.
_STATUS_BADGE = {
    "pending_confirmation": "🟡 PENDING — capacity reserved, warehouse confirmation still required",
    "confirmed":            "✅ CONFIRMED — warehouse has accepted your booking",
    "conflict":             "🔴 CONFLICT — slot was taken; refreshed options shown below",
    "escalate":             "⚠️  ESCALATED — operations team has been notified",
    "needs_information":    "ℹ️  CLARIFICATION NEEDED",
}


def _session_key(driver_id: str) -> str:
    return f"chat_history_{driver_id}"


def _thread_key(driver_id: str) -> str:
    return f"thread_id_{driver_id}"


def _ensure_thread(driver_id: str) -> str:
    """Return the persistent thread_id for this driver, creating it if needed."""
    key = _thread_key(driver_id)
    if key not in st.session_state:
        result = repo.create_or_get_chat_thread(driver_id, None, "UNKNOWN")
        st.session_state[key] = result["thread_id"]
    return st.session_state[key]


def _load_history_from_db(driver_id: str, thread_id: str):
    """Populate session history from the database if the UI was just opened."""
    key = _session_key(driver_id)
    if key in st.session_state:
        return  # already loaded in this session

    messages = repo.get_chat_messages(thread_id, limit=100)
    history = []
    for m in messages:
        if m.get("is_duplicate"):
            continue
        role = "user" if m["sender_type"] == "DRIVER" else "assistant"
        history.append({"role": role, "content": m["message_text"]})
    st.session_state[key] = history


def _render_message(role: str, content: str):
    """Render one chat bubble, suppressing any accidental internal-ID leakage."""
    with st.chat_message(role):
        st.markdown(content)


def render_driver_chat():
    """Render the full driver chat page."""
    # ------------------------------------------------------------------ #
    # Page header                                                          #
    # ------------------------------------------------------------------ #
    st.title("SetuHaul Driver Chat")
    st.caption(
        "Report delays, request dock slots, and check your booking status. "
        "This assistant cannot book a slot unless you explicitly confirm a specific option."
    )

    # ------------------------------------------------------------------ #
    # Developer-only sidebar: identity picker                              #
    # ------------------------------------------------------------------ #
    with st.sidebar:
        st.header("🔧 Developer mode")
        st.warning("Driver identity is fixed by the server session. This picker is for demo only.")

        label = st.selectbox(
            "Demo driver",
            options=list(_DEMO_DRIVERS.keys()),
            key="demo_driver_label",
        )
        driver_id = _DEMO_DRIVERS[label]
        st.info(f"Session driver: **{driver_id}**")

        # Config check displayed in sidebar so operators can see it.
        config = verify_client_configuration()
        if config["configured"]:
            st.success(f"LLM ready — {config['model']}")
        else:
            st.error(f"LLM not configured:\n{config['message']}")

        # Effective environment values (helpful when debugging model/key issues).
        import os
        st.caption(
            f"Env: GEMINI_API_KEY={'set' if os.environ.get('GEMINI_API_KEY') else 'missing'}, "
            f"OPENAI_MODEL={os.environ.get('OPENAI_MODEL', 'not set')}"
        )

        # Mock mode indicator — no API key needed.
        import os
        mock_enabled = os.environ.get("USE_MOCK_AGENT", "false")
        if str(mock_enabled).strip().lower() in ("1", "true", "yes"):
            st.success("🧪 Mock agent mode is ON — no API key needed")
        else:
            st.info("Mock agent mode is OFF")

    # ------------------------------------------------------------------ #
    # Session state initialisation                                         #
    # ------------------------------------------------------------------ #
    thread_id = _ensure_thread(driver_id)
    _load_history_from_db(driver_id, thread_id)

    history_key = _session_key(driver_id)
    # history stores OpenAI-format dicts: {"role": "user"/"assistant", "content": str}
    if history_key not in st.session_state:
        st.session_state[history_key] = []

    # ------------------------------------------------------------------ #
    # Render existing conversation                                         #
    # ------------------------------------------------------------------ #
    for msg in st.session_state[history_key]:
        _render_message(msg["role"], msg["content"])

    # ------------------------------------------------------------------ #
    # Driver input                                                         #
    # ------------------------------------------------------------------ #
    user_input = st.chat_input("Type your message…")

    if not user_input:
        return

    # Show the driver's message immediately.
    _render_message("user", user_input)
    st.session_state[history_key].append({"role": "user", "content": user_input})

    # ------------------------------------------------------------------ #
    # Agent turn                                                           #
    # ------------------------------------------------------------------ #
    # Pass only the turn history (no system prompt) from session state.
    # The agent function prepends the system prompt internally.
    agent_history = [
        m for m in st.session_state[history_key][:-1]  # all but the just-added user msg
        if m["role"] in ("user", "assistant")
    ]

    with st.chat_message("assistant"):
        placeholder = st.empty()
        placeholder.markdown("⏳ Thinking…")

        try:
            import os
            is_mock = os.environ.get("USE_MOCK_AGENT", "").strip().lower() in ("1", "true", "yes")
            if not is_mock and not verify_client_configuration()["configured"]:
                raise EnvironmentError(
                    "OpenAI API key is not configured. "
                    "Add OPENAI_API_KEY to your environment or .streamlit/secrets.toml, "
                    "or enable mock mode with USE_MOCK_AGENT=true."
                )

            result = run_agent_turn(
                driver_id=driver_id,          # trusted session value — never from chat text
                thread_id=thread_id,
                user_message=user_input,
                history=agent_history,
            )

            reply = result["reply"]

            # Detect booking-status keywords in the raw tool calls for the badge.
            badge = None
            tool_results_in_history = [
                m for m in result.get("history", [])
                if isinstance(m, dict) and m.get("role") == "tool"
            ]
            for tm in tool_results_in_history:
                import json
                try:
                    payload = json.loads(tm.get("content", "{}"))
                    s = payload.get("status")
                    if s in _STATUS_BADGE:
                        badge = s
                except Exception:
                    pass

            # Render reply and optional status badge.
            placeholder.markdown(reply)
            if badge:
                st.info(_STATUS_BADGE[badge])

        except EnvironmentError as exc:
            reply = (
                "⚠️  The assistant is not available right now — "
                f"the API key needs to be configured. "
                "You can also enable mock mode with `USE_MOCK_AGENT=true`. "
                "Please contact your coordinator.\n\n"
                f"*(Technical detail: {exc})*"
            )
            placeholder.markdown(reply)

        except Exception as exc:
            import logging, traceback
            logging.error("run_agent_turn failed: %s", exc, exc_info=True)
            traceback.print_exc()

            # Provide a slightly more actionable message when the error looks
            # like an LLM/provider configuration issue (API key / model access).
            exc_text = str(exc)
            if "Gemini API request failed" in exc_text or "API key" in exc_text or "Model" in exc_text:
                reply = (
                    "⚠️  The assistant couldn't reach the LLM service due to a configuration or access error. "
                    "Please check that `GEMINI_API_KEY` (or `OPENAI_API_KEY`) and `OPENAI_MODEL` are set and valid. "
                    "If you need to test without a key, enable mock mode with `USE_MOCK_AGENT=true`."
                )
            else:
                reply = (
                    "⚠️  Something went wrong on our side. "
                    "Your message has been saved — please try again in a moment, "
                    "or speak to your coordinator if the problem continues."
                )

            placeholder.markdown(reply)

            # Surface the full error in the sidebar for developers.
            with st.sidebar:
                with st.expander("Last error (developer only)", expanded=False):
                    st.write("Exception message:")
                    st.markdown("```\n" + exc_text + "\n```")
                    st.exception(exc)

    st.session_state[history_key].append({"role": "assistant", "content": reply})

    # Update the persisted turn history from the agent result so subsequent
    # turns carry full tool context (tool-role messages, etc.).
    if "result" in dir() and isinstance(result, dict):  # only if run_agent_turn succeeded
        # Merge tool-role entries from agent history back into session state for
        # fidelity; the UI loop only renders user/assistant roles.
        st.session_state[f"agent_history_{driver_id}"] = result.get("history", [])

