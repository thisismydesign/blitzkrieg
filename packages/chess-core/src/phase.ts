import type { Phase } from './types';

/** Count non-king pieces from a FEN placement field. */
function nonKingPieceCount(fen: string): number {
  const placement = fen.split(' ')[0];
  let n = 0;
  for (const ch of placement) {
    if (/[a-z]/i.test(ch) && ch !== 'k' && ch !== 'K') n++;
  }
  return n;
}

/**
 * Heuristic game-phase for a position. MVP heuristic (the design's book-based
 * opening detection is a later refinement):
 *   - endgame  when few pieces remain (≤ 6 non-king pieces),
 *   - opening  in the first ~10 full moves (ply < 20) otherwise,
 *   - middlegame  the rest.
 */
export function phaseOf(fen: string, ply: number): Phase {
  if (nonKingPieceCount(fen) <= 6) return 'endgame';
  if (ply < 20) return 'opening';
  return 'middlegame';
}
