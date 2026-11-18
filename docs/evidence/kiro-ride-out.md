# Ride Out: graybox rules experiment

November 18, 2026 Pacific. Kiro (Kiro IDE agent session) on branch `kiro/ride-out-pilot`, base `55a395e`. This is a developer-only experiment. The rule exists only on matches created with `createMatch(seed, { rideOut: true })`, and nothing in the game, UI, art or release pipeline creates one. No human has played it. Spec: [requirements](../../.kiro/specs/ride-out/requirements.md), [design](../../.kiro/specs/ride-out/design.md).

**Rule.** Once during its phase, a side may spend its summon allowance to move one of its troops one lane left or right into an empty lane on its own board. The troop keeps its life and stays in play. The move cannot follow a summon or a spell. A spell may follow it.

## Result

- **Not dominant, and it rarely matters with these CPUs.** A ride-out was legal in about 80% of phases. The CPUs chose it in 0.7% to 1.0% of those phases, and it changed the winner in 2.6% of Normal holdout matches and 1.9% of Hard holdout matches. Counting legal moves would overstate the rule.
- **When used, it is a trade against a summon.** A summon was legal at every opportunity in all four runs. In 454 of 481 Normal holdout uses and 256 of 260 Hard holdout uses, the same CPU would otherwise have summoned, either spreading a free troop or paying a tribute. It seldom replaced holding a position (27 Normal and 4 Hard holdout uses).
- **It rescues a stalled side by opening a lane, at the cost of another.** 97% of Normal and 99% of Hard holdout uses came from a side with no Base pressure. 99% gave up protecting a lane: the troop leaves a block, and the enemy troop it blocked now hits the Base. Under Normal the usual result is that both Bases fall together. Draws rose 1.38 points (95% interval 0.90 to 1.85), and 71 of 93 improved results were losses turned into draws. Under Hard the draw rate did not change, and 30 riding sides went from a loss to a win.
- **It shortens matches the riding side was going to win.** Only 13 Normal and 3 Hard holdout uses came from a side that already had Base pressure. But 287 of 478 first ride-outs under Normal, and 90 of 258 under Hard, came from the side ahead on Base orbs. When the riding side won in both arms, it won sooner in 193 of 341 Normal and 105 of 119 Hard matches. On average, matches were 0.09 rounds shorter under Normal and 0.04 under Hard.
- **Seat balance.** Normal's first-seat lead (+27 points) did not move: −0.07 points, interval −0.61 to 0.46. Hard's second-seat lead narrowed by 1.65 points, interval 1.02 to 2.28, and the development lane agreed (+1.60). No faction gap change excluded zero.

**Suggested adjustment (not tested).** Allow the move into an occupied adjacent friendly lane by swapping the two troops, both keeping their life. Because the destination must be empty, the move can only rescue a stall by abandoning a block. A swap would let a side change matchups while every lane stays covered. That would test the rescue without starting a race.

## Method

- **Engine.** The rule uses the shipped engine and public view. `src/game/lanes.js` defines the one-lane move once, and Singularity's relocation now uses the same helper. A ride-out on a match without the flag is rejected as `invalid-action`, as before.
- **Bots.** Both levels see the move only through `legalActions` on their own public view. They score it with the same clash projection they use for other plays. Normal compares summons and ride-outs in one step against the same floor (end-phase score plus 1). Hard values a ride-out like a summon, alone or with the best spell that may follow.
- **Ties.** Ride-outs are listed after every shipped action type, and both levels keep the first of equal scores. A ride-out is chosen only when it scores strictly higher than every shipped option, so an exact tie keeps the shipped choice. A test pins one exact tie: a tribute summon that leaves the same board as the ride-out wins it.
- **Comparison.** Each cohort uses one CPU level on both sides of both arms: shipped rules, and Ride Out rules with the same CPU allowed to pick the move. Paired matches share decks, shuffles and first seat. Every seed is played once with each faction first. The results describe how this CPU uses the move, not the rule's effect on players in general.
- **In-run checks**, every match of all four receipts:
  - cards were conserved and troop health stayed between 1 and the printed value after every action;
  - the two arms played the same actions and events until the first ride-out;
  - a ride-out match with no ride-out equalled its shipped pair, so every changed winner follows an actual ride-out;
  - at the first ride-out, the CPU's choice with the move hidden equalled the action the shipped match played.
