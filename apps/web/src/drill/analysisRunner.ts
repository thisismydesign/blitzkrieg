import {
  analyzeGame,
  type Color,
  type Eval,
  parseGame,
  sideToMove,
  toEpd,
} from '@blitzkrieg/chess-core';
import { DEFAULT_DEPTH, Engine } from '../engine/stockfish';
import { getCachedEvals, persistEval, persistMistakes } from '../data/analysis';
import type { GameRow } from '../data/rows';

/**
 * Analyse one game with the engine and persist evals + mistakes. Positions are
 * looked up in the global cache first (so shared/opening positions are only ever
 * computed once); freshly-computed evals are written back. Returns the number of
 * new mistakes recorded.
 */
export async function analyzeAndStoreGame(
  game: GameRow,
  engine: Engine,
  userId: string,
  depth = DEFAULT_DEPTH,
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
  });

  return persistMistakes(game.id, userId, mistakes);
}

export interface AnalysisProgress {
  done: number;
  total: number;
  mistakes: number;
  current?: GameRow;
}

/** Analyse a batch of games with a single shared engine, reporting progress. */
export async function analyzeGames(
  games: GameRow[],
  userId: string,
  onProgress?: (p: AnalysisProgress) => void,
  depth = DEFAULT_DEPTH,
): Promise<number> {
  const engine = new Engine();
  let mistakes = 0;
  try {
    for (let i = 0; i < games.length; i++) {
      onProgress?.({ done: i, total: games.length, mistakes, current: games[i] });
      mistakes += await analyzeAndStoreGame(games[i], engine, userId, depth);
    }
    onProgress?.({ done: games.length, total: games.length, mistakes });
    return mistakes;
  } finally {
    engine.terminate();
  }
}
