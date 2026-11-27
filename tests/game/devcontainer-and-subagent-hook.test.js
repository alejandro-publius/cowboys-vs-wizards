// Tests for judge devcontainer, SubagentStop phase resolution & receipt guard, and Bonus Blog compliance (JCS-1..JCS-6).
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {auditRepoReceipts, runStopGuard} from "../../scripts/check-subagent-stop.mjs";
import {PHASES, canonicalPhase, resolvePhase} from "../../scripts/saloon-activity.mjs";
import {measureHooks} from "../../scripts/scorecard.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("JCS-1: .devcontainer/devcontainer.json configures Node 22 + Python 3 with npm ci and zero secrets", () => {
  const raw = readFileSync(join(ROOT, ".devcontainer/devcontainer.json"), "utf8");
  const cfg = JSON.parse(raw);
  assert.equal(cfg.image, "mcr.microsoft.com/devcontainers/javascript-node:22-bookworm");
  assert.equal(cfg.features["ghcr.io/devcontainers/features/python:1"].version, "3.12");
  assert.equal(cfg.postCreateCommand, "npm ci");
  assert.deepEqual(cfg.forwardPorts, [4179, 8080]);
  assert.equal(/(?:api[_-]?key|secret|token|password)/i.test(raw), false);
});

test("JCS-2: canonicalPhase maps Kiro CLI 3.6 SubagentStop onto Stop while keeping 14 canonical PHASES", () => {
  assert.equal(PHASES.length, 14);
  assert.equal(canonicalPhase("SubagentStop"), "Stop");
  assert.equal(canonicalPhase("subagent_stop"), "Stop");
  assert.equal(resolvePhase({hook_event_name: "SubagentStop"}, "Stop"), "Stop");
});

const git = (cwd, ...args) => execFileSync("git", args, {cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]}).trim();
const propertyPath = "reports/properties/latest.json";
const bundlePath = "docs/evidence/fixture/bundle.json";
const commit = (cwd, message) => git(cwd, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", message);
function write(root, path, text) {
  mkdirSync(dirname(join(root, path)), {recursive: true});
  writeFileSync(join(root, path), text);
}

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), "cvw-stop-guard-"));
  t.after(() => rmSync(base, {recursive: true, force: true}));
  const source = join(base, "source");
  git(base, "init", "-q", source);
  const file = "tests/game/fixture.test.js";
  write(source, file, 'import fc from "fast-check";');
  git(source, "add", ".");
  commit(source, "Fixture source");
  const receipt = {
    schema: "cvw-property-receipt/1",
    commit: git(source, "rev-parse", "HEAD"),
    properties: [{id: "P1", file, status: "passed", numRuns: 25, seed: 1}],
  };
  const bundle = readFileSync(join(ROOT, "docs/evidence/night-shift-review/cowboy-sheriff-health-3-to-4-2417d71c-fd2e069/bundle.json"), "utf8");
  write(source, bundlePath, bundle);
  write(source, propertyPath, JSON.stringify(receipt));
  git(source, "add", ".");
  commit(source, "Fixture receipts");
  return {base, source, receipt, bundle};
}

test("JCS-3: the guard skips re-entry and unrelated events", () => {
  for (const input of [
    {env: {SUBAGENT_GUARD_ACTIVE: "1"}},
    {stdinText: '{"hook_event_name":"Stop","stop_hook_active":true}'},
    {stdinText: '{"hook_event_name":"PreToolUse"}'},
  ]) {
    assert.deepEqual(runStopGuard({...input, root: "/missing-checkout"}), {skipped: true, code: 0, output: ""});
  }
});

test("JCS-4: missing or edited committed bundles and missing, empty or rejected property runs fail", (t) => {
  const {source, receipt, bundle} = fixture(t);
  assert.equal(auditRepoReceipts(source).ok, true);
  for (const edit of [{schema: "other"}, {bundleSha256: "bad"}]) {
    write(source, bundlePath, JSON.stringify({...JSON.parse(bundle), ...edit}));
    assert.equal(auditRepoReceipts(source).tamperedBundles.length, 1);
  }
  rmSync(join(source, bundlePath));
  assert.equal(auditRepoReceipts(source).tamperedBundles.length, 1);
  write(source, bundlePath, bundle);
  for (const value of ["{", JSON.stringify({...receipt, properties: []}), JSON.stringify({...receipt, properties: [{id: "P1", status: "failed"}]})]) {
    write(source, propertyPath, value);
    const result = runStopGuard({root: source});
    assert.equal(result.code, 1);
    assert.equal(result.summary.propertyRejectedCount, 1);
    assert.ok(result.summary.problems[0].includes(propertyPath));
  }
  rmSync(join(source, propertyPath));
  assert.equal(auditRepoReceipts(source).ok, false);
});

