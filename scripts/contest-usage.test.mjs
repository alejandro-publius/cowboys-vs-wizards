// node --test scripts/contest-usage.test.mjs  (offline, no npm packages)
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildRecord, parseReceipts, renderInto, sessionOf, toolCategory, BEGIN, END} from "./contest-usage-lib.mjs";
import {recognizeLicense, linkProblem, runChecks} from "./contest-submission-check.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const SECRET = "sk-live-DO-NOT-STORE alex@example.com /Users/someone/private";
const ctx = (now) => ({now, root: "/r", envSession: null, cwdReal: (p) => p});
const DOC = `# t\n\n${BEGIN}\n| Receipt | Session |\n| --- | --- |\n${END}\n`;

test("sanitizers keep only fixed categories and safe session IDs", () => {
  assert.equal(toolCategory("fs_write"), "write");
  assert.equal(toolCategory("@orb-duel-review/inspect_duel_replay"), "mcp");
  assert.equal(toolCategory("something_new"), "other");
  assert.equal(sessionOf("sess_ab-12"), "sess_ab-12");
  assert.equal(sessionOf("alex@example.com"), null);
  assert.equal(sessionOf("a b"), null);
});

test("Stop folds tool categories and never stores values", () => {
  const prior = [];
  const s = "sess_1";
  for (const [t, name] of [[1000, "fs_read"], [2000, "execute_bash"], [3000, "fs_read"]]) {
    prior.push(buildRecord({hook_event_name: "PostToolUse", session_id: s, tool_name: name, tool_input: {command: SECRET}, prompt: SECRET}, prior, ctx(t)));
  }
  const stop = buildRecord({hook_event_name: "Stop", session_id: s, cwd: "/r", prompt: SECRET}, prior, ctx(4000));
  assert.equal(stop.turn, 1);
  assert.deepEqual(stop.tools, {read: 2, shell: 1});
  assert.equal(stop.flags.cwd_is_checkout, true);
  assert.deepEqual(stop.flags.fields, ["cwd", "hook_event_name", "prompt", "session_id"]);
  const all = JSON.stringify([...prior, stop]);
  for (const bad of ["sk-live", "example.com", "/Users/", "execute_bash", "fs_read"]) assert.ok(!all.includes(bad), bad);
});

test("a repeated Stop for the same turn is skipped; a later turn counts", () => {
  const first = buildRecord({hook_event_name: "Stop", session_id: "s"}, [], ctx(10_000));
  assert.equal(buildRecord({hook_event_name: "Stop", session_id: "s"}, [first], ctx(11_000)), null);
  const second = buildRecord({hook_event_name: "Stop", session_id: "s"}, [first], ctx(20_000));
  assert.equal(second.turn, 2);
  assert.notEqual(second.id, first.id);
});

test("malformed and unrelated events record only the hook action", () => {
  assert.deepEqual(buildRecord(null, [], ctx(0)).actions, ["skipped-malformed"]);
  assert.deepEqual(buildRecord({hook_event_name: "UserPromptSubmit", prompt: SECRET}, [], ctx(0)).actions, ["skipped-irrelevant"]);
  assert.ok(!JSON.stringify(buildRecord({hook_event_name: "X", prompt: SECRET}, [], ctx(0))).includes("sk-live"));
});

test("render is append-only and idempotent", () => {
  const a = buildRecord({hook_event_name: "Stop", session_id: "s"}, [], ctx(10_000));
  const b = buildRecord({hook_event_name: "Stop", session_id: "s"}, [a], ctx(30_000));
  const once = renderInto(DOC, [a]);
  assert.equal(once.added, 1);
  assert.deepEqual(renderInto(once.text, [a]), {text: once.text, added: 0});
  const edited = once.text.replace("|  |\n", "| screenshot |\n"); // a human note
  const twice = renderInto(edited, [b, a, a]);
  assert.equal(twice.added, 1);
  assert.ok(twice.text.includes("| screenshot |"));
  assert.equal(renderInto(twice.text, []).text, twice.text); // lost receipts delete nothing
  assert.ok(twice.text.indexOf(a.id) < twice.text.indexOf(b.id));
  assert.throws(() => renderInto("no markers", [a]));
});

