# CARD-WIZARD-HEADLESS-HORSEMAN tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 05: "Raise returns the last Undead troop ..." (raised Headless Horseman cannot attack).
- 14: showdown-3d-presentation.test.js "every troop opens a real rules-engine preview, ..." (the Ride preview has a `ride` beat).
- Ride and Guard behaviour is tested for Cowboy riders only; tasks 2 and 3 add the Wizard rider.

## Tasks

- [ ] 1. Tribute and strike (03, 04). Wizards to act, a Skeleton on the board, hand `["wizard-headless-horseman-1"]`, a Cowboy Sheriff opposite. Assert the summon needs `tributes: [0]` and the Horseman's `canAttack` is true. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Ride-past (06, 08, 09, 12). Wizards to act, a Horseman on slot 0, Cowboy board `[Sheriff, Billy]`. Assert targets `["0>0", "0>1", "0>base"]`. Ride past: Cowboy Base 5 → 4, both Cowboy troops unchanged, Horseman still 3 orbs, log "The Wizards' Headless Horseman struck the Cowboys' Base for 1."
- [ ] 3. Guard blocks (07). Cowboy board `[Sheriff, Covered Wagon]`. Assert targets `["0>1"]`.
- [ ] 4. Empty board (10). Empty Cowboy board: Base 5 → 3. With the Boneyard in play: Base 5 → 2.
- [ ] 5. Trap on a ride-past (11). Cowboy trap `["cowboy-bear-trap-1"]`. Ride past. Assert events `["trap", "attack"]`, the Horseman on 1 orb, and the Cowboy Base on 4.
- [ ] 6. Ride beat (13). In `tests/match/showdown-3d-presentation.test.js`, present the ride-past from task 2 and assert one beat of kind `ride` with `hit.sides.cowboy.base` 4. Run `node --test tests/match/showdown-3d-presentation.test.js`.
- [ ] 7. Catalog and decks (01, 02). Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js` after adding the record and count assertions.
