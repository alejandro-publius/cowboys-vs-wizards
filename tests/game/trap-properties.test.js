// Issue #100, trap T7: card conservation and deterministic property tests for
// the opt-in A + X trap prototype (contract sections 2 to 6, requirements R1,
// R3 to R6, R8, R9, R11, R13). Headless; no presenter, renderer or 3D code.
//
// The shipped catalog has no trap card. The fixture IDs below exist only in
// this file; they reach the rules through the `cards` option and enter a
// cloned createMatch(seed, { traps: true }) state as EXTRA cards outside the
// 12-card decks. CARDS and DECKS stay as shipped. Nothing here is balance
// evidence.
//
// Two kinds of run are kept apart:
//   reachable: an injected opening, then only actions from legalActions or
//     chooseAction(publicState(...)), each accepted by applyAction;
//   probes: hand-built or deliberately corrupted states, labelled as such.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CARDS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch, BASE_ORBS, MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicEvents, publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { DEFAULT_PAUSES } from "../../src/match/presenter.js";

// Two copies of one anonymous fixture trap type per side, so the fixture
// itself has a legitimately repeated card type.
const FIXTURE_OF = Object.fromEntries(
  SIDES.map((side) => [side, [1, 2].map((copy) => `test-fixture-t7-trap-${side}-${copy}`)]),
);
const TEST_CARDS = Object.freeze({
  ...CARDS,
  ...Object.fromEntries(
    SIDES.flatMap((side) => FIXTURE_OF[side].map((id) => [id, Object.freeze({ id, side, kind: "trap", name: "Test fixture trap" })])),
  ),
});
const OPT = { cards: TEST_CARDS };
const FIXTURE_IDS = SIDES.flatMap((side) => FIXTURE_OF[side]);

// Event types the T6 presenter plays: the four animated ones plus every
// timed pause (presenter.js builds its EVENT_TYPES the same way).
const PRESENTER_TYPES = new Set(["summon", "spell", "damage", "defeat", ...Object.keys(DEFAULT_PAUSES)]);
const SIDE_KEYS = ["baseOrbs", "board", "deck", "discard", "hand", "trap"];
// Nine rounds, two phases, at most summon + one tactical action + end-phase.
const MAX_STEPS = MAX_ROUNDS * SIDES.length * 3;
const SAMPLE = Array.from({ length: 200 }, (_, seed) => seed); // 0-199, includes 0 and 60

// A card ID names one copy of a card type: "<type>-<copy>".
const cardType = (id) => id.replace(/-\d+$/, "");
const zonesOf = (own) => ({
  deck: own.deck,
  hand: own.hand,
  board: own.board.filter(Boolean).map((troop) => troop.cardId),
  trap: own.trap ? [own.trap.cardId] : [],
  discard: own.discard,
});
// Multiset (sorted [key, count] pairs) over deck + hand + board + trap + discard.
function multiset(state, side, key) {
  const counts = {};
  for (const ids of Object.values(zonesOf(state.sides[side]))) for (const id of ids) counts[key(id)] = (counts[key(id)] ?? 0) + 1;
  return Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1));
}
const census = (state) =>
  Object.fromEntries(SIDES.map((side) => [side, { types: multiset(state, side, cardType), ids: multiset(state, side, (id) => id) }]));

