import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {after, test} from "node:test";
import {MARKER, fenceDecision, runHook} from "../../scripts/contest-balance-fence.mjs";

const CARDS = ".kiro/specs/duel-card-pipeline/cards";
const SHERIFF = '{ "type": "cowboy-sheriff", "side": "cowboy", "kind": "troop", "stars": 2, "health": 3, "attack": 1 }\n';
const roots = [];
after(() => { for (const dir of roots) rmSync(dir, {recursive: true, force: true}); });

function workspace({attempt = 1, cards = ["cowboy-sheriff"], receipt = false} = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "balancer-fence-")));
  roots.push(root);
  const scratch = join(root, `.artifacts/contest-balance/attempt-${attempt}/scratch`);
  mkdirSync(join(scratch, CARDS), {recursive: true});
  mkdirSync(join(root, CARDS), {recursive: true});
  writeFileSync(join(scratch, CARDS, "cowboy-sheriff.json"), SHERIFF);
  writeFileSync(join(scratch, CARDS, "wizard-spell.json"), "{}\n");
  writeFileSync(join(root, CARDS, "cowboy-sheriff.json"), SHERIFF);
  writeFileSync(join(scratch, MARKER), JSON.stringify({schema: "contest-balance/scratch@1", attempt, base: "0".repeat(40), cards}));
  if (receipt) writeFileSync(join(scratch, "..", "receipt.json"), "{}");
  return root;
}
const scratchCard = (attempt = 1, card = "cowboy-sheriff") => `.artifacts/contest-balance/attempt-${attempt}/scratch/${CARDS}/${card}.json`;
const write = (root, path, extra = {}) => fenceDecision({hook_event_name: "preToolUse", cwd: root, tool_name: "fs_write", tool_input: {command: "str_replace", path, ...extra}});

test("allows a write to an existing whitelisted card in the open scratch snapshot", () => {
  const root = workspace();
  assert.equal(write(root, scratchCard()).allow, true);
  assert.equal(write(root, join(root, scratchCard())).allow, true, "absolute path inside the workspace");
  assert.equal(fenceDecision({hookEventName: "PreToolUse", cwd: root, toolName: "write", toolInput: {command: "create", path: scratchCard()}}).allow, true);
});

test("allows read-only tools and denies shell, code, MCP and unknown tools", () => {
  const root = workspace();
  for (const tool of ["read", "fs_read", "glob", "grep"]) assert.equal(fenceDecision({cwd: root, tool_name: tool, tool_input: {}}).allow, true, tool);
  for (const tool of ["shell", "execute_bash", "code", "use_aws", "@tripo/tripo_make", "mcp_github_create_issue", "orb-duel-review/act_showdown", "delegate", "web_fetch", ""]) {
    assert.equal(fenceDecision({cwd: root, tool_name: tool, tool_input: {command: "ls"}}).allow, false, tool || "(empty)");
  }
});

test("denies the real card directory, other files, traversal and non-cards", () => {
  const root = workspace();
  for (const path of [
    `${CARDS}/cowboy-sheriff.json`,
    ".artifacts/contest-balance/status.json",
    ".artifacts/contest-balance/attempt-1/receipt.json",
    ".artifacts/contest-balance/attempt-1/scratch/src/game/showdown/rules.js",
    `.artifacts/contest-balance/attempt-1/scratch/${CARDS}/../../../../${CARDS}/cowboy-sheriff.json`,
    `.artifacts/contest-balance/attempt-1/scratch/./${CARDS}/cowboy-sheriff.json`,
    `.artifacts/contest-balance/attempt-1//scratch/${CARDS}/cowboy-sheriff.json`,
    `.artifacts\\contest-balance\\attempt-1\\scratch\\${CARDS}\\cowboy-sheriff.json`,
    `~/${scratchCard()}`,
    "/etc/passwd",
    scratchCard(1, "wizard-spell"),
    scratchCard(1, "cowboy-new-card"),
    scratchCard(7),
  ]) assert.equal(write(root, path).allow, false, path);
});

test("denies symbolic links anywhere on the path, closed attempts and bad markers", () => {
  const linked = workspace();
  const card = join(linked, scratchCard());
  rmSync(card);
  symlinkSync(join(linked, CARDS, "cowboy-sheriff.json"), card);
  assert.match(write(linked, scratchCard()).reason, /symbolic link/);

  const dirLink = workspace();
  const cardsDir = join(dirLink, `.artifacts/contest-balance/attempt-1/scratch/${CARDS}`);
  rmSync(cardsDir, {recursive: true});
  symlinkSync(join(dirLink, CARDS), cardsDir);
  assert.equal(write(dirLink, scratchCard()).allow, false);

  assert.match(write(workspace({receipt: true}), scratchCard()).reason, /already reviewed/);
  assert.match(write(workspace({cards: []}), scratchCard()).reason, /not a whitelisted/);
  const wrong = workspace();
  writeFileSync(join(wrong, `.artifacts/contest-balance/attempt-1/scratch/${MARKER}`), JSON.stringify({schema: "contest-balance/scratch@1", attempt: 2, cards: ["cowboy-sheriff"]}));
  assert.equal(write(wrong, scratchCard()).allow, false);
});

