# Tasks: Sheriff (`cowboy-sheriff`)

Status words: **covered** means an existing named test asserts the behaviour; **partial** means it asserts part of it; **unsigned** means no test asserts it and no owner is assigned. No test title cites these IDs yet, so `scripts/trace.mjs` lists them all as orphans. No test was run for this spec in this session.

Test files: `prototypes/showdown/rules.test.js` (rules), `prototypes/showdown/progress.test.js` (progress), `tests/game/card-specs.test.js` (card specs), `tests/game/showdown-presenter.test.js` (presenter).

- [ ] CARD-COWBOY-SHERIFF-01 covered: card specs, "canonical Showdown values for a sample of cards": `assert.deepEqual(TYPES["cowboy-sheriff"], {side: "cowboy", name: "Sheriff", kind: "troop", stars: 2, attack: 1, health: 3, bounty: false, keys: [], rarity: "basic", tag: "Lawman"})`.
- [ ] CARD-COWBOY-SHERIFF-02 unsigned. Assertion to add: with a free slot and `cowboy-sheriff-2` in hand, `legalActions(state).filter(a => a.type === "summon")` deep-equals `[{type: "summon", cardId: "cowboy-sheriff-2", tributes: []}]`.
- [ ] CARD-COWBOY-SHERIFF-03 unsigned. Assertion to add: three Sheriffs on board and one in hand gives no `summon` action.
- [ ] CARD-COWBOY-SHERIFF-04 partial: rules, "free troops rest on arrival, tribute troops strike at once, and nothing is played after an attack": `assert.equal(canAttack(withSheriff, withSheriff.sides.cowboy.board[1]), false)`. The next-turn half is not asserted.
- [ ] CARD-COWBOY-SHERIFF-05 covered: rules, "a target that survives hits back, and neither Base is touched": Wizard health 3, Sheriff health 1, Bases `[5, 5]`.
- [ ] CARD-COWBOY-SHERIFF-06 partial: rules, "locations: one for the whole table, it adds attack by type tag, and a new one replaces it": `[2, 2, null]` for Sheriff and Billy under the Office. Only the Cowboy side is asserted.
- [ ] CARD-COWBOY-SHERIFF-07 covered: rules, "gear: a Six-Shooter adds 1 attack, Bone Armor adds 2 orbs, and gear goes to the graveyard with its troop": `assert.equal(attackOf(armed, armed.sides.cowboy.board[0]), 2)`.
- [ ] CARD-COWBOY-SHERIFF-08 partial: rules, "Scout draws a card on arrival": a Sheriff pays for the Ranger and `types(applied.events)` is `["tribute", "summon", "draw"]`. The discard contents are not asserted.
- [ ] CARD-COWBOY-SHERIFF-09 unsigned. Assertion to add: `presentEvent({type: "tribute", side: "cowboy", cardId: "cowboy-sheriff-1"})` equals the exact sentence.
- [ ] CARD-COWBOY-SHERIFF-10 unsigned. Assertion to add: `DECKS.cowboy["cowboy-sheriff"] === 4`. The card-table test checks only the 16-card total.
- [ ] CARD-COWBOY-SHERIFF-11 unsigned. Assertion to add: `STARTER["cowboy-sheriff"] === 8`.
- [ ] CARD-COWBOY-SHERIFF-12 unsigned. Assertion to add: `deckAfter(6)["cowboy-sheriff"] === 3`. The progress test checks only that each `deckAfter` totals 16.
- [ ] CARD-COWBOY-SHERIFF-13 covered: progress, "a Trail win pays its card into the deck and offers a choice of two cards the player has met": a deck with 1 Sheriff becomes `{"cowboy-billy": 12, "cowboy-deadeye": 3, "cowboy-covered-wagon": 1}`.
- [ ] CARD-COWBOY-SHERIFF-14 partial: progress, "deck rules: sixteen cards, only what you own, rarity limits across deck and side deck, four in the side deck": a deck with 9 Sheriffs and no Sheriff in the collection has no problems. `owned(...) === Infinity` is not asserted.
- [ ] CARD-COWBOY-SHERIFF-15 partial: progress, "offers and packs: the same save gives the same cards, never a basic or legendary card, never past the deck limit": asserts pack cards are never basic. Offers are not checked card by card.
- [ ] CARD-COWBOY-SHERIFF-16 unsigned. Assertion to add: `migrate({...save, collection: {...save.collection, "cowboy-sheriff": 1}})` deep-equals `newSave()`.
- [ ] Link IDs (unsigned, outside this spec's file scope): put the CARD-COWBOY-SHERIFF IDs into the titles of the tests above so `node scripts/trace.mjs --require CARD-COWBOY-SHERIFF` can prove them.
