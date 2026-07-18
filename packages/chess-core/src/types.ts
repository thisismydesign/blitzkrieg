export type Color = 'w' | 'b';
export type Severity = 'inaccuracy' | 'mistake' | 'blunder';
export type Phase = 'opening' | 'middlegame' | 'endgame';

/** A single position along a game's actual line. */
export interface GameNode {
  /** 0-based ply index — this is the position BEFORE ply `ply`. */
  ply: number;
  /** Full FEN of the position. */
  fen: string;
  /** EPD = first 4 FEN fields (placement, side, castling, en-passant). */
  epd: string;
  /** Side to move in this position. */
  sideToMove: Color;
  /** The move actually played from this position (UCI / long algebraic), null at the final node. */
  moveUci: string | null;
  /** The move actually played, in SAN. */
  moveSan: string | null;
}

/** An engine evaluation of a position, from the side-to-move POV. */
export interface Eval {
  /** Centipawns (side-to-move POV); null when a forced mate was found. */
  cp: number | null;
  /** Signed mate distance (side-to-move POV); null when `cp` is set. */
  mate: number | null;
  /** The engine's best move (UCI) in this position, when known. */
  bestUci?: string;
}

/** A detected mistake, ready to persist as a `mistakes` row + drill. */
export interface MistakeInput {
  ply: number;
  epd: string;
  fen: string;
  sideToMove: Color;
  playedUci: string;
  playedSan: string | null;
  bestUci: string;
  bestSan: string | null;
  /** Winning chance (0..1) for the mover with best play. */
  winBefore: number;
  /** Winning chance (0..1) for the mover after the move actually played. */
  winAfter: number;
  /** winBefore - winAfter. */
  winDrop: number;
  severity: Severity;
  phase: Phase;
  /** The single opponent ply to auto-animate as context, or null (first move). */
  leadInUci: string | null;
}
