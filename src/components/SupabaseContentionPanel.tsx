import React, { useState, useEffect } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Truck,
  Zap,
  Check,
  Lock,
  Boxes,
  Radio,
} from 'lucide-react';
import { ContentionDetail, SupabaseDockSlot } from '../db/supabaseService';
import { useAuth } from '../context/AuthContext';
import { useSupabaseRealtime } from '../lib/realtimeService';
import { useSlotContention } from '../hooks/useSlotContention';

export const SupabaseContentionPanel: React.FC<{
  facilityId?: string;
  onContentionResolved?: () => void;
}> = ({ facilityId = 'FAC_JAI_01', onContentionResolved }) => {
  const { profile } = useAuth();
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [slots, setSlots] = useState<SupabaseDockSlot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resolvingSlotId, setResolvingSlotId] = useState<string | null>(null);
  const [recentlyUpdatedSlotId, setRecentlyUpdatedSlotId] = useState<string | null>(null);

  // Dedicated Contention Logic Hook: flags slots where requests > 1
  const {
    contestedSlots,
    flaggedSlotIds,
    isSlotContested,
    getSlotRequestCount,
    totalContestedSlots,
    totalContestedRequests,
    refetch: refetchContention,
    resolveContention: resolveHookContention,
    simulateContention: simulateHookContention,
  } = useSlotContention({
    facilityId,
    onContentionDetected: (newAlerts) => {
      setActionMessage({
        type: 'error',
        text: `⚠️ Contention Alert: ${newAlerts.length} slot(s) flagged with concurrent requests (> 1)!`,
      });
    },
  });

  // Supabase Realtime WebSocket hook: instant reactive sync on any slot or contention changes
  const { status: realtimeStatus, isConnected: isRealtimeConnected, lastEvent: realtimeLastEvent, activePeersCount } = useSupabaseRealtime({
    onEvent: (event, payload) => {
      fetchData();
      refetchContention();
      if (payload?.slotId) {
        setRecentlyUpdatedSlotId(payload.slotId);
        setTimeout(() => setRecentlyUpdatedSlotId(null), 3000);
      }
    },
    userProfile: profile ? {
      id: profile.id,
      fullName: profile.fullName,
      role: profile.role,
      facilityId: facilityId,
    } : null,
  });

  // Fetch Supabase data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Supabase status & stats
      const statusRes = await fetch('/api/supabase/status');
      const statusData = await statusRes.json();
      setStatusInfo(statusData);

      // 2. Fetch live slots
      const slotsRes = await fetch(`/api/supabase/slots?facilityId=${facilityId}`);
      const slotsData = await slotsRes.json();
      setSlots(slotsData.slots || []);

      // 3. Re-evaluate contention query
      await refetchContention();
    } catch (err: any) {
      console.error('Error fetching Supabase data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Fallback relaxed heartbeat interval (30s); instant reactivity is driven by Supabase Realtime WebSocket events
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [facilityId]);

  // Simulate two drivers competing for the same slot
  const handleSimulateContention = async () => {
    setIsSimulating(true);
    setActionMessage(null);
    try {
      // Pick an AVAILABLE slot for concurrency contention test
      const targetSlot = slots.find(s => s.status === 'AVAILABLE') || slots[0];
      const slotId = targetSlot ? targetSlot.id : 'SLOT-JAI-103';

      // Driver 1: Rajesh Kumar (Perishable cold-chain cargo, high confidence)
      const res1 = await fetch('/api/supabase/book-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: 'DRV001',
          driverName: 'Rajesh Kumar',
          vehicleRegistration: 'RJ14GT4101',
          shipmentId: 'SHP-SIM-001',
          slotId,
          facilityId,
          cargoType: 'PERISHABLE',
          urgencyLevel: 'HIGH',
          declaredEta: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          etaConfidenceScore: 96,
        }),
      });
      const data1 = await res1.json();

      // Driver 2: Imran Khan (General freight, medium confidence) concurrent request for SAME slot
      const res2 = await fetch('/api/supabase/book-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: 'DRV002',
          driverName: 'Imran Khan',
          vehicleRegistration: 'HR26GT4102',
          shipmentId: 'SHP-SIM-002',
          slotId,
          facilityId,
          cargoType: 'GENERAL',
          urgencyLevel: 'MEDIUM',
          declaredEta: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
          etaConfidenceScore: 78,
        }),
      });
      const data2 = await res2.json();

      if (res2.status === 409 || data2.status === 'conflict') {
        setActionMessage({
          type: 'success',
          text: `Slot ${slotId} is already confirmed. Concurrency engine safely prevented double-booking (409 Conflict) and suggested ${data2.alternative_slots?.length || 0} alternative slot(s).`,
        });
      } else {
        setActionMessage({
          type: 'success',
          text: `Simulated 2 concurrent driver booking requests on ${slotId}! Contention detected and decision support generated.`,
        });
      }
      await fetchData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to simulate contention',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Resolve contention
  const handleResolveContention = async (
    alert: ContentionDetail,
    selectedDriverApptId: string,
    alternativeSlotId: string | null
  ) => {
    setResolvingSlotId(alert.slot_id);
    setActionMessage(null);
    try {
      const coordinatorId = profile?.id || 'COORD001';
      const refCode = `WH-CONF-${Date.now().toString().slice(-4)}`;

      const otherAppts = alert.competing_appointments
        .filter(a => a.appointment_id !== selectedDriverApptId)
        .map(a => a.appointment_id);

      const res = await fetch('/api/supabase/resolve-contention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: alert.slot_id,
          approvedAppointmentId: selectedDriverApptId,
          coordinatorId,
          confirmationRef: refCode,
          alternativeSlotId,
          rejectedAppointmentIds: otherAppts,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setActionMessage({
          type: 'success',
          text: data.message,
        });
        if (onContentionResolved) onContentionResolved();
        await fetchData();
      } else {
        setActionMessage({
          type: 'error',
          text: data.message || 'Failed to resolve contention.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Network error resolving contention',
      });
    } finally {
      setResolvingSlotId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Supabase Single Source of Truth & Realtime State */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Supabase Real-Time Docking Engine
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Single Source of Truth
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized PostgreSQL database managing concurrent dock slot reservations, atomic locks, and intelligent contention resolution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Supabase Realtime Live Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              />
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium hidden sm:inline">Supabase Realtime:</span>
              <span className="text-emerald-400 font-semibold font-mono text-[11px]">
                {isRealtimeConnected ? 'LIVE' : realtimeStatus}
              </span>
            </div>

            <button
              onClick={handleSimulateContention}
              disabled={isSimulating}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow-md shadow-amber-900/30 flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
              title="Test multi-user concurrency by having 2 drivers compete for the same dock slot"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Simulating...' : 'Simulate 2-Driver Contention'}</span>
            </button>

            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh Supabase data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Supabase Inventory Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Total Docks in DB</span>
            <span className="text-xl font-bold text-slate-100 mt-0.5 block">
              {statusInfo?.total_slots || slots.length || 0} Slots
            </span>
            <span className="text-[10px] text-slate-500">Across 4 Operational Bays</span>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] text-emerald-400 block font-medium">Available</span>
            <span className="text-xl font-bold text-emerald-300 mt-0.5 block">
              {statusInfo?.available_slots ?? slots.filter(s => s.status === 'AVAILABLE').length}
            </span>
            <span className="text-[10px] text-slate-500">Ready for booking</span>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] text-amber-400 block font-medium">Hold Pending (Lock)</span>
            <span className="text-xl font-bold text-amber-300 mt-0.5 block">
              {statusInfo?.hold_pending_slots ?? slots.filter(s => s.status === 'HOLD_PENDING').length}
            </span>
            <span className="text-[10px] text-slate-500">Under 10-min reservation</span>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] text-rose-400 block font-medium">Contested Slots (Req &gt; 1)</span>
            <span className="text-xl font-bold text-rose-300 mt-0.5 block">
              {totalContestedSlots}
            </span>
            <span className="text-[10px] text-slate-500">
              {totalContestedRequests > 0 ? `${totalContestedRequests} competing requests` : '0 concurrent requests'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg transition-all animate-fade-in ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-mono ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION: Contention Intelligence Engine */}
      {contestedSlots.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Contested Slots Flagged ({contestedSlots.length} Slots &gt; 1 Request)</span>
                <span className="text-xs font-normal normal-case text-slate-400">
                  — Contention query identified {totalContestedRequests} competing requests
                </span>
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Rule: requests &gt; 1
            </span>
          </div>

          {contestedSlots.map(alert => {
            const isResolving = resolvingSlotId === alert.slot_id;
            const winner = alert.competing_appointments[0];
            const runnerUp = alert.competing_appointments[1];

            return (
              <div
                key={alert.slot_id}
                className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden"
              >
                {/* Contention Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-mono font-bold">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <span>Contested Dock: {alert.door_number}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {alert.slot_id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          Window:{' '}
                          {new Date(alert.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(alert.end_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        <span className="text-blue-400 font-medium">
                          {alert.competing_appointments.length} Drivers Competing
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 self-start sm:self-center border border-rose-500/30">
                    Action Required
                  </span>
                </div>

                {/* Competing Drivers Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {alert.competing_appointments.map((comp, idx) => {
                    const isRecommended = comp.driver_id === alert.recommendation.recommended_driver_id;

                    return (
                      <div
                        key={comp.appointment_id}
                        className={`rounded-xl p-4 border transition-all ${
                          isRecommended
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                            : 'bg-slate-950/70 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200">
                              Candidate #{idx + 1}: {comp.driver_name}
                            </span>
                            {isRecommended && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Recommended Choice
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {comp.driver_id}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-500 block">Vehicle Reg</span>
                            <span className="font-mono text-slate-300 font-medium">
                              {comp.vehicle_registration}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">Cargo Type</span>
                            <span
                              className={`font-semibold ${
                                comp.cargo_type === 'PERISHABLE' || comp.cargo_type === 'COLD_CHAIN'
                                  ? 'text-cyan-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {comp.cargo_type}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">Urgency Level</span>
                            <span
                              className={`font-semibold ${
                                comp.urgency_level === 'CRITICAL'
                                  ? 'text-rose-400'
                                  : comp.urgency_level === 'HIGH'
                                  ? 'text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {comp.urgency_level}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">ETA Confidence</span>
                            <div className="flex items-center gap-1 font-bold text-emerald-400">
                              <span>{comp.eta_confidence_score}%</span>
                              <span className="text-[10px] font-normal text-slate-400">
                                ({new Date(comp.declared_eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Priority Score Meter */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Priority Engine Score:</span>
                          <span className="font-mono font-bold text-amber-300">
                            {comp.score} pts
                          </span>
                        </div>

                        {/* Manual override button */}
                        <div className="mt-3">
                          <button
                            onClick={() =>
                              handleResolveContention(
                                alert,
                                comp.appointment_id,
                                isRecommended ? alert.recommendation.alternative_slot_id : null
                              )
                            }
                            disabled={isResolving}
                            className={`w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                              isRecommended
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Award Slot to {comp.driver_name.split(' ')[0]}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI & Scoring Decision Recommendation Box */}
                <div className="bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-blue-200 uppercase tracking-wide">
                      Decision-Support Recommendation
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed">
                    {alert.recommendation.reason}
                  </p>

                  {alert.recommendation.alternative_slot_id && runnerUp && (
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-slate-300">
                          Suggested alternative for <strong>{runnerUp.driver_name}</strong>:
                        </span>
                      </div>
                      <span className="font-mono text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {alert.recommendation.alternative_slot_door} ({alert.recommendation.alternative_slot_id})
                      </span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() =>
                        handleResolveContention(
                          alert,
                          winner.appointment_id,
                          alert.recommendation.alternative_slot_id
                        )
                      }
                      disabled={isResolving}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {isResolving
                          ? 'Resolving...'
                          : `Accept Recommendation: Assign to ${winner.driver_name.split(' ')[0]} & Re-route Runner-up`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-200">No Dock Contention Currently</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All current dock slot bookings are cleanly isolated. If multiple concurrent drivers target the exact same slot, this engine will automatically flag it and calculate the best decision recommendation here.
          </p>
          <div>
            <button
              onClick={handleSimulateContention}
              disabled={isSimulating}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate 2-Driver Contention Test</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION: Live Supabase Dock Slots Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-400" />
              <span>Live Supabase Dock Matrix ({slots.length} Slots)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Direct live view of PostgreSQL public.dock_slots with real-time concurrency status.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {slots.map(slot => {
            const isContested = isSlotContested(slot.id);
            const requestCount = getSlotRequestCount(slot.id);
            const isHold = slot.status === 'HOLD_PENDING';
            const isConfirmed = slot.status === 'CONFIRMED';
            const isAvailable = slot.status === 'AVAILABLE';
            const isJustUpdated = recentlyUpdatedSlotId === slot.id;

            return (
              <div
                key={slot.id}
                className={`p-3.5 rounded-xl border transition-all relative ${
                  isContested
                    ? 'ring-2 ring-rose-500 bg-rose-950/30 border-rose-500/80 shadow-lg shadow-rose-950/50'
                    : isJustUpdated
                    ? 'ring-2 ring-cyan-400 bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-950/50'
                    : isHold
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                    : isConfirmed
                    ? 'bg-blue-950/20 border-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isContested && (
                  <span className="absolute -top-2 left-2 px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-md shadow-rose-950 animate-pulse z-10">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Contested ({requestCount} requests &gt; 1)
                  </span>
                )}
                {isJustUpdated && !isContested && (
                  <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-bold text-[9px] uppercase tracking-wider animate-bounce">
                    ⚡ Live Synced
                  </span>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-200">
                    {slot.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isAvailable
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isHold
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {slot.status}
                  </span>
                </div>

                <div className="text-xs text-slate-300 font-medium mb-1">
                  {slot.dock_doors?.door_number || 'Bay'}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {isHold && slot.hold_expires_at && (
                  <div className="mt-2 pt-2 border-t border-amber-500/20 text-[10px] text-amber-300/90 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Concurrency Hold Active</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
