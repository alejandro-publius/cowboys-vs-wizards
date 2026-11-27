// Tests for Showdown Wanted bounty draft verification and preview repair agent ownership (SBP-1..SBP-8, PM3).
import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {REPAIR_AGENT_OWNERS, repairsFrom, verifyRepairAgentFence} from "../../scripts/maintain-showdown-preview.mjs";
import {classifyAgent, measureAgents} from "../../scripts/scorecard.mjs";
import {
  AUTHOR_AGENT,
  DEFAULT_PACKAGE,
  REVIEWER_AGENT,
  checkGuardPayload,
  validateBountySchema,
  verifyBountyPackage,
} from "../../scripts/verify-showdown-bounty-draft.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function tempDir(t, files) {
  const dir = mkdtempSync(join(tmpdir(), "cvw-bounty-draft-"));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), {recursive: true});
    writeFileSync(full, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

test("SBP-1 / PM3: maintain-showdown-preview verifies repair agent single-file ownership and rejects mismatched or shell profiles", async (t) => {
  const realMap = await repairsFrom(ROOT);
  assert.equal(realMap.size, 2);
  for (const task of realMap.values()) {
    assert.equal(REPAIR_AGENT_OWNERS[task.agent], task.file);
  }

  // Rejects an agent assigned to the wrong file
  await assert.rejects(
    () => verifyRepairAgentFence(ROOT, {agent: "showdown-camp-maintainer", file: "src/ui/showdown-3d/gallery.js"}),
    /not pinned/
  );

  // Rejects a profile that adds shell access or broad write paths
  const badRoot = tempDir(t, {
    ".kiro/agents/showdown-camp-maintainer.json": {
      name: "showdown-camp-maintainer",
      tools: ["read", "write", "shell"],
      permissions: {rules: [{capability: "fs_write", match: ["src/app.js"], effect: "allow"}]},
    },
  });
  await assert.rejects(
    () => verifyRepairAgentFence(badRoot, {agent: "showdown-camp-maintainer", file: "src/app.js"}),
    /without shell tools/
  );
});

test("SBP-2 & SBP-3: showdown-bounty-drafter is a protected writer and showdown-bounty-reviewer is a fenced read-only verifier", () => {
  const drafter = JSON.parse(readFileSync(join(ROOT, `.kiro/agents/${AUTHOR_AGENT}.json`), "utf8"));
  const reviewer = JSON.parse(readFileSync(join(ROOT, `.kiro/agents/${REVIEWER_AGENT}.json`), "utf8"));
  assert.equal(classifyAgent(drafter, true).class, "protected");
  assert.deepEqual(classifyAgent(drafter, true).paths, ["tasks/showdown-bounties/**"]);
  assert.equal(classifyAgent(reviewer, true).class, "read-only");

  // PreToolUse guard enforces path and tool bounds
  assert.equal(checkGuardPayload({tool_name: "fs_write", tool_input: {path: "tasks/showdown-bounties/bone-marshal/bounty.json"}}, ROOT).allow, true);
  assert.equal(checkGuardPayload({tool_name: "fs_write", tool_input: {path: "src/game/showdown/rules.js"}}, ROOT).allow, false);
  assert.equal(checkGuardPayload({tool_name: "execute_bash", tool_input: {command: "ls"}}, ROOT).allow, false);
});

test("SBP-4, SBP-5, SBP-6: validateBountySchema rejects duplicate IDs, illegal escort decks, and non-monotonic hunts", () => {
  const valid = JSON.parse(readFileSync(join(ROOT, DEFAULT_PACKAGE, "bounty.json"), "utf8"));
  assert.deepEqual(validateBountySchema(valid), []);

  // Duplicate shipped bounty ID
  assert.ok(validateBountySchema({...valid, id: "lantern-wraith"}).some((p) => /collides/.test(p)));

  // Escort deck wrong size or Cowboy card
  assert.ok(validateBountySchema({...valid, deck: {"wizard-skeleton": 10}}).some((p) => /total 16/.test(p)));
  assert.ok(validateBountySchema({...valid, deck: {...valid.deck, "cowboy-sheriff": 1, "wizard-hex": 0}}).some((p) => /positive integer|not a Wizard/.test(p)));

  // Decreasing boss orbs across stages
  const nonMonotone = structuredClone(valid);
  nonMonotone.hunts[3].orbs = 2;
  assert.ok(validateBountySchema(nonMonotone).some((p) => /decreases below/.test(p)));
});

test("SBP-4 & SBP-7: verifyBountyPackage validates the tracked Bone Marshal draft and simulates all 5 hunts", (t) => {
  const res = verifyBountyPackage(DEFAULT_PACKAGE, {root: ROOT, seeds: 16});
  assert.equal(res.ok, true, res.problems.join("; "));
  assert.equal(res.stages.length, 5);
  for (const stage of res.stages) {
    assert.ok(stage.cowboyWins >= 1, `hunt ${stage.hunt} must have at least one Cowboy win`);
    assert.equal(stage.cowboyWins + stage.wizardWins + stage.draws, 16);
  }

  // Missing human art-approval gate in portrait-brief.md is rejected
  const unapproved = tempDir(t, {
    "pkg/bounty.json": readFileSync(join(ROOT, DEFAULT_PACKAGE, "bounty.json"), "utf8"),
    "pkg/reward.md": readFileSync(join(ROOT, DEFAULT_PACKAGE, "reward.md"), "utf8"),
    "pkg/portrait-brief.md": "Generate a new portrait immediately via API.",
    "pkg/model-brief.md": readFileSync(join(ROOT, DEFAULT_PACKAGE, "model-brief.md"), "utf8"),
  });
  const rejected = verifyBountyPackage("pkg", {root: unapproved, seeds: 4});
  assert.equal(rejected.ok, false);
  assert.ok(rejected.problems.some((p) => /portrait-brief\.md.*approval/.test(p)));
});

test("SBP-8: scorecard measureAgents reaches >= 8 active protected agents with zero unprotected writers", () => {
  const row = measureAgents(ROOT);
  assert.equal(row.pass, true, row.reason);
  assert.ok(row.value >= 8, `expected >= 8 protected agents, got ${row.value}`);
  const unprotected = row.details.agents.filter((a) => a.class === "unprotected-writer");
  assert.deepEqual(unprotected, []);
});
