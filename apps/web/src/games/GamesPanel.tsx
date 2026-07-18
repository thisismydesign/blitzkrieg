import { useState } from 'react';
import { useAccounts, useAnalyze, useDueCount, useGames, useImport, useLinkChesscom } from '../data/hooks';

export function GamesPanel({ onDrill }: { onDrill: () => void }) {
  const accounts = useAccounts();
  const games = useGames();
  const due = useDueCount();
  const link = useLinkChesscom();
  const imp = useImport();
  const analyze = useAnalyze();
  const [username, setUsername] = useState('');

  const account = accounts.data?.[0];
  const unanalyzed = games.data?.filter((g) => !g.analyzed_at).length ?? 0;
  const dueCount = due.data ?? 0;

  if (!account) {
    return (
      <div className="games-panel">
        <h2>Drill your games</h2>
        <p className="muted">Connect your chess.com account to import your games.</p>
        <div className="connect-row">
          <input
            placeholder="chess.com username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button disabled={!username.trim() || link.isPending} onClick={() => link.mutate(username.trim())}>
            {link.isPending ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        {link.isError && <div className="error">{(link.error as Error).message}</div>}
      </div>
    );
  }

  return (
    <div className="games-panel">
      <div className="account-row">
        Connected: <strong>{account.username}</strong>
      </div>

      <div className="actions">
        <button disabled={imp.isPending} onClick={() => imp.mutate({ accountId: account.id, maxMonths: 3 })}>
          {imp.isPending ? 'Importing…' : 'Import games'}
        </button>
        <button
          disabled={analyze.isPending || unanalyzed === 0}
          onClick={() => analyze.mutate(5)}
        >
          {analyze.isPending ? 'Analyzing…' : `Analyze ${unanalyzed} game${unanalyzed === 1 ? '' : 's'}`}
        </button>
      </div>

      {imp.isError && <div className="error">{(imp.error as Error).message}</div>}
      {imp.isSuccess && <div className="muted">Imported {imp.data.imported} new game(s).</div>}
      {analyze.progress && (
        <div className="analysis-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  analyze.progress.positionsTotal
                    ? Math.round(
                        (analyze.progress.positionsDone / analyze.progress.positionsTotal) * 100,
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="muted">
            Analyzing game {Math.min(analyze.progress.gamesDone + 1, analyze.progress.gamesTotal)}/
            {analyze.progress.gamesTotal} · {analyze.progress.positionsDone}/
            {analyze.progress.positionsTotal} positions · {analyze.progress.mistakes} mistakes
          </div>
        </div>
      )}
      {analyze.isError && <div className="error">{(analyze.error as Error).message}</div>}

      <div className="stats-row">
        <div>
          <strong>{games.data?.length ?? 0}</strong> games
        </div>
        <div>
          <strong>{dueCount}</strong> due to drill
        </div>
      </div>

      <button className="btn-primary" disabled={dueCount === 0} onClick={onDrill}>
        Drill {dueCount} mistake{dueCount === 1 ? '' : 's'}
      </button>
    </div>
  );
}
