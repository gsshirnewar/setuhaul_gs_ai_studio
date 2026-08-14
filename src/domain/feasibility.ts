import { db } from '../db/dataStore';
import { AppointmentSlot, FacilityRule, DockStatusEvent, Shipment } from '../types';

export interface FeasibilityEvaluation {
  feasible: boolean;
  reasons: string[];
  messages: string[];
  needs_manual_approval: boolean;
  recommendation: 'BOOK' | 'NEEDS_APPROVAL' | 'ESCALATE';
  slot_id?: string;
  dock_code?: string;
  slot_start_ts?: string;
  slot_end_ts?: string;
}

export function evaluateSlotFeasibility(
  shipmentId: string,
  slotData: AppointmentSlot & {
    dock_code: string;
    dock_type: 'STANDARD' | 'REEFER' | 'HEAVY';
    supports_refrigerated: number;
    max_vehicle_weight_kg: number;
  },
  facilityRules: FacilityRule[],
  dockStatusEvents: DockStatusEvent[]
): FeasibilityEvaluation {
  const reasons: string[] = [];
  const messages: string[] = [];
  let needsManualApproval = false;

  const shipment = db.getShipment(shipmentId);
  if (!shipment) {
    return {
      feasible: false,
      reasons: ['SHIPMENT_NOT_FOUND'],
      messages: [`Shipment ${shipmentId} not found in database.`],
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  const latestEta = db.getLatestETA(shipmentId);
  const vehicle = db.getVehicle(shipment.vehicle_id);
  const vehicleWeightLimit = vehicle?.capacity_kg;

  // CHECK 1: Slot Availability
  if (slotData.slot_status !== 'OPEN') {
    reasons.push(`SLOT_NOT_OPEN:${slotData.slot_status}`);
    messages.push(`Slot is not open (status: ${slotData.slot_status}).`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  // CHECK 2: Dock Type Compatibility
  const requiredDockType = shipment.required_dock_type || 'ANY';
  const slotDockType = slotData.dock_type;

  if (requiredDockType !== 'ANY' && slotDockType !== requiredDockType) {
    reasons.push(`DOCK_TYPE_MISMATCH:${requiredDockType}_vs_${slotDockType}`);
    messages.push(`Shipment requires ${requiredDockType} dock, but slot is ${slotDockType}.`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  // CHECK 3: Refrigeration Requirement
  if (shipment.temperature_control_required === 1 && !slotData.supports_refrigerated) {
    reasons.push('REEFER_REQUIRED_BUT_NOT_SUPPORTED');
    messages.push(`Shipment requires temperature control (reefer), but slot at ${slotData.dock_code} does not support it.`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  // CHECK 4: Vehicle Weight Capacity
  const shipmentWeight = shipment.load_weight_kg;
  const slotWeightLimit = slotData.max_vehicle_weight_kg;

  if (vehicleWeightLimit && shipmentWeight > vehicleWeightLimit) {
    reasons.push(`VEHICLE_WEIGHT_EXCEEDED:${shipmentWeight}_vs_${vehicleWeightLimit}`);
    messages.push(`Vehicle capacity ${vehicleWeightLimit} kg is less than shipment weight ${shipmentWeight} kg.`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  if (slotWeightLimit && shipmentWeight > slotWeightLimit) {
    reasons.push(`SLOT_WEIGHT_EXCEEDED:${shipmentWeight}_vs_${slotWeightLimit}`);
    messages.push(`Slot max weight ${slotWeightLimit} kg is less than shipment weight ${shipmentWeight} kg.`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  // CHECK 5: Slot Duration vs. Expected Unload Time
  const slotStart = new Date(slotData.slot_start_ts);
  const slotEnd = new Date(slotData.slot_end_ts);
  const slotDurationMin = Math.round((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60));

  if (slotDurationMin < shipment.expected_unload_min) {
    reasons.push(`INSUFFICIENT_SLOT_DURATION:${slotDurationMin}_vs_${shipment.expected_unload_min}`);
    messages.push(`Slot duration ${slotDurationMin} min is less than expected unload time ${shipment.expected_unload_min} min.`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  // CHECK 6: Dock Status Events (Breakdowns, Maintenance)
  const dockConflicts: string[] = [];
  for (const event of dockStatusEvents) {
    if (event.dock_id !== slotData.dock_id) continue;

    const eventStart = new Date(event.event_start_ts);
    const eventEnd = event.event_end_ts ? new Date(event.event_end_ts) : null;

    if (!eventEnd) {
      if (slotStart.getTime() >= eventStart.getTime()) {
        dockConflicts.push(`${event.event_type}:${event.reason || 'Unknown'} (ongoing from ${event.event_start_ts})`);
      }
    } else {
      // Overlap: not (slotEnd <= eventStart || slotStart >= eventEnd)
      if (!(slotEnd.getTime() <= eventStart.getTime() || slotStart.getTime() >= eventEnd.getTime())) {
        dockConflicts.push(`${event.event_type}:${event.reason || 'Unknown'} (${event.event_start_ts} to ${event.event_end_ts})`);
      }
    }
  }

  if (dockConflicts.length > 0) {
    reasons.push('DOCK_EVENT_CONFLICT');
    messages.push(`Slot conflicts with dock maintenance/breakdown: ${dockConflicts.join('; ')}`);
    return {
      feasible: false,
      reasons,
      messages,
      needs_manual_approval: false,
      recommendation: 'ESCALATE',
    };
  }

  // CHECK 7: ETA Confidence Warning
  if (latestEta && latestEta.eta_confidence === 'LOW') {
    reasons.push('LOW_CONFIDENCE_ETA');
    messages.push(`ETA confidence is LOW (${latestEta.effective_eta_ts}). Booking may be risky.`);
  }

  // CHECK 8: Facility Rules - LAST_NEW_START_TIME
  for (const rule of facilityRules) {
    if (rule.rule_type === 'LAST_NEW_START_TIME' && rule.active_flag === 1) {
      const parts = rule.rule_value.split(':');
      const ruleHour = parseInt(parts[0], 10);
      const ruleMinute = parts.length > 1 ? parseInt(parts[1], 10) : 0;

      const slotHour = slotStart.getHours();
      const slotMinute = slotStart.getMinutes();

      if (slotHour > ruleHour || (slotHour === ruleHour && slotMinute >= ruleMinute)) {
        needsManualApproval = true;
        reasons.push('LAST_NEW_START_TIME_VIOLATION');
        messages.push(`Slot starts at ${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}, but facility rule prohibits new starts after ${rule.rule_value} without manual approval.`);
      }
    }
  }

  const recommendation = needsManualApproval ? 'NEEDS_APPROVAL' : 'BOOK';

  return {
    feasible: true,
    reasons,
    messages,
    needs_manual_approval: needsManualApproval,
    recommendation,
    slot_id: slotData.slot_id,
    dock_code: slotData.dock_code,
    slot_start_ts: slotData.slot_start_ts,
    slot_end_ts: slotData.slot_end_ts,
  };
}

export function assembleFeasibleSlotOptions(
  shipmentId: string,
  facilityId: string,
  dockType?: string,
  maxOptions: number = 5
) {
  const facilityRules = db.getFacilityRules(facilityId);
  const dockStatusEvents = db.getDockStatusEvents(facilityId);
  const availableSlots = db.getAvailableSlots(facilityId, dockType);

  const feasibleSlots: any[] = [];
  let needsApprovalCount = 0;

  for (const slot of availableSlots) {
    const result = evaluateSlotFeasibility(shipmentId, slot, facilityRules, dockStatusEvents);
    if (result.feasible) {
      feasibleSlots.push({
        slot_id: result.slot_id,
        dock_code: result.dock_code,
        slot_start_ts: result.slot_start_ts,
        slot_end_ts: result.slot_end_ts,
        recommendation: result.recommendation,
        needs_approval: result.needs_manual_approval,
      });

      if (result.needs_manual_approval) {
        needsApprovalCount++;
      }
    }
  }

  const limitedSlots = feasibleSlots.slice(0, maxOptions);
  let escalationReason: string | null = null;
  if (limitedSlots.length === 0) {
    escalationReason = `No feasible slots available for ${shipmentId} at ${facilityId}. All available slots have conflicts with dock maintenance/breakdowns, insufficient duration, or other constraints.`;
  }

  return {
    shipment_id: shipmentId,
    facility_id: facilityId,
    total_available: availableSlots.length,
    total_feasible: limitedSlots.length,
    feasible: limitedSlots,
    needs_approval_count: needsApprovalCount,
    escalation_reason: escalationReason,
  };
}
