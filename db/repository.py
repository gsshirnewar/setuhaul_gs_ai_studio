"""Repository: read-only access to SetuHaul operational database.

This module is the ONLY location for raw SQL. It must:
- Locate the database reliably using pathlib (relative to project root)
- Manage SQLite connections with proper configuration (WAL, foreign keys, timeouts)
- Expose small, focused read functions only
- Return plain dictionaries/lists (never Row objects)
- Parameterize all values
- Contain NO writes or LLM logic

Connection Lifecycle:
  1. Caller imports a read function: get_driver_context(driver_id)
  2. Function creates a connection with get_db_connection()
  3. Function queries the database and converts rows to dicts
  4. Function closes the connection (via context manager)
  5. Function returns plain dict/list to caller
  
This ensures:
  - Each read is independent (no shared connection state)
  - Connections are always closed (no resource leaks)
  - Foreign keys are enforced (if corrupted data exists, we'll catch it)
  - WAL mode enables concurrent reads while writes are transactional
  - 5-second busy timeout prevents deadlocks
"""

import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Any

# Module-level so tests can point at a temporary copy of the database.
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "setuhaul_freight_operations.db"


def get_db_connection() -> sqlite3.Connection:
    """Open a SQLite connection to the working database.
    
    Returns a connection configured with:
    - row_factory for dict-like access (converted to plain dicts by callers)
    - foreign_keys enabled (enforce referential integrity)
    - WAL mode (Write-Ahead Logging for concurrent reads)
    - 5-second busy timeout (prevent deadlocks on contention)
    
    Caller must close the connection or use a context manager.
    
    Returns:
        sqlite3.Connection: Connected to data/setuhaul_freight_operations.db
        
    Raises:
        FileNotFoundError: If database file does not exist
        sqlite3.OperationalError: If database is corrupted
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. "
            "Run: python -c \"import sqlite3; conn = sqlite3.connect('data/setuhaul_freight_operations.db'); "
            "conn.executescript(open('data/setuhaul_schema_and_seed.sql').read()); conn.close()\""
        )
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    conn.execute("PRAGMA foreign_keys = ON")  # Enforce foreign key constraints
    conn.execute("PRAGMA journal_mode = WAL")  # Write-Ahead Logging for concurrency
    conn.execute("PRAGMA busy_timeout = 5000")  # 5-second timeout on contention
    
    return conn


def _row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    """Convert a sqlite3.Row to a plain dictionary, or None if row is None."""
    if row is None:
        return None
    return dict(row)


def _rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    """Convert a list of sqlite3.Row objects to plain dictionaries."""
    return [dict(row) for row in rows]


# ============================================================================
# DRIVER & CONTEXT FUNCTIONS
# ============================================================================

def get_driver(driver_id: str) -> Optional[Dict[str, Any]]:
    """Fetch driver details.
    
    Args:
        driver_id: Driver ID (e.g., 'DRV001')
        
    Returns:
        Dictionary with driver_id, carrier_id, driver_name, etc., or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM drivers WHERE driver_id = ?
        """, (driver_id,))
        return _row_to_dict(cursor.fetchone())


def get_driver_active_shipments(driver_id: str) -> List[Dict[str, Any]]:
    """Fetch all active (non-terminal) shipments for a driver.
    
    Active statuses: ASSIGNED, IN_TRANSIT, AT_GATE, WAITING, IN_DOCK
    Terminal statuses: COMPLETED, CANCELLED
    
    Args:
        driver_id: Driver ID
        
    Returns:
        List of shipments with shipment_id, order_reference, destination_facility_id, etc.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                s.shipment_id,
                s.order_reference,
                s.driver_id,
                s.carrier_id,
                s.vehicle_id,
                s.destination_facility_id,
                s.required_dock_type,
                s.temperature_control_required,
                s.load_weight_kg,
                s.priority_code,
                s.original_eta_ts,
                s.latest_eta_ts,
                s.expected_unload_min,
                s.current_status
            FROM shipments s
            WHERE s.driver_id = ? AND s.current_status IN (
                'ASSIGNED', 'IN_TRANSIT', 'AT_GATE', 'WAITING', 'IN_DOCK'
            )
            ORDER BY s.priority_code DESC, s.original_eta_ts ASC
        """, (driver_id,))
        return _rows_to_dicts(cursor.fetchall())


def get_driver_operational_context(driver_id: str) -> Optional[Dict[str, Any]]:
    """Resolve complete operational context from a trusted driver_id.
    
    For a driver with ONE active shipment:
        Returns dict with shipment, carrier, vehicle, facility, current appointment,
        dock info, applicable rules, and effective ETA.
    
    For a driver with MULTIPLE active shipments (ambiguous case like DRV004):
        Returns dict with 'ambiguous' = True and 'choices' containing human-readable
        options (order_reference, facility name, scheduled time) for the driver to select from.
        The internal IDs (shipment_id, etc.) are NOT included in the choice.
    
    For a driver with NO active shipments:
        Returns None
    
    Args:
        driver_id: Trusted from session (never from user input)
        
    Returns:
        Dict with complete context, ambiguity marker, or None if no active shipments
    """
    shipments = get_driver_active_shipments(driver_id)
    
    if not shipments:
        return None
    
    if len(shipments) > 1:
        # Ambiguous case: multiple active shipments
        # Return choices without internal IDs
        choices = []
        for s in shipments:
            facility_name = _get_facility_name(s['destination_facility_id']) or "Unknown Facility"
            choice = {
                'order_reference': s['order_reference'],
                'destination_facility': facility_name,
                'expected_eta': s['latest_eta_ts'] or s['original_eta_ts'],
                'current_status': s['current_status'],
            }
            choices.append(choice)
        
        return {
            'ambiguous': True,
            'driver_id': driver_id,
            'choice_count': len(shipments),
            'choices': choices,
            'message': f"You have {len(shipments)} active shipments. Please select by order reference or facility name.",
        }
    
    # Normal case: one active shipment
    shipment = shipments[0]
    shipment_id = shipment['shipment_id']
    
    # Fetch related data
    carrier = _get_carrier(shipment['carrier_id'])
    vehicle = _get_vehicle(shipment['vehicle_id'])
    facility = _get_facility(shipment['destination_facility_id'])
    latest_eta = _get_latest_eta(shipment_id)
    current_appointment = _get_current_appointment(shipment_id)
    dock_status_events = _get_dock_status_events(shipment['destination_facility_id'])
    facility_rules = _get_facility_rules_for_dock_type(
        shipment['destination_facility_id'],
        shipment['required_dock_type']
    )
    facility_checkin = _get_facility_checkin(shipment_id)
    
    return {
        'shipment': shipment,
        'carrier': carrier,
        'vehicle': vehicle,
        'facility': facility,
        'latest_eta': latest_eta,
        'current_appointment': current_appointment,
        'dock_status_events': dock_status_events,
        'facility_rules': facility_rules,
        'facility_checkin': facility_checkin,
    }


# ============================================================================
# SHIPMENT & ETA FUNCTIONS
# ============================================================================

def get_shipment(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Fetch shipment details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM shipments WHERE shipment_id = ?", (shipment_id,))
        return _row_to_dict(cursor.fetchone())


def get_latest_eta(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Fetch effective ETA from v_latest_eta view.
    
    Returns the authoritative ETA: driver-declared, planner-adjusted, or original,
    plus source, confidence, and delay reason.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                shipment_id,
                original_eta_ts,
                effective_eta_ts,
                eta_source,
                eta_confidence,
                delay_reason_code,
                eta_note,
                eta_updated_at
            FROM v_latest_eta
            WHERE shipment_id = ?
        """, (shipment_id,))
        return _row_to_dict(cursor.fetchone())


