import {
  Coordinator,
  Facility,
  Dock,
  FacilityRule,
  DockStatusEvent,
  Carrier,
  Driver,
  Vehicle,
  VehicleType,
  Shipment,
  AppointmentSlot,
  Appointment,
  ETAUpdate,
  FacilityCheckin,
  DriverException,
  ChatThread,
  ChatMessage,
} from '../types';
import {
  INITIAL_COORDINATORS,
  INITIAL_FACILITIES,
  INITIAL_DOCKS,
  INITIAL_FACILITY_RULES,
  INITIAL_DOCK_STATUS_EVENTS,
  INITIAL_CARRIERS,
  INITIAL_DRIVERS,
  INITIAL_VEHICLE_TYPES,
  INITIAL_VEHICLES,
  INITIAL_SHIPMENTS,
  generateSlots,
  INITIAL_APPOINTMENTS,
  INITIAL_ETA_UPDATES,
  INITIAL_FACILITY_CHECKINS,
  INITIAL_DRIVER_EXCEPTIONS,
  INITIAL_CHAT_THREADS,
  INITIAL_CHAT_MESSAGES,
} from './seedData';

class DataStore {
  coordinators: Coordinator[] = [];
  facilities: Facility[] = [];
  docks: Dock[] = [];
  facilityRules: FacilityRule[] = [];
  dockStatusEvents: DockStatusEvent[] = [];
  carriers: Carrier[] = [];
  drivers: Driver[] = [];
  vehicleTypes: VehicleType[] = [];
  vehicles: Vehicle[] = [];
  shipments: Shipment[] = [];
  appointmentSlots: AppointmentSlot[] = [];
  appointments: Appointment[] = [];
  etaUpdates: ETAUpdate[] = [];
  facilityCheckins: FacilityCheckin[] = [];
  driverExceptions: DriverException[] = [];
  chatThreads: ChatThread[] = [];
  chatMessages: ChatMessage[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.coordinators = JSON.parse(JSON.stringify(INITIAL_COORDINATORS));
    this.facilities = JSON.parse(JSON.stringify(INITIAL_FACILITIES));
    this.docks = JSON.parse(JSON.stringify(INITIAL_DOCKS));
    this.facilityRules = JSON.parse(JSON.stringify(INITIAL_FACILITY_RULES));
    this.dockStatusEvents = JSON.parse(JSON.stringify(INITIAL_DOCK_STATUS_EVENTS));
    this.carriers = JSON.parse(JSON.stringify(INITIAL_CARRIERS));
    this.drivers = JSON.parse(JSON.stringify(INITIAL_DRIVERS));
    this.vehicleTypes = JSON.parse(JSON.stringify(INITIAL_VEHICLE_TYPES));
    this.vehicles = JSON.parse(JSON.stringify(INITIAL_VEHICLES));
    this.shipments = JSON.parse(JSON.stringify(INITIAL_SHIPMENTS));
    this.appointmentSlots = generateSlots();
    this.appointments = JSON.parse(JSON.stringify(INITIAL_APPOINTMENTS));
    this.etaUpdates = JSON.parse(JSON.stringify(INITIAL_ETA_UPDATES));
    this.facilityCheckins = JSON.parse(JSON.stringify(INITIAL_FACILITY_CHECKINS));
    this.driverExceptions = JSON.parse(JSON.stringify(INITIAL_DRIVER_EXCEPTIONS));
    this.chatThreads = [];
    this.chatMessages = [];
  }

  // Coordinators
  getCoordinators(facilityId?: string): Coordinator[] {
    if (facilityId) {
      return this.coordinators.filter(c => c.facility_id === facilityId);
    }
    return this.coordinators;
  }

  getCoordinator(coordinatorId: string): Coordinator | undefined {
    return this.coordinators.find(c => c.coordinator_id === coordinatorId);
  }

  getCoordinatorByEmail(email: string): Coordinator | undefined {
    const normalized = email.trim().toLowerCase();
    return this.coordinators.find(c => c.email.toLowerCase() === normalized);
  }

  // Facility & Docks
  getFacilities(): Facility[] {
    return this.facilities.filter(f => f.active_flag === 1);
  }

  getFacility(facilityId: string): Facility | undefined {
    return this.facilities.find(f => f.facility_id === facilityId);
  }

  getDocks(facilityId: string): Dock[] {
    return this.docks.filter(d => d.facility_id === facilityId);
  }

  getDock(dockId: string): Dock | undefined {
    return this.docks.find(d => d.dock_id === dockId);
  }

