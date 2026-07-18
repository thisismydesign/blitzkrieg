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

/** Abort an analyse() that hasn't produced a `bestmove` in this long (a hung worker). */
export const ENGINE_TIMEOUT_MS = 20_000;

/** Proactively replace the worker after this many analyses — prevents the slow
 *  resource build-up that can make a long-lived worker hang (the "stuck at 2083"
 *  symptom). Cheap: worker respawn is ~100 ms. */
const RECREATE_EVERY = 800;

/** Retries (each with a fresh worker) per position before giving up on it. */
const MAX_RETRIES = 2;

/**
 * The engine seam: anything that can evaluate a position + return the best move
 * (and, via MultiPV, the top-N moves). `Engine` (Stockfish WASM) is the only
 * implementation today, but analysis/drill code depends on this interface so a
 * different engine can be swapped in later.
 */
export interface Analyzer {
  analyse(fen: string, depth?: number, multipv?: number): Promise<Analysis>;
  terminate(): void;
}

/**
 * Stockfish WASM client. Resilient: every search is bounded by a timeout, a hung
 * or dead worker is torn down and the position retried with a fresh worker, and
 * the worker is proactively recycled every `RECREATE_EVERY` searches.
 */
export class Engine implements Analyzer {
  private worker!: Worker;
  private onLine: ((line: string) => void) | null = null;
  private ready!: Promise<void>;
  /** Serialises analyse() calls — one `go` search at a time per worker. */
  private tail: Promise<unknown> = Promise.resolve();
  private analysesSinceSpawn = 0;

  constructor(
    private readonly url: string = ENGINE_URL,
    private readonly timeoutMs: number = ENGINE_TIMEOUT_MS,
  ) {
    this.spawn();
  }

  private spawn(): void {
    this.worker = new Worker(this.url);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      this.onLine?.(line);
    };
    this.ready = this.handshake();
    this.analysesSinceSpawn = 0;
  }

  private recreate(): void {
    try {
      this.worker.terminate();
    } catch {
      /* already gone */
    }
    this.onLine = null;
    this.spawn();
  }

  private send(cmd: string): void {
    this.worker.postMessage(cmd);
  }

  private handshake(): Promise<void> {
    return new Promise((resolve) => {
      this.onLine = (line) => {
        if (line.startsWith('uciok')) this.send('isready');
        else if (line.startsWith('readyok')) {
          this.onLine = null;
          resolve();
        }
      };
      this.send('uci');
    });
  }

  /** Analyse a position to a fixed depth (optionally MultiPV=N for the top N moves). */
  analyse(fen: string, depth: number = DEFAULT_DEPTH, multipv = 1): Promise<Analysis> {
    const run = () => this.attempt(fen, depth, multipv, MAX_RETRIES);
    const next = this.tail.then(run, run);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async attempt(
    fen: string,
    depth: number,
    multipv: number,
    retriesLeft: number,
  ): Promise<Analysis> {
    if (this.analysesSinceSpawn >= RECREATE_EVERY) this.recreate();
    try {
      await this.ready;
      const result = await this.search(fen, depth, multipv);
      this.analysesSinceSpawn += 1;
      return result;
    } catch (err) {
      if (retriesLeft > 0) {
        this.recreate();
        return this.attempt(fen, depth, multipv, retriesLeft - 1);
      }
      throw err;
    }
  }

  private search(fen: string, depth: number, multipv: number): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      const collector = new UciCollector();
      let result: Analysis | null = null;
      const timer = setTimeout(() => {
        this.onLine = null;
        reject(new Error(`engine timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.onLine = (line) => {
        const r = collector.push(line);
        if (r) result = r;
        if (line.startsWith('bestmove')) {
          clearTimeout(timer);
          this.onLine = null;
          if (result) resolve(result);
          else reject(new Error('engine returned no analysis'));
        }
      };

      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  terminate(): void {
    try {
      this.worker.terminate();
    } catch {
      /* already gone */
    }
  }
}
