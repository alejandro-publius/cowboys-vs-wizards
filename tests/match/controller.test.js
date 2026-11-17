// Match controller (src/match/controller.js). Properties 5 and 6 run as
// seeded loops over seeds 0-99, because no PBT library is installed. Each
// controller runs on the real epoch scheduler with a fake clock (plain
// numbers passed to tick), a recording fake renderer with fixed cue times and
// a recording wrapper around Fable's Engine. Whenever the controller accepts
// input, the Cowboy move is chooseAction(controller.view()), entered through
// selection clicks or through submit() and endPhase(); Wizard moves come from
// the controller's own CPU step.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createController } from "../../src/match/controller.js";

const SEEDS = Array.from({ length: 100 }, (_, seed) => seed); // includes 14, 27 and 47
// The default pauses, the default CPU delay (600 ms) and every fake cue time
// are multiples of STEP, so ticking in STEP increments runs each callback
// exactly when it is due.
const STEP = 50;
const MAX_TICKS = 10000;
const IDLE_MS = 60000;
const SUMMON = { impact: 100, end: 200 };
const SPELL = { impact: 150, end: 250 };
const REMOVE = { end: 100 };
const MOVE = { end: 100 };
const ATTACKS = { Billy: { impact: 400, end: 700 }, Wizard: { impact: 500, end: 800 } };
const attackCue = (cardId) => ({ ...(ATTACKS[CARDS[cardId].name] ?? { impact: 250, end: 450 }) });

// mulberry32, local to this file.
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

function forEachSeed(run) {
  for (const seed of SEEDS) {
    try {
      run(seed);
    } catch (error) {
      throw new Error(`seed ${seed}: ${error.message}`, { cause: error });
    }
  }
}

// Records every call as { op, args, at }, with `at` in ms since the latest
// clear(), so the logs of matches started at different clock times compare
// equal. `impacts` counts orb changes made while an attack is still running.
function recordingRenderer(scheduler) {
  const calls = [];
  let origin = 0;
  let attackEnds = [];
  const record = (op, args) => calls.push({ op, args: structuredClone(args), at: scheduler.now() - origin });
  const cue = (op, args, timing) => {
    record(op, args);
    return { ...timing };
  };
  const renderer = {
    calls,
    impacts: 0,
    midClash: () => attackEnds.some((end) => scheduler.now() < end),
    reset: (view) => record("reset", { view }),
    clear() {
      origin = scheduler.now();
      attackEnds = [];
      record("clear", {});
    },
    setTroopOrbs(side, slot, n) {
      if (renderer.midClash()) renderer.impacts += 1;
      record("setTroopOrbs", { side, slot, n });
    },
    setBaseOrbs(side, n) {
      if (renderer.midClash()) renderer.impacts += 1;
      record("setBaseOrbs", { side, n });
    },
    summon: (args) => cue("summon", args, SUMMON),
    attack(args) {
      const timing = attackCue(args.attacker.cardId);
      attackEnds.push(scheduler.now() + timing.end);
      return cue("attack", args, timing);
    },
    spell: (args) => cue("spell", args, SPELL),
    remove: (args) => cue("remove", args, REMOVE),
    move: (args) => cue("move", args, MOVE),
  };
  return renderer;
}

// Fable's Engine with every call counted, the seeds given to createMatch,
// each applied action with the revision it met and its verdict, and the
// latest committed state.
function recordingEngine() {
  const log = { calls: 0, seeds: [], applied: [], latest: null };
  const engine = {
    createMatch(seed) {
      log.calls += 1;
      log.seeds.push(seed);
      log.latest = createMatch(seed);
      return log.latest;
    },
    applyAction(state, action) {
      log.calls += 1;
      const result = applyAction(state, action);
      log.applied.push({ action: structuredClone(action), revision: state.revision, ok: result.ok, reason: result.reason });
      if (result.ok) log.latest = result.state;
      return result;
    },
    legalActions(state, side) {
      log.calls += 1;
      return legalActions(state, side);
    },
    publicState(state, side) {
      log.calls += 1;
      return publicState(state, side);
    },
  };
  return { engine, log };
}