  getFacilityRules(facilityId: string): FacilityRule[] {
    return this.facilityRules.filter(r => r.facility_id === facilityId && r.active_flag === 1);
  }

  getDockStatusEvents(facilityId: string): (DockStatusEvent & { dock_code?: string })[] {
    const facilityDockIds = new Set(this.docks.filter(d => d.facility_id === facilityId).map(d => d.dock_id));
    return this.dockStatusEvents
      .filter(e => facilityDockIds.has(e.dock_id))
      .map(e => {
        const dock = this.docks.find(d => d.dock_id === e.dock_id);
        return {
          ...e,
          dock_code: dock?.dock_code,
        };
      })
      .sort((a, b) => b.event_start_ts.localeCompare(a.event_start_ts));
  }

  // Driver & Carrier & Vehicles
  getDrivers(): Driver[] {
    return this.drivers.filter(d => d.driver_status === 'ACTIVE');
  }

  getDriver(driverId: string): Driver | undefined {
    return this.drivers.find(d => d.driver_id === driverId);
  }

  getCarrier(carrierId: string): Carrier | undefined {
    return this.carriers.find(c => c.carrier_id === carrierId);
  }

  getVehicle(vehicleId: string): Vehicle | undefined {
    return this.vehicles.find(v => v.vehicle_id === vehicleId);
  }

  // Shipments & Latest ETA
  getShipment(shipmentId: string): Shipment | undefined {
    return this.shipments.find(s => s.shipment_id === shipmentId);
  }

  getDriverActiveShipments(driverId: string): Shipment[] {
    const activeStatuses = ['ASSIGNED', 'IN_TRANSIT', 'AT_GATE', 'WAITING', 'IN_DOCK'];
    return this.shipments
      .filter(s => s.driver_id === driverId && activeStatuses.includes(s.current_status))
      .sort((a, b) => {
        if (a.priority_code !== b.priority_code) {
          const pOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
          return (pOrder[b.priority_code] || 0) - (pOrder[a.priority_code] || 0);
        }
        return a.original_eta_ts.localeCompare(b.original_eta_ts);
      });
  }

