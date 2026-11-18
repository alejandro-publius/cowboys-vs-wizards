# Round-one tempo: round-1 Base shield experiment (Kiro)

Run by Kiro (Kiro IDE session) on November 18, 2026 (UTC) on branch `kiro/round-one-tempo`, base `9603fe4`.
The spec in `.kiro/specs/round-one-tempo/` was written before the code change and before any shield match.
Rules version `orb-duel-draft-1`. The shield exists only behind the state flag `experimentalRoundOneBaseShield`.

**Result: negative.** Both + Shield played exactly like Both in all 1,024 holdout matches, with the same actions and the same results. Under the released CPU, Both never leaves a lane open in the round-1 clash, so the shield never fires. Shield alone is a worse candidate than Both: its seat gap stays at the shipped level.

```sh
node --test tests/game/round-one-tempo.test.js        # 6 of 6 pass
node scripts/compare-round-one-tempo.mjs --from 10000 --count 64 --out .artifacts/card-rd/round-one-tempo/dev/results.json      # 1.0 s
node scripts/compare-round-one-tempo.mjs --from 20000 --count 512 --out .artifacts/card-rd/round-one-tempo/holdout/results.json # 12.5 s; rerun byte-identical
node scripts/verify-duel.mjs                            # 339 of 339 tests pass; GLB preflight passes
```

## Method
- Policies: Shipped; Both (the free-opener swap plus a fifth card for the second seat, `src/game/opening-policy.js`); Shield (shipped opening plus the flag); Both + Shield.
- Rule under the flag: in the round-1 clash an attack into an empty lane deals 0 to the opposing Base, for either faction. Its `damage` event keeps the attacker and reports `amount: 0`, `before` equal to `after`, and `shielded: true`. Blocked attacks, defeats and spells are unchanged. Base damage is normal from round 2.
- Each seed is played once with each faction first, with the same shuffles, and with `chooseAction` on both sides through `publicState`, which does not show the flag. Rows are paired by (seed, first seat). The 95% intervals treat a seed's two matches as one observation.
- Seeds: development 10000–10063 (64 seeds, 128 matches per policy) and holdout 20000–20511 (512 seeds, 1,024 matches per policy). No earlier note used seeds of 10000 or more. Nothing was tuned on the development sample. Before the holdout, the spec, the design, the rule, the script and the test were hashed into `holdout/frozen-files.sha256`, and the committed files match those hashes.
- Every holdout match passed these checks:
  - All 133,731 actions were listed by `legalActions` and accepted, and cards were conserved after each one.
  - All 113,530 damage events satisfy `after = max(0, before − amount)`, and the Base events add up to the orbs lost.
  - `shielded` appears only on round-1 Base hits under the flag (74 events).
  - Each shield policy played the same round-1 actions as its unshielded twin.
  - 1,974 of the 2,048 shield runs had no shielded hit, and each of those matched its twin in every action and in its final state.
  - All 512 shipped runs with the seed's own first seat equal `playMatch`.

## Holdout results (seeds 20000–20511)

| 1,024 matches each | Shipped | Both | Shield | Both + Shield |
| --- | --- | --- | --- | --- |
| First-seat wins | 587 (57.32%) | 522 (50.98%) | 585 (57.13%) | 522 (50.98%) |
| Second-seat wins | 338 (33.01%) | 392 (38.28%) | 338 (33.01%) | 392 (38.28%) |
| Draws | 99 (9.67%) | 110 (10.74%) | 101 (9.86%) | 110 (10.74%) |
| Seat gap, points | 24.32 | 12.70 | 24.12 | 12.70 |
| Mean rounds | 7.175 | 7.621 | 7.234 | 7.621 |
| Sides with no round-1 summon, first / second seat | 37 / 37 | 0 / 0 | 37 / 37 | 0 / 0 |
| Matches with an open lane in the round-1 clash | 74 | 0 | 74 | 0 |
| Base orbs lost in the round-1 clash (first / second seat) | 74 (37 / 37) | 0 | 0 (74 absorbed) | 0 |
| Base orbs lost after the round-1 clash (per match) | 7,001 (6.84) | 7,284 (7.11) | 7,089 (6.92) | 7,284 (7.11) |
| Cowboy minus Wizard, points | −7.91 | −9.96 | −7.71 | −9.96 |

In every column, the hands dealt with no free troop equal the sides with no round-1 summon (74, 0, 74 and 0).

| Paired change, 95% interval | Both vs Shipped | Shield vs Shipped | Both + Shield vs Both | Shield vs Both |
| --- | --- | --- | --- | --- |
| Seat gap, points | −11.6 (−17.1 to −6.2) | −0.2 (−0.7 to +0.3) | 0.0 (0.0 to 0.0) | +11.4 (+6.0 to +16.8) |
| Mean rounds | +0.446 (+0.340 to +0.553) | +0.060 (+0.034 to +0.085) | 0.000 (0.000 to 0.000) | −0.387 (−0.484 to −0.289) |
| Draw share, points | +1.1 (−1.4 to +3.5) | +0.2 (−0.1 to +0.5) | 0.0 (0.0 to 0.0) | −0.9 (−3.3 to +1.6) |
| Matches with a different result | 336 | 3 | 0 | 336 |

**Verdict.** The rule is RT-10, fixed before the holdout. A shield policy passes only if its seat-gap change against Both has a 95% interval entirely below zero and it adds at most 0.5 rounds.
- Both + Shield **fails**: 0.0 points (0.0 to 0.0), +0.000 rounds. It does not reduce the gap.
- Shield **fails**: +11.4 points (+6.0 to +16.8), −0.387 rounds. It widens the gap against Both.

## Development sample (seeds 10000–10063)

