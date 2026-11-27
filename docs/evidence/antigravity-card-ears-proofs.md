# Cowboy and Wizard card requirements

Antigravity authored the initial card tests. Codex reviewed the assertions, exercised the card sync validator, and fixed the illustrated replay when a defeated troop takes its gear to the graveyard. The replay uses the existing burial beat for each discarded card.

## Named coverage

At the branch base `93db9f3`, the trace linked 55 of the 443 card clauses to named tests. With these changes it links 440, an increase of 385. Across the 29 card specifications, 27 have a named test for every clause. Across the 45 specifications on this branch, 449 of 728 clauses have named coverage, up from 64. The trace reported zero duplicate IDs, zero unsupported declarations, and the same two unresolved historical references. A trace link records which test names the clause. Running that test checks the assertions.

| Clause without a named test | Remaining question |
| --- | --- |
| CARD-WIZARD-HELLFIRE-04 | Whether Hellfire can be cast while the enemy board is empty remains an open [referee ruling](../../proof/referee/referee.py). |
| CARD-WIZARD-HELLFIRE-06 | The test observes Hellfire leaving the hand and entering its graveyard, and the enemy troop losing an orb. The public result does not expose when the discard occurred relative to the orb loss. |
| CARD-WIZARD-DRAGON-14 | The test observes the Dragon's death from hit-back and damage to its Sweep target. The public result does not establish when the Dragon entered its graveyard relative to the Sweep. |

The [card tests](../../tests/game/card-ears-catalog-proofs.test.js) exercise the engine, campaign, and public replays. The [card sync test](../../tests/game/card-ears-sync.test.js) runs the real validator with the valid catalog and four altered inputs. The [presentation test](../../tests/match/showdown-3d-presentation.test.js) checks the burial sequence and destination for a lethal Singularity against an equipped defender.

## Reproduce

```sh
node --test tests/game/card-ears-catalog-proofs.test.js tests/game/card-ears-sync.test.js tests/match/showdown-3d-presentation.test.js tests/game/dec4-trace.test.js tests/assets/links.test.mjs
node scripts/trace.mjs --json
```
