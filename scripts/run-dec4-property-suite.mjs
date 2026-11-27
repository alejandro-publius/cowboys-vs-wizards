// Executes all 20 rulebook/contract properties from `scripts/showdown-dec4-properties.mjs` plus all 85
// requirement-traced fast-check properties (`PROP-001`..`PROP-085`) via `node --test`, and writes a unified
// `cvw-property-receipt/1` receipt to `reports/properties/latest.json` (105 distinct passing properties).
//
//   node scripts/run-dec4-property-suite.mjs [--commit <sha>=HEAD] [--out reports/properties/latest.json]
import {spawnSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {BASE_SEED, DEFAULT_REPORT, PROPERTIES, QUICK_RUNS, SCHEMA, TEST_FILE, readCommit, runProperty} from "./showdown-dec4-properties.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const EXTRA_SUITES = Object.freeze([
  "tests/game/showdown-catalog-fast-check.test.js",
  "tests/game/showdown-campaign-fast-check.test.js",
  "tests/game/poker-kit-fast-check.test.js",
]);

function parseArgs(argv) {
  let out = DEFAULT_REPORT;
  let commit = readCommit(ROOT);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") {
      out = argv[++i];
    } else if (argv[i] === "--commit") {
      commit = argv[++i];
    } else {
      throw new RangeError(`Unknown option: ${argv[i]}`);
    }
  }
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`Invalid commit SHA: ${commit}`);
  }
  return {out, commit};
}

export function runFullPropertySuite({commit = readCommit(ROOT), out = DEFAULT_REPORT} = {}) {
  const coreEntries = PROPERTIES.map((prop) => {
    const r = runProperty(prop, {numRuns: QUICK_RUNS, baseSeed: BASE_SEED});
    return {
      id: prop.id,
      name: prop.name,
      file: TEST_FILE,
      status: r.passed ? "passed" : "failed",
      numRuns: r.runs,
      runs: r.runs,
      passed: r.passed,
      seed: r.seed,
    };
  });

  const tmp = mkdtempSync(join(tmpdir(), "cvw-prop-suite-"));
  const logFile = join(tmp, "props.jsonl");
  try {
    writeFileSync(logFile, "");
    const run = spawnSync(process.execPath, ["--test", ...EXTRA_SUITES], {
      cwd: ROOT,
      encoding: "utf8",
      env: {...process.env, CVW_PROPERTY_LOG: logFile},
      timeout: 120_000,
    });
    if (run.status !== 0) {
      throw new Error(`node --test failed with status ${run.status}:\n${run.stdout}\n${run.stderr}`);
    }
    const extraEntries = readFileSync(logFile, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    const properties = [...coreEntries, ...extraEntries];
    const passedCount = properties.filter((p) => p.status === "passed").length;
    const totalRuns = properties.reduce((acc, p) => acc + p.numRuns, 0);
    const receipt = {
      schema: SCHEMA,
      generator: "dec4-property-suite/1",
      ruleset: "showdown+frontier-kit+poker",
      commit,
      generatedAt: new Date().toISOString(),
      command: "node scripts/run-dec4-property-suite.mjs",
      summary: {
        properties: properties.length,
        passed: passedCount,
        failed: properties.length - passedCount,
        runs: totalRuns,
      },
      properties,
    };
    if (out) {
      writeFileSync(resolve(ROOT, out), JSON.stringify(receipt, null, 2) + "\n");
    }
    return receipt;
  } finally {
    rmSync(tmp, {recursive: true, force: true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const receipt = runFullPropertySuite(opts);
  console.log(JSON.stringify(receipt.summary));
  process.exitCode = receipt.summary.failed === 0 ? 0 : 1;
}
