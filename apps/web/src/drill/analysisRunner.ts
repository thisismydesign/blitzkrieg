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
 * fresh evals are written back. `onPosition` fires once per position; `onSkip`
 * fires when the engine fails on a position (after its own retries) and that
 * position is skipped rather than stalling the whole run.
 */
export async function analyzeAndStoreGame(
  game: GameRow,
  engine: Analyzer,
  userId: string,
  depth = DEFAULT_DEPTH,
  onPosition?: () => void,
  onSkip?: () => void,
  signal?: AbortSignal,
): Promise<number> {
  const userColor: Color = game.user_color === 'black' ? 'b' : 'w';

  const nodes = parseGame(game.pgn);
  const cache = await getCachedEvals(nodes.map((n) => n.epd));

  const analyze = async (fen: string, d?: number): Promise<Eval> => {
    if (signal?.aborted) throw new Error('aborted');
    try {
      const a = await engine.analyse(fen, d ?? depth);
      const ev: Eval = { cp: a.cp, mate: a.mate, bestUci: a.bestUci };
      const epd = toEpd(fen);
      cache.set(epd, ev); // dedupe repeated positions within this game
      try {
        await persistEval(epd, fen, sideToMove(fen), a);
      } catch (err) {
        console.warn('[analysis] failed to persist an eval (continuing)', err);
      }
      return ev;
    } catch (err) {
      if (signal?.aborted) throw err;
      // The engine already retried with a fresh worker; skip this position (no
      // best move → detection ignores moves that need it).
      console.warn('[analysis] engine failed on a position, skipping', err);
      onSkip?.();
      return { cp: null, mate: null };
    }
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
  /** Positions skipped after repeated engine failure. */
  skipped: number;
  currentGame?: GameRow;
}

export interface AnalysisSummary {
  mistakes: number;
  skipped: number;
  failedGames: number;
}

export interface AnalyzeGamesOptions {
  depth?: number;
  /** Abort the run between positions (completed games stay persisted → resumable). */
  signal?: AbortSignal;
}

/** Analyse a batch of games with one shared engine, reporting per-position
 *  progress. Resilient: a position the engine can't handle is skipped, and a game
 *  that fails entirely is logged and skipped — the run always finishes. */
export async function analyzeGames(
  games: GameRow[],
  userId: string,
  onProgress?: (p: AnalysisProgress) => void,
  opts: AnalyzeGamesOptions = {},
): Promise<AnalysisSummary> {
  const { depth = DEFAULT_DEPTH, signal } = opts;
  // Count positions up front so the progress bar is smooth (parsing is cheap).
  const positionsTotal = games.reduce((sum, g) => sum + parseGame(g.pgn).length, 0);

  const engine = new Engine();
  let mistakes = 0;
  let positionsDone = 0;
  let skipped = 0;
  let failedGames = 0;

  const report = (gamesDone: number, currentGame?: GameRow) =>
    onProgress?.({
      gamesDone,
      gamesTotal: games.length,
      positionsDone,
      positionsTotal,
      mistakes,
      skipped,
      currentGame,
    });

  try {
    for (let i = 0; i < games.length; i++) {
      if (signal?.aborted) break;
      report(i, games[i]);
      try {
        mistakes += await analyzeAndStoreGame(
          games[i],
          engine,
          userId,
          depth,
          () => {
            positionsDone++;
            report(i, games[i]);
          },
          () => {
            skipped++;
          },
          signal,
        );
      } catch (err) {
        if (signal?.aborted) break; // clean stop mid-game (resumable)
        console.warn('[analysis] game failed, skipping', games[i].id, err);
        failedGames++;
      }
    }
    report(games.length);
    return { mistakes, skipped, failedGames };
  } finally {
    engine.terminate();
  }
}
