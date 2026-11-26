#!/usr/bin/env node
// Referee proof: stream frozen Showdown duels through the blind Python referee
// and the engine adapter, compare every record, and judge the release gates.
//
//   npm run referee:prove                      full proof (needs proof/referee/freeze.json)
//   npm run referee:quick [-- --limit N]       development run; never writes proof receipts
//   node scripts/referee/prove.mjs --print-freeze   draft freeze manifest for the coordinator
//
// Interfaces this script expects (coordinator reconciles):
//   scripts/referee/corpus.mjs   export function recipe({quick}) -> JSON seed recipe
//                                export function duels(recipe) -> (async) iterable of duel JSON
//   scripts/referee/adapter.mjs  export const schema
//                                export function replay(duel) -> (async) iterable of records
//                                export function refereeRecords(result) -> records for one result line
//   scripts/referee/history.mjs  export async function pinnedHistories(ctx)
//   scripts/referee/browser.mjs  export async function browserVerdicts(ctx)
//   proof/referee/referee.py --stream
//       stdin:  one canonical duel JSON per line
//       stdout: one {seed, initial, steps, unsupported} result line per duel, in order,
//               framed by refereeRecords. (Test referees may instead print a {schema} header,
//               then {duel,step,accepted,state} records and {duel,done:true}.)
// Records from both sides are compared as emitted. This script never rewrites
// either side's output; `accepted` and `state` must match exactly. `reason` is
// reported but not compared. The script reads `state.turn` and `state.winner`.
import {createHash} from "node:crypto";
import {spawn, spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {once} from "node:events";
import {fileURLToPath, pathToFileURL} from "node:url";

export const RECEIPT_SCHEMA = "referee-prove-receipt/1";
export const FREEZE_SCHEMA = "referee-freeze/1";
export const GATES = Object.freeze({moves: 100_000, completedDuels: 2_500, defects: 5, browserDuels: 250});
export const CORE_ACTIONS = Object.freeze(["summon", "spell", "gear", "location", "set", "attack", "cover", "end"]);
const DUEL_KEYS = new Set(["seed", "first", "decks", "actions", "cardNames"]);
const INSTANCE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d+$/;
const MAX_PENDING = 256;
const LIST_CAP = 100;

export function canonicalJson(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function hashFile(file) {
  try { return createHash("sha256").update(fs.readFileSync(file)).digest("hex"); } catch { return null; }
}

// Digest of a directory: sorted relative paths and file digests. Null when absent.
export function hashTree(dir, skip = () => false) {
  if (!fs.existsSync(dir)) return null;
  const entries = [];
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(dir, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (skip(r)) continue;
      const full = path.join(dir, r);
      if (fs.statSync(full).isDirectory()) walk(r);
      else entries.push(`${r}\0${hashFile(full)}\n`);
    }
  };
  walk("");
  return sha256(entries.join(""));
}

// Oracle files: everything under proof/referee except receipts and the freeze manifest.
export const oracleSkip = (rel) => rel === "receipts" || rel === "freeze.json" ||
  rel.split("/").includes("__pycache__") || rel.endsWith(".pyc");

export const dealDigest = (duel) => sha256(canonicalJson({first: duel.first, decks: duel.decks}));

// Inputs are ordered deals and moves only. Anything else (engine state,
// expected answers) is refused so it cannot reach the blind referee.
export function validateDuel(duel, index) {
  const bad = (why) => { throw new Error(`corpus duel ${index} is invalid: ${why}`); };
  if (!duel || typeof duel !== "object" || Array.isArray(duel)) bad("not an object");
  for (const key of Object.keys(duel)) if (!DUEL_KEYS.has(key)) bad(`unexpected key "${key}"`);
  if (typeof duel.seed !== "number" && typeof duel.seed !== "string") bad("seed must be a number or string");
  if (duel.first !== "cowboy" && duel.first !== "wizard") bad("first must be cowboy or wizard");
  for (const side of ["cowboy", "wizard"]) {
    const deck = duel.decks?.[side];
    if (!Array.isArray(deck) || deck.length === 0) bad(`decks.${side} must be a non-empty array`);
    deck.forEach((id) => { if (typeof id !== "string" || !INSTANCE_ID.test(id)) bad(`decks.${side} has bad instance ID ${JSON.stringify(id)}`); });
    if (new Set(deck).size !== deck.length) bad(`decks.${side} repeats an instance ID`);
  }
  if (duel.cardNames !== undefined && (typeof duel.cardNames !== "object" || Array.isArray(duel.cardNames))) bad("cardNames must map IDs to names");
  if (!Array.isArray(duel.actions)) bad("actions must be an array");
  duel.actions.forEach((a, i) => {
    if (!a || !CORE_ACTIONS.includes(a.type)) bad(`action ${i} has unsupported type ${JSON.stringify(a?.type)}`);
  });
  return duel;
}

function diffPaths(a, b, at = "$", out = [], limit = 20) {
  if (out.length >= limit) return out;
  if (canonicalJson(a) === canonicalJson(b)) return out;
  const objects = a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b);
  if (!objects) { out.push(at); return out; }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) diffPaths(a[k], b[k], Array.isArray(a) ? `${at}[${k}]` : `${at}.${k}`, out, limit);
  return out;
}

