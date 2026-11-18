// Pure helpers of scripts/browser-pace-measure.mjs (issue #125). No browser is
// launched here and no timing threshold is asserted: timings come only from
// real Chrome runs of the script.
import test from "node:test";
import assert from "node:assert/strict";
import {compareOrder, markdown, modeOrder, parseArgs, queryFor, receipt, summarize} from "../../scripts/browser-pace-measure.mjs";

test("defaults: seeds 0 and 60, both modes, three samples", () => {
  const cfg = parseArgs([]);
  assert.deepEqual(cfg.seeds, [0, 60]);
  assert.deepEqual(cfg.modes, ["default", "fast"]);
  assert.equal(cfg.samples, 3);
  assert.equal(cfg.turns, 2);
  assert.equal(cfg.out, null);
});

test("rejects unknown modes, bad seeds and out-of-range counts", () => {
  assert.throws(() => parseArgs(["--modes", "default,slow"]), /--modes/);
  assert.throws(() => parseArgs(["--seeds", "0,-1"]), /--seeds/);
  assert.throws(() => parseArgs(["--samples", "0"]), /--samples/);
  assert.throws(() => parseArgs(["--turns", "1.5"]), /--turns/);
});

test("default mode adds no pace parameter; fast adds exactly pace=fast", () => {
  assert.equal(queryFor("default", 0), "?mode=match&deck=starter&seed=0");
  assert.equal(queryFor("fast", 60), "?mode=match&deck=starter&seed=60&pace=fast");
  assert.equal(new URLSearchParams(queryFor("default", 0)).has("pace"), false);
  assert.throws(() => queryFor("FAST", 0));
});

test("mode order alternates per sample", () => {
  assert.deepEqual(modeOrder(["default", "fast"], 0), ["default", "fast"]);
  assert.deepEqual(modeOrder(["default", "fast"], 1), ["fast", "default"]);
});

test("summarize gives median, min and max and skips missing values", () => {
  assert.deepEqual(summarize([3, 1, 2]), {n: 3, median: 2, min: 1, max: 3});
  assert.deepEqual(summarize([4, null, 1]), {n: 2, median: 2.5, min: 1, max: 4});
  assert.deepEqual(summarize([]), {n: 0, median: null, min: null, max: null});
});

test("order comparison separates identical, merged and reordered steps", () => {
  assert.equal(compareOrder(["a", "b", "c"], ["a", "b", "c"]), "identical");
  assert.equal(compareOrder(["a", "c"], ["a", "b", "c"]), "subsequence");
  assert.equal(compareOrder(["a", "c", "b"], ["a", "b", "c"]), "different");
});

test("receipt shape: per-metric rows per mode, order verdicts, fails on remote requests", () => {
  const cfg = {...parseArgs(["--seeds", "0", "--samples", "1", "--turns", "1"])};
  const turn = (ms, seq) => ({turn: 1, cardAck: {dom: 2, frame: 14}, escapeAck: {dom: 2, frame: 15}, endAck: {dom: 7, frame: 13},
    toCpuTurn: ms / 10, toComplete: ms, boardOrder: seq});
  const runs = [{mode: "default", seed: 0, loadMs: 500, gpu: "g", turns: [turn(7400, ["a", "b"])], consoleErrors: [], remoteRequests: []},
    {mode: "fast", seed: 0, loadMs: 500, gpu: "g", turns: [turn(5000, ["a", "b"])], consoleErrors: [], remoteRequests: []}];
  const rec = receipt(cfg, runs, "hash");
  assert.equal(rec.pass, true);
  assert.equal(rec.order[0].order, "identical");
  const complete = rec.table.find((r) => r.metric.startsWith("End phase click → next"));
  assert.equal(complete.default.median, 7400);
  assert.equal(complete.fast.median, 5000);
  assert.equal(rec.runs[0].turns[0].boardOrder, undefined);
  assert.match(markdown(rec), /\| 0 \| 1 \| End phase click → next input\/terminal \| 7400 /);
  runs[1].remoteRequests = ["https://example.invalid/x"];
  assert.equal(receipt(cfg, runs, "hash").pass, false);
});
