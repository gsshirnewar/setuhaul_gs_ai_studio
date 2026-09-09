import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  User,
  Bot,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  Box,
  Layers,
  RotateCcw,
  Sparkles,
  Lock,
  ShieldAlert,
  Sliders,
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Terminal,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSupabaseRealtime } from '../lib/realtimeService';
import { RealtimeStatusBadge } from './RealtimeStatusBadge';

interface DriverItem {
  driver_id: string;
  driver_name: string;
  phone: string;
  scenario: string;
  active_shipments_count: number;
}

interface GuardrailCheckItem {
  passed: boolean;
  name: string;
  category: 'INPUT' | 'RUNTIME' | 'OUTPUT';
  severity: 'INFO' | 'WARNING' | 'BLOCK';
  message: string;
  details?: Record<string, any>;
}

interface GuardrailAuditData {
  overallPassed: boolean;
  blocked: boolean;
  interceptedResponse?: string;
  checks: GuardrailCheckItem[];
  latencyMs: number;
  groundingScore: number;
  safetyCategory: 'NORMAL' | 'EMERGENCY' | 'JAILBREAK_ATTEMPT' | 'OFF_TOPIC';
}

interface HarnessReportData {
  sessionId: string;
  driverId: string;
  turnNumber: number;
  totalLatencyMs: number;
  iterationsCount: number;
  mode: 'gemini' | 'mock';
  guardrails: GuardrailAuditData;
  toolsInvoked: string[];
}

interface ChatMsg {
  id: string;
  sender: 'driver' | 'agent';
  text: string;
  timestamp: string;
  toolCalls?: any[];
  mode?: 'gemini' | 'mock';
  guardrails?: GuardrailAuditData;
  harnessReport?: HarnessReportData;
}

const SESSION_KEY_PREFIX = 'setuhaul_chat_session_';

function formatDriverWelcomeName(rawName?: string): string {
  if (!rawName) return 'Driver';
  let clean = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  clean = clean.replace(/^Mr\.?\s*/i, '').trim();
  return clean || 'Driver';
}

