import type { Eval, Severity } from './types';

// Move classification uses Lichess's published win-probability model rather than
// raw centipawn thresholds (the same centipawn swing means very different things
// in an equal vs an already-decided position). Constants are pinned here; see
// docs/technical.md §7.1. Lichess notes these "might change" — re-verify against
// https://lichess.org/page/accuracy periodically.

/** Lichess winning-chances decay constant. */
export const WIN_PERCENT_K = 0.00368208;

/** Win% (0..100) for the side to move, from a centipawn eval (their POV). */
export function winPercentFromCp(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_PERCENT_K * cp)) - 1);
}

/** Winning chance as a fraction (0..1) for the side to move, from a full eval. */
export function winFrac(ev: Eval): number {
  if (ev.mate != null) return ev.mate > 0 ? 1 : 0;
  if (ev.cp != null) return winPercentFromCp(ev.cp) / 100;
  return 0.5;
}

/** Lichess per-move accuracy (0..100). Inputs are the mover's win% (0..100). */
export function accuracyPercent(winBefore: number, winAfter: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/** Drop in winning chances (fractions 0..1) at which each label applies. */
export const SEVERITY_THRESHOLDS = {
  inaccuracy: 0.1,
  mistake: 0.2,
  blunder: 0.3,
} as const;

export interface Classification {
  severity: Severity;
  /** winBefore - winAfter (0..1). */
  winDrop: number;
}

/**
 * Classify a move by the drop in the mover's winning chances (each 0..1).
 * Applies the Lichess guard: no "blunder" once you were already losing
 * (winBefore below the blunder threshold) — a lost position can't blunder into a
 * bigger loss. Returns null when the move is within tolerance.
 */
export function classify(winBefore: number, winAfter: number): Classification | null {
  const winDrop = winBefore - winAfter;
  if (winDrop >= SEVERITY_THRESHOLDS.blunder && winBefore >= SEVERITY_THRESHOLDS.blunder) {
    return { severity: 'blunder', winDrop };
  }
  if (winDrop >= SEVERITY_THRESHOLDS.mistake) return { severity: 'mistake', winDrop };
  if (winDrop >= SEVERITY_THRESHOLDS.inaccuracy) return { severity: 'inaccuracy', winDrop };
  return null;
}
