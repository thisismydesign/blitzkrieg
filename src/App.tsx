import { useCallback, useEffect, useRef, useState } from 'react';
import { usePractice } from './hooks/usePractice';
import { Board } from './components/Board';
import { StatsBar } from './components/StatsBar';
import { Summary } from './components/Summary';
import { Options } from './components/Options';
import { StatsMenu } from './components/StatsMenu';
import { loadSettings, saveSettings } from './settings';
import { recordPractice } from './stats/lifetime';
import type { PracticeStats, Settings } from './types';

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const { state, attempt, newPractice, setFilters } = usePractice({
    side: settings.side,
    openings: settings.openings,
  });

  const [round, setRound] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [menu, setMenu] = useState<null | 'options' | 'stats'>(null);
  const recorded = useRef<PracticeStats | null>(null);

  const playing = state.status === 'playing';

  // Persist each finished practice into lifetime stats exactly once.
  useEffect(() => {
    if (state.status === 'finished' && state.stats && recorded.current !== state.stats) {
      recorded.current = state.stats;
      recordPractice(state.stats);
    }
  }, [state.status, state.stats]);

  // Optional auto-hint: reveal the piece to move after a delay.
  useEffect(() => {
    if (!settings.autoHint || !playing || !state.isUserTurn || hintLevel > 0) return;
    const id = setTimeout(() => setHintLevel(1), settings.autoHintSeconds * 1000);
    return () => clearTimeout(id);
  }, [settings.autoHint, settings.autoHintSeconds, playing, state.isUserTurn, state.fen, hintLevel]);

  const handleAttempt = useCallback(
    (from: string, to: string) => {
      const result = attempt(from, to);
      if (result.accepted) setHintLevel(0);
      return result;
    },
    [attempt],
  );

  const advance = useCallback(
    (forceNew: boolean) => {
      newPractice(forceNew);
      setHintLevel(0);
      setRound((r) => r + 1);
    },
    [newPractice],
  );

  const updateSettings = useCallback(
    (nextSettings: Settings) => {
      if (
        nextSettings.side !== settings.side ||
        !sameIds(nextSettings.openings, settings.openings)
      ) {
        setFilters({ side: nextSettings.side, openings: nextSettings.openings });
        setHintLevel(0);
        setRound((r) => r + 1);
      }
      setSettings(nextSettings);
      saveSettings(nextSettings);
    },
    [settings, setFilters],
  );

  const hintLabel = hintLevel === 0 ? 'Hint' : hintLevel === 1 ? 'Show target' : 'Hint shown';

  return (
    <div className="app">
      <header className="app-header">
        <h1>♞ Blitzkrieg</h1>
        <div className="header-actions">
          <button onClick={() => setMenu('stats')} aria-label="Stats">
            📊
          </button>
          <button onClick={() => setMenu('options')} aria-label="Options">
            ⚙
          </button>
        </div>
      </header>

      <div className="opening-info">
        <span className="opening-name">
          {playing ? '🎭 Mystery opening' : (state.outcome?.name ?? '')}
        </span>
        <span className={`badge badge-${state.orientation}`}>
          You play {state.orientation === 'white' ? 'White' : 'Black'}
        </span>
      </div>

      <Board
        key={round}
        state={state}
        onAttempt={handleAttempt}
        hintLevel={hintLevel}
        assist={settings.assist}
      />

      <div className="panel">
        {playing && (
          <div className="play-row">
            <StatsBar key={round} state={state} />
            <button
              className="btn-hint"
              disabled={!state.isUserTurn || hintLevel >= 2}
              onClick={() => setHintLevel((l) => Math.min(2, l + 1))}
            >
              💡 {hintLabel}
            </button>
          </div>
        )}

        {playing && (
          <div className="hint muted">
            {state.isUserTurn ? 'Your move — play the book line.' : 'Opponent to move…'}
          </div>
        )}

        {state.status === 'finished' && state.stats && (
          <Summary stats={state.stats} onNext={() => advance(false)} />
        )}
      </div>

      {playing && (
        <button className="btn-skip" onClick={() => advance(true)}>
          Skip to a new opening
        </button>
      )}

      {menu === 'options' && (
        <Options settings={settings} onChange={updateSettings} onClose={() => setMenu(null)} />
      )}
      {menu === 'stats' && <StatsMenu onClose={() => setMenu(null)} />}
    </div>
  );
}
