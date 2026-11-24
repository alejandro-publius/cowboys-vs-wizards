// Night Shift saloon producer: turns real Kiro hook observations into journal facts through
// scripts/saloon-journal.mjs recordEvent(root, facts, stableKey). Every observe* call returns a
// promise that settles only after the journal call settled, so a CLI awaits it before exiting.
// Best effort everywhere: no observation may change a policy outcome, print anything, or throw into
// a caller. Public facts carry only the fields below; payload values (session and task ids, paths,
// commands, task text, card bodies) never leave this module except inside sha256 keys.
//
// Observations and their evidence:
//   block {rule:"balancer"}    the balancer fence (scripts/contest-balance-fence.mjs) exited 2
//   block {rule:"completion"}  the release gate `completion` mode exited 2
//   block {rule:"tasks"}       the release gate `tasks-edit` mode exited 2 (a spec tasks.md file edit)
//   bell                       the release gate `stop` mode exited 0 and the stamp is fresh for the tree
//   cast {card,field,before,after}
//                              the fence allowed a write to an open attempt's scratch card (a before
//                              snapshot is taken then), and the balancer's PostToolUse for that same
//                              write, with a decoded response that is not a failure, finds the file on
//                              disk differing from the snapshot in exactly one whitelisted whole-number
//                              stat. Failed, no-op or multi-field writes: none.
//   job                        contest-balance-preparer's PostToolUse for exactly
//                              `node scripts/contest-balance.mjs reset` reporting success (exit 0 or the
//                              script's reset line, no failure signal) and a fresh reset status.json
//   wanted {boss}              a native task_update, as Kiro CLI 3.5 dispatches it in a /spec run
//                              (PreToolUse and PostToolUse, tool_name exactly "task_update"; standalone
//                              PreTaskExecution/PostTaskExecution did not dispatch in two observed runs).
//                              tool_input {tasksFilePath: .kiro/specs/<wanted|bounty>-<name>/tasks.md,
//                              relative or absolute; taskId; status:"completed"; error:null}; the
//                              tool_response, a JSON-encoded string, decodes to {updated:true,
//                              propagatedChanges:[{taskId: same, oldStatus: not "completed",
//                              newStatus:"completed"}, ...]}. PreToolUse stores a snapshot of that one
//                              tasks.md (path and item-label hashes, one checkbox mark per item, three
//                              numbers) keyed by session, task id and path. PostToolUse consumes it and
//                              selects the task: the item numbered taskId ("1", "2.3"), or for an opaque
//                              taskId the single item that turned [x]. That item must have turned [x]
//                              since the snapshot, name exactly one tasks/bounties/<boss>/, and
//                              tasks/bounties/<boss>/boss.json must be drafted with id <boss>. The key
//                              is stable per spec task and boss, so a repeated observation never pins
//                              twice. Drafted only; never a claim that a boss is live.
//
// Hook commands (stdin: the Kiro hook event JSON; always exit 0, no output):
//   node scripts/saloon-hooks.mjs balancer-post   PostToolUse, showdown-balancer
//   node scripts/saloon-hooks.mjs preparer-post   PostToolUse, contest-balance-preparer
//   node scripts/saloon-hooks.mjs bounty-pre      PreToolUse matcher task_update (.kiro/hooks/night-shift-saloon.json)
//   node scripts/saloon-hooks.mjs bounty-post     PostToolUse matcher task_update
//   node scripts/saloon-hooks.mjs bounty-task     optional PostTaskExecution, not registered: pins only an
//                                                 event that carries the same task_update tool_input and
//                                                 tool_response, against the same snapshot
// Hook state (snapshots) lives in .artifacts/night-shift/hooks/ (generated, not committed).
import {createHash, randomBytes} from "node:crypto";
import {lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {isAbsolute, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {CARD_PATH, WRITE_TOOLS, fenceDecision} from "./contest-balance-fence.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const STATE = [".artifacts", "night-shift", "hooks"];
export const STAT_FIELDS = Object.freeze(["attack", "health", "stars"]);
export const RESET_COMMAND = "node scripts/contest-balance.mjs reset";
export const TASK_TOOL = "task_update";
const RESET_LINE = "reset .artifacts/contest-balance; status pass=false";
const RESET_STATUS = {schema: "contest-balance/status@1", pass: false, attempt: 0, note: "reset; no attempt reviewed yet"};
export const SHELL_TOOLS = Object.freeze(["execute_bash", "executeBash", "shell", "execute_cmd", "executeCmd", "run_shell_command", "bash"]);
const CAST_WINDOW_MS = 10 * 60_000;
const JOB_WINDOW_MS = 10 * 60_000;
const TASK_WINDOW_MS = 30 * 60_000;
const BUCKET_MS = 5_000;
const MAX_RAW = 1 << 20;
const MAX_CARD = 16 * 1024;
const MAX_TASKS = 256 * 1024;
const SPEC_TASKS = /^\.kiro\/specs\/(?:wanted|bounty)-[a-z0-9]+(?:-[a-z0-9]+)*\/tasks\.md$/;
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

// The production recorder, loaded on first use; a missing journal is observed as nothing.
async function defaultRecord(root, facts, key) {
  const journal = await import("./saloon-journal.mjs");
  return journal.recordEvent(root, facts, key);
}

export const sha = (...parts) => createHash("sha256").update(parts.map(String).join("\0")).digest("hex");

// Runs fn with stdout/stderr silenced and every error swallowed. When fn returns a promise (the
// production journal), output stays silenced until it settles; a sync result restores at once.
export async function quietly(fn) {
  const out = process.stdout.write, err = process.stderr.write;
  const restore = () => { process.stdout.write = out; process.stderr.write = err; };
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  let value;
  try { value = fn(); } catch { restore(); return undefined; }
  if (!value || typeof value.then !== "function") { restore(); return value; }
  try { return await value; } catch { return undefined; } finally { restore(); }
}

// decide() returns {root, facts, key} or null; the record call is awaited by the caller.
const observe = (options, decide) => quietly(() => {
  const out = decide();
  return out ? (options.record ?? defaultRecord)(out.root, out.facts, out.key) : undefined;
});

function parse(raw) {
  if (typeof raw !== "string" || !raw.trim() || raw.length > MAX_RAW) return null;
  try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value : null; } catch { return null; }
}
// Kiro CLI sends some tool_response values as JSON-encoded strings; decode before judging them.
function decoded(value) {
  if (typeof value !== "string" || value.length > MAX_RAW || !/^\s*[{[]/.test(value)) return value;
  try { return JSON.parse(value); } catch { return value; }
}
const field = (event, ...keys) => { for (const key of keys) if (event?.[key] !== undefined) return event[key]; return undefined; };
const toolOf = (event) => field(event, "tool_name", "toolName");
const inputOf = (event) => field(event, "tool_input", "toolInput");
const responseOf = (event) => decoded(field(event, "tool_response", "toolResponse", "tool_output", "toolOutput", "result"));
const hookOf = (event) => field(event, "hook_event_name", "hookEventName");
const isHook = (event, phase) => hookOf(event) === undefined || new RegExp(`^${phase}_?tool_?use$`, "i").test(String(hookOf(event)));

// The project root for an observation: an explicit test root, or this checkout when the hook's cwd
// is this checkout. Anything else is ambiguous and observed as nothing.
function contextRoot(event, options) {
  if (options.root) return options.root;
  const cwd = typeof event?.cwd === "string" && isAbsolute(event.cwd) ? event.cwd : process.cwd();
  try { return realpathSync(cwd) === realpathSync(ROOT) ? ROOT : null; } catch { return null; }
}

// One native invocation -> one key; distinct invocations -> distinct keys. Uses per-call ids when the
// runtime sends them; otherwise the payload digest, the spawning Kiro process and a 5 s bucket.
export function invocationKey(label, event, raw, {now = Date.now(), extra = ""} = {}) {
  const ids = ["session_id", "sessionId", "conversation_id", "conversationId", "tool_use_id", "toolUseId", "invocation_id", "invocationId", "execution_id", "executionId"]
    .filter((key) => ["string", "number"].includes(typeof event?.[key])).map((key) => `${key}=${String(event[key]).slice(0, 200)}`);
  const parts = [label, extra, sha(typeof raw === "string" ? raw : ""), ...ids];
  if (!ids.some((id) => /tool_?use|invocation|execution/i.test(id))) parts.push(`p${process.ppid}`, `t${Math.floor(now / BUCKET_MS)}`);
  return sha(...parts);
}

// ---------------------------------------------------------------- local hook state
function stateDir(root, create) {
  let at = root;
  for (const part of STATE) {
    at = join(at, part);
    const stat = lstatSync(at, {throwIfNoEntry: false});
    if (!stat) { if (!create) return null; mkdirSync(at); continue; }
    if (stat.isSymbolicLink() || !stat.isDirectory()) return null;
  }
  return at;
}
function writeState(root, name, value) {
  const dir = stateDir(root, true);
  if (!dir) return;
  const tmp = join(dir, `.${name}.${process.pid}.${randomBytes(4).toString("hex")}`);
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, join(dir, name));
}
// Atomically claims and removes a state file, so only one process consumes a snapshot.
function takeState(root, name) {
  const dir = stateDir(root, false);
  if (!dir) return null;
  const claim = join(dir, `.${name}.${process.pid}.${randomBytes(4).toString("hex")}.claimed`);
  try { renameSync(join(dir, name), claim); } catch { return null; }
  try { return JSON.parse(readFileSync(claim, "utf8")); } catch { return null; } finally { rmSync(claim, {force: true}); }
}

// A regular, link-free file under root, read as text, or null.
function readSafe(root, rel, max) {
  if (typeof rel !== "string" || !rel || isAbsolute(rel) || rel.split("/").some((part) => !part || part === "." || part === "..")) return null;
  let at = root;
  for (const part of rel.split("/")) {
    at = join(at, part);
    const stat = lstatSync(at, {throwIfNoEntry: false});
    if (!stat || stat.isSymbolicLink()) return null;
  }
  const stat = lstatSync(at);
  if (!stat.isFile() || stat.size > max) return null;
  return readFileSync(at, "utf8");
}

// ---------------------------------------------------------------- balancer: block and cast
function scratchRel(root, input) {
  const path = input?.path;
  if (typeof path !== "string" || !path) return null;
  const rel = (isAbsolute(path) ? relative(root, path) : path).split(sep).join("/");
  const match = CARD_PATH.exec(rel);
  return match ? {rel, card: match[2]} : null;
}
const castSlot = (rel) => `cast-${sha(rel).slice(0, 32)}.json`;

// Called by the fence CLI after its decision. Denied -> block; allowed scratch-card write -> snapshot.
export function observeFence(raw, decision, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    const root = contextRoot(event, options);
    if (!root) return null;
    const now = options.now ?? Date.now();
    if (!decision?.allow) return {root, facts: {kind: "block", rule: "balancer"}, key: invocationKey("block:balancer", event, raw, {now})};
    if (!WRITE_TOOLS.includes(toolOf(event))) return null;
    const target = scratchRel(root, inputOf(event));
    if (!target) return null;
    const before = readSafe(root, target.rel, MAX_CARD);
    if (before !== null) writeState(root, castSlot(target.rel), {rel: target.rel, card: target.card, before, at: now, nonce: randomBytes(12).toString("hex")});
    return null;
  });
}

