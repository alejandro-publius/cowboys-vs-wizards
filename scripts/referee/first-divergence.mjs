#!/usr/bin/env node
// Reproduce the first recorded engine/referee divergence from the frozen first-run receipt.
//
//   node scripts/referee/first-divergence.mjs            the receipt's first divergence (seed 109)
//   node scripts/referee/first-divergence.mjs --seed N   the first divergence of another recorded duel
//   node scripts/referee/first-divergence.mjs --json     machine-readable report
//
// Local inputs only, all read-only:
//   proof/referee/freeze.json                            frozen recipe, sources and input digest
//   proof/referee/receipts/first-run-<key>.json          the preserved first full comparison
//   proof/referee/receipts/first-run-<key>.mismatches.jsonl
// The key is derived from the freeze exactly as prove.mjs derives it. Nothing is written.
//
// Steps:
//   1. Fail closed (exit 2) when the freeze, oracle tree, corpus, recipe, rulebook, card CSV,
//      adapter, engine or Showdown rules differ from what the receipt recorded, or when the
//      receipt or its mismatch file fails its integrity check.
//   2. Regenerate the frozen corpus with corpus.mjs recipe()/duels() and check its digest against
//      the freeze, keeping the recorded duel.
//   3. Cut the duel to the exact prefix that ends at the divergent action, replay it through the
//      engine adapter and through `referee.py --stream`, and compare with prove.mjs compareDuel.
//   4. Report the action, both legality verdicts and the state difference, and check that the
//      observed divergence equals the recorded one field for field (exit 0) or not (exit 1).
// The receipt, the referee and the rules are never changed or reinterpreted.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {
  FREEZE_SCHEMA, RECEIPT_SCHEMA, canonicalJson, compareDuel, dealDigest, freezeSources, hashFile, hashTree,
  oracleSkip, proofPaths, readFirstRun, receiptKey, validateDuel,
} from "./prove.mjs";
import * as corpus from "./corpus.mjs";
import * as adapter from "./adapter.mjs";

const USAGE = "usage: node scripts/referee/first-divergence.mjs [--seed N] [--json]";

class Stale extends Error {}

