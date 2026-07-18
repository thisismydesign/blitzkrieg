# ♞ Blitzkrieg

A mobile-first web app for drilling chess openings — fast and from memory.

You see only a board. Play the book moves of a randomly chosen opening as quickly
as you can; the opponent's replies are pre-scripted. Get a move wrong and it's
reverted with the correct move highlighted, so you can try again. Each line ends
where theory does, then you get speed/accuracy stats and a fresh opening.

- **Guess the line**: the opening name is hidden until the end. Lines that share
  moves **branch** — at a fork any book move is correct and the one you play
  decides which opening you're in. The opponent's replies are weighted, so common
  lines come up more often. When you play White, your first move and the reply are
  played for you, then you take over.
- **Visual feedback only**: a green blip on the square you land on, teal blips on
  equally-correct alternatives (and the piece, if it differs), a red blip on a
  wrong square. No text telling you what to play.
- **Repeat until perfect**: a line repeats until you play it with zero mistakes,
  then you move on to a new one.
- **Spaced repetition**: new openings come up first; once you play one perfectly
  it's suppressed for a while (and longer each time you nail it again), so you
  meet fresh material instead of drilling the same line — a Leitner-style schedule
  ([design notes](./docs/design.md#spaced-repetition)).
- **Hints**: tap 💡 once to highlight the piece to move, again for its target.
  Optional auto-reveal after a delay. "Give hint when incorrect" (on by default)
  reveals just the part you got wrong — the correct piece, or the correct square.
- **Options** (⚙): practise White, Black, or random; pick specific openings.
- **Lifetime stats** (📊): accuracy, moves, average speed, and best/weakest
  openings — saved locally so they persist across visits.
- **No engine** — just curated theory.

## Develop

Blitzkrieg is a pnpm + Turborepo monorepo:

| Path | What |
| --- | --- |
| `apps/web` | React + Vite frontend |
| `packages/chess-core` | Shared, framework-free chess logic |
| `supabase` | Postgres schema, RLS, and edge functions |

```bash
mise install           # Node, pnpm, Deno, Supabase CLI (see .tool-versions)
pnpm install
cp .env.example .env   # fill in your Supabase project values
pnpm dev               # Vite dev server (apps/web)
```

### Local backend (Supabase)

The local database is the Supabase CLI stack (Docker, Postgres 17):

```bash
supabase start         # Postgres + Auth + PostgREST + Edge runtime, in Docker
supabase db reset      # apply migrations + seed
supabase stop
```

`supabase start` prints a local API URL and keys — put those in `.env.local`
(loaded ahead of `.env`) to develop fully offline. A standalone `postgres:17` is
also available via `docker compose up -d` on port 5433 for bare-DB use.

## Scripts

| Command          | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Frontend dev server                           |
| `pnpm build`     | Build all packages (Turbo)                    |
| `pnpm typecheck` | Types across the workspace                    |
| `pnpm lint`      | ESLint                                         |
| `pnpm test`      | Vitest (unit) across the workspace            |
| `pnpm format`    | Prettier                                       |
| `pnpm run deploy` | Build + deploy the frontend to Cloudflare Pages |

Production builds are minified with Terser (comments and `console` stripped, no
source maps).

## Deploy

CI deploys on push to `main` (frontend → Cloudflare Pages; migrations + edge
functions → Supabase). Manual frontend deploy: `pnpm run deploy` (after
`wrangler login`) — use `pnpm run deploy`, not `pnpm deploy` (a pnpm built-in).
See [`docs/technical.md`](./docs/technical.md#12-cicd).

## Stack

React + TypeScript + Vite, [`chess.js`](https://github.com/jhlywa/chess.js) for
move legality and [`react-chessboard`](https://github.com/Clariity/react-chessboard)
for the board, Stockfish (WASM) for analysis, [Supabase](https://supabase.com)
(Postgres + Auth + Edge Functions) for the backend, and FSRS
([`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)) for spaced
repetition. See [`Agents.md`](./Agents.md) and
[`docs/technical.md`](./docs/technical.md) for architecture.
