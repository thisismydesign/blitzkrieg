/** Format milliseconds as a compact, human-readable duration. */
export function fmtMs(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const fmtPct = (ratio: number): string => `${Math.round(ratio * 100)}%`;
