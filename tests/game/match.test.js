import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch, MAX_ROUNDS, RULES_VERSION } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";

// Every selected default card is in exactly one of deck, hand, board or discard,
// and only in its own side's zones.
function assertConservation(state) {
  const seen = [];
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const ids = [...deck, ...hand, ...discard, ...board.filter(Boolean).map((troop) => troop.cardId)];
    for (const id of ids) assert.equal(CARDS[id]?.side, side, `${id} is in a ${side} zone`);
    seen.push(...ids);
  }
  assert.deepEqual(seen.sort(), Object.values(DECKS).flat().sort());
}

// Valid mid-match position. Per side: `board` slots are a card ID, a
// [card ID, health] pair or null; `hand` and `discard` are ID lists. Every
// other card of that side stays in its deck, or goes to discard when `deck`
// names the deck explicitly.
function fixture({ round = 1, startingSide = "cowboy", activeSide = startingSide, cowboy = {}, wizard = {} } = {}) {
  const state = createMatch(1);
  Object.assign(state, { round, startingSide, activeSide });
  for (const [side, spec] of Object.entries({ cowboy, wizard })) {
    const board = (spec.board ?? [null, null, null]).map((entry) => {
      if (entry === null) return null;
      const [cardId, health = CARDS[cardId].health] = [].concat(entry);
      return { cardId, health };
    });
    const hand = spec.hand ?? [];
    const placed = new Set([...hand, ...(spec.discard ?? []), ...board.filter(Boolean).map((troop) => troop.cardId)]);
    const rest = DECKS[side].filter((id) => !placed.has(id));
    const deck = spec.deck ?? rest;
    state.sides[side] = {
      baseOrbs: spec.baseOrbs ?? 5,
      deck: [...deck],
      hand: [...hand],
      board,
      discard: [...(spec.discard ?? []), ...rest.filter((id) => !deck.includes(id))],
    };
  }
  assertConservation(state);
  return state;
}

// An action by the side whose phase it is, at the current revision.
const act = (state, type, fields = {}) => ({ type, side: state.activeSide, revision: state.revision, ...fields });

function accept(state, action) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, true, `rejected: ${result.reason}`);
  assert.deepEqual(state, before, "accepted actions return a new state");
  assert.equal(result.state.revision, state.revision + 1);
  assert.equal(result.state.rng, state.rng);
  for (const event of result.events) assert.equal(event.revision, state.revision);
  assertConservation(result.state);
  return result;
}

// The rejection must leave the input object exactly as it was.
function assertRejected(state, action, reason) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.state, state);
  assert.equal(result.events, undefined);
  assert.deepEqual(state, before);
}

const endPhase = (state) => accept(state, act(state, "end-phase"));
// Both sides end their phases with no other action.
const passRound = (state) => endPhase(endPhase(state).state);
// A position where the next end-phase runs the clash.
const beforeClash = (spec) => fixture({ startingSide: "cowboy", activeSide: "wizard", ...spec });
const types = (events) => events.map((event) => event.type);
const ofType = (events, type) => events.filter((event) => event.type === type);
// Events without the revision stamp, for exact comparisons.
const bare = (events) => events.map(({ revision, ...event }) => event);

test("phase flow: sequential phases, explicit end-phase, alternating starting side", () => {
  let state = createMatch(42);
  const first = state.startingSide;
  const second = opponent(first);
  assert.equal(state.seed, 42);
  assert.equal(state.round, 1);
  assert.equal(state.activeSide, first);
  assert.equal(state.result, null);
  assert.equal(typeof RULES_VERSION, "string");

  assertRejected(state, { type: "end-phase", side: second, revision: state.revision }, "wrong-side");
  let result = endPhase(state);
  assert.deepEqual(bare(result.events), [
    { type: "phase-end", side: first, round: 1 },
    { type: "phase-start", side: second, round: 1 },
  ]);
  state = result.state;
  assert.equal(state.round, 1);
  assert.equal(state.activeSide, second);
  assertRejected(state, { type: "end-phase", side: first, revision: state.revision }, "wrong-side");

  result = endPhase(state);
  assert.deepEqual(bare(result.events), [
    { type: "phase-end", side: second, round: 1 },
    { type: "clash", round: 1 },
    { type: "round-start", round: 2, startingSide: second },
    { type: "draw", side: second },
    { type: "draw", side: first },
    { type: "phase-start", side: second, round: 2 },
  ]);
  state = result.state;

  for (let round = 2; round <= MAX_ROUNDS; round++) {
    const starter = round % 2 === 1 ? first : second;
    assert.equal(state.round, round);
    assert.equal(state.startingSide, starter);
    assert.equal(state.activeSide, starter);
    state = passRound(state).state;
  }
  assert.equal(state.round, MAX_ROUNDS);
  assert.deepEqual(state.result, { winner: null, loser: null, reason: "round-limit", round: 9 });
});

