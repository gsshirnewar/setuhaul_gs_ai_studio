import { db } from '../db/dataStore';

export function resolveDriverOperationalContext(driverId: string) {
  const context = db.getDriverOperationalContext(driverId);
  if (!context) {
    return {
      status: 'escalate',
      driver_id: driverId,
      message: 'No active shipments found for this driver.',
    };
  }

  if (context.isPendingApproval) {
    return {
      status: 'pending_approval',
      driver_id: driverId,
      driver_name: context.driver_name,
      approval_status: 'PENDING',
      vehicle_registration: context.vehicle_registration,
      registered_at: context.registered_at,
      message: 'Driver registration is currently being processed by the facility coordinator.',
    };
  }

  if (context.ambiguous) {
    return {
      status: 'needs_information',
      driver_id: driverId,
      choices: context.choices,
      choice_count: context.choice_count,
      message: context.message,
    };
  }

  return {
    status: 'ready',
    driver_id: driverId,
    shipment_id: context.shipment.shipment_id,
    order_reference: context.shipment.order_reference,
    carrier_name: context.carrier?.carrier_name,
    vehicle_registration: context.vehicle?.registration_number,
    facility_id: context.facility?.facility_id,
    facility_name: context.facility?.facility_name,
    required_dock_type: context.shipment.required_dock_type,
    effective_eta: context.latest_eta?.effective_eta_ts,
    eta_confidence: context.latest_eta?.eta_confidence,
    current_appointment: context.current_appointment ? {
      appointment_id: context.current_appointment.appointment_id,
      slot_start_ts: context.current_appointment.slot?.slot_start_ts,
      slot_end_ts: context.current_appointment.slot?.slot_end_ts,
      dock_code: context.current_appointment.dock_code,
      status: context.current_appointment.appointment_status,
      is_warehouse_confirmed: context.current_appointment.is_warehouse_confirmed,
      warehouse_confirmation_ref: context.current_appointment.warehouse_confirmation_ref,
    } : null,
    active_exceptions: context.dock_status_events?.length || 0,
    checkin_state: context.facility_checkin?.queue_state || null,
  };
}

export function selectDriverShipmentByOrderReference(driverId: string, orderRef: string) {
  const shipmentId = db.getShipmentIdByOrderReferenceForDriver(driverId, orderRef);
  if (!shipmentId) {
    const activeShipments = db.getDriverActiveShipments(driverId);
    return {
      status: 'not_found',
      driver_id: driverId,
      order_reference: orderRef,
      message: `No active shipment with order reference "${orderRef}" found for driver ${driverId}.`,
      valid_choices: activeShipments.map(s => s.order_reference),
    };
  }

  const shipment = db.getShipment(shipmentId)!;
  const facility = db.getFacility(shipment.destination_facility_id);
  const latestEta = db.getLatestETA(shipmentId);
  const currentAppt = db.getCurrentAppointment(shipmentId);

  return {
    status: 'ready',
    driver_id: driverId,
    shipment_id: shipment.shipment_id,
    order_reference: shipment.order_reference,
    facility_id: shipment.destination_facility_id,
    facility_name: facility ? facility.facility_name : shipment.destination_facility_id,
    required_dock_type: shipment.required_dock_type,
    effective_eta: latestEta?.effective_eta_ts,
    eta_confidence: latestEta?.eta_confidence,
    current_appointment: currentAppt ? {
      appointment_id: currentAppt.appointment_id,
      slot_start_ts: currentAppt.slot?.slot_start_ts,
      slot_end_ts: currentAppt.slot?.slot_end_ts,
      dock_code: currentAppt.dock_code,
      status: currentAppt.appointment_status,
      is_warehouse_confirmed: currentAppt.is_warehouse_confirmed,
      warehouse_confirmation_ref: currentAppt.warehouse_confirmation_ref,
    } : null,
  };
}

export function persistDriverDeclaredETA(
  driverId: string,
  shipmentId: string,
  declaredEtaTs: string,
  confidenceCode: 'LOW' | 'MEDIUM' | 'HIGH',
  delayReasonCode?: string | null
) {
  const thread = db.createOrGetChatThread(driverId, shipmentId, 'REPORT_DELAY');
  const etaResult = db.persistDriverETA(shipmentId, declaredEtaTs, confidenceCode, delayReasonCode, driverId);

  const exceptionResult = db.persistDriverException(
    driverId,
    thread.thread_id,
    shipmentId,
    'DELAY',
    'NEEDS_INFORMATION',
    `Driver declared ETA ${declaredEtaTs} (confidence: ${confidenceCode}, reason: ${delayReasonCode || 'Not provided'})`
  );

  return {
    status: 'ok',
    shipment_id: shipmentId,
    declared_eta_ts: declaredEtaTs,
    confidence_code: confidenceCode,
    delay_reason_code: delayReasonCode || null,
    eta_update_id: etaResult.eta_update_id,
    exception_id: exceptionResult.exception_id,
    thread_id: thread.thread_id,
    message: `ETA recorded: ${declaredEtaTs}. Exception registered with status NEEDS_INFORMATION.`,
  };
}

export function getExceptionOrAppointmentStatus(driverId: string, shipmentId?: string | null) {
  let targetShipmentId = shipmentId;
  if (!targetShipmentId) {
    const active = db.getDriverActiveShipments(driverId);
    if (active.length === 1) {
      targetShipmentId = active[0].shipment_id;
    }
  }

  if (!targetShipmentId) {
    return {
      status: 'needs_information',
      message: 'Could not uniquely identify the shipment to check status for.',
    };
  }

  const appt = db.getCurrentAppointment(targetShipmentId);
  const eta = db.getLatestETA(targetShipmentId);
  const shipment = db.getShipment(targetShipmentId);

  return {
    status: 'ok',
    shipment_id: targetShipmentId,
    order_reference: shipment?.order_reference,
    current_status: shipment?.current_status,
    effective_eta: eta?.effective_eta_ts,
    eta_confidence: eta?.eta_confidence,
    appointment: appt ? {
      appointment_id: appt.appointment_id,
      slot_id: appt.slot_id,
      slot_start_ts: appt.slot?.slot_start_ts,
      slot_end_ts: appt.slot?.slot_end_ts,
      dock_code: appt.dock_code,
      status: appt.appointment_status,
      is_warehouse_confirmed: appt.is_warehouse_confirmed,
      warehouse_confirmation_ref: appt.warehouse_confirmation_ref,
      booked_at: appt.booked_at,
    } : null,
  };
}
