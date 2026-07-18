import { Chess } from 'chess.js';
import type { AttemptOutcome } from '@blitzkrieg/chess-core';
import type { Side } from '../types';

// Drives a single mistake drill: the learner is dropped into the position before
// their mistake and must find the engine's best move. Reuses the visual-feedback
// idiom of the openings engine (green/red blips, hints) but is single-move. UI-
// agnostic and unit-tested; `now` is injectable for deterministic timing.

export interface MistakeDrillInput {
  /** Position before the user's move (the decision point). */
  fen: string;
  /** The correct move to find, in UCI. */
  bestUci: string;
  /** The opponent's move that led into this position, to highlight (or null). */
  leadInUci: string | null;
}

export interface Square {
  from: string;
  to: string;
}

export interface DrillView {
  fen: string;
  orientation: Side;
  status: 'playing' | 'solved';
  errors: number;
  usedHint: boolean;
  /** Opponent's last move, for a subtle "how we got here" highlight. */
  leadIn: Square | null;
  /** The last wrong attempt, to blip red. */
  lastWrong: Square | null;
  /** The solving move once found. */
  solved: (Square & { san: string }) | null;
  /** The piece to move — revealed by the hint button. */
  hintFrom: string | null;
}

function split(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

export class MistakeDrill {
  private readonly game: Chess;
  private readonly best: { from: string; to: string; promotion?: string };
  private readonly orientation: Side;
  private readonly now: () => number;
  private readonly startedAt: number;

  private errors = 0;
  private usedHint = false;
  private status: 'playing' | 'solved' = 'playing';
  private lastWrong: Square | null = null;
  private solved: (Square & { san: string }) | null = null;
  private hintShown = false;

  constructor(
    private readonly input: MistakeDrillInput,
    now: () => number = () => performance.now(),
  ) {
    this.game = new Chess(input.fen);
    this.best = split(input.bestUci);
    this.orientation = this.game.turn() === 'w' ? 'white' : 'black';
    this.now = now;
    this.startedAt = now();
  }

  /** Attempt a move. Illegal moves snap back without penalty; legal-but-wrong
   *  moves cost an error; the best move solves the drill. */
  tryMove(from: string, to: string): { accepted: boolean; correct: boolean; legal: boolean } {
    if (this.status === 'solved') return { accepted: false, correct: false, legal: false };

    try {
      new Chess(this.game.fen()).move({ from, to, promotion: 'q' });
    } catch {
      return { accepted: false, correct: false, legal: false };
    }

    if (from === this.best.from && to === this.best.to) {
      const applied = this.game.move({ from, to, promotion: this.best.promotion ?? 'q' });
      this.solved = { from, to, san: applied.san };
      this.status = 'solved';
      return { accepted: true, correct: true, legal: true };
    }

    this.errors += 1;
    this.lastWrong = { from, to };
    return { accepted: false, correct: false, legal: true };
  }

  /** Reveal the piece to move; marks the attempt as hinted (affects grading). */
  hint(): string {
    this.usedHint = true;
    this.hintShown = true;
    return this.best.from;
  }

  /** The graded outcome, for FSRS (see @blitzkrieg/chess-core gradeAttempt). */
  outcome(): AttemptOutcome {
    return {
      correct: this.status === 'solved',
      firstTry: this.errors === 0,
      usedHint: this.usedHint,
      elapsedMs: this.now() - this.startedAt,
    };
  }

  view(): DrillView {
    const lead = this.input.leadInUci
      ? { from: this.input.leadInUci.slice(0, 2), to: this.input.leadInUci.slice(2, 4) }
      : null;
    return {
      fen: this.game.fen(),
      orientation: this.orientation,
      status: this.status,
      errors: this.errors,
      usedHint: this.usedHint,
      leadIn: lead,
      lastWrong: this.lastWrong,
      solved: this.solved,
      hintFrom: this.hintShown ? this.best.from : null,
    };
  }
}
