import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.7';

/**
 * Service-role client for edge functions. Bypasses RLS, so every write must set
 * `user_id` explicitly to the authenticated caller. Platform-injected env
 * (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) is available in local `functions
 * serve` and in production.
 */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Resolve the authenticated user from the request's bearer token, or null. */
export async function getUser(admin: SupabaseClient, req: Request): Promise<User | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error ? null : data.user;
}
