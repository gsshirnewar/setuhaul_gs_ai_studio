import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_DRIVERS } from './seedData';
import { Driver } from '../types';

// Default Supabase project credentials provided by user
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ivjuhthqecntjywfyrag.supabase.co';
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2anVodGhxZWNudGp5d2Z5cmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzAwNzAsImV4cCI6MjEwMjMwNjA3MH0.cMtR-mPONHTuJqGRMymSDerqryfltdGqtVicRC7fwYQ';

export const supabaseServer: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

let serverRealtimeChannel: any = null;

export function getServerRealtimeChannel() {
  if (!serverRealtimeChannel) {
    serverRealtimeChannel = supabaseServer.channel('setuhaul-realtime');
    serverRealtimeChannel.subscribe((status: string) => {
      console.log(`[Supabase Realtime] Backend channel status: ${status}`);
    });
  }
  return serverRealtimeChannel;
}

export async function broadcastServerEvent(event: string, payload: Record<string, any>) {
  try {
    const channel = getServerRealtimeChannel();
    await channel.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('[Supabase Realtime] Server broadcast error:', err);
  }
}

export interface SupabaseDockSlot {
  id: string;
  dock_door_id: string;
  facility_id: string;
  start_time: string;
  end_time: string;
  status: 'AVAILABLE' | 'HOLD_PENDING' | 'CONFIRMED' | 'BLOCKED';
  current_appointment_id?: string | null;
  hold_expires_at?: string | null;
  created_at: string;
  dock_doors?: {
    door_number: string;
    dock_type: string;
    status: string;
  };
}

export interface SupabaseAppointment {
  id: string;
  slot_id: string;
  shipment_id: string;
  driver_id: string;
  facility_id: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  coordinator_notes?: string | null;
  is_contested: boolean;
  contention_priority_score?: number;
  created_at: string;
  updated_at: string;
}

export interface ContentionDetail {
  slot_id: string;
  door_number: string;
  dock_type: string;
  start_time: string;
  end_time: string;
  request_count?: number;
  is_contested?: boolean;
  competing_appointments: Array<{
    appointment_id: string;
    driver_id: string;
    driver_name: string;
    vehicle_registration: string;
    shipment_id: string;
    cargo_type: string;
    urgency_level: string;
    declared_eta: string;
    eta_confidence_score: number;
    score: number;
    requested_at: string;
  }>;
  recommendation: {
    recommended_driver_id: string;
    recommended_driver_name: string;
    reason: string;
    alternative_slot_id: string | null;
    alternative_slot_door: string | null;
    alternative_slot_time: string | null;
  };
}

export interface ContestedSlotResult extends ContentionDetail {
  request_count: number;
  is_contested: boolean;
}

export interface ContentionQueryResponse {
  facility_id: string;
  contested_slots: ContestedSlotResult[];
  flagged_slot_ids: string[];
  total_contested_slots: number;
  total_contested_requests: number;
  slot_contention_map: Record<string, {
    slot_id: string;
    is_contested: boolean;
    request_count: number;
    competing_driver_names: string[];
    recommended_driver_name?: string;
  }>;
}

/**
 * Fetch all dock slots from Supabase along with bay metadata
 */
export async function getSupabaseSlots(facilityId: string = 'FAC_JAI_01'): Promise<SupabaseDockSlot[]> {
  try {
    const { data: slots, error: slotsError } = await supabaseServer
      .from('dock_slots')
      .select('*, dock_doors(*)')
      .eq('facility_id', facilityId)
      .order('start_time', { ascending: true });

    if (slotsError) {
      console.error('[Supabase] Error fetching slots:', slotsError);
      return [];
    }

    return (slots as SupabaseDockSlot[]) || [];
  } catch (err) {
    console.error('[Supabase] Unexpected error fetching slots:', err);
    return [];
  }
}

/**
 * Concurrency-safe Slot Booking with Lock & Contention Detection
 */
