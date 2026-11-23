// Showdown release gate for the Kiro hooks in .kiro/hooks/contest-gates.json and
// .kiro/hooks/contest-tasks-guard.json. Run from the project root:
//   node scripts/contest-release-gate.mjs fast [paths...]  fast-check properties G1-G4 (scripts/contest-gate-properties.mjs),
//                                                    bounded; with paths, only when one is Showdown rules or card data.
//                                                    The only mode that honours CONTEST_FC_* replay overrides; never stamps
//   node scripts/contest-release-gate.mjs release    all four properties at the fixed seed, then node scripts/verify-duel.mjs,
//                                                    then a small scripts/deck-balance.mjs sample; writes the validation stamp
//   node scripts/contest-release-gate.mjs pre-task   records the tree fingerprint at task start, reports the stamp
//   node scripts/contest-release-gate.mjs post-task  release checks when the tree differs from a passing stamp
//   node scripts/contest-release-gate.mjs stop       the same, with a retry budget so a failing tree cannot loop Stop
//   node scripts/contest-release-gate.mjs completion PreToolUse gate: refuses a success send_message without a fresh stamp
//   node scripts/contest-release-gate.mjs tasks-edit PreToolUse gate: refuses a file edit that introduces a [x] in
//                                                    .kiro/specs/**/tasks.md without a fresh stamp (runs no checks)
//   node scripts/contest-release-gate.mjs status     prints the stamp and whether it matches the tree
// Exit 0: pass or nothing to do. Exit 2: failed checks or a refused tool call; the concise reason is on
// stderr. Exit 1: usage error, missing dependency, or a failure already reported for this unchanged tree.
// Whether a given hook trigger acts on the exit code is up to the Kiro runtime; see
// docs/evidence/kiro-contest-gates.md. The stamp lives in .artifacts/kiro/contest-gates/ (generated, not committed).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const stampDir = `${root}.artifacts/kiro/contest-gates/`;
const STAMP = `${stampDir}stamp.json`;
const ATTEMPTS = `${stampDir}stop-attempts.json`;
const TASK_START = `${stampDir}task-start.json`;
const STOP_RETRIES = 2;
export const FAST_RUNS = 15;
export const RELEASE_RUNS = 60;
const LIMITS = { fastMs: 20_000, propertyMs: 60_000, verifyMs: 300_000, balanceMs: 120_000 };
// The existing deck-balance sample, cut to the starter and one other deck over four seeds (16 matches).
const BALANCE_ARGS = ["scripts/deck-balance.mjs", "--decks", "1", "--from", "0", "--count", "4"];
const RERUN = "Run: node scripts/contest-release-gate.mjs release";

// Inputs whose change invalidates the stamp: every source the verifier, its tests and the balance
// sample load, the lockfile, the GLBs the preflight reads, the gate itself, the Node version, and the
// Night Shift policy/decider and Billy seat-audit proof inputs the workflows rely on.
const WATCHED_DIRS = ["src", "tests", "prototypes/showdown", ".kiro/specs/duel-card-pipeline/cards"];
export const WATCHED_FILES = [
  "package.json", "package-lock.json",
  "scripts/verify-duel.mjs", "scripts/check-sourced-animation.mjs", "scripts/deck-balance.mjs", "scripts/play-match.mjs",
  "scripts/contest-release-gate.mjs", "scripts/contest-gate-properties.mjs",
  "assets/models/dragon.glb", "assets/models/mounted-billy.glb",
  "scripts/contest-balance.mjs", "scripts/showdown-balance-contract.mjs",
  ".kiro/specs/night-shift-balance-contract/requirements.md",
  "scripts/billy-balance-gate.mjs", "scripts/billy-seat-audit.mjs", "scripts/billy-replay-engine.mjs", "scripts/verify-billy-replay.mjs",
  "docs/evidence/billy-seat-audit/protocol.json", "docs/evidence/billy-seat-audit/result.json",
  "docs/evidence/billy-seat-audit/outcomes.csv.gz",
];
// Saves that trigger the fast properties.
const FAST_SCOPE = [/^src\/game\/showdown\//, /^\.kiro\/specs\/duel-card-pipeline\/cards\//, /^tests\/helpers\/boundary-properties\/showdown\//, /^scripts\/contest-gate-properties\.mjs$/];
const TASKS_FILE = /^\.kiro\/specs\/(?:[^/]+\/)*tasks\.md$/;

const say = (text) => process.stdout.write(`${text}\n`);
const warn = (text) => process.stderr.write(`${text}\n`);
const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };
const writeJson = (file, value) => { mkdirSync(stampDir, { recursive: true }); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); };

