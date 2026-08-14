"""Booking command: the only code allowed to write appointments.

Orchestrates deterministic booking transactions. All raw SQL (including the
atomic BEGIN IMMEDIATE booking transaction and the warehouse confirmation
write) lives in db/repository.py; this module only resolves trusted identity,
maps human-readable input to a shipment_id, and calls the repository.

A displayed slot is never treated as held. The database's partial unique
indexes (ux_active_appointment_per_slot, ux_current_active_appointment_per_shipment)
are the final protection against double-booking; this module never pre-checks
occupancy as a substitute for that.
"""

from typing import Dict, Any, Optional
from db import repository as repo
from domain import operations


def select_slot_for_driver(
    driver_id: str,
    slot_id: str,
    order_reference: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve the trusted driver's shipment and attempt to book the given slot.
    
    Never trusts a client-supplied shipment_id: the shipment is always resolved
    server-side from driver_id (and, if the driver has multiple active shipments,
    from a human-readable order_reference the backend maps to a shipment).
    
    Args:
        driver_id: Trusted driver ID from the server session
        slot_id: Candidate slot selected by the driver (not yet held)
        order_reference: Required only when the driver has multiple active
            shipments; must be one of the human-readable choices already shown
    
    Returns:
        {
            'status': 'pending_confirmation' | 'conflict' | 'invalid'
                       | 'needs_information' | 'escalate',
            'code': machine-readable reason code,
            'message': human-readable message,
            ...
        }
    """
    context = operations.resolve_driver_operational_context(driver_id)
    
    if context.get('escalate'):
        return {
            'status': 'escalate',
            'code': context.get('reason', 'NO_ACTIVE_SHIPMENTS'),
            'message': context.get('message'),
        }
    
    if context.get('needs_information'):
        if not order_reference:
            return {
                'status': 'needs_information',
                'code': 'AMBIGUOUS_SHIPMENT',
                'message': context.get('message'),
                'choices': context.get('choices', []),
            }
        
        shipment_id = repo.get_shipment_id_by_order_reference_for_driver(driver_id, order_reference)
        if not shipment_id:
            return {
                'status': 'needs_information',
                'code': 'ORDER_REFERENCE_NOT_RECOGNIZED',
                'message': f"'{order_reference}' does not match one of your active shipments. Please choose again.",
                'choices': context.get('choices', []),
            }
    else:
        shipment_id = context['shipment_id']
    
    return repo.execute_slot_booking_transaction(shipment_id, slot_id)


def confirm_booking(appointment_id: str, warehouse_confirmation_ref: str) -> Dict[str, Any]:
    """Warehouse-initiated confirmation of a specific PENDING_CONFIRMATION appointment.
    
    This is the only path that can set appointment_status to CONFIRMED. A
    sent/delivered operational_messages row is never treated as confirmation.
    
    Args:
        appointment_id: The exact appointment to confirm
        warehouse_confirmation_ref: External WMS reference
    
    Returns:
        {'status': 'confirmed' | 'conflict', 'code': ..., 'message': ...}
    """
    return repo.confirm_pending_appointment(appointment_id, warehouse_confirmation_ref)
