// Epoch scheduler (src/match/scheduler.js), driven by a fake clock: plain
// numbers passed to tick(). Impact callbacks and CPU requests are ordinary
// timers, so the timer cases cover them too.
import test from "node:test";
import assert from "node:assert/strict";
import { createScheduler } from "../../src/match/scheduler.js";

test("timers run in order of time, then insertion, and the clock never moves back", () => {
  const scheduler = createScheduler();
  const log = [];
  scheduler.after(20, () => log.push("b"));
  scheduler.after(10, () => log.push("a"));
  scheduler.after(20, () => log.push("c"));
  scheduler.after(0, () => log.push("zero"));
  scheduler.tick(5);
  assert.deepEqual(log, ["zero"]);
  scheduler.tick(30); // one jump past both times: still time order, ties by insertion
  assert.deepEqual(log, ["zero", "a", "b", "c"]);

  scheduler.tick(25);
  assert.equal(scheduler.now(), 30);
  scheduler.after(10, () => log.push(`late at ${scheduler.now()}`));
  scheduler.tick(39);
  scheduler.tick(40);
  assert.deepEqual(log.slice(4), ["late at 40"]);

  assert.throws(() => scheduler.after(-1, () => {}), RangeError);
  assert.throws(() => scheduler.after(Number.NaN, () => {}), RangeError);
  assert.throws(() => scheduler.tick(Number.NaN), TypeError);
});

test("a zero-delay chain scheduled during a tick runs in that tick", () => {
  const scheduler = createScheduler();
  const log = [];
  scheduler.after(10, () => {
    log.push("first");
    scheduler.after(0, () => {
      log.push("chained");
      scheduler.after(0, () => log.push("chained again"));
    });
    scheduler.after(5, () => log.push("later"));
  });
  scheduler.after(10, () => log.push("tie"));
  scheduler.tick(10);
  assert.deepEqual(log, ["first", "tie", "chained", "chained again"]);
  assert.equal(scheduler.pending(), 1);
  scheduler.tick(15);
  assert.equal(log.at(-1), "later");

  const runaway = createScheduler();
  const loop = () => runaway.after(0, loop);
  runaway.after(0, loop);
  assert.throws(() => runaway.tick(0), /more than 100000 timer callbacks in one tick/);
});

test("frames get dt since their previous call and are dropped when they return false", () => {
  const scheduler = createScheduler();
  scheduler.tick(100);
  const calls = [];
  scheduler.frame((dt, now) => {
    calls.push([dt, now]);
    return calls.length < 3;
  });
  scheduler.tick(116);
  scheduler.tick(150);
  scheduler.tick(150);
  assert.deepEqual(calls, [
    [16, 116],
    [34, 150],
    [0, 150],
  ]);
  assert.equal(scheduler.pending(), 0);
  scheduler.tick(200);
  assert.equal(calls.length, 3);

  // A frame registered during the frame pass starts on the next tick.
  const nested = [];
  scheduler.frame(() => {
    scheduler.frame((dt) => {
      nested.push(dt);
      return false;
    });
    return false;
  });
  scheduler.tick(210);
  assert.deepEqual(nested, []);
  scheduler.tick(230);
  assert.deepEqual(nested, [20]);
});

test("cancel removes a pending timer or frame, also from inside a callback", () => {
  const scheduler = createScheduler();
  const log = [];
  scheduler.after(10, () => log.push("kept"));
  const dropped = scheduler.after(10, () => log.push("dropped"));
  const frame = scheduler.frame(() => log.push("frame"));
  assert.equal(scheduler.cancel(dropped), true);
  assert.equal(scheduler.cancel(dropped), false);
  assert.equal(scheduler.cancel(frame), true);

  let victim = null;
  scheduler.after(20, () => scheduler.cancel(victim));
  victim = scheduler.after(20, () => log.push("victim"));
  scheduler.tick(20);
  assert.deepEqual(log, ["kept"]);
  assert.equal(scheduler.pending(), 0);
});

test("after advance() no pending timer, impact, CPU request or frame runs, even after time passes", () => {
  const scheduler = createScheduler();
  const log = [];
  scheduler.after(0, () => log.push("impact"));
  scheduler.after(300, () => log.push("cpu request"));
  scheduler.frame(() => log.push("frame"));
  assert.equal(scheduler.epoch(), 0);
  assert.equal(scheduler.advance(), 1);
  assert.equal(scheduler.epoch(), 1);
  assert.equal(scheduler.pending(), 0);
  scheduler.tick(10000);
  assert.deepEqual(log, []);

  // A restart from inside a callback: the rest of the old match's work in
  // that same tick is dropped, the new match's work runs.
  scheduler.after(5, () => {
    log.push("restart");
    scheduler.advance();
    scheduler.after(0, () => log.push("new match"));
  });
  scheduler.after(5, () => log.push("old impact"));
  scheduler.frame(() => log.push("old frame"));
  scheduler.tick(10005);
  assert.deepEqual(log, ["restart", "new match"]);

  scheduler.frame(() => {
    log.push("mode switch");
    scheduler.advance();
  });
  scheduler.frame(() => log.push("old frame 2"));
  scheduler.tick(10010);
  assert.deepEqual(log, ["restart", "new match", "mode switch"]);
  assert.equal(scheduler.epoch(), 3);
  assert.equal(scheduler.pending(), 0);
});

test("a guard-wrapped late callback from an old epoch is dropped", () => {
  const scheduler = createScheduler();
  const log = [];
  const late = scheduler.guard((value) => {
    log.push(value);
    return value;
  });
  assert.equal(late("current"), "current");
  scheduler.advance();
  assert.equal(late("stale CPU result"), undefined);
  assert.deepEqual(log, ["current"]);

  const fresh = scheduler.guard((value) => log.push(value));
  fresh("new epoch");
  assert.deepEqual(log, ["current", "new epoch"]);
});

test("pending() counts the timers and frames still waiting", () => {
  const scheduler = createScheduler();
  assert.equal(scheduler.pending(), 0);
  scheduler.after(10, () => {});
  scheduler.after(20, () => {});
  const frame = scheduler.frame(() => {});
  assert.equal(scheduler.pending(), 3);
  scheduler.tick(10);
  assert.equal(scheduler.pending(), 2);
  scheduler.cancel(frame);
  assert.equal(scheduler.pending(), 1);
  scheduler.tick(20);
  assert.equal(scheduler.pending(), 0);
});
