// Historical defect runner for the Showdown referee.
//
// Three jobs, kept apart so the referee stays blind:
//   mine    lists Git fix commits that touched the Showdown engine or its rule tests, with their
//           parent and changed paths. It proposes candidates only; a person or agent must still
//           write a blind input and a sealed answer before a candidate counts.
//   verify  checks that every revision named in the sealed answers exists in this clone, and
//           reports a missing one (for example in a shallow checkout) as a failure, never a skip.
//   run     hands each blind input, and nothing else, to the frozen Python referee; replays the
//           same input on the parent and fix engines through the engine adapter; then, only after
//           all three outputs exist, opens the sealed answers and judges each case.
//
// Usage:
//   node scripts/referee/history.mjs mine   [--repo .]
//   node scripts/referee/history.mjs seal   [--manifest proof/history/manifest.json] [--pin-referee proof/referee/referee.py]
//                                           --pin-referee first checks the referee tree against proof/referee/freeze.json
//   node scripts/referee/history.mjs verify [--manifest proof/history/manifest.json]
//   node scripts/referee/history.mjs pinned --freeze-key <key>   what prove.mjs would count
//   node scripts/referee/history.mjs run    --referee proof/referee/referee.py --adapter scripts/referee/history-adapter.mjs
//                                           [--manifest …] [--out report.json]
//                                           [--freeze-key <key>]   also writes proof/history/receipts/run-<key>.json once
//
// Integration points (owned elsewhere): the Python referee and its normalized output schema. The
// referee gets each blind duel as one NDJSON line on `referee.py --stream` and answers with one line.
// The engine side must export runDuel(engineRoot, duel) and load the engine from engineRoot, the
// archived revision; scripts/referee/history-adapter.mjs does that. The pinned adapter.mjs imports the
// current engine, so `run` refuses it rather than replay today's rules under a past commit id.
// This file reads outputs only by JSON pointer, so it does not depend on the schema's field names.
import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, relative, resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {hashTree, oracleSkip} from "./prove.mjs";

export const SIDES = ["cowboy", "wizard"];
export const INSTANCE_ID = /^[a-z]+(?:-[a-z]+)*-\d+$/;
export const REVISION = /^[0-9a-f]{7,40}$/;

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Paths that decide a single Showdown duel, and the rule tests that state expected outcomes.
// Before f44af67 the engine lived in prototypes/showdown/, so both locations are mined.
export const ENGINE_PATHS = ["src/game/showdown/rules.js", "src/game/showdown/cards.js", "src/game/card-specs.generated.js",
  ".kiro/specs/duel-card-pipeline/cards/", "prototypes/showdown/rules.js", "prototypes/showdown/cards.js"];
// Trees extracted for an engine run; a revision keeps whichever of them it has.
export const ENGINE_ROOTS = ["src/game", "prototypes/showdown"];
export const RULE_TEST_PATHS = ["prototypes/showdown/rules.test.js", "prototypes/showdown/contract.test.js",
  "tests/game/showdown-properties.test.js", "tests/game/dec4-showdown-properties.test.js", "tests/game/showdown-fast-check.test.js"];
// Out of scope for reference findings: presentation, progression, bosses, the retired lane duel.
export const EXCLUDED_PATHS = ["src/game/showdown/presenter.js", "src/game/showdown/progress.js", "src/game/showdown/trail.js",
  "src/game/showdown/campaign-store.js", "src/game/showdown/savecode.js", "src/ui/", "src/match/", "src/main.js", "src/render/"];

const under = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(prefix));

// What kind of candidate a fix commit is, from the paths it changed. Not a verdict.
export function classifyPaths(paths) {
  const engine = paths.filter((p) => under(p, ENGINE_PATHS));
  const tests = paths.filter((p) => under(p, RULE_TEST_PATHS));
  if (engine.length) return {kind: "engine-defect-candidate", engine, tests};
  if (tests.length) return {kind: "test-expectation-candidate", engine, tests};
  if (paths.some((p) => under(p, EXCLUDED_PATHS))) return {kind: "excluded-out-of-scope", engine, tests};
  return {kind: "excluded-unrelated", engine, tests};
}

// --- Blind input contract -------------------------------------------------------------------

