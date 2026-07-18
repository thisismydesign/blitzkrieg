import { describe, expect, it } from 'vitest';
import { parseGame, uciToSan } from './pgn';
import { toEpd } from './fen';

// A real chess.com game (csa531, blitz) — includes clock comments and ECO
// headers to exercise the parser against production PGN.
const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.06.06"]
[White "flash2841"]
[Black "csa531"]
[Result "1-0"]
[ECO "C00"]
[TimeControl "300+5"]
[Termination "flash2841 won by resignation"]

1. d4 {[%clk 0:05:04.5]} 1... e6 {[%clk 0:05:04.3]} 2. e4 {[%clk 0:05:07.8]} 2... Ne7 {[%clk 0:05:08.7]} 3. Nc3 {[%clk 0:05:09.2]} 3... Ng6 {[%clk 0:05:12.7]} 4. Nf3 {[%clk 0:05:07.1]} 4... d6 {[%clk 0:05:16.3]} 5. Bc4 {[%clk 0:04:58.9]} 5... Be7 {[%clk 0:05:19.5]} 6. Be3 {[%clk 0:04:53.8]} 6... O-O {[%clk 0:05:23]} 7. h4 {[%clk 0:04:48]} 7... h5 {[%clk 0:04:54.3]} 8. Ng5 {[%clk 0:04:41.9]} 8... f5 {[%clk 0:04:43.2]} 9. Bxe6+ {[%clk 0:04:37.9]} 1-0`;

const START_EPD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

describe('parseGame', () => {
  const nodes = parseGame(PGN);

  it('produces one node per position (moves + the final position)', () => {
    // 17 plies played → 18 positions.
    expect(nodes).toHaveLength(18);
  });

  it('starts at the initial position with White to move', () => {
    expect(nodes[0].epd).toBe(START_EPD);
    expect(nodes[0].sideToMove).toBe('w');
    expect(nodes[0].moveUci).toBe('d2d4');
    expect(nodes[0].moveSan).toBe('d4');
  });

  it('alternates sides and records long-algebraic moves', () => {
    expect(nodes[1].sideToMove).toBe('b');
    expect(nodes[1].moveUci).toBe('e7e6');
  });

  it('marks the final node as having no move', () => {
    const last = nodes.at(-1)!;
    expect(last.ply).toBe(17);
    expect(last.moveUci).toBeNull();
    expect(last.moveSan).toBeNull();
  });

  it('keeps EPDs consistent with the node FEN', () => {
    for (const n of nodes) expect(n.epd).toBe(toEpd(n.fen));
  });
});

describe('uciToSan', () => {
  it('converts a legal move', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(uciToSan(start, 'd2d4')).toBe('d4');
    expect(uciToSan(start, 'g1f3')).toBe('Nf3');
  });

  it('returns null for an illegal move', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(uciToSan(start, 'e2e5')).toBeNull();
  });
});
