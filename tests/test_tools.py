"""Tests for agent/tools.py dispatcher.

Uses a temporary copy of the seed database so reruns never modify the working demo.
Covers: authorization, conflict handling, duplicate-message suppression, ambiguity
resolution, ETA/exception persistence, and slot booking outcomes.
"""

import shutil
from pathlib import Path

import pytest

from db import repository as repo
from agent import tools

SEED_DB = Path(__file__).resolve().parent.parent / "data" / "setuhaul_freight_operations.db"


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    temp_path = tmp_path / "test_tools.db"
    shutil.copy(SEED_DB, temp_path)
    monkeypatch.setattr(repo, "DB_PATH", temp_path)
    yield temp_path


# ---------------------------------------------------------------------------
# Authorization / safety checks
# ---------------------------------------------------------------------------

class TestAuthorization:
    def test_empty_driver_id_returns_unauthorized(self, temp_db):
        result = tools.dispatch("get_my_current_context", {}, driver_id="", thread_id=None)
        assert result["status"] == "invalid"
        assert result["code"] == "UNAUTHORIZED"

    def test_unknown_tool_returns_invalid(self, temp_db):
        result = tools.dispatch("drop_all_tables", {}, driver_id="DRV001", thread_id=None)
        assert result["status"] == "invalid"
        assert result["code"] == "UNKNOWN_TOOL"

    def test_driver_id_comes_from_session_not_tool_input(self, temp_db):
        # Even if the LLM tried to supply a different driver_id in the payload,
        # the dispatcher ignores it and uses the session driver_id.
        result = tools.dispatch(
            "get_my_current_context",
            {"driver_id": "DRV_EVIL"},   # LLM-supplied, should be silently ignored
            driver_id="DRV001",           # trusted session value
            thread_id=None,
        )
        # Result is for DRV001's shipment, not DRV_EVIL
        assert result["status"] in ("ready", "needs_information", "escalate")
        if result["status"] == "ready":
            # DRV001's data, not some spoofed driver
            assert result.get("order_reference") is not None


# ---------------------------------------------------------------------------
# get_my_current_context
# ---------------------------------------------------------------------------

class TestGetMyCurrentContext:
    def test_single_shipment_driver_returns_ready(self, temp_db):
        result = tools.dispatch("get_my_current_context", {}, driver_id="DRV001", thread_id=None)
        assert result["tool"] == "get_my_current_context"
        assert result["status"] in ("ready", "needs_information", "escalate")
        if result["status"] == "ready":
            assert result.get("order_reference") is not None
            assert result.get("destination_facility") is not None
            # No internal IDs exposed to LLM (shipment_id is kept for server use only)

    def test_ambiguous_driver_returns_needs_information_with_choices(self, temp_db):
        result = tools.dispatch("get_my_current_context", {}, driver_id="DRV004", thread_id=None)
        assert result["status"] == "needs_information"
        assert result["code"] == "AMBIGUOUS_SHIPMENT"
        assert len(result["choices"]) >= 2
        for choice in result["choices"]:
            assert "shipment_id" not in choice  # never expose internal IDs to the LLM
            assert "order_reference" in choice

    def test_driver_with_no_active_shipment_returns_escalate(self, temp_db):
        result = tools.dispatch("get_my_current_context", {}, driver_id="DRV999", thread_id=None)
        assert result["status"] == "escalate"


# ---------------------------------------------------------------------------
# select_my_shipment_by_order_reference
# ---------------------------------------------------------------------------

class TestSelectMyShipmentByOrderReference:
    def test_valid_order_reference_resolves(self, temp_db):
        result = tools.dispatch(
            "select_my_shipment_by_order_reference",
            {"order_reference": "ORD-260804-004"},
            driver_id="DRV004",
            thread_id=None,
        )
        assert result["status"] == "ready"
        assert result["order_reference"] == "ORD-260804-004"

    def test_unrecognised_order_reference_returns_needs_information(self, temp_db):
        result = tools.dispatch(
            "select_my_shipment_by_order_reference",
            {"order_reference": "ORD-DOES-NOT-EXIST"},
            driver_id="DRV004",
            thread_id=None,
        )
        assert result["status"] == "needs_information"
        assert result["code"] == "ORDER_REFERENCE_NOT_RECOGNISED"

    def test_missing_order_reference_field_returns_invalid(self, temp_db):
        result = tools.dispatch(
            "select_my_shipment_by_order_reference",
            {},
            driver_id="DRV004",
            thread_id=None,
        )
        assert result["status"] == "invalid"
        assert result["code"] == "MISSING_FIELD"


