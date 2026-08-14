"""Feasibility: deterministic business logic for slot validation.

Pure functions that evaluate if a candidate slot is feasible for a shipment.
No writes, no side effects. Returns structured result objects.

Input: Slot data, shipment context, facility rules
Output: {feasible: bool, reasons: list, needs_manual_approval: bool}
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from db import repository as repo


def evaluate_slot_feasibility(
    shipment_id: str,
    slot_data: Dict[str, Any],
    facility_rules: List[Dict[str, Any]],
    dock_status_events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Pure function: Evaluate if a candidate slot is feasible for a shipment.
    
    Checks:
    - Slot is AVAILABLE (from v_slot_availability)
    - Dock type matches required_dock_type
    - Refrigeration: if shipment requires reefer, dock must support it
    - Vehicle weight: shipment load_weight_kg <= slot max_vehicle_weight_kg
    - Slot duration: slot_end_ts - slot_start_ts >= shipment expected_unload_min
    - No dock breakdowns/maintenance during slot time
    - Facility rules (especially LAST_NEW_START_TIME)
    
    Args:
        shipment_id: Shipment ID (for error context)
        slot_data: Dict from v_slot_availability with slot_id, dock_type, slot_start_ts, etc.
        facility_rules: List of facility rules (CHECKIN_EARLY_LIMIT_MIN, LAST_NEW_START_TIME, etc.)
        dock_status_events: List of active dock events (breakdowns, maintenance, etc.)
    
    Returns:
        {
            'feasible': bool,
            'reasons': [str, ...],  # Machine-readable reason codes
            'messages': [str, ...],  # Human-readable explanations
            'needs_manual_approval': bool,  # If LAST_NEW_START_TIME violation
            'recommendation': str,  # 'BOOK' | 'ESCALATE' | 'NEEDS_APPROVAL'
        }
    """
    reasons = []
    messages = []
    needs_manual_approval = False
    
    # Fetch shipment details
    shipment = repo.get_shipment(shipment_id)
    if not shipment:
        return {
            'feasible': False,
            'reasons': ['SHIPMENT_NOT_FOUND'],
            'messages': [f'Shipment {shipment_id} not found in database.'],
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # Fetch vehicle details
    vehicle = repo.get_vehicle(shipment['vehicle_id'])
    if not vehicle:
        return {
            'feasible': False,
            'reasons': ['VEHICLE_NOT_FOUND'],
            'messages': [f"Vehicle {shipment['vehicle_id']} not found."],
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # Fetch vehicle type to get weight capacity
    vehicle_type = repo.get_vehicle_type(vehicle['vehicle_type_code'])
    vehicle_weight_limit = vehicle_type.get('max_load_weight_kg') if vehicle_type else None
    
    # Fetch latest ETA
    latest_eta = repo.get_latest_eta(shipment_id)
    if not latest_eta:
        reasons.append('NO_ETA_FOUND')
        messages.append('No ETA information available for this shipment.')
    
    # ========================================================================
    # CHECK 1: Slot Availability Status
    # ========================================================================
    if slot_data.get('availability_status') != 'AVAILABLE':
        return {
            'feasible': False,
            'reasons': [f"SLOT_NOT_AVAILABLE:{slot_data.get('availability_status')}"],
            'messages': [f"Slot {slot_data.get('slot_id')} is {slot_data.get('availability_status')}, not available."],
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # ========================================================================
    # CHECK 2: Dock Type Compatibility
    # ========================================================================
    slot_dock_type = slot_data.get('dock_type', 'UNKNOWN')
    required_dock_type = shipment.get('required_dock_type', 'STANDARD')
    
    if slot_dock_type != required_dock_type:
        reasons.append(f'DOCK_TYPE_MISMATCH:{required_dock_type}_vs_{slot_dock_type}')
        messages.append(
            f"Shipment requires {required_dock_type} dock, but slot is {slot_dock_type}."
        )
        return {
            'feasible': False,
            'reasons': reasons,
            'messages': messages,
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # ========================================================================
    # CHECK 3: Refrigeration Requirement
    # ========================================================================
    if shipment.get('temperature_control_required', 0) == 1:
        if not slot_data.get('supports_refrigerated', False):
            reasons.append('REEFER_REQUIRED_BUT_NOT_SUPPORTED')
            messages.append(
                f"Shipment requires temperature control (reefer), but slot at {slot_data.get('dock_code')} does not support it."
            )
            return {
                'feasible': False,
                'reasons': reasons,
                'messages': messages,
                'needs_manual_approval': False,
                'recommendation': 'ESCALATE',
            }
    
    # ========================================================================
    # CHECK 4: Vehicle Weight Capacity
    # ========================================================================
    shipment_weight = shipment.get('load_weight_kg', 0)
    slot_weight_limit = slot_data.get('max_vehicle_weight_kg')
    
    if vehicle_weight_limit and shipment_weight > vehicle_weight_limit:
        reasons.append(f'VEHICLE_WEIGHT_EXCEEDED:{shipment_weight}_vs_{vehicle_weight_limit}')
        messages.append(
            f"Vehicle capacity {vehicle_weight_limit} kg is less than shipment weight {shipment_weight} kg."
        )
        return {
            'feasible': False,
            'reasons': reasons,
            'messages': messages,
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    if slot_weight_limit and shipment_weight > slot_weight_limit:
        reasons.append(f'SLOT_WEIGHT_EXCEEDED:{shipment_weight}_vs_{slot_weight_limit}')
        messages.append(
            f"Slot max weight {slot_weight_limit} kg is less than shipment weight {shipment_weight} kg."
        )
        return {
            'feasible': False,
            'reasons': reasons,
            'messages': messages,
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # ========================================================================
    # CHECK 5: Slot Duration vs. Expected Unload Time
    # ========================================================================
    try:
        slot_start = datetime.fromisoformat(slot_data['slot_start_ts'].replace('+05:30', '+0530'))
        slot_end = datetime.fromisoformat(slot_data['slot_end_ts'].replace('+05:30', '+0530'))
        slot_duration_min = int((slot_end - slot_start).total_seconds() / 60)
    except (ValueError, KeyError):
        reasons.append('INVALID_SLOT_TIME')
        messages.append('Slot time data is invalid or missing.')
        return {
            'feasible': False,
            'reasons': reasons,
            'messages': messages,
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    expected_unload_min = shipment.get('expected_unload_min', 0)
    if slot_duration_min < expected_unload_min:
        reasons.append(f'INSUFFICIENT_SLOT_DURATION:{slot_duration_min}_vs_{expected_unload_min}')
        messages.append(
            f"Slot duration {slot_duration_min} min is less than expected unload time {expected_unload_min} min."
        )
        return {
            'feasible': False,
            'reasons': reasons,
            'messages': messages,
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # ========================================================================
    # CHECK 6: Dock Status Events (Breakdowns, Maintenance)
    # ========================================================================
    dock_conflicts = []
    for event in dock_status_events:
        try:
            event_start = datetime.fromisoformat(event['event_start_ts'].replace('+05:30', '+0530'))
            event_end_str = event.get('event_end_ts')
            if event_end_str:
                event_end = datetime.fromisoformat(event_end_str.replace('+05:30', '+0530'))
            else:
                event_end = None
        except (ValueError, TypeError):
            continue
        
        # Check if slot overlaps with event
        if event_end is None:
            # Event is ongoing; check if slot_start is after event_start
            if slot_start >= event_start:
                dock_conflicts.append(
                    f"{event['event_type']}:{event.get('reason', 'Unknown')} (ongoing from {event['event_start_ts']})"
                )
        else:
            # Check time overlap: event[start,end] overlaps with slot[start,end]
            if not (slot_end <= event_start or slot_start >= event_end):
                dock_conflicts.append(
                    f"{event['event_type']}:{event.get('reason', 'Unknown')} ({event['event_start_ts']} to {event['event_end_ts']})"
                )
    
    if dock_conflicts:
        reasons.append('DOCK_EVENT_CONFLICT')
        messages.append(
            f"Slot conflicts with dock maintenance/breakdown: {'; '.join(dock_conflicts)}"
        )
        return {
            'feasible': False,
            'reasons': reasons,
            'messages': messages,
            'needs_manual_approval': False,
            'recommendation': 'ESCALATE',
        }
    
    # ========================================================================
    # CHECK 7: ETA Confidence (Warning)
    # ========================================================================
    if latest_eta:
        eta_confidence = latest_eta.get('eta_confidence', 'MEDIUM')
        if eta_confidence == 'LOW':
            reasons.append('LOW_CONFIDENCE_ETA')
            messages.append(
                f"ETA confidence is LOW. Driver declared ETA: {latest_eta.get('effective_eta_ts')}. "
                "Booking may be risky."
            )
    
    # ========================================================================
    # CHECK 8: Facility Rules - LAST_NEW_START_TIME
    # ========================================================================
    for rule in facility_rules:
        if rule.get('rule_type') == 'LAST_NEW_START_TIME' and rule.get('active_flag', 1) == 1:
            rule_value = rule.get('rule_value')  # e.g., "21:00"
            try:
                # Parse rule time as HH:MM (same-day interpretation)
                rule_time_parts = rule_value.split(':')
                rule_hour = int(rule_time_parts[0])
                rule_minute = int(rule_time_parts[1]) if len(rule_time_parts) > 1 else 0
                
                slot_hour = slot_start.hour
                slot_minute = slot_start.minute
                
                if (slot_hour > rule_hour) or (slot_hour == rule_hour and slot_minute >= rule_minute):
                    needs_manual_approval = True
                    reasons.append('LAST_NEW_START_TIME_VIOLATION')
                    messages.append(
                        f"Slot starts at {slot_start.strftime('%H:%M')}, but facility rule prohibits new starts after {rule_value} without manual approval."
                    )
            except (ValueError, IndexError):
                pass
    
    # ========================================================================
    # RESULT: FEASIBLE
    # ========================================================================
    recommendation = 'NEEDS_APPROVAL' if needs_manual_approval else 'BOOK'
    
    return {
        'feasible': True,
        'reasons': reasons,
        'messages': messages,
        'needs_manual_approval': needs_manual_approval,
        'recommendation': recommendation,
        'slot_id': slot_data.get('slot_id'),
        'dock_code': slot_data.get('dock_code'),
        'slot_start_ts': slot_data.get('slot_start_ts'),
        'slot_end_ts': slot_data.get('slot_end_ts'),
    }


def assemble_feasible_slot_options(
    shipment_id: str,
    facility_id: str,
    dock_type: Optional[str] = None,
    max_options: int = 5,
) -> Dict[str, Any]:
    """
    Retrieve all feasible slots for a shipment at a facility.
    
    Calls evaluate_slot_feasibility on each available slot.
    
    Args:
        shipment_id: Shipment to find slots for
        facility_id: Facility to search
        dock_type: Optional filter (e.g., 'REEFER', 'STANDARD')
        max_options: Maximum number of options to return
    
    Returns:
        {
            'shipment_id': shipment_id,
            'facility_id': facility_id,
            'total_available': int,
            'feasible': [
                {
                    'slot_id': ...,
                    'dock_code': ...,
                    'slot_start_ts': ...,
                    'slot_end_ts': ...,
                    'recommendation': 'BOOK' | 'NEEDS_APPROVAL',
                },
                ...
            ],
            'needs_approval_count': int,
            'escalation_reason': str or None,  # If no feasible slots
        }
    """
    facility_rules = repo.get_facility_rules(facility_id)
    dock_status_events = repo.get_dock_status_events(facility_id)
    
    available_slots = repo.get_available_slots(facility_id, dock_type=dock_type)
    
    feasible_slots = []
    needs_approval_count = 0
    
    for slot in available_slots:
        result = evaluate_slot_feasibility(
            shipment_id, slot, facility_rules, dock_status_events
        )
        
        if result['feasible']:
            feasible_slots.append({
                'slot_id': result.get('slot_id'),
                'dock_code': result.get('dock_code'),
                'slot_start_ts': result.get('slot_start_ts'),
                'slot_end_ts': result.get('slot_end_ts'),
                'recommendation': result['recommendation'],
                'needs_approval': result['needs_manual_approval'],
            })
            
            if result['needs_manual_approval']:
                needs_approval_count += 1
    
    feasible_slots = feasible_slots[:max_options]
    escalation_reason = None
    if not feasible_slots:
        escalation_reason = (
            f"No feasible slots available for {shipment_id} at {facility_id}. "
            "All available slots have conflicts with dock maintenance/breakdowns, "
            "insufficient duration, or other constraints."
        )
    
    return {
        'shipment_id': shipment_id,
        'facility_id': facility_id,
        'total_available': len(available_slots),
        'total_feasible': len(feasible_slots),
        'feasible': feasible_slots,
        'needs_approval_count': needs_approval_count,
        'escalation_reason': escalation_reason,
    }