const ACTION_FIELDS = {
  summon: {cardId: "id", tributes: "slots"},
  spell: {cardId: "id", target: "slot?"},
  gear: {cardId: "id", slot: "slot"},
  location: {cardId: "id"},
  set: {cardId: "id"},
  attack: {slot: "slot", target: "target"},
  cover: {slot: "slot"},
  end: {},
};
const isSlot = (v) => Number.isInteger(v) && v >= 0;
const FIELD_CHECKS = {
  id: (v) => typeof v === "string" && INSTANCE_ID.test(v),
  slot: isSlot,
  "slot?": (v) => v === undefined || isSlot(v),
  slots: (v) => Array.isArray(v) && v.every(isSlot) && new Set(v).size === v.length,
  target: (v) => v === "base" || isSlot(v),
};

// Returns a list of problems; an empty list means the input is a blind duel and nothing more.
// Anything that could carry engine state or an answer (expected, state, result, revision…) is refused.
export function blindInputProblems(input) {
  const problems = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["input is not an object"];
  const allowed = new Set(["seed", "first", "decks", "actions", "cardNames"]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) problems.push(`unexpected key ${key}`);
  if (!Number.isInteger(input.seed) || input.seed < 0) problems.push("seed must be a non-negative integer");
  if (!SIDES.includes(input.first)) problems.push("first must be cowboy or wizard");
  const decks = input.decks ?? {};
  if (Object.keys(decks).sort().join() !== "cowboy,wizard") problems.push("decks must have exactly cowboy and wizard");
  const seen = new Set();
  for (const side of SIDES) {
    if (!Array.isArray(decks[side])) { problems.push(`decks.${side} must be an array`); continue; }
    for (const id of decks[side]) {
      if (typeof id !== "string" || !INSTANCE_ID.test(id)) problems.push(`decks.${side} has bad instance id ${JSON.stringify(id)}`);
      else if (!id.startsWith(`${side}-`)) problems.push(`decks.${side} holds the other side's card ${id}`);
      if (seen.has(id)) problems.push(`instance id ${id} appears twice`);
      seen.add(id);
    }
  }
  if (input.cardNames !== undefined) {
    const names = input.cardNames;
    if (!names || typeof names !== "object" || Array.isArray(names)) problems.push("cardNames must be an object");
    else for (const [type, name] of Object.entries(names)) {
      if (INSTANCE_ID.test(type) || !/^[a-z]+(?:-[a-z]+)*$/.test(type)) problems.push(`cardNames key ${type} is not a catalog id`);
      if (typeof name !== "string" || !name) problems.push(`cardNames.${type} is not a printed name`);
    }
  }
  if (!Array.isArray(input.actions)) return [...problems, "actions must be an array"];
  input.actions.forEach((action, i) => {
    const fields = ACTION_FIELDS[action?.type];
    if (!fields) { problems.push(`actions[${i}] has unknown type ${JSON.stringify(action?.type)}`); return; }
    for (const key of Object.keys(action)) if (key !== "type" && !(key in fields)) problems.push(`actions[${i}] has unexpected field ${key}`);
    for (const [key, check] of Object.entries(fields)) {
      if (!FIELD_CHECKS[check](action[key])) problems.push(`actions[${i}].${key} is invalid`);
    }
  });
  return problems;
}

// --- Sealed held-out manifest ---------------------------------------------------------------

// The manifest names two files and their digests: inputs (blind duels by case id) and answers
// (category, commit pair, known fix, observable). The referee sees only inputs.
export function loadSealed(manifestPath, read = (p) => readFileSync(p, "utf8")) {
  const manifest = JSON.parse(read(manifestPath));
  const root = dirname(manifestPath);
  const open = (entry, label) => {
    if (!entry?.path || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? "")) throw new Error(`${label} are not sealed: run \`history.mjs seal\` once cases exist`);
    const text = read(join(root, entry.path));
    if (sha256(text) !== entry.sha256) throw new Error(`${label} seal broken: ${entry.path} does not match its sha256`);
    return JSON.parse(text);
  };
  const inputs = open(manifest.inputs, "inputs");
  // Answers are returned as a function so a caller cannot read them by accident before judging.
  return {manifest, inputs, openAnswers: () => open(manifest.answers, "answers")};
}

