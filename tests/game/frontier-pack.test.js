// Content pack 1, "Frontier" (brief cases 5-11): the six Cowboy cards, the
// Ride flag and the copy limit. Boards are set directly; fixtures need not
// conserve cards because none of these cases checks the deck.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { deckIds, validateDeck, validateDeckIds } from "../../src/game/deck-builder.js";

const WAGON_TRAIN = {
  "cowboy-sheriff": 3, "cowboy-covered-wagon": 2, "cowboy-billy": 2, "cowboy-gatling-crew": 1, "cowboy-deadeye": 2, "cowboy-lasso": 2,
};
const NIGHT_RIDERS = {
  "cowboy-sheriff": 3, "cowboy-outrider": 2, "cowboy-dynamiter": 2, "cowboy-ranger": 2, "cowboy-deadeye": 2, "cowboy-lasso": 1,
};
const unlocked = {frontierCards: [...Object.keys(WAGON_TRAIN), ...Object.keys(NIGHT_RIDERS)]};

// Seed 0, Cowboy first. Boards are [cardId, health?] per lane; hands replace the dealt hands.
function position({ cowboy = [], wizard = [], hand = [], options = {} } = {}) {
  const state = createMatch(0, options);
  const put = (side, troops) => {
    state.sides[side].board = [0, 1, 2].map((lane) => {
      const troop = troops[lane];
      return troop ? { cardId: troop[0], health: troop[1] ?? CARDS[troop[0]].health } : null;
    });
  };
  put("cowboy", cowboy);
  put("wizard", wizard);
  state.sides.cowboy.hand = hand;
  return state;
}

const act = (state, fields) => ({ side: state.activeSide, revision: state.revision, ...fields });
function accept(state, fields) {
  const result = applyAction(state, act(state, fields));
  assert.equal(result.ok, true, `${JSON.stringify(fields)}: ${result.reason}`);
  return result.state;
}
// Both sides end their phase: the clash runs once.
const clash = (state) => accept(accept(state, { type: "end-phase" }), { type: "end-phase" });
const healths = (state, side) => state.sides[side].board.map((troop) => troop?.health ?? null);

test("the six Frontier specs carry their stats, limits and rides", () => {
  const expected = {
    "cowboy-covered-wagon": { stars: 4, health: 4, attack: 1, limit: 2 },
    "cowboy-outrider": { stars: 3, health: 3, attack: 1, limit: 2, rides: true },
    "cowboy-dynamiter": { stars: 3, health: 1, attack: 3, limit: 2 },
    "cowboy-ranger": { stars: 5, health: 4, attack: 2, limit: 2, rides: true },
    "cowboy-gatling-crew": { stars: 7, health: 4, attack: 4, limit: 1 },
    "cowboy-lasso": { kind: "spell", relocates: true, limit: 2 },
  };
  for (const [type, fields] of Object.entries(expected)) {
    const limit = fields.limit;
    assert.equal(CARDS[`${type}-1`].side, "cowboy");
    for (const [key, value] of Object.entries(fields)) assert.equal(CARDS[`${type}-1`][key], value, `${type} ${key}`);
    assert.equal(Object.hasOwn(CARDS, `${type}-${limit}`), true, `${type} copy ${limit}`);
    assert.equal(Object.hasOwn(CARDS, `${type}-${limit + 1}`), false, `${type} copy ${limit + 1}`);
    assert.equal(DECKS.cowboy.some((id) => id.startsWith(`${type}-`)), false, `${type} is in no default deck`);
  }
  assert.equal(CARDS["cowboy-mounted-billy-1"].rides, true);
  assert.equal(CARDS["cowboy-billy-1"].rides, undefined);
});

test("case 5: a Covered Wagon stands on 1 after a Dragon's hit, a Sheriff falls", () => {
  const state = position({
    cowboy: [["cowboy-covered-wagon-1"], ["cowboy-sheriff-1"]],
    wizard: [["wizard-dragon-1"], ["wizard-dragon-1"]],
  });
  const next = clash(state);
  assert.deepEqual(healths(next, "cowboy"), [1, null, null]);
  assert.deepEqual(healths(next, "wizard"), [4, 4, null]);
});

test("case 6: Gatling Crew clears a Wizard in one clash and leaves a Dragon on 1", () => {
  const state = position({
    cowboy: [["cowboy-gatling-crew-1"], ["cowboy-gatling-crew-1"]],
    wizard: [["wizard-wizard-1"], ["wizard-dragon-1"]],
  });
  const next = clash(state);
  assert.deepEqual(healths(next, "wizard"), [null, 1, null]);
  assert.deepEqual(healths(next, "cowboy"), [2, 1, null]);
});