  getLatestETA(shipmentId: string): {
    shipment_id: string;
    original_eta_ts: string;
    effective_eta_ts: string;
    eta_source: string;
    eta_confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    delay_reason_code: string | null;
    eta_note: string | null;
    eta_updated_at: string;
  } | null {
    const s = this.getShipment(shipmentId);
    if (!s) return null;

    const updates = this.etaUpdates
      .filter(u => u.shipment_id === shipmentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    if (updates.length > 0) {
      const top = updates[0];
      return {
        shipment_id: s.shipment_id,
        original_eta_ts: s.original_eta_ts,
        effective_eta_ts: top.declared_eta_ts || s.latest_eta_ts || s.original_eta_ts,
        eta_source: top.source_type,
        eta_confidence: top.confidence_code,
        delay_reason_code: top.delay_reason_code,
        eta_note: top.note,
        eta_updated_at: top.created_at,
      };
    }

    return {
      shipment_id: s.shipment_id,
      original_eta_ts: s.original_eta_ts,
      effective_eta_ts: s.latest_eta_ts || s.original_eta_ts,
      eta_source: 'ORIGINAL_PLAN',
      eta_confidence: 'HIGH',
      delay_reason_code: null,
      eta_note: null,
      eta_updated_at: s.created_at,
    };
  }

  getCurrentAppointment(shipmentId: string): (Appointment & {
    slot?: AppointmentSlot;
    dock?: Dock;
    dock_code?: string;
    is_warehouse_confirmed?: boolean;
  }) | null {
    const appt = this.appointments.find(
      a => a.shipment_id === shipmentId &&
        a.is_current === 1 &&
        ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(a.appointment_status)
    );
    if (!appt) return null;

    const slot = this.appointmentSlots.find(sl => sl.slot_id === appt.slot_id);
    const dock = slot ? this.docks.find(d => d.dock_id === slot.dock_id) : undefined;

    return {
      ...appt,
      slot,
      dock,
      dock_code: dock?.dock_code,
      is_warehouse_confirmed: appt.appointment_status === 'CONFIRMED' && !!appt.warehouse_confirmation_ref,
    };
  }

  getFacilityCheckin(shipmentId: string): FacilityCheckin | undefined {
    return this.facilityCheckins.find(c => c.shipment_id === shipmentId);
  }

  // Driver Operational Context
  getDriverOperationalContext(driverId: string): any {
    const shipments = this.getDriverActiveShipments(driverId);
    if (!shipments || shipments.length === 0) {
      return null;
    }

    if (shipments.length > 1) {
      // Ambiguous case
      const choices = shipments.map(s => {
        const fac = this.getFacility(s.destination_facility_id);
        return {
          order_reference: s.order_reference,
          destination_facility: fac ? fac.facility_name : s.destination_facility_id,
          expected_eta: s.latest_eta_ts || s.original_eta_ts,
          current_status: s.current_status,
        };
      });

      return {
        ambiguous: true,
        driver_id: driverId,
        choice_count: shipments.length,
        choices,
        message: `You have ${shipments.length} active shipments. Please select by order reference.`,
      };
    }

    const shipment = shipments[0];
    const shipmentId = shipment.shipment_id;
    const carrier = this.getCarrier(shipment.carrier_id);
    const vehicle = this.getVehicle(shipment.vehicle_id);
    const facility = this.getFacility(shipment.destination_facility_id);
    const latestEta = this.getLatestETA(shipmentId);
    const currentAppointment = this.getCurrentAppointment(shipmentId);
    const dockStatusEvents = this.getDockStatusEvents(shipment.destination_facility_id);
    const facilityRules = this.getFacilityRules(shipment.destination_facility_id);
    const facilityCheckin = this.getFacilityCheckin(shipmentId);

    return {
      ambiguous: false,
      driver_id: driverId,
      shipment,
      carrier,
      vehicle,
      facility,
      latest_eta: latestEta,
      current_appointment: currentAppointment,
      dock_status_events: dockStatusEvents,
      facility_rules: facilityRules,
      facility_checkin: facilityCheckin,
    };
  }

  getShipmentIdByOrderReferenceForDriver(driverId: string, orderRef: string): string | null {
    const s = this.shipments.find(
      ship => ship.driver_id === driverId &&
        ship.order_reference.toLowerCase() === orderRef.trim().toLowerCase() &&
        ['ASSIGNED', 'IN_TRANSIT', 'AT_GATE', 'WAITING', 'IN_DOCK'].includes(ship.current_status)
    );
    return s ? s.shipment_id : null;
  }

  // Available Slots for a facility
  getAvailableSlots(facilityId: string, dockType?: string): (AppointmentSlot & {
    dock_code: string;
    dock_type: 'STANDARD' | 'REEFER' | 'HEAVY';
    supports_refrigerated: number;
    max_vehicle_weight_kg: number;
    is_occupied: boolean;
  })[] {
    const facilityDocks = this.docks.filter(d => d.facility_id === facilityId && (dockType ? d.dock_type === dockType : true));
    const dockMap = new Map(facilityDocks.map(d => [d.dock_id, d]));

    // Check which slots have active appointments
    const occupiedSlotIds = new Set(
      this.appointments
        .filter(a => ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(a.appointment_status) && a.is_current === 1)
        .map(a => a.slot_id)
    );

    return this.appointmentSlots
      .filter(s => s.facility_id === facilityId && dockMap.has(s.dock_id))
      .map(s => {
        const dock = dockMap.get(s.dock_id)!;
        const isOccupied = occupiedSlotIds.has(s.slot_id);
        return {
          ...s,
          dock_code: dock.dock_code,
          dock_type: dock.dock_type,
          supports_refrigerated: dock.supports_refrigerated,
          max_vehicle_weight_kg: dock.max_vehicle_weight_kg,
          is_occupied: isOccupied,
        };
      })
      .filter(s => s.slot_status === 'OPEN' && !s.is_occupied)
      .sort((a, b) => a.slot_start_ts.localeCompare(b.slot_start_ts));
  }

  // Persistence: ETA
  persistDriverETA(
    shipmentId: string,
    declaredEtaTs: string,
    confidenceCode: 'LOW' | 'MEDIUM' | 'HIGH',
    delayReasonCode?: string | null,
    reportedByDriverId?: string | null
  ) {
    const updateId = `ETA-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = new Date().toISOString();

    const record: ETAUpdate = {
      eta_update_id: updateId,
      shipment_id: shipmentId,
      source_type: 'DRIVER_DECLARED',
      reported_by_driver_id: reportedByDriverId || null,
      declared_eta_ts: declaredEtaTs,
      confidence_code: confidenceCode,
      delay_reason_code: delayReasonCode || null,
      note: `Driver declared ETA with ${confidenceCode} confidence`,
      created_at: now,
    };

    this.etaUpdates.unshift(record);

    // Update shipment's latest_eta_ts
    const s = this.shipments.find(sh => sh.shipment_id === shipmentId);
    if (s) {
      s.latest_eta_ts = declaredEtaTs;
      s.updated_at = now;
    }

    return {
      eta_update_id: updateId,
      shipment_id: shipmentId,
      declared_eta_ts: declaredEtaTs,
      confidence_code: confidenceCode,
      message: `ETA updated: ${declaredEtaTs} (confidence: ${confidenceCode})`,
    };
  }

  // Persistence: Driver Exception
  persistDriverException(
    driverId: string,
    threadId: string,
    shipmentId: string | null,
    exceptionType: 'DELAY' | 'BREAKDOWN' | 'TRAFFIC' | 'WEATHER' | 'EARLY_ARRIVAL' | 'DOCK_UNAVAILABLE' | 'UNKNOWN',
    exceptionStatus: 'OPEN' | 'NEEDS_INFORMATION' | 'SLOT_OPTIONS_SHARED' | 'WAITING_CONFIRMATION' | 'RESOLVED' | 'ESCALATED' | 'DUPLICATE' | 'CANCELLED' = 'NEEDS_INFORMATION',
    description: string = '',
    dedupeKey?: string | null
  ) {
    const excId = `EXC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = new Date().toISOString();

    const record: DriverException = {
      exception_id: excId,
      shipment_id: shipmentId,
      driver_id: driverId,
      thread_id: threadId,
      exception_type: exceptionType,
      reported_at: now,
      reported_delay_min: null,
      declared_eta_ts: null,
      earliest_acceptable_ts: null,
      latest_acceptable_ts: null,
      severity_code: 'MEDIUM',
      exception_status: exceptionStatus,
      description: description || exceptionType,
      dedupe_key: dedupeKey || null,
    };

    this.driverExceptions.unshift(record);

    return {
      exception_id: excId,
      driver_id: driverId,
      exception_type: exceptionType,
      exception_status: exceptionStatus,
      message: `Exception recorded: ${exceptionType}`,
    };
  }

  // Chat Thread & Messages
  createOrGetChatThread(driverId: string, shipmentId: string | null = null, threadReason: string = 'CHECK_STATUS'): { thread_id: string; created: boolean; thread_status: string } {
    const existing = this.chatThreads.find(
      t => t.driver_id === driverId &&
        (shipmentId ? t.shipment_id === shipmentId : true) &&
        ['OPEN', 'WAITING_FOR_DRIVER', 'WAITING_FOR_WAREHOUSE'].includes(t.thread_status)
    );

    if (existing) {
      return {
        thread_id: existing.thread_id,
        created: false,
        thread_status: existing.thread_status,
      };
    }

    const threadId = `THR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = new Date().toISOString();

    const newThread: ChatThread = {
      thread_id: threadId,
      driver_id: driverId,
      shipment_id: shipmentId,
      opened_at: now,
      closed_at: null,
      thread_status: 'OPEN',
      thread_intent: (threadReason as any) || 'CHECK_STATUS',
    };

    this.chatThreads.unshift(newThread);

    return {
      thread_id: threadId,
      created: true,
      thread_status: 'OPEN',
    };
  }

  getThreadMessages(threadId: string): ChatMessage[] {
    return this.chatMessages
      .filter(m => m.thread_id === threadId)
      .sort((a, b) => a.message_ts.localeCompare(b.message_ts));
  }

  persistChatMessage(
    threadId: string,
    senderType: 'DRIVER' | 'AGENT' | 'OPERATIONS' | 'WAREHOUSE' | 'SYSTEM',
    senderReference: string,
    messageText: string,
    externalMessageId?: string | null
  ): ChatMessage {
    const msgId = `MSG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = new Date().toISOString();

    const isDuplicate = externalMessageId
      ? this.chatMessages.some(m => m.external_message_id === externalMessageId)
      : false;

    const msg: ChatMessage = {
      chat_message_id: msgId,
      thread_id: threadId,
      sender_type: senderType,
      sender_reference: senderReference,
      message_text: messageText,
      message_ts: now,
      external_message_id: externalMessageId || null,
      is_duplicate: isDuplicate ? 1 : 0,
      parsed_intent: null,
      extracted_eta_ts: null,
      requires_human_review: 0,
    };

    this.chatMessages.push(msg);
    return msg;
  }

  clearDriverChatHistory(driverId?: string): void {
    if (driverId) {
      const threadIds = this.chatThreads.filter(t => t.driver_id === driverId).map(t => t.thread_id);
      this.chatMessages = this.chatMessages.filter(m => !threadIds.includes(m.thread_id));
      this.chatThreads = this.chatThreads.filter(t => t.driver_id !== driverId);
    } else {
      this.chatMessages = [];
      this.chatThreads = [];
    }
  }

  // Slot Booking Transaction
  executeSlotBookingTransaction(shipmentId: string, slotId: string): {
    status: 'pending_confirmation' | 'conflict' | 'invalid';
    code: string;
    message: string;
    appointment_id?: string;
    shipment_id?: string;
    slot_id?: string;
    slot_start_ts?: string;
    slot_end_ts?: string;
    dock_code?: string;
    replaced_appointment_id?: string | null;
  } {
    const shipment = this.getShipment(shipmentId);
    if (!shipment) {
      return {
        status: 'invalid',
        code: 'SHIPMENT_NOT_FOUND',
        message: `Shipment ${shipmentId} not found.`,
      };
    }

    const slot = this.appointmentSlots.find(sl => sl.slot_id === slotId);
    if (!slot) {
      return {
        status: 'invalid',
        code: 'SLOT_NOT_FOUND',
        message: `Slot ${slotId} not found.`,
      };
    }

    const dock = this.docks.find(d => d.dock_id === slot.dock_id);
    if (!dock) {
      return {
        status: 'invalid',
        code: 'DOCK_NOT_FOUND',
        message: `Dock for slot ${slotId} not found.`,
      };
    }

    if (slot.facility_id !== shipment.destination_facility_id) {
      return {
        status: 'invalid',
        code: 'FACILITY_MISMATCH',
        message: "This slot is not at the shipment's destination facility.",
      };
    }

    if (slot.slot_status !== 'OPEN') {
      return {
        status: 'invalid',
        code: `SLOT_NOT_OPEN:${slot.slot_status}`,
        message: `This slot is no longer available (${slot.slot_status}). Please choose another.`,
      };
    }

    // Check dock type
    if (shipment.required_dock_type !== 'ANY' && dock.dock_type !== shipment.required_dock_type) {
      return {
        status: 'invalid',
        code: 'DOCK_TYPE_MISMATCH',
        message: `Shipment requires ${shipment.required_dock_type} dock, slot is ${dock.dock_type}.`,
      };
    }

    // Check reefer requirement
    if (shipment.temperature_control_required === 1 && !dock.supports_refrigerated) {
      return {
        status: 'invalid',
        code: 'REEFER_REQUIRED_BUT_NOT_SUPPORTED',
        message: 'Shipment requires temperature control; this dock does not support it.',
      };
    }

    // Check weight limit
    if (dock.max_vehicle_weight_kg && shipment.load_weight_kg > dock.max_vehicle_weight_kg) {
      return {
        status: 'invalid',
        code: 'SLOT_WEIGHT_EXCEEDED',
        message: "This dock's weight limit is below the shipment's load weight.",
      };
    }

    // Check duration vs unload time
    const start = new Date(slot.slot_start_ts).getTime();
    const end = new Date(slot.slot_end_ts).getTime();
    const durationMin = Math.round((end - start) / (1000 * 60));
    if (durationMin < shipment.expected_unload_min) {
      return {
        status: 'invalid',
        code: 'INSUFFICIENT_SLOT_DURATION',
        message: 'This slot is too short for the expected unload time.',
      };
    }

    // Check for concurrency / conflict: Is slot already taken by another active appointment?
    const slotTaken = this.appointments.some(
      a => a.slot_id === slotId &&
        a.is_current === 1 &&
        ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(a.appointment_status)
    );
    if (slotTaken) {
      return {
        status: 'conflict',
        code: 'SLOT_OR_SHIPMENT_ALREADY_ACTIVE',
        message: 'This slot was just taken, or this shipment already has an active booking. Please pick another option.',
      };
    }

    const now = new Date().toISOString();

    // Cancel prior active appointment for this shipment
    const priorAppt = this.appointments.find(
      a => a.shipment_id === shipmentId &&
        a.is_current === 1 &&
        ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(a.appointment_status)
    );

    let replacedAppointmentId: string | null = null;
    if (priorAppt) {
      replacedAppointmentId = priorAppt.appointment_id;
      priorAppt.appointment_status = 'CANCELLED';
      priorAppt.is_current = 0;
      priorAppt.cancelled_at = now;
      priorAppt.cancellation_reason = 'Replaced by new driver slot selection';
      priorAppt.updated_at = now;
    }

    const newApptId = `APT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newAppointment: Appointment = {
      appointment_id: newApptId,
      shipment_id: shipmentId,
      slot_id: slotId,
      appointment_status: 'PENDING_CONFIRMATION',
      booking_source: 'DRIVER_CHAT',
      is_current: 1,
      booked_at: now,
      confirmed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      replaced_appointment_id: replacedAppointmentId,
      warehouse_confirmation_ref: null,
      updated_at: now,
    };

    this.appointments.unshift(newAppointment);

    return {
      status: 'pending_confirmation',
      code: 'BOOKED',
      appointment_id: newApptId,
      shipment_id: shipmentId,
      slot_id: slotId,
      slot_start_ts: slot.slot_start_ts,
      slot_end_ts: slot.slot_end_ts,
      dock_code: dock.dock_code,
      replaced_appointment_id: replacedAppointmentId,
      message: 'Your booking is pending warehouse confirmation.',
    };
  }

  // Coordinator Approval for Driver Slot Request
  approvePendingAppointment(
    appointmentId: string,
    coordinatorId: string,
    warehouseConfirmationRef: string,
    notes?: string
  ): {
    status: 'confirmed' | 'conflict';
    code: string;
    message: string;
    appointment?: Appointment;
    coordinator?: Coordinator;
  } {
    const appt = this.appointments.find(
      a => a.appointment_id === appointmentId && a.is_current === 1 && a.appointment_status === 'PENDING_CONFIRMATION'
    );

    if (!appt) {
      return {
        status: 'conflict',
        code: 'NOT_PENDING_CONFIRMATION',
        message: `Appointment ${appointmentId} is not awaiting approval (may already be confirmed or cancelled).`,
      };
    }

    const coordinator = this.getCoordinator(coordinatorId) || this.coordinators[0];
    const now = new Date().toISOString();
    appt.appointment_status = 'CONFIRMED';
    appt.confirmed_at = now;
    appt.warehouse_confirmation_ref = warehouseConfirmationRef;
    appt.approved_by_coordinator_id = coordinator?.coordinator_id || coordinatorId;
    appt.approved_by_name = coordinator?.name || 'Facility Coordinator';
    appt.coordinator_notes = notes || null;
    appt.updated_at = now;

    // Resolve any linked open driver exception
    const shipment = this.getShipment(appt.shipment_id);
    const facility = shipment ? this.getFacility(shipment.destination_facility_id) : undefined;
    const slot = this.appointmentSlots.find(s => s.slot_id === appt.slot_id);
    const dock = slot ? this.docks.find(d => d.dock_id === slot.dock_id) : undefined;

    const exc = this.driverExceptions.find(
      e => e.shipment_id === appt.shipment_id && ['OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED', 'WAITING_CONFIRMATION'].includes(e.exception_status)
    );
    if (exc) {
      exc.exception_status = 'RESOLVED';
    }

    // Append official confirmation notification message into driver's chat thread
    if (shipment) {
      const thread = this.createOrGetChatThread(shipment.driver_id, shipment.shipment_id, 'ASK_SLOT_OPTIONS');
      const startStr = slot?.slot_start_ts?.split('T')[1]?.substring(0, 5) || 'scheduled time';
      const endStr = slot?.slot_end_ts?.split('T')[1]?.substring(0, 5) || '';
      const dockCode = dock?.dock_code ? `Dock ${dock.dock_code}` : 'Assigned Dock';
      const coordName = coordinator ? `${coordinator.name} (${coordinator.role_title})` : 'Facility Coordinator';
      const facilityName = facility ? facility.facility_name : 'Facility Warehouse';

      const notificationText = `✅ **Slot Approved by Facility Coordinator**\n\nCoordinator **${coordName}** at **${facilityName}** has officially **APPROVED** your slot request for **${startStr} - ${endStr}** at **${dockCode}**.\n\n• **Warehouse Sign-off Ref**: \`${warehouseConfirmationRef}\`\n• **Status**: **CONFIRMED**${notes ? `\n• **Instructions**: ${notes}` : '\n• **Instructions**: Please proceed to the main gate for security check-in upon arrival.'}`;

      this.chatMessages.push({
        chat_message_id: `MSG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        thread_id: thread.thread_id,
        sender_type: 'OPERATIONS',
        sender_reference: coordinator ? coordinator.name : 'Operations Coordinator',
        message_text: notificationText,
        message_ts: now,
        external_message_id: null,
        is_duplicate: 0,
        parsed_intent: 'SLOT_APPROVED',
        extracted_eta_ts: null,
        requires_human_review: 0,
      });
    }

    return {
      status: 'confirmed',
      code: 'APPROVED',
      message: `Appointment approved by ${coordinator?.name || 'Coordinator'}, confirmation ref: ${warehouseConfirmationRef}.`,
      appointment: appt,
      coordinator,
    };
  }

  // Coordinator Rejection for Driver Slot Request
  rejectPendingAppointment(
    appointmentId: string,
    coordinatorId: string,
    rejectionReason: string
  ): {
    status: 'rejected' | 'conflict';
    code: string;
    message: string;
    appointment?: Appointment;
    coordinator?: Coordinator;
  } {
    const appt = this.appointments.find(
      a => a.appointment_id === appointmentId && a.is_current === 1 && a.appointment_status === 'PENDING_CONFIRMATION'
    );

    if (!appt) {
      return {
        status: 'conflict',
        code: 'NOT_PENDING_CONFIRMATION',
        message: `Appointment ${appointmentId} is not awaiting confirmation.`,
      };
    }

    const coordinator = this.getCoordinator(coordinatorId) || this.coordinators[0];
    const now = new Date().toISOString();
    appt.appointment_status = 'REJECTED';
    appt.is_current = 0;
    appt.cancelled_at = now;
    appt.rejection_reason = rejectionReason;
    appt.rejected_by_coordinator_id = coordinator?.coordinator_id || coordinatorId;
    appt.rejected_by_name = coordinator?.name || 'Facility Coordinator';
    appt.updated_at = now;

    // Slot is now freed
    const slot = this.appointmentSlots.find(s => s.slot_id === appt.slot_id);
    if (slot && slot.slot_status === 'BLOCKED') {
      slot.slot_status = 'OPEN';
      slot.block_reason = null;
    }

    const shipment = this.getShipment(appt.shipment_id);
    const facility = shipment ? this.getFacility(shipment.destination_facility_id) : undefined;
    const dock = slot ? this.docks.find(d => d.dock_id === slot.dock_id) : undefined;

    // Update exception status
    const exc = this.driverExceptions.find(
      e => e.shipment_id === appt.shipment_id && ['OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED', 'WAITING_CONFIRMATION'].includes(e.exception_status)
    );
    if (exc) {
      exc.exception_status = 'ESCALATED';
      exc.description += ` (Slot change rejected by coordinator: ${rejectionReason})`;
    }

    // Append rejection notification message into driver's chat thread
    if (shipment) {
      const thread = this.createOrGetChatThread(shipment.driver_id, shipment.shipment_id, 'ASK_SLOT_OPTIONS');
      const startStr = slot?.slot_start_ts?.split('T')[1]?.substring(0, 5) || 'requested slot';
      const dockCode = dock?.dock_code ? `Dock ${dock.dock_code}` : 'Dock';
      const coordName = coordinator ? `${coordinator.name} (${coordinator.role_title})` : 'Facility Coordinator';
      const facilityName = facility ? facility.facility_name : 'Facility Warehouse';

      const notificationText = `❌ **Slot Request Declined by Coordinator**\n\nCoordinator **${coordName}** at **${facilityName}** was unable to approve the requested slot for **${startStr}** at **${dockCode}**.\n\n• **Reason**: "${rejectionReason}"\n• **Action Required**: Please ask for other available slots in this chat or propose a new ETA.`;

      this.chatMessages.push({
        chat_message_id: `MSG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        thread_id: thread.thread_id,
        sender_type: 'OPERATIONS',
        sender_reference: coordinator ? coordinator.name : 'Operations Coordinator',
        message_text: notificationText,
        message_ts: now,
        external_message_id: null,
        is_duplicate: 0,
        parsed_intent: 'SLOT_REJECTED',
        extracted_eta_ts: null,
        requires_human_review: 0,
      });
    }

    return {
      status: 'rejected',
      code: 'REJECTED',
      message: `Appointment rejected by ${coordinator?.name || 'Coordinator'}. Reason: ${rejectionReason}`,
      appointment: appt,
      coordinator,
    };
  }

