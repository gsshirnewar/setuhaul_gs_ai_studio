import express, { Request, Response } from 'express';
import cors from 'cors';
import { db } from './db/dataStore';
import { resolveDriverOperationalContext } from './domain/operations';
import { runAgentTurn } from './agent/agent';
import { validatePhoneNumber, validateTruckRegistration, validateEmail } from './utils/sanitaryValidation';
import {
  getSupabaseSlots,
  bookSlotWithConcurrency,
  getContentionAlerts,
  queryContestedSlots,
  resolveContention,
  releaseExpiredHolds,
  approveSupabaseAppointment,
  rejectSupabaseAppointment,
  broadcastServerEvent,
  supabaseServer,
  pushSeedDriversToSupabase,
  fetchSupabaseDrivers,
  authenticateSupabaseDriver,
  registerSupabaseDriver,
  verifySupabaseDriver,
  rejectSupabaseDriver,
  checkSupabaseDriversTable,
  SUPABASE_DRIVERS_SQL,
} from './db/supabaseService';

export const apiApp = express();

apiApp.use(cors());
apiApp.use(express.json());

const router = express.Router();

// Health Check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Comprehensive drivers directory & metadata endpoint for Driver Selector and Directories
router.get('/drivers', (req: Request, res: Response) => {
  const includePending = req.query.includePending !== 'false';
  const sourceDrivers = includePending ? db.getAllDrivers() : db.getDrivers();

  const drivers = sourceDrivers.map(d => {
    const activeShipments = db.getDriverActiveShipments(d.driver_id);
    let scenario = 'Standard delivery';
    if (d.approval_status === 'PENDING') {
      scenario = 'Newly Registered — Awaiting Facility Verification & Slot Allocation';
    } else if (d.approval_status === 'REJECTED') {
      scenario = 'Registration Rejected — Requires Revised Credentials';
    } else if (d.driver_id === 'DRV006') scenario = 'Traffic delay (SHP1006) — 10:00 slot missed';
    else if (d.driver_id === 'DRV012') scenario = 'Mechanical breakdown repaired (SHP1012)';
    else if (d.driver_id === 'DRV004') scenario = 'Ambiguous case (2 active shipments: ORD-004 & ORD-020)';
    else if (d.driver_id === 'DRV015') scenario = 'Reefer shipment with maintenance conflict (SHP1015)';
    else if (d.driver_id === 'DRV007') scenario = 'Heavy trailer requiring Dock D6 (SHP1016)';
    else if (d.driver_id === 'DRV003') scenario = 'Early arrival at gate (SHP1003)';
    else if (d.driver_id === 'DRV014') scenario = 'Critical hospital supply pending confirmation (SHP1014)';
    else if (d.driver_id === 'DRV013') scenario = 'Vague 1-hour delay with low confidence (SHP1013)';
    else if (d.driver_id === 'DRV008') scenario = 'Cancelled shipment (SHP1019)';

    return {
      ...d,
      active_shipments_count: activeShipments.length,
      scenario,
    };
  });

  const pendingCount = db.getPendingDrivers().length;
  const approvedCount = db.getDrivers().length;

  res.json({
    drivers,
    total: drivers.length,
    pending_count: pendingCount,
    approved_count: approvedCount,
  });
});

// Get driver context
router.get('/context/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const context = resolveDriverOperationalContext(driverId);
  res.json(context);
});

