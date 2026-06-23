import { describe, expect, it } from 'vitest';
import { SessionScheduler } from './scheduler';
import type { Opening } from '../types';

const mk = (id: string, weight: number): Opening => ({
  id,
  name: id,
  userSide: 'white',
  moves: ['e4'],
  weight,
  tag: 't',
});

/** Deterministic PRNG so weighted selection is reproducible. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe('SessionScheduler', () => {
  it('favours higher-weighted openings over many draws', () => {
    const s = new SessionScheduler([mk('common', 10), mk('rare', 1)], {
      rng: seeded(42),
      cooldown: 1,
      minFactor: 1, // disable recency so we isolate base weights
    });
    const counts: Record<string, number> = { common: 0, rare: 0 };
    for (let i = 0; i < 1000; i++) counts[s.next().id]++;
    expect(counts.common).toBeGreaterThan(counts.rare * 3);
  });

  it('avoids immediate repeats via recency down-weighting', () => {
    const s = new SessionScheduler([mk('a', 5), mk('b', 5)], {
      rng: seeded(7),
      cooldown: 4,
      minFactor: 0.05,
    });
    let repeats = 0;
    let prev = s.next().id;
    for (let i = 0; i < 500; i++) {
      const cur = s.next().id;
      if (cur === prev) repeats++;
      prev = cur;
    }
    // Two equal-weight openings would repeat ~50% of the time (≈250) if picked
    // uniformly. Recency damping should cut that dramatically.
    expect(repeats).toBeLessThan(125);
  });

  it('still lets every opening recur over a session', () => {
    const s = new SessionScheduler([mk('a', 5), mk('b', 5), mk('c', 5)], { rng: seeded(99) });
    for (let i = 0; i < 200; i++) s.next();
    const counts = s.counts();
    expect(Object.keys(counts).sort()).toEqual(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) expect(counts[id]).toBeGreaterThan(10);
  });
});
