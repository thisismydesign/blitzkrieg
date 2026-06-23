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

- **`PracticeEngine`** is UI-agnostic and fully unit-tested. It holds a `chess.js`
  game, an index into the opening's `moves`, per-move timings, and error counts.
  `now()` is injected so timing is testable. Moves are compared by `from`/`to`/
  `promotion` (not SAN strings) to avoid check-symbol formatting mismatches; the
  canonical SAN shown to the user comes from `chess.js`.
- **`SessionScheduler`** picks the next line by `weight × recency`, where recency
  drops to `minFactor` right after a line is shown and recovers over `cooldown`
  draws. This is in-memory, per session only.
  The user starts after the opponent's first reply, so when playing White the
  engine auto-plays 1.e4/…/the reply first (`userStartIndex`).
- **`usePractice`** renders `engine.state()`, forwards user moves via `attempt()`,
  and schedules the opponent's reply on a timer so it reads as a separate move.
  `setFilters` rebuilds the scheduler pool from the chosen side / openings.
- **Persistence** is localStorage-only via `storage.ts`: `settings.ts` for options,
  `stats/lifetime.ts` for cross-visit totals (recorded once per finished practice
  in `App`). The engine exposes `expected` (the answer) so the UI can show hints.

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
