# Tasks: Captured Dragon (`cowboy-captured-dragon`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-CAPTURED-DRAGON-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts the numbers and `bounty` equals true. Tag, keys and rarity are not asserted exactly; the progress test "every opponent deck is sixteen Wizard cards, and every reward is a Cowboy card the player does not have yet" asserts the bounty reward is legendary.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-02 unsigned. Assertion to add: with 2 own troops, two summon actions, each with one tribute.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-03 unsigned. Assertion to add: after the summon on turn 4, `canAttack` is true.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-04 unsigned. Assertion to add: Wizard slot 0 null, Skeleton health 2, Wizard Base 5.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-05 unsigned. Assertion to add: Cowboy slot null, Wizard Dragon health 1, Skeleton health 2.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-06 unsigned for this bounty. `prototypes/showdown/progress.test.js`, "a bounty: five hunts, each harder, and the fifth win captures the boss's card" asserts the capture for the Lantern Wraith only.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-07 unsigned. Assertion to add: with 1 owned, a deck holding 2 matches `/You own 1 Captured Dragon/`.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-08 partial: progress, "offers and packs: the same save gives the same cards, never a basic or legendary card, never past the deck limit" asserts no pack card is legendary.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-09 covered: progress, "saves: the first version is carried over, a round trip is exact, and anything untrustworthy starts fresh": `{...save, collection: {...save.collection, "cowboy-captured-dragon": 1}}` migrates to `newSave()`.
- [ ] CARD-COWBOY-CAPTURED-DRAGON-10 unsigned. Assertion to add: `DECKS.cowboy["cowboy-captured-dragon"] === undefined`.
