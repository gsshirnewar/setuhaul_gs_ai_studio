"""Concurrency proof: two real threads racing for the same slot.

This is the key evidence that the chat agent cannot double-book a slot: the
database's partial unique index (ux_active_appointment_per_slot), combined
with BEGIN IMMEDIATE in db.repository.execute_slot_booking_transaction, means
only one of two simultaneous requests for the same slot can ever succeed.

Runs against a temporary copy of the seed database; the real working database
is never touched.
"""

import queue
import shutil
import threading
from pathlib import Path

import pytest

from db import repository as repo

SEED_DB = Path(__file__).resolve().parent.parent / "data" / "setuhaul_freight_operations.db"


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Point the repository at a throwaway copy of the seed database."""
    temp_path = tmp_path / "test_setuhaul_concurrency.db"
    shutil.copy(SEED_DB, temp_path)
    monkeypatch.setattr(repo, "DB_PATH", temp_path)
    yield temp_path


class TestSimultaneousBookingRequests:
    def test_two_threads_same_slot_exactly_one_pending_one_conflict(self, temp_db):
        """Two different shipments race for SLOT-JAI-020 at (almost) the same instant.
        
        SHP1012 and SHP1008 are both real seeded shipments with no current active
        appointment, both STANDARD dock, both compatible with SLOT-JAI-020 (a real,
        open, unoccupied STANDARD slot at FAC-JAI-01). No fake IDs are constructed.
        """
        results = queue.Queue()
        # Barrier(3): both worker threads plus this thread all release together,
        # so the two booking attempts start as close to simultaneously as possible.
        start_barrier = threading.Barrier(3)
        
        def attempt(shipment_id):
            start_barrier.wait()
            result = repo.execute_slot_booking_transaction(shipment_id, 'SLOT-JAI-020')
            results.put(result)
        
        t1 = threading.Thread(target=attempt, args=('SHP1012',))
        t2 = threading.Thread(target=attempt, args=('SHP1008',))
        t1.start()
        t2.start()
        start_barrier.wait()  # release both threads together
        t1.join(timeout=10)
        t2.join(timeout=10)
        
        assert not t1.is_alive(), "Thread for SHP1012 did not finish in time"
        assert not t2.is_alive(), "Thread for SHP1008 did not finish in time"
        
        outcomes = [results.get_nowait(), results.get_nowait()]
        statuses = sorted(r['status'] for r in outcomes)
        
        assert statuses == ['conflict', 'pending_confirmation'], (
            f"Expected exactly one 'pending_confirmation' and one 'conflict', got: {outcomes}"
        )
        
        # The slot itself now shows exactly one active occupant.
        slot_state = repo.get_slot_availability('SLOT-JAI-020')
        assert slot_state['availability_status'] == 'OCCUPIED'
        
        winner = next(r for r in outcomes if r['status'] == 'pending_confirmation')
        loser = next(r for r in outcomes if r['status'] == 'conflict')
        assert slot_state['appointment_id'] == winner['appointment_id']
        assert loser['code'] == 'SLOT_OR_SHIPMENT_ALREADY_ACTIVE'
    
    def test_only_one_appointment_row_ends_up_active_for_the_slot(self, temp_db):
        """Directly counts active appointments on the slot after the race: must be 1."""
        results = queue.Queue()
        start_barrier = threading.Barrier(3)
        
        def attempt(shipment_id):
            start_barrier.wait()
            results.put(repo.execute_slot_booking_transaction(shipment_id, 'SLOT-JAI-021'))
        
        t1 = threading.Thread(target=attempt, args=('SHP1012',))
        t2 = threading.Thread(target=attempt, args=('SHP1008',))
        t1.start()
        t2.start()
        start_barrier.wait()
        t1.join(timeout=10)
        t2.join(timeout=10)
        
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) AS n FROM appointments
                WHERE slot_id = 'SLOT-JAI-021'
                  AND appointment_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS')
            """)
            active_count = cursor.fetchone()['n']
        
        assert active_count == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
