# Architecture

Concise technical overview for contributors and coding agents.

## Layout

```
src/
  types.ts              Shared types (Opening, Settings, *Stats, ...)
  format.ts             ms/percent display helpers
  storage.ts            Fail-safe localStorage load/save
  settings.ts           Settings defaults + persistence
  chess/
    openings.ts         Curated opening lines (the dataset)
    scheduler.ts        SessionScheduler — weighted spaced repetition
    engine.ts           PracticeEngine — game state, validation, timing, stats
  stats/lifetime.ts     Persisted lifetime totals + aggregation
  hooks/usePractice.ts  React glue: owns the engine, auto-plays the opponent
  components/
    Board.tsx           react-chessboard wrapper (drag + tap-to-move + hints)
    StatsBar.tsx        Live timer / move count / errors
    Summary.tsx         End-of-line stats with colour grade
    Options.tsx         Options modal (side / openings / hints) + shared Modal
    StatsMenu.tsx       Lifetime stats modal
  App.tsx               Layout, menus, hint level, pulse, stat recording
```

## Core ideas

- **`PracticeEngine`** is UI-agnostic and fully unit-tested. It takes candidate
  openings sharing a side and treats them as a move tree: `viable` is the subset
  still matching the moves played. On the user's turn any move continuing a viable
  opening is correct (others are returned as `alternatives`); the move played
  narrows `viable`. Opponent / White-intro moves are picked among viable
  continuations weighted by opening weight (`rng` injected for tests). When no
  viable opening has a further move the line has resolved to one `outcome`. Moves
  are compared by `from`/`to`/`promotion`, not SAN. `now()` is injected for timing.
  The user starts after the opponent's first reply (`userStartIndex`).
- **`SessionScheduler`** picks the lead opening by `weight × recency` (recency
  drops to `minFactor` after a line is shown, recovering over `cooldown` draws),
  which sets the practice's side. In-memory, per session.
- **`usePractice`** renders `engine.state()`, forwards user moves via `attempt()`,
  and schedules opponent replies on a timer. A fresh practice's candidates are every
  pooled opening of the lead's side. `newPractice` repeats the same resolved line
  (single candidate) until it's played perfectly, then advances. `setFilters`
  rebuilds the scheduler pool from the chosen side / openings.
- **Persistence** is localStorage-only via `storage.ts`: `settings.ts` for options,
  `stats/lifetime.ts` for cross-visit totals (recorded once per finished practice
  in `App`). The engine exposes `expected` (a correct move) so the UI can show hints.

## Conventions

- Keep the engine pure of React; put orchestration/timing in the hook.
- `pnpm typecheck && pnpm lint && pnpm test` must pass (also enforced in CI).
- Strict TypeScript, ESLint (incl. react-hooks rules), Prettier.

## Adding an opening

Append to `OPENINGS` in `src/chess/openings.ts`:

```ts
{
  id: 'unique-id',
  name: 'Display Name',
  userSide: 'white' | 'black',
  moves: ['e4', 'e5', ...], // SAN, full line from White's 1st move
  weight: 1..10,            // higher = shown more often
  tag: 'Main line',
}
```

`openings.test.ts` enforces two invariants: every line is fully legal, and each
line **ends on a user move** (so the user plays the final move). See
[`docs/design.md`](./docs/design.md) for rationale.