const byStep = (records) => {
  const map = new Map();
  for (const r of records) if (Number.isInteger(r?.step) && !map.has(r.step)) map.set(r.step, r);
  return map;
};
const view = (r) => (r ? {accepted: r.accepted ?? null, reason: r.reason ?? null, state: r.state ?? null} : null);

// Compare one duel's records. Counts come from the referee (the oracle).
export function compareDuel({index, duel, deal, ref, eng, engineError = null, refDone = true}) {
  const steps = duel.actions.length + 1;
  const refMap = byStep(ref);
  const engMap = byStep(eng);
  const mismatches = [];
  const unsupported = [];
  const violations = [];
  const stats = {actions: 0, accepted: 0, rejected: 0, byType: {}, completed: false, initialCompared: false};
  const turnOf = (r, e) => r?.state?.turn ?? e?.state?.turn ?? null;
  const add = (step, kind, r, e, paths = []) => mismatches.push({
    step, kind, turn: turnOf(r, e), action: step > 0 ? duel.actions[step - 1] : null,
    referee: view(r), engine: view(e), paths,
  });
  if (!refDone) violations.push({duel: index, kind: "missing-done"});
  let prevRef = null;
  for (let step = 0; step < steps; step++) {
    const r = refMap.get(step);
    const e = engMap.get(step);
    if (r?.unsupported) unsupported.push({duel: index, step, side: "referee", rule: r.unsupported});
    if (e?.unsupported) unsupported.push({duel: index, step, side: "engine", rule: e.unsupported});
    if (!r) { add(step, "omitted-by-referee", r, e); violations.push({duel: index, step, kind: "omitted-record"}); }
    if (!e) add(step, engineError ? "engine-error" : "omitted-by-engine", r, e, engineError ? [engineError] : []);
    if (r && step > 0) {
      const type = duel.actions[step - 1].type;
      const t = (stats.byType[type] ??= {accepted: 0, rejected: 0});
      stats.actions++;
      if (r.accepted === true) { stats.accepted++; t.accepted++; } else if (r.accepted === false) { stats.rejected++; t.rejected++; } else violations.push({duel: index, step, kind: "accepted-not-boolean"});
      if (r.accepted === false && prevRef && canonicalJson(prevRef.state) !== canonicalJson(r.state)) violations.push({duel: index, step, kind: "rejection-changed-state"});
    }
    if (r && step === 0) stats.initialCompared = true;
    if (r && e) {
      if (step > 0 && r.accepted !== e.accepted) add(step, e.accepted === false ? "rejected-by-engine" : "rejected-by-referee", r, e);
      else if (canonicalJson(r.state) !== canonicalJson(e.state)) add(step, step === 0 ? "initial-state" : "state", r, e, diffPaths(r.state, e.state));
    }
    if (r) prevRef = r;
  }
  for (const [step, e] of engMap) if (step >= steps) add(step, "extra-from-engine", null, e);
  for (const [step, r] of refMap) if (step >= steps) add(step, "extra-from-referee", r, null);
  const last = prevRef?.state;
  stats.completed = last?.winner !== undefined && last?.winner !== null;
  const line = mismatches.length ? {
    duel: index, seed: duel.seed, dealDigest: deal, firstStep: mismatches[0].step, firstTurn: mismatches[0].turn,
    initial: refMap.get(0)?.state ?? null, mismatches,
  } : null;
  return {line, stats, unsupported, violations};
}

function newTotals() {
  return {
    duels: 0, seeds: new Set(), deals: new Set(), initialStates: 0, actions: 0, accepted: 0, rejected: 0,
    byType: {}, completedSeeds: new Set(), completedDeals: new Set(), completed: 0,
    mismatchDuels: 0, mismatches: 0, byKind: {}, earliest: null, minTurn: null,
    unsupported: 0, unsupportedList: [], violations: 0, violationList: [],
  };
}

function addDuel(t, p, result) {
  const {stats} = result;
  const seedKey = canonicalJson(p.duel.seed);
  t.duels++; t.seeds.add(seedKey); t.deals.add(p.deal);
  if (stats.initialCompared) t.initialStates++;
  t.actions += stats.actions; t.accepted += stats.accepted; t.rejected += stats.rejected;
  for (const [type, c] of Object.entries(stats.byType)) {
    const into = (t.byType[type] ??= {accepted: 0, rejected: 0});
    into.accepted += c.accepted; into.rejected += c.rejected;
  }
  if (stats.completed) { t.completed++; t.completedSeeds.add(seedKey); t.completedDeals.add(p.deal); }
  t.unsupported += result.unsupported.length;
  t.violations += result.violations.length;
  for (const u of result.unsupported) if (t.unsupportedList.length < LIST_CAP) t.unsupportedList.push(u);
  for (const v of result.violations) if (t.violationList.length < LIST_CAP) t.violationList.push(v);
  if (result.line) {
    const {line} = result;
    t.mismatchDuels++; t.mismatches += line.mismatches.length;
    for (const m of line.mismatches) t.byKind[m.kind] = (t.byKind[m.kind] ?? 0) + 1;
    t.earliest ??= {duel: line.duel, seed: line.seed, step: line.firstStep, turn: line.firstTurn, kind: line.mismatches[0].kind};
    if (typeof line.firstTurn === "number" && (t.minTurn === null || line.firstTurn < t.minTurn)) t.minTurn = line.firstTurn;
  }
}

