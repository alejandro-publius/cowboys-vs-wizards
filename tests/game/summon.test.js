import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES, tributeCost } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";

// Every card instance is in exactly one of deck, hand, board or discard,
// and only in its own side's zones.
function assertConservation(state) {
  const seen = [];
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const ids = [...deck, ...hand, ...discard, ...board.filter(Boolean).map((troop) => troop.cardId)];
    for (const id of ids) assert.equal(CARDS[id]?.side, side, `${id} is in a ${side} zone`);
    seen.push(...ids);
  }
  assert.deepEqual(seen.sort(), Object.keys(CARDS).sort());
}

// Valid mid-match cowboy position: the named cards on the board (null = empty
// slot) and in hand, every other cowboy card left in the deck.
function cowboyFixture({ board, hand }) {
  const state = createMatch(1);
  const placed = new Set([...board, ...hand]);
  state.activeSide = "cowboy";
  state.sides.cowboy = {
    baseOrbs: 5,
    deck: DECKS.cowboy.filter((id) => !placed.has(id)),
    hand: [...hand],
    board: board.map((id) => (id ? { cardId: id, health: CARDS[id].health } : null)),
    discard: [],
  };
  assertConservation(state);
  return state;
}

// First hand card that is a troop needing no tribute (spells have no stars).
const freeTroop = (hand) => hand.find((id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0);

const fullBoard = ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-sheriff-3"];
const summon = (state, fields) => ({ type: "summon", side: "cowboy", revision: state.revision, tributes: [], ...fields });

// The rejection must leave the input object exactly as it was.
function assertRejected(state, action, reason) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.state, state);
  assert.deepEqual(state, before);
}

test("tribute cost by stars", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(tributeCost), [0, 0, 0, 0, 1, 1, 2, 2]);
});

test("seeded setup: 12 unique cards per side, four in hand, three slots, five orbs", () => {
  const state = createMatch(42);
  for (const side of SIDES) {
    const { baseOrbs, deck, hand, board, discard } = state.sides[side];
    assert.equal(new Set([...deck, ...hand]).size, 12);
    assert.equal(hand.length, 4);
    assert.equal(deck.length, 8);
    assert.deepEqual(board, [null, null, null]);
    assert.deepEqual(discard, []);
    assert.equal(baseOrbs, 5);
  }
  assert.ok(SIDES.includes(state.activeSide));
  assert.equal(state.summonUsed, false);
  assertConservation(state);
});

test("seed replay: same seed and actions give identical states", () => {
  assert.deepEqual(createMatch(42), createMatch(42));
  assert.notDeepEqual(createMatch(42).sides, createMatch(43).sides);

  const starts = new Set();
  for (let seed = 0; seed < 20; seed++) starts.add(createMatch(seed).activeSide);
  assert.equal(starts.size, 2, "starting side depends on the seed");

  const play = (seed) => {
    const state = createMatch(seed);
    const side = state.activeSide;
    const cardId = freeTroop(state.sides[side].hand);
    return applyAction(state, { type: "summon", side, revision: 0, cardId, slot: 1, tributes: [] });
  };
  const first = play(42);
  assert.equal(first.ok, true);
  assert.deepEqual(first, play(42));
});

test("full-board sacrifice: a tribute summon reuses the slot it vacates", () => {
  const state = cowboyFixture({ board: fullBoard, hand: ["cowboy-billy-1", "cowboy-mounted-billy-1"] });
  const before = structuredClone(state);

  const one = applyAction(state, summon(state, { cardId: "cowboy-billy-1", slot: 1, tributes: [1] }));
  assert.equal(one.ok, true);
  assert.deepEqual(state, before, "accepted actions return a new state");
  assert.deepEqual(one.state.sides.cowboy.board, [
    { cardId: "cowboy-sheriff-1", health: 3 },
    { cardId: "cowboy-billy-1", health: 4 },
    { cardId: "cowboy-sheriff-3", health: 3 },
  ]);
  assert.deepEqual(one.state.sides.cowboy.discard, ["cowboy-sheriff-2"]);
  assert.deepEqual(one.state.sides.cowboy.hand, ["cowboy-mounted-billy-1"]);
  assert.equal(one.state.summonUsed, true);
  assert.equal(one.state.revision, state.revision + 1);
  assert.equal(one.state.rng, state.rng);
  assertConservation(one.state);

  const two = applyAction(state, summon(state, { cardId: "cowboy-mounted-billy-1", slot: 2, tributes: [0, 2] }));
  assert.equal(two.ok, true);
  assert.deepEqual(two.state.sides.cowboy.board, [
    null,
    { cardId: "cowboy-sheriff-2", health: 3 },
    { cardId: "cowboy-mounted-billy-1", health: 5 },
  ]);
  assert.deepEqual(two.state.sides.cowboy.discard, ["cowboy-sheriff-1", "cowboy-sheriff-3"]);
  assertConservation(two.state);

  // Only a vacated slot opens up: the other occupied slots stay taken.
  assertRejected(state, summon(state, { cardId: "cowboy-billy-1", slot: 0, tributes: [1] }), "slot-occupied");
});