// One controller on a fresh fake clock. `cpu` stands in for chooseAction and
// gets every argument the controller passes; h.onChange is an optional hook.
function harness({ cpu = chooseAction, randomSeed } = {}) {
  const scheduler = createScheduler();
  const renderer = recordingRenderer(scheduler);
  const { engine, log } = recordingEngine();
  const h = { scheduler, renderer, log, cpuCalls: 0, onChange: null };
  h.controller = createController({
    engine,
    chooseCpuAction: (...args) => {
      h.cpuCalls += 1;
      return cpu(...args);
    },
    scheduler,
    renderer,
    randomSeed,
    onChange: () => h.onChange?.(),
  });
  return h;
}

function tickUntil(h, done) {
  for (let ticks = 0; !done(); ticks++) {
    assert.ok(ticks < MAX_TICKS, "timed out");
    h.scheduler.tick(h.scheduler.now() + STEP);
  }
}

// The Cowboy move: chooseAction on the Player_View, entered through selection
// clicks or through submit() and endPhase(), alternating by revision.
function actCowboy(h, seed) {
  const { controller, log } = h;
  const view = controller.view();
  const action = chooseAction(view);
  const count = log.applied.length;
  const byClicks = (seed + view.revision) % 2 === 0;
  if (action.type === "end-phase") {
    if (byClicks) controller.endPhase();
    else controller.submit(action);
  } else if (!byClicks) {
    controller.submit(action);
  } else {
    controller.input({ type: "card", cardId: action.cardId });
    if (action.type === "summon") {
      for (const slot of action.tributes) controller.input({ type: "slot", side: "cowboy", slot });
      controller.input({ type: "slot", side: "cowboy", slot: action.slot });
    } else {
      controller.input({ type: "slot", side: "wizard", slot: action.target });
    }
    controller.input({ type: "confirm" });
  }
  assert.equal(log.applied.length, count + 1, `revision ${view.revision}: the Cowboy move was not submitted once`);
  const { action: sent, ok, reason } = log.applied.at(-1);
  assert.equal(ok, true, `revision ${view.revision}: ${reason}`);
  assert.deepEqual(sent, { ...action, actionId: sent.actionId });
}

// Drives the match until it ends or is left. Cut moments are counted as they
// pass: "tick", after a tick that leaves the controller playing or on the CPU
// turn, and "impact", inside the onChange that follows an orb change made
// while an attack is running (mid-clash, with later impacts still pending).
// With `cut`, cut.act(h) runs at the cut.k-th moment of kind cut.kind, and
// h.cut records that moment.
function play(h, cut = null) {
  h.moments = { tick: 0, impact: 0 };
  let seen = h.renderer.impacts;
  const moment = (kind) => {
    h.moments[kind] += 1;
    if (!cut || h.cut || cut.kind !== kind || h.moments[kind] !== cut.k) return;
    h.cut = {
      kind,
      status: h.controller.status(),
      midClash: h.renderer.midClash(),
      pending: h.scheduler.pending(),
      calls: h.renderer.calls.length,
      applied: h.log.applied.length,
      cpuCalls: h.cpuCalls,
    };
    cut.act(h);
  };
  h.onChange = () => {
    if (h.renderer.impacts === seen) return;
    seen = h.renderer.impacts;
    moment("impact");
  };
  for (let ticks = 0; ; ) {
    const status = h.controller.status();
    if (status === "error") throw new Error(`controller error: ${h.controller.message()}`);
    if (status === "terminal" || status === "idle") return;
    if (status === "accepting_input") {
      actCowboy(h, h.seed);
      continue;
    }
    assert.ok(++ticks <= MAX_TICKS, `no result after ${MAX_TICKS} ticks`);
    h.scheduler.tick(h.scheduler.now() + STEP);
    if (["playing", "cpu_turn"].includes(h.controller.status())) moment("tick");
  }
}

// A started harness for `seed`.
function started(seed, options) {
  const h = harness(options);
  h.seed = seed;
  assert.equal(h.controller.start(seed), true);
  return h;
}

// ---- Property 5 ----