- **Lanes.** Development lane: seeds 60000 to 60999, 2,000 matches per arm. Holdout lane: seeds 61000 to 62999, 4,000 matches per arm. Rules and CPU code did not change after the first development run. After it, only reporting fields were added to the runner, and both development receipts were regenerated. The holdout ran after those receipts were reviewed. All four receipts carry the same source blob IDs.

## Use

The shipped choice is what the same CPU picks from the same view with the move hidden. Spread is a free summon, tribute is a tribute summon, cast is a spell first and hold is ending the phase.

| Cohort | Lane | Phases | Ride-out legal | Chosen | Matches with one | Shipped choice replaced (spread / tribute / cast / hold) | Gave up a lane | No Base pressure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | development | 28,422 | 23,504 (82.7%) | 229 (0.97%) | 228 of 2,000 | 167 / 51 / 2 / 9 | 225 | 217 |
| Normal | holdout | 57,904 | 48,161 (83.2%) | 481 (1.00%) | 478 of 4,000 | 336 / 118 / 10 / 17 | 480 | 468 |
| Hard | development | 23,084 | 18,166 (78.7%) | 128 (0.70%) | 124 of 2,000 | 72 / 53 / 0 / 3 | 125 | 125 |
| Hard | holdout | 45,930 | 36,181 (78.8%) | 260 (0.72%) | 258 of 4,000 | 141 / 115 / 1 / 3 | 257 | 257 |

At the holdout uses, a free summon was also legal in 419 of 481 Normal and 164 of 260 Hard cases, and a tribute summon in 326 and 170. Normal's holdout uses were 459 break-outs into an open lane, 21 re-matches against another enemy troop and 1 block. Hard's were 157, 100 and 3. A spell followed the move in 30 Normal and 84 Hard holdout uses.

## Outcomes

The seat gap is first-seat wins minus second-seat wins, in points. A paired change is the mean per-seed change over its two first-seat matches, with a 95% normal interval, as in the [opening study](codex-card-rd.md).

| Cohort | Lane | Seat gap, shipped to Ride Out | Paired seat change | Draws | Paired draw change | Mean rounds | Winner changed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | development | +28.00 to +28.30 | +0.30 (−0.46 to 1.06) | 192 to 222 | +1.50 (0.80 to 2.20) | 7.197 to 7.106 | 54 |
| Normal | holdout | +27.02 to +26.95 | −0.07 (−0.61 to 0.46) | 405 to 460 | +1.38 (0.90 to 1.85) | 7.328 to 7.238 | 102 |
| Hard | development | −22.95 to −21.35 | +1.60 (0.70 to 2.50) | 161 to 153 | −0.40 (−0.86 to 0.06) | 5.809 to 5.771 | 38 |
| Hard | holdout | −20.57 to −18.93 | +1.65 (1.02 to 2.28) | 305 to 305 | 0.00 (−0.33 to 0.33) | 5.784 to 5.741 | 76 |

The paired round change was −0.09 for Normal and −0.04 for Hard in both lanes. All four intervals exclude zero. In the Normal holdout, draws in which both Bases fell together went from 195 to 264, and round-limit draws went from 210 to 196.

At a match's first ride-out, both arms share the whole history. The riding side's paired results in the holdout lanes:

| Cohort | First ride-outs | Better | Same | Worse | Improved by |
| --- | --- | --- | --- | --- | --- |
| Normal | 478 | 93 | 376 | 9 | loss to draw 71, draw to win 19, loss to win 3 |
| Hard | 258 | 75 | 182 | 1 | loss to win 30, loss to draw 23, draw to win 22 |

Under Normal, 95 first ride-outs came from a side behind on Base orbs, and 68 of those improved. Of the 287 from a side ahead, 16 improved and 5 got worse. When neither side had Base pressure, Normal improved 9 times and worsened 5 times out of 264. Hard improved 44 times out of 137 and never worsened.

## Board examples

Each example is the first holdout use in seed order that gave up a lane, one per cohort. The runner selected both by rule. The receipts hold the other example slots.

**A. Normal, seed 61002, Wizard in the first seat, round 6, Wizard acting second.** Cowboy Base 3, board: Billy 4, empty, Sheriff 3. Wizard Base 1, board: Dragon 4, empty, empty. The Wizard holds Skeleton and Wizard, so both a free summon and a tribute summon were legal.

