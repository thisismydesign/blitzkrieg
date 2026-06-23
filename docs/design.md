# Design notes

## Goal

Memorise opening sequences by repetition and speed. The user only sees a board;
the opposite side is pre-scripted theory (no engine). Practice ends when theory
ends — after that, moves are no longer forced.

## Move flow

1. A scenario is a fixed SAN line starting from White's first move.
2. The opponent's moves auto-play. The user always starts right after the
   opponent's first reply: playing Black, White's 1st move is shown; playing
   White, the user's 1st move **and** Black's reply are played for them. A short
   delay makes each move read as its own action.
3. The user plays their side. A move is checked against the next theory move:
   - **Correct** → applied; per-move time recorded; opponent replies.
   - **Legal but wrong** → reverted (piece snaps back), an error is shown, and the
     correct move's squares are highlighted. The move is *not* made for the user.
   - **Illegal** → snaps back, no penalty.
4. At the end of the line: accuracy + speed summary, then a new (different) opening.

We compare moves by `from`/`to`/`promotion` rather than SAN text, so a missing
`+`/`#` in the dataset can never cause a false mismatch.

Lines are trimmed to **end on a user move** so the satisfying final move is the
user's, not an auto-played reply.

## Spaced repetition (within a session)

`SessionScheduler` selects the next line with weighted random sampling on
`effectiveWeight = weight × recency`:

- `weight` (1–10) encodes how common a line is. Main lines are high; offbeat or
  sub-optimal opponent replies are low, so they appear less often.
- `recency(id)` is `minFactor` immediately after a line is shown and recovers
  linearly to `1` over `cooldown` subsequent draws.

Net effect: common lines dominate, the same line rarely repeats back-to-back, but
everything recurs over time. State is per session (no persistence) — deliberately
simple for a proof of concept.

## Timing

The engine records `now() - userTurnStart` for each correct move, where the timer
starts when control returns to the user. Errors cost time (the clock keeps
running), which rewards both accuracy and speed. `now` is injectable for tests.

## Hints

A 💡 button reveals help without making the move: first press highlights the
piece to move, a second press highlights its destination. Optionally (off by
default) the piece hint auto-appears after a configurable number of seconds.

## Options & lifetime stats

Options (side: White/Black/random, a specific-openings multi-select, and the
auto-hint settings) persist to localStorage. Each finished practice is folded
into lifetime totals (also localStorage), surfaced in the 📊 menu: average
accuracy, openings/moves played, average move time, and best/weakest opening by
average accuracy.

## Out of scope (PoC)

Accounts/server sync, full opening trees with live branching, engine evaluation,
and sound. The dataset is a curated subset of common lines.
