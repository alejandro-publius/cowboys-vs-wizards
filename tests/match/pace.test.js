import test from "node:test";
import assert from "node:assert/strict";
import { paceOptions, FAST_PACE } from "../../src/match/pace.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createPresenter, DEFAULT_PAUSES } from "../../src/match/presenter.js";

test("default and unknown pace values change nothing", () => {
  for (const v of [null, undefined, "", "slow", "FAST", "fast "]) assert.deepEqual(paceOptions(v), {});
});

test("fast pace sets exactly the proposed values", () => {
  assert.deepEqual(paceOptions("fast"), {
    cpuDelay: 250,
    pauses: { "round-start": 250, "phase-start": 150, "phase-end": 80 },
  });
  assert.equal(FAST_PACE.drawHidden, 120);
  assert.equal(FAST_PACE.drawVisible, 300);
});

test("fast pace never overrides clash, result or draw pauses", () => {
  const { pauses } = paceOptions("fast");
  for (const k of ["clash", "result", "draw", "damage", "defeat"]) assert.equal(Object.hasOwn(pauses, k), false);
});

// Play a seeded CPU match through a presenter; return renderer ops in order
// plus the finish time. Every cue is a fixed 100 ms impact, 200 ms end.
function play(seed, pauses) {
  const scheduler = createScheduler();
  const ops = [];
  const renderer = new Proxy({}, { get: (_, op) => (...args) => { ops.push(`${op} ${JSON.stringify(args)}`); return { impact: 100, end: 200 }; } });
  const errors = [];
  const presenter = createPresenter({ scheduler, renderer, pauses, onError: (e) => errors.push(e) });
  let state = createMatch(seed);
  presenter.reset(publicState(state, "cowboy"));
  for (let step = 0; !state.result; step++) {
    const action = chooseAction(publicState(state, state.activeSide));
    const applied = applyAction(state, { ...action, actionId: `pace-${seed}-${step}` });
    assert.equal(applied.ok, true);
    presenter.enqueue({ from: publicState(state, "cowboy"), to: publicState(applied.state, "cowboy"), events: applied.events });
    for (let t = 0; presenter.busy() && !errors.length; t++) {
      assert.ok(t < 1000);
      scheduler.tick(scheduler.now() + 10);
    }
    assert.deepEqual(errors, []);
    state = applied.state;
  }
  return { ops, end: scheduler.now() };
}

test("fast pace keeps renderer cue order identical and finishes sooner", () => {
  for (const seed of [0, 60]) {
    const base = play(seed, undefined);
    const fast = play(seed, paceOptions("fast").pauses);
    assert.ok(base.ops.length > 0);
    assert.deepEqual(fast.ops, base.ops, `seed ${seed}`);
    assert.ok(fast.end < base.end, `seed ${seed}: ${fast.end} < ${base.end}`);
  }
});

test("fast pace waits are shorter than defaults", () => {
  const { pauses } = paceOptions("fast");
  for (const [k, v] of Object.entries(pauses)) assert.ok(v < DEFAULT_PAUSES[k], k);
});