// {field, before, after} when exactly one whitelisted whole-number stat differs, else null.
export function singleStatChange(beforeText, afterText) {
  let a, b;
  try { a = JSON.parse(beforeText); b = JSON.parse(afterText); } catch { return null; }
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) return null;
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
  if (changed.length !== 1 || !STAT_FIELDS.includes(changed[0])) return null;
  const [name] = changed;
  if (!Number.isSafeInteger(a[name]) || !Number.isSafeInteger(b[name])) return null;
  return {field: name, before: a[name], after: b[name]};
}

function responseFailed(response) {
  const scan = (value) => {
    if (!value || typeof value !== "object") return false;
    if (value.success === false || value.isError === true || value.is_error === true) return true;
    if (typeof value.error === "string" && value.error.trim()) return true;
    if (typeof value.status === "string" && /^(error|failed|failure|denied|cancell?ed)$/i.test(value.status)) return true;
    return false;
  };
  return scan(response) || (Array.isArray(response?.result) && response.result.some((item) => scan(decoded(item))));
}

export function observeBalancerPost(raw, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    if (!event || !isHook(event, "post") || !WRITE_TOOLS.includes(toolOf(event))) return null;
    const root = contextRoot(event, options);
    if (!root) return null;
    const target = scratchRel(root, inputOf(event));
    if (!target) return null;
    const pending = takeState(root, castSlot(target.rel));
    const now = options.now ?? Date.now();
    if (!pending || pending.rel !== target.rel || typeof pending.before !== "string" || !(now - pending.at <= CAST_WINDOW_MS)) return null;
    if (responseFailed(responseOf(event))) return null;
    const recheck = {...event, hook_event_name: undefined, hookEventName: undefined, cwd: root};
    if (!fenceDecision(recheck, {cwd: root}).allow) return null;
    const after = readSafe(root, target.rel, MAX_CARD);
    if (after === null) return null;
    const change = singleStatChange(pending.before, after);
    return change ? {root, facts: {kind: "cast", card: pending.card, ...change}, key: sha("cast", pending.nonce, sha(after))} : null;
  });
}

