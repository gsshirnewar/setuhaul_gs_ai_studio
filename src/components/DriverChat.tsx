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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DriverItem {
  driver_id: string;
  driver_name: string;
  phone: string;
  scenario: string;
  active_shipments_count: number;
}

interface ChatMsg {
  id: string;
  sender: 'driver' | 'agent';
  text: string;
  timestamp: string;
  toolCalls?: any[];
  mode?: 'gemini' | 'mock';
}

const SESSION_KEY_PREFIX = 'setuhaul_chat_session_';

function formatDriverWelcomeName(rawName?: string): string {
  if (!rawName) return 'Driver';
  // Remove parentheses like "(NorthStar Roadways)"
  let clean = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  // Remove existing "Mr." or "Mr " if present to avoid duplication
  clean = clean.replace(/^Mr\.?\s*/i, '').trim();
  return clean || 'Driver';
}

export const DriverChat: React.FC = () => {
  const { profile, role } = useAuth();
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  
  // Set default driver based on authenticated profile
  const initialDriverId =
    role === 'driver' && profile?.id
      ? profile.id.startsWith('DRV')
        ? profile.id
        : 'DRV001'
      : 'DRV006';

  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDriverId);
  const [context, setContext] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync selected driver if profile changes
  useEffect(() => {
    if (role === 'driver' && profile?.id) {
      const driverId = profile.id.startsWith('DRV') ? profile.id : 'DRV001';
      setSelectedDriverId(driverId);
    }
  }, [profile?.id, role]);

  // Fetch demo drivers on load
  useEffect(() => {
    fetch('/api/drivers')
      .then(res => res.json())
      .then(data => {
        if (data.drivers) setDrivers(data.drivers);
      })
      .catch(console.error);
  }, []);

  // Initialize or restore active chat session for selected driver
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

    // 2. Check active session history in sessionStorage
    const sessionKey = `${SESSION_KEY_PREFIX}${selectedDriverId}`;
    const activeSessionData = sessionStorage.getItem(sessionKey);

    if (activeSessionData) {
      try {
        const parsed = JSON.parse(activeSessionData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse active chat session:', err);
      }
    }

    // 3. If no active session exists (fresh login or post-logout), create new session:
    // Fetch the driver's name directly from the database and set the clean welcome message
    fetch(`/api/driver/${selectedDriverId}`)
      .then(res => res.json())
      .then(data => {
        const dbDriverName =
          data?.driver?.driver_name ||
          (selectedDriverId === profile?.id ? profile?.fullName : '') ||
          'Driver';

        const welcomeName = formatDriverWelcomeName(dbDriverName);
        const welcomeMessageText = `Welcome to Setuhaul Mr ${welcomeName}, how can i help you today.`;

        const initialSessionMessage: ChatMsg = {
          id: `welcome-${Date.now()}`,
          sender: 'agent',
          text: welcomeMessageText,
          timestamp: new Date().toISOString(),
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
        sessionStorage.setItem(sessionKey, JSON.stringify([initialSessionMessage]));
      });
  }, [selectedDriverId, profile]);

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

  const getQuickPrompts = () => {
    if (selectedDriverId === 'DRV006') {
      return [
        'Traffic after Shahpura. Reaching around 11:20. Any slot after 12?',
        'Please book the first available slot',
        'Is my booking confirmed by warehouse?',
      ];
    }
    if (selectedDriverId === 'DRV012') {
      return [
        'Tyre repaired. Reaching at 11:10. Need to leave before 1:30 PM.',
        'Show me available slots for today',
      ];
    }
    if (selectedDriverId === 'DRV004') {
      return [
        'I will be late by 45 minutes',
        'I am referring to ORD-260804-004',
        'Check status for ORD-260804-020',
      ];
    }
    if (selectedDriverId === 'DRV015') {
      return [
        'Evening traffic. ETA 6:30 PM. Can the reefer unload tonight?',
        'Check status of D5 reefer dock',
      ];
    }
    if (selectedDriverId === 'DRV003') {
      return [
        'I arrived early at the gate (8:20 AM). Can I unload now?',
        'What slots are open before 9 AM?',
      ];
    }
    if (selectedDriverId === 'DRV001') {
      return [
        'What is my appointment status at Jaipur DC?',
        'I am delayed by 30 minutes, ETA 11:15 AM',
        'Show available docks for standard truck',
      ];
    }
    return [
      'What is my current appointment status?',
      'I am delayed, ETA is 11:30 AM',
      'Show available slots',
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
      {/* Sidebar: Driver Operational Context & Simulator Controls */}
      <div className="lg:col-span-4 space-y-4">
        {/* Driver Profile / Simulator Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span>Active Driver Profile</span>
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded border font-mono bg-blue-950/70 border-blue-800/40 text-blue-300">
              Live Driver Session
            </span>
          </div>

          {profile && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs mb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Name:</span>
                <span className="font-semibold text-slate-100">{profile.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver ID / Email:</span>
                <span className="font-mono text-slate-300">{profile.email}</span>
              </div>
              {profile.vehicleReg && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Vehicle Reg:</span>
                  <span className="font-mono text-blue-400 font-medium">{profile.vehicleReg}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Switch Driver Channel / Test Scenario:
            </label>
            <select
              id="driver-select"
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              {drivers.map(d => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.driver_name} ({d.driver_id}) — {d.scenario}
                </option>
              ))}
            </select>

            {drivers.find(d => d.driver_id === selectedDriverId) && (
              <div className="mt-3 p-2.5 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs text-blue-300">
                <span className="font-semibold block text-blue-200 mb-0.5">Test Case Scenario:</span>
                {drivers.find(d => d.driver_id === selectedDriverId)?.scenario}
              </div>
            )}
          </div>
        </div>

        {/* Live Operational Context Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <span>Authoritative Context</span>
            </h3>
            {isLoadingContext ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Authoritative DB
              </span>
            )}
          </div>

          {context?.status === 'ready' && (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Order Reference:</span>
                <span className="font-mono font-medium text-slate-100">{context.order_reference}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Destination:</span>
                <span className="font-medium text-slate-100">{context.facility_name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Vehicle / Dock:</span>
                <span className="font-medium text-slate-200">
                  {context.vehicle_registration || 'Standard'} ({context.required_dock_type})
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Effective ETA:</span>
                <span className="font-medium text-amber-400">
                  {context.effective_eta ? context.effective_eta.split('T')[1]?.substring(0, 5) : 'N/A'}
                  {context.eta_confidence && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
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
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                        : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
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
                      <span className="font-mono text-[11px]">
                        Dock {context.current_appointment.dock_code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Slot: {context.current_appointment.slot_start_ts?.split('T')[1]?.substring(0, 5)}–
                      {context.current_appointment.slot_end_ts?.split('T')[1]?.substring(0, 5)}
                    </div>
                    {context.current_appointment.warehouse_confirmation_ref && (
                      <div className="text-[10px] font-mono text-emerald-300 pt-0.5">
                        Ref: {context.current_appointment.warehouse_confirmation_ref}
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
      </div>

      {/* Main Chat Interface */}
      <div className="lg:col-span-8 flex flex-col h-[700px] bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-100">SetuHaul Driver Coordinator</h3>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Session
                </span>
              </div>
              <p className="text-xs text-slate-400">Strict backend tool validation • Zero hallucinations</p>
            </div>
          </div>

          {/* New Session Button */}
          <button
            id="btn-new-session"
            onClick={handleStartNewSession}
            title="Start a new chat session and reset history"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>New Session</span>
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

                  {/* Tool Calls Execution Badge / Trace */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/50 space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        Authoritative Backend Calls:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300"
                            title={JSON.stringify(tc.result, null, 2)}
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                            {tc.toolName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
              <span>Verifying constraints & consulting authoritative database...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Prompts */}
        <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-500 whitespace-nowrap font-medium">Quick Prompts:</span>
          {getQuickPrompts().map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p)}
              disabled={isLoading}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <span>{p}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
            </button>
          ))}
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
              placeholder="Type message (e.g., 'Traffic delay, ETA 11:20 AM', 'Select SLOT-JAI-004')..."
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