test("the hook command writes one receipt line and exits 0", () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "contest-usage-")));
  try {
    const run = (event) => spawnSync(process.execPath, [path.join(here, "contest-usage.mjs")], {cwd: dir, input: event, encoding: "utf8", env: {...process.env, KIRO_SESSION_ID: "sess_x"}});
    assert.equal(run(JSON.stringify({hook_event_name: "PostToolUse", session_id: "sess_x", tool_name: "fs_write", tool_input: SECRET})).status, 0);
    assert.equal(run(JSON.stringify({hook_event_name: "Stop", session_id: "sess_x", cwd: dir})).status, 0);
    assert.equal(run("not json").status, 0);
    const text = readFileSync(path.join(dir, ".artifacts/kiro-contest-usage/receipts.jsonl"), "utf8");
    const rows = parseReceipts(text);
    assert.deepEqual(rows.map((r) => r.actions[0]), ["recorded-tool", "recorded-stop", "skipped-malformed"]);
    assert.deepEqual(rows[1].tools, {write: 1});
    assert.equal(rows[1].flags.env_session_matches, true);
    assert.equal(rows[1].flags.cwd_is_checkout, true);
    assert.ok(!text.includes("sk-live"));
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("license recognition", () => {
  assert.deepEqual(recognizeLicense(readFileSync(path.join(repo, "LICENSE"), "utf8")), {id: "MIT", osi: true});
  assert.equal(recognizeLicense("Apache License\n Version 2.0, January 2004").id, "Apache-2.0");
  assert.equal(recognizeLicense("All rights reserved."), null);
});

test("link form checks", () => {
  assert.equal(linkProblem("demo", "https://www.youtube.com/watch?v=abcdefghijk"), null);
  assert.equal(linkProblem("demo", "https://youtu.be/abcdefghijk"), null);
  assert.equal(linkProblem("demo", "https://vimeo.com/1"), "not a YouTube host");
  assert.equal(linkProblem("demo", "http://youtu.be/abcdefghijk"), "must use https");
  assert.equal(linkProblem("repo", "https://github.com/o/r"), null);
  assert.equal(linkProblem("repo", "https://github.com/o"), "not an owner/repo URL");
  assert.equal(linkProblem("site", "https://o.github.io/r/"), null);
});

test("submission check on a scratch repository", (t) => {
  if (spawnSync("git", ["--version"]).status !== 0) return t.skip("git unavailable");
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "contest-check-")));
  try {
    const g = (...a) => assert.equal(spawnSync("git", a, {cwd: dir}).status, 0, a.join(" "));
    g("init", "-q");
    mkdirSync(path.join(dir, ".kiro/hooks"), {recursive: true});
    mkdirSync(path.join(dir, "docs"));
    writeFileSync(path.join(dir, ".kiro/hooks/a.json"), "{}");
    writeFileSync(path.join(dir, "LICENSE"), readFileSync(path.join(repo, "LICENSE")));
    writeFileSync(path.join(dir, "docs/KIRO_USAGE.md"), DOC);
    writeFileSync(path.join(dir, "README.md"), "Demo: https://youtu.be/abcdefghijk\n");
    g("add", ".");
    const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i]));
    let r = byId(runChecks(dir, {demo: "https://youtu.be/abcdefghijk"}));
    assert.equal(r["kiro-tracked"].status, "pass");
    assert.equal(r["kiro-not-ignored"].status, "pass");
    assert.match(r.license.detail, /MIT/);
    assert.equal(r["demo-link"].status, "pass");
    assert.equal(r["site-link"].kind, "human");
    writeFileSync(path.join(dir, ".gitignore"), ".kiro/\n");
    writeFileSync(path.join(dir, ".kiro/hooks/b.json"), "{");
    g("add", "-f", ".kiro/hooks/b.json");
    r = byId(runChecks(dir, {demo: "https://youtu.be/zzzzzzzzzzz"}));
    assert.equal(r["kiro-not-ignored"].status, "fail");
    assert.equal(r["kiro-json"].status, "fail");
    assert.equal(r["demo-link"].status, "fail");
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