// ---------------------------------------------------------------- release gate: block and bell
// Called by the release gate CLI after main() returned `code`, with the same stdin text main() read.
export function observeGate({mode, code, raw, fresh, stamp}, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    const root = contextRoot(event, options);
    if (!root) return null;
    const now = options.now ?? Date.now();
    const rule = {completion: "completion", "tasks-edit": "tasks"}[mode];
    if (rule && code === 2) return {root, facts: {kind: "block", rule}, key: invocationKey(`block:${rule}`, event, raw, {now})};
    if (mode === "stop" && code === 0 && fresh?.() === true) {
      const print = stamp?.()?.fingerprint;
      return {root, facts: {kind: "bell"}, key: invocationKey("bell", event, raw, {now, extra: typeof print === "string" ? print : ""})};
    }
    return null;
  });
}

// ---------------------------------------------------------------- preparer: job
function shellEvidence(value, depth = 0, out = {exits: [], failed: false, resetLine: false}) {
  if (depth > 5 || value === null || value === undefined) return out;
  if (typeof value === "string") {
    if (value.length > MAX_RAW) return out;
    if (value.split(/\r?\n/).some((line) => line.trim() === RESET_LINE)) out.resetLine = true;
    const inner = decoded(value);
    if (inner !== value) shellEvidence(inner, depth + 1, out);
    return out;
  }
  if (typeof value !== "object") return out;
  if (Array.isArray(value)) { for (const item of value.slice(0, 32)) shellEvidence(item, depth + 1, out); return out; }
  if (responseFailed(value)) out.failed = true;
  for (const [key, item] of Object.entries(value)) {
    if (/^exit_?(status|code)$/i.test(key) || key === "exitStatus" || key === "exitCode") {
      const n = typeof item === "number" ? item : typeof item === "string" && /^-?\d+$/.test(item.trim()) ? Number(item) : NaN;
      if (Number.isInteger(n)) out.exits.push(n); else if (item !== null && item !== undefined) out.failed = true;
    } else shellEvidence(item, depth + 1, out);
  }
  return out;
}

