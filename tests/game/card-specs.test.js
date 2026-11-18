import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { CARDS, DECKS, SIDES, tributeCost } from "../../src/game/cards.js";
import { CARD_SPECS } from "../../src/game/card-specs.generated.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";

// The JSON specs are the source of truth; the tests compare the engine to them.
const specDir = new URL("../../.kiro/specs/duel-card-pipeline/cards/", import.meta.url);
const specs = readdirSync(specDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(new URL(name, specDir), "utf8")));
const sideSpecs = (side) => specs.filter((spec) => spec.side === side).sort((a, b) => a.order - b.order);
const idOf = (spec, copy) => `${spec.type}-${copy}`;

test("generated card list matches the JSON specs in deck order", () => {
  assert.deepEqual(CARD_SPECS, SIDES.flatMap(sideSpecs));
});

test("registry holds available copies; default decks retain each spec's copies and order", () => {
  const expectedRegistry = [];
  for (const side of SIDES) {
    const expectedDeck = [];
    for (const { type, order, copies, ...fields } of sideSpecs(side)) {
      const availableCopies = fields.bounty ? 1 : side === "cowboy" ? 6 : copies;
      for (let copy = 1; copy <= availableCopies; copy++) {
        const id = idOf({ type }, copy);
        expectedRegistry.push(id);
        if (copy <= copies) expectedDeck.push(id);
        assert.deepEqual(CARDS[id], { id, ...fields });
        assert.ok(Object.isFrozen(CARDS[id]), `${id} is frozen`);
      }
    }
    assert.equal(expectedDeck.length, 12);
    assert.deepEqual(DECKS[side], expectedDeck);
    assert.ok(Object.isFrozen(DECKS[side]));
  }
  assert.equal(expectedRegistry.length, 37);
  assert.deepEqual(Object.keys(CARDS).sort(), expectedRegistry.sort());
  assert.ok(Object.isFrozen(CARDS) && Object.isFrozen(DECKS));
});

test("each side's first free troop spec can be summoned from hand", () => {
  for (const side of SIDES) {
    const spec = sideSpecs(side).find((item) => item.kind === "troop" && tributeCost(item.stars) === 0);
    const cardId = idOf(spec, 1);
    const state = createMatch(1);
    state.activeSide = side;
    state.sides[side].hand = [cardId];
    state.sides[side].deck = DECKS[side].filter((id) => id !== cardId);
    state.sides[side].board = [null, null, null];

    const result = applyAction(state, { type: "summon", side, revision: state.revision, cardId, slot: 0, tributes: [] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.sides[side].board[0], { cardId, health: spec.health });
    assert.deepEqual(result.state.sides[side].hand, []);
  }
});
