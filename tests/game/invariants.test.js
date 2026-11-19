// Seeded invariant checks: for a fixed list of match seeds, a seeded picker
// local to this file plays random legal actions until the match ends, and the
// invariants below are asserted after every step. Ride-outs (card-level, Mounted
// Billy in standard duels) are enumerated independently and modelled exactly.
// No testing library is used.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch, BASE_ORBS, MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";

const SEEDS = Array.from({ length: 100 }, (_, seed) => seed); // 0-99, so 14, 27 and 47 are included
// Nine rounds, two sides, at most summon + spell + end-phase each.
const MAX_STEPS = MAX_ROUNDS * SIDES.length * 3;

// mulberry32, kept separate from the engine's generator on purpose.
function picker(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertInvariants(state, label) {
  // Card conservation: the 24 selected default IDs, each in exactly one zone of its own side.
  const seen = [];
  for (const side of SIDES) {
    const { baseOrbs, deck, hand, board, discard } = state.sides[side];
    const ids = [...deck, ...hand, ...discard, ...board.filter(Boolean).map((troop) => troop.cardId)];
    for (const id of ids) assert.equal(CARDS[id]?.side, side, `${label}: ${id} is in a ${side} zone`);
    seen.push(...ids);

    // Health bounds.
    assert.equal(board.length, SLOT_COUNT, label);
    for (const troop of board.filter(Boolean)) {
      const card = CARDS[troop.cardId];
      assert.equal(card.kind, "troop", label);
      assert.ok(Number.isInteger(troop.health) && troop.health >= 1 && troop.health <= card.health, `${label}: ${troop.cardId} health ${troop.health}`);
      assert.ok(card.health <= 5, label);
    }
    assert.ok(Number.isInteger(baseOrbs) && baseOrbs >= 0 && baseOrbs <= BASE_ORBS, `${label}: ${side} base ${baseOrbs}`);
    // One draw per side per round after the first, from an eight-card deck.
    assert.equal(deck.length, MAX_ROUNDS - state.round, `${label}: ${side} deck size`);
  }
  assert.equal(seen.length, 24, label);
  assert.deepEqual(seen.sort(), Object.values(DECKS).flat().sort(), label);

  assert.ok(Number.isInteger(state.round) && state.round >= 1 && state.round <= MAX_ROUNDS, `${label}: round ${state.round}`);
  const baseDown = SIDES.some((side) => state.sides[side].baseOrbs === 0);
  if (state.result) {
    assert.equal(state.activeSide, null, label);
    assert.ok(baseDown || state.round === MAX_ROUNDS, label);
  } else {
    assert.ok(SIDES.includes(state.activeSide), label);
    assert.equal(baseDown, false, `${label}: a destroyed base without a result`);
  }
}

// Every well-formed action that side could try, legal or not, in the key
// order legalActions uses.
function candidates(state, side) {
  const base = { side, revision: state.revision };
  const slots = [0, 1, 2];
  const subsets = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
  const out = [];
  for (const cardId of state.sides[side].hand) {
    for (const tributes of subsets) for (const slot of slots) out.push({ type: "summon", ...base, cardId, slot, tributes });
    for (const target of slots) {
      out.push({ type: "spell", ...base, cardId, target });
      for (const destination of slots) out.push({ type: "spell", ...base, cardId, target, destination });
    }
  }
  // Ride-outs: every lane pair, adjacent or not, empty or not. applyAction
  // alone decides which are accepted (card-level `rides`, allowances, lanes).
  for (const slot of slots) for (const destination of slots) out.push({ type: "ride-out", ...base, slot, destination });
  out.push({ type: "end-phase", ...base });
  return out;
}

// Independent enumerator of the ride-outs `side` may play: written from the
// rule, not from legal.js. A troop whose card has `rides: true` moves one lane
// to an empty adjacent lane, on its side's turn, while neither the summon nor
// the cast allowance is used. Order: slot, then destination, ascending.
function expectedRideOuts(state, side) {
  const { summonUsed, castUsed } = state.allowances[side];
  if (state.result || state.activeSide !== side || summonUsed || castUsed) return [];
  const { board } = state.sides[side];
  const out = [];
  board.forEach((troop, slot) => {
    if (troop === null || CARDS[troop.cardId].rides !== true) return;
    for (const destination of [slot - 1, slot + 1]) {
      if (destination >= 0 && destination < SLOT_COUNT && board[destination] === null) {
        out.push({ type: "ride-out", side, revision: state.revision, slot, destination });
      }
    }
  });
  return out;
}

// The state a ride-out must produce, modelled from the rule: the troop object
// (card and health) changes lane, the summon allowance is spent, the revision
// advances; no card changes zone, nothing is drawn, no other side changes.
function modelRideOut(state, action) {
  const expected = structuredClone(state);
  const { board } = expected.sides[action.side];
  board[action.destination] = board[action.slot];
  board[action.slot] = null;
  expected.allowances[action.side].summonUsed = true;
  expected.revision += 1;
  if (action.actionId !== undefined) expected.actionIds.push(action.actionId);
  return expected;
}

// A match with the default deck's card-level rider on the Cowboy board in lane
// seed % 3. Fixture: it takes the rider from the hand (swapping with a hand
// card if it is in the deck), so every zone count the invariants check holds.
function stagedMatch(seed) {
  const state = createMatch(seed);
  const own = state.sides.cowboy;
  const id = DECKS.cowboy.find((each) => CARDS[each].rides === true);
  assert.ok(id, "the default Cowboy deck holds a card-level rider");
  const at = own.deck.indexOf(id);
  if (at !== -1) [own.deck[at], own.hand[0]] = [own.hand[0], own.deck[at]];
  own.hand.splice(own.hand.indexOf(id), 1);
  own.board[seed % SLOT_COUNT] = { cardId: id, health: CARDS[id].health };
  return state;
}

// `summonChance` is how often summons are offered to the picker. At 1 every
// legal action is equally likely; lower values give sparse boards and longer
// matches. Legality is still checked against the full list at every step.
function walk(seed, summonChance, start = createMatch) {
  const random = picker(seed ^ 0x5eed);
  let state = start(seed);
  const events = [];
  const played = {}; // "<round>:<side>" -> action types accepted in that phase
  let steps = 0;
  let rides = 0;
  assertInvariants(state, `seed ${seed} setup`);

  while (!state.result) {
    const label = `seed ${seed} step ${steps}`;
    assert.ok(steps < MAX_STEPS, `${label}: walk did not terminate`);
    const side = state.activeSide;
    const actions = legalActions(state, side);
    assert.deepEqual(legalActions(state, opponent(side)), [], label);

    // legalActions is exactly the set of candidates applyAction accepts.
    const accepted = candidates(state, side).filter((action) => applyAction(state, action).ok);
    assert.deepEqual(actions.map((a) => JSON.stringify(a)).sort(), accepted.map((a) => JSON.stringify(a)).sort(), label);

    // The ride-outs are exactly the independent enumerator's, in its order.
    assert.deepEqual(actions.filter((each) => each.type === "ride-out"), expectedRideOuts(state, side), `${label}: ride-outs`);

    const offered = random() < summonChance ? actions : actions.filter((each) => each.type !== "summon");
    const action = { ...offered[Math.floor(random() * offered.length)], actionId: `walk-${steps}` };
    const phase = (played[`${state.round}:${side}`] ??= []);
    // Per-round allowances: one summon, one spell, never a summon after the spell.
    // A ride-out spends the summon allowance and cannot follow a spell: it also needs an untouched phase.
    if (action.type === "summon" || action.type === "ride-out") assert.deepEqual(phase, [], label);
    if (action.type === "spell") assert.equal(phase.includes("spell"), false, label);
    assert.equal(phase.includes("end-phase"), false, label);
    phase.push(action.type);

    const snapshot = structuredClone(state);
    const result = applyAction(state, action);
    assert.equal(result.ok, true, `${label}: ${result.reason}`);
    assert.deepEqual(state, snapshot, `${label}: the input state was mutated`);
    if (action.type === "ride-out") {
      rides += 1;
      const { cardId, health } = state.sides[side].board[action.slot];
      assert.equal(CARDS[cardId].rides, true, `${label}: ${cardId} does not ride`);
      assert.equal(Math.abs(action.slot - action.destination), 1, label);
      assert.deepEqual(result.state, modelRideOut(state, action), `${label}: ride-out state`);
      assert.deepEqual(result.events, [{ type: "ride-out", side, cardId, slot: action.slot, destination: action.destination, health, revision: state.revision, actionId: action.actionId }], label);
    }
    assert.equal(result.state.revision, state.revision + 1, label);
    assert.equal(result.state.rng, state.rng, label);
    for (const event of result.events) {
      assert.equal(event.revision, state.revision, label);
      assert.equal(event.actionId, action.actionId, label);
      if (event.type === "draw") assert.deepEqual(Object.keys(event).sort(), ["actionId", "revision", "side", "type"], label);
    }
    events.push(...result.events);
    state = result.state;
    steps += 1;
    assertInvariants(state, label);
  }
  assert.deepEqual(legalActions(state, "cowboy"), []);
  assert.deepEqual(legalActions(state, "wizard"), []);
  return { state, events, steps, rides };
}

for (const [name, summonChance] of [["uniform", 1], ["sparse", 0.15]]) {
  test(`seeded invariant checks: ${name} legal-action walks over seeds 0-99`, (t) => {
    const steps = {};
    const endings = {};
    let rides = 0;
    for (const seed of SEEDS) {
      const first = walk(seed, summonChance);
      // Same seed, same picker: the whole walk replays identically.
      assert.deepEqual(walk(seed, summonChance), first, `seed ${seed} replay`);
      steps[seed] = first.steps;
      rides += first.rides;
      const { winner, reason } = first.state.result;
      const key = `${reason}/${winner ?? "draw"}`;
      endings[key] = (endings[key] ?? 0) + 1;
    }
    const counts = Object.values(steps);
    t.diagnostic(`walks: ${counts.length}, all terminated`);
    t.diagnostic(`steps: total ${counts.reduce((a, b) => a + b, 0)}, min ${Math.min(...counts)}, max ${Math.max(...counts)} (bound ${MAX_STEPS})`);
    t.diagnostic(`steps for seeds 14, 27, 47: ${[14, 27, 47].map((seed) => steps[seed]).join(", ")}`);
    t.diagnostic(`ride-outs played: ${rides}`);
    t.diagnostic(`endings: ${JSON.stringify(endings)}`);
  });

  // The same walks with Mounted Billy on the Cowboy board from the start, so
  // the Ride paths are certain to be reached on every run.
  test(`seeded invariant checks: ${name} walks with a card-level rider on the board, seeds 0-99`, (t) => {
    let rides = 0;
    for (const seed of SEEDS) {
      const first = walk(seed, summonChance, stagedMatch);
      assert.deepEqual(walk(seed, summonChance, stagedMatch), first, `seed ${seed} replay`);
      rides += first.rides;
    }
    assert.ok(rides > 0, "no ride-out was played in any staged walk");
    t.diagnostic(`staged ${name} walks: ride-outs played ${rides}`);
  });
}

test("ride-out is legal by card, turn and adjacent empty lane, and applied exactly", () => {
  const rider = DECKS.cowboy.find((id) => CARDS[id].rides === true);
  assert.equal(CARDS[rider].name, "Mounted Billy");
  const sheriff = DECKS.cowboy.find((id) => CARDS[id].name === "Sheriff");
  assert.equal(CARDS[sheriff].rides, undefined);
  const troop = (cardId, health = CARDS[cardId].health) => ({ cardId, health });
  const at = (board, allowances = {}) => {
    const state = createMatch(0);
    state.startingSide = state.activeSide = "cowboy";
    state.sides.cowboy.hand = [];
    state.sides.cowboy.board = board;
    Object.assign(state.allowances.cowboy, allowances);
    return state;
  };
  const rides = (state, side = "cowboy") => legalActions(state, side).filter((each) => each.type === "ride-out").map(({ slot, destination }) => `${slot}>${destination}`);
  const expectRides = (state, expected, label) => {
    assert.deepEqual(rides(state), expected, label);
    assert.deepEqual(legalActions(state, "cowboy").filter((each) => each.type === "ride-out"), expectedRideOuts(state, "cowboy"), label);
  };

  // By adjacent empty lane: lane 0 and 2 have one neighbour, lane 1 has two.
  expectRides(at([troop(rider), null, null]), ["0>1"], "lane 0");
  expectRides(at([null, troop(rider), null]), ["1>0", "1>2"], "lane 1");
  expectRides(at([null, null, troop(rider)]), ["2>1"], "lane 2");
  expectRides(at([troop(rider), null, troop(rider)]), ["0>1", "2>1"], "two riders share a lane");
  // Blocked by an occupied neighbour, friendly rider or not; only the free side remains.
  expectRides(at([troop(sheriff), troop(rider), null]), ["1>2"], "left neighbour occupied");
  expectRides(at([troop(rider), troop(sheriff), troop(rider)]), [], "both lanes blocked");
  // By card: an ordinary troop never rides, with or without a rider beside it.
  expectRides(at([null, troop(sheriff), null]), [], "ordinary troop");
  expectRides(at([troop(sheriff), null, troop(rider)]), ["2>1"], "ordinary troop beside an empty lane");
  // By turn and allowance: summon or cast spent, the other side, or the match over.
  const open = at([null, troop(rider), null]);
  expectRides(at([null, troop(rider), null], { summonUsed: true }), [], "summon used");
  expectRides(at([null, troop(rider), null], { castUsed: true }), [], "cast used");
  assert.deepEqual(rides(open, "wizard"), []);
  const over = at([null, troop(rider), null]);
  over.result = { winner: "cowboy", loser: "wizard", reason: "round-limit", round: 9 };
  over.activeSide = null;
  expectRides(over, [], "match over");

  // Rejected without the rule: ordinary troop, occupied or distant lane, and after a spent allowance.
  const reason = (state, action) => applyAction(state, { side: "cowboy", revision: state.revision, ...action }).reason;
  assert.equal(reason(at([null, troop(sheriff), null]), { type: "ride-out", slot: 1, destination: 2 }), "invalid-action");
  assert.equal(reason(open, { type: "ride-out", slot: 1, destination: 1 }), "invalid-destination");
  assert.equal(reason(at([troop(rider), null, null]), { type: "ride-out", slot: 0, destination: 2 }), "invalid-destination");
  assert.equal(reason(at([troop(rider), troop(sheriff), null]), { type: "ride-out", slot: 0, destination: 1 }), "destination-occupied");
  assert.equal(reason(at([null, null, null]), { type: "ride-out", slot: 0, destination: 1 }), "invalid-action");
  assert.equal(reason(at([null, troop(rider), null], { summonUsed: true }), { type: "ride-out", slot: 1, destination: 0 }), "summon-used");
  assert.equal(reason(at([null, troop(rider), null], { castUsed: true }), { type: "ride-out", slot: 1, destination: 0 }), "ride-out-after-spell");

  // Applied: the damaged troop keeps its health, nothing else changes, the allowance is spent, and a rider rides once.
  const hurt = at([null, troop(rider, 2), null]);
  const action = { type: "ride-out", side: "cowboy", revision: hurt.revision, slot: 1, destination: 0, actionId: "ride-1" };
  const before = structuredClone(hurt);
  const result = applyAction(hurt, action);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(hurt, before, "input state untouched");
  assert.deepEqual(result.state, modelRideOut(hurt, action));
  assert.deepEqual(result.state.sides.cowboy.board, [troop(rider, 2), null, null]);
  assert.deepEqual(result.events, [{ type: "ride-out", side: "cowboy", cardId: rider, slot: 1, destination: 0, health: 2, revision: hurt.revision, actionId: "ride-1" }]);
  assert.deepEqual(legalActions(result.state, "cowboy").map(({ type }) => type), ["end-phase"]);
  assert.equal(applyAction(result.state, { ...action, revision: result.state.revision }).reason, "duplicate-action");
  assert.equal(applyAction(result.state, { ...action, revision: result.state.revision, actionId: "ride-2", slot: 0, destination: 1 }).reason, "summon-used");
});