test("stale or retried action is rejected, and so is a second summon in the phase", () => {
  const state = cowboyFixture({ board: [null, null, null], hand: ["cowboy-sheriff-1", "cowboy-sheriff-2"] });
  const action = summon(state, { cardId: "cowboy-sheriff-1", slot: 0 });
  const applied = applyAction(state, action);
  assert.equal(applied.ok, true);

  assertRejected(applied.state, action, "stale");
  // A different card and slot with the old revision is stale too.
  assertRejected(applied.state, { ...action, cardId: "cowboy-sheriff-2", slot: 1 }, "stale");
  // Current revision, but the phase's one summon is spent.
  assertRejected(applied.state, summon(applied.state, { cardId: "cowboy-sheriff-2", slot: 1 }), "summon-used");
  assertConservation(applied.state);
});

test("invalid selections are rejected without changing state, ownership or RNG", () => {
  const state = cowboyFixture({
    board: ["cowboy-sheriff-1", "cowboy-sheriff-2", null],
    hand: ["cowboy-sheriff-3", "cowboy-billy-1", "cowboy-mounted-billy-1", "cowboy-deadeye-1"],
  });
  const wizardCard = state.sides.wizard.hand[0];
  const cases = [
    ["invalid-action", undefined],
    ["invalid-action", { ...summon(state, { cardId: "cowboy-sheriff-3", slot: 2 }), type: "cast" }],
    ["stale", { ...summon(state, { cardId: "cowboy-sheriff-3", slot: 2 }), revision: undefined }],
    ["wrong-side", { ...summon(state, { cardId: wizardCard, slot: 2 }), side: "wizard" }],
    ["card-not-in-hand", summon(state, { cardId: wizardCard, slot: 2 })],
    ["card-not-in-hand", summon(state, { cardId: "cowboy-sheriff-4", slot: 2 })], // still in the deck
    ["card-not-in-hand", summon(state, { cardId: "cowboy-sheriff-1", slot: 2 })], // already on the board
    ["card-not-in-hand", summon(state, { cardId: "no-such-card", slot: 2 })],
    ["not-a-troop", summon(state, { cardId: "cowboy-deadeye-1", slot: 2 })],
    ["invalid-tribute", { ...summon(state, { cardId: "cowboy-billy-1", slot: 2 }), tributes: undefined }],
    ["invalid-tribute", summon(state, { cardId: "cowboy-mounted-billy-1", slot: 2, tributes: [0, 0] })],
    ["invalid-tribute", summon(state, { cardId: "cowboy-billy-1", slot: 0, tributes: [2] })], // empty slot
    ["invalid-tribute", summon(state, { cardId: "cowboy-billy-1", slot: 2, tributes: [3] })],
    ["unpaid", summon(state, { cardId: "cowboy-billy-1", slot: 2 })],
    ["unpaid", summon(state, { cardId: "cowboy-mounted-billy-1", slot: 2, tributes: [0] })],
    ["overpaid", summon(state, { cardId: "cowboy-sheriff-3", slot: 2, tributes: [0] })],
    ["overpaid", summon(state, { cardId: "cowboy-billy-1", slot: 2, tributes: [0, 1] })],
    ["invalid-slot", summon(state, { cardId: "cowboy-sheriff-3", slot: 3 })],
    ["invalid-slot", summon(state, { cardId: "cowboy-sheriff-3" })],
    ["slot-occupied", summon(state, { cardId: "cowboy-sheriff-3", slot: 0 })],
    ["slot-occupied", summon(state, { cardId: "cowboy-billy-1", slot: 1, tributes: [0] })],
  ];
  for (const [reason, action] of cases) assertRejected(state, action, reason);
  assertConservation(state);
});

test("card conservation across seeds, before and after a summon", () => {
  for (let seed = 0; seed < 50; seed++) {
    let state = createMatch(seed);
    assertConservation(state);
    const side = state.activeSide;
    // A hand of only 5+ star troops and spells has no legal summon on an
    // empty board.
    const cardId = freeTroop(state.sides[side].hand);
    if (!cardId) continue;
    const result = applyAction(state, { type: "summon", side, revision: 0, cardId, slot: seed % 3, tributes: [] });
    assert.equal(result.ok, true, `seed ${seed}`);
    assertConservation(result.state);
    assert.equal(result.state.rng, state.rng);
  }
});