export async function bookSlotWithConcurrency(params: {
  driverId: string;
  driverName?: string;
  vehicleRegistration?: string;
  shipmentId: string;
  slotId: string;
  facilityId?: string;
  cargoType?: string;
  urgencyLevel?: string;
  declaredEta?: string;
  etaConfidenceScore?: number;
}): Promise<{
  status: 'success' | 'conflict' | 'error';
  appointment_id?: string;
  is_contested?: boolean;
  message: string;
  code?: string;
  slot?: any;
  alternative_slots?: any[];
}> {
  const {
    driverId,
    driverName = 'Driver',
    vehicleRegistration = 'RJ14GT4101',
    shipmentId,
    slotId,
    facilityId = 'FAC_JAI_01',
    cargoType = 'GENERAL',
    urgencyLevel = 'MEDIUM',
    declaredEta = new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    etaConfidenceScore = 90,
  } = params;

  try {
    // 1. Check current slot state in Supabase
    const { data: slot, error: slotErr } = await supabaseServer
      .from('dock_slots')
      .select('*, dock_doors(*)')
      .eq('id', slotId)
      .single();

    if (slotErr || !slot) {
      return { status: 'error', message: `Slot ${slotId} not found in Supabase.` };
    }

    // Check if slot is already officially confirmed to someone else
    if (slot.status === 'CONFIRMED') {
      const { data: altSlots } = await supabaseServer
        .from('dock_slots')
        .select('*, dock_doors(*)')
        .eq('facility_id', facilityId)
        .eq('status', 'AVAILABLE')
        .neq('id', slotId)
        .order('start_time', { ascending: true })
        .limit(3);

      return {
        status: 'conflict',
        code: 'SLOT_ALREADY_CONFIRMED',
        message: `Slot ${slotId} is already confirmed for another vehicle. Here are available alternative slots for your arrival.`,
        slot,
        alternative_slots: altSlots || [],
      };
    }

    // 2. Ensure shipment record exists in Supabase
    await supabaseServer.from('shipments').upsert({
      id: shipmentId,
      driver_id: driverId,
      driver_name: driverName,
      vehicle_registration: vehicleRegistration,
      origin_city: 'Delhi',
      destination_facility_id: facilityId,
      cargo_type: cargoType,
      urgency_level: urgencyLevel,
      declared_eta: declaredEta,
      eta_confidence_score: etaConfidenceScore,
      status: 'IN_TRANSIT',
    });

    // Generate unique Appointment ID
    const appointmentId = `APT-${Date.now().toString().slice(-6)}-${driverId.slice(-4)}`;

    // 3. Calculate Priority Score for Contention
    // Factors: Urgency (Critical=40, High=30, Med=20, Low=10), Perishable cargo (+30), ETA confidence (+0 to 30)
    let priorityScore = 20;
    if (urgencyLevel === 'CRITICAL') priorityScore += 40;
    else if (urgencyLevel === 'HIGH') priorityScore += 30;
    else if (urgencyLevel === 'MEDIUM') priorityScore += 20;
    else priorityScore += 10;

    if (cargoType === 'PERISHABLE' || cargoType === 'COLD_CHAIN' || cargoType === 'PHARMA') {
      priorityScore += 30;
    }
    priorityScore += Math.round((etaConfidenceScore / 100) * 30);

    const now = new Date().toISOString();
    const holdExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 4. ATOMIC CHECK-AND-SET TRANSACTION via PostgreSQL conditional update
    // Only succeeds if status is AVAILABLE or prior hold has expired (hold_expires_at < now)
    const { data: acquiredSlot, error: acquireErr } = await supabaseServer
      .from('dock_slots')
      .update({
        status: 'HOLD_PENDING',
        current_appointment_id: appointmentId,
        hold_expires_at: holdExpires,
      })
      .eq('id', slotId)
      .or(`status.eq.AVAILABLE,hold_expires_at.lt.${now}`)
      .select('*, dock_doors(*)');

    if (acquireErr) {
      console.error('[Supabase] Error acquiring slot lock:', acquireErr);
      return { status: 'error', message: 'Failed to acquire slot lock: ' + acquireErr.message };
    }

    const lockAcquired = acquiredSlot && acquiredSlot.length > 0;

    if (lockAcquired) {
      // Current transaction WON the exclusive HOLD_PENDING lock
      const { error: insertErr } = await supabaseServer.from('appointments').insert({
        id: appointmentId,
        slot_id: slotId,
        shipment_id: shipmentId,
        driver_id: driverId,
        facility_id: facilityId,
        status: 'REQUESTED',
        is_contested: false,
        contention_priority_score: priorityScore,
        coordinator_notes: null,
      });

      if (insertErr) {
        console.error('[Supabase] Insert appointment failed:', insertErr);
        // Rollback lock if appointment insertion fails
        await supabaseServer.from('dock_slots').update({ status: 'AVAILABLE', current_appointment_id: null, hold_expires_at: null }).eq('id', slotId);
        return { status: 'error', message: 'Failed to record appointment: ' + insertErr.message };
      }

      // Broadcast live slot update & appointment over Supabase Realtime
      broadcastServerEvent('SLOT_UPDATED', {
        slotId,
        status: 'HOLD_PENDING',
        appointmentId,
        driverId,
        driverName,
        facilityId,
      });
      broadcastServerEvent('APPOINTMENT_UPDATED', {
        appointmentId,
        status: 'REQUESTED',
        driverId,
        slotId,
        facilityId,
        isContested: false,
      });

      return {
        status: 'success',
        appointment_id: appointmentId,
        is_contested: false,
        message: `Slot ${slotId} is held for your arrival (10-minute hold). Awaiting coordinator confirmation.`,
        slot: acquiredSlot[0],
      };
    } else {
      // Slot could not be locked: Either CONFIRMED or in active HOLD_PENDING by another driver
      const { data: currentSlot } = await supabaseServer
        .from('dock_slots')
        .select('*, dock_doors(*)')
        .eq('id', slotId)
        .single();

      if (!currentSlot || currentSlot.status === 'CONFIRMED') {
        // Fetch fresh alternative available slots at this facility
        const { data: altSlots } = await supabaseServer
          .from('dock_slots')
          .select('*, dock_doors(*)')
          .eq('facility_id', facilityId)
          .eq('status', 'AVAILABLE')
          .neq('id', slotId)
          .limit(3);

        return {
          status: 'conflict',
          code: 'SLOT_ALREADY_CONFIRMED',
          message: `Slot ${slotId} is already confirmed for another vehicle. Please select an available alternative slot.`,
          slot: currentSlot,
          alternative_slots: altSlots || [],
        };
      }

      // Slot is currently held by another driver (HOLD_PENDING and not expired)
      // CONCURRENCY CONTENTION: Record competing request and alert coordinator
      const { error: insertCompErr } = await supabaseServer.from('appointments').insert({
        id: appointmentId,
        slot_id: slotId,
        shipment_id: shipmentId,
        driver_id: driverId,
        facility_id: facilityId,
        status: 'REQUESTED',
        is_contested: true,
        contention_priority_score: priorityScore,
        coordinator_notes: `Contention detected: Driver ${driverName} concurrently requested slot ${slotId} currently held by ${currentSlot.current_appointment_id}`,
      });

      if (insertCompErr) {
        console.error('[Supabase] Insert competing appointment failed:', insertCompErr);
        return { status: 'error', message: 'Failed to register competing appointment: ' + insertCompErr.message };
      }

      // Flag existing appointments on this slot as contested
      await supabaseServer
        .from('appointments')
        .update({ is_contested: true })
        .eq('slot_id', slotId)
        .eq('status', 'REQUESTED');

      // Broadcast live contention alert & competing appointment over Supabase Realtime
      broadcastServerEvent('CONTENTION_ALERT', {
        slotId,
        facilityId,
        competingDriverId: driverId,
        competingDriverName: driverName,
        priorityScore,
        appointmentId,
        message: `Concurrent contention detected on slot ${slotId} with driver ${driverName}`,
      });
      broadcastServerEvent('APPOINTMENT_UPDATED', {
        appointmentId,
        status: 'REQUESTED',
        driverId,
        slotId,
        facilityId,
        isContested: true,
      });

      return {
        status: 'success',
        appointment_id: appointmentId,
        is_contested: true,
        message: `Slot ${slotId} is currently held under review by another vehicle. Your request is registered as a priority contender and submitted for coordinator decision-support.`,
        slot: currentSlot,
      };
    }
  } catch (err: any) {
    console.error('[Supabase] Concurrency booking error:', err);
    return { status: 'error', message: err.message || 'Error executing Supabase booking' };
  }
}

