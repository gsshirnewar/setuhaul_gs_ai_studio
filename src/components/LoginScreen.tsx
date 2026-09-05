import React, { useState, useEffect, useRef } from 'react';
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
  CornerDownLeft,
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';
import { getSupabaseConfig } from '../lib/supabaseClient';
import { INITIAL_DRIVERS, INITIAL_VEHICLES, INITIAL_COORDINATORS, INITIAL_FACILITIES } from '../db/seedData';
import {
  validatePhoneNumber,
  validateTruckRegistration,
  validateEmail,
  validateFullName,
} from '../utils/sanitaryValidation';

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
  const [vehicleReg, setVehicleReg] = useState('');
  const [facilityId, setFacilityId] = useState('FAC-JAI-01');

  // Sanitary validation states
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneValid, setPhoneValid] = useState(false);

  const [vehicleRegError, setVehicleRegError] = useState<string | null>(null);
  const [vehicleRegValid, setVehicleRegValid] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailValid, setEmailValid] = useState(false);

  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [fullNameValid, setFullNameValid] = useState(false);

  // Field input refs for sequential Enter key navigation
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const vehicleRegRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDriverDirectory, setShowDriverDirectory] = useState(false);
  const [showCoordDirectory, setShowCoordDirectory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveDrivers, setLiveDrivers] = useState<any[]>(INITIAL_DRIVERS);

  const fetchDrivers = () => {
    fetch('/api/drivers?includePending=true')
      .then(res => res.json())
      .then(data => {
        if (data.drivers && Array.isArray(data.drivers) && data.drivers.length > 0) {
          setLiveDrivers(data.drivers);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Direct Supabase config toggle
  const [customUrl, setCustomUrl] = useState('');
  const [customAnonKey, setCustomAnonKey] = useState('');
  const [showConfigInput, setShowConfigInput] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfig();
    if (config.url) setCustomUrl(config.url);
    if (config.anonKey) setCustomAnonKey(config.anonKey);
  }, []);

  const clearValidationErrors = () => {
    setPhoneError(null);
    setVehicleRegError(null);
    setEmailError(null);
    setFullNameError(null);
    setPhoneValid(false);
    setVehicleRegValid(false);
    setEmailValid(false);
    setFullNameValid(false);
    setErrorMsg(null);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    clearValidationErrors();
    if (newRole === 'driver') {
      setEmail('driver01@gmail.com');
      setPassword('Password#Drv01');
    } else {
      setEmail('vikram.joshi@setuhaul.com');
      setPassword('Password#Coord01');
    }
  };

  const handleModeChange = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    clearValidationErrors();
    setSuccessMsg(null);
    if (newMode === 'signup') {
      if (role === 'driver') {
        setEmail('');
        setPassword('');
        setFullName('');
        setPhone('');
        setVehicleReg('');
      } else {
        setEmail('');
        setPassword('');
        setFullName('');
      }
    } else {
      if (role === 'driver') {
        setEmail('driver01@gmail.com');
        setPassword('Password#Drv01');
      } else {
        setEmail('vikram.joshi@setuhaul.com');
        setPassword('Password#Coord01');
      }
    }
  };

  // Field validation routines
  const validatePhoneField = (val: string = phone): boolean => {
    const res = validatePhoneNumber(val);
    if (!res.isValid) {
      setPhoneError(res.error);
      setPhoneValid(false);
      return false;
    } else {
      setPhoneError(null);
      setPhoneValid(true);
      if (res.formatted) {
        setPhone(res.formatted);
      }
      return true;
    }
  };

  const validateVehicleRegField = (val: string = vehicleReg): boolean => {
    const res = validateTruckRegistration(val);
    if (!res.isValid) {
      setVehicleRegError(res.error);
      setVehicleRegValid(false);
      return false;
    } else {
      setVehicleRegError(null);
      setVehicleRegValid(true);
      if (res.cleaned) {
        setVehicleReg(res.cleaned);
      }
      return true;
    }
  };

  const validateEmailField = (val: string = email): boolean => {
    const res = validateEmail(val);
    if (!res.isValid) {
      setEmailError(res.error);
      setEmailValid(false);
      return false;
    } else {
      setEmailError(null);
      setEmailValid(true);
      if (res.cleaned) {
        setEmail(res.cleaned);
      }
      return true;
    }
  };

  const validateFullNameField = (val: string = fullName): boolean => {
    const res = validateFullName(val);
    if (!res.isValid) {
      setFullNameError(res.error);
      setFullNameValid(false);
      return false;
    } else {
      setFullNameError(null);
      setFullNameValid(true);
      return true;
    }
  };

  // Enter key handlers for instant feedback and auto-advancing
  const handleFullNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valid = validateFullNameField();
      if (valid) {
        if (role === 'driver') {
          phoneRef.current?.focus();
        } else {
          emailRef.current?.focus();
        }
      }
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valid = validatePhoneField();
      if (valid) {
        vehicleRegRef.current?.focus();
      }
    }
  };

  const handleVehicleRegKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valid = validateVehicleRegField();
      if (valid) {
        emailRef.current?.focus();
      }
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (mode === 'signup') {
        e.preventDefault();
        const valid = validateEmailField();
        if (valid) {
          passwordRef.current?.focus();
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate registration fields if registering
    if (mode === 'signup') {
      let hasError = false;

      if (!validateFullNameField()) {
        hasError = true;
      }

      if (role === 'driver') {
        if (!validatePhoneField()) {
          hasError = true;
        }
        if (!validateVehicleRegField()) {
          hasError = true;
        }
      }

      if (!validateEmailField()) {
        hasError = true;
      }

      if (!password || password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        passwordRef.current?.focus();
        return;
      }

      if (hasError) {
        setErrorMsg('Please correct the validation errors in the highlighted fields.');
        // Focus first invalid element
        if (fullNameError || !fullName) fullNameRef.current?.focus();
        else if (role === 'driver' && (phoneError || !phone)) phoneRef.current?.focus();
        else if (role === 'driver' && (vehicleRegError || !vehicleReg)) vehicleRegRef.current?.focus();
        else if (emailError || !email) emailRef.current?.focus();
        return;
      }
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
        const validatedPhone = role === 'driver' ? (validatePhoneNumber(phone).formatted || phone) : phone;
        const validatedVehicle = role === 'driver' ? (validateTruckRegistration(vehicleReg).cleaned || vehicleReg) : undefined;
        const validatedEmail = validateEmail(email).cleaned || email.trim();

        const res = await signUp(validatedEmail, password, {
          role,
          fullName: fullName.trim(),
          phone: validatedPhone,
          vehicleReg: validatedVehicle,
          facilityId: role === 'coordinator' ? facilityId : undefined,
        });
        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          setSuccessMsg(
            role === 'driver'
              ? 'Driver profile registered with PENDING review status. Opening Driver Chat...'
              : 'Coordinator account registered with instant access!'
          );
          fetchDrivers();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDriver = (d: any) => {
    const veh = INITIAL_VEHICLES.find(v => v.carrier_id === d.carrier_id) || INITIAL_VEHICLES[0];
    setRole('driver');
    setEmail(d.email);
    setPassword(d.password || 'Password#Drv01');
    setFullName(d.driver_name);
    setPhone(d.phone || '');
    setVehicleReg(d.vehicle_registration || veh?.registration_number || '');
    setErrorMsg(null);
    setSuccessMsg(`Loaded credentials for ${d.driver_name} (${d.driver_id})`);
  };

  const handleSelectCoordinator = (c: typeof INITIAL_COORDINATORS[0]) => {
    setRole('coordinator');
    setEmail(c.email);
    setPassword(c.password);
    setFullName(c.name);
    setPhone(c.phone);
    setFacilityId(c.facility_id);
    setErrorMsg(null);
    setSuccessMsg(`Loaded credentials for ${c.name} (${c.facility_id})`);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customAnonKey.trim()) {
      setErrorMsg('Both Supabase URL and Anon Key are required.');
      return;
    }
    saveSupabaseKeys(customUrl.trim(), customAnonKey.trim());
    setSuccessMsg('Supabase API configuration saved! App now connected to Supabase.');
    setShowConfigInput(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const currentConfig = getSupabaseConfig();

  return (
    <div className={`min-h-screen flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-700 ${
      role === 'driver'
        ? 'bg-gradient-to-br from-[#eff6ff] via-[#dbeafe] to-[#e0e7ff]'
        : 'bg-gradient-to-br from-[#ecfdf5] via-[#d1fae5] to-[#ccfbf1]'
    }`}>
      {/* Dynamic Ambient Background Glows & Logistics Grid */}
      <div className={`absolute inset-0 [background-size:24px_24px] pointer-events-none ${
        role === 'driver'
          ? 'bg-[radial-gradient(#3b82f6_1.5px,transparent_1.5px)] opacity-20'
          : 'bg-[radial-gradient(#10b981_1.5px,transparent_1.5px)] opacity-20'
      }`} />
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] blur-[130px] pointer-events-none rounded-full transition-all duration-700 ${
        role === 'driver' 
          ? 'bg-gradient-to-tr from-blue-400/35 via-cyan-300/30 to-indigo-300/30' 
          : 'bg-gradient-to-tr from-emerald-400/35 via-teal-300/30 to-emerald-200/35'
      }`} />
      <div className={`absolute bottom-5 right-5 w-[500px] h-[350px] blur-[110px] pointer-events-none rounded-full transition-all duration-700 ${
        role === 'driver' ? 'bg-cyan-300/30' : 'bg-teal-300/30'
      }`} />
      <div className={`absolute top-10 left-10 w-[420px] h-[320px] blur-[100px] pointer-events-none rounded-full transition-all duration-700 ${
        role === 'driver' ? 'bg-blue-300/25' : 'bg-emerald-300/25'
      }`} />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white shadow-xl mb-4 border transition-all transform hover:scale-105 duration-300 ${
          role === 'driver'
            ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-blue-500/30 border-blue-300/40 ring-4 ring-blue-500/15'
            : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-400 shadow-emerald-500/30 border-emerald-300/40 ring-4 ring-emerald-500/15'
        }`}>
          {role === 'driver' ? <Truck className="w-8 h-8 text-white drop-shadow-md" /> : <Building2 className="w-8 h-8 text-white drop-shadow-md" />}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2.5">
          <span className={`bg-clip-text text-transparent bg-gradient-to-r ${
            role === 'driver'
              ? 'from-blue-700 via-indigo-700 to-cyan-700'
              : 'from-emerald-700 via-teal-700 to-emerald-800'
          }`}>
            SetuHaul
          </span>
          <span className={`text-xs font-extrabold px-3 py-1 rounded-full border shadow-sm ${
            role === 'driver'
              ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-blue-500/10'
              : 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-emerald-500/10'
          }`}>
            {role === 'driver' ? 'Driver Portal' : 'Coordinator Portal'}
          </span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 font-semibold">
          Deterministic Freight Operations & Automated Dock Scheduling
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 transition-all duration-300 border overflow-hidden relative ${
          role === 'driver' 
            ? 'bg-white/95 border-blue-200/80 shadow-blue-900/10 ring-1 ring-blue-500/10' 
            : 'bg-white/95 border-emerald-200/80 shadow-emerald-900/10 ring-1 ring-emerald-500/10'
        }`}>
          {/* Top Decorative Color Accent Stripe */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
            role === 'driver'
              ? 'from-blue-600 via-cyan-500 to-indigo-600'
              : 'from-emerald-600 via-teal-500 to-emerald-600'
          }`} />

          {/* Isolated Portal Selector (Driver vs. Coordinator) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Portal Target
              </label>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                role === 'driver'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
              }`}>
                Role Isolation Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200">
              <button
                type="button"
                id="login-role-driver"
                onClick={() => handleRoleChange('driver')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  role === 'driver'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-md shadow-blue-600/25 border border-blue-400/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Truck className={`w-4 h-4 ${role === 'driver' ? 'text-white' : 'text-slate-600'}`} />
                <span>Driver Login</span>
              </button>
              <button
                type="button"
                id="login-role-coordinator"
                onClick={() => handleRoleChange('coordinator')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  role === 'coordinator'
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-md shadow-emerald-600/25 border border-emerald-400/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${role === 'coordinator' ? 'text-white' : 'text-slate-600'}`} />
                <span>Coordinator Login</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-600 mt-2 flex items-center gap-1.5 font-medium">
              <span className={`w-2 h-2 rounded-full animate-pulse ${role === 'driver' ? 'bg-blue-600 shadow-sm shadow-blue-500' : 'bg-emerald-600 shadow-sm shadow-emerald-500'}`} />
              <span>
                {role === 'driver'
                  ? 'Driver Portal: AI Dispatch Assistant, Real-time Slot Negotiations & Gate Passes.'
                  : 'Coordinator Console: Dock Management, Supervisor Decisions & Gate Queue.'}
              </span>
            </p>
          </div>

          {/* Portal Highlight Card */}
          <div className={`p-4 rounded-xl border text-xs transition-all ${
            role === 'driver'
              ? 'bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-cyan-50/90 border-blue-200 text-slate-800 shadow-sm'
              : 'bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border-emerald-200 text-slate-800 shadow-sm'
          }`}>
            <div className="font-semibold flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                {role === 'driver' ? (
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 border border-blue-400/40 flex items-center justify-center text-white shadow-xs">
                    <Truck className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/40 flex items-center justify-center text-white shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                )}
                <span className="text-slate-900 font-extrabold text-xs sm:text-sm">
                  {role === 'driver' ? 'Driver Dispatch Entry Point' : 'Operations Coordinator Entry Point'}
                </span>
              </span>
              <span className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                role === 'driver'
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {role === 'driver' ? 'Fleet Access' : 'Facility Access'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              {role === 'driver'
                ? 'Authorized access for carrier drivers to negotiate slot reschedules with the AI dispatch agent and view assigned dock permits.'
                : 'Authorized access for facility yard supervisors to review incoming reschedule requests, issue sign-off tokens, and inspect dock queue.'}
            </p>
            {role === 'driver' && (
              <div className="mt-2.5 pt-2 border-t border-blue-200/80 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>AI Rescheduling</span>
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-600" />
                  <span>Live ETA Sync</span>
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                  <span>Digital Dock Permits</span>
                </span>
              </div>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              id="login-tab-signin"
              onClick={() => handleModeChange('signin')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex-1 text-center ${
                mode === 'signin'
                  ? role === 'driver' ? 'border-blue-600 text-blue-700' : 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In Existing
            </button>
            <button
              type="button"
              id="login-tab-signup"
              onClick={() => handleModeChange('signup')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex-1 text-center ${
                mode === 'signup'
                  ? role === 'driver' ? 'border-blue-600 text-blue-700' : 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Register New Profile
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-fade-in shadow-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2 animate-fade-in shadow-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Full Name</label>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <CornerDownLeft className="w-3 h-3 text-slate-400" />
                      <span>Press [Enter] to check</span>
                    </span>
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={fullNameRef}
                      type="text"
                      required
                      placeholder={role === 'driver' ? 'Rajesh Kumar' : 'Vikram Joshi'}
                      value={fullName}
                      onChange={e => {
                        setFullName(e.target.value);
                        if (fullNameError) setFullNameError(null);
                        setFullNameValid(false);
                      }}
                      onKeyDown={handleFullNameKeyDown}
                      onBlur={() => {
                        if (fullName.trim()) validateFullNameField();
                      }}
                      className={`w-full bg-slate-50 border rounded-xl pl-9 pr-9 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all ${
                        fullNameError
                          ? 'border-rose-400 bg-rose-50/40 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                          : fullNameValid
                          ? 'border-emerald-400 bg-emerald-50/30 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                          : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    {fullNameValid && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                    {fullNameError && (
                      <AlertCircle className="w-4 h-4 text-rose-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                  {fullNameError ? (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                      <span>{fullNameError}</span>
                    </p>
                  ) : fullNameValid ? (
                    <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>Full name verified</span>
                    </p>
                  ) : null}
                </div>

                {role === 'driver' ? (
                  <>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Coordinator Approval Workflow & Sanitary Checks</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        Driver profiles undergo sanitary validation for <strong>+91 10-digit mobile</strong>, standard <strong>Indian vehicle plate</strong>, and valid <strong>email (.com/.in)</strong>. Press <strong>[Enter]</strong> on any field to test validation.
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      {/* Phone Number Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">Phone Number (India)</label>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <CornerDownLeft className="w-3 h-3 text-slate-400" />
                            <span>Press [Enter] to check</span>
                          </span>
                        </div>
                        <div className="relative flex rounded-xl shadow-2xs">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-700 text-xs font-bold select-none font-mono">
                            🇮🇳 +91
                          </span>
                          <div className="relative flex-1">
                            <input
                              ref={phoneRef}
                              type="tel"
                              id="input-signup-phone"
                              placeholder="98765 43210"
                              value={phone.replace(/^\+91\s*/, '')}
                              onChange={e => {
                                let val = e.target.value;
                                if (val.startsWith('+91')) {
                                  val = val.slice(3).trim();
                                }
                                setPhone(val);
                                if (phoneError) setPhoneError(null);
                                setPhoneValid(false);
                              }}
                              onKeyDown={handlePhoneKeyDown}
                              onBlur={() => {
                                if (phone.trim()) validatePhoneField();
                              }}
                              className={`w-full bg-slate-50 border rounded-r-xl pr-9 py-2.5 pl-3 text-xs text-slate-900 font-mono font-medium placeholder-slate-400 focus:bg-white focus:outline-none transition-all ${
                                phoneError
                                  ? 'border-rose-400 bg-rose-50/40 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                                  : phoneValid
                                  ? 'border-emerald-400 bg-emerald-50/30 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                  : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                              }`}
                            />
                            {phoneValid && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            )}
                            {phoneError && (
                              <AlertCircle className="w-4 h-4 text-rose-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            )}
                          </div>
                        </div>
                        {phoneError ? (
                          <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                            <span>{phoneError}</span>
                          </p>
                        ) : phoneValid ? (
                          <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>Valid Indian 10-digit mobile (+91 {phone.replace(/\D/g, '').slice(-10)})</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-1">
                            Enter 10 digits without letters (e.g. 9876543210). Indian format begins with 6, 7, 8, or 9.
                          </p>
                        )}
                      </div>

                      {/* Truck Registration Number Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">Truck Registration Plate</label>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <CornerDownLeft className="w-3 h-3 text-slate-400" />
                            <span>Press [Enter] to check</span>
                          </span>
                        </div>
                        <div className="relative">
                          <Truck className="w-4 h-4 text-cyan-600 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            ref={vehicleRegRef}
                            type="text"
                            required
                            placeholder="RJ14GT4101"
                            value={vehicleReg}
                            onChange={e => {
                              setVehicleReg(e.target.value.toUpperCase());
                              if (vehicleRegError) setVehicleRegError(null);
                              setVehicleRegValid(false);
                            }}
                            onKeyDown={handleVehicleRegKeyDown}
                            onBlur={() => {
                              if (vehicleReg.trim()) validateVehicleRegField();
                            }}
                            className={`w-full bg-slate-50 border rounded-xl pl-9 pr-9 py-2.5 text-xs text-blue-800 font-mono font-bold placeholder-slate-400 focus:bg-white focus:outline-none transition-all uppercase ${
                              vehicleRegError
                                ? 'border-rose-400 bg-rose-50/40 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                                : vehicleRegValid
                                ? 'border-emerald-400 bg-emerald-50/30 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                            }`}
                          />
                          {vehicleRegValid && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                          {vehicleRegError && (
                            <AlertCircle className="w-4 h-4 text-rose-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                        </div>
                        {vehicleRegError ? (
                          <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                            <span>{vehicleRegError}</span>
                          </p>
                        ) : vehicleRegValid ? (
                          <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>Valid Indian commercial registration ({vehicleReg})</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-1 font-mono">
                            Indian plate pattern: State(2) + RTO(1-2) + Series(1-2) + No(4), e.g. RJ14GT4101 or MH12AB1234
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Hub Facility</label>
                    <select
                      value={facilityId}
                      onChange={e => setFacilityId(e.target.value)}
                      className="w-full bg-slate-50 border border-emerald-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 font-medium"
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {role === 'driver' ? 'Driver Email / Username' : 'Coordinator Work Email'}
                </label>
                {mode === 'signup' && (
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <CornerDownLeft className="w-3 h-3 text-slate-400" />
                    <span>Press [Enter] to check</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  role === 'driver' ? 'text-blue-500' : 'text-emerald-500'
                }`} />
                <input
                  ref={emailRef}
                  type="email"
                  id="input-login-email"
                  required
                  placeholder={role === 'driver' ? 'driver01@gmail.com' : 'vikram.joshi@setuhaul.com'}
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                    setEmailValid(false);
                  }}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={() => {
                    if (email.trim() && mode === 'signup') validateEmailField();
                  }}
                  className={`w-full bg-slate-50 border rounded-xl pl-9 pr-9 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none font-mono font-medium transition-all ${
                    emailError
                      ? 'border-rose-400 bg-rose-50/40 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                      : emailValid && mode === 'signup'
                      ? 'border-emerald-400 bg-emerald-50/30 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                      : role === 'driver'
                      ? 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                      : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
                {emailValid && mode === 'signup' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                {emailError && (
                  <AlertCircle className="w-4 h-4 text-rose-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
              {emailError ? (
                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                  <span>{emailError}</span>
                </p>
              ) : emailValid && mode === 'signup' ? (
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 mt-1.5 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Valid email address (.com / .in)</span>
                </p>
              ) : null}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                {mode === 'signin' && (
                  <span className={`text-[11px] font-mono font-bold ${role === 'driver' ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {role === 'driver' ? 'e.g. Password#Drv01' : 'e.g. Password#Coord01'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  role === 'driver' ? 'text-indigo-500' : 'text-teal-500'
                }`} />
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  id="input-login-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none font-mono font-medium transition-all ${
                    role === 'driver'
                      ? 'focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                      : 'focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
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
              className={`w-full py-3 px-4 rounded-xl text-white text-xs font-extrabold transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-2 ${
                role === 'driver'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-600/30 hover:shadow-blue-600/40'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30 hover:shadow-emerald-600/40'
              }`}
            >
              {isLoading ? (
                <span className="animate-pulse flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </span>
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? `Sign In to ${role === 'driver' ? 'Driver Portal' : 'Coordinator Dashboard'}`
                      : 'Register & Launch Workspace'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Directory helper based on selected portal */}
          {role === 'driver' ? (
            /* Quick Pre-Configured Drivers Directory Accordion */
            <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-sm">
              <button
                type="button"
                id="btn-toggle-driver-directory"
                onClick={() => setShowDriverDirectory(!showDriverDirectory)}
                className="flex items-center justify-between w-full text-left text-xs font-bold text-slate-800"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <span id="driver-directory-title">
                    Driver Database Directory ({liveDrivers.length} Drivers)
                  </span>
                  {liveDrivers.some(d => d.approval_status === 'PENDING') && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300 font-mono">
                      {liveDrivers.filter(d => d.approval_status === 'PENDING').length} Pending
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-blue-600 flex items-center gap-1 font-bold">
                  {showDriverDirectory ? 'Hide' : 'View & Auto-Fill'}
                  {showDriverDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {showDriverDirectory && (
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 leading-snug font-medium">
                    <span>
                      Click <strong className="text-blue-700 font-bold">Auto-Fill</strong> on any driver below to populate credentials:
                    </span>
                    <button
                      type="button"
                      onClick={fetchDrivers}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white">
                    {liveDrivers.map(d => (
                      <div
                        key={d.driver_id}
                        className="p-2.5 flex items-center justify-between hover:bg-blue-50/60 transition-colors text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{d.driver_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono font-bold">
                              {d.driver_id}
                            </span>
                            {d.approval_status === 'PENDING' ? (
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold">
                                Pending Review
                              </span>
                            ) : d.approval_status === 'REJECTED' ? (
                              <span className="text-[10px] px-1.5 py-0.2 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold">
                                Rejected
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold">
                                Approved
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                            <span className="text-blue-600 font-semibold">{d.email}</span> • <span className="text-slate-500">{d.password}</span>
                            {d.vehicle_registration && (
                              <span className="text-slate-400"> • {d.vehicle_registration}</span>
                            )}
                            {d.phone && (
                              <span className="text-slate-400"> • {d.phone}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${d.email} | ${d.password}`, d.driver_id)}
                            title="Copy credentials"
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
                          >
                            {copiedId === d.driver_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectDriver(d)}
                            className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-md text-[11px] font-bold transition-all shadow-xs"
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
            <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-sm">
              <button
                type="button"
                id="btn-toggle-coord-directory"
                onClick={() => setShowCoordDirectory(!showCoordDirectory)}
                className="flex items-center justify-between w-full text-left text-xs font-bold text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span>Operations Coordinators Directory (4 Staff)</span>
                </div>
                <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                  {showCoordDirectory ? 'Hide' : 'View & Auto-Fill'}
                  {showCoordDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {showCoordDirectory && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                  <p className="text-[11px] text-slate-600 leading-snug font-medium">
                    Click <strong className="text-emerald-700 font-bold">Auto-Fill</strong> on any facility coordinator to sign into their console:
                  </p>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white">
                    {INITIAL_COORDINATORS.map(c => (
                      <div
                        key={c.coordinator_id}
                        className="p-2.5 flex items-center justify-between hover:bg-emerald-50/60 transition-colors text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-mono font-bold">
                              {c.facility_id}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">({c.shift_hours})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                            <span className="text-emerald-700 font-semibold">{c.email}</span> • <span className="text-slate-500">{c.password}</span>
                          </div>
                          <div className="text-[10px] text-teal-700 truncate font-semibold">{c.role_title}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${c.email} | ${c.password}`, c.coordinator_id)}
                            title="Copy credentials"
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
                          >
                            {copiedId === c.coordinator_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectCoordinator(c)}
                            className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-md text-[11px] font-bold transition-all shadow-xs"
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

          {/* Quick Demo Sandbox Buttons */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <span className="text-[11px] text-slate-700 block text-center font-bold tracking-wide">
              ⚡ Instant 1-Click Launch:
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id="btn-quick-driver"
                onClick={() => signInDemo('driver')}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 hover:scale-[1.02]"
              >
                <Truck className="w-4 h-4 text-white" />
                <span>Demo Driver</span>
              </button>
              <button
                type="button"
                id="btn-quick-coordinator"
                onClick={() => signInDemo('coordinator')}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 hover:scale-[1.02]"
              >
                <Building2 className="w-4 h-4 text-white" />
                <span>Demo Coordinator</span>
              </button>
            </div>
          </div>

          {/* Supabase Connection Status / Key Configuration */}
          <div className="pt-3 border-t border-slate-200 text-center space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{isConfigured ? 'Database Online' : 'Local Fallback Engine'}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowConfigInput(!showConfigInput)}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[10px] underline font-medium"
              >
                <Database className="w-3 h-3" />
                <span>{showConfigInput ? 'Hide Keys' : 'Configure Supabase Keys'}</span>
              </button>
            </div>

            {showConfigInput && (
              <form onSubmit={handleSaveKeys} className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-left animate-fade-in">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  <span>Custom Supabase Credentials</span>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 mb-0.5 font-medium">Project URL</label>
                  <input
                    type="text"
                    required
                    placeholder="https://xyzcompany.supabase.co"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 mb-0.5 font-medium">Anon Public Key</label>
                  <input
                    type="password"
                    required
                    placeholder="eyJhbGciOi..."
                    value={customAnonKey}
                    onChange={e => setCustomAnonKey(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  Save & Connect Database
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
