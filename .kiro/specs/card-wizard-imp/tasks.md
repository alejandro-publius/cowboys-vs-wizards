# CARD-WIZARD-IMP tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 05: "Quickdraw: a free troop with it attacks on the turn it arrives".
- 09: "a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first".
- 11: showdown-3d-presentation.test.js "every troop opens a real rules-engine preview, ...".

## Tasks

- [ ] 1. Turn 1 (06). `createShowdown(seed, {first: "wizard"})`, hand set to `["wizard-imp-1"]`, Cowboy Sheriff on the board. Summon the Imp on turn 1. Assert no attack action. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Overflow (07). Imp attacks a 1-orb Sheriff. Assert Cowboy Base 5 → 3 and the Imp survives.
- [ ] 3. Falls to hit-back (08). Imp attacks a full Covered Wagon. Assert the Wagon on 1 and the Imp in the Wizard graveyard.
- [ ] 4. Last Stand (10). Imp attacks a Dynamiter. Assert both are in their graveyards and one `laststand` event names the Imp as target with `left: 0`.
- [ ] 5. Catalog and decks (01, 02, 03). Assert `TYPES["wizard-imp"]`, that the lane `CARD_SPECS` entry has `copies: 0, limit: 1`, that the `SHOWDOWN_SPECS` entry has neither, and the counts in 03. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
