// Night Shift review: takes one Night Watch Showdown finding to one draft candidate that
// changes a single number on a single card, reviews it on paired seeds plus a holdout range,
// and writes a proof bundle bound to the exact source and build hashes. Local CLI only.
// It never edits this checkout's cards; the candidate exists as a patch and a temporary snapshot.
// Fable and Alex decide; an "accepted" verdict only means "ready for their review".
//
//   node scripts/night-review.mjs draft  --finding <reports.json> [--report <id>] [--base <ref>=HEAD] --card <type> --field attack|health|stars --to <n> [--out <dir>]
//   node scripts/night-review.mjs review --bundle <dir> [--holdout <from>:<deals>]
//   node scripts/night-review.mjs verify --bundle <dir> [--rerun] [--finding <reconstructed-report.json>]
//   node scripts/night-review.mjs run    (draft options) [--holdout <from>:<deals>]   draft + review + verify
//   node scripts/night-review.mjs check  --finding <reports.json> [--report <id>]   re-run the finding's counts only
//     (no candidate, no bundle; Night Watch calls this before an opt-in scheduled issue and prints one JSON line)
// Exit status: 0 accepted (or verified), 1 rejected (or verification failed), 2 unusable input.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
const GENERATED = "src/game/card-specs.generated.js";
const NIGHT_WATCH_SIM = "apps/night-watch/backend/showdown_sim.mjs";
const SNAPSHOT_PATHS = ["src", "scripts", "tests", "prototypes/showdown", ".kiro/specs/duel-card-pipeline"];
const RECEIPT = "tests/helpers/boundary-properties/showdown/minimal-cases.json";
const RECEIPT_TOOL = "tests/helpers/boundary-properties/showdown/replay.mjs";
const PROPERTY_TESTS = ["tests/game/showdown-properties.test.js", "tests/game/showdown-fair-bot.test.js"];
const ADVISORY_TESTS = ["prototypes/showdown/rules.test.js"];
const FIELDS = ["attack", "health", "stars"];
const MAX_DEALS = 2000;
// Review thresholds, not game balance. They are recorded in every bundle so Fable/Alex can change them.
export const POLICY = Object.freeze({
  metric: "faction skew: |Cowboy share - 50%| in percentage points over all games",
  improveOn: ["tune", "holdout"],
  seatTolerancePp: 1,
});
export const SURFACE = Object.freeze({
  kind: "local-cli",
  kiroWeb: "not used; this bundle was produced by the local CLI and is not a Kiro Web run",
});

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
// Stable JSON (sorted keys) so a hash does not depend on key order.
export const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
export const sealBundle = (bundle) => ({...bundle, bundleSha256: sha256(canonical({...bundle, bundleSha256: undefined}))});
export const bundleSealIntact = (bundle) => bundle.bundleSha256 === sha256(canonical({...bundle, bundleSha256: undefined}));

const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
// A Night Watch Showdown report (apps/night-watch/backend/balance.py) whose numbers add up.
// Returns a list of problems; empty means the report is usable as a finding.
export function findingProblems(report) {
  const problems = [];
  if (!report || typeof report !== "object") return ["finding is not a JSON object"];
  if (report.mode !== "showdown") problems.push(`mode is ${JSON.stringify(report.mode)}, not "showdown"`);
  if (!isCount(report.firstSeed)) problems.push("firstSeed is not a whole number");
  if (!Number.isSafeInteger(report.count) || report.count < 1 || report.count > MAX_DEALS) problems.push(`count must be 1 to ${MAX_DEALS} deals`);
  if (report.rules?.state !== "passed") problems.push("the finding's own rule tests did not pass");
  const side = report.candidate;
  if (!/^[0-9a-f]{40}$/.test(side?.commit ?? "")) problems.push("candidate.commit is not a full 40-character commit id");
  const c = side?.counts ?? {};
  for (const key of ["games", "cowboy", "wizard", "draw", "first", "second"]) if (!isCount(c[key])) problems.push(`candidate.counts.${key} is missing`);
  if (problems.length) return problems;
  if (c.games !== 2 * report.count) problems.push("games is not two per deal");
  if (c.cowboy + c.wizard + c.draw !== c.games) problems.push("cowboy + wizard + draw does not equal games");
  if (c.first + c.second + c.draw !== c.games) problems.push("first + second + draw does not equal games");
  return problems;
}

