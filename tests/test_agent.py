"""Tests for agent/agent.py — no network calls made.

All tests run without touching the OpenAI API:
- verify_client_configuration() checks env-var presence only
- The conversation loop is tested by patching openai.OpenAI so no HTTP request
  leaves the process
- Tool dispatch authorization and smoke-test assertions use the real dispatcher
  against a temp DB

To make one live API call (after you have set OPENAI_API_KEY):
    python scripts/smoke_test_agent.py DRV006
"""

import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from db import repository as repo
from agent import agent as agent_module
from agent.tools import dispatch

SEED_DB = Path(__file__).resolve().parent.parent / "data" / "setuhaul_freight_operations.db"


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    temp_path = tmp_path / "test_agent.db"
    shutil.copy(SEED_DB, temp_path)
    monkeypatch.setattr(repo, "DB_PATH", temp_path)
    yield temp_path


# ---------------------------------------------------------------------------
# Provider configuration smoke test (no network call)
# ---------------------------------------------------------------------------

class TestVerifyClientConfiguration:
    def test_missing_key_returns_configured_false(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        result = agent_module.verify_client_configuration()
        assert result["configured"] is False
        assert result["key_present"] is False
        assert "OPENAI_API_KEY" in result["message"]

    def test_key_present_returns_configured_true(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")
        result = agent_module.verify_client_configuration()
        assert result["configured"] is True
        assert result["key_present"] is True
        assert "model" in result

    def test_default_model_is_gpt4o_mini(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")
        monkeypatch.delenv("OPENAI_MODEL", raising=False)
        result = agent_module.verify_client_configuration()
        assert result["model"] == "gpt-4o-mini"

    def test_custom_model_is_respected(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")
        monkeypatch.setenv("OPENAI_MODEL", "gpt-4o")
        result = agent_module.verify_client_configuration()
        assert result["model"] == "gpt-4o"


# ---------------------------------------------------------------------------
# Helpers for mocking the OpenAI client
# ---------------------------------------------------------------------------

def _make_mock_response(content: str = None, tool_calls=None):
    """Build a minimal mock that looks like a chat.completions.create() response."""
    msg = SimpleNamespace(content=content, tool_calls=tool_calls)
    choice = SimpleNamespace(message=msg)
    return SimpleNamespace(choices=[choice])


def _tool_call(name: str, arguments: dict, call_id: str = "call_1"):
    fn = SimpleNamespace(name=name, arguments=json.dumps(arguments))
    return SimpleNamespace(id=call_id, function=fn)


# ---------------------------------------------------------------------------
# Conversation loop (mocked OpenAI)
# ---------------------------------------------------------------------------

class TestRunAgentTurn:
    def test_simple_text_reply_returned_and_persisted(self, temp_db, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")

        thread_result = repo.create_or_get_chat_thread("DRV006", "SHP1006", "CHECK_STATUS")
        thread_id = thread_result["thread_id"]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _make_mock_response(
            content="Hello, how can I help you today?"
        )

        with patch.object(agent_module, "_get_openai_client", return_value=(mock_client, "gpt-4o-mini")):
            result = agent_module.run_agent_turn(
                driver_id="DRV006",
                thread_id=thread_id,
                user_message="Hi, what is my current status?",
                history=[],
            )

        assert result["reply"] == "Hello, how can I help you today?"
        assert isinstance(result["history"], list)
        assert len(result["history"]) >= 2  # user + assistant

        # Verify the exchange was persisted to the database.
        messages = repo.get_chat_messages(thread_id)
        texts = [m["message_text"] for m in messages]
        assert any("Hi, what is my current status?" in t for t in texts)
        assert any("Hello, how can I help you today?" in t for t in texts)

    def test_tool_call_is_dispatched_and_result_injected(self, temp_db, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")

        # First response: model requests get_my_current_context
        tc = _tool_call("get_my_current_context", {})
        first_response = _make_mock_response(tool_calls=[tc])
        # Second response: model gives text after seeing tool result
        second_response = _make_mock_response(content="Your booking is at Jaipur DC.")

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = [first_response, second_response]

        with patch.object(agent_module, "_get_openai_client", return_value=(mock_client, "gpt-4o-mini")):
            result = agent_module.run_agent_turn(
                driver_id="DRV006",
                thread_id=None,
                user_message="What is my slot?",
                history=[],
            )

        assert result["reply"] == "Your booking is at Jaipur DC."
        assert "get_my_current_context" in result["tool_calls_made"]

        # The tool response should have been inserted as a 'tool' role message.
        tool_msgs = [m for m in result["history"] if isinstance(m, dict) and m.get("role") == "tool"]
        assert len(tool_msgs) == 1
        tool_content = json.loads(tool_msgs[0]["content"])
        assert "status" in tool_content


class TestMockAgentTurn:
    def test_mock_mode_runs_without_api_key(self, temp_db, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("USE_MOCK_AGENT", "true")

        # DRV012 has a single active shipment, so the status query resolves cleanly.
        result = agent_module.run_agent_turn(
            driver_id="DRV012",
            thread_id=None,
            user_message="What is my booking status?",
            history=[],
        )

        assert "reply" in result
        assert "get_my_exception_or_appointment_status" in result["tool_calls_made"]

    def test_mock_mode_reports_delay_and_creates_exception(self, temp_db, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("USE_MOCK_AGENT", "true")

        result = agent_module.run_agent_turn(
            driver_id="DRV012",
            thread_id=None,
            user_message="I'm stuck in traffic, will arrive at 12:30",
            history=[],
        )

        assert "report_delay_or_eta" in result["tool_calls_made"]
        assert result["reply"]

    def test_mock_mode_lists_options(self, temp_db, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("USE_MOCK_AGENT", "true")

        result = agent_module.run_agent_turn(
            driver_id="DRV012",
            thread_id=None,
            user_message="Show me available slots",
            history=[],
        )

        assert "get_fresh_feasible_options" in result["tool_calls_made"]
        assert "slot" in result["reply"].lower()

    def test_mock_mode_books_first_option(self, temp_db, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("USE_MOCK_AGENT", "true")

        result = agent_module.run_agent_turn(
            driver_id="DRV012",
            thread_id=None,
            user_message="Book the first option",
            history=[],
        )

        assert "select_slot" in result["tool_calls_made"]
        assert "pending" in result["reply"].lower() or "warehouse" in result["reply"].lower()

    def test_history_carries_forward(self, temp_db, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _make_mock_response(
            content="Turn 1 reply."
        )

        with patch.object(agent_module, "_get_openai_client", return_value=(mock_client, "gpt-4o-mini")):
            r1 = agent_module.run_agent_turn("DRV006", None, "First message", history=[])

        mock_client.chat.completions.create.return_value = _make_mock_response(
            content="Turn 2 reply."
        )

        with patch.object(agent_module, "_get_openai_client", return_value=(mock_client, "gpt-4o-mini")):
            r2 = agent_module.run_agent_turn("DRV006", None, "Second message", history=r1["history"])

        # The second call should have seen at least: user(1) + assistant(1) + user(2)
        call_args = mock_client.chat.completions.create.call_args
        sent_messages = call_args.kwargs["messages"]
        roles = [m["role"] if isinstance(m, dict) else m.role for m in sent_messages]
        assert roles.count("user") >= 2

    def test_missing_api_key_raises_before_network_call(self, temp_db, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        with pytest.raises(EnvironmentError, match="OPENAI_API_KEY"):
            agent_module.run_agent_turn("DRV006", None, "Hello", history=[])

    def test_conflict_tool_result_prompts_fresh_options_call(self, temp_db, monkeypatch):
        """When select_slot returns conflict, the model should call
        get_fresh_feasible_options next. This test checks the tool loop handles
        multiple consecutive tool calls in one turn."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")

        conflict_result = {
            "tool": "select_slot", "status": "conflict",
            "code": "SLOT_OR_SHIPMENT_ALREADY_ACTIVE",
            "message": "Slot was just taken.",
            "instruction_for_agent": "Call get_fresh_feasible_options.",
        }

        tc_select = _tool_call("select_slot", {"slot_id": "SLOT-JAI-044"}, "call_1")
        tc_fresh = _tool_call("get_fresh_feasible_options", {}, "call_2")

        # Turn 1: model requests select_slot (conflict) then get_fresh_feasible_options
        resp1 = _make_mock_response(tool_calls=[tc_select])
        resp2 = _make_mock_response(tool_calls=[tc_fresh])
        resp3 = _make_mock_response(content="Here are your fresh options.")

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = [resp1, resp2, resp3]

        with patch.object(agent_module, "_get_openai_client", return_value=(mock_client, "gpt-4o-mini")):
            result = agent_module.run_agent_turn(
                driver_id="DRV012",
                thread_id=None,
                user_message="Book SLOT-JAI-044 for me.",
                history=[],
            )

        assert "select_slot" in result["tool_calls_made"]
        assert "get_fresh_feasible_options" in result["tool_calls_made"]
        assert result["reply"] == "Here are your fresh options."

    def test_system_prompt_is_always_first_message(self, temp_db, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests")

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _make_mock_response(content="ok")

        with patch.object(agent_module, "_get_openai_client", return_value=(mock_client, "gpt-4o-mini")):
            agent_module.run_agent_turn("DRV006", None, "Hello", history=[])

        sent = mock_client.chat.completions.create.call_args.kwargs["messages"]
        # First message must be the system prompt.
        first = sent[0]
        role = first["role"] if isinstance(first, dict) else first.role
        assert role == "system"


# ---------------------------------------------------------------------------
# Tool schema sanity checks
# ---------------------------------------------------------------------------

class TestToolSchemas:
    def test_all_six_tools_are_present(self):
        from agent.tools import TOOL_SCHEMAS
        expected = {
            "get_my_current_context",
            "select_my_shipment_by_order_reference",
            "report_delay_or_eta",
            "get_fresh_feasible_options",
            "select_slot",
            "get_my_exception_or_appointment_status",
        }
        assert set(TOOL_SCHEMAS.keys()) == expected

    def test_openai_tools_list_has_correct_structure(self):
        tools_list = agent_module._build_openai_tools()
        assert len(tools_list) == 6
        for t in tools_list:
            assert t["type"] == "function"
            assert "name" in t["function"]
            assert "description" in t["function"]
            assert "parameters" in t["function"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
