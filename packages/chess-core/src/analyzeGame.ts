import { parseGame } from './pgn';
import { detectMistakes, type DetectOptions } from './mistakes';
import type { Color, Eval, GameNode, MistakeInput } from './types';

/** Analyse a single position, returning an eval + best move (side-to-move POV). */
export type AnalyzeFn = (fen: string, depth?: number) => Promise<Eval>;

export interface AnalyzeGameOptions extends DetectOptions {
  /** Runs the engine on one position (e.g. the Stockfish Web Worker client). */
  analyze: AnalyzeFn;
  /** Optional cache lookup by EPD; return a hit to skip the engine. */
  getCached?: (epd: string) => Eval | null | undefined;
  depth?: number;
  /** Called after each position is evaluated — for progress + persisting the cache. */
  onEval?: (node: GameNode, ev: Eval, fromCache: boolean) => void | Promise<void>;
}

export interface GameAnalysis {
  nodes: GameNode[];
  evals: Eval[];
  mistakes: MistakeInput[];
}

/**
 * Evaluate every position of a game (using the cache where possible) and derive
 * the user's mistakes. Evaluating a position at most once — combined with a
 * global EPD-keyed cache — means shared/opening positions are only computed once
 * across all games and users. Positions are evaluated in order so a resumable
 * queue can persist progress via `onEval`.
 */
export async function analyzeGame(
  pgn: string,
  userColor: Color,
  opts: AnalyzeGameOptions,
): Promise<GameAnalysis> {
  const nodes = parseGame(pgn);
  const evals: Eval[] = [];

  for (const node of nodes) {
    const cached = opts.getCached?.(node.epd);
    if (cached) {
      evals.push(cached);
      await opts.onEval?.(node, cached, true);
      continue;
    }
    const ev = await opts.analyze(node.fen, opts.depth);
    evals.push(ev);
    await opts.onEval?.(node, ev, false);
  }

  const mistakes = detectMistakes(nodes, evals, userColor, { minSeverity: opts.minSeverity });
  return { nodes, evals, mistakes };
}
