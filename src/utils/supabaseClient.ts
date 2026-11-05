import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export const DEFAULT_SUPABASE_URL = 'https://vxkgxlomnvizqwzachie.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_NK0EaOo2owEELvqH0a-NeQ_oI4LvPXG';

export const getSupabaseConfig = (): { url: string; anonKey: string } => {
  // 1. Check environment variables
  const envMeta = (import.meta as any).env || {};
  const envUrl = envMeta.VITE_SUPABASE_URL || envMeta.EXPO_PUBLIC_SUPABASE_URL || '';
  const envKey = envMeta.VITE_SUPABASE_KEY || envMeta.VITE_SUPABASE_ANON_KEY || envMeta.EXPO_PUBLIC_SUPABASE_KEY || envMeta.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  // 2. Check saved store settings in localStorage
  let savedUrl = '';
  let savedKey = '';
  try {
    const raw = localStorage.getItem('fireworks_pos_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      savedUrl = parsed.supabaseUrl || '';
      savedKey = parsed.supabaseAnonKey || '';
    }
  } catch {
    // ignore
  }

  return {
    url: (savedUrl || envUrl || DEFAULT_SUPABASE_URL).trim(),
    anonKey: (savedKey || envKey || DEFAULT_SUPABASE_KEY).trim(),
  };
};

export const getSupabaseClient = (overrideUrl?: string, overrideKey?: string): SupabaseClient | null => {
  const config = getSupabaseConfig();
  const url = (overrideUrl !== undefined ? overrideUrl : config.url).trim();
  const anonKey = (overrideKey !== undefined ? overrideKey : config.anonKey).trim();

  if (!url || !anonKey) {
    return null;
  }

  // Reuse cached client if credentials haven't changed
  if (cachedClient && lastUsedUrl === url && lastUsedKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastUsedUrl = url;
    lastUsedKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const testSupabaseConnection = async (
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> => {
  const client = getSupabaseClient(testUrl, testKey);
  if (!client) {
    return { success: false, message: 'Supabase URL or Anon Key is missing.' };
  }

  try {
    // Attempt a light read from products or store_settings
    const { error } = await client.from('products').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return {
          success: false,
          message: 'Connected to Supabase! However, database tables have not been created yet. Please run supabase_schema.sql in your Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Database query error: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to reach Supabase server.' };
  }
};

