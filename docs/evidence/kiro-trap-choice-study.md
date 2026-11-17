# Kiro trap-choice study (issue #78)

Author: Kiro CLI 3.4.0 V3 (this note, the lab and the numbers below). Date: 2026-11-17, America/Los_Angeles (PST).
Base: `main` e214e8d65db4c3496d3acede5a5f191191e44d88, branch `kiro/trap-choice-78`. Text and headless experiment only.
Decision text: [docs/submission/trap-rule-decision.md](../submission/trap-rule-decision.md).
Lab: [experiments/trap-balance/](../../experiments/trap-balance/) (`shadow.js`, `shadow.test.js`, `run.mjs`, `toy.mjs`, `results/`).

## 1. What this is, and what it is not

The harness is a **shadow model**. It is not a trap implementation and not a measurement of the shipped game.

| Part | Real or shadow |
|---|---|
| `createMatch`, shuffles, draws, `applyAction` for summon, spell and the first side's end-phase | Real, imported read-only from `src/game/` |
| CPU | Real production `chooseAction`. It reads the unchanged public view, so it **does not know traps exist** and never reacts to one |
| Second side's end-phase (clash, result, round advance, draws) when a trap variant is active | Shadow re-implementation of `applyEndPhase` and `resolveClash`. A no-trap shadow run equals real play state by state on seeds 0-199 (test 1) |
| Trap card, zone, set action, trigger, discard | Shadow only. `src/game/` has none of them |
| Trap card content | A **fixture** `trap-fixture-<side>` that exists only in the harness. No name, art, stat or copy count |

Limits that apply to every number below:

1. The fixture is an **extra card outside the 12-card deck**, which keeps draws and matched seeds identical to the baseline. It costs no deck slot, so every trap result is an upper bound on trap benefit. A real card takes a deck slot and replaces an existing card, which is an open decision (section 9).
2. The CPU's trap policy is hard-coded here (section 3). It is not tuned and not human.
3. `set-trap` does not bump `revision` in the shadow, and production rejection reasons are not tested (they belong to production task T2).
4. Win shares are shadow-model, CPU against CPU, 1000 seeds per block. They show direction and rough size under these assumptions. They are not estimates of human play or of the final game.

I cannot run true CPU matches with traps without changing production (`clash.js`, `actions.js`, `legal.js`, `state.js`, `view.js`, `cpu.js`). This lab therefore does not claim realistic win rates. It uses the real engine for everything that does not involve a trap, and bounded exact scenarios for everything that does.

## 2. Fixed rules (all four variants)

One dedicated slot per side, card kind `trap` (not a spell), armed when `round > setRound`, single use then discard, opponent card hidden, simultaneous clash (R9). The trigger is automatic: the armed trap picks the enemy troop with the highest attack (tie: lowest lane) on the pre-trigger board. No target means the trap stays set.

| | X: cancel that attack | Y: prevent at most 1 damage of that attack |
|---|---|---|
| **A: set-trap uses the cast allowance** | AX | AY |
| **B: separate `trapSet` allowance** | BX | BY |

Negative control `inert`: a trap is set and consumed but its effect is nothing (`A-inert`, `B-inert`). It isolates the pure allowance cost from the effect.

## 3. Method

- Seeds: block 1 is 0-999, block 2 is 1000-1999. Every configuration in a block reuses the same seeds, so deals, starting seats and CPU choices before the first trap are matched.
- Baseline: no-trap shadow run. Its Cowboy, Wizard and draw counts equal `scripts/simulate-matches.mjs` for each block (425/472/103 and 424/475/101). `run.mjs` prints `baselineEqualsRealSimulate: true` for both.
- Grid, fixed before the first full run, nothing dropped: action {A,B} x effect {X,Y,inert} x CPU policy {S,T} x fixture arrival round {1,4} x holders {both, Cowboy only, Wizard only} x 2 blocks = 144 rows, plus 2 baselines. All 146 rows are in [results/results.md](../../experiments/trap-balance/results/results.md) and [results/results.json](../../experiments/trap-balance/results/results.json). Nothing was re-run with different parameters after seeing results.
- CPU policy S ("spell first"): set the trap only when the production CPU would end its phase. T ("trap first"): set when the CPU would cast or end. Neither sets before the summon, because under A the cast allowance would also block a later summon (section 6). The CPU never sets in round 9.
- Arrival 1: the fixture is in the opening hand (best case). Arrival 4: it is usable from round 4 (a stand-in for drawing it later).
- Paired statistic: change in Cowboy win share against the same seeds' baseline, with a normal 95% interval. A trap can change the winner of 20% of matches and still move the share by about 0.

