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
  it('serves every new opening before repeating any', () => {
    const s = new SessionScheduler([mk('a', 10), mk('b', 5), mk('c', 1)], { rng: seeded(1) });
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const o = s.pickFocus();
      seen.add(o.id);
      s.record(o.id, true);
    }
    expect(seen.size).toBe(3); // all three shown before any repeat
  });

  it('marks a perfectly-played opening mastered and suppresses it while due', () => {
    const s = new SessionScheduler([mk('a', 5), mk('b', 5)], { rng: seeded(2) });
    s.record('a', true);
    expect(s.isMastered('a')).toBe(true);
    // 'b' is still unseen, so it must come up before the just-mastered 'a'.
    expect(s.pickFocus().id).toBe('b');
  });

  it('keeps a missed opening in rotation over a mastered one', () => {
    const s = new SessionScheduler([mk('a', 5), mk('b', 5)], { rng: seeded(3) });
    s.record('a', false); // missed → box 0, due again soon
    s.record('b', true); // perfect → box 1, suppressed longer
    expect(s.pickFocus().id).toBe('a');
    expect(s.isMastered('a')).toBe(false);
  });

  it('favours higher-weighted openings among due candidates', () => {
    const s = new SessionScheduler([mk('common', 10), mk('rare', 1)], { rng: seeded(42) });
    // Seed both so neither is "unseen", then let them fall due together.
    s.record('common', true);
    s.record('rare', true);
    const counts: Record<string, number> = { common: 0, rare: 0 };
    for (let i = 0; i < 400; i++) {
      const o = s.pickFocus();
      counts[o.id]++;
      s.record(o.id, true);
    }
    expect(counts.common).toBeGreaterThan(counts.rare);
  });
});
