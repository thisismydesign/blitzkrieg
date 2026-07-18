import type { LifetimeStats, PracticeStats } from '../types';
import { loadJSON, saveJSON } from '../storage';

const KEY = 'blitzkrieg:stats:v1';

const EMPTY: LifetimeStats = {
  openingsPlayed: 0,
  movesPlayed: 0,
  sumAccuracy: 0,
  sumMoveMs: 0,
  byOpening: {},
};

export const loadLifetime = (): LifetimeStats => loadJSON(KEY, EMPTY);

export function resetLifetime(): LifetimeStats {
  saveJSON(KEY, EMPTY);
  return EMPTY;
}

/** Fold one finished practice into the persisted lifetime totals. */
export function recordPractice(stats: PracticeStats): LifetimeStats {
  const cur = loadLifetime();
  const prev = cur.byOpening[stats.openingId];
  const byOpening = {
    ...cur.byOpening,
    [stats.openingId]: {
      id: stats.openingId,
      name: stats.opening,
      plays: (prev?.plays ?? 0) + 1,
      sumAccuracy: (prev?.sumAccuracy ?? 0) + stats.accuracy,
      moves: (prev?.moves ?? 0) + stats.userMoves,
      sumMoveMs: (prev?.sumMoveMs ?? 0) + stats.totalMs,
    },
  };
  const next: LifetimeStats = {
    openingsPlayed: cur.openingsPlayed + 1,
    movesPlayed: cur.movesPlayed + stats.userMoves,
    sumAccuracy: cur.sumAccuracy + stats.accuracy,
    sumMoveMs: cur.sumMoveMs + stats.totalMs,
    byOpening,
  };
  saveJSON(KEY, next);
  return next;
}

export interface LifetimeSummary {
  practices: number;
  movesPlayed: number;
  avgAccuracy: number;
  avgMoveMs: number;
  best: { name: string; avgAccuracy: number } | null;
  worst: { name: string; avgAccuracy: number } | null;
}

/** Derive display-ready aggregates, including best/worst opening by accuracy. */
export function summarize(s: LifetimeStats): LifetimeSummary {
  const openings = Object.values(s.byOpening);
  const ranked = openings
    .map((o) => ({ name: o.name, avgAccuracy: o.sumAccuracy / o.plays }))
    .sort((a, b) => b.avgAccuracy - a.avgAccuracy);
  return {
    practices: s.openingsPlayed,
    movesPlayed: s.movesPlayed,
    avgAccuracy: s.openingsPlayed ? s.sumAccuracy / s.openingsPlayed : 0,
    avgMoveMs: s.movesPlayed ? s.sumMoveMs / s.movesPlayed : 0,
    best: ranked.length ? ranked[0] : null,
    worst: ranked.length ? ranked[ranked.length - 1] : null,
  };
}
