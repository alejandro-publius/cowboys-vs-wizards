# CARD-WIZARD-SKELETON tasks

Test tasks only. No engine, catalog or UI change is planned. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 07: rules.test.js "locations: ..." asserts Skeleton attack 2 in the Boneyard.
- 08: rules.test.js "Raise returns the last Undead troop ...".
- 10: showdown-3d-presentation.test.js "every troop opens a real rules-engine preview, ...".

## Tasks

- [ ] 1. Free and resting (04, 05). In `prototypes/showdown/rules.test.js`, Wizards to act, hand `["wizard-skeleton-1"]`, a Cowboy Sheriff opposite. Assert the summon has `tributes: []` and the arrived Skeleton has `canAttack` false. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Hit-back (06). Cowboy Sheriff attacks a full Skeleton. Assert Skeleton 2 orbs, Sheriff 2 orbs, attack event `hitBack` 1.
- [ ] 3. Raised Skeleton rests (09). Extend task 1 with a Wizard summon that tributes a Skeleton. Assert the returned Skeleton has `canAttack` false while the Wizard's is true.
- [ ] 4. Catalog and decks (01, 02, 03). Assert `TYPES["wizard-skeleton"]`, no `copies` in its `SHOWDOWN_SPECS` record, and the counts in 03. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