## 4. Results

### 4.1 Symmetric case: both sides hold one fixture (primary slice)

Columns: Cowboy/Wizard/draw %, paired change in Cowboy win share in percentage points with 95% interval, matches whose winner changed (of 1000), mean final round, mean actions per match (baseline 31.99 in block 1, 31.94 in block 2), forgone casts per match, matches containing a summon + cast + trap phase, largest number of actions in one phase (baseline 3).

| block | arrival | policy | cfg | C/W/D % | dCowboy pp (95%) | winner changed | mean round | actions | forgone casts | summon+cast+trap phases | max/phase |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0-999 | 1 | S | AX | 41.9/46.8/11.3 | -0.6 (-4.1..2.9) | 416 | 7.3 | 33.92 | 0 | 0 | 3 |
| 0-999 | 1 | S | AY | 43.9/46.0/10.1 | 1.4 (-1.8..4.6) | 355 | 7.37 | 34.38 | 0 | 0 | 3 |
| 0-999 | 1 | S | A-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.99 | 0 | 0 | 3 |
| 0-999 | 1 | S | BX | 41.9/46.8/11.3 | -0.6 (-4.1..2.9) | 416 | 7.3 | 33.92 | 0 | 0 | 3 |
| 0-999 | 1 | S | BY | 43.9/46.0/10.1 | 1.4 (-1.8..4.6) | 355 | 7.37 | 34.38 | 0 | 0 | 3 |
| 0-999 | 1 | S | B-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.99 | 0 | 0 | 3 |
| 0-999 | 1 | T | AX | 41.9/46.8/11.3 | -0.6 (-4.1..2.9) | 416 | 7.3 | 33.92 | 0 | 0 | 3 |
| 0-999 | 1 | T | AY | 43.9/46.0/10.1 | 1.4 (-1.8..4.6) | 355 | 7.37 | 34.38 | 0 | 0 | 3 |
| 0-999 | 1 | T | A-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.99 | 0 | 0 | 3 |
| 0-999 | 1 | T | BX | 41.9/46.8/11.3 | -0.6 (-4.1..2.9) | 416 | 7.3 | 33.92 | 0 | 0 | 3 |
| 0-999 | 1 | T | BY | 43.9/46.0/10.1 | 1.4 (-1.8..4.6) | 355 | 7.37 | 34.38 | 0 | 0 | 3 |
| 0-999 | 1 | T | B-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.99 | 0 | 0 | 3 |
| 0-999 | 4 | S | AX | 42.9/48.7/8.4 | 0.4 (-2.0..2.8) | 221 | 7.64 | 35.33 | 0 | 0 | 3 |
| 0-999 | 4 | S | AY | 41.0/48.8/10.2 | -1.5 (-3.9..0.9) | 206 | 7.47 | 34.72 | 0 | 0 | 3 |
| 0-999 | 4 | S | A-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.92 | 0 | 0 | 3 |
| 0-999 | 4 | S | BX | 42.7/49.5/7.8 | 0.2 (-2.2..2.6) | 214 | 7.61 | 35.22 | 0 | 469 | 4 |
| 0-999 | 4 | S | BY | 42.3/48.6/9.1 | -0.2 (-2.6..2.2) | 210 | 7.46 | 34.72 | 0 | 469 | 4 |
| 0-999 | 4 | S | B-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.93 | 0 | 469 | 4 |
| 0-999 | 4 | T | AX | 43.1/47.9/9.0 | 0.6 (-2.0..3.2) | 263 | 7.61 | 35.15 | 0.571 | 0 | 3 |
| 0-999 | 4 | T | AY | 42.6/46.7/10.7 | 0.1 (-2.6..2.8) | 248 | 7.45 | 34.63 | 0.571 | 0 | 3 |
| 0-999 | 4 | T | A-inert | 41.0/46.2/12.8 | -1.5 (-3.1..0.1) | 96 | 7.35 | 34.09 | 0.571 | 0 | 3 |
| 0-999 | 4 | T | BX | 42.7/49.5/7.8 | 0.2 (-2.2..2.6) | 214 | 7.61 | 35.22 | 0 | 469 | 4 |
| 0-999 | 4 | T | BY | 42.3/48.6/9.1 | -0.2 (-2.6..2.2) | 210 | 7.46 | 34.72 | 0 | 469 | 4 |
| 0-999 | 4 | T | B-inert | 42.5/47.2/10.3 | 0.0 (0.0..0.0) | 0 | 7.3 | 33.93 | 0 | 469 | 4 |
| 1000-1999 | 1 | S | AX | 41.7/47.4/10.9 | -0.7 (-4.1..2.7) | 391 | 7.33 | 34.12 | 0 | 0 | 3 |
| 1000-1999 | 1 | S | AY | 44.4/46.1/9.5 | 2.0 (-1.2..5.2) | 363 | 7.33 | 34.28 | 0 | 0 | 3 |
| 1000-1999 | 1 | S | A-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.94 | 0 | 0 | 3 |
| 1000-1999 | 1 | S | BX | 41.7/47.4/10.9 | -0.7 (-4.1..2.7) | 391 | 7.33 | 34.12 | 0 | 0 | 3 |
| 1000-1999 | 1 | S | BY | 44.4/46.1/9.5 | 2.0 (-1.2..5.2) | 363 | 7.33 | 34.28 | 0 | 0 | 3 |
| 1000-1999 | 1 | S | B-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.94 | 0 | 0 | 3 |
| 1000-1999 | 1 | T | AX | 41.7/47.4/10.9 | -0.7 (-4.1..2.7) | 391 | 7.33 | 34.12 | 0 | 0 | 3 |
| 1000-1999 | 1 | T | AY | 44.4/46.1/9.5 | 2.0 (-1.2..5.2) | 363 | 7.33 | 34.28 | 0 | 0 | 3 |
| 1000-1999 | 1 | T | A-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.94 | 0 | 0 | 3 |
| 1000-1999 | 1 | T | BX | 41.7/47.4/10.9 | -0.7 (-4.1..2.7) | 391 | 7.33 | 34.12 | 0 | 0 | 3 |
| 1000-1999 | 1 | T | BY | 44.4/46.1/9.5 | 2.0 (-1.2..5.2) | 363 | 7.33 | 34.28 | 0 | 0 | 3 |
| 1000-1999 | 1 | T | B-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.94 | 0 | 0 | 3 |
| 1000-1999 | 4 | S | AX | 42.8/47.8/9.4 | 0.4 (-2.0..2.8) | 223 | 7.61 | 35.22 | 0 | 0 | 3 |
| 1000-1999 | 4 | S | AY | 41.8/46.8/11.4 | -0.6 (-2.8..1.6) | 196 | 7.48 | 34.78 | 0 | 0 | 3 |
| 1000-1999 | 4 | S | A-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.87 | 0 | 0 | 3 |
| 1000-1999 | 4 | S | BX | 44.7/47.6/7.7 | 2.3 (0.0..4.6) | 210 | 7.57 | 35.09 | 0 | 462 | 4 |
| 1000-1999 | 4 | S | BY | 43.3/46.9/9.8 | 0.9 (-1.3..3.1) | 192 | 7.46 | 34.7 | 0 | 462 | 4 |
| 1000-1999 | 4 | S | B-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.88 | 0 | 462 | 4 |
| 1000-1999 | 4 | T | AX | 43.9/46.5/9.6 | 1.5 (-1.1..4.1) | 260 | 7.59 | 35.12 | 0.554 | 0 | 3 |
| 1000-1999 | 4 | T | AY | 42.8/46.4/10.8 | 0.4 (-2.0..2.8) | 229 | 7.46 | 34.68 | 0.554 | 0 | 3 |
| 1000-1999 | 4 | T | A-inert | 41.3/47.6/11.1 | -1.1 (-2.6..0.4) | 87 | 7.31 | 33.94 | 0.554 | 0 | 3 |
| 1000-1999 | 4 | T | BX | 44.7/47.6/7.7 | 2.3 (0.0..4.6) | 210 | 7.57 | 35.09 | 0 | 462 | 4 |
| 1000-1999 | 4 | T | BY | 43.3/46.9/9.8 | 0.9 (-1.3..3.1) | 192 | 7.46 | 34.7 | 0 | 462 | 4 |
| 1000-1999 | 4 | T | B-inert | 42.4/47.5/10.1 | 0.0 (0.0..0.0) | 0 | 7.28 | 33.88 | 0 | 462 | 4 |

