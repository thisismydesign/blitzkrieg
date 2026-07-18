import { type Analysis, UciCollector } from './uci';

// Browser client for the vendored Stockfish WASM build. Runs the engine in a Web
// Worker (single-threaded lite build → no COOP/COEP headers required) and drives
// it over UCI. The worker script is served from public/engine/ (see
// vite.config.ts). UCI parsing lives in ./uci and is unit-tested separately.

/** Served worker script (copied from the stockfish package by the Vite plugin). */
const ENGINE_URL = '/engine/stockfish-18-lite-single.js';

/** Stored with every cached eval so results are reproducible / re-computable. */
export const ENGINE_VERSION = 'stockfish-18-lite';

/**
 * Default search depth. Fixed (not movetime) so stored evals are reproducible.
 * Depth 12 (~2400 strength, far beyond any human) is plenty to reliably spot a
 * clearly-better move — which is all mistake detection needs — and is several
 * times faster than a deep analysis. Raise it for stronger evals at more cost.
 */
export const DEFAULT_DEPTH = 12;

/**
 * The engine seam: anything that can evaluate a position + return the best move.
 * `Engine` (Stockfish WASM) is the only implementation today, but analysis code
 * depends on this interface so a different engine can be swapped in later.
 */
export interface Analyzer {
  analyse(fen: string, depth?: number): Promise<Analysis>;
  terminate(): void;
}

export class Engine implements Analyzer {
  private worker: Worker;
  private onLine: ((line: string) => void) | null = null;
  private ready: Promise<void>;
  /** Serialises analyse() calls — one `go` search at a time per worker. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(url: string = ENGINE_URL) {
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      this.onLine?.(line);
    };
    this.ready = this.handshake();
  }

  private send(cmd: string): void {
    this.worker.postMessage(cmd);
  }

  /** Resolve once a line satisfying `done` arrives, routing every line to `each`. */
  private collect(done: (line: string) => boolean, each?: (line: string) => void): Promise<void> {
    return new Promise((resolve) => {
      this.onLine = (line) => {
        each?.(line);
        if (done(line)) {
          this.onLine = null;
          resolve();
        }
      };
    });
  }

  private async handshake(): Promise<void> {
    this.send('uci');
    await this.collect((l) => l.startsWith('uciok'));
    this.send('isready');
    await this.collect((l) => l.startsWith('readyok'));
  }

  /** Analyse a position to a fixed depth. Calls are queued so they never overlap. */
  analyse(fen: string, depth: number = DEFAULT_DEPTH): Promise<Analysis> {
    const run = async (): Promise<Analysis> => {
      await this.ready;
      const collector = new UciCollector();
      let result: Analysis | null = null;
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
      await this.collect(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const r = collector.push(l);
          if (r) result = r;
        },
      );
      if (!result) throw new Error('engine returned no analysis');
      return result;
    };
    const next = this.tail.then(run, run);
    this.tail = next.catch(() => undefined);
    return next;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
