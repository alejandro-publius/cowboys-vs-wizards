// Seeded invariant checks: for a fixed list of match seeds, a seeded picker
// local to this file plays random legal actions until the match ends, and the
// invariants below are asserted after every step. No testing library is used.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES, opponent } from "../../src/game/cards.js";
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
  // Card conservation: 24 distinct IDs, each in exactly one zone of its own side.
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
  assert.deepEqual(seen.sort(), Object.keys(CARDS).sort(), label);

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
  out.push({ type: "end-phase", ...base });
  return out;
}

// `summonChance` is how often summons are offered to the picker. At 1 every
// legal action is equally likely; lower values give sparse boards and longer
// matches. Legality is still checked against the full list at every step.
function walk(seed, summonChance) {
  const random = picker(seed ^ 0x5eed);
  let state = createMatch(seed);
  const events = [];
  const played = {}; // "<round>:<side>" -> action types accepted in that phase
  let steps = 0;
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

    const offered = random() < summonChance ? actions : actions.filter((each) => each.type !== "summon");
    const action = { ...offered[Math.floor(random() * offered.length)], actionId: `walk-${steps}` };
    const phase = (played[`${state.round}:${side}`] ??= []);
    // Per-round allowances: one summon, one spell, never a summon after the spell.
    if (action.type === "summon") assert.deepEqual(phase, [], label);
    if (action.type === "spell") assert.equal(phase.includes("spell"), false, label);
    assert.equal(phase.includes("end-phase"), false, label);
    phase.push(action.type);

    const result = applyAction(state, action);
    assert.equal(result.ok, true, `${label}: ${result.reason}`);
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
  return { state, events, steps };
}

for (const [name, summonChance] of [["uniform", 1], ["sparse", 0.15]]) {
  test(`seeded invariant checks: ${name} legal-action walks over seeds 0-99`, (t) => {
    const steps = {};
    const endings = {};
    for (const seed of SEEDS) {
      const first = walk(seed, summonChance);
      // Same seed, same picker: the whole walk replays identically.
      assert.deepEqual(walk(seed, summonChance), first, `seed ${seed} replay`);
      steps[seed] = first.steps;
      const { winner, reason } = first.state.result;
      const key = `${reason}/${winner ?? "draw"}`;
      endings[key] = (endings[key] ?? 0) + 1;
    }
    const counts = Object.values(steps);
    t.diagnostic(`walks: ${counts.length}, all terminated`);
    t.diagnostic(`steps: total ${counts.reduce((a, b) => a + b, 0)}, min ${Math.min(...counts)}, max ${Math.max(...counts)} (bound ${MAX_STEPS})`);
    t.diagnostic(`steps for seeds 14, 27, 47: ${[14, 27, 47].map((seed) => steps[seed]).join(", ")}`);
    t.diagnostic(`endings: ${JSON.stringify(endings)}`);
  });
}
