import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch, MAX_ROUNDS } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";

// Issue #90, trap T2: set-trap action and legal list (contract section 3).
// The shipped catalog has no trap card and no approved trap name or ID, so
// these tests use one fixture card that exists only in this file. It reaches
// the engine through the `cards` option of applyAction and legalActions and
// is placed in a hand by editing a cloned state. CARDS and DECKS stay as shipped.
const TRAP_ID = "test-fixture-trap-1";
const TRAP_ID_2 = "test-fixture-trap-2";
const TEST_CARDS = Object.freeze({
  ...CARDS,
  [TRAP_ID]: Object.freeze({ id: TRAP_ID, side: "cowboy", kind: "trap", name: "Test fixture trap" }),
  [TRAP_ID_2]: Object.freeze({ id: TRAP_ID_2, side: "cowboy", kind: "trap", name: "Test fixture trap" }),
});
const OPT = { cards: TEST_CARDS };

// Seed 0, cowboy to act in round 1. Cowboy hand: mounted-billy-1, deadeye-1
// (spell), sheriff-5, billy-3, plus the fixture trap. The wizard's
// skeleton-1 moves from hand to wizard slot 0 so a spell has a target.
function trapMatch({ traps = true, trapInHand = true } = {}) {
  const state = structuredClone(createMatch(0, { traps }));
  if (trapInHand) state.sides.cowboy.hand.push(TRAP_ID);
  const wizard = state.sides.wizard;
  wizard.hand.splice(wizard.hand.indexOf("wizard-skeleton-1"), 1);
  wizard.board[0] = { cardId: "wizard-skeleton-1", health: CARDS["wizard-skeleton-1"].health };
  return state;
}

const act = (state, fields) => ({ side: state.activeSide, revision: state.revision, ...fields });
const setTrap = (state, extra = {}) => act(state, { type: "set-trap", cardId: TRAP_ID, ...extra });
const summonSheriff = (state) => act(state, { type: "summon", cardId: "cowboy-sheriff-5", slot: 0, tributes: [] });
const castDeadeye = (state) => act(state, { type: "spell", cardId: "cowboy-deadeye-1", target: 0 });

function accept(state, action, options = OPT) {
  const result = applyAction(state, action, options);
  assert.equal(result.ok, true, result.reason);
  return result;
}

// A rejection returns the very input object, emits nothing and leaves it unchanged.
function assertRejected(state, action, reason, options = OPT) {
  const before = structuredClone(state);
  const result = applyAction(state, action, options);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.state, state);
  assert.equal("events" in result, false);
  assert.deepEqual(state, before);
}

test("set-trap is accepted from hand: card to own zone, castUsed, tactical trap, one revision, no RNG, one trap-set event", () => {
  const state = trapMatch();
  const before = structuredClone(state);
  const { state: next, events } = accept(state, setTrap(state, { actionId: "t-1" }));

  assert.deepEqual(state, before, "input not mutated");
  assert.equal(next.sides.cowboy.hand.includes(TRAP_ID), false);
  assert.deepEqual(next.sides.cowboy.hand, before.sides.cowboy.hand.filter((id) => id !== TRAP_ID));
  assert.deepEqual(next.sides.cowboy.trap, { cardId: TRAP_ID, setRound: 1 });
  assert.deepEqual(next.allowances.cowboy, { summonUsed: false, castUsed: true, tactical: "trap" });
  assert.deepEqual(next.allowances.wizard, before.allowances.wizard);
  assert.equal(next.revision, state.revision + 1);
  assert.equal(next.rng, state.rng);
  assert.deepEqual(next.actionIds, ["t-1"]);
  assert.equal(next.activeSide, "cowboy");
  assert.deepEqual(events, [{ type: "trap-set", side: "cowboy", cardId: TRAP_ID, revision: 0, actionId: "t-1" }]);

  // Only the set side's hand, trap, allowance, revision and actionIds change.
  const expected = structuredClone(before);
  expected.sides.cowboy.hand = next.sides.cowboy.hand;
  expected.sides.cowboy.trap = { cardId: TRAP_ID, setRound: 1 };
  expected.allowances.cowboy = { summonUsed: false, castUsed: true, tactical: "trap" };
  expected.revision = 1;
  expected.actionIds = ["t-1"];
  assert.deepEqual(next, expected);
});

test("set-trap records setRound as the current round", () => {
  const state = trapMatch();
  state.round = 4;
  assert.deepEqual(accept(state, setTrap(state)).state.sides.cowboy.trap, { cardId: TRAP_ID, setRound: 4 });
});

