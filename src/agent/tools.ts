import { resolveDriverOperationalContext, selectDriverShipmentByOrderReference, persistDriverDeclaredETA, getExceptionOrAppointmentStatus } from '../domain/operations';
import { assembleFeasibleSlotOptions } from '../domain/feasibility';
import { selectSlotForDriver } from '../domain/booking';
import { db } from '../db/dataStore';

export const TOOL_DEFINITIONS = [
  {
    name: 'get_my_current_context',
    description: 'Resolve the current operational context for the logged-in driver session.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'select_my_shipment_by_order_reference',
    description: 'Select an active shipment by its human-readable order reference when the driver has multiple active assignments.',
    parameters: {
      type: 'OBJECT',
      properties: {
        order_reference: {
          type: 'STRING',
          description: 'The human-readable order reference selected by the driver (e.g. ORD-260804-004)',
        },
      },
      required: ['order_reference'],
    },
  },
  {
    name: 'report_delay_or_eta',
    description: 'Record a driver-declared ETA update, confidence code, and optional delay reason.',
    parameters: {
      type: 'OBJECT',
      properties: {
        declared_eta_ts: {
          type: 'STRING',
          description: 'The declared ETA in ISO 8601 format (e.g. 2026-08-04T11:20:00+05:30) or clear time representation.',
        },
        confidence_code: {
          type: 'STRING',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
          description: 'The confidence level explicitly stated or conveyed by the driver.',
        },
        delay_reason_code: {
          type: 'STRING',
          enum: ['TRAFFIC', 'BREAKDOWN', 'WEATHER', 'LOADING_DELAY', 'ROUTE_ISSUE', 'OTHER'],
          description: 'The reason for delay if provided.',
        },
      },
      required: ['declared_eta_ts', 'confidence_code'],
    },
  },
  {
    name: 'get_fresh_feasible_options',
    description: 'Fetch current available and feasible dock slot options for the driver\'s active shipment.',
    parameters: {
      type: 'OBJECT',
      properties: {
        max_options: {
          type: 'INTEGER',
          description: 'Maximum number of options to return (default 5).',
        },
      },
    },
  },
  {
    name: 'select_slot',
    description: 'Attempt to book a specific slot selected by the driver.',
    parameters: {
      type: 'OBJECT',
      properties: {
        slot_id: {
          type: 'STRING',
          description: 'The slot ID selected from the feasible options list (e.g. SLOT-JAI-004).',
        },
        order_reference: {
          type: 'STRING',
          description: 'Optional order reference if multiple shipments were active.',
        },
      },
      required: ['slot_id'],
    },
  },
  {
    name: 'get_my_exception_or_appointment_status',
    description: 'Retrieve the latest status of the driver\'s appointment, warehouse confirmation ref, or reported exception.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

export async function dispatchToolCall(toolName: string, args: Record<string, any>, driverId: string): Promise<any> {
  switch (toolName) {
    case 'get_my_current_context': {
      return resolveDriverOperationalContext(driverId);
    }
    case 'select_my_shipment_by_order_reference': {
      const orderRef = String(args.order_reference || '');
      return selectDriverShipmentByOrderReference(driverId, orderRef);
    }
    case 'report_delay_or_eta': {
      const activeShipments = db.getDriverActiveShipments(driverId);
      if (activeShipments.length === 0) {
        return { status: 'escalate', message: 'No active shipment found for driver.' };
      }
      const shipmentId = activeShipments[0].shipment_id;
      let etaTs = String(args.declared_eta_ts || '');
      if (!etaTs.includes('T') && !etaTs.includes(':')) {
        etaTs = `2026-08-04T${etaTs}:00+05:30`;
      } else if (!etaTs.includes('+05:30') && !etaTs.endsWith('Z')) {
        if (!etaTs.includes('2026-08-04')) {
          etaTs = `2026-08-04T${etaTs.padStart(5, '0')}:00+05:30`;
        } else {
          etaTs = `${etaTs}+05:30`;
        }
      }
      const confidence = (args.confidence_code as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM';
      const reason = args.delay_reason_code || null;
      return persistDriverDeclaredETA(driverId, shipmentId, etaTs, confidence, reason);
    }
    case 'get_fresh_feasible_options': {
      const activeShipments = db.getDriverActiveShipments(driverId);
      if (activeShipments.length === 0) {
        return { status: 'escalate', message: 'No active shipment found for driver.' };
      }
      const shipment = activeShipments[0];
      const maxOptions = args.max_options || 5;
      const result = assembleFeasibleSlotOptions(shipment.shipment_id, shipment.destination_facility_id, undefined, maxOptions);
      if (result.feasible.length === 0) {
        return {
          status: 'escalate',
          message: result.escalation_reason || 'No feasible slots found.',
        };
      }
      return {
        status: 'ok',
        total_feasible: result.total_feasible,
        options: result.feasible,
      };
    }
    case 'select_slot': {
      const slotId = String(args.slot_id || '');
      const orderRef = args.order_reference ? String(args.order_reference) : null;
      return await selectSlotForDriver(driverId, slotId, orderRef);
    }
    case 'get_my_exception_or_appointment_status': {
      return getExceptionOrAppointmentStatus(driverId);
    }
    default:
      return { status: 'error', message: `Unknown tool ${toolName}` };
  }
}
