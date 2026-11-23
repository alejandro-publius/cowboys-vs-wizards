# Tasks: Captured Wraith (`cowboy-captured-wraith`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-CAPTURED-WRAITH-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts the numbers and `bounty`. Tag, keys and rarity are not asserted exactly.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-02 unsigned. Assertion to add: summon actions deep-equal `[{type: "summon", cardId: "cowboy-captured-wraith-1", tributes: []}]`.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-03 unsigned. Assertion to add: after the summon, `canAttack` is false.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-04 unsigned for this card. `prototypes/showdown/rules.test.js`, "Ghostly troops cannot be targeted by spells, but Hellfire still burns them" asserts the rule for the Wizard Lantern Wraith against Cowboy spells.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-05 covered: same test, after Hellfire the Cowboy board health list is `[1, null, null]` with the Captured Wraith in slot 0.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-06 unsigned. Assertion to add: with `location = {cardId: "wizard-boneyard-1", side: "wizard"}`, `attackOf` for the Captured Wraith is 3.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-07 unsigned. Assertion to add: with `wizard.traps = ["wizard-hex-1"]`, the events are `["trap"]` and the target's orbs are unchanged.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-08 covered: `prototypes/showdown/progress.test.js`, "a bounty: five hunts, each harder, and the fifth win captures the boss's card": `done.earned.captured` is `cowboy-captured-wraith` on hunt 5 and `owned(save, "cowboy-captured-wraith")` is 1.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-09 unsigned. Assertion to add: a deck of 1 plus a side deck of 1 returns a problem.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-10 partial: progress, "offers and packs: the same save gives the same cards, never a basic or legendary card, never past the deck limit" asserts no pack card is legendary.
- [ ] CARD-COWBOY-CAPTURED-WRAITH-11 unsigned. Assertion to add: `DECKS.cowboy["cowboy-captured-wraith"] === undefined`.