test("set-trap rejections follow contract section 3 order", () => {
  // 1 traps-disabled: flag off, even with the fixture in hand and in the catalog.
  const off = trapMatch({ traps: false });
  assertRejected(off, setTrap(off), "traps-disabled");
  assertRejected(off, setTrap(off), "traps-disabled", {});

  // 2 card-not-in-hand: unknown ID, an opponent's card, a card still in the deck.
  const on = trapMatch();
  assertRejected(on, setTrap(on, { cardId: "no-such-card" }), "card-not-in-hand");
  assertRejected(on, setTrap(on, { cardId: "wizard-singularity-1" }), "card-not-in-hand");
  assertRejected(on, setTrap(on, { cardId: on.sides.cowboy.deck[0] }), "card-not-in-hand");
  assertRejected(on, setTrap(on, { cardId: undefined }), "card-not-in-hand");

  // 3 not-a-trap: a troop, a spell, and the fixture under the shipped catalog.
  assertRejected(on, setTrap(on, { cardId: "cowboy-sheriff-5" }), "not-a-trap");
  assertRejected(on, setTrap(on, { cardId: "cowboy-deadeye-1" }), "not-a-trap");
  assertRejected(on, setTrap(on), "not-a-trap", {});
  assertRejected(on, setTrap(on), "not-a-trap", { cards: CARDS });

  // 4 trap-too-late wins over a full zone and a used cast.
  const late = trapMatch();
  late.round = MAX_ROUNDS;
  assertRejected(late, setTrap(late), "trap-too-late");
  late.sides.cowboy.trap = { cardId: "placeholder", setRound: 1 };
  late.allowances.cowboy = { summonUsed: false, castUsed: true, tactical: "spell" };
  assertRejected(late, setTrap(late), "trap-too-late");

  // 5 trap-zone-full wins over a used cast; an armed trap fills the zone too.
  const full = trapMatch();
  full.round = 3;
  full.sides.cowboy.trap = { cardId: "placeholder", setRound: 2 };
  assertRejected(full, setTrap(full), "trap-zone-full");
  full.allowances.cowboy = { summonUsed: false, castUsed: true, tactical: "spell" };
  assertRejected(full, setTrap(full), "trap-zone-full");

  // 6 trap-after-spell.
  const cast = accept(on, castDeadeye(on)).state;
  assertRejected(cast, setTrap(cast), "trap-after-spell");
});

test("shared checks keep their precedence over set-trap reasons", () => {
  const off = trapMatch({ traps: false });
  const on = trapMatch();
  for (const state of [off, on]) {
    assertRejected(state, null, "invalid-action");
    assertRejected(state, setTrap(state, { actionId: "" }), "invalid-action");
    assertRejected(state, setTrap(state, { revision: state.revision + 1 }), "stale");
    assertRejected(state, setTrap(state, { side: "wizard" }), "wrong-side");
    const over = structuredClone(state);
    over.result = { winner: "wizard", loser: "cowboy", reason: "test", round: 1 };
    over.activeSide = null;
    assertRejected(over, setTrap(over), "match-over");
  }
  const { state: next } = accept(on, act(on, { type: "end-phase", actionId: "dup" }));
  next.sides.wizard.hand.push(TRAP_ID);
  assertRejected(next, setTrap(next, { actionId: "dup" }), "duplicate-action");
  // Wrong side wins over a too-late round and a full zone.
  const late = trapMatch();
  late.round = MAX_ROUNDS;
  late.sides.cowboy.trap = { cardId: "placeholder", setRound: 1 };
  assertRejected(late, setTrap(late, { side: "wizard" }), "wrong-side");
});

test("action economy: summon then set is legal; a set blocks a later summon and cast", () => {
  const start = trapMatch();
  const summoned = accept(start, summonSheriff(start)).state;
  const afterBoth = accept(summoned, setTrap(summoned)).state;
  assert.deepEqual(afterBoth.allowances.cowboy, { summonUsed: true, castUsed: true, tactical: "trap" });
  assertRejected(afterBoth, castDeadeye(afterBoth), "cast-after-trap");
  assertRejected(afterBoth, summonSheriff(afterBoth), "summon-used");

  const set = accept(start, setTrap(start)).state;
  assertRejected(set, summonSheriff(set), "summon-after-trap");
  assertRejected(set, castDeadeye(set), "cast-after-trap");
  assertRejected(set, setTrap(set), "card-not-in-hand");
  // A second set in one round reports the zone, not the allowance.
  const twoTraps = trapMatch();
  twoTraps.sides.cowboy.hand.push(TRAP_ID_2);
  const setOne = accept(twoTraps, setTrap(twoTraps)).state;
  assertRejected(setOne, setTrap(setOne, { cardId: TRAP_ID_2 }), "trap-zone-full");
  // The phase can still end normally.
  assert.equal(accept(set, act(set, { type: "end-phase" })).state.activeSide, "wizard");
});

