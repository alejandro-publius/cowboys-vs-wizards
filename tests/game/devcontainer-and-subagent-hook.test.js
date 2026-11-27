// Tests for judge devcontainer, SubagentStop phase resolution & receipt guard, and Bonus Blog compliance (JCS-1..JCS-6).
import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {auditRepoReceipts, runStopGuard} from "../../scripts/check-subagent-stop.mjs";
import {PHASES, canonicalPhase, resolvePhase} from "../../scripts/saloon-activity.mjs";
import {measureHooks} from "../../scripts/scorecard.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("JCS-1: .devcontainer/devcontainer.json configures Node 22 + Python 3 with npm ci and zero secrets", () => {
  const raw = readFileSync(join(ROOT, ".devcontainer/devcontainer.json"), "utf8");
  const cfg = JSON.parse(raw);
  assert.match(cfg.image, /javascript-node:1-22/);
  assert.ok(cfg.features["ghcr.io/devcontainers/features/python:1"]);
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

test("JCS-3 & JCS-4: check-subagent-stop skips re-entry, passes real repo receipts, and catches tampered seals", (t) => {
  assert.equal(runStopGuard({env: {SUBAGENT_GUARD_ACTIVE: "1"}}).skipped, true);
  assert.equal(runStopGuard({stdinText: JSON.stringify({hook_event_name: "Stop", stop_hook_active: true})}).skipped, true);

  const okRun = runStopGuard({
    stdinText: JSON.stringify({hook_event_name: "SubagentStop"}),
    configuredTrigger: "Stop",
    env: {},
    root: ROOT,
  });
  assert.equal(okRun.skipped, false);
  assert.equal(okRun.code, 0);
  assert.equal(okRun.summary.phase, "Stop");
  assert.equal(okRun.summary.deliveredEvent, "SubagentStop");
  assert.ok(okRun.summary.sealedBundles >= 1);
  assert.equal(okRun.summary.tamperedCount, 0);
  assert.equal(okRun.summary.propertyRejectedCount, 0);

  // Tampered bundle is caught and fails closed
  const dir = mkdtempSync(join(tmpdir(), "cvw-subagent-guard-"));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const realBundlePath = "docs/evidence/night-shift-review/cowboy-sheriff-health-3-to-4-2417d71c-fd2e069/bundle.json";
  const tampered = JSON.parse(readFileSync(join(ROOT, realBundlePath), "utf8"));
  tampered.decision.verdict = "accepted";
  const target = join(dir, "docs/evidence/tampered/bundle.json");
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, JSON.stringify(tampered));

  const badAudit = auditRepoReceipts(dir);
  assert.equal(badAudit.ok, false);
  assert.equal(badAudit.tamperedBundles.length, 1);
});

test("JCS-5: subagent-stop-receipt-guard.json passes scorecard measureHooks with zero problems", () => {
  const hooks = measureHooks(ROOT);
  assert.equal(hooks.pass, true);
  assert.deepEqual(hooks.details.problems, []);
  assert.ok(hooks.details.triggers.Stop.includes("CLI subagent-stop-receipt-guard.json"));
});

test("JCS-6: publishable section of docs/submission/build-story.md includes exact Bonus Blog eligibility phrase", () => {
  const story = readFileSync(join(ROOT, "docs/submission/build-story.md"), "utf8");
  const publishable = story.split("<!-- PUBLISH START -->")[1]?.split("<!-- PUBLISH END -->")[0] ?? "";
  assert.match(publishable, /being written as part of the Kiroween 2026 hackathon/);
});
