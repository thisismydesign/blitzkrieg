import { Chess } from 'chess.js';
import { sideToMove, toEpd } from './fen';
import type { GameNode } from './types';

/**
 * Parse a PGN into the sequence of positions along the actual game line.
 *
 * Node `p` holds the position BEFORE ply `p` together with the move played from
 * it; the final node is the position after the last move and has `moveUci = null`.
 * chess.com clock comments (`{[%clk ...]}`) are tolerated and ignored.
 */
export function parseGame(pgn: string): GameNode[] {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });

  const nodes: GameNode[] = moves.map((m, i) => ({
    ply: i,
    fen: m.before,
    epd: toEpd(m.before),
    sideToMove: sideToMove(m.before),
    moveUci: m.lan,
    moveSan: m.san,
  }));

  const finalFen = moves.length ? moves[moves.length - 1].after : chess.fen();
  nodes.push({
    ply: moves.length,
    fen: finalFen,
    epd: toEpd(finalFen),
    sideToMove: sideToMove(finalFen),
    moveUci: null,
    moveSan: null,
  });

  return nodes;
}

/** Convert a UCI move to SAN in the context of a FEN, or null if illegal there. */
export function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return move.san;
  } catch {
    return null;
  }
}