function fingerprint() {
  const hash = createHash("sha256");
  hash.update(`node ${process.version}\0`);
  const files = [...WATCHED_FILES];
  for (const dir of WATCHED_DIRS) {
    if (!existsSync(`${root}${dir}`)) continue;
    for (const entry of readdirSync(`${root}${dir}`, { recursive: true })) {
      const path = `${dir}/${String(entry).split(sep).join("/")}`;
      if (/(^|\/)(node_modules|dist|\.artifacts)\//.test(path)) continue;
      if (statSync(`${root}${path}`).isFile()) files.push(path);
    }
  }
  for (const path of [...new Set(files)].sort()) {
    hash.update(`${path}\0`);
    hash.update(existsSync(`${root}${path}`) ? readFileSync(`${root}${path}`) : "missing");
    hash.update("\0");
  }
  return hash.digest("hex");
}

// The hook event on stdin, when a runtime sends one (never read from a terminal).
function readStdin() {
  if (process.stdin.isTTY) return "";
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}
const parse = (raw) => { try { return raw.trim() ? JSON.parse(raw) : null; } catch { return null; } };

function pathsIn(value, out = []) {
  if (typeof value === "string" && /\.(m?js|json|md)$/.test(value)) out.push(value);
  else if (value && typeof value === "object") for (const item of Object.values(value)) pathsIn(item, out);
  return out;
}
const relPath = (path, cwd = root) => relative(root, resolve(cwd, path)).split(sep).join("/");
const inFastScope = (path) => FAST_SCOPE.some((pattern) => pattern.test(relPath(path)));

// Child checks never see replay overrides: verify-duel runs tests/game/showdown-fast-check.test.js,
// which would otherwise pick up CONTEST_FC_SEED/PATH/RUNS and pass a filtered run.
export const childEnv = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith("CONTEST_FC_")));

// What the properties run with. Only "fast" (manual replay, never stamped) reads CONTEST_FC_*;
// every stamping path runs all four properties at the fixed seed and run count.
export function propertyPlan(mode, env, props) {
  const all = props.PROPERTIES.map(({ id }) => id);
  if (mode === "fast") {
    return {
      ...props.paramsFromEnv(env, { numRuns: FAST_RUNS }),
      ids: env.CONTEST_FC_PROPERTY ? env.CONTEST_FC_PROPERTY.split(",") : all,
      timeLimitMs: LIMITS.fastMs,
    };
  }
  return { seed: props.FC_SEED, numRuns: RELEASE_RUNS, ids: all, timeLimitMs: LIMITS.propertyMs };
}

async function loadProperties() {
  try { return await import("./contest-gate-properties.mjs"); } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && /fast-check/.test(error.message)) {
      warn('contest gate: missing devDependency "fast-check" (coordinator: add it to package.json devDependencies and install).');
      process.exit(1);
    }
    throw error;
  }
}

// G1-G4 under fast-check. Returns a list of concise failure texts (empty when all pass).
async function propertyFailures(mode) {
  const props = await loadProperties();
  const plan = propertyPlan(mode, process.env, props);
  const failures = [];
  for (const result of props.runProperties(plan)) {
    const { property, details } = result;
    if (details.failed) failures.push(props.formatFailure(result));
    else if (details.interrupted) failures.push(`${property.id} INTERRUPTED after ${details.numRuns} of ${plan.numRuns} runs (limit ${plan.timeLimitMs} ms); not a pass`);
    else if (mode !== "fast" && details.numRuns !== plan.numRuns) failures.push(`${property.id} ran ${details.numRuns} of ${plan.numRuns} runs; not a pass`);
    else say(`${property.id} passed ${details.numRuns} runs (seed ${details.seed})`);
  }
  if (mode !== "fast" && failures.length === 0) {
    const ran = props.PROPERTIES.map(({ id }) => id).filter((id) => plan.ids.includes(id));
    if (ran.length !== props.PROPERTIES.length) failures.push(`only ${ran.join(",")} ran; a release run needs every property`);
  }
  return { failures, plan };
}