test("phase limits: one summon and one cast per side per round, summon before spell", () => {
  const start = fixture({
    cowboy: { hand: ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-deadeye-1", "cowboy-deadeye-2"] },
    wizard: { board: ["wizard-wizard-1", null, null], hand: ["wizard-skeleton-1", "wizard-singularity-1"] },
  });
  const summon = (state, cardId, slot) => act(state, "summon", { cardId, slot, tributes: [] });
  const cast = (state, cardId, target = 0) => act(state, "spell", { cardId, target });

  // Summon, then cast, then nothing more of either.
  let state = accept(start, summon(start, "cowboy-sheriff-1", 0)).state;
  assert.deepEqual(state.allowances.cowboy, { summonUsed: true, castUsed: false });
  assertRejected(state, summon(state, "cowboy-sheriff-2", 1), "summon-used");
  state = accept(state, cast(state, "cowboy-deadeye-1")).state;
  assert.deepEqual(state.allowances.cowboy, { summonUsed: true, castUsed: true });
  assertRejected(state, cast(state, "cowboy-deadeye-2"), "cast-used");
  assertRejected(state, summon(state, "cowboy-sheriff-2", 1), "summon-used");
  assert.deepEqual(legalActions(state, "cowboy"), [act(state, "end-phase")]);

  // The other side has its own allowances; the first side's stay spent.
  state = endPhase(state).state;
  assert.deepEqual(state.allowances, {
    cowboy: { summonUsed: true, castUsed: true },
    wizard: { summonUsed: false, castUsed: false },
  });
  assertRejected(state, { ...cast(state, "cowboy-deadeye-2"), side: "cowboy" }, "wrong-side");
  state = accept(state, summon(state, "wizard-skeleton-1", 1)).state;
  state = accept(state, cast(state, "wizard-singularity-1")).state;

  // A new round resets both sides.
  state = endPhase(state).state;
  assert.equal(state.round, 2);
  for (const side of SIDES) assert.deepEqual(state.allowances[side], { summonUsed: false, castUsed: false });

  // Cast first: the summon is then closed for this phase.
  const castFirst = accept(start, cast(start, "cowboy-deadeye-1")).state;
  assert.deepEqual(castFirst.allowances.cowboy, { summonUsed: false, castUsed: true });
  assertRejected(castFirst, summon(castFirst, "cowboy-sheriff-1", 0), "summon-after-spell");
  assert.deepEqual(legalActions(castFirst, "cowboy"), [act(castFirst, "end-phase")]);
});

test("full-board tribute: a two-tribute summon lands on a vacated slot and fights in that round's clash", () => {
  const start = beforeClash({
    cowboy: { board: ["cowboy-sheriff-1", null, null] },
    wizard: { board: ["wizard-skeleton-1", "wizard-skeleton-2", "wizard-skeleton-3"], hand: ["wizard-dragon-1"] },
  });
  const dragon = { cardId: "wizard-dragon-1", slot: 0 };
  assertRejected(start, act(start, "summon", { ...dragon, tributes: [] }), "unpaid");
  assertRejected(start, act(start, "summon", { ...dragon, tributes: [1, 2] }), "slot-occupied");

  const summoned = accept(start, act(start, "summon", { ...dragon, tributes: [0, 1] }));
  assert.deepEqual(bare(summoned.events), [
    { type: "summon", side: "wizard", cardId: "wizard-dragon-1", slot: 0, tributes: [0, 1] },
  ]);
  assert.deepEqual(summoned.state.sides.wizard.board, [
    { cardId: "wizard-dragon-1", health: 5 },
    null,
    { cardId: "wizard-skeleton-3", health: 3 },
  ]);
  assert.deepEqual(summoned.state.sides.wizard.discard, ["wizard-skeleton-1", "wizard-skeleton-2"]);

  const clash = endPhase(summoned.state);
  assert.deepEqual(bare(ofType(clash.events, "damage")), [
    {
      type: "damage",
      lane: 0,
      attacker: { side: "cowboy", slot: 0, cardId: "cowboy-sheriff-1" },
      target: { kind: "troop", side: "wizard", slot: 0, cardId: "wizard-dragon-1" },
      amount: 1,
      before: 5,
      after: 4,
    },
    {
      type: "damage",
      lane: 0,
      attacker: { side: "wizard", slot: 0, cardId: "wizard-dragon-1" },
      target: { kind: "troop", side: "cowboy", slot: 0, cardId: "cowboy-sheriff-1" },
      amount: 3,
      before: 3,
      after: 0,
    },
    {
      type: "damage",
      lane: 2,
      attacker: { side: "wizard", slot: 2, cardId: "wizard-skeleton-3" },
      target: { kind: "base", side: "cowboy" },
      amount: 1,
      before: 5,
      after: 4,
    },
  ]);
  assert.deepEqual(bare(ofType(clash.events, "defeat")), [
    { type: "defeat", side: "cowboy", slot: 0, cardId: "cowboy-sheriff-1" },
  ]);
  assert.equal(clash.state.sides.cowboy.baseOrbs, 4);
  assert.equal(clash.state.sides.wizard.board[0].health, 4);
});

test("invalid actions are rejected without changing state, card zones or RNG", () => {
  const state = fixture({
    startingSide: "wizard",
    activeSide: "wizard",
    cowboy: { board: ["cowboy-sheriff-1", "cowboy-sheriff-2", null], hand: ["cowboy-deadeye-1"] },
    wizard: {
      board: ["wizard-skeleton-1", null, null],
      hand: ["wizard-singularity-1", "wizard-skeleton-2"],
    },
  });
  const cast = (fields) => act(state, "spell", { cardId: "wizard-singularity-1", target: 0, ...fields });
  const cases = [
    ["invalid-action", null],
    ["invalid-action", "end-phase"],
    ["invalid-action", act(state, "cast", { cardId: "wizard-singularity-1", target: 0 })],
    ["invalid-action", act(state, "toString")],
    ["invalid-action", act(state, "end-phase", { actionId: 7 })],
    ["invalid-action", act(state, "end-phase", { actionId: "" })],
    ["stale", { ...act(state, "end-phase"), revision: state.revision + 1 }],
    ["stale", { ...cast(), revision: undefined }],
    ["wrong-side", { ...act(state, "end-phase"), side: "cowboy" }],
    ["wrong-side", { ...act(state, "end-phase"), side: undefined }],
    ["wrong-side", { ...cast({ cardId: "cowboy-deadeye-1" }), side: "cowboy" }],
    ["card-not-in-hand", cast({ cardId: "cowboy-deadeye-1" })],
    ["card-not-in-hand", cast({ cardId: "wizard-singularity-2" })], // still in the deck
    ["card-not-in-hand", cast({ cardId: undefined })],
    ["not-a-spell", cast({ cardId: "wizard-skeleton-2" })],
    ["invalid-target", cast({ target: 2 })], // empty enemy slot
    ["invalid-target", cast({ target: 3 })],
    ["invalid-target", cast({ target: -1 })],
    ["invalid-target", cast({ target: "0" })],
    ["invalid-target", cast({ target: undefined })],
    ["invalid-destination", cast({ destination: 1 })], // occupied
    ["invalid-destination", cast({ destination: 2 })], // not adjacent
    ["invalid-destination", cast({ destination: 0 })], // the target's own slot
    ["invalid-destination", cast({ destination: -1 })],
    ["invalid-destination", cast({ target: 1, destination: 3 })],
    ["invalid-destination", cast({ target: 1, destination: "2" })],
  ];
  for (const [reason, action] of cases) assertRejected(state, action, reason);

  // A rejected cast spends nothing: the same card can still be cast.
  assert.deepEqual(state.allowances.wizard, { summonUsed: false, castUsed: false });
  const valid = accept(state, cast({ target: 1, destination: 2 }));
  assert.deepEqual(valid.state.sides.wizard.discard.slice(-1), ["wizard-singularity-1"]);
});

test("stale and retried submissions: expected revision and action ID", () => {
  const state = fixture({ cowboy: { hand: ["cowboy-sheriff-1", "cowboy-deadeye-1"] }, wizard: { board: ["wizard-wizard-1", null, null] } });
  const summon = act(state, "summon", { cardId: "cowboy-sheriff-1", slot: 0, tributes: [], actionId: "a-1" });
  const first = accept(state, summon);
  assert.deepEqual(first.state.actionIds, ["a-1"]);
  assert.deepEqual(first.events, [
    { type: "summon", side: "cowboy", cardId: "cowboy-sheriff-1", slot: 0, tributes: [], revision: state.revision, actionId: "a-1" },
  ]);

  const next = first.state;
  // The same submission again, and its ID on a fresh action.
  assertRejected(next, summon, "duplicate-action");
  assertRejected(next, act(next, "end-phase", { actionId: "a-1" }), "duplicate-action");
  // An old revision, with a new ID or with none.
  assertRejected(next, { ...act(next, "end-phase", { actionId: "a-2" }), revision: state.revision }, "stale");
  assertRejected(next, { ...summon, actionId: undefined }, "stale");
  // A rejected ID is not committed, so it can be used by the corrected action.
  const cast = accept(next, act(next, "spell", { cardId: "cowboy-deadeye-1", target: 0, actionId: "a-2" }));
  assert.deepEqual(cast.state.actionIds, ["a-1", "a-2"]);
  for (const event of cast.events) assert.equal(event.actionId, "a-2");

  // The ID is optional; events then carry none.
  const plain = accept(cast.state, act(cast.state, "end-phase"));
  assert.deepEqual(plain.state.actionIds, ["a-1", "a-2"]);
  for (const event of plain.events) assert.equal("actionId" in event, false);
  // IDs are remembered for the whole match, across sides.
  assertRejected(plain.state, act(plain.state, "end-phase", { actionId: "a-1" }), "duplicate-action");
});

test("clash: troops facing an empty lane damage the opposing base, both ways", () => {
  const state = beforeClash({
    cowboy: { board: ["cowboy-billy-1", null, null] },
    wizard: { board: [null, "wizard-dragon-1", null] },
  });
  const { state: after, events } = endPhase(state);
  assert.deepEqual(bare(ofType(events, "damage")), [
    {
      type: "damage",
      lane: 0,
      attacker: { side: "cowboy", slot: 0, cardId: "cowboy-billy-1" },
      target: { kind: "base", side: "wizard" },
      amount: 2,
      before: 5,
      after: 3,
    },
    {
      type: "damage",
      lane: 1,
      attacker: { side: "wizard", slot: 1, cardId: "wizard-dragon-1" },
      target: { kind: "base", side: "cowboy" },
      amount: 3,
      before: 5,
      after: 2,
    },
  ]);
  assert.equal(after.sides.wizard.baseOrbs, 3);
  assert.equal(after.sides.cowboy.baseOrbs, 2);
  assert.deepEqual(after.sides.cowboy.board, state.sides.cowboy.board);
  assert.deepEqual(after.sides.wizard.board, state.sides.wizard.board);
  assert.equal(after.round, 2);
  assert.equal(after.result, null);
});

test("clash: a blocking troop absorbs the whole attack and nothing spills to the base", () => {
  const state = beforeClash({
    cowboy: { board: ["cowboy-mounted-billy-1", null, ["cowboy-sheriff-1", 1]] },
    wizard: { board: [["wizard-skeleton-1", 1], null, "wizard-dragon-1"] },
  });
  const { state: after, events } = endPhase(state);
  assert.equal(after.sides.wizard.baseOrbs, 5);
  assert.equal(after.sides.cowboy.baseOrbs, 5);
  assert.deepEqual(
    ofType(events, "damage").map(({ lane, attacker, target, amount, before, after }) => [lane, attacker.side, target.kind, amount, before, after]),
    [
      [0, "cowboy", "troop", 3, 1, 0],
      [0, "wizard", "troop", 1, 5, 4], // the Skeleton still strikes: attacks are one snapshot
      [2, "cowboy", "troop", 1, 5, 4],
      [2, "wizard", "troop", 3, 1, 0],
    ],
  );
  assert.deepEqual(after.sides.cowboy.board, [{ cardId: "cowboy-mounted-billy-1", health: 4 }, null, null]);
  assert.deepEqual(after.sides.wizard.board, [null, null, { cardId: "wizard-dragon-1", health: 4 }]);
});

test("clash: mutual defeats go to their owners' discards exactly once", () => {
  const state = beforeClash({
    cowboy: { board: [["cowboy-sheriff-1", 1], ["cowboy-billy-1", 2], null] },
    wizard: { board: [["wizard-skeleton-1", 1], ["wizard-wizard-1", 2], null] },
  });
  const { state: after, events } = endPhase(state);
  assert.deepEqual(after.sides.cowboy.board, [null, null, null]);
  assert.deepEqual(after.sides.wizard.board, [null, null, null]);
  assert.deepEqual(after.sides.cowboy.discard, ["cowboy-sheriff-1", "cowboy-billy-1"]);
  assert.deepEqual(after.sides.wizard.discard, ["wizard-skeleton-1", "wizard-wizard-1"]);
  assert.deepEqual(bare(ofType(events, "defeat")), [
    { type: "defeat", side: "cowboy", slot: 0, cardId: "cowboy-sheriff-1" },
    { type: "defeat", side: "wizard", slot: 0, cardId: "wizard-skeleton-1" },
    { type: "defeat", side: "cowboy", slot: 1, cardId: "cowboy-billy-1" },
    { type: "defeat", side: "wizard", slot: 1, cardId: "wizard-wizard-1" },
  ]);
  // All damage comes before any removal.
  assert.deepEqual(types(events).slice(1, 10), ["clash", "damage", "damage", "damage", "damage", "defeat", "defeat", "defeat", "defeat"]);
  assert.equal(after.sides.cowboy.baseOrbs, 5);
  assert.equal(after.sides.wizard.baseOrbs, 5);
  assert.equal(after.result, null);
});

test("result: both bases at zero in the same clash is a draw, whichever lane lands first", () => {
  const positions = [
    { cowboy: { baseOrbs: 2, board: ["cowboy-mounted-billy-1", null, null] }, wizard: { baseOrbs: 3, board: [null, null, "wizard-wizard-1"] } },
    { cowboy: { baseOrbs: 2, board: [null, null, "cowboy-mounted-billy-1"] }, wizard: { baseOrbs: 3, board: ["wizard-wizard-1", null, null] } },
  ];
  for (const position of positions) {
    const { state, events } = endPhase(beforeClash({ round: 4, ...position }));
    assert.equal(state.sides.cowboy.baseOrbs, 0);
    assert.equal(state.sides.wizard.baseOrbs, 0);
    const result = { winner: null, loser: null, reason: "base-destroyed", round: 4 };
    assert.deepEqual(state.result, result);
    assert.equal(state.activeSide, null);
    assert.equal(state.round, 4);
    assert.deepEqual(bare(events.slice(-1)), [{ type: "result", result }]);
    assert.equal(ofType(events, "damage").length, 2);
  }
});

test("result: exactly one base at zero loses, and the rest of the clash still resolves", () => {
  for (const [loser, winner] of [["cowboy", "wizard"], ["wizard", "cowboy"]]) {
    const prefix = (side) => (side === "cowboy" ? "cowboy-sheriff" : "wizard-skeleton");
    const state = beforeClash({
      round: 3,
      [loser]: { baseOrbs: 1, board: [null, null, `${prefix(loser)}-1`] },
      [winner]: { baseOrbs: 5, board: [`${prefix(winner)}-1`, `${prefix(winner)}-2`, null] },
    });
    const { state: after, events } = endPhase(state);
    // Lanes 0 and 1 both hit the one-orb base; lane 2 still answers afterwards.
    assert.deepEqual(
      ofType(events, "damage").map(({ lane, target, before, after }) => [lane, target.side, before, after]),
      [[0, loser, 1, 0], [1, loser, 0, 0], [2, winner, 5, 4]],
    );
    assert.equal(after.sides[loser].baseOrbs, 0);
    assert.equal(after.sides[winner].baseOrbs, 4);
    assert.deepEqual(after.result, { winner, loser, reason: "base-destroyed", round: 3 });
    assert.equal(types(events).at(-1), "result");
  }
});

test("result: after round nine's clash the higher base wins and equal bases draw", () => {
  const bases = (cowboy, wizard, round) => beforeClash({ round, cowboy: { baseOrbs: cowboy }, wizard: { baseOrbs: wizard } });

  assert.deepEqual(endPhase(bases(3, 4, 9)).state.result, { winner: "wizard", loser: "cowboy", reason: "round-limit", round: 9 });
  assert.deepEqual(endPhase(bases(2, 1, 9)).state.result, { winner: "cowboy", loser: "wizard", reason: "round-limit", round: 9 });
  assert.deepEqual(endPhase(bases(3, 3, 9)).state.result, { winner: null, loser: null, reason: "round-limit", round: 9 });

  // The comparison uses base health after the clash.
  const late = beforeClash({
    round: 9,
    cowboy: { baseOrbs: 4, board: ["cowboy-billy-1", null, null] },
    wizard: { baseOrbs: 5 },
  });
  assert.deepEqual(endPhase(late).state.result, { winner: "cowboy", loser: "wizard", reason: "round-limit", round: 9 });

  // Unequal bases before round nine decide nothing.
  const early = endPhase(bases(1, 5, 8)).state;
  assert.equal(early.result, null);
  assert.equal(early.round, 9);
});

test("spells: Deadeye removes one health, kills at one, and needs no friendly troop", () => {
  const state = fixture({
    cowboy: { hand: ["cowboy-deadeye-1", "cowboy-deadeye-2"] },
    wizard: { board: ["wizard-wizard-1", null, ["wizard-skeleton-1", 1]] },
  });
  assert.deepEqual(state.sides.cowboy.board, [null, null, null]);

  const hit = accept(state, act(state, "spell", { cardId: "cowboy-deadeye-1", target: 0 }));
  assert.deepEqual(bare(hit.events), [
    {
      type: "spell",
      spell: "Deadeye",
      cardId: "cowboy-deadeye-1",
      caster: "cowboy",
      target: { side: "wizard", slot: 0, cardId: "wizard-wizard-1" },
      before: 4,
      after: 3,
    },
  ]);
  assert.deepEqual(hit.state.sides.wizard.board[0], { cardId: "wizard-wizard-1", health: 3 });
  assert.deepEqual(hit.state.sides.cowboy.hand, ["cowboy-deadeye-2"]);
  assert.deepEqual(hit.state.sides.cowboy.discard, ["cowboy-deadeye-1"]);
  assert.equal(hit.state.sides.wizard.baseOrbs, 5);

  const kill = accept(state, act(state, "spell", { cardId: "cowboy-deadeye-2", target: 2 }));
  assert.deepEqual(bare(kill.events), [
    {
      type: "spell",
      spell: "Deadeye",
      cardId: "cowboy-deadeye-2",
      caster: "cowboy",
      target: { side: "wizard", slot: 2, cardId: "wizard-skeleton-1" },
      before: 1,
      after: 0,
    },
    { type: "defeat", side: "wizard", slot: 2, cardId: "wizard-skeleton-1" },
  ]);
  assert.equal(kill.state.sides.wizard.board[2], null);
  assert.deepEqual(kill.state.sides.wizard.discard, ["wizard-skeleton-1"]);
  assert.deepEqual(kill.state.sides.cowboy.discard, ["cowboy-deadeye-2"]);

  // Deadeye never relocates.
  assertRejected(state, act(state, "spell", { cardId: "cowboy-deadeye-1", target: 0, destination: 1 }), "invalid-destination");
});

test("spells: Singularity damages, then optionally moves the survivor to an adjacent empty enemy slot", () => {
  const state = fixture({
    startingSide: "wizard",
    cowboy: { board: ["cowboy-billy-1", null, ["cowboy-sheriff-1", 1]] },
    wizard: { hand: ["wizard-singularity-1"] },
  });
  assert.deepEqual(state.sides.wizard.board, [null, null, null]);
  const cast = (fields) => act(state, "spell", { cardId: "wizard-singularity-1", ...fields });

  const moved = accept(state, cast({ target: 0, destination: 1 }));
  assert.deepEqual(bare(moved.events), [
    {
      type: "spell",
      spell: "Singularity",
      cardId: "wizard-singularity-1",
      caster: "wizard",
      target: { side: "cowboy", slot: 0, cardId: "cowboy-billy-1" },
      before: 4,
      after: 3,
      destination: 1,
    },
  ]);
  assert.deepEqual(moved.state.sides.cowboy.board, [
    null,
    { cardId: "cowboy-billy-1", health: 3 },
    { cardId: "cowboy-sheriff-1", health: 1 },
  ]);
  assert.deepEqual(moved.state.sides.wizard.discard, ["wizard-singularity-1"]);
  assert.deepEqual(moved.state.sides.wizard.hand, []);

  // The move is optional.
  const stayed = accept(state, cast({ target: 0 }));
  assert.equal("destination" in stayed.events[0], false);
  assert.deepEqual(stayed.state.sides.cowboy.board[0], { cardId: "cowboy-billy-1", health: 3 });
  assert.equal(stayed.state.sides.cowboy.board[1], null);

  // A target that dies cannot be moved: naming a destination rejects it all.
  assertRejected(state, cast({ target: 2, destination: 1 }), "invalid-destination");
  const killed = accept(state, cast({ target: 2 }));
  assert.deepEqual(types(killed.events), ["spell", "defeat"]);
  assert.deepEqual(killed.state.sides.cowboy.board, [{ cardId: "cowboy-billy-1", health: 4 }, null, null]);
  assert.deepEqual(killed.state.sides.cowboy.discard, ["cowboy-sheriff-1"]);
  assert.deepEqual(killed.state.sides.wizard.discard, ["wizard-singularity-1"]);

  // Not adjacent, and occupied.
  assertRejected(state, cast({ target: 0, destination: 2 }), "invalid-destination");
  const crowded = fixture({
    startingSide: "wizard",
    cowboy: { board: ["cowboy-billy-1", "cowboy-sheriff-1", null] },
    wizard: { hand: ["wizard-singularity-1"] },
  });
  assertRejected(crowded, act(crowded, "spell", { cardId: "wizard-singularity-1", target: 0, destination: 1 }), "invalid-destination");
  assert.equal(accept(crowded, act(crowded, "spell", { cardId: "wizard-singularity-1", target: 1, destination: 2 })).state.sides.cowboy.board[2].health, 2);
});

test("spells: with no enemy troop a spell cannot be cast and stays in hand", () => {
  for (const [side, cardId] of [["cowboy", "cowboy-deadeye-1"], ["wizard", "wizard-singularity-1"]]) {
    const state = fixture({ startingSide: side, [side]: { hand: [cardId], board: [`${side === "cowboy" ? "cowboy-sheriff" : "wizard-skeleton"}-1`, null, null] } });
    for (const target of [0, 1, 2]) assertRejected(state, act(state, "spell", { cardId, target }), "invalid-target");
    assert.deepEqual(legalActions(state, side), [act(state, "end-phase")]);
    assert.deepEqual(state.sides[side].hand, [cardId]);
    assert.equal(state.allowances[side].castUsed, false);
  }
});

test("drawing: none in round one, one per side at the start of rounds two to nine", () => {
  let state = createMatch(7);
  const tops = (current) => SIDES.map((side) => current.sides[side].deck[0]);
  for (const side of SIDES) {
    assert.equal(state.sides[side].hand.length, 4);
    assert.equal(state.sides[side].deck.length, 8);
  }
  const midRound = endPhase(state);
  assert.deepEqual(ofType(midRound.events, "draw"), []);
  assert.deepEqual(midRound.state.sides, state.sides);

  for (let round = 2; round <= MAX_ROUNDS; round++) {
    const expected = tops(state);
    const { state: next, events } = passRound(state);
    assert.equal(next.round, round);
    const draws = ofType(events, "draw");
    assert.deepEqual(draws.map((event) => event.side).sort(), [...SIDES].sort());
    // Public information only: a draw names the side, never the card.
    for (const event of draws) assert.deepEqual(Object.keys(event).sort(), ["revision", "side", "type"]);
    SIDES.forEach((side, i) => {
      assert.equal(next.sides[side].hand.at(-1), expected[i]);
      assert.equal(next.sides[side].hand.length, 3 + round);
      assert.equal(next.sides[side].deck.length, 9 - round);
    });
    state = next;
  }
  assert.equal(state.result, null);
});

test("drawing: an empty deck draws nothing and the match continues", () => {
  const state = fixture({
    round: 3,
    startingSide: "wizard",
    activeSide: "cowboy",
    cowboy: { hand: ["cowboy-sheriff-1"], deck: [] },
    wizard: { hand: ["wizard-skeleton-1"] },
  });
  assert.equal(state.sides.cowboy.deck.length, 0);
  const { state: next, events } = endPhase(state);
  assert.equal(next.round, 4);
  assert.equal(next.result, null);
  assert.equal(next.activeSide, "cowboy");
  assert.deepEqual(ofType(events, "draw").map((event) => event.side), ["wizard"]);
  assert.deepEqual(next.sides.cowboy.hand, ["cowboy-sheriff-1"]);
  assert.equal(next.sides.wizard.hand.length, 2);
  // Still playable with an empty deck.
  accept(next, act(next, "summon", { cardId: "cowboy-sheriff-1", slot: 0, tributes: [] }));
});

test("terminal match rejects every action", () => {
  const live = beforeClash({
    cowboy: { baseOrbs: 1, hand: ["cowboy-sheriff-1", "cowboy-deadeye-1"] },
    wizard: { board: ["wizard-skeleton-1", null, null], hand: ["wizard-skeleton-2", "wizard-singularity-1"] },
  });
  const over = endPhase(live).state;
  assert.deepEqual(over.result, { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 1 });
  for (const side of SIDES) {
    assert.deepEqual(legalActions(over, side), []);
    const own = { side, revision: over.revision };
    assertRejected(over, { type: "end-phase", ...own }, "match-over");
    assertRejected(over, { type: "end-phase", ...own, actionId: "late" }, "match-over");
    assertRejected(over, { type: "summon", ...own, cardId: over.sides[side].hand[0], slot: 1, tributes: [] }, "match-over");
    assertRejected(over, { type: "spell", ...own, cardId: over.sides[side].hand[1], target: 0 }, "match-over");
  }
  assertRejected(over, undefined, "match-over");
  assertRejected(over, act(live, "end-phase"), "match-over");
});

test("deterministic replay: same seed and actions give identical states and events", () => {
  // Fixed script: at step n take legal action number (5n + 1) mod count.
  const play = (seed) => {
    let state = createMatch(seed);
    const log = [];
    while (!state.result) {
      const actions = legalActions(state, state.activeSide);
      const action = { ...actions[(5 * log.length + 1) % actions.length], actionId: `step-${log.length}` };
      const result = applyAction(state, action);
      assert.equal(result.ok, true);
      log.push({ action, events: result.events, state: result.state });
      state = result.state;
    }
    return log;
  };
  const first = play(42);
  assert.deepEqual(first, play(42));
  assert.ok(first.some(({ action }) => action.type === "summon"));
  assert.ok(first.some(({ action }) => action.type === "spell"));
  assert.ok(first.some(({ events }) => events.some((event) => event.type === "damage")));
  assert.notDeepEqual(first.at(-1).state, play(43).at(-1).state);

  // Restart: the stored seed rebuilds the starting state.
  const final = first.at(-1).state;
  assert.deepEqual(createMatch(final.seed), createMatch(42));
});

test("publicState hides the opponent's hand, both deck orders, the seed and the RNG", () => {
  // Every zone of both sides holds cards.
  const state = fixture({
    round: 3,
    cowboy: {
      board: ["cowboy-sheriff-1", null, ["cowboy-billy-1", 2]],
      hand: ["cowboy-sheriff-2", "cowboy-deadeye-1", "cowboy-mounted-billy-1"],
      discard: ["cowboy-sheriff-3", "cowboy-deadeye-2"],
    },
    wizard: {
      board: [null, "wizard-skeleton-1", null],
      hand: ["wizard-skeleton-2", "wizard-singularity-1", "wizard-dragon-1"],
      discard: ["wizard-skeleton-3"],
    },
  });
  state.allowances.cowboy.summonUsed = true;
  const snapshot = structuredClone(state);

  for (const side of SIDES) {
    const other = opponent(side);
    const view = publicState(state, side);
    assert.deepEqual(Object.keys(view).sort(), ["activeSide", "allowances", "result", "revision", "round", "sides", "startingSide", "viewer"]);
    assert.equal(view.viewer, side);
    assert.deepEqual(Object.keys(view.sides[side]).sort(), ["baseOrbs", "board", "deckCount", "discard", "hand", "handCount"]);
    assert.deepEqual(Object.keys(view.sides[other]).sort(), ["baseOrbs", "board", "deckCount", "discard", "handCount"]);

    // No hidden card ID appears anywhere in the view.
    const text = JSON.stringify(view);
    const hidden = [...state.sides[other].hand, ...state.sides[side].deck, ...state.sides[other].deck];
    assert.ok(state.sides[other].hand.length > 0 && state.sides[side].deck.length > 0);
    for (const id of hidden) assert.equal(text.includes(id), false, `${id} leaked to ${side}`);
    assert.equal(text.includes(String(state.rng)), false);

    // Everything public is there and equal.
    assert.deepEqual(view.sides[side].hand, state.sides[side].hand);
    for (const each of SIDES) {
      const { baseOrbs, deck, hand, board, discard } = state.sides[each];
      assert.deepEqual(
        { ...view.sides[each], hand: undefined },
        { baseOrbs, deckCount: deck.length, handCount: hand.length, board, discard, hand: undefined },
      );
    }
    for (const key of ["revision", "round", "startingSide", "activeSide", "allowances", "result"]) {
      assert.deepEqual(view[key], state[key]);
    }

    // The view is enough to list that side's own legal actions.
    assert.deepEqual(legalActions(view, side), legalActions(state, side));

    // The view is a copy: changing it cannot reach the match state.
    view.sides[side].board[0] = "changed";
    view.sides[side].hand.length = 0;
    view.allowances[side].summonUsed = "changed";
    assert.deepEqual(state, snapshot);
  }
  assert.throws(() => publicState(state, "nobody"), TypeError);
  // The opponent's hand is not in the view, so its actions cannot be listed from it.
  assert.throws(() => legalActions(publicState(state, opponent(state.activeSide)), state.activeSide), TypeError);
});

test("publicState reports the result from the viewer's side", () => {
  const won = endPhase(beforeClash({ cowboy: { baseOrbs: 1 }, wizard: { board: ["wizard-skeleton-1", null, null] } })).state;
  const result = { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 1 };
  assert.deepEqual(publicState(won, "wizard").result, { ...result, outcome: "win" });
  assert.deepEqual(publicState(won, "cowboy").result, { ...result, outcome: "loss" });
  assert.equal(publicState(won, "cowboy").activeSide, null);

  const drawn = endPhase(beforeClash({ round: 9 })).state;
  for (const side of SIDES) assert.equal(publicState(drawn, side).result.outcome, "draw");
});

test("legalActions lists every summon, spell and end-phase, and each one is accepted", () => {
  const state = fixture({
    cowboy: {
      board: ["cowboy-sheriff-1", "cowboy-sheriff-2", null],
      hand: ["cowboy-sheriff-3", "cowboy-billy-1", "cowboy-mounted-billy-1", "cowboy-deadeye-1"],
    },
    wizard: { board: ["wizard-skeleton-1", null, "wizard-wizard-1"], hand: ["wizard-singularity-1"] },
  });
  const base = { side: "cowboy", revision: state.revision };
  const summon = (cardId, slot, tributes) => ({ type: "summon", ...base, cardId, slot, tributes });
  assert.deepEqual(legalActions(state, "cowboy"), [
    summon("cowboy-sheriff-3", 2, []),
    summon("cowboy-billy-1", 0, [0]),
    summon("cowboy-billy-1", 2, [0]),
    summon("cowboy-billy-1", 1, [1]),
    summon("cowboy-billy-1", 2, [1]),
    summon("cowboy-mounted-billy-1", 0, [0, 1]),
    summon("cowboy-mounted-billy-1", 1, [0, 1]),
    summon("cowboy-mounted-billy-1", 2, [0, 1]),
    { type: "spell", ...base, cardId: "cowboy-deadeye-1", target: 0 },
    { type: "spell", ...base, cardId: "cowboy-deadeye-1", target: 2 },
    { type: "end-phase", ...base },
  ]);
  assert.deepEqual(legalActions(state, "wizard"), []);
  for (const action of legalActions(state, "cowboy")) accept(state, action);

  // Singularity: each target alone, plus each adjacent empty slot for a survivor.
  const wizardTurn = fixture({
    startingSide: "wizard",
    cowboy: { board: ["cowboy-billy-1", null, ["cowboy-sheriff-1", 1]] },
    wizard: { hand: ["wizard-singularity-1"] },
  });
  const cast = (fields) => ({ type: "spell", side: "wizard", revision: wizardTurn.revision, cardId: "wizard-singularity-1", ...fields });
  assert.deepEqual(legalActions(wizardTurn, "wizard"), [
    cast({ target: 0 }),
    cast({ target: 0, destination: 1 }),
    cast({ target: 2 }),
    { type: "end-phase", side: "wizard", revision: wizardTurn.revision },
  ]);
  assert.deepEqual(legalActions(wizardTurn, "cowboy"), []);
  for (const action of legalActions(wizardTurn, "wizard")) accept(wizardTurn, action);
});
