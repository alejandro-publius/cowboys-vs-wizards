import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CARDS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch, MAX_ROUNDS } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { CPU_LEVELS, chooseAction, cpuFor } from "../../src/game/cpu.js";
import { MAX_STEPS, playMatch } from "../../scripts/play-match.mjs";
import { HISTORICAL_CARDS, historicalBot } from "../../scripts/compare-ride-out.mjs";

// Issue #95, trap T5: the trap-aware CPU (contract section 6). The shipped
// catalog has no trap card, so these tests use fixture IDs that exist only in
// this file. They reach the engine and the CPU through the `cards` option of
// applyAction, legalActions and chooseAction, and enter a hand or deck by
// editing a cloned state. CARDS and DECKS stay as shipped.
const TRAP_W = "test-fixture-cpu-trap-w1";
const TRAP_W2 = "test-fixture-cpu-trap-w2";
const TRAP_C = "test-fixture-cpu-trap-c1";
const TRAP_C2 = "test-fixture-cpu-trap-c2";
const fixtureTrap = (id, side) => Object.freeze({ id, side, kind: "trap", name: "Test fixture trap" });
const TEST_CARDS = Object.freeze({
  ...CARDS,
  [TRAP_W]: fixtureTrap(TRAP_W, "wizard"),
  [TRAP_W2]: fixtureTrap(TRAP_W2, "wizard"),
  [TRAP_C]: fixtureTrap(TRAP_C, "cowboy"),
  [TRAP_C2]: fixtureTrap(TRAP_C2, "cowboy"),
});
const OPT = { cards: TEST_CARDS };
// The same fixture catalog read as before card-level rides: no card has `rides`.
const HISTORICAL_OPT = { cards: Object.freeze({ ...HISTORICAL_CARDS, ...Object.fromEntries([TRAP_W, TRAP_W2, TRAP_C, TRAP_C2].map((id) => [id, TEST_CARDS[id]])) }) };

const wizardChoice = (state) => chooseAction(publicState(state, "wizard"), OPT);

// Seed 0 trap match with the Wizard to act in round 1. Wizard hand:
// singularity-1, singularity-2 (spells), wizard-3, skeleton-1, plus the
// fixture trap. A one-health Cowboy troop in lane 0 gives the spells a kill,
// so casting is worth it and the trap visibly takes the spell's place.
function wizardPosition({ trapInHand = true } = {}) {
  const state = structuredClone(createMatch(0, { traps: true }));
  state.startingSide = state.activeSide = "wizard";
  if (trapInHand) state.sides.wizard.hand.push(TRAP_W);
  const cowboy = state.sides.cowboy;
  cowboy.hand.splice(cowboy.hand.indexOf("cowboy-billy-3"), 1);
  cowboy.board[0] = { cardId: "cowboy-billy-3", health: 1 };
  return state;
}

// Wizard lanes full of troops no hand card improves on, so no summon scores
// above ending the phase.
const FULL_BOARD = () => ["wizard-wizard-1", "wizard-wizard-2", "wizard-dragon-1"].map((cardId) => ({ cardId, health: CARDS[cardId].health }));

function accept(state, action) {
  const legal = legalActions(state, state.activeSide, OPT).map((each) => JSON.stringify(each));
  assert.ok(legal.includes(JSON.stringify(action)), `not in the legal list: ${JSON.stringify(action)}`);
  const applied = applyAction(state, action, OPT);
  assert.equal(applied.ok, true, applied.reason);
  return applied.state;
}

test("beneficial summon first, then one trap set instead of a cast, then end-phase", () => {
  let state = wizardPosition();
  const summon = wizardChoice(state);
  assert.equal(summon.type, "summon");
  state = accept(state, summon);

  // A spell is legal and would be cast without the trap; the trap is set instead.
  assert.ok(legalActions(state, "wizard", OPT).some((action) => action.type === "spell"));
  const set = wizardChoice(state);
  assert.deepEqual(set, { type: "set-trap", side: "wizard", revision: state.revision, cardId: TRAP_W });
  state = accept(state, set);
  assert.deepEqual(state.allowances.wizard, { summonUsed: true, castUsed: true, tactical: "trap" });
  assert.deepEqual(state.sides.wizard.trap, { cardId: TRAP_W, setRound: 1 });

  // The set used the tactical action: no cast is listed or accepted.
  const legal = legalActions(state, "wizard", OPT);
  assert.deepEqual(legal.map(({ type }) => type), ["end-phase"]);
  const spell = { type: "spell", side: "wizard", revision: state.revision, cardId: "wizard-singularity-1", target: 0 };
  assert.equal(applyAction(state, spell, OPT).reason, "cast-after-trap");
  assert.deepEqual(wizardChoice(state), legal[0]);

  // Without the trap the same position casts after the summon.
  let control = wizardPosition({ trapInHand: false });
  control = accept(control, wizardChoice(control));
  assert.equal(wizardChoice(control).type, "spell");
});

