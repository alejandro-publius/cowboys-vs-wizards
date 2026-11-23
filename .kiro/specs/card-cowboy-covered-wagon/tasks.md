# Tasks: Covered Wagon (`cowboy-covered-wagon`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`.

- [ ] CARD-COWBOY-COVERED-WAGON-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty.
- [ ] CARD-COWBOY-COVERED-WAGON-02 unsigned. Assertion to add: summon actions for `cowboy-covered-wagon-1` deep-equal `[{type: "summon", cardId: "cowboy-covered-wagon-1", tributes: []}]`.
- [ ] CARD-COWBOY-COVERED-WAGON-03 unsigned for this card. Rules, "Guard: enemies must attack it first, and a rider cannot pass it" asserts the rule with the Wizards' Bone Wall.
- [ ] CARD-COWBOY-COVERED-WAGON-04 unsigned. Assertion to add: Wizard to act, `troop("wizard-headless-horseman")` against a Wagon and a Sheriff; attacks are only `"0>0"` for the Wagon's slot.
- [ ] CARD-COWBOY-COVERED-WAGON-05 unsigned. Assertion to add: Dragon attacks a Wagon beside a Sheriff; the Sheriff's health is 2.
- [ ] CARD-COWBOY-COVERED-WAGON-06 covered: rules, "cover: no damage reaches the Base and the troop does not hit back, until its owner's next turn": `assert.equal(attackOutcome(sturdy, 0, 0).attackerLeft, 3)`.
- [ ] CARD-COWBOY-COVERED-WAGON-07 covered: same test, `act(sturdy, {type: "end"}).sides.cowboy.board[0].cover` equals false.
- [ ] CARD-COWBOY-COVERED-WAGON-08 unsigned. Assertion to add: `DECKS.cowboy["cowboy-covered-wagon"] === 2`.
- [ ] CARD-COWBOY-COVERED-WAGON-09 covered: `prototypes/showdown/progress.test.js`, "a Trail win pays its card into the deck and offers a choice of two cards the player has met": `earned` deep-equals `{cards: [["cowboy-covered-wagon", 2]], packs: 0, captured: null}` and `owned(save, "cowboy-covered-wagon")` equals 2.
- [ ] CARD-COWBOY-COVERED-WAGON-10 covered: progress, "deck rules: sixteen cards, only what you own, rarity limits across deck and side deck, four in the side deck": `/You own 2 Covered Wagon/`.
