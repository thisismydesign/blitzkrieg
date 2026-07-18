// Pure parsing of UCI engine output. Kept separate from the WASM worker so it
// can be unit-tested without loading Stockfish. Scores are from the side-to-move
// POV (matching @blitzkrieg/chess-core's Eval convention).

export interface InfoLine {
  depth?: number;
  multipv?: number;
  cp?: number;
  mate?: number;
  nodes?: number;
  /** Principal variation as UCI moves. */
  pv?: string[];
}

/** Parse one `info ...` line, or null if the line isn't an info line. */
export function parseInfo(line: string): InfoLine | null {
  const t = line.trim().split(/\s+/);
  if (t[0] !== 'info') return null;
  const info: InfoLine = {};
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        info.depth = Number(t[++i]);
        break;
      case 'multipv':
        info.multipv = Number(t[++i]);
        break;
      case 'nodes':
        info.nodes = Number(t[++i]);
        break;
      case 'score':
        if (t[i + 1] === 'cp') {
          info.cp = Number(t[i + 2]);
          i += 2;
        } else if (t[i + 1] === 'mate') {
          info.mate = Number(t[i + 2]);
          i += 2;
        }
        break;
      case 'pv':
        info.pv = t.slice(i + 1);
        i = t.length;
        break;
      default:
        break;
    }
  }
  return info;
}

/** The move from a `bestmove <uci> [ponder <uci>]` line; null for none/not-a-bestmove. */
export function parseBestmove(line: string): string | null {
  const m = line.trim().match(/^bestmove\s+(\S+)/);
  if (!m) return null;
  return m[1] === '(none)' ? null : m[1];
}

/** One principal variation from a (possibly MultiPV) search. */
export interface AnalysisLine {
  /** First move of the line (UCI). */
  uci: string;
  cp: number | null;
  mate: number | null;
}

/** The finished analysis of a position, from the side-to-move POV. */
export interface Analysis {
  bestUci: string;
  cp: number | null;
  mate: number | null;
  depth: number;
  knodes: number;
  /** Top lines, best first — one entry per MultiPV (a single entry for MultiPV=1). */
  lines: AnalysisLine[];
}

/**
 * Accumulates UCI output for one `go` search, supporting MultiPV. Keeps the
 * latest line per multipv index and finalises when the `bestmove` line arrives.
 */
export class UciCollector {
  private readonly lines = new Map<number, AnalysisLine>();
  private depth = 0;
  private nodes = 0;

  /** Feed a line; returns the Analysis once `bestmove` is seen, else null. */
  push(line: string): Analysis | null {
    const info = parseInfo(line);
    if (info) {
      if (info.pv?.length && (info.cp !== undefined || info.mate !== undefined)) {
        this.lines.set(info.multipv ?? 1, {
          uci: info.pv[0],
          cp: info.cp ?? null,
          mate: info.mate ?? null,
        });
      }
      if (info.depth !== undefined) this.depth = info.depth;
      if (info.nodes !== undefined) this.nodes = info.nodes;
      return null;
    }

    if (line.trim().startsWith('bestmove')) {
      const bm = parseBestmove(line);
      const sorted = [...this.lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      const best = sorted[0];
      return {
        bestUci: bm ?? best?.uci ?? '',
        cp: best?.cp ?? null,
        mate: best?.mate ?? null,
        depth: this.depth,
        knodes: Math.round(this.nodes / 1000),
        lines: sorted,
      };
    }
    return null;
  }
}