| 128 matches each | Shipped | Both | Shield | Both + Shield |
| --- | --- | --- | --- | --- |
| First / second / draw share, % | 60.94 / 32.03 / 7.03 | 53.13 / 40.63 / 6.25 | 60.94 / 32.03 / 7.03 | 53.13 / 40.63 / 6.25 |
| Seat gap, points | 28.91 | 12.50 | 28.91 | 12.50 |
| Mean rounds | 7.195 | 7.664 | 7.227 | 7.664 |
| Sides with no round-1 summon, first / second seat | 3 / 3 | 0 / 0 | 3 / 3 | 0 / 0 |
| Base orbs lost in / after the round-1 clash | 6 / 856 | 0 / 893 | 0 (6 absorbed) / 864 | 0 / 893 |

Both + Shield against Both changed 0 results and Shield against Shipped changed 0. Both against Shipped moved the seat gap by −16.4 points (−32.3 to −0.5). Both shield policies fail RT-10 here too. After this run the script was edited so its check counters reset on each `run()` call. The edited script reproduced the development output byte-identically.

## Why the shield does nothing after Both
This is a descriptive pass over the holdout seeds after the frozen run, saved as `holdout/round1-patterns.json`.
- Under Both, all 1,024 matches open the same way. The first seat summons a free troop into lane 0, and the second seat summons one into lane 0 to block it. The round-1 clash never reaches a Base.
- Under Shipped, 950 matches open that way. The other 74 are the drought matches, where one side summons nothing and the other side's troop hits an open lane for 1 orb. Those 74 orbs are all the shield absorbs, and Both already removes the droughts.
- In round 1 each side can summon only one troop, and every free troop has attack 1, so the shield can absorb at most one orb per side.
- The sides dealt no free troop under Shipped (74) were followed through each policy, as wins / losses / draws: Shipped 1 / 73 / 0, Shield 0 / 72 / 2, Both 33 / 34 / 7, Both + Shield 33 / 34 / 7. The shield does not rescue a dead hand.
- Under Both no Base loses an orb in round 1, yet the first seat still leads by 12.7 points. The remaining edge is built after round 1. This experiment does not show where.

## Seeds 0 and 60 and default parity

| Seed, first seat | Shipped (default) | Shield | Both | Both + Shield |
| --- | --- | --- | --- | --- |
| 0, Cowboy | Same route as at `9603fe4`; Cowboy wins at the round limit | Identical to Shipped | Differs from action 22; draw, both Bases destroyed in round 9 | Identical to Both |
| 60, Wizard | Same route as at `9603fe4`; Cowboy wins, Wizard Base destroyed in round 9 | Identical to Shipped | Identical to Shipped | Identical to Shipped |

- Neither seed has an open lane in its round-1 clash under any policy. Their CPU-vs-CPU route hashes were recorded at `9603fe4` before editing: seed 0 `46c6588a…` and seed 60 `40435b91…`. `tests/game/round-one-tempo.test.js` pins them in full (RT-1), and the harness reproduces them. The `tests/match/trap-presenter.test.js` renderer baselines for seeds 0 and 60 still pass.
- On seeds 0–99, `createMatch`, `createMatch(seed, { traps: true })` and `openingMatch` never add the flag, and `publicState` of a flagged state equals the unflagged one (RT-2). In `src/`, only `src/game/clash.js` reads the flag. No URL parameter or browser control sets it.
- A mutation check ran in a scratch copy, not the repo. Each of five mutations fails at least one new test: the shield off, the shield in every round, the shield on blocked lanes, the attack amount kept on a shielded hit, and an extra key on default events.

## Tradeoffs and limits
- Both + Shield showed no benefit and no cost under this CPU. Shipping it would still mean a rule players must learn, a new rules version, and a zero-damage hit that the clash log and presenter do not describe. This evidence gives no reason to adopt it.
- Shield alone leaves the seat gap at the shipped level (−0.2 points, −0.7 to +0.3). It adds 0.06 rounds and keeps the 74 openings with no summon. Against Both it is 11.4 points worse.
- The CPU never sees the flag. Under Both the round-1 boards were the same with and without the shield, so the flag never fired. A player who knows the rule might leave a lane open in round 1, which self-play cannot measure.
- The seat gaps on these seeds are lower than in Fable's holdout: Shipped 24.3 against 28.3, and Both 12.7 against 22.0. The Both change here, −11.6 (−17.1 to −6.2), overlaps Fable's −6.3 (−8.9 to −3.7). This sample has 512 seeds against Fable's 2,000.
- The coordinator generated `.artifacts/card-rd/round-one-tempo/codex-hard-sensitivity.json` as a separately labeled Hard follow-up. It is not part of this run and is not reported here.

## Receipts and files
The receipts are git-ignored and live under `.artifacts/card-rd/round-one-tempo/`:
- `prepatch-routes.json`
- `dev/{results,summary}.json` and `dev/receipt.txt`. `results.json` SHA-256 is `2d9af91b01f53e9dac4af8b7778916c9543a5faaff6a3483c2b9f888ee28c49c`.
- `holdout/{results,summary}.json`, `holdout/receipt.txt`, `holdout/rerun/`, `holdout/frozen-files.sha256` and `holdout/round1-patterns.json`. `results.json` SHA-256 is `0b8318f2d58cb01277c7570858934aff438648b97051da20bfa104f8982e0137`, and the rerun is identical.
- `verify-duel.log`

The commit changes `src/game/clash.js` (11 lines added, 1 removed, active only under the flag) and adds `scripts/compare-round-one-tempo.mjs`, `tests/game/round-one-tempo.test.js`, `.kiro/specs/round-one-tempo/` and this note. Nothing was pushed, published or merged.
