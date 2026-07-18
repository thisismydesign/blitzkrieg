import { useState } from 'react';
import App from './App';
import { useAuth } from './auth/useAuth';
import { signOut } from './auth/actions';
import { isSupabaseConfigured } from './lib/supabase';
import { Login } from './auth/Login';
import { GamesPanel } from './games/GamesPanel';
import { DrillSession } from './drill/DrillSession';

type Mode = 'openings' | 'games';

/** Top-level shell: switch between the curated-openings drill (the original app,
 *  no login) and the logged-in "drill my games" mode. */
export function AppShell() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('openings');
  const [drilling, setDrilling] = useState(false);

  return (
    <div className="shell">
      <nav className="shell-nav">
        <button
          className={mode === 'openings' ? 'active' : ''}
          onClick={() => {
            setMode('openings');
            setDrilling(false);
          }}
        >
          Openings
        </button>
        {isSupabaseConfigured && (
          <button className={mode === 'games' ? 'active' : ''} onClick={() => setMode('games')}>
            My games
          </button>
        )}
        <span className="spacer" />
        {isSupabaseConfigured && user && (
          <button className="link-btn" onClick={() => void signOut()}>
            Sign out
          </button>
        )}
      </nav>

      {mode === 'openings' && <App />}
      {mode === 'games' &&
        (loading ? (
          <div className="loading">…</div>
        ) : !user ? (
          <Login />
        ) : drilling ? (
          <DrillSession onExit={() => setDrilling(false)} />
        ) : (
          <GamesPanel onDrill={() => setDrilling(true)} />
        ))}
    </div>
  );
}
