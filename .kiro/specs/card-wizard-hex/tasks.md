# CARD-WIZARD-HEX tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 08, 09 (target orbs), 10, 15: "a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first".
- 03 (one a turn, two at most) for traps in general: "setting a trap: ..." (Bear Trap).
- 06: showdown-3d-presentation.test.js checks that replay frames hide the Wizard `traps` list.
- 17: showdown-3d-presentation.test.js "Hex stops an attack, ..." (`["trap", "burial"]`).

## Tasks

- [ ] 1. Set limits (03, 04, 05). Wizards to act, hand `["wizard-hex-1", "wizard-hex-2", "wizard-skeleton-1", "wizard-singularity-1"]`, a Cowboy troop on the board. Set Hex 1: assert no further `set` action, and `summon` and `spell` actions remain. With `traps = ["wizard-hex-8", "wizard-hex-9"]` assert no `set` action. With `traps = ["wizard-hex-8"]`, set Hex 1 and assert `traps` is `["wizard-hex-8", "wizard-hex-1"]`. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Public view and log (06, 07). After a set, assert `viewFor(state, "cowboy").sides.wizard` has `trapCount` 1 and no `traps`, and `presentEvent` on the `set` event returns "The Wizards set a card face down."
- [ ] 3. Nothing lands (09). A Gatling Crew attacks into a Hex with two Wizard troops on the board. Assert every Wizard troop and both Bases unchanged and no `sweep` event.
- [ ] 4. Card plays close (11). After a cancelled attack, assert `legalActions` has no `summon`, `spell`, `gear`, `location` or `set` action.
- [ ] 5. Base and ride-past (12). A Mounted Billy rides past a Skeleton into a Hex: Wizard Base unchanged. Empty Wizard board, Billy attacks the Base into a Hex: Base unchanged.
- [ ] 6. Cover springs nothing (13). A Cowboy troop takes cover while a Hex is set. Assert the Hex is still in `traps`.
- [ ] 7. Oldest first (14). `traps = ["wizard-hex-1", "wizard-hex-2"]`. One Cowboy attack: `traps` becomes `["wizard-hex-2"]`. A second attack by another troop: `traps` is empty.
- [ ] 8. Log (16). `presentEvent` on the `trap` event returns "Trap! The Wizards' Hex caught Billy: its attack was cancelled."
- [ ] 9. Catalog and decks (01, 02). Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js` after adding the record and count assertions.
