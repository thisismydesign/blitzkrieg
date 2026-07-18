import {
  analyzeGame,
  type Color,
  type Eval,
  parseGame,
  sideToMove,
  toEpd,
} from '@blitzkrieg/chess-core';
import { type Analyzer, DEFAULT_DEPTH, Engine } from '../engine/stockfish';
import { getCachedEvals, persistEval, persistMistakes } from '../data/analysis';
import type { GameRow } from '../data/rows';

/**
 * Analyse one game and persist evals + mistakes. Positions are looked up in the
 * global cache first (shared/opening positions are only ever computed once);
 * fresh evals are written back. `onPosition` fires once per position (cached or
 * computed) so callers can drive a progress bar.
 */
export async function analyzeAndStoreGame(
  game: GameRow,
  engine: Analyzer,
  userId: string,
  depth = DEFAULT_DEPTH,
  onPosition?: () => void,
): Promise<number> {
  const userColor: Color = game.user_color === 'black' ? 'b' : 'w';

  const nodes = parseGame(game.pgn);
  const cache = await getCachedEvals(nodes.map((n) => n.epd));

  const analyze = async (fen: string, d?: number): Promise<Eval> => {
    const a = await engine.analyse(fen, d ?? depth);
    const ev: Eval = { cp: a.cp, mate: a.mate, bestUci: a.bestUci };
    const epd = toEpd(fen);
    cache.set(epd, ev); // dedupe repeated positions within this game
    await persistEval(epd, fen, sideToMove(fen), a);
    return ev;
  };

  const { mistakes } = await analyzeGame(game.pgn, userColor, {
    analyze,
    getCached: (epd) => cache.get(epd),
    depth,
    onEval: () => onPosition?.(),
  });

  return persistMistakes(game.id, userId, mistakes);
}

export interface AnalysisProgress {
  gamesDone: number;
  gamesTotal: number;
  /** Positions evaluated so far, across all games in this batch. */
  positionsDone: number;
  /** Total positions in this batch (known up front). */
  positionsTotal: number;
  mistakes: number;
  currentGame?: GameRow;
}

/** Analyse a batch of games with one shared engine, reporting per-position progress. */
export async function analyzeGames(
  games: GameRow[],
  userId: string,
  onProgress?: (p: AnalysisProgress) => void,
  depth = DEFAULT_DEPTH,
): Promise<number> {
  // Count positions up front so the progress bar is smooth (parsing is cheap).
  const positionsTotal = games.reduce((sum, g) => sum + parseGame(g.pgn).length, 0);

  const engine = new Engine();
  let mistakes = 0;
  let positionsDone = 0;

  const report = (gamesDone: number, currentGame?: GameRow) =>
    onProgress?.({
      gamesDone,
      gamesTotal: games.length,
      positionsDone,
      positionsTotal,
      mistakes,
      currentGame,
    });

  try {
    for (let i = 0; i < games.length; i++) {
      report(i, games[i]);
      mistakes += await analyzeAndStoreGame(games[i], engine, userId, depth, () => {
        positionsDone++;
        report(i, games[i]);
      });
    }
    report(games.length);
    return mistakes;
  } finally {
    engine.terminate();
  }
}
