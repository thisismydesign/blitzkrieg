import type { Opening } from '../types';

interface CardState {
  /** Leitner box: 0 = learning, higher = mastered for longer. */
  box: number;
  /** Practice clock value when this opening was last completed. */
  lastSeen: number;
}

/**
 * Practices to wait before an opening is due again, indexed by Leitner box.
 * Box 0 (just missed) returns almost immediately; each correct repetition
 * roughly doubles the gap (Leitner / SM-2 style geometric growth).
 */
const INTERVALS = [1, 2, 4, 8, 16];

/**
 * In-session spaced repetition over the opening set.
 *
 * Rules (Leitner system, see design.md):
 *  - Unseen openings have top priority, so you meet new lines before repeats.
 *  - Completing a line perfectly promotes it a box → it isn't shown again until
 *    its (growing) interval elapses.
 *  - A mistake resets it to box 0 → it comes back around quickly.
 *
 * Time is measured in completed practices (`clock`), not wall-clock.
 */
export class SessionScheduler {
  private readonly openings: Opening[];
  private readonly rng: () => number;
  private readonly cards = new Map<string, CardState>();
  private clock = 0;

  constructor(openings: Opening[], opts: { rng?: () => number } = {}) {
    if (openings.length === 0) throw new Error('SessionScheduler needs at least one opening');
    this.openings = openings;
    this.rng = opts.rng ?? Math.random;
  }

  private interval(box: number): number {
    return INTERVALS[Math.min(box, INTERVALS.length - 1)];
  }

  /** Practices elapsed past an opening's due point; unseen → Infinity. */
  private overdue(o: Opening): number {
    const c = this.cards.get(o.id);
    if (!c) return Infinity;
    return this.clock - c.lastSeen - this.interval(c.box);
  }

  private weightedPick(list: Opening[]): Opening {
    const total = list.reduce((sum, o) => sum + o.weight, 0);
    let r = this.rng() * total;
    for (const o of list) {
      r -= o.weight;
      if (r < 0) return o;
    }
    return list[list.length - 1];
  }

  /** True once the opening has been completed perfectly at least once. */
  isMastered(id: string): boolean {
    return (this.cards.get(id)?.box ?? 0) > 0;
  }

  /** New or due-for-review openings among `among` (falls back to all of them). */
  due(among: Opening[]): Opening[] {
    const unseen = among.filter((o) => !this.cards.has(o.id));
    if (unseen.length) return unseen;
    const ready = among.filter((o) => this.overdue(o) >= 0);
    return ready.length ? ready : among;
  }

  /** Pick the next focus opening: new ones first, then due, weighted by frequency. */
  pickFocus(among: Opening[] = this.openings): Opening {
    return this.weightedPick(this.due(among));
  }

  /** Record a finished practice, advancing the spaced-repetition clock. */
  record(id: string, perfect: boolean): void {
    const c = this.cards.get(id) ?? { box: 0, lastSeen: this.clock };
    c.box = perfect ? Math.min(c.box + 1, INTERVALS.length - 1) : 0;
    c.lastSeen = this.clock;
    this.cards.set(id, c);
    this.clock += 1;
  }
}