Read-across:

- Only one symmetric row has an interval that excludes zero: `BX` arrival 4 in block 2 (+2.3, interval 0.0 to 4.6, an edge case among 32 effect rows). I treat every symmetric difference between variants as **not distinguished** at 1000 seeds.
- Winner changes are large (about 20-42% of matches for X and Y rows) while the share barely moves. The trap reshuffles outcomes more than it shifts balance.
- `B-inert` equals the baseline exactly (0 changed). `A-inert` equals it under policy S and under arrival 1. It differs only where setting a trap forgoes a cast (policy T, arrival 4: 0.57 and 0.55 forgone casts per match, dCowboy -1.5 and -1.1 pp, intervals include 0). That is the whole measured gap between A and B in this model.
- At arrival 1, A and B give identical results: the allowance never binds, because the trap is set in round 1 before any spell is in play.
- Under B the largest phase has 4 actions (summon, cast, trap, end), and 46-47% of matches at arrival 4 contain at least one. Under A the largest phase stays at 3, as today.
- Trap sets add about 1.9 actions per match (about +6% over 31.99). Mean final round moves from 7.30 to 7.30-7.64 for X and 7.33-7.48 for Y.

### 4.2 Asymmetric hazard: only one side holds a fixture

Change in Cowboy win share in percentage points, policy S (T is identical for B and within about 1 pp for A; all rows are in results.md). Columns are block 1 and block 2.