test("spells on a trap match keep their reasons and mark tactical spell", () => {
  const start = trapMatch();
  const cast = accept(start, castDeadeye(start)).state;
  assert.deepEqual(cast.allowances.cowboy, { summonUsed: false, castUsed: true, tactical: "spell" });
  assertRejected(cast, summonSheriff(cast), "summon-after-spell");
  assertRejected(cast, setTrap(cast), "trap-after-spell");
  cast.sides.cowboy.hand.push("cowboy-deadeye-2");
  cast.sides.cowboy.deck.splice(cast.sides.cowboy.deck.indexOf("cowboy-deadeye-2"), 1);
  assertRejected(cast, act(cast, { type: "spell", cardId: "cowboy-deadeye-2", target: 0 }), "cast-used");
});

test("flag off: spells add no tactical key and old reasons stay", () => {
  const start = trapMatch({ traps: false, trapInHand: false });
  const cast = accept(start, castDeadeye(start)).state;
  assert.deepEqual(cast.allowances.cowboy, { summonUsed: false, castUsed: true });
  assertRejected(cast, summonSheriff(cast), "summon-after-spell");
});

test("a set trap stays in the zone across round start; the allowance resets", () => {
  let state = accept(trapMatch(), setTrap(trapMatch())).state;
  state = accept(state, act(state, { type: "end-phase" })).state;
  state = accept(state, act(state, { type: "end-phase" })).state;
  assert.equal(state.round, 2);
  assert.deepEqual(state.sides.cowboy.trap, { cardId: TRAP_ID, setRound: 1 });
  for (const side of SIDES) assert.deepEqual(state.allowances[side], { summonUsed: false, castUsed: false, tactical: null });
});

test("legalActions lists set-trap once, after spells and before end-phase, and every entry is accepted", () => {
  const state = trapMatch();
  const actions = legalActions(state, "cowboy", OPT);
  const types = actions.map((a) => a.type);
  assert.deepEqual(actions.filter((a) => a.type === "set-trap"), [{ type: "set-trap", side: "cowboy", revision: 0, cardId: TRAP_ID }]);
  assert.equal(types.lastIndexOf("spell") < types.indexOf("set-trap"), true);
  assert.equal(types.indexOf("set-trap"), types.length - 2);
  assert.equal(types.at(-1), "end-phase");
  for (const action of actions) assert.equal(applyAction(state, action, OPT).ok, true, JSON.stringify(action));
  // Same list as the shipped catalog gives for the hand without the fixture, plus the set entry.
  assert.deepEqual(actions.filter((a) => a.type !== "set-trap"), legalActions(trapMatch({ trapInHand: false }), "cowboy"));
});

test("legalActions omits set-trap whenever applyAction would reject it", () => {
  const omits = (state, options = OPT) =>
    assert.equal(legalActions(state, state.activeSide, options).some((a) => a.type === "set-trap"), false);
  omits(trapMatch({ traps: false }));
  omits(trapMatch({ trapInHand: false }));
  const late = trapMatch();
  late.round = MAX_ROUNDS;
  omits(late);
  const full = trapMatch();
  full.sides.cowboy.trap = { cardId: "placeholder", setRound: 1 };
  omits(full);
  const start = trapMatch();
  omits(accept(start, castDeadeye(start)).state);

  // After a set only end-phase is left.
  const set = accept(start, setTrap(start)).state;
  assert.deepEqual(legalActions(set, "cowboy", OPT), [{ type: "end-phase", side: "cowboy", revision: 1 }]);
  // After a summon the set is still listed.
  const summoned = accept(start, summonSheriff(start)).state;
  assert.equal(legalActions(summoned, "cowboy", OPT).some((a) => a.type === "set-trap"), true);
});

// First-legal-action policy over a whole match. With no trap card in any
// hand, a trap match must play the same actions and events as a default one.
function playFirstLegal(state, options) {
  const log = [];
  for (let step = 0; step < 500 && !state.result; step++) {
    const action = legalActions(state, state.activeSide, options)[0];
    const result = applyAction(state, action, options);
    assert.equal(result.ok, true, result.reason);
    log.push(action, ...result.events);
    state = result.state;
  }
  return { state, log };
}

test("with no trap card dealt, flag on and the cards option change no play for seeds 0 and 60", () => {
  for (const seed of [0, 60]) {
    const off = playFirstLegal(createMatch(seed));
    assert.notEqual(off.state.result, null);
    assert.deepEqual(playFirstLegal(createMatch(seed), { cards: CARDS }), off);
    assert.deepEqual(playFirstLegal(createMatch(seed), OPT), off);
    const on = playFirstLegal(createMatch(seed, { traps: true }), OPT);
    assert.deepEqual(on.log, off.log);
    assert.deepEqual(on.state.result, off.state.result);
    assert.equal(on.log.some((entry) => entry.type === "set-trap" || entry.type === "trap-set"), false);
  }
});

test("the shipped catalog and decks hold no trap card", () => {
  assert.equal(Object.isFrozen(CARDS), true);
  assert.equal(Object.values(CARDS).some((card) => card.kind === "trap"), false);
  assert.equal(TRAP_ID in CARDS, false);
});
