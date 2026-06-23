import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { OPENINGS } from './openings';
import { PracticeEngine } from './engine';

describe('openings dataset', () => {
  it('has unique ids', () => {
    const ids = OPENINGS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers both colours', () => {
    expect(OPENINGS.some((o) => o.userSide === 'white')).toBe(true);
    expect(OPENINGS.some((o) => o.userSide === 'black')).toBe(true);
  });

  it.each(OPENINGS)('$name is a fully legal line', (opening) => {
    const game = new Chess();
    expect(opening.moves.length).toBeGreaterThan(0);
    for (const san of opening.moves) {
      // .move throws on an illegal/unparseable move.
      expect(() => game.move(san)).not.toThrow();
    }
  });

  it.each(OPENINGS)('$name ends on a user move so the user finishes the line', (opening) => {
    // Last move index parity must match the user's side.
    const lastSide = (opening.moves.length - 1) % 2 === 0 ? 'white' : 'black';
    expect(lastSide).toBe(opening.userSide);
  });

  it.each(OPENINGS)('$name leaves the user at least one move to play', (opening) => {
    // After the scripted intro (White's 1st move + reply, or White's 1st move),
    // there must be moves left for the user.
    expect(new PracticeEngine(opening, () => 0).state().totalUserMoves).toBeGreaterThan(0);
  });
});