/**
 * Contention Logic Query:
 * Flags slots where requests > 1 across active/pending appointments.
 * Groups all active requested appointments by slot_id, flags slots where requests > 1,
 * auto-updates is_contested = true in Supabase, and calculates priority ranking & recommendations.
 */
export async function queryContestedSlots(facilityId: string = 'FAC_JAI_01'): Promise<ContentionQueryResponse> {
  try {
    // 1. Query all active appointment requests for this facility (both 'REQUESTED' and 'HOLD_PENDING')
    const { data: allActiveAppts, error: apptErr } = await supabaseServer
      .from('appointments')
      .select('*, shipments(*)')
      .eq('facility_id', facilityId)
      .in('status', ['REQUESTED', 'HOLD_PENDING']);

    if (apptErr) {
      console.error('[Supabase] Error querying active appointments for contention:', apptErr);
    }

    // 2. Query any explicitly flagged contested appointments
    const { data: flaggedAppts } = await supabaseServer
      .from('appointments')
      .select('*, shipments(*)')
      .eq('facility_id', facilityId)
      .eq('is_contested', true)
      .neq('status', 'CANCELLED');

    // Deduplicate appointments by id
    const apptMap = new Map<string, any>();
    for (const a of (allActiveAppts || [])) {
      apptMap.set(a.id, a);
    }
    for (const a of (flaggedAppts || [])) {
      apptMap.set(a.id, a);
    }

    // 3. Group appointments by slot_id
    const slotGroups: Record<string, any[]> = {};
    for (const appt of apptMap.values()) {
      if (!appt.slot_id) continue;
      if (!slotGroups[appt.slot_id]) {
        slotGroups[appt.slot_id] = [];
      }
      slotGroups[appt.slot_id].push(appt);
    }

    // 4. Fetch available alternative slots for recommendations
    const { data: allSlots } = await supabaseServer
      .from('dock_slots')
      .select('*, dock_doors(*)')
      .eq('facility_id', facilityId)
      .eq('status', 'AVAILABLE');

    const contested_slots: ContestedSlotResult[] = [];
    const flagged_slot_ids: string[] = [];
    const slot_contention_map: Record<string, {
      slot_id: string;
      is_contested: boolean;
      request_count: number;
      competing_driver_names: string[];
      recommended_driver_name?: string;
    }> = {};

    let totalContestedRequests = 0;

    // 5. CONTENTION LOGIC: Flag slots where requests > 1
    for (const [slotId, appts] of Object.entries(slotGroups)) {
      const requestCount = appts.length;

      // SPEC RULE: Flag slots where requests > 1
      if (requestCount > 1) {
        flagged_slot_ids.push(slotId);
        totalContestedRequests += requestCount;

        // Auto-heal database: Ensure all competing appointments are tagged is_contested = true
        const unflagged = appts.filter(a => !a.is_contested);
        if (unflagged.length > 0) {
          void Promise.resolve(
            supabaseServer
              .from('appointments')
              .update({ is_contested: true })
              .in('id', unflagged.map(a => a.id))
          ).catch(e => console.warn('[Supabase] Non-blocking warning updating is_contested:', e));
        }

        // Fetch slot & door metadata
        const { data: slotData } = await supabaseServer
          .from('dock_slots')
          .select('*, dock_doors(*)')
          .eq('id', slotId)
          .single();

        const competingDrivers = appts.map(a => {
          const shp = a.shipments || {};
          return {
            appointment_id: a.id,
            driver_id: a.driver_id,
            driver_name: shp.driver_name || `Driver ${a.driver_id}`,
            vehicle_registration: shp.vehicle_registration || 'RJ14-UNKNOWN',
            shipment_id: a.shipment_id,
            cargo_type: shp.cargo_type || 'GENERAL',
            urgency_level: shp.urgency_level || 'MEDIUM',
            declared_eta: shp.declared_eta || a.created_at,
            eta_confidence_score: shp.eta_confidence_score || 85,
            score: a.contention_priority_score || 50,
            requested_at: a.created_at,
          };
        });

        // Sort by score descending (highest priority contender first)
        competingDrivers.sort((a, b) => b.score - a.score);

        const winner = competingDrivers[0];
        const runnerUp = competingDrivers[1] || competingDrivers[0];

        // Formulate smart recommendation justification
        let reason = '';
        if (winner.cargo_type === 'PERISHABLE' || winner.cargo_type === 'COLD_CHAIN') {
          reason = `${winner.driver_name} carries temperature-sensitive ${winner.cargo_type} cargo with ${winner.eta_confidence_score}% ETA confidence score. Assigning ${slotData?.dock_doors?.door_number || slotId} prevents cold-chain spoiling.`;
        } else if (winner.score > runnerUp.score + 15) {
          reason = `${winner.driver_name} has significantly higher urgency (${winner.urgency_level}) and proven ETA punctuality (${winner.eta_confidence_score}%), minimizing bay turnaround delay.`;
        } else {
          reason = `${winner.driver_name} requested first with ${winner.eta_confidence_score}% ETA confidence. Propose alternative bay to ${runnerUp.driver_name}.`;
        }

        // Find an alternative available slot for runner-up
        const altSlot = (allSlots || []).find(s => s.id !== slotId);

        const detail: ContestedSlotResult = {
          slot_id: slotId,
          request_count: requestCount,
          is_contested: true,
          door_number: slotData?.dock_doors?.door_number || 'Dock Bay',
          dock_type: slotData?.dock_doors?.dock_type || 'DRY_STANDARD',
          start_time: slotData?.start_time || '',
          end_time: slotData?.end_time || '',
          competing_appointments: competingDrivers,
          recommendation: {
            recommended_driver_id: winner.driver_id,
            recommended_driver_name: winner.driver_name,
            reason,
            alternative_slot_id: altSlot ? altSlot.id : null,
            alternative_slot_door: altSlot?.dock_doors?.door_number || null,
            alternative_slot_time: altSlot ? `${new Date(altSlot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null,
          },
        };

        contested_slots.push(detail);

        slot_contention_map[slotId] = {
          slot_id: slotId,
          is_contested: true,
          request_count: requestCount,
          competing_driver_names: competingDrivers.map(d => d.driver_name),
          recommended_driver_name: winner.driver_name,
        };
      }
    }

    return {
      facility_id: facilityId,
      contested_slots,
      flagged_slot_ids,
      total_contested_slots: contested_slots.length,
      total_contested_requests: totalContestedRequests,
      slot_contention_map,
    };
  } catch (err) {
    console.error('[Supabase] Error calculating contention query (requests > 1):', err);
    return {
      facility_id: facilityId,
      contested_slots: [],
      flagged_slot_ids: [],
      total_contested_slots: 0,
      total_contested_requests: 0,
      slot_contention_map: {},
    };
  }
}

/**
 * Get all contested dock slots with Smart Recommendations for the Coordinator
 */
export async function getContentionAlerts(facilityId: string = 'FAC_JAI_01'): Promise<ContentionDetail[]> {
  const result = await queryContestedSlots(facilityId);
  return result.contested_slots;
}

/**
 * Coordinator Resolves Contention:
 * Confirms the recommended driver, and re-routes or re-assigns the other driver to an alternative slot
 */
export async function resolveContention(params: {
  slotId: string;
  approvedAppointmentId: string;
  coordinatorId: string;
  confirmationRef: string;
  alternativeSlotId?: string | null;
  rejectedAppointmentIds?: string[];
}): Promise<{ status: 'success' | 'error'; message: string }> {
  const { slotId, approvedAppointmentId, coordinatorId, confirmationRef, alternativeSlotId, rejectedAppointmentIds = [] } = params;

  try {
    // 1. Approve winning appointment
    await supabaseServer
      .from('appointments')
      .update({
        status: 'APPROVED',
        coordinator_notes: `Confirmed by coordinator ${coordinatorId}. Ref: ${confirmationRef}`,
        is_contested: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvedAppointmentId);

    // 2. Mark dock slot as CONFIRMED
    await supabaseServer
      .from('dock_slots')
      .update({
        status: 'CONFIRMED',
        current_appointment_id: approvedAppointmentId,
        hold_expires_at: null,
      })
      .eq('id', slotId);

    // 3. Handle runner-up drivers: re-assign to alternative slot if available, or reject
    if (alternativeSlotId) {
      for (const rejId of rejectedAppointmentIds) {
        await supabaseServer
          .from('appointments')
          .update({
            slot_id: alternativeSlotId,
            status: 'REQUESTED',
            is_contested: false,
            coordinator_notes: `Automated re-assignment from contested slot ${slotId} to alternative slot ${alternativeSlotId}.`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rejId);

        // Put hold on the alternative slot
        await supabaseServer
          .from('dock_slots')
          .update({
            status: 'HOLD_PENDING',
            current_appointment_id: rejId,
            hold_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          })
          .eq('id', alternativeSlotId);
      }
    } else {
      // Mark other competing appointments as REJECTED with note
      for (const rejId of rejectedAppointmentIds) {
        await supabaseServer
          .from('appointments')
          .update({
            status: 'REJECTED',
            coordinator_notes: `Slot ${slotId} awarded to higher priority cargo/punctual driver. Please request an alternative window.`,
            is_contested: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rejId);
      }
    }

    // Broadcast real-time events over Supabase Realtime WebSocket
    broadcastServerEvent('CONTENTION_RESOLVED', {
      slotId,
      approvedAppointmentId,
      alternativeSlotId,
      coordinatorId,
      confirmationRef,
    });
    broadcastServerEvent('SLOT_UPDATED', {
      slotId,
      status: 'CONFIRMED',
      appointmentId: approvedAppointmentId,
    });
    if (alternativeSlotId) {
      broadcastServerEvent('SLOT_UPDATED', {
        slotId: alternativeSlotId,
        status: 'HOLD_PENDING',
      });
    }

    return {
      status: 'success',
      message: `Contention resolved! Appointment ${approvedAppointmentId} confirmed on ${slotId}.${alternativeSlotId ? ` Re-routed competing driver to alternative slot ${alternativeSlotId}.` : ''}`,
    };
  } catch (err: any) {
    console.error('[Supabase] Resolve contention error:', err);
    return { status: 'error', message: err.message || 'Failed to resolve contention' };
  }
}

/**
 * Release expired HOLD_PENDING dock slots back to AVAILABLE
 */
export async function releaseExpiredHolds(): Promise<number> {
  try {
    const now = new Date().toISOString();
    const { data: expiredSlots, error } = await supabaseServer
      .from('dock_slots')
      .update({
        status: 'AVAILABLE',
        current_appointment_id: null,
        hold_expires_at: null,
      })
      .eq('status', 'HOLD_PENDING')
      .lt('hold_expires_at', now)
      .select('id');

    if (error) {
      console.error('[Supabase] Error releasing expired holds:', error);
      return 0;
    }

    if (expiredSlots && expiredSlots.length > 0) {
      broadcastServerEvent('HOLDS_EXPIRED', {
        releasedSlotIds: expiredSlots.map(s => s.id),
      });
    }

    return expiredSlots?.length || 0;
  } catch (err) {
    console.error('[Supabase] Error in releaseExpiredHolds:', err);
    return 0;
  }
}

/**
 * Coordinator approves appointment in Supabase: transitions slot to CONFIRMED
 */
export async function approveSupabaseAppointment(params: {
  appointmentId: string;
  coordinatorId: string;
  warehouseConfirmationRef: string;
  notes?: string;
}): Promise<{ status: 'success' | 'error'; message: string }> {
  try {
    const { appointmentId, coordinatorId, warehouseConfirmationRef, notes } = params;

    // Fetch appointment
    const { data: appt, error: apptErr } = await supabaseServer
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptErr || !appt) {
      return { status: 'error', message: `Appointment ${appointmentId} not found in Supabase.` };
    }

    // Update appointment
    await supabaseServer
      .from('appointments')
      .update({
        status: 'APPROVED',
        coordinator_notes: notes || `Approved by ${coordinatorId}. Ref: ${warehouseConfirmationRef}`,
        is_contested: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    // Update dock slot to CONFIRMED
    if (appt.slot_id) {
      await supabaseServer
        .from('dock_slots')
        .update({
          status: 'CONFIRMED',
          current_appointment_id: appointmentId,
          hold_expires_at: null,
        })
        .eq('id', appt.slot_id);
    }

    broadcastServerEvent('APPOINTMENT_APPROVED', {
      appointmentId,
      slotId: appt.slot_id,
      driverId: appt.driver_id,
      warehouseConfirmationRef,
    });
    broadcastServerEvent('SLOT_UPDATED', {
      slotId: appt.slot_id,
      status: 'CONFIRMED',
      appointmentId,
    });

    return {
      status: 'success',
      message: `Appointment ${appointmentId} approved and confirmed on slot ${appt.slot_id}.`,
    };
  } catch (err: any) {
    console.error('[Supabase] Error approving appointment:', err);
    return { status: 'error', message: err.message || 'Failed to approve appointment in Supabase' };
  }
}

/**
 * Coordinator rejects appointment in Supabase: releases slot back to AVAILABLE
 */
export async function rejectSupabaseAppointment(params: {
  appointmentId: string;
  coordinatorId: string;
  rejectionReason: string;
}): Promise<{ status: 'success' | 'error'; message: string }> {
  try {
    const { appointmentId, coordinatorId, rejectionReason } = params;

    const { data: appt, error: apptErr } = await supabaseServer
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptErr || !appt) {
      return { status: 'error', message: `Appointment ${appointmentId} not found in Supabase.` };
    }

    await supabaseServer
      .from('appointments')
      .update({
        status: 'REJECTED',
        coordinator_notes: `Rejected by ${coordinatorId}: ${rejectionReason}`,
        is_contested: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    // If slot was on hold for this appointment, release it back to AVAILABLE
    if (appt.slot_id) {
      await supabaseServer
        .from('dock_slots')
        .update({
          status: 'AVAILABLE',
          current_appointment_id: null,
          hold_expires_at: null,
        })
        .eq('id', appt.slot_id)
        .eq('current_appointment_id', appointmentId);
    }

    broadcastServerEvent('APPOINTMENT_REJECTED', {
      appointmentId,
      slotId: appt.slot_id,
      driverId: appt.driver_id,
      rejectionReason,
    });
    broadcastServerEvent('SLOT_UPDATED', {
      slotId: appt.slot_id,
      status: 'AVAILABLE',
      appointmentId: null,
    });

    return {
      status: 'success',
      message: `Appointment ${appointmentId} rejected and slot ${appt.slot_id} released.`,
    };
  } catch (err: any) {
    console.error('[Supabase] Error rejecting appointment:', err);
    return { status: 'error', message: err.message || 'Failed to reject appointment in Supabase' };
  }
}

/**
 * SQL statement for creating the drivers table with verification_status in Supabase SQL Editor
 */
export const SUPABASE_DRIVERS_SQL = `-- Supabase Drivers Table with Verification Status
CREATE TABLE IF NOT EXISTS public.drivers (
    driver_id TEXT PRIMARY KEY,
    carrier_id TEXT DEFAULT 'CAR001',
    driver_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    licence_number TEXT,
    home_base_city TEXT,
    driver_status TEXT DEFAULT 'ACTIVE',
    verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('VERIFIED', 'PENDING', 'REJECTED')),
    approval_status TEXT DEFAULT 'PENDING' CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED')),
    vehicle_registration TEXT,
    registered_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by TEXT,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejection_reason TEXT
);

-- Enable Row Level Security (RLS) & allow read/write for application
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public full access to drivers" ON public.drivers
    FOR ALL
    USING (true)
    WITH CHECK (true);
`;

/**
 * Check whether public.drivers table exists and is accessible in Supabase
 */
export async function checkSupabaseDriversTable(): Promise<{
  exists: boolean;
  count: number;
  error?: string;
}> {
  try {
    const { data, error, count } = await supabaseServer
      .from('drivers')
      .select('driver_id', { count: 'exact' })
      .limit(1);

    if (error) {
      // 404 / PGRST205 indicates table does not exist in schema cache
      return { exists: false, count: 0, error: error.message };
    }
    return { exists: true, count: typeof count === 'number' ? count : ((data as any[]) ? (data as any[]).length : 0) };
  } catch (err: any) {
    return { exists: false, count: 0, error: err.message };
  }
}

/**
 * Push existing drivers into Supabase with verification_status = 'VERIFIED'
 */
export async function pushSeedDriversToSupabase(customDrivers?: Driver[]): Promise<{
  success: boolean;
  count: number;
  message: string;
  error?: string;
  missingTable?: boolean;
}> {
  try {
    const driversToPush = customDrivers || INITIAL_DRIVERS;
    
    // Map drivers ensuring verification_status is explicitly set
    const rows = driversToPush.map(d => ({
      driver_id: d.driver_id,
      carrier_id: d.carrier_id || 'CAR001',
      driver_name: d.driver_name,
      email: d.email.toLowerCase().trim(),
      password: d.password || 'Password#Drv01',
      phone: d.phone,
      licence_number: d.licence_number,
      home_base_city: d.home_base_city || 'Jaipur',
      driver_status: d.driver_status || 'ACTIVE',
      // For existing driver database, make all existing data as VERIFIED as instructed
      verification_status: d.verification_status || (d.approval_status === 'PENDING' ? 'PENDING' : 'VERIFIED'),
      approval_status: d.approval_status || 'APPROVED',
      vehicle_registration: d.vehicle_registration || null,
      registered_at: d.registered_at || new Date().toISOString(),
      verified_at: d.verification_status === 'PENDING' ? null : (d.verified_at || new Date().toISOString()),
      verified_by: d.verification_status === 'PENDING' ? null : (d.verified_by || 'SYSTEM_INIT'),
      approved_at: d.approval_status === 'PENDING' ? null : (d.approved_at || new Date().toISOString()),
      approved_by: d.approval_status === 'PENDING' ? null : (d.approved_by || 'SYSTEM_INIT'),
    }));

    const { data, error } = await supabaseServer
      .from('drivers')
      .upsert(rows, { onConflict: 'driver_id' })
      .select();

    if (error) {
      const isMissing = error.message?.includes('schema cache') || error.code === 'PGRST205';
      return {
        success: false,
        count: 0,
        message: isMissing
          ? "Supabase 'drivers' table does not exist yet. Please run the migration script in Supabase SQL editor."
          : `Supabase error: ${error.message}`,
        error: error.message,
        missingTable: isMissing,
      };
    }

    console.log(`[Supabase Drivers] Successfully synced ${rows.length} drivers to Supabase with VERIFIED status.`);
    broadcastServerEvent('DRIVERS_SYNCED', { count: rows.length });

    return {
      success: true,
      count: rows.length,
      message: `Successfully pushed ${rows.length} drivers to Supabase with verification status initialized!`,
    };
  } catch (err: any) {
    console.error('[Supabase Drivers] Error pushing seed drivers:', err);
    return {
      success: false,
      count: 0,
      message: err.message || 'Failed to push drivers to Supabase',
      error: err.message,
    };
  }
}

/**
 * Fetch all drivers from Supabase
 */
export async function fetchSupabaseDrivers(): Promise<{
  drivers: Driver[];
  fromSupabase: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseServer
      .from('drivers')
      .select('*')
      .order('registered_at', { ascending: false });

    if (error || !data) {
      return { drivers: [], fromSupabase: false, error: error?.message };
    }

    return { drivers: data as Driver[], fromSupabase: true };
  } catch (err: any) {
    return { drivers: [], fromSupabase: false, error: err.message };
  }
}

/**
 * Authenticate driver directly from Supabase drivers table (username/email and password)
 */
export async function authenticateSupabaseDriver(
  identifier: string,
  passwordAttempt: string
): Promise<{
  authenticated: boolean;
  driver?: Driver;
  verification_status?: 'VERIFIED' | 'PENDING' | 'REJECTED';
  message: string;
  source: 'supabase' | 'fallback';
}> {
  const cleanId = identifier.trim().toLowerCase();

  try {
    // Check Supabase drivers table first
    const { data: drivers, error } = await supabaseServer
      .from('drivers')
      .select('*')
      .or(`email.ilike.${cleanId},driver_id.ilike.${cleanId},phone.ilike.${cleanId}`)
      .limit(1);

    if (!error && drivers && drivers.length > 0) {
      const driver = drivers[0] as Driver;
      if (driver.password && driver.password !== passwordAttempt) {
        return {
          authenticated: false,
          message: 'Invalid password. Please verify credentials.',
          source: 'supabase',
        };
      }

      return {
        authenticated: true,
        driver,
        verification_status: driver.verification_status || 'VERIFIED',
        message: driver.verification_status === 'PENDING'
          ? 'Driver authenticated (Account pending coordinator verification)'
          : 'Driver authenticated successfully via Supabase',
        source: 'supabase',
      };
    }
  } catch (err) {
    console.warn('[Supabase Auth] Failed query to drivers table, using fallback:', err);
  }

  // Fallback to INITIAL_DRIVERS if Supabase is offline or table hasn't been migrated
  const localDriver = INITIAL_DRIVERS.find(
    d => d.email.toLowerCase() === cleanId || d.driver_id.toLowerCase() === cleanId || d.phone.toLowerCase() === cleanId
  );

  if (localDriver) {
    if (localDriver.password && localDriver.password !== passwordAttempt) {
      return {
        authenticated: false,
        message: 'Invalid password. Please verify credentials.',
        source: 'fallback',
      };
    }

    return {
      authenticated: true,
      driver: localDriver,
      verification_status: localDriver.verification_status || 'VERIFIED',
      message: 'Driver authenticated via local database',
      source: 'fallback',
    };
  }

  return {
    authenticated: false,
    message: 'Driver account not found. Please register or check your username/email.',
    source: 'supabase',
  };
}

/**
 * Register a new driver into Supabase with verification_status = 'PENDING'
 */
export async function registerSupabaseDriver(driverData: {
  driver_id: string;
  driver_name: string;
  email: string;
  password: string;
  phone?: string;
  licence_number?: string;
  vehicle_registration?: string;
  carrier_id?: string;
  home_base_city?: string;
}): Promise<{
  success: boolean;
  driver?: Driver;
  message: string;
  error?: string;
}> {
  const now = new Date().toISOString();
  const newRow = {
    driver_id: driverData.driver_id,
    carrier_id: driverData.carrier_id || 'CAR001',
    driver_name: driverData.driver_name,
    email: driverData.email.toLowerCase().trim(),
    password: driverData.password,
    phone: driverData.phone || '+91-9829000000',
    licence_number: driverData.licence_number || `LIC-${driverData.driver_id}`,
    home_base_city: driverData.home_base_city || 'Jaipur',
    driver_status: 'OFF_DUTY',
    // New driver registers with label of pending verification
    verification_status: 'PENDING',
    approval_status: 'PENDING',
    vehicle_registration: driverData.vehicle_registration || 'RJ14-PEND-01',
    registered_at: now,
  };

  try {
    const { data, error } = await supabaseServer
      .from('drivers')
      .insert([newRow])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Drivers] Register insert warning:', error.message);
      return {
        success: false,
        message: `Registered locally, but Supabase insert note: ${error.message}`,
        error: error.message,
      };
    }

    broadcastServerEvent('DRIVER_REGISTERED', {
      driver_id: newRow.driver_id,
      driver_name: newRow.driver_name,
      verification_status: 'PENDING',
    });

    return {
      success: true,
      driver: data as Driver,
      message: 'Driver registered in Supabase with PENDING verification status.',
    };
  } catch (err: any) {
    console.error('[Supabase Drivers] Error registering driver:', err);
    return {
      success: false,
      message: err.message || 'Failed to register driver in Supabase',
      error: err.message,
    };
  }
}

/**
 * Coordinator verifies driver in Supabase (sets verification_status = 'VERIFIED')
 */
export async function verifySupabaseDriver(
  driverId: string,
  coordinatorId: string,
  notes?: string
): Promise<{
  success: boolean;
  message: string;
  driver?: Driver;
}> {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabaseServer
      .from('drivers')
      .update({
        verification_status: 'VERIFIED',
        approval_status: 'APPROVED',
        driver_status: 'ACTIVE',
        verified_by: coordinatorId,
        verified_at: now,
        approved_by: coordinatorId,
        approved_at: now,
      })
      .eq('driver_id', driverId)
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Drivers] Update verification warning:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }

    broadcastServerEvent('DRIVER_STATUS_UPDATED', {
      driverId,
      status: 'VERIFIED',
      approval_status: 'APPROVED',
      verifiedBy: coordinatorId,
      notes,
    });

    return {
      success: true,
      message: `Driver ${driverId} marked as VERIFIED in Supabase.`,
      driver: data as Driver,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to update driver verification in Supabase',
    };
  }
}

/**
 * Coordinator rejects driver in Supabase (sets verification_status = 'REJECTED')
 */
export async function rejectSupabaseDriver(
  driverId: string,
  coordinatorId: string,
  reason: string
): Promise<{
  success: boolean;
  message: string;
  driver?: Driver;
}> {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabaseServer
      .from('drivers')
      .update({
        verification_status: 'REJECTED',
        approval_status: 'REJECTED',
        driver_status: 'INACTIVE',
        verified_by: coordinatorId,
        verified_at: now,
        approved_by: coordinatorId,
        approved_at: now,
        rejection_reason: reason,
      })
      .eq('driver_id', driverId)
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    broadcastServerEvent('DRIVER_STATUS_UPDATED', {
      driverId,
      status: 'REJECTED',
      reason,
      verifiedBy: coordinatorId,
    });

    return {
      success: true,
      message: `Driver ${driverId} rejected in Supabase.`,
      driver: data as Driver,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to update driver rejection in Supabase',
    };
  }
}

