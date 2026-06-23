import { Chess } from 'chess.js';
import type { Opening, PracticeStats, Side } from '../types';

export interface ErrorHint {
  /** Canonical SAN of the move the user should have played. */
  expectedSan: string;
  from: string;
  to: string;
}

export interface EngineState {
  openingId: string;
  openingName: string;
  openingTag: string;
  fen: string;
  orientation: Side;
  status: 'playing' | 'finished';
  isUserTurn: boolean;
  userMovesDone: number;
  totalUserMoves: number;
  /** Wrong attempts on the move currently being played. */
  errorsThisMove: number;
  errorHint: ErrorHint | null;
  /** Last move applied to the board, for highlighting. */
  lastMove: { from: string; to: string } | null;
  /** The move the user should play now (the hint answer); null off-turn. */
  expected: { from: string; to: string; san: string } | null;
  stats: PracticeStats | null;
}

export interface AttemptResult {
  /** The move was the expected opening move and was applied. */
  accepted: boolean;
  /** The move was a legal chess move (vs. an impossible drag). */
  legal: boolean;
}

const sideAt = (index: number): Side => (index % 2 === 0 ? 'white' : 'black');

/**
 * Drives a single opening practice: validates user moves against a fixed line,
 * auto-plays the opponent, and records per-move timing and accuracy.
 *
 * Pure of any UI — the React layer renders `state()` and calls `tryUserMove` /
 * `playOpponent`. `now` is injectable so timing is testable.
 */
export class PracticeEngine {
  private readonly game = new Chess();
  private readonly moves: string[];
  private readonly userSide: Side;
  private readonly now: () => number;

  private index = 0;
  private readonly userStartIndex: number;
  private userTurnStart = 0;
  private moveTimes: number[] = [];
  private errorCounts: number[] = [];
  private errorsThisMove = 0;
  private _errorHint: ErrorHint | null = null;
  private _lastMove: { from: string; to: string } | null = null;
  private _status: 'playing' | 'finished' = 'playing';
  private _stats: PracticeStats | null = null;

  constructor(
    private readonly opening: Opening,
    now: () => number = () => performance.now(),
  ) {
    this.moves = opening.moves;
    this.userSide = opening.userSide;
    this.now = now;
    // The user starts playing right after the opponent's first reply, so when
    // playing White their opening move and Black's reply are auto-played first
    // (mirroring how White's first move is shown when the user plays Black).
    this.userStartIndex = this.userSide === 'white' ? 2 : 1;
    this.checkFinished();
    this.maybeStartTimer();
  }

  private isUserMoveIndex(i: number): boolean {
    return sideAt(i) === this.userSide && i >= this.userStartIndex;
  }

  private isUserTurn(): boolean {
    return this._status === 'playing' && this.index < this.moves.length && this.isUserMoveIndex(this.index);
  }

  private maybeStartTimer(): void {
    if (this.isUserTurn()) this.userTurnStart = this.now();
  }

  private checkFinished(): void {
    if (this.index >= this.moves.length && this._status === 'playing') {
      this._status = 'finished';
      this._stats = this.computeStats();
    }
  }

  private computeStats(): PracticeStats {
    const userMoves = this.moveTimes.length;
    const cleanMoves = this.errorCounts.filter((e) => e === 0).length;
    const errors = this.errorCounts.reduce((a, b) => a + b, 0);
    const totalMs = this.moveTimes.reduce((a, b) => a + b, 0);
    return {
      openingId: this.opening.id,
      opening: this.opening.name,
      userMoves,
      cleanMoves,
      errors,
      accuracy: userMoves ? cleanMoves / userMoves : 1,
      totalMs,
      avgMs: userMoves ? totalMs / userMoves : 0,
      fastestMs: userMoves ? Math.min(...this.moveTimes) : 0,
    };
  }

  /** Auto-play the next opponent move. No-op if it's the user's turn. */
  playOpponent(): boolean {
    if (!(this._status === 'playing' && this.index < this.moves.length) || this.isUserMoveIndex(this.index)) {
      return false;
    }
    const m = this.game.move(this.moves[this.index]);
    this._lastMove = { from: m.from, to: m.to };
    this.index += 1;
    this.checkFinished();
    this.maybeStartTimer();
    return true;
  }

  /** Attempt a user move from one square to another. */
  tryUserMove(from: string, to: string): AttemptResult {
    if (!this.isUserTurn()) return { accepted: false, legal: false };

    const probe = new Chess(this.game.fen());
    let userMove;
    try {
      userMove = probe.move({ from, to, promotion: 'q' });
    } catch {
      return { accepted: false, legal: false }; // not a legal chess move → snap back
    }

    const expected = new Chess(this.game.fen()).move(this.moves[this.index]);
    const samePromotion = (userMove.promotion ?? '') === (expected.promotion ?? '');

    if (userMove.from === expected.from && userMove.to === expected.to && samePromotion) {
      this.moveTimes.push(this.now() - this.userTurnStart);
      this.errorCounts.push(this.errorsThisMove);
      this.errorsThisMove = 0;
      this._errorHint = null;
      this.game.move(this.moves[this.index]);
      this._lastMove = { from: expected.from, to: expected.to };
      this.index += 1;
      this.checkFinished();
      this.maybeStartTimer();
      return { accepted: true, legal: true };
    }

    // Legal move, but not the opening move: reject and show the correct one.
    this.errorsThisMove += 1;
    this._errorHint = { expectedSan: expected.san, from: expected.from, to: expected.to };
    return { accepted: false, legal: true };
  }

  /** The expected move now (used for hints); null when it isn't the user's turn. */
  private expectedMove(): { from: string; to: string; san: string } | null {
    if (!this.isUserTurn()) return null;
    const m = new Chess(this.game.fen()).move(this.moves[this.index]);
    return { from: m.from, to: m.to, san: m.san };
  }

  state(): EngineState {
    let total = 0;
    for (let i = 0; i < this.moves.length; i++) if (this.isUserMoveIndex(i)) total++;
    return {
      openingId: this.opening.id,
      openingName: this.opening.name,
      openingTag: this.opening.tag,
      fen: this.game.fen(),
      orientation: this.userSide,
      status: this._status,
      isUserTurn: this.isUserTurn(),
      userMovesDone: this.moveTimes.length,
      totalUserMoves: total,
      errorsThisMove: this.errorsThisMove,
      errorHint: this._errorHint,
      lastMove: this._lastMove,
      expected: this.expectedMove(),
      stats: this._stats,
    };
  }
}
