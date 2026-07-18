import { type Card, State } from '@blitzkrieg/chess-core';
import type { ReviewCardRow } from './rows';

// Map between the persisted review_cards row (timestamps as ISO strings) and the
// ts-fsrs Card (Date objects).

export function rowToCard(r: ReviewCardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  };
}

/** The mutable FSRS fields of a card, ready to UPDATE onto a review_cards row. */
export function cardToRow(c: Card) {
  return {
    state: c.state,
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    last_review: c.last_review ? c.last_review.toISOString() : null,
  };
}
