import { useCallback, useEffect, useReducer, useState } from 'react';
import { PracticeEngine } from '../chess/engine';
import type { AttemptResult, EngineState } from '../chess/engine';
import { SessionScheduler } from '../chess/scheduler';
import { OPENINGS } from '../chess/openings';
import type { Opening, SideFilter } from '../types';

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
  /** Advance to the next practice. Repeats the same opening unless the last one
   *  was perfect (or `forceNew` is set, e.g. the user skips). */
  newPractice: (forceNew?: boolean) => void;
  setFilters: (filters: PracticeFilters) => void;
}

/** Openings matching the current filters, with sane fallbacks. */
function pool(filters: PracticeFilters): Opening[] {
  const bySide = OPENINGS.filter((o) => filters.side === 'random' || o.userSide === filters.side);
  if (filters.openings.length === 0) return bySide;
  const selected = bySide.filter((o) => filters.openings.includes(o.id));
  return selected.length > 0 ? selected : bySide;
}

/** Start a fresh practice: the scheduler picks a weighted lead (which sets the
 *  side); the candidate tree is every pooled opening of that side, so the line
 *  can branch based on the user's moves. */
function freshEngine(scheduler: SessionScheduler, filters: PracticeFilters): PracticeEngine {
  const lead = scheduler.next();
  const candidates = pool(filters).filter((o) => o.userSide === lead.userSide);
  return new PracticeEngine(candidates);
}

interface Core {
  scheduler: SessionScheduler;
  filters: PracticeFilters;
  engine: PracticeEngine;
}

function buildCore(filters: PracticeFilters): Core {
  const scheduler = new SessionScheduler(pool(filters));
  return { scheduler, filters, engine: freshEngine(scheduler, filters) };
}

export function usePractice(initial: PracticeFilters): Practice {
  const [core, setCore] = useState(() => buildCore(initial));
  const [, tick] = useReducer((x: number) => x + 1, 0);

  const state = core.engine.state();

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
      const perfect = finished.stats ? finished.stats.accuracy === 1 : false;
      // Imperfect run → drill the exact resolved line again until it's clean.
      const engine =
        !forceNew && !perfect && finished.outcome
          ? new PracticeEngine([finished.outcome])
          : freshEngine(c.scheduler, c.filters);
      return { ...c, engine };
    });
  }, []);

  const setFilters = useCallback((filters: PracticeFilters) => setCore(buildCore(filters)), []);

  return { state, attempt, newPractice, setFilters };
}
