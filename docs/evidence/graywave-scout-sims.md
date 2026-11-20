# Scout fair-bot fix: before/after simulation numbers

Kiro CLI (Kiro agent), 2026-11-19 America/Los_Angeles, Node v26.0.0, macOS.
Task: brief `docs/design/showdown-integration-kiro-brief.md`, "Answer on the Scout bot".
Before: a9aa828 (github/main). After: 3dd47f1 (code commit, fix from 7e8e6eb applied to
`src/game/showdown/rules.js` plus `tests/game/showdown-fair-bot.test.js`).
Bots and rules are those in `src/game/showdown/rules.js`; no card, deck or level changed.

Gate (brief, Done when 3): no single Trail win rate moves more than 3 points and the
`progress.test.js` ramp passes unchanged. Observed: largest move 2 points
(Rival 4 careful, 56% to 58%); ramp passed; gate not tripped. These are estimates
under the tested seeds, not playtest results.

## `node prototypes/showdown/sim.mjs 1000` (seeds 0-999, each with both first seats, level-2 mirror)

Before (a9aa828):
```
2000 games: first player wins 57.5%, Cowboys win 59.3%, draws 0.0%
turns: 13.4 on average, longest 27; ended by {"base":2000}
per game: summon 12.89, turn 12.37, draw 13.38, spell 3.10, attack 11.48, tribute 4.38, set 1.36, cover 1.82, trap 1.21, laststand 0.62, sweep 0.36, raise 0.97, burn 0.04, fatigue 0.05
```

After (3dd47f1):
```
2000 games: first player wins 57.1%, Cowboys win 59.4%, draws 0.0%
turns: 13.4 on average, longest 27; ended by {"base":2000}
per game: summon 12.89, turn 12.37, draw 13.42, spell 3.12, attack 11.49, tribute 4.38, raise 0.98, set 1.36, trap 1.21, cover 1.82, laststand 0.61, burn 0.04, sweep 0.36, fatigue 0.05
```

## `node prototypes/showdown/trail-sim.mjs` (default 300 deals per duel; careless = level 0, simple = level 1, careful = level 2 player)

Before (a9aa828):
```
duel                                careless  simple careful
Trail 1. Boot Hill                       99%    100%    100%
Trail 2. Raven Roost                    100%     99%    100%
Trail 3. The Bone Fence                  69%     88%    100%
Trail 4. Imp Hollow                      41%     85%     89%
Trail 5. The Hexed Mile                  20%     60%     95%
Trail 6. Dragon's Roost                  19%     41%     78%
Rival 1. The Stargazer                   22%     33%     90%
Rival 2. The Imp                         30%     56%     88%
Rival 3. The Bonewright                  11%     37%     91%
Rival 4. The Graveyard Coven              8%     12%     56%
The Lantern Wraith, hunt 1               89%     91%     97%
The Lantern Wraith, hunt 2               77%     86%     97%
The Lantern Wraith, hunt 3               41%     68%     87%
The Lantern Wraith, hunt 4               32%     61%     85%
The Lantern Wraith, hunt 5               15%     38%     62%
The Graveyard Dragon, hunt 1             51%     60%     95%
The Graveyard Dragon, hunt 2             27%     44%     79%
The Graveyard Dragon, hunt 3             18%     36%     73%
The Graveyard Dragon, hunt 4             12%     28%     67%
The Graveyard Dragon, hunt 5              6%     20%     55%
Open range (the even match)              10%     14%     65%
```

After (3dd47f1):
```
duel                                careless  simple careful
Trail 1. Boot Hill                       99%    100%    100%
Trail 2. Raven Roost                    100%     99%    100%
Trail 3. The Bone Fence                  69%     88%    100%
Trail 4. Imp Hollow                      41%     85%     89%
Trail 5. The Hexed Mile                  20%     60%     95%
Trail 6. Dragon's Roost                  19%     41%     78%
Rival 1. The Stargazer                   22%     33%     90%
Rival 2. The Imp                         30%     56%     88%
Rival 3. The Bonewright                  11%     37%     91%
Rival 4. The Graveyard Coven              8%     12%     58%
The Lantern Wraith, hunt 1               89%     91%     97%
The Lantern Wraith, hunt 2               77%     86%     97%
The Lantern Wraith, hunt 3               41%     68%     87%
The Lantern Wraith, hunt 4               33%     61%     85%
The Lantern Wraith, hunt 5               16%     39%     62%
The Graveyard Dragon, hunt 1             51%     60%     95%
The Graveyard Dragon, hunt 2             27%     44%     79%
The Graveyard Dragon, hunt 3             18%     36%     73%
The Graveyard Dragon, hunt 4             12%     28%     67%
The Graveyard Dragon, hunt 5              6%     20%     55%
Open range (the even match)              10%     14%     65%
```

Rows that moved (points): Rival 4 careful +2; Lantern Wraith hunt 4 careless +1;
Lantern Wraith hunt 5 careless +1, simple +1. All other cells unchanged.

## Other checks on 3dd47f1

- `node --test tests/game/showdown-fair-bot.test.js`: 5 pass, 0 fail.
- `node --test prototypes/showdown/progress.test.js` (unchanged since a9aa828): 14 pass,
  including "a cushion, then a ramp, all the way to the even match".
- `npm test`: 535 tests, 535 pass, 0 fail; sourced-animation structural check 2/2 pass.
- Not run: browser checks (bo3, campaign, cues). Callers that take `planTurn(...)[0]`
  (campaign-driver.mjs, bo3-browser-check.mjs) call it once per action, so they plan again
  after a Scout draw by construction; `playTurn` callers (sim, trail-sim, main.js,
  src/match/showdown-session.js) get the replan inside `playTurn`, covered by the fair-bot test.
