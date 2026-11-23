# CARD-WIZARD-BONE-ARMOR tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 06 (Skeleton 3 → 5): "gear: a Six-Shooter adds 1 attack, Bone Armor adds 2 orbs, ...".
- 05 for gear in general (Six-Shooter blocks a spell): same test.

## Tasks

- [ ] 1. Offer (03, 04). Wizards to act, hand `["wizard-bone-armor-1"]`. Empty board: no gear action. Skeletons on slots 0 and 2: gear actions for slots `[0, 2]`. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Shared play (05). Add `wizard-boneyard-1` and `wizard-hellfire-1` to the hand and a Cowboy troop to the board. After Bone Armor: no `location` or `spell` action.
- [ ] 3. Stacking and attack (06, 07, 08). Fix two Bone Armors to one Imp over two turns. Assert health 5 and `attackOf` 3.
- [ ] 4. Graveyard order (09, 10). An armored Skeleton is paid as tribute for a Headless Horseman (no Raise). Assert the Wizard discard is `["wizard-skeleton-1", "wizard-bone-armor-1"]` and the armor is in no hand, deck or `traps` list.
- [ ] 5. Raise leaves it (11). Repeat task 4 paying for a Wizard instead. Assert the returned Skeleton has `gear: []` and health 1, and the discard is `["wizard-bone-armor-1"]`.
- [ ] 6. Log (12). `presentEvent` on the `gear` event returns "The Wizards' Skeleton now carries Bone Armor."
- [ ] 7. Catalog and decks (01, 02). Assert `TYPES["wizard-bone-armor"]`, `EFFECTS.bonearmor` `{attack: 0, orbs: 2}`, and the counts. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