- *Shipped:* the Wizard summons Skeleton to lane 2. In the clash, Billy and the Dragon trade in lane 0 (Dragon 4 to 2, Billy 4 to 1), and the Sheriff and Skeleton trade in lane 2. The Bases stay at 3 and 1. The Cowboy wins by Base in round 9.
- *Ride Out:* the Dragon moves from lane 0 to lane 1, leaving lane 0 open, and lane 2 stays open. Billy hits the Wizard Base 1 to 0, and the Dragon hits the Cowboy Base 3 to 0. A draw in round 6.

The Wizard turns a loss into a draw by giving up the block in lane 0 and the Skeleton it would have summoned. This is the main reason Normal's draw rate rose.

**B. Hard, seed 61009, Cowboy in the first seat, round 4, Cowboy acting second.** Cowboy Base 3, board: Mounted Billy 2, empty, empty. Wizard Base 3, board: Wizard 4, empty, empty. The Cowboy holds two Sheriffs, so a free summon was legal and a tribute summon was not.

- *Shipped:* the Cowboy summons a Sheriff to lane 1. In the clash, the Wizard defeats Mounted Billy in lane 0 and drops to 1, and the Sheriff hits the Wizard Base 3 to 2. The Cowboy wins by Base in round 6.
- *Ride Out:* Mounted Billy moves from lane 0 to lane 1, leaving lane 0 open. The Wizard hits the Cowboy Base 3 to 1, and Mounted Billy hits the Wizard Base 3 to 0. The Cowboy wins in round 4.

The Cowboy wins in both arms. Riding out costs it two Base orbs and ends the match two rounds sooner.

## Parity and tests

- With the flag off, seeds 0 and 60 match the hashes recorded on `55a395e` before any edit: the opening, both CPU logs and the first-legal-action log. `tests/game/ride-out.test.js` pins Hard's actions on seeds 0 to 199. The Normal hash already in `tests/game/cpu.test.js` still passes.
- With the flag on, Normal never rides out on seed 0 or 60. Hard rides out once on seed 0 (round 4, Cowboy, lane 0 to lane 1), and the Wizard still wins by Base in round 4. Hard has no ride-out on seed 60.
- `tests/game/ride-out.test.js` has 16 tests, and every rules case runs for both factions. They cover:
  - left and right boundaries and the empty destination;
  - health and card conservation;
  - the shared allowance: a summon after the move is rejected with `summon-used`, and a spell after it is accepted;
  - a rejected move leaving state and RNG unchanged;
  - the legal list checked against `applyAction`;
  - hidden information and the tie rule;
  - the runner's counts.
- In a scratch copy, nine of ten deliberate mutations of the rules and CPU code failed the first version of the test file. The tenth broke Hard's hand projection after a move, and it survived. Codex then supplied a fixture from an independent review: seed 63116, Hard, Wizard first, revision 16, outside both lanes. That fixture is now a test, and it fails on the mutated code.

## Receipts and commands

The receipts are local and untracked, about 0.2 to 0.4 MB each.

```text
12b10c883ab21e9c4281922e0e952a7f09a3f3ca7e7a62205e2c590ca6ce07ad  .artifacts/card-rd/ride-out/normal-development.json
2829a3f34ec4cdf07443da61a23d9cac675aa463b594253f04de81f79dfc31e0  .artifacts/card-rd/ride-out/normal-holdout.json
2ec1dedcf063f99378cd70c963810764ee55ae079b3efb3621f64e2feae50223  .artifacts/card-rd/ride-out/hard-development.json
208edbd5146b3d9bd53dfec1f435948d3635c9e5f903e05c9bcde30233d6eafa  .artifacts/card-rd/ride-out/hard-holdout.json
```

```sh
node --test tests/game/ride-out.test.js
node scripts/compare-ride-out.mjs --lane development --cpu normal --out .artifacts/card-rd/ride-out/normal-development.json
node scripts/compare-ride-out.mjs --lane development --cpu hard --out .artifacts/card-rd/ride-out/hard-development.json
node scripts/compare-ride-out.mjs --lane holdout --cpu normal --out .artifacts/card-rd/ride-out/normal-holdout.json
node scripts/compare-ride-out.mjs --lane holdout --cpu hard --out .artifacts/card-rd/ride-out/hard-holdout.json
```

Not yet done: UI and renderer wiring, and human play. The CPUs look one or two clashes ahead and never model the opponent's reply, so a person may value the move differently.
