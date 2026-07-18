import { useMemo, useRef, useState } from 'react';
import { gradeAttempt } from '@blitzkrieg/chess-core';
import { useDueReviews } from '../data/hooks';
import { recordReview } from '../data/reviews';
import { MistakeDrill } from './MistakeDrill';
import { DrillBoard } from './DrillBoard';

/** Advance-to-next delay after a mistake is solved (ms). */
const NEXT_DELAY = 1400;

export function DrillSession({ onExit }: { onExit: () => void }) {
  const { data: reviews, isLoading } = useDueReviews();
  const [index, setIndex] = useState(0);
  const [, forceRender] = useState(0);
  const solvedHandled = useRef<string | null>(null);

  const current = reviews?.[index];
  const drill = useMemo(
    () =>
      current
        ? new MistakeDrill({
            fen: current.mistake.fen,
            bestUci: current.mistake.best_uci,
            leadInUci: current.mistake.lead_in_uci,
          })
        : null,
    [current],
  );

  function handleChange() {
    forceRender((n) => n + 1);
    if (!drill || !current) return;
    if (drill.view().status === 'solved' && solvedHandled.current !== current.card.id) {
      solvedHandled.current = current.card.id;
      void recordReview(current.card, gradeAttempt(drill.outcome())).catch(() => {});
      setTimeout(() => setIndex((i) => i + 1), NEXT_DELAY);
    }
  }

  if (isLoading) return <div className="loading">Loading your mistakes…</div>;
  if (!reviews || reviews.length === 0) {
    return (
      <div className="drill-done">
        <p>Nothing due to drill right now 🎉</p>
        <button onClick={onExit}>Back</button>
      </div>
    );
  }
  if (!current || !drill) {
    return (
      <div className="drill-done">
        <p>Session complete — {reviews.length} drilled. Nice work.</p>
        <button onClick={onExit}>Back</button>
      </div>
    );
  }

  const v = drill.view();
  const m = current.mistake;
  const solved = v.status === 'solved';

  return (
    <div className="drill">
      <div className="drill-top">
        <span className="muted">
          {index + 1} / {reviews.length}
        </span>
        <span className={`sev sev-${m.severity}`}>{m.severity}</span>
        <span className="spacer" />
        <button className="link-btn" onClick={onExit}>
          Exit
        </button>
      </div>

      <DrillBoard key={current.card.id} drill={drill} onChange={handleChange} />

      <div className="drill-panel">
        {!solved ? (
          <div className="play-row">
            <div className="hint muted">
              {v.orientation === 'white' ? 'White' : 'Black'} to move — play the best move.
            </div>
            <button
              className="btn-hint"
              onClick={() => {
                drill.hint();
                forceRender((n) => n + 1);
              }}
            >
              💡 Hint
            </button>
          </div>
        ) : (
          <div className="solved">
            Best was <strong>{m.best_san ?? m.best_uci}</strong>; you had played{' '}
            <strong>{m.played_san ?? m.played_uci}</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