export function summarizeTotals(t) {
  return {
    duels: t.duels, distinctSeeds: t.seeds.size, distinctDeals: t.deals.size, initialStates: t.initialStates,
    actions: t.actions, accepted: t.accepted, rejected: t.rejected, byType: t.byType,
    completed: t.completed, completedDistinctSeeds: t.completedSeeds.size, completedDistinctDeals: t.completedDeals.size,
    mismatchDuels: t.mismatchDuels, mismatches: t.mismatches, mismatchesByKind: t.byKind,
    firstDivergence: t.earliest, earliestDivergentTurn: t.minTurn,
    unsupported: t.unsupported, unsupportedSample: t.unsupportedList,
    oracleViolations: t.violations, oracleViolationSample: t.violationList,
  };
}

async function collect(iterable) {
  const out = [];
  for await (const r of iterable) out.push(r);
  return out;
}

// Stream duels to the referee and compare as its records arrive. Memory holds
// at most MAX_PENDING duels in flight; mismatches go to `sink` line by line.
export async function streamComparison({duels, engine, command, cwd, sink, limit = Infinity}) {
  const child = spawn(command[0], command.slice(1), {cwd, stdio: ["pipe", "pipe", "pipe"], env: {...process.env, PYTHONUNBUFFERED: "1"}});
  const errors = [];
  let stderrTail = "";
  child.stderr.on("data", (d) => { stderrTail = (stderrTail + d).slice(-4000); });
  child.stdin.on("error", (e) => { if (e.code !== "EPIPE") errors.push(`referee stdin: ${e.message}`); });
  let exitedFlag = false;
  const exited = new Promise((resolve) => {
    child.on("error", (e) => { exitedFlag = true; resolve({error: e.message}); });
    child.on("close", (code, signal) => { exitedFlag = true; resolve({code, signal}); });
  });
  const totals = newTotals();
  const inputs = createHash("sha256");
  const pending = [];
  const buffers = new Map();
  let wake = null;
  const notify = () => { if (wake) { const w = wake; wake = null; w(); } };
  let readerDone = false;
  let written = 0;
  let writerFinished = false;

  const writer = (async () => {
    try {
      for await (const duel of duels) {
        if (written >= limit) break;
        if (readerDone) { errors.push("referee stopped reading before every duel was sent"); return; }
        validateDuel(duel, written);
        const text = canonicalJson(duel);
        inputs.update(`${text}\n`);
        pending.push({index: written, duel: JSON.parse(text), deal: dealDigest(duel)});
        written++;
        if (!child.stdin.write(`${text}\n`)) await Promise.race([once(child.stdin, "drain"), exited]);
        while (pending.length >= MAX_PENDING && !readerDone) await new Promise((r) => { wake = r; });
      }
      writerFinished = true;
    } catch (e) {
      errors.push(`corpus: ${e.message}`);
    } finally {
      child.stdin.end();
    }
  })();

  const settle = async (p, refDone) => {
    const ref = buffers.get(p.index) ?? [];
    buffers.delete(p.index);
    let eng = [];
    let engineError = null;
    try { eng = await collect(engine.replay(structuredClone(p.duel))); } catch (e) { engineError = `engine adapter threw: ${e.message}`; }
    const result = compareDuel({index: p.index, duel: p.duel, deal: p.deal, ref, eng, engineError, refDone});
    addDuel(totals, p, result);
    if (result.line) sink(result.line);
  };

  // Two framings. "records": a {schema} header, then {duel, step, ...} records and {duel, done}
  // (test referees). "results": no header, one referee.py result line per sent duel, in order,
  // framed by the adapter's refereeRecords without touching its values.
  let header = null;
  let framing = null;
  const violate = (v) => { totals.violations++; if (totals.violationList.length < LIST_CAP) totals.violationList.push(v); };
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const rl = readline.createInterface({input: child.stdout, crlfDelay: Infinity});
  try {
    for await (const raw of rl) {
      const text = raw.trim();
      if (!text) continue;
      let rec;
      try { rec = JSON.parse(text); } catch { errors.push(`referee printed non-JSON: ${text.slice(0, 120)}`); break; }
      if (!framing) {
        if (isObject(rec) && typeof rec.schema === "string" && !("duel" in rec)) {
          framing = "records";
          header = rec;
          if (rec.schema !== engine.schema) {
            errors.push(`schema mismatch: referee emits ${rec.schema}, engine adapter emits ${engine.schema}; reconcile scripts/referee/adapter.mjs with proof/referee/SCHEMA.md`);
            break;
          }
          continue;
        }
        if (isObject(rec) && !("duel" in rec) && !("schema" in rec) && typeof engine.refereeRecords === "function") {
          framing = "results";
          header = {framing: "results", schema: null};
        } else {
          errors.push("referee printed neither a {schema} header nor a duel result line first");
          break;
        }
      }
      if (framing === "results") {
        if (!pending.length) { violate({duel: null, kind: "result-for-unknown-duel"}); continue; }
        const p = pending.shift();
        if (!isObject(rec) || canonicalJson(rec.seed ?? null) !== canonicalJson(p.duel.seed)) violate({duel: p.index, kind: "result-seed-mismatch"});
        buffers.set(p.index, engine.refereeRecords(rec));
        await settle(p, true);
        notify();
        continue;
      }
      if (!Number.isInteger(rec?.duel) || rec.duel < 0) { totals.violations++; continue; }
      if (rec.duel >= written || (pending.length && rec.duel < pending[0].index) || !pending.length) {
        totals.violations++;
        if (totals.violationList.length < LIST_CAP) totals.violationList.push({duel: rec.duel, kind: "record-for-unknown-or-settled-duel"});
        continue;
      }
      if (rec.done === true) {
        while (pending.length && pending[0].index <= rec.duel) {
          const p = pending.shift();
          await settle(p, p.index === rec.duel);
        }
        notify();
        continue;
      }
      if (!buffers.has(rec.duel)) buffers.set(rec.duel, []);
      buffers.get(rec.duel).push(rec);
    }
  } finally {
    readerDone = true;
    notify();
    // A non-empty error list here means the reader stopped early; stop the referee too.
    if (errors.length && !exitedFlag) child.kill();
  }
  await writer;
  const exit = await exited;
  if (pending.length) errors.push(`referee ended before finishing ${pending.length} duel(s), first is duel ${pending[0].index}`);
  while (pending.length) await settle(pending.shift(), false);
  if (exit.error) errors.push(`could not start referee: ${exit.error}`);
  else if (exit.code !== 0) errors.push(`referee exited with ${exit.signal ?? exit.code}${stderrTail ? `: ${stderrTail.trim().slice(-500)}` : ""}`);
  return {
    complete: errors.length === 0 && writerFinished && Boolean(header),
    errors, header, inputsSha256: inputs.digest("hex"), duelsSent: written, totals: summarizeTotals(totals),
  };
}

