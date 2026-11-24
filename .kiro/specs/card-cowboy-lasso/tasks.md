# Tasks: Lasso (`cowboy-lasso`)

Status words: **covered**, **partial** and **unsigned** as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session.

- [ ] CARD-COWBOY-LASSO-01 unsigned. `tests/game/card-specs.test.js`, "canonical Showdown values for a sample of cards" pins the Deadeye spell shape, not the Lasso. Assertion to add: `TYPES["cowboy-lasso"]` deep-equals `{side: "cowboy", name: "Lasso", kind: "spell", stars: undefined, attack: undefined, health: undefined, bounty: false, keys: [], rarity: "uncommon", effect: "tie"}`.
- [ ] CARD-COWBOY-LASSO-02 partial: `prototypes/showdown/rules.test.js`, "Ghostly troops cannot be targeted by spells, but Hellfire still burns them": with a Lantern Wraith and a Skeleton, the spell targets are `[1, 1]` (Deadeye and Lasso both skip the Wraith). The already-stunned exclusion is not asserted.
- [ ] CARD-COWBOY-LASSO-03 unsigned. Assertion to add: with an empty Wizard board, no `spell` action for `cowboy-lasso-1`.
- [ ] CARD-COWBOY-LASSO-04 unsigned. Assertion to add: after the cast, `wizard.board[0].stunned === true` and its health equals the value before.
- [ ] CARD-COWBOY-LASSO-05 unsigned. Assertion to add: `cowboy.hand` no longer holds `cowboy-lasso-1` and `cowboy.discard` ends with it.
- [ ] CARD-COWBOY-LASSO-06 covered: rules, "Lasso stuns a troop for its next turn only": after the cast and `end`, `assert.deepEqual(attacks(state), [])`.
- [ ] CARD-COWBOY-LASSO-07 covered: same test, after two more `end` actions, `assert.deepEqual(attacks(state), ["0>0"])`.
- [ ] CARD-COWBOY-LASSO-08 unsigned. Assertion to add: in the Wizard turn after the cast, `legalActions` includes `{type: "cover", slot: 0}`.
- [ ] CARD-COWBOY-LASSO-09 unsigned. Assertion to add: a stunned Wizard at 4 orbs attacked by a Sheriff leaves the Sheriff on 1 orb.
- [ ] CARD-COWBOY-LASSO-10 unsigned. Assertion to add: Bone Wall stunned beside a Skeleton; Cowboy attack targets are only the Bone Wall's slot.
- [ ] CARD-COWBOY-LASSO-11 partial: rules, "gear: a Six-Shooter adds 1 attack, Bone Armor adds 2 orbs, and gear goes to the graveyard with its troop" asserts the shared slot with a Deadeye and a Six-Shooter, not with a Lasso.
- [ ] CARD-COWBOY-LASSO-12 unsigned. Assertion to add: after the cast, a Sheriff in hand still has its summon action.
- [ ] CARD-COWBOY-LASSO-13 unsigned. Assertion to add: `applied.events` deep-equals `[{type: "spell", side: "cowboy", cardId: "cowboy-lasso-1", target: "wizard-wizard-1", left: 4, stunned: true}]`.
- [ ] CARD-COWBOY-LASSO-14 unsigned. Assertion to add: `presentEvent` of that event equals the exact sentence.
- [ ] CARD-COWBOY-LASSO-15 unsigned. Assertion to add: `DECKS.cowboy["cowboy-lasso"] === 1`.
- [ ] CARD-COWBOY-LASSO-16 unsigned. Assertion to add: `settle(saveAt({wins: 2}), "trail", true).earned.cards` includes `["cowboy-lasso", 1]` and the Deadeye count falls by 1.
- [ ] CARD-COWBOY-LASSO-17 partial: `prototypes/showdown/progress.test.js`, "deck rules: sixteen cards, only what you own, rarity limits across deck and side deck, four in the side deck" accepts 3 Lassos in the side deck. A fourth copy is not asserted.
- [ ] Link IDs (unsigned, outside this spec's file scope): cite the IDs in the test titles so `node scripts/trace.mjs --require CARD-COWBOY-LASSO` can prove them.
