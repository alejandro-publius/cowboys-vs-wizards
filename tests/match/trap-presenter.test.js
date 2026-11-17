// Issue #99, trap T6: the presenter plays trap-set and trap-trigger
// (contract section 5) on a fake scheduler and renderer, with no 3D API.
// Batches are built per viewer from publicState and the T4 publicEvents
// projection. The shipped catalog has no trap card, so the fixture IDs below
// exist only in this file and reach the rules through the `cards` option;
// CARDS and DECKS stay as shipped.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { chooseAction } from "../../src/game/cpu.js";
import { publicEvents, publicState } from "../../src/game/view.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createPresenter, DEFAULT_PAUSES } from "../../src/match/presenter.js";

const TRAP_OF = { cowboy: "test-fixture-presenter-trap-c", wizard: "test-fixture-presenter-trap-w" };
const TEST_CARDS = Object.freeze({
  ...CARDS,
  ...Object.fromEntries(
    SIDES.map((side) => [TRAP_OF[side], Object.freeze({ id: TRAP_OF[side], side, kind: "trap", name: "Test fixture trap" })]),
  ),
});
const OPT = { cards: TEST_CARDS };
const STEP = 10;
const MAX_TICKS = 2000;

// A renderer with the full interface and the optional clashReady. Every call
// is logged with the clock time. It has no trap method: traps need none.
function fakeRenderer(scheduler) {
  const calls = [];
  const log = (op, args) => calls.push({ op, args: structuredClone(args), at: scheduler.now() });
  return {
    calls,
    reset: (view) => log("reset", { view }),
    clear: () => log("clear", {}),
    setTroopOrbs: (side, slot, n) => log("setTroopOrbs", { side, slot, n }),
    setBaseOrbs: (side, n) => log("setBaseOrbs", { side, n }),
    summon: (args) => (log("summon", args), { impact: 100, end: 200 }),
    attack: (args) => (log("attack", args), { impact: 250, end: 450 }),
    spell: (args) => (log("spell", args), { impact: 120, end: 240 }),
    remove: (args) => (log("remove", args), { end: 80 }),
    move: (args) => (log("move", args), { end: 90 }),
    clashReady: (troops, ms) => log("clashReady", { troops, ms }),
  };
}

function harness() {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const renderer = fakeRenderer(scheduler);
  const errors = [];
  const changes = [];
  let drains = 0;
  const presenter = createPresenter({
    scheduler,
    renderer,
    onChange: (copy) => changes.push(copy),
    onDrain: () => (drains += 1),
    onError: (error) => errors.push(error),
  });
  const drain = () => {
    for (let ticks = 0; presenter.busy() && errors.length === 0; ticks++) {
      assert.ok(ticks < MAX_TICKS, "playback did not drain");
      scheduler.tick(scheduler.now() + STEP);
    }
    if (errors.length > 0) throw errors[0];
  };
  return { scheduler, renderer, presenter, errors, changes, drain, drains: () => drains };
}

// One batch as `viewer` sees it.
function batchFor(viewer, before, applied) {
  return {
    from: publicState(before, viewer),
    to: publicState(applied.state, viewer),
    events: publicEvents(applied.events, viewer),
  };
}

function act(state, action) {
  const applied = applyAction(state, { side: state.activeSide, revision: state.revision, ...action }, OPT);
  assert.equal(applied.ok, true, applied.reason);
  return applied;
}

// Seed 0 trap match. Each side gets its fixture trap in hand and its first
// `troops` deck troops on the board from slot 0, so each trap has a target
// and, with two troops, a damage event follows the trigger.
function fixture(troops) {
  const state = structuredClone(createMatch(0, { traps: true }));
  for (const side of SIDES) {
    const own = state.sides[side];
    own.hand.push(TRAP_OF[side]);
    for (let slot = 0; slot < troops; slot++) {
      const troop = own.deck.find((id) => CARDS[id].kind === "troop");
      own.deck.splice(own.deck.indexOf(troop), 1);
      own.board[slot] = { cardId: troop, health: CARDS[troop].health };
    }
  }
  return state;
}

// Round 1: each side sets its trap and ends its phase (one batch per action).
// Round 2: both end; the clash triggers both traps.
function setThenTrigger(troops) {
  const steps = [];
  let state = fixture(troops);
  const run = (action) => {
    const applied = act(state, action);
    steps.push({ before: state, applied });
    state = applied.state;
  };
  for (let i = 0; i < 2; i++) {
    run({ type: "set-trap", cardId: TRAP_OF[state.activeSide] });
    run({ type: "end-phase" });
  }
  run({ type: "end-phase" });
  run({ type: "end-phase" });
  return { start: fixture(troops), steps };
}

