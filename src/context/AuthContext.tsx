import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseConfig } from '../lib/supabaseClient';
import { INITIAL_DRIVERS, INITIAL_VEHICLES, INITIAL_COORDINATORS } from '../db/seedData';

export type UserRole = 'driver' | 'coordinator';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  vehicleReg?: string; // for drivers
  facilityId?: string; // for coordinators
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    profileData: {
      role: UserRole;
      fullName: string;
      phone?: string;
      vehicleReg?: string;
      facilityId?: string;
    }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInDemo: (role: UserRole) => void;
  saveSupabaseKeys: (url: string, anonKey: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'setuhaul_authenticated_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(() => getSupabaseConfig().isConfigured);

  // Helper to construct profile from Supabase user metadata
  const buildProfileFromUser = (sbUser: User): UserProfile => {
    const meta = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      email: sbUser.email || '',
      role: (meta.role as UserRole) || 'driver',
      fullName: meta.full_name || meta.fullName || sbUser.email?.split('@')[0] || 'User',
      phone: meta.phone,
      vehicleReg: meta.vehicle_reg || meta.vehicleReg,
      facilityId: meta.facility_id || meta.facilityId,
    };
  };

  const initAuth = (client: SupabaseClient | null) => {
    // 1. Check local storage first for persisted user session
    try {
      const savedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setProfile(parsed);
      }
    } catch (e) {
      console.error('Failed to load local profile session', e);
    }

    if (client) {
      setIsConfigured(true);
      // Fetch Supabase session if configured
      client.auth.getSession().then(({ data: { session: currentSession }, error }) => {
        if (!error && currentSession) {
          setSession(currentSession);
          if (currentSession.user) {
            setUser(currentSession.user);
            const userProf = buildProfileFromUser(currentSession.user);
            setProfile(userProf);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProf));
          }
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });

      // Listen to Auth State Changes in Supabase
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user) {
          setUser(currentSession.user);
          const userProf = buildProfileFromUser(currentSession.user);
          setProfile(userProf);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProf));
        } else {
          // Only clear if we were using a Supabase session
          if (currentSession === null && user) {
            setUser(null);
            setProfile(null);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          }
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setIsConfigured(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const client = getSupabaseClient();
    const cleanup = initAuth(client);
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const saveSupabaseKeys = (url: string, anonKey: string) => {
    localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', anonKey.trim());
    const client = getSupabaseClient();
    if (client) {
      initAuth(client);
    }
  };

  // Find matching driver in our database
  const findDatabaseDriver = (emailInput: string, passwordInput?: string) => {
    const normalizedEmail = emailInput.trim().toLowerCase();
    return INITIAL_DRIVERS.find(d => {
      const matchEmail = d.email?.toLowerCase() === normalizedEmail;
      if (!matchEmail) return false;
      if (passwordInput && d.password) {
        return d.password === passwordInput;
      }
      return true;
    });
  };

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClient();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. If Supabase is connected, attempt Supabase Auth first
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data.user) {
          setUser(data.user);
          setSession(data.session);
          const userProf = buildProfileFromUser(data.user);
          setProfile(userProf);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProf));
          return { error: null };
        }
        // If Supabase returned an error, fallback to checking local database drivers
      } catch (err: any) {
        console.warn('Supabase sign-in fallback triggered:', err);
      }
    }

    // 2. Direct Database Driver Credentials Validation
    const matchedDriver = findDatabaseDriver(normalizedEmail);
    if (matchedDriver) {
      if (matchedDriver.password && matchedDriver.password !== password) {
        return { error: new Error('Incorrect password. Please verify the password from the driver directory.') };
      }

      // Look up carrier's vehicle
      const vehicle = INITIAL_VEHICLES.find(v => v.carrier_id === matchedDriver.carrier_id) || INITIAL_VEHICLES[0];
      const driverProfile: UserProfile = {
        id: matchedDriver.driver_id,
        email: matchedDriver.email,
        role: 'driver',
        fullName: matchedDriver.driver_name,
        phone: matchedDriver.phone,
        vehicleReg: vehicle.registration_number,
      };

      setProfile(driverProfile);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(driverProfile));
      return { error: null };
    }

    // 3. Coordinator check from INITIAL_COORDINATORS or keyword
    const matchedCoordinator = INITIAL_COORDINATORS.find(
      c => c.email.toLowerCase() === normalizedEmail || c.coordinator_id.toLowerCase() === normalizedEmail
    );

    if (matchedCoordinator) {
      const coordProfile: UserProfile = {
        id: matchedCoordinator.coordinator_id,
        email: matchedCoordinator.email,
        role: 'coordinator',
        fullName: `${matchedCoordinator.name} (${matchedCoordinator.role_title})`,
        phone: matchedCoordinator.phone,
        facilityId: matchedCoordinator.facility_id,
      };
      setProfile(coordProfile);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(coordProfile));
      return { error: null };
    }

    if (normalizedEmail.includes('coord') || normalizedEmail.includes('admin') || normalizedEmail.includes('manager')) {
      const firstCoord = INITIAL_COORDINATORS[0];
      const coordProfile: UserProfile = {
        id: firstCoord.coordinator_id,
        email: normalizedEmail,
        role: 'coordinator',
        fullName: `${firstCoord.name} (${firstCoord.role_title})`,
        phone: firstCoord.phone,
        facilityId: firstCoord.facility_id,
      };
      setProfile(coordProfile);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(coordProfile));
      return { error: null };
    }

    // 4. Any other custom email/password login (allow instant login)
    const customProfile: UserProfile = {
      id: 'usr-' + Date.now().toString().slice(-4),
      email: normalizedEmail,
      role: 'driver',
      fullName: normalizedEmail.split('@')[0],
      phone: '+91 98000 00000',
      vehicleReg: 'MH-12-AB-1234',
    };
    setProfile(customProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(customProfile));
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    profileData: {
      role: UserRole;
      fullName: string;
      phone?: string;
      vehicleReg?: string;
      facilityId?: string;
    }
  ) => {
    const client = getSupabaseClient();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth if client is available
    if (client) {
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: profileData.role,
              full_name: profileData.fullName,
              phone: profileData.phone,
              vehicle_reg: profileData.vehicleReg,
              facility_id: profileData.facilityId,
            },
          },
        });

        if (!error && data.user) {
          setUser(data.user);
          setSession(data.session);
          const userProf = buildProfileFromUser(data.user);
          setProfile(userProf);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProf));
          return { error: null };
        }
      } catch (err: any) {
        console.warn('Supabase sign-up fallback triggered:', err);
      }
    }

    // 2. Direct instant registration
    const newProfile: UserProfile = {
      id: 'reg-' + Date.now().toString().slice(-4),
      email: normalizedEmail,
      role: profileData.role,
      fullName: profileData.fullName || (profileData.role === 'driver' ? 'Freight Driver' : 'Hub Coordinator'),
      phone: profileData.phone || '+91 90000 00000',
      vehicleReg: profileData.vehicleReg || 'MH-12-AB-1234',
      facilityId: profileData.facilityId || 'FAC001',
    };

    setProfile(newProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newProfile));
    return { error: null };
  };

  const signOut = async () => {
    const driverId = profile?.id;

    // 1. Clear local/session chat state
    try {
      sessionStorage.removeItem('setuhaul_active_chat_session');
      sessionStorage.removeItem('setuhaul_active_session_id');
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('setuhaul_chat_history_') || key.startsWith('setuhaul_session_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Could not clear sessionStorage:', e);
    }

    // 2. Clear backend chat thread history for this driver
    if (driverId) {
      try {
        fetch('/api/chat/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId }),
        }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        // ignore
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  };

  // Demo user helper for testing without Supabase or instant role switching
  const signInDemo = (role: UserRole) => {
    const demoProfile: UserProfile =
      role === 'driver'
        ? {
            id: 'DRV001',
            email: 'driver01@gmail.com',
            role: 'driver',
            fullName: 'Rajesh Kumar (NorthStar Roadways)',
            phone: '+91-9000010001',
            vehicleReg: 'RJ14GT4101',
          }
        : {
            id: 'COORD001',
            email: 'vikram.joshi@setuhaul.com',
            role: 'coordinator',
            fullName: 'Vikram Joshi (Senior Yard & Dock Operations Lead)',
            phone: '+91-9829011001',
            facilityId: 'FAC-JAI-01',
          };

    setProfile(demoProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoProfile));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: profile?.role || null,
        loading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        signInDemo,
        saveSupabaseKeys,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
