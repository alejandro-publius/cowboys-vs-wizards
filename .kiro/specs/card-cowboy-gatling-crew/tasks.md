# Tasks: Gatling Crew (`cowboy-gatling-crew`)

Status words: **covered**, **partial** and **unsigned** as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-GATLING-CREW-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty. Tag, keys and rarity have no exact assertion.
- [ ] CARD-COWBOY-GATLING-CREW-02 unsigned. Assertion to add: with 1, 2 and 3 own troops and `cowboy-gatling-crew-1` in hand, the Gatling summon actions number 0, 1 and 3.
- [ ] CARD-COWBOY-GATLING-CREW-03 unsigned. Assertion to add: with troops in slots 0 and 1 paid, the events start `["tribute", "tribute", "summon"]`, both tributes are in `discard` and the Gatling Crew is in slot 0.
- [ ] CARD-COWBOY-GATLING-CREW-04 unsigned. The rules test "free troops rest on arrival, tribute troops strike at once, and nothing is played after an attack" asserts this for Billy (1 tribute) only.
- [ ] CARD-COWBOY-GATLING-CREW-05 unsigned for this card. Rules, "Sweep: every other enemy troop loses an orb when it attacks a troop" asserts the same rule with the Wizard Dragon: `[null, 3, null]` and Cowboy Base 5.
- [ ] CARD-COWBOY-GATLING-CREW-06 unsigned. Assertion to add: Gatling attacks one of three Wizard troops; one `sweep` event with `count: 2`.
- [ ] CARD-COWBOY-GATLING-CREW-07 unsigned. Assertion to add: `troop("cowboy-gatling-crew", 3)` attacks `troop("wizard-dragon")` beside `troop("wizard-skeleton")`; Cowboy slot null, Skeleton health 2, events include `sweep`.
- [ ] CARD-COWBOY-GATLING-CREW-08 unsigned. Assertion to add: Gatling attacks a full Skeleton beside two 1-orb troops; Wizard Base 4.
- [ ] CARD-COWBOY-GATLING-CREW-09 unsigned for this card. Rules, "Guard: enemies must attack it first, and a rider cannot pass it" asserts the Guard target rule with Billy and Outrider.
- [ ] CARD-COWBOY-GATLING-CREW-10 unsigned. Assertion to add: after the Bone Wall attack, the Skeleton's health is 2.
- [ ] CARD-COWBOY-GATLING-CREW-11 unsigned. Assertion to add: Gatling attacks a Skeleton beside `troop("wizard-jack-o-lantern")`; no `laststand` event and the Gatling Crew's health is 4.
- [ ] CARD-COWBOY-GATLING-CREW-12 unsigned. Assertion to add: Gatling attacks a Skeleton beside `troop("wizard-lantern-wraith")`; the Wraith's health is 3.
- [ ] CARD-COWBOY-GATLING-CREW-13 unsigned. Assertion to add: with `wizard.traps = ["wizard-hex-1"]`, events are `["trap"]` and every Wizard troop keeps its orbs.
- [ ] CARD-COWBOY-GATLING-CREW-14 unsigned. Assertion to add: Wizard to act, a Skeleton attacks the Gatling Crew beside other Cowboy troops; no `sweep` event and the other Wizard troops keep their orbs.
- [ ] CARD-COWBOY-GATLING-CREW-15 unsigned. Assertion to add: `attackOutcome(state, slot, target)` leaves `state` deep-equal to a clone taken before the call and reports the fight only.
- [ ] CARD-COWBOY-GATLING-CREW-16 unsigned. Assertion to add: `presentEvent({type: "sweep", side: "cowboy", cardId: "cowboy-gatling-crew-1", count: 2})` equals the exact sentence.
- [ ] CARD-COWBOY-GATLING-CREW-17 unsigned. Assertion to add: `DECKS.cowboy["cowboy-gatling-crew"] === undefined`.
- [ ] CARD-COWBOY-GATLING-CREW-18 unsigned. Assertion to add: `settle(saveAt({wins: 5}), "trail", true).earned.cards` deep-equals `[["cowboy-gatling-crew", 1]]` and the Billy count falls by 1.
- [ ] CARD-COWBOY-GATLING-CREW-19 unsigned. Assertion to add: a deck of 2 plus a side deck of 1 Gatling Crew returns a problem.
- [ ] CARD-COWBOY-GATLING-CREW-20 covered: `prototypes/showdown/progress.test.js`, "saves: the first version is carried over, a round trip is exact, and anything untrustworthy starts fresh": the bad-save list includes `deck: {..., "cowboy-gatling-crew": 4}` and `collection: {..., "cowboy-gatling-crew": 9}`, each `migrate`d to `newSave()`.
- [ ] Link IDs (unsigned, outside this spec's file scope): cite the IDs in the test titles so `node scripts/trace.mjs --require CARD-COWBOY-GATLING-CREW` can prove them.