// Structural invariants of one state. `opening` is the census to conserve.
function assertState(state, opening, label) {
  assert.ok(Number.isInteger(state.round) && state.round >= 1 && state.round <= MAX_ROUNDS, `${label}: round ${state.round}`);
  for (const side of SIDES) {
    const own = state.sides[side];
    assert.deepEqual(Object.keys(own).sort(), SIDE_KEYS, `${label}: ${side} zone keys`);
    // One trap zone: null or a single { cardId, setRound } set in an earlier or the current round.
    if (own.trap !== null) {
      assert.ok(!Array.isArray(own.trap), `${label}: ${side} has more than one trap zone`);
      assert.deepEqual(Object.keys(own.trap).sort(), ["cardId", "setRound"], `${label}: ${side} trap shape`);
      assert.ok(Number.isInteger(own.trap.setRound) && own.trap.setRound >= 1 && own.trap.setRound <= state.round, `${label}: ${side} setRound`);
    }
    // Ownership: every card in a side's zones belongs to that side.
    for (const [zone, ids] of Object.entries(zonesOf(own))) {
      for (const id of ids) {
        const card = TEST_CARDS[id];
        assert.ok(card, `${label}: unknown card ${id} in ${side} ${zone}`);
        assert.equal(card.side, side, `${label}: ${id} (${card.side}) in ${side} ${zone}`);
        if (zone === "board") assert.equal(card.kind, "troop", `${label}: ${id} on ${side} board`);
        if (zone === "trap") assert.equal(card.kind, "trap", `${label}: ${id} in ${side} trap zone`);
      }
    }
    // Board: exactly three lanes, each empty or one living troop within its printed health.
    assert.ok(Array.isArray(own.board) && own.board.length === SLOT_COUNT, `${label}: ${side} board shape`);
    for (const troop of own.board.filter(Boolean)) {
      assert.deepEqual(Object.keys(troop).sort(), ["cardId", "health"], `${label}: ${side} troop shape`);
      const max = TEST_CARDS[troop.cardId].health;
      assert.ok(Number.isInteger(troop.health) && troop.health >= 1 && troop.health <= max && max <= 5, `${label}: ${troop.cardId} health ${troop.health}`);
    }
    assert.ok(Number.isInteger(own.baseOrbs) && own.baseOrbs >= 0 && own.baseOrbs <= BASE_ORBS, `${label}: ${side} base ${own.baseOrbs}`);
  }
  assert.deepEqual(census(state), opening, `${label}: card multiset changed`);
}

// The pre-trigger expectation for a clash on board `prev` (contract section 4).
function expectedTriggers(prev) {
  const out = [];
  for (const side of SIDES) {
    const trap = prev.sides[side].trap;
    if (!trap || !(trap.setRound < prev.round)) continue;
    const enemySide = opponent(side);
    let slot = -1;
    prev.sides[enemySide].board.forEach((troop, lane) => {
      if (troop && (slot === -1 || CARDS[troop.cardId].attack > CARDS[prev.sides[enemySide].board[slot].cardId].attack)) slot = lane;
    });
    if (slot === -1) continue;
    const { cardId } = prev.sides[enemySide].board[slot];
    out.push({ type: "trap-trigger", side, cardId: trap.cardId, target: { side: enemySide, slot, cardId }, cancelled: CARDS[cardId].attack });
  }
  return out;
}

const strip = ({ revision, actionId, ...rest }) => rest;
const count = (list, id) => list.filter((each) => each === id).length;

