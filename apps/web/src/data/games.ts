import { requireSupabase } from '../lib/supabase';
import type { GameRow } from './rows';

export async function getGames(limit = 200): Promise<GameRow[]> {
  const { data, error } = await requireSupabase()
    .from('games')
    .select('*')
    .order('played_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GameRow[];
}

/** Games not yet analysed by the client engine (drives the analysis queue).
 *  Defaults to all of them (up to the Data API's max-rows cap). */
export async function getUnanalyzedGames(limit = 1000): Promise<GameRow[]> {
  const { data, error } = await requireSupabase()
    .from('games')
    .select('*')
    .is('analyzed_at', null)
    .order('played_at', { ascending: true }) // oldest first
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GameRow[];
}

/** Exact total games count (not row-limited). */
export async function countGames(): Promise<number> {
  const { count, error } = await requireSupabase()
    .from('games')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Exact count of games still awaiting analysis. */
export async function countUnanalyzedGames(): Promise<number> {
  const { count, error } = await requireSupabase()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('analyzed_at', null);
  if (error) throw error;
  return count ?? 0;
}

export interface ImportResult {
  jobId: string;
  months: number;
  imported: number;
}

/** Trigger a chess.com import for a linked account (server-side edge function). */
export async function importGames(accountId: string, maxMonths = 3): Promise<ImportResult> {
  const { data, error } = await requireSupabase().functions.invoke('import-games', {
    body: { accountId, maxMonths },
  });
  if (error) throw error;
  return data as ImportResult;
}
