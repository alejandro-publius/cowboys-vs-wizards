# Design: Beginner Seat Privacy (`BSP-1`–`BSP-4`)

## Root Cause & Snapshot Constraint

`planTurn` (level `2`) already sanitizes hidden state via `knowable(state)` and cuts plans upon unseen `Scout` draws via `hideDraw`. In contrast, `simpleStep(state, 0)` hashed `JSON.stringify(blind.sides)` after clearing only `opponent(side).traps`.

Flipping default `level: 0` directly without a snapshot cut alters two downstream checks that exercise `level: 0`:
1. **Outrider Gate (`scripts/outrider-gate.mjs`):** All 10 frozen `Bone Fence` cases (`case-a`..`case-j`) run against the `level: 0` Wizard and turn `0 fresh, 10 stale` when `level: 0` tiebreaks move.
2. **Naive-attacker Boot Hill smoke (`tests/match/showdown-session.test.js`):** A script that always clicks the first non-end legal move wins `26/40` seeds instead of `>=36/40` because the `viewFor` hash shifts how often the Wizard summons vs. attacks with identical Skeletons, whereas `trail-sim.mjs` `simple` (`level: 1`) Cowboy stays `100.0%` (`1,000/1,000`).

## Pure Engine Candidate (`src/game/showdown/rules.js`)

1. Use one pure `viewFor(state, side)` in the engine and re-export it from `contract.js` for existing screens.
2. Add optional `{seatPrivate = false}` to `playTurn(state, level = 2, onAction, options = {})` and forward `seatPrivate` to `simpleStep(state, level, seatPrivate)`.
3. Default (`seatPrivate = false`) preserves 100% of November 20 snapshot replays; `{seatPrivate: true}` hashes `JSON.stringify(viewFor(state, side))`.
