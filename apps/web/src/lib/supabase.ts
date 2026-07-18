import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The client is built from the two client-safe values exposed by Vite from the
// root .env. When they're absent (e.g. a logged-out visitor with no backend
// configured), `supabase` is null and the app runs the openings-only mode.

const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

/** Whether Supabase is configured — gates the "drill my games" features. */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

/** Narrow accessor that throws if called when unconfigured (guards feature code). */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
