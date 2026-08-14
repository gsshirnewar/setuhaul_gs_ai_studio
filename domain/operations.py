"""Operations: deterministic business logic using read and write repository functions.

Handles:
- Resolving driver context (single shipment, ambiguous, no shipments)
- Persisting driver-declared ETAs
- Creating/updating exceptions
- Managing chat threads and messages
- Assembling fresh feasible slot options

All functions call repository.py (no raw SQL).
"""

from typing import Dict, List, Any, Optional
from db import repository as repo
from domain import feasibility


def resolve_driver_operational_context(driver_id: str) -> Dict[str, Any]:
    """
    Resolve the operational context for a trusted driver.
    
    Returns one of:
    1. Single shipment: Complete context dict with shipment, facility, appointment, etc.
    2. Multiple shipments (ambiguous): {'needs_information': True, 'choices': [{'order_reference': ..., 'facility': ...}, ...]}
    3. No active shipments: {'escalate': True, 'message': 'No active shipments assigned.'}
    
    Args:
        driver_id: Trusted driver ID from session
    
    Returns:
        Dict with resolved context or needs_information/escalate markers
    """
    context = repo.get_driver_operational_context(driver_id)
    
    if context is None:
        return {
            'escalate': True,
            'reason': 'NO_ACTIVE_SHIPMENTS',
            'message': f"Driver {driver_id} has no active shipments assigned.",
        }
    
    if context.get('ambiguous'):
        # Multiple active shipments: return choices
        return {
            'needs_information': True,
            'driver_id': driver_id,
            'message': context.get('message'),
            'choices': context.get('choices', []),
        }
    
    # Single shipment: return full context
    return {
        'ready': True,
        'driver_id': driver_id,
        'shipment_id': context['shipment']['shipment_id'],
        'order_reference': context['shipment']['order_reference'],
        'destination_facility': context['facility']['facility_name'],
        'current_status': context['shipment']['current_status'],
        'current_appointment': context['current_appointment'],
        'latest_eta': context['latest_eta'],
        'context': context,  # Full context for downstream use
    }