  // Warehouse Manual Confirmation fallback
  confirmPendingAppointment(appointmentId: string, warehouseConfirmationRef: string): {
    status: 'confirmed' | 'conflict';
    code: string;
    message: string;
    appointment_id?: string;
    warehouse_confirmation_ref?: string;
    confirmed_at?: string;
  } {
    const defaultCoord = this.coordinators[0]?.coordinator_id || 'COORD001';
    const res = this.approvePendingAppointment(appointmentId, defaultCoord, warehouseConfirmationRef);
    if (res.status === 'confirmed') {
      return {
        status: 'confirmed',
        code: 'CONFIRMED',
        appointment_id: appointmentId,
        warehouse_confirmation_ref: warehouseConfirmationRef,
        confirmed_at: res.appointment?.confirmed_at || new Date().toISOString(),
        message: res.message,
      };
    }
    return {
      status: 'conflict',
      code: res.code,
      message: res.message,
    };
  }

  // Coordinator Overview Data for a Facility
  getCoordinatorOverview(facilityId: string) {
    const facility = this.getFacility(facilityId);
    if (!facility) return null;

    const coordinators = this.getCoordinators(facilityId);

    const openExceptionStatuses = ['OPEN', 'NEEDS_INFORMATION', 'SLOT_OPTIONS_SHARED', 'WAITING_CONFIRMATION', 'ESCALATED'];
    const exceptions = this.driverExceptions
      .filter(e => openExceptionStatuses.includes(e.exception_status))
      .map(e => {
        const shipment = e.shipment_id ? this.getShipment(e.shipment_id) : undefined;
        const driver = this.getDriver(e.driver_id);
        const carrier = driver ? this.getCarrier(driver.carrier_id) : undefined;
        const vehicle = shipment ? this.getVehicle(shipment.vehicle_id) : undefined;
        return {
          ...e,
          order_reference: shipment?.order_reference,
          driver_name: driver?.driver_name,
          driver_phone: driver?.phone,
          carrier_name: carrier?.carrier_name,
          vehicle_reg: vehicle?.registration_number,
          priority_code: shipment?.priority_code,
        };
      })
      .filter(e => {
        if (!e.shipment_id) return true;
        const shp = this.getShipment(e.shipment_id);
        return shp ? shp.destination_facility_id === facilityId : true;
      })
      .sort((a, b) => b.reported_at.localeCompare(a.reported_at));

    // Current facility queue (waiting early, waiting late, waiting dock unavailable, called to dock)
    const queue = this.facilityCheckins
      .filter(c => c.facility_id === facilityId && ['WAITING_EARLY', 'WAITING_LATE', 'WAITING_DOCK_UNAVAILABLE', 'CALLED_TO_DOCK'].includes(c.queue_state || ''))
      .map(c => {
        const shipment = this.getShipment(c.shipment_id);
        const driver = shipment ? this.getDriver(shipment.driver_id) : undefined;
        const vehicle = shipment ? this.getVehicle(shipment.vehicle_id) : undefined;
        const latestEta = shipment ? this.getLatestETA(shipment.shipment_id) : undefined;
        return {
          ...c,
          order_reference: shipment?.order_reference,
          driver_name: driver?.driver_name,
          registration_number: vehicle?.registration_number,
          priority_code: shipment?.priority_code,
          effective_eta_ts: latestEta?.effective_eta_ts,
          expected_unload_min: shipment?.expected_unload_min,
          required_dock_type: shipment?.required_dock_type,
        };
      })
      .sort((a, b) => (a.queue_position || 99) - (b.queue_position || 99));

    // Appointments for facility (current)
    const facilitySlotIds = new Set(this.appointmentSlots.filter(s => s.facility_id === facilityId).map(s => s.slot_id));
    const appointments = this.appointments
      .filter(a => a.is_current === 1 && facilitySlotIds.has(a.slot_id))
      .map(a => {
        const slot = this.appointmentSlots.find(s => s.slot_id === a.slot_id);
        const dock = slot ? this.docks.find(d => d.dock_id === slot.dock_id) : undefined;
        const shipment = this.getShipment(a.shipment_id);
        const driver = shipment ? this.getDriver(shipment.driver_id) : undefined;
        const carrier = driver ? this.getCarrier(driver.carrier_id) : undefined;
        const vehicle = shipment ? this.getVehicle(shipment.vehicle_id) : undefined;
        const latestEta = shipment ? this.getLatestETA(shipment.shipment_id) : undefined;

        return {
          ...a,
          slot_start_ts: slot?.slot_start_ts,
          slot_end_ts: slot?.slot_end_ts,
          dock_code: dock?.dock_code,
          dock_type: dock?.dock_type,
          order_reference: shipment?.order_reference,
          driver_name: driver?.driver_name,
          driver_phone: driver?.phone,
          carrier_name: carrier?.carrier_name,
          vehicle_reg: vehicle?.registration_number,
          product_category: shipment?.product_category,
          load_weight_kg: shipment?.load_weight_kg,
          effective_eta_ts: latestEta?.effective_eta_ts,
          priority_code: shipment?.priority_code,
          is_warehouse_confirmed: a.appointment_status === 'CONFIRMED' && !!a.warehouse_confirmation_ref,
        };
      })
      .sort((a, b) => (a.slot_start_ts || '').localeCompare(b.slot_start_ts || ''));

    const dockEvents = this.getDockStatusEvents(facilityId);

    return {
      facility,
      coordinators,
      exceptions,
      queue,
      appointments,
      dockEvents,
    };
  }
}

export const db = new DataStore();