# ============================================================================
# APPOINTMENT & BOOKING FUNCTIONS
# ============================================================================

def get_current_appointment(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the current active appointment for a shipment (if any).
    
    Active statuses: PENDING_CONFIRMATION, CONFIRMED, IN_PROGRESS
    Returns None if no current active appointment exists.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                appointment_id,
                shipment_id,
                slot_id,
                appointment_status,
                booking_source,
                is_current,
                booked_at,
                confirmed_at,
                cancelled_at,
                cancellation_reason,
                replaced_appointment_id,
                warehouse_confirmation_ref,
                updated_at
            FROM appointments
            WHERE shipment_id = ?
              AND is_current = 1
              AND appointment_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS')
        """, (shipment_id,))
        return _row_to_dict(cursor.fetchone())


def get_appointment(appointment_id: str) -> Optional[Dict[str, Any]]:
    """Fetch appointment details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM appointments WHERE appointment_id = ?
        """, (appointment_id,))
        return _row_to_dict(cursor.fetchone())


def get_appointment_history(shipment_id: str) -> List[Dict[str, Any]]:
    """Fetch all appointments (current + history) for a shipment, newest first."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM appointments
            WHERE shipment_id = ?
            ORDER BY updated_at DESC
        """, (shipment_id,))
        return _rows_to_dicts(cursor.fetchall())


# ============================================================================
# FACILITY & DOCK FUNCTIONS
# ============================================================================

def get_facility(facility_id: str) -> Optional[Dict[str, Any]]:
    """Fetch facility details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM facilities WHERE facility_id = ?", (facility_id,))
        return _row_to_dict(cursor.fetchone())


def get_docks(facility_id: str) -> List[Dict[str, Any]]:
    """Fetch all docks at a facility."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.*, f.facility_name
            FROM docks d
            JOIN facilities f ON f.facility_id = d.facility_id
            WHERE d.facility_id = ?
            ORDER BY d.dock_code
        """, (facility_id,))
        return _rows_to_dicts(cursor.fetchall())


