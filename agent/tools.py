"""Agent tool contract: the only bridge between the chat agent and the deterministic backend.

Each tool has:
- An input schema (plain dict, no ORM objects, no internal IDs from the LLM)
- An authorization check that uses the trusted driver_id from the server session
- A dispatcher branch that calls exactly one domain function
- A JSON-serializable result with a machine-readable 'status' field

The dispatcher receives driver_id from the server session, never from tool input or
from the LLM. No general SQL tool or arbitrary database access is exposed.

Results use these status values across all tools:
  ready               - context resolved, single shipment
  needs_information   - driver must clarify (ambiguous shipment or missing input)
  pending_confirmation - slot is reserved; warehouse confirmation still required
  confirmed           - warehouse has confirmed via explicit warehouse_confirmation_ref
  conflict            - slot was taken by another booking; agent must refresh options
  invalid             - input is malformed or business rules were violated
  escalate            - no actionable path; human operations staff must intervene
  ok                  - generic success for read-only operations
"""

from typing import Any, Dict, Optional

from db import repository as repo
from domain import booking, feasibility, operations


# ---------------------------------------------------------------------------
# Public tool input schemas (for reference / LLM function-call metadata)
# ---------------------------------------------------------------------------

TOOL_SCHEMAS: Dict[str, Dict] = {
    "get_my_current_context": {
        "description": (
            "Return the driver's current shipment, active appointment, latest ETA, "
            "facility, and dock status. No driver input required. If the driver has "
            "two active shipments, returns human-readable choices with no internal IDs."
        ),
        "parameters": {},
    },
    "select_my_shipment_by_order_reference": {
        "description": (
            "Resolve ambiguity when get_my_current_context returned needs_information. "
            "Accepts the human-readable order reference the driver chose (e.g. 'ORD-260804-004'). "
            "Never accepts an internal shipment ID."
        ),
        "parameters": {
            "order_reference": {"type": "string", "description": "The order reference the driver selected."}
        },
        "required": ["order_reference"],
    },
    "report_delay_or_eta": {
        "description": (
            "Persist a driver-declared ETA and, if it represents a delay vs. the "
            "original plan, create an exception record. Preserves the supplied "
            "confidence_code exactly; never upgrades LOW to MEDIUM or MEDIUM to HIGH."
        ),
        "parameters": {
            "declared_eta_ts": {
                "type": "string",
                "description": "ISO 8601 datetime of the driver's new ETA.",
            },
            "confidence_code": {
                "type": "string",
                "enum": ["HIGH", "MEDIUM", "LOW"],
                "description": "Driver's confidence in the ETA.",
            },
            "delay_reason_code": {
                "type": "string",
                "enum": ["TRAFFIC", "BREAKDOWN", "WEATHER", "LATE_DEPARTURE", "LOADING_DELAY", "ROUTE_ISSUE", "OTHER"],
                "description": "Optional reason for the delay.",
            },
        },
        "required": ["declared_eta_ts", "confidence_code"],
    },
    "get_fresh_feasible_options": {
        "description": (
            "Return a fresh list of available, feasible dock slots for the driver's "
            "shipment. Options are never pre-reserved; showing them does not hold "
            "capacity. Call this after any slot conflict so the agent always shows "
            "current availability."
        ),
        "parameters": {
            "after_time": {
                "type": "string",
                "description": "ISO 8601 datetime; only return slots starting at or after this time.",
            },
            "preference": {
                "type": "string",
                "description": "Optional driver preference hint (e.g., 'earliest', 'morning').",
            },
        },
    },
    "select_slot": {
        "description": (
            "Book the driver's chosen slot. Must only be called after the driver has "
            "explicitly confirmed a specific slot in the conversation. Creates a "
            "PENDING_CONFIRMATION appointment that immediately consumes slot capacity. "
            "Returns conflict if another driver won the slot; agent must call "
            "get_fresh_feasible_options and never retry the same slot automatically."
        ),
        "parameters": {
            "slot_id": {
                "type": "string",
                "description": "The slot_id the driver chose from the displayed options.",
            },
            "order_reference": {
                "type": "string",
                "description": "Required only when the driver has two active shipments.",
            },
        },
        "required": ["slot_id"],
    },
    "get_my_exception_or_appointment_status": {
        "description": (
            "Return the driver's current appointment status and any open exceptions. "
            "CONFIRMED means warehouse has explicitly confirmed the booking via an "
            "external WMS reference. PENDING_CONFIRMATION means capacity is reserved "
            "but warehouse confirmation is still pending."
        ),
        "parameters": {},
    },
}


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def dispatch(
    tool_name: str,
    tool_input: Dict[str, Any],
    driver_id: str,
    thread_id: Optional[str],
    external_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Route one tool call from the agent to the correct backend function.

    Args:
        tool_name: One of the keys in TOOL_SCHEMAS.
        tool_input: LLM-supplied parameters (never trusted for identity/IDs).
        driver_id: Trusted from the server session; never comes from LLM input.
        thread_id: Chat thread for message persistence.
        external_message_id: Gateway dedup ID when provided by the transport layer.

    Returns:
        JSON-serializable dict with at minimum {'tool': tool_name, 'status': str}.
    """
    if tool_name not in TOOL_SCHEMAS:
        return _error(tool_name, "UNKNOWN_TOOL", f"'{tool_name}' is not a recognised tool.")

    if not driver_id:
        return _error(tool_name, "UNAUTHORIZED", "No authenticated driver identity in session.")

    # Persist incoming driver message when a thread is active.
    if thread_id and tool_input.get("_driver_message"):
        msg_result = repo.persist_chat_message(
            thread_id, "DRIVER", driver_id,
            tool_input["_driver_message"],
            external_message_id=external_message_id,
        )
        if msg_result["is_duplicate"]:
            # Duplicate retransmission: persist but take no further action.
            return {
                "tool": tool_name,
                "status": "ok",
                "is_duplicate": True,
                "message": "Message already received; no action taken.",
            }

    if tool_name == "get_my_current_context":
        return _get_my_current_context(driver_id, thread_id)

    if tool_name == "select_my_shipment_by_order_reference":
        order_reference = tool_input.get("order_reference", "").strip()
        if not order_reference:
            return _error(tool_name, "MISSING_FIELD", "'order_reference' is required.")
        return _select_my_shipment_by_order_reference(driver_id, order_reference)

    if tool_name == "report_delay_or_eta":
        declared_eta_ts = tool_input.get("declared_eta_ts", "").strip()
        confidence_code = tool_input.get("confidence_code", "MEDIUM")
        delay_reason_code = tool_input.get("delay_reason_code")
        if not declared_eta_ts:
            return _error(tool_name, "MISSING_FIELD", "'declared_eta_ts' is required.")
        return _report_delay_or_eta(driver_id, declared_eta_ts, confidence_code, delay_reason_code, thread_id)

    if tool_name == "get_fresh_feasible_options":
        after_time = tool_input.get("after_time")
        preference = tool_input.get("preference")
        return _get_fresh_feasible_options(driver_id, after_time, preference)

    if tool_name == "select_slot":
        slot_id = tool_input.get("slot_id", "").strip()
        order_reference = tool_input.get("order_reference", "").strip() or None
        if not slot_id:
            return _error(tool_name, "MISSING_FIELD", "'slot_id' is required.")
        return _select_slot(driver_id, slot_id, order_reference, thread_id)

    if tool_name == "get_my_exception_or_appointment_status":
        return _get_my_exception_or_appointment_status(driver_id)

    return _error(tool_name, "UNKNOWN_TOOL", f"No handler for '{tool_name}'.")


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def _get_my_current_context(driver_id: str, thread_id: Optional[str]) -> Dict[str, Any]:
    context = operations.resolve_driver_operational_context(driver_id)

    if context.get("escalate"):
        return {
            "tool": "get_my_current_context",
            "status": "escalate",
            "code": context.get("reason", "NO_ACTIVE_SHIPMENTS"),
            "message": context.get("message"),
        }

    if context.get("needs_information"):
        return {
            "tool": "get_my_current_context",
            "status": "needs_information",
            "code": "AMBIGUOUS_SHIPMENT",
            "message": context.get("message"),
            # choices contain only order_reference, destination_facility, expected_eta, current_status
            "choices": context.get("choices", []),
            "instruction_for_agent": (
                "Ask the driver which shipment they mean by order reference or facility name. "
                "Do not ask for an internal shipment ID."
            ),
        }

    ctx = context.get("context", {})
    shipment = ctx.get("shipment", {})
    facility = ctx.get("facility") or {}
    latest_eta = ctx.get("latest_eta") or {}
    current_appt = ctx.get("current_appointment")

    appt_summary = None
    if current_appt:
        appt_summary = {
            "appointment_id": current_appt["appointment_id"],
            "appointment_status": current_appt["appointment_status"],
            "slot_id": current_appt["slot_id"],
            "is_confirmed": current_appt["appointment_status"] == "CONFIRMED"
                            and bool(current_appt.get("warehouse_confirmation_ref")),
            "warehouse_confirmation_ref": current_appt.get("warehouse_confirmation_ref"),
        }

    return {
        "tool": "get_my_current_context",
        "status": "ready",
        "shipment_id": shipment.get("shipment_id"),
        "order_reference": shipment.get("order_reference"),
        "destination_facility": facility.get("facility_name"),
        "current_status": shipment.get("current_status"),
        "required_dock_type": shipment.get("required_dock_type"),
        "temperature_control_required": bool(shipment.get("temperature_control_required")),
        "latest_eta": latest_eta.get("effective_eta_ts"),
        "eta_confidence": latest_eta.get("eta_confidence"),
        "current_appointment": appt_summary,
    }


def _select_my_shipment_by_order_reference(driver_id: str, order_reference: str) -> Dict[str, Any]:
    shipment_id = repo.get_shipment_id_by_order_reference_for_driver(driver_id, order_reference)
    if not shipment_id:
        active = repo.get_driver_active_shipments(driver_id)
        choices = [
            {
                "order_reference": s["order_reference"],
                "current_status": s["current_status"],
            }
            for s in active
        ]
        return {
            "tool": "select_my_shipment_by_order_reference",
            "status": "needs_information",
            "code": "ORDER_REFERENCE_NOT_RECOGNISED",
            "message": f"'{order_reference}' does not match any of your active shipments. Please choose again.",
            "choices": choices,
        }

    shipment = repo.get_shipment(shipment_id)
    facility = repo.get_facility(shipment["destination_facility_id"]) or {}
    latest_eta = repo.get_latest_eta(shipment_id) or {}

    return {
        "tool": "select_my_shipment_by_order_reference",
        "status": "ready",
        "shipment_id": shipment_id,
        "order_reference": order_reference,
        "destination_facility": facility.get("facility_name"),
        "current_status": shipment.get("current_status"),
        "latest_eta": latest_eta.get("effective_eta_ts"),
    }


def _report_delay_or_eta(
    driver_id: str,
    declared_eta_ts: str,
    confidence_code: str,
    delay_reason_code: Optional[str],
    thread_id: Optional[str],
) -> Dict[str, Any]:
    active = repo.get_driver_active_shipments(driver_id)
    if not active:
        return _error("report_delay_or_eta", "NO_ACTIVE_SHIPMENTS", "No active shipment to update ETA for.")
    if len(active) > 1:
        return _error(
            "report_delay_or_eta", "AMBIGUOUS_SHIPMENT",
            "Call select_my_shipment_by_order_reference first to clarify which shipment this ETA applies to.",
        )

    shipment_id = active[0]["shipment_id"]
    result = operations.persist_driver_declared_eta(
        driver_id, shipment_id, declared_eta_ts, confidence_code, delay_reason_code
    )
    return {
        "tool": "report_delay_or_eta",
        "status": "ok",
        "eta_update_id": result["eta_update_id"],
        "declared_eta_ts": declared_eta_ts,
        "confidence_code": confidence_code,
        "exception_created": result["exception_created"],
        "exception_id": result.get("exception_id"),
        "message": result["message"],
    }


def _get_fresh_feasible_options(
    driver_id: str,
    after_time: Optional[str],
    preference: Optional[str],
) -> Dict[str, Any]:
    active = repo.get_driver_active_shipments(driver_id)
    if not active:
        return _error("get_fresh_feasible_options", "NO_ACTIVE_SHIPMENTS", "No active shipment.")
    if len(active) > 1:
        return _error(
            "get_fresh_feasible_options", "AMBIGUOUS_SHIPMENT",
            "Call select_my_shipment_by_order_reference first.",
        )

    shipment_id = active[0]["shipment_id"]
    options_result = operations.assemble_fresh_feasible_options(driver_id, shipment_id)

    slots = options_result.get("feasible", [])
    if after_time:
        slots = [s for s in slots if s.get("slot_start_ts", "") >= after_time]

    # Apply a simple preference filter (does not affect correctness; just ordering).
    if preference == "earliest" or preference is None:
        slots = sorted(slots, key=lambda s: s.get("slot_start_ts", ""))

    if not slots and options_result.get("escalation_reason"):
        return {
            "tool": "get_fresh_feasible_options",
            "status": "escalate",
            "code": "NO_FEASIBLE_SLOTS",
            "message": options_result["escalation_reason"],
        }

    return {
        "tool": "get_fresh_feasible_options",
        "status": "ok",
        "shipment_id": shipment_id,
        "total_feasible": len(slots),
        "options": [
            {
                "slot_id": s["slot_id"],
                "dock_code": s["dock_code"],
                "slot_start_ts": s["slot_start_ts"],
                "slot_end_ts": s["slot_end_ts"],
                "needs_manual_approval": s.get("needs_approval", False),
            }
            for s in slots
        ],
        "instruction_for_agent": (
            "Present these options to the driver. Showing options does not reserve "
            "any slot. Only call select_slot after the driver explicitly confirms a choice."
        ),
    }


def _select_slot(
    driver_id: str,
    slot_id: str,
    order_reference: Optional[str],
    thread_id: Optional[str],
) -> Dict[str, Any]:
    result = booking.select_slot_for_driver(driver_id, slot_id, order_reference=order_reference)
    status = result["status"]

    if status == "pending_confirmation":
        return {
            "tool": "select_slot",
            "status": "pending_confirmation",
            "appointment_id": result["appointment_id"],
            "slot_id": result["slot_id"],
            "slot_start_ts": result["slot_start_ts"],
            "slot_end_ts": result["slot_end_ts"],
            "message": (
                "Your slot request has been sent to the warehouse. Capacity is now "
                "reserved pending their confirmation. You will be notified once confirmed."
            ),
        }

    if status == "conflict":
        return {
            "tool": "select_slot",
            "status": "conflict",
            "code": result.get("code"),
            "message": result.get("message"),
            "instruction_for_agent": (
                "This slot was just taken by another booking. Call get_fresh_feasible_options "
                "immediately to show the driver current availability. Do not retry the same slot."
            ),
        }

    if status == "needs_information":
        return {
            "tool": "select_slot",
            "status": "needs_information",
            "code": result.get("code"),
            "message": result.get("message"),
            "choices": result.get("choices", []),
        }

    # invalid / escalate passthrough
    return {
        "tool": "select_slot",
        "status": status,
        "code": result.get("code"),
        "message": result.get("message"),
    }


def _get_my_exception_or_appointment_status(driver_id: str) -> Dict[str, Any]:
    active = repo.get_driver_active_shipments(driver_id)
    if not active:
        return {
            "tool": "get_my_exception_or_appointment_status",
            "status": "escalate",
            "code": "NO_ACTIVE_SHIPMENTS",
            "message": "No active shipments found.",
        }

    results = []
    for shipment in active:
        shipment_id = shipment["shipment_id"]
        appt = repo.get_current_appointment(shipment_id)
        exceptions = repo.get_open_exceptions(driver_id=driver_id)
        relevant_exc = [e for e in exceptions if e.get("shipment_id") == shipment_id]

        appt_summary = None
        if appt:
            is_warehouse_confirmed = (
                appt["appointment_status"] == "CONFIRMED"
                and bool(appt.get("warehouse_confirmation_ref"))
            )
            appt_summary = {
                "appointment_id": appt["appointment_id"],
                "appointment_status": appt["appointment_status"],
                "slot_id": appt["slot_id"],
                "is_warehouse_confirmed": is_warehouse_confirmed,
                "warehouse_confirmation_ref": appt.get("warehouse_confirmation_ref"),
                # Reminder: PENDING_CONFIRMATION means capacity reserved, not warehouse-confirmed
                "pending_message": (
                    "Your booking request is pending warehouse confirmation."
                    if appt["appointment_status"] == "PENDING_CONFIRMATION" else None
                ),
            }

        results.append({
            "order_reference": shipment["order_reference"],
            "current_status": shipment["current_status"],
            "appointment": appt_summary,
            "open_exceptions": [
                {
                    "exception_id": e["exception_id"],
                    "exception_type": e["exception_type"],
                    "exception_status": e["exception_status"],
                }
                for e in relevant_exc
            ],
        })

    return {
        "tool": "get_my_exception_or_appointment_status",
        "status": "ok",
        "shipments": results,
    }


def _error(tool_name: str, code: str, message: str) -> Dict[str, Any]:
    return {"tool": tool_name, "status": "invalid", "code": code, "message": message}

