import { describe, expect, it } from 'vitest';
import { PracticeEngine } from './engine';
import type { Opening } from '../types';

const italian: Opening = {
  id: 'it',
  name: 'Italian',
  userSide: 'white',
  moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  weight: 1,
  tag: 'main',
};

const sicilian: Opening = {
  id: 'sic',
  name: 'Sicilian',
  userSide: 'black',
  moves: ['e4', 'c5', 'Nf3', 'd6'],
  weight: 1,
  tag: 'main',
};

/** A fake clock that advances by a fixed step on each read. */
function fakeClock(step = 1000) {
  let t = 0;
  return () => {
    const v = t;
    t += step;
    return v;
  };
}

/** Play White's scripted intro (1.e4 e5) so it's the user's move. */
function introWhite(e: PracticeEngine) {
  e.playOpponent();
  e.playOpponent();
}

describe('PracticeEngine', () => {
  it("auto-plays White's first move and Black's reply before the user moves", () => {
    const e = new PracticeEngine(italian, fakeClock());
    expect(e.state().isUserTurn).toBe(false);
    expect(e.playOpponent()).toBe(true); // 1.e4 (user's colour, auto)
    expect(e.state().isUserTurn).toBe(false);
    expect(e.playOpponent()).toBe(true); // 1...e5 (opponent)
    expect(e.state().isUserTurn).toBe(true);
    expect(e.state().expected?.san).toBe('Nf3');
  });

  it('waits for the opponent when playing Black', () => {
    const e = new PracticeEngine(sicilian, fakeClock());
    expect(e.state().isUserTurn).toBe(false);
    expect(e.playOpponent()).toBe(true); // White plays e4
    expect(e.state().isUserTurn).toBe(true);
  });

  it('accepts the correct move and rejects a legal-but-wrong one', () => {
    const e = new PracticeEngine(italian, fakeClock());
    introWhite(e);
    const wrong = e.tryUserMove('d2', 'd4'); // legal, but Nf3 was expected
    expect(wrong).toEqual({ accepted: false, legal: true });
    expect(e.state().errorHint?.expectedSan).toBe('Nf3');
    expect(e.state().errorsThisMove).toBe(1);

    const right = e.tryUserMove('g1', 'f3');
    expect(right.accepted).toBe(true);
    expect(e.state().errorHint).toBeNull();
  });

  it('snaps back an impossible drag without penalty', () => {
    const e = new PracticeEngine(italian, fakeClock());
    introWhite(e);
    expect(e.tryUserMove('a2', 'a5')).toEqual({ accepted: false, legal: false });
    expect(e.state().errorsThisMove).toBe(0);
  });

  it('finishes the line and reports stats', () => {
    const e = new PracticeEngine(italian, fakeClock(1000));
    introWhite(e);
    e.tryUserMove('g1', 'f3'); // user move 1: Nf3
    e.playOpponent(); // Nc6
    expect(e.state().status).toBe('playing');
    e.tryUserMove('f1', 'c4'); // user move 2 (last): Bc4
    const s = e.state();
    expect(s.status).toBe('finished');
    expect(s.stats?.openingId).toBe('it');
    expect(s.stats?.userMoves).toBe(2);
    expect(s.stats?.cleanMoves).toBe(2);
    expect(s.stats?.accuracy).toBe(1);
    expect(s.stats?.totalMs).toBeGreaterThan(0);
  });

  it('counts an error against accuracy', () => {
    const e = new PracticeEngine(italian, fakeClock());
    introWhite(e);
    e.tryUserMove('a2', 'a4'); // wrong
    e.tryUserMove('g1', 'f3'); // correct after error
    e.playOpponent();
    e.tryUserMove('f1', 'c4');
    const s = e.state().stats!;
    expect(s.userMoves).toBe(2);
    expect(s.errors).toBe(1);
    expect(s.cleanMoves).toBe(1);
  });
});
