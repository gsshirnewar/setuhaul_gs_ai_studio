import React, { useState } from 'react';
import {
  Truck,
  LayoutDashboard,
  MessageSquare,
  RotateCcw,
  User,
  LogOut,
  LogIn,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { RealtimeStatusBadge } from './RealtimeStatusBadge';

interface HeaderProps {
  onReset: () => void;
  isResetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  isResetting,
}) => {
  const { profile, role, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const isDriver = role === 'driver';
  const isCoordinator = role === 'coordinator';

  return (
    <>
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand & Portal Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-white font-bold ${
                isCoordinator
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20'
                  : 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-blue-500/20'
              }`}>
                {isCoordinator ? <Building2 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-lg tracking-tight text-white">SetuHaul</h1>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                    isCoordinator
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  }`}>
                    {isCoordinator ? 'Operations Coordinator Portal' : 'Driver Dispatch Portal'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {isCoordinator
                    ? 'Yard Logistics, Gate Queue & Dock Approvals'
                    : 'AI Dispatch Agent, Slot Negotiation & Fleet Routing'}
                </p>
              </div>
            </div>

            {/* Mobile Auth Button */}
            <div className="md:hidden">
              {profile ? (
                <button
                  id="btn-header-mobile-exit"
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-rose-300"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Portal Badge, Realtime Status, User Profile & Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0">
            {/* Supabase Realtime WebSocket Status */}
            <div className="hidden sm:block">
              <RealtimeStatusBadge />
            </div>

            {/* Isolated Portal Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isCoordinator ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <span className="text-slate-400 font-medium">Isolated View:</span>
              <span className={`font-semibold ${isCoordinator ? 'text-emerald-300' : 'text-blue-300'}`}>
                {isCoordinator ? 'Facility Management Console' : 'Driver Chat Console'}
              </span>
            </div>

            {/* User Account / Profile Card */}
            <div className="flex items-center gap-2">
              {profile ? (
                <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isCoordinator
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {isCoordinator ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <Truck className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="text-left pr-1">
                      <div className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                        {profile.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="capitalize font-mono">{profile.role}</span>
                        {profile.vehicleReg && <span className="text-blue-400 font-mono">• {profile.vehicleReg}</span>}
                        {profile.facilityId && <span className="text-emerald-400 font-mono">• {profile.facilityId}</span>}
                      </div>
                    </div>
                  </div>

                  {isCoordinator && (
                    <button
                      id="btn-switch-account"
                      onClick={() => setIsAuthModalOpen(true)}
                      title="Switch Portal / Profile"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span className="hidden xl:inline text-xs">Switch</span>
                    </button>
                  )}

                  <button
                    id="btn-header-signout"
                    onClick={() => signOut()}
                    title="Sign out to Portal Selector"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline text-xs">Exit</span>
                  </button>
                </div>
              ) : (
                <button
                  id="btn-header-signin"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            <button
              id="btn-reset-db"
              onClick={onReset}
              disabled={isResetting}
              title="Reset database to seed state"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden lg:inline">Reset Seed</span>
            </button>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialRole={role || 'driver'}
      />
    </>
  );
};
