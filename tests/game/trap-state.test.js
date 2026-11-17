import test from "node:test";
import assert from "node:assert/strict";
import { DECKS, SIDES } from "../../src/game/cards.js";
import { createMatch, RULES_VERSION, TRAP_RULES_VERSION } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";

// Issue #89, trap T1: feature-flagged state only. The fixtures below are the
// createMatch(0) and createMatch(60) output of main 1c803bc, before the flag
// existed, recorded as fixed literals so flag-off parity is checked against a
// known engine state rather than against the function under test.
const BASELINE = {
  0: {
    seed: 0, revision: 0, rng: 3471308035, round: 1, startingSide: "cowboy", activeSide: "cowboy",
    allowances: { cowboy: { summonUsed: false, castUsed: false }, wizard: { summonUsed: false, castUsed: false } },
    actionIds: [], result: null,
    sides: {
      cowboy: {
        baseOrbs: 5,
        deck: ["cowboy-sheriff-6", "cowboy-billy-1", "cowboy-billy-2", "cowboy-deadeye-2", "cowboy-sheriff-2", "cowboy-sheriff-3", "cowboy-sheriff-1", "cowboy-sheriff-4"],
        hand: ["cowboy-mounted-billy-1", "cowboy-deadeye-1", "cowboy-sheriff-5", "cowboy-billy-3"],
        board: [null, null, null], discard: [],
      },
      wizard: {
        baseOrbs: 5,
        deck: ["wizard-skeleton-3", "wizard-skeleton-4", "wizard-wizard-2", "wizard-skeleton-6", "wizard-wizard-1", "wizard-skeleton-5", "wizard-dragon-1", "wizard-skeleton-2"],
        hand: ["wizard-singularity-1", "wizard-singularity-2", "wizard-wizard-3", "wizard-skeleton-1"],
        board: [null, null, null], discard: [],
      },
    },
  },
  60: {
    seed: 60, revision: 0, rng: 3471308095, round: 1, startingSide: "wizard", activeSide: "wizard",
    allowances: { cowboy: { summonUsed: false, castUsed: false }, wizard: { summonUsed: false, castUsed: false } },
    actionIds: [], result: null,
    sides: {
      cowboy: {
        baseOrbs: 5,
        deck: ["cowboy-billy-2", "cowboy-billy-1", "cowboy-billy-3", "cowboy-sheriff-5", "cowboy-sheriff-6", "cowboy-deadeye-1", "cowboy-sheriff-3", "cowboy-sheriff-4"],
        hand: ["cowboy-sheriff-2", "cowboy-sheriff-1", "cowboy-mounted-billy-1", "cowboy-deadeye-2"],
        board: [null, null, null], discard: [],
      },
      wizard: {
        baseOrbs: 5,
        deck: ["wizard-wizard-3", "wizard-dragon-1", "wizard-singularity-1", "wizard-wizard-1", "wizard-singularity-2", "wizard-skeleton-4", "wizard-skeleton-3", "wizard-wizard-2"],
        hand: ["wizard-skeleton-1", "wizard-skeleton-2", "wizard-skeleton-6", "wizard-skeleton-5"],
        board: [null, null, null], discard: [],
      },
    },
  },
};

const TOP_KEYS = ["seed", "revision", "rng", "round", "startingSide", "activeSide", "allowances", "actionIds", "result", "sides"];
const SIDE_KEYS = ["baseOrbs", "deck", "hand", "board", "discard"];
const ALLOWANCE_KEYS = ["summonUsed", "castUsed"];

// Baseline state with exactly the T1 additions: trap: null per side,
// tactical: null per allowance and the trap version key.
function withTrapState(base) {
  const out = structuredClone(base);
  for (const side of SIDES) {
    out.sides[side].trap = null;
    out.allowances[side].tactical = null;
  }
  out.traps = { enabled: true, rulesVersion: "orb-duel-draft-1+traps" };
  return out;
}

test("traps flag off: createMatch(0) and createMatch(60) equal the 1c803bc baseline state", () => {
  for (const seed of [0, 60]) {
    assert.deepEqual(createMatch(seed), BASELINE[seed]);
    assert.deepEqual(createMatch(seed, {}), BASELINE[seed]);
    assert.deepEqual(createMatch(seed, { traps: false }), BASELINE[seed]);
  }
});

test("traps flag off adds no key at any level and keeps RULES_VERSION", () => {
  assert.equal(RULES_VERSION, "orb-duel-draft-1");
  for (const seed of [0, 60, 7]) {
    for (const state of [createMatch(seed), createMatch(seed, { traps: false })]) {
      assert.deepEqual(Object.keys(state), TOP_KEYS);
      assert.equal("traps" in state, false);
      for (const side of SIDES) {
        assert.deepEqual(Object.keys(state.sides[side]), SIDE_KEYS);
        assert.deepEqual(Object.keys(state.allowances[side]), ALLOWANCE_KEYS);
      }
    }
  }
});

