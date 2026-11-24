# CARD-WIZARD-SINGULARITY tasks

Test tasks only. No engine, catalog, gallery or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js` (helpers `position`, `troop`, `act`); beat and gallery tests in `tests/match/showdown-3d-presentation.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 17, 18: "ordinary Singularity still shows one targeted vortex".
- 19 to 22: "both authored area Singularity gallery replays satisfy the area contact properties", "generated area Singularity layouts hit each enemy troop once in one contact" (seed 172890, 240 cases), "a dropped hit or a split contact ... fails the area properties".
- 05 (Ghostly exclusion) is covered for Deadeye, which shares `shot`, in "Ghostly troops cannot be targeted by spells, ...". Task 1 adds the Singularity case.

## Tasks

- [ ] 1. Targets (04, 05, 06). Wizards to act, hand `["wizard-singularity-1"]`. Cowboy board `[Captured Wraith, Covered Wagon, Sheriff]`: spell targets are `[1, 2]`. Cowboy board `[Captured Wraith]`: no spell action. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. After a troop acts (04). With a Wizard troop that has taken cover, assert no spell action.
- [ ] 3. Turn plays (07, 08). Hand `["wizard-singularity-1", "wizard-hellfire-1", "wizard-skeleton-1", "wizard-hex-1"]`. After casting Singularity: no `spell` action; a `summon` and a `set` action remain.
- [ ] 4. Resolution (09, 10, 11, 12). Cast at a 1-orb Sheriff carrying `cowboy-six-shooter-1` in slot 1, with a Billy in slot 0. Assert the Wizard discard ends with `wizard-singularity-1`, the Cowboy discard ends with `["cowboy-sheriff-1", "cowboy-six-shooter-1"]`, Billy stays in slot 0 with full orbs, and both Bases are unchanged.
- [ ] 5. No trap, no Last Stand, cover ignored (13, 14, 15). Cowboy trap `["cowboy-bear-trap-1"]`, a 1-orb Dynamiter in cover. Cast at it. Assert the trap is still set, the Dynamiter is defeated, and the events are only `spell`.
- [ ] 6. Log (16). `presentEvent` returns "The Wizards' Singularity hit Sheriff: 2 orbs left.", "... : 1 orb left." and "... : defeated." for targets on 3, 2 and 1 orbs.
- [ ] 7. Lethal beat order (17). Cast at a 1-orb Sheriff. Assert beat kinds `["play", "vortex", "burial", "burial"]` and that the burials carry the Sheriff and the Singularity. Run `node --test tests/match/showdown-3d-presentation.test.js`.
- [ ] 8. Catalog (01, 02, 03). Assert `TYPES["wizard-singularity"]`, that its `SHOWDOWN_SPECS` record has no `copies` or `relocates`, and the deck counts. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
- [ ] 9. Route the gallery mismatch to Fable. Quote the "Not numbered" note in `requirements.md` in the Fable thread. Change nothing until Fable decides.
