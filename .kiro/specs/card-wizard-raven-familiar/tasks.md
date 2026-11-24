# CARD-WIZARD-RAVEN-FAMILIAR tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 04 for Scout in general: "Scout draws a card on arrival" (Cowboy Ranger).
- 10: showdown-3d-presentation.test.js "every troop opens a real rules-engine preview, ...".

## Tasks

- [ ] 1. Raven draws (03, 04). Wizards to act, hand `["wizard-raven-familiar-1"]`. Record the Wizard deck's top card. Summon. Assert `tributes: []`, `canAttack` false, the hand equals `[top]`, and event types `["summon", "draw"]`. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Empty deck (05). Same with `sides.wizard.deck = []`. Assert no `draw`, no `fatigue` event and the Wizard Base unchanged.
- [ ] 3. Full hand (06). Build a Wizard hand of 7 cards including the Raven (a state normal play cannot reach). Summon. Assert a `burn` event and the burned card in the Wizard discard.
- [ ] 4. Plays stay open (07). Deck top `wizard-hex-9`, hand `["wizard-raven-familiar-1"]`. After the summon assert a `set` action for the Hex.
- [ ] 5. Bot replans (08). Scan seeded even-match turns (for example seeds 0–59 played with `playTurn`) for a Wizard state where `planTurn` returns a plan that contains a Raven summon while the Wizard deck is not empty. Assert that summon is the plan's last action. Record the seed used.
- [ ] 6. Log (09). `presentEvent` on the `draw` event returns "The Wizards drew a card."
- [ ] 7. Catalog and decks (01, 02). Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js` after adding the record and count assertions.