test("with no beneficial summon the trap is set first, and the summon is then closed", () => {
  const state = wizardPosition();
  state.sides.wizard.board = FULL_BOARD();
  assert.equal(chooseAction(publicState(wizardPosition({ trapInHand: false }), "wizard"))?.type, "summon", "control: the empty board summons");
  const set = wizardChoice(state);
  assert.equal(set.type, "set-trap");
  const next = accept(state, set);
  assert.deepEqual(legalActions(next, "wizard", OPT).map(({ type }) => type), ["end-phase"]);
  assert.equal(wizardChoice(next).type, "end-phase");
});

test("no second set while the zone holds a trap; the second trap is set once the zone clears", () => {
  const full = wizardPosition();
  full.sides.wizard.hand.push(TRAP_W2);
  full.sides.wizard.hand.splice(full.sides.wizard.hand.indexOf(TRAP_W), 1);
  full.sides.wizard.trap = { cardId: TRAP_W, setRound: 1 };
  full.round = 2;
  assert.equal(legalActions(full, "wizard", OPT).some(({ type }) => type === "set-trap"), false);

  // Phase by phase the choice is the one the CPU makes with no trap in hand.
  let state = full;
  for (let step = 0; step < 3 && state.activeSide === "wizard"; step++) {
    const choice = wizardChoice(state);
    assert.notEqual(choice.type, "set-trap");
    const without = structuredClone(state);
    without.sides.wizard.hand.splice(without.sides.wizard.hand.indexOf(TRAP_W2), 1);
    assert.deepEqual(choice, wizardChoice(without), `step ${step}`);
    if (choice.type === "end-phase") break;
    state = accept(state, choice);
  }

  const cleared = structuredClone(full);
  cleared.sides.wizard.trap = null;
  cleared.sides.wizard.board = FULL_BOARD();
  assert.deepEqual(wizardChoice(cleared), { type: "set-trap", side: "wizard", revision: cleared.revision, cardId: TRAP_W2 });
});

test("never sets in the final round; sets in the round before", () => {
  for (const round of [MAX_ROUNDS - 1, MAX_ROUNDS]) {
    let state = wizardPosition();
    state.round = round;
    const types = [];
    while (state.activeSide === "wizard" && state.round === round) {
      const choice = wizardChoice(state);
      types.push(choice.type);
      state = accept(state, choice);
    }
    if (round === MAX_ROUNDS) {
      assert.equal(types.includes("set-trap"), false, `round ${round}: ${types}`);
      assert.deepEqual(types, ["summon", "spell", "end-phase"], "the no-trap order");
    } else {
      assert.deepEqual(types, ["summon", "set-trap", "end-phase"]);
    }
  }
});

test("the Wizard's choice never reads the opponent's trap card or hidden cards", () => {
  const base = wizardPosition();
  const expected = wizardChoice(base);
  assert.equal(expected.type, "summon");
  const variants = [null, TRAP_C, TRAP_C2].map((cardId) => {
    const state = structuredClone(base);
    state.sides.cowboy.trap = cardId && { cardId, setRound: 1 };
    // Hidden information also differs: cowboy hand order and both deck orders.
    state.sides.cowboy.hand.reverse();
    state.sides.cowboy.deck.reverse();
    state.sides.wizard.deck.reverse();
    return state;
  });
  for (const state of variants) {
    const view = publicState(state, "wizard");
    const text = JSON.stringify(view);
    for (const id of [TRAP_C, TRAP_C2]) assert.equal(text.includes(id), false);
    // Any read of the opponent's trap marker throws, so a pass proves it is not consulted.
    view.sides.cowboy = new Proxy(view.sides.cowboy, {
      get(target, key) {
        if (key === "trap") throw new Error("the CPU read the opponent's trap zone");
        return target[key];
      },
    });
    assert.deepEqual(chooseAction(view, OPT), expected);
  }
});

// Plays a fixture trap match: CPU against CPU, every action checked against
// the legal list and applied with the fixture catalog.
function fixtureMatch(seed) {
  let state = structuredClone(createMatch(seed, { traps: true }));
  state.sides.wizard.hand.push(TRAP_W);
  state.sides.wizard.deck.splice(3, 0, TRAP_W2);
  const log = [];
  while (!state.result) {
    assert.ok(log.length < MAX_STEPS, `seed ${seed}: no result`);
    const { activeSide: side, round } = state;
    const view = publicState(state, side);
    const before = structuredClone(view);
    const action = chooseAction(view, OPT);
    assert.deepEqual(view, before, `seed ${seed}: view changed`);
    const zoneFull = state.sides[side].trap !== null;
    state = accept(state, action);
    log.push({ seed, round, side, action, zoneFull });
  }
  return { state, log };
}