function playSteps(viewer, { start, steps }, check) {
  const h = harness();
  h.presenter.reset(publicState(start, viewer));
  steps.forEach(({ before, applied }, index) => {
    const batch = batchFor(viewer, before, applied);
    const first = h.renderer.calls.length;
    h.presenter.enqueue(batch);
    h.drain();
    assert.deepEqual(h.presenter.displayed(), batch.to, `${viewer} step ${index}`);
    check?.({ batch, calls: h.renderer.calls.slice(first), h, index });
  });
  return h;
}

const hasKey = (value, key) =>
  value !== null && typeof value === "object" && (Object.hasOwn(value, key) || Object.values(value).some((v) => hasKey(v, key)));

test("trap-set and trap-trigger batches drain to batch.to for both viewers, with no renderer trap call", () => {
  for (const troops of [1, 2]) {
    const scenario = setThenTrigger(troops);
    const types = scenario.steps.flatMap(({ applied }) => applied.events.map((event) => event.type));
    assert.equal(types.filter((type) => type === "trap-set").length, 2);
    assert.equal(types.filter((type) => type === "trap-trigger").length, 2);
    for (const viewer of SIDES) {
      const h = playSteps(viewer, scenario);
      assert.equal(h.drains(), scenario.steps.length);
      const ops = new Set(h.renderer.calls.map((call) => call.op));
      assert.ok(![...ops].some((op) => /trap/i.test(op)));
    }
  }
});

test("a trap-set pause is 150 ms and patches the setter's zone, hand and allowance; the opponent sees only faceDown", () => {
  assert.equal(DEFAULT_PAUSES["trap-set"], 150);
  assert.equal(DEFAULT_PAUSES["trap-trigger"], 400);
  const { start, steps } = setThenTrigger(1);
  const [{ before, applied }] = steps;
  const setter = before.activeSide;
  for (const viewer of SIDES) {
    const h = harness();
    h.presenter.reset(publicState(start, viewer));
    const batch = batchFor(viewer, before, applied);
    assert.deepEqual(batch.events.map((event) => event.type), ["trap-set"]);
    h.presenter.enqueue(batch);
    // Patched when the event starts; the pause runs 150 ms.
    const shown = h.presenter.displayed();
    assert.deepEqual(shown.sides[setter].trap, batch.to.sides[setter].trap);
    assert.deepEqual(shown.allowances[setter], batch.to.allowances[setter]);
    if (viewer === setter) {
      assert.deepEqual(shown.sides[setter].trap, { cardId: TRAP_OF[setter], setRound: 1 });
      assert.deepEqual(shown.sides[setter].hand, batch.to.sides[setter].hand);
      assert.equal(shown.allowances[setter].tactical, "trap");
    } else {
      assert.deepEqual(shown.sides[setter].trap, { faceDown: true, setRound: 1 });
      assert.equal(Object.hasOwn(shown.sides[setter], "hand"), false);
      assert.equal(Object.hasOwn(shown.allowances[setter], "tactical"), false);
    }
    assert.equal(shown.sides[setter].handCount, batch.to.sides[setter].handCount);
    h.scheduler.tick(140);
    assert.equal(h.presenter.busy(), true);
    h.scheduler.tick(150);
    assert.equal(h.presenter.busy(), false);
    assert.deepEqual(h.presenter.displayed(), batch.to);
  }
});

test("an opponent never receives a trap-set cardId; a raw one is refused before anything is queued", () => {
  const scenario = setThenTrigger(2);
  for (const viewer of SIDES) {
    const fake = TRAP_OF[SIDES.find((side) => side !== viewer)];
    playSteps(viewer, scenario, ({ calls, h, index }) => {
      // Before the trigger batch (the last), nothing shown to this viewer names the opponent's trap.
      if (index < scenario.steps.length - 1) {
        assert.equal(JSON.stringify(calls).includes(fake), false);
        assert.equal(JSON.stringify(h.changes).includes(fake), false);
      }
    });
    const { before, applied } = scenario.steps.find(
      ({ applied }) => applied.events[0].type === "trap-set" && applied.events[0].side !== viewer,
    );
    const projected = batchFor(viewer, before, applied);
    assert.equal(hasKey(projected.events, "cardId"), false);
    assert.equal(JSON.stringify(projected).includes(fake), false);
    const h = harness();
    h.presenter.reset(projected.from);
    const raw = { ...projected, events: structuredClone(applied.events) };
    assert.throws(() => h.presenter.enqueue(raw), /trap-set names its cardId.*publicEvents/);
    assert.equal(h.presenter.busy(), false);
  }
});

