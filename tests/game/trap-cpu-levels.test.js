import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch, MAX_ROUNDS } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { CPU_LEVELS, chooseAction, cpuFor } from "../../src/game/cpu.js";
import { MAX_STEPS } from "../../scripts/play-match.mjs";

// Issue #112: easy, normal and hard on opt-in trap matches. The shipped
// catalog has no trap card, so the traps here are anonymous fixture IDs that
// exist only in this file. They reach the engine and the CPU through the
// `cards` option and enter a hand or deck by editing a cloned state, as extra
// cards outside the 12-card deck. CARDS and DECKS stay as shipped. Nothing
// here measures balance: the fixture trap has no shipped counterpart.
const trapOf = (side, n) => `test-fixture-level-trap-${side}-${n}`;
const FIXTURE = Object.fromEntries(
  SIDES.flatMap((side) => [1, 2].map((n) => trapOf(side, n)).map((id) => [id, Object.freeze({ id, side, kind: "trap", name: "Test fixture trap" })])),
);
const TEST_CARDS = Object.freeze({ ...CARDS, ...FIXTURE });
const OPT = { cards: TEST_CARDS };
const isTrap = (cardId) => cardId in FIXTURE;

// Seeded opt-in match with one fixture trap in each opening hand and a second
// one fourth from the top of each deck.
function fixtureOpening(seed) {
  const state = structuredClone(createMatch(seed, { traps: true }));
  for (const side of SIDES) {
    state.sides[side].hand.push(trapOf(side, 1));
    state.sides[side].deck.splice(3, 0, trapOf(side, 2));
  }
  return state;
}

// The same view with every fixture trap taken out of the viewer's hand.
function withoutTraps(view) {
  const copy = structuredClone(view);
  const own = copy.sides[copy.viewer];
  own.hand = own.hand.filter((cardId) => !isTrap(cardId));
  own.handCount = own.hand.length;
  return copy;
}

// Any use of Math.random or Date.now during `fn` fails the test.
function noClock(fn) {
  const { random } = Math;
  const { now } = Date;
  Math.random = () => assert.fail("the CPU used Math.random");
  Date.now = () => assert.fail("the CPU read the clock");
  try {
    return fn();
  } finally {
    Math.random = random;
    Date.now = now;
  }
}

const key = (action) => JSON.stringify(action);

// Plays one fixture match and checks every decision. Returns the actions,
// result and counts.
function play(seed, levels) {
  let state = fixtureOpening(seed);
  const trace = [];
  const stats = { sets: 0, triggers: 0 };
  const phases = {};
  while (!state.result) {
    assert.ok(trace.length < MAX_STEPS, `seed ${seed}: no result after ${MAX_STEPS} actions`);
    const { activeSide: side, round } = state;
    const level = levels[side];
    const label = `seed ${seed} round ${round} ${side} ${level}`;
    const stateBefore = structuredClone(state);
    const view = publicState(state, side);
    const viewBefore = structuredClone(view);
    const action = noClock(() => cpuFor(level)(view, OPT));
    assert.deepEqual(view, viewBefore, `${label}: view changed`);
    assert.deepEqual(state, stateBefore, `${label}: state changed`);

    // Legal for the full state (applyAction acceptance is checked below).
    const legal = legalActions(state, side, OPT);
    assert.ok(legal.map(key).includes(key(action)), `${label}: not legal ${key(action)}`);

    // Transparent trap step: the choice is the one made with no trap in
    // hand, except that a spell or end-phase may become a set.
    const plain = cpuFor(level)(withoutTraps(view), OPT);
    if (action.type === "set-trap") assert.ok(["spell", "end-phase"].includes(plain.type), `${label}: set replaced ${plain.type}`);
    else assert.deepEqual(action, plain, `${label}: a held trap changed a non-set choice`);
    if (level === "easy") assert.notEqual(action.type, "spell", `${label}: easy cast`);

    // Phase order and set gates.
    const phase = (phases[`${round}:${side}`] ??= []);
    assert.equal(phase.includes(action.type), false, `${label}: second ${action.type}`);
    if (action.type === "summon") assert.ok(!phase.includes("spell") && !phase.includes("set-trap"), `${label}: summon after a tactical action`);
    if (action.type === "spell") assert.equal(phase.includes("set-trap"), false, `${label}: cast after a set`);
    if (action.type === "set-trap") {
      assert.ok(round < MAX_ROUNDS, `${label}: set in round ${round}`);
      assert.equal(state.sides[side].trap, null, `${label}: set onto a full zone`);
      assert.equal(phase.includes("spell"), false, `${label}: set after a cast`);
      assert.ok(state.sides[side].hand.includes(action.cardId) && isTrap(action.cardId), `${label}: set a card not held`);
      stats.sets += 1;
    }
    phase.push(action.type);

    const zones = Object.fromEntries(SIDES.map((each) => [each, state.sides[each].trap]));
    const applied = applyAction(state, action, OPT);
    assert.equal(applied.ok, true, `${label}: rejected (${applied.reason})`);
    for (const event of applied.events) {
      if (event.type !== "trap-trigger") continue;
      assert.equal(action.type, "end-phase", `${label}: trigger outside a clash`);
      const zone = zones[event.side];
      assert.equal(zone?.cardId, event.cardId, `${label}: trigger of a card not set`);
      assert.ok(zone.setRound < round, `${label}: triggered in its set round`);
      stats.triggers += 1;
    }
    state = applied.state;
    trace.push(action);
  }
  return { trace, result: state.result, stats };
}