// Edits exactly one top-level number in a one-card JSON text, keeping its formatting.
export function changeField(text, field, from, to) {
  if (!FIELDS.includes(field)) throw new Error(`field must be one of ${FIELDS.join(", ")}`);
  if (!Number.isSafeInteger(to) || to === from) throw new Error("the new value must be a different whole number");
  const pattern = new RegExp(`("${field}"\\s*:\\s*)${from}(?=\\s*[,}])`, "g");
  const matches = text.match(pattern) ?? [];
  if (matches.length !== 1) throw new Error(`expected exactly one "${field}": ${from}, found ${matches.length}`);
  const out = text.replace(pattern, `$1${to}`);
  const before = JSON.parse(text);
  const after = JSON.parse(out);
  const changed = Object.keys({...before, ...after}).filter((key) => canonical(before[key]) !== canonical(after[key]));
  if (changed.length !== 1 || changed[0] !== field || after[field] !== to) throw new Error("the edit changed more than the one field");
  return out;
}

const pp = (n, games) => (100 * n) / games;
export const summarize = (games) => {
  const t = {games: games.length, cowboy: 0, wizard: 0, draw: 0, first: 0, second: 0};
  for (const g of games) {
    if (g.winner === null) t.draw += 1;
    else { t[g.winner] += 1; t[g.winner === g.first ? "first" : "second"] += 1; }
  }
  return {...t, cowboyShare: pp(t.cowboy, t.games), firstShare: pp(t.first, t.games),
    factionSkew: Math.abs(pp(t.cowboy, t.games) - 50), seatSkew: Math.abs(pp(t.first, t.games) - 50)};
};
// Per-game comparison of the same deal and first seat under baseline and candidate.
export function paired(base, cand) {
  if (base.length !== cand.length) throw new Error("paired runs have different lengths");
  const flips = {towardCowboy: 0, towardWizard: 0, other: 0, same: 0};
  const score = (w) => (w === "cowboy" ? 1 : w === "wizard" ? -1 : 0);
  base.forEach((b, i) => {
    const c = cand[i];
    if (b.seed !== c.seed || b.first !== c.first) throw new Error(`game ${i} is not paired`);
    const d = score(c.winner) - score(b.winner);
    flips[d > 0 ? "towardCowboy" : d < 0 ? "towardWizard" : b.winner === c.winner ? "same" : "other"] += 1;
  });
  return flips;
}

// The reviewer's decision from recorded evidence. Pure, so `verify` can recompute it.
export function decide({finding, properties, sets, policy = POLICY}) {
  const reasons = [];
  if (!finding.reproduced) reasons.push("the Night Watch finding did not reproduce from its commit and seeds");
  if (finding.holdsAtBase === false) reasons.push("the finding's counts no longer hold at the review base; rerun Night Watch on the base");
  if (!properties.baseline.passed) reasons.push("baseline property tests failed, so the gate is not meaningful");
  if (!properties.candidate.passed) reasons.push("candidate failed a property test or card-spec validation");
  for (const name of policy.improveOn) {
    const s = sets[name];
    if (!s) { reasons.push(`no ${name} results`); continue; }
    if (s.flips.same === s.baseline.games) reasons.push(`${name}: the change altered no game result`);
    else if (!(s.candidate.factionSkew < s.baseline.factionSkew)) {
      reasons.push(`${name}: faction skew ${s.baseline.factionSkew.toFixed(2)} -> ${s.candidate.factionSkew.toFixed(2)} pp did not improve`);
    }
    if (s.candidate.seatSkew > s.baseline.seatSkew + policy.seatTolerancePp) {
      reasons.push(`${name}: first-seat skew grew ${s.baseline.seatSkew.toFixed(2)} -> ${s.candidate.seatSkew.toFixed(2)} pp (tolerance ${policy.seatTolerancePp})`);
    }
  }
  return {verdict: reasons.length ? "rejected" : "accepted", reasons,
    meaning: reasons.length ? "Do not forward this candidate." : "Ready for Fable/Alex review. Not applied to any card; no merge."};
}

// ---- side effects below: git snapshots, child processes, files ----

const git = (...args) => {
  const r = spawnSync("git", args, {cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024});
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout;
};
const commitExists = (sha) => spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {cwd: ROOT}).status === 0;