test("traps flag on adds only trap: null, tactical: null and traps.enabled, no trapSet", () => {
  assert.equal(TRAP_RULES_VERSION, "orb-duel-draft-1+traps");
  assert.notEqual(TRAP_RULES_VERSION, RULES_VERSION);
  for (const seed of [0, 60]) {
    const state = createMatch(seed, { traps: true });
    assert.deepEqual(state, withTrapState(BASELINE[seed]));
    assert.deepEqual(Object.keys(state), [...TOP_KEYS, "traps"]);
    assert.deepEqual(state.traps, { enabled: true, rulesVersion: "orb-duel-draft-1+traps" });
    assert.equal(state.traps?.enabled, true);
    for (const side of SIDES) {
      assert.deepEqual(Object.keys(state.sides[side]), [...SIDE_KEYS, "trap"]);
      assert.equal(state.sides[side].trap, null);
      assert.deepEqual(state.allowances[side], { summonUsed: false, castUsed: false, tactical: null });
      assert.equal("trapSet" in state.allowances[side], false);
    }
  }
});

test("traps flag on keeps card order, RNG and starting side of the same seed", () => {
  for (const seed of [0, 1, 60, 12345]) {
    const off = createMatch(seed);
    const on = createMatch(seed, { traps: true });
    assert.equal(on.rng, off.rng);
    assert.equal(on.startingSide, off.startingSide);
    assert.equal(on.activeSide, off.activeSide);
    for (const side of SIDES) {
      assert.deepEqual(on.sides[side].deck, off.sides[side].deck);
      assert.deepEqual(on.sides[side].hand, off.sides[side].hand);
      assert.deepEqual([...on.sides[side].deck, ...on.sides[side].hand].sort(), [...DECKS[side]].sort());
    }
  }
});

test("traps flag on composes with a custom Cowboy deck", () => {
  const cowboyDeck = [...DECKS.cowboy].reverse();
  const off = createMatch(60, { cowboyDeck });
  const on = createMatch(60, { cowboyDeck, traps: true });
  assert.deepEqual(on, withTrapState(off));
});

test("a fresh restart with traps on creates empty trap state again", () => {
  const first = createMatch(60, { traps: true });
  first.sides.cowboy.trap = { cardId: "placeholder", setRound: 1 };
  first.allowances.wizard.tactical = "spell";
  const restart = createMatch(60, { traps: true });
  assert.deepEqual(restart, withTrapState(BASELINE[60]));
  assert.notEqual(restart.sides, first.sides);
});

test("createMatch does not mutate its options, the custom deck or the default decks", () => {
  const decksBefore = structuredClone(DECKS);
  const cowboyDeck = [...DECKS.cowboy];
  const options = { cowboyDeck, traps: true };
  const frozenCopy = structuredClone(options);
  createMatch(0, options);
  createMatch(0, { traps: false });
  assert.deepEqual(options, frozenCopy);
  assert.equal(options.cowboyDeck, cowboyDeck);
  assert.deepEqual(DECKS, decksBefore);
});

// Two end-phase actions through the real applyAction: the second ends round 1,
// runs an empty clash and starts round 2 with fresh allowances.
function playEmptyRound(state) {
  for (let i = 0; i < 2; i++) {
    const result = applyAction(state, { type: "end-phase", side: state.activeSide, revision: state.revision });
    assert.equal(result.ok, true, result.reason);
    state = result.state;
  }
  return state;
}

test("round start keeps tactical: null on flagged matches and adds nothing off", () => {
  for (const seed of [0, 60]) {
    const on = playEmptyRound(createMatch(seed, { traps: true }));
    assert.equal(on.round, 2);
    assert.equal(on.result, null);
    assert.deepEqual(on.traps, { enabled: true, rulesVersion: "orb-duel-draft-1+traps" });
    for (const side of SIDES) {
      assert.deepEqual(on.allowances[side], { summonUsed: false, castUsed: false, tactical: null });
      assert.equal(on.sides[side].trap, null);
    }

    const off = playEmptyRound(createMatch(seed));
    assert.equal(off.round, 2);
    assert.deepEqual(Object.keys(off), TOP_KEYS);
    for (const side of SIDES) {
      assert.deepEqual(off.allowances[side], { summonUsed: false, castUsed: false });
      assert.deepEqual(Object.keys(off.sides[side]), SIDE_KEYS);
    }
    // Same draws and turn order with the flag on: only the T1 keys differ.
    assert.deepEqual(on, withTrapState(off));
  }
});

test("traps must be a boolean when given", () => {
  for (const traps of [1, "true", null, {}]) {
    assert.throws(() => createMatch(0, { traps }), { name: "TypeError", message: "traps must be a boolean" });
  }
});