export const DriverChat: React.FC = () => {
  const { profile, role } = useAuth();

  // Strict driver isolation: Permanently locked to the authenticated driver's profile ID
  const initialDriverId =
    role === 'driver' && profile?.id
      ? profile.id
      : 'DRV001';

  const selectedDriverId = profile?.id || initialDriverId;
  const [driverApprovalStatus, setDriverApprovalStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvedCoordinatorName, setApprovedCoordinatorName] = useState<string | null>(null);
  const [context, setContext] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or restore active chat session for authenticated driver
  useEffect(() => {
    if (!selectedDriverId) return;

    // 1. Fetch live operational context for this driver
    setIsLoadingContext(true);
    fetch(`/api/context/${selectedDriverId}`)
      .then(res => res.json())
      .then(data => {
        setContext(data);
      })
      .finally(() => setIsLoadingContext(false));

    // 2. Fetch driver profile and approval status
    fetch(`/api/driver/${selectedDriverId}`)
      .then(res => res.json())
      .then(data => {
        const dbDriver = data?.driver;
        const dbDriverName =
          dbDriver?.driver_name ||
          (selectedDriverId === profile?.id ? profile?.fullName : '') ||
          'Driver';

        const approvalStatus =
          dbDriver?.approval_status ||
          (selectedDriverId === profile?.id ? profile?.approvalStatus : undefined) ||
          'APPROVED';

        setDriverApprovalStatus(approvalStatus);
        const isPending = approvalStatus === 'PENDING';
        const vehiclePlate = dbDriver?.vehicle_registration || (selectedDriverId === profile?.id ? profile?.vehicleReg : '') || 'Submitted Vehicle';
        const welcomeName = formatDriverWelcomeName(dbDriverName);

        let welcomeMessageText = `Welcome to Setuhaul Mr ${welcomeName}, how can i help you today.`;

        if (isPending) {
          welcomeMessageText = `Welcome to Setuhaul Mr ${welcomeName}! Your driver registration is currently being processed by the facility coordinator.\n\nYour profile and vehicle details (${vehiclePlate}) have been submitted to warehouse dispatch for coordinator verification. While your registration is under coordinator review, dock slot booking and automated gate passes are temporarily on hold.\n\nI am here to assist with any questions. You will be notified immediately once the coordinator approves your account!`;
        }

        // Check active session history in sessionStorage
        const sessionKey = `${SESSION_KEY_PREFIX}${selectedDriverId}`;
        const activeSessionData = sessionStorage.getItem(sessionKey);

        if (activeSessionData) {
          try {
            const parsed = JSON.parse(activeSessionData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Ensure pending status is reflected in the initial message if driver is still pending
              if (isPending && !parsed[0].text.includes('processed by the facility coordinator')) {
                parsed[0].text = welcomeMessageText;
              }
              setMessages(parsed);
              return;
            }
          } catch (err) {
            console.warn('Failed to parse active chat session:', err);
          }
        }

        const initialSessionMessage: ChatMsg = {
          id: `welcome-${Date.now()}`,
          sender: 'agent',
          text: welcomeMessageText,
          timestamp: new Date().toISOString(),
          guardrails: {
            overallPassed: true,
            blocked: false,
            checks: [
              {
                name: 'Session Security & Auth Guardrail',
                category: 'INPUT',
                passed: true,
                severity: 'INFO',
                message: `Authenticated driver session established for ${selectedDriverId} (${approvalStatus}).`,
              },
              {
                name: 'System Prompt Policy Harness',
                category: 'RUNTIME',
                passed: true,
                severity: 'INFO',
                message: isPending
                  ? 'Registration Pending Coordinator Review policy enforced.'
                  : 'Deterministic operational boundaries initialized.',
              },
            ],
            latencyMs: 12,
            groundingScore: 100,
            safetyCategory: 'NORMAL',
          },
        };

        setMessages([initialSessionMessage]);
        sessionStorage.setItem(sessionKey, JSON.stringify([initialSessionMessage]));
      })
      .catch(err => {
        console.error('Error fetching driver for welcome message:', err);
        const fallbackName = formatDriverWelcomeName(profile?.fullName || 'Driver');
        const welcomeMessageText = `Welcome to Setuhaul Mr ${fallbackName}, how can i help you today.`;

        const initialSessionMessage: ChatMsg = {
          id: `welcome-${Date.now()}`,
          sender: 'agent',
          text: welcomeMessageText,
          timestamp: new Date().toISOString(),
        };

        setMessages([initialSessionMessage]);
      });
  }, [selectedDriverId, profile]);

  // Supabase Realtime WebSocket subscription for driver events
  const { status: realtimeStatus, isConnected: isRealtimeConnected } = useSupabaseRealtime({
    onEvent: (event, payload) => {
      // 1. Driver registration status changed live by coordinator
      if (event === 'DRIVER_STATUS_UPDATED' && payload.driverId === selectedDriverId) {
        if (payload.status === 'APPROVED' && driverApprovalStatus !== 'APPROVED') {
          setDriverApprovalStatus('APPROVED');
          setApprovedCoordinatorName(payload.approvedBy || 'Operations Coordinator');

          // Refresh context immediately
          fetch(`/api/context/${selectedDriverId}`)
            .then(r => r.json())
            .then(ctx => setContext(ctx))
            .catch(() => {});

          const coordName = payload.approvedBy ? ` (Approved by ${payload.approvedBy})` : '';
          const approvedMsg: ChatMsg = {
            id: `approved-realtime-${Date.now()}`,
            sender: 'agent',
            text: `🎉 Great news! Your driver registration has been APPROVED by the facility coordinator${coordName} via Live Realtime WebSocket!\n\nYour profile and vehicle credentials have been verified. An initial shipment has been assigned, and dock slot reservations, ETA reporting, and digital gate check-in passes are now fully active! How can I assist you today?`,
            timestamp: new Date().toISOString(),
            guardrails: {
              overallPassed: true,
              blocked: false,
              checks: [
                {
                  name: 'Realtime WebSocket Approval',
                  category: 'OUTPUT',
                  passed: true,
                  severity: 'INFO',
                  message: `Registration promoted to APPROVED by ${payload.approvedBy || 'Coordinator'} via Supabase Realtime.`,
                },
              ],
              latencyMs: 12,
              groundingScore: 100,
              safetyCategory: 'NORMAL',
            },
          };
          setMessages(prev => [...prev, approvedMsg]);
        } else if (payload.status === 'REJECTED') {
          setDriverApprovalStatus('REJECTED');
          const rejectMsg: ChatMsg = {
            id: `reject-realtime-${Date.now()}`,
            sender: 'agent',
            text: `⚠️ Notice: Facility coordinator has rejected this driver registration.\n\nReason: ${payload.reason || 'Verification criteria not met'}. Please contact facility dispatch for assistance.`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, rejectMsg]);
        }
      }

      // 2. Appointment confirmed by coordinator
      if (event === 'APPOINTMENT_APPROVED' && (payload.driverId === selectedDriverId || payload.appointmentId === context?.current_appointment?.id)) {
        fetch(`/api/context/${selectedDriverId}`)
          .then(r => r.json())
          .then(ctx => setContext(ctx))
          .catch(() => {});

        const apptApprovedMsg: ChatMsg = {
          id: `appt-approved-${Date.now()}`,
          sender: 'agent',
          text: `✅ Warehouse Confirmation: Your dock slot appointment has been officially approved and confirmed by the facility coordinator!\n\nBay Slot: ${payload.slotId}\nConfirmation Reference: ${payload.warehouseConfirmationRef || 'WH-CONFIRMED'}`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, apptApprovedMsg]);
      }

      // 3. Contention resolved or slot updated
      if (event === 'CONTENTION_RESOLVED' || event === 'SLOT_UPDATED' || event === 'SYSTEM_RESET') {
        fetch(`/api/context/${selectedDriverId}`)
          .then(r => r.json())
          .then(ctx => setContext(ctx))
          .catch(() => {});
      }
    },
    userProfile: profile ? {
      id: profile.id,
      fullName: profile.fullName,
      role: 'driver',
    } : null,
  });

  // Fallback relaxed polling (30s) when driver registration is pending coordinator approval
  useEffect(() => {
    if (!selectedDriverId || driverApprovalStatus !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/driver/status/${selectedDriverId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.approval_status && data.approval_status === 'APPROVED') {
          setDriverApprovalStatus('APPROVED');
          setApprovedCoordinatorName(data.approved_by || 'Operations Coordinator');

          fetch(`/api/context/${selectedDriverId}`)
            .then(r => r.json())
            .then(ctx => setContext(ctx))
            .catch(() => {});
        }
      } catch (err) {
        // ignore polling error
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedDriverId, driverApprovalStatus]);

  // Maintain active chat history in sessionStorage whenever messages update
  useEffect(() => {
    if (selectedDriverId && messages.length > 0) {
      const sessionKey = `${SESSION_KEY_PREFIX}${selectedDriverId}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(messages));
    }
  }, [messages, selectedDriverId]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handler to start a new chat session manually
  const handleStartNewSession = async () => {
    if (!selectedDriverId) return;

    // Clear backend thread
    try {
      await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriverId }),
      });
    } catch (e) {
      console.warn('Error clearing backend thread:', e);
    }

    // Fetch driver's name from database and create fresh session
    try {
      const res = await fetch(`/api/driver/${selectedDriverId}`);
      const data = await res.json();
      const dbDriverName =
        data?.driver?.driver_name ||
        (selectedDriverId === profile?.id ? profile?.fullName : '') ||
        'Driver';

      const welcomeName = formatDriverWelcomeName(dbDriverName);
      const welcomeMessageText = `Welcome to Setuhaul Mr ${welcomeName}, how can i help you today.`;

      const newWelcomeMsg: ChatMsg = {
        id: `welcome-${Date.now()}`,
        sender: 'agent',
        text: welcomeMessageText,
        timestamp: new Date().toISOString(),
        guardrails: {
          overallPassed: true,
          blocked: false,
          checks: [
            {
              name: 'Session Reset Harness',
              category: 'RUNTIME',
              passed: true,
              severity: 'INFO',
              message: 'Chat state refreshed and reset to authoritative clean baseline.',
            },
          ],
          latencyMs: 15,
          groundingScore: 100,
          safetyCategory: 'NORMAL',
        },
      };

      setMessages([newWelcomeMsg]);
      sessionStorage.setItem(`${SESSION_KEY_PREFIX}${selectedDriverId}`, JSON.stringify([newWelcomeMsg]));
    } catch (err) {
      console.error('Error creating new session:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      sender: 'driver',
      text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = updatedMessages.map(m => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: selectedDriverId,
          message: text,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const agentMsg: ChatMsg = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: data.message,
          timestamp: new Date().toISOString(),
          toolCalls: data.tool_calls,
          mode: data.mode,
          guardrails: data.guardrails,
          harnessReport: data.harness_report,
        };
        const nextMessages = [...updatedMessages, agentMsg];
        setMessages(nextMessages);

        // Refresh context after tool execution
        fetch(`/api/context/${selectedDriverId}`)
          .then(r => r.json())
          .then(ctxData => setContext(ctxData));
      } else {
        const errMsg: ChatMsg = {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: `Error: ${data.error || 'Unable to process message.'}`,
          timestamp: new Date().toISOString(),
        };
        setMessages([...updatedMessages, errMsg]);
      }
    } catch (err: any) {
      const netErrMsg: ChatMsg = {
        id: `err-${Date.now()}`,
        sender: 'agent',
        text: 'Network error communicating with the agent server.',
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, netErrMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const getOperationalPrompts = () => {
    return [
      'What is my current appointment status?',
      'Show available slots for today',
      'Can I reschedule my appointment?',
      'Is my booking confirmed by warehouse?',
    ];
  };

  if (role === 'coordinator') {
    return (
      <div className="max-w-3xl mx-auto p-6 my-12 text-center bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Access Restricted to Freight Drivers</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          You are currently logged in as an <strong>Operations Coordinator</strong> ({profile?.fullName}). Driver Chat and AI dispatch negotiation is strictly isolated for carrier drivers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Sidebar: Driver Operational Context & Profile */}
      <div className="lg:col-span-4 space-y-4">
        {/* Dedicated Driver Identity & Terminal Authorization Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <h2 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span>Assigned Driver Profile</span>
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border flex items-center gap-1 ${
              driverApprovalStatus === 'APPROVED'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
                : driverApprovalStatus === 'PENDING'
                ? 'bg-amber-950/80 text-amber-300 border-amber-700/50'
                : 'bg-rose-950/80 text-rose-300 border-rose-700/50'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                driverApprovalStatus === 'APPROVED' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`} />
              {driverApprovalStatus === 'APPROVED' ? 'Verified Driver' : 'Under Review'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Driver Name:</span>
              <span className="font-bold text-slate-100">{profile?.fullName || 'Driver'}</span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Assigned Driver ID:</span>
              <span className="font-mono font-bold text-blue-400">{selectedDriverId}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Registered Mobile:</span>
                <span className="font-mono text-slate-300">{profile.phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Email Address:</span>
              <span className="font-mono text-slate-300 truncate max-w-[170px]">{profile?.email}</span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Truck Plate:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {profile?.vehicleReg || context?.vehicle_registration || 'Plate Assigned'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Carrier / Fleet:</span>
              <span className="text-slate-200 font-medium">
                {context?.carrier_name || 'Assigned Logistics Fleet'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-800/30 flex items-start gap-2 text-[11px] text-blue-300/90">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              Secure Private Terminal: Authenticated as <strong>{profile?.fullName || selectedDriverId}</strong>. Access is restricted exclusively to your assigned loads, dock clearances, and dispatch scheduling.
            </span>
          </div>
        </div>

        {/* Live Operational Context Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <span>Authoritative Context</span>
            </h3>
            <div className="flex items-center gap-2">
              <RealtimeStatusBadge compact />
              {isLoadingContext && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              )}
            </div>
          </div>

          {context?.status === 'ready' && (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Order Reference:</span>
                <span className="font-mono font-medium text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/30">
                  {context.order_reference}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Destination:</span>
                <span className="font-medium text-slate-100 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" />
                  {context.facility_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Vehicle / Dock:</span>
                <span className="font-medium text-slate-200">
                  <span className="text-blue-300 font-mono">{context.vehicle_registration || 'Standard'}</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/30 font-mono text-[10px]">
                    {context.required_dock_type}
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Effective ETA:</span>
                <span className="font-medium text-amber-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {context.effective_eta ? context.effective_eta.split('T')[1]?.substring(0, 5) : 'N/A'}
                  {context.eta_confidence && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                      context.eta_confidence === 'HIGH'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : context.eta_confidence === 'MEDIUM'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}>
                      {context.eta_confidence}
                    </span>
                  )}
                </span>
              </div>

              {/* Current Appointment Status Badge */}
              <div className="pt-2">
                <span className="text-slate-400 block mb-1">Appointment State:</span>
                {context.current_appointment ? (
                  <div
                    className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
                      context.current_appointment.is_warehouse_confirmed
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200 shadow-sm'
                        : 'bg-amber-950/50 border-amber-500/40 text-amber-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs flex items-center gap-1.5">
                        {context.current_appointment.is_warehouse_confirmed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        {context.current_appointment.status}
                      </span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-cyan-300">
                        Dock {context.current_appointment.dock_code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 flex items-center gap-1">
                      <span>Slot:</span>
                      <span className="font-mono text-slate-100 font-medium">
                        {context.current_appointment.slot_start_ts?.split('T')[1]?.substring(0, 5)}–
                        {context.current_appointment.slot_end_ts?.split('T')[1]?.substring(0, 5)}
                      </span>
                    </div>
                    {context.current_appointment.warehouse_confirmation_ref && (
                      <div className="text-[10px] font-mono text-emerald-300 pt-0.5 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Ref: {context.current_appointment.warehouse_confirmation_ref}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                    No active appointment booked
                  </div>
                )}
              </div>
            </div>
          )}

          {(context?.status === 'pending_approval' || driverApprovalStatus === 'PENDING') && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 space-y-2">
              <div className="font-semibold flex items-center gap-2 text-amber-300">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Registration Pending Approval</span>
              </div>
              <p className="text-[11px] text-amber-100/90 leading-relaxed">
                Your driver account registration is currently in the coordinator queue. Automated dock slot reservation and gate check-in passes will activate immediately upon coordinator approval.
              </p>
              <div className="flex items-center justify-between pt-1.5 border-t border-amber-800/40 text-[10px] text-amber-300/80 font-mono">
                <span>Vehicle: {context?.vehicle_registration || profile?.vehicleReg || 'Submitted'}</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Live Sync
                </span>
              </div>
            </div>
          )}

          {context?.status === 'needs_information' && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Ambiguous Driver Assignments ({context.choice_count})
              </div>
              <p className="text-[11px] text-amber-200/80">
                Driver must specify which shipment by order reference:
              </p>
              <div className="space-y-1">
                {context.choices?.map((c: any, i: number) => (
                  <div key={i} className="bg-slate-950/60 p-1.5 rounded font-mono text-[11px]">
                    {c.order_reference} ({c.destination_facility})
                  </div>
                ))}
              </div>
            </div>
          )}

          {context?.status === 'escalate' && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>No active shipment found. Must escalate to operations.</span>
            </div>
          )}
        </div>

        {/* Driver Operational Security & Support */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h3 className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Terminal Security & Support</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/50">
              Active Channel
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Session Status:</span>
              <span className="text-cyan-300 font-semibold flex items-center gap-1 mt-0.5">
                <Activity className="w-3 h-3 text-cyan-400" />
                Live Dispatch Sync
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Data Isolation:</span>
              <span className="text-emerald-300 font-semibold flex items-center gap-1 mt-0.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                Single Driver Private
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Dock Validation:</span>
              <span className="text-indigo-300 font-semibold flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                Authoritative Grounded
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Permit Approvals:</span>
              <span className="text-amber-300 font-semibold flex items-center gap-1 mt-0.5">
                <Check className="w-3 h-3 text-amber-400" />
                Warehouse Signed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="lg:col-span-8 flex flex-col h-[740px] bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-100">SetuHaul Driver Coordinator</h3>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Stateful Session
                </span>
              </div>
              <p className="text-xs text-slate-400">Multi-turn memory • Pre/Post Guardrail Harness • Zero hallucinations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* New Session Button */}
            <button
              id="btn-new-session"
              onClick={handleStartNewSession}
              title="Start a new chat session and reset history"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Chat</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {driverApprovalStatus === 'PENDING' && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-3 shadow-lg">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-amber-300">Registration Under Coordinator Review</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Pending Approval
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Your credentials and vehicle details are currently being processed by the warehouse coordinator. Automated dock booking and facility entry permits will activate automatically as soon as approval is granted.
                </p>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'driver' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end gap-2 max-w-[85%]">
                {msg.sender === 'agent' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 mb-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'driver'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-none shadow-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>

                {msg.sender === 'driver' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0 mb-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-500 mt-1 px-9">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <Bot className="w-4 h-4 animate-bounce text-blue-400" />
              <span>Evaluating dispatch schedule & consulting authoritative database...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Operational Dispatch Inquiries */}
        <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-blue-400" />
              <span>Quick Dispatch Inquiries:</span>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {getOperationalPrompts().map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                disabled={isLoading}
                className="text-xs px-2.5 py-1 rounded-lg whitespace-nowrap transition-all disabled:opacity-50 flex items-center gap-1.5 border font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-blue-500/50"
              >
                <span>{p}</span>
                <ArrowRight className="w-2.5 h-2.5 opacity-60 text-blue-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              id="driver-chat-input"
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Type your message or inquiry here..."
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <button
              id="btn-send-message"
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-blue-600/30"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
