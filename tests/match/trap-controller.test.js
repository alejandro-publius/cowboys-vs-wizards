// Issue #104: the controller hands the Presenter the Cowboy's projection of
// each accepted action's events (publicEvents, contract section 6), so an
// opt-in trap match runs through the controller without leaking the Wizard's
// face-down trap. The shipped catalog has no trap card, so the two fixture IDs
// below exist only in this file and reach the rules through the `cards`
// option; CARDS, DECKS and the default engine stay as shipped. Results under
// this synthetic fixture say nothing about real balance.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicEvents, publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createController } from "../../src/match/controller.js";

const TRAP_OF = { cowboy: "test-fixture-controller-trap-c", wizard: "test-fixture-controller-trap-w" };
const ENEMY_TRAP = TRAP_OF.wizard;
const TEST_CARDS = Object.freeze({
  ...CARDS,
  ...Object.fromEntries(
    SIDES.map((side) => [TRAP_OF[side], Object.freeze({ id: TRAP_OF[side], side, kind: "trap", name: "Test fixture trap" })]),
  ),
});
const OPT = { cards: TEST_CARDS };
const SEEDS = [0, 60];
const STEP = 50; // the CPU delay (600 ms), every default pause and every fake cue are multiples of it
const MAX_TICKS = 20000;
const IDLE_MS = 5000;

// A renderer with the full interface; every call is logged with its clock time.
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
    spell: (args) => (log("spell", args), { impact: 150, end: 250 }),
    remove: (args) => (log("remove", args), { end: 100 }),
    move: (args) => (log("move", args), { end: 100 }),
  };
}

// The real rules behind the controller's engine interface. `traps` turns on
// the experimental flag and puts each side's fixture trap in its opening
// hand; it then passes the fixture lookup to applyAction and legalActions.
// `log.applied` keeps each accepted result's raw events in this test only.
function testEngine({ traps }) {
  const log = { applied: [], rejected: [] };
  const opt = traps ? OPT : undefined;
  const engine = {
    createMatch(seed) {
      if (!traps) return createMatch(seed);
      const state = createMatch(seed, { traps: true });
      for (const side of SIDES) state.sides[side].hand.push(TRAP_OF[side]);
      return state;
    },
    applyAction(state, action) {
      const result = applyAction(state, action, opt);
      if (result.ok) log.applied.push({ side: action.side, type: action.type, revision: state.revision, events: result.events });
      else log.rejected.push(result.reason);
      return result;
    },
    legalActions: (state, side) => legalActions(state, side, opt),
    publicState,
  };
  return { engine, log };
}

// One controller on a fresh fake clock. `snapshots` holds everything the
// controller exposes to the UI at each onChange.
function harness({ traps }) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const renderer = fakeRenderer(scheduler);
  const { engine, log } = testEngine({ traps });
  const h = { scheduler, renderer, log, cpuCalls: 0, snapshots: [], drainMismatches: [], revealAt: null, revealCalls: null };
  h.controller = createController({
    engine,
    chooseCpuAction: (view) => {
      h.cpuCalls += 1;
      return chooseAction(view, traps ? OPT : undefined);
    },
    scheduler,
    renderer,
    onChange() {
      const c = h.controller;
      // options() is left out: selection.js calls legalActions without the
      // `cards` option, so it throws on the fixture trap in hand (see the
      // issue #104 evidence note). selection.js is outside this task.
      // The first snapshot taken after the Wizard trigger is committed.
      if (h.revealAt === null && enemyTriggerIndex(h.log) !== -1) {
        h.revealAt = h.snapshots.length;
        h.revealCalls = h.renderer.calls.length;
      }
      h.snapshots.push(JSON.stringify({ status: c.status(), view: c.view(), displayed: c.displayed(), message: c.message() }));
      if (["accepting_input", "cpu_turn", "terminal"].includes(c.status()) && !c.busy()) {
        if (!isDeepEqual(c.displayed(), c.view())) h.drainMismatches.push(c.view()?.revision);
      }
    },
  });
  return h;
}

