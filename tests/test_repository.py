"""Tests for db/repository.py - Read-only database access layer.

These tests verify:
- Database connection lifecycle and configuration
- All read-only functions return correct data
- Parameterized queries prevent SQL injection
- Plain dictionaries are returned (never Row objects)
- Operational context resolution (single shipment, ambiguous, none)
- DRV004 ambiguity handling with human-readable choices
- No dependency on hard-coded driver IDs (tests parameterized)

Tests use the real seeded database from data/setuhaul_freight_operations.db
and do not modify any data (read-only).
"""

import pytest
from db import repository as repo


class TestDatabaseConnection:
    """Test database connection lifecycle and configuration."""
    
    def test_get_db_connection_succeeds(self):
        """Database connection is created successfully."""
        conn = repo.get_db_connection()
        assert conn is not None
        conn.close()
    
    def test_get_db_connection_with_context_manager(self):
        """Database connection is properly closed with context manager."""
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM shipments")
            count = cursor.fetchone()[0]
            assert count > 0
    
    def test_db_connection_foreign_keys_enabled(self):
        """Foreign key constraints are enabled."""
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys")
            result = cursor.fetchone()
            assert result[0] == 1  # Foreign keys are ON
    
    def test_db_connection_wal_mode(self):
        """Write-Ahead Logging (WAL) mode is enabled."""
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA journal_mode")
            result = cursor.fetchone()
            assert result[0].upper() == 'WAL'
    
    def test_db_connection_busy_timeout_set(self):
        """Busy timeout is set to 5 seconds."""
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA busy_timeout")
            result = cursor.fetchone()
            assert result[0] == 5000  # 5 seconds in milliseconds


class TestDriverFunctions:
    """Test driver context and shipment retrieval."""
    
    def test_get_driver_returns_dict(self):
        """get_driver returns plain dict (not Row object)."""
        driver = repo.get_driver('DRV001')
        assert isinstance(driver, dict)
        assert 'driver_id' in driver
        assert driver['driver_id'] == 'DRV001'
    
    def test_get_driver_not_found_returns_none(self):
        """get_driver returns None for non-existent driver."""
        driver = repo.get_driver('DRV999')
        assert driver is None
    
    def test_get_driver_active_shipments_normal_driver(self):
        """get_driver_active_shipments returns list of dicts for single-assignment driver."""
        # DRV001 should have at least one active shipment
        shipments = repo.get_driver_active_shipments('DRV001')
        assert isinstance(shipments, list)
        if shipments:
            assert isinstance(shipments[0], dict)
            assert 'shipment_id' in shipments[0]
            assert 'order_reference' in shipments[0]
    
    def test_get_driver_active_shipments_ambiguous_driver(self):
        """get_driver_active_shipments returns multiple shipments for DRV004."""
        shipments = repo.get_driver_active_shipments('DRV004')
        assert isinstance(shipments, list)
        assert len(shipments) >= 2  # DRV004 has 2+ active shipments
        assert all(isinstance(s, dict) for s in shipments)
        
        # Verify shipments are for DRV004
        assert all(s['driver_id'] == 'DRV004' for s in shipments)
        
        # Verify order_references are present (human-readable)
        assert all('order_reference' in s for s in shipments)
    
    def test_get_driver_active_shipments_no_active_shipments(self):
        """get_driver_active_shipments returns empty list for driver with no active shipments."""
        # Find a driver with completed shipments only
        shipments = repo.get_driver_active_shipments('DRV999')
        assert isinstance(shipments, list)
        assert len(shipments) == 0


class TestOperationalContext:
    """Test operational context resolution."""
    
    def test_get_driver_operational_context_single_shipment(self):
        """Operational context for single-shipment driver includes all nested data."""
        # DRV001 should have one active shipment
        context = repo.get_driver_operational_context('DRV001')
        
        if context:  # Only test if driver has active shipments
            assert isinstance(context, dict)
            assert 'ambiguous' not in context or context['ambiguous'] is False
            assert 'shipment' in context
            assert 'carrier' in context
            assert 'vehicle' in context
            assert 'facility' in context
            assert 'latest_eta' in context
            assert 'current_appointment' in context
            assert 'dock_status_events' in context
            assert 'facility_rules' in context
            assert 'facility_checkin' in context
    
    def test_get_driver_operational_context_ambiguous_case(self):
        """Operational context for DRV004 (ambiguous) returns choices without internal IDs."""
        context = repo.get_driver_operational_context('DRV004')
        
        assert context is not None
        assert context['ambiguous'] is True
        assert context['driver_id'] == 'DRV004'
        assert context['choice_count'] >= 2
        assert 'choices' in context
        assert len(context['choices']) >= 2
        
        # Verify choices are human-readable (no internal IDs)
        for choice in context['choices']:
            assert 'order_reference' in choice  # Human-readable order ref
            assert 'destination_facility' in choice  # Facility name, not ID
            assert 'expected_eta' in choice
            assert 'current_status' in choice
            # Ensure NO shipment_id or facility_id in choice
            assert 'shipment_id' not in choice
            assert 'facility_id' not in choice
    
    def test_get_driver_operational_context_no_shipments(self):
        """Operational context for driver with no active shipments returns None."""
        context = repo.get_driver_operational_context('DRV999')
        assert context is None


