import { describe, expect, it } from 'vitest';
import { MistakeDrill } from './MistakeDrill';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const input = { fen: START, bestUci: 'e2e4', leadInUci: null };

describe('MistakeDrill', () => {
  it('solves on the best move, first try', () => {
    const d = new MistakeDrill(input);
    const r = d.tryMove('e2', 'e4');
    expect(r).toMatchObject({ accepted: true, correct: true });
    const v = d.view();
    expect(v.status).toBe('solved');
    expect(v.solved?.san).toBe('e4');
    expect(d.outcome()).toMatchObject({ correct: true, firstTry: true, usedHint: false });
  });

  it('penalises a legal-but-wrong move, then accepts the best move (not first try)', () => {
    const d = new MistakeDrill(input);
    const wrong = d.tryMove('a2', 'a3');
    expect(wrong).toMatchObject({ accepted: false, correct: false, legal: true });
    expect(d.view().errors).toBe(1);
    expect(d.view().lastWrong).toEqual({ from: 'a2', to: 'a3' });

    d.tryMove('e2', 'e4');
    expect(d.outcome()).toMatchObject({ correct: true, firstTry: false });
  });

  it('ignores illegal moves without penalty', () => {
    const d = new MistakeDrill(input);
    const r = d.tryMove('e2', 'e5'); // pawn can't jump to e5 from start
    expect(r).toMatchObject({ accepted: false, legal: false });
    expect(d.view().errors).toBe(0);
  });

  it('reveals the piece via hint and records it for grading', () => {
    const d = new MistakeDrill(input);
    expect(d.hint()).toBe('e2');
    expect(d.view().hintFrom).toBe('e2');
    d.tryMove('e2', 'e4');
    expect(d.outcome().usedHint).toBe(true);
  });

  it('orients the board to the side to move and times the attempt', () => {
    let t = 1000;
    const d = new MistakeDrill(input, () => t);
    expect(d.view().orientation).toBe('white');
    t = 3500;
    d.tryMove('e2', 'e4');
    expect(d.outcome().elapsedMs).toBe(2500);
  });

  it('highlights the lead-in move when present', () => {
    const d = new MistakeDrill({ ...input, leadInUci: 'g8f6' });
    expect(d.view().leadIn).toEqual({ from: 'g8', to: 'f6' });
  });
});
