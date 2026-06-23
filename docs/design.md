# Design notes

## Goal

Memorise opening sequences by repetition and speed. The user only sees a board;
the opposite side is pre-scripted theory (no engine). Practice ends when theory
ends — after that, moves are no longer forced.

## Move flow

1. A practice runs over the candidate openings of one side (a move tree). The
   opening's **name is hidden** until the line resolves.
2. The opponent's moves auto-play, picked among viable continuations weighted by
   opening weight (common replies more often). The user starts right after the
   opponent's first reply: playing Black, White's 1st move is shown; playing
   White, the user's 1st move **and** Black's reply are played for them. A short
   delay makes each move read as its own action.
3. The user plays their side. Any move that continues a still-viable opening is
   correct, so a fork can have **several correct moves**; the one played narrows
   the candidates and decides which opening you end up in.
   - **Correct** → applied; per-move time recorded; a green blip marks the landing
     square, teal blips mark equally-correct alternatives (and the alternative
     piece, when it differs). Opponent replies.
   - **Legal but wrong** → reverted (piece snaps back); a red blip marks the square
     aimed at. With the optional *assist* setting, the correct piece and square are
     also highlighted.
   - **Illegal** → snaps back, no penalty.
4. When no viable opening has a further move the line has **resolved**; the summary
   reveals the opening with a colour-graded accuracy/speed breakdown.
5. **Repeat until perfect**: an imperfect line repeats (locked to that exact line)
   until played with no mistakes; only then does a new opening start. (The Skip
   button forces a new one anyway.)

We compare moves by `from`/`to`/`promotion` rather than SAN text, so a missing
`+`/`#` in the dataset can never cause a false mismatch. Lines **end on a user
move** so the final move is the user's, not an auto-played reply.

## Spaced repetition & branching

`SessionScheduler` picks the practice's lead opening with weighted random sampling
on `effectiveWeight = weight × recency`:

- `weight` (1–10) encodes how common a line is.
- `recency(id)` is `minFactor` right after a line is shown and recovers linearly to
  `1` over `cooldown` draws, so the same lead rarely repeats back-to-back.

The lead sets the side; the candidate set is every pooled opening of that side.
Within a practice, **weighting the opponent's branch choices** is what makes common
replies frequent and offbeat/sub-optimal ones rare — no separate logic needed.

## Timing

The engine records `now() - userTurnStart` for each correct move, where the timer
starts when control returns to the user. Errors cost time (the clock keeps
running), which rewards both accuracy and speed. `now` is injectable for tests.

## Hints

A 💡 button reveals help without making the move: first press highlights the
piece to move, a second press highlights its destination. Two optional settings
(both off by default): auto-show the piece hint after a configurable number of
seconds, and *assist* — reveal the correct move after a wrong attempt.

## Options & lifetime stats

Options (side: White/Black/random, a specific-openings multi-select, and the
auto-hint settings) persist to localStorage. Each finished practice is folded
into lifetime totals (also localStorage), surfaced in the 📊 menu: average
accuracy, openings/moves played, average move time, and best/weakest opening by
average accuracy.

## Out of scope (PoC)

Accounts/server sync, engine evaluation, and sound. Branching is limited to the
curated lines (a deep opening database is out of scope). The dataset is a curated
subset of common lines.
