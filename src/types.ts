export type Side = 'white' | 'black';

export interface Opening {
  /** Stable id used by the scheduler. */
  id: string;
  /** Display name, e.g. "Ruy Lopez — Main Line". */
  name: string;
  /** Side the user plays; the opposite side's moves are auto-played. */
  userSide: Side;
  /**
   * Full move list in SAN, starting from White's first move and alternating
   * sides. Must be a legal sequence (validated in tests).
   */
  moves: string[];
  /**
   * Relative selection weight. Common main lines get higher weights; offbeat
   * or sub-optimal opponent lines get lower ones so they show up less often.
   */
  weight: number;
  /** Short label shown under the board, e.g. "Main line" / "Sideline". */
  tag: string;
}

export interface MoveResult {
  ok: boolean;
  /** True only when the move was the expected opening move. */
  correct: boolean;
}

export interface PracticeStats {
  openingId: string;
  opening: string;
  userMoves: number;
  /** Moves played correctly on the first attempt. */
  cleanMoves: number;
  errors: number;
  accuracy: number; // 0..1
  totalMs: number;
  avgMs: number;
  fastestMs: number;
}

export type SideFilter = 'white' | 'black' | 'random';

export interface Settings {
  /** Which colour to practise; 'random' mixes both. */
  side: SideFilter;
  /** Specific opening ids to drill; empty means "all that match `side`". */
  openings: string[];
  /** Auto-reveal the piece-to-move hint after a delay. */
  autoHint: boolean;
  /** Seconds to wait before the auto hint appears. */
  autoHintSeconds: number;
}

/** Per-opening lifetime totals, kept so averages survive across visits. */
export interface OpeningTotals {
  id: string;
  name: string;
  plays: number;
  sumAccuracy: number;
  moves: number;
  sumMoveMs: number;
}

export interface LifetimeStats {
  openingsPlayed: number;
  movesPlayed: number;
  sumAccuracy: number;
  sumMoveMs: number;
  byOpening: Record<string, OpeningTotals>;
}
