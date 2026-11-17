// Custom Cowboy deck simulation: 128 deterministic deck/seed samples played
// against the fixed Wizard deck through the pure rules (createMatch,
// legalActions, applyAction, publicState, chooseAction). The CPU sees only
// publicState(state, side). The other side picks a seeded legal action.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { COWBOY_CATALOG, DECK_SIZE, deckIds, validateDeck, validateDeckIds } from "../../src/game/deck-builder.js";
import { createMatch, BASE_ORBS, MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";

const SAMPLES = 128;
const MAX_STEPS = MAX_ROUNDS * SIDES.length * 3;
const S = "cowboy-sheriff", B = "cowboy-billy", M = "cowboy-mounted-billy", D = "cowboy-deadeye";

// mulberry32, local so sample choice is independent of the engine's generator.
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

const key = (c) => COWBOY_CATALOG.map(({ type }) => c[type] ?? 0).join("/");
const EDGES = [
  ["six Mounted, one Sheriff, five Billy", { [S]: 1, [B]: 5, [M]: 6, [D]: 0 }],
  ["six Mounted, one Sheriff, five Deadeye", { [S]: 1, [B]: 0, [M]: 6, [D]: 5 }],
  ["six Mounted, two Sheriff, two Billy, two Deadeye", { [S]: 2, [B]: 2, [M]: 6, [D]: 2 }],
  ["maximum spells (six Deadeye)", { [S]: 3, [B]: 3, [M]: 0, [D]: 6 }],
  ["no spells", { [S]: 6, [B]: 4, [M]: 2, [D]: 0 }],
  ["one Sheriff", { [S]: 1, [B]: 5, [M]: 0, [D]: 6 }],
  ["default deck", { [S]: 6, [B]: 3, [M]: 1, [D]: 2 }],
];
function allCompositions() {
  const out = [];
  for (let s = 1; s <= 6; s++) for (let b = 0; b <= 6; b++) for (let m = 0; m <= 6; m++) {
    const d = DECK_SIZE - s - b - m;
    if (d >= 0 && d <= 6) out.push({ [S]: s, [B]: b, [M]: m, [D]: d });
  }
  return out;
}

function buildSamples() {
  const used = new Set();
  const samples = [];
  for (const [name, counts] of EDGES) {
    used.add(key(counts));
    samples.push({ name, counts });
  }
  // Bounded: one pass over the finite list of valid compositions, ordered by a seeded shuffle.
  const pool = allCompositions().filter((c) => !used.has(key(c)));
  const random = picker(0xdec5);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  assert.ok(pool.length >= SAMPLES - EDGES.length, "enough valid compositions");
  pool.slice(0, SAMPLES - EDGES.length).forEach((counts, i) => samples.push({ name: `diverse ${i + 1}`, counts }));
  return samples.map((sample, index) => ({ ...sample, index, seed: (index * 7919 + 13) % 100000 }));
}

const cardsOf = (z) => [...z.deck, ...z.hand, ...z.discard, ...z.board.filter(Boolean).map((t) => t.cardId)];

function assertInvariants(state, expected, label) {
  const all = [];
  for (const side of SIDES) {
    const zone = state.sides[side];
    const ids = cardsOf(zone);
    assert.deepEqual([...ids].sort(), [...expected[side]].sort(), `${label}: ${side} cards`);
    for (const id of ids) assert.equal(CARDS[id]?.side, side, `${label}: ${id} faction`);
    all.push(...ids);
    assert.equal(zone.board.length, SLOT_COUNT, label);
    for (const troop of zone.board.filter(Boolean)) {
      const card = CARDS[troop.cardId];
      assert.equal(card.kind, "troop", label);
      assert.ok(Number.isInteger(troop.health) && troop.health >= 1 && troop.health <= card.health, `${label}: ${troop.cardId} health ${troop.health}`);
    }
    assert.ok(Number.isInteger(zone.baseOrbs) && zone.baseOrbs >= 0 && zone.baseOrbs <= BASE_ORBS, `${label}: ${side} base`);
  }
  assert.equal(all.length, 2 * DECK_SIZE, label);
  assert.equal(new Set(all).size, all.length, `${label}: unique IDs`);
  assert.ok(Number.isInteger(state.round) && state.round >= 1 && state.round <= MAX_ROUNDS, `${label}: round ${state.round}`);
  const baseDown = SIDES.some((side) => state.sides[side].baseOrbs === 0);
  if (state.result) {
    assert.equal(state.activeSide, null, label);
    assert.ok(baseDown || state.round === MAX_ROUNDS, `${label}: ended early`);
  } else {
    assert.ok(SIDES.includes(state.activeSide), label);
    assert.equal(baseDown, false, `${label}: destroyed base without result`);
  }
}

// Same position with everything the viewer may not know changed: the
// opponent's hand/deck order, the viewer's own deck order, seed and rng.
function perturbHidden(state, viewer) {
  const copy = structuredClone(state);
  const enemy = copy.sides[opponent(viewer)];
  const pool = [...enemy.hand, ...enemy.deck].reverse();
  enemy.hand = pool.slice(0, enemy.hand.length);
  enemy.deck = pool.slice(enemy.hand.length);
  copy.sides[viewer].deck.reverse();
  copy.seed = state.seed + 1;
  copy.rng = (state.rng ^ 0x9e3779b9) >>> 0;
  return copy;
}

const strip = ({ actionId, ...action }) => action;

function play(sample) {
  const ids = deckIds(sample.counts);
  const expected = { cowboy: ids, wizard: DECKS.wizard };
  // Mode: 0 CPU cowboy vs random wizard, 1 random cowboy vs CPU wizard, 2 CPU vs CPU, 3 as 0.
  const mode = sample.index % 4;
  const cpuSides = mode === 2 ? SIDES : mode === 1 ? ["wizard"] : ["cowboy"];
  const random = picker(sample.seed ^ 0x5eed);
  let state = createMatch(sample.seed, { cowboyDeck: ids });
  const trace = { actions: [], events: [], states: [JSON.stringify(state)] };
  const stats = { cpuDecisions: 0, hiddenChecks: 0 };
  assertInvariants(state, expected, `${sample.name} setup`);

  while (!state.result) {
    const label = `${sample.name} seed ${sample.seed} step ${trace.actions.length}`;
    assert.ok(trace.actions.length < MAX_STEPS, `${label}: exceeded ${MAX_STEPS} actions`);
    const side = state.activeSide;
    const actions = legalActions(state, side);
    assert.ok(actions.length > 0, `${label}: no legal action while active`);
    assert.deepEqual(legalActions(state, opponent(side)), [], label);

    let picked;
    if (cpuSides.includes(side)) {
      const view = publicState(state, side);
      picked = chooseAction(view);
      assert.ok(actions.some((a) => JSON.stringify(a) === JSON.stringify(strip(picked))), `${label}: CPU action not legal`);
      stats.cpuDecisions++;
      // Hidden-information boundary (scope: the view and CPU choice, not a leakage proof).
      const other = opponent(side);
      assert.equal("hand" in view.sides[other], false, label);
      assert.equal("deck" in view.sides[side] || "deck" in view.sides[other], false, label);
      assert.equal("seed" in view || "rng" in view, false, label);
      assert.equal(view.sides[side].deckCount, state.sides[side].deck.length, label);
      const altered = perturbHidden(state, side);
      assert.deepEqual(publicState(altered, side), view, `${label}: public view depends on hidden fields`);
      assert.deepEqual(chooseAction(publicState(altered, side)), picked, `${label}: CPU choice depends on hidden fields`);
      stats.hiddenChecks++;
    } else {
      picked = actions[Math.floor(random() * actions.length)];
    }
    const action = { ...strip(picked), actionId: `sim-${trace.actions.length}` };

    // Every legal action is accepted, advances revision once, and leaves the input state untouched.
    const before = JSON.stringify(state);
    for (const legal of actions) {
      const probe = applyAction(state, { ...legal, actionId: "probe" });
      assert.equal(probe.ok, true, `${label}: legal action rejected: ${probe.reason}`);
      assert.equal(probe.state.revision, state.revision + 1, label);
    }
    assert.equal(JSON.stringify(state), before, `${label}: applyAction mutated input`);

    const result = applyAction(state, action);
    assert.equal(result.ok, true, `${label}: ${result.reason}`);
    assert.equal(result.state.revision, state.revision + 1, label);
    for (const event of result.events) assert.equal(event.actionId, action.actionId, label);
    trace.actions.push(action);
    trace.events.push(...result.events);
    state = result.state;
    trace.states.push(JSON.stringify(state));
    assertInvariants(state, expected, label);
  }
  assert.deepEqual(legalActions(state, "cowboy"), []);
  assert.deepEqual(legalActions(state, "wizard"), []);
  return { trace, state, steps: trace.actions.length, stats, mode };
}

test("custom Cowboy decks: 128 valid samples play to completion with invariants and replay", (t) => {
  const samples = buildSamples();
  assert.equal(samples.length, SAMPLES);
  assert.equal(new Set(samples.map((s) => key(s.counts))).size, SAMPLES, "distinct compositions");
  for (const name of ["six Mounted, one Sheriff", "maximum spells", "no spells", "one Sheriff", "default deck"]) {
    assert.ok(samples.some((s) => s.name.startsWith(name)), name);
  }
  const totals = { steps: 0, min: Infinity, max: 0, cpuDecisions: 0, hiddenChecks: 0, spellDecks: 0 };
  const endings = {};
  const modes = [0, 0, 0, 0];
  for (const sample of samples) {
    assert.deepEqual(validateDeck(sample.counts), { ok: true, error: null, total: DECK_SIZE }, sample.name);
    const ids = deckIds(sample.counts);
    assert.equal(validateDeckIds(ids).ok, true, sample.name);
    assert.ok(sample.counts[S] >= 1, sample.name);

    const first = play(sample);
    const replay = play(sample);
    assert.deepEqual(replay.trace, first.trace, `${sample.name} seed ${sample.seed}: replay differs`);
    assert.deepEqual(replay.state, first.state, `${sample.name}: replay final state`);

    totals.steps += first.steps;
    totals.min = Math.min(totals.min, first.steps);
    totals.max = Math.max(totals.max, first.steps);
    totals.cpuDecisions += first.stats.cpuDecisions;
    totals.hiddenChecks += first.stats.hiddenChecks;
    if (sample.counts[D] > 0) totals.spellDecks++;
    modes[first.mode]++;
    const { winner, reason } = first.state.result;
    const k = `${reason}/${winner ?? "draw"}`;
    endings[k] = (endings[k] ?? 0) + 1;
  }
  t.diagnostic(`samples: ${SAMPLES}, each played twice and replay-identical (actions, events, every state)`);
  t.diagnostic(`steps: total ${totals.steps}, min ${totals.min}, max ${totals.max} (bound ${MAX_STEPS})`);
  t.diagnostic(`CPU decisions: ${totals.cpuDecisions}, hidden-field perturbation checks: ${totals.hiddenChecks}`);
  t.diagnostic(`decks with spells: ${totals.spellDecks}; modes (cpu-cowboy, cpu-wizard, cpu-both, cpu-cowboy): ${modes.join("/")}`);
  t.diagnostic(`endings: ${JSON.stringify(endings)}`);
});
