# Blitzkrieg — Technical design

Architecture and implementation reference for the full-stack chess-training app. Pairs with
[`product.md`](./product.md) (the "why") and [`design.md`](./design.md) (the opening-drill engine
mechanics, which this reuses). This document is the source of truth referred to during
implementation.

> Status: this describes the target design. Sections marked _(MVP)_ are what the first working
> vertical slice implements; _(later)_ marks the documented-but-deferred scale path.

---

## 1. Product in one paragraph

Users sign in, link their chess.com account, and Blitzkrieg imports their games. A chess engine
finds the best move in every position the user had to play and flags the moves that measurably
lost ground (inaccuracy / mistake / blunder) or left opening theory. Each flagged moment becomes
a drill: the user is dropped into the position and must play the move they _should_ have played.
An **FSRS** spaced-repetition schedule brings each mistake back at the right time until it's
learned. The original **curated-openings** drill mode is retained.

---

## 2. Technology choices

Picked for _latest mutually-compatible and stable_, not newest-on-npm. Where a newer major exists
but the ecosystem isn't ready, the reason is noted so the choice can be revisited.

| Concern | Choice | Version | Why / notes |
| --- | --- | --- | --- |
| Language | TypeScript | 5.9.x | **Not 6/7 yet:** `typescript-eslint` peer-caps at `<6.1.0`, so TS 6/7 breaks type-aware linting. Revisit when it ships TS 7 support. |
| Frontend | React + Vite | React 19.2, Vite 7 | SPA, static-hosted. **Not Vite 8:** it's Rolldown-based and bleeding-edge; `@vitejs/plugin-react@6` requires it. Revisit once stable. |
| Board / rules | react-chessboard + chess.js | 4.7, 1.4 | Already integrated and working. react-chessboard 5 is a full rewrite — not worth breaking a working board (not a "big" topic). |
| Chess engine | `stockfish` (nmrugg) WASM | 18.0.8 | `stockfish-18-lite-single` (~7 MB, single-thread, **no COOP/COEP headers**). Runs in a Web Worker. Multi-thread build is the `(later)` upgrade. |
| Spaced repetition | `ts-fsrs` (FSRS-6) | 5.4.1 | Modern SM-2 successor, Anki's default. Pure function; runs client-side. MIT. |
| Server state / fetching | TanStack Query | 5 | Caching/async state for Supabase reads (games, mistakes, review queue). |
| Routing | React Router | 7 | Stable, standard. TanStack Router considered (more type-safe) — heavier; revisit if we want file-based typed routes. |
| Runtime validation | Zod | 4 | Env-var validation, chess.com API response parsing, edge-function I/O contracts. |
| Backend platform | Supabase | — | Postgres 17, Auth, Edge Functions (Deno/TS), RLS, `pgmq`, `pg_cron`. |
| DB workflow | Supabase SQL migrations + generated types | — | `supabase gen types typescript` → typed `supabase-js`. **Not Drizzle/Kysely:** keeps one SQL source of truth for RLS/policies/extensions; generated types give full type-safety without a second schema DSL. |
| Monorepo | pnpm workspaces + Turborepo | pnpm 10, turbo 2 | Task orchestration + caching across `apps/web`, `packages/chess-core`, `supabase`. |
| Unit tests | Vitest | 3 | Web + `chess-core`. |
| Component tests | Vitest + Testing Library | RTL 16 | React component behaviour. |
| E2E | Playwright | 1.61 | Best-in-class over Cypress. Drives the real app in a browser. |
| Request/integration tests | Vitest vs local Supabase stack | — | The "Rails request spec" analog: hit PostgREST + Edge Functions as real roles, assert RLS. |
| Lint / format | ESLint + Prettier + typescript-eslint | ESLint 10, Prettier 3 | Flat config; strict, type-aware. |

