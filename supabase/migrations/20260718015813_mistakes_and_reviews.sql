-- The user's flagged mistakes (drillable items) and their FSRS review state.

-- ── mistakes: a user's flagged move in a game — the drillable item ──────────
create table public.mistakes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  game_id     uuid not null references public.games (id) on delete cascade,
  ply         int not null,                        -- 0-based ply index of the user's move
  epd         text not null references public.positions (epd),  -- position BEFORE the user's move
  fen         text not null,
  played_uci  text not null,
  played_san  text,
  best_uci    text not null,
  best_san    text,
  win_before  real not null,                        -- 0..1 win prob (side to move), best line
  win_after   real not null,                        -- 0..1 win prob after the played move
  win_drop    real not null,                        -- win_before - win_after
  severity    text not null check (severity in ('inaccuracy', 'mistake', 'blunder')),
  phase       text not null check (phase in ('opening', 'middlegame', 'endgame')),
  lead_in_uci text,                                 -- single opponent ply to auto-animate (nullable)
  created_at  timestamptz not null default now(),
  unique (user_id, game_id, ply)
);
create index mistakes_user_idx on public.mistakes (user_id, created_at desc);
create index mistakes_game_idx on public.mistakes (game_id);

alter table public.mistakes enable row level security;
create policy "mistakes: all own"
  on public.mistakes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.mistakes to authenticated;
grant all on public.mistakes to service_role;

-- ── review_cards: FSRS state, one per (user, mistake) — mirrors ts-fsrs Card ─
create table public.review_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  mistake_id     uuid not null references public.mistakes (id) on delete cascade,
  state          smallint not null default 0,       -- 0 New, 1 Learning, 2 Review, 3 Relearning
  due            timestamptz not null default now(),
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  last_review    timestamptz,
  updated_at     timestamptz not null default now(),
  unique (user_id, mistake_id)
);
create index review_cards_due_idx on public.review_cards (user_id, due);

create trigger review_cards_set_updated_at
  before update on public.review_cards
  for each row execute function public.set_updated_at();

alter table public.review_cards enable row level security;
create policy "review_cards: all own"
  on public.review_cards for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.review_cards to authenticated;
grant all on public.review_cards to service_role;

-- ── review_logs: append-only, for later FSRS weight optimisation ────────────
create table public.review_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  card_id        uuid not null references public.review_cards (id) on delete cascade,
  rating         smallint not null,                 -- 1 Again, 2 Hard, 3 Good, 4 Easy
  state          smallint not null,
  due            timestamptz,
  stability      double precision,
  difficulty     double precision,
  scheduled_days integer,
  elapsed_days   integer,
  reviewed_at    timestamptz not null default now()
);
create index review_logs_card_idx on public.review_logs (card_id, reviewed_at);
create index review_logs_user_idx on public.review_logs (user_id, reviewed_at desc);

alter table public.review_logs enable row level security;
create policy "review_logs: all own"
  on public.review_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.review_logs to authenticated;
grant all on public.review_logs to service_role;
