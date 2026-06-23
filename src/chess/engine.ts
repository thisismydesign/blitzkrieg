import { Chess } from 'chess.js';
import type { Opening, PracticeStats, Side } from '../types';

export interface ErrorHint {
  expectedSan: string;
  from: string;
  to: string;
  /** Which part of the correct move to reveal: the piece or its destination. */
  highlight: 'from' | 'to';
}

export interface Move {
  from: string;
  to: string;
}

export interface EngineState {
  orientation: Side;
  fen: string;
  status: 'playing' | 'finished';
  isUserTurn: boolean;
  userMovesDone: number;
  /** Wrong attempts on the move currently being played. */
  errorsThisMove: number;
  errorHint: ErrorHint | null;
  /** Last move applied to the board, for highlighting. */
  lastMove: Move | null;
  /** A correct move the user could play now (top-weighted) — for hints. */
  expected: (Move & { san: string }) | null;
  /** Squares the user may legitimately move a piece from right now. */
  correctFroms: string[];
  /** The opening the line has resolved to, known once finished. */
  outcome: Opening | null;
  stats: PracticeStats | null;
}

export interface AttemptResult {
  /** The move matched one of the correct continuations and was applied. */
  accepted: boolean;
  /** The move was a legal chess move (vs. an impossible drag). */
  legal: boolean;
  /** The square the accepted move landed on. */
  played?: Move;
  /** Other moves that would also have been correct here (different openings). */
  alternatives?: Move[];
  /** The square to reveal as a hint after a wrong move (the correct square). */
  hint?: { square: string };
}

interface NextMove {
  san: string;
  from: string;
  to: string;
  weight: number;
}

const sideAt = (index: number): Side => (index % 2 === 0 ? 'white' : 'black');

/**
 * Drives an opening practice over a set of candidate openings that share a side.
 *
 * The candidates form a move tree: at each ply the line can branch. When it's the
 * user's turn any move that continues a still-viable opening is correct, and the
 * one played narrows the candidates. Opponent (and the scripted White intro) moves
 * are chosen randomly among viable continuations, weighted by opening weight, so
 * common replies appear more often. When the candidates run out of moves the line
 * has resolved to one opening.
 */
export class PracticeEngine {
  private readonly game = new Chess();
  private readonly userSide: Side;
  private readonly userStartIndex: number;
  private readonly now: () => number;
  private readonly rng: () => number;

  private viable: Opening[];
  private index = 0;
  private userTurnStart = 0;
  private moveTimes: number[] = [];
  private errorCounts: number[] = [];
  private errorsThisMove = 0;
  private _errorHint: ErrorHint | null = null;
  private _lastMove: Move | null = null;
  private _status: 'playing' | 'finished' = 'playing';
  private _stats: PracticeStats | null = null;
  private _outcome: Opening | null = null;

  constructor(
    candidates: Opening[],
    now: () => number = () => performance.now(),
    rng: () => number = Math.random,
  ) {
    if (candidates.length === 0) throw new Error('PracticeEngine needs a candidate opening');
    this.viable = candidates;
    this.userSide = candidates[0].userSide;
    this.now = now;
    this.rng = rng;
    // The user starts after the opponent's first reply; for White their own first
    // move and Black's reply are auto-played first.
    this.userStartIndex = this.userSide === 'white' ? 2 : 1;
    this.checkFinished();
    this.maybeStartTimer();
  }

  private isUserMoveIndex(i: number): boolean {
    return sideAt(i) === this.userSide && i >= this.userStartIndex;
  }

  private continuations(): Opening[] {
    return this.viable.filter((o) => o.moves.length > this.index);
  }

  private isUserTurn(): boolean {
    return this._status === 'playing' && this.continuations().length > 0 && this.isUserMoveIndex(this.index);
  }

  /** Distinct next moves across viable openings, with summed weights. */
  private nextMoves(): NextMove[] {
    const bySan = new Map<string, NextMove>();
    for (const o of this.continuations()) {
      const san = o.moves[this.index];
      let entry = bySan.get(san);
      if (!entry) {
        const m = new Chess(this.game.fen()).move(san);
        entry = { san, from: m.from, to: m.to, weight: 0 };
        bySan.set(san, entry);
      }
      entry.weight += o.weight;
    }
    return [...bySan.values()].sort((a, b) => b.weight - a.weight);
  }

  private maybeStartTimer(): void {
    if (this.isUserTurn()) this.userTurnStart = this.now();
  }

