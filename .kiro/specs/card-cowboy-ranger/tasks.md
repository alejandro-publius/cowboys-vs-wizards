# Tasks: Ranger (`cowboy-ranger`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-RANGER-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty.
- [ ] CARD-COWBOY-RANGER-02 covered: `prototypes/showdown/rules.test.js`, "Scout draws a card on arrival": `assert.deepEqual(applied.state.sides.cowboy.hand, [top])` and `assert.deepEqual(types(applied.events), ["tribute", "summon", "draw"])`.
- [ ] CARD-COWBOY-RANGER-03 unsigned. Assertion to add: with `cowboy.deck = []`, the events are `["tribute", "summon"]` and `cowboy.base` is unchanged.
- [ ] CARD-COWBOY-RANGER-04 unsigned. Assertion to add: after the summon on turn 4, `canAttack` is true.
- [ ] CARD-COWBOY-RANGER-05 unsigned. Assertion to add: with Sheriff's Office as the location, `attackOf` for the Ranger is 3.
- [ ] CARD-COWBOY-RANGER-06 unsigned. Assertion to add: in a position where the best plan summons the Ranger, `planTurn(state).at(-1)` is that summon action.
- [ ] CARD-COWBOY-RANGER-07 unsigned. Assertion to add: `DECKS.cowboy["cowboy-ranger"] === 1`.
- [ ] CARD-COWBOY-RANGER-08 unsigned. Assertion to add: `settle(saveAt({wins: 2}), "trail", true).earned.cards` includes `["cowboy-ranger", 1]`.
