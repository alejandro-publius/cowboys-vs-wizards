# Tasks: Billy (`cowboy-billy`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`.

- [ ] CARD-COWBOY-BILLY-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty. Tag, keys and rarity have no exact assertion.
- [ ] CARD-COWBOY-BILLY-02 unsigned. Assertion to add: with 0, 1 and 3 own troops, the Billy summon actions number 0, 1 and 3.
- [ ] CARD-COWBOY-BILLY-03 covered: rules, "free troops rest on arrival, tribute troops strike at once, and nothing is played after an attack": `assert.equal(canAttack(withBilly, withBilly.sides.cowboy.board[0]), true)`.
- [ ] CARD-COWBOY-BILLY-04 covered: rules, "a Base can be struck directly only when its side has no troops": `act(open, {type: "attack", slot: 0, target: "base"}).sides.wizard.base` equals 3.
- [ ] CARD-COWBOY-BILLY-05 unsigned. Assertion to add: Billy attacks a full Skeleton; Skeleton health 1, Billy health 3.
- [ ] CARD-COWBOY-BILLY-06 covered: rules, "Last Stand: the defeated troop takes an orb off the troop that fought it, attacking or defending": `assert.equal(defending.sides.cowboy.board[0].health, 3)`.
- [ ] CARD-COWBOY-BILLY-07 covered: rules, "locations: one for the whole table, it adds attack by type tag, and a new one replaces it": `[2, 2, null]`, "the Lawman gains, the Outlaw does not".
- [ ] CARD-COWBOY-BILLY-08 covered: rules, "a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first": events `["trap"]`, Skeleton health 3, traps `[]`, discard `["wizard-hex-1"]`.
- [ ] CARD-COWBOY-BILLY-09 unsigned. Assertion to add: `DECKS.cowboy["cowboy-billy"] === 2`.
- [ ] CARD-COWBOY-BILLY-10 unsigned. Assertion to add: `STARTER["cowboy-billy"] === 5`.
- [ ] CARD-COWBOY-BILLY-11 unsigned. Assertion to add: `deckAfter(6)["cowboy-billy"] === 2`.
- [ ] CARD-COWBOY-BILLY-12 partial: `prototypes/showdown/progress.test.js`, "offers and packs: the same save gives the same cards, never a basic or legendary card, never past the deck limit" asserts no pack card is basic.
