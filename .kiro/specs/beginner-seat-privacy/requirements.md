# Beginner Seat Privacy (Issue #223)

## Introduction

In Showdown (`src/game/showdown/rules.js`), the level-0 beginner opponent (`simpleStep` when `level === 0`, used by Boot Hill, Raven Roost, and The Bone Fence) breaks ties deterministically from the board state rather than advancing a mutable PRNG. Under the frozen November 20 snapshot (`93db9f3`), `simpleStep` clears only `opponent(side).traps` and hashes `JSON.stringify(blind.sides)`, which still includes `sides[opponent].hand`, `sides[opponent].deck`, and `sides[side].deck`. On seed `6` (`first: "wizard"`), swapping the top two unseen cards in the Cowboy draw pile (`Outrider` and `Sheriff`) leaves `viewFor(state, "wizard")` identical yet flips the Wizard's turn-1 summon from `wizard-jack-o-lantern-1` to `wizard-skeleton-1`.

Per Issue #223 ("Record the comparison before changing the released bot. The approved November 20 snapshot limits which bot and card changes ship"), the seat-private tiebreak ships as an opt-in `{seatPrivate: true}` mode on `playTurn` so all frozen November 20 snapshot receipts (including the Outrider Gate's 10 `Bone Fence` cases) stay intact while the candidate policy is verified end-to-end.

## Requirements

- BSP-1: WHEN `playTurn` runs with `{seatPrivate: true}` at level `0`, THE Showdown engine SHALL compute its deterministic choice solely from information exposed by `viewFor(state, state.active)`.
- BSP-2: WHEN `playTurn` runs without `{seatPrivate: true}`, THE Showdown engine SHALL preserve the November 20 snapshot behavior byte-for-byte so frozen Outrider Gate (`G1`–`G7`) and RNG duel digests remain intact until design approval.
- BSP-3: WHEN two Showdown states have deep-equal `viewFor(first, first.active)` and `viewFor(second, second.active)` views, THE Showdown engine under `{seatPrivate: true}` SHALL choose the identical pre-reveal actions at bot levels `0`, `1`, `1.5`, and `2`, including on seed `6` (`first: "wizard"`).
- BSP-4: THE repository test suite SHALL use `fast-check` to catch and shrink the unflagged level-0 hidden-deck dependency and to verify hidden-information invariance across both seats and unseen hand, draw-pile, and trap permutations under `{seatPrivate: true}`.