| holder | arrival | cfg | 0-999 | 1000-1999 |
|---|---|---|---|---|
| cowboy only | 1 | AX | 20.6 | 20.7 |
| cowboy only | 1 | AY | 19.6 | 17.9 |
| cowboy only | 1 | BX | 20.6 | 20.7 |
| cowboy only | 1 | BY | 19.6 | 17.9 |
| cowboy only | 4 | AX | 14.2 | 15.5 |
| cowboy only | 4 | AY | 7.8 | 8.9 |
| cowboy only | 4 | BX | 15.1 | 16.0 |
| cowboy only | 4 | BY | 8.2 | 9.6 |
| wizard only | 1 | AX | -17.4 | -21.5 |
| wizard only | 1 | AY | -15.5 | -20.3 |
| wizard only | 1 | BX | -17.4 | -21.5 |
| wizard only | 1 | BY | -15.5 | -20.3 |
| wizard only | 4 | AX | -14.0 | -13.1 |
| wizard only | 4 | AY | -9.2 | -7.9 |
| wizard only | 4 | BX | -13.8 | -12.8 |
| wizard only | 4 | BY | -9.0 | -8.0 |

A single free trap moves one faction's win share by about 8 to 22 points. At arrival 1, X and Y differ by about 1-2 points. At arrival 4, X is about twice as strong as Y (14-16 vs 8-10), because the trap meets 2- and 3-attack targets more often. Trigger targets (block 1, policy S, both holders, `BX`): arrival 4 had attack 1 x382, attack 2 x1424, attack 3 x80. Arrival 1 had attack 1 x1562, attack 2 x437, attack 3 x0. X and Y differ only when the target has attack 2 or more, and the auto-trigger usually fires on the first clash with any troop, which is mostly a cheap attack-1 or attack-2 troop. The X-or-Y choice therefore matters far less than how many copies each faction gets and when they arrive.

## 5. Bounded exact scenarios (no sampling)

Generated by `node experiments/trap-balance/toy.mjs`, also saved as [results/toy.md](../../experiments/trap-balance/results/toy.md). One clash, hand-built boards. The Cowboy holds the armed trap unless the row says both. Losses are damage the Cowboy base or Cowboy troops take in that clash. "none (control)" is the inert trap.

