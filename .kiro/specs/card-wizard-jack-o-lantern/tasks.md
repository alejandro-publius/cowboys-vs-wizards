# CARD-WIZARD-JACK-O-LANTERN tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 03: "Last Stand: ..." (Billy attacks a Jack-o'-Lantern and ends on 3).
- 06, 13: showdown-3d-presentation.test.js "covered Last Stand, Ride, and lethal Sweep ..." and the Last Stand preview check in "every troop opens a real rules-engine preview, ...".

## Tasks

- [ ] 1. Attacking Jack-o'-Lantern (04). Wizards to act, a Jack-o'-Lantern attacks a full Cowboy Sheriff. Assert the Sheriff ends on 1 (1 from the attack, 1 from Last Stand) and the Jack-o'-Lantern is in the Wizard graveyard. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Lethal Last Stand (05, 11). A Cowboy Billy on 1 orb attacks the Jack-o'-Lantern. Assert both are defeated and the log reads "Last Stand: Jack-o'-Lantern took an orb off Billy, defeating it."
- [ ] 3. No chain (07). A Cowboy Dynamiter (3/1, Last Stand) attacks the Jack-o'-Lantern. Assert both are defeated and exactly one `laststand` event appears, from the Jack-o'-Lantern. Repeat with the Jack-o'-Lantern attacking the Dynamiter: one `laststand` event, from the Dynamiter.
- [ ] 4. No Last Stand outside fights (08). Separately: Deadeye on the Jack-o'-Lantern; Bear Trap springing on its attack; a Gatling Crew attack on another Wizard troop sweeping it to 0; a Wizard summon paying it as tribute. Assert no `laststand` event in each.
- [ ] 5. Base attack (09). Empty Cowboy board; the Jack-o'-Lantern attacks the Base. Assert Cowboy Base 5 → 4 and no `laststand` event.
- [ ] 6. Event fields (10). From task 1, assert the `laststand` event has `cardId` of the Jack-o'-Lantern, `target` of the Sheriff and `left` 1.
- [ ] 7. Catalog and decks (01, 02). Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js` after adding the record and count assertions.
