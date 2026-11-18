# Requirements: Round-one tempo (round-1 Base shield experiment)
**Status: experiment spec, requirements-first.** Written by Kiro on `kiro/round-one-tempo` at base `9603fe4` before the code change and before any shield match was played. The criteria below are frozen before the holdout runs; the holdout receipt records this file's SHA-256.

**Hypothesis.** In the prior 4,000-match holdout (`docs/evidence/fable-opening-holdout.md`) the opening policy Both removed every opening free-summon drought and still left the first seat 22.0 points ahead (55.1% against 33.1%). If part of that edge comes from unopposed Base damage early in the match, a first clash that cannot hurt either Base gives both players time to build. Both + Shield should then narrow the seat gap against Both without making games much longer.

**Tested rule, experimental flag only.** On a match state with `experimentalRoundOneBaseShield: true`, an attack into an empty lane during the round-1 clash deals 0 to the opposing Base, whichever faction attacks. Attacks into a troop, defeats and spells resolve as usual. Base damage is normal from round 2. The shielded attack keeps its `damage` event, with `amount: 0`, `before` equal to `after`, and `shielded: true`.

**Default parity.** Without the flag every rule, event, CPU choice and route is unchanged, including the seed 0 and seed 60 routes. `createMatch` never sets the flag, `publicState` never shows it, and no URL parameter or browser control sets it, so neither the CPU nor the graybox can see it.

| ID | Requirement | Check |
| --- | --- | --- |
| RT-1 | WHEN the flag is absent, THE engine SHALL behave exactly as at `9603fe4`. | Existing `tests/game/match.test.js` round-1 Base tests unchanged. New test pins the SHA-256 of the default seed 0 and seed 60 CPU-vs-CPU routes recorded before the patch. `tests/match/trap-presenter.test.js` renderer baseline for seeds 0 and 60. |
| RT-2 | THE flag SHALL be set only by tests and the experiment script. | Test: `createMatch` and `openingMatch` never add the key, and `publicState` of a flagged state equals the unflagged one. `git grep` finds the flag only in owned files. |
| RT-3 | WHILE the flag is set and the round is 1, WHEN a troop of either faction attacks an empty lane, THE opposing Base SHALL keep its orbs and THE `damage` event SHALL report `amount: 0`, `before` = `after` and `shielded: true`. | `tests/game/round-one-tempo.test.js`: each faction alone, and both ways in one clash. |
| RT-4 | WHILE the flag is set in round 1, attacks into a troop, defeats and spells SHALL resolve exactly as without it. | Same file: blocked clash, mixed clash and spell casts compared with and without the flag. |
| RT-5 | WHILE the flag is set, from round 2 an attack into an empty lane SHALL damage the Base normally, with no `shielded` key. | Same file: a round-2 fixture and seeded matches played through round 2. |
| RT-6 | EVERY `damage` event SHALL satisfy `after = max(0, before − amount)`. Base damage SHALL be counted as `before − after`. | The experiment script asserts, per match, that the Base damage events add up to the orbs each Base lost. |
| RT-7 | THE comparison SHALL play four policies on the same seeds, decks and released CPU (`chooseAction` on both sides), each seed once with each faction first: Shipped, Both, Shield (shipped opening + flag) and Both + Shield. | `scripts/compare-round-one-tempo.mjs` reuses `openingMatch`, `playMatch` and `legalActions`. It asserts card conservation, that every action is listed by `legalActions` and accepted, that shipped runs with the natural first seat equal `playMatch`, and that each shield policy plays the same round-1 actions as its unshielded twin. |
| RT-8 | A development sample SHALL run first. A separate 512-seed holdout SHALL run once the code and this file are frozen, and a rerun SHALL produce byte-identical output. | Development seeds 10000–10063. Holdout seeds 20000–20511. No earlier note used seeds of 10000 or more. SHA-256 receipts under `.artifacts/card-rd/round-one-tempo/`. |
| RT-9 | THE evidence note SHALL report, per policy and sample: exact seeds, match count, first-seat, second-seat and draw share, mean rounds, sides with no round-1 summon, and Base damage in and after the first clash. It SHALL include paired changes with 95% intervals. | `docs/evidence/kiro-round-one-tempo.md`. |
| RT-10 | A shield policy SHALL count as a good first candidate only if, on the holdout against Both, the paired seat-gap change has a 95% interval entirely below zero AND mean rounds rise by at most 0.5. Otherwise the note SHALL report it as failed, with its tradeoffs. | `verdict` in the script output; the note. |
| RT-11 | THE change SHALL NOT touch the graybox UI, art, release config, package files or the CPU, and SHALL NOT be pushed, published or merged. | `git diff --stat` on the commit. |

## Metrics
- Seat gap: first-seat win share minus second-seat win share, in points. Draw share and mean rounds (round of the result) are reported beside it.
- Paired changes treat each seed's two matches as one observation: mean ± 1.96 standard errors over seeds.
- Opening no-summon count: sides that made no summon before the round-1 clash, by seat. Hands dealt with no free troop are reported beside it.
- Base damage: orbs actually removed, by the seat whose Base was hit. It is split into the round-1 clash and all later clashes, because the brief's phrase "total Base damage after first clash" reads both ways.
- Mechanism count: matches whose round-1 clash has an attack into an empty lane. The shield can change only those matches.

## Limits known before running
- The CPU reads only `publicState`, so it plays round 1 as if the shield were absent. This is the unchanged CPU strategy the brief asks for, not a shield-aware player.
- 512 seeds give roughly ±5 points on a paired seat-gap change that moves many results. A change that moves few results has a narrower interval.