test("fixture trap matches on seeds 0-49 and 60: legal, one tactical action, ordered, bounded and replayable", () => {
  let sets = 0;
  let triggers = 0;
  for (const seed of [...Array.from({ length: 50 }, (_, i) => i), 60]) {
    const first = fixtureMatch(seed);
    assert.ok(first.state.result, `seed ${seed}`);
    const phases = {};
    for (const { round, side, action, zoneFull } of first.log) {
      const phase = (phases[`${round}:${side}`] ??= []);
      assert.equal(phase.includes(action.type), false, `seed ${seed} round ${round}: second ${action.type}`);
      if (action.type === "set-trap") {
        sets += 1;
        assert.equal(side, "wizard");
        assert.ok(round < MAX_ROUNDS, `seed ${seed}: set in round ${round}`);
        assert.equal(zoneFull, false, `seed ${seed}: set onto a full zone`);
        assert.equal(phase.includes("spell"), false, `seed ${seed}: set after a cast`);
      }
      if (action.type === "spell") assert.equal(phase.includes("set-trap"), false, `seed ${seed}: cast after a set`);
      if (action.type === "summon") assert.equal(phase.includes("set-trap"), false, `seed ${seed}: summon after a set`);
      // A ride-out spends the summon allowance only: it opens a phase, and no cast or set precedes it.
      if (action.type === "summon") assert.equal(phase.includes("ride-out"), false, `seed ${seed}: summon after a ride-out`);
      if (action.type === "ride-out") assert.deepEqual(phase, [], `seed ${seed} round ${round}: ride-out after ${phase}`);
      phase.push(action.type);
    }
    if (first.state.sides.wizard.discard.includes(TRAP_W)) triggers += 1;
    assert.deepEqual(fixtureMatch(seed), first, `seed ${seed}: replay differs`);
  }
  assert.ok(sets >= 51, `${sets} sets`); // the opening trap is set in every match
  assert.ok(triggers > 0, "some fixture trap is spent");
});

// SHA-256 of [actions, result] for Cowboy normal against Wizard <level> on
// seeds 0-199, recorded before this change (main 1f6f80c), flag off and flag
// on with no trap dealt: the two were already equal. Both sides play the
// pre-Ride policy (historicalBot): the recording predates card-level rides.
const BASELINE = {
  easy: "1e8249bb9df6e5919d125eba0453c0394a0f0623fa686ce8c7f395c5286a0298",
  normal: "e6867ef19b9c11edb39e2f6364035987b19ba666b71edc42e3d80b68e1a1508c",
  hard: "d8f564e03ea6452023e7690cdf3fff6352fdc42e9c6e7d52b004090713a6c19d",
};

for (const level of CPU_LEVELS) {
  test(`${level}: traps off and traps on with no trap dealt give the recorded traces on seeds 0-199`, () => {
    for (const traps of [false, true]) {
      const hash = createHash("sha256");
      for (let seed = 0; seed < 200; seed++) {
        const opening = createMatch(seed, traps ? { traps: true } : undefined);
        const { log, state } = playMatch(seed, { cowboy: historicalBot(cpuFor("normal")), wizard: historicalBot(cpuFor(level)) }, opening);
        assert.equal(log.some(({ action }) => action.type === "ride-out"), false, `seed ${seed}`);
        hash.update(JSON.stringify([log.map(({ action }) => action), state.result]));
      }
      assert.equal(hash.digest("hex"), BASELINE[level], `traps ${traps}`);
    }
  });

  test(`${level}: with traps on and none dealt, current play equals traps off and leaves the historical trace only at a ride-out, seeds 0-199`, () => {
    for (let seed = 0; seed < 200; seed++) {
      const bots = { cowboy: cpuFor("normal"), wizard: cpuFor(level) };
      const off = playMatch(seed, bots, createMatch(seed));
      const on = playMatch(seed, bots, createMatch(seed, { traps: true }));
      const actions = (run) => run.log.map(({ action }) => action);
      assert.deepEqual(actions(on), actions(off), `seed ${seed}: flag changes the actions`);
      assert.deepEqual(on.state.result, off.state.result, `seed ${seed}: flag changes the result`);
      const old = playMatch(seed, { cowboy: historicalBot(bots.cowboy), wizard: historicalBot(bots.wizard) }, createMatch(seed, { traps: true }));
      const first = on.log.findIndex(({ action }) => action.type === "ride-out");
      if (first === -1) {
        assert.deepEqual(actions(on), actions(old), `seed ${seed}: differs from the old trace with no ride-out`);
        assert.deepEqual(on.state.result, old.state.result, `seed ${seed}: result`);
      } else {
        assert.deepEqual(actions(on).slice(0, first), actions(old).slice(0, first), `seed ${seed}: differs before the first ride-out`);
        assert.equal(on.log[first].side, "cowboy", `seed ${seed}: only the Cowboy has a rider`);
      }
    }
  });
}

