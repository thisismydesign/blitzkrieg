import { requireSupabase } from '../lib/supabase';
import type { ChesscomAccountRow } from './rows';

export async function getAccounts(): Promise<ChesscomAccountRow[]> {
  const { data, error } = await requireSupabase()
    .from('chesscom_accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChesscomAccountRow[];
}

/** Link a chess.com username (server-side profile lookup via the edge function). */
export async function linkChesscom(username: string): Promise<ChesscomAccountRow> {
  const { data, error } = await requireSupabase().functions.invoke('link-chesscom', {
    body: { username },
  });
  if (error) throw error;
  return (data as { account: ChesscomAccountRow }).account;
}