function snapshot(commit) {
  const dir = mkdtempSync(join(tmpdir(), "night-review-"));
  const archive = spawnSync("git", ["archive", "--format=tar", commit, ...SNAPSHOT_PATHS], {cwd: ROOT, maxBuffer: 512 * 1024 * 1024});
  if (archive.status !== 0) throw new Error(`git archive ${commit}: ${archive.stderr}`);
  const tar = spawnSync("tar", ["-x", "-C", dir], {input: archive.stdout});
  if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`);
  return dir;
}
const node = (cwd, args) => spawnSync(process.execPath, args, {cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
const tail = (text) => text.trim().split("\n").slice(-12).join("\n");

function prepareCandidate(dir, proposal) {
  const file = join(dir, proposal.cardPath);
  writeFileSync(file, changeField(readFileSync(file, "utf8"), proposal.field, proposal.from, proposal.to));
  const sync = node(dir, ["scripts/sync-card-specs.mjs"]);
  if (sync.status !== 0) return {ok: false, output: tail(sync.stdout + sync.stderr)};
  // The planted-fault receipt is derived from generated play, so a stat change can move it.
  // Regenerate it in the snapshot (as a real change would have to) and record whether it moved.
  const before = fileHash(dir, RECEIPT);
  const receipt = node(dir, [RECEIPT_TOOL, "--write-minimal"]);
  if (receipt.status !== 0) return {ok: false, output: tail(receipt.stdout + receipt.stderr)};
  return {ok: true, derived: [GENERATED, ...(fileHash(dir, RECEIPT) === before ? [] : [RECEIPT])]};
}

async function buildHash(dir) {
  const {build} = await import("esbuild");
  const out = await build({entryPoints: [join(dir, "src/game/showdown/rules.js")], bundle: true, write: false,
    format: "esm", platform: "neutral", logLevel: "silent", absWorkingDir: dir});
  return sha256(out.outputFiles[0].contents);
}
const fileHash = (dir, path) => sha256(readFileSync(join(dir, path)));
async function sourceHashes(dir) {
  return {card: null, generated: fileHash(dir, GENERATED), rules: fileHash(dir, "src/game/showdown/rules.js"),
    cards: fileHash(dir, "src/game/showdown/cards.js"), propertyReceipt: fileHash(dir, RECEIPT), engineBundle: await buildHash(dir)};
}

function testRun(dir, files) {
  const r = node(dir, ["--test", ...files]);
  const count = (label) => Number((r.stdout.match(new RegExp(`^(?:#|ℹ) ${label} (\\d+)`, "m")) ?? [])[1] ?? 0);
  const missing = files.filter((file) => !existsSync(join(dir, file)));
  return {passed: r.status === 0 && missing.length === 0 && count("tests") > 0 && count("fail") === 0, missing, tests: count("tests"), pass: count("pass"), fail: count("fail"), files,
    ...(r.status === 0 ? {} : {failed: [...new Set([...r.stdout.matchAll(/^\s*✖ (.+?) \(\d/gm)].map((m) => m[1]))].slice(0, 20)})};
}

// Plays each deal twice (each faction first) with the snapshot's own level-2 bot, recording every game.
const PLAY = `
const [snapshot, from, deals] = process.argv.slice(1);
const {createShowdown, playTurn} = await import(new URL("prototypes/showdown/rules.js", "file://" + snapshot + "/").href);
const games = [];
for (let seed = Number(from); seed < Number(from) + Number(deals); seed++) for (const first of ["cowboy", "wizard"]) {
  let state = createShowdown(seed, {first});
  while (!state.result) state = playTurn(state).state;
  games.push({seed, first, winner: state.result.winner, reason: state.result.reason, turns: state.turn});
}
process.stdout.write(JSON.stringify(games));`;
function play(dir, from, deals) {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", PLAY, dir, String(from), String(deals)], {encoding: "utf8", maxBuffer: 256 * 1024 * 1024});
  if (r.status !== 0) throw new Error(`simulation failed: ${tail(r.stderr)}`);
  return JSON.parse(r.stdout);
}

// Re-runs the finding with Night Watch's own runner at the finding's commit and compares every count.
function reproduce(dir, report) {
  const out = join(dir, ".night-watch-repro.json");
  const r = spawnSync(process.execPath, [join(ROOT, NIGHT_WATCH_SIM), dir, String(report.firstSeed), String(report.count), out], {encoding: "utf8"});
  if (r.status !== 0) return {reproduced: false, error: tail(r.stderr)};
  const got = JSON.parse(readFileSync(out, "utf8"));
  const keys = ["games", "cowboy", "wizard", "draw", "first", "second"];
  const mismatched = keys.filter((key) => got[key] !== report.candidate.counts[key]);
  return {reproduced: mismatched.length === 0, runner: NIGHT_WATCH_SIM, observed: Object.fromEntries(keys.map((k) => [k, got[k]])), mismatched};
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
class InputError extends Error {}

function loadFinding(file, id) {
  if (!file || !existsSync(file)) throw new InputError(`finding file not found: ${file}`);
  const raw = readFileSync(file);
  let data;
  try { data = JSON.parse(raw); } catch { throw new InputError("finding file is not valid JSON"); }
  const reports = (Array.isArray(data) ? data : [data]).filter((r) => r?.mode === "showdown" && (!id || r.id === id));
  if (reports.length !== 1) throw new InputError(id ? `no Showdown report with id ${id}` : `expected one Showdown report, found ${reports.length}; pass --report <id>`);
  const report = reports[0];
  const problems = findingProblems(report);
  if (problems.length) throw new InputError(`finding rejected: ${problems.join("; ")}`);
  if (!commitExists(report.candidate.commit)) throw new InputError(`finding commit ${report.candidate.commit} is not in this repository`);
  return {report, file: relative(ROOT, resolve(file)), sha256: sha256(raw)};
}

async function draft(opts) {
  const finding = loadFinding(opts.finding, opts.report);
  const card = opts.card ?? "";
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(card)) throw new InputError("card must be a card key such as cowboy-sheriff");
  const field = opts.field;
  if (!FIELDS.includes(field)) throw new InputError(`field must be one of ${FIELDS.join(", ")}`);
  const to = Number(opts.to);
  if (!Number.isSafeInteger(to)) throw new InputError("--to must be a whole number");
  const base = opts.base ? git("rev-parse", "--verify", `${opts.base}^{commit}`).trim() : git("rev-parse", "HEAD").trim();
  const cardPath = `${CARD_DIR}/${card}.json`;
  const dir = snapshot(base);
  try {
    if (!existsSync(join(dir, cardPath))) throw new InputError(`${cardPath} does not exist at ${base}`);
    const text = readFileSync(join(dir, cardPath), "utf8");
    const spec = JSON.parse(text);
    if (spec.kind !== "troop" || !Number.isSafeInteger(spec[field])) throw new InputError(`${card} has no numeric ${field}`);
    const {DECKS} = await import(pathToFileURL(join(dir, "src/game/showdown/cards.js")).href);
    if (!DECKS[spec.side]?.[card]) throw new InputError(`${card} is not in the Showdown ${spec.side} deck, so the even match cannot measure it`);
    let after;
    try { after = changeField(text, field, spec[field], to); } catch (error) { throw new InputError(error.message); }
    const id = `${card}-${field}-${spec[field]}-to-${to}-${base.slice(0, 8)}-f${finding.sha256.slice(0, 6)}`;
    const out = resolve(opts.out ?? join(ROOT, ".artifacts/night-review", id));
    mkdirSync(out, {recursive: true});
    const patch = `--- a/${cardPath}\n+++ b/${cardPath}\n@@ -1 +1 @@\n-${text.trimEnd()}\n+${after.trimEnd()}\n`;
    writeFileSync(join(out, "candidate.patch"), patch);
    const proposal = {schema: "night-review/proposal@1", id, status: "draft", surface: SURFACE,
      finding: {file: finding.file, sha256: finding.sha256, reportId: finding.report.id, commit: finding.report.candidate.commit,
        firstSeed: finding.report.firstSeed, count: finding.report.count, counts: finding.report.candidate.counts},
      base, cardPath, card, side: spec.side, field, from: spec[field], to,
      cardSha256: {before: sha256(text), after: sha256(after)}, patchSha256: sha256(patch),
      note: "Draft only. Not applied to this checkout or any branch. Fable/Alex decide."};
    writeJson(join(out, "proposal.json"), proposal);
    console.log(`draft ${id}: ${card} ${field} ${spec[field]} -> ${to} on ${base.slice(0, 12)}\n  ${relative(ROOT, out) || out}`);
    return out;
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

function holdoutFor(proposal, arg) {
  const [from, deals] = arg ? arg.split(":").map(Number) : [proposal.finding.firstSeed + proposal.finding.count, Math.min(proposal.finding.count, 1000)];
  if (!isCount(from) || !Number.isSafeInteger(deals) || deals < 1 || deals > MAX_DEALS) throw new InputError("--holdout must be <from>:<deals> with 1 to 2000 deals");
  const t0 = proposal.finding.firstSeed, t1 = t0 + proposal.finding.count;
  if (from < t1 && from + deals > t0) throw new InputError("holdout seeds overlap the finding's seeds");
  return {from, deals};
}

async function review(opts) {
  const out = resolve(opts.bundle);
  const proposal = readJson(join(out, "proposal.json"));
  const findingFile = join(ROOT, proposal.finding.file);
  if (!existsSync(findingFile) || sha256(readFileSync(findingFile)) !== proposal.finding.sha256) throw new InputError("the finding file is missing or changed since the draft");
  const {report} = loadFinding(findingFile, proposal.finding.reportId);
  if (sha256(readFileSync(join(out, "candidate.patch"))) !== proposal.patchSha256) throw new InputError("candidate.patch changed since the draft");
  const holdout = holdoutFor(proposal, opts.holdout);
  const tune = {from: proposal.finding.firstSeed, deals: proposal.finding.count};
  const baseDir = snapshot(proposal.base);
  const candDir = snapshot(proposal.base);
  try {
    if (fileHash(baseDir, proposal.cardPath) !== proposal.cardSha256.before) throw new InputError("the card at the base commit differs from the draft");
    console.log(`review ${proposal.id}`);
    const findingDir = proposal.finding.commit === proposal.base ? baseDir : snapshot(proposal.finding.commit);
    const finding = reproduce(findingDir, report);
    if (findingDir !== baseDir) rmSync(findingDir, {recursive: true, force: true});
    finding.commit = proposal.finding.commit;
    console.log(`  finding reproduced at ${finding.commit.slice(0, 12)}: ${finding.reproduced}${finding.mismatched?.length ? ` (mismatched ${finding.mismatched.join(", ")})` : ""}`);
    const prepared = prepareCandidate(candDir, proposal);
    const properties = {baseline: testRun(baseDir, PROPERTY_TESTS),
      candidate: prepared.ok ? {...testRun(candDir, PROPERTY_TESTS), derived: prepared.derived} : {passed: false, files: PROPERTY_TESTS, output: prepared.output, specSync: "failed"}};
    console.log(`  properties: baseline ${properties.baseline.pass}/${properties.baseline.tests}, candidate ${properties.candidate.pass ?? 0}/${properties.candidate.tests ?? 0}${prepared.ok ? "" : " (spec validation failed)"}`);
    // Advisory: the rules suite also compares generated docs (ART-DIRECTION.md, cards.csv) that print card numbers.
    const advisory = prepared.ok ? {...testRun(candDir, ADVISORY_TESTS), counted: false} : null;
    const sets = {};
    const results = {};
    if (prepared.ok) {
      for (const [name, range] of Object.entries({tune, holdout})) {
        const b = play(baseDir, range.from, range.deals);
        const c = play(candDir, range.from, range.deals);
        results[name] = {baseline: b, candidate: c};
        sets[name] = {seeds: {from: range.from, to: range.from + range.deals - 1, deals: range.deals},
          baseline: summarize(b), candidate: summarize(c), flips: paired(b, c)};
        const s = sets[name];
        if (name === "tune") {
          const keys = ["games", "cowboy", "wizard", "draw", "first", "second"];
          finding.holdsAtBase = keys.every((key) => s.baseline[key] === report.candidate.counts[key]);
        }
        console.log(`  ${name} ${s.seeds.from}-${s.seeds.to}: Cowboy ${s.baseline.cowboyShare.toFixed(2)}% -> ${s.candidate.cowboyShare.toFixed(2)}%, first seat ${s.baseline.firstShare.toFixed(2)}% -> ${s.candidate.firstShare.toFixed(2)}%`);
      }
    }
    const decision = decide({finding, properties, sets});
    const resultHashes = {};
    for (const [name, pair] of Object.entries(results)) for (const [which, games] of Object.entries(pair)) {
      const file = `games-${name}-${which}.json`;
      const text = JSON.stringify(games) + "\n";
      writeFileSync(join(out, file), text);
      resultHashes[file] = sha256(text);
    }
    const bundle = sealBundle({
      schema: "night-review/bundle@1", id: proposal.id, createdAt: new Date().toISOString(), surface: SURFACE,
      tool: {commit: git("rev-parse", "HEAD").trim(), script: sha256(readFileSync(fileURLToPath(import.meta.url))),
        nightWatchRunner: sha256(readFileSync(join(ROOT, NIGHT_WATCH_SIM))), node: process.version},
      proposal: {sha256: sha256(canonical(proposal)), card: proposal.card, field: proposal.field, from: proposal.from, to: proposal.to, patchSha256: proposal.patchSha256},
      source: {commit: proposal.base, tree: git("rev-parse", `${proposal.base}^{tree}`).trim(),
        baseline: {...await sourceHashes(baseDir), card: proposal.cardSha256.before},
        candidate: prepared.ok ? {...await sourceHashes(candDir), card: fileHash(candDir, proposal.cardPath)} : null},
      finding: {...finding, file: proposal.finding.file, sha256: proposal.finding.sha256, reportId: report.id, seeds: tune},
      properties, advisory, sets, results: resultHashes, policy: POLICY, decision,
    });
    writeJson(join(out, "bundle.json"), bundle);
    console.log(`  verdict: ${decision.verdict}${decision.reasons.length ? `\n    - ${decision.reasons.join("\n    - ")}` : ""}\n  ${decision.meaning}`);
    return decision.verdict === "accepted";
  } finally {
    rmSync(baseDir, {recursive: true, force: true});
    rmSync(candDir, {recursive: true, force: true});
  }
}

async function verify(opts) {
  const out = resolve(opts.bundle);
  const problems = [];
  const bundle = readJson(join(out, "bundle.json"));
  const proposal = readJson(join(out, "proposal.json"));
  if (!bundleSealIntact(bundle)) problems.push("bundle seal does not match its contents");
  if (canonical(bundle.surface) !== canonical(SURFACE)) problems.push("bundle claims a surface other than the local CLI");
  if (bundle.proposal.sha256 !== sha256(canonical(proposal))) problems.push("proposal.json differs from the reviewed proposal");
  if (sha256(readFileSync(join(out, "candidate.patch"))) !== proposal.patchSha256) problems.push("candidate.patch changed");
  if (!commitExists(bundle.source.commit) || git("rev-parse", `${bundle.source.commit}^{tree}`).trim() !== bundle.source.tree) problems.push("source commit or tree does not match");
  const findingFile = join(ROOT, bundle.finding.file);
  let reconstructed;
  if (opts.finding) {
    reconstructed = loadFinding(opts.finding, bundle.finding.reportId).report;
    const original = proposal.finding;
    if (bundle.finding.reportId !== original.reportId || bundle.finding.sha256 !== original.sha256 ||
        reconstructed.candidate.commit !== original.commit || reconstructed.firstSeed !== original.firstSeed ||
        reconstructed.count !== original.count || canonical(reconstructed.candidate.counts) !== canonical(original.counts))
      problems.push("reconstructed finding differs from the sealed proposal's commit, seeds or counts");
  } else if (!existsSync(findingFile) || sha256(readFileSync(findingFile)) !== bundle.finding.sha256) {
    problems.push("finding file missing or changed; supply --finding only for a documented reconstruction");
  }
  for (const [file, hash] of Object.entries(bundle.results)) {
    if (!existsSync(join(out, file)) || sha256(readFileSync(join(out, file))) !== hash)
      problems.push(`${file} missing or changed`);
  }
  if (problems.length) {
    for (const problem of problems) console.error(`verify: ${problem}`);
    return false;
  }
  const sets = {};
  for (const name of Object.keys(bundle.sets)) {
    const b = readJson(join(out, `games-${name}-baseline.json`));
    const c = readJson(join(out, `games-${name}-candidate.json`));
    sets[name] = {...bundle.sets[name], baseline: summarize(b), candidate: summarize(c), flips: paired(b, c)};
    if (canonical(sets[name]) !== canonical(bundle.sets[name])) problems.push(`${name} summary does not match its game records`);
  }
  if (canonical(decide({finding: bundle.finding, properties: bundle.properties, sets, policy: bundle.policy})) !== canonical(bundle.decision)) problems.push("recorded decision does not follow from the evidence");
  const baseDir = snapshot(bundle.source.commit);
  const candDir = snapshot(bundle.source.commit);
  try {
    const base = {...await sourceHashes(baseDir), card: fileHash(baseDir, proposal.cardPath)};
    if (canonical(base) !== canonical(bundle.source.baseline)) problems.push("baseline source/build hashes differ");
    if (reconstructed && opts.rerun) {
      // The recorded finding normally comes from the same source as the candidate's baseline.
      const findingDir = reconstructed.candidate.commit === bundle.source.commit ? baseDir : snapshot(reconstructed.candidate.commit);
      try {
        if (!reproduce(findingDir, reconstructed).reproduced) problems.push("the reconstructed finding did not reproduce");
      } finally {
        if (findingDir !== baseDir) rmSync(findingDir, {recursive: true, force: true});
      }
    }
    if (bundle.source.candidate) {
      const prepared = prepareCandidate(candDir, proposal);
      const cand = prepared.ok ? {...await sourceHashes(candDir), card: fileHash(candDir, proposal.cardPath)} : null;
      if (canonical(cand) !== canonical(bundle.source.candidate)) problems.push("candidate source/build hashes differ");
      if (opts.rerun) for (const [name, s] of Object.entries(bundle.sets)) {
        for (const [which, dir] of [["baseline", baseDir], ["candidate", candDir]]) {
          const text = JSON.stringify(play(dir, s.seeds.from, s.seeds.deals)) + "\n";
          if (sha256(text) !== bundle.results[`games-${name}-${which}.json`]) problems.push(`rerun of ${name} ${which} gave different games`);
        }
      }
    }
  } finally {
    rmSync(baseDir, {recursive: true, force: true});
    rmSync(candDir, {recursive: true, force: true});
  }
  const toolCurrent = bundle.tool.script === sha256(readFileSync(fileURLToPath(import.meta.url)));
  console.log(`verify ${bundle.id}: ${problems.length ? "FAILED" : "ok"}${opts.rerun ? " (games replayed)" : ""}; recorded verdict ${bundle.decision.verdict}; tool script ${toolCurrent ? "matches" : "differs from"} the current file`);
  if (reconstructed) console.log("Finding: reconstructed report checked against the sealed proposal.");
  for (const p of problems) console.log(`  - ${p}`);
  return problems.length === 0;
}

function parse(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const m = /^--([a-z]+)$/.exec(rest[i]);
    if (!m) throw new InputError(`unexpected argument ${rest[i]}`);
    if (m[1] === "rerun") opts.rerun = true;
    else opts[m[1]] = rest[++i];
  }
  return {command, opts};
}

async function main(argv) {
  const {command, opts} = parse(argv);
  if (command === "draft") return (await draft(opts), 0);
  if (command === "review") return (await review(opts)) ? 0 : 1;
  if (command === "verify") return (await verify(opts)) ? 0 : 1;
  if (command === "check") {
    const finding = loadFinding(opts.finding, opts.report);
    const dir = snapshot(finding.report.candidate.commit);
    try {
      const result = reproduce(dir, finding.report);
      process.stdout.write(JSON.stringify({check: "reproduce", finding: finding.sha256, commit: finding.report.candidate.commit,
        seeds: [finding.report.firstSeed, finding.report.firstSeed + finding.report.count - 1], ...result, surface: SURFACE.kind}) + "\n");
      return result.reproduced ? 0 : 1;
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }
  if (command === "run") {
    const out = await draft(opts);
    const accepted = await review({bundle: out, holdout: opts.holdout});
    return (await verify({bundle: out})) ? (accepted ? 0 : 1) : 1;
  }
  throw new InputError("usage: night-review.mjs draft|review|verify|run|check (see the header of scripts/night-review.mjs)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    console.error(`night-review: ${error.message}`);
    process.exit(error instanceof InputError ? 2 : 1);
  });
}
