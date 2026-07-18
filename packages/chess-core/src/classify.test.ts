import { describe, expect, it } from 'vitest';
import { accuracyPercent, classify, winFrac, winPercentFromCp } from './classify';

describe('winPercentFromCp', () => {
  it('is 50% at cp 0 and symmetric', () => {
    expect(winPercentFromCp(0)).toBeCloseTo(50, 6);
    expect(winPercentFromCp(300) + winPercentFromCp(-300)).toBeCloseTo(100, 6);
  });

  it('increases with the eval', () => {
    expect(winPercentFromCp(100)).toBeGreaterThan(winPercentFromCp(0));
    expect(winPercentFromCp(1000)).toBeGreaterThan(winPercentFromCp(500));
  });
});

describe('winFrac', () => {
  it('maps mate to a certain result', () => {
    expect(winFrac({ cp: null, mate: 3 })).toBe(1);
    expect(winFrac({ cp: null, mate: -1 })).toBe(0);
  });

  it('returns 0.5 for a missing eval', () => {
    expect(winFrac({ cp: null, mate: null })).toBe(0.5);
  });
});

describe('accuracyPercent', () => {
  it('is ~100 for a move that loses no winning chances', () => {
    expect(accuracyPercent(60, 60)).toBeCloseTo(100, 0);
  });

  it('drops as more winning chances are lost, clamped to [0,100]', () => {
    expect(accuracyPercent(80, 20)).toBeLessThan(accuracyPercent(80, 70));
    expect(accuracyPercent(100, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('classify', () => {
  it('flags a ~28% drop as a mistake (below the blunder threshold)', () => {
    expect(classify(0.6, 0.32)).toEqual({ severity: 'mistake', winDrop: expect.closeTo(0.28, 5) });
  });

  it('flags a ≥30% drop from a decent position as a blunder', () => {
    const c = classify(0.7, 0.35);
    expect(c?.severity).toBe('blunder');
  });

  it('flags a ~12% drop as an inaccuracy', () => {
    expect(classify(0.55, 0.43)?.severity).toBe('inaccuracy');
  });

  it('returns null within tolerance', () => {
    expect(classify(0.6, 0.55)).toBeNull();
  });
});
