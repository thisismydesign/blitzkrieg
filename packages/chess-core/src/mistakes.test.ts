import { describe, expect, it } from 'vitest';
import { detectMistakes } from './mistakes';
import { toEpd } from './fen';
import type { Eval, GameNode } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_F3 = 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1';
const AFTER_F3_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2';

// White plays the weakening 1.f3 (best was 1.e4); Black replies 1...e5 and stands
// clearly better. Evals are from each position's side-to-move POV.
const nodes: GameNode[] = [
  { ply: 0, fen: START, epd: toEpd(START), sideToMove: 'w', moveUci: 'f2f3', moveSan: 'f3' },
  { ply: 1, fen: AFTER_F3, epd: toEpd(AFTER_F3), sideToMove: 'b', moveUci: 'e7e5', moveSan: 'e5' },
  { ply: 2, fen: AFTER_F3_E5, epd: toEpd(AFTER_F3_E5), sideToMove: 'w', moveUci: null, moveSan: null },
];
const evals: Eval[] = [
  { cp: 20, mate: null, bestUci: 'e2e4' }, // White to move, best is e4
  { cp: 300, mate: null, bestUci: 'd8h4' }, // Black to move, Black +300
  { cp: -280, mate: null, bestUci: 'g1f3' }, // White to move again, White −280
];

describe('detectMistakes', () => {
  it("flags White's f3 as a mistake with the engine's best move to drill", () => {
    const found = detectMistakes(nodes, evals, 'w');
    expect(found).toHaveLength(1);
    const m = found[0];
    expect(m.ply).toBe(0);
    expect(m.severity).toBe('mistake');
    expect(m.bestUci).toBe('e2e4');
    expect(m.bestSan).toBe('e4');
    expect(m.playedUci).toBe('f2f3');
    expect(m.leadInUci).toBeNull(); // first move → no lead-in
    expect(m.winBefore).toBeGreaterThan(m.winAfter);
  });

  it('only flags the requested side', () => {
    expect(detectMistakes(nodes, evals, 'b')).toHaveLength(0);
  });

  it('skips a move when the eval before or after is missing', () => {
    const gaps: (Eval | null)[] = [evals[0], null, evals[2]];
    expect(detectMistakes(nodes, gaps, 'w')).toHaveLength(0);
  });

  it('does not flag the move when the user played the engine best move', () => {
    const playedBest: GameNode[] = [{ ...nodes[0], moveUci: 'e2e4', moveSan: 'e4' }, nodes[1], nodes[2]];
    expect(detectMistakes(playedBest, evals, 'w')).toHaveLength(0);
  });

  it('respects minSeverity (blunder-only filters out mistakes)', () => {
    expect(detectMistakes(nodes, evals, 'w', { minSeverity: 'blunder' })).toHaveLength(0);
  });
});