// Chat endpoint
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { driverId, message, history } = req.body;
    if (!driverId || !message) {
      return res.status(400).json({ error: 'driverId and message are required' });
    }

    // 1. Create or get chat thread
    const activeShipments = db.getDriverActiveShipments(driverId);
    const shipmentId = activeShipments.length === 1 ? activeShipments[0].shipment_id : null;
    const thread = db.createOrGetChatThread(driverId, shipmentId);

    // 2. Persist user message
    db.persistChatMessage(thread.thread_id, 'DRIVER', driverId, message);

    // 3. Run agent turn
    const agentResponse = await runAgentTurn(driverId, message, history || []);

    // 4. Persist agent message
    db.persistChatMessage(thread.thread_id, 'AGENT', 'agent', agentResponse.message);

    res.json({
      thread_id: thread.thread_id,
      message: agentResponse.message,
      tool_calls: agentResponse.toolCalls,
      mode: agentResponse.mode,
      guardrails: agentResponse.guardrails,
      harness_report: agentResponse.harnessReport,
    });
  } catch (err: any) {
    console.error('Error handling chat:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Chat message history for driver
router.get('/chat/history/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const threads = db.chatThreads.filter(t => t.driver_id === driverId);
  const messages: any[] = [];
  for (const t of threads) {
    const threadMsgs = db.getThreadMessages(t.thread_id);
    messages.push(...threadMsgs);
  }
  messages.sort((a, b) => a.message_ts.localeCompare(b.message_ts));
  res.json({ messages });
});

// Clear chat history for driver on logout/session end
router.post('/chat/clear', (req: Request, res: Response) => {
  const { driverId } = req.body;
  db.clearDriverChatHistory(driverId);
  res.json({ status: 'ok', message: 'Chat history cleared for driver session.' });
});

// Driver Registration & Verification Endpoints
router.get('/driver/check-uniqueness', (req: Request, res: Response) => {
  const { phone, vehicle_registration, vehicleReg, email, driver_id } = req.query as Record<string, string>;
  const check = db.validateDriverRegistrationUniqueness({
    phone: phone || undefined,
    vehicle_registration: vehicle_registration || vehicleReg || undefined,
    email: email || undefined,
    driver_id: driver_id || undefined,
  });
  res.json(check);
});

router.post('/driver/register', (req: Request, res: Response) => {
  try {
    const { driver_id, driver_name, fullName, name, email, phone, vehicle_registration, vehicleReg, password, home_base_city } = req.body;
    const effectiveName = (driver_name || fullName || name || '').trim();
    const effectiveVehicle = (vehicle_registration || vehicleReg || '').trim();

    if (!email || !effectiveName) {
      return res.status(400).json({ error: 'driver_name and email are required for registration.' });
    }

    // Sanitary check email
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      return res.status(400).json({ error: emailCheck.error });
    }

    // Sanitary check phone if provided
    let formattedPhone = phone;
    if (phone) {
      const phoneCheck = validatePhoneNumber(phone);
      if (!phoneCheck.isValid) {
        return res.status(400).json({ error: phoneCheck.error });
      }
      formattedPhone = phoneCheck.cleaned;
    }

    // Sanitary check vehicle registration if provided
    let formattedVehicle = effectiveVehicle;
    if (effectiveVehicle) {
      const vehicleCheck = validateTruckRegistration(effectiveVehicle);
      if (!vehicleCheck.isValid) {
        return res.status(400).json({ error: vehicleCheck.error });
      }
      formattedVehicle = vehicleCheck.cleaned;
    }

    // Uniqueness validation against DB
    const uniquenessCheck = db.validateDriverRegistrationUniqueness({
      email: emailCheck.cleaned || email,
      phone: formattedPhone,
      vehicle_registration: formattedVehicle,
      driver_id,
    });

    if (!uniquenessCheck.isValid) {
      return res.status(409).json({
        error: uniquenessCheck.error,
        conflictField: uniquenessCheck.conflictField,
        existingEntity: uniquenessCheck.conflictingEntity,
      });
    }

    const result = db.registerDriver({
      driver_id,
      driver_name: effectiveName,
      email: emailCheck.cleaned || email,
      phone: formattedPhone,
      vehicle_registration: formattedVehicle,
      password,
      home_base_city,
    });

    // Synchronize driver registration to Supabase with verification_status = 'PENDING'
    if (result.status === 'success' && result.driver) {
      registerSupabaseDriver({
        driver_id: result.driver.driver_id,
        driver_name: result.driver.driver_name,
        email: result.driver.email,
        password: password || 'Password#Drv01',
        phone: result.driver.phone,
        licence_number: result.driver.licence_number,
        vehicle_registration: result.driver.vehicle_registration,
        carrier_id: result.driver.carrier_id,
        home_base_city: result.driver.home_base_city,
      }).catch(err => console.warn('[Supabase Driver Sync] Async register warning:', err));
    }

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Error registering driver:', err);
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({
      error: err.message || 'Failed to register driver',
      conflictField: err.conflictField,
    });
  }
});

// Direct Driver Authentication from Supabase (username / email and password)
router.post('/auth/driver-login', async (req: Request, res: Response) => {
  try {
    const { identifier, email, username, driver_id, password } = req.body;
    const targetId = (identifier || email || username || driver_id || '').trim();
    const targetPassword = (password || '').trim();

    if (!targetId || !targetPassword) {
      return res.status(400).json({
        authenticated: false,
        error: 'Username/Email and password are required for driver authentication.',
      });
    }

    const authResult = await authenticateSupabaseDriver(targetId, targetPassword);
    if (!authResult.authenticated) {
      return res.status(401).json({
        authenticated: false,
        error: authResult.message,
      });
    }

    res.json(authResult);
  } catch (err: any) {
    console.error('[Auth Driver Login] Unexpected error:', err);
    res.status(500).json({
      authenticated: false,
      error: err.message || 'Authentication service error',
    });
  }
});

