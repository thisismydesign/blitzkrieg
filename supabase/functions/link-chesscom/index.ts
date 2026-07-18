import { z } from 'npm:zod@4.4.3';
import { adminClient, getUser } from '../_shared/supabase.ts';
import { fetchProfile } from '../_shared/chesscom.ts';
import { errorResponse, json, preflight } from '../_shared/http.ts';

// Link a chess.com account to the authenticated user. The profile lookup is
// server-side (User-Agent policy); the account row stores the STABLE player_id.

const Body = z.object({ username: z.string().min(1).max(64) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return errorResponse('method not allowed', 405);

  const admin = adminClient();
  const user = await getUser(admin, req);
  if (!user) return errorResponse('unauthorized', 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('invalid body', 422);
  const username = parsed.data.username.trim().toLowerCase();

  const profile = await fetchProfile(username);
  if (!profile) return errorResponse('chess.com user not found', 404);

  const { data, error } = await admin
    .from('chesscom_accounts')
    .upsert(
      {
        user_id: user.id,
        chesscom_player_id: profile.player_id,
        username: profile.username.toLowerCase(),
      },
      { onConflict: 'user_id,chesscom_player_id' },
    )
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return json({ account: data });
});
