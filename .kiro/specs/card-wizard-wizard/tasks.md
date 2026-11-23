# CARD-WIZARD-WIZARD tasks

Test tasks only. No engine, catalog or UI change is planned. Add tests to `prototypes/showdown/rules.test.js` with its `position`, `troop`, `act` and `attacks` helpers, then run `node --test prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 10, 11, 12, 13, 15, 16 (Imp and Hex skipped): "Raise returns the last Undead troop from the graveyard with one orb, and only an Undead".
- 19: "a target that survives hits back, and neither Base is touched".

## Tasks

- [ ] 1. Tribute count and choices (04, 05, 06). Wizards to act with hand `["wizard-wizard-1"]`. Empty board: no summon action. Three Skeletons: exactly 3 summon actions, with tributes `[0]`, `[1]` and `[2]`.
- [ ] 2. Tribute first, gear included (07, 17). A Skeleton on slot 0 carries `wizard-bone-armor-1`. Summon the Wizard paying slot 0. Assert the Skeleton returns with health 1 and `gear: []`, and the Wizard discard still holds `wizard-bone-armor-1`.
- [ ] 3. Placement and strike (08, 09). Wizards to act, a Skeleton on slot 1, a Cowboy Sheriff opposite. Summon the Wizard paying slot 1. Assert the Wizard is on slot 0 with 4 orbs and `canAttack` is true.
- [ ] 4. Full board (14). Three Wizard troops, discard `["wizard-skeleton-9"]`. Summon the Wizard paying slot 0 (a non-Undead troop such as an Imp). Assert no `raise` event and the discard still contains `wizard-skeleton-9`.
- [ ] 5. Own graveyard only (18). Put `cowboy-captured-wraith-1` in the Cowboy discard and nothing Undead in the Wizard discard. Summon a Wizard paying an Imp. Assert no `raise` event.
- [ ] 6. Event order and log (20, 21). From task 2, assert event types `["tribute", "summon", "raise"]` and that `presentEvent` on the `raise` event returns "Raise: The Wizards' Skeleton returned from the graveyard with 1 orb."
- [ ] 7. Raise beat (22). In `tests/match/showdown-3d-presentation.test.js`, build a fixture where a Wizard summon raises a Skeleton. Assert one beat of kind `raise` with `from.at === "discard"` and its `hit` board slot at health 1. Run `node --test tests/match/showdown-3d-presentation.test.js`.
- [ ] 8. Catalog and decks (01, 02, 03). In `tests/game/card-specs.test.js`, assert `TYPES["wizard-wizard"]` and that the generated `SHOWDOWN_SPECS` entry has no `copies`. In `prototypes/showdown/progress.test.js`, assert the Wizard count in each deck listed in 03. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
