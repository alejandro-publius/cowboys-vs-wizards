// Boundary-focused generated properties over the pure rules, mapped to
// numbered acceptance criteria (R<requirement>.<criterion> in
// .kiro/specs/orb-duel/requirements.md; see docs/requirement-test-map.md).
// Generators, invariants and the CPU hidden-information twin live in
// tests/helpers/boundary-properties/. The base seed is recorded in rng.js
// (0xB0DA); replay one case with
//   node scripts/replay-boundary-case.mjs --property BP-CLASH --index 17
// and rerun the whole file with another stream via BOUNDARY_SEED=<integer>.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../../src/game/actions.js";
import { PROPERTIES, runAll, runProperty } from "../helpers/boundary-properties/properties.js";
import { BASE_SEED } from "../helpers/boundary-properties/rng.js";
import { Violation } from "../helpers/boundary-properties/invariants.js";
import { buildShrinkDemo } from "../helpers/boundary-properties/shrink-demo.js";
import { runSequence } from "../helpers/boundary-properties/shrink.js";
import * as mutants from "../helpers/boundary-properties/mutants.js";

const byId = (id) => PROPERTIES.find((property) => property.id === id);

for (const property of PROPERTIES) {
  test(`${property.id} [${property.reqs.join(" ")}] ${property.title}`, (t) => {
    const counts = runAll(property);
    const missing = property.categories.filter((category) => !counts.has(category));
    t.diagnostic(`base seed ${BASE_SEED}, ${property.cases} cases`);
    t.diagnostic(`categories exercised: ${JSON.stringify(Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))))}`);
    assert.deepEqual(missing, [], `declared boundary categories never reached: ${missing.join(", ")}`);
  });
}

test("BP-REPLAY-CASE a recorded (property, index, seed) regenerates the same case", () => {
  for (const property of PROPERTIES) {
    const first = runProperty(property, { index: 3 });
    assert.deepEqual(runProperty(property, { index: 3 }), first, property.id);
  }
});

// Harness verification only. Each mutant is a disposable wrapper in test code
// (tests/helpers/boundary-properties/mutants.js). None is a production bug.
const SENSITIVITY = [
  ["M1 drops a second tribute card", "BP-TRIBUTE", { apply: mutants.applyM1DropsSecondTribute }, ["tribute-discard"]],
  ["M2 a rejection advances the RNG", "BP-REJECT", { apply: mutants.applyM2RejectionTouchesRng }, ["atomicity"]],
  ["M3 accepts a destination for a one-orb target", "BP-SPELL", { apply: mutants.applyM3AcceptsDestinationForDefeatedTarget }, ["rejected"]],
  ["M4 mutual base-zero reported as a win", "BP-CLASH", { apply: mutants.applyM4MutualBaseZeroIsAWin }, ["result"]],
  ["M5 nondeterministic events", "BP-REPLAY", { apply: mutants.applyM5NondeterministicEvents }, ["replay"]],
  ["M6 CPU peeks at the opponent's hand", "BP-CPU", { decider: mutants.deciderM6PeeksAtEnemyHand }, ["cpu-information-leak"]],
];
for (const [name, id, options, kinds] of SENSITIVITY) {
  test(`HARNESS-VERIFY disposable mutant ${name} is caught by ${id}`, (t) => {
    let caught;
    try { runAll(byId(id), options); } catch (error) { caught = error; }
    assert.ok(caught instanceof Violation, `${id} did not detect the mutant`);
    assert.ok(kinds.includes(caught.kind), `detected as ${caught.kind}`);
    t.diagnostic(caught.message.slice(0, 160));
  });
}

test("HARNESS-VERIFY the reducer shrinks a generated mutant failure and keeps its violation", (t) => {
  const demo = buildShrinkDemo();
  const committed = JSON.parse(readFileSync(new URL("../../docs/evidence/boundary-properties/shrink-m1.json", import.meta.url), "utf8"));
  assert.deepEqual(demo, committed, "receipt is stale: node scripts/replay-boundary-case.mjs --shrink-demo > docs/evidence/boundary-properties/shrink-m1.json");

  const { original, minimized } = demo;
  assert.equal(original.mutantResult.status, "violation");
  assert.equal(minimized.mutantResult.kind, original.mutantResult.kind);
  assert.deepEqual(original.originalEngineResult, { status: "pass" });
  assert.deepEqual(minimized.originalEngineResult, { status: "pass" });
  assert.ok(minimized.size.total < original.size.total && minimized.size.actions < original.size.actions);
  assert.equal(demo.budgetExhausted, false);
  // Replay the minimized input from the file itself, on both engines.
  assert.equal(runSequence(committed.minimized.input, mutants.applyM1DropsSecondTribute).kind, original.mutantResult.kind);
  assert.deepEqual(runSequence(committed.minimized.input, applyAction), { status: "pass" });
  t.diagnostic(`size ${JSON.stringify(original.size)} -> ${JSON.stringify(minimized.size)} in ${demo.evaluations} candidate runs`);
});