test("Feature: orb-duel, Property 5: Cancellation", (t) => {
  const coverage = { cpuQueued: 0, midClash: 0, insideImpact: 0 };
  forEachSeed((seed) => {
    const fresh = started(seed);
    play(fresh);

    const random = picker(seed ^ 0xca9ce1);
    const kind = random() < 0.5 && fresh.moments.impact > 0 ? "impact" : "tick";
    const k = 1 + Math.floor(random() * fresh.moments[kind]);

    // Restart at the cut, then play on: from the restart's clear() onward
    // everything equals the fresh match, so no old impact, frame or CPU
    // request reached the new match.
    const restarted = started(seed);
    play(restarted, { kind, k, act: (h) => h.controller.restart() });
    const { cut } = restarted;
    assert.ok(cut, `cut ${kind} ${k} was never reached`);
    assert.ok(["playing", "cpu_turn"].includes(cut.status), `cut during ${cut.status}`);
    const calls = restarted.renderer.calls.slice(cut.calls);
    assert.deepEqual(
      calls.slice(0, 2).map((call) => call.op),
      ["clear", "reset"],
      "the renderer is cleared before the new state is shown",
    );
    assert.deepEqual(calls, fresh.renderer.calls, "renderer calls after the restart");
    assert.deepEqual(restarted.log.applied.slice(cut.applied), fresh.log.applied, "actions applied after the restart");
    assert.equal(restarted.cpuCalls - cut.cpuCalls, fresh.cpuCalls, "CPU requests after the restart");
    assert.deepEqual(restarted.log.latest, fresh.log.latest, "committed state");
    assert.deepEqual(restarted.controller.displayed(), fresh.controller.displayed(), "displayed state");
    assert.deepEqual(restarted.log.seeds, [seed, seed], "the pinned seed is reused");

    // leave() at the same cut: after its clear(), a minute of clock time
    // reaches no renderer, Engine or CPU.
    const left = started(seed);
    play(left, { kind, k, act: (h) => h.controller.leave() });
    assert.deepEqual(
      left.renderer.calls.slice(left.cut.calls).map((call) => call.op),
      ["clear"],
    );
    const before = { renderer: left.renderer.calls.length, engine: left.log.calls, cpu: left.cpuCalls };
    for (const end = left.scheduler.now() + IDLE_MS; left.scheduler.now() < end; ) {
      left.scheduler.tick(left.scheduler.now() + STEP);
    }
    assert.deepEqual({ renderer: left.renderer.calls.length, engine: left.log.calls, cpu: left.cpuCalls }, before, "calls after leave()");
    assert.equal(left.controller.status(), "idle");
    assert.equal(left.controller.busy(), false);
    assert.equal(left.scheduler.pending(), 0);

    if (cut.status === "cpu_turn") {
      assert.ok(cut.pending > 0, "no CPU request was queued during cpu_turn");
      coverage.cpuQueued += 1;
    }
    if (cut.midClash) coverage.midClash += 1;
    if (kind === "impact") coverage.insideImpact += 1;
  });
  for (const [what, count] of Object.entries(coverage)) assert.ok(count > 0, `no cut was ${what}`);
  t.diagnostic(`cuts: ${JSON.stringify(coverage)}`);
});

// ---- Property 6 ----

test("Feature: orb-duel, Property 6: CPU information limit", () => {
  forEachSeed((seed) => {
    const requests = [];
    const h = started(seed, {
      cpu(...args) {
        assert.equal(args.length, 1, "the CPU gets exactly one argument");
        const [view] = args;
        assert.deepEqual(view, publicState(h.log.latest, "wizard"), "the CPU view");
        for (const key of ["seed", "rng", "actionIds"]) assert.equal(Object.hasOwn(view, key), false, `the CPU view holds ${key}`);
        for (const side of SIDES) assert.equal(Object.hasOwn(view.sides[side], "deck"), false, `the CPU view holds the ${side} deck`);
        assert.equal(Object.hasOwn(view.sides.cowboy, "hand"), false, "the CPU view holds the Cowboy hand");
        assert.equal(h.controller.status(), "cpu_turn", "the CPU was asked outside cpu_turn");
        assert.equal(h.controller.busy(), false, "the CPU was asked during playback");
        const action = chooseAction(view);
        requests.push({ returned: structuredClone(action), index: h.log.applied.length });
        return action;
      },
    });
    play(h);

    // Each CPU step applies exactly the action the CPU returned, plus an actionId.
    const wizard = h.log.applied.filter((entry) => entry.action.side === "wizard");
    assert.equal(wizard.length, requests.length, "Wizard actions applied vs CPU requests");
    for (const { returned, index } of requests) {
      const entry = h.log.applied[index];
      assert.deepEqual(entry.action, { ...returned, actionId: entry.action.actionId });
      assert.equal(entry.ok, true, entry.reason);
    }
    // Every submitted action carries the current revision and a match-unique actionId.
    const ids = h.log.applied.map((entry) => entry.action.actionId);
    assert.ok(
      ids.every((id) => typeof id === "string" && id !== ""),
      "an action without an actionId",
    );
    assert.equal(new Set(ids).size, ids.length, "a repeated actionId");
    for (const entry of h.log.applied) assert.equal(entry.action.revision, entry.revision, "an action with an old revision");
  });
});