// Supabase Drivers Synchronization & Status endpoints
router.post('/supabase/sync-drivers', async (req: Request, res: Response) => {
  try {
    const allDrivers = db.getAllDrivers();
    const syncResult = await pushSeedDriversToSupabase(allDrivers);
    res.json(syncResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/supabase/drivers/status', async (req: Request, res: Response) => {
  try {
    const check = await checkSupabaseDriversTable();
    const localDrivers = db.getAllDrivers();
    const verifiedCount = localDrivers.filter(d => d.verification_status === 'VERIFIED' || d.approval_status === 'APPROVED').length;
    const pendingCount = localDrivers.filter(d => d.verification_status === 'PENDING' || d.approval_status === 'PENDING').length;

    res.json({
      tableExists: check.exists,
      supabaseCount: check.count,
      localTotal: localDrivers.length,
      verifiedCount,
      pendingCount,
      error: check.error,
      sqlSnippet: SUPABASE_DRIVERS_SQL,
    });
  } catch (err: any) {
    res.status(500).json({ tableExists: false, error: err.message, sqlSnippet: SUPABASE_DRIVERS_SQL });
  }
});

// Get driver approval and operational status
router.get('/driver/status/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const driver = db.getDriver(driverId);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }
  res.json({
    driver_id: driver.driver_id,
    driver_name: driver.driver_name,
    verification_status: driver.verification_status || (driver.approval_status === 'PENDING' ? 'PENDING' : 'VERIFIED'),
    approval_status: driver.approval_status || 'APPROVED',
    driver_status: driver.driver_status,
    vehicle_registration: driver.vehicle_registration,
    registered_at: driver.registered_at,
    approved_by: driver.approved_by,
    approved_at: driver.approved_at,
    verified_by: driver.verified_by || driver.approved_by,
    verified_at: driver.verified_at || driver.approved_at,
    rejection_reason: driver.rejection_reason,
  });
});

// List all pending drivers for coordinators
router.get('/coordinator/drivers/pending', (req: Request, res: Response) => {
  const pendingDrivers = db.getPendingDrivers();
  res.json({ pending_drivers: pendingDrivers });
});

// Coordinator approves driver registration (updates Supabase to VERIFIED)
router.post('/coordinator/drivers/:driverId/approve', async (req: Request, res: Response) => {
  const { driverId } = req.params;
  const { coordinatorId, notes } = req.body;
  const coordId = coordinatorId || 'COORD001';

  const result = db.approveDriverRegistration(driverId, coordId, notes);
  if (result.status === 'error') {
    return res.status(400).json(result);
  }

  // Synchronize to Supabase drivers table: set verification_status = 'VERIFIED'
  verifySupabaseDriver(driverId, coordId, notes).catch(err => {
    console.warn('[Supabase Verify] Background update note:', err);
  });

  broadcastServerEvent('DRIVER_STATUS_UPDATED', {
    driverId,
    status: 'APPROVED',
    verification_status: 'VERIFIED',
    approvedBy: coordId,
    notes,
  });

  res.json(result);
});

// Coordinator rejects driver registration (updates Supabase to REJECTED)
router.post('/coordinator/drivers/:driverId/reject', async (req: Request, res: Response) => {
  const { driverId } = req.params;
  const { coordinatorId, reason } = req.body;
  const coordId = coordinatorId || 'COORD001';
  const rejectReason = reason || 'Driver credentials or vehicle documentation could not be verified.';

  const result = db.rejectDriverRegistration(driverId, coordId, rejectReason);
  if (result.status === 'error') {
    return res.status(400).json(result);
  }

  // Synchronize to Supabase drivers table: set verification_status = 'REJECTED'
  rejectSupabaseDriver(driverId, coordId, rejectReason).catch(err => {
    console.warn('[Supabase Reject] Background update note:', err);
  });

  broadcastServerEvent('DRIVER_STATUS_UPDATED', {
    driverId,
    status: 'REJECTED',
    verification_status: 'REJECTED',
    rejectedBy: coordId,
    reason: rejectReason,
  });

  res.json(result);
});

// Driver details by Email
router.get('/driver/by-email/:email', (req: Request, res: Response) => {
  const { email } = req.params;
  const driver = db.getDriverByEmail(decodeURIComponent(email));
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found in database' });
  }
  res.json({ driver });
});

