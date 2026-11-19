import assert from "node:assert/strict";
import test from "node:test";
import { CARDS, DECKS } from "../../src/game/cards.js";
import { resolveClash } from "../../src/game/clash.js";
import { deckIds } from "../../src/game/deck-builder.js";
import { IMP_DECK, WAGON_TRAIN } from "../../src/game/deck-presets.js";
import { createMatch } from "../../src/game/state.js";

test("the Imp is one registered free troop outside the default Wizard deck", () => {
  const { id, side, kind, stars, health, attack } = CARDS["wizard-imp-1"];
  assert.deepEqual({ id, side, kind, stars, health, attack }, {
    id: "wizard-imp-1", side: "wizard", kind: "troop", stars: 2, health: 1, attack: 3,
  });
  assert.equal(CARDS["wizard-imp-2"], undefined);
  assert.equal(DECKS.wizard.length, 12);
  assert.ok(!DECKS.wizard.includes("wizard-imp-1"));
});

test("the Imp list is the canonical 12 cards in catalog order", () => {
  assert.deepEqual(IMP_DECK, [
    ...[1, 2, 3, 4, 5, 6].map((n) => `wizard-skeleton-${n}`),
    "wizard-wizard-1", "wizard-wizard-2", "wizard-dragon-1",
    "wizard-singularity-1", "wizard-singularity-2", "wizard-imp-1",
  ]);
  assert.equal(new Set(IMP_DECK).size, 12);
});

test("seed 4671 deals the authored Wagon Train and Imp opening", () => {
  const options = { cowboyDeck: deckIds(WAGON_TRAIN.counts, { bountyReward: true }), wizardDeck: IMP_DECK };
  const a = createMatch(4671, options);
  const b = createMatch(4671, options);
  assert.deepEqual(a, b);
  assert.equal(a.startingSide, "cowboy");
  const hand = (side) => a.sides[side].hand.map((id) => CARDS[id].name);
  assert.deepEqual(hand("cowboy"), ["Billy", "Sheriff", "Sheriff", "Sheriff"]);
  assert.deepEqual(hand("wizard"), ["Skeleton", "Skeleton", "Dragon", "Skeleton"]);
});

test("an Imp threatens three Base orbs and trades into Wagon Train blockers as authored", () => {
  for (const [cardId, cowboyBase, cowboyHealth] of [
    [null, 2, null],
    ["cowboy-covered-wagon-1", 5, 1],
    ["cowboy-sheriff-1", 5, null],
    ["cowboy-gatling-crew-1", 5, 1],
  ]) {
    const state = createMatch(0);
    const { sides } = state;
    sides.wizard.board[2] = { cardId: "wizard-imp-1", health: 1 };
    if (cardId) sides.cowboy.board[2] = { cardId, health: CARDS[cardId].health };
    resolveClash(state, () => {});
    assert.equal(sides.cowboy.baseOrbs, cowboyBase);
    assert.equal(sides.cowboy.board[2]?.health ?? null, cowboyHealth);
    assert.equal(sides.wizard.board[2]?.cardId ?? null, cardId ? null : "wizard-imp-1");
  }
});

test("a default match is unchanged by registering the Imp", () => {
  const match = createMatch(0);
  assert.deepEqual([...match.sides.wizard.hand, ...match.sides.wizard.deck].sort(), [...DECKS.wizard].sort());
});