const gate = (name, target, actual, pass) => ({name, target, actual, pass: Boolean(pass)});

export function evaluateComparison(run, {quick = false, reproduced = null} = {}) {
  const t = run.totals;
  const gates = [
    gate("comparison complete", "referee exit 0, every duel settled", run.complete ? "complete" : run.errors.join("; "), run.complete),
    gate("state agreement after each action", 0, t.mismatches, t.mismatches === 0),
    gate("unsupported rules", 0, t.unsupported, t.unsupported === 0),
    gate("oracle contract violations", 0, t.oracleViolations, t.oracleViolations === 0),
  ];
  if (!quick) {
    gates.push(
      gate("moves compared", `>= ${GATES.moves}`, t.actions, t.actions >= GATES.moves),
      gate("distinct completed seeded duels", `>= ${GATES.completedDuels}`,
        Math.min(t.completedDistinctSeeds, t.completedDistinctDeals), Math.min(t.completedDistinctSeeds, t.completedDistinctDeals) >= GATES.completedDuels),
      gate("legal actions covered", "> 0", t.accepted, t.accepted > 0),
      gate("rejected actions covered", "> 0", t.rejected, t.rejected > 0),
    );
    if (reproduced !== null) gates.push(gate("rerun reproduces first-run counts", true, reproduced, reproduced === true));
  }
  let status = gates.every((g) => g.pass) ? "pass" : "fail";
  if (t.unsupported > 0 || run.errors.some((e) => e.startsWith("schema mismatch"))) status = "unsupported";
  else if (!run.complete) status = "incomplete";
  return {status, gates};
}

const PINNED = /^[0-9a-f]{7,40}$/;

