import { useCallback, useEffect, useRef, useState } from 'react';
import { usePractice, availableVariations } from './hooks/usePractice';
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
  const { state, attempt, penalize, newPractice, vary, restart, setFilters } = usePractice({
    side: settings.side,
    openings: settings.openings,
  });

  const [round, setRound] = useState(0);
  // Each press cycles the hint: odd → the piece, even → its destination.
  const [hintPress, setHintPress] = useState(0);
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

  // "Show hint after delay": reveal the piece (same blip) after a delay.
  useEffect(() => {
    if (!settings.autoHint || !playing || !state.isUserTurn || hintPress > 0) return;
    const id = setTimeout(() => setHintPress(1), settings.autoHintSeconds * 1000);
    return () => clearTimeout(id);
  }, [settings.autoHint, settings.autoHintSeconds, playing, state.isUserTurn, state.fen, hintPress]);

  const handleAttempt = useCallback(
    (from: string, to: string) => {
      const result = attempt(from, to);
      if (result.accepted) setHintPress(0);
      return result;
    },
    [attempt],
  );

  const advance = useCallback(
    (forceNew: boolean) => {
      newPractice(forceNew);
      setHintPress(0);
      setRound((r) => r + 1);
    },
    [newPractice],
  );

  const varyNext = useCallback(() => {
    vary();
    setHintPress(0);
    setRound((r) => r + 1);
  }, [vary]);

  const restartNow = useCallback(() => {
    restart();
    setHintPress(0);
    setRound((r) => r + 1);
  }, [restart]);

  const updateSettings = useCallback(
    (nextSettings: Settings) => {
      if (
        nextSettings.side !== settings.side ||
        !sameIds(nextSettings.openings, settings.openings)
      ) {
        setFilters({ side: nextSettings.side, openings: nextSettings.openings });
        setHintPress(0);
        setRound((r) => r + 1);
      }
      setSettings(nextSettings);
      saveSettings(nextSettings);
    },
    [settings, setFilters],
  );

  // Odd press → reveal the piece; even press → reveal its destination.
  const hintBlip =
    hintPress > 0 && state.expected
      ? { square: hintPress % 2 === 1 ? state.expected.from : state.expected.to, id: hintPress }
      : null;

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

      <Board
        key={round}
        state={state}
        onAttempt={handleAttempt}
        onWrongPiece={penalize}
        hintBlip={hintBlip}
        assist={settings.assist}
      />

      <div className="panel">
        {playing && (
          <div className="play-row">
            <StatsBar key={round} state={state} />
            <button
              className="btn-hint"
              disabled={!state.isUserTurn}
              onClick={() => setHintPress((p) => p + 1)}
            >
              💡 Hint
            </button>
          </div>
        )}

        {playing && (
          <div className="hint muted">
            {state.isUserTurn ? 'Your move — play the book line.' : 'Opponent to move…'}
          </div>
        )}

        {state.status === 'finished' && state.stats && (
          <Summary
            stats={state.stats}
            canVary={
              availableVariations(
                { side: settings.side, openings: settings.openings },
                state.orientation,
              ) > 1
            }
            onNext={() => advance(true)}
            onRepeat={() => advance(false)}
            onVary={varyNext}
          />
        )}
      </div>

      {playing && (
        <div className="play-controls">
          <button className="btn-secondary" onClick={restartNow}>
            Restart
          </button>
          <button className="btn-secondary" onClick={() => advance(true)}>
            Skip
          </button>
        </div>
      )}

      {menu === 'options' && (
        <Options settings={settings} onChange={updateSettings} onClose={() => setMenu(null)} />
      )}
      {menu === 'stats' && <StatsMenu onClose={() => setMenu(null)} />}
    </div>
  );
}