test("a ride-out on a trap match uses the summon allowance only, so a set may follow it but never precede it", () => {
  const stage = () => {
    const state = structuredClone(createMatch(0, { traps: true }));
    state.startingSide = state.activeSide = "cowboy";
    state.sides.cowboy.hand = [TRAP_C];
    state.sides.cowboy.board = [null, { cardId: "cowboy-mounted-billy-1", health: 5 }, null];
    return state;
  };
  const types = (state) => legalActions(state, "cowboy", OPT).map(({ type, slot, destination }) => (type === "ride-out" ? `ride-out ${slot}>${destination}` : type));
  const state = stage();
  assert.deepEqual(types(state), ["set-trap", "ride-out 1>0", "ride-out 1>2", "end-phase"]);

  // Ride first: only the summon allowance is spent; the set is still open, and the zone and tactical slot are untouched.
  const rode = accept(state, { type: "ride-out", side: "cowboy", revision: state.revision, slot: 1, destination: 2 });
  assert.deepEqual(rode.allowances.cowboy, { summonUsed: true, castUsed: false, tactical: null });
  assert.deepEqual(rode.sides.cowboy.board, [null, null, { cardId: "cowboy-mounted-billy-1", health: 5 }]);
  assert.equal(rode.sides.cowboy.trap, null);
  assert.deepEqual(types(rode), ["set-trap", "end-phase"]);
  const set = accept(rode, { type: "set-trap", side: "cowboy", revision: rode.revision, cardId: TRAP_C });
  assert.deepEqual(set.allowances.cowboy, { summonUsed: true, castUsed: true, tactical: "trap" });
  assert.deepEqual(set.sides.cowboy.trap, { cardId: TRAP_C, setRound: 1 });

  // Set first: the cast allowance is spent, so the ride-out is neither listed nor accepted.
  const trapped = accept(stage(), { type: "set-trap", side: "cowboy", revision: 0, cardId: TRAP_C });
  assert.deepEqual(types(trapped), ["end-phase"]);
  const late = applyAction(trapped, { type: "ride-out", side: "cowboy", revision: trapped.revision, slot: 1, destination: 0 }, OPT);
  assert.equal(late.ok, false);
  assert.equal(late.reason, "ride-out-after-spell");
  assert.equal(late.state, trapped);
});

test("seeds 0 and 60: off, on, and on with the fixture catalog but no trap dealt replay the same actions and result", () => {
  for (const seed of [0, 60]) {
    const run = (opening, options) => {
      const bot = (view) => chooseAction(view, options);
      const { log, state } = playMatch(seed, Object.fromEntries(SIDES.map((side) => [side, bot])), opening);
      return { actions: log.map(({ action }) => action), result: state.result };
    };
    // Current policy: the three runs agree, and no trap is ever set.
    const off = run(createMatch(seed));
    assert.deepEqual(run(createMatch(seed, { traps: true })), off, `seed ${seed}`);
    assert.deepEqual(run(createMatch(seed, { traps: true }), OPT), off, `seed ${seed} fixture catalog`);
    assert.equal(off.actions.some(({ type }) => type === "set-trap"), false);
    // Pre-Ride policy (no card-level rides): the same three-way parity, with no ride-out anywhere.
    const old = run(createMatch(seed), HISTORICAL_OPT);
    assert.deepEqual(run(createMatch(seed, { traps: true }), HISTORICAL_OPT), old, `seed ${seed} historical, traps on`);
    assert.deepEqual(run(createMatch(seed, { traps: true }), { cards: HISTORICAL_CARDS }), old, `seed ${seed} historical, plain catalog`);
    assert.equal(old.actions.some(({ type }) => type === "set-trap" || type === "ride-out"), false);
    // Current against old trace: equal up to the first ride-out, and wholly equal when there is none.
    const first = off.actions.findIndex(({ type }) => type === "ride-out");
    if (first === -1) assert.deepEqual(off, old, `seed ${seed}: no ride-out, so the old trace`);
    else assert.deepEqual(off.actions.slice(0, first), old.actions.slice(0, first), `seed ${seed}: before the first ride-out`);
  }
  assert.equal(chooseAction(publicState(createMatch(0), opponent(createMatch(0).activeSide)), OPT), null);
});