// Pinned historical defects: {freezeKey, skipped?, defects:[{id, commit, area:"engine"|"tests", verdict:"caught"|"missed"|"unknown"}]}
export function evaluateHistory(result, {freezeKey}) {
  if (!result || !Array.isArray(result.defects)) return {status: "missing", problems: ["history.mjs returned no defects array"]};
  const problems = [];
  const counts = {caught: 0, missed: 0, unknown: 0, caughtEngine: 0, caughtTests: 0};
  if (result.freezeKey !== freezeKey) return {status: "stale", problems: [`history was produced for ${result.freezeKey ?? "no freeze"}, not ${freezeKey}`]};
  if (result.skipped) return {status: "skipped", problems: [`history skipped: ${result.skipped}`]};
  const ids = new Set();
  let status = null;
  for (const d of result.defects) {
    if (d.skipped) { status ??= "skipped"; problems.push(`defect ${d.id} skipped`); continue; }
    if (!["caught", "missed", "unknown"].includes(d.verdict) || !["engine", "tests"].includes(d.area)) {
      status = "unsupported"; problems.push(`defect ${d.id} has verdict ${d.verdict} / area ${d.area}`); continue;
    }
    if (typeof d.id !== "string" || ids.has(d.id)) { status ??= "fail"; problems.push(`defect ID ${d.id} missing or repeated`); continue; }
    if (!PINNED.test(d.commit ?? "")) { status ??= "fail"; problems.push(`defect ${d.id} is not pinned to a commit`); continue; }
    ids.add(d.id);
    counts[d.verdict]++;
    if (d.verdict === "caught") counts[d.area === "engine" ? "caughtEngine" : "caughtTests"]++;
  }
  const gates = [
    gate("historical defects caught", `>= ${GATES.defects}`, counts.caught, counts.caught >= GATES.defects),
    gate("caught engine defects", ">= 1", counts.caughtEngine, counts.caughtEngine >= 1),
    gate("caught test defects", ">= 1", counts.caughtTests, counts.caughtTests >= 1),
  ];
  return {status: status ?? (gates.every((g) => g.pass) ? "pass" : "fail"), counts, gates, problems};
}

// Browser verdicts: {freezeKey, build:{commit}, verdicts:[{seed, dealDigest, illustrated, completed, verdict:"agree"|...}]}
// Verdicts from an earlier freeze or build (for example prior Sheriff wins) do not count.
export function evaluateBrowser(result, {freezeKey, head}) {
  if (!result || !Array.isArray(result.verdicts)) return {status: "missing", problems: ["browser.mjs returned no verdicts array"]};
  if (result.freezeKey !== freezeKey) return {status: "stale", problems: [`browser verdicts belong to ${result.freezeKey ?? "no freeze"}, not ${freezeKey}`]};
  if (!head || result.build?.commit !== head) return {status: "stale", problems: [`browser build ${result.build?.commit ?? "unknown"} is not HEAD ${head ?? "unknown"}`]};
  const problems = [];
  const seen = new Set();
  let agree = 0, skipped = 0, duplicate = 0, other = 0;
  for (const v of result.verdicts) {
    const key = `${canonicalJson(v.seed)}|${v.dealDigest}`;
    if (v.verdict === "skipped" || v.skipped) { skipped++; continue; }
    if (seen.has(key)) { duplicate++; continue; }
    seen.add(key);
    if (v.verdict === "agree" && v.completed === true && v.illustrated === true && typeof v.dealDigest === "string") agree++;
    else other++;
  }
  if (duplicate) problems.push(`${duplicate} repeated browser duel(s) not counted`);
  if (other) problems.push(`${other} browser duel(s) not completed, not illustrated, or disagreeing`);
  const gates = [gate("distinct completed illustrated browser duels", `${GATES.browserDuels}/${GATES.browserDuels}`,
    `${agree}/${result.verdicts.length}`, agree >= GATES.browserDuels && other === 0 && duplicate === 0 && skipped === 0)];
  const status = skipped ? "skipped" : gates[0].pass ? "pass" : "fail";
  if (skipped) problems.push(`${skipped} browser duel(s) skipped`);
  return {status, counts: {agree, other, duplicate, skipped, total: result.verdicts.length}, gates, problems};
}

export function proofPaths(root) {
  return {
    root,
    oracleDir: path.join(root, "proof/referee"),
    referee: path.join(root, "proof/referee/referee.py"),
    freeze: path.join(root, "proof/referee/freeze.json"),
    receipts: path.join(root, "proof/referee/receipts"),
    quickDir: path.join(root, ".artifacts/referee"),
    corpus: path.join(root, "scripts/referee/corpus.mjs"),
    engine: path.join(root, "scripts/referee/engine.mjs"),
    adapter: path.join(root, "scripts/referee/adapter.mjs"),
    history: path.join(root, "scripts/referee/history.mjs"),
    browser: path.join(root, "scripts/referee/browser.mjs"),
    showdown: path.join(root, "src/game/showdown"),
  };
}

export const receiptKey = ({oracleSha256, corpusSha256, inputsSha256}) =>
  sha256(canonicalJson({schema: RECEIPT_SCHEMA, oracle: oracleSha256, corpus: corpusSha256, inputs: inputsSha256}));

