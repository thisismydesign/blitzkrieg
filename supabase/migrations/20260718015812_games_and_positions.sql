-- chess.com account linking, imported games, and the global position/eval cache.

-- ── chesscom_accounts: a user's linked chess.com account(s) ─────────────────
create table public.chesscom_accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  chesscom_player_id bigint not null,             -- STABLE identity (usernames change)
  username           text not null,               -- stored lowercased
  verified_at        timestamptz,                 -- profile-token handshake result
  verification_token text,                        -- transient; cleared after verify
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, chesscom_player_id)
);
create index chesscom_accounts_user_idx on public.chesscom_accounts (user_id);

create trigger chesscom_accounts_set_updated_at
  before update on public.chesscom_accounts
  for each row execute function public.set_updated_at();

alter table public.chesscom_accounts enable row level security;
create policy "chesscom_accounts: all own"
  on public.chesscom_accounts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.chesscom_accounts to authenticated;
grant all on public.chesscom_accounts to service_role;

-- ── import_jobs: one row per sync run; drives progress UI ────────────────────
create table public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  account_id     uuid not null references public.chesscom_accounts (id) on delete cascade,
  status         text not null default 'queued'
                   check (status in ('queued', 'running', 'done', 'error')),
  months_total   int not null default 0,
  months_done    int not null default 0,
  games_imported int not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index import_jobs_user_idx on public.import_jobs (user_id, created_at desc);

create trigger import_jobs_set_updated_at
  before update on public.import_jobs
  for each row execute function public.set_updated_at();

alter table public.import_jobs enable row level security;
create policy "import_jobs: select own"
  on public.import_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.import_jobs to authenticated;   -- written by the edge function
grant all on public.import_jobs to service_role;

-- ── archive_months: per-month ETag cache for conditional chess.com GETs ──────
-- Internal to the import edge function (service_role only); not exposed to clients.
create table public.archive_months (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.chesscom_accounts (id) on delete cascade,
  yyyymm          text not null,                  -- e.g. '2026/06'
  etag            text,
  last_modified   text,
  last_fetched_at timestamptz,
  game_count      int not null default 0,
  unique (account_id, yyyymm)
);
alter table public.archive_months enable row level security;   -- no authenticated policy
grant all on public.archive_months to service_role;

-- ── games: one imported game (user-owned) ───────────────────────────────────
create table public.games (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  account_id       uuid not null references public.chesscom_accounts (id) on delete cascade,
  provider         text not null default 'chesscom',   -- provider-agnostic (Lichess later)
  provider_game_id text not null,                       -- chess.com uuid
  url              text,
  played_at        timestamptz,
  user_color       text check (user_color in ('white', 'black')),
  time_class       text,                                -- blitz / rapid / bullet / daily
  rules            text,                                -- 'chess' only (others filtered)
  rated            boolean,
  result_for_user  text check (result_for_user in ('win', 'loss', 'draw')),
  user_rating      int,
  opponent_rating  int,
  opponent_username text,
  eco              text,
  opening_name     text,
  opening_epd      text,
  pgn              text not null,
  analyzed_at      timestamptz,                          -- set once client analysis finishes
  created_at       timestamptz not null default now(),
  unique (user_id, provider, provider_game_id)
);
create index games_user_played_idx on public.games (user_id, played_at desc);
create index games_user_analyzed_idx on public.games (user_id, analyzed_at);

alter table public.games enable row level security;
create policy "games: all own"
  on public.games for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.games to authenticated;
grant all on public.games to service_role;

-- ── positions: GLOBAL, deduplicated by EPD (first 4 FEN fields) ─────────────
create table public.positions (
  epd          text primary key,                  -- placement + side + castling + en-passant
  fen          text not null,                     -- full FEN (for replay / halfmove logic)
  side_to_move text not null check (side_to_move in ('w', 'b'))
);
alter table public.positions enable row level security;
-- Positions are not sensitive; any authenticated user may read and contribute one.
create policy "positions: select" on public.positions for select to authenticated using (true);
create policy "positions: insert" on public.positions for insert to authenticated with check (true);
grant select, insert on public.positions to authenticated;
grant all on public.positions to service_role;

-- ── position_evals: GLOBAL engine cache, one row per (epd, engine_version) ──
create table public.position_evals (
  epd            text not null references public.positions (epd) on delete cascade,
  engine_version text not null,                   -- e.g. 'stockfish-18-lite'
  depth          int not null,
  best_move_uci  text not null,
  best_move_san  text,
  eval_cp        int,                             -- side-to-move POV; null when mate
  eval_mate      int,                             -- signed mate distance; null otherwise
  knodes         int,
  created_at     timestamptz not null default now(),
  primary key (epd, engine_version),
  constraint eval_cp_xor_mate check ((eval_cp is null) <> (eval_mate is null))
);
alter table public.position_evals enable row level security;
-- Evals are deterministic and non-sensitive; contribute-once (insert), no tamper (no update).
create policy "position_evals: select" on public.position_evals for select to authenticated using (true);
create policy "position_evals: insert" on public.position_evals for insert to authenticated with check (true);
grant select, insert on public.position_evals to authenticated;
grant all on public.position_evals to service_role;
