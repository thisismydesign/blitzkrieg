import { describe, expect, it } from 'vitest';
import { sideToMove, toEpd } from './fen';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('toEpd', () => {
  it('keeps the first 4 FEN fields and drops the move counters', () => {
    expect(toEpd(START)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  });

  it('keeps castling and en-passant (they change the best move)', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    expect(toEpd(fen)).toBe('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6');
  });

  it('makes two positions that differ only in clocks share a key', () => {
    const a = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 3';
    const b = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 9 40';
    expect(toEpd(a)).toBe(toEpd(b));
  });
});

describe('sideToMove', () => {
  it('reads the side-to-move field', () => {
    expect(sideToMove(START)).toBe('w');
    expect(sideToMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1')).toBe('b');
  });
});