const tmpName = (dir, name) => path.join(dir, `.${name}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);

// Create `final` from `source` only if it does not exist yet (hard link is atomic and never replaces).
function linkOnce(source, final) {
  const tmp = tmpName(path.dirname(final), path.basename(final));
  fs.copyFileSync(source, tmp);
  try {
    fs.linkSync(tmp, final);
    fs.chmodSync(final, 0o444);
    return true;
  } catch (e) {
    if (e.code === "EEXIST") return false;
    throw e;
  } finally {
    fs.rmSync(tmp, {force: true});
  }
}

function writeReplace(final, text) {
  fs.mkdirSync(path.dirname(final), {recursive: true});
  const tmp = tmpName(path.dirname(final), path.basename(final));
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, final);
}

export function firstRunPaths(receiptsDir, key) {
  return {
    receipt: path.join(receiptsDir, `first-run-${key}.json`),
    mismatches: path.join(receiptsDir, `first-run-${key}.mismatches.jsonl`),
  };
}

export function readFirstRun(receiptsDir, key) {
  const p = firstRunPaths(receiptsDir, key);
  if (!fs.existsSync(p.receipt)) return null;
  const receipt = JSON.parse(fs.readFileSync(p.receipt, "utf8"));
  const intact = receipt.key === key && hashFile(p.mismatches) === receipt.mismatches?.sha256;
  return {receipt, intact, paths: p};
}

// Preserve the first full comparison, passing or not. Never overwrites either file.
export function preserveFirstRun({receiptsDir, key, mismatchFile, receipt, quick}) {
  if (quick) throw new Error("quick mode cannot write a first-run receipt");
  fs.mkdirSync(receiptsDir, {recursive: true});
  const p = firstRunPaths(receiptsDir, key);
  if (fs.existsSync(p.receipt)) return {created: false, paths: p};
  if (!linkOnce(mismatchFile, p.mismatches) && hashFile(p.mismatches) !== receipt.mismatches.sha256) {
    throw new Error(`${p.mismatches} exists without its receipt and differs from this run; ask the coordinator to inspect it`);
  }
  const tmp = tmpName(receiptsDir, "receipt");
  fs.writeFileSync(tmp, `${JSON.stringify(receipt, null, 2)}\n`);
  try { return {created: linkOnce(tmp, p.receipt), paths: p}; } finally { fs.rmSync(tmp, {force: true}); }
}

const ORACLE_COUNTS = ["duels", "distinctSeeds", "distinctDeals", "initialStates", "actions", "accepted", "rejected", "completed"];
export function reproduces(first, run) {
  if (first.inputs?.sha256 !== run.inputsSha256) return false;
  return ORACLE_COUNTS.every((k) => first.counts?.[k] === run.totals[k]);
}

async function loadModule(file) {
  if (!fs.existsSync(file)) return {missing: `${path.relative(process.cwd(), file)} does not exist`};
  try { return {module: await import(pathToFileURL(file).href)}; } catch (e) { return {missing: `${file} failed to load: ${e.message}`}; }
}

function gitHead(root) {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"});
  return r.status === 0 && /^[0-9a-f]{40}$/.test(r.stdout.trim()) ? r.stdout.trim() : null;
}

async function inputsDigest(corpus, recipe) {
  const h = createHash("sha256");
  let duels = 0, actions = 0;
  for await (const duel of corpus.duels(recipe)) {
    validateDuel(duel, duels);
    h.update(`${canonicalJson(duel)}\n`);
    duels++; actions += duel.actions.length;
  }
  return {sha256: h.digest("hex"), duels, actions};
}

// Files the freeze pins besides the oracle tree and corpus. referee.py names rules/RULEBOOK.md and
// rules/cards.csv as its sources; when that folder is absent the project copies are used. The path
// actually hashed is recorded, and a missing file is recorded as null.
const FREEZE_SOURCES = Object.freeze({
  rules: ["rules/RULEBOOK.md", "prototypes/showdown/RULEBOOK.md"],
  csv: ["rules/cards.csv", "prototypes/showdown/cards.csv"],
  adapter: ["scripts/referee/adapter.mjs"],
});

export function freezeSources(root) {
  return Object.fromEntries(Object.entries(FREEZE_SOURCES).map(([name, candidates]) => {
    for (const rel of candidates) {
      const digest = hashFile(path.join(root, rel));
      if (digest) return [name, {path: rel, sha256: digest}];
    }
    return [name, {path: candidates[0], sha256: null}];
  }));
}

const fail = (log, exitCode, status, message, next, extra = {}) => {
  log(`referee:prove ${status}: ${message}`);
  if (next) log(`next: ${next}`);
  return {exitCode, report: {status, message, next, ...extra}};
};

export async function prove(options = {}) {
  const {quick = false, printFreeze = false, limit = Infinity, log = console.log, now = () => new Date().toISOString()} = options;
  const paths = proofPaths(options.root ?? fileURLToPath(new URL("../../", import.meta.url)));
  const mods = options.modules ?? {};
  const load = async (name) => (mods[name] ? {module: mods[name]} : loadModule(paths[name]));
  const corpusMod = await load("corpus");
  const engineMod = mods.engine ? {module: mods.engine} : await loadModule(paths.adapter);
  if (corpusMod.missing) return fail(log, 1, "missing", corpusMod.missing, "the corpus owner must provide recipe({quick}) and duels(recipe)");
  const corpus = corpusMod.module;
  if (typeof corpus.recipe !== "function" || typeof corpus.duels !== "function") return fail(log, 1, "unsupported", "corpus.mjs must export recipe and duels", "reconcile scripts/referee/corpus.mjs with the interface in prove.mjs");
  if (!fs.existsSync(paths.referee)) return fail(log, 1, "missing", "proof/referee/referee.py does not exist", "the referee owner must provide referee.py --stream");
  const oracleSha256 = hashTree(paths.oracleDir, oracleSkip);
  const corpusSha256 = hashFile(paths.corpus) ?? sha256(canonicalJson(corpus.recipe({quick: false})));
  const sources = freezeSources(paths.root);

  if (printFreeze) {
    const recipe = corpus.recipe({quick: false});
    const inputs = await inputsDigest(corpus, recipe);
    const again = await inputsDigest(corpus, recipe);
    if (again.sha256 !== inputs.sha256) return fail(log, 1, "unsupported", `corpus is not deterministic: two passes gave ${inputs.sha256} and ${again.sha256}`, "fix the recipe so it uses recorded seeds only; no freeze was printed");
    const manifest = {schema: FREEZE_SCHEMA, referee: {entry: "proof/referee/referee.py", treeSha256: oracleSha256},
      corpus: {path: "scripts/referee/corpus.mjs", sha256: corpusSha256}, ...sources, recipe, inputs: {...inputs, deterministic: true}};
    log(JSON.stringify(manifest, null, 2));
    return {exitCode: 0, report: manifest};
  }

  if (engineMod.missing) return fail(log, 1, "missing", engineMod.missing, "the adapter owner must provide schema, replay(duel) and refereeRecords(result)");
  const engine = engineMod.module;
  if (typeof engine.replay !== "function" || typeof engine.schema !== "string") return fail(log, 1, "unsupported", "adapter.mjs must export schema and replay", "reconcile scripts/referee/adapter.mjs with the interface in prove.mjs");
  const command = options.refereeCommand ?? [process.env.REFEREE_PYTHON || "python3", "-u", paths.referee, "--stream"];
  const head = options.head !== undefined ? options.head : gitHead(paths.root);
  const baseline = {head, engineSha256: hashFile(paths.engine), showdownTreeSha256: hashTree(paths.showdown)};
  const dealGenerator = hashFile(path.join(paths.root, "src/game/frontier-kit/seeded-rng.js"));
  if (dealGenerator) baseline.dealGeneratorSha256 = dealGenerator;

  let freeze = null, key, recipe;
  if (quick) {
    recipe = corpus.recipe({quick: true});
    key = `quick-${sha256(canonicalJson({oracleSha256, recipe})).slice(0, 16)}`;
  } else {
    if (!fs.existsSync(paths.freeze)) return fail(log, 1, "not-frozen", "proof/referee/freeze.json is missing; full comparison waits for the coordinator's freeze",
      "coordinator: run `node scripts/referee/prove.mjs --print-freeze > proof/referee/freeze.json` after review, then rerun");
    freeze = JSON.parse(fs.readFileSync(paths.freeze, "utf8"));
    recipe = corpus.recipe({quick: false});
    const stale = [];
    if (freeze.schema !== FREEZE_SCHEMA) stale.push(`freeze schema ${freeze.schema}`);
    if (freeze.referee?.treeSha256 !== oracleSha256) stale.push("proof/referee files changed since the freeze");
    if (freeze.corpus?.sha256 !== corpusSha256) stale.push("scripts/referee/corpus.mjs changed since the freeze");
    if (canonicalJson(freeze.recipe) !== canonicalJson(recipe)) stale.push("seed recipe differs from the freeze");
    for (const [name, s] of Object.entries(sources)) {
      if (canonicalJson(freeze[name] ?? null) !== canonicalJson(s)) stale.push(`${name} (${s.path}) differs from the freeze`);
    }
    if (!stale.length) {
      const inputs = await inputsDigest(corpus, recipe);
      if (inputs.sha256 !== freeze.inputs?.sha256) stale.push(`corpus output ${inputs.sha256} differs from frozen inputs ${freeze.inputs?.sha256}`);
    }
    if (stale.length) return fail(log, 1, "stale", stale.join("; "), "restore the frozen files, or have the coordinator issue a new freeze (a new freeze gets a new first-run key)");
    key = receiptKey({oracleSha256, corpusSha256, inputsSha256: freeze.inputs.sha256});
  }

  const outDir = quick ? paths.quickDir : paths.receipts;
  fs.mkdirSync(outDir, {recursive: true});
  const prior = quick ? null : readFirstRun(paths.receipts, key);
  if (prior && !prior.intact) return fail(log, 1, "stale", `first-run receipt for ${key} fails its integrity check`, "do not edit first-run files; ask the coordinator to inspect proof/referee/receipts", {key});

  const mismatchTmp = tmpName(outDir, "mismatches");
  const fd = fs.openSync(mismatchTmp, "w");
  const mismatchHash = createHash("sha256");
  const sink = (line) => { const text = `${canonicalJson(line)}\n`; mismatchHash.update(text); fs.writeSync(fd, text); };
  const startedAt = now();
  let run;
  try {
    run = await streamComparison({duels: corpus.duels(recipe), engine, command, cwd: paths.root, sink, limit: quick ? limit : Infinity});
  } finally {
    fs.closeSync(fd);
  }
  const finishedAt = now();
  if (!quick && run.complete && run.inputsSha256 !== freeze.inputs.sha256) {
    run.complete = false;
    run.errors.push("corpus was not deterministic: streamed inputs differ from the frozen digest");
  }
  const mismatches = {count: run.totals.mismatches, duels: run.totals.mismatchDuels, byKind: run.totals.mismatchesByKind, sha256: mismatchHash.digest("hex")};
  const record = {
    schema: RECEIPT_SCHEMA, key, mode: quick ? "quick" : "full", startedAt, finishedAt,
    oracle: {entry: "proof/referee/referee.py", treeSha256: oracleSha256, header: run.header},
    engineSchema: engine.schema, corpus: {sha256: corpusSha256}, recipe, inputs: {sha256: run.inputsSha256, duels: run.duelsSent},
    baseline, complete: run.complete, errors: run.errors, counts: run.totals, mismatches,
  };

  // The first full run is kept whatever its outcome, once the referee has answered at all
  // (a header or a result line). A referee that never started compared nothing.
  let firstRun = prior ? {status: "existing", path: prior.paths.receipt, reproduced: reproduces(prior.receipt, run)} : null;
  if (!quick && !prior && run.header) {
    const kept = preserveFirstRun({receiptsDir: paths.receipts, key, mismatchFile: mismatchTmp,
      receipt: {...record, kind: "first-run", mismatches: {...mismatches, file: path.basename(firstRunPaths(paths.receipts, key).mismatches)}}, quick});
    const now2 = readFirstRun(paths.receipts, key);
    firstRun = {status: kept.created ? "created" : "existing", path: kept.paths.receipt, reproduced: kept.created ? null : reproduces(now2.receipt, run)};
  }
  const base = quick ? "quick-current" : `current-${key}`;
  fs.renameSync(mismatchTmp, path.join(outDir, `${base}.mismatches.jsonl`));

  const comparison = {...evaluateComparison(run, {quick, reproduced: firstRun?.reproduced ?? null}), firstRun};
  if (!quick && !firstRun) comparison.firstRun = {status: "not-written", reason: "referee produced no output"};
  const sections = {comparison};
  if (!quick) {
    const ctx = {root: paths.root, freezeKey: key, head, freeze};
    for (const [name, fn, evaluate] of [["history", "pinnedHistories", evaluateHistory], ["browser", "browserVerdicts", evaluateBrowser]]) {
      const m = await load(name);
      if (m.missing || typeof m.module[fn] !== "function") { sections[name] = {status: "missing", problems: [m.missing ?? `${name}.mjs must export ${fn}`]}; continue; }
      try { sections[name] = evaluate(await m.module[fn](ctx), ctx); } catch (e) { sections[name] = {status: "missing", problems: [`${fn} threw: ${e.message}`]}; }
    }
  } else {
    sections.history = {status: "skipped", problems: ["quick mode does not judge pinned histories"]};
    sections.browser = {status: "skipped", problems: ["quick mode does not judge browser verdicts"]};
  }
  const passed = quick ? comparison.status === "pass" : Object.values(sections).every((s) => s.status === "pass");
  const report = {...record, sections, verdict: passed ? "pass" : "fail"};
  writeReplace(path.join(outDir, `${base}.json`), `${JSON.stringify(report, null, 2)}\n`);

  log(`referee:prove ${report.mode} ${report.verdict} key=${key}`);
  for (const [name, s] of Object.entries(sections)) {
    log(`  ${name}: ${s.status}`);
    for (const g of s.gates ?? []) log(`    ${g.pass ? "ok  " : "FAIL"} ${g.name}: ${typeof g.actual === "object" ? JSON.stringify(g.actual) : g.actual} (target ${g.target})`);
    for (const p of s.problems ?? []) log(`    - ${p}`);
  }
  if (firstRun) log(`  first-run receipt: ${firstRun.status} ${path.relative(paths.root, firstRun.path)}`);
  if (run.totals.firstDivergence) log(`  first divergence: ${JSON.stringify(run.totals.firstDivergence)}`);
  if (quick) log("  quick mode: release gates not judged; no proof receipt written");
  return {exitCode: passed ? 0 : 1, report};
}

const USAGE = "usage: node scripts/referee/prove.mjs [--quick [--limit N]] | --print-freeze";

export function parseArgs(argv) {
  const opts = {quick: false, printFreeze: false, limit: Infinity};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--quick") opts.quick = true;
    else if (a === "--print-freeze") opts.printFreeze = true;
    else if (a === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error("--limit needs a positive integer");
      opts.limit = n;
    } else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.quick && opts.printFreeze) throw new Error("--quick and --print-freeze cannot be combined");
  if (opts.limit !== Infinity && !opts.quick) throw new Error("--limit is only allowed with --quick");
  return opts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`${e.message}\n${USAGE}`); process.exit(2); }
  const log = opts.printFreeze ? (m) => (m.startsWith("{") ? console.log(m) : console.error(m)) : console.log;
  prove({...opts, log}).then((r) => process.exit(r.exitCode), (e) => { console.error(`referee:prove error: ${e.stack ?? e.message}`); process.exit(1); });
}
