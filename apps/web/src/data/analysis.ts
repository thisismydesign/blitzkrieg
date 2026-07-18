import { requireSupabase } from '../lib/supabase';
import type { Color, Eval, MistakeInput } from '@blitzkrieg/chess-core';
import { ENGINE_VERSION } from '../engine/stockfish';

/** Look up cached evals for a set of EPDs (global position_evals cache). */
export async function getCachedEvals(epds: string[]): Promise<Map<string, Eval>> {
  const map = new Map<string, Eval>();
  if (!epds.length) return map;
  const { data, error } = await requireSupabase()
    .from('position_evals')
    .select('epd, best_move_uci, eval_cp, eval_mate')
    .eq('engine_version', ENGINE_VERSION)
    .in('epd', epds);
  if (error) throw error;
  const rows = (data ?? []) as {
    epd: string;
    best_move_uci: string;
    eval_cp: number | null;
    eval_mate: number | null;
  }[];
  for (const r of rows) map.set(r.epd, { cp: r.eval_cp, mate: r.eval_mate, bestUci: r.best_move_uci });
  return map;
}

export interface EngineEval {
  bestUci: string;
  cp: number | null;
  mate: number | null;
  depth: number;
  knodes: number;
}

/** Persist a freshly-computed position + eval (contribute-once; never tampers). */
export async function persistEval(
  epd: string,
  fen: string,
  side: Color,
  a: EngineEval,
): Promise<void> {
  const sb = requireSupabase();
  await sb
    .from('positions')
    .upsert({ epd, fen, side_to_move: side }, { onConflict: 'epd', ignoreDuplicates: true });
  await sb.from('position_evals').upsert(
    {
      epd,
      engine_version: ENGINE_VERSION,
      depth: a.depth,
      best_move_uci: a.bestUci,
      eval_cp: a.mate == null ? a.cp : null,
      eval_mate: a.mate,
      knodes: a.knodes,
    },
    { onConflict: 'epd,engine_version', ignoreDuplicates: true },
  );
}

/** Store a game's mistakes, create FSRS cards for the new ones, mark game analysed.
 *  Returns how many new mistakes were recorded. */
export async function persistMistakes(
  gameId: string,
  userId: string,
  mistakes: MistakeInput[],
): Promise<number> {
  const sb = requireSupabase();
  let created = 0;

  if (mistakes.length) {
    const rows = mistakes.map((m) => ({
      user_id: userId,
      game_id: gameId,
      ply: m.ply,
      epd: m.epd,
      fen: m.fen,
      played_uci: m.playedUci,
      played_san: m.playedSan,
      best_uci: m.bestUci,
      best_san: m.bestSan,
      win_before: m.winBefore,
      win_after: m.winAfter,
      win_drop: m.winDrop,
      severity: m.severity,
      phase: m.phase,
      lead_in_uci: m.leadInUci,
    }));
    const { data: inserted, error } = await sb
      .from('mistakes')
      .upsert(rows, { onConflict: 'user_id,game_id,ply', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;

    const newMistakes = (inserted ?? []) as { id: string }[];
    created = newMistakes.length;
    if (newMistakes.length) {
      const cards = newMistakes.map((mi) => ({ user_id: userId, mistake_id: mi.id }));
      const { error: cardErr } = await sb
        .from('review_cards')
        .upsert(cards, { onConflict: 'user_id,mistake_id', ignoreDuplicates: true });
      if (cardErr) throw cardErr;
    }
  }

  const { error: upErr } = await sb
    .from('games')
    .update({ analyzed_at: new Date().toISOString() })
    .eq('id', gameId);
  if (upErr) throw upErr;
  return created;
}
