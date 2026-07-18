import { z } from 'npm:zod@4.4.3';
import { adminClient, getUser } from '../_shared/supabase.ts';
import { type ChesscomGame, fetchMonth, listArchives } from '../_shared/chesscom.ts';
import { errorResponse, json, preflight } from '../_shared/http.ts';

// Import a user's chess.com games into `games`. Months are fetched STRICTLY
// SERIALLY with ETag/Last-Modified caching (archive_months) so re-imports skip
// unchanged months. MVP imports the most recent `maxMonths`; the queue-based
// full-history path is documented in docs/technical.md §5.1.

const Body = z.object({
  accountId: z.string().uuid(),
  maxMonths: z.number().int().min(1).max(120).optional(),
});

const DRAW_RESULTS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
]);

function resultForUser(userResult: string): 'win' | 'loss' | 'draw' {
  if (userResult === 'win') return 'win';
  if (DRAW_RESULTS.has(userResult)) return 'draw';
  return 'loss';
}

function ecoFromPgn(pgn: string): { eco: string | null; opening: string | null } {
  const eco = pgn.match(/\[ECO "([^"]+)"\]/)?.[1] ?? null;
  const url = pgn.match(/\[ECOUrl "([^"]+)"\]/)?.[1] ?? null;
  const opening = url ? decodeURIComponent(url.split('/').pop() ?? '').replace(/-/g, ' ') : null;
  return { eco, opening };
}

function toGameRow(g: ChesscomGame, userId: string, accountId: string, username: string) {
  const userIsWhite = g.white.username.toLowerCase() === username.toLowerCase();
  const userSide = userIsWhite ? g.white : g.black;
  const oppSide = userIsWhite ? g.black : g.white;
  const { eco, opening } = ecoFromPgn(g.pgn);
  return {
    user_id: userId,
    account_id: accountId,
    provider: 'chesscom',
    provider_game_id: g.uuid,
    url: g.url,
    played_at: new Date(g.end_time * 1000).toISOString(),
    user_color: userIsWhite ? 'white' : 'black',
    time_class: g.time_class,
    rules: g.rules,
    rated: g.rated,
    result_for_user: resultForUser(userSide.result),
    user_rating: userSide.rating,
    opponent_rating: oppSide.rating,
    opponent_username: oppSide.username,
    eco,
    opening_name: opening,
    pgn: g.pgn,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return errorResponse('method not allowed', 405);

  const admin = adminClient();
  const user = await getUser(admin, req);
  if (!user) return errorResponse('unauthorized', 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('invalid body', 422);
  const { accountId, maxMonths = 3 } = parsed.data;

  // The account must belong to the caller.
  const { data: account, error: accErr } = await admin
    .from('chesscom_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();
  if (accErr || !account) return errorResponse('account not found', 404);

  const { data: job, error: jobErr } = await admin
    .from('import_jobs')
    .insert({ user_id: user.id, account_id: accountId, status: 'running' })
    .select()
    .single();
  if (jobErr || !job) return errorResponse(jobErr?.message ?? 'could not create job', 500);

  try {
    const archives = await listArchives(account.username);
    const months = archives.slice(-maxMonths).reverse(); // most recent first
    await admin.from('import_jobs').update({ months_total: months.length }).eq('id', job.id);

    let imported = 0;
    let done = 0;
    for (const url of months) {
      const yyyymm = url.split('/').slice(-2).join('/');
      const { data: cache } = await admin
        .from('archive_months')
        .select('etag, last_modified')
        .eq('account_id', accountId)
        .eq('yyyymm', yyyymm)
        .maybeSingle();

      const month = await fetchMonth(url, cache?.etag, cache?.last_modified);
      if (month.status === 'ok') {
        const rows = month.games
          .filter((g) => g.rules === 'chess')
          .map((g) => toGameRow(g, user.id, accountId, account.username));
        if (rows.length) {
          const { data: inserted, error: upErr } = await admin
            .from('games')
            .upsert(rows, {
              onConflict: 'user_id,provider,provider_game_id',
              ignoreDuplicates: true,
            })
            .select('id');
          if (upErr) throw upErr;
          imported += inserted?.length ?? 0;
        }
        await admin.from('archive_months').upsert(
          {
            account_id: accountId,
            yyyymm,
            etag: month.etag ?? null,
            last_modified: month.lastModified ?? null,
            last_fetched_at: new Date().toISOString(),
            game_count: month.games.length,
          },
          { onConflict: 'account_id,yyyymm' },
        );
      }
      done++;
      await admin
        .from('import_jobs')
        .update({ months_done: done, games_imported: imported })
        .eq('id', job.id);
    }

    await admin
      .from('chesscom_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', accountId);
    await admin.from('import_jobs').update({ status: 'done' }).eq('id', job.id);
    return json({ jobId: job.id, months: months.length, imported });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('import_jobs').update({ status: 'error', error: message }).eq('id', job.id);
    return errorResponse(message, 502);
  }
});