function readJson(file, what) {
  if (!fs.existsSync(file)) throw new Stale(`${what} is missing: ${file}`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { throw new Stale(`${what} is not valid JSON: ${e.message}`); }
}

// Every check prove.mjs makes before a full run, plus the receipt's own baseline.
function checkFrozen(paths) {
  const freeze = readJson(paths.freeze, "proof/referee/freeze.json");
  const stale = [];
  if (freeze.schema !== FREEZE_SCHEMA) stale.push(`freeze schema ${JSON.stringify(freeze.schema)} is not ${FREEZE_SCHEMA}`);
  const oracleSha256 = hashTree(paths.oracleDir, oracleSkip);
  const corpusSha256 = hashFile(paths.corpus);
  if (freeze.referee?.treeSha256 !== oracleSha256) stale.push("proof/referee files changed since the freeze");
  if (freeze.corpus?.sha256 !== corpusSha256) stale.push("scripts/referee/corpus.mjs changed since the freeze");
  const recipe = corpus.recipe({quick: false});
  if (canonicalJson(freeze.recipe) !== canonicalJson(recipe)) stale.push("corpus recipe differs from the freeze");
  for (const [name, s] of Object.entries(freezeSources(paths.root))) {
    if (canonicalJson(freeze[name] ?? null) !== canonicalJson(s)) stale.push(`${name} (${s.path}) differs from the freeze`);
  }
  if (typeof freeze.inputs?.sha256 !== "string") stale.push("freeze records no input digest");
  if (stale.length) throw new Stale(stale.join("; "));

  const key = receiptKey({oracleSha256, corpusSha256, inputsSha256: freeze.inputs.sha256});
  const first = readFirstRun(paths.receipts, key);
  if (!first) throw new Stale(`no first-run receipt for key ${key} in ${path.relative(paths.root, paths.receipts)}`);
  if (!first.intact) throw new Stale(`first-run receipt ${key} fails its integrity check (key or mismatch-file digest)`);
  const r = first.receipt;
  if (r.schema !== RECEIPT_SCHEMA || r.kind !== "first-run" || r.mode !== "full") stale.push("receipt is not a full first-run receipt");
  if (r.complete !== true) stale.push("first run did not complete");
  if (r.oracle?.treeSha256 !== oracleSha256) stale.push("receipt oracle digest differs from the referee files");
  if (r.corpus?.sha256 !== corpusSha256) stale.push("receipt corpus digest differs from corpus.mjs");
  if (r.inputs?.sha256 !== freeze.inputs.sha256) stale.push("receipt inputs differ from the frozen inputs");
  if (canonicalJson(r.recipe) !== canonicalJson(recipe)) stale.push("receipt recipe differs from the corpus recipe");
  if (r.engineSchema !== adapter.schema) stale.push(`receipt engine schema ${r.engineSchema} is not adapter schema ${adapter.schema}`);
  if (r.baseline?.engineSha256 !== hashFile(paths.engine)) stale.push("scripts/referee/engine.mjs changed since the first run");
  if (r.baseline?.showdownTreeSha256 !== hashTree(paths.showdown)) stale.push("src/game/showdown changed since the first run");
  if (stale.length) throw new Stale(stale.join("; "));
  return {freeze, recipe, key, receipt: r, mismatchFile: first.paths.mismatches};
}

// The recorded mismatch line for one duel (by seed, or the receipt's first divergence).
async function recordedLine(file, receipt, seed) {
  const want = seed ?? receipt.counts?.firstDivergence?.seed;
  if (want === undefined || want === null) throw new Stale("receipt records no first divergence");
  const rl = readline.createInterface({input: fs.createReadStream(file), crlfDelay: Infinity});
  try {
    for await (const text of rl) {
      if (!text.trim()) continue;
      const line = JSON.parse(text);
      if (canonicalJson(line.seed) === canonicalJson(want)) return line;
    }
  } finally { rl.close(); }
  throw new Stale(`seed ${want} has no recorded divergence in the first run`);
}

// Regenerate the whole frozen corpus so its digest can be checked; keep only the duel we need.
async function frozenDuel(recipe, freeze, index) {
  const hash = createHash("sha256");
  let count = 0, actions = 0, kept = null;
  for await (const duel of corpus.duels(recipe)) {
    validateDuel(duel, count);
    const text = canonicalJson(duel);
    hash.update(`${text}\n`);
    if (count === index) kept = JSON.parse(text);
    count++; actions += duel.actions.length;
  }
  const sha256 = hash.digest("hex");
  if (sha256 !== freeze.inputs.sha256 || count !== freeze.inputs.duels || actions !== freeze.inputs.actions) {
    throw new Stale(`regenerated corpus (${count} duels, ${actions} actions, ${sha256}) differs from the freeze (${freeze.inputs.duels}, ${freeze.inputs.actions}, ${freeze.inputs.sha256})`);
  }
  if (!kept) throw new Stale(`corpus has no duel at index ${index}`);
  return kept;
}

function runReferee(paths, duel) {
  const python = process.env.REFEREE_PYTHON || "python3";
  const r = spawnSync(python, ["-u", paths.referee, "--stream"], {cwd: paths.root, input: `${canonicalJson(duel)}\n`, encoding: "utf8"});
  if (r.error) throw new Stale(`could not start the referee with ${python}: ${r.error.message}`);
  if (r.status !== 0) throw new Stale(`referee exited with ${r.signal ?? r.status}: ${r.stderr.trim().slice(-500)}`);
  const lines = r.stdout.split("\n").filter((l) => l.trim());
  if (lines.length !== 1) throw new Stale(`referee printed ${lines.length} result lines for one duel`);
  const result = JSON.parse(lines[0]);
  if (canonicalJson(result.seed) !== canonicalJson(duel.seed)) throw new Stale(`referee answered for seed ${result.seed}, not ${duel.seed}`);
  if (Array.isArray(result.unsupported) && result.unsupported.length) throw new Stale(`referee reports unsupported rules: ${result.unsupported.join("; ")}`);
  return adapter.refereeRecords(result);
}

function valueDiff(a, b, at = "$", out = []) {
  if (canonicalJson(a) === canonicalJson(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      valueDiff(a[k], b[k], Array.isArray(a) ? `${at}[${k}]` : `${at}.${k}`, out);
    }
    return out;
  }
  out.push({path: at, referee: a ?? null, engine: b ?? null});
  return out;
}

export async function firstDivergence({root = fileURLToPath(new URL("../../", import.meta.url)), seed = null} = {}) {
  const paths = proofPaths(root);
  const frozen = checkFrozen(paths);
  const recorded = await recordedLine(frozen.mismatchFile, frozen.receipt, seed);
  const first = recorded.mismatches?.[0];
  if (!first || first.step !== recorded.firstStep || !Number.isInteger(first.step) || first.step < 1) {
    throw new Stale(`recorded line for seed ${recorded.seed} has no usable first mismatch`);
  }
  const fd = frozen.receipt.counts.firstDivergence;
  if (seed === null && (fd.duel !== recorded.duel || fd.step !== first.step || fd.kind !== first.kind || fd.turn !== recorded.firstTurn)) {
    throw new Stale("receipt firstDivergence disagrees with its mismatch file");
  }

  const duel = await frozenDuel(frozen.recipe, frozen.freeze, recorded.duel);
  const checks = [];
  const check = (name, ok) => checks.push({name, pass: Boolean(ok)});
  check("regenerated duel has the recorded seed", canonicalJson(duel.seed) === canonicalJson(recorded.seed));
  check("regenerated deal digest equals the recorded one", dealDigest(duel) === recorded.dealDigest);
  check("recorded action is the corpus action at that step", canonicalJson(duel.actions[first.step - 1]) === canonicalJson(first.action));

  const prefix = {...duel, actions: duel.actions.slice(0, first.step)};
  const ref = runReferee(paths, prefix);
  const eng = [];
  for await (const r of adapter.replay(structuredClone(prefix))) eng.push(r);
  const observed = compareDuel({index: recorded.duel, duel: prefix, deal: dealDigest(prefix), ref, eng});
  const om = observed.line?.mismatches ?? [];
  check("prefix produced exactly one difference", om.length === 1);
  check("no oracle contract violations", observed.violations.length === 0);
  const m = om[0] ?? null;
  check("difference is at the recorded step", m?.step === first.step && observed.line?.firstTurn === recorded.firstTurn);
  check("observed difference equals the recorded one", m !== null && canonicalJson(m) === canonicalJson(first));
  check("initial state equals the recorded one", canonicalJson(observed.line?.initial) === canonicalJson(recorded.initial));

  const before = ref.find((r) => r.step === first.step - 1)?.state ?? null;
  return {
    reproduced: checks.every((c) => c.pass),
    receipt: {key: frozen.key, file: path.relative(root, path.join(paths.receipts, `first-run-${frozen.key}.json`))},
    duel: {index: recorded.duel, seed: duel.seed, first: duel.first, dealDigest: dealDigest(duel), prefixActions: prefix.actions.length},
    divergence: m && {
      step: m.step, turn: m.turn, kind: m.kind, action: m.action,
      engine: {accepted: m.engine?.accepted ?? null, reason: m.engine?.reason ?? null},
      referee: {accepted: m.referee?.accepted ?? null, reason: m.referee?.reason ?? null},
      stateDifference: valueDiff(m.referee?.state, m.engine?.state),
      refereeChange: valueDiff(m.referee?.state, before).map(({path: p, referee, engine}) => ({path: p, before: engine, after: referee})),
      engineChange: valueDiff(m.engine?.state, before).map(({path: p, referee, engine}) => ({path: p, before: engine, after: referee})),
    },
    checks,
  };
}

const verdict = (v) => (v.accepted === true ? "accepted" : v.accepted === false ? `rejected (${v.reason ?? "no reason"})` : "no record");
const show = (v) => JSON.stringify(v);

function printText(r) {
  const d = r.divergence;
  console.log(`first-divergence ${r.reproduced ? "reproduced" : "NOT reproduced"}: seed ${r.duel.seed}, duel ${r.duel.index}`);
  console.log(`  receipt: ${r.receipt.file}`);
  console.log(`  replayed prefix: ${r.duel.prefixActions} action(s), ${r.duel.first} goes first, deal ${r.duel.dealDigest.slice(0, 12)}`);
  if (d) {
    console.log(`  step ${d.step}, turn ${d.turn}, kind ${d.kind}`);
    console.log(`  action: ${show(d.action)}`);
    console.log(`  engine:  ${verdict(d.engine)}`);
    console.log(`  referee: ${verdict(d.referee)}`);
    console.log(`  state difference (referee vs engine), ${d.stateDifference.length} path(s):`);
    for (const x of d.stateDifference) console.log(`    ${x.path}: referee ${show(x.referee)}, engine ${show(x.engine)}`);
    for (const [who, list] of [["referee", d.refereeChange], ["engine", d.engineChange]]) {
      console.log(`  ${who} change from the previous state: ${list.length ? "" : "none"}`);
      for (const x of list) console.log(`    ${x.path}: ${show(x.before)} -> ${show(x.after)}`);
    }
  }
  console.log("  checks:");
  for (const c of r.checks) console.log(`    ${c.pass ? "ok  " : "FAIL"} ${c.name}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let values;
  try {
    ({values} = parseArgs({args: process.argv.slice(2), options: {seed: {type: "string"}, json: {type: "boolean", default: false}}, strict: true}));
  } catch (e) { console.error(`${e.message}\n${USAGE}`); process.exit(2); }
  let seed = null;
  if (values.seed !== undefined) {
    seed = Number(values.seed);
    if (!/^\d+$/.test(values.seed) || !Number.isSafeInteger(seed)) { console.error(`--seed needs a non-negative integer\n${USAGE}`); process.exit(2); }
  }
  firstDivergence({seed}).then((r) => {
    if (values.json) console.log(JSON.stringify(r, null, 2)); else printText(r);
    process.exit(r.reproduced ? 0 : 1);
  }, (e) => {
    console.error(`first-divergence ${e instanceof Stale ? "stale" : "error"}: ${e.message}`);
    process.exit(2);
  });
}