| scenario | effect | triggers | Cowboy base orbs lost | Cowboy troop health lost | trap left set |
|---|---|---|---|---|---|
| Cowboy trap vs lone attack-1 troop (lane 0, no blocker) | none (control) | 1 | 1 | 0 | none |
| Cowboy trap vs lone attack-1 troop (lane 0, no blocker) | X | 1 | 0 | 0 | none |
| Cowboy trap vs lone attack-1 troop (lane 0, no blocker) | Y | 1 | 0 | 0 | none |
| Cowboy trap vs lone attack-2 troop | none (control) | 1 | 2 | 0 | none |
| Cowboy trap vs lone attack-2 troop | X | 1 | 0 | 0 | none |
| Cowboy trap vs lone attack-2 troop | Y | 1 | 1 | 0 | none |
| Cowboy trap vs lone attack-3 troop | none (control) | 1 | 3 | 0 | none |
| Cowboy trap vs lone attack-3 troop | X | 1 | 0 | 0 | none |
| Cowboy trap vs lone attack-3 troop | Y | 1 | 2 | 0 | none |
| Cowboy trap vs 1+2+3 attackers (targets the 3) | none (control) | 1 | 5 | 0 | none |
| Cowboy trap vs 1+2+3 attackers (targets the 3) | X | 1 | 3 | 0 | none |
| Cowboy trap vs 1+2+3 attackers (targets the 3) | Y | 1 | 5 | 0 | none |
| Same, but Cowboy blockers in all lanes (damage lands on troops) | none (control) | 1 | 0 | 6 | none |
| Same, but Cowboy blockers in all lanes (damage lands on troops) | X | 1 | 0 | 3 | none |
| Same, but Cowboy blockers in all lanes (damage lands on troops) | Y | 1 | 0 | 5 | none |
| Tie: two attack-2 troops (lanes 0 and 2): lowest lane is targeted | none (control) | 1 | 4 | 0 | none |
| Tie: two attack-2 troops (lanes 0 and 2): lowest lane is targeted | X | 1 | 2 | 0 | none |
| Tie: two attack-2 troops (lanes 0 and 2): lowest lane is targeted | Y | 1 | 3 | 0 | none |
| Empty enemy board: trap stays set | none (control) | 0 | 0 | 0 | cowboy |
| Empty enemy board: trap stays set | X | 0 | 0 | 0 | cowboy |
| Empty enemy board: trap stays set | Y | 0 | 0 | 0 | cowboy |
| Both traps armed, 2 vs 3 attackers (double trigger) | none (control) | 2 | 3 | 3 | none |
| Both traps armed, 2 vs 3 attackers (double trigger) | X | 2 | 0 | 3 | none |
| Both traps armed, 2 vs 3 attackers (double trigger) | Y | 2 | 2 | 3 | none |
| Round 9, trap set in round 8 (last clash still fires) | none (control) | 1 | 2 | 0 | none |
| Round 9, trap set in round 8 (last clash still fires) | X | 1 | 0 | 0 | none |
| Round 9, trap set in round 8 (last clash still fires) | Y | 1 | 1 | 0 | none |
| Round 9, trap set in round 9 (dead set) | none (control) | 0 | 2 | 0 | cowboy |
| Round 9, trap set in round 9 (dead set) | X | 0 | 2 | 0 | cowboy |
| Round 9, trap set in round 9 (dead set) | Y | 0 | 2 | 0 | cowboy |

Observations: X removes all of the target's damage (1, 2 or 3). Y removes exactly 1, so Y equals X against an attack-1 target, halves an attack-2 target and removes a third of an attack-3 target. A cancelled attacker keeps its lane and still blocks; only its damage disappears. Y emits a damage event of amount 0 when the target has attack 1. X emits no damage event for the cancelled attacker.

## 6. Event ordering, arming, hidden information, edge cases

Event order for a clash with traps in the shadow, matching design.md section 4: `clash`, then `trap-trigger` for each side in `SIDES` order (cowboy, wizard), then `damage` (lane-major, cowboy before wizard within a lane), then `defeat`. Triggers read the pre-trigger board, so neither trap can change which troop the other picks. Test 10 checks that boards are identical when the zones are listed in the other order.