function runCheck(label, args, timeout) {
  say(`$ node ${args.join(" ")}`);
  const run = spawnSync(process.execPath, args, { cwd: root, env: childEnv(process.env), encoding: "utf8", timeout, maxBuffer: 64 << 20 });
  if (run.status === 0) return null;
  const tail = `${run.stdout ?? ""}${run.stderr ?? ""}`.split("\n").filter((line) => /not ok|fail|error|assert|Violation|expected|actual/i.test(line)).slice(-12);
  const why = run.error?.code === "ETIMEDOUT" ? `timed out after ${timeout} ms` : `exit ${run.status ?? run.signal}`;
  return [`${label} FAILED (${why})`, ...tail.map((line) => `  ${line.trim().slice(0, 240)}`)].join("\n");
}

// The release checks; writes the stamp for the fingerprint taken before they ran.
async function release(trigger) {
  const print = fingerprint();
  const { failures, plan } = await propertyFailures("release");
  // Stop at the first failing stage so the report stays short.
  if (!failures.length) {
    const verify = runCheck("verify-duel", ["scripts/verify-duel.mjs"], LIMITS.verifyMs);
    if (verify) failures.push(verify);
  }
  if (!failures.length) {
    const balance = runCheck("deck-balance sample", BALANCE_ARGS, LIMITS.balanceMs);
    if (balance) failures.push(balance);
  }
  if (failures.length === 0 && print !== fingerprint()) failures.push("the tree changed while the checks ran; run the gate again");
  const ok = failures.length === 0;
  writeJson(STAMP, {
    fingerprint: print, ok, trigger,
    checks: [`fast-check ${plan.ids.join(",")} seed ${plan.seed} x${plan.numRuns}`, "scripts/verify-duel.mjs", BALANCE_ARGS.join(" ")],
    failures, at: new Date().toISOString(),
  });
  return failures;
}

const stampState = () => {
  const stamp = readJson(STAMP);
  const current = fingerprint();
  return { stamp, current, fresh: Boolean(stamp?.ok && stamp.fingerprint === current) };
};
const stampProblem = (stamp) => !stamp ? "no stamp" : stamp.ok ? "the stamp is stale for this tree" : `the last release run failed:\n${stamp.failures.join("\n")}`;

// ---------------------------------------------------------------- tasks.md completion guard
// A task line: "- [ ] text", "- [x] text", or a status/progress marker such as "- [-]" or "- [~]".
const ITEM = /^\s*[-*+]\s+\[([^\]])\]\s+(.*?)\s*$/;
function itemsOf(text) {
  const checked = [];
  const open = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = ITEM.exec(line);
    if (!match) continue;
    const label = match[2].replace(/\s+/g, " ");
    if (match[1] === "x" || match[1] === "X") checked.push(label);
    else open.add(label);
  }
  return { checked, open };
}

// True when `after` marks more items done than `before`, or marks done an item that `before` left open.
// Rewording an already-done item, notes and status markers are not completion.
export function introducesCompletion(before, after) {
  const a = itemsOf(before);
  const b = itemsOf(after);
  return b.checked.length > a.checked.length || b.checked.some((label) => a.open.has(label));
}

const text = (value) => (typeof value === "string" ? value : undefined);
const pathOf = (input) => text(input?.path ?? input?.file_path ?? input?.filePath);

// Every index where `needle` occurs in `haystack`, overlapping matches included.
function occurrences(haystack, needle) {
  const found = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) found.push(at);
  return found;
}

