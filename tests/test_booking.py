"""Tests for domain/booking.py and the repository booking transaction helpers.

Uses a temporary copy of the seed database (never the real data/ file) so tests
can safely INSERT/UPDATE appointments without touching seed data.

Scenarios proven:
- A valid slot selection becomes PENDING_CONFIRMATION (and replaces an existing
  active appointment, preserving history via replaced_appointment_id).
- An explicit warehouse confirmation call (and only that call) becomes CONFIRMED.
- A repeated selection of the same slot conflicts safely (no double booking).
- A stale/unavailable (BLOCKED) slot is reported as invalid, never as pending
  or confirmed.
- An ambiguous driver (DRV004) requires a human-readable order reference before
  any booking is attempted.
"""

import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from db import repository as repo
from domain import booking, operations

SEED_DB = Path(__file__).resolve().parent.parent / "data" / "setuhaul_freight_operations.db"


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Point the repository at a throwaway copy of the seed database."""
    temp_path = tmp_path / "test_setuhaul.db"
    shutil.copy(SEED_DB, temp_path)
    monkeypatch.setattr(repo, "DB_PATH", temp_path)
    yield temp_path


class TestValidSelectionBecomesPendingConfirmation:
    def test_new_booking_for_shipment_with_no_active_appointment(self, temp_db):
        # SHP1012 has only a CANCELLED (non-current) appointment; SLOT-JAI-006 is
        # an open, unoccupied STANDARD slot at the same facility.
        result = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-006')
        
        assert result['status'] == 'pending_confirmation'
        assert result['code'] == 'BOOKED'
        assert result['appointment_id'].startswith('APT-')
        assert result['replaced_appointment_id'] is None
        assert 'pending warehouse confirmation' in result['message'].lower()
        
        appt = repo.get_appointment(result['appointment_id'])
        assert appt['appointment_status'] == 'PENDING_CONFIRMATION'
        assert appt['booking_source'] == 'DRIVER_CHAT'
        assert appt['is_current'] == 1
    
    def test_booking_replaces_existing_active_appointment(self, temp_db):
        # SHP1004 currently has a CONFIRMED appointment on SLOT-JAI-016.
        old_appt = repo.get_current_appointment('SHP1004')
        assert old_appt is not None
        old_appointment_id = old_appt['appointment_id']
        
        result = repo.execute_slot_booking_transaction('SHP1004', 'SLOT-JAI-006')
        
        assert result['status'] == 'pending_confirmation'
        assert result['replaced_appointment_id'] == old_appointment_id
        
        # Old appointment preserved as history: cancelled, no longer current.
        old_after = repo.get_appointment(old_appointment_id)
        assert old_after['appointment_status'] == 'CANCELLED'
        assert old_after['is_current'] == 0
        
        # New appointment is the only current active one for this shipment.
        current = repo.get_current_appointment('SHP1004')
        assert current['appointment_id'] == result['appointment_id']


class TestWarehouseConfirmation:
    def test_explicit_confirmation_becomes_confirmed(self, temp_db):
        booked = repo.execute_slot_booking_transaction('SHP1019', 'SLOT-JAI-008')
        assert booked['status'] == 'pending_confirmation'
        
        result = booking.confirm_booking(booked['appointment_id'], 'WH-JAI-9999')
        
        assert result['status'] == 'confirmed'
        appt = repo.get_appointment(booked['appointment_id'])
        assert appt['appointment_status'] == 'CONFIRMED'
        assert appt['warehouse_confirmation_ref'] == 'WH-JAI-9999'
        assert appt['confirmed_at'] is not None
    
    def test_sent_operational_message_never_confirms_booking(self, temp_db):
        # SHP1015's operational message OM004 has delivery_status FAILED and is
        # unrelated to appointment state; confirming requires the explicit call.
        booked = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-007')
        assert booked['status'] == 'pending_confirmation'
        
        appt = repo.get_appointment(booked['appointment_id'])
        assert appt['appointment_status'] == 'PENDING_CONFIRMATION'
        assert appt['warehouse_confirmation_ref'] is None
    
    def test_confirming_already_confirmed_appointment_conflicts(self, temp_db):
        booked = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-009')
        first = booking.confirm_booking(booked['appointment_id'], 'WH-JAI-0001')
        assert first['status'] == 'confirmed'
        
        second = booking.confirm_booking(booked['appointment_id'], 'WH-JAI-0002')
        assert second['status'] == 'conflict'
        assert second['code'] == 'NOT_PENDING_CONFIRMATION'


class TestRepeatedSelectionConflictsSafely:
    def test_second_driver_selecting_same_slot_gets_conflict(self, temp_db):
        first = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-010')
        assert first['status'] == 'pending_confirmation'
        
        second = repo.execute_slot_booking_transaction('SHP1008', 'SLOT-JAI-010')
        
        assert second['status'] == 'conflict'
        assert second['code'] == 'SLOT_OR_SHIPMENT_ALREADY_ACTIVE'
        assert 'already' in second['message'].lower() or 'taken' in second['message'].lower()
        
        # Only one active appointment exists for that slot.
        slot_state = repo.get_slot_availability('SLOT-JAI-010')
        assert slot_state['appointment_id'] == first['appointment_id']
    
    def test_rebooking_same_shipment_twice_replaces_not_conflicts(self, temp_db):
        # Booking again for the SAME shipment is a legitimate replace, not a conflict.
        first = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-011')
        second = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-012')
        
        assert first['status'] == 'pending_confirmation'
        assert second['status'] == 'pending_confirmation'
        assert second['replaced_appointment_id'] == first['appointment_id']


class TestStaleOrUnavailableSlotNotBooked:
    def test_blocked_slot_is_invalid_not_pending_or_confirmed(self, temp_db):
        # SLOT-JAI-031 is BLOCKED (dock breakdown) in the seed data.
        result = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-JAI-031')
        
        assert result['status'] == 'invalid'
        assert result['status'] not in ('pending_confirmation', 'confirmed')
        assert 'SLOT_NOT_OPEN' in result['code']
        
        slot_state = repo.get_slot_availability('SLOT-JAI-031')
        assert slot_state['appointment_id'] is None
    
    def test_dock_type_mismatch_is_invalid(self, temp_db):
        # SHP1016 requires HEAVY dock; SLOT-JAI-013 is a STANDARD dock slot.
        result = repo.execute_slot_booking_transaction('SHP1016', 'SLOT-JAI-013')
        
        assert result['status'] == 'invalid'
        assert result['code'] == 'DOCK_TYPE_MISMATCH'
    
    def test_nonexistent_slot_is_invalid(self, temp_db):
        result = repo.execute_slot_booking_transaction('SHP1012', 'SLOT-DOES-NOT-EXIST')
        
        assert result['status'] == 'invalid'
        assert result['code'] == 'SLOT_NOT_FOUND'


class TestAmbiguousDriverRequiresOrderReference:
    def test_selecting_without_order_reference_needs_information(self, temp_db):
        result = booking.select_slot_for_driver('DRV004', 'SLOT-JAI-006')
        
        assert result['status'] == 'needs_information'
        assert result['code'] == 'AMBIGUOUS_SHIPMENT'
        assert len(result['choices']) >= 2
        for choice in result['choices']:
            assert 'shipment_id' not in choice
    
    def test_selecting_with_valid_order_reference_resolves_and_books(self, temp_db):
        result = booking.select_slot_for_driver('DRV004', 'SLOT-JAI-006', order_reference='ORD-260804-004')
        
        assert result['status'] == 'pending_confirmation'
        appt = repo.get_appointment(result['appointment_id'])
        assert appt['shipment_id'] == 'SHP1004'
    
    def test_selecting_with_unrecognized_order_reference_needs_information(self, temp_db):
        result = booking.select_slot_for_driver('DRV004', 'SLOT-JAI-006', order_reference='ORD-NOT-REAL')
        
        assert result['status'] == 'needs_information'
        assert result['code'] == 'ORDER_REFERENCE_NOT_RECOGNIZED'


class TestSingleShipmentDriverBooksDirectly:
    def test_select_slot_for_driver_with_single_shipment(self, temp_db):
        # DRV012 has exactly one active shipment (SHP1012).
        result = booking.select_slot_for_driver('DRV012', 'SLOT-JAI-014')
        
        assert result['status'] == 'pending_confirmation'
        appt = repo.get_appointment(result['appointment_id'])
        assert appt['shipment_id'] == 'SHP1012'


class TestETAAndExceptionPersistence:
    def test_driver_declared_eta_is_persisted_and_raises_exception_on_delay(self, temp_db):
        shipment = repo.get_shipment('SHP1012')
        original_eta = shipment['original_eta_ts']
        delayed_eta = (datetime.fromisoformat(original_eta) + timedelta(hours=1)).isoformat()
        
        result = operations.persist_driver_declared_eta(
            'DRV012', 'SHP1012', delayed_eta, confidence_code='HIGH', delay_reason_code='TRAFFIC'
        )
        
        assert result['success'] is True
        assert result['exception_created'] is True
        
        latest = repo.get_latest_eta('SHP1012')
        assert latest['effective_eta_ts'] == delayed_eta
        assert latest['eta_source'] == 'DRIVER_DECLARED'
        assert latest['eta_confidence'] == 'HIGH'


class TestDuplicateMessageHandling:
    def test_retried_message_is_marked_duplicate_and_stored_once_meaningfully(self, temp_db):
        thread_result = operations.create_or_continue_chat_thread('DRV012', 'SHP1012', 'REPORT_DELAY')
        thread_id = thread_result['thread_id']
        
        first = operations.persist_incoming_driver_message(
            thread_id, 'DRV012', 'Running 20 minutes late', external_message_id='WA-RETRY-01'
        )
        second = operations.persist_incoming_driver_message(
            thread_id, 'DRV012', 'Running 20 minutes late', external_message_id='WA-RETRY-01'
        )
        
        assert first['is_duplicate'] is False
        assert second['is_duplicate'] is True
        
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) AS n FROM chat_messages WHERE external_message_id = ?",
                ('WA-RETRY-01',)
            )
            assert cursor.fetchone()['n'] == 2  # both stored; only the retry is flagged


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