// ---- Examples ----

// Seed 0: the Cowboy starts, with a Sheriff (no tribute) in hand.
function cowboyOpening() {
  const h = started(0);
  assert.equal(h.controller.status(), "accepting_input");
  const legal = legalActions(h.controller.view(), "cowboy");
  return { h, summon: legal.find((action) => action.type === "summon"), end: legal.at(-1) };
}

test("clicks, end phase and submit() during playback or the CPU turn are ignored and reach no Engine call", () => {
  const { h, summon, end } = cowboyOpening();
  const hand = h.controller.view().sides.cowboy.hand;
  const ignored = (status) => {
    assert.equal(h.controller.status(), status);
    const calls = h.log.calls;
    h.controller.input({ type: "card", cardId: hand[0] });
    h.controller.input({ type: "slot", side: "cowboy", slot: 2 });
    h.controller.input({ type: "confirm" });
    assert.deepEqual(h.controller.submit(end), { ok: false, reason: "busy" });
    assert.deepEqual(h.controller.endPhase(), { ok: false, reason: "busy" });
    assert.equal(h.log.calls, calls, `${status}: an Engine call`);
    assert.equal(h.controller.selection().step, "idle", status);
    assert.equal(h.controller.status(), status);
  };
  assert.deepEqual(h.controller.submit(summon), { ok: true });
  ignored("playing");
  tickUntil(h, () => h.controller.status() !== "playing");
  h.controller.endPhase();
  ignored("playing");
  tickUntil(h, () => h.controller.status() !== "playing");
  ignored("cpu_turn");
  assert.deepEqual(
    h.log.applied.map((entry) => entry.action.type),
    ["summon", "end-phase"],
  );
});

test("a double confirm, or end phase twice, applies once", () => {
  const { h, summon } = cowboyOpening();
  h.controller.input({ type: "card", cardId: summon.cardId });
  h.controller.input({ type: "slot", side: "cowboy", slot: summon.slot });
  assert.equal(h.controller.selection().step, "confirm");
  h.controller.input({ type: "confirm" });
  h.controller.input({ type: "confirm" });
  assert.equal(h.log.applied.length, 1);
  assert.deepEqual(h.log.applied[0].action, { ...summon, actionId: h.log.applied[0].action.actionId });

  tickUntil(h, () => h.controller.status() === "accepting_input");
  h.controller.endPhase();
  h.controller.endPhase();
  assert.deepEqual(
    h.log.applied.map((entry) => [entry.action.type, entry.ok]),
    [
      ["summon", true],
      ["end-phase", true],
    ],
  );
});

test("re-submitting a committed action after the drain is rejected and changes nothing", () => {
  const { h, summon } = cowboyOpening();
  h.controller.submit(summon);
  tickUntil(h, () => h.controller.status() === "accepting_input");
  const committed = h.log.latest;
  const view = h.controller.view();
  const displayed = h.controller.displayed();
  const cases = [
    [h.log.applied[0].action, "duplicate-action", "That move was already played."],
    [summon, "stale", "The board has changed. Choose again."],
  ];
  for (const [action, reason, message] of cases) {
    assert.deepEqual(h.controller.submit(action), { ok: false, reason });
    assert.equal(h.controller.message(), message);
    assert.equal(h.controller.status(), "accepting_input");
    assert.equal(h.log.latest, committed, `${reason}: a state was committed`);
    assert.deepEqual(h.controller.view(), view);
    assert.deepEqual(h.controller.displayed(), displayed);
  }
  assert.equal(h.controller.busy(), false);
  assert.equal(h.scheduler.pending(), 0);
});