function freshResetStatus(root, now) {
  const rel = ".artifacts/contest-balance/status.json";
  const text = readSafe(root, rel, 4096);
  if (text === null) return null;
  let status;
  try { status = JSON.parse(text); } catch { return null; }
  if (JSON.stringify(status) !== JSON.stringify(RESET_STATUS)) return null;
  const stat = lstatSync(join(root, rel));
  if (!(now - stat.mtimeMs <= JOB_WINDOW_MS && stat.mtimeMs - now <= 5_000)) return null;
  if (readdirSync(join(root, ".artifacts/contest-balance")).some((name) => /^attempt-\d+$/.test(name))) return null;
  return stat;
}

export function observePreparerPost(raw, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    if (!event || !isHook(event, "post") || !SHELL_TOOLS.includes(toolOf(event))) return null;
    const command = inputOf(event)?.command;
    if (typeof command !== "string" || command.trim() !== RESET_COMMAND) return null;
    const root = contextRoot(event, options);
    if (!root) return null;
    const evidence = shellEvidence(responseOf(event));
    if (evidence.failed || evidence.exits.some((n) => n !== 0)) return null;
    if (!evidence.exits.includes(0) && !evidence.resetLine) return null;
    const stat = freshResetStatus(root, options.now ?? Date.now());
    return stat ? {root, facts: {kind: "job"}, key: sha("job", stat.ino, stat.mtimeMs, stat.size)} : null;
  });
}