// The referee pin for a manifest: refuses unless the referee's directory still hashes (as prove.mjs
// hashes it) to the frozen treeSha256, then pins the entry file's own digest, which `run` checks.
export function frozenRefereePin(refereePath, freezePath, {tree = hashTree, read = (p) => readFileSync(p)} = {}) {
  const freeze = JSON.parse(read(freezePath).toString("utf8"));
  const expected = freeze.referee?.treeSha256;
  if (!/^[0-9a-f]{64}$/.test(expected ?? "")) throw new Error(`${freezePath} pins no referee treeSha256`);
  const actual = tree(dirname(resolve(refereePath)), oracleSkip);
  if (actual !== expected) throw new Error(`referee tree ${actual} is not the frozen ${expected}`);
  return {path: refereePath, sha256: createHash("sha256").update(read(refereePath)).digest("hex"), treeSha256: expected};
}

// Writes the two digests into the manifest. Refuses an empty or invalid set, so a seal always means
// at least one checked case. `referee` (from frozenRefereePin) also pins the referee.
export function seal(manifestPath, {read = (p) => readFileSync(p, "utf8"), write = writeFileSync, referee = null} = {}) {
  const manifest = JSON.parse(read(manifestPath));
  const root = dirname(manifestPath);
  const inputsText = read(join(root, manifest.inputs.path));
  const answersText = read(join(root, manifest.answers.path));
  const inputs = JSON.parse(inputsText);
  const answers = JSON.parse(answersText);
  if (!Object.keys(inputs.cases ?? {}).length) throw new Error("refusing to seal an empty held-out set");
  const problems = sealProblems(inputs, answers);
  if (problems.length) throw new Error(`refusing to seal:\n${problems.join("\n")}`);
  manifest.inputs.sha256 = sha256(inputsText);
  manifest.answers.sha256 = sha256(answersText);
  if (referee) manifest.referee = {...manifest.referee, ...referee};
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// Every input must be a blind duel, and no input may share a case id with nothing in answers
// (checked at judging) or carry a revision, fix or expectation.
export function sealProblems(inputs, answers) {
  const problems = [];
  const inputIds = Object.keys(inputs.cases ?? {});
  const answerIds = Object.keys(answers.cases ?? {});
  for (const id of inputIds) for (const p of blindInputProblems(inputs.cases[id])) problems.push(`${id}: ${p}`);
  for (const id of inputIds) if (!answerIds.includes(id)) problems.push(`${id}: input has no sealed answer`);
  for (const id of answerIds) if (!inputIds.includes(id)) problems.push(`${id}: answer has no blind input`);
  const seeds = inputIds.map((id) => inputs.cases[id].seed);
  if (new Set(seeds).size !== seeds.length) problems.push("held-out inputs reuse a seed");
  const deals = inputIds.map((id) => JSON.stringify(inputs.cases[id].decks));
  if (new Set(deals).size !== deals.length) problems.push("held-out inputs reuse a deal");
  for (const id of answerIds) {
    const a = answers.cases[id];
    if (!["engine-defect", "test-expectation"].includes(a.category)) problems.push(`${id}: category must be engine-defect or test-expectation`);
    if (!REVISION.test(a.parent ?? "") || !REVISION.test(a.fix ?? "")) problems.push(`${id}: parent and fix must be commit ids`);
    if (!a.knownFix?.paths?.length) problems.push(`${id}: knownFix.paths is required`);
    if (typeof a.observable?.pointer !== "string") problems.push(`${id}: observable.pointer is required`);
    if (!a.rule?.source) problems.push(`${id}: rule.source (the rule text that decides it) is required`);
    if (a.category === "test-expectation" && !("parentExpected" in a && "fixExpected" in a && a.test?.path)) {
      problems.push(`${id}: test-expectation needs test.path, parentExpected and fixExpected`);
    }
  }
  return problems;
}

// --- Git ------------------------------------------------------------------------------------

export const realGit = (repo) => (args) => execFileSync("git", ["-C", repo, ...args], {encoding: "utf8", maxBuffer: 64 << 20});

export function isShallow(git) {
  try { return git(["rev-parse", "--is-shallow-repository"]).trim() === "true"; } catch { return null; }
}

export function revisionExists(git, rev) {
  if (!REVISION.test(rev)) return false;
  try { git(["cat-file", "-e", `${rev}^{commit}`]); return true; } catch { return false; }
}

// Each named revision either exists or is reported missing. Nothing is silently skipped.
export function verifyRevisions(git, answers) {
  const shallow = isShallow(git);
  return Object.entries(answers.cases ?? {}).map(([id, a]) => {
    const missing = [a.parent, a.fix].filter((rev) => !revisionExists(git, rev));
    return missing.length ? {id, status: "revision-missing", missing, shallow} : {id, status: "present"};
  });
}

const FIX_WORDS = "fix|bug|wrong|repair|correct|regress|broke";

// Fix commits that touched duel rules or rule tests, newest first, with first parent and paths.
export function mine(git) {
  const shallow = isShallow(git);
  const log = git(["log", "--no-merges", "-i", "-E", `--grep=${FIX_WORDS}`, "--format=%H%x1f%P%x1f%s%x1e", "--",
    ...ENGINE_PATHS, ...RULE_TEST_PATHS]);
  const candidates = [];
  for (const record of log.split("\x1e").map((r) => r.trim()).filter(Boolean)) {
    const [fix, parents, subject] = record.split("\x1f");
    const parent = parents.split(" ")[0] || null;
    if (!parent) { candidates.push({fix, parent: null, subject, kind: "unsupported-root-commit"}); continue; }
    if (!revisionExists(git, parent)) { candidates.push({fix, parent, subject, kind: "parent-missing", shallow}); continue; }
    const paths = git(["diff", "--name-only", parent, fix]).split("\n").filter(Boolean);
    candidates.push({fix, parent, subject, paths, ...classifyPaths(paths)});
  }
  return {shallow, grep: FIX_WORDS, candidates};
}

// Extract one revision's engine trees (src/game and, for older revisions, prototypes/showdown)
// into a fresh temporary folder. The revision's package.json comes along so Node loads its .js files
// with that revision's own module type. Caller removes it.
export function materialize(repo, rev) {
  if (!REVISION.test(rev)) throw new Error(`not a commit id: ${rev}`);
  const has = (path) => {
    try { execFileSync("git", ["-C", repo, "cat-file", "-e", `${rev}:${path}`], {stdio: "ignore"}); return true; } catch { return false; }
  };
  const roots = ENGINE_ROOTS.filter(has);
  if (!roots.length) throw new Error(`${rev} has none of ${ENGINE_ROOTS.join(", ")}`);
  if (has("package.json")) roots.push("package.json");
  const dir = mkdtempSync(join(tmpdir(), `referee-history-${rev.slice(0, 12)}-`));
  const archive = execFileSync("git", ["-C", repo, "archive", "--format=tar", rev, ...roots], {maxBuffer: 256 << 20});
  execFileSync("tar", ["-x", "-C", dir], {input: archive});
  return dir;
}

// --- Referee and adapter --------------------------------------------------------------------

// The referee is frozen: its bytes must match the pinned digest before it sees any input.
export function checkFrozen(refereePath, pinned, read = (p) => readFileSync(p)) {
  if (!pinned || !/^[0-9a-f]{64}$/.test(pinned)) throw new Error("manifest.referee.sha256 is not pinned");
  const actual = createHash("sha256").update(read(refereePath)).digest("hex");
  if (actual !== pinned) throw new Error(`referee is not the frozen one: sha256 ${actual} != ${pinned}`);
}

// Runs the frozen referee's documented CLI, `referee.py --stream`, with the blind input as exactly
// one NDJSON line on stdin, in an empty temporary cwd, isolated (-I), and no other argument that
// could point it at the answers or the engine. Exactly one result line must come back.
export const REFEREE_ARGS = Object.freeze(["--stream"]);
export function runReferee(refereePath, input, spawn = spawnSync) {
  const cwd = mkdtempSync(join(tmpdir(), "referee-blind-"));
  try {
    const out = spawn("python3", ["-I", resolve(refereePath), ...REFEREE_ARGS], {cwd, input: `${JSON.stringify(input)}\n`, encoding: "utf8",
      env: {PATH: process.env.PATH ?? "", PYTHONDONTWRITEBYTECODE: "1"}, maxBuffer: 64 << 20});
    if (out.error) throw new Error(`referee did not start: ${out.error.message}`);
    if (out.status !== 0) throw new Error(`referee exited ${out.status}: ${String(out.stderr).slice(0, 500)}`);
    const lines = String(out.stdout).split("\n").filter((line) => line.trim());
    if (lines.length !== 1) throw new Error(`referee --stream returned ${lines.length} result lines for one duel`);
    return JSON.parse(lines[0]);
  } finally { rmSync(cwd, {recursive: true, force: true}); }
}

// The engine side must export runDuel(engineRoot, input) and replay on the engine in engineRoot.
// A module with only the pinned adapter's replay(duel) replays the current checkout's engine, which
// would put today's rules under a historical commit id; it is refused, never used as a fallback.
export async function runAdapter(adapterPath, engineRoot, input) {
  const adapter = await import(pathToFileURL(resolve(adapterPath)).href);
  if (typeof adapter.runDuel !== "function") {
    const why = typeof adapter.replay === "function"
      ? "exports only replay(duel), which runs the current engine, not the archived revision; use scripts/referee/history-adapter.mjs"
      : "does not export runDuel(engineRoot, input)";
    throw new Error(`${adapterPath} ${why}`);
  }
  return adapter.runDuel(engineRoot, structuredClone(input));
}

// RFC 6901 JSON pointer.
export function pointer(doc, path) {
  if (path === "") return doc;
  if (!path.startsWith("/")) throw new Error(`bad pointer ${path}`);
  return path.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((node, token) => (node === undefined || node === null ? undefined : node[token]), doc);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Judges one case after all outputs exist. `referee` is the frozen referee's output; `parent` and
// `fix` are the adapter's outputs for the two revisions (either may be an {error} record).
export function judge(answer, {referee, parent, fix}) {
  const at = (doc) => (doc && !doc.error ? pointer(doc, answer.observable.pointer) : undefined);
  const values = {referee: at(referee), parent: at(parent), fix: at(fix)};
  if (values.referee === undefined) return {verdict: "unsupported", reason: "referee output has no value at the observable pointer", values};
  if (answer.category === "engine-defect") {
    if (parent?.error || fix?.error) return {verdict: "not-run", reason: "an engine revision failed to run", values};
    // An archived engine that cannot express the observable (or never ran that step) is not a value.
    const absent = ["parent", "fix"].filter((side) => values[side] === undefined);
    if (absent.length) return {verdict: "unsupported", reason: `no value at the observable pointer on ${absent.join(" and ")}`, values};
    if (same(values.referee, values.fix) && !same(values.referee, values.parent)) return {verdict: "reproduced", values};
    if (same(values.referee, values.parent) && !same(values.referee, values.fix)) return {verdict: "referee-sides-with-parent", values};
    if (same(values.parent, values.fix)) return {verdict: "no-difference", reason: "parent and fix agree on this input", values};
    return {verdict: "referee-disagrees-with-both", values};
  }
  // test-expectation: the rules decide which expected value was right. Engine runs are reported, not required.
  const expected = {parent: answer.parentExpected, fix: answer.fixExpected};
  if (same(values.referee, expected.fix) && !same(values.referee, expected.parent)) return {verdict: "reproduced", values, expected};
  if (same(values.referee, expected.parent)) return {verdict: "referee-sides-with-old-expectation", values, expected};
  return {verdict: "referee-disagrees-with-both", values, expected};
}

export async function run({manifestPath, refereePath, adapterPath, repo}) {
  const {manifest, inputs, openAnswers} = loadSealed(manifestPath);
  checkFrozen(refereePath, manifest.referee?.sha256);
  const ids = Object.keys(inputs.cases ?? {});
  const leaks = ids.flatMap((id) => blindInputProblems(inputs.cases[id]).map((p) => `${id}: ${p}`));
  if (leaks.length) throw new Error(`inputs are not blind duels:\n${leaks.join("\n")}`);
  // 1. Referee: blind inputs only. Answers are still sealed here.
  const refereeOut = Object.fromEntries(ids.map((id) => [id, runReferee(refereePath, inputs.cases[id])]));
  // 2. Answers opened only now, to learn which revisions to replay.
  const answers = openAnswers();
  const problems = sealProblems(inputs, answers);
  if (problems.length) throw new Error(`sealed set is invalid:\n${problems.join("\n")}`);
  const git = realGit(repo);
  const presence = Object.fromEntries(verifyRevisions(git, answers).map((r) => [r.id, r]));
  const results = [];
  for (const id of ids) {
    const answer = answers.cases[id];
    if (presence[id].status !== "present") { results.push({id, verdict: "fail-revision-missing", ...presence[id]}); continue; }
    const outputs = {referee: refereeOut[id]};
    for (const side of ["parent", "fix"]) {
      const root = materialize(repo, answer[side]);
      try { outputs[side] = await runAdapter(adapterPath, root, inputs.cases[id]); }
      catch (error) { outputs[side] = {error: String(error.message ?? error)}; }
      finally { rmSync(root, {recursive: true, force: true}); }
    }
    const notes = (out) => (out?.error ? {error: out.error} : {engine: out?.engine?.path ?? null, unsupported: out?.unsupported ?? []});
    results.push({id, category: answer.category, ...judge(answer, outputs),
      runs: {referee: {unsupported: outputs.referee?.unsupported ?? []}, parent: {rev: answer.parent, ...notes(outputs.parent)},
        fix: {rev: answer.fix, ...notes(outputs.fix)}}});
  }
  return {manifest: manifest.id, cases: ids.length, results,
    seals: {inputs: manifest.inputs.sha256, answers: manifest.answers.sha256, referee: manifest.referee.sha256}};
}

// --- Pinned histories for scripts/referee/prove.mjs -----------------------------------------
//
// prove.mjs calls pinnedHistories({root, freezeKey, head, freeze}) and judges the result with
// evaluateHistory. Only a history receipt that matches every pin counts:
//   - the held-out set is sealed (inputs and answers match their manifest digests),
//   - the receipt names this freeze key, this manifest and those two digests,
//   - the referee and adapter files on disk still have the digests the receipt recorded, and the
//     referee digest is the one the manifest pins,
//   - every sealed case is reported exactly once,
//   - each case's parent and fix are full 40-character commit ids present in this clone.
// Anything else yields zero counted defects, with the reason in `problems`. A receipt made for a
// different freeze key is returned under that key, so evaluateHistory reports it as stale.
// A case counts as caught only when its verdict is "reproduced", and only once per fix commit, so
// five caught cases mean five independent historical defects.

export const HISTORY_RECEIPT_SCHEMA = "referee-history-receipt/1";
export const HISTORY_RECEIPTS = "proof/history/receipts";
const FULL_REVISION = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const MISSED = new Set(["referee-sides-with-parent", "referee-sides-with-old-expectation", "referee-disagrees-with-both"]);

export const historyReceiptPath = (root, freezeKey) => join(root, HISTORY_RECEIPTS, `run-${freezeKey}.json`);

const fileDigest = (file) => {
  try { return createHash("sha256").update(readFileSync(file)).digest("hex"); } catch { return null; }
};

// The receipt `run --freeze-key` writes. Paths are relative to the repository root.
export function historyReceipt(report, {freezeKey, repo, refereePath, adapterPath}) {
  if (!freezeKey) throw new Error("a history receipt needs the freeze key from proof/referee/freeze.json");
  const pin = (file) => ({path: relative(repo, resolve(file)), sha256: fileDigest(file)});
  return {schema: HISTORY_RECEIPT_SCHEMA, freezeKey, manifest: report.manifest,
    inputsSha256: report.seals.inputs, answersSha256: report.seals.answers,
    referee: pin(refereePath), adapter: pin(adapterPath), cases: report.cases, results: report.results};
}

// Writes a receipt once; an existing receipt for the same freeze key is never replaced.
export function writeHistoryReceipt(root, receipt) {
  const file = historyReceiptPath(root, receipt.freezeKey);
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, {flag: "wx"});
  return file;
}

const verdictOf = (v) => (v === "reproduced" ? "caught" : MISSED.has(v) ? "missed" : "unknown");

export async function pinnedHistories(ctx = {}) {
  const root = resolve(ctx.root ?? ".");
  const freezeKey = ctx.freezeKey ?? null;
  const zero = (problem, key = freezeKey, evidence = null) => ({freezeKey: key, defects: [], verified: 0, problems: [problem], evidence});
  if (!freezeKey) return zero("no freeze key: history is judged only in a frozen full proof");

  const manifestPath = join(root, "proof/history/manifest.json");
  if (!existsSync(manifestPath)) return zero("proof/history/manifest.json is missing");
  let manifest, inputs, answers;
  try {
    const sealed = loadSealed(manifestPath);
    ({manifest, inputs} = sealed);
    answers = sealed.openAnswers();
  } catch (e) { return zero(`held-out set: ${e.message}`); }
  const caseIds = Object.keys(inputs.cases ?? {});
  if (!caseIds.length) return zero("held-out set has no cases");
  const setProblems = sealProblems(inputs, answers);
  if (setProblems.length) return zero(`held-out set is invalid: ${setProblems.join("; ")}`);

  const receiptPath = historyReceiptPath(root, freezeKey);
  const evidence = relative(root, receiptPath);
  if (!existsSync(receiptPath)) {
    const dir = join(root, HISTORY_RECEIPTS);
    const others = existsSync(dir) ? readdirSync(dir).filter((n) => /^run-.+\.json$/.test(n)).sort() : [];
    if (others.length) {
      const old = others.map((n) => n.slice(4, -5));
      return zero(`history receipts exist only for other freezes (${old.join(", ")}); rerun history for ${freezeKey}`, old[old.length - 1], join(HISTORY_RECEIPTS, others[others.length - 1]));
    }
    return zero(`no history receipt at ${evidence}: no historical case has been run against this freeze`, freezeKey, evidence);
  }
  let receipt;
  try { receipt = JSON.parse(readFileSync(receiptPath, "utf8")); } catch (e) { return zero(`${evidence} is not JSON: ${e.message}`, freezeKey, evidence); }
  if (receipt.schema !== HISTORY_RECEIPT_SCHEMA) return zero(`${evidence} has schema ${receipt.schema}, not ${HISTORY_RECEIPT_SCHEMA}`, freezeKey, evidence);
  if (receipt.freezeKey !== freezeKey) return zero(`${evidence} records freeze ${receipt.freezeKey}`, receipt.freezeKey ?? null, evidence);

  const stale = [];
  if (receipt.manifest !== manifest.id) stale.push(`receipt is for manifest ${receipt.manifest}, not ${manifest.id}`);
  if (receipt.inputsSha256 !== manifest.inputs.sha256) stale.push("sealed inputs changed since the receipt");
  if (receipt.answersSha256 !== manifest.answers.sha256) stale.push("sealed answers changed since the receipt");
  const refereePin = manifest.referee?.sha256;
  if (!DIGEST.test(refereePin ?? "")) stale.push("manifest.referee.sha256 is not pinned");
  else if (receipt.referee?.sha256 !== refereePin) stale.push("receipt referee digest differs from the manifest pin");
  for (const name of ["referee", "adapter"]) {
    const pin = receipt[name];
    if (typeof pin?.path !== "string" || !DIGEST.test(pin.sha256 ?? "")) { stale.push(`receipt does not pin the ${name}`); continue; }
    const now = fileDigest(join(root, pin.path));
    if (now !== pin.sha256) stale.push(`${pin.path} ${now ? "changed" : "is missing"} since the receipt`);
  }
  const results = Array.isArray(receipt.results) ? receipt.results : [];
  const reported = results.map((r) => r?.id);
  if (new Set(reported).size !== reported.length) stale.push("receipt reports a case twice");
  const unknownIds = reported.filter((id) => !caseIds.includes(id));
  if (unknownIds.length) stale.push(`receipt reports cases not in the sealed set: ${unknownIds.join(", ")}`);
  const unreported = caseIds.filter((id) => !reported.includes(id));
  if (unreported.length) stale.push(`receipt omits sealed cases: ${unreported.join(", ")}`);
  if (stale.length) return {freezeKey, defects: [], verified: 0, problems: stale, evidence};

  let presence;
  try { presence = Object.fromEntries(verifyRevisions(ctx.git ?? realGit(root), answers).map((r) => [r.id, r])); }
  catch { presence = {}; }
  const problems = [];
  const caughtFixes = new Set();
  const defects = results.map((r) => {
    const a = answers.cases[r.id];
    const defect = {id: r.id, commit: a.fix, parent: a.parent, area: a.category === "engine-defect" ? "engine" : "tests",
      verdict: verdictOf(r.verdict), recorded: r.verdict};
    if (!FULL_REVISION.test(a.fix) || !FULL_REVISION.test(a.parent)) {
      problems.push(`${r.id}: parent and fix must be full 40-character commit ids`);
      return {...defect, verdict: "unknown"};
    }
    if (presence[r.id]?.status !== "present") {
      problems.push(`${r.id}: ${presence[r.id]?.missing?.join(", ") ?? "revisions"} not in this clone`);
      return {...defect, verdict: "unknown"};
    }
    if (defect.verdict === "caught") {
      if (caughtFixes.has(a.fix)) {
        problems.push(`${r.id}: fix ${a.fix} is already counted; one fix commit is one independent defect`);
        return {...defect, verdict: "unknown"};
      }
      caughtFixes.add(a.fix);
    }
    return defect;
  });
  return {freezeKey, defects, verified: caughtFixes.size, problems, evidence};
}

// --- CLI ------------------------------------------------------------------------------------

function flag(argv, name, fallback) {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : fallback;
}

async function main(argv) {
  const [command] = argv;
  const repo = resolve(flag(argv, "repo", "."));
  const manifestPath = resolve(flag(argv, "manifest", "proof/history/manifest.json"));
  if (command === "mine") {
    process.stdout.write(`${JSON.stringify(mine(realGit(repo)), null, 2)}\n`);
  } else if (command === "seal") {
    const pin = flag(argv, "pin-referee");
    const referee = pin ? frozenRefereePin(pin, resolve(flag(argv, "freeze", "proof/referee/freeze.json"))) : null;
    const sealed = seal(manifestPath, {referee});
    process.stdout.write(`${JSON.stringify({inputs: sealed.inputs, answers: sealed.answers, referee: sealed.referee}, null, 2)}\n`);
  } else if (command === "verify") {
    const {inputs, openAnswers} = loadSealed(manifestPath);
    const answers = openAnswers();
    const report = {problems: sealProblems(inputs, answers), revisions: verifyRevisions(realGit(repo), answers)};
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    const cases = Object.keys(inputs.cases ?? {}).length;
    if (!cases) { process.stderr.write("held-out set has no cases: nothing is verified\n"); process.exitCode = 3; }
    if (report.problems.length || report.revisions.some((r) => r.status !== "present")) process.exitCode = 2;
  } else if (command === "run") {
    const refereePath = flag(argv, "referee");
    const adapterPath = flag(argv, "adapter");
    if (!refereePath || !adapterPath) throw new Error("run needs --referee <file.py> and --adapter <file.mjs>");
    const report = await run({manifestPath, refereePath, adapterPath, repo});
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    const out = flag(argv, "out");
    if (out) { mkdirSync(dirname(resolve(out)), {recursive: true}); writeFileSync(resolve(out), `${JSON.stringify(report, null, 2)}\n`); }
    const freezeKey = flag(argv, "freeze-key");
    if (freezeKey && report.cases) {
      const file = writeHistoryReceipt(repo, historyReceipt(report, {freezeKey, repo, refereePath, adapterPath}));
      process.stderr.write(`history receipt written: ${relative(repo, file)}\n`);
    }
    if (!report.cases) { process.stderr.write("held-out set has no cases: nothing was judged\n"); process.exitCode = 3; }
    else if (report.results.some((r) => r.verdict !== "reproduced")) process.exitCode = 2;
  } else if (command === "pinned") {
    const freezeKey = flag(argv, "freeze-key");
    const result = await pinnedHistories({root: repo, freezeKey});
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.verified < 5) process.exitCode = 2;
  } else {
    process.stderr.write("usage: history.mjs mine|seal|verify|pinned|run [--repo .] [--manifest …] [--freeze-key K] [--referee … --adapter …]\n");
    process.exitCode = 64;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
