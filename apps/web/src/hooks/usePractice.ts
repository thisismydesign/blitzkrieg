import { useCallback, useEffect, useReducer, useState } from 'react';
import { PracticeEngine } from '../chess/engine';
import type { AttemptResult, EngineState } from '../chess/engine';
import { SessionScheduler } from '../chess/scheduler';
import { OPENINGS } from '../chess/openings';
import type { Opening, Side, SideFilter } from '../types';

/** Pause before the opponent replies, so the move reads as a separate action. */
const OPPONENT_DELAY_MS = 250;

export interface PracticeFilters {
  side: SideFilter;
  /** Selected opening ids; empty means "all that match `side`". */
  openings: string[];
}

export interface Practice {
  state: EngineState;
  attempt: (from: string, to: string) => AttemptResult;
  /** Register a non-move mistake (wrong piece); returns the correct piece's square. */
  penalize: () => string | null;
  /** Advance to the next practice. Repeats the same opening unless the last one
   *  was perfect (or `forceNew` is set, e.g. the user skips). */
  newPractice: (forceNew?: boolean) => void;
  /** Drill a different, not-yet-mastered variation of the same side. */
  vary: () => void;
  /** Restart the current practice from the beginning. */
  restart: () => void;
  setFilters: (filters: PracticeFilters) => void;
}

/** Openings matching the current filters, with sane fallbacks. */
function pool(filters: PracticeFilters): Opening[] {
  const bySide = OPENINGS.filter((o) => filters.side === 'random' || o.userSide === filters.side);
  if (filters.openings.length === 0) return bySide;
  const selected = bySide.filter((o) => filters.openings.includes(o.id));
  return selected.length > 0 ? selected : bySide;
}

/** How many leading moves two lines share. */
function sharedPrefix(a: string[], b: string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Pick the variation closest to a reference line (most shared moves, then weight). */
export function pickVariation(choices: Opening[], reference: string[]): Opening {
  return [...choices].sort(
    (a, b) =>
      sharedPrefix(b.moves, reference) - sharedPrefix(a.moves, reference) || b.weight - a.weight,
  )[0];
}

/** Number of openings available to vary within for a given side. */
export function availableVariations(filters: PracticeFilters, side: Side): number {
  return pool(filters).filter((o) => o.userSide === side).length;
}

/** Candidates for a fresh practice. The scheduler picks a focus (new/due lines
 *  first — see scheduler.ts), which sets the side; the candidate tree is the
 *  due/unseen openings of that side, so branching steers toward fresh material. */
function freshCandidates(scheduler: SessionScheduler, filters: PracticeFilters): Opening[] {
  const focus = scheduler.pickFocus(pool(filters));
  const sideOpenings = pool(filters).filter((o) => o.userSide === focus.userSide);
  return scheduler.due(sideOpenings);
}

interface Core {
  scheduler: SessionScheduler;
  filters: PracticeFilters;
  /** Candidate openings the current engine was built from (for Restart). */
  candidates: Opening[];
  engine: PracticeEngine;
}

function buildCore(filters: PracticeFilters): Core {
  const scheduler = new SessionScheduler(pool(filters));
  const candidates = freshCandidates(scheduler, filters);
  return { scheduler, filters, candidates, engine: new PracticeEngine(candidates) };
}

export function usePractice(initial: PracticeFilters): Practice {
  const [core, setCore] = useState(() => buildCore(initial));
  const [, tick] = useReducer((x: number) => x + 1, 0);

  const state = core.engine.state();

  // Feed a finished practice into spaced repetition (no-op if unfinished).
  const recordOutcome = (scheduler: SessionScheduler, finished: EngineState) => {
    if (finished.status === 'finished' && finished.outcome) {
      scheduler.record(finished.outcome.id, finished.stats?.accuracy === 1);
    }
  };

  // Auto-play the opponent (and White's scripted intro) when it's not our turn.
  useEffect(() => {
    if (state.status !== 'playing' || state.isUserTurn) return;
    const id = setTimeout(() => {
      core.engine.playOpponent();
      tick();
    }, OPPONENT_DELAY_MS);
    return () => clearTimeout(id);
  }, [core, state.fen, state.status, state.isUserTurn]);

  const attempt = useCallback(
    (from: string, to: string) => {
      const result = core.engine.tryUserMove(from, to);
      tick();
      return result;
    },
    [core],
  );

  const newPractice = useCallback((forceNew = false) => {
    setCore((c) => {
      const finished = c.engine.state();
      recordOutcome(c.scheduler, finished);
      const perfect = finished.stats ? finished.stats.accuracy === 1 : false;
      // Imperfect run → drill the exact resolved line again until it's clean.
      const candidates =
        !forceNew && !perfect && finished.outcome
          ? [finished.outcome]
          : freshCandidates(c.scheduler, c.filters);
      return { ...c, candidates, engine: new PracticeEngine(candidates) };
    });
  }, []);

  const vary = useCallback(() => {
    setCore((c) => {
      const finished = c.engine.state();
      recordOutcome(c.scheduler, finished);
      const sideOpenings = pool(c.filters).filter((o) => o.userSide === finished.orientation);
      const fresh = sideOpenings.filter((o) => !c.scheduler.isMastered(o.id));
      const choices = fresh.length > 0 ? fresh : sideOpenings;
      const candidates = [pickVariation(choices, finished.outcome?.moves ?? [])];
      return { ...c, candidates, engine: new PracticeEngine(candidates) };
    });
  }, []);

  const restart = useCallback(() => {
    setCore((c) => ({ ...c, engine: new PracticeEngine(c.candidates) }));
  }, []);

  const penalize = useCallback(() => {
    const square = core.engine.markError();
    tick();
    return square;
  }, [core]);

  const setFilters = useCallback((filters: PracticeFilters) => setCore(buildCore(filters)), []);

  return { state, attempt, penalize, newPractice, vary, restart, setFilters };
}