test("JCS-4: a depth-one clone verifies the cited commit only after it is fetched", (t) => {
  const {base, source, receipt} = fixture(t);
  const shallow = join(base, "shallow");
  git(base, "clone", "-q", "--depth=1", pathToFileURL(source).href, shallow);
  assert.equal(git(shallow, "rev-parse", "--is-shallow-repository"), "true");
  const before = auditRepoReceipts(shallow);
  assert.equal(before.ok, false);
  assert.equal(before.propertyPassed, 0);
  assert.equal(before.propertyRejected[0].reason, "commit is not a commit in this repository");
  git(shallow, "fetch", "--no-tags", "--depth=1", "origin", receipt.commit);
  assert.equal(git(shallow, "cat-file", "-t", receipt.commit), "commit");
  assert.equal(auditRepoReceipts(shallow).ok, true);
  const laterTest = "tests/game/added-after-run.test.js";
  write(shallow, laterTest, 'import fc from "fast-check";');
  write(shallow, propertyPath, JSON.stringify({...receipt, properties: [{...receipt.properties[0], file: laterTest}]}));
  const missingSource = auditRepoReceipts(shallow);
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.propertyPassed, 0);
  assert.match(missingSource.propertyRejected[0].reason, /not a fast-check source at/);
  write(shallow, propertyPath, JSON.stringify({...receipt, commit: "f".repeat(40)}));
  assert.equal(auditRepoReceipts(shallow).ok, false);
});

test("JCS-5: ordinary Stop is installed and the opt-in SubagentStop registration runs its documented command", (t) => {
  const hooks = measureHooks(ROOT);
  assert.equal(hooks.pass, true);
  assert.deepEqual(hooks.details.problems, []);
  assert.ok(hooks.details.triggers.Stop.includes("CLI stop-receipt-guard.json"));

  const root = mkdtempSync(join(tmpdir(), "cvw-hook-registration-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, ".kiro/hooks"), {recursive: true});
  const example = ".kiro/examples/hooks/subagent-stop-receipt-guard.json";
  write(root, example, readFileSync(join(ROOT, example)));
  symlinkSync(join(ROOT, "scripts"), join(root, "scripts"), "dir");
  execFileSync("cp", [example, ".kiro/hooks/"], {cwd: root});
  assert.deepEqual(measureHooks(root).details.problems, []);
  for (const [dir, file, trigger] of [
    [ROOT, "stop-receipt-guard.json", "Stop"],
    [root, "subagent-stop-receipt-guard.json", "SubagentStop"],
  ]) {
    const config = JSON.parse(readFileSync(join(dir, ".kiro/hooks", file), "utf8"));
    assert.equal(config.version, "v1");
    assert.equal(config.hooks.length, 1);
    const [hook] = config.hooks;
    assert.equal(hook.trigger, trigger);
    assert.equal(hook.action.type, "command");
    assert.equal(hook.action.command, `node scripts/check-subagent-stop.mjs ${trigger}`);
    const [command, ...args] = hook.action.command.split(" ");
    const result = spawnSync(command, args, {cwd: ROOT, input: JSON.stringify({hook_event_name: trigger}), encoding: "utf8"});
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.deliveredEvent, trigger);
    assert.equal(report.phase, "Stop");
    assert.ok(report.sealedBundles > 0);
    assert.ok(report.propertyPassed > 0);
    assert.equal(report.propertyRejectedCount, 0);
  }
});

test("JCS-6: publishable section of docs/submission/build-story.md includes exact Bonus Blog eligibility phrase", () => {
  const story = readFileSync(join(ROOT, "docs/submission/build-story.md"), "utf8");
  const publishable = story.split("<!-- PUBLISH START -->")[1]?.split("<!-- PUBLISH END -->")[0] ?? "";
  assert.match(publishable, /being written as part of the Kiroween 2026 hackathon/);
});
