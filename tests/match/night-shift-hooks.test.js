// Night Shift saloon hook producer (scripts/saloon-hooks.mjs) and its calls from the balancer fence
// and the release gate. In-process tests use a temporary root and an injected recorder. CLI smoke
// tests copy the scripts into a temporary root next to a stub scripts/saloon-journal.mjs, so the
// default recorder runs for real; nothing here writes the real journal.
// Run: node --test tests/match/night-shift-hooks.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {fenceDecision} from "../../scripts/contest-balance-fence.mjs";
import {
  RESET_COMMAND, observeBalancerPost, observeBountyPost, observeBountyPre, observeBountyTask,
  observeFence, observeGate, observePreparerPost, singleStatChange,
} from "../../scripts/saloon-hooks.mjs";

const SCRIPTS = fileURLToPath(new URL("../../scripts/", import.meta.url));
const REL = ".artifacts/contest-balance/attempt-1/scratch/.kiro/specs/duel-card-pipeline/cards/cowboy-billy.json";
const CARD = '{ "type": "cowboy-billy", "side": "cowboy", "order": 2, "name": "Billy", "kind": "troop", "stars": 5, "health": 4, "attack": 2, "copies": 3, "showdown": { "rarity": "basic", "tag": "Outlaw", "keys": [] } }\n';

const temps = [];
function tempRoot() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "night-shift-hooks-")));
  temps.push(root);
  return root;
}
test.after(() => { for (const dir of temps) rmSync(dir, {recursive: true, force: true}); });

const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), {recursive: true}); writeFileSync(join(root, rel), text); };
function recorder(root) {
  const calls = [];
  return {calls, options: {root, record: (at, facts, key) => calls.push({at, facts, key})}};
}

// ---------------------------------------------------------------- balancer cast and block
function balancerRoot(root = tempRoot()) {
  put(root, ".artifacts/contest-balance/attempt-1/scratch/.contest-balance-scratch.json",
    JSON.stringify({schema: "contest-balance/scratch@1", attempt: 1, cards: ["cowboy-billy"]}));
  put(root, REL, CARD);
  return root;
}
const writeEvent = (root, hook, extra = {}) => JSON.stringify({
  hook_event_name: hook, cwd: root, tool_name: "fs_write",
  tool_input: {command: "str_replace", path: REL, old_str: '"attack": 2', new_str: '"attack": 3'}, ...extra,
});
async function preCall(root, options) {
  const raw = writeEvent(root, "PreToolUse");
  const decision = fenceDecision(JSON.parse(raw));
  await observeFence(raw, decision, options);
  return decision;
}

test("cast: an allowed write that changes one stat on disk records the transition", async () => {
  const root = balancerRoot();
  const {calls, options} = recorder(root);
  assert.equal((await preCall(root, options)).allow, true);
  assert.equal(calls.length, 0, "the pre-call records nothing");
  put(root, REL, CARD.replace('"attack": 2', '"attack": 3'));
  await observeBalancerPost(writeEvent(root, "PostToolUse", {tool_response: '{"success":true}'}), options);
  assert.deepEqual(calls.map((c) => c.facts), [{kind: "cast", card: "cowboy-billy", field: "attack", before: 2, after: 3}]);
  assert.match(calls[0].key, /^[0-9a-f]{64}$/);
  await observeBalancerPost(writeEvent(root, "PostToolUse", {tool_response: {success: true}}), options);
  assert.equal(calls.length, 1, "a repeated post for the same write finds the snapshot consumed");
});

test("cast: no-op, failed (object or JSON string), two-field and non-stat writes record nothing", async () => {
  for (const [label, after, response] of [
    ["unchanged", CARD, {success: true}],
    ["failed", CARD.replace('"attack": 2', '"attack": 3'), {success: false, error: "write failed"}],
    ["failed string", CARD.replace('"attack": 2', '"attack": 3'), JSON.stringify({success: false, error: "write failed"})],
    ["two fields", CARD.replace('"attack": 2', '"attack": 3').replace('"health": 4', '"health": 5'), {success: true}],
    ["non-stat field", CARD.replace('"copies": 3', '"copies": 2'), {success: true}],
  ]) {
    const root = balancerRoot();
    const {calls, options} = recorder(root);
    await preCall(root, options);
    put(root, REL, after);
    await observeBalancerPost(writeEvent(root, "PostToolUse", {tool_response: response}), options);
    assert.deepEqual(calls, [], label);
  }
});