// ---------------------------------------------------------------- bounty designer: wanted
const ITEM = /^(\s*)[-*+]\s+\[([^\]])\]\s+(.*?)\s*$/;
// Checkbox items, each with its own block: the item line plus deeper-indented non-item lines.
export function taskItems(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const m = ITEM.exec(lines[i]);
    if (!m) continue;
    const block = [lines[i]];
    for (let j = i + 1; j < lines.length && !ITEM.test(lines[j]); j++) {
      if (lines[j].trim() && /^\s*/.exec(lines[j])[0].length <= m[1].length) break;
      block.push(lines[j]);
    }
    items.push({label: m[3], done: m[2] === "x" || m[2] === "X", block: block.join("\n")});
  }
  return items;
}
const shapeOf = (items) => sha("shape", ...items.map((item) => item.label));
const marksOf = (items) => items.map((item) => (item.done ? "x" : ".")).join("");

// The scoped task_update: {root, rel, taskId, slot} for a completion of one wanted/bounty spec's
// tasks.md in this checkout, else null.
function taskScope(event, options) {
  const input = inputOf(event);
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const {tasksFilePath: path, taskId, status} = input;
  if (status !== "completed" || (input.error !== null && input.error !== undefined)) return null;
  if (typeof path !== "string" || !path || path.length > 1024 || path.includes("\0")) return null;
  if (typeof taskId !== "string" || !taskId.trim() || taskId.length > 200) return null;
  const root = contextRoot(event, options);
  if (!root) return null;
  // An absolute path is taken relative to the root or to the runtime's (possibly unresolved) cwd.
  const bases = isAbsolute(path) ? [root, event.cwd].filter((base) => typeof base === "string" && isAbsolute(base)) : [root];
  const rel = bases.map((base) => relative(base, resolve(base, path)).split(sep).join("/")).find((candidate) => SPEC_TASKS.test(candidate));
  if (!rel) return null;
  const session = field(event, "session_id", "sessionId");
  const who = ["string", "number"].includes(typeof session) ? `s:${session}` : `p:${process.ppid}`;
  return {root, rel, taskId, slot: `task-${sha(who, taskId, rel).slice(0, 32)}.json`};
}

// Item index for a numbered taskId ("1", "2.3"): >= 0 when exactly one item carries that number,
// -2 when several do, -1 when none does (an opaque id).
function numberedItem(items, taskId) {
  if (!/^\d+(?:\.\d+)*$/.test(taskId)) return -1;
  const hits = items.flatMap((item, index) => (/^(\d+(?:\.\d+)*)\.?(?:\s|$)/.exec(item.label)?.[1] === taskId ? [index] : []));
  return hits.length === 1 ? hits[0] : hits.length ? -2 : -1;
}

// A decoded task_update response that reports this task's own change to completed.
function completedTransition(response, taskId) {
  if (!response || typeof response !== "object" || Array.isArray(response) || response.updated !== true) return false;
  if (response.error !== undefined && response.error !== null) return false;
  return Array.isArray(response.propagatedChanges) && response.propagatedChanges.some((change) =>
    change?.taskId === taskId && change.newStatus === "completed" && typeof change.oldStatus === "string" && change.oldStatus !== "completed");
}

