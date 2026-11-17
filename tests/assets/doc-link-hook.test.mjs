import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync, execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const hook = fileURLToPath(new URL("../../scripts/check-doc-links-hook.mjs", import.meta.url));
function fixture(t, exitCode = 0) {
  const root = mkdtempSync(path.join(tmpdir(), "doc-link-hook-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(path.join(root, "docs"));
  mkdirSync(path.join(root, "scripts"));
  writeFileSync(path.join(root, "docs/my saved note.md"), "# Tracked\n");
  writeFileSync(path.join(root, "docs/untracked.md"), "# Untracked\n");
  writeFileSync(path.join(root, "docs/*.md"), "# A literal untracked filename, not a Git glob\n");
  writeFileSync(path.join(root, "scripts/check-links.mjs"), `import {writeFileSync} from 'node:fs'; writeFileSync('checker-ran', 'yes'); console.log('checker stdout'); console.error('checker stderr'); process.exitCode = ${exitCode};\n`);
  execFileSync("git", ["init", "-q"], {cwd: root});
  execFileSync("git", ["add", "--", "docs/my saved note.md"], {cwd: root});
  return root;
}
function run(root, input) {
  const result = spawnSync(process.execPath, [hook], {cwd: root, input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8"});
  const lines = readFileSync(path.join(root, ".artifacts/doc-link-hook/receipts.jsonl"), "utf8").trim().split("\n");
  return {...result, receipt: JSON.parse(lines.at(-1))};
}
const event = (root, file_path) => ({session_id: "session-42", hook_event_name: "PostFileSave", cwd: root, file_path});

test("doc hook: tracked Markdown filename with spaces runs the checker and propagates failure", (t) => {
  const root = fixture(t, 7);
  const result = run(root, {...event(root, path.join(root, "docs/my saved note.md")), irrelevant_text: "docs/wrong.md"});
  assert.equal(result.status, 7);
  assert.match(result.stdout, /checker stdout/);
  assert.match(result.stderr, /checker stderr/);
  assert.equal(existsSync(path.join(root, "checker-ran")), true);
  assert.equal(result.receipt.file, "docs/my saved note.md");
  assert.equal(result.receipt.tracked, true);
  assert.equal(result.receipt.status, "failed");
  assert.equal(result.receipt.session_id, "session-42");
  assert.equal(result.receipt.hook_event_name, "PostFileSave");
  assert.ok(result.receipt.output.includes("checker stdout") && result.receipt.output.includes("checker stderr"));
  assert.ok(!JSON.stringify(result.receipt).includes("irrelevant_text"));
});

test("doc hook: valid relative documentation path records success", (t) => {
  const root = fixture(t);
  const result = run(root, event(root, "docs/my saved note.md"));
  assert.equal(result.status, 0);
  assert.equal(result.receipt.status, "passed");
});

test("doc hook: checkout aliases resolve without replacing a tracked symlink's name", (t) => {
  const root = fixture(t, 7);
  const parent = mkdtempSync(path.join(tmpdir(), "doc-link-hook-alias-"));
  t.after(() => rmSync(parent, {recursive: true, force: true}));
  const alias = path.join(parent, "checkout");
  symlinkSync(root, alias, "dir");
  const throughAlias = run(root, event(root, path.join(alias, "docs/my saved note.md")));
  assert.equal(throughAlias.status, 7);
  assert.equal(throughAlias.receipt.file, "docs/my saved note.md");
  assert.equal(throughAlias.receipt.tracked, true);
  assert.equal(throughAlias.receipt.status, "failed");

  symlinkSync("my saved note.md", path.join(root, "docs/linked note.md"));
  execFileSync("git", ["add", "--", "docs/linked note.md"], {cwd: root});
  const linked = run(root, event(root, path.join(alias, "docs/linked note.md")));
  assert.equal(linked.status, 7);
  assert.equal(linked.receipt.file, "docs/linked note.md");
  assert.equal(linked.receipt.tracked, true);
});

test("doc hook: malformed, untracked, outside and irrelevant events skip without running", (t) => {
  const root = fixture(t);
  const cases = [
    ["{broken", "skipped-malformed"],
    [[], "skipped-malformed"],
    [{...event(root, "docs/my saved note.md"), file_path: null}, "skipped-malformed"],
    [event(root, "docs/untracked.md"), "skipped-untracked"],
    [event(root, "docs/*.md"), "skipped-untracked"],
    [event(root, "../outside.md"), "skipped-outside"],
    [event(root, path.join(path.dirname(root), "outside.md")), "skipped-outside"],
    [event(root, "README.md"), "skipped-irrelevant"],
    [event(root, "docs/code.js"), "skipped-irrelevant"],
    [{...event(root, "docs/my saved note.md"), hook_event_name: "SessionStart"}, "skipped-irrelevant"],
  ];
  for (const [input, expected] of cases) {
    const result = run(root, input);
    assert.equal(result.status, 0);
    assert.equal(result.receipt.status, expected);
    assert.equal(result.receipt.tracked, false);
    assert.equal(existsSync(path.join(root, "checker-ran")), false);
    assert.ok(result.receipt.output.length <= 2000);
    assert.ok(!JSON.stringify(result.receipt).includes(root));
  }
});

test("doc hook: receipts bound checker output and redact the checkout path", (t) => {
  const root = fixture(t);
  writeFileSync(path.join(root, "scripts/check-links.mjs"), "console.log(process.cwd() + ' ' + 'x'.repeat(4000));\n");
  const {receipt, status} = run(root, event(root, "docs/my saved note.md"));
  assert.equal(status, 0);
  assert.equal(receipt.output.length, 2000);
  assert.match(receipt.output, /^<PROJECT_ROOT> /);
  assert.ok(!JSON.stringify(receipt).includes(root));
});
