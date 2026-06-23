import type { Opening } from '../types';

interface SeenState {
  lastSeen: number; // practice index when it was last shown
  count: number;
}

/**
 * In-session spaced repetition.
 *
 * Each opening has a base `weight` (how common it is). On top of that we apply a
 * recency factor: a line shown recently is temporarily down-weighted and then
 * recovers to full weight over the next few practices. This means common lines
 * dominate, every line can recur, but you won't see the same one twice in a row.
 */
export class SessionScheduler {
  private readonly openings: Opening[];
  private readonly cooldown: number;
  private readonly minFactor: number;
  private readonly rng: () => number;
  private readonly seen = new Map<string, SeenState>();
  private served = 0;

  constructor(
    openings: Opening[],
    opts: { cooldown?: number; minFactor?: number; rng?: () => number } = {},
  ) {
    if (openings.length === 0) throw new Error('SessionScheduler needs at least one opening');
    this.openings = openings;
    this.cooldown = opts.cooldown ?? 4;
    this.minFactor = opts.minFactor ?? 0.15;
    this.rng = opts.rng ?? Math.random;
  }

  /** Recency multiplier in [minFactor, 1] based on practices since last shown. */
  private recency(id: string): number {
    const s = this.seen.get(id);
    if (!s) return 1;
    // `elapsed` is >= 1 on the very next draw; the just-shown line should sit at
    // `minFactor` then recover to full weight over the next `cooldown` draws.
    const elapsed = this.served - s.lastSeen;
    const recovered = Math.max(0, elapsed - 1) / this.cooldown;
    return Math.min(1, this.minFactor + recovered * (1 - this.minFactor));
  }

  private effectiveWeight(o: Opening): number {
    return o.weight * this.recency(o.id);
  }

  /** Pick the next opening using weighted random selection. */
  next(): Opening {
    const weights = this.openings.map((o) => this.effectiveWeight(o));
    const total = weights.reduce((a, b) => a + b, 0);

    let r = this.rng() * total;
    let chosen = this.openings[this.openings.length - 1];
    for (let i = 0; i < this.openings.length; i++) {
      r -= weights[i];
      if (r < 0) {
        chosen = this.openings[i];
        break;
      }
    }

    const prev = this.seen.get(chosen.id);
    this.seen.set(chosen.id, { lastSeen: this.served, count: (prev?.count ?? 0) + 1 });
    this.served += 1;
    return chosen;
  }

  /** How many times each opening has been served (for debugging/tests). */
  counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, s] of this.seen) out[id] = s.count;
    return out;
  }
}
