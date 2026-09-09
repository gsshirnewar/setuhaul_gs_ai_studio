import { db } from '../db/dataStore';
import { bookSlotWithConcurrency } from '../db/supabaseService';

export async function selectSlotForDriver(
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

  const shipment = db.getShipment(shipmentId);
  const driver = db.getDriver(driverId);

  // Execute Supabase atomic transaction with HOLD_PENDING state
  let supabaseResult: any = null;
  try {
    const vehicle = shipment ? db.getVehicle(shipment.vehicle_id) : null;
    const isPerishable = shipment?.required_dock_type === 'REEFER' || shipment?.temperature_control_required === 1;
    const isHighUrgency = shipment?.priority_code === 'HIGH' || shipment?.priority_code === 'CRITICAL';

    supabaseResult = await bookSlotWithConcurrency({
      driverId,
      driverName: driver?.driver_name || 'Driver',
      vehicleRegistration: driver?.vehicle_registration || vehicle?.registration_number || 'RJ14GT4101',
      shipmentId,
      slotId,
      facilityId: shipment?.destination_facility_id || 'FAC_JAI_01',
      cargoType: isPerishable ? 'PERISHABLE' : 'GENERAL',
      urgencyLevel: isHighUrgency ? 'HIGH' : 'MEDIUM',
      declaredEta: shipment?.latest_eta_ts || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      etaConfidenceScore: 92,
    });

    if (supabaseResult.status === 'conflict') {
      return {
        status: 'conflict',
        code: 'SLOT_ALREADY_CONFIRMED',
        message: supabaseResult.message,
        alternative_slots: supabaseResult.alternative_slots || [],
      };
    }
  } catch (err: any) {
    console.warn('[Supabase Concurrency] Fallback to local transaction:', err.message);
  }

  // Execute local transaction for memory synchrony
  const result = db.executeSlotBookingTransaction(shipmentId, slotId);

  // If successfully booked or placed on hold, update exception status
  if (result.status === 'pending_confirmation' || supabaseResult?.status === 'success') {
    const exc = db.driverExceptions.find(
      e => e.driver_id === driverId && e.shipment_id === shipmentId && ['OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED'].includes(e.exception_status)
    );
    if (exc) {
      exc.exception_status = 'WAITING_CONFIRMATION';
    }

    if (supabaseResult?.is_contested) {
      return {
        status: 'pending_confirmation',
        code: 'CONTENTION_FLAGGED',
        appointment_id: supabaseResult.appointment_id || result.appointment_id,
        shipment_id: shipmentId,
        slot_id: slotId,
        is_contested: true,
        message: supabaseResult.message,
      };
    }
  }

  return result;
}

export function confirmBooking(appointmentId: string, warehouseConfirmationRef: string) {
  return db.confirmPendingAppointment(appointmentId, warehouseConfirmationRef);
}

