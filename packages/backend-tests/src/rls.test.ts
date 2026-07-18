import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Request/integration tests against a running Supabase stack (the "Rails request
// spec" analog): drive PostgREST as real roles and assert RLS. Skipped unless the
// stack's env is provided (CI exports it after `supabase start`).

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(URL && ANON && SERVICE);
const PASSWORD = 'Passw0rd!-req-tests';

interface TestUser {
  id: string;
  client: SupabaseClient;
}

describe.skipIf(!hasEnv)('RLS isolates users', () => {
  let admin: SupabaseClient;
  let a: TestUser;
  let b: TestUser;
  let accountId: string;

  async function makeUser(email: string): Promise<TestUser> {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === email);
    if (existing) await admin.auth.admin.deleteUser(existing.id);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;

    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data: signin, error: sErr } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (sErr) throw sErr;

    const client = createClient(URL!, ANON!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${signin.session!.access_token}` } },
    });
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    a = await makeUser('rls-a@blitzkrieg.test');
    b = await makeUser('rls-b@blitzkrieg.test');

    const { data: acct, error } = await admin
      .from('chesscom_accounts')
      .insert({ user_id: a.id, chesscom_player_id: 1, username: 'usera' })
      .select()
      .single();
    if (error) throw error;
    accountId = acct.id;

    const { error: gErr } = await admin.from('games').insert({
      user_id: a.id,
      account_id: accountId,
      provider: 'chesscom',
      provider_game_id: 'g1',
      user_color: 'white',
      pgn: '1. e4 e5',
    });
    if (gErr) throw gErr;
  });

  afterAll(async () => {
    if (a) await admin.auth.admin.deleteUser(a.id);
    if (b) await admin.auth.admin.deleteUser(b.id);
  });

  it('A reads their own game', async () => {
    const { data } = await a.client.from('games').select('id');
    expect(data).toHaveLength(1);
  });

  it("B cannot read A's game", async () => {
    const { data } = await b.client.from('games').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('B cannot insert a game owned by A', async () => {
    const { error } = await b.client.from('games').insert({
      user_id: a.id,
      account_id: accountId,
      provider: 'chesscom',
      provider_game_id: 'gx',
      pgn: 'x',
    });
    expect(error).toBeTruthy();
  });

  it('anon cannot read games', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error } = await anon.from('games').select('id');
    expect(error).toBeTruthy();
  });
});
