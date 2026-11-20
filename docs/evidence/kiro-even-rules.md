# Even fight, items 1 to 3: Kiro CLI worker evidence

November 20, 2026 (America/Los_Angeles). Kiro CLI worker on branch `kiro/showdown-sprint-even-rules`, base `6a464e0`. Brief: `docs/design/showdown-even-fight-kiro-brief.md` at commit `f079fdc` (Fable 5.2, approved by Alex; not yet on this branch). Gameplay commit `b5e87e2`.

All results below are scripted (Node tests, bot simulations, headless Chrome harnesses). No human playtest was run or is claimed.

## What changed

- `src/game/showdown/cards.js`: the even-match Wizard deck holds 3 Skeletons and 2 Imps (was 4 and 1).
- `src/game/showdown/rules.js`: `createShowdown` without `baseOrbs` starts the side going first on 5 Base orbs and the side going second on 7 (`BASE_ORBS`, `SECOND_PLAYER_BASE`); `baseMax` is still the starting Base. A spell that chooses cannot choose a troop in cover; Hellfire skips covered troops and is not legal when every enemy troop is in cover.
- `src/game/showdown/trail.js`, `progress.js`: Dragon's Roost and the Graveyard Coven were built from the even-match deck. They now list their `755df56` counts, so neither changes.

## Setup checks against 755df56

- Every Trail duel (with and without 2 grit), rival and hunt, seeds 0 to 3: the whole initial state from `createShowdown` is byte-identical to `755df56` (scripted probe, not committed). `prototypes/showdown/even-setup.test.js` pins the Base numbers.
- Even match, 1,000 seeds × {random, Cowboy, Wizard first}: the same side opens and the Cowboy deal is identical to the old engine in all 3,000 cases; the side going second has 7 Base orbs and 5 cards in all 3,000.

## trail-sim.mjs, before and after

`node prototypes/showdown/trail-sim.mjs` (300 deals per row, seeds 0 to 299). Before: `6a464e0` (engine identical to `755df56`). After: the `b5e87e2` engine. Cowboy win % for careless / simple / careful.

| Duel | Before | After |
| --- | --- | --- |
| Trail 1. Boot Hill | 99 / 100 / 100 | 99 / 100 / 100 |
| Trail 2. Raven Roost | 100 / 99 / 100 | 100 / 99 / 100 |
| Trail 3. The Bone Fence | 69 / 88 / 100 | 69 / 87 / 100 |
| Trail 4. Imp Hollow | 41 / 85 / 89 | 41 / 85 / 89 |
| Trail 5. The Hexed Mile | 20 / 60 / 95 | 22 / 63 / 95 |
| Trail 6. Dragon's Roost | 19 / 41 / 78 | 19 / 41 / 78 |
| Rival 1. The Stargazer | 22 / 33 / 90 | 21 / **40** / 93 |
| Rival 2. The Imp | 30 / 56 / 88 | 29 / 58 / 89 |
| Rival 3. The Bonewright | 11 / 37 / 91 | 11 / 37 / 91 |
| Rival 4. The Graveyard Coven | 8 / 12 / 58 | 9 / 12 / 59 |
| Lantern Wraith, hunt 1 | 89 / 91 / 97 | 87 / **95** / 99 |
| Lantern Wraith, hunt 2 | 77 / 86 / 97 | 76 / **92** / 99 |
| Lantern Wraith, hunt 3 | 41 / 68 / 87 | 42 / 69 / 87 |
| Lantern Wraith, hunt 4 | 33 / 61 / 85 | 30 / 64 / 86 |
| Lantern Wraith, hunt 5 | 16 / 39 / 62 | 15 / 39 / 63 |
| Graveyard Dragon, hunt 1 | 51 / 60 / 95 | 49 / 61 / 95 |
| Graveyard Dragon, hunt 2 | 27 / 44 / 79 | 26 / 44 / 79 |
| Graveyard Dragon, hunt 3 | 18 / 36 / 73 | 17 / 36 / 72 |
| Graveyard Dragon, hunt 4 | 12 / 28 / 67 | 13 / 27 / 66 |
| Graveyard Dragon, hunt 5 | 6 / 20 / 55 | 6 / 19 / 54 |
| Open range (the even match) | 10 / 14 / 65 | 10 / 11 / **59** |

Bold: moved by more than 3 points. The six Trail duels moved by 3 at most. The Stargazer and Wraith hunts 1 and 2 (simple player) and Open range (careful player) moved by more. The brief's stop condition was sent to the coordinator; nothing was retuned. These are estimates from single 300-deal rows under these bot levels.

## Checks run on b5e87e2

- `node --test prototypes/showdown/*.test.js tests/game/showdown-presenter.test.js tests/match/showdown-*.test.js`: 115 pass, 0 fail. The ramp test in `progress.test.js` passes and was not edited.
- `node --test tests/game/showdown-properties.test.js`: 16 pass.
- `npm test`: all suites pass except two Sheriff's Ledger tests. `src/ui/sheriffs-ledger.data.js` still shows the old starter counts (Skeleton 4, Imp 1). That file belongs to the Ledger worker and was not edited here.
- `npm run build`, then `browser-showdown-check.mjs` (22 checks) and `browser-showdown-modes-check.mjs` (13 checks) on the built graybox: pass.
- `node prototypes/showdown/build.mjs`, then `bo3-browser-check.mjs` (47 checks) and `campaign-browser-check.mjs` (55 checks): pass.

Pending (other owners): Night Shift review on deals 0 to 1999 (done-when 1), Ledger (2), both hands at the end of a duel and property 4 (6).