  private checkFinished(): void {
    if (this.continuations().length === 0 && this._status === 'playing') {
      this._status = 'finished';
      this._outcome = this.viable.slice().sort((a, b) => b.weight - a.weight)[0] ?? null;
      this._stats = this.computeStats();
    }
  }

  private computeStats(): PracticeStats {
    const userMoves = this.moveTimes.length;
    const cleanMoves = this.errorCounts.filter((e) => e === 0).length;
    const errors = this.errorCounts.reduce((a, b) => a + b, 0);
    const totalMs = this.moveTimes.reduce((a, b) => a + b, 0);
    return {
      openingId: this._outcome?.id ?? '',
      opening: this._outcome?.name ?? '',
      userMoves,
      cleanMoves,
      errors,
      accuracy: userMoves ? cleanMoves / userMoves : 1,
      totalMs,
      avgMs: userMoves ? totalMs / userMoves : 0,
      fastestMs: userMoves ? Math.min(...this.moveTimes) : 0,
    };
  }

  private advance(picked: NextMove): void {
    this.game.move(picked.san);
    this._lastMove = { from: picked.from, to: picked.to };
    this.viable = this.continuations().filter((o) => o.moves[this.index] === picked.san);
    this.index += 1;
    this.checkFinished();
    this.maybeStartTimer();
  }

  /** Auto-play the next opponent (or scripted White intro) move. */
  playOpponent(): boolean {
    if (this._status === 'finished' || this.isUserTurn()) return false;
    const options = this.nextMoves();
    if (options.length === 0) return false;
    const total = options.reduce((a, o) => a + o.weight, 0);
    let r = this.rng() * total;
    let pick = options[options.length - 1];
    for (const o of options) {
      r -= o.weight;
      if (r < 0) {
        pick = o;
        break;
      }
    }
    this.advance(pick);
    return true;
  }

  /** Attempt a user move from one square to another. */
  tryUserMove(from: string, to: string): AttemptResult {
    if (!this.isUserTurn()) return { accepted: false, legal: false };

    let userMove;
    try {
      userMove = new Chess(this.game.fen()).move({ from, to, promotion: 'q' });
    } catch {
      return { accepted: false, legal: false }; // not a legal chess move → snap back
    }

    const options = this.nextMoves();
    const matched = options.find((o) => o.from === userMove.from && o.to === userMove.to);

    if (matched) {
      this.moveTimes.push(this.now() - this.userTurnStart);
      this.errorCounts.push(this.errorsThisMove);
      this.errorsThisMove = 0;
      this._errorHint = null;
      const alternatives = options
        .filter((o) => o !== matched)
        .map((o) => ({ from: o.from, to: o.to }));
      this.advance(matched);
      return { accepted: true, legal: true, played: { from: matched.from, to: matched.to }, alternatives };
    }

    // Legal move with a book piece but the wrong square: point at the right square.
    this.errorsThisMove += 1;
    const samePiece = options.find((o) => o.from === userMove.from);
    const move = samePiece ?? options[0];
    const which = samePiece ? 'to' : 'from';
    this.setHint(move, which);
    return {
      accepted: false,
      legal: true,
      hint: move ? { square: which === 'to' ? move.to : move.from } : undefined,
    };
  }

  /** Register grabbing the wrong piece. Returns the correct piece's square. */
  markError(): string | null {
    if (!this.isUserTurn()) return null;
    this.errorsThisMove += 1;
    const move = this.nextMoves()[0];
    this.setHint(move, 'from');
    return move ? move.from : null;
  }

  private setHint(move: NextMove | undefined, highlight: 'from' | 'to'): void {
    if (move) this._errorHint = { expectedSan: move.san, from: move.from, to: move.to, highlight };
  }

  state(): EngineState {
    const userTurn = this.isUserTurn();
    const moves = userTurn ? this.nextMoves() : [];
    const best = moves[0];
    return {
      orientation: this.userSide,
      fen: this.game.fen(),
      status: this._status,
      isUserTurn: userTurn,
      userMovesDone: this.moveTimes.length,
      errorsThisMove: this.errorsThisMove,
      errorHint: this._errorHint,
      lastMove: this._lastMove,
      expected: best ? { from: best.from, to: best.to, san: best.san } : null,
      correctFroms: [...new Set(moves.map((m) => m.from))],
      outcome: this._outcome,
      stats: this._stats,
    };
  }
}