**Non-negotiables** (from the research brief): chess.com fetched **server-side only** (serial, contact
`User-Agent`, ETag caching); **Stockfish never in an Edge Function**; **4-field FEN/EPD** is the
universal position key (never strip castling/en-passant); Lichess classification constants pinned
in one module; card = one mistake-position, full FSRS Card persisted, RLS `(select auth.uid()) =
user_id` on every user table; store `depth`+`engine_version`+`knodes` with every cached eval.

---

## 3. Repository layout (monorepo)

```
blitzkrieg/
  apps/
    web/                  React + Vite frontend (the current app, moved here)
      src/
        chess/            existing opening engine + scheduler (reused)
        drill/            NEW: drill-a-mistake wiring around PracticeEngine
        games/            NEW: import UI, game list, mistake list (TanStack Query)
        auth/             NEW: Supabase auth, chess.com account linking
        engine/           NEW: Stockfish WASM worker client
        lib/supabase.ts   supabase-js client (url + publishable key only)
        ...               existing components/hooks
      e2e/                Playwright tests
  packages/
    chess-core/           Shared, pure TS (no React, no DOM): usable by web AND edge fns
      src/
        fen.ts            EPD/FEN normalisation + position keys
        pgn.ts            PGN → moves/positions/clocks (chess.js)
        classify.ts       Lichess win% + accuracy + inaccuracy/mistake/blunder
        openings.ts       ECO lookup (Lichess chess-openings EPD map)
        mistakes.ts       walk a game → the user's flagged positions + drop-in
        fsrs.ts           attempt outcome → FSRS Rating; schedule helpers
  supabase/
    config.toml           local stack config (major_version = 17)
    migrations/           versioned SQL (schema, RLS, grants, extensions)
    functions/            Edge Functions (Deno/TS): import, verify-account, ...
    tests/                request-level tests (Vitest) against the local stack
    seed.sql              dev seed data
  docs/                   product.md, technical.md, design.md
  docker-compose.yml      pinned postgres:17 (standalone/test Postgres)
  turbo.json              task graph
  pnpm-workspace.yaml
  .tool-versions          mise: node, pnpm, supabase CLI, deno
  .env.example            documented env template (real values in gitignored .env)
```

`chess-core` is the keystone: it is pure TypeScript with no React or DOM dependency, so the exact
same classification / FEN / opening logic runs in the browser (analysis, drilling) and, where
needed, in Deno edge functions and Node tests. No logic is duplicated across the stack.

---

## 4. Data model

Postgres, one schema (`public`). Every user-owned table has `user_id uuid references auth.users`,
RLS enabled, and an explicit `grant` to `authenticated` (the project does **not** auto-expose new
tables, so exposure is deliberate). Position/eval tables are **global** (deduplicated across all
users) and readable by any authenticated user but writable only via service role.

Position key everywhere = **EPD** = the first 4 FEN fields (placement, side-to-move, castling,
en-passant), stored as `text`. The full FEN is kept alongside for replay.