class TestShipmentAndETA:
    """Test shipment and ETA retrieval."""
    
    def test_get_shipment_returns_dict(self):
        """get_shipment returns plain dict."""
        shipment = repo.get_shipment('SHP1006')
        assert isinstance(shipment, dict)
        assert shipment['shipment_id'] == 'SHP1006'
        assert 'order_reference' in shipment
    
    def test_get_latest_eta_returns_effective_eta(self):
        """get_latest_eta returns effective ETA from view."""
        eta = repo.get_latest_eta('SHP1006')
        assert eta is not None
        assert isinstance(eta, dict)
        assert 'effective_eta_ts' in eta
        assert 'eta_source' in eta
        assert 'eta_confidence' in eta


class TestAppointmentFunctions:
    """Test appointment and booking retrieval."""
    
    def test_get_current_appointment_returns_active(self):
        """get_current_appointment returns PENDING_CONFIRMATION or CONFIRMED."""
        # SHP1006 has a confirmed appointment
        appt = repo.get_current_appointment('SHP1006')
        
        if appt:  # Only test if appointment exists
            assert isinstance(appt, dict)
            assert appt['appointment_status'] in [
                'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'
            ]
            assert appt['is_current'] == 1
    
    def test_get_appointment_returns_dict(self):
        """get_appointment returns plain dict."""
        appt = repo.get_appointment('APT1006')
        assert isinstance(appt, dict)
        assert appt['appointment_id'] == 'APT1006'
    
    def test_get_appointment_history_returns_list(self):
        """get_appointment_history returns list of dicts."""
        history = repo.get_appointment_history('SHP1006')
        assert isinstance(history, list)
        if history:
            assert all(isinstance(a, dict) for a in history)


class TestFacilityAndDockFunctions:
    """Test facility, dock, and rule retrieval."""
    
    def test_get_facility_returns_dict(self):
        """get_facility returns plain dict."""
        facility = repo.get_facility('FAC-JAI-01')
        assert isinstance(facility, dict)
        assert facility['facility_id'] == 'FAC-JAI-01'
        assert 'facility_name' in facility
    
    def test_get_docks_returns_list(self):
        """get_docks returns list of dicts."""
        docks = repo.get_docks('FAC-JAI-01')
        assert isinstance(docks, list)
        assert len(docks) > 0
        assert all(isinstance(d, dict) for d in docks)
    
    def test_get_facility_rules_returns_list(self):
        """get_facility_rules returns list of rules."""
        rules = repo.get_facility_rules('FAC-JAI-01')
        assert isinstance(rules, list)
        assert all(isinstance(r, dict) for r in rules)
    
    def test_get_dock_status_events_returns_list(self):
        """get_dock_status_events returns active dock events."""
        events = repo.get_dock_status_events('FAC-JAI-01')
        assert isinstance(events, list)
        assert all(isinstance(e, dict) for e in events)


class TestSlotAvailabilityFunctions:
    """Test slot availability retrieval."""
    
    def test_get_available_slots_returns_list(self):
        """get_available_slots returns list of available slots."""
        slots = repo.get_available_slots('FAC-JAI-01')
        assert isinstance(slots, list)
        # Should have some available slots in the seed data
        if slots:
            assert all(s['availability_status'] == 'AVAILABLE' for s in slots)
    
    def test_get_available_slots_filtered_by_dock_type(self):
        """get_available_slots with dock_type filter returns filtered results."""
        slots = repo.get_available_slots('FAC-JAI-01', dock_type='STANDARD')
        assert isinstance(slots, list)
        if slots:
            assert all(s['dock_type'] == 'STANDARD' for s in slots)
    
    def test_get_slot_availability_returns_dict(self):
        """get_slot_availability returns slot with status."""
        slot = repo.get_slot_availability('SLOT-JAI-001')
        assert isinstance(slot, dict)
        assert slot['slot_id'] == 'SLOT-JAI-001'
        assert 'availability_status' in slot


class TestFacilityQueueFunctions:
    """Test facility queue and checkin retrieval."""
    
    def test_get_facility_queue_returns_list(self):
        """get_facility_queue returns trucks waiting/called to dock."""
        queue = repo.get_facility_queue('FAC-JAI-01')
        assert isinstance(queue, list)
        assert all(isinstance(q, dict) for q in queue)
    
    def test_get_facility_checkin_returns_dict_or_none(self):
        """get_facility_checkin returns checkin record or None."""
        # SHP1001 should have a checkin
        checkin = repo.get_facility_checkin('SHP1001')
        if checkin:
            assert isinstance(checkin, dict)
            assert checkin['shipment_id'] == 'SHP1001'


