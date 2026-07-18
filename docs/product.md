# Blitzkrieg — What it is and why it exists

_A non-technical overview. For the architecture, see [`technical.md`](./technical.md); for the
opening-drill mechanics, see [`design.md`](./design.md)._

## The one-sentence version

**Blitzkrieg turns the mistakes you actually make in your own chess games into a
personalised, spaced-repetition drill — so you stop making them.**

## The problem

Most chess improvement below master level is not about learning new ideas — it's about
_not repeating the same mistakes_. You hang a piece in the same kind of position, mishandle
the same opening, miss the same tactic, over and over.

The usual tools don't fix this:

- **Game review** (chess.com / Lichess "analysis") tells you _what_ went wrong in a game you
  just played, once. You nod, you close the tab, and next week you make the same move again.
  It's passive, one-shot, and organised by _game_ rather than by _mistake_.
- **Puzzle trainers** drill generic tactics that may have nothing to do with the holes in
  _your_ game.
- **Opening courses** teach lines you may never reach and don't adapt to where _you_
  personally go wrong.

Nothing takes _your_ recurring mistakes and makes you practise them deliberately until they're
gone. That's the gap Blitzkrieg fills.

## The idea

Three steps, fully automatic:

1. **Connect your chess.com account.** Blitzkrieg imports your games (past and ongoing) using
   chess.com's public data. You don't upload anything by hand.
2. **We find your mistakes.** A chess engine re-examines every position _you_ had to move in,
   works out the best move, and flags the moments where your move measurably threw away the
   game — inaccuracies, mistakes, and blunders — and where you drifted out of solid opening
   theory.
3. **You drill them, and they stick.** Each mistake becomes a bite-sized exercise: you're
   dropped into the exact position, from memory, and asked to find the move you _should_ have
   played. A **spaced-repetition** schedule (the same proven method behind Anki flashcards)
   brings each mistake back at exactly the right time — soon if you fumble it, later once
   you've nailed it — until it's genuinely learned, not just seen.

The result is a training queue that is 100% about _your_ weaknesses and is measurably shrinking
over time.

## What makes it different

- **It's about you.** Every exercise comes from a real position from one of your own games —
  not a generic puzzle set.
- **Active recall, from memory.** You don't read an explanation; you have to _play_ the right
  move. That's what actually builds the habit. The board gives you visual feedback only — a
  quiet blip on the right square — no text telling you the answer.
- **Spaced, not one-shot.** Mistakes come back on a schedule tuned to how well you know them,
  so effort goes where it's needed and nothing is drilled to death.
- **Openings and middlegame, handled differently.** An opening slip drops you in where you
  left theory and asks for the book move. A middlegame blunder drops you one move before the
  mistake and asks for the engine's best move. (More on this distinction in
  [`design.md`](./design.md).)
- **Fast and low-friction.** Mobile-first, board-only, built for short sessions.

## Two ways to train

Blitzkrieg keeps the original **"drill the classic openings"** mode — a curated set of common
opening lines you practise for speed and recall, with no account required — and adds the new
**"drill my games"** mode described above. The openings mode is a great warm-up and a way to
learn theory; the games mode is where you fix your personal leaks.

You can use the openings mode with no login at all. The games mode needs an account (so your
games and progress are saved and private to you).

## Your data, your privacy

- You sign in with email or a social login (Google / GitHub). Your chess.com account is
  _linked_, not logged into — Blitzkrieg only ever reads the public game data chess.com already
  publishes.
- Everything we store about you — your games, your mistakes, your progress — is private to your
  account and readable only by you. You can delete it.
- We never post anything to your chess.com account or play on your behalf.

## Where it's going

- **Lichess support**, so the same drilling works for Lichess players (their data is even more
  open than chess.com's).
- **"Sign in with chess.com"** once we're approved for their official login, replacing the
  manual account-linking step.
- **Themes and patterns**: grouping your mistakes ("you keep hanging pieces to knight forks",
  "you struggle against the London") so you can drill a _weakness_, not just individual
  positions.
- **Progress you can feel**: trends showing your blunder rate falling and your accuracy rising
  as the drill queue does its job.

## Why "Blitzkrieg"?

The original app was about playing openings _fast_ from memory. The name stuck. The spirit is
the same: sharp, quick, repetition-until-automatic — now aimed at the specific mistakes holding
your rating back.
