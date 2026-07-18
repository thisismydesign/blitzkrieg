import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';
import type { Card, Grade, RecordLogItem } from 'ts-fsrs';

// Spaced repetition uses FSRS-6 via ts-fsrs. A card = one mistake-position. The
// full ts-fsrs Card is persisted (review_cards); every attempt appends a log.

/** The outcome of one drill attempt, used to derive an FSRS rating. */
export interface AttemptOutcome {
  /** Did the user ultimately play the correct (best) move? */
  correct: boolean;
  /** Correct on the very first try (no earlier wrong attempt this drill)? */
  firstTry: boolean;
  /** Did the user reveal a hint? */
  usedHint: boolean;
  /** Time to the accepted move, in milliseconds. */
  elapsedMs: number;
}

export interface GradingConfig {
  /** Below this (correct, first try, no hint) → Easy. */
  fastMs: number;
  /** Below this (correct, first try, no hint) → Good; at/above → Hard. */
  slowMs: number;
}

/** Illustrative defaults — tune against real review data (see docs/technical.md §8). */
export const DEFAULT_GRADING: GradingConfig = { fastMs: 4000, slowMs: 15000 };

/**
 * Map a drill attempt to an FSRS rating:
 *   Again — wrong / gave up / revealed the solution
 *   Hard  — right only after a wrong try, or slow first-try, or used a hint
 *   Good  — right first try at a normal pace (default success)
 *   Easy  — right first try, fast, no hint
 */
export function gradeAttempt(o: AttemptOutcome, cfg: GradingConfig = DEFAULT_GRADING): Grade {
  if (!o.correct) return Rating.Again;
  if (o.firstTry && !o.usedHint && o.elapsedMs < cfg.fastMs) return Rating.Easy;
  if (o.firstTry && !o.usedHint && o.elapsedMs < cfg.slowMs) return Rating.Good;
  return Rating.Hard;
}

const scheduler = fsrs();

/** A fresh FSRS card for a newly-detected mistake. */
export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/** Apply a rating to a card, returning the next card state and the review log. */
export function reviewCard(card: Card, rating: Grade, now: Date = new Date()): RecordLogItem {
  return scheduler.next(card, now, rating);
}

export { Rating, State };
export type { Card, Grade };