// The edit a file-writing tool call would make on the whole file: {path, before, after} or
// {path, before, afters} (every plausible result, when the tool's exact join is not known), or
// {path, error}, or null when the input names no path. `read(path)` returns the current file text or
// null and is called only after the caller has decided the path is covered. Shapes: this session's
// fs_write {path, text} and str_replace {path, oldStr, newStr}; Kiro CLI fs_write {command:
// create|str_replace|append|insert, path, file_text|old_str|new_str|insert_line}; IDE-style
// fsWrite/fsAppend/strReplace {path, text|content|oldStr|newStr}.
export function editOf(tool, input, read) {
  const path = pathOf(input);
  if (!path) return null;
  const command = text(input.command);
  const name = String(tool ?? "");
  if (command === "str_replace" || /^(str_replace|strReplace)$/.test(name)) {
    const oldText = text(input.old_str ?? input.oldStr);
    const newText = text(input.new_str ?? input.newStr);
    if (oldText === undefined || newText === undefined) return { path, error: "str_replace without old and new text" };
    if (oldText === "") return { path, error: "str_replace with empty old text" };
    const before = read(path);
    if (before === null || before === undefined) return { path, error: "str_replace on an unreadable file" };
    const at = occurrences(before, oldText);
    if (at.length !== 1) return { path, error: `str_replace old text occurs ${at.length} times, not exactly once` };
    // Literal splice (String.replace would interpret $ patterns in newText).
    return { path, before, after: before.slice(0, at[0]) + newText + before.slice(at[0] + oldText.length) };
  }
  if (command === "insert") {
    const added = text(input.new_str ?? input.text ?? input.content);
    const line = input.insert_line ?? input.insertLine;
    if (added === undefined) return { path, error: "insert without text" };
    if (!Number.isInteger(line) || line < 0) return { path, error: "insert without a valid insert_line" };
    const before = read(path);
    if (before === null || before === undefined) return { path, error: "insert into an unreadable file" };
    const lines = before.split("\n");
    if (line > lines.length) return { path, error: `insert_line ${line} is past the end of the file` };
    // Inserted after line `line`. Whether the tool adds a newline after the text is not pinned
    // down here, so both joins are checked and either one introducing a [x] counts.
    const head = lines.slice(0, line).join("\n");
    const tail = lines.slice(line).join("\n");
    const lead = line > 0 ? `${head}\n` : "";
    return { path, before, afters: [`${lead}${added}\n${tail}`, `${lead}${added}${tail}`] };
  }
  if (command === "append" || /^(fs_append|fsAppend|append)$/.test(name)) {
    const added = text(input.new_str ?? input.text ?? input.content);
    if (added === undefined) return { path, error: "append without text" };
    const before = read(path);
    if (before === null || before === undefined) return { path, error: "append to an unreadable file" };
    // Appending to a file whose last line is unfinished could join onto that line, depending on
    // whether the tool inserts a newline first; check both results.
    if (before === "" || before.endsWith("\n")) return { path, before, after: before + added };
    return { path, before, afters: [`${before}\n${added}`, before + added] };
  }
  if (command === "create" || (command === undefined && /^(fs_write|fsWrite|write)$/.test(name))) {
    const after = text(input.file_text ?? input.text ?? input.content);
    return after === undefined ? { path, error: "write without file text" } : { path, before: read(path) ?? "", after };
  }
  return { path, error: `unrecognised edit ${name}${command ? ` ${command}` : ""}` };
}

