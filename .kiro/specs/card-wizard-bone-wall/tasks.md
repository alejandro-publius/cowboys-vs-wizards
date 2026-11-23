# CARD-WIZARD-BONE-WALL tasks

Test tasks only. No engine, catalog or UI change is planned. Add rules tests to `prototypes/showdown/rules.test.js` with its existing `position`, `troop`, `act` and `attacks` helpers. Run `node --test prototypes/showdown/rules.test.js` after each task. None of these commands has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 01: `tests/game/card-specs.test.js` asserts the full `TYPES["wizard-bone-wall"]` record.
- 09, 10: `rules.test.js` "locations: ..." asserts Bone Wall attack 1 in the Boneyard and an attack action for its slot.
- 12, 13: `rules.test.js` "Guard: enemies must attack it first, and a rider cannot pass it".
- 21: `tests/match/showdown-3d-presentation.test.js` asserts `attackExample("wizard-bone-wall", "attack")` is null.

## Tasks

- [ ] 1. Summon and rest (04, 05, 06, 07). Wizards to act, empty board, hand `["wizard-bone-wall-1"]`. Assert the summon action has `tributes: []`. After it, assert slot 0 has health 4, `gear: []`, `canAttack` false, and a `cover` action for slot 0. With three Skeletons on the board, assert no summon action for the Bone Wall.
- [ ] 2. No attack without help (08, 11). Wizards to act, Bone Wall on slot 0 facing a Cowboy Sheriff. Assert no attack action for slot 0. Apply Bone Armor to slot 0 and assert `attackOf` is still 0, health is 6 and there is still no attack action.
- [ ] 3. Spells ignore Guard (14). Cowboys to act with `[Skeleton, Bone Wall]` on the Wizard board and hand `["cowboy-deadeye-1"]`. Assert spell targets `[0, 1]`.
- [ ] 4. No hit-back and its log line (15, 16). Cowboy Sheriff attacks a full Bone Wall. Assert Sheriff health 3, Bone Wall health 3, the attack event's `hitBack` 0, and `presentEvent` text "The Cowboys' Sheriff attacked Bone Wall and left it on 3; it has no attack, so it did not hit back."
- [ ] 5. Overflow and cover (17, 18). Mounted Billy (3 attack) attacks a 1-orb Bone Wall: Wizard Base 5 → 3. Repeat with the Bone Wall in cover: Wizard Base stays 5.
- [ ] 6. Defeat with gear (19). A 1-orb Bone Wall carrying `wizard-bone-armor-1` is defeated by a Cowboy attack. Assert the Wizard discard ends with `["wizard-bone-wall-1", "wizard-bone-armor-1"]`.
- [ ] 7. Raise returns it (20). Wizards to act, an Imp on Wizard slot 0, discard `["wizard-skeleton-2", "wizard-bone-wall-1"]`, hand `["wizard-wizard-1"]`. Summon the Wizard paying the Imp (a Fiend), so the Bone Wall stays the last Undead troop. Assert the Bone Wall returns with health 1 and `gear: []`.
- [ ] 8. Gallery summary (22). Assert `attackExample("wizard-bone-wall", "guard").summary` starts with "Guard makes enemies attack Bone Wall first." Run `node --test tests/match/showdown-3d-presentation.test.js`.
- [ ] 9. Deck counts (03). In `prototypes/showdown/progress.test.js`, assert the Bone Wall count for every deck in `TRAIL`, `RIVALS`, `BOUNTIES` and `DECKS.wizard` against the table in requirement 03. Run `node --test prototypes/showdown/progress.test.js`.
