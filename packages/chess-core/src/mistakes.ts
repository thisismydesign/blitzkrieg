import { classify, winFrac } from './classify';
import { uciToSan } from './pgn';
import { phaseOf } from './phase';
import type { Color, Eval, GameNode, MistakeInput, Severity } from './types';

const SEVERITY_RANK: Record<Severity, number> = { inaccuracy: 0, mistake: 1, blunder: 2 };

export interface DetectOptions {
  /** Lowest severity to keep. Default 'mistake' (drills mistakes + blunders). */
  minSeverity?: Severity;
}

/**
 * Detect the user's mistakes from a parsed game and a per-node evaluation.
 *
 * `evals` is index-aligned with `nodes` (one eval per position, from that
 * position's side-to-move POV; `null` when unavailable). For a user move at ply
 * `p`:
 *   winBefore = winFrac(eval[p])          — best line, user to move
 *   winAfter  = 1 - winFrac(eval[p+1])    — after the user's actual move
 * The correct move to drill is `eval[p].bestUci`.
 */
export function detectMistakes(
  nodes: GameNode[],
  evals: (Eval | null)[],
  userColor: Color,
  opts: DetectOptions = {},
): MistakeInput[] {
  const min = SEVERITY_RANK[opts.minSeverity ?? 'mistake'];
  const out: MistakeInput[] = [];

  for (let p = 0; p < nodes.length - 1; p++) {
    const node = nodes[p];
    if (node.sideToMove !== userColor || node.moveUci == null) continue;

    const before = evals[p];
    const after = evals[p + 1];
    if (!before || !after || !before.bestUci) continue;

    const winBefore = winFrac(before);
    const winAfter = 1 - winFrac(after);
    const cls = classify(winBefore, winAfter);
    if (!cls || SEVERITY_RANK[cls.severity] < min) continue;

    // If the user actually played the engine's best move, it isn't a mistake
    // (guards against eval noise producing a "drop" on the top move).
    if (before.bestUci === node.moveUci) continue;

    out.push({
      ply: p,
      epd: node.epd,
      fen: node.fen,
      sideToMove: node.sideToMove,
      playedUci: node.moveUci,
      playedSan: node.moveSan,
      bestUci: before.bestUci,
      bestSan: uciToSan(node.fen, before.bestUci),
      winBefore,
      winAfter,
      winDrop: cls.winDrop,
      severity: cls.severity,
      phase: phaseOf(node.fen, p),
      leadInUci: p > 0 ? nodes[p - 1].moveUci : null,
    });
  }

  return out;
}
