// Focused checks for the matched-seed deck replacement simulation (issue #114).
//   node --test experiments/trap-deck-sim/sim.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { MAX_ROUNDS, createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { cpuFor } from "../../src/game/cpu.js";
import { playMatch as shippedPlayMatch } from "../../scripts/play-match.mjs";
import {
  FIXTURE_IDS,
  SCENARIOS,
  SPELL_IDS,
  TEST_CARDS,
  holdings,
  openingFor,
  pairedDelta,
  playMatch,
  relabelMap,
} from "./sim.js";

const SEEDS = [0, 60];
const LEVELS = ["easy", "normal", "hard"];
const decksBefore = JSON.stringify(DECKS);
const kinds = (ids) => {
  const out = { troop: 0, spell: 0, trap: 0 };
  for (const id of ids) out[TEST_CARDS[id].kind]++;
  return out;
};

test("BASE seeds 0 and 60: opening equals createMatch and actions equal the shipped match runner", () => {
  for (const seed of SEEDS) {
    assert.deepEqual(openingFor(seed, "BASE"), createMatch(seed));
    for (const level of LEVELS) {
      const ours = playMatch(seed, "BASE", { cowboy: level, wizard: level });
      const bot = cpuFor(level);
      const shipped = shippedPlayMatch(seed, { cowboy: bot, wizard: bot });
      assert.deepEqual(ours.trace.map((step) => step.action), shipped.log.map((step) => step.action), `seed ${seed} ${level}`);
      assert.deepEqual(ours.trace.map((step) => step.events), shipped.log.map((step) => step.events));
      assert.deepEqual(ours.final, shipped.state);
    }
  }
});

test("every scenario deals exactly 12 cards per side with the stated composition", () => {
  const expected = { BASE: { troop: 10, spell: 2, trap: 0 }, T1: { troop: 10, spell: 1, trap: 1 }, T2: { troop: 10, spell: 0, trap: 2 } };
  for (let seed = 0; seed < 200; seed++) {
    for (const scenario of SCENARIOS) {
      const state = openingFor(seed, scenario);
      for (const side of SIDES) {
        const ids = holdings(state, side);
        assert.equal(ids.length, 12);
        assert.equal(new Set(ids).size, 12, "IDs are unique");
        assert.deepEqual(kinds(ids), expected[scenario], `seed ${seed} ${scenario} ${side}`);
        assert.equal(state.sides[side].hand.length, 4);
      }
    }
  }
});

test("T1/T2 keep RNG, starting side and every other ID position; only spell copies are relabelled", () => {
  for (let seed = 0; seed < 200; seed++) {
    const base = createMatch(seed);
    for (const scenario of ["T1", "T2"]) {
      const map = relabelMap(scenario);
      const state = openingFor(seed, scenario);
      assert.equal(state.rng, base.rng);
      assert.equal(state.startingSide, base.startingSide);
      assert.equal(state.activeSide, base.activeSide);
      assert.deepEqual(state.traps, { enabled: true, rulesVersion: createMatch(seed, { traps: true }).traps.rulesVersion });
      for (const side of SIDES) {
        assert.deepEqual(state.sides[side].hand, base.sides[side].hand.map((id) => map[id] ?? id));
        assert.deepEqual(state.sides[side].deck, base.sides[side].deck.map((id) => map[id] ?? id));
        assert.equal(state.sides[side].trap, null);
      }
    }
  }
  assert.deepEqual(Object.keys(relabelMap("T1")), SIDES.map((side) => SPELL_IDS[side][1]));
  assert.deepEqual(Object.keys(relabelMap("T2")).sort(), SIDES.flatMap((side) => SPELL_IDS[side]).sort());
});

test("fixture traps do not leak into the shipped catalog or decks", () => {
  for (const id of FIXTURE_IDS) {
    assert.equal(id in CARDS, false);
    assert.equal(TEST_CARDS[id].kind, "trap");
  }
  assert.equal(Object.values(CARDS).some((card) => card.kind === "trap"), false);
  for (const id of Object.keys(CARDS)) assert.equal(TEST_CARDS[id], CARDS[id]);
  assert.ok(Object.isFrozen(CARDS) && Object.isFrozen(DECKS) && Object.isFrozen(TEST_CARDS));
  // Without the fixture catalog the engine refuses the fixture card.
  const state = openingFor(0, "T2");
  const side = state.activeSide;
  const cardId = state.sides[side].hand.find((id) => FIXTURE_IDS.includes(id)) ?? state.sides[side].deck.find((id) => FIXTURE_IDS.includes(id));
  state.sides[side].hand = [...state.sides[side].hand.filter((id) => id !== cardId), cardId];
  state.sides[side].deck = state.sides[side].deck.filter((id) => id !== cardId);
  const action = { type: "set-trap", side, revision: 0, cardId };
  assert.equal(applyAction(state, action).reason, "not-a-trap");
  assert.equal(applyAction(state, action, { cards: TEST_CARDS }).ok, true);
});

test("seeds 0 and 60: legal replay, deterministic digest and correct result in every scenario and level", () => {
  for (const seed of SEEDS) {
    for (const scenario of SCENARIOS) {
      for (const level of LEVELS) {
        const levels = { cowboy: level, wizard: level };
        const first = playMatch(seed, scenario, levels);
        const again = playMatch(seed, scenario, levels);
        assert.equal(first.digest, again.digest, `seed ${seed} ${scenario} ${level}`);
        assert.deepEqual(first.result, again.result);
        // Replaying the recorded actions alone reproduces every event and the result.
        let state = openingFor(seed, scenario);
        for (const step of first.trace) {
          const applied = applyAction(state, step.action, { cards: TEST_CARDS });
          assert.equal(applied.ok, true);
          assert.deepEqual(applied.events, step.events);
          state = applied.state;
        }
        assert.deepEqual(state.result, first.result);
        assert.ok(first.result.round >= 1 && first.result.round <= MAX_ROUNDS);
        for (const step of first.trace) {
          if (step.action.type === "set-trap") assert.ok(step.round < MAX_ROUNDS);
        }
        if (scenario !== "T2") continue;
        for (const side of SIDES) assert.equal(first.metrics[side].casts, 0, "T2 has no spell to cast");
      }
    }
  }
  assert.equal(JSON.stringify(DECKS), decksBefore, "DECKS unchanged after simulation");
});

test("pairedDelta is zero for identical lists and refuses unpaired seeds", () => {
  const list = SEEDS.map((seed) => playMatch(seed, "BASE", { cowboy: "normal", wizard: "normal" }));
  assert.deepEqual(pairedDelta(list, list), { n: 2, mean: 0, low: 0, high: 0, changedResults: 0 });
  assert.throws(() => pairedDelta(list, [...list].reverse()), /not paired/);
});