```
profiles                         one row per auth user
  user_id (pk, fk auth.users)
  display_name, created_at

chesscom_accounts                a user's linked chess.com account(s)
  id (pk), user_id (fk)
  chesscom_player_id (bigint)    STABLE identity (usernames change)
  username (citext)
  verified_at, verification_token (transient)
  last_synced_at, created_at
  unique (user_id, chesscom_player_id)

import_jobs                      one per sync run; drives the queue/progress UI
  id (pk), user_id (fk), account_id (fk)
  status (queued|running|done|error)
  months_total, months_done, games_imported, error, created_at, updated_at

archive_months                   per-month ETag cache for conditional GETs
  id (pk), account_id (fk)
  yyyymm (text), etag, last_modified, last_fetched_at, game_count
  unique (account_id, yyyymm)

games                            one imported game (user-owned)
  id (pk), user_id (fk), account_id (fk)
  provider (text default 'chesscom')   -- provider-agnostic for Lichess later
  provider_game_id (text)              -- chess.com uuid
  url, played_at (timestamptz)
  user_color (white|black)
  time_class, rules, rated, result_for_user (win|loss|draw)
  user_rating, opponent_rating, opponent_username
  eco, opening_name, opening_epd
  pgn (text)
  unique (user_id, provider, provider_game_id)

positions                        GLOBAL, deduplicated decision positions
  epd (pk)                        -- 4-field FEN
  fen (full), side_to_move
  ply, is_book (bool)             -- book/opening context (nullable until known)

position_evals                   GLOBAL engine cache, one row per (epd, engine)
  epd (fk positions), engine_version (text), depth (int)
  best_move_uci, best_move_san
  eval_cp (int, null if mate), eval_mate (int, null otherwise)   -- side-to-move POV
  knodes (int), created_at
  pk (epd, engine_version)

mistakes                         a user's flagged move in a game (the drillable item)
  id (pk), user_id (fk), game_id (fk)
  ply, epd (the position BEFORE the user's move), fen
  played_uci, played_san
  best_uci, best_san
  win_before (real), win_after (real), win_drop (real)
  severity (inaccuracy|mistake|blunder)
  phase (opening|middlegame|endgame)
  lead_in_uci (nullable)          -- the one opponent ply to auto-animate
  created_at
  unique (user_id, game_id, ply)

review_cards                     FSRS state, one per (user, mistake)  -- mirrors ts-fsrs Card
  id (pk), user_id (fk), mistake_id (fk)
  state smallint, due timestamptz, stability double precision, difficulty double precision,
  elapsed_days int, scheduled_days int, learning_steps int, reps int, lapses int,
  last_review timestamptz, updated_at
  unique (user_id, mistake_id)
  index (user_id, due)            -- the due-queue query

review_logs                      append-only, for later FSRS weight optimisation
  id (pk), card_id (fk), user_id (fk)
  rating smallint, state smallint, due, stability, difficulty,
  scheduled_days int, elapsed_days int, reviewed_at
```