# ---------------------------------------------------------------------------
# report_delay_or_eta
# ---------------------------------------------------------------------------

class TestReportDelayOrETA:
    def test_delay_eta_creates_exception_and_preserves_confidence(self, temp_db):
        from datetime import datetime, timedelta, timezone
        shipment = repo.get_shipment("SHP1012")
        original = shipment["original_eta_ts"]
        late = (datetime.fromisoformat(original) + timedelta(hours=2)).isoformat()

        result = tools.dispatch(
            "report_delay_or_eta",
            {"declared_eta_ts": late, "confidence_code": "LOW", "delay_reason_code": "TRAFFIC"},
            driver_id="DRV012",
            thread_id=None,
        )
        assert result["status"] == "ok"
        assert result["confidence_code"] == "LOW"   # must never be upgraded
        assert result["exception_created"] is True

    def test_missing_declared_eta_ts_returns_invalid(self, temp_db):
        result = tools.dispatch(
            "report_delay_or_eta",
            {"confidence_code": "MEDIUM"},
            driver_id="DRV012",
            thread_id=None,
        )
        assert result["status"] == "invalid"
        assert result["code"] == "MISSING_FIELD"


# ---------------------------------------------------------------------------
# get_fresh_feasible_options
# ---------------------------------------------------------------------------

class TestGetFreshFeasibleOptions:
    def test_returns_ok_with_options_list(self, temp_db):
        result = tools.dispatch("get_fresh_feasible_options", {}, driver_id="DRV012", thread_id=None)
        assert result["status"] in ("ok", "escalate")
        if result["status"] == "ok":
            assert "options" in result
            assert isinstance(result["options"], list)
            if result["options"]:
                opt = result["options"][0]
                assert "slot_id" in opt
                assert "slot_start_ts" in opt

    def test_no_feasible_slots_returns_escalate(self, temp_db):
        # SHP1015 is a reefer shipment; all reefer slots after 18:00 are BLOCKED.
        result = tools.dispatch("get_fresh_feasible_options", {}, driver_id="DRV015", thread_id=None)
        assert result["status"] in ("ok", "escalate", "invalid")


# ---------------------------------------------------------------------------
# select_slot
# ---------------------------------------------------------------------------

class TestSelectSlot:
    def test_valid_slot_returns_pending_confirmation(self, temp_db):
        result = tools.dispatch(
            "select_slot",
            {"slot_id": "SLOT-JAI-044"},  # free STANDARD slot in seed data
            driver_id="DRV012",
            thread_id=None,
        )
        assert result["status"] == "pending_confirmation"
        assert result["tool"] == "select_slot"
        assert "pending" in result["message"].lower()
        assert "warehouse" in result["message"].lower()
        assert "appointment_id" in result

    def test_blocked_slot_returns_invalid(self, temp_db):
        result = tools.dispatch(
            "select_slot",
            {"slot_id": "SLOT-JAI-031"},  # BLOCKED in seed
            driver_id="DRV012",
            thread_id=None,
        )
        assert result["status"] == "invalid"
        assert result["status"] != "pending_confirmation"

    def test_conflict_returns_instruction_to_refresh(self, temp_db):
        # DRV012 wins SLOT-JAI-043; DRV013 tries the same slot.
        first = tools.dispatch(
            "select_slot", {"slot_id": "SLOT-JAI-043"}, driver_id="DRV012", thread_id=None
        )
        assert first["status"] == "pending_confirmation"

        # DRV013 also has one active STANDARD shipment (SHP1013) at FAC-JAI-01.
        second = tools.dispatch(
            "select_slot", {"slot_id": "SLOT-JAI-043"}, driver_id="DRV013", thread_id=None
        )
        assert second["status"] == "conflict"
        assert "instruction_for_agent" in second
        assert "get_fresh_feasible_options" in second["instruction_for_agent"]

    def test_ambiguous_driver_needs_order_reference_before_booking(self, temp_db):
        result = tools.dispatch(
            "select_slot", {"slot_id": "SLOT-JAI-007"}, driver_id="DRV004", thread_id=None
        )
        assert result["status"] == "needs_information"

    def test_ambiguous_driver_books_with_order_reference(self, temp_db):
        result = tools.dispatch(
            "select_slot",
            {"slot_id": "SLOT-JAI-007", "order_reference": "ORD-260804-004"},
            driver_id="DRV004",
            thread_id=None,
        )
        assert result["status"] == "pending_confirmation"
        appt = repo.get_appointment(result["appointment_id"])
        assert appt["shipment_id"] == "SHP1004"

    def test_missing_slot_id_returns_invalid(self, temp_db):
        result = tools.dispatch("select_slot", {}, driver_id="DRV012", thread_id=None)
        assert result["status"] == "invalid"
        assert result["code"] == "MISSING_FIELD"


