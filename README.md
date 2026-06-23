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
- **Hints**: tap 💡 once to highlight the piece to move, again for its target.
  Optional auto-reveal after a delay. "Give hint when incorrect" (on by default)
  reveals just the part you got wrong — the correct piece, or the correct square.
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
| `pnpm run deploy` | Build, then deploy to Cloudflare Pages |

Production builds are minified with Terser (comments and `console` stripped, no
source maps).

## Deploy

`pnpm run deploy` builds and deploys to Cloudflare Pages (after `wrangler login`).
Config lives in `wrangler.toml`. Use `pnpm run deploy`, not `pnpm deploy` — the
latter is a pnpm built-in command, not this script.

## Stack

React + TypeScript + Vite, [`chess.js`](https://github.com/jhlywa/chess.js) for
move legality and [`react-chessboard`](https://github.com/Clariity/react-chessboard)
for the board. See [`Agents.md`](./Agents.md) for architecture.