test("a generated seed reaches createMatch and is recorded; the default comes from crypto", () => {
  const h = harness({ randomSeed: () => 123456789 });
  assert.equal(h.controller.start(), true);
  assert.deepEqual(h.log.seeds, [123456789]);
  assert.equal(h.controller.seed(), 123456789);
  assert.equal(h.controller.seedPinned(), false);
  assert.deepEqual(h.log.latest, createMatch(123456789));

  const d = harness();
  assert.equal(d.controller.start(), true);
  const [generated] = d.log.seeds;
  assert.ok(Number.isInteger(generated) && generated >= 0 && generated < 2 ** 32, `generated ${generated}`);
  assert.equal(d.controller.seed(), generated);
});

test("restart reuses a pinned seed and otherwise generates a new one", () => {
  const generated = [7, 8];
  const h = harness({ randomSeed: () => generated.shift() });
  assert.equal(h.controller.start("42"), true);
  assert.equal(h.controller.seed(), 42);
  assert.equal(h.controller.seedPinned(), true);
  assert.equal(h.controller.restart(), true);
  assert.deepEqual(h.log.seeds, [42, 42]);

  h.controller.start();
  h.controller.restart();
  assert.deepEqual(h.log.seeds, [42, 42, 7, 8]);
  assert.equal(h.controller.seed(), 8);
  assert.equal(h.controller.seedPinned(), false);

  h.controller.start(4294967295);
  h.controller.restart();
  assert.deepEqual(h.log.seeds.slice(4), [4294967295, 4294967295]);
  assert.equal(h.controller.start("0"), true);
  assert.equal(h.controller.start(60), true);
  assert.deepEqual(h.log.seeds.slice(6), [0, 60]);
});

test("a seed that is not a whole number is refused before createMatch, leaving the match untouched", () => {
  const BAD = ["1.5", "abc", 1.5, "1e3", "", 2 ** 53, -1, "-5", 4294967296, "4294967296", 2 ** 32 + 60, "-0x1"];
  const h = harness();
  for (const bad of BAD) {
    assert.equal(h.controller.start(bad), false, `${bad}`);
    assert.equal(h.controller.message(), "Seed must be a whole number from 0 to 4294967295.");
  }
  assert.deepEqual(h.log.seeds, []);
  assert.equal(h.controller.status(), "idle");
  assert.deepEqual(h.renderer.calls, []);

  // During playback of a running match nothing changes either.
  const { h: running, summon } = cowboyOpening();
  running.controller.submit(summon);
  const snapshot = () => ({
    status: running.controller.status(),
    seed: running.controller.seed(),
    displayed: running.controller.displayed(),
    latest: running.log.latest,
    seeds: [...running.log.seeds],
    calls: running.renderer.calls.length,
    epoch: running.scheduler.epoch(),
    pending: running.scheduler.pending(),
  });
  const before = snapshot();
  for (const bad of BAD) assert.equal(running.controller.start(bad), false);
  assert.deepEqual(snapshot(), before);
  play(running);
  assert.equal(running.controller.status(), "terminal");
});

test("seeds 14, 27 and 47 keep the createMatch opening hands and play to a result", () => {
  for (const seed of [14, 27, 47]) {
    const h = started(seed);
    const opening = createMatch(seed);
    assert.deepEqual(h.log.latest, opening, `seed ${seed}: the committed state after start`);
    assert.deepEqual(h.controller.view().sides.cowboy.hand, opening.sides.cowboy.hand, `seed ${seed}`);
    assert.deepEqual(h.controller.displayed(), publicState(opening, "cowboy"), `seed ${seed}`);
    play(h);
    assert.deepEqual(h.log.seeds, [seed], `seed ${seed}: createMatch called again`);
    assert.equal(h.log.applied[0].revision, 0, `seed ${seed}`);
    assert.equal(h.controller.status(), "terminal", `seed ${seed}`);
    assert.ok(h.log.latest.result, `seed ${seed}: no result`);
  }
});

test("seeds 0-99 finish with the displayed outcome equal to the Engine result", (t) => {
  const outcomes = { win: 0, loss: 0, draw: 0 };
  forEachSeed((seed) => {
    const h = started(seed);
    play(h);
    assert.equal(h.controller.status(), "terminal");
    const { outcome } = publicState(h.log.latest, "cowboy").result;
    assert.equal(h.controller.displayed().result.outcome, outcome);
    assert.deepEqual(h.controller.displayed(), publicState(h.log.latest, "cowboy"));
    outcomes[outcome] += 1;
  });
  t.diagnostic(`Cowboy outcomes: ${JSON.stringify(outcomes)}`);
});