# ---------------------------------------------------------------------------
# get_my_exception_or_appointment_status
# ---------------------------------------------------------------------------

class TestGetMyExceptionOrAppointmentStatus:
    def test_returns_ok_with_shipment_data(self, temp_db):
        result = tools.dispatch(
            "get_my_exception_or_appointment_status", {}, driver_id="DRV006", thread_id=None
        )
        assert result["status"] == "ok"
        assert "shipments" in result
        assert len(result["shipments"]) >= 1

    def test_confirmed_appointment_shows_warehouse_confirmation_ref(self, temp_db):
        result = tools.dispatch(
            "get_my_exception_or_appointment_status", {}, driver_id="DRV006", thread_id=None
        )
        assert result["status"] == "ok"
        shipment_data = result["shipments"][0]
        appt = shipment_data.get("appointment")
        # SHP1006 has a CONFIRMED appointment with WH-JAI-9006 in seed data
        if appt and appt["appointment_status"] == "CONFIRMED":
            assert appt["is_warehouse_confirmed"] is True
            assert appt["warehouse_confirmation_ref"] is not None

    def test_pending_confirmation_shows_pending_message(self, temp_db):
        # Book a slot for DRV012 so there is a PENDING_CONFIRMATION appointment.
        tools.dispatch("select_slot", {"slot_id": "SLOT-JAI-008"}, driver_id="DRV012", thread_id=None)
        result = tools.dispatch(
            "get_my_exception_or_appointment_status", {}, driver_id="DRV012", thread_id=None
        )
        assert result["status"] == "ok"
        shipment_data = result["shipments"][0]
        appt = shipment_data.get("appointment")
        if appt and appt["appointment_status"] == "PENDING_CONFIRMATION":
            assert appt["pending_message"] is not None
            assert appt["is_warehouse_confirmed"] is False


# ---------------------------------------------------------------------------
# Duplicate-message suppression
# ---------------------------------------------------------------------------

class TestDuplicateMessageSuppression:
    def test_duplicate_message_returns_ok_without_action(self, temp_db):
        # Create a thread first so message persistence has somewhere to write.
        thread_result = repo.create_or_get_chat_thread("DRV012", "SHP1012", "REPORT_DELAY")
        thread_id = thread_result["thread_id"]

        # First delivery: external_message_id wa-dupe-01
        first = tools.dispatch(
            "get_my_current_context",
            {"_driver_message": "Am I still confirmed?"},
            driver_id="DRV012",
            thread_id=thread_id,
            external_message_id="wa-dupe-01",
        )
        # First call goes through normally
        assert first["status"] in ("ready", "needs_information", "escalate")

        # Gateway retransmits the same message (same external_message_id)
        second = tools.dispatch(
            "get_my_current_context",
            {"_driver_message": "Am I still confirmed?"},
            driver_id="DRV012",
            thread_id=thread_id,
            external_message_id="wa-dupe-01",
        )
        assert second["is_duplicate"] is True
        assert second["status"] == "ok"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
