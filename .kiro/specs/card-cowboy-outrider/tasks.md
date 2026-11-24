# Tasks: Outrider (`cowboy-outrider`)

Status words: **covered**, **partial** and **unsigned** as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-OUTRIDER-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty. Tag, keys and rarity have no exact assertion.
- [ ] CARD-COWBOY-OUTRIDER-02 unsigned. Assertion to add: summon actions for `cowboy-outrider-1` deep-equal `[{type: "summon", cardId: "cowboy-outrider-1", tributes: []}]`.
- [ ] CARD-COWBOY-OUTRIDER-03 unsigned. Assertion to add: after the summon, `canAttack` is false and no `attack` action names its slot.
- [ ] CARD-COWBOY-OUTRIDER-04 unsigned for this card. `prototypes/showdown/rules.test.js`, "Ride: a rider may pass standing troops to strike the Base for one orb" asserts `["0>0", "0>base", "1>0"]` with Mounted Billy as the rider.
- [ ] CARD-COWBOY-OUTRIDER-05 covered: rules, "Guard: enemies must attack it first, and a rider cannot pass it": Billy in slot 0 and Outrider in slot 1 against a Skeleton and a Bone Wall give `["0>1", "1>1"]`.
- [ ] CARD-COWBOY-OUTRIDER-06 unsigned for this card. The Ride test asserts Wizard Base 4 after Mounted Billy (3 attack) rides past.
- [ ] CARD-COWBOY-OUTRIDER-07 unsigned. Assertion to add: after the ride-past both boards' health lists equal the lists before it.
- [ ] CARD-COWBOY-OUTRIDER-08 unsigned. Assertion to add: Outrider against an empty board; `attacks` is `["0>base"]` and the Wizard Base falls by 1.
- [ ] CARD-COWBOY-OUTRIDER-09 unsigned. Assertion to add: with `location = {cardId: "cowboy-sheriffs-office-1", side: "cowboy"}`, `attackOf` is 2.
- [ ] CARD-COWBOY-OUTRIDER-10 unsigned. Assertion to add: in that position with a Skeleton standing, the ride-past leaves the Wizard Base on 4.
- [ ] CARD-COWBOY-OUTRIDER-11 unsigned. Assertion to add: with `wizard.traps = ["wizard-hex-1"]`, the ride-past events are `["trap"]`, the Wizard Base is 5 and no further `attack` action names the Outrider.
- [ ] CARD-COWBOY-OUTRIDER-12 unsigned. Assertion to add: Wizard Base 1, ride-past, `state.result` deep-equals `{winner: "cowboy", reason: "base"}`.
- [ ] CARD-COWBOY-OUTRIDER-13 unsigned. Assertion to add: the `attack` event fields match the clause.
- [ ] CARD-COWBOY-OUTRIDER-14 unsigned. `tests/game/showdown-presenter.test.js`, "hand-built events of each type read with card and side names" asserts `/struck the Wizards' Base for 2/` with a dealt card, not with the Outrider.
- [ ] CARD-COWBOY-OUTRIDER-15 unsigned. Assertion to add: `DECKS.cowboy["cowboy-outrider"] === 2`.
- [ ] CARD-COWBOY-OUTRIDER-16 unsigned. Assertion to add: `settle(saveAt({wins: 1}), "trail", true).earned.cards` deep-equals `[["cowboy-outrider", 2]]` and the Sheriff count falls by 2.
- [ ] CARD-COWBOY-OUTRIDER-17 unsigned. Assertion to add: with 5 owned, a deck of 4 plus a side deck of 1 Outrider returns a problem.
- [ ] Link IDs (unsigned, outside this spec's file scope): cite the IDs in the test titles so `node scripts/trace.mjs --require CARD-COWBOY-OUTRIDER` can prove them.
