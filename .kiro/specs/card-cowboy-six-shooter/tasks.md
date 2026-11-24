# Tasks: Six-Shooter (`cowboy-six-shooter`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`; progress test file: `prototypes/showdown/progress.test.js`.

- [ ] CARD-COWBOY-SIX-SHOOTER-01 partial: `tests/game/card-specs.test.js`, "Showdown has exactly 29 catalog cards: the lane cards in lane order, then the Showdown-only ones" asserts it is Showdown-only and `fresh`.
- [ ] CARD-COWBOY-SIX-SHOOTER-02 unsigned. Assertion to add: with troops in slots 0 and 2, gear actions are for slots 0 and 2; with an empty board, none.
- [ ] CARD-COWBOY-SIX-SHOOTER-03 covered: rules, "gear: a Six-Shooter adds 1 attack, Bone Armor adds 2 orbs, and gear goes to the graveyard with its troop": `attackOf` is 2 for the armed Sheriff, and its attack leaves the Skeleton on 1.
- [ ] CARD-COWBOY-SIX-SHOOTER-04 covered: same test, "gear uses the turn's one other card".
- [ ] CARD-COWBOY-SIX-SHOOTER-05 unsigned. Assertion to add: a Sheriff with `gear: ["cowboy-six-shooter-1", "cowboy-six-shooter-2"]` has `attackOf` 3.
- [ ] CARD-COWBOY-SIX-SHOOTER-06 covered: same gear test, `cowboy.discard` deep-equals `["cowboy-sheriff-1", "cowboy-six-shooter-1"]`.
- [ ] CARD-COWBOY-SIX-SHOOTER-07 unsigned. Assertion to add: an armed Sheriff paid for a Billy; the discard holds both ids.
- [ ] CARD-COWBOY-SIX-SHOOTER-08 unsigned. Assertion to add: Wizard to act, Skeleton attacks the armed Sheriff; Skeleton health 1, Sheriff health 2.
- [ ] CARD-COWBOY-SIX-SHOOTER-09 unsigned. Assertion to add: armed Mounted Billy rides past a Skeleton; Wizard Base 4.
- [ ] CARD-COWBOY-SIX-SHOOTER-10 unsigned. Assertion to add: `presentEvent({type: "gear", side: "cowboy", cardId: "cowboy-six-shooter-1", target: "cowboy-sheriff-1"})` equals the exact sentence.
- [ ] CARD-COWBOY-SIX-SHOOTER-11 covered: progress, "the Trail's end pays a pack and opens the rivals in order, the bounties and the even match": `beaten.earned` deep-equals `{cards: [["cowboy-six-shooter", 1]], packs: 1, captured: null}`.
- [ ] CARD-COWBOY-SIX-SHOOTER-12 partial: progress, "a rival's own reward cannot be earned before that rival is beaten, and never goes past its limit": thirty packs before any rival hold no Six-Shooter. Offers share `pool()` but are not asserted.
- [ ] CARD-COWBOY-SIX-SHOOTER-13 unsigned. Assertion to add: `DECKS.cowboy["cowboy-six-shooter"] === undefined`.
- [ ] CARD-COWBOY-SIX-SHOOTER-14 unsigned. Assertion to add: a deck of 3 plus a side deck of 1 returns a problem.