def get_docks_by_facility() -> Dict[str, List[Dict[str, Any]]]:
    """Fetch all docks grouped by facility."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.*, f.facility_name
            FROM docks d
            JOIN facilities f ON f.facility_id = d.facility_id
            ORDER BY d.facility_id, d.dock_code
        """)
        result: Dict[str, List[Dict[str, Any]]] = {}
        for row in cursor.fetchall():
            result.setdefault(row["facility_id"], []).append(dict(row))
        return result


def get_facility_rules(facility_id: str) -> List[Dict[str, Any]]:
    """Fetch all facility rules (reefer, heavy-load, no-show, etc.)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM facility_rules
            WHERE facility_id = ?
            ORDER BY rule_type
        """, (facility_id,))
        return _rows_to_dicts(cursor.fetchall())


def get_dock_status_events(facility_id: str) -> List[Dict[str, Any]]:
    """Fetch active dock status events (breakdowns, maintenance, etc.) for a facility.
    
    Returns events for all docks in the facility, ordered by event start time.
    Includes breakdowns, maintenance, and capacity reductions.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                dock_event_id,
                dock_id,
                event_type,
                event_start_ts,
                event_end_ts,
                reason,
                created_at
            FROM dock_status_events
            WHERE dock_id IN (
                SELECT dock_id FROM docks WHERE facility_id = ?
            )
            ORDER BY event_start_ts
        """, (facility_id,))
        return _rows_to_dicts(cursor.fetchall())


# ============================================================================
# SLOT AVAILABILITY FUNCTIONS
# ============================================================================

def get_available_slots(facility_id: str, dock_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch available slots at a facility, optionally filtered by dock type.
    
    Available = slot_status = OPEN AND no active appointment.
    
    Args:
        facility_id: Facility ID
        dock_type: Optional dock type filter (STANDARD, REEFER, HEAVY)
        
    Returns:
        List of slots with slot_id, dock_code, dock_type, supports_refrigerated, slot times, etc.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        if dock_type:
            cursor.execute("""
                SELECT 
                    slot_id,
                    facility_id,
                    dock_code,
                    dock_type,
                    supports_refrigerated,
                    max_vehicle_weight_kg,
                    slot_start_ts,
                    slot_end_ts,
                    availability_status
                FROM v_slot_availability
                WHERE facility_id = ?
                  AND dock_type = ?
                  AND availability_status = 'AVAILABLE'
                ORDER BY slot_start_ts
            """, (facility_id, dock_type))
        else:
            cursor.execute("""
                SELECT 
                    slot_id,
                    facility_id,
                    dock_code,
                    dock_type,
                    supports_refrigerated,
                    max_vehicle_weight_kg,
                    slot_start_ts,
                    slot_end_ts,
                    availability_status
                FROM v_slot_availability
                WHERE facility_id = ?
                  AND availability_status = 'AVAILABLE'
                ORDER BY slot_start_ts
            """, (facility_id,))
        
        return _rows_to_dicts(cursor.fetchall())


def get_slot_availability(slot_id: str) -> Optional[Dict[str, Any]]:
    """Fetch slot availability status from v_slot_availability."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM v_slot_availability WHERE slot_id = ?
        """, (slot_id,))
        return _row_to_dict(cursor.fetchone())


def get_occupied_slots_at_facility(facility_id: str) -> List[Dict[str, Any]]:
    """Fetch occupied slots (slots with active appointments) at a facility."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                slot_id,
                facility_id,
                dock_code,
                dock_type,
                slot_start_ts,
                slot_end_ts,
                appointment_id,
                appointment_status
            FROM v_slot_availability
            WHERE facility_id = ?
              AND availability_status = 'OCCUPIED'
            ORDER BY slot_start_ts
        """, (facility_id,))
        return _rows_to_dicts(cursor.fetchall())


# ============================================================================
# FACILITY QUEUE & CHECKIN FUNCTIONS
# ============================================================================

def get_facility_queue(facility_id: str) -> List[Dict[str, Any]]:
    """Fetch current facility queue: trucks waiting at gate or called to dock.
    
    Uses v_current_facility_queue view.
    Returns shipments with facility_id, driver_id, priority, queue_position, etc.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                facility_id,
                shipment_id,
                driver_id,
                vehicle_id,
                priority_code,
                gate_in_ts,
                arrival_state,
                queue_state,
                queue_position,
                effective_eta_ts,
                expected_unload_min,
                required_dock_type
            FROM v_current_facility_queue
            WHERE facility_id = ?
            ORDER BY queue_position
        """, (facility_id,))
        return _rows_to_dicts(cursor.fetchall())