test("cast: a post without an allowed pre-call snapshot records nothing", async () => {
  const root = balancerRoot();
  const {calls, options} = recorder(root);
  put(root, REL, CARD.replace('"attack": 2', '"attack": 3'));
  await observeBalancerPost(writeEvent(root, "PostToolUse", {tool_response: {success: true}}), options);
  assert.deepEqual(calls, []);
});

test("block: a denied balancer call records block balancer and takes no snapshot", async () => {
  const root = balancerRoot();
  put(root, ".artifacts/contest-balance/attempt-1/receipt.json", "{}\n");
  const {calls, options} = recorder(root);
  assert.equal((await preCall(root, options)).allow, false);
  assert.deepEqual(calls.map((c) => c.facts), [{kind: "block", rule: "balancer"}]);
  put(root, REL, CARD.replace('"attack": 2', '"attack": 3'));
  await observeBalancerPost(writeEvent(root, "PostToolUse", {tool_response: {success: true}}), options);
  assert.equal(calls.length, 1, "no cast after a denied write");
});

test("singleStatChange accepts exactly one whole-number stat", () => {
  assert.deepEqual(singleStatChange(CARD, CARD.replace('"stars": 5', '"stars": 6')), {field: "stars", before: 5, after: 6});
  assert.equal(singleStatChange(CARD, CARD.replace('"stars": 5', '"stars": 5.5')), null);
  assert.equal(singleStatChange(CARD, "not json"), null);
});

// ---------------------------------------------------------------- release gate block and bell
test("gate: refusals record blocks, a passing Stop with a fresh stamp rings the bell", async () => {
  const root = tempRoot();
  const {calls, options} = recorder(root);
  await observeGate({mode: "completion", code: 2, raw: '{"tool_name":"send_message"}'}, options);
  await observeGate({mode: "tasks-edit", code: 2, raw: '{"tool_name":"fs_write"}'}, options);
  await observeGate({mode: "completion", code: 0, raw: ""}, options);
  await observeGate({mode: "stop", code: 2, raw: "", fresh: () => false}, options);
  await observeGate({mode: "stop", code: 1, raw: "", fresh: () => true}, options);
  await observeGate({mode: "stop", code: 0, raw: "", fresh: () => false}, options);
  await observeGate({mode: "stop", code: 0, raw: "", fresh: () => true, stamp: () => ({fingerprint: "f"})}, options);
  assert.deepEqual(calls.map((c) => c.facts), [{kind: "block", rule: "completion"}, {kind: "block", rule: "tasks"}, {kind: "bell"}]);
});

test("gate: a throwing or rejecting journal or stamp leaves the caller and its output untouched", async () => {
  const root = tempRoot();
  const write = process.stdout.write;
  const loud = {root, record: () => { console.log("noise"); throw new Error("journal down"); }};
  const rejecting = {root, record: async () => { throw new Error("journal down"); }};
  await assert.doesNotReject(observeGate({mode: "completion", code: 2, raw: ""}, loud));
  await assert.doesNotReject(observeGate({mode: "completion", code: 2, raw: ""}, rejecting));
  await assert.doesNotReject(observeGate({mode: "stop", code: 0, raw: "", fresh: () => { throw new Error("no stamp"); }}, loud));
  assert.equal(process.stdout.write, write);
});