// Per-step properties of one accepted action from `prev` to `next`.
function assertStep(prev, action, next, events, label) {
  for (const event of events) assert.ok(PRESENTER_TYPES.has(event.type), `${label}: event type ${event.type} unknown to T6`);
  const types = events.map((event) => event.type);
  const triggers = events.filter((event) => event.type === "trap-trigger");
  const clashes = action.type === "end-phase" && action.side !== prev.startingSide;

  if (!clashes) {
    assert.deepEqual(triggers, [], `${label}: trigger outside a clash`);
  } else {
    // The end-phase changes no board before the clash, so `prev` is the snapshot.
    const expected = expectedTriggers(prev);
    assert.deepEqual(triggers.map(strip), expected, `${label}: trigger set, order or target`);
    // Fixed order: clash, trap-trigger*, damage*.
    const at = types.indexOf("clash");
    assert.deepEqual(types.slice(at + 1, at + 1 + expected.length), expected.map(() => "trap-trigger"), `${label}: trigger order`);
    // Exactly the uncancelled troops attack, lane order, then SIDES order: no phantom damage.
    const cancelled = expected.map(({ target }) => `${target.side}:${target.slot}`);
    const attackers = [];
    for (let lane = 0; lane < SLOT_COUNT; lane++) {
      for (const side of SIDES) {
        const troop = prev.sides[side].board[lane];
        if (troop && !cancelled.includes(`${side}:${lane}`)) attackers.push({ side, slot: lane, cardId: troop.cardId });
      }
    }
    const damage = events.filter((event) => event.type === "damage");
    assert.deepEqual(damage.map((event) => event.attacker), attackers, `${label}: damage attackers`);
    for (const event of damage) assert.equal(event.amount, CARDS[event.attacker.cardId].attack, `${label}: damage amount`);
    // Spent once to discard; an armed trap with no target, or an unarmed one, stays.
    for (const side of SIDES) {
      const fired = expected.find((each) => each.side === side);
      const before = prev.sides[side];
      if (fired) {
        assert.equal(next.sides[side].trap, null, `${label}: ${side} trap not cleared`);
        assert.equal(count(next.sides[side].discard, fired.cardId), count(before.discard, fired.cardId) + 1, `${label}: ${side} trap not in discard`);
      } else {
        assert.deepEqual(next.sides[side].trap, before.trap, `${label}: ${side} trap changed without a trigger`);
      }
    }
  }

  if (action.type === "set-trap") {
    assert.equal(prev.sides[action.side].trap, null, `${label}: set onto a full zone`);
    assert.equal(prev.allowances[action.side].castUsed, false, `${label}: set after the tactical action`);
    assert.ok(prev.round < MAX_ROUNDS, `${label}: set in round ${prev.round}`);
    assert.deepEqual(next.sides[action.side].trap, { cardId: action.cardId, setRound: prev.round }, `${label}: zone after set`);
    assert.equal(next.allowances[action.side].tactical, "trap", label);
  }
  if (action.type !== "end-phase") {
    // Only an end-phase can spend or move a trap of the other side.
    assert.deepEqual(next.sides[opponent(action.side)].trap, prev.sides[opponent(action.side)].trap, `${label}: opponent zone changed`);
  }

  // Hidden information (R5): for each viewer, an opponent fixture ID appears in
  // that viewer's state or events only once it is in the opponent's public discard.
  for (const viewer of SIDES) {
    const enemy = opponent(viewer);
    const projected = publicEvents(events, viewer);
    for (const event of projected) {
      if (event.type === "trap-set" && event.side === enemy) assert.equal("cardId" in event, false, `${label}: ${viewer} sees enemy trap-set cardId`);
    }
    for (const event of triggers) assert.ok(projected.some((each) => each.type === "trap-trigger" && each.cardId === event.cardId), `${label}: trigger not public`);
    const view = publicState(next, viewer);
    const seen = JSON.stringify([view, projected]);
    for (const id of FIXTURE_OF[enemy]) {
      if (!next.sides[enemy].discard.includes(id)) assert.equal(seen.includes(id), false, `${label}: ${viewer} sees hidden ${id}`);
    }
    const ownTrap = next.sides[viewer].trap;
    const enemyTrap = next.sides[enemy].trap;
    assert.deepEqual(view.sides[viewer].trap, ownTrap && { cardId: ownTrap.cardId, setRound: ownTrap.setRound }, `${label}: own trap view`);
    assert.deepEqual(view.sides[enemy].trap, enemyTrap && { faceDown: true, setRound: enemyTrap.setRound }, `${label}: enemy trap view`);
  }
}

// A state with the same public view for `side` but different hidden facts:
// another seed and RNG, other deck orders, one opponent hand card swapped
// with its deck, and the opponent's face-down trap holding the other copy.
function hiddenVariant(state, side) {
  const alt = structuredClone(state);
  alt.seed += 1;
  alt.rng = (alt.rng ^ 0x9e3779b9) >>> 0;
  const enemy = alt.sides[opponent(side)];
  for (const each of SIDES) alt.sides[each].deck.reverse();
  if (enemy.hand.length > 0 && enemy.deck.length > 0) [enemy.hand[0], enemy.deck[0]] = [enemy.deck[0], enemy.hand[0]];
  if (enemy.trap) {
    const [a, b] = FIXTURE_OF[opponent(side)];
    enemy.trap = { ...enemy.trap, cardId: enemy.trap.cardId === a ? b : a };
  }
  return alt;
}

// Injected opening: one fixture trap in each hand and the second copy at a
// seed-dependent deck position. Both sides then hold 14 cards.
function opening(seed) {
  const state = structuredClone(createMatch(seed, { traps: true }));
  for (const side of SIDES) {
    const own = state.sides[side];
    const [inHand, inDeck] = FIXTURE_OF[side];
    own.hand.push(inHand);
    own.deck.splice((seed + (side === "wizard" ? 3 : 0)) % (own.deck.length + 1), 0, inDeck);
  }
  return state;
}

