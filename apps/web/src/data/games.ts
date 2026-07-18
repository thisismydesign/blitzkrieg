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

/** Games not yet analysed by the client engine (drives the analysis queue). */
export async function getUnanalyzedGames(limit = 20): Promise<GameRow[]> {
  const { data, error } = await requireSupabase()
    .from('games')
    .select('*')
    .is('analyzed_at', null)
    .order('played_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GameRow[];
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