function isDeepEqual(a, b) {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

// The Cowboy move: the CPU rule on the Player_View, entered through submit()
// (set-trap and other actions) and endPhase(). selectionStep has no trap step,
// so the fixture trap is never clicked.
function actCowboy(h, opt) {
  const { controller, log } = h;
  const action = chooseAction(controller.view(), opt);
  const count = log.applied.length;
  const outcome = action.type === "end-phase" ? controller.endPhase() : controller.submit(action);
  assert.equal(outcome.ok, true, outcome.reason);
  assert.equal(log.applied.length, count + 1);
}

// Drives the match; `stop(h)` ends early when it returns true.
function play(h, opt, stop = () => false) {
  for (let ticks = 0; ; ) {
    const status = h.controller.status();
    assert.notEqual(status, "error", `controller error: ${h.controller.message()}`);
    if (status === "terminal" || status === "idle" || stop(h)) return;
    if (status === "accepting_input") {
      actCowboy(h, opt);
      continue;
    }
    assert.ok(++ticks <= MAX_TICKS, "no result");
    h.scheduler.tick(h.scheduler.now() + STEP);
  }
}

const isEnemyTrigger = (event) => event.type === "trap-trigger" && event.side === "wizard";
const enemyTriggerIndex = (log) => log.applied.findIndex((entry) => entry.events.some(isEnemyTrigger));

test("trap match: the Wizard trap-set reaches the Presenter without its cardId, and the trap is shown only once it triggers", () => {
  for (const seed of SEEDS) {
    const h = harness({ traps: true });
    assert.equal(h.controller.start(seed), true);
    play(h, OPT);
    const { revealAt, revealCalls } = h;
    const where = `seed ${seed}`;
    assert.equal(h.controller.status(), "terminal", where);
    assert.ok(h.controller.view().result, where);
    assert.ok(h.controller.view().round > 1, where);
    assert.deepEqual(h.log.rejected, [], where);
    assert.deepEqual(h.drainMismatches, [], where);
    assert.deepEqual(h.controller.displayed(), h.controller.view(), where);

    const raw = h.log.applied.flatMap((entry) => entry.events);
    const sets = raw.filter((event) => event.type === "trap-set");
    assert.ok(sets.some((event) => event.side === "cowboy" && event.cardId === TRAP_OF.cowboy), `${where}: Cowboy set-trap`);
    assert.ok(sets.some((event) => event.side === "wizard" && event.cardId === ENEMY_TRAP), `${where}: raw Wizard trap-set names its card`);
    assert.equal(raw.filter(isEnemyTrigger).length, 1, `${where}: one Wizard trigger`);
    assert.ok(revealAt !== null && revealAt > 0, where);

    // Before the trigger is committed, no view, displayed state, message
    // or renderer call names the Wizard trap; afterwards it is public.
    const before = h.snapshots.slice(0, revealAt);
    assert.ok(before.every((snap) => !snap.includes(ENEMY_TRAP)), `${where}: leaked before trigger`);
    assert.ok(before.some((snap) => snap.includes('"faceDown":true')), `${where}: face-down marker shown`);
    assert.equal(JSON.stringify(h.renderer.calls.slice(0, revealCalls)).includes(ENEMY_TRAP), false, `${where}: renderer leak`);
    const wizardSet = h.log.applied.findIndex((entry) => entry.events.some((e) => e.type === "trap-set" && e.side === "wizard"));
    assert.ok(wizardSet !== -1 && wizardSet < enemyTriggerIndex(h.log), where);
    assert.ok(h.snapshots.slice(revealAt).some((snap) => snap.includes(ENEMY_TRAP)), `${where}: revealed after trigger`);
    assert.ok(h.controller.view().sides.wizard.discard.includes(ENEMY_TRAP), where);
  }
});

test("trap match: restart or leave while a trigger batch is playing drops its callbacks and trap zones", () => {
  for (const seed of SEEDS) {
    for (const cut of ["restart", "leave"]) {
      const where = `seed ${seed} ${cut}`;
      const h = harness({ traps: true });
      h.controller.start(seed);
      play(h, OPT, () => enemyTriggerIndex(h.log) !== -1);
      assert.equal(h.controller.status(), "playing", where);
      assert.equal(h.controller.busy(), true, where);
      const applied = h.log.applied.length;
      const cpuCalls = h.cpuCalls;
      h.controller[cut]();
      const calls = h.renderer.calls.length;
      assert.equal(h.controller.busy(), false, where);
      if (cut === "leave") {
        assert.equal(h.controller.status(), "idle", where);
        assert.equal(h.renderer.calls.at(-1).op, "clear", where);
        h.scheduler.tick(h.scheduler.now() + IDLE_MS);
        assert.equal(h.renderer.calls.length, calls, `${where}: stale renderer call`);
        assert.equal(h.log.applied.length, applied, where);
        assert.equal(h.cpuCalls, cpuCalls, where);
        continue;
      }
      // Restart: a fresh round 1 with empty trap zones, shown as the view.
      const view = h.controller.view();
      assert.equal(view.round, 1, where);
      assert.equal(view.revision, 0, where);
      assert.deepEqual(SIDES.map((side) => view.sides[side].trap), [null, null], where);
      assert.deepEqual(h.controller.displayed(), view, where);
      assert.deepEqual(h.renderer.calls.slice(-2).map((call) => call.op), ["clear", "reset"], where);
      // Until the new match applies an action, the old batch calls nothing.
      for (let t = 0; t < IDLE_MS && h.log.applied.length === applied && h.controller.status() !== "accepting_input"; t += STEP) {
        h.scheduler.tick(h.scheduler.now() + STEP);
        if (h.log.applied.length === applied) assert.equal(h.renderer.calls.length, calls, `${where}: stale renderer call`);
      }
      // The new match then plays to its own result with no error.
      play(h, OPT);
      assert.equal(h.controller.status(), "terminal", where);
      assert.equal(h.log.applied[applied].revision, 0, where);
      assert.deepEqual(h.log.rejected, [], where);
      assert.deepEqual(h.controller.displayed(), h.controller.view(), where);
    }
  }
});

test("trap match: a CPU request pending at restart never acts on the fresh match", () => {
  for (const seed of SEEDS) {
    const where = `seed ${seed}`;
    const h = harness({ traps: true });
    h.controller.start(seed);
    // Wait for a Wizard phase after round 1 (the Wizard trap is set by then), then 300 ms in.
    play(h, OPT, () => h.controller.status() === "cpu_turn" && h.controller.view().round >= 2);
    assert.equal(h.controller.status(), "cpu_turn", where);
    h.scheduler.tick(h.scheduler.now() + 300);
    assert.equal(h.controller.status(), "cpu_turn", where);
    const cpuCalls = h.cpuCalls;
    const applied = h.log.applied.length;
    h.controller.restart();
    const restartedAt = h.scheduler.now();
    // The old request was due 300 ms after the restart; a new one, if any, is due at 600.
    while (h.scheduler.now() < restartedAt + 550) h.scheduler.tick(h.scheduler.now() + STEP);
    assert.equal(h.cpuCalls, cpuCalls, `${where}: the old CPU request ran`);
    assert.equal(h.log.applied.length, applied, `${where}: an old action was applied`);
    assert.equal(h.controller.view().revision, 0, where);
    play(h, OPT);
    assert.equal(h.controller.status(), "terminal", where);
    assert.deepEqual(h.log.rejected, [], where);
    assert.equal(h.log.applied[applied].revision, 0, where);
  }
});

test("flag off: seeds 0 and 60 play to a result and publicEvents is the identity on every batch", () => {
  for (const seed of SEEDS) {
    const where = `seed ${seed}`;
    const h = harness({ traps: false });
    assert.equal(h.controller.start(seed), true);
    play(h, undefined);
    assert.equal(h.controller.status(), "terminal", where);
    assert.ok(h.controller.view().result, where);
    assert.equal(Object.hasOwn(h.controller.view(), "traps"), false, where);
    assert.deepEqual(h.drainMismatches, [], where);
    assert.ok(h.log.applied.length > 0, where);
    for (const { events } of h.log.applied) {
      assert.deepEqual(publicEvents(events, "cowboy"), events, where);
      assert.ok(events.every((event) => !event.type.startsWith("trap")), where);
    }
  }
});