| Topic | Finding | How checked |
|---|---|---|
| One-round delay | Set in round N, armed in N+1: `isArmed` is `setRound < round` | Test 3 |
| One slot, single use | The zone is one value per side. A fired trap leaves the zone empty and is recorded as spent. With one fixture there is at most one set per side per match | Tests 7 and 6. The production rejection `trap-zone-full` is not exercised here |
| Highest attack and ties | Highest attack, lowest lane on a tie. An empty enemy board means no trigger and the trap stays set | Tests 5 and 6 |
| Simultaneous traps | Both fire from the snapshot. In the 2 vs 3 attackers scenario X cancels 2 of 5 attacks | Test 10, toy row "double trigger" |
| Last round | A trap set in round 8 still fires in round 9. A trap set in round 9 never fires (dead set). Under A a round-9 set would also burn the cast allowance. The harness CPU never sets in round 9, so it does not measure this waste. A human could. It needs a UI guard or a warning | Test 4, toy rows |
| Allowance A | Setting sets `castUsed`. In production, `summonRejection` returns `summon-after-spell` when `castUsed` is true. Read literally, a side that sets a trap before summoning loses that phase's summon. A prototype must say whether a trap counts as a cast for that ordering rule. The harness CPU summons first, so this cost is **not** in the results | Read of `actions.js`; test 12 for the no trap+cast overlap |
| Allowance B | A separate `trapSet`, kept in `allowances`. `publicState` exposes `allowances`, so it shows that a trap was set. That is already visible from the hand count and the face-down marker | Read of `view.js` |
| Hidden information | The opponent's view of the zone is `{ faceDown: true, setRound }` and never the card ID. Redacted events were not tested, because production has no trap events. The face-down marker and a hand-count drop tell the opponent that a trap exists and when it was set. That matches the spec | Test 11 |
| Flag-off parity | A no-trap shadow run equals real play state by state (seeds 0-199), with the real end-phase and with the shadow end-phase | Test 1 |
| Deck conservation | The real card table has no `trap-*` card and each deck keeps 12 cards. The study adds nothing to either | Test 13 |
| Y zero-damage event | Needs a presenter decision (skip it or show a "blocked" cue) | Toy rows |
| Lethal prevention | A trap can stop lethal base damage, so more matches can reach the round limit. Draw share in symmetric rows ranges from 7.7% to 12.8% against a baseline of 10.3% and 10.1% | results.md |

## 7. Decision load and game length (hypotheses only)

Observed in this shadow, CPU only: B raises the largest phase from 3 to 4 actions and A keeps it at 3. Mean actions per match go from about 32 to 33.9-35.3 (1.9 sets plus slightly longer matches). Mean final round goes from 7.30 to 7.30-7.64. These are CPU action counts, not human clicks, time or fun.

Hypotheses for a human playtest (not measured): the extra decision under B is cheap while the player holds one trap card and the zone is empty. It becomes a cost only if a deck holds several traps and a player must pick between trap, spell and summon every phase. A removes one decision by making trap and spell exclusive, but only 2 of 12 cards are spells, so the conflict appears about 0.26-0.57 times per match in the shadow (policy T). It can also read as a hidden penalty if the cast allowance blocks a later summon (section 6).

## 8. Design inspiration only

Yu-Gi-Oh: a set trap cannot act the turn it is set (rulebook: <https://img.yugioh-card.com/en/downloads/rulebook/SD_RuleBook_EN_10.pdf>). Pokemon: few, predictable once-per-turn actions (rulebook: <https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/rulebook/par_rulebook_en.pdf>). I did not fetch or quote either PDF for this study. They are cited as the issue directs, for the one-turn delay and limited-action ideas. No card, name, text, art or economy is imported.

## 9. Risks, conservative reading

- The CPU never plays around traps, so the value of a hidden trap against a reacting opponent is unmeasured.
- A free extra card is the best case. Taking a deck slot (which would replace an existing card and needs user approval; it must not silently remove a spell) shrinks or reverses the effect.
- Faction balance: one trap on one side shifts a win share by about 8-22 pp in the shadow. An asymmetric copy count or draw chance is the dominant balance lever.
- The auto-trigger fires on the first clash with any troop. It is spent early on a cheap troop, so X and Y are weakest exactly when a late big attacker would make them valuable.
- Under A, the summon-after-cast ordering is a rules trap for players.
- Under B, a deck with several trap cards would make 4-decision phases routine.

## 10. Commands run and outcomes

| Command | Outcome |
|---|---|
| `node --test experiments/trap-balance/shadow.test.js` | 13 tests, 13 pass. The first run had 3 failures, all in my tests: two wrong expected values and one arrival-round choice for the B trap+cast check. Fixed in the tests, not in the model |
| `node experiments/trap-balance/run.mjs` | Wrote 146 rows. Baseline equals `simulate()` for both blocks. About 100 s. Run twice: the first run predates removing one unused output field (`meanSetRound`), and the second run produced the committed results |
| `node experiments/trap-balance/toy.mjs > experiments/trap-balance/results/toy.md` | 10 scenarios x 3 effects. The first version measured troop loss from surviving troops, which hid defeated blockers. I changed it to sum damage events and re-ran it |
| Relative-link check of this note and the decision note (small node script, not committed) | 7 relative links, 0 missing |
| `git diff HEAD -- src .kiro` | Empty. No production or spec edits |

Not run: `verify-duel`, renderer build, browser replay, human playtest. None applies, because no production code changed.