test("case 7: Dynamiter takes three Base orbs in an open lane and trades with a fresh Skeleton", () => {
  const open = clash(position({ cowboy: [["cowboy-dynamiter-1"]] }));
  assert.equal(open.sides.wizard.baseOrbs, 2);
  assert.equal(open.sides.cowboy.baseOrbs, 5);
  assert.deepEqual(healths(open, "cowboy"), [1, null, null]);

  const blocked = clash(position({ cowboy: [["cowboy-dynamiter-1"]], wizard: [["wizard-skeleton-1"]] }));
  assert.deepEqual(healths(blocked, "cowboy"), [null, null, null]);
  assert.deepEqual(healths(blocked, "wizard"), [null, null, null]);
  assert.equal(blocked.sides.wizard.baseOrbs, 5);
});

test("case 8: Lasso lists its cast, drag and second cast, and the drag leaves the survivor on 2", () => {
  const state = position({
    wizard: [["wizard-skeleton-1", 3], null, ["wizard-skeleton-2", 1]],
    hand: ["cowboy-lasso-1"],
  });
  const casts = legalActions(state, "cowboy").filter((action) => action.type === "spell");
  assert.deepEqual(casts.map(({ target, destination }) => [target, destination]), [[0, undefined], [0, 1], [2, undefined]]);
  const dragged = accept(state, { type: "spell", cardId: "cowboy-lasso-1", target: 0, destination: 1 });
  assert.deepEqual(dragged.sides.wizard.board.map((troop) => troop && [troop.cardId, troop.health]), [null, ["wizard-skeleton-1", 2], ["wizard-skeleton-2", 1]]);
});

test("case 9: in a standard duel only a rider may ride, and the move spends the summon", () => {
  const state = position({
    cowboy: [["cowboy-outrider-1"], null, ["cowboy-sheriff-1"]],
    wizard: [["wizard-skeleton-1"]],
    hand: ["cowboy-sheriff-2", "cowboy-lasso-1"],
  });
  assert.equal("rideOut" in state, false);
  const rides = legalActions(state, "cowboy").filter((action) => action.type === "ride-out");
  assert.deepEqual(rides.map(({ slot, destination }) => [slot, destination]), [[0, 1]]);

  const moved = accept(state, { type: "ride-out", slot: 0, destination: 1 });
  assert.deepEqual(moved.sides.cowboy.board.map((troop) => troop && [troop.cardId, troop.health]), [null, ["cowboy-outrider-1", 3], ["cowboy-sheriff-1", 3]]);
  const summon = applyAction(moved, act(moved, { type: "summon", cardId: "cowboy-sheriff-2", slot: 0, tributes: [] }));
  assert.deepEqual([summon.ok, summon.reason], [false, "summon-used"]);
  assert.equal(legalActions(moved, "cowboy").some((action) => action.type === "spell"), true);
  accept(moved, { type: "spell", cardId: "cowboy-lasso-1", target: 0 });

  const sheriff = applyAction(state, act(state, { type: "ride-out", slot: 2, destination: 1 }));
  assert.deepEqual([sheriff.ok, sheriff.reason], [false, "invalid-action"]);
  assert.equal(sheriff.state, state);
});

test("case 10: on a ride-out match every troop still rides", () => {
  const state = position({
    cowboy: [["cowboy-outrider-1"], null, ["cowboy-sheriff-1"]],
    options: { rideOut: true },
  });
  const rides = legalActions(state, "cowboy").filter((action) => action.type === "ride-out");
  assert.deepEqual(rides.map(({ slot, destination }) => [slot, destination]), [[0, 1], [2, 1]]);
  accept(state, { type: "ride-out", slot: 2, destination: 1 });
});

test("case 11: copy limits apply to counts and IDs; both new decks are legal", () => {
  const rest = { "cowboy-sheriff": 5 };
  const rejected = [
    { ...rest, "cowboy-lasso": 3, "cowboy-billy": 4 },
    { ...rest, "cowboy-covered-wagon": 3, "cowboy-billy": 4 },
    { ...rest, "cowboy-gatling-crew": 2, "cowboy-billy": 5 },
  ];
  for (const counts of rejected) {
    assert.match(validateDeck(counts, unlocked).error, /whole copies/);
    assert.throws(() => deckIds(counts, unlocked), TypeError);
  }
  for (const counts of [WAGON_TRAIN, NIGHT_RIDERS]) {
    assert.equal(validateDeck(counts).ok, false);
    assert.deepEqual(validateDeck(counts, unlocked), { ok: true, error: null, total: 12 });
    const ids = deckIds(counts, unlocked);
    assert.deepEqual(validateDeckIds(ids), { ok: true, error: null, total: 12 });
    createMatch(6, { cowboyDeck: ids });
  }
  // An ID beyond the limit is not registered, so a match refuses it.
  const beyond = deckIds(WAGON_TRAIN, unlocked);
  beyond[beyond.indexOf("cowboy-lasso-2")] = "cowboy-lasso-3";
  assert.equal(validateDeckIds(beyond).ok, false);
  assert.throws(() => createMatch(6, { cowboyDeck: beyond }), TypeError);
});
