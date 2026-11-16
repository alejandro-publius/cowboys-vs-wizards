# Opening-hand experiment: guaranteed free summon

Work by Fable (Claude Fable 5.2, Claude Code), 2026-11-15, on branch
`fable/opening-hand-experiment`, built on `b3c77bd`. Not Kiro or Codex work.
**No rule changed.** The variant exists only in
`scripts/opening-hand-experiment.mjs`; `src/game/` and `RULES_VERSION`
(`orb-duel-draft-1`) are untouched. `scripts/play-match.mjs` gained one optional
argument so the runner and the trace printer accept a prepared opening state.

These are bot-against-bot results with one heuristic CPU on both sides. They are
not proof of balance for human play.

## Method

```sh
node scripts/opening-hand-experiment.mjs --out docs/evidence/opening-hand-experiment
```

- **Deals:** seeds 0–999 from `createMatch(seed)`.
- **Variant:** a side dealt no free-summon troop (Sheriff or Skeleton) swaps its
  fourth card with the free-summon troop nearest the top of its deck. All other
  cards stay where the seed put them, so the 938 deals that already qualify are
  identical in both variants.
- **Starting side:** every deal is played twice per variant, once with each side
  acting first in round 1. That gives 2,000 matches per variant.
- **Policy:** `chooseAction` from `src/game/cpu.js` for both sides in both variants.
- **Checks in the script:** the variant changes only deals that lack a free
  summon, keeps each side's 12 cards, and leaves no hand without one. The
  current rules with the seeded starting side give Cowboy 425, Wizard 472, draws
  103, the same as `docs/evidence/cpu-playtests/cpu-vs-cpu-seeds-0-999.json`.
- **Output:** `docs/evidence/opening-hand-experiment/report.json` and
  `traces.txt` (seeds 14, 27 and 47, both starting sides, both variants).

## Results

Deals with no free summon under the current rules: Cowboy 23, Wizard 40, either
side 62 of 1,000 (6.2%), both sides 1. The exact chance is 15/495 = 3.0% per
side, so the 23 against 40 split is sampling noise. With the guarantee: 0.

| 2,000 matches per variant | Current | Guaranteed |
|---|---|---|
| Cowboy wins | 880 (44.0%) | 855 (42.8%) |
| Wizard wins | 943 (47.2%) | 960 (48.0%) |
| Draws | 177 (8.9%) | 185 (9.3%) |
| Cowboy starts: Cowboy / Wizard / draw | 585 / 321 / 94 | 578 / 327 / 95 |
| Wizard starts: Cowboy / Wizard / draw | 295 / 622 / 83 | 277 / 633 / 90 |
| Side acting first wins | 1,207 (60.4%) | 1,211 (60.6%) |
| Side acting second wins | 616 (30.8%) | 604 (30.2%) |
| Ended at the round limit | 343 | 363 |
| Mean length | 7.28 rounds, 31.88 actions | 7.44 rounds, 32.72 actions |

The 62 changed deals (124 matches per variant) carry the whole difference:

| 124 matches per variant | Current | Guaranteed |
|---|---|---|
| Side dealt no free summon: won / lost / drew | 1 / 123 / 2 | 59 / 57 / 10 |
| of those, when it acted first | 0 / 62 / 1 | 32 / 24 / 7 |
| of those, when it acted second | 1 / 61 / 1 | 27 / 33 / 3 |
| Cowboy / Wizard / draw | 79 / 44 / 1 | 54 / 61 / 9 |
| Mean length | 3.86 rounds | 6.52 rounds |

The first row counts 126 results because one deal left both sides short. The
winner differs between the variants in 66 of the 124 matches.

## Traces

- **Seed 14** (Cowboy dealt three Billys and Mounted Billy): under the current
  rules the Cowboy passes round 1 and loses in round 3 or 4 from either seat.
  With a Sheriff in hand the Cowboy wins in round 9 when starting and still
  loses in round 4 when second.
- **Seeds 27 and 47** (Wizard dealt only Wizards, a Dragon and Singularity):
  the Cowboy wins in round 3 from either seat under the current rules. With a
  Skeleton the Cowboy still wins both seats of seed 47 and one of seed 27, in
  rounds 4–5; seed 27 with the Wizard starting becomes a round-9 draw.

## Recommendation

Adopt the guarantee, as a rules-owner decision. Under this CPU a hand with no
free summon is a loss decided by the shuffle: 1 win in 126, in under four
rounds, whichever side starts. With the guarantee those same deals split 59 to
57 and last about as long as a normal match.

Tradeoffs seen:

- **The Wizard lead grows**, from 63 wins (943 to 880) to 105 (960 to 855). In
  this sample the Wizard was short 40 times against the Cowboy's 23, so the
  current rule handed the Cowboy more free wins. The 938 unchanged deals already
  favour the Wizard 899 to 801; the guarantee exposes that edge, it does not
  create it.
- **Matches run slightly longer**: +0.16 rounds, 20 more round-limit endings and
  8 more draws in 2,000.
- **The first-player edge is untouched**: the side acting first wins about 60%
  against 30%. That is the larger imbalance and needs its own change.

Limits: 62 changed deals; one heuristic policy with no human play; the swap of
the fourth card is one of several ways to phrase the guarantee, and a redraw
rule would order the deck differently.