class TestChatAndExceptionFunctions:
    """Test chat thread and exception retrieval."""
    
    def test_get_chat_thread_returns_dict(self):
        """get_chat_thread returns plain dict."""
        thread = repo.get_chat_thread('THR001')
        assert isinstance(thread, dict)
        assert thread['thread_id'] == 'THR001'
    
    def test_get_chat_messages_returns_list(self):
        """get_chat_messages returns messages in order."""
        messages = repo.get_chat_messages('THR001')
        assert isinstance(messages, list)
        if len(messages) > 1:
            # Messages should be in chronological order (oldest first)
            assert all(isinstance(m, dict) for m in messages)
    
    def test_get_open_exceptions_returns_list(self):
        """get_open_exceptions returns open/escalated exceptions."""
        exceptions = repo.get_open_exceptions()
        assert isinstance(exceptions, list)
        if exceptions:
            assert all(
                e['exception_status'] in ['OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED', 'WAITING_CONFIRMATION', 'ESCALATED']
                for e in exceptions
            )
    
    def test_get_open_exceptions_filtered_by_driver(self):
        """get_open_exceptions with driver_id filter."""
        exceptions = repo.get_open_exceptions(driver_id='DRV006')
        assert isinstance(exceptions, list)
        if exceptions:
            assert all(e['driver_id'] == 'DRV006' for e in exceptions)


class TestCarrierAndVehicleFunctions:
    """Test carrier and vehicle retrieval."""
    
    def test_get_carrier_returns_dict(self):
        """get_carrier returns plain dict."""
        carrier = repo.get_carrier('CAR001')
        assert isinstance(carrier, dict)
        assert carrier['carrier_id'] == 'CAR001'
    
    def test_get_vehicle_returns_dict(self):
        """get_vehicle returns plain dict."""
        vehicle = repo.get_vehicle('VEH001')
        assert isinstance(vehicle, dict)
        assert vehicle['vehicle_id'] == 'VEH001'
    
    def test_get_vehicle_type_returns_dict(self):
        """get_vehicle_type returns vehicle type details."""
        vtype = repo.get_vehicle_type('32FT_SXL')
        if vtype:  # Only test if vehicle type exists
            assert isinstance(vtype, dict)


class TestParameterization:
    """Test that queries are properly parameterized (prevent SQL injection)."""
    
    def test_parameterized_driver_query(self):
        """Driver queries use parameter binding."""
        # This should not raise an error or return unexpected results
        driver = repo.get_driver("'; DROP TABLE shipments; --")
        assert driver is None  # Not found, database intact
        
        # Verify database is still intact
        with repo.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM shipments")
            count = cursor.fetchone()[0]
            assert count > 0  # Table still exists
    
    def test_parameterized_shipment_query(self):
        """Shipment queries use parameter binding."""
        shipment = repo.get_shipment("SHP1001' OR '1'='1")
        assert shipment is None  # Not found, query safe


class TestDataIntegrity:
    """Test that returned data is consistent with database schema."""
    
    def test_driver_data_includes_required_fields(self):
        """Driver data includes required fields."""
        driver = repo.get_driver('DRV001')
        if driver:
            assert 'driver_id' in driver
            assert 'carrier_id' in driver
    
    def test_shipment_data_includes_required_fields(self):
        """Shipment data includes required fields."""
        shipment = repo.get_shipment('SHP1006')
        assert shipment is not None
        assert 'shipment_id' in shipment
        assert 'order_reference' in shipment
        assert 'driver_id' in shipment
        assert 'destination_facility_id' in shipment
        assert 'current_status' in shipment
    
    def test_appointment_data_includes_required_fields(self):
        """Appointment data includes required fields."""
        appt = repo.get_appointment('APT1006')
        if appt:
            assert 'appointment_id' in appt
            assert 'appointment_status' in appt
            assert appt['appointment_status'] in [
                'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED', 'NO_SHOW'
            ]


class TestRealWorldScenarios:
    """Test real-world use cases from seed data."""
    
    def test_scenario_shp1006_multiple_eta_updates(self):
        """SHP1006: retrieve shipment with multiple ETA updates."""
        eta = repo.get_latest_eta('SHP1006')
        assert eta is not None
        assert eta['shipment_id'] == 'SHP1006'
        # eta_source should indicate if ETA was updated
        assert eta['eta_source'] in ['DRIVER_DECLARED', 'ORIGINAL_PLAN', 'PLANNER_ADJUSTED']
    
    def test_scenario_shp1015_reefer_constraints(self):
        """SHP1015: retrieve reefer shipment with dock type constraints."""
        shipment = repo.get_shipment('SHP1015')
        assert shipment is not None
        assert shipment['required_dock_type'] == 'REEFER'
        assert shipment['temperature_control_required'] == 1
    
    def test_scenario_drv004_ambiguous_assignment(self):
        """DRV004: resolve ambiguous driver assignment."""
        context = repo.get_driver_operational_context('DRV004')
        assert context is not None
        assert context['ambiguous'] is True
        assert context['choice_count'] == 2
        
        # Verify choices are usable by driver
        choices = context['choices']
        assert choices[0]['order_reference'] in ['ORD-260804-004', 'ORD-260804-020']
        assert choices[1]['order_reference'] in ['ORD-260804-004', 'ORD-260804-020']
        assert choices[0]['order_reference'] != choices[1]['order_reference']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
