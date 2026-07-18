import { type Grade, reviewCard } from '@blitzkrieg/chess-core';
import { requireSupabase } from '../lib/supabase';
import { cardToRow, rowToCard } from './fsrsMap';
import type { MistakeRow, ReviewCardRow } from './rows';

export interface DueReview {
  card: ReviewCardRow;
  mistake: MistakeRow;
}

/** Cards due now, with their mistake, oldest-due first. */
export async function getDueReviews(limit = 30): Promise<DueReview[]> {
  const { data, error } = await requireSupabase()
    .from('review_cards')
    .select('*, mistake:mistakes(*)')
    .lte('due', new Date().toISOString())
    .order('due', { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as (ReviewCardRow & { mistake: MistakeRow | null })[];
  return rows
    .filter((r): r is ReviewCardRow & { mistake: MistakeRow } => r.mistake != null)
    .map((r) => ({ card: r, mistake: r.mistake }));
}

export async function countDueReviews(): Promise<number> {
  const { count, error } = await requireSupabase()
    .from('review_cards')
    .select('*', { count: 'exact', head: true })
    .lte('due', new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Apply an FSRS grade: advance the card and append a review log. */
export async function recordReview(card: ReviewCardRow, rating: Grade): Promise<void> {
  const sb = requireSupabase();
  const { card: next, log } = reviewCard(rowToCard(card), rating);

  const { error: upErr } = await sb.from('review_cards').update(cardToRow(next)).eq('id', card.id);
  if (upErr) throw upErr;

  const { error: logErr } = await sb.from('review_logs').insert({
    user_id: card.user_id,
    card_id: card.id,
    rating,
    state: log.state,
    due: log.due ? new Date(log.due).toISOString() : null,
    stability: log.stability,
    difficulty: log.difficulty,
    scheduled_days: log.scheduled_days,
    elapsed_days: log.elapsed_days,
  });
  if (logErr) throw logErr;
}
