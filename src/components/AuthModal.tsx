import React, { useState, useEffect } from 'react';
import {
  Truck,
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Database,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';
import { getSupabaseConfig } from '../lib/supabaseClient';
import { INITIAL_DRIVERS, INITIAL_VEHICLES, INITIAL_COORDINATORS } from '../db/seedData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialRole = 'driver',
}) => {
  const { signIn, signUp, signInDemo, isConfigured, saveSupabaseKeys } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>(initialRole);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleReg, setVehicleReg] = useState('MH-12-AB-1234');
  const [facilityId, setFacilityId] = useState('FAC001');

  // Direct Supabase config toggle
  const [customUrl, setCustomUrl] = useState('');
  const [customAnonKey, setCustomAnonKey] = useState('');
  const [showConfigInput, setShowConfigInput] = useState(false);
  const [showDriverDirectory, setShowDriverDirectory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfig();
    if (config.url) setCustomUrl(config.url);
    if (config.anonKey) setCustomAnonKey(config.anonKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          setSuccessMsg('Successfully signed in with Supabase!');
          setTimeout(() => {
            onClose();
          }, 600);
        }
      } else {
        const res = await signUp(email, password, {
          role,
          fullName: fullName || (role === 'driver' ? 'Freight Driver' : 'Facility Coordinator'),
          phone,
          vehicleReg: role === 'driver' ? vehicleReg : undefined,
          facilityId: role === 'coordinator' ? facilityId : undefined,
        });

        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          setSuccessMsg('Account created & active with instant access (no email verification needed)!');
          setTimeout(() => {
            onClose();
          }, 600);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customAnonKey.trim()) {
      setErrorMsg('Please enter both Supabase URL and Anon Key');
      return;
    }
    saveSupabaseKeys(customUrl, customAnonKey);
    setSuccessMsg('Supabase credentials linked successfully!');
    setShowConfigInput(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDemoLogin = (selectedRole: UserRole) => {
    signInDemo(selectedRole);
    setSuccessMsg(`Signed in as Demo ${selectedRole === 'driver' ? 'Driver' : 'Coordinator'}`);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleSelectDriver = (d: typeof INITIAL_DRIVERS[0]) => {
    const veh = INITIAL_VEHICLES.find(v => v.carrier_id === d.carrier_id) || INITIAL_VEHICLES[0];
    setRole('driver');
    setEmail(d.email || `driver${d.driver_id.replace('DRV', '')}@gmail.com`);
    setPassword(d.password || `Password#Drv${d.driver_id.replace('DRV', '')}`);
    setFullName(d.driver_name);
    setPhone(d.phone);
    setVehicleReg(veh.registration_number);
    setSuccessMsg(`Selected driver ${d.driver_name} (${d.driver_id})`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentConfig = getSupabaseConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              {role === 'driver' ? <Truck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                {mode === 'signin' ? 'Sign In' : 'Create Account'} • {role === 'driver' ? 'Driver' : 'Coordinator'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Supabase Auth</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] text-emerald-400 font-medium">Instant Access Enabled</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Role Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              id="auth-role-driver"
              onClick={() => {
                setRole('driver');
                setEmail('driver01@gmail.com');
                setPassword('Password#Drv01');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                role === 'driver'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Driver Portal</span>
            </button>
            <button
              type="button"
              id="auth-role-coordinator"
              onClick={() => {
                setRole('coordinator');
                setEmail('vikram.joshi@setuhaul.com');
                setPassword('Password#Coord01');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                role === 'coordinator'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Coordinator Portal</span>
            </button>
          </div>

          <div className={`p-2.5 rounded-xl border text-xs ${
            role === 'driver'
              ? 'bg-blue-950/30 border-blue-800/40 text-blue-200'
              : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
          }`}>
            <p className="text-[11px]">
              {role === 'driver'
                ? '🚚 Driver Portal Isolation: Grants access to Driver AI Dispatch Chat and appointments.'
                : '🛡️ Coordinator Portal Isolation: Grants access to Yard Operations and Dock Scheduling.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              id="auth-mode-signin"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                mode === 'signin'
                  ? role === 'driver' ? 'border-blue-500 text-blue-400' : 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In Existing
            </button>
            <button
              type="button"
              id="auth-mode-signup"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                mode === 'signup'
                  ? role === 'driver' ? 'border-blue-500 text-blue-400' : 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Register New Profile
            </button>
          </div>

          {/* Directory helper based on selected portal */}
          {role === 'driver' ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              <button
                type="button"
                onClick={() => setShowDriverDirectory(!showDriverDirectory)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Pre-Configured Drivers Directory (15 Drivers)</span>
                </div>
                <span className="text-[11px] text-blue-400 flex items-center gap-1">
                  {showDriverDirectory ? 'Hide' : 'View & Auto-Fill'}
                  {showDriverDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {showDriverDirectory && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Click any driver below to auto-fill their credentials into the form:
                  </p>
                  <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/60">
                    {INITIAL_DRIVERS.map(d => (
                      <div
                        key={d.driver_id}
                        className="p-2 flex items-center justify-between hover:bg-slate-800/60 transition-colors text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{d.driver_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-900/50 text-blue-300 rounded font-mono">
                              {d.driver_id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {d.email} • {d.password}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${d.email} | ${d.password}`, d.driver_id)}
                            title="Copy login details"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {copiedId === d.driver_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectDriver(d)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium"
                          >
                            Auto-Fill
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              <button
                type="button"
                onClick={() => setShowDriverDirectory(!showDriverDirectory)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Operations Coordinators Directory (4 Staff)</span>
                </div>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  {showDriverDirectory ? 'Hide' : 'View & Auto-Fill'}
                  {showDriverDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {showDriverDirectory && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Click any coordinator below to auto-fill their credentials:
                  </p>
                  <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/60">
                    {INITIAL_COORDINATORS.map(c => (
                      <div
                        key={c.coordinator_id}
                        className="p-2 flex items-center justify-between hover:bg-slate-800/60 transition-colors text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-900/50 text-emerald-300 rounded font-mono">
                              {c.facility_id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {c.email} • {c.password}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${c.email} | ${c.password}`, c.coordinator_id)}
                            title="Copy login details"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {copiedId === c.coordinator_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEmail(c.email);
                              setPassword(c.password || 'Password#Coord01');
                              setFullName(c.name);
                              setPhone(c.phone);
                              setFacilityId(c.facility_id);
                              setSuccessMsg(`Selected coordinator ${c.name}`);
                              setTimeout(() => setSuccessMsg(null), 2500);
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium"
                          >
                            Auto-Fill
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Supabase Connected Banner */}
          {currentConfig.isConfigured ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-medium truncate max-w-[260px]">
                  Connected: {currentConfig.url.replace(/^https?:\/\//, '')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigInput(!showConfigInput)}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Key className="w-3 h-3" />
                <span>Change</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl text-xs text-blue-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-blue-200">
                  <Database className="w-4 h-4 text-blue-400" />
                  <span>Supabase Ready for Linking</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigInput(!showConfigInput)}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  {showConfigInput ? 'Hide' : 'Enter Keys Directly'}
                </button>
              </div>
              <p className="text-[11px] text-slate-300/80 leading-relaxed">
                Authentication works seamlessly with your configured Supabase project. You can also sign in using the 1-click sandbox accounts below.
              </p>
            </div>
          )}

          {/* Optional Direct Key Input Form */}
          {showConfigInput && (
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3 animate-fade-in">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-blue-400" />
                <span>Configure Supabase Project Keys</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Supabase Project URL</label>
                  <input
                    type="text"
                    placeholder="https://xyzproject.supabase.co"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Supabase Anon Key</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={customAnonKey}
                    onChange={e => setCustomAnonKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveKeys}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Save & Apply Supabase Client
                </button>
              </div>
            </div>
          )}

          {/* Alert Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder={role === 'driver' ? 'Rajesh Kumar' : 'Operations Coordinator'}
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {role === 'driver' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Truck Reg No.</label>
                      <input
                        type="text"
                        required
                        placeholder="MH-12-AB-1234"
                        value={vehicleReg}
                        onChange={e => setVehicleReg(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Assigned Facility</label>
                    <select
                      value={facilityId}
                      onChange={e => setFacilityId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="FAC001">Bhiwandi Hub (FAC001)</option>
                      <option value="FAC002">Bangalore DC (FAC002)</option>
                      <option value="FAC003">Gurugram Logistics Park (FAC003)</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder={role === 'driver' ? 'driver01@gmail.com' : 'coordinator@setuhaul.com'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Password#Drv01"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-auth-submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <span className="animate-pulse">Processing...</span>
              ) : mode === 'signin' ? (
                <span>Sign In to {role === 'driver' ? 'Driver Portal' : 'Coordinator Dashboard'}</span>
              ) : (
                <span>Register & Enter Instantly</span>
              )}
            </button>
          </form>

          {/* Quick Demo Access Options */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium block mb-2">
              Instant 1-Click Sandbox Login:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-quick-driver"
                onClick={() => handleDemoLogin('driver')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left transition-colors flex items-center gap-2"
              >
                <Truck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-200 truncate">Demo Driver</div>
                  <div className="text-[10px] text-slate-400">Truck MH-12</div>
                </div>
              </button>

              <button
                type="button"
                id="btn-quick-coordinator"
                onClick={() => handleDemoLogin('coordinator')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left transition-colors flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-200 truncate">Demo Coordinator</div>
                  <div className="text-[10px] text-slate-400">Bhiwandi Hub</div>
                </div>
              </button>
            </div>
          </div>

          {/* Step-by-Step Setup Guide Accordion */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="flex items-center justify-between w-full text-left text-xs text-blue-400 hover:text-blue-300 font-medium py-1"
            >
              <span>How to disable email verification in Supabase?</span>
              {showSetupGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSetupGuide && (
              <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-100">Step-by-Step Supabase Configuration:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                  <li>Go to your Supabase Project Dashboard (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a>).</li>
                  <li>Click on <strong>Authentication</strong> in the left sidebar, then select <strong>Providers</strong>.</li>
                  <li>Click on the <strong>Email</strong> provider to open its settings.</li>
                  <li>Toggle <strong>Confirm email</strong> to <span className="text-amber-400 font-semibold">OFF</span> (Disabled).</li>
                  <li>Click <strong>Save</strong>.</li>
                  <li>Copy your <strong>Project URL</strong> and <strong>anon/public API key</strong> from <em>Project Settings → API</em> into your environment variables (<code className="text-cyan-300">VITE_SUPABASE_URL</code>, <code className="text-cyan-300">VITE_SUPABASE_ANON_KEY</code>).</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
