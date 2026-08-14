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
  Eye,
  EyeOff,
  Sparkles,
  Users,
  Copy,
  Check,
  Shield,
  Key,
  Database,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Clock,
  MapPin,
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';
import { getSupabaseConfig } from '../lib/supabaseClient';
import { INITIAL_DRIVERS, INITIAL_VEHICLES, INITIAL_COORDINATORS, INITIAL_FACILITIES } from '../db/seedData';

export const LoginScreen: React.FC = () => {
  const { signIn, signUp, signInDemo, isConfigured, saveSupabaseKeys } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>('driver');

  // Credentials
  const [email, setEmail] = useState('driver01@gmail.com');
  const [password, setPassword] = useState('Password#Drv01');
  const [showPassword, setShowPassword] = useState(false);

  // Profile fields for registration
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleReg, setVehicleReg] = useState('RJ14GT4101');
  const [facilityId, setFacilityId] = useState('FAC-JAI-01');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDriverDirectory, setShowDriverDirectory] = useState(false);
  const [showCoordDirectory, setShowCoordDirectory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Direct Supabase config toggle
  const [customUrl, setCustomUrl] = useState('');
  const [customAnonKey, setCustomAnonKey] = useState('');
  const [showConfigInput, setShowConfigInput] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfig();
    if (config.url) setCustomUrl(config.url);
    if (config.anonKey) setCustomAnonKey(config.anonKey);
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (newRole === 'driver') {
      setEmail('driver01@gmail.com');
      setPassword('Password#Drv01');
    } else {
      setEmail('vikram.joshi@setuhaul.com');
      setPassword('Password#Coord01');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          setSuccessMsg('Authentication successful! Launching portal...');
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
          setSuccessMsg('Account registered with instant access!');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDriver = (d: typeof INITIAL_DRIVERS[0]) => {
    const veh = INITIAL_VEHICLES.find(v => v.carrier_id === d.carrier_id) || INITIAL_VEHICLES[0];
    setRole('driver');
    setEmail(d.email || `driver${d.driver_id.replace('DRV', '')}@gmail.com`);
    setPassword(d.password || `Password#Drv${d.driver_id.replace('DRV', '')}`);
    setFullName(d.driver_name);
    setPhone(d.phone);
    setVehicleReg(veh.registration_number);
    setErrorMsg(null);
    setSuccessMsg(`Loaded credentials for ${d.driver_name} (${d.driver_id})`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSelectCoordinator = (c: typeof INITIAL_COORDINATORS[0]) => {
    setRole('coordinator');
    setEmail(c.email);
    setPassword(c.password || 'Password#Coord01');
    setFullName(c.name);
    setPhone(c.phone);
    setFacilityId(c.facility_id);
    setErrorMsg(null);
    setSuccessMsg(`Loaded credentials for ${c.name} (${c.role_title})`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const currentConfig = getSupabaseConfig();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] blur-[120px] pointer-events-none rounded-full transition-colors ${role === 'driver' ? 'bg-blue-600/10' : 'bg-emerald-600/10'}`} />
      <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-cyan-600/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white shadow-xl mb-4 border transition-all ${
          role === 'driver'
            ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-blue-600/30 border-blue-400/20'
            : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-600/30 border-emerald-400/20'
        }`}>
          {role === 'driver' ? <Truck className="w-7 h-7" /> : <Building2 className="w-7 h-7" />}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          <span>SetuHaul</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            role === 'driver'
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          }`}>
            {role === 'driver' ? 'Driver Portal' : 'Coordinator Portal'}
          </span>
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          Deterministic Freight Operations & Automated Dock Scheduling
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Isolated Portal Selector (Driver vs. Coordinator) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select Isolated Portal Target
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Role Isolation Active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                id="login-role-driver"
                onClick={() => handleRoleChange('driver')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  role === 'driver'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Driver Login</span>
              </button>
              <button
                type="button"
                id="login-role-coordinator"
                onClick={() => handleRoleChange('coordinator')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  role === 'coordinator'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Coordinator Login</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${role === 'driver' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
              <span>
                {role === 'driver'
                  ? 'Strict Isolation: Driver Portal ONLY (AI Dispatch chat & appointments).'
                  : 'Strict Isolation: Coordinator Console ONLY (Dock management & approvals).'}
              </span>
            </p>
          </div>

          {/* Portal Highlight Card */}
          <div className={`p-3.5 rounded-xl border text-xs transition-colors ${
            role === 'driver'
              ? 'bg-blue-950/40 border-blue-500/30 text-blue-200'
              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="font-semibold flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                {role === 'driver' ? <Truck className="w-4 h-4 text-blue-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                {role === 'driver' ? 'Driver Dispatch Entry Point' : 'Operations Coordinator Entry Point'}
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10">
                {role === 'driver' ? 'Fleet Access' : 'Facility Access'}
              </span>
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              {role === 'driver'
                ? 'Authorized access for carrier drivers to negotiate slot reschedules with the AI dispatch agent and view assigned dock permits.'
                : 'Authorized access for facility yard supervisors to review incoming reschedule requests, issue sign-off tokens, and inspect dock queue.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              id="login-tab-signin"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all flex-1 text-center ${
                mode === 'signin'
                  ? role === 'driver' ? 'border-blue-500 text-blue-400' : 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In Existing
            </button>
            <button
              type="button"
              id="login-tab-signup"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all flex-1 text-center ${
                mode === 'signup'
                  ? role === 'driver' ? 'border-blue-500 text-blue-400' : 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Register New Profile
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder={role === 'driver' ? 'Rajesh Kumar' : 'Vikram Joshi'}
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {role === 'driver' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Truck Reg No.</label>
                      <input
                        type="text"
                        required
                        placeholder="RJ14GT4101"
                        value={vehicleReg}
                        onChange={e => setVehicleReg(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Hub Facility</label>
                    <select
                      value={facilityId}
                      onChange={e => setFacilityId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      {INITIAL_FACILITIES.map(f => (
                        <option key={f.facility_id} value={f.facility_id}>
                          {f.facility_name} ({f.city})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email / Coordinator Login</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  id="input-login-email"
                  required
                  placeholder={role === 'driver' ? 'driver01@gmail.com' : 'vikram.joshi@setuhaul.com'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono ${
                    role === 'driver' ? 'focus:border-blue-500' : 'focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                {mode === 'signin' && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {role === 'driver' ? 'e.g. Password#Drv01' : 'e.g. Password#Coord01'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="input-login-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono ${
                    role === 'driver' ? 'focus:border-blue-500' : 'focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-login-submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-2 ${
                role === 'driver'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {isLoading ? (
                <span className="animate-pulse">Authenticating...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? `Sign In to ${role === 'driver' ? 'Driver Portal' : 'Coordinator Dashboard'}`
                      : 'Register & Launch Workspace'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Directory helper based on selected portal */}
          {role === 'driver' ? (
            /* Quick Pre-Configured Drivers Directory Accordion */
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <button
                type="button"
                id="btn-toggle-driver-directory"
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
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Click <strong>Auto-Fill</strong> on any driver below to populate the login fields:
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
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            {d.email} • {d.password}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${d.email} | ${d.password}`, d.driver_id)}
                            title="Copy credentials"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {copiedId === d.driver_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectDriver(d)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition-colors"
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
            /* Quick Pre-Configured Coordinators Directory Accordion */
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <button
                type="button"
                id="btn-toggle-coord-directory"
                onClick={() => setShowCoordDirectory(!showCoordDirectory)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Operations Coordinators Directory (4 Staff)</span>
                </div>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  {showCoordDirectory ? 'Hide' : 'View & Auto-Fill'}
                  {showCoordDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {showCoordDirectory && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Click <strong>Auto-Fill</strong> on any facility coordinator to sign into their operations console:
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
                            <span className="text-[10px] text-slate-400">({c.shift_hours})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            {c.email} • {c.password}
                          </div>
                          <div className="text-[10px] text-cyan-400 truncate">{c.role_title}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${c.email} | ${c.password}`, c.coordinator_id)}
                            title="Copy credentials"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {copiedId === c.coordinator_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectCoordinator(c)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition-colors"
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

          {/* Instant 1-Click Sandbox Test Access */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium block mb-2">
              Instant 1-Click Sandbox Access:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-sandbox-driver"
                onClick={() => signInDemo('driver')}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 text-left transition-colors flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-200 truncate">Demo Driver</div>
                  <div className="text-[10px] text-slate-400">Rajesh K. (RJ14GT4101)</div>
                </div>
              </button>

              <button
                type="button"
                id="btn-sandbox-coordinator"
                onClick={() => signInDemo('coordinator')}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 text-left transition-colors flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-200 truncate">Demo Coordinator</div>
                  <div className="text-[10px] text-slate-400">Vikram J. (Jaipur Hub)</div>
                </div>
              </button>
            </div>
          </div>

          {/* Supabase Connection Details / Custom Key Switcher */}
          <div className="pt-2 border-t border-slate-800 text-xs">
            {currentConfig.isConfigured ? (
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-medium text-[11px] truncate max-w-[240px]">
                    Supabase Connected ({currentConfig.url.replace(/^https?:\/\//, '')})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigInput(!showConfigInput)}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  {showConfigInput ? 'Hide' : 'Configure'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Database className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Supabase Ready (Enter keys or use sandbox)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigInput(!showConfigInput)}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  {showConfigInput ? 'Hide' : 'Add Keys'}
                </button>
              </div>
            )}

            {showConfigInput && (
              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 animate-fade-in">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Update Supabase Project Keys</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Project URL</label>
                    <input
                      type="text"
                      placeholder="https://xyzproject.supabase.co"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Anon Public Key</label>
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
                    Save & Reconnect Supabase Client
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

