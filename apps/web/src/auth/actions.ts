import { requireSupabase } from '../lib/supabase';

// Thin wrappers over Supabase auth. Each throws if Supabase is unconfigured.

export function signInWithPassword(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({ email, password });
}

export function signUpWithPassword(email: string, password: string) {
  return requireSupabase().auth.signUp({ email, password });
}

export function signInWithOAuth(provider: 'google' | 'github') {
  return requireSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
}

export function signOut() {
  return requireSupabase().auth.signOut();
}