test("trap-trigger reveals the card, clears the zone, appends discard, and keeps the fixed event order", () => {
  const scenario = setThenTrigger(2);
  const clash = scenario.steps.at(-1);
  const raw = clash.applied.events.map((event) => event.type);
  const from = raw.indexOf("clash");
  const tail = raw.slice(from).filter((type) => ["clash", "trap-trigger", "damage", "defeat", "result"].includes(type));
  const rank = { clash: 0, "trap-trigger": 1, damage: 2, defeat: 3, result: 4 };
  assert.deepEqual(tail, [...tail].sort((a, b) => rank[a] - rank[b]));
  assert.ok(tail.includes("damage"));
  for (const viewer of SIDES) {
    const h = harness();
    h.presenter.reset(publicState(clash.before, viewer));
    const batch = batchFor(viewer, clash.before, clash.applied);
    const triggers = batch.events.filter((event) => event.type === "trap-trigger");
    assert.deepEqual(triggers.map((event) => event.cardId), SIDES.map((side) => TRAP_OF[side]));
    const seen = [];
    let tick = 0;
    h.presenter.enqueue(batch);
    while (h.presenter.busy()) {
      seen.push(h.presenter.displayed());
      h.scheduler.tick((tick += STEP));
      assert.ok(tick < STEP * MAX_TICKS);
    }
    assert.deepEqual(h.errors, []);
    for (const { side, cardId } of triggers) {
      const revealed = seen.find((view) => view.sides[side].trap === null);
      assert.ok(revealed, `${side} trap cleared`);
      assert.equal(revealed.sides[side].discard.at(-1), cardId);
    }
    assert.deepEqual(h.presenter.displayed(), batch.to);
  }
});

test("clashReady sees every attacker past trap-trigger events; damage stays consecutive and in order", () => {
  const scenario = setThenTrigger(2);
  const clash = scenario.steps.at(-1);
  for (const viewer of SIDES) {
    const h = harness();
    h.presenter.reset(publicState(clash.before, viewer));
    const batch = batchFor(viewer, clash.before, clash.applied);
    const at = batch.events.findIndex((event) => event.type === "clash");
    let first = at + 1;
    while (batch.events[first].type === "trap-trigger") first += 1;
    assert.equal(first - at - 1, 2);
    const damage = [];
    for (let i = first; batch.events[i]?.type === "damage"; i++) damage.push(batch.events[i]);
    assert.ok(damage.length > 0);
    const expected = [];
    for (const { attacker } of damage) {
      if (!expected.some((t) => t.side === attacker.side && t.slot === attacker.slot)) {
        expected.push({ side: attacker.side, slot: attacker.slot });
      }
    }
    h.presenter.enqueue(batch);
    h.drain();
    const calls = h.renderer.calls;
    const ready = calls.filter((call) => call.op === "clashReady");
    assert.deepEqual(ready[0].args.troops, expected);
    assert.equal(ready[0].args.ms, DEFAULT_PAUSES.clash + 2 * DEFAULT_PAUSES["trap-trigger"]);
    assert.deepEqual(ready[1].args, { troops: [], ms: 0 });
    const attacks = calls.filter((call) => call.op === "attack");
    assert.deepEqual(
      attacks.map((call) => call.args),
      damage.map(({ attacker, target }) => ({ attacker, target })),
    );
    // All attacks start together, after the clash pause and both trigger pauses.
    assert.equal(new Set(attacks.map((call) => call.at)).size, 1);
    assert.equal(attacks[0].at - ready[0].at, ready[0].args.ms);
  }
});

test("a trigger that cancels the only attack still progresses to the end of the batch", () => {
  const scenario = setThenTrigger(1);
  const clash = scenario.steps.at(-1);
  const types = clash.applied.events.map((event) => event.type);
  assert.ok(types.includes("trap-trigger"));
  assert.equal(types.includes("damage"), false);
  for (const viewer of SIDES) {
    const h = harness();
    h.presenter.reset(publicState(clash.before, viewer));
    const batch = batchFor(viewer, clash.before, clash.applied);
    h.presenter.enqueue(batch);
    h.drain();
    assert.equal(h.drains(), 1);
    assert.deepEqual(h.presenter.displayed(), batch.to);
    assert.equal(h.renderer.calls.some((call) => call.op === "clashReady" || call.op === "attack"), false);
  }
});

