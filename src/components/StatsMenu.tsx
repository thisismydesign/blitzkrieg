import { useState } from 'react';
import { Modal } from './Options';
import { loadLifetime, resetLifetime, summarize } from '../stats/lifetime';
import { fmtMs, fmtPct } from '../format';

export function StatsMenu({ onClose }: { onClose: () => void }) {
  const [lifetime, setLifetime] = useState(loadLifetime);
  const s = summarize(lifetime);

  return (
    <Modal title="Your stats" onClose={onClose}>
      {s.practices === 0 ? (
        <p className="note">No practices yet — finish a line to start tracking.</p>
      ) : (
        <>
          <div className="summary-grid">
            <Cell label="Avg accuracy" value={fmtPct(s.avgAccuracy)} />
            <Cell label="Openings played" value={String(s.practices)} />
            <Cell label="Moves played" value={String(s.movesPlayed)} />
            <Cell label="Avg / move" value={fmtMs(s.avgMoveMs)} />
          </div>
          {s.best && s.worst && (
            <div className="best-worst">
              <div>
                <span className="tone-good">Best</span> {s.best.name} ·{' '}
                {fmtPct(s.best.avgAccuracy)}
              </div>
              <div>
                <span className="tone-bad">Weakest</span> {s.worst.name} ·{' '}
                {fmtPct(s.worst.avgAccuracy)}
              </div>
            </div>
          )}
          <button className="btn-skip" onClick={() => setLifetime(resetLifetime())}>
            Reset stats
          </button>
        </>
      )}
    </Modal>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
