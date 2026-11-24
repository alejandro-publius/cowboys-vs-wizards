# Tasks: Dynamiter (`cowboy-dynamiter`)

Status words: **covered**, **partial** and **unsigned** as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-DYNAMITER-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty against the lane row. Tag, keys and rarity have no exact assertion.
- [ ] CARD-COWBOY-DYNAMITER-02 unsigned. Assertion to add: summon actions for `cowboy-dynamiter-1` deep-equal `[{type: "summon", cardId: "cowboy-dynamiter-1", tributes: []}]`.
- [ ] CARD-COWBOY-DYNAMITER-03 unsigned. Assertion to add: after that summon, `canAttack(state, board[slot])` is false.
- [ ] CARD-COWBOY-DYNAMITER-04 covered: `prototypes/showdown/rules.test.js`, "Last Stand: the defeated troop takes an orb off the troop that fought it, attacking or defending": `assert.deepEqual([attacking.sides.cowboy.board[0], attacking.sides.wizard.board[0]], [null, null])`.
- [ ] CARD-COWBOY-DYNAMITER-05 unsigned. Assertion to add: Dynamiter attacks `troop("wizard-skeleton")`; Wizard slot 0 is null and the Dynamiter's health is 1.
- [ ] CARD-COWBOY-DYNAMITER-06 unsigned. Assertion to add: Wizard to act, Skeleton attacks the Dynamiter; Cowboy slot 0 is null and the Skeleton's health is 2.
- [ ] CARD-COWBOY-DYNAMITER-07 unsigned. Assertion to add: Imp attacks the Dynamiter; both slots null, `sides.cowboy.base === 3`.
- [ ] CARD-COWBOY-DYNAMITER-08 unsigned. Assertion to add: `troop("cowboy-dynamiter", 1, {cover: true})` attacked by a Wizard; Cowboy slot null, Wizard health 3, `sides.cowboy.base === 5`.
- [ ] CARD-COWBOY-DYNAMITER-09 unsigned. Assertion to add: Dynamiter attacks `troop("wizard-jack-o-lantern")`; both slots null and `events.filter(e => e.type === "laststand")` has one entry with `cardId` `wizard-jack-o-lantern-1`.
- [ ] CARD-COWBOY-DYNAMITER-10 unsigned. Assertion to add: Wizard casts `wizard-singularity-1` at the Dynamiter, then (separate position) `wizard-hellfire-1`; neither event list contains `laststand`.
- [ ] CARD-COWBOY-DYNAMITER-11 unsigned. Assertion to add: Dragon attacks a Sheriff beside a Dynamiter; no `laststand` event and the Dragon's health is unchanged by the sweep.
- [ ] CARD-COWBOY-DYNAMITER-12 unsigned. Assertion to add: Billy summoned with the Dynamiter as tribute; events are `["tribute", "summon"]`.
- [ ] CARD-COWBOY-DYNAMITER-13 unsigned. The Hex case in rules, "a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first" uses Billy; the same assertion with a Dynamiter is not written.
- [ ] CARD-COWBOY-DYNAMITER-14 unsigned. Assertion to add: `presentEvent({type: "laststand", side: "cowboy", cardId: "cowboy-dynamiter-1", target: "wizard-wizard-1", left: 0})` equals the exact sentence.
- [ ] CARD-COWBOY-DYNAMITER-15 unsigned. Assertion to add: `DECKS.cowboy["cowboy-dynamiter"] === 1`.
- [ ] CARD-COWBOY-DYNAMITER-16 unsigned. Assertion to add: `settle(saveAt({wins: 3}), "trail", true).earned.cards` includes `["cowboy-dynamiter", 1]` and the Sheriff count falls by 1.
- [ ] CARD-COWBOY-DYNAMITER-17 unsigned. Assertion to add: with 4 owned, a deck of 3 plus a side deck of 1 Dynamiter matches `/Dynamiter is Uncommon: at most 3/`.
- [ ] Link IDs (unsigned, outside this spec's file scope): cite the IDs in the test titles so `node scripts/trace.mjs --require CARD-COWBOY-DYNAMITER` can prove them.
