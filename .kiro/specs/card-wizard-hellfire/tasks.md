# CARD-WIZARD-HELLFIRE tasks

Test tasks only. No engine, catalog, gallery or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js` (helpers `position`, `troop`, `act`); beat tests in `tests/match/showdown-3d-presentation.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 07, 08, 10 (Ghostly and lethal): "Ghostly troops cannot be targeted by spells, but Hellfire still burns them".
- 16, 17, 18: "the Hellfire gallery casts one real spell and strikes all three troops together" and "Hex stops an attack, Lasso shows a stun, and Hellfire groups public targets".

## Tasks

- [ ] 1. Offer (03, 04). Wizards to act, hand `["wizard-hellfire-1"]`. Empty Cowboy board: no spell action. Two Cowboy troops: exactly one spell action, `{type: "spell", cardId: "wizard-hellfire-1"}` with no `target`. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Shared play (05). Hand `["wizard-hellfire-1", "wizard-singularity-1", "wizard-bone-armor-1"]`, a Wizard troop on the board. After Hellfire: no `spell` and no `gear` action.
- [ ] 3. Guard, cover and order (07, 09, 14). Cowboy board `[Covered Wagon, Sheriff in cover, Billy]`. Assert healths `[3, 2, 3]` and `spell` events whose `target` ids follow slot order 0, 1, 2.
- [ ] 4. Graveyard order and gear (06, 10). Cast at a 1-orb Sheriff carrying `cowboy-six-shooter-1`. Assert the Wizard discard ends with `wizard-hellfire-1` and the Cowboy discard ends with `["cowboy-sheriff-1", "cowboy-six-shooter-1"]`.
- [ ] 5. Nothing else changes (11, 12, 13). Wizard board with a Skeleton, Cowboy trap `["cowboy-bear-trap-1"]`, a 1-orb Dynamiter. Assert the Skeleton keeps 3 orbs, both Bases are unchanged, the trap is still set, the Dynamiter is defeated, and no `laststand` or `trap` event appears.
- [ ] 6. Log (15). For a Sheriff on 3 orbs and a Billy on 1 orb, assert "The Wizards' Hellfire hit Sheriff: 2 orbs left." and "The Wizards' Hellfire hit Billy: defeated."
- [ ] 7. Lethal beats (16). Cowboy board `[Sheriff on 1, Billy on 4]`. Assert beat kinds `["play", "hellfire", "burial", "burial"]`, the `hellfire` beat has 2 targets, and the burials carry the Sheriff and the Hellfire. Run `node --test tests/match/showdown-3d-presentation.test.js`.
- [ ] 8. Catalog and decks (01, 02). Assert `TYPES["wizard-hellfire"]` and `EFFECTS.hellfire.target === false`, and the Hellfire count in each deck. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
