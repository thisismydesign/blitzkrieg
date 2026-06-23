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
  newPractice: () => void;
  setFilters: (filters: PracticeFilters) => void;
}

/** Pick the openings matching the current filters, with sane fallbacks. */
function pool(filters: PracticeFilters): Opening[] {
  const bySide = OPENINGS.filter((o) => filters.side === 'random' || o.userSide === filters.side);
  if (filters.openings.length === 0) return bySide;
  const selected = bySide.filter((o) => filters.openings.includes(o.id));
  return selected.length > 0 ? selected : bySide;
}

interface Core {
  scheduler: SessionScheduler;
  engine: PracticeEngine;
}

function buildCore(filters: PracticeFilters): Core {
  const scheduler = new SessionScheduler(pool(filters));
  return { scheduler, engine: new PracticeEngine(scheduler.next()) };
}

export function usePractice(initial: PracticeFilters): Practice {
  const [core, setCore] = useState(() => buildCore(initial));
  const [, tick] = useReducer((x: number) => x + 1, 0);

  const state = core.engine.state();

  // Auto-play the opponent (and White's scripted intro) whenever it's not the
  // user's turn.
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

  const newPractice = useCallback(() => {
    setCore((c) => ({ scheduler: c.scheduler, engine: new PracticeEngine(c.scheduler.next()) }));
  }, []);

  const setFilters = useCallback((filters: PracticeFilters) => setCore(buildCore(filters)), []);

  return { state, attempt, newPractice, setFilters };
}
