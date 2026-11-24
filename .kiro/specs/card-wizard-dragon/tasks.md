# CARD-WIZARD-DRAGON tasks

Test tasks only. No engine, catalog, bounty or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js` (helpers `position`, `troop`, `act`, `attacks`); bounty tests in `prototypes/showdown/progress.test.js`; beat tests in `tests/match/showdown-3d-presentation.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 08, 09 (lethal Sweep), 10: rules.test.js "Sweep: every other enemy troop loses an orb when it attacks a troop".
- 15, 20, 21: showdown-3d-presentation.test.js "Ranger, Dragon counter, and a cancelled Dragon attack ..." and "covered Last Stand, Ride, and lethal Sweep ...".
- 19 (cover outcome without Sweep): rules.test.js "cover: ...".
- 22 (landing turn), 25, 26 (`summon` before the draw), 27, 29: progress.test.js Dragon landing block.
- 24 (no Dragon in escort): progress.test.js "the boss is not also in its escort deck".

## Tasks

- [ ] 1. Tribute pairs (04, 05, 06, 07). Wizards to act, hand `["wizard-dragon-1"]`. One Skeleton: no summon action. Three Skeletons: exactly the tribute pairs `[0,1]`, `[0,2]`, `[1,2]`. After summoning with `[0,1]` and a Cowboy Sheriff opposite, `canAttack` is true. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. No Sweep on a Base attack (11). Wizards to act, Dragon on slot 0, empty Cowboy board. Attack `"base"`. Assert Cowboy Base 5 → 2 and no `sweep` event.
- [ ] 3. Sweep ignores cover and Ghostly (12). Cowboy board: Sheriff (target), Sheriff in cover, Captured Wraith. Dragon attacks slot 0. Assert slot 1 health 2 and slot 2 health 1.
- [ ] 4. Sweep never fires Last Stand (13). Cowboy board: Sheriff (target) and a 1-orb Dynamiter. Dragon attacks the Sheriff. Assert the Sheriff and the Dynamiter are both defeated, the Dragon stays on 5 orbs (a defeated target does not hit back), and there is no `laststand` event.
- [ ] 5. Sweep before the Dragon falls (14). Dragon with 1 orb attacks a full Covered Wagon (hit-back 1) with a 1-orb Sheriff beside it. Assert both the Dragon and the Sheriff are in their graveyards, a `sweep` event exists, and the Wagon has 1 orb.
- [ ] 6. Bear Trap survived (16). Full Dragon, Cowboy trap `["cowboy-bear-trap-1"]`, Cowboy board Sheriff + Sheriff. Dragon attacks slot 0. Assert events `trap`, `attack`, `sweep` in that order, the Dragon on 3 orbs (5 − 2 from the trap; the defeated Sheriff does not hit back), slot 0 empty and slot 1 on 2 orbs.
- [ ] 7. Sweep event and log (17, 18). From task 3, assert one `sweep` event with `count` 2 and the text "Sweep: Dragon also hit 2 other troops for 1." With a single other troop, assert "... 1 other troop for 1."
- [ ] 8. Hunt table (22, 23, 24). Assert `BOUNTIES[1]` fields and the escort counts, and that no escort type has the `guard` keyword. Run `node --test prototypes/showdown/progress.test.js`.
- [ ] 9. Landing leaves the turn's plays open (28, 30). Land the boss as the existing test does, then set the Wizard hand to `["wizard-skeleton-1", "wizard-wizard-1"]`. Assert a Skeleton summon action exists, and a Wizard summon action with `tributes: [0]` (the boss's slot) is legal.
- [ ] 10. Log name (31). `presentEvent` on the landing `summon` event returns "The Wizards' Dragon arrived."
- [ ] 11. Capture (32, 33). Settle five Graveyard Dragon wins on a finished-Trail save. Assert `hunts["graveyard-dragon"]` goes 1 to 5, `earned.captured` is `cowboy-captured-dragon` only on the fifth, and the collection holds 1 copy.
- [ ] 12. Lesson (34). Assert `duelFor(save, "hunt:graveyard-dragon").lesson` equals the text in 34.
- [ ] 13. Catalog (01, 02, 03). Assert `TYPES["wizard-dragon"]`, the absence of `copies` in its `SHOWDOWN_SPECS` record, and the deck counts. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