**RLS pattern** (every user table): enable RLS; `for all to authenticated using ((select
auth.uid()) = user_id) with check ((select auth.uid()) = user_id)`. Global tables (`positions`,
`position_evals`): `for select to authenticated using (true)`; writes only via service role.
`grant select, insert, update, delete on <user tables> to authenticated` (explicit, because the
project doesn't auto-expose).

**Why global position/eval tables:** the same position occurs across many games and users;
computing Stockfish once per EPD and caching it means a popular position is analysed once, ever.

---

## 5. chess.com integration

### 5.1 Import pipeline _(server-side only)_

Runs in a Supabase **Edge Function** (`functions/import-games`), never the browser (browsers strip
custom `User-Agent`; CORS + etiquette require server-side). Confirmed live against `csa531`.

1. `GET /pub/player/{username}/games/archives` → list of monthly archive URLs.
2. For each month **strictly serially** (serial = never rate-limited; the API 429s on >3 concurrent
   per IP): conditional `GET /pub/player/{username}/games/{YYYY}/{MM}` sending
   `If-None-Match`/`If-Modified-Since` from `archive_months`. On `304` skip; on `200` store the new
   `ETag`/`Last-Modified`.
3. Header `User-Agent: blitzkrieg/1.0 (+contact: csaba@ticketinghub.com)`.
4. For each game: filter `rules === 'chess'`; determine `user_color` by matching
   `chesscom_player_id`; derive `result_for_user`; store `games` row (pgn + metadata). Parse the PGN
   with `chess-core/pgn.ts` to enumerate positions.
5. Large histories exceed one Edge invocation's wall clock (150 s free / 400 s paid) → structure as
   a **pgmq** queue: one invocation enqueues month URLs, a worker invocation processes a bounded
   batch per call and records progress on `import_jobs` in a `finally` block _(later; MVP does a
   bounded synchronous import of the most recent N months)_.

The game object fields we rely on (verified live): `uuid`, `url`, `pgn`, `time_control`,
`time_class`, `rules`, `rated`, `end_time`, `white/black {username, rating, result}`, `eco`, `fen`.

### 5.2 Account linking / verification

chess.com has **no self-serve OAuth** (it's approval-gated), so v1 uses the **profile-token
handshake**:

1. User enters their chess.com username. We call `GET /pub/player/{username}` and store
   `chesscom_player_id` (stable) + `username`.
2. We generate a short `verification_token` and ask the user to paste it into their chess.com
   profile **Name** or **Location** field.
3. `functions/verify-account` polls `GET /pub/player/{username}` until the token appears in
   `name`/`location`, then sets `verified_at` and tells the user they can remove it.

Verification is **optional** for MVP (a personal tool can trust the entered username), but the hook
is built. "Sign in with chess.com" via official OAuth is the `(later)` upgrade. Schema is
`provider`-tagged so **Lichess** (real OAuth, open DB) drops in as a second provider.

---

## 6. Engine analysis _(client-side, MVP)_

Stockfish WASM runs in a **Web Worker** in the browser (`apps/web/src/engine/`). This sidesteps
every Edge Function CPU/timeout limit and costs zero server compute.

- Build: `stockfish-18-lite-single` (~7 MB, single-thread, no cross-origin-isolation headers).
- Drive over **UCI**: `uci` → `isready` → `position fen <FEN>` → `go depth 18` → read
  `info … score cp <x>` / `score mate <y>` (side-to-move POV) and final `bestmove <uci>`.
- **Fixed `go depth`** (not movetime) for reproducible, cacheable evals.
- For each position, first check `position_evals` for a cached row at ≥ our depth; only run the
  engine on a miss, then upsert `{epd, engine_version, depth, best_move, eval_cp/mate, knodes}`.
- Analysis is a **resumable queue** persisted in the DB, so closing the tab and returning continues
  where it left off.

`(later)` scale path: multi-thread WASM (add COOP/COEP headers — verify auth popups still work) or a
native-Stockfish worker on Fly.io/Railway pulling `pgmq` and writing back via the service-role key.
Never Edge-Function-per-position (the ~200 ms CPU cap makes deep analysis impractical).

Only Lichess `/api/cloud-eval` is an optional fast-path for _opening_ positions (it 404s on arbitrary
mid-game positions, so it can never be primary). chess.com exposes no eval API.

---

## 7. Mistake detection & drill construction

Implemented in `chess-core` so analysis (browser) and tests (Node) share it exactly.

### 7.1 Classification (Lichess constants — pinned in `classify.ts`)

```
Win%      = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)          // cp = side-to-move POV
Accuracy% = 103.1668 * exp(-0.04354 * (winBefore - winAfter)) - 3.1669   // clamp [0,100]
```

For each of the **user's own moves**: compute `winBefore` (best move's eval, side-to-move POV) and
`winAfter` (eval after the played move, converted to the same POV). `winDrop = winBefore -
winAfter` (in 0–1). Classify:

- `winDrop >= 0.30` → **blunder**, `>= 0.20` → **mistake**, `>= 0.10` → **inaccuracy**.
- **Guard:** if `winBefore < ~0.30` (already losing), suppress "blunder" (a lost position can't
  blunder into a bigger loss).
- MVP drills **mistakes + blunders** of the user's moves (inaccuracies optional/off by default).

### 7.2 Drop-in point (Lichess puzzle convention)

We drill the user's _own_ mistake, so the learner is the **side to move** at the mistake position.
Store the FEN of the position **before** the user's move as the drill start; auto-animate the
single opponent ply that led into it (`lead_in_uci`) for context; then hand control to the learner
and require the engine's `best_uci`. For the very first move of a game, render static (no lead-in).
**No full-game run-up** — one ply of context is the convention (an expandable "show earlier moves"
is UI-only, not part of the solve).

### 7.3 Opening vs middlegame

A mistake is **opening-phase** if its position was still in book. Detect "in book" via the ECO/EPD
map (`openings.ts`): while positions match opening entries, the game is in theory; the first
position absent from book is where a side left theory. Require **book-exit _and_ an eval drop**
before labelling an opening mistake ("out of book" can just mean "rare but sound"). Opening drills
still drop in at the deviation position (not move 1), same 1-ply lead-in; the "correct" answer is
the main book move where one exists, else the engine best.

### 7.4 Reusing `PracticeEngine`

A mistake is modelled as a **single-move "line"** for the existing UI-agnostic
[`PracticeEngine`](../apps/web/src/chess/engine.ts): candidate = one `Opening`-shaped object whose
`moves` are `[...leadIn, bestMove]` and whose `userSide` is the mistake's side to move. The engine's
existing correct/incorrect feedback, hint, and timing machinery then apply unchanged. This is why
the opening-drill engine is reused rather than rebuilt.

---

## 8. Spaced repetition (FSRS)

`ts-fsrs` (FSRS-6), card = **one mistake-position**. The full ts-fsrs `Card` is persisted in
`review_cards`; every attempt appends to `review_logs` (for later per-user weight optimisation).

**Grade an attempt → FSRS `Rating`** (`fsrs.ts`, thresholds are tunable config):

- **Again (1):** wrong move / gave up / revealed the solution.
- **Hard (2):** correct only after a wrong first try, or slow first-try (> ~15 s), or used a hint.
- **Good (3):** correct first try, normal pace (default success).
- **Easy (4):** correct first try, fast (< ~4 s), no hint.

Flow: load `review_cards` row → hydrate `Card` → compute rating from the drill outcome →
`f.next(card, now, rating)` → upsert returned fields + insert `review_logs`. **Due-queue:**
`select … where user_id = auth.uid() and due <= now() order by due`. New mistakes enter as
`createEmptyCard()`. Weight optimisation is deferred until there are hundreds of reviews/user; stock
FSRS-6 weights ship fine.

The existing session-only Leitner scheduler ([`scheduler.ts`](../apps/web/src/chess/scheduler.ts))
remains for the **logged-out curated-openings** mode; FSRS + Supabase is the **logged-in** path.

---

## 9. Auth & client access

- **Supabase Auth**: email + OAuth (Google/GitHub). The frontend gets **only** `SUPABASE_URL` +
  `SUPABASE_PUBLISHABLE_KEY` (exposed via Vite from the root `.env`; never the secret key).
- `supabase-js` client with the publishable key → PostgREST Data API, subject to RLS.
- Edge Functions use the **secret (service-role) key** for writes to global tables and cross-user
  maintenance, and validate the caller's JWT (`SUPABASE_JWKS_URL`) for user-scoped actions.
- **Logged-out** users keep the current localStorage-only curated-openings experience; logging in
  enables games/mistakes/FSRS sync.

---

## 10. Local development

Goal: Postgres in Docker, everything else native via `mise`; pinned, up-to-date, Supabase-supported
Postgres = **17**.

- **`mise`** (`.tool-versions`) pins `node`, `pnpm`, the **Supabase CLI**, and **deno** (edge fns).
- **Supabase CLI stack** (`supabase start`) is the source-of-truth local database — it runs Postgres
  **17** (`config.toml major_version = 17`) + Auth + PostgREST + Edge runtime in Docker. This _is_
  "Docker for Postgres."
- **`docker-compose.yml`** additionally pins `postgres:17` on a non-default port as a standalone
  Postgres for plain-DB use / request-test isolation (avoids the CLI's 54322). Single pinned version
  across both.
- `.env` (gitignored) holds real secrets; **`.env.example`** documents every variable. Frontend
  reads url + publishable key; server reads secret key + DB password + JWKS url.
- Common flow: `mise install && pnpm install && supabase start && pnpm dev`.

The two-Postgres note: the Supabase stack is authoritative for dev; docker-compose Postgres is only
for scenarios that want a bare DB. They never run on the same port.

---

## 11. Testing strategy (multiple levels)

| Level | Tool | Scope |
| --- | --- | --- |
| Unit (pure) | Vitest | `chess-core` (classification, FEN/EPD, PGN, mistakes, FSRS grading) and web utilities. Deterministic, no I/O. |
| Component | Vitest + Testing Library | React components (Board interactions, drill flow) with a mocked engine/data layer. |
| Request / integration | Vitest vs local Supabase | The "Rails request spec" analog: run `supabase start`, then hit PostgREST + Edge Functions with `supabase-js` as **anon**, **user A**, **user B**, asserting **RLS** (A cannot read B's games), import behaviour, and verification. |
| E2E | Playwright | Full browser: log in, link account (mocked chess.com), import, run a drill end-to-end. Curated-openings mode logged-out. |

Determinism: engine `rng`/`now` are already injectable in `PracticeEngine`; chess.com and Stockfish
are mocked in unit/component/e2e and exercised for real only in a dedicated, opt-in integration run.

---

## 12. CI/CD

GitHub Actions. Existing jobs (typecheck, lint, test, build) extend to the monorepo via Turborepo
(`turbo run …`).

- **CI (every push):** `typecheck`, `lint`, `test` (unit + component), `build`. A **request-tests**
  job boots the Supabase CLI stack (Docker is available on GitHub runners), applies migrations, and
  runs the integration suite. An **e2e** job runs Playwright against a preview build.
- **CD (push to `main`):** deploy job →
  1. `pnpm --filter web build` + `wrangler pages deploy` (Cloudflare Pages, existing).
  2. `supabase db push` (apply migrations to the linked cloud project).
  3. `supabase functions deploy` (edge functions).
  - Secrets (GitHub Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
    `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`. Documented in
    `.env.example` + README.

Deploys are ordered migrations-before-frontend where a schema change is backward-incompatible; MVP
keeps migrations additive so ordering is safe.

---

## 13. Security & privacy

- RLS on every user table; `(select auth.uid()) = user_id` (wrapped in `select` for per-query
  caching). Explicit `grant`s (no accidental exposure).
- Secret key / DB password / JWKS url are **server-only**; never in the client bundle (enforced by
  exposing only url + publishable key through Vite).
- We only ever **read** chess.com public data; we never write to or act on the user's chess.com
  account.
- User data (games, mistakes, progress) is private to the account and deletable (a "delete my data"
  path cascades from `auth.users`).
- chess.com etiquette: contact `User-Agent`, serial requests, ETag caching, respect the ~12 h
  refresh.

---

## 14. Key risks & mitigations

| Risk | Mitigation |
| --- | --- |
| chess.com OAuth unavailable/approval-gated | Ship profile-token handshake; OAuth is an upgrade, not a dependency. |
| Client WASM needs the tab open + device CPU | Resumable DB-backed analysis queue; lower depth on weak devices; native-worker `(later)`. |
| Analysis depth vs quality unbenchmarked | Store `depth`+`knodes`; benchmark on target hardware; re-computable when depth rises. |
| Lichess formula constants "might change" | Pinned in one `classify.ts` module; periodic re-verify. |
| "Out of book" ≠ mistake | Require book-exit **and** eval drop before labelling an opening mistake. |
| FSRS default weights are flashcard-trained | Collect `review_logs` from day one; optimise later. |
| Two local Postgres instances clash on ports | Supabase CLI stack authoritative; docker-compose PG on a different port. |
| Bleeding-edge toolchain (TS 7 / Vite 8) breakage | Stay on latest mutually-compatible stable; upgrade when `typescript-eslint`/plugins support them. |

---

## 15. Build order (commits)

1. Docs (this + product.md). 2. Monorepo restructure. 3. Local dev env (Supabase CLI + Docker PG17).
4. DB schema + RLS + migrations. 5. `chess-core` (classification/EPD/PGN/mistakes/FSRS) + unit tests.
6. chess.com import edge function + request tests. 7. Client Stockfish analysis + eval cache.
8. Drill-your-mistakes mode + FSRS scheduling (frontend). 9. Tests (unit + request + e2e). 10. CI +
auto-deploy on `main`.

Each is a self-contained, reviewable commit on `feat/chesscom-game-drilling`.