test("fails closed on malformed events and unsupported write shapes", () => {
  const root = workspace();
  assert.equal(runHook("not json").allow, false);
  assert.equal(runHook("[]").allow, false);
  assert.equal(fenceDecision({cwd: root, tool_name: "fs_write"}).allow, false, "no input");
  assert.equal(fenceDecision({cwd: "relative", tool_name: "fs_write", tool_input: {path: scratchCard()}}).allow, false);
  assert.equal(fenceDecision({hook_event_name: "postToolUse", cwd: root, tool_name: "fs_write", tool_input: {path: scratchCard()}}).allow, false);
  assert.equal(write(root, scratchCard(), {command: "append"}).allow, false);
  assert.equal(write(root, scratchCard(), {paths: [scratchCard(), `${CARDS}/cowboy-sheriff.json`]}).allow, false);
  assert.equal(write(root, scratchCard(), {file_path: `${CARDS}/cowboy-sheriff.json`}).allow, false);
});

test("allows only a bounded send_message to the parent session", () => {
  const root = workspace();
  const send = (tool_input) => fenceDecision({hook_event_name: "preToolUse", cwd: root, tool_name: "send_message", tool_input});
  // The draft step's mandatory report after its guarded fs_write, as the native runtime sent it.
  const observed = {sessionId: "parent", message: `Edited ${scratchCard()}: attack 1 -> 2.`, severity: "success"};
  assert.equal(send(observed).allow, true, "observed step report");
  assert.equal(send({...observed, sessionIds: null}).allow, true, "nullable sessionIds left empty");
  assert.equal(send({sessionId: "parent", message: "progress"}).allow, true, "default severity");
  for (const [label, input] of [
    ["other session", {...observed, sessionId: "sess_5ccb7d79-f78c-4117-9cdf-136521d90cdf"}],
    ["missing destination", {message: observed.message, severity: "success"}],
    ["null destination", {...observed, sessionId: null}],
    ["sessionIds list", {...observed, sessionIds: ["parent"]}],
    ["sessionIds only", {message: observed.message, sessionIds: ["sess_other"]}],
    ["parent with odd case", {...observed, sessionId: "Parent"}],
    ["unknown severity", {...observed, severity: "critical"}],
    ["empty message", {...observed, message: "  "}],
    ["non-text message", {...observed, message: {text: "x"}}],
    ["oversized message", {...observed, message: "x".repeat(4001)}],
    ["extra field", {...observed, path: `${CARDS}/cowboy-sheriff.json`}],
    ["array input", [observed]],
    ["no input", undefined],
  ]) assert.equal(send(input).allow, false, label);
  assert.equal(write(root, `${CARDS}/cowboy-sheriff.json`).allow, false, "file writes stay guarded");
});

test("hook entry point exits 0 to allow and 2 to block", () => {
  const root = workspace();
  const script = new URL("../../scripts/contest-balance-fence.mjs", import.meta.url).pathname;
  const run = (event) => spawnSync(process.execPath, [script], {cwd: root, input: JSON.stringify(event), encoding: "utf8"});
  assert.equal(run({hook_event_name: "preToolUse", cwd: root, tool_name: "fs_write", tool_input: {command: "str_replace", path: scratchCard()}}).status, 0);
  const blocked = run({hook_event_name: "preToolUse", cwd: root, tool_name: "shell", tool_input: {command: "rm -rf ."}});
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /blocked/);
  assert.equal(run({hook_event_name: "preToolUse", cwd: root, tool_name: "send_message", tool_input: {sessionId: "parent", message: "done", severity: "success"}}).status, 0);
  assert.equal(run({hook_event_name: "preToolUse", cwd: root, tool_name: "send_message", tool_input: {sessionId: "sess_other", message: "done"}}).status, 2);
  assert.equal(spawnSync(process.execPath, [script], {cwd: root, input: "", encoding: "utf8"}).status, 2);
});

test("balancer agent profile is fenced and has no shell, code or MCP", () => {
  const profile = JSON.parse(readFileSync(new URL("../../.kiro/agents/showdown-balancer.json", import.meta.url), "utf8"));
  assert.deepEqual(profile.tools, ["read", "write"]);
  assert.equal(profile.mcpServers, undefined);
  assert.equal(profile.includeMcpJson, undefined);
  assert.equal(profile.allowedTools, undefined, "nothing is pre-approved around the fence");
  assert.ok(profile.permissions.rules.some((rule) => rule.capability === "shell" && rule.effect === "deny"));
  const hooks = profile.hooks.filter((hook) => hook.trigger === "PreToolUse");
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0].matcher, undefined, "the fence sees every tool call");
  assert.equal(hooks[0].action.command, "node scripts/contest-balance-fence.mjs");
});
