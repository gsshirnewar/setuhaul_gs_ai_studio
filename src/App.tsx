import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { DriverChat } from './components/DriverChat';
import { CoordinatorDashboard } from './components/CoordinatorDashboard';
import { LoginScreen } from './components/LoginScreen';
import { Truck, ShieldCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, profile, role, loading } = useAuth();
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetData = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        setResetMessage('Data store reset to initial seed state.');
        setTimeout(() => {
          setResetMessage(null);
          // Reload page to refresh all active queries and threads
          window.location.reload();
        }, 800);
      }
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // 1. Initial Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-100 to-indigo-50 flex flex-col items-center justify-center text-slate-600">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-xl shadow-blue-500/25 border border-blue-300/40 flex items-center justify-center text-white mb-4 animate-pulse">
          <Truck className="w-7 h-7" />
        </div>
        <p className="text-sm font-bold text-slate-800 tracking-tight">Initializing SetuHaul Platform...</p>
        <p className="text-xs text-slate-500 mt-1 font-medium">Connecting deterministic dispatch services</p>
      </div>
    );
  }

  // 2. Dedicated Isolated Login Screen when NOT authenticated
  if (!user && !profile) {
    return <LoginScreen />;
  }

  // 3. Authenticated App Workspace with Strict Portal Isolation
  // - Driver role: strictly Driver Chat (no Coordinator Dashboard)
  // - Coordinator role: strictly Coordinator Dashboard (no Driver Chat)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white animate-fade-in relative overflow-x-hidden">
      {/* Ambient illuminated background accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[350px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Global Header */}
      <Header
        onReset={handleResetData}
        isResetting={isResetting}
      />

      {/* Reset Notification Toast */}
      {resetMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-2xl border border-blue-400/30 text-xs font-medium animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* Main Screen Content strictly isolated per role */}
      <main className="flex-1 pb-10">
        {role === 'coordinator' ? (
          <CoordinatorDashboard />
        ) : (
          <DriverChat />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
