# CARD-WIZARD-LANTERN-WRAITH tasks

Test tasks only. No engine, catalog, bounty or UI change is planned. [Codex CLI verification, 2026-11-27](../../../docs/evidence/showdown-wanted-card-proof.md) maps each checked task to its executed assertions.

Already covered by existing tests (to re-run, not rewrite):
- 01: `tests/game/card-specs.test.js` asserts the Lantern Wraith record.
- 03 (escort), 05 (orbs), 09, 10: `prototypes/showdown/progress.test.js` Lantern Wraith block and "the boss is not also in its escort deck".
- 07, 08: `prototypes/showdown/rules.test.js` "a bounty's boss opens on the board with the orbs the hunt gives it".
- 12: `rules.test.js` "Ghostly troops cannot be targeted by spells, ...".
- 16: `tests/match/showdown-3d-presentation.test.js` "every troop opens a real rules-engine preview, ...".

## Tasks

- [x] 1. Attack target (13). In `prototypes/showdown/rules.test.js`, Cowboys to act, a Billy facing the Wraith alone. Assert the attack `0>0` is legal. Run `node --test prototypes/showdown/rules.test.js`.
- [x] 2. Sweep reaches it (14). A Cowboy Gatling Crew attacks a Skeleton beside a full Wraith. Assert the Wraith ends on 3.
- [x] 3. Bear Trap (15). Wizards to act, Wraith on 4 orbs, Cowboy trap `["cowboy-bear-trap-1"]`. The Wraith attacks a Sheriff. Assert a `trap` event and the Wraith on 2 before the exchange (ends on 1 after the Sheriff's hit-back).
- [x] 4. Hunt table and lesson (04, 06, 11). In `prototypes/showdown/progress.test.js`, assert `BOUNTIES[0]` fields, escort counts and `duelFor(save, "hunt:lantern-wraith").lesson`. Run `node --test prototypes/showdown/progress.test.js`.
- [x] 5. Sync rule (02). In `tests/game/card-specs.test.js`, assert the lane `CARD_SPECS` record has `copies: 0`, `bounty: true` and no `limit`. Run `node --test tests/game/card-specs.test.js`.
