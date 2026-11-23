// Night Shift repair, fresh confirmation. Replays the one reviewed contest-balance candidate against its
// base on the two fresh confirm ranges of .kiro/specs/night-shift-repair/protocol.json, both versions, both
// opening seats, through the shared engine API (scripts/field-trial-engine.mjs). Each range is played once by
// the shared paired audit (src/review/paired-duel-kit.js); its ordered pair stream feeds the block and its hash,
// and its own counts must equal the block's. It never picks or edits a candidate, never edits cards or earlier
// evidence, and never retries: an existing result in this run's OUTPUT is final. The tracked public
// reference (EVIDENCE) never blocks a live run; when it holds published data, the run is flagged as not blind.
//
//   node scripts/field-trial-confirm.mjs            live: seal checks, separation, replay, write
//                                                   .artifacts/contest-balance/field-trial/fresh.json
//   node scripts/field-trial-confirm.mjs --verify   reproduce docs/evidence/night-shift-repair/fresh.json from
//                                                   its pinned base commit and input object IDs; when this
//                                                   checkout lacks that commit, from local HEAD only if HEAD
//                                                   has exactly the recorded input objects (no network fetch)
//
// Live exit: 0 both confirm blocks pass, 1 valid measurement rejects (result written), 2 integrity or input
// problem (nothing written), 3 a required input is unavailable.
// Verify exit: 0 verified pass, 1 verified rejection, 2 malformed record, 3 unavailable, 4 stale (record
// reproduces but the current contract or protocol differs from it), 5 mismatch (does not reproduce or is
// internally inconsistent).
import {spawnSync} from "node:child_process";
import {existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {DRAW, measurePairedCohort} from "../src/review/paired-duel-kit.js";
import {bundleSealIntact, canonical, changeField, paired, sha256, summarize} from "./night-review.mjs";
import {CONTRACT_PATH, contractProblems, evaluateBalanceRequirements, parseBalanceContract} from "./showdown-balance-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PROTOCOL_PATH = ".kiro/specs/night-shift-repair/protocol.json";
export const OUTPUT = ".artifacts/contest-balance/field-trial/fresh.json";
export const EVIDENCE = "docs/evidence/night-shift-repair/fresh.json";
const STATUS = ".artifacts/contest-balance/status.json";
const ENGINE = "scripts/field-trial-engine.mjs";
const KIT = "src/review/paired-duel-kit.js";
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
export const INPUT_PATHS = Object.freeze(["src/game", CARD_DIR, "scripts/sync-card-specs.mjs", "prototypes/showdown/rules.js"]);
const FIELDS = ["attack", "health", "stars"];
const SEATS = ["cowboy", "wizard"];
export const CONFIRM_DEALS = 2000; // 2,000 deals x 2 opening seats = 4,000 games per arm per range
const KIND = "night-shift-repair/fresh-confirmation";
// Fields verify recomputes; provenance (attempt, receiptSha256, protocol, separation) is checked, not replayed.
const CALCULATED = ["inputs", "change", "cardFile", "blocks", "pass", "reasons", "meaning"];

export class Failure extends Error {
  constructor(kind, problems) {
    const list = [problems].flat();
    super(list.join("\n  - "));
    this.kind = kind;
    this.problems = list;
  }
}
const fail = (kind, problems) => { throw new Failure(kind, problems); };

// ---- pure checks ----

const isInt = (v) => Number.isSafeInteger(v) && v >= 0;
const isHex = (v, n) => typeof v === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(v);
const isObjectId = (v) => isHex(v, 40) || isHex(v, 64);
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const sameKeys = (v, keys) => plain(v) && canonical(Object.keys(v).sort()) === canonical([...keys].sort());
const span = (r) => ({from: r.first, deals: r.deals, last: r.first + r.deals - 1});
const overlaps = (a, b) => a.from <= b.last && b.from <= a.last;

export function protocolProblems(p) {
  const out = [];
  if (!sameKeys(p, ["schema", "scout", "confirm"])) return ["protocol must be exactly {schema, scout, confirm}"];
  if (p.schema !== 1) out.push(`protocol schema must be 1, got ${JSON.stringify(p.schema)}`);
  const ranges = (name, list) => {
    if (!Array.isArray(list) || !list.length) return out.push(`protocol ${name} must be a non-empty list`);
    list.forEach((r, i) => {
      if (!sameKeys(r, ["first", "deals"]) || !isInt(r.first) || !Number.isSafeInteger(r.deals) || r.deals < 1 || !Number.isSafeInteger(r.first + r.deals))
        out.push(`protocol ${name}[${i}] must be {first, deals} with whole numbers and deals >= 1`);
    });
  };
  ranges("scout", p.scout);
  ranges("confirm", p.confirm);
  if (Array.isArray(p.confirm)) {
    if (p.confirm.length !== 2) out.push(`protocol must list exactly two confirm ranges, found ${p.confirm.length}`);
    p.confirm.forEach((r, i) => { if (r?.deals !== CONFIRM_DEALS) out.push(`confirm[${i}] must have ${CONFIRM_DEALS} deals (4,000 games per arm), got ${r?.deals}`); });
  }
  return out;
}

// Both fresh cohorts must be disjoint from each other, from every scout range and from tune and holdout.
export function separationProblems({confirm, scout, tune, holdout}) {
  const out = [];
  const named = [...scout.map((r, i) => [`scout[${i}]`, span(r)]), ["tune", tune], ["holdout", holdout]];
  const fresh = confirm.map((r, i) => [`confirm[${i}]`, span(r)]);
  for (const [name, r] of [["tune", tune], ["holdout", holdout]]) {
    if (!r || !isInt(r.from) || !isInt(r.last) || r.last < r.from) out.push(`${name} seed range is missing or malformed`);
  }
  if (out.length) return out;
  if (fresh.length === 2 && overlaps(fresh[0][1], fresh[1][1])) out.push("the two confirm ranges overlap each other");
  for (const [fn, f] of fresh) for (const [on, o] of named) if (overlaps(f, o)) out.push(`${fn} seeds ${f.from}-${f.last} overlap ${on} seeds ${o.from}-${o.last}`);
  return out;
}

const pct = (n, games) => (100 * n) / games;
function arm(games) {
  const s = summarize(games);
  return {games: s.games, cowboy: s.cowboy, wizard: s.wizard, draw: s.draw, openingWins: s.first, secondWins: s.second,
    cowboyShare: s.cowboyShare, wizardShare: pct(s.wizard, s.games), drawShare: pct(s.draw, s.games),
    openingShare: s.firstShare, secondShare: pct(s.second, s.games), seatSkew: s.seatSkew};
}
const fixed = (v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "missing");

// Paired games -> one block with shares, flips, NSB-1/NSB-2 rows, reasons and the paired-games hash.
// pairs: measurePairedCohort's onPair stream in play order, [{seed, first, baseline: {winner, endTurn},
// candidate: {winner, endTurn}}] with winner cowboy, wizard or "draw". The hash covers that stream as delivered.
export function evaluateBlock(id, range, pairs, policy) {
  const as = (which) => pairs.map((p) => ({seed: p.seed, first: p.first, winner: p[which].winner === DRAW ? null : p[which].winner}));
  const b = as("baseline"), c = as("candidate");
  const baseline = arm(b), candidate = arm(c);
  const f = paired(b, c);
  const flips = {...f, changed: f.towardCowboy + f.towardWizard + f.other, endTurnChanged: pairs.filter((p) => p.baseline.endTurn !== p.candidate.endTurn).length};
  const measurement = {cowboyShare: candidate.cowboyShare, wizardShare: candidate.wizardShare, seatSkew: candidate.seatSkew, baselineSeatSkew: baseline.seatSkew};
  const requirements = evaluateBalanceRequirements(policy, measurement);
  const reasons = [];
  if (pairs.length !== 2 * range.deals) reasons.push(`${id}: expected ${2 * range.deals} paired games, found ${pairs.length}`);
  if (flips.same === pairs.length) reasons.push(`${id}: the change altered no game result`);
  for (const row of requirements) {
    if (!row.measured) { reasons.push(`${id}: ${row.id} measurement is missing or non-finite`); continue; }
    if (row.pass) continue;
    if (row.id === "NSB-1") reasons.push(`${id}: NSB-1 Cowboy ${fixed(row.cowboyShare)}% / Wizard ${fixed(row.wizardShare)}% not both within ${policy.band[0]}-${policy.band[1]}%`);
    else reasons.push(`${id}: NSB-2 first-seat skew grew ${fixed(row.baselineSeatSkew)} -> ${fixed(row.seatSkew)} pp (tolerance ${policy.seatTolerancePp})`);
  }
  const pairedGames = pairs.map((p) => [p.seed, p.first, p.baseline.winner, p.baseline.endTurn, p.candidate.winner, p.candidate.endTurn]);
  return {id, seeds: {first: range.first, last: range.first + range.deals - 1, deals: range.deals}, gamesPerArm: pairs.length,
    baseline, candidate, flips, measurement: {...measurement, unit: "percent of all games in this block; draws count for neither faction"},
    requirements, reasons, pass: reasons.length === 0,
    pairedSha256: sha256(canonical({order: ["seed", "first", "baselineWinner", "baselineEndTurn", "candidateWinner", "candidateEndTurn"], games: pairedGames}))};
}

// A block derived from the pair stream must agree with the shared kit's own counts for that stream.
export function cohortProblems(block, counts) {
  const ours = (a) => ({wins: {cowboy: a.cowboy, wizard: a.wizard}, draws: a.draw, firstWins: a.openingWins});
  const out = [];
  if (counts.gamesPerArm !== block.gamesPerArm) out.push(`${block.id}: ${block.gamesPerArm} paired games, measurePairedCohort counted ${counts.gamesPerArm}`);
  for (const which of ["baseline", "candidate"]) {
    if (canonical(ours(block[which])) !== canonical(counts[which])) out.push(`${block.id}: ${which} ${canonical(ours(block[which]))} differs from measurePairedCohort ${canonical(counts[which])}`);
  }
  if (counts.switchedWinners !== block.flips.changed) out.push(`${block.id}: ${block.flips.changed} changed results, measurePairedCohort counted ${counts.switchedWinners}`);
  return out;
}

export function decide(blocks) {
  const reasons = blocks.length === 2 ? blocks.flatMap((b) => b.reasons) : [`expected two confirm blocks, found ${blocks.length}`];
  const pass = reasons.length === 0 && blocks.every((b) => b.pass);
  return {pass, reasons, meaning: pass
    ? "Both fresh confirm ranges meet NSB-1 and NSB-2. Ready for Fable/Alex review only; not applied to any card or release."
    : "The reviewed candidate did not confirm on fresh seeds. Do not forward it."};
}

export const seal = (record) => ({...record, recordSha256: sha256(canonical({...record, recordSha256: undefined}))});
export const sealIntact = (record) => record.recordSha256 === sha256(canonical({...record, recordSha256: undefined}));

// ---- side effects: git, engine, files ----

// Same no-network Git settings as the shared engine: a missing object fails instead of being fetched.
const GIT_ENV = {...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0"};
function git(args, {binary = false, allowFail = false} = {}) {
  const r = spawnSync("git", args, {cwd: ROOT, env: GIT_ENV, encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) return allowFail ? null : fail("unavailable", `git ${args.join(" ")}: ${String(r.stderr).trim()}`);
  return binary ? r.stdout : r.stdout.trim();
}
const commitExists = (sha) => isObjectId(sha) && git(["cat-file", "-e", `${sha}^{commit}`], {allowFail: true}) !== null;
const readText = (rel) => readFileSync(join(ROOT, rel), "utf8");
function readJsonFile(rel, what) {
  if (!existsSync(join(ROOT, rel))) fail("unavailable", `${what} not found: ${rel}`);
  const text = readText(rel);
  try { return {value: JSON.parse(text), sha256: sha256(text)}; } catch { return fail("malformed", `${what} is not valid JSON: ${rel}`); }
}

function loadProtocol() {
  const {value, sha256: hash} = readJsonFile(PROTOCOL_PATH, "protocol");
  const problems = protocolProblems(value);
  if (problems.length) fail("malformed", problems.map((p) => `${PROTOCOL_PATH}: ${p}`));
  return {protocol: {scout: value.scout, confirm: value.confirm}, protocolSha256: hash};
}

// Every pinned input must be the base commit's own git object for that path.
function inputProblems(base, inputs) {
  if (!sameKeys(inputs, INPUT_PATHS)) return [`inputs must name exactly ${INPUT_PATHS.join(", ")}; got ${plain(inputs) ? Object.keys(inputs).join(", ") : typeof inputs}`];
  const out = [];
  for (const path of INPUT_PATHS) {
    const id = git(["rev-parse", "--verify", `${base}:${path}`], {allowFail: true});
    if (!isObjectId(inputs[path])) out.push(`input ${path} is not a git object ID`);
    else if (id !== inputs[path]) out.push(`input ${path} is ${inputs[path]}, but ${base.slice(0, 12)} has ${id ?? "no such path"}`);
  }
  return out;
}

// The reviewed change re-derived from the base commit's card text: one whitelisted number on one troop.
function cardFileAt(base, change) {
  const problems = [];
  if (!sameKeys(change, ["card", "field", "from", "to"])) return {problems: ["change must be exactly {card, field, from, to}"]};
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(change.card ?? "")) problems.push(`card ${JSON.stringify(change.card)} is not a card key`);
  if (!FIELDS.includes(change.field)) problems.push(`field ${JSON.stringify(change.field)} is not one of ${FIELDS.join(", ")}`);
  if (!Number.isSafeInteger(change.from) || !Number.isSafeInteger(change.to) || change.from === change.to) problems.push("from and to must be different whole numbers");
  if (problems.length) return {problems};
  const path = `${CARD_DIR}/${change.card}.json`;
  const buf = git(["cat-file", "blob", `${base}:${path}`], {binary: true, allowFail: true});
  if (!buf) return {problems: [`${path} does not exist at ${base.slice(0, 12)}`]};
  const baseText = buf.toString("utf8");
  let spec;
  try { spec = JSON.parse(baseText); } catch { return {problems: [`${path} at base is not valid JSON`]}; }
  if (spec.kind !== "troop") problems.push(`${change.card} is not a troop card`);
  if (spec.type !== change.card) problems.push(`${path} has type ${spec.type}, not ${change.card}`);
  if (spec[change.field] !== change.from) problems.push(`${change.card}.${change.field} is ${spec[change.field]} at base, not ${change.from}`);
  let after = null;
  try { after = changeField(baseText, change.field, change.from, change.to); } catch (error) { problems.push(`not a one-field edit: ${error.message}`); }
  return {problems, cardFile: after === null ? null : {path, before: sha256(baseText), after: sha256(after)}};
}

async function loadEngine() {
  const file = join(ROOT, ENGINE);
  if (!existsSync(file)) fail("unavailable", `shared engine ${ENGINE} is missing`);
  let mod;
  try { mod = await import(pathToFileURL(file).href); } catch (error) { return fail("unavailable", `shared engine ${ENGINE} failed to load: ${error.message}`); }
  if (typeof mod.openTrialEngine !== "function" || typeof mod.playTrial !== "function") fail("unavailable", `${ENGINE} does not export openTrialEngine and playTrial`);
  return {mod, sha256: sha256(readFileSync(file))};
}

// Opens base and candidate in their own new private temp directories and plays every confirm range once
// through measurePairedCohort: each seed from both opening seats, baseline then candidate. Any engine or
// outcome error ends the run (no retry). ref must be a commit this checkout has, so the engine never fetches.
async function replay(engine, base, change, expectedInputs, confirm, policy, failKind) {
  const parent = mkdtempSync(join(tmpdir(), "field-trial-confirm-"));
  try {
    const open = async (name, ch, expected) => {
      const dir = mkdtempSync(join(parent, `${name}-`));
      try { return await engine.openTrialEngine(dir, base, ch, expected); } catch (error) { return fail(failKind, `openTrialEngine (${name}) failed: ${error.message}`); }
    };
    const baseArm = await open("baseline", null, expectedInputs);
    const candArm = await open("candidate", {...change}, expectedInputs ?? baseArm.inputs);
    const inputs = baseArm?.inputs;
    if (canonical(inputs) !== canonical(candArm?.inputs)) fail(failKind, "baseline and candidate report different pinned inputs");
    const blocks = [];
    for (const [i, range] of confirm.entries()) {
      const id = `confirm-${i + 1}`, pairs = [];
      let counts;
      try {
        counts = measurePairedCohort({firstSeed: range.first, deals: range.deals, sides: SEATS,
          playBaseline: (seed, first) => engine.playTrial(baseArm.rules, seed, first),
          playCandidate: (seed, first) => engine.playTrial(candArm.rules, seed, first),
          onPair: (pair) => { pairs.push(pair); }});
      } catch (error) {
        const n = pairs.length;
        return fail(failKind, `${id} stopped after ${n} pairs at seed ${range.first + Math.floor(n / 2)} ${SEATS[n % 2]} first: ${error.message}`);
      }
      const block = evaluateBlock(id, range, pairs, policy);
      const drift = cohortProblems(block, counts);
      if (drift.length) fail(failKind, drift);
      blocks.push(block);
      console.log(`  ${id} seeds ${block.seeds.first}-${block.seeds.last}, ${block.gamesPerArm} games/arm: Cowboy ${fixed(block.baseline.cowboyShare)}% -> ${fixed(block.candidate.cowboyShare)}%, ` +
        `Wizard ${fixed(block.baseline.wizardShare)}% -> ${fixed(block.candidate.wizardShare)}%, opening ${fixed(block.baseline.openingShare)}% -> ${fixed(block.candidate.openingShare)}%, ` +
        `${block.flips.changed} results changed: ${block.pass ? "pass" : "reject"}`);
    }
    return {inputs, blocks};
  } finally {
    rmSync(parent, {recursive: true, force: true});
  }
}

// Atomic and no-clobber: a hard link fails if the final file already exists.
function writeFinal(rel, value) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", {flag: "wx"});
  try { linkSync(tmp, file); } catch (error) { fail("integrity", `could not write ${rel} (final data is never replaced): ${error.message}`); } finally { unlinkSync(tmp); }
}

function seedsOf(set, name) {
  const s = set?.seeds;
  if (!plain(s) || !isInt(s.from) || !isInt(s.to) || s.to - s.from + 1 !== s.deals) fail("integrity", `receipt ${name} seeds are missing or inconsistent`);
  return {from: s.from, last: s.to, deals: s.deals};
}

// Whether the tracked public reference already holds a published result. Only its null placeholder (first
// integration) counts as empty; nothing else is read from it, so no published value can steer this run.
function referencePublished() {
  const file = join(ROOT, EVIDENCE);
  if (!existsSync(file)) return false;
  try { return JSON.parse(readFileSync(file, "utf8")) !== null; } catch { return true; }
}
const NOT_BLIND = `${EVIDENCE} already holds published results for this protocol; this run is a reproduction or a new ` +
  "nomination on previously published seeds and must not be reported as blind";

async function live() {
  // Only this run's own ignored output is final. The tracked reference file ships in every clone.
  if (existsSync(join(ROOT, OUTPUT))) fail("integrity", `${OUTPUT} already exists; this run's fresh confirmation data is final and is not re-run`);
  const notBlind = referencePublished();
  if (notBlind) console.log(`  note: ${NOT_BLIND}`);
  const {protocol, protocolSha256} = loadProtocol();

  // 1. The authoritative balance loop must verify and report a passing, sealed receipt.
  const {value: status} = readJsonFile(STATUS, "contest-balance status");
  const attempt = status.attempt;
  if (!Number.isSafeInteger(attempt) || attempt < 1) fail("integrity", `status.json names no reviewed attempt (attempt ${JSON.stringify(attempt)})`);
  const check = spawnSync(process.execPath, [join(ROOT, "scripts/contest-balance.mjs"), "verify", "--attempt", String(attempt)], {cwd: ROOT, encoding: "utf8"});
  if (check.status !== 0) fail("integrity", `contest-balance verify --attempt ${attempt} exited ${check.status}: ${(check.stdout + check.stderr).trim().split("\n").slice(-6).join(" | ")}`);
  const problems = [];
  const receiptPath = `.artifacts/contest-balance/attempt-${attempt}/receipt.json`;
  if (status.schema !== "contest-balance/status@1") problems.push("status.json has an unknown schema");
  if (status.pass !== true) problems.push("status.json does not report pass=true");
  if (status.receipt !== receiptPath) problems.push(`status.json points at ${status.receipt}, expected ${receiptPath}`);
  const {value: receipt} = readJsonFile(receiptPath, "receipt");
  if (receipt.schema !== "contest-balance/receipt@1" || receipt.attempt !== attempt) problems.push("receipt schema or attempt does not match status.json");
  if (!bundleSealIntact(receipt)) problems.push("receipt seal does not match its contents");
  if (!isHex(receipt.bundleSha256, 64) || status.receiptSha256 !== receipt.bundleSha256) problems.push("status.json receiptSha256 does not match the sealed receipt");
  if (receipt.decision?.pass !== true || receipt.decision?.verdict !== "PASS") problems.push("receipt decision is not PASS");
  if (receipt.realCards?.unchanged !== true || receipt.applied !== false) problems.push("receipt reports changed real cards or an applied change");
  if (!Array.isArray(receipt.violations) || receipt.violations.length) problems.push("receipt records violations");
  if (problems.length) fail("integrity", problems);

  // 2. Source commit, reviewed one-field change and card hashes.
  const base = receipt.base?.commit;
  if (!commitExists(base)) fail("unavailable", `receipt base commit ${base} is not in this repository`);
  if (git(["rev-parse", `${base}^{tree}`]) !== receipt.base.tree) problems.push("receipt base tree does not match its commit");
  const rc = receipt.change ?? {};
  const change = {card: rc.card, field: rc.field, from: rc.from, to: rc.to};
  const {problems: changeProblems, cardFile} = cardFileAt(base, change);
  problems.push(...changeProblems);
  if (cardFile) {
    if (rc.cardPath !== cardFile.path) problems.push(`receipt cardPath ${rc.cardPath} is not ${cardFile.path}`);
    if (rc.cardSha256?.before !== cardFile.before) problems.push("receipt card hash before the change does not match the base commit");
    if (rc.cardSha256?.after !== cardFile.after) problems.push("receipt card hash after the change does not match a one-field edit of the base card");
    const scratch = join(ROOT, `.artifacts/contest-balance/attempt-${attempt}/scratch`, cardFile.path);
    if (!existsSync(scratch) || sha256(readFileSync(scratch)) !== cardFile.after) problems.push("the reviewed scratch card is missing or differs from the reviewed change");
  }

  // 3. The current contract must be the reviewed contract.
  let contractSha256 = null;
  const policy = {band: receipt.policy?.band, seatTolerancePp: receipt.policy?.seatTolerancePp};
  problems.push(...contractProblems(policy).map((p) => `receipt policy: ${p}`));
  if (!existsSync(join(ROOT, CONTRACT_PATH))) problems.push(`${CONTRACT_PATH} is missing`);
  else {
    const text = readText(CONTRACT_PATH);
    contractSha256 = sha256(text);
    if (contractSha256 !== receipt.tool?.balanceContract?.requirements) problems.push(`${CONTRACT_PATH} differs from the contract the receipt was reviewed under`);
    try {
      const current = parseBalanceContract(text);
      if (canonical({band: [...current.band], seatTolerancePp: current.seatTolerancePp}) !== canonical(policy)) problems.push("current contract numbers differ from the receipt policy");
    } catch (error) { problems.push(error.message); }
  }

  // 4. Fresh cohorts separate from scout, tune and holdout.
  const separation = {scout: protocol.scout, tune: seedsOf(receipt.sets?.tune, "tune"), holdout: seedsOf(receipt.sets?.holdout, "holdout")};
  problems.push(...separationProblems({confirm: protocol.confirm, ...separation}));
  if (problems.length) fail("integrity", problems);

  // 5. Replay both versions, both starts, on both fresh ranges.
  const engine = await loadEngine();
  console.log(`fresh confirm: attempt ${attempt}, ${change.card} ${change.field} ${change.from} -> ${change.to} at ${base.slice(0, 12)}`);
  const {inputs, blocks} = await replay(engine.mod, base, change, null, protocol.confirm, policy, "integrity");
  const inputIssues = inputProblems(base, inputs);
  if (inputIssues.length) fail("integrity", inputIssues);
  const decision = decide(blocks);
  const record = seal({schema: 1, kind: KIND, base, inputs, change, cardFile, attempt, receiptSha256: receipt.bundleSha256, contractSha256, policy,
    protocolSha256, protocol, separation: {...separation, disjoint: true}, blocks, ...decision,
    tool: {script: sha256(readFileSync(fileURLToPath(import.meta.url))), engine: engine.sha256, kit: sha256(readFileSync(join(ROOT, KIT))), node: process.version},
    surface: "local-cli", applied: false, recordedAt: new Date().toISOString()});
  writeFinal(OUTPUT, record);
  console.log(`  ${decision.pass ? "PASS" : "REJECT"}${decision.reasons.length ? `\n    - ${decision.reasons.join("\n    - ")}` : ""}\n  ${decision.meaning}\n  wrote ${OUTPUT}${notBlind ? `\n  note: ${NOT_BLIND}` : ""}`);
  return decision.pass ? 0 : 1;
}

function recordShapeProblems(r) {
  const out = [];
  if (!plain(r)) return ["record is not a JSON object"];
  if (r.schema !== 1 || r.kind !== KIND) out.push("record schema or kind is not a fresh confirmation (schema 1)");
  if (!isObjectId(r.base)) out.push("base is not a full commit ID");
  if (!plain(r.inputs)) out.push("inputs is not an object");
  if (!plain(r.change)) out.push("change is not an object");
  if (!Number.isSafeInteger(r.attempt) || r.attempt < 1) out.push("attempt is not a positive whole number");
  for (const key of ["receiptSha256", "contractSha256", "protocolSha256", "recordSha256"]) if (!isHex(r[key], 64)) out.push(`${key} is not a SHA-256`);
  if (!plain(r.policy) || contractProblems(r.policy).length) out.push("policy is missing or unusable");
  if (!plain(r.protocol)) out.push("protocol is missing");
  else out.push(...protocolProblems({schema: 1, ...r.protocol}));
  if (!plain(r.separation)) out.push("separation is missing");
  if (!Array.isArray(r.blocks)) out.push("blocks is not a list");
  if (typeof r.pass !== "boolean") out.push("pass is not a boolean");
  return out;
}

async function verify() {
  const {value: record} = readJsonFile(EVIDENCE, "published evidence");
  const shape = recordShapeProblems(record);
  if (shape.length) fail("malformed", shape);
  const problems = [];
  if (!sealIntact(record)) problems.push("recordSha256 does not match the record's contents");
  // Source: the frozen base commit when present; otherwise local HEAD, only with exactly the recorded inputs.
  let source = record.base;
  if (!commitExists(record.base)) {
    const head = git(["rev-parse", "--verify", "HEAD^{commit}"], {allowFail: true});
    const headIssues = isObjectId(head) ? inputProblems(head, record.inputs) : ["this checkout has no HEAD commit"];
    if (headIssues.length) fail("unavailable", [`base commit ${record.base} is not in this repository and local HEAD cannot stand in (no network fetch is attempted):`, ...headIssues]);
    console.log(`  base ${record.base.slice(0, 12)} is not local; replaying from local HEAD ${head.slice(0, 12)}, whose four input objects equal the recorded ones`);
    source = head;
  }
  problems.push(...inputProblems(source, record.inputs));
  const {problems: changeProblems, cardFile} = cardFileAt(source, record.change);
  problems.push(...changeProblems);
  const sep = record.separation;
  if (canonical(sep.scout) !== canonical(record.protocol.scout)) problems.push("separation scout ranges differ from the recorded protocol");
  problems.push(...separationProblems({confirm: record.protocol.confirm, scout: record.protocol.scout, tune: sep.tune, holdout: sep.holdout}));
  if (problems.length) fail("mismatch", problems);

  const engine = await loadEngine();
  console.log(`verify ${EVIDENCE}: attempt ${record.attempt}, ${record.change.card} ${record.change.field} ${record.change.from} -> ${record.change.to} at ${record.base.slice(0, 12)}${source === record.base ? "" : ` (source HEAD ${source.slice(0, 12)})`}`);
  const {inputs, blocks} = await replay(engine.mod, source, record.change, record.inputs, record.protocol.confirm, record.policy, "mismatch");
  const recomputed = {inputs, change: record.change, cardFile, blocks, ...decide(blocks)};
  for (const key of CALCULATED) if (canonical(recomputed[key]) !== canonical(record[key])) problems.push(`${key} differs from the replay`);
  for (const [i, b] of blocks.entries()) if (canonical(b) !== canonical(record.blocks[i])) problems.push(`${b.id}: recorded ${record.blocks[i]?.pairedSha256 ?? "missing"}, replay ${b.pairedSha256}`);
  if (problems.length) fail("mismatch", problems);

  // Reproduced. Is it still current against today's contract and protocol?
  const stale = [];
  if (!existsSync(join(ROOT, CONTRACT_PATH)) || sha256(readText(CONTRACT_PATH)) !== record.contractSha256) stale.push(`${CONTRACT_PATH} differs from the contract the record used`);
  else {
    try {
      const c = parseBalanceContract(readText(CONTRACT_PATH));
      if (canonical({band: [...c.band], seatTolerancePp: c.seatTolerancePp}) !== canonical(record.policy)) stale.push("current contract numbers differ from the recorded policy");
    } catch (error) { stale.push(error.message); }
  }
  if (!existsSync(join(ROOT, PROTOCOL_PATH)) || sha256(readText(PROTOCOL_PATH)) !== record.protocolSha256) stale.push(`${PROTOCOL_PATH} differs from the protocol the record used`);
  if (stale.length) fail("stale", stale);
  const toolNote = record.tool?.script === sha256(readFileSync(fileURLToPath(import.meta.url))) ? "matches" : "differs from";
  console.log(`  reproduced exactly; recorded tool script ${toolNote} this file. Tune/holdout ranges are as recorded under receipt ${record.receiptSha256.slice(0, 12)}.`);
  if (record.pass) { console.log("  VERIFIED PASS"); return 0; }
  console.log(`  VERIFIED REJECTION\n    - ${record.reasons.join("\n    - ")}`);
  return 1;
}

const LIVE_EXIT = {integrity: 2, malformed: 2, mismatch: 2, stale: 2, unavailable: 3};
const VERIFY_EXIT = {malformed: 2, unavailable: 3, stale: 4, mismatch: 5, integrity: 5};

async function main(argv) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--verify")) fail("malformed", "usage: field-trial-confirm.mjs [--verify]");
  return argv[0] === "--verify" ? verify() : live();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verifying = process.argv[2] === "--verify";
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    const kind = error instanceof Failure ? error.kind : "integrity";
    console.error(`field-trial-confirm${verifying ? " --verify" : ""}: ${kind.toUpperCase()}\n  - ${error instanceof Failure ? error.message : error.stack}`);
    process.exit((verifying ? VERIFY_EXIT : LIVE_EXIT)[kind] ?? 2);
  });
}
