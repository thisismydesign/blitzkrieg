import { describe, expect, it } from 'vitest';
import { gradeAttempt, newCard, Rating, reviewCard } from './fsrs';

describe('gradeAttempt', () => {
  it('rates a wrong answer Again', () => {
    expect(gradeAttempt({ correct: false, firstTry: false, usedHint: true, elapsedMs: 9000 })).toBe(
      Rating.Again,
    );
  });

  it('rates a fast, clean first try Easy', () => {
    expect(gradeAttempt({ correct: true, firstTry: true, usedHint: false, elapsedMs: 2000 })).toBe(
      Rating.Easy,
    );
  });

  it('rates a normal-pace clean first try Good', () => {
    expect(gradeAttempt({ correct: true, firstTry: true, usedHint: false, elapsedMs: 8000 })).toBe(
      Rating.Good,
    );
  });

  it('rates a slow / hinted / not-first-try success Hard', () => {
    expect(gradeAttempt({ correct: true, firstTry: true, usedHint: false, elapsedMs: 20000 })).toBe(
      Rating.Hard,
    );
    expect(gradeAttempt({ correct: true, firstTry: true, usedHint: true, elapsedMs: 2000 })).toBe(
      Rating.Hard,
    );
    expect(gradeAttempt({ correct: true, firstTry: false, usedHint: false, elapsedMs: 2000 })).toBe(
      Rating.Hard,
    );
  });
});

describe('FSRS scheduling', () => {
  const now = new Date('2026-07-18T00:00:00Z');

  it('creates a new card that is due now', () => {
    const card = newCard(now);
    expect(card.reps).toBe(0);
    expect(card.due.getTime()).toBe(now.getTime());
  });

  it('schedules the next review into the future on a Good rating', () => {
    const { card } = reviewCard(newCard(now), Rating.Good, now);
    expect(card.reps).toBe(1);
    expect(card.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it('brings a lapsed card back sooner than a well-known one', () => {
    const again = reviewCard(newCard(now), Rating.Again, now).card;
    const easy = reviewCard(newCard(now), Rating.Easy, now).card;
    expect(again.due.getTime()).toBeLessThan(easy.due.getTime());
  });
});