// Driver details by ID
router.get('/driver/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const driver = db.getDriver(driverId);
  if (!driver) {
    return res.json({
      driver: {
        driver_id: driverId,
        driver_name: driverId.startsWith('DRV') ? `Driver ${driverId}` : 'Driver',
        carrier_id: 'CAR001',
        phone: '',
        driver_status: 'ACTIVE',
        approval_status: 'APPROVED',
      },
    });
  }
  res.json({ driver });
});

// Coordinators directory & details
router.get('/coordinators', (req: Request, res: Response) => {
  const facilityId = req.query.facilityId as string | undefined;
  const coordinators = db.getCoordinators(facilityId);
  res.json({ coordinators });
});

router.get('/coordinators/:coordinatorId', (req: Request, res: Response) => {
  const { coordinatorId } = req.params;
  const coordinator = db.getCoordinator(coordinatorId);
  if (!coordinator) {
    return res.status(404).json({ error: 'Coordinator not found' });
  }
  res.json({ coordinator });
});

// Facilities list
router.get('/facilities', (req: Request, res: Response) => {
  const facilities = db.getFacilities();
  res.json({ facilities });
});

// Coordinator dashboard overview
router.get('/coordinator/:facilityId', (req: Request, res: Response) => {
  const { facilityId } = req.params;
  const overview = db.getCoordinatorOverview(facilityId);
  if (!overview) {
    return res.status(404).json({ error: 'Facility not found' });
  }
  res.json(overview);
});

// Coordinator approve driver slot change / booking request
router.post('/appointments/:appointmentId/approve', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const { coordinatorId, warehouseConfirmationRef, notes } = req.body;

  if (!warehouseConfirmationRef) {
    return res.status(400).json({ error: 'warehouseConfirmationRef is required' });
  }

  const coordId = coordinatorId || 'COORD001';
  const result = db.approvePendingAppointment(appointmentId, coordId, warehouseConfirmationRef, notes);

  try {
    await approveSupabaseAppointment({
      appointmentId,
      coordinatorId: coordId,
      warehouseConfirmationRef,
      notes,
    });
  } catch (sbErr: any) {
    console.warn('[Supabase Sync Warning]', sbErr.message);
  }

  res.json(result);
});

// Coordinator reject driver slot change / booking request
router.post('/appointments/:appointmentId/reject', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const { coordinatorId, rejectionReason } = req.body;

  if (!rejectionReason) {
    return res.status(400).json({ error: 'rejectionReason is required' });
  }

  const coordId = coordinatorId || 'COORD001';
  const result = db.rejectPendingAppointment(appointmentId, coordId, rejectionReason);

  try {
    await rejectSupabaseAppointment({
      appointmentId,
      coordinatorId: coordId,
      rejectionReason,
    });
  } catch (sbErr: any) {
    console.warn('[Supabase Sync Warning]', sbErr.message);
  }

  res.json(result);
});

// Warehouse manual confirmation
router.post('/appointments/:appointmentId/confirm', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const { warehouseConfirmationRef, coordinatorId, notes } = req.body;
  if (!warehouseConfirmationRef) {
    return res.status(400).json({ error: 'warehouseConfirmationRef is required' });
  }

  const coordId = coordinatorId || 'COORD001';
  const result = db.approvePendingAppointment(appointmentId, coordId, warehouseConfirmationRef, notes);

  try {
    await approveSupabaseAppointment({
      appointmentId,
      coordinatorId: coordId,
      warehouseConfirmationRef,
      notes,
    });
  } catch (sbErr: any) {
    console.warn('[Supabase Sync Warning]', sbErr.message);
  }

  res.json(result);
});

