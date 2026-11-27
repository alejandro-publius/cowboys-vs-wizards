// Tests for Showdown Wanted bounty draft verification and preview repair agent ownership (SBP-1..SBP-8, PM3).
import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {REPAIR_AGENT_OWNERS, repairsFrom, verifyRepairAgentFence} from "../../scripts/maintain-showdown-preview.mjs";
import {classifyAgent, measureAgents} from "../../scripts/scorecard.mjs";
import {
  AUTHOR_AGENT,
  DEFAULT_PACKAGE,
  REVIEWER_AGENT,
  REQUIRED_FILES,
  selectedBounty,
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

  const agent = "showdown-camp-maintainer";
  const file = "src/app.js";
  const profilePath = `.kiro/agents/${agent}.json`;
  const profile = JSON.parse(readFileSync(join(ROOT, profilePath), "utf8"));
  const [writeRule] = profile.permissions.rules;
  for (const [change, message] of [
    [{tools: ["read", "write", "shell"]}, /only file read and write tools/],
    [{tools: ["read", "write", "unreviewed-tool"]}, /only file read and write tools/],
    [{name: "other-profile"}, /profile configuration/],
    [{includeMcpJson: true}, /profile configuration/],
    [{hooks: []}, /profile configuration/],
    [{permissions: {rules: [{...writeRule, match: [file, "src/other.js"]}]}}, /allowlist/],
    [{permissions: {rules: [writeRule, {...writeRule, match: file}]}}, /allowlist/],
  ]) {
    const badRoot = tempDir(t, {[profilePath]: {...profile, ...change}});
    await assert.rejects(() => verifyRepairAgentFence(badRoot, {agent, file}), message);
  }
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

test("the two workflow roles use the same selected draft and only the reviewer runs the fixed commands", (t) => {
  const brief = {id: "test-rider", brief: "Test a rider using the existing post-Trail deck."};
  const root = tempDir(t, {"tasks/showdown-bounties/active-brief.json": brief});
  const target = "tasks/showdown-bounties/test-rider";
  assert.deepEqual(selectedBounty(root), {targetDir: target, brief: brief.brief});
  const write = (path) => ({toolName: "fs_write", toolInput: {command: "create", path, file_text: "a draft"}});
  for (const name of REQUIRED_FILES) assert.equal(checkGuardPayload(write(`${target}/${name}`), root).allow, true);
  assert.equal(checkGuardPayload(write(`${DEFAULT_PACKAGE}/reward.md`), root).allow, false);
  assert.equal(checkGuardPayload(write(`${target}/reward.md`), root, "reviewer").allow, false);
  assert.equal(checkGuardPayload({}, root).allow, false);
  symlinkSync(root, join(root, target), "dir");
  assert.equal(checkGuardPayload(write(`${target}/reward.md`), root).allow, false);

  const reviewer = JSON.parse(readFileSync(join(ROOT, `.kiro/agents/${REVIEWER_AGENT}.json`), "utf8"));
  assert.ok(reviewer.hooks.some((h) => h.trigger === "PreToolUse" && h.action?.command === "node scripts/verify-showdown-bounty-draft.mjs guard reviewer"));
  const commands = reviewer.permissions.rules.find((r) => r.capability === "shell").match;
  for (const command of commands) {
    const event = {tool_name: "execute_bash", tool_input: {command, cwd: ".", run_in_background: false}};
    assert.equal(checkGuardPayload(event, ROOT, "reviewer").allow, true);
    assert.equal(checkGuardPayload(event, ROOT).allow, false);
  }
  const other = {tool_name: "execute_bash", tool_input: {command: "node --version"}};
  assert.equal(checkGuardPayload(other, ROOT, "reviewer").allow, false);
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
    assert.equal(stage.cowboyWinRate, stage.cowboyWins / 16);
  }

  // Missing human art-approval gate in portrait-brief.md is rejected
  const files = Object.fromEntries(REQUIRED_FILES.map((name) => [
    `${DEFAULT_PACKAGE}/${name}`, readFileSync(join(ROOT, DEFAULT_PACKAGE, name), "utf8"),
  ]));
  const root = tempDir(t, files);
  const check = () => verifyBountyPackage(DEFAULT_PACKAGE, {root, seeds: 4});
  const replace = (name, contents) => writeFileSync(join(root, DEFAULT_PACKAGE, name), contents);
  replace("portrait-brief.md", "Generate a new portrait immediately via API.");
  assert.match(check().problems.join(" "), /portrait-brief\.md.*approval/);
  replace("portrait-brief.md", files[`${DEFAULT_PACKAGE}/portrait-brief.md`]);
  replace("bounty.json", "null");
  assert.match(check().problems.join(" "), /must be a JSON object/);
  const other = {...JSON.parse(files[`${DEFAULT_PACKAGE}/bounty.json`]), id: "another-rider"};
  replace("bounty.json", JSON.stringify(other));
  assert.match(check().problems.join(" "), /match its package directory/);

});

test("SBP-8: scorecard measureAgents reaches >= 8 active protected agents with zero unprotected writers", () => {
  const row = measureAgents(ROOT);
  assert.equal(row.pass, true, row.reason);
  assert.ok(row.value >= 8, `expected >= 8 protected agents, got ${row.value}`);
  const unprotected = row.details.agents.filter((a) => a.class === "unprotected-writer");
  assert.deepEqual(unprotected, []);
});