// ---------------------------------------------------------------- preparer job
const STATUS = ".artifacts/contest-balance/status.json";
const RESET_STATUS = {schema: "contest-balance/status@1", pass: false, attempt: 0, note: "reset; no attempt reviewed yet"};
const shellEvent = (root, command, response) => JSON.stringify({hook_event_name: "PostToolUse", cwd: root, tool_name: "execute_bash", tool_input: {command}, tool_response: response});
const ok = {success: true, result: [{exit_status: "0", stdout: "reset .artifacts/contest-balance; status pass=false\n", stderr: ""}]};

test("job: a successful reset with a fresh reset status records one job key", async () => {
  const root = tempRoot();
  put(root, STATUS, `${JSON.stringify(RESET_STATUS, null, 2)}\n`);
  const {calls, options} = recorder(root);
  await observePreparerPost(shellEvent(root, RESET_COMMAND, ok), options);
  await observePreparerPost(shellEvent(root, RESET_COMMAND, JSON.stringify(ok)), options);
  assert.deepEqual(calls.map((c) => c.facts), [{kind: "job"}, {kind: "job"}]);
  assert.equal(calls[0].key, calls[1].key, "the same reset groups under one key");
});

test("job: failed, other, stale or non-reset runs record nothing", async () => {
  const root = tempRoot();
  put(root, STATUS, `${JSON.stringify(RESET_STATUS, null, 2)}\n`);
  const {calls, options} = recorder(root);
  await observePreparerPost(shellEvent(root, RESET_COMMAND, {success: true, result: [{exit_status: "1", stdout: "", stderr: "boom"}]}), options);
  await observePreparerPost(shellEvent(root, RESET_COMMAND, JSON.stringify({success: false})), options);
  await observePreparerPost(shellEvent(root, "node scripts/contest-balance.mjs prepare", ok), options);
  await observePreparerPost(shellEvent(root, `${RESET_COMMAND}; ls`, ok), options);
  await observePreparerPost(shellEvent(root, RESET_COMMAND, ok), {...options, now: Date.now() + 60 * 60_000});
  mkdirSync(join(root, ".artifacts/contest-balance/attempt-1"));
  await observePreparerPost(shellEvent(root, RESET_COMMAND, ok), options);
  assert.deepEqual(calls, []);
});

// ---------------------------------------------------------------- bounty wanted (native task_update)
const SPEC = ".kiro/specs/wanted-lantern-wraith/tasks.md";
const TASK_TEXT = [
  "# Implementation Plan", "",
  "- [ ] 1. Draft the boss entry",
  "  - Write tasks/bounties/lantern-wraith/boss.json from the Fable brief",
  "  - _Requirements: 1.1_",
  "- [ ] 2. Tidy the spec notes",
  "- [ ] 3. Draft the hunts for tasks/bounties/lantern-wraith/hunts.json", "",
].join("\n");
function bountyRoot({boss = {id: "lantern-wraith", name: "Lantern Wraith"}} = {}) {
  const root = tempRoot();
  put(root, SPEC, TASK_TEXT);
  put(root, ".kiro/specs/lane-cleanup/tasks.md", "- [ ] 1. Draft tasks/bounties/lantern-wraith/boss.json again\n");
  if (boss) put(root, "tasks/bounties/lantern-wraith/boss.json", JSON.stringify(boss));
  return root;
}
const check = (root, n, rel = SPEC) => put(root, rel, readFileSync(join(root, rel), "utf8").replace(`- [ ] ${n}.`, `- [x] ${n}.`));
const taskInput = (taskId, extra = {}) => ({tasksFilePath: SPEC, taskId, status: "completed", error: null, ...extra});
const response = (taskId, extra = {}) => JSON.stringify({updated: true, propagatedChanges: [{taskId, oldStatus: "in_progress", newStatus: "completed"}], newlyReady: [], ...extra});
const nativePre = (root, taskId, {session = "s1", input = {}, tool = "task_update"} = {}) =>
  JSON.stringify({hook_event_name: "preToolUse", cwd: root, session_id: session, tool_name: tool, tool_input: taskInput(taskId, input)});
const nativePost = (root, taskId, {session = "s1", input = {}, tool = "task_update", tool_response = response(taskId)} = {}) =>
  JSON.stringify({hook_event_name: "postToolUse", cwd: root, session_id: session, tool_name: tool, tool_input: taskInput(taskId, input), tool_response});