// mulberry32 picker for the random walk, separate from the engine's RNG.
function picker(seed) {
  let a = (seed ^ 0x7a7) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plays one reachable match from opening(seed) and checks every step.
// mode "cpu": both sides use the normal CPU on their own public view.
// mode "walk": a seeded uniform pick from legalActions with the fixture catalog.
function play(seed, mode) {
  const start = opening(seed);
  const base = census(start);
  assertState(start, base, `${mode} seed ${seed} setup`);
  const random = picker(seed);
  const trace = [];
  const events = [];
  const stats = { sets: 0, triggers: 0, idle: 0 };
  let state = start;
  while (!state.result) {
    const step = trace.length;
    const side = state.activeSide;
    let label = `${mode} seed ${seed} step ${step} round ${state.round} ${side}`;
    assert.ok(step < MAX_STEPS, `${label}: no result`);
    let action;
    if (mode === "cpu") {
      const view = publicState(state, side);
      const frozen = structuredClone(view);
      action = chooseAction(view, OPT);
      assert.deepEqual(view, frozen, `${label}: CPU changed its view`);
      // R11: the view, and so the choice, is blind to hidden facts.
      const altView = publicState(hiddenVariant(state, side), side);
      assert.deepEqual(altView, view, `${label}: public view leaks hidden state`);
      assert.deepEqual(chooseAction(altView, OPT), action, `${label}: CPU choice depends on hidden state`);
    } else {
      const actions = legalActions(state, side, OPT);
      action = actions[Math.floor(random() * actions.length)];
    }
    label += ` ${JSON.stringify(action)}`;
    const before = structuredClone(state);
    const applied = applyAction(state, action, OPT);
    assert.equal(applied.ok, true, `${label}: rejected ${applied.reason}`);
    assert.deepEqual(state, before, `${label}: input state mutated`);
    assert.notEqual(applied.state, state, label);
    assert.equal(applied.state.rng, state.rng, `${label}: RNG touched`);
    assertState(applied.state, base, label);
    assertStep(state, action, applied.state, applied.events, label);

    if (action.type === "set-trap") stats.sets += 1;
    stats.triggers += applied.events.filter((event) => event.type === "trap-trigger").length;
    if (action.type === "end-phase" && action.side !== state.startingSide) {
      stats.idle += SIDES.filter((each) => {
        const trap = state.sides[each].trap;
        return trap && trap.setRound < state.round && state.sides[opponent(each)].board.every((troop) => troop === null);
      }).length;
    }
    trace.push(action);
    events.push(...applied.events);
    state = applied.state;
  }
  return { start, trace, events, state, stats };
}

// Re-applies a recorded action list from a fresh injected opening.
function replay(seed, trace) {
  let state = opening(seed);
  const events = [];
  trace.forEach((action, step) => {
    const applied = applyAction(state, action, OPT);
    assert.equal(applied.ok, true, `replay seed ${seed} step ${step} ${JSON.stringify(action)}: ${applied.reason}`);
    events.push(...applied.events);
    state = applied.state;
  });
  return { events, state };
}

const digest = (run) => createHash("sha256").update(JSON.stringify([run.trace, run.events, run.state])).digest("hex");

// ---------------------------------------------------------------- reachable

for (const mode of ["cpu", "walk"]) {
  test(`reachable ${mode} matches, seeds 0-199: conservation, zones, triggers, redaction, immutability and replay`, (t) => {
    const totals = { sets: 0, triggers: 0, idle: 0, endings: {} };
    for (const seed of SAMPLE) {
      const run = play(seed, mode);
      const again = replay(seed, run.trace);
      assert.deepEqual(again.events, run.events, `${mode} seed ${seed}: replay events differ`);
      assert.deepEqual(again.state, run.state, `${mode} seed ${seed}: replay state differs`);
      for (const key of ["sets", "triggers", "idle"]) totals[key] += run.stats[key];
      const key = `${run.state.result.reason}/${run.state.result.winner ?? "draw"}`;
      totals.endings[key] = (totals.endings[key] ?? 0) + 1;
    }
    // The sample must actually exercise the trap paths it claims to check.
    assert.ok(totals.sets > SAMPLE.length, `${mode}: ${totals.sets} sets`);
    assert.ok(totals.triggers > 0, `${mode}: no trigger`);
    t.diagnostic(`${mode}: ${SAMPLE.length} matches, sets ${totals.sets}, triggers ${totals.triggers}, armed-without-target clashes ${totals.idle}`);
    t.diagnostic(`${mode} endings: ${JSON.stringify(totals.endings)}`);
  });
}

// SHA-256 of [trace, events, final state] for the injected openings, recorded
// on main ac000c1 when this file was written. A change means seed 0 or 60
// plays differently with fixture traps on.
const RECORDED = {
  cpu: {
    0: "2e931bf4ac3c04076848b121614377ab4af934446395572c085a30c38daa7d43",
    60: "8b43ffbe1121852204210c5eb453a7a9c17cd058479c61de78ca0032efcf6c11",
  },
  walk: {
    0: "1f9623ca35cb7efd48b26bda2d0d4734c656f87e40f25ddd16de74f041d5c0f8",
    60: "5187db0f06d3c2f920c35a041f06108b6769a6a8f20da64cbd9e7e14ddc436b8",
  },
};

test("seeds 0 and 60 with fixture traps replay to the recorded traces", (t) => {
  for (const mode of ["cpu", "walk"]) {
    for (const seed of [0, 60]) {
      const first = play(seed, mode);
      assert.deepEqual(play(seed, mode), first, `${mode} seed ${seed}: second run differs`);
      assert.equal(digest(first), RECORDED[mode][seed], `${mode} seed ${seed}: trace changed`);
      const { result } = first.state;
      t.diagnostic(`${mode} seed ${seed}: ${first.trace.length} actions, sets ${first.stats.sets}, triggers ${first.stats.triggers}, ${result.reason}/${result.winner ?? "draw"} round ${result.round}`);
    }
  }
});

test("flag off: seeds 0 and 60 CPU matches add no trap key, action or event and keep the seed 60 baseline", () => {
  for (const seed of [0, 60]) {
    const run = (state) => {
      const events = [];
      while (!state.result) {
        assert.ok(events.length < 2000, `seed ${seed}`);
        const applied = applyAction(state, chooseAction(publicState(state, state.activeSide)));
        assert.equal(applied.ok, true, `seed ${seed}: ${applied.reason}`);
        events.push(...applied.events);
        state = applied.state;
      }
      return { state, events };
    };
    const off = run(createMatch(seed));
    const text = JSON.stringify(off);
    for (const word of ["trap", "tactical"]) assert.equal(text.includes(word), false, `seed ${seed}: ${word} with flag off`);
    for (const event of off.events) assert.ok(PRESENTER_TYPES.has(event.type), event.type);
    const on = run(createMatch(seed, { traps: true }));
    assert.deepEqual(on.events, off.events, `seed ${seed}: flag on with no trap dealt plays differently`);
    if (seed === 60) {
      // Recorded by scripts/play-match.mjs --seed 60 (see trap-clash.test.js).
      assert.deepEqual(off.state.result, { winner: "cowboy", loser: "wizard", reason: "base-destroyed", round: 9 });
      assert.equal(off.state.revision, 40);
    }
  }
  for (const seed of SAMPLE) {
    const text = JSON.stringify(createMatch(seed));
    assert.equal(text.includes("trap") || text.includes("tactical"), false, `seed ${seed}`);
  }
});

// ---------------------------------------------------------------- probes

// Hand-built: the given troops move from deck or hand to the board at full
// health; both traps are armed (setRound 1, round 2). Not a reachable match.
function boardProbe(boards, baseOrbs) {
  const state = opening(0);
  state.round = 2;
  state.startingSide = state.activeSide = "cowboy";
  for (const side of SIDES) {
    const own = state.sides[side];
    boards[side].forEach((cardId, slot) => {
      if (cardId === null) return;
      const from = own.hand.includes(cardId) ? own.hand : own.deck;
      assert.ok(from.includes(cardId), `probe: ${cardId} not held by ${side}`);
      from.splice(from.indexOf(cardId), 1);
      own.board[slot] = { cardId, health: CARDS[cardId].health };
    });
    const id = FIXTURE_OF[side][0];
    own.hand.splice(own.hand.indexOf(id), 1);
    own.trap = { cardId: id, setRound: 1 };
    own.baseOrbs = baseOrbs;
  }
  return state;
}

// Every board of 0-3 troops per side from the default deck's troop types
// (attack 1, 2, 3; at most the one attack-3 copy the deck holds).
function boards(side) {
  const byAttack = { 1: [], 2: [], 3: [] };
  for (const id of opening(0).sides[side].deck.concat(opening(0).sides[side].hand)) {
    if (CARDS[id]?.kind === "troop") byAttack[CARDS[id].attack].push(id);
  }
  for (const list of Object.values(byAttack)) list.sort();
  const out = [];
  for (const a of [0, 1, 2, 3]) for (const b of [0, 1, 2, 3]) for (const c of [0, 1, 2, 3]) {
    const used = { 1: 0, 2: 0, 3: 0 };
    const lanes = [a, b, c].map((attack) => (attack === 0 ? null : byAttack[attack][used[attack]++] ?? false));
    if (!lanes.includes(false)) out.push(lanes);
  }
  return out;
}

test("probe: both traps armed over every 0-3 troop board pair resolve as the contract says", () => {
  let fired = 0;
  let idle = 0;
  const cowboyBoards = boards("cowboy");
  const wizardBoards = boards("wizard");
  for (const baseOrbs of [5, 1]) {
    for (const cowboy of cowboyBoards) {
      for (const wizard of wizardBoards) {
        let state = boardProbe({ cowboy, wizard }, baseOrbs);
        const base = census(state);
        for (let i = 0; i < 2; i++) {
          const action = { type: "end-phase", side: state.activeSide, revision: state.revision };
          const label = `probe orbs ${baseOrbs} cowboy ${cowboy} wizard ${wizard} end ${i}`;
          const applied = applyAction(state, action, OPT);
          assert.equal(applied.ok, true, `${label}: ${applied.reason}`);
          assertState(applied.state, base, label);
          assertStep(state, action, applied.state, applied.events, label);
          fired += applied.events.filter((event) => event.type === "trap-trigger").length;
          state = applied.state;
        }
        idle += SIDES.filter((side) => state.sides[side].trap !== null).length;
      }
    }
  }
  assert.ok(fired > 0 && idle > 0, `fired ${fired}, idle ${idle}`);
});

test("probe: a trap set this round never triggers this round, and triggers once at the next eligible clash", () => {
  // Hand-built: the Cowboy sets in round 2 with a Wizard troop present.
  let state = boardProbe({ cowboy: [null, null, null], wizard: [null, "wizard-skeleton-1", null] }, 5);
  state.sides.cowboy.hand.push(state.sides.cowboy.trap.cardId);
  state.sides.cowboy.trap = null;
  state.sides.wizard.hand.push(state.sides.wizard.trap.cardId);
  state.sides.wizard.trap = null;
  const base = census(state);
  const cardId = FIXTURE_OF.cowboy[0];
  const script = [
    { type: "set-trap", side: "cowboy", cardId },
    { type: "end-phase", side: "cowboy" },
    { type: "end-phase", side: "wizard" }, // round 2 clash: not armed
    { type: "end-phase", side: "wizard" },
    { type: "end-phase", side: "cowboy" }, // round 3 clash: fires
    { type: "end-phase", side: "cowboy" },
    { type: "end-phase", side: "wizard" }, // round 4 clash: already spent
  ];
  const fired = [];
  script.forEach((partial, step) => {
    const action = { ...partial, revision: state.revision };
    const label = `probe set-then-wait step ${step} ${JSON.stringify(action)}`;
    const applied = applyAction(state, action, OPT);
    assert.equal(applied.ok, true, `${label}: ${applied.reason}`);
    assertState(applied.state, base, label);
    assertStep(state, action, applied.state, applied.events, label);
    for (const event of applied.events) if (event.type === "trap-trigger") fired.push([state.round, event.cardId]);
    state = applied.state;
  });
  assert.deepEqual(fired, [[3, cardId]]);
  assert.equal(count(state.sides.cowboy.discard, cardId), 1);
});

test("probe: two copies of the same fixture ID in one hand are conserved by multiplicity", () => {
  // Deliberately mutated: the engine never deals one ID twice, but nothing in
  // set-trap or the trigger may rely on that; conservation counts copies.
  let state = boardProbe({ cowboy: [null, null, null], wizard: ["wizard-skeleton-1", null, null] }, 5);
  const id = state.sides.cowboy.trap.cardId;
  state.sides.cowboy.trap = null;
  state.sides.cowboy.hand.push(id, id);
  state.sides.wizard.hand.push(state.sides.wizard.trap.cardId);
  state.sides.wizard.trap = null;
  const base = census(state);
  assert.equal(base.cowboy.ids.find(([key]) => key === id)[1], 2);
  for (const partial of [
    { type: "set-trap", side: "cowboy", cardId: id },
    { type: "end-phase", side: "cowboy" },
    { type: "end-phase", side: "wizard" },
    { type: "end-phase", side: "wizard" },
    { type: "end-phase", side: "cowboy" },
  ]) {
    const applied = applyAction(state, { ...partial, revision: state.revision }, OPT);
    assert.equal(applied.ok, true, applied.reason);
    assert.deepEqual(census(applied.state), base, `duplicate-ID probe ${partial.type}`);
    state = applied.state;
  }
  assert.equal(count(state.sides.cowboy.hand, id), 1);
  assert.equal(count(state.sides.cowboy.discard, id), 1);
  assert.equal(state.sides.cowboy.trap, null);
});

test("probe: the checkers reject deliberately corrupted states", () => {
  // Each mutation breaks one property; assertState must fail on it, so a
  // passing reachable run is not a vacuous pass.
  const good = boardProbe({ cowboy: ["cowboy-sheriff-1", null, null], wizard: [null, "wizard-skeleton-1", null] }, 5);
  const base = census(good);
  assertState(good, base, "unmutated probe");
  const mutations = {
    "fixture vanished": (s) => (s.sides.cowboy.trap = null),
    "fixture duplicated into discard": (s) => s.sides.cowboy.discard.push(s.sides.cowboy.trap.cardId),
    "fixture moved across sides": (s) => {
      s.sides.wizard.hand.push(s.sides.cowboy.trap.cardId);
      s.sides.cowboy.trap = null;
    },
    "type swapped for another copy count": (s) => (s.sides.cowboy.deck[0] = s.sides.cowboy.deck[0] === "cowboy-sheriff-2" ? "cowboy-billy-1" : "cowboy-sheriff-2"),
    "second trap zone": (s) => (s.sides.wizard.trap = [s.sides.wizard.trap]),
    "troop in the trap zone": (s) => {
      s.sides.cowboy.hand.push(s.sides.cowboy.trap.cardId);
      s.sides.cowboy.trap = { cardId: s.sides.cowboy.hand.shift(), setRound: 1 };
    },
    "trap card on the board": (s) => {
      s.sides.cowboy.board[2] = { cardId: s.sides.cowboy.trap.cardId, health: 1 };
      s.sides.cowboy.trap = null;
    },
    "fourth lane": (s) => s.sides.cowboy.board.push(null),
    "base above five orbs": (s) => (s.sides.wizard.baseOrbs = BASE_ORBS + 1),
    "negative base": (s) => (s.sides.wizard.baseOrbs = -1),
    "troop above printed health": (s) => (s.sides.cowboy.board[0].health += 1),
    "trap set in a future round": (s) => (s.sides.cowboy.trap.setRound = s.round + 1),
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const bad = structuredClone(good);
    mutate(bad);
    assert.throws(() => assertState(bad, base, name), assert.AssertionError, `not caught: ${name}`);
  }
});

test("probe: rejected actions return the same state object and emit nothing; accepted results are independent copies", () => {
  const state = opening(0);
  const side = state.activeSide;
  const before = structuredClone(state);
  const rejected = [
    { type: "set-trap", side: opponent(side), revision: state.revision, cardId: FIXTURE_OF[opponent(side)][0] },
    { type: "set-trap", side, revision: state.revision + 1, cardId: FIXTURE_OF[side][0] },
    { type: "set-trap", side, revision: state.revision, cardId: FIXTURE_OF[side][1] }, // in deck, not hand
    { type: "set-trap", side, revision: state.revision, cardId: FIXTURE_OF[opponent(side)][0] },
  ];
  for (const action of rejected) {
    const result = applyAction(state, action, OPT);
    assert.equal(result.ok, false, JSON.stringify(action));
    assert.equal(result.state, state);
    assert.equal("events" in result, false);
  }
  const set = applyAction(state, { type: "set-trap", side, revision: state.revision, cardId: FIXTURE_OF[side][0] }, OPT);
  assert.equal(set.ok, true, set.reason);
  set.state.sides[side].discard.push("x");
  set.state.sides[side].trap.setRound = 99;
  assert.deepEqual(state, before);
  // Without the fixture catalog the same card is not a trap.
  assert.equal(applyAction(state, { type: "set-trap", side, revision: state.revision, cardId: FIXTURE_OF[side][0] }).reason, "not-a-trap");
  assert.equal(Object.values(CARDS).some((card) => card.kind === "trap"), false);
  assert.equal(FIXTURE_IDS.some((id) => id in CARDS), false);
});