def persist_driver_declared_eta(
    driver_id: str,
    shipment_id: str,
    declared_eta_ts: str,
    confidence_code: str = 'MEDIUM',
    delay_reason_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist a driver-declared ETA and create/update exception if delay detected.
    
    Args:
        driver_id: Driver reporting the delay
        shipment_id: Shipment with new ETA
        declared_eta_ts: New ETA (ISO 8601)
        confidence_code: 'HIGH' | 'MEDIUM' | 'LOW'
        delay_reason_code: TRAFFIC, MECHANICAL, WEATHER, etc.
    
    Returns:
        {
            'success': True,
            'eta_update_id': '...',
            'declared_eta_ts': '...',
            'confidence_code': '...',
            'exception_created': bool,
            'exception_id': '...' if exception created,
            'message': str,
        }
    """
    # Persist ETA
    eta_result = repo.persist_driver_eta(
        shipment_id,
        declared_eta_ts,
        confidence_code,
        delay_reason_code,
        reported_by_driver_id=driver_id
    )
    
    # Check if delay detected (declared ETA is later than original)
    shipment = repo.get_shipment(shipment_id)
    original_eta = shipment.get('original_eta_ts') if shipment else None
    
    exception_created = False
    exception_id = None
    exception_type = None
    
    if original_eta and declared_eta_ts > original_eta:
        # Delay detected; create exception
        # Need a thread for the exception
        thread_result = repo.create_or_get_chat_thread(driver_id, shipment_id, 'REPORT_DELAY')
        thread_id = thread_result['thread_id']
        
        exception_type = delay_reason_code if delay_reason_code in (
            'TRAFFIC', 'BREAKDOWN', 'WEATHER'
        ) else 'DELAY'
        
        exc_result = repo.persist_driver_exception(
            driver_id,
            thread_id,
            shipment_id,
            exception_type,
            'NEEDS_INFORMATION',
            description=f"Driver declared new ETA {declared_eta_ts} ({confidence_code} confidence)."
        )
        exception_created = True
        exception_id = exc_result['exception_id']
    
    return {
        'success': True,
        'eta_update_id': eta_result['eta_update_id'],
        'declared_eta_ts': declared_eta_ts,
        'confidence_code': confidence_code,
        'exception_created': exception_created,
        'exception_id': exception_id,
        'message': (
            f"ETA updated to {declared_eta_ts} with {confidence_code} confidence. "
            f"{'Delay exception created.' if exception_created else 'No delay detected.'}"
        ),
    }


def create_or_continue_chat_thread(
    driver_id: str,
    shipment_id: Optional[str] = None,
    thread_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new chat thread for a driver or continue an existing open thread.
    
    Args:
        driver_id: Driver starting/continuing conversation
        shipment_id: Optional; which shipment (None if ambiguous/unresolved)
        thread_reason: REPORT_DELAY | EARLY_ARRIVAL | CHECK_STATUS | ASK_SLOT_OPTIONS
    
    Returns:
        {
            'thread_id': '...',
            'created': bool,
            'message': str,
        }
    """
    return repo.create_or_get_chat_thread(driver_id, shipment_id, thread_reason)


def persist_incoming_driver_message(
    thread_id: str,
    driver_id: str,
    message_text: str,
    external_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist an incoming message from driver.
    
    Detects and marks duplicates (retries from SMS/messaging gateway).
    
    Args:
        thread_id: Chat thread
        driver_id: Driver ID
        message_text: Message content
        external_message_id: Gateway message ID (for dedup)
    
    Returns:
        {
            'chat_message_id': '...',
            'is_duplicate': bool,
            'message': str,
        }
    """
    result = repo.persist_chat_message(
        thread_id,
        'DRIVER',
        driver_id,
        message_text,
        external_message_id=external_message_id
    )
    
    return {
        'chat_message_id': result['chat_message_id'],
        'is_duplicate': result['is_duplicate'],
        'message': result['message'],
    }


def persist_outgoing_agent_message(
    thread_id: str,
    message_text: str,
    external_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist an outgoing message from agent.
    
    Args:
        thread_id: Chat thread
        message_text: Agent response
        external_message_id: Optional gateway reference
    
    Returns:
        {
            'chat_message_id': '...',
            'message': str,
        }
    """
    result = repo.persist_chat_message(
        thread_id,
        'AGENT',
        'agent',
        message_text,
        external_message_id=external_message_id
    )
    
    return {
        'chat_message_id': result['chat_message_id'],
        'message': result['message'],
    }


def detect_duplicate_incoming_message(
    external_message_id: Optional[str],
) -> bool:
    """
    Check if an incoming message is a duplicate (retry).
    
    Args:
        external_message_id: Message ID from gateway
    
    Returns:
        True if duplicate, False otherwise
    """
    if not external_message_id:
        return False
    
    existing = repo.detect_duplicate_message(external_message_id, None)
    return existing is not None


def assemble_fresh_feasible_options(
    driver_id: str,
    shipment_id: str,
    max_options: int = 5,
) -> Dict[str, Any]:
    """
    Assemble fresh set of feasible slots for a shipment.
    
    Calls feasibility.py to evaluate each candidate slot.
    
    Args:
        driver_id: Driver requesting options (for validation)
        shipment_id: Shipment needing a slot
        max_options: Maximum options to return
    
    Returns:
        {
            'shipment_id': shipment_id,
            'facility_id': facility_id,
            'total_available': int,
            'total_feasible': int,
            'feasible': [
                {
                    'slot_id': '...',
                    'dock_code': '...',
                    'slot_start_ts': '...',
                    'slot_end_ts': '...',
                    'recommendation': 'BOOK' | 'NEEDS_APPROVAL',
                },
                ...
            ],
            'needs_approval_count': int,
            'escalation_reason': str or None,
        }
    """
    shipment = repo.get_shipment(shipment_id)
    if not shipment:
        return {
            'error': 'SHIPMENT_NOT_FOUND',
            'message': f'Shipment {shipment_id} not found.',
        }
    
    facility_id = shipment['destination_facility_id']
    dock_type = shipment.get('required_dock_type')
    
    # Use feasibility to evaluate slots
    return feasibility.assemble_feasible_slot_options(
        shipment_id,
        facility_id,
        dock_type=dock_type,
        max_options=max_options
    )


def create_or_update_exception(
    driver_id: str,
    thread_id: str,
    shipment_id: Optional[str],
    exception_type: str,
    exception_status: str = 'NEEDS_INFORMATION',
    description: str = '',
) -> Dict[str, Any]:
    """
    Create an exception record.
    
    Args:
        driver_id: Driver reporting issue
        thread_id: Chat context
        shipment_id: Optional affected shipment
        exception_type: 'DELAY' | 'BREAKDOWN' | 'TRAFFIC' | 'WEATHER' | 'EARLY_ARRIVAL' | 'DOCK_UNAVAILABLE' | 'UNKNOWN'
        exception_status: 'OPEN' | 'NEEDS_INFORMATION' | 'SLOT_OPTIONS_SHARED' | 'WAITING_CONFIRMATION' | 'RESOLVED' | 'ESCALATED' | 'DUPLICATE' | 'CANCELLED'
        description: Human-readable description
    
    Returns:
        {
            'exception_id': '...',
            'exception_type': '...',
            'exception_status': '...',
            'message': str,
        }
    """
    return repo.persist_driver_exception(
        driver_id,
        thread_id,
        shipment_id,
        exception_type,
        exception_status,
        description=description
    )