const facts = (calls) => calls.map((c) => c.facts);

test("wanted: a native task_update completion pins only its own boss, once", async () => {
  const root = bountyRoot();
  const {calls, options} = recorder(root);
  await observeBountyPre(nativePre(root, "1"), options);
  check(root, 1);
  check(root, 2); // an unrelated item completed in the same spec
  await observeBountyPost(nativePost(root, "1"), options);
  assert.deepEqual(facts(calls), [{kind: "wanted", boss: "lantern-wraith"}]);
  await observeBountyPost(nativePost(root, "1"), options);
  await observeBountyPre(nativePre(root, "1"), options);
  await observeBountyPost(nativePost(root, "1"), options);
  assert.equal(calls.length, 1, "repeat post, and a re-run on an already-[x] task, pin nothing");
});

test("wanted: absolute path, opaque task id with one changed line, and concurrent sessions", async () => {
  const root = bountyRoot();
  const {calls, options} = recorder(root);
  const abs = {tasksFilePath: join(root, SPEC)};
  await observeBountyPre(nativePre(root, "t-9f3a", {input: abs}), options);
  await observeBountyPre(nativePre(root, "t-9f3a", {input: abs, session: "s2"}), options);
  check(root, 3);
  await observeBountyPost(nativePost(root, "t-9f3a", {input: abs}), options);
  await observeBountyPost(nativePost(root, "t-9f3a", {input: abs, session: "s2"}), options);
  assert.deepEqual(facts(calls), [{kind: "wanted", boss: "lantern-wraith"}, {kind: "wanted", boss: "lantern-wraith"}]);
  assert.equal(calls[0].key, calls[1].key, "the same task completion keys identically across sessions");
});

test("wanted: failed, same-state, stale, unscoped, ambiguous or boss-less updates record nothing", async () => {
  const cases = {
    "updated false (raw string)": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {tool_response: response("1", {updated: false})}), o); },
    "error in response": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {tool_response: response("1", {error: "boom"})}), o); },
    "undecodable response": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {tool_response: "{updated"}), o); },
    "same state": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {tool_response: JSON.stringify({updated: true, propagatedChanges: [{taskId: "1", oldStatus: "completed", newStatus: "completed"}]})}), o); },
    "other task's transition": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {tool_response: response("3")}), o); },
    "input error": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {input: {error: "x"}}), o); },
    "not completed": async (root, o) => { await observeBountyPre(nativePre(root, "1", {input: {status: "in_progress"}}), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {input: {status: "in_progress"}}), o); },
    "task_list": async (root, o) => { await observeBountyPre(nativePre(root, "1", {tool: "task_list"}), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {tool: "task_list"}), o); },
    "checkbox unchanged": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); await observeBountyPost(nativePost(root, "1"), o); },
    "no snapshot": async (root, o) => { check(root, 1); await observeBountyPost(nativePost(root, "1"), o); },
    "other session's snapshot": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {session: "s2"}), o); },
    "stale snapshot": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); await observeBountyPost(nativePost(root, "1"), {...o, now: Date.now() + 31 * 60_000}); },
    "tasks edited between": async (root, o) => { await observeBountyPre(nativePre(root, "1"), o); check(root, 1); put(root, SPEC, `${readFileSync(join(root, SPEC), "utf8")}- [ ] 4. New task\n`); await observeBountyPost(nativePost(root, "1"), o); },
    "task names no boss": async (root, o) => { await observeBountyPre(nativePre(root, "2"), o); check(root, 2); await observeBountyPost(nativePost(root, "2"), o); },
    "opaque id, two lines changed": async (root, o) => { await observeBountyPre(nativePre(root, "t-1"), o); check(root, 1); check(root, 3); await observeBountyPost(nativePost(root, "t-1"), o); },
    "unscoped spec": async (root, o) => { const input = {tasksFilePath: ".kiro/specs/lane-cleanup/tasks.md"}; await observeBountyPre(nativePre(root, "1", {input}), o); check(root, 1, input.tasksFilePath); await observeBountyPost(nativePost(root, "1", {input}), o); },
    "outside the root": async (root, o) => { const input = {tasksFilePath: `/elsewhere/${SPEC}`}; await observeBountyPre(nativePre(root, "1", {input}), o); check(root, 1); await observeBountyPost(nativePost(root, "1", {input}), o); },
  };
  for (const [label, run] of Object.entries(cases)) {
    const root = bountyRoot();
    const {calls, options} = recorder(root);
    await run(root, options);
    assert.deepEqual(calls, [], label);
  }
  for (const [label, boss] of [["no boss.json", null], ["id mismatch", {id: "someone-else"}]]) {
    const root = bountyRoot({boss});
    const {calls, options} = recorder(root);
    await observeBountyPre(nativePre(root, "1"), options);
    check(root, 1);
    await observeBountyPost(nativePost(root, "1"), options);
    assert.deepEqual(calls, [], label);
  }
});