test("reset and scheduler.advance cancel a queued trap-trigger; old callbacks never touch the new match", () => {
  const scenario = setThenTrigger(2);
  const clash = scenario.steps.at(-1);
  for (const mode of ["reset", "advance-then-reset"]) {
    const h = harness();
    h.presenter.reset(publicState(clash.before, "cowboy"));
    h.presenter.enqueue(batchFor("cowboy", clash.before, clash.applied));
    // Into the first trap-trigger pause, after the phase-end and clash pauses.
    // The clock moves in STEP ticks: a delay counts from the tick that schedules it.
    for (let t = STEP; t <= DEFAULT_PAUSES["phase-end"] + DEFAULT_PAUSES.clash + 100; t += STEP) h.scheduler.tick(t);
    assert.equal(h.presenter.displayed().sides[SIDES[0]].trap, null);
    assert.equal(h.presenter.busy(), true);
    if (mode === "advance-then-reset") h.scheduler.advance();
    const fresh = publicState(createMatch(60), "cowboy");
    h.presenter.reset(fresh);
    const calls = h.renderer.calls.length;
    const changes = h.changes.length;
    for (let t = 0; t < 1000; t++) h.scheduler.tick(h.scheduler.now() + STEP);
    assert.equal(h.renderer.calls.length, calls, mode);
    assert.equal(h.changes.length, changes, mode);
    assert.equal(h.presenter.busy(), false);
    assert.deepEqual(h.presenter.displayed(), fresh);
    assert.equal(h.scheduler.pending(), 0);
    assert.deepEqual(h.errors, []);
  }
});

test("CPU-vs-CPU trap matches (fixture traps, seeds 0-19) play every event for both viewers with no error", () => {
  let sets = 0;
  let triggers = 0;
  for (let seed = 0; seed < 20; seed++) {
    let state = structuredClone(createMatch(seed, { traps: true }));
    for (const side of SIDES) state.sides[side].hand.push(TRAP_OF[side]);
    const players = Object.fromEntries(SIDES.map((viewer) => [viewer, harness()]));
    for (const viewer of SIDES) players[viewer].presenter.reset(publicState(state, viewer));
    for (let step = 0; !state.result; step++) {
      const action = chooseAction(publicState(state, state.activeSide), OPT);
      const applied = applyAction(state, { ...action, actionId: `t6-${seed}-${step}` }, OPT);
      assert.equal(applied.ok, true, `seed ${seed} step ${step}: ${applied.reason}`);
      for (const event of applied.events) {
        if (event.type === "trap-set") sets += 1;
        if (event.type === "trap-trigger") triggers += 1;
      }
      for (const viewer of SIDES) {
        const h = players[viewer];
        const batch = batchFor(viewer, state, applied);
        h.presenter.enqueue(batch);
        h.drain();
        assert.deepEqual(h.presenter.displayed(), batch.to, `seed ${seed} step ${step} ${viewer}`);
      }
      state = applied.state;
    }
  }
  assert.ok(sets > 0 && triggers > 0, `${sets} sets, ${triggers} triggers`);
});

// Default (no-trap) seeds 0 and 60: the full renderer trace, change count and
// drawing() keys hash to the value recorded with the presenter at main
// 6f5f088, before T6. publicEvents is the identity on these events.
const BASELINE = {
  0: "34400b3ee4f3270e2dad218183338ca11ae5166f47197f647bd63a92a5ee979d",
  60: "be4b182607dd10503dd38eb71a0b9fd1883b88580b34c861adfc07477c99dd17",
};

function defaultTrace(seed) {
  const h = harness();
  let state = createMatch(seed);
  h.presenter.reset(publicState(state, "cowboy"));
  const draws = [];
  for (let step = 0; !state.result; step++) {
    const action = chooseAction(publicState(state, state.activeSide));
    const applied = applyAction(state, { ...action, actionId: `presenter-${seed}-${step}` });
    assert.equal(applied.ok, true, applied.reason);
    assert.deepEqual(publicEvents(applied.events, "cowboy"), applied.events);
    assert.equal(applied.events.some((event) => event.type.startsWith("trap")), false);
    h.presenter.enqueue({ from: publicState(state, "cowboy"), to: publicState(applied.state, "cowboy"), events: applied.events });
    for (let ticks = 0; h.presenter.busy(); ticks++) {
      assert.ok(ticks < MAX_TICKS);
      const drawing = h.presenter.drawing();
      if (drawing && draws.at(-1) !== drawing.key) draws.push(drawing.key);
      h.scheduler.tick(h.scheduler.now() + STEP);
    }
    assert.deepEqual(h.errors, []);
    state = applied.state;
  }
  const trace = JSON.stringify({ calls: h.renderer.calls, changes: h.changes, draws, end: h.scheduler.now() });
  return createHash("sha256").update(trace).digest("hex");
}

test("default no-trap seeds 0 and 60 play exactly as before T6", () => {
  for (const side of SIDES) assert.equal(DECKS[side].some((id) => CARDS[id].kind === "trap"), false);
  for (const seed of [0, 60]) assert.equal(defaultTrace(seed), BASELINE[seed], `seed ${seed}`);
});