// Supabase Status
router.get('/supabase/status', async (req: Request, res: Response) => {
  try {
    await releaseExpiredHolds();
    const { data: slots, error: slotErr } = await supabaseServer.from('dock_slots').select('id, status');
    const { data: doors, error: doorErr } = await supabaseServer.from('dock_doors').select('id');
    const { data: appts, error: apptErr } = await supabaseServer.from('appointments').select('id, is_contested, status');

    if (slotErr || doorErr) {
      return res.status(500).json({
        connected: false,
        error: slotErr?.message || doorErr?.message,
      });
    }

    const contestedCount = (appts || []).filter(a => a.is_contested && a.status === 'REQUESTED').length;

    res.json({
      connected: true,
      project_url: 'https://ivjuhthqecntjywfyrag.supabase.co',
      total_slots: slots?.length || 0,
      available_slots: (slots || []).filter(s => s.status === 'AVAILABLE').length,
      hold_pending_slots: (slots || []).filter(s => s.status === 'HOLD_PENDING').length,
      confirmed_slots: (slots || []).filter(s => s.status === 'CONFIRMED').length,
      total_doors: doors?.length || 0,
      contested_appointments: contestedCount,
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// Fetch live dock slots from Supabase
router.get('/supabase/slots', async (req: Request, res: Response) => {
  try {
    const facilityId = (req.query.facilityId as string) || 'FAC_JAI_01';
    const slots = await getSupabaseSlots(facilityId);
    res.json({ facility_id: facilityId, slots });
  } catch (err: any) {
    console.error('Error fetching Supabase slots:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch Supabase slots' });
  }
});

// Book a dock slot with concurrency locking & contention detection
router.post('/supabase/book-slot', async (req: Request, res: Response) => {
  try {
    const {
      driverId,
      driverName,
      vehicleRegistration,
      shipmentId,
      slotId,
      facilityId,
      cargoType,
      urgencyLevel,
      declaredEta,
      etaConfidenceScore,
    } = req.body;

    if (!driverId || !slotId) {
      return res.status(400).json({ error: 'driverId and slotId are required' });
    }

    const result = await bookSlotWithConcurrency({
      driverId,
      driverName,
      vehicleRegistration,
      shipmentId: shipmentId || `SHP-${Date.now().toString().slice(-4)}`,
      slotId,
      facilityId: facilityId || 'FAC_JAI_01',
      cargoType,
      urgencyLevel,
      declaredEta,
      etaConfidenceScore,
    });

    if (result.status === 'conflict') {
      return res.status(409).json(result);
    }
    if (result.status === 'error') {
      return res.status(500).json(result);
    }

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Error booking Supabase slot:', err);
    res.status(500).json({ error: err.message || 'Failed to book slot' });
  }
});

// Contention Logic: Query & flag slots where requests > 1
router.get('/supabase/contention-slots', async (req: Request, res: Response) => {
  try {
    const facilityId = (req.query.facilityId as string) || 'FAC_JAI_01';
    const result = await queryContestedSlots(facilityId);
    res.json(result);
  } catch (err: any) {
    console.error('Error executing contention slots query (requests > 1):', err);
    res.status(500).json({ error: err.message || 'Failed to query contested slots' });
  }
});

// Check contention status for a single slot
router.get('/supabase/slot-contention/:slotId', async (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const facilityId = (req.query.facilityId as string) || 'FAC_JAI_01';
    const result = await queryContestedSlots(facilityId);
    const slotContention = result.contested_slots.find(s => s.slot_id === slotId);
    const isContested = result.flagged_slot_ids.includes(slotId);
    const requestCount = slotContention?.request_count || (isContested ? 2 : 0);

    res.json({
      slot_id: slotId,
      facility_id: facilityId,
      is_contested: isContested,
      request_count: requestCount,
      contention_detail: slotContention || null,
    });
  } catch (err: any) {
    console.error('Error checking single slot contention:', err);
    res.status(500).json({ error: err.message || 'Failed to check slot contention' });
  }
});

// Coordinator: Get real-time slot contention alerts
router.get('/supabase/contention-alerts', async (req: Request, res: Response) => {
  try {
    const facilityId = (req.query.facilityId as string) || 'FAC_JAI_01';
    const alerts = await getContentionAlerts(facilityId);
    res.json({ facility_id: facilityId, contention_alerts: alerts, count: alerts.length });
  } catch (err: any) {
    console.error('Error fetching contention alerts:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch contention alerts' });
  }
});

// Coordinator: Resolve contention
router.post('/supabase/resolve-contention', async (req: Request, res: Response) => {
  try {
    const {
      slotId,
      approvedAppointmentId,
      coordinatorId,
      confirmationRef,
      alternativeSlotId,
      rejectedAppointmentIds,
    } = req.body;

    if (!slotId || !approvedAppointmentId || !confirmationRef) {
      return res.status(400).json({
        error: 'slotId, approvedAppointmentId, and confirmationRef are required to resolve contention',
      });
    }

    const result = await resolveContention({
      slotId,
      approvedAppointmentId,
      coordinatorId: coordinatorId || 'COORD001',
      confirmationRef,
      alternativeSlotId,
      rejectedAppointmentIds,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error resolving contention:', err);
    res.status(500).json({ error: err.message || 'Failed to resolve contention' });
  }
});

// Reset database state
router.post('/reset', (req: Request, res: Response) => {
  db.reset();
  broadcastServerEvent('SYSTEM_RESET', { message: 'Data store reset to initial seed state.' });
  res.json({ status: 'ok', message: 'Data store reset to initial seed state.' });
});

// Mount both under /api (for local and full-path calls) and directly on router (for Vercel rewrites)
apiApp.use('/api', router);
apiApp.use(router);
