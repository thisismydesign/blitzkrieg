import type { PracticeStats } from '../types';
import { fmtMs, fmtPct } from '../format';

interface Props {
  stats: PracticeStats;
  onNext: () => void;
}

/** Map a 0..1 score to a colour grade used across the summary. */
function grade(score: number): { tone: 'good' | 'ok' | 'bad'; label: string } {
  if (score >= 0.9) return { tone: 'good', label: 'Excellent' };
  if (score >= 0.6) return { tone: 'ok', label: 'Good' };
  return { tone: 'bad', label: 'Keep practising' };
}

export function Summary({ stats, onNext }: Props) {
  const g = grade(stats.accuracy);
  const perfect = stats.accuracy === 1;
  const errorTone = stats.errors === 0 ? 'good' : stats.errors <= 2 ? 'ok' : 'bad';
  return (
    <div className="summary">
      <h2>{stats.opening}</h2>
      <div className={`grade grade-${g.tone}`}>{g.label}</div>
      <div className="summary-grid">
        <Stat label="Accuracy" value={fmtPct(stats.accuracy)} tone={g.tone} />
        <Stat label="Clean moves" value={`${stats.cleanMoves}/${stats.userMoves}`} />
        <Stat label="Errors" value={String(stats.errors)} tone={errorTone} />
        <Stat label="Total time" value={fmtMs(stats.totalMs)} />
        <Stat label="Avg / move" value={fmtMs(stats.avgMs)} />
        <Stat label="Fastest" value={fmtMs(stats.fastestMs)} />
      </div>
      <p className="note">
        {perfect ? 'Perfect — on to a new opening.' : 'Not perfect yet — repeat to advance.'}
      </p>
      <button className="btn-primary" onClick={onNext}>
        {perfect ? 'Next opening →' : 'Repeat opening'}
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat">
      <div className={`stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
