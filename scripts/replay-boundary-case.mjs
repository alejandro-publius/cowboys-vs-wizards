// Replay and inspect the boundary property cases (tests/game/boundary-properties.test.js).
//   node scripts/replay-boundary-case.mjs --summary [--seed N]
//        run every property and print the exercised boundary categories as JSON
//   node scripts/replay-boundary-case.mjs --property BP-CLASH --index 17 [--seed N]
//        rerun one generated case; prints its categories, or the violation and exit status 1
//   node scripts/replay-boundary-case.mjs --fixture docs/evidence/boundary-properties/shrink-m1.json \
//        [--which original|minimized] [--engine real|m1]
//        replay a recorded reducer input against the real engine or the disposable mutant
//   node scripts/replay-boundary-case.mjs --shrink-demo
//        regenerate the reducer receipt (print it; redirect to refresh the committed file)
// --seed N is the same as BOUNDARY_SEED=N. The recorded base seed is 0xB0DA (45274).
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

const { values } = parseArgs({ options: {
  summary: { type: "boolean" }, property: { type: "string" }, index: { type: "string" }, seed: { type: "string" },
  fixture: { type: "string" }, which: { type: "string", default: "minimized" }, engine: { type: "string", default: "real" }, "shrink-demo": { type: "boolean" },
} });
if (values.seed !== undefined) process.env.BOUNDARY_SEED = values.seed;

const dir = "../tests/helpers/boundary-properties/";
const { PROPERTIES, runAll, runProperty } = await import(dir + "properties.js");
const { BASE_SEED } = await import(dir + "rng.js");

if (values.summary) {
  const report = { baseSeed: BASE_SEED, properties: [] };
  for (const property of PROPERTIES) {
    const counts = Object.fromEntries([...runAll(property)].sort(([a], [b]) => a.localeCompare(b)));
    report.properties.push({ id: property.id, reqs: property.reqs, cases: property.cases, categories: counts, declaredButUnexercised: property.categories.filter((c) => !(c in counts)) });
  }
  console.log(JSON.stringify(report, null, 2));
} else if (values.property !== undefined) {
  const property = PROPERTIES.find((p) => p.id === values.property);
  if (!property || !Number.isInteger(Number(values.index))) {
    console.error("usage: --property <BP-ID> --index <case number>; ids: " + PROPERTIES.map((p) => p.id).join(", "));
    process.exit(2);
  }
  try {
    console.log(JSON.stringify({ baseSeed: BASE_SEED, property: property.id, index: Number(values.index), categories: runProperty(property, { index: Number(values.index) }) }));
  } catch (error) {
    console.error(`[${property.id} case ${values.index}, base seed ${BASE_SEED}] ${error.message}`);
    process.exit(1);
  }
} else if (values.fixture !== undefined) {
  const { runSequence } = await import(dir + "shrink.js");
  const { MUTANTS } = await import(dir + "shrink-demo.js");
  if (!(values.engine in MUTANTS)) { console.error("--engine must be real or m1"); process.exit(2); }
  const receipt = JSON.parse(readFileSync(values.fixture, "utf8"));
  const input = values.which in receipt ? receipt[values.which].input : receipt;
  console.log(JSON.stringify(runSequence(input, MUTANTS[values.engine])));
} else if (values["shrink-demo"]) {
  const { buildShrinkDemo } = await import(dir + "shrink-demo.js");
  console.log(JSON.stringify(buildShrinkDemo(), null, 1));
} else {
  console.error("usage: see the header of scripts/replay-boundary-case.mjs");
  process.exit(2);
}