test("wanted: the optional PostTaskExecution entry needs the same native evidence", async () => {
  const root = bountyRoot();
  const {calls, options} = recorder(root);
  await observeBountyPre(nativePre(root, "1"), options);
  check(root, 1);
  await observeBountyTask(JSON.stringify({hook_event_name: "postTaskExecution", cwd: root}), options);
  assert.deepEqual(calls, [], "a bare task event pins nothing");
  const event = JSON.parse(nativePost(root, "1"));
  await observeBountyTask(JSON.stringify({...event, hook_event_name: "postTaskExecution", tool_name: undefined}), options);
  assert.deepEqual(facts(calls), [{kind: "wanted", boss: "lantern-wraith"}]);
});

// ---------------------------------------------------------------- CLI smoke: default recorder
// A stub journal that resolves late, so an exit before the await would lose the event.
const STUB_JOURNAL = `import {appendFileSync} from "node:fs";
import {join} from "node:path";
export async function recordEvent(root, facts, key) {
  await new Promise((done) => setTimeout(done, 50));
  appendFileSync(join(root, ".journal.jsonl"), JSON.stringify({facts, key}) + "\\n");
}
`;
function cliRoot() {
  const root = tempRoot();
  mkdirSync(join(root, "scripts"));
  for (const name of ["saloon-hooks.mjs", "contest-balance-fence.mjs", "contest-release-gate.mjs"]) copyFileSync(join(SCRIPTS, name), join(root, "scripts", name));
  writeFileSync(join(root, "scripts", "saloon-journal.mjs"), STUB_JOURNAL);
  return root;
}
const cli = (root, script, args, input) => spawnSync(process.execPath, [join(root, "scripts", script), ...args], {cwd: root, encoding: "utf8", input});
const journal = (root) => (existsSync(join(root, ".journal.jsonl")) ? readFileSync(join(root, ".journal.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);

test("smoke: native task_update hooks store one wanted event without payload values", () => {
  const root = cliRoot();
  put(root, SPEC, TASK_TEXT);
  put(root, "tasks/bounties/lantern-wraith/boss.json", JSON.stringify({id: "lantern-wraith"}));
  const session = "session-secret-7731";
  const pre = cli(root, "saloon-hooks.mjs", ["bounty-pre"], nativePre(root, "1", {session}));
  assert.equal(pre.status, 0);
  assert.equal(pre.stdout + pre.stderr, "");
  const dir = join(root, ".artifacts/night-shift/hooks");
  const [slot] = readdirSync(dir);
  const snapshot = JSON.parse(readFileSync(join(dir, slot), "utf8"));
  assert.deepEqual(Object.keys(snapshot).sort(), ["at", "done", "marks", "path", "shape", "total"]);
  assert.deepEqual([snapshot.marks, snapshot.total, snapshot.done], ["...", 3, 0]);
  check(root, 1);
  for (let i = 0; i < 2; i++) {
    const post = cli(root, "saloon-hooks.mjs", ["bounty-post"], nativePost(root, "1", {session}));
    assert.equal(post.status, 0);
    assert.equal(post.stdout + post.stderr, "");
  }
  const stored = journal(root);
  assert.deepEqual(stored.map((entry) => entry.facts), [{kind: "wanted", boss: "lantern-wraith"}]);
  assert.match(stored[0].key, /^[0-9a-f]{64}$/);
  const text = readFileSync(join(root, ".journal.jsonl"), "utf8");
  for (const value of [session, "wanted-lantern-wraith", "tasks.md", "Draft", "taskId"]) assert.equal(text.includes(value), false, value);
});

test("smoke: fence and release gate CLIs keep their outcome and store their event before exit", () => {
  const root = cliRoot();
  const denied = cli(root, "contest-balance-fence.mjs", [], JSON.stringify({cwd: root, tool_name: "execute_bash", tool_input: {command: "ls"}}));
  assert.equal(denied.status, 2);
  assert.equal(denied.stdout, "");
  assert.equal(denied.stderr, "contest-balance fence blocked this tool call: tool execute_bash is not allowed for the balancer (no shell, code or other tools)\n");
  const read = cli(root, "contest-balance-fence.mjs", [], JSON.stringify({cwd: root, tool_name: "read", tool_input: {}}));
  assert.equal(read.status, 0);
  assert.equal(read.stdout + read.stderr, "");

  const refused = cli(root, "contest-release-gate.mjs", ["tasks-edit"], JSON.stringify({
    hook_event_name: "PreToolUse", cwd: root, tool_name: "fs_write",
    tool_input: {command: "create", path: SPEC, file_text: "- [x] 1. Draft the boss entry\n"},
  }));
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /\.kiro\/specs\/wanted-lantern-wraith\/tasks\.md would mark a task \[x\] but no stamp/);

  const current = JSON.parse(cli(root, "contest-release-gate.mjs", ["status"], "").stdout).current;
  put(root, ".artifacts/kiro/contest-gates/stamp.json", JSON.stringify({fingerprint: current, ok: true, failures: []}));
  const stop = cli(root, "contest-release-gate.mjs", ["stop"], JSON.stringify({hook_event_name: "stop", cwd: root, session_id: "s1"}));
  assert.equal(stop.status, 0);
  assert.equal(stop.stdout, "contest gate: stamp passes for this tree\n");
  assert.deepEqual(journal(root).map((entry) => entry.facts), [{kind: "block", rule: "balancer"}, {kind: "block", rule: "tasks"}, {kind: "bell"}]);
});

test("smoke: with no journal module, observers exit 0 silently and the fence keeps allow 0 / deny 2", () => {
  const root = cliRoot();
  rmSync(join(root, "scripts", "saloon-journal.mjs"));
  put(root, SPEC, TASK_TEXT);
  put(root, "tasks/bounties/lantern-wraith/boss.json", JSON.stringify({id: "lantern-wraith"}));
  const pre = cli(root, "saloon-hooks.mjs", ["bounty-pre"], nativePre(root, "1"));
  assert.deepEqual([pre.status, pre.stdout + pre.stderr], [0, ""]);
  check(root, 1);
  const post = cli(root, "saloon-hooks.mjs", ["bounty-post"], nativePost(root, "1"));
  assert.deepEqual([post.status, post.stdout + post.stderr], [0, ""], "a wanted event with no journal to write");
  const denied = cli(root, "contest-balance-fence.mjs", [], JSON.stringify({cwd: root, tool_name: "execute_bash", tool_input: {command: "ls"}}));
  assert.deepEqual([denied.status, denied.stdout], [2, ""]);
  assert.equal(denied.stderr, "contest-balance fence blocked this tool call: tool execute_bash is not allowed for the balancer (no shell, code or other tools)\n");
  balancerRoot(root);
  const write = cli(root, "contest-balance-fence.mjs", [], writeEvent(root, "PreToolUse"));
  assert.deepEqual([write.status, write.stdout + write.stderr], [0, ""], "an allowed scratch-card write");
});
