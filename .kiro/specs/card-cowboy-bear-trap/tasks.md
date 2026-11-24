# Tasks: Bear Trap (`cowboy-bear-trap`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`.

- [ ] CARD-COWBOY-BEAR-TRAP-01 partial: `tests/game/card-specs.test.js`, "Showdown has exactly 29 catalog cards: the lane cards in lane order, then the Showdown-only ones" asserts it is Showdown-only and `fresh`. Effect and rarity are not asserted exactly.
- [ ] CARD-COWBOY-BEAR-TRAP-02 partial: rules, "setting a trap: one a turn, two face down at most, and the bot plans without seeing them": the first set gives `traps` `["cowboy-bear-trap-1"]`.
- [ ] CARD-COWBOY-BEAR-TRAP-03 covered: same test, with two traps face down no `set` action.
- [ ] CARD-COWBOY-BEAR-TRAP-04 covered: same test, `assert.ok(!legalActions(set).some((a) => a.type === "set"))`.
- [ ] CARD-COWBOY-BEAR-TRAP-05 unsigned. Assertion to add: the `set` event deep-equals `{type: "set", side: "cowboy"}`.
- [ ] CARD-COWBOY-BEAR-TRAP-06 partial: `prototypes/showdown/contract.test.js`, "a side's view names its own hand and traps and nothing hidden of the other side's" asserts the opponent's `trapCount` equals the real trap count over every duel the test plays. Whether a Bear Trap is face down in those duels, and the absence of the `traps` key, are not asserted in a Bear Trap case.
- [ ] CARD-COWBOY-BEAR-TRAP-07 partial: rules, "a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first": the Wizard survives on 2 orbs and its attack lands. The Cowboy discard is not asserted.
- [ ] CARD-COWBOY-BEAR-TRAP-08 covered: same test, the Imp's slot is null and the Sheriff keeps 3 orbs.
- [ ] CARD-COWBOY-BEAR-TRAP-09 covered: same test, Wizard health 1 and Sheriff health 1 after the attack.
- [ ] CARD-COWBOY-BEAR-TRAP-10 unsigned. Assertion to add: with `cowboy.traps = ["cowboy-bear-trap-1", "cowboy-bear-trap-2"]`, one attack leaves `["cowboy-bear-trap-2"]`.
- [ ] CARD-COWBOY-BEAR-TRAP-11 unsigned. Assertion to add: a Skeleton at 2 orbs carrying `wizard-bone-armor-1` attacks; the Wizard discard holds both ids.
- [ ] CARD-COWBOY-BEAR-TRAP-12 unsigned. Assertion to add: an attacking `troop("wizard-jack-o-lantern")` is defeated with no `laststand` event.
- [ ] CARD-COWBOY-BEAR-TRAP-13 unsigned. Assertion to add: Horseman ride-past; Horseman health 1, Cowboy Base 4.
- [ ] CARD-COWBOY-BEAR-TRAP-14 unsigned. Assertion to add: `presentEvent` of the Imp `trap` event equals the exact sentence.
- [ ] CARD-COWBOY-BEAR-TRAP-15 unsigned. Assertion to add: `DECKS.cowboy["cowboy-bear-trap"] === 1`.
- [ ] CARD-COWBOY-BEAR-TRAP-16 unsigned. Assertion to add: `settle(saveAt({wins: 3}), "trail", true).earned.cards` includes `["cowboy-bear-trap", 1]`.
- [ ] CARD-COWBOY-BEAR-TRAP-17 unsigned. Assertion to add: a deck of 3 plus a side deck of 1 returns a problem.
