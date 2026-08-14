import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/dataStore';
import { resolveDriverOperationalContext } from './src/domain/operations';
import { confirmBooking } from './src/domain/booking';
import { runAgentTurn } from './src/agent/agent';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Demo drivers metadata for Driver Selector UI
  app.get('/api/drivers', (req, res) => {
    const drivers = db.getDrivers().map(d => {
      const activeShipments = db.getDriverActiveShipments(d.driver_id);
      let scenario = 'Standard delivery';
      if (d.driver_id === 'DRV006') scenario = 'Traffic delay (SHP1006) — 10:00 slot missed';
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
    res.json({ drivers });
  });

  // Get driver context
  app.get('/api/context/:driverId', (req, res) => {
    const { driverId } = req.params;
    const context = resolveDriverOperationalContext(driverId);
    res.json(context);
  });

  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
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
      });
    } catch (err: any) {
      console.error('Error handling chat:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Chat message history for driver
  app.get('/api/chat/history/:driverId', (req, res) => {
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
  app.post('/api/chat/clear', (req, res) => {
    const { driverId } = req.body;
    db.clearDriverChatHistory(driverId);
    res.json({ status: 'ok', message: 'Chat history cleared for driver session.' });
  });

  // Driver details by ID
  app.get('/api/driver/:driverId', (req, res) => {
    const { driverId } = req.params;
    const driver = db.getDriver(driverId);
    if (!driver) {
      // Return fallback for custom registered users
      return res.json({
        driver: {
          driver_id: driverId,
          driver_name: driverId.startsWith('DRV') ? `Driver ${driverId}` : 'Driver',
          carrier_id: 'CAR001',
          phone: '',
          driver_status: 'ACTIVE',
        },
      });
    }
    res.json({ driver });
  });

  // Coordinators directory & details
  app.get('/api/coordinators', (req, res) => {
    const facilityId = req.query.facilityId as string | undefined;
    const coordinators = db.getCoordinators(facilityId);
    res.json({ coordinators });
  });

  app.get('/api/coordinators/:coordinatorId', (req, res) => {
    const { coordinatorId } = req.params;
    const coordinator = db.getCoordinator(coordinatorId);
    if (!coordinator) {
      return res.status(404).json({ error: 'Coordinator not found' });
    }
    res.json({ coordinator });
  });

  // Facilities list
  app.get('/api/facilities', (req, res) => {
    const facilities = db.getFacilities();
    res.json({ facilities });
  });

  // Coordinator dashboard overview
  app.get('/api/coordinator/:facilityId', (req, res) => {
    const { facilityId } = req.params;
    const overview = db.getCoordinatorOverview(facilityId);
    if (!overview) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    res.json(overview);
  });

  // Coordinator approve driver slot change / booking request
  app.post('/api/appointments/:appointmentId/approve', (req, res) => {
    const { appointmentId } = req.params;
    const { coordinatorId, warehouseConfirmationRef, notes } = req.body;

    if (!warehouseConfirmationRef) {
      return res.status(400).json({ error: 'warehouseConfirmationRef is required' });
    }

    const coordId = coordinatorId || 'COORD001';
    const result = db.approvePendingAppointment(appointmentId, coordId, warehouseConfirmationRef, notes);
    res.json(result);
  });

  // Coordinator reject driver slot change / booking request
  app.post('/api/appointments/:appointmentId/reject', (req, res) => {
    const { appointmentId } = req.params;
    const { coordinatorId, rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'rejectionReason is required' });
    }

    const coordId = coordinatorId || 'COORD001';
    const result = db.rejectPendingAppointment(appointmentId, coordId, rejectionReason);
    res.json(result);
  });

  // Warehouse manual confirmation (legacy fallback)
  app.post('/api/appointments/:appointmentId/confirm', (req, res) => {
    const { appointmentId } = req.params;
    const { warehouseConfirmationRef, coordinatorId, notes } = req.body;
    if (!warehouseConfirmationRef) {
      return res.status(400).json({ error: 'warehouseConfirmationRef is required' });
    }

    const coordId = coordinatorId || 'COORD001';
    const result = db.approvePendingAppointment(appointmentId, coordId, warehouseConfirmationRef, notes);
    res.json(result);
  });

  // Reset database state
  app.post('/api/reset', (req, res) => {
    db.reset();
    res.json({ status: 'ok', message: 'Data store reset to initial seed state.' });
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SetuHaul Freight Operations server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
