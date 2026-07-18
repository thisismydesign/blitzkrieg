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

/** The finished analysis of a position, from the side-to-move POV. */
export interface Analysis {
  bestUci: string;
  cp: number | null;
  mate: number | null;
  depth: number;
  knodes: number;
}

/**
 * Accumulates UCI output lines for one `go` search. Tracks the latest primary
 * (multipv 1) score/depth and finalises when the `bestmove` line arrives.
 */
export class UciCollector {
  private best: string | null = null;
  private cp: number | null = null;
  private mate: number | null = null;
  private depth = 0;
  private nodes = 0;

  /** Feed a line; returns the Analysis once `bestmove` is seen, else null. */
  push(line: string): Analysis | null {
    const info = parseInfo(line);
    if (info) {
      if (info.multipv === undefined || info.multipv === 1) {
        if (info.cp !== undefined) {
          this.cp = info.cp;
          this.mate = null;
        }
        if (info.mate !== undefined) {
          this.mate = info.mate;
          this.cp = null;
        }
        if (info.depth !== undefined) this.depth = info.depth;
        if (info.nodes !== undefined) this.nodes = info.nodes;
        if (info.pv?.length && this.best === null) this.best = info.pv[0];
      }
      return null;
    }

    if (line.trim().startsWith('bestmove')) {
      const bm = parseBestmove(line);
      return {
        bestUci: bm ?? this.best ?? '',
        cp: this.cp,
        mate: this.mate,
        depth: this.depth,
        knodes: Math.round(this.nodes / 1000),
      };
    }
    return null;
  }
}
