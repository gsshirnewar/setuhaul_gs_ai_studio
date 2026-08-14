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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 animate-pulse">
          <Truck className="w-6 h-6" />
        </div>
        <p className="text-xs font-medium text-slate-300">Initializing SetuHaul Platform...</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white animate-fade-in">
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