// {allow, reason}. `fresh` is a function so the fingerprint is only taken for a covered completion.
export function guardFileEdit({ raw = "", event, fresh, read = () => null, cwd = root }) {
  const refuse = (why) => ({ allow: false, reason: `contest gate: refused edit: ${why}. ${RERUN}, then retry the edit.` });
  const mentionsTasks = /tasks\.md/.test(raw);
  if (!event || typeof event !== "object") {
    return mentionsTasks && !fresh() ? refuse("unparseable hook payload naming tasks.md (fail closed)") : { allow: true, reason: "no covered edit" };
  }
  const tool = event.tool_name ?? event.toolName ?? event.tool;
  const input = event.tool_input ?? event.toolInput ?? event.input ?? {};
  const base = event.cwd ?? cwd;
  const path = pathOf(input);
  if (!path) return mentionsTasks && !fresh() ? refuse("edit payload naming tasks.md without a readable path (fail closed)") : { allow: true, reason: "no path" };
  // Scope first, so an ordinary write never reads any file.
  const rel = relative(base, resolve(base, path)).split(sep).join("/");
  if (!TASKS_FILE.test(rel)) return { allow: true, reason: `${rel} is not a spec tasks.md` };
  const edit = editOf(tool, input, (file) => read(resolve(base, file)));
  if (edit.error) return fresh() ? { allow: true, reason: "stamp fresh" } : refuse(`${rel}: ${edit.error} (fail closed)`);
  const afters = edit.afters ?? [edit.after];
  if (!afters.some((after) => introducesCompletion(edit.before, after))) return { allow: true, reason: "no new [x]" };
  if (fresh()) return { allow: true, reason: "completion with a fresh passing stamp" };
  return refuse(`${rel} would mark a task [x] but ${stampProblem(readJson(STAMP)).split("\n")[0]}. Status markers ([-], [~]) and notes stay editable`);
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "fast") {
    const saved = [...rest, ...pathsIn(parse(readStdin()))];
    if (saved.length && !saved.some(inFastScope)) { say(`contest gate: no Showdown rules or card data in ${saved.length} saved path(s); skipped`); return 0; }
    const { failures } = await propertyFailures("fast");
    if (failures.length) { warn(failures.join("\n")); return 2; }
    return 0;
  }
  if (mode === "release") {
    const failures = await release("manual");
    if (failures.length) { warn(failures.join("\n")); return 2; }
    say("contest gate: release checks passed; stamp written");
    return 0;
  }
  if (mode === "status") {
    const { stamp, current, fresh } = stampState();
    say(JSON.stringify({ current, stamp, fresh }, null, 2));
    return 0;
  }
  if (mode === "pre-task") {
    const { stamp, current, fresh } = stampState();
    writeJson(TASK_START, { fingerprint: current, at: new Date().toISOString() });
    say(`contest gate: task start recorded; stamp ${stamp ? (fresh ? "passes for this tree" : stamp.ok ? "is stale" : "recorded a failure") : "missing"}`);
    return 0;
  }
  if (mode === "post-task") {
    const { stamp, fresh, current } = stampState();
    if (fresh) { say("contest gate: stamp already passes for this tree"); return 0; }
    if (stamp?.fingerprint === current) {
      // This exact tree already failed: report the recorded result again without re-running.
      warn(`contest gate: unchanged tree still fails:\n${stamp.failures.join("\n")}`);
      return 2;
    }
    const failures = await release("PostTaskExecution");
    if (failures.length) { warn(failures.join("\n")); return 2; }
    say("contest gate: release checks passed; stamp written");
    return 0;
  }
  if (mode === "stop") {
    const event = parse(readStdin());
    const { stamp, fresh, current } = stampState();
    if (fresh) { say("contest gate: stamp passes for this tree"); return 0; }
    const attempts = readJson(ATTEMPTS);
    const count = attempts?.fingerprint === current ? attempts.count : 0;
    // Loop guard: a Stop that already re-entered (stop_hook_active) or a tree that failed STOP_RETRIES
    // times without changing is reported once more with exit 1 and no new run.
    if (count >= STOP_RETRIES || (event?.stop_hook_active && count > 0)) {
      warn(`contest gate: still failing after ${count} Stop report(s) on an unchanged tree; not re-running. See ${relative(root, STAMP)}`);
      return 1;
    }
    // A failure already recorded for this exact tree is reported again without re-running the checks.
    const failures = stamp?.fingerprint === current ? stamp.failures : await release("Stop");
    if (!failures.length) { writeJson(ATTEMPTS, { fingerprint: current, count: 0 }); say("contest gate: release checks passed; stamp written"); return 0; }
    writeJson(ATTEMPTS, { fingerprint: current, count: count + 1 });
    warn(failures.join("\n"));
    return 2;
  }
  if (mode === "completion") {
    const event = parse(readStdin());
    const tool = event?.tool_name ?? event?.toolName ?? event?.tool;
    const input = event?.tool_input ?? event?.toolInput ?? event?.input ?? {};
    // Only a step's success completion is gated; info, warning and error messages pass.
    if (event && ((tool && tool !== "send_message") || input.severity !== "success")) return 0;
    const { stamp, fresh } = stampState();
    if (fresh) return 0;
    warn(`contest gate: completion refused; ${stampProblem(stamp)}. ${RERUN}`);
    return 2;
  }
  if (mode === "tasks-edit") {
    const raw = readStdin();
    const verdict = guardFileEdit({ raw, event: parse(raw), fresh: () => stampState().fresh, read: (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } } });
    if (verdict.allow) return 0;
    warn(verdict.reason);
    return 2;
  }
  warn("usage: node scripts/contest-release-gate.mjs fast [paths...] | release | pre-task | post-task | stop | completion | tasks-edit | status");
  return 1;
}

if (import.meta.main) process.exitCode = await main();
