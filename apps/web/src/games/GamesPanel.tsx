import { useState } from 'react';
import {
  useAccounts,
  useAnalyze,
  useDueCount,
  useGamesCount,
  useImport,
  useLinkChesscom,
  useUnanalyzedCount,
} from '../data/hooks';

export function GamesPanel({ onDrill }: { onDrill: () => void }) {
  const accounts = useAccounts();
  const gamesCount = useGamesCount();
  const unanalyzedCount = useUnanalyzedCount();
  const due = useDueCount();
  const link = useLinkChesscom();
  const imp = useImport();
  const analyze = useAnalyze();
  const [username, setUsername] = useState('');

  const account = accounts.data?.[0];
  const unanalyzed = unanalyzedCount.data ?? 0;
  const totalGames = gamesCount.data ?? 0;
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
        {analyze.isPending ? (
          <button className="btn-stop" onClick={() => analyze.stop()}>
            Stop
          </button>
        ) : (
          <button disabled={unanalyzed === 0} onClick={() => analyze.mutate()}>
            Analyze all {unanalyzed} game{unanalyzed === 1 ? '' : 's'}
          </button>
        )}
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
            {analyze.progress.skipped > 0 ? ` · ${analyze.progress.skipped} skipped` : ''}
          </div>
        </div>
      )}
      {analyze.isSuccess && analyze.data && !analyze.progress && (
        <div className="muted">
          Analyzed — {analyze.data.mistakes} new mistake{analyze.data.mistakes === 1 ? '' : 's'}
          {analyze.data.skipped > 0 ? `, ${analyze.data.skipped} positions skipped` : ''}
          {analyze.data.failedGames > 0 ? `, ${analyze.data.failedGames} games failed` : ''}.
        </div>
      )}
      {analyze.isError && <div className="error">{(analyze.error as Error).message}</div>}

      <div className="stats-row">
        <div>
          <strong>{totalGames}</strong> games
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
