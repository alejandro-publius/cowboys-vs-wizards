# Tasks: Deadeye (`cowboy-deadeye`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`; progress test file: `prototypes/showdown/progress.test.js`.

- [ ] CARD-COWBOY-DEADEYE-01 covered: `tests/game/card-specs.test.js`, "canonical Showdown values for a sample of cards": `TYPES["cowboy-deadeye"]` deep-equals the spell shape with `rarity: "common", effect: "shot"`.
- [ ] CARD-COWBOY-DEADEYE-02 partial: rules, "Ghostly troops cannot be targeted by spells, but Hellfire still burns them": targets `[1, 1]` for Deadeye and Lasso. A stunned target is not asserted.
- [ ] CARD-COWBOY-DEADEYE-03 partial: rules, "gear: a Six-Shooter adds 1 attack, Bone Armor adds 2 orbs, and gear goes to the graveyard with its troop" casts a Deadeye but asserts only the shared allowance. Orb loss and defeat are not asserted.
- [ ] CARD-COWBOY-DEADEYE-04 unsigned. Assertion to add: Deadeye at `troop("wizard-jack-o-lantern")`; no `laststand` event.
- [ ] CARD-COWBOY-DEADEYE-05 covered: same gear test, "and a spell uses it too".
- [ ] CARD-COWBOY-DEADEYE-06 unsigned. Assertion to add: `presentEvent({type: "spell", side: "cowboy", cardId: "cowboy-deadeye-1", target: "wizard-skeleton-1", left: 2, stunned: false})` equals the exact sentence.
- [ ] CARD-COWBOY-DEADEYE-07 unsigned. Assertion to add: `DECKS.cowboy["cowboy-deadeye"] === 1`.
- [ ] CARD-COWBOY-DEADEYE-08 unsigned. Assertion to add: `STARTER["cowboy-deadeye"] === 3`.
- [ ] CARD-COWBOY-DEADEYE-09 unsigned. Assertion to add: `newSave().collection` deep-equals `{"cowboy-deadeye": 3}`.
- [ ] CARD-COWBOY-DEADEYE-10 unsigned. Assertion to add: `deckAfter(6)["cowboy-deadeye"] === 1`.
- [ ] CARD-COWBOY-DEADEYE-11 covered: progress, "a Trail win pays its card into the deck and offers a choice of two cards the player has met": sorted offer `["cowboy-covered-wagon", "cowboy-deadeye"]`.
- [ ] CARD-COWBOY-DEADEYE-12 covered: same test, `owned(chosen, "cowboy-deadeye")` equals 4.
- [ ] CARD-COWBOY-DEADEYE-13 covered: progress, "deck rules: sixteen cards, only what you own, rarity limits across deck and side deck, four in the side deck": `/You own 4 Deadeye/`.
