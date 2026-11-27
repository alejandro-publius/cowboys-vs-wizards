// Shared helper for Dec 4 fast-check property suites: deterministic FNV-1a seed derivation per property ID
// and optional JSONL execution logging when invoked by `scripts/run-dec4-property-suite.mjs`.
import assert from "node:assert/strict";
import {appendFileSync} from "node:fs";
import fc from "fast-check";

export const SUITE_BASE_SEED = 57028;
export const DEFAULT_RUNS = 30;

export function propSeed(id, baseSeed = SUITE_BASE_SEED) {
  let h = (2166136261 ^ (baseSeed >>> 0)) >>> 0;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h | 0;
}

export function assertProp(id, file, property, numRuns = DEFAULT_RUNS) {
  const seed = propSeed(id);
  const details = fc.check(property, {seed, numRuns});
  if (process.env.CVW_PROPERTY_LOG) {
    appendFileSync(process.env.CVW_PROPERTY_LOG, JSON.stringify({
      id,
      file,
      status: details.failed ? "failed" : "passed",
      numRuns: details.numRuns,
      runs: details.numRuns,
      passed: !details.failed,
      seed,
    }) + "\n");
  }
  if (details.failed) {
    const msg = details.errorInstance?.message ?? details.error ?? "property failed";
    assert.fail(`${id} failed after ${details.numRuns} runs (seed ${seed}, counterexample ${fc.stringify(details.counterexample)}): ${msg}`);
  }
}
