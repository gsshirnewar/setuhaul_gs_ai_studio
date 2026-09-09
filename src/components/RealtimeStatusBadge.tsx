import React, { useState } from 'react';
import { Wifi, WifiOff, Activity, Users, Radio, CheckCircle, Zap } from 'lucide-react';
import { useSupabaseRealtime, RealtimeEventType } from '../lib/realtimeService';
import { useAuth } from '../context/AuthContext';

interface RealtimeStatusBadgeProps {
  compact?: boolean;
}

export const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({ compact = false }) => {
  const { profile } = useAuth();
  const { status, isConnected, presenceUsers, activePeersCount, lastEvent, broadcast } = useSupabaseRealtime({
    userProfile: profile ? {
      id: profile.id,
      fullName: profile.fullName,
      role: profile.role,
      facilityId: profile.facilityId,
    } : null,
  });

  const [showPeersModal, setShowPeersModal] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  const handleTestPing = async () => {
    setIsPinging(true);
    await broadcast('SLOT_UPDATED' as RealtimeEventType, {
      type: 'ping',
      sender: profile?.fullName || 'Anonymous Operator',
      clientTimestamp: new Date().toISOString(),
    });
    setTimeout(() => setIsPinging(false), 600);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'SUBSCRIBED':
        return 'emerald';
      case 'CONNECTING':
        return 'amber';
      case 'ERROR':
      case 'DISCONNECTED':
      default:
        return 'rose';
    }
  };

  const color = getStatusColor();

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
          isConnected
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : status === 'CONNECTING'
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
        }`}
        title={`Supabase Realtime WebSocket (${status})`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isConnected
              ? 'bg-emerald-400 animate-pulse'
              : status === 'CONNECTING'
              ? 'bg-amber-400 animate-ping'
              : 'bg-rose-400'
          }`}
        />
        <Radio className="w-3 h-3" />
        <span>{isConnected ? 'Supabase Realtime' : status}</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs shadow-sm">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-400 animate-pulse'
                : status === 'CONNECTING'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-400'
            }`}
          />
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1 font-semibold text-slate-200">
              <Radio className={`w-3 h-3 text-${color}-400`} />
              <span>Realtime WebSockets</span>
              <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border bg-${color}-500/15 text-${color}-300 border-${color}-500/30`}>
                {status === 'SUBSCRIBED' ? 'LIVE' : status}
              </span>
            </div>
            {lastEvent ? (
              <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={`${lastEvent.event} received`}>
                ⚡ {lastEvent.event}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Channel: setuhaul-realtime</span>
            )}
          </div>
        </div>

        {/* Active Presence Peers Button */}
        <button
          onClick={() => setShowPeersModal(!showPeersModal)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors text-[11px]"
          title="Click to view active online operators and drivers"
        >
          <Users className="w-3 h-3 text-cyan-400" />
          <span className="font-mono font-medium">{activePeersCount > 0 ? activePeersCount : 1}</span>
          <span className="text-slate-400 text-[10px] hidden sm:inline">online</span>
        </button>

        {/* Manual Realtime Ping Broadcast */}
        <button
          onClick={handleTestPing}
          disabled={isPinging || !isConnected}
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors disabled:opacity-40"
          title="Send WebSocket test broadcast to peers"
        >
          <Zap className={`w-3 h-3 ${isPinging ? 'animate-bounce text-cyan-300' : ''}`} />
        </button>
      </div>

      {/* Online Users Popover */}
      {showPeersModal && (
        <div className="absolute right-0 mt-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 animate-fade-in text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Connected Peers ({activePeersCount > 0 ? activePeersCount : 1})
            </span>
            <button
              onClick={() => setShowPeersModal(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-1"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {presenceUsers.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-1">
                You are currently the active local operator.
              </div>
            ) : (
              presenceUsers.map(user => (
                <div
                  key={user.id + user.onlineAt}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-slate-800/60 border border-slate-800"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-slate-200 font-medium truncate">{user.name}</span>
                  </div>
                  <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                    user.role === 'coordinator'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-blue-500/15 text-blue-300'
                  }`}>
                    {user.role}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Protocol: wss:// Supabase v1</span>
            <span className="text-emerald-400 font-mono">2-way synced</span>
          </div>
        </div>
      )}
    </div>
  );
};
