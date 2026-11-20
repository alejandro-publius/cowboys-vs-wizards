// K-089 / K-090 harness arithmetic (scripts/browser-showdown-first-input.mjs). The browser run itself is not repeated here.
import assert from "node:assert/strict";
import test from "node:test";
import {parseArgs, percentile, routeOrder, summarize, ROUTES} from "../scripts/browser-showdown-first-input.mjs";

test("p95 is nearest-rank: index ceil(0.95 n) - 1", () => {
  const v = Array.from({length: 20}, (_, i) => i + 1);
  assert.equal(percentile(v, 0.95), 19);
  assert.equal(percentile([5], 0.95), 5);
  assert.equal(percentile(Array.from({length: 10}, (_, i) => i + 1), 0.95), 10);
  assert.equal(percentile([], 0.95), null);
});

test("summarize sorts, drops non-finite values and keeps the distribution", () => {
  const s = summarize([4, 1, NaN, 3, 2]);
  assert.deepEqual(s, {n: 4, median: 2.5, p95: 4, min: 1, max: 4, values: [1, 2, 3, 4]});
});

test("routes are pinned, alternate per sample, and unknown ones are refused", () => {
  assert.deepEqual(ROUTES, {"boot-hill": "/?seed=0", outrider: "/"});
  assert.deepEqual(routeOrder(["a", "b"], 0), ["a", "b"]);
  assert.deepEqual(routeOrder(["a", "b"], 1), ["b", "a"]);
  assert.throws(() => parseArgs(["--routes", "lane"]), /unknown route/);
  assert.throws(() => parseArgs(["--samples", "0"]), /--samples/);
  assert.equal(parseArgs([]).samples, 20);
});
