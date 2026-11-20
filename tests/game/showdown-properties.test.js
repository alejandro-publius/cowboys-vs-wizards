// The seven Showdown engine properties (docs/design/showdown-integration-kiro-brief.md,
// "Property tests worth writing" and item B), generated over legal play on src/game/showdown/.
// Helpers: tests/helpers/boundary-properties/showdown/ (streams from ../rng.js, base seed 0xB0DA;
// BOUNDARY_SEED=<integer> explores another stream). Replay one case alone:
//   node tests/helpers/boundary-properties/showdown/replay.mjs --property SP4 --index 0 [--fault]
//   node tests/helpers/boundary-properties/showdown/replay.mjs --minimal SP3 --fault
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Violation } from "../helpers/boundary-properties/invariants.js";
import { BASE_SEED } from "../helpers/boundary-properties/rng.js";
import { ENGINE } from "../helpers/boundary-properties/showdown/engine.js";
import { FAULTS } from "../helpers/boundary-properties/showdown/faults.js";
import { PROPERTIES, byId, inputFor, runAll, runCase } from "../helpers/boundary-properties/showdown/properties.js";
import { RECEIPT, buildReceipt } from "../helpers/boundary-properties/showdown/receipt.js";
import { runInput } from "../helpers/boundary-properties/showdown/shrink.js";

const sorted = (counts) => JSON.stringify(Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))));

for (const property of PROPERTIES) {
  test(`${property.id} ${property.title}`, (t) => {
    const counts = runAll(property);
    t.diagnostic(`base seed ${BASE_SEED}, ${property.cases} generated cases`);
    t.diagnostic(`categories exercised: ${sorted(counts)}`);
    const missing = property.categories.filter((category) => !counts.has(category));
    assert.deepEqual(missing, [], `declared categories never reached: ${missing.join(", ")}`);
  });
}

test("SP-REPLAY a recorded (property, index, seed) regenerates the same case alone", () => {
  for (const property of PROPERTIES) {
    assert.deepEqual(inputFor(property, 5), inputFor(property, 5), property.id);
    assert.deepEqual([...runCase(property, 5).seen], [...runCase(property, 5).seen], property.id);
  }
});

// Harness verification only: each fault is a disposable wrapper in faults.js, not a production bug.
for (const property of PROPERTIES) {
  const [makeFault, kinds] = FAULTS[property.id];
  test(`HARNESS-VERIFY planted fault ${makeFault.name} is caught by ${property.id}`, (t) => {
    let caught;
    try { runAll(property, { engine: makeFault(ENGINE) }); } catch (error) { caught = error; }
    assert.ok(caught instanceof Violation, `${property.id} did not catch ${makeFault.name}`);
    assert.ok(kinds.includes(caught.kind), `caught as ${caught.kind}`);
    t.diagnostic(`case ${caught.index}: ${caught.message.slice(0, 180)}`);
  });
}

test("HARNESS-VERIFY each fault's failure reduces to the committed minimal case, which replays alone", (t) => {
  const committed = JSON.parse(readFileSync(RECEIPT, "utf8"));
  // The receipt is for the recorded base seed; another BOUNDARY_SEED stream only replays it.
  if (BASE_SEED === committed.baseSeed) {
    assert.deepEqual(buildReceipt(), committed, "receipt is stale: node tests/helpers/boundary-properties/showdown/replay.mjs --write-minimal");
  }
  for (const entry of committed.cases) {
    const property = byId(entry.property);
    const [makeFault] = FAULTS[entry.property];
    assert.equal(entry.exhausted, false, entry.property);
    assert.ok(entry.minimizedSize.total < entry.originalSize.total, `${entry.property} did not shrink`);
    // Replayed from the file itself, on both engines.
    assert.deepEqual(runInput(property, entry.minimized), { status: "pass" }, `${entry.property} real engine`);
    assert.equal(runInput(property, entry.minimized, makeFault(ENGINE)).kind, entry.kind, `${entry.property} fault`);
    t.diagnostic(`${entry.property} case ${entry.index} ${entry.kind}: ${JSON.stringify(entry.originalSize)} -> ${JSON.stringify(entry.minimizedSize)} in ${entry.evaluations} candidate runs`);
  }
});
