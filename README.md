# ♞ Blitzkrieg

A mobile-first web app for drilling chess openings — fast and from memory.

You see only a board. Play the book moves of a randomly chosen opening as quickly
as you can; the opponent's replies are pre-scripted. Get a move wrong and it's
reverted with the correct move highlighted, so you can try again. Each line ends
where theory does, then you get speed/accuracy stats and a fresh opening.

- **Spaced repetition** within a session: common lines come up more often, every
  line can recur, but you won't see the same one twice in a row.
- **Both colours**: White and Black repertoires, plus some offbeat/sub-optimal
  opponent lines that show up less often. When you play White, your first move and
  the reply are played for you, then you take over.
- **Hints**: tap 💡 once to highlight the piece to move, again for its target — you
  still make the move. Optionally auto-reveal the piece after a configurable delay.
- **Options** (⚙): practise White, Black, or random; pick specific openings.
- **Lifetime stats** (📊): accuracy, moves, average speed, and best/weakest
  openings — saved locally so they persist across visits.
- **No engine** — just curated theory.

## Develop

```bash
mise install          # installs pinned Node + pnpm (see .tool-versions)
pnpm install
pnpm dev              # start Vite dev server
```

## Scripts

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Dev server                       |
| `pnpm build`     | Typecheck + production build     |
| `pnpm typecheck` | Types only                       |
| `pnpm lint`      | ESLint                           |
| `pnpm test`      | Vitest                           |
| `pnpm deploy`    | Deploy `dist/` to Cloudflare Pages |

Production builds are minified with Terser (comments and `console` stripped, no
source maps).

## Deploy

Build and deploy `dist/` to Cloudflare Pages with `pnpm deploy` (after
`wrangler login`). Config lives in `wrangler.toml`.

## Stack

React + TypeScript + Vite, [`chess.js`](https://github.com/jhlywa/chess.js) for
move legality and [`react-chessboard`](https://github.com/Clariity/react-chessboard)
for the board. See [`Agents.md`](./Agents.md) for architecture.
