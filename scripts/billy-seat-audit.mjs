// Billy seat audit: replays the frozen protocol (docs/evidence/billy-seat-audit/protocol.json) on the pinned
// original engine, baseline Billy attack 2 and candidate attack 1, every deal with each faction opening.
//
//   node scripts/billy-seat-audit.mjs --record [--workers 1..8]
//     writes the ignored pair .artifacts/billy-seat-audit/{outcomes.csv,result.json}; never touches docs/.
//     First repairs any replacement an earlier run left unfinished (see "publishing" below).
//   node scripts/billy-seat-audit.mjs --verify [--workers 1..8]
//     replays and compares every field and the CSV digest with docs/evidence/billy-seat-audit/result.json; writes nothing
//
// Workers each play a contiguous seed range and return compact CSV rows only; rows are joined in seed, then seat
// (cowboy, wizard) order before hashing, so the output does not depend on the worker count.
// Exit status: 0 success, 1 failed check or replay, 2 usage error.
import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {closeSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, unlinkSync, writeFileSync, writeSync} from "node:fs";
import {hostname, tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {Worker, isMainThread, parentPort, workerData} from "node:worker_threads";
import {BOT_LEVEL, CARD, FIELD, loadEngines, play, prepareEngines, record, root} from "./billy-replay-engine.mjs";

export const HEADER = "seed,first,baseline_winner,candidate_winner,baseline_turn,candidate_turn";
export const WINNERS = Object.freeze(["cowboy", "wizard", "draw"]);
export const PROTOCOL_PATH = "docs/evidence/billy-seat-audit/protocol.json";
export const REFERENCE_PATH = "docs/evidence/billy-seat-audit/result.json";
export const OUT_DIR = ".artifacts/billy-seat-audit";
export const DEFAULT_WORKERS = 4;
const FROZEN_PROTOCOL = Object.freeze({
  schema: 1, sourceCommit: "eedab9385931e093e156fdb7885c470eb2ec64eb", card: "cowboy-billy", field: "attack",
  baseline: 2, candidate: 1, firstSeed: 901010000, deals: 25000, blockDeals: 5000, seats: ["cowboy", "wizard"], botLevel: 2,
});
const WORKER_TAG = "billy-seat-audit-worker";
const LOCK_WAIT_MS = 120_000;
// A lock with no readable owner (or an earlier version's empty lock directory) is treated as abandoned after this long.
const UNOWNED_STALE_MS = 10_000;
export const MAX_DEALS = 1_000_000;
const UINT32_MAX = 0xffff_ffff;
const PAIR = ["outcomes.csv", "result.json"];
const LOCK_NAME = ".lock";
const JOURNAL_NAME = ".replacing";

const sha256 = data => createHash("sha256").update(data).digest("hex");
const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;

// Structure and ranges only: same proposal (commit, card, field, both arms, bot level) and seats as the pinned
// engine, positive bounded whole deals split into whole blocks, and a seed interval inside uint32 that does not wrap.
// The seed range and sizes may differ from the frozen protocol, so small fixtures (firstSeed 123, 4 deals, blocks of 2) pass.
export function validateProtocolShape(protocol) {
  assert.ok(protocol && typeof protocol === "object" && !Array.isArray(protocol), "protocol must be a JSON object");
  assert.deepStrictEqual(Object.keys(protocol).sort(), Object.keys(FROZEN_PROTOCOL).sort(), "protocol fields");
  assert.equal(protocol.schema, FROZEN_PROTOCOL.schema, "protocol schema");
  assert.deepStrictEqual([protocol.sourceCommit, protocol.card, protocol.field, protocol.baseline, protocol.candidate, protocol.botLevel],
    [record.source.commit, CARD, FIELD, record.baseline.attack, record.candidate.attack, BOT_LEVEL], "protocol does not match the pinned engine proposal");
  assert.deepStrictEqual(protocol.seats, [...FROZEN_PROTOCOL.seats], "protocol seats");
  const {firstSeed, deals, blockDeals} = protocol;
  assert.ok(isPositiveInteger(deals) && deals <= MAX_DEALS, `deals must be a whole number from 1 to ${MAX_DEALS}`);
  assert.ok(isPositiveInteger(blockDeals) && blockDeals <= deals, "blockDeals must be a whole number from 1 to deals");
  assert.ok(deals % blockDeals === 0, "deals must split into whole blocks");
  assert.ok(Number.isSafeInteger(firstSeed) && firstSeed >= 0 && firstSeed <= UINT32_MAX, "firstSeed must be a uint32");
  assert.ok(firstSeed + deals - 1 <= UINT32_MAX, "the seed interval must stay inside uint32 without wrapping");
  return protocol;
}

// The real command accepts only the frozen, preregistered protocol.
export function validateProtocol(protocol) {
  validateProtocolShape(protocol);
  assert.deepStrictEqual({...protocol}, {...FROZEN_PROTOCOL, seats: [...FROZEN_PROTOCOL.seats]}, "protocol differs from the frozen protocol");
  return protocol;
}

const counts = () => ({cowboy: 0, wizard: 0, draw: 0});
const TURN = /^[1-9][0-9]*$/;

// Validates a complete, ordered compact recording and derives the exact result. Throws on any defect.
// Pure: checks the protocol's structure and ranges; the command entry enforces the frozen protocol and pinned inputs.
export function summarizeRows(csvText, protocol, protocolSha256) {
  validateProtocolShape(protocol);
  assert.ok(typeof protocolSha256 === "string" && /^[0-9a-f]{64}$/.test(protocolSha256), "protocolSha256 must be 64 lowercase hex digits");
  assert.ok(typeof csvText === "string", "CSV must be text");
  assert.ok(!csvText.includes("\r"), "CSV must use LF line endings");
  assert.ok(csvText.endsWith("\n"), "CSV must end with LF");
  const lines = csvText.slice(0, -1).split("\n");
  assert.equal(lines[0], HEADER, "CSV header");
  const {firstSeed, deals, blockDeals, seats} = protocol;
  const expectedRows = deals * seats.length;
  assert.equal(lines.length - 1, expectedRows, `CSV must hold exactly ${expectedRows} rows`);

  const byFirst = {};
  for (const seat of seats) {
    const transitions = {};
    for (const w of WINNERS) transitions[w] = counts();
    byFirst[seat] = {gamesPerArm: 0, baseline: counts(), candidate: counts(), transitions};
  }
  const blocks = [];
  for (let b = 0; b < deals / blockDeals; b++) blocks.push({firstSeed: firstSeed + b * blockDeals, deals: blockDeals, baselineCowboyWins: 0, candidateCowboyWins: 0});

  for (let i = 0; i < expectedRows; i++) {
    const line = lines[i + 1], where = `CSV row ${i + 1}`;
    const fields = line.split(",");
    assert.equal(fields.length, 6, `${where}: expected 6 fields`);
    const [seed, first, bw, cw, bt, ct] = fields;
    const deal = Math.floor(i / seats.length);
    assert.equal(seed, String(firstSeed + deal), `${where}: seed out of order, duplicated, missing or out of range`);
    assert.equal(first, seats[i % seats.length], `${where}: opening seat out of order, duplicated or missing`);
    assert.ok(WINNERS.includes(bw) && WINNERS.includes(cw), `${where}: winner must be cowboy, wizard or draw`);
    assert.ok(TURN.test(bt) && TURN.test(ct) && Number.isSafeInteger(Number(bt)) && Number.isSafeInteger(Number(ct)), `${where}: turns must be positive whole numbers`);
    const cell = byFirst[first];
    cell.gamesPerArm++;
    cell.baseline[bw]++;
    cell.candidate[cw]++;
    cell.transitions[bw][cw]++;
    const block = blocks[Math.floor(deal / blockDeals)];
    block.baselineCowboyWins += Number(bw === "cowboy");
    block.candidateCowboyWins += Number(cw === "cowboy");
  }
  return {
    schema: 1, protocolSha256, sourceCommit: protocol.sourceCommit, firstSeed, deals,
    totalDuels: expectedRows * 2, byFirst, blocks, csvSha256: sha256(csvText),
  };
}

export const resultText = result => JSON.stringify(result, null, 2) + "\n";

// First differing path between two JSON values, or null.
function difference(a, b, path = "result") {
  if (Object.is(a, b)) return null;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return path;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!(key in a) || !(key in b)) return `${path}.${key}`;
    const found = difference(a[key], b[key], `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

// --- worker: plays one contiguous seed range and returns compact rows only ---
async function runShard({urls, from, to, seats}) {
  const pair = await loadEngines(urls);
  const rows = [];
  for (let seed = from; seed < to; seed++) {
    for (const first of seats) {
      const [b, c] = pair.map(engine => play(engine, seed, first));
      rows.push([seed, first, b.winner, c.winner, b.endTurn, c.endTurn].join(",") + "\n");
    }
  }
  return rows.join("");
}

function playShards(urls, protocol, workers) {
  const {firstSeed, deals, seats} = protocol;
  const live = [];
  const jobs = [];
  for (let i = 0; i < workers; i++) {
    const from = firstSeed + Math.floor(i * deals / workers), to = firstSeed + Math.floor((i + 1) * deals / workers);
    if (from === to) continue;
    jobs.push(new Promise((resolveShard, rejectShard) => {
      const worker = new Worker(new URL(import.meta.url), {workerData: {tag: WORKER_TAG, urls, from, to, seats}});
      live.push(worker);
      let done = false;
      worker.once("message", message => {
        done = true;
        if (message.ok && typeof message.rows === "string") resolveShard(message.rows);
        else rejectShard(new Error(`seeds ${from}-${to - 1}: ${message.error ?? "no rows"}`));
      });
      worker.once("error", error => { done = true; rejectShard(new Error(`seeds ${from}-${to - 1}: ${error.message}`)); });
      worker.once("exit", code => { if (!done) rejectShard(new Error(`seeds ${from}-${to - 1}: worker exited with ${code} before reporting`)); });
    }));
  }
  return Promise.all(jobs).catch(async error => {
    await Promise.allSettled(live.map(worker => worker.terminate()));
    throw error;
  });
}

// --- publishing ---
// The pair is staged and validated beside the output first, so a preparation failure leaves the old pair untouched.
// The swap runs under an exclusive lock file that names its owner (pid and host); a lock whose owner process has
// exited is removed by the next run. Before moving anything the swap records which old files existed in a journal
// directory and sets them aside there; result.json moves last. The next locked run (or a failed rename) restores the
// old pair from the journal unless the new pair is complete, so an interrupted replacement needs no manual cleanup.
// Only outcomes.csv, result.json, .lock, .replacing and this tool's own .stage-<pid>-* directories are touched.

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

// Returns a description of the current lock when it is abandoned, {gone} when it vanished, or null when it may be live.
function staleLock(lock) {
  let info;
  try { info = lstatSync(lock); } catch (error) { if (error.code === "ENOENT") return {gone: true}; throw error; }
  const old = Date.now() - info.mtimeMs > UNOWNED_STALE_MS;
  // Earlier versions locked with an empty directory held for a few renames.
  if (info.isDirectory()) return old && readdirSync(lock).length === 0 ? {legacy: true} : null;
  let raw;
  try { raw = readFileSync(lock, "utf8"); } catch (error) { if (error.code === "ENOENT") return {gone: true}; throw error; }
  let owner = null;
  try { owner = JSON.parse(raw); } catch { /* unreadable owner */ }
  if (!owner || !isPositiveInteger(owner.pid) || typeof owner.host !== "string") return old ? {raw} : null;
  if (owner.host !== hostname()) return null;
  // Publishing is not re-entrant, so a lock naming this process was left by an earlier process with the same pid.
  return owner.pid === process.pid || !processAlive(owner.pid) ? {raw} : null;
}

function breakLock(lock, stale) {
  if (stale.legacy) {
    try { rmdirSync(lock); } catch (error) { if (!["ENOENT", "ENOTEMPTY", "ENOTDIR"].includes(error.code)) throw error; }
    return;
  }
  // Move the stale lock aside and confirm it is the one judged stale; if another run took the lock in between, put it back.
  const aside = `${lock}.stale-${process.pid}-${randomUUID()}`;
  try { renameSync(lock, aside); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  let moved = null;
  try { moved = readFileSync(aside, "utf8"); } catch { /* treated as changed */ }
  if (moved !== stale.raw) {
    try { linkSync(aside, lock); } catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  rmSync(aside, {force: true});
}

async function acquireLock(lock) {
  const raw = JSON.stringify({pid: process.pid, host: hostname(), token: randomUUID(), startedAt: new Date().toISOString()}) + "\n";
  const start = Date.now();
  for (;;) {
    let fd = null;
    try { fd = openSync(lock, "wx"); } catch (error) { if (error.code !== "EEXIST") throw error; }
    if (fd !== null) {
      try { writeSync(fd, raw); } catch (error) { closeSync(fd); rmSync(lock, {force: true}); throw error; }
      closeSync(fd);
      return raw;
    }
    const stale = staleLock(lock);
    if (stale) { if (!stale.gone) breakLock(lock, stale); continue; }
    if (Date.now() - start > LOCK_WAIT_MS) throw new Error(`another audit is still publishing (lock ${lock} belongs to a running process); retry when it finishes`);
    await sleep(200);
  }
}

function releaseLock(lock, raw) {
  try { if (readFileSync(lock, "utf8") === raw) unlinkSync(lock); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

async function withLock(lock, fn) {
  const raw = await acquireLock(lock);
  try { return fn(); } finally { releaseLock(lock, raw); }
}

// A live pair is complete when result.json parses and names the SHA-256 of outcomes.csv.
function pairComplete(out) {
  try {
    const result = JSON.parse(readFileSync(join(out, "result.json"), "utf8"));
    return result?.csvSha256 === sha256(readFileSync(join(out, "outcomes.csv")));
  } catch {
    return false;
  }
}

// Finishes or undoes an interrupted swap. Call only while holding the lock.
function restoreFromJournal(out) {
  const journal = join(out, JOURNAL_NAME);
  if (!existsSync(journal)) return;
  let had = null;
  try { had = JSON.parse(readFileSync(join(journal, "manifest.json"), "utf8")).had; } catch { /* nothing was moved yet */ }
  if (Array.isArray(had) && !pairComplete(out)) {
    for (const name of PAIR) {
      const saved = join(journal, name), live = join(out, name);
      if (existsSync(saved)) renameSync(saved, live);
      else if (!had.includes(name)) rmSync(live, {force: true}); // a new file with no old one to restore
    }
  }
  rmSync(journal, {recursive: true, force: true});
}

function recoverOutput(out) {
  restoreFromJournal(out);
  for (const entry of readdirSync(out)) {
    const match = /^\.stage-([1-9][0-9]*)-[A-Za-z0-9]{6}$/.exec(entry);
    if (match && !processAlive(Number(match[1]))) rmSync(join(out, entry), {recursive: true, force: true});
  }
}

function swapIn(out, stage) {
  const journal = join(out, JOURNAL_NAME);
  mkdirSync(journal);
  try {
    const had = PAIR.filter(name => existsSync(join(out, name)));
    writeFileSync(join(journal, "manifest.tmp"), JSON.stringify({had}) + "\n");
    renameSync(join(journal, "manifest.tmp"), join(journal, "manifest.json"));
    // Set the old result aside first, so a new CSV is never left beside the old result.
    for (const name of ["result.json", "outcomes.csv"]) if (had.includes(name)) renameSync(join(out, name), join(journal, name));
    renameSync(join(stage, "outcomes.csv"), join(out, "outcomes.csv"));
    renameSync(join(stage, "result.json"), join(out, "result.json"));
  } catch (error) {
    restoreFromJournal(out);
    throw error;
  }
  rmSync(journal, {recursive: true, force: true});
}

async function publish(csv, result, protocol, protocolSha256) {
  const out = resolve(root, OUT_DIR);
  mkdirSync(out, {recursive: true});
  const stage = mkdtempSync(join(out, `.stage-${process.pid}-`));
  try {
    const csvPath = join(stage, "outcomes.csv"), resultPath = join(stage, "result.json");
    writeFileSync(csvPath, csv);
    writeFileSync(resultPath, resultText(result));
    // Re-read the staged pair and confirm it derives the same result before it replaces anything.
    const staged = summarizeRows(readFileSync(csvPath, "utf8"), protocol, protocolSha256);
    assert.deepStrictEqual(JSON.parse(readFileSync(resultPath, "utf8")), staged, "staged result does not match staged CSV");
    await withLock(join(out, LOCK_NAME), () => {
      recoverOutput(out);
      swapIn(out, stage);
    });
    return [join(OUT_DIR, "outcomes.csv"), join(OUT_DIR, "result.json")];
  } finally {
    rmSync(stage, {recursive: true, force: true});
  }
}

// Repairs an interrupted earlier publication before a new recording starts.
async function recoverBeforeRecord() {
  const out = resolve(root, OUT_DIR);
  if (existsSync(out)) await withLock(join(out, LOCK_NAME), () => recoverOutput(out));
}

function parseArgs(args) {
  let mode = null, workers = DEFAULT_WORKERS, sawWorkers = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--record" || arg === "--verify") && !mode) mode = arg.slice(2);
    else if (arg === "--workers" && !sawWorkers && /^[1-8]$/.test(args[i + 1] ?? "")) { workers = Number(args[++i]); sawWorkers = true; }
    else return null;
  }
  return mode ? {mode, workers} : null;
}

async function main(args) {
  const options = parseArgs(args);
  if (!options) {
    console.error("Usage: node scripts/billy-seat-audit.mjs --record|--verify [--workers 1..8]");
    return 2;
  }
  const protocolBytes = readFileSync(resolve(root, PROTOCOL_PATH));
  // Exact enforcement happens here: the frozen protocol, then the pinned original inputs in prepareEngines.
  const protocol = validateProtocol(JSON.parse(protocolBytes.toString("utf8")));
  const protocolSha256 = sha256(protocolBytes);
  if (options.mode === "record") await recoverBeforeRecord();
  const scratch = mkdtempSync(join(tmpdir(), "showdown-billy-seat-"));
  try {
    const urls = prepareEngines(scratch);
    const shards = await playShards(urls, protocol, options.workers);
    const csv = HEADER + "\n" + shards.join("");
    const result = summarizeRows(csv, protocol, protocolSha256);
    if (options.mode === "record") {
      const [csvPath, resultPath] = await publish(csv, result, protocol, protocolSha256);
      console.log(`Recorded ${result.totalDuels} games (${options.workers} workers). CSV SHA-256 ${result.csvSha256}.\nWrote ${csvPath} and ${resultPath}.`);
      return 0;
    }
    const reference = JSON.parse(readFileSync(resolve(root, REFERENCE_PATH), "utf8"));
    const differs = difference(result, reference);
    if (differs) throw new Error(`Replay differs from ${REFERENCE_PATH} at ${differs}`);
    assert.deepStrictEqual(result, reference, "replayed result");
    console.log(`Verified ${result.totalDuels} games against ${REFERENCE_PATH} (${options.workers} workers). CSV SHA-256 ${result.csvSha256}.`);
    return 0;
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}

if (!isMainThread && workerData?.tag === WORKER_TAG) {
  runShard(workerData).then(rows => parentPort.postMessage({ok: true, rows}), error => parentPort.postMessage({ok: false, error: error.message}));
} else if (isMainThread && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
    console.error(`billy-seat-audit: ${error.message}`);
    process.exitCode = 1;
  });
}
