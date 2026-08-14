import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  try {
    const envVal = (import.meta as any)?.env?.[key];
    if (envVal && typeof envVal === 'string' && envVal.trim().length > 0) {
      return envVal.trim();
    }
  } catch {
    // fallback
  }

  try {
    const localVal = localStorage.getItem(key);
    if (localVal && typeof localVal === 'string' && localVal.trim().length > 0) {
      return localVal.trim();
    }
  } catch {
    // fallback
  }

  return '';
};

export const getSupabaseConfig = () => {
  const url = getEnvVar('VITE_SUPABASE_URL');
  const anonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
};

let activeClient: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }
  if (!activeClient || currentUrl !== url || currentKey !== anonKey) {
    currentUrl = url;
    currentKey = anonKey;
    activeClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return activeClient;
};

export const isSupabaseConfigured = Boolean(
  getEnvVar('VITE_SUPABASE_URL') && getEnvVar('VITE_SUPABASE_ANON_KEY')
);

export const supabase = getSupabaseClient();