const SAMPLE = Array.from({ length: 200 }, (_, seed) => seed);

for (const level of CPU_LEVELS) {
  test(`${level} vs ${level}, fixture traps, seeds 0-199: legal, accepted, ordered, gated, transparent, bounded and replayable`, (t) => {
    const totals = { sets: 0, triggers: 0 };
    for (const seed of SAMPLE) {
      const levels = { cowboy: level, wizard: level };
      const first = play(seed, levels);
      if (seed === 0 || seed === 60) {
        assert.deepEqual(play(seed, levels), first, `seed ${seed}: replay differs`);
        assert.ok(first.stats.sets >= 2, `seed ${seed}: ${first.stats.sets} sets`); // each side sets its opening trap
      }
      totals.sets += first.stats.sets;
      totals.triggers += first.stats.triggers;
    }
    assert.ok(totals.sets >= 2 * SAMPLE.length, `${level}: ${totals.sets} sets`);
    assert.ok(totals.triggers > 0, `${level}: no trigger`);
    t.diagnostic(`${level}: ${SAMPLE.length} matches, sets ${totals.sets}, triggers ${totals.triggers}`);
  });
}

test("seeds 0 and 60, every level pairing with fixture traps: legal, accepted and replayable", () => {
  for (const seed of [0, 60]) {
    for (const cowboy of CPU_LEVELS) {
      for (const wizard of CPU_LEVELS) {
        const first = play(seed, { cowboy, wizard });
        assert.deepEqual(play(seed, { cowboy, wizard }), first, `seed ${seed} ${cowboy}/${wizard}`);
      }
    }
  }
});

test("each level reads neither the opponent's face-down trap nor hidden cards", () => {
  for (const level of CPU_LEVELS) {
    const choose = cpuFor(level);
    for (const seed of [0, 60]) {
      const base = fixtureOpening(seed);
      const side = base.activeSide;
      const enemy = opponent(side);
      const expected = choose(publicState(base, side), OPT);
      for (const cardId of [null, trapOf(enemy, 1), trapOf(enemy, 2)]) {
        const state = structuredClone(base);
        state.sides[enemy].trap = cardId && { cardId, setRound: 1 };
        state.sides[enemy].hand.reverse();
        state.sides[enemy].deck.reverse();
        state.sides[side].deck.reverse();
        const view = publicState(state, side);
        const text = JSON.stringify(view.sides[enemy]);
        for (const id of [trapOf(enemy, 1), trapOf(enemy, 2)]) assert.equal(text.includes(id), false, `${level}: ${id} visible`);
        assert.deepEqual(choose(view, OPT), expected, `${level} seed ${seed}`);
        // With the opponent's face-down marker removed the choice is the same.
        const unmarked = structuredClone(view);
        delete unmarked.sides[enemy].trap;
        assert.deepEqual(choose(unmarked, OPT), expected, `${level} seed ${seed}: marker`);
        // easy and normal: any read of the opponent's trap marker or hand
        // throws. hard copies its view with structuredClone, which cannot copy
        // a Proxy, so the removal above stands in for it there.
        if (level === "hard") continue;
        view.sides[enemy] = new Proxy(view.sides[enemy], {
          get(target, prop) {
            if (prop === "trap" || prop === "hand") throw new Error(`${level} read the opponent's ${prop}`);
            return target[prop];
          },
        });
        assert.deepEqual(choose(view, OPT), expected, `${level} seed ${seed}: proxy`);
      }
    }
  }
});

test("hard sets a held trap in the round before the last, never in the final round", () => {
  const hard = cpuFor("hard");
  for (const seed of [0, 60]) {
    for (const round of [MAX_ROUNDS - 1, MAX_ROUNDS]) {
      let state = fixtureOpening(seed);
      state.round = round;
      const side = state.activeSide;
      const types = [];
      while (state.activeSide === side && state.round === round) {
        const action = hard(publicState(state, side), OPT);
        types.push(action.type);
        const applied = applyAction(state, action, OPT);
        assert.equal(applied.ok, true, applied.reason);
        state = applied.state;
      }
      assert.equal(types.at(-1), "end-phase");
      if (round === MAX_ROUNDS) assert.equal(types.includes("set-trap"), false, `seed ${seed}: ${types}`);
      else {
        assert.ok(types.includes("set-trap"), `seed ${seed}: ${types}`);
        assert.equal(types.includes("spell"), false, `seed ${seed}: ${types}`);
      }
    }
  }
});

test("option signature, level fallback, and no change without a trap in hand", () => {
  assert.deepEqual(CPU_LEVELS, ["easy", "normal", "hard"]);
  for (const name of ["normal", "unknown", "", "HARD", undefined, null, 1]) assert.equal(cpuFor(name), chooseAction, String(name));
  assert.notEqual(cpuFor("easy"), chooseAction);
  assert.notEqual(cpuFor("hard"), chooseAction);
  for (const level of CPU_LEVELS) {
    const choose = cpuFor(level);
    assert.equal(choose.length, 1, `${level}: (view, options?)`);
    for (const seed of [0, 60]) {
      // Flag off and flag on with no trap dealt: the option changes nothing.
      for (const opening of [createMatch(seed), createMatch(seed, { traps: true })]) {
        const view = publicState(opening, opening.activeSide);
        const plain = choose(view);
        assert.deepEqual(choose(view, {}), plain, level);
        assert.deepEqual(choose(view, OPT), plain, level);
        assert.equal(choose(publicState(opening, opponent(opening.activeSide)), OPT), null, `${level}: not its phase`);
      }
    }
  }
});