function bossOf(block) {
  const refs = new Set([...block.matchAll(/tasks\/bounties\/([a-z][a-z0-9-]{0,31})\//g)].map((m) => m[1]));
  return refs.size === 1 ? [...refs][0] : null;
}
function bossDrafted(root, slug) {
  if (!SLUG.test(slug)) return false;
  const text = readSafe(root, `tasks/bounties/${slug}/boss.json`, MAX_CARD);
  if (text === null) return false;
  try { return JSON.parse(text)?.id === slug; } catch { return false; }
}

function pruneSnapshots(root, now) {
  const dir = stateDir(root, false);
  if (!dir) return;
  for (const name of readdirSync(dir)) {
    if (!/^task-[0-9a-f]{32}\.json$/.test(name)) continue;
    const stat = lstatSync(join(dir, name), {throwIfNoEntry: false});
    if (stat && !(now - stat.mtimeMs <= TASK_WINDOW_MS)) rmSync(join(dir, name), {force: true});
  }
}

export function observeBountyPre(raw, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    if (!event || toolOf(event) !== TASK_TOOL || !isHook(event, "pre")) return null;
    const scope = taskScope(event, options);
    if (!scope) return null;
    const now = options.now ?? Date.now();
    pruneSnapshots(scope.root, now);
    const text = readSafe(scope.root, scope.rel, MAX_TASKS);
    if (text === null) return null;
    const items = taskItems(text);
    const marks = marksOf(items);
    writeState(scope.root, scope.slot, {path: sha(scope.rel), shape: shapeOf(items), marks, at: now, total: items.length, done: marks.split("x").length - 1});
    return null;
  });
}

function decideWanted(event, options) {
  const scope = taskScope(event, options);
  if (!scope) return null;
  const snap = takeState(scope.root, scope.slot);
  const now = options.now ?? Date.now();
  if (!snap || snap.path !== sha(scope.rel) || typeof snap.marks !== "string" || !(now - snap.at <= TASK_WINDOW_MS && snap.at - now <= 5_000)) return null;
  if (!completedTransition(responseOf(event), scope.taskId)) return null;
  const text = readSafe(scope.root, scope.rel, MAX_TASKS);
  if (text === null) return null;
  const items = taskItems(text);
  if (items.length !== snap.marks.length || shapeOf(items) !== snap.shape) return null;
  const turned = items.flatMap((item, index) => (item.done && snap.marks[index] !== "x" ? [index] : []));
  const numbered = numberedItem(items, scope.taskId);
  const index = numbered >= 0 ? (turned.includes(numbered) ? numbered : -1) : numbered === -1 && turned.length === 1 ? turned[0] : -1;
  if (index < 0) return null;
  const boss = bossOf(items[index].block);
  if (!boss || !bossDrafted(scope.root, boss)) return null;
  return {root: scope.root, facts: {kind: "wanted", boss}, key: sha("wanted", scope.rel, sha(items[index].label), boss)};
}

export function observeBountyPost(raw, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    return event && toolOf(event) === TASK_TOOL && isHook(event, "post") ? decideWanted(event, options) : null;
  });
}

// Optional PostTaskExecution entry (see header): the same evidence, without the tool-name check.
export function observeBountyTask(raw, options = {}) {
  return observe(options, () => {
    const event = parse(raw);
    return event && [undefined, TASK_TOOL].includes(toolOf(event)) ? decideWanted(event, options) : null;
  });
}

const COMMANDS = {
  "balancer-post": observeBalancerPost,
  "preparer-post": observePreparerPost,
  "bounty-pre": observeBountyPre,
  "bounty-post": observeBountyPost,
  "bounty-task": observeBountyTask,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = COMMANDS[process.argv[2]];
  if (!run) {
    process.stderr.write(`usage: node scripts/saloon-hooks.mjs ${Object.keys(COMMANDS).join(" | ")}\n`);
    process.exitCode = 1;
  } else {
    let raw = "";
    if (!process.stdin.isTTY) { try { raw = readFileSync(0, "utf8"); } catch { raw = ""; } }
    await run(raw);
    process.exitCode = 0;
  }
}
