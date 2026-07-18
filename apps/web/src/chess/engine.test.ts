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

// Three White lines that share 1.e4 e5 2.Nf3 Nc6 and branch on White's 3rd move.
const branchSet: Opening[] = [
  { id: 'it', name: 'Italian', userSide: 'white', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], weight: 10, tag: 'm' },
  { id: 'ruy', name: 'Ruy Lopez', userSide: 'white', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], weight: 10, tag: 'm' },
  { id: 'scotch', name: 'Scotch', userSide: 'white', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'], weight: 6, tag: 'm' },
];

function fakeClock(step = 1000) {
  let t = 0;
  return () => {
    const v = t;
    t += step;
    return v;
  };
}

function introWhite(e: PracticeEngine) {
  e.playOpponent(); // 1.e4
  e.playOpponent(); // 1...e5
}

describe('PracticeEngine', () => {
  it("auto-plays White's first move and Black's reply before the user moves", () => {
    const e = new PracticeEngine([italian], fakeClock());
    expect(e.state().isUserTurn).toBe(false);
    expect(e.playOpponent()).toBe(true);
    expect(e.state().isUserTurn).toBe(false);
    expect(e.playOpponent()).toBe(true);
    expect(e.state().isUserTurn).toBe(true);
    expect(e.state().expected?.san).toBe('Nf3');
  });

  it('waits for the opponent when playing Black', () => {
    const e = new PracticeEngine([sicilian], fakeClock());
    expect(e.state().isUserTurn).toBe(false);
    expect(e.playOpponent()).toBe(true);
    expect(e.state().isUserTurn).toBe(true);
  });

  it('accepts the correct move and rejects a legal-but-wrong one', () => {
    const e = new PracticeEngine([italian], fakeClock());
    introWhite(e);
    const wrong = e.tryUserMove('d2', 'd4');
    expect(wrong.accepted).toBe(false);
    expect(wrong.legal).toBe(true);
    expect(e.state().errorHint?.expectedSan).toBe('Nf3');
    expect(e.state().errorsThisMove).toBe(1);

    const right = e.tryUserMove('g1', 'f3');
    expect(right.accepted).toBe(true);
    expect(e.state().errorHint).toBeNull();
  });

  it('snaps back an impossible drag without penalty', () => {
    const e = new PracticeEngine([italian], fakeClock());
    introWhite(e);
    expect(e.tryUserMove('a2', 'a5')).toEqual({ accepted: false, legal: false });
    expect(e.state().errorsThisMove).toBe(0);
  });

  it('finishes the line and reports stats with the resolved opening', () => {
    const e = new PracticeEngine([italian], fakeClock(1000));
    introWhite(e);
    e.tryUserMove('g1', 'f3');
    e.playOpponent(); // Nc6
    expect(e.state().status).toBe('playing');
    e.tryUserMove('f1', 'c4');
    const s = e.state();
    expect(s.status).toBe('finished');
    expect(s.outcome?.id).toBe('it');
    expect(s.stats?.openingId).toBe('it');
    expect(s.stats?.userMoves).toBe(2);
    expect(s.stats?.accuracy).toBe(1);
    expect(s.stats?.totalMs).toBeGreaterThan(0);
  });

  it('counts an error against accuracy', () => {
    const e = new PracticeEngine([italian], fakeClock());
    introWhite(e);
    e.tryUserMove('a2', 'a4'); // wrong
    e.tryUserMove('g1', 'f3'); // correct
    e.playOpponent();
    e.tryUserMove('f1', 'c4');
    const s = e.state().stats!;
    expect(s.userMoves).toBe(2);
    expect(s.errors).toBe(1);
    expect(s.cleanMoves).toBe(1);
  });

  it('branches: multiple correct moves, and the choice resolves the opening', () => {
    const e = new PracticeEngine(branchSet, fakeClock(), () => 0); // deterministic opponent
    introWhite(e); // e4 e5
    e.tryUserMove('g1', 'f3'); // Nf3 (shared)
    e.playOpponent(); // Nc6 (shared)

    // At White's 3rd move three book moves are correct.
    const res = e.tryUserMove('f1', 'c4'); // play the Italian's Bc4
    expect(res.accepted).toBe(true);
    expect(res.alternatives).toEqual(
      expect.arrayContaining([
        { from: 'f1', to: 'b5' }, // Ruy Lopez (same bishop, different square)
        { from: 'd2', to: 'd4' }, // Scotch (different piece)
      ]),
    );

    e.playOpponent(); // ...Bc5 → line ends
    expect(e.state().status).toBe('finished');
    expect(e.state().outcome?.id).toBe('it');
  });

  it('exposes the legal book source squares and counts a wrong-piece touch', () => {
    const e = new PracticeEngine([italian], fakeClock());
    introWhite(e);
    expect(e.state().correctFroms).toEqual(['g1']); // only Nf3 is correct
    expect(e.markError()).toBe('g1'); // hint points at the correct piece
    expect(e.state().errorsThisMove).toBe(1);
    expect(e.state().errorHint?.highlight).toBe('from');
  });

  it('on a wrong square (right piece) points at the correct destination', () => {
    const e = new PracticeEngine([italian], fakeClock());
    introWhite(e);
    const r = e.tryUserMove('g1', 'h3'); // correct knight, wrong square
    expect(r.accepted).toBe(false);
    expect(r.legal).toBe(true);
    expect(r.hint).toEqual({ square: 'f3' });
  });

  it('rejects a move that belongs to no viable opening', () => {
    const e = new PracticeEngine(branchSet, fakeClock(), () => 0);
    introWhite(e);
    e.tryUserMove('g1', 'f3');
    e.playOpponent();
    const bad = e.tryUserMove('f1', 'e2'); // Be2 is legal but not a book move here
    expect(bad.accepted).toBe(false);
    expect(bad.legal).toBe(true);
  });
});
