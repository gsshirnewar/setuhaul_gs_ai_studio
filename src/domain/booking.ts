import { db } from '../db/dataStore';

export function selectSlotForDriver(
  driverId: string,
  slotId: string,
  orderReference?: string | null
) {
  let shipmentId: string | null = null;

  if (orderReference) {
    shipmentId = db.getShipmentIdByOrderReferenceForDriver(driverId, orderReference);
  } else {
    const activeShipments = db.getDriverActiveShipments(driverId);
    if (activeShipments.length === 1) {
      shipmentId = activeShipments[0].shipment_id;
    } else if (activeShipments.length > 1) {
      return {
        status: 'needs_information',
        code: 'MULTIPLE_ACTIVE_SHIPMENTS',
        message: 'Driver has multiple active shipments. Please specify which order reference this slot is for.',
        choices: activeShipments.map(s => s.order_reference),
      };
    }
  }

  if (!shipmentId) {
    return {
      status: 'invalid',
      code: 'SHIPMENT_NOT_RESOLVED',
      message: 'Could not resolve an active shipment for this driver.',
    };
  }

  const result = db.executeSlotBookingTransaction(shipmentId, slotId);

  // If successfully booked, update exception status if any
  if (result.status === 'pending_confirmation') {
    const exc = db.driverExceptions.find(
      e => e.driver_id === driverId && e.shipment_id === shipmentId && ['OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED'].includes(e.exception_status)
    );
    if (exc) {
      exc.exception_status = 'WAITING_CONFIRMATION';
    }
  }

  return result;
}

export function confirmBooking(appointmentId: string, warehouseConfirmationRef: string) {
  return db.confirmPendingAppointment(appointmentId, warehouseConfirmationRef);
}
