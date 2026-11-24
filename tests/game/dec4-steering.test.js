// Static checks of the Dec 4 steering contract in .kiro/steering/goal.md. No Kiro session runs here,
// so a pass shows what the file configures, not that a native session loads it.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const flat = (text) => text.replace(/\s+/g, " ");
const goal = read(".kiro/steering/goal.md");
const rows = Object.fromEntries(
  [...goal.matchAll(/^\| ([a-z][a-z-]*) \| ([^|]+) \| ([^|]+) \|$/gm)].map(([, line, target, source]) => [line, { target, source }]),
);

test("goal.md is always-on steering within a 4 KiB budget", () => {
  assert.match(goal, /^---\ninclusion: always\n---\n/);
  // Every session pays for always-on steering, so growing past the budget should be a deliberate edit here.
  assert.ok(Buffer.byteLength(goal) <= 4096, `${Buffer.byteLength(goal)} bytes`);
});

test("the scorecard lists exactly the Dec 4 lines with the user's counts", () => {
  assert.deepEqual(Object.keys(rows), ["submit", "credits", "category", "loop-prs", "reviews", "duels", "card-band", "properties", "scoping", "second-game"]);
  assert.match(rows["loop-prs"].target, /^300 PRs .*native Kiro loop/);
  assert.match(rows.reviews.target, /^100 reviews,/);
  assert.match(rows.duels.target, /^10,000,000 simulated duels:/);
  assert.match(rows["card-band"].target, /per-card band/);
  assert.match(rows.properties.target, /^100 distinct properties,/);
  assert.match(rows.scoping.target, /native hook and agent/);
  assert.match(rows["second-game"].target, /^A second game live on the public site, .*`src\/review\/paired-duel-kit\.js`/);
  for (const line of ["submit", "credits", "category"]) assert.equal(rows[line].source, "human");
});

test("the deadline, credit and category clauses are quoted exactly from rules-check.md", () => {
  const rules = flat(read("docs/submission/rules-check.md"));
  for (const clause of [
    "December 4, 2:00 pm Pacific",
    "No extensions will be granted.",
    "4,000 Kiro credits",
    "by Tuesday, December 1, 2026 at 12:00 pm Pacific Time",
    "allow 48 business hours",
    "redeemed by December 4",
    "Category and bonus categories identified",
    "Costume Contest",
  ]) {
    assert.ok(flat(goal).includes(clause), `goal.md lacks: ${clause}`);
    assert.ok(rules.includes(clause), `rules-check.md lacks: ${clause}`);
  }
});

test("every path and requirement ID the steering cites exists", () => {
  for (const [, token] of goal.matchAll(/`([^`\s]*\/[^`\s]*)`/g)) {
    assert.ok(existsSync(new URL(token.split("*")[0], root)), `missing path: ${token}`);
  }
  const specs = readdirSync(new URL(".kiro/specs/", root))
    .flatMap((name) => ["requirements.md", "bugfix.md"].map((file) => `.kiro/specs/${name}/${file}`))
    .filter((path) => existsSync(new URL(path, root)))
    .map((path) => read(path))
    .join("\n");
  const ids = [...goal.matchAll(/`([A-Z]+-\d+)`/g)].map(([, id]) => id);
  assert.ok(ids.length > 0, "goal.md cites no requirement ID");
  for (const id of ids) assert.match(specs, new RegExp(`\\b${id}\\b`), `no spec defines ${id}`);
});

test("the balancer's only allowed writes are card spec JSON files", () => {
  const { rules } = JSON.parse(read(".kiro/agents/showdown-balancer.json")).permissions;
  const allowed = rules.filter((rule) => rule.effect === "allow");
  assert.ok(allowed.every((rule) => rule.capability === "fs_read" || rule.capability === "fs_write"));
  const writes = allowed.filter((rule) => rule.capability === "fs_write").flatMap((rule) => rule.match);
  assert.ok(writes.length > 0);
  for (const glob of writes) assert.match(glob, /(^|\/)\.kiro\/specs\/duel-card-pipeline\/cards\/\*\.json$/);
  assert.ok(rules.some((rule) => rule.capability === "shell" && rule.effect === "deny" && rule.match.includes("*")));
});

test("the task rules, regression-only stop policy and load status are stated", () => {
  const text = flat(goal);
  for (const clause of [
    "Each commit message cites a real requirement ID",
    "Scorecard line names are not requirement IDs.",
    "The balancer writes only `.kiro/specs/duel-card-pipeline/cards/*.json`.",
    "`src/game/` changes only for a requirement of a spec approved in writing",
    "no hook or script enforces it yet",
    "A line that passed at base and does not pass at head fails the task.",
    "A missing or unmeasurable value does not pass.",
    "A line already failing at base never blocks a task.",
    "Unmet project-wide targets must not freeze unrelated work.",
    "Never edit a line, its threshold or its source to make a task pass.",
    "`steering_inclusion` event naming `goal.md`",
  ]) assert.ok(text.includes(clause), `goal.md lacks: ${clause}`);
  // The observed status changes after native verification; only the split between the two is fixed.
  assert.match(text, /Configured: the front matter above sets `inclusion: always`\. Observed: /);
});