def get_facility_checkin(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Fetch facility check-in record (gate arrival, queue state, etc.) for a shipment."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM facility_checkins WHERE shipment_id = ?
        """, (shipment_id,))
        return _row_to_dict(cursor.fetchone())


# ============================================================================
# CHAT & EXCEPTION FUNCTIONS
# ============================================================================

def get_or_create_chat_thread_for_driver(driver_id: str, shipment_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch an open chat thread for a driver and optional shipment.
    
    If shipment_id is provided, looks for a thread linked to that shipment.
    If shipment_id is None, looks for an open thread without a shipment (ambiguous case).
    Returns the most recent open thread, or None if none exists.
    
    NOTE: This is a READ-ONLY function. Actual thread creation is in domain/operations.py.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        if shipment_id:
            cursor.execute("""
                SELECT * FROM chat_threads
                WHERE driver_id = ? AND shipment_id = ? AND thread_status = 'OPEN'
                ORDER BY opened_at DESC
                LIMIT 1
            """, (driver_id, shipment_id))
        else:
            cursor.execute("""
                SELECT * FROM chat_threads
                WHERE driver_id = ? AND shipment_id IS NULL AND thread_status = 'OPEN'
                ORDER BY opened_at DESC
                LIMIT 1
            """, (driver_id,))
        
        return _row_to_dict(cursor.fetchone())


def get_chat_thread(thread_id: str) -> Optional[Dict[str, Any]]:
    """Fetch chat thread details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chat_threads WHERE thread_id = ?", (thread_id,))
        return _row_to_dict(cursor.fetchone())


def get_chat_messages(thread_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch chat messages in a thread, newest first."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM chat_messages
            WHERE thread_id = ?
            ORDER BY message_ts DESC
            LIMIT ?
        """, (thread_id, limit))
        rows = cursor.fetchall()
        return list(reversed(_rows_to_dicts(rows)))  # Reverse to get oldest first


def get_open_exceptions(driver_id: Optional[str] = None, facility_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch open/unresolved driver exceptions.
    
    Open statuses: OPEN, NEEDS_INFORMATION, SLOT_OPTIONS_SHARED, WAITING_CONFIRMATION, ESCALATED
    Closed statuses (excluded): RESOLVED, DUPLICATE, CANCELLED
    
    Args:
        driver_id: Optional filter by driver
        facility_id: Optional filter by facility (via shipment->facility link)
        
    Returns:
        List of exceptions with exception_id, exception_type, exception_status, etc.
    """
    open_statuses = ('OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED', 'WAITING_CONFIRMATION', 'ESCALATED')
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        if driver_id and facility_id:
            cursor.execute("""
                SELECT DISTINCT de.* FROM driver_exceptions de
                LEFT JOIN shipments s ON de.shipment_id = s.shipment_id
                WHERE de.driver_id = ? AND s.destination_facility_id = ?
                  AND de.exception_status IN (?, ?, ?, ?, ?)
                ORDER BY de.reported_at DESC
            """, (driver_id, facility_id) + open_statuses)
        elif driver_id:
            cursor.execute("""
                SELECT * FROM driver_exceptions
                WHERE driver_id = ? AND exception_status IN (?, ?, ?, ?, ?)
                ORDER BY reported_at DESC
            """, (driver_id,) + open_statuses)
        else:
            cursor.execute("""
                SELECT * FROM driver_exceptions
                WHERE exception_status IN (?, ?, ?, ?, ?)
                ORDER BY reported_at DESC
            """, open_statuses)
        
        return _rows_to_dicts(cursor.fetchall())


# ============================================================================
# CARRIER & VEHICLE FUNCTIONS
# ============================================================================

def get_carrier(carrier_id: str) -> Optional[Dict[str, Any]]:
    """Fetch carrier details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM carriers WHERE carrier_id = ?", (carrier_id,))
        return _row_to_dict(cursor.fetchone())


def get_vehicle(vehicle_id: str) -> Optional[Dict[str, Any]]:
    """Fetch vehicle details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vehicles WHERE vehicle_id = ?", (vehicle_id,))
        return _row_to_dict(cursor.fetchone())


def get_vehicle_type(vehicle_type_code: str) -> Optional[Dict[str, Any]]:
    """Fetch vehicle type details (capacity, reefer capability, etc.)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vehicle_types WHERE vehicle_type_code = ?", (vehicle_type_code,))
        return _row_to_dict(cursor.fetchone())


# ============================================================================
# PRIVATE HELPER FUNCTIONS (for internal use by get_driver_operational_context)
# ============================================================================

def _get_carrier(carrier_id: str) -> Optional[Dict[str, Any]]:
    """Internal: fetch carrier (used by operational context resolution)."""
    return get_carrier(carrier_id)


def _get_vehicle(vehicle_id: str) -> Optional[Dict[str, Any]]:
    """Internal: fetch vehicle (used by operational context resolution)."""
    return get_vehicle(vehicle_id)


def _get_facility(facility_id: str) -> Optional[Dict[str, Any]]:
    """Internal: fetch facility (used by operational context resolution)."""
    return get_facility(facility_id)


def _get_facility_name(facility_id: str) -> Optional[str]:
    """Internal: get facility name for ambiguity display."""
    facility = get_facility(facility_id)
    return facility['facility_name'] if facility else None


def _get_latest_eta(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Internal: fetch latest ETA (used by operational context resolution)."""
    return get_latest_eta(shipment_id)


def _get_current_appointment(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Internal: fetch current appointment (used by operational context resolution)."""
    return get_current_appointment(shipment_id)


def _get_dock_status_events(facility_id: str) -> List[Dict[str, Any]]:
    """Internal: fetch dock status events (used by operational context resolution)."""
    return get_dock_status_events(facility_id)


def _get_facility_rules_for_dock_type(facility_id: str, dock_type: str) -> List[Dict[str, Any]]:
    """Internal: fetch facility rules applicable to a facility.
    
    Note: facility_rules does not filter by dock_type; it applies facility-wide.
    For dock-specific constraints, check dock characteristics via get_docks().
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM facility_rules
            WHERE facility_id = ? AND active_flag = 1
            ORDER BY rule_type
        """, (facility_id,))
        return _rows_to_dicts(cursor.fetchall())


def _get_facility_checkin(shipment_id: str) -> Optional[Dict[str, Any]]:
    """Internal: fetch facility checkin (used by operational context resolution)."""
    return get_facility_checkin(shipment_id)


# ============================================================================
# WRITE FUNCTIONS (for ETA, exceptions, chat)
# ============================================================================

def persist_driver_eta(
    shipment_id: str,
    declared_eta_ts: str,
    confidence_code: str,
    delay_reason_code: Optional[str] = None,
    reported_by_driver_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist a driver-declared ETA as an eta_updates record.
    
    Args:
        shipment_id: Shipment ID
        declared_eta_ts: Driver declared ETA (ISO 8601 timestamp)
        confidence_code: 'HIGH' | 'MEDIUM' | 'LOW'
        delay_reason_code: Optional reason (TRAFFIC, MECHANICAL, WEATHER, etc.)
        reported_by_driver_id: Driver reporting the ETA
    
    Returns:
        Dict with eta_update_id and confirmation message
    
    Raises:
        sqlite3.IntegrityError: If shipment_id does not exist
        sqlite3.OperationalError: If database error occurs
    """
    import uuid
    from datetime import datetime, timezone
    
    eta_update_id = f"ETA-{uuid.uuid4().hex[:12].upper()}"
    created_at = datetime.now(timezone.utc).isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO eta_updates (
                eta_update_id,
                shipment_id,
                declared_eta_ts,
                source_type,
                confidence_code,
                delay_reason_code,
                reported_by_driver_id,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            eta_update_id,
            shipment_id,
            declared_eta_ts,
            'DRIVER_DECLARED',
            confidence_code,
            delay_reason_code,
            reported_by_driver_id,
            created_at
        ))
        conn.commit()
    
    return {
        'eta_update_id': eta_update_id,
        'shipment_id': shipment_id,
        'declared_eta_ts': declared_eta_ts,
        'confidence_code': confidence_code,
        'message': f"ETA updated: {declared_eta_ts} (confidence: {confidence_code})",
    }


def persist_driver_exception(
    driver_id: str,
    thread_id: str,
    shipment_id: Optional[str],
    exception_type: str,
    exception_status: str = 'NEEDS_INFORMATION',
    description: str = '',
    dedupe_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a driver exception record.
    
    Args:
        driver_id: Driver reporting the issue
        thread_id: Chat thread context
        shipment_id: Optional; which shipment is affected
        exception_type: 'DELAY' | 'BREAKDOWN' | 'TRAFFIC' | 'WEATHER' | 'EARLY_ARRIVAL' | 'DOCK_UNAVAILABLE' | 'UNKNOWN'
        exception_status: 'OPEN' | 'NEEDS_INFORMATION' | 'SLOT_OPTIONS_SHARED' | 'WAITING_CONFIRMATION' | 'RESOLVED' | 'ESCALATED' | 'DUPLICATE' | 'CANCELLED'
        description: Human-readable description
        dedupe_key: Optional deterministic key for dedup detection
    
    Returns:
        Dict with exception_id and confirmation
    
    Raises:
        sqlite3.OperationalError: If database error occurs
    """
    import uuid
    from datetime import datetime, timezone
    
    exception_id = f"EXC-{uuid.uuid4().hex[:12].upper()}"
    reported_at = datetime.now(timezone.utc).isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO driver_exceptions (
                exception_id,
                shipment_id,
                driver_id,
                thread_id,
                exception_type,
                reported_at,
                severity_code,
                exception_status,
                description,
                dedupe_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            exception_id,
            shipment_id,
            driver_id,
            thread_id,
            exception_type,
            reported_at,
            'MEDIUM',
            exception_status,
            description or exception_type,
            dedupe_key
        ))
        conn.commit()
    
    return {
        'exception_id': exception_id,
        'driver_id': driver_id,
        'exception_type': exception_type,
        'exception_status': exception_status,
        'message': f"Exception recorded: {exception_type}",
    }


def create_or_get_chat_thread(
    driver_id: str,
    shipment_id: Optional[str] = None,
    thread_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new chat thread or return an existing open thread.
    
    Args:
        driver_id: Driver starting the thread
        shipment_id: Optional; which shipment (None if ambiguous)
        thread_reason: Optional reason (REPORT_DELAY, EARLY_ARRIVAL, CHECK_STATUS, ASK_SLOT_OPTIONS)
    
    Returns:
        Dict with thread_id, created (bool), thread_status
    
    Raises:
        sqlite3.OperationalError: If database error occurs
    """
    import uuid
    from datetime import datetime, timezone
    
    # First, try to find an existing OPEN thread
    existing = get_or_create_chat_thread_for_driver(driver_id, shipment_id)
    if existing:
        return {
            'thread_id': existing['thread_id'],
            'created': False,
            'thread_status': existing['thread_status'],
            'message': f"Continuing existing thread {existing['thread_id']}",
        }
    
    # Create a new thread
    thread_id = f"THR-{uuid.uuid4().hex[:12].upper()}"
    opened_at = datetime.now(timezone.utc).isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chat_threads (
                thread_id,
                driver_id,
                shipment_id,
                thread_status,
                thread_intent,
                opened_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            thread_id,
            driver_id,
            shipment_id,
            'OPEN',
            thread_reason or 'CHECK_STATUS',
            opened_at
        ))
        conn.commit()
    
    return {
        'thread_id': thread_id,
        'created': True,
        'thread_status': 'OPEN',
        'message': f"New thread created: {thread_id}",
    }


def persist_chat_message(
    thread_id: str,
    sender_type: str,
    sender_reference: str,
    message_text: str,
    external_message_id: Optional[str] = None,
    dedupe_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist a chat message to the database.
    
    Detects duplicates using external_message_id or dedupe_key.
    Marks is_duplicate = 1 if duplicate is detected.
    
    Args:
        thread_id: Chat thread ID
        sender_type: 'DRIVER' | 'AGENT' | 'OPERATIONS' | 'WAREHOUSE' | 'SYSTEM'
        sender_reference: Driver ID or 'agent'
        message_text: Human-readable message
        external_message_id: Optional external ID (for dedup)
        dedupe_key: Optional deterministic key (for dedup)
    
    Returns:
        Dict with chat_message_id, is_duplicate, message
    
    Raises:
        sqlite3.OperationalError: If database error occurs
    """
    import uuid
    from datetime import datetime, timezone
    
    # Check for duplicate
    is_duplicate = 0
    if external_message_id or dedupe_key:
        existing = detect_duplicate_message(external_message_id, dedupe_key)
        if existing:
            is_duplicate = 1
    
    chat_message_id = f"MSG-{uuid.uuid4().hex[:12].upper()}"
    message_ts = datetime.now(timezone.utc).isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chat_messages (
                chat_message_id,
                thread_id,
                sender_type,
                sender_reference,
                message_text,
                message_ts,
                external_message_id,
                is_duplicate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            chat_message_id,
            thread_id,
            sender_type,
            sender_reference,
            message_text,
            message_ts,
            external_message_id,
            is_duplicate
        ))
        conn.commit()
    
    return {
        'chat_message_id': chat_message_id,
        'thread_id': thread_id,
        'is_duplicate': is_duplicate == 1,
        'message': f"Message persisted: {chat_message_id}" + (" (marked as duplicate)" if is_duplicate else ""),
    }


def detect_duplicate_message(
    external_message_id: Optional[str],
    dedupe_key: Optional[str],
) -> Optional[Dict[str, Any]]:
    """
    Check if a message already exists by external_message_id or dedupe_key.
    
    Args:
        external_message_id: External message ID (e.g., from SMS gateway)
        dedupe_key: Deterministic key (e.g., SHA256 of message_text + timestamp)
    
    Returns:
        Dict with existing message if found, None otherwise
    """
    if not external_message_id and not dedupe_key:
        return None
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        if external_message_id:
            cursor.execute("""
                SELECT chat_message_id, thread_id, message_ts, is_duplicate
                FROM chat_messages
                WHERE external_message_id = ?
                LIMIT 1
            """, (external_message_id,))
            return _row_to_dict(cursor.fetchone())
        
        if dedupe_key:
            # Note: dedupe_key not stored in DB; this is for client-side use
            # In production, dedupe_key could be SHA256(message_text + sender_id + timestamp_bin)
            # For now, return None to allow all messages
            pass
    
    return None


# ============================================================================
# BOOKING FUNCTIONS (appointment writes - the only writes to `appointments`)
# ============================================================================

def get_shipment_id_by_order_reference_for_driver(
    driver_id: str, order_reference: str
) -> Optional[str]:
    """Map a human-readable order reference to a shipment_id, scoped to this driver's
    own active shipments. Used to resolve ambiguous driver assignments without ever
    trusting a client-supplied shipment_id.
    
    Returns:
        shipment_id if found among the driver's active shipments, else None
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT shipment_id FROM shipments
            WHERE driver_id = ? AND order_reference = ?
              AND current_status IN ('ASSIGNED', 'IN_TRANSIT', 'AT_GATE', 'WAITING', 'IN_DOCK')
        """, (driver_id, order_reference))
        row = cursor.fetchone()
        return row['shipment_id'] if row else None


def _open_write_connection() -> sqlite3.Connection:
    """Open a connection in autocommit mode so callers can issue explicit
    BEGIN IMMEDIATE / COMMIT / ROLLBACK for the booking transaction.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DB_PATH}.")
    
    conn = sqlite3.connect(str(DB_PATH), isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def execute_slot_booking_transaction(
    shipment_id: str,
    slot_id: str,
) -> Dict[str, Any]:
    """Atomically evaluate and book a slot for a shipment.
    
    Uses BEGIN IMMEDIATE to take the write lock before re-reading state, so every
    decision is based on data as of the moment of booking, not stale UI data.
    Business-rule violations (dock type, reefer, weight, duration, blocked slot)
    are caught by this fresh re-read and reported as 'invalid'. The slot/shipment
    uniqueness race is left entirely to ux_active_appointment_per_slot and
    ux_current_active_appointment_per_shipment: this function always attempts the
    INSERT and treats sqlite3.IntegrityError as an expected 'conflict'.
    
    Args:
        shipment_id: Resolved server-side (never trusted from client input directly)
        slot_id: Candidate slot selected by the driver
    
    Returns:
        {
            'status': 'pending_confirmation' | 'conflict' | 'invalid',
            'code': machine-readable reason code,
            'message': human-readable message,
            'appointment_id': str (only if status == 'pending_confirmation'),
            ...
        }
    """
    from datetime import datetime, timezone
    import uuid
    
    conn = _open_write_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        
        # Fresh read: shipment
        cursor.execute("""
            SELECT shipment_id, destination_facility_id, required_dock_type,
                   temperature_control_required, load_weight_kg, expected_unload_min
            FROM shipments WHERE shipment_id = ?
        """, (shipment_id,))
        shipment = cursor.fetchone()
        if shipment is None:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'SHIPMENT_NOT_FOUND',
                'message': f"Shipment {shipment_id} not found.",
            }
        
        # Fresh read: slot + dock
        cursor.execute("""
            SELECT sl.slot_id, sl.facility_id, sl.slot_start_ts, sl.slot_end_ts, sl.slot_status,
                   d.dock_type, d.supports_refrigerated, d.max_vehicle_weight_kg
            FROM appointment_slots sl
            JOIN docks d ON d.dock_id = sl.dock_id
            WHERE sl.slot_id = ?
        """, (slot_id,))
        slot = cursor.fetchone()
        if slot is None:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'SLOT_NOT_FOUND',
                'message': f"Slot {slot_id} not found.",
            }
        
        # Business-rule validation on freshly read state
        if slot['facility_id'] != shipment['destination_facility_id']:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'FACILITY_MISMATCH',
                'message': "This slot is not at the shipment's destination facility.",
            }
        
        if slot['slot_status'] != 'OPEN':
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': f"SLOT_NOT_OPEN:{slot['slot_status']}",
                'message': f"This slot is no longer available ({slot['slot_status']}). Please choose another.",
            }
        
        if slot['dock_type'] != shipment['required_dock_type']:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'DOCK_TYPE_MISMATCH',
                'message': f"Shipment requires {shipment['required_dock_type']} dock, slot is {slot['dock_type']}.",
            }
        
        if shipment['temperature_control_required'] == 1 and not slot['supports_refrigerated']:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'REEFER_REQUIRED_BUT_NOT_SUPPORTED',
                'message': "Shipment requires temperature control; this dock does not support it.",
            }
        
        if slot['max_vehicle_weight_kg'] and shipment['load_weight_kg'] > slot['max_vehicle_weight_kg']:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'SLOT_WEIGHT_EXCEEDED',
                'message': "This dock's weight limit is below the shipment's load weight.",
            }
        
        try:
            slot_start = datetime.fromisoformat(slot['slot_start_ts'])
            slot_end = datetime.fromisoformat(slot['slot_end_ts'])
            duration_min = int((slot_end - slot_start).total_seconds() / 60)
        except ValueError:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'INVALID_SLOT_TIME',
                'message': "Slot time data is invalid.",
            }
        
        if duration_min < shipment['expected_unload_min']:
            conn.execute("ROLLBACK")
            return {
                'status': 'invalid',
                'code': 'INSUFFICIENT_SLOT_DURATION',
                'message': "This slot is too short for the expected unload time.",
            }
        
        # Fresh read: current active appointment for this shipment (to replace, if any)
        cursor.execute("""
            SELECT appointment_id FROM appointments
            WHERE shipment_id = ? AND is_current = 1
              AND appointment_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS')
        """, (shipment_id,))
        current_appt = cursor.fetchone()
        
        now = datetime.now(timezone.utc).isoformat()
        new_appointment_id = f"APT-{uuid.uuid4().hex[:12].upper()}"
        replaced_appointment_id = None
        
        if current_appt is not None:
            replaced_appointment_id = current_appt['appointment_id']
            cursor.execute("""
                UPDATE appointments
                SET appointment_status = 'CANCELLED',
                    is_current = 0,
                    cancelled_at = ?,
                    cancellation_reason = 'Replaced by new driver slot selection',
                    updated_at = ?
                WHERE appointment_id = ? AND is_current = 1
                  AND appointment_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS')
            """, (now, now, replaced_appointment_id))
        
        try:
            cursor.execute("""
                INSERT INTO appointments (
                    appointment_id, shipment_id, slot_id, appointment_status,
                    booking_source, is_current, booked_at, replaced_appointment_id, updated_at
                ) VALUES (?, ?, ?, 'PENDING_CONFIRMATION', 'DRIVER_CHAT', 1, ?, ?, ?)
            """, (new_appointment_id, shipment_id, slot_id, now, replaced_appointment_id, now))
        except sqlite3.IntegrityError:
            conn.execute("ROLLBACK")
            return {
                'status': 'conflict',
                'code': 'SLOT_OR_SHIPMENT_ALREADY_ACTIVE',
                'message': "This slot was just taken, or this shipment already has an active booking. Please pick another option.",
            }
        
        conn.execute("COMMIT")
        return {
            'status': 'pending_confirmation',
            'code': 'BOOKED',
            'appointment_id': new_appointment_id,
            'shipment_id': shipment_id,
            'slot_id': slot_id,
            'slot_start_ts': slot['slot_start_ts'],
            'slot_end_ts': slot['slot_end_ts'],
            'replaced_appointment_id': replaced_appointment_id,
            'message': "Your booking is pending warehouse confirmation.",
        }
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def confirm_pending_appointment(
    appointment_id: str,
    warehouse_confirmation_ref: str,
) -> Dict[str, Any]:
    """Deterministic warehouse confirmation: the ONLY way an appointment becomes
    CONFIRMED. Never inferred from operational_messages or chat status.
    
    Args:
        appointment_id: The specific PENDING_CONFIRMATION appointment to confirm
        warehouse_confirmation_ref: External WMS reference (e.g., 'WH-JAI-9001')
    
    Returns:
        {
            'status': 'confirmed' | 'conflict',
            'code': ...,
            'message': ...,
        }
    """
    from datetime import datetime, timezone
    
    conn = _open_write_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            UPDATE appointments
            SET appointment_status = 'CONFIRMED',
                confirmed_at = ?,
                warehouse_confirmation_ref = ?,
                updated_at = ?
            WHERE appointment_id = ? AND is_current = 1 AND appointment_status = 'PENDING_CONFIRMATION'
        """, (now, warehouse_confirmation_ref, now, appointment_id))
        
        if cursor.rowcount == 0:
            conn.execute("ROLLBACK")
            return {
                'status': 'conflict',
                'code': 'NOT_PENDING_CONFIRMATION',
                'message': f"Appointment {appointment_id} is not awaiting confirmation (already confirmed, cancelled, or not found).",
            }
        
        conn.execute("COMMIT")
        return {
            'status': 'confirmed',
            'code': 'CONFIRMED',
            'appointment_id': appointment_id,
            'warehouse_confirmation_ref': warehouse_confirmation_ref,
            'confirmed_at': now,
            'message': f"Booking confirmed by warehouse, ref: {warehouse_confirmation_ref}.",
        }
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()
