import type { Color } from './types';

/**
 * Normalise a FEN to its EPD position key: the first 4 space-separated fields
 * (piece placement, side to move, castling rights, en-passant square). The
 * halfmove clock and fullmove number are dropped — they don't change the set of
 * legal moves or the engine's choice, so two otherwise-identical positions share
 * one key. Castling and en-passant are KEPT: they do affect the best move.
 */
export function toEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Side to move from a FEN (the 2nd field). Defaults to white for malformed input. */
export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}
