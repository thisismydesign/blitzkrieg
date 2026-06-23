import { useEffect, useRef, useState } from 'react';
import type { EngineState } from '../chess/engine';
import { fmtMs } from '../format';

/** Live progress bar shown while practising: timer, move count, errors. */
export function StatsBar({ state }: { state: EngineState }) {
  const start = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const running = state.status === 'playing';

  useEffect(() => {
    if (!running) return;
    if (start.current == null) start.current = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - (start.current ?? 0)), 100);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="statsbar">
      <span>⏱ {fmtMs(elapsed)}</span>
      <span>
        Move {Math.min(state.userMovesDone + (state.isUserTurn ? 1 : 0), state.totalUserMoves)}/
        {state.totalUserMoves}
      </span>
      <span className={state.errorsThisMove ? 'statsbar-err' : ''}>✗ {state.errorsThisMove}</span>
    </div>
  );
}
