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
  CornerDownLeft,
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';
import { getSupabaseConfig } from '../lib/supabaseClient';
import { INITIAL_DRIVERS, INITIAL_VEHICLES, INITIAL_COORDINATORS } from '../db/seedData';
import {
  validatePhoneNumber,
  validateTruckRegistration,
  validateEmail,
  validateFullName,
} from '../utils/sanitaryValidation';

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
  const [vehicleReg, setVehicleReg] = useState('');
  const [facilityId, setFacilityId] = useState('FAC001');

  // Sanitary validation states
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneValid, setPhoneValid] = useState(false);

  const [vehicleRegError, setVehicleRegError] = useState<string | null>(null);
  const [vehicleRegValid, setVehicleRegValid] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailValid, setEmailValid] = useState(false);

  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [fullNameValid, setFullNameValid] = useState(false);

  // Field input refs for sequential Enter key focus
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const vehicleRegRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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
    const config = getSupabaseConfig();
    if (config.url) setCustomUrl(config.url);
    if (config.anonKey) setCustomAnonKey(config.anonKey);
    if (isOpen) {
      fetchDrivers();
    }
  }, [isOpen]);

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

  const handleModeToggle = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    clearValidationErrors();
    setSuccessMsg(null);
    if (newMode === 'signup') {
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
      setVehicleReg('');
    }
  };

  const handleRoleToggle = (newRole: UserRole) => {
    setRole(newRole);
    clearValidationErrors();
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

  // Enter key handlers
  const handleFullNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valid = validateFullNameField();
      if (valid) {
        if (role === 'driver') phoneRef.current?.focus();
        else emailRef.current?.focus();
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

  if (!isOpen) return null;

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
          setSuccessMsg('Successfully signed in with Supabase!');
          setTimeout(() => {
            onClose();
          }, 600);
        }
      } else {
        const validatedPhone = role === 'driver' ? (validatePhoneNumber(phone).formatted || phone) : phone;
        const validatedVehicle = role === 'driver' ? (validateTruckRegistration(vehicleReg).cleaned || vehicleReg) : undefined;
        const validatedEmail = validateEmail(email).cleaned || email.trim();

        const res = await signUp(validatedEmail, password, {
          role,
          fullName: fullName.trim() || (role === 'driver' ? 'Freight Driver' : 'Facility Coordinator'),
          phone: validatedPhone,
          vehicleReg: validatedVehicle,
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

  const handleSelectDriver = (d: any) => {
    const veh = INITIAL_VEHICLES.find(v => v.carrier_id === d.carrier_id) || INITIAL_VEHICLES[0];
    setRole('driver');
    setEmail(d.email || `driver${d.driver_id.replace('DRV', '')}@gmail.com`);
    setPassword(d.password || `Password#Drv${d.driver_id.replace('DRV', '')}`);
    setFullName(d.driver_name);
    setPhone(d.phone || '');
    setVehicleReg(d.vehicle_registration || veh?.registration_number || '');
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
        <div className={`p-5 border-b border-slate-800 flex items-center justify-between transition-colors ${
          role === 'driver' ? 'bg-gradient-to-r from-blue-950/40 via-slate-950/60 to-slate-950/60' : 'bg-slate-950/60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${
              role === 'driver'
                ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-md shadow-blue-600/30 border-blue-400/30 text-white'
                : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-md shadow-emerald-600/30 border-emerald-400/30 text-white'
            }`}>
              {role === 'driver' ? <Truck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  role === 'driver'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {role === 'driver' ? 'Driver Portal' : 'Coordinator Portal'}
                </span>
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
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
                handleRoleToggle('driver');
                setEmail('driver01@gmail.com');
                setPassword('Password#Drv01');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                role === 'driver'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4 text-cyan-300" />
              <span>Driver Portal</span>
            </button>
            <button
              type="button"
              id="auth-role-coordinator"
              onClick={() => {
                handleRoleToggle('coordinator');
                setEmail('vikram.joshi@setuhaul.com');
                setPassword('Password#Coord01');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                role === 'coordinator'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-300" />
              <span>Coordinator Portal</span>
            </button>
          </div>

          <div className={`p-3 rounded-xl border text-xs transition-colors ${
            role === 'driver'
              ? 'bg-gradient-to-r from-blue-950/50 via-indigo-950/30 to-slate-900/80 border-blue-500/30 text-blue-200'
              : 'bg-gradient-to-r from-emerald-950/50 via-teal-950/30 to-slate-900/80 border-emerald-500/30 text-emerald-200'
          }`}>
            <p className="text-[11px] leading-relaxed">
              {role === 'driver'
                ? '🚚 Driver Portal Isolation: Grants access to Driver AI Dispatch Chat, live slot negotiations, and gate permits.'
                : '🛡️ Coordinator Portal Isolation: Grants access to Yard Operations, Dock Scheduling, and exception overrides.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              id="auth-mode-signin"
              onClick={() => handleModeToggle('signin')}
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
              onClick={() => handleModeToggle('signup')}
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
            <div className="bg-slate-950/80 border border-blue-900/30 rounded-xl p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setShowDriverDirectory(!showDriverDirectory)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-200"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center text-cyan-300">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span>Driver Database Directory ({liveDrivers.length} Drivers)</span>
                  {liveDrivers.some(d => d.approval_status === 'PENDING') && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
                      {liveDrivers.filter(d => d.approval_status === 'PENDING').length} Pending
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-medium">
                  {showDriverDirectory ? 'Hide' : 'View & Auto-Fill'}
                  {showDriverDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {showDriverDirectory && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 leading-snug">
                    <span>
                      Click <strong className="text-blue-300">Auto-Fill</strong> on any driver to populate credentials:
                    </span>
                    <button
                      type="button"
                      onClick={fetchDrivers}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/70">
                    {liveDrivers.map(d => (
                      <div
                        key={d.driver_id}
                        className="p-2 flex items-center justify-between hover:bg-blue-950/30 transition-colors text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5 flex-wrap">
                            <span>{d.driver_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-mono font-medium">
                              {d.driver_id}
                            </span>
                            {d.approval_status === 'PENDING' ? (
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-medium">
                                Pending
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-medium">
                                Approved
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            <span className="text-cyan-400/90">{d.email}</span> • {d.password}
                            {d.vehicle_registration && (
                              <span className="text-slate-500"> • {d.vehicle_registration}</span>
                            )}
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
                            className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded text-[11px] font-semibold"
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
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">Full Name</label>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <CornerDownLeft className="w-3 h-3 text-slate-500" />
                      <span>Press [Enter] to check</span>
                    </span>
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={fullNameRef}
                      type="text"
                      required
                      placeholder={role === 'driver' ? 'Rajesh Kumar' : 'Operations Coordinator'}
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
                      className={`w-full bg-slate-950 border rounded-xl pl-9 pr-9 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all ${
                        fullNameError
                          ? 'border-rose-500/80 bg-rose-950/20 focus:border-rose-500'
                          : fullNameValid
                          ? 'border-emerald-500/80 bg-emerald-950/20 focus:border-emerald-500'
                          : 'border-slate-800 focus:border-blue-500'
                      }`}
                    />
                    {fullNameValid && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                    {fullNameError && (
                      <AlertCircle className="w-4 h-4 text-rose-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                  {fullNameError ? (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>{fullNameError}</span>
                    </p>
                  ) : fullNameValid ? (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Full name verified</span>
                    </p>
                  ) : null}
                </div>

                {role === 'driver' ? (
                  <div className="space-y-3">
                    {/* Phone Number with +91 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-slate-300">Phone Number (India)</label>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <CornerDownLeft className="w-3 h-3 text-slate-500" />
                          <span>Press [Enter] to check</span>
                        </span>
                      </div>
                      <div className="relative flex rounded-xl shadow-xs">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold select-none font-mono">
                          🇮🇳 +91
                        </span>
                        <div className="relative flex-1">
                          <input
                            ref={phoneRef}
                            type="tel"
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
                            className={`w-full bg-slate-950 border rounded-r-xl pr-9 py-2 pl-3 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none transition-all ${
                              phoneError
                                ? 'border-rose-500/80 bg-rose-950/20 focus:border-rose-500'
                                : phoneValid
                                ? 'border-emerald-500/80 bg-emerald-950/20 focus:border-emerald-500'
                                : 'border-slate-800 focus:border-blue-500'
                            }`}
                          />
                          {phoneValid && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                          {phoneError && (
                            <AlertCircle className="w-4 h-4 text-rose-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                        </div>
                      </div>
                      {phoneError ? (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span>{phoneError}</span>
                        </p>
                      ) : phoneValid ? (
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>Valid Indian 10-digit mobile (+91 {phone.replace(/\D/g, '').slice(-10)})</span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 mt-1">
                          10 digits without letters. Valid Indian numbers begin with 6, 7, 8, or 9.
                        </p>
                      )}
                    </div>

                    {/* Truck Reg Plate */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-slate-300">Truck Registration Plate</label>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <CornerDownLeft className="w-3 h-3 text-slate-500" />
                          <span>Press [Enter] to check</span>
                        </span>
                      </div>
                      <div className="relative">
                        <Truck className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                          className={`w-full bg-slate-950 border rounded-xl pl-9 pr-9 py-2 text-xs text-blue-200 font-mono font-semibold placeholder-slate-600 focus:outline-none transition-all uppercase ${
                            vehicleRegError
                              ? 'border-rose-500/80 bg-rose-950/20 focus:border-rose-500'
                              : vehicleRegValid
                              ? 'border-emerald-500/80 bg-emerald-950/20 focus:border-emerald-500'
                              : 'border-slate-800 focus:border-blue-500'
                          }`}
                        />
                        {vehicleRegValid && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                        {vehicleRegError && (
                          <AlertCircle className="w-4 h-4 text-rose-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                      </div>
                      {vehicleRegError ? (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span>{vehicleRegError}</span>
                        </p>
                      ) : vehicleRegValid ? (
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>Valid Indian commercial plate ({vehicleReg})</span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">
                          Format: ^[A-Z]&#123;2&#125;[0-9]&#123;1,2&#125;[A-Z]&#123;1,2&#125;[0-9]&#123;4&#125;$ (e.g. RJ14GT4101 or MH12AB1234)
                        </p>
                      )}
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

            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  {role === 'driver' ? 'Driver Email / Username' : 'Coordinator Work Email'}
                </label>
                {mode === 'signup' && (
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <CornerDownLeft className="w-3 h-3 text-slate-500" />
                    <span>Press [Enter] to check</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  role === 'driver' ? 'text-blue-400' : 'text-emerald-400'
                }`} />
                <input
                  ref={emailRef}
                  type="email"
                  required
                  placeholder={role === 'driver' ? 'driver01@gmail.com' : 'coordinator@setuhaul.com'}
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
                  className={`w-full bg-slate-950 border rounded-xl pl-9 pr-9 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono transition-all ${
                    emailError
                      ? 'border-rose-500/80 bg-rose-950/20 focus:border-rose-500 text-rose-200'
                      : emailValid && mode === 'signup'
                      ? 'border-emerald-500/80 bg-emerald-950/20 focus:border-emerald-500 text-emerald-200'
                      : role === 'driver'
                      ? 'border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 text-blue-100'
                      : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 text-emerald-100'
                  }`}
                />
                {emailValid && mode === 'signup' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                {emailError && (
                  <AlertCircle className="w-4 h-4 text-rose-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
              {emailError ? (
                <p className="text-[11px] text-rose-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span>{emailError}</span>
                </p>
              ) : emailValid && mode === 'signup' ? (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1 animate-fade-in font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Valid email address (.com / .in)</span>
                </p>
              ) : null}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  role === 'driver' ? 'text-indigo-400' : 'text-teal-400'
                }`} />
                <input
                  ref={passwordRef}
                  type="text"
                  required
                  placeholder={role === 'driver' ? 'Password#Drv01' : 'Password#Coord01'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono transition-all ${
                    role === 'driver'
                      ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 text-blue-100'
                      : 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 text-emerald-100'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-auth-submit"
              disabled={isLoading}
              className={`w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-2 ${
                role === 'driver'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/30'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-600/30'
              }`}
            >
              {isLoading ? (
                <span className="animate-pulse flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </span>
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
                className="p-2.5 rounded-xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 hover:from-blue-900 hover:to-indigo-900 border border-blue-500/40 text-left transition-all flex items-center gap-2.5 shadow-sm shadow-blue-950/50 hover:border-blue-400"
              >
                <Truck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-blue-200 truncate">Demo Driver</div>
                  <div className="text-[10px] text-cyan-400/80 font-mono">Truck RJ14</div>
                </div>
              </button>

              <button
                type="button"
                id="btn-quick-coordinator"
                onClick={() => handleDemoLogin('coordinator')}
                className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 hover:from-emerald-900 hover:to-teal-900 border border-emerald-500/40 text-left transition-all flex items-center gap-2.5 shadow-sm shadow-emerald-950/50 hover:border-emerald-400"
              >
                <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-emerald-200 truncate">Demo Coordinator</div>
                  <div className="text-[10px] text-emerald-400/80 font-mono">Bhiwandi Hub</div>
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
