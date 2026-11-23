import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, test} from "node:test";
import {POLICY, STATUS, cardChange, compareTrees, decideAttempt, disjoint, parseRange, perCardCohorts, shares} from "../../scripts/contest-balance.mjs";
import {MAX_ATTEMPTS} from "../../scripts/contest-balance-fence.mjs";
import {paired} from "../../scripts/night-review.mjs";

const SHERIFF = '{ "type": "cowboy-sheriff", "side": "cowboy", "order": 1, "name": "Sheriff", "kind": "troop", "stars": 2, "health": 3, "attack": 1, "copies": 6, "showdown": { "rarity": "basic", "tag": "Lawman", "keys": [] } }\n';
const dirs = [];
after(() => { for (const dir of dirs) rmSync(dir, {recursive: true, force: true}); });

test("accepts exactly one whitelisted number on a troop, byte-for-byte", () => {
  const ok = cardChange(SHERIFF, SHERIFF.replace('"attack": 1', '"attack": 2'), {card: "cowboy-sheriff"});
  assert.deepEqual([ok.ok, ok.field, ok.from, ok.to], [true, "attack", 1, 2]);
  assert.equal(cardChange(SHERIFF, SHERIFF.replace('"health": 3', '"health": 4'), {card: "cowboy-sheriff"}).ok, true);
});

test("rejects two fields, non-whitelisted fields, reformatting, bounds, non-troops and renames", () => {
  const reject = (text, opts = {card: "cowboy-sheriff"}, base = SHERIFF) => cardChange(base, text, opts);
  assert.match(reject(SHERIFF.replace('"attack": 1', '"attack": 2').replace('"health": 3', '"health": 4')).reasons[0], /exactly one changed field/);
  assert.match(reject(SHERIFF.replace('"copies": 6', '"copies": 7')).reasons[0], /not whitelisted/);
  assert.match(reject(SHERIFF.replace('"name": "Sheriff"', '"name": "Marshal"')).reasons[0], /not whitelisted/);
  assert.match(reject(JSON.stringify({...JSON.parse(SHERIFF), attack: 2}, null, 2) + "\n").reasons.join(), /formatting/);
  assert.match(reject(SHERIFF.replace('"attack": 1', '"attack": 40')).reasons.join(), /outside/);
  assert.match(reject(SHERIFF.replace('"attack": 1', '"attack": 1.5')).reasons.join(), /whole number/);
  assert.match(reject(SHERIFF.replace('"attack": 1', '"attack": 2'), {card: "cowboy-billy"}).reasons.join(), /does not match/);
  const spell = SHERIFF.replace('"kind": "troop"', '"kind": "spell"');
  assert.match(reject(spell.replace('"attack": 1', '"attack": 2'), {card: "cowboy-sheriff"}, spell).reasons.join(), /not a troop/);
  assert.equal(reject(SHERIFF).ok, false, "no change is not a candidate");
  assert.equal(reject("{").ok, false);
});

test("seed ranges parse strictly and the holdout must be disjoint", () => {
  assert.deepEqual(parseRange("0:200"), {from: 0, deals: 200});
  for (const bad of ["0:0", "0:2001", "-1:5", "1e3:5", "0:20;rm", ""]) assert.throws(() => parseRange(bad), bad);
  const [tune, holdout] = [parseRange(POLICY.defaults.tune), parseRange(POLICY.defaults.holdout)];
  assert.equal(disjoint(tune, holdout), true);
  assert.equal(disjoint({from: 0, deals: 200}, {from: 199, deals: 10}), false);
  assert.equal(disjoint({from: 0, deals: 200}, {from: 200, deals: 10}), true);
});

// Synthetic records: `cowboyWins` of each 100 games go to the Cowboys, first seat alternating.
const games = (cowboyWins, n = 100, summoned = () => ({cowboy: [], wizard: []})) => Array.from({length: n}, (_, i) => ({
  seed: Math.floor(i / 2), first: i % 2 ? "wizard" : "cowboy", winner: i < cowboyWins ? "cowboy" : "wizard", summoned: summoned(i),
}));
const set = (b, c) => ({seeds: {from: 0, to: 49, deals: 50}, baseline: shares(b), candidate: shares(c), flips: paired(b, c)});
const passing = {baseline: {passed: true}, candidate: {passed: true}};

test("PASS needs both Cowboy and Wizard shares in 45-55% on tune and holdout", () => {
  const sets = {tune: set(games(62), games(50)), holdout: set(games(60), games(54))};
  assert.equal(decideAttempt({violations: [], properties: passing, sets}).verdict, "PASS");
  const tuneOnly = {...sets, holdout: set(games(60), games(57))};
  const fail = decideAttempt({violations: [], properties: passing, sets: tuneOnly});
  assert.equal(fail.verdict, "FAIL");
  assert.match(fail.reasons.join(), /holdout: Cowboy share 57\.00%/);
  assert.match(decideAttempt({violations: [], properties: passing, sets: {tune: sets.tune}}).reasons.join(), /no holdout results/);
});

test("missing evidence, violations, failing properties and no-op changes never pass", () => {
  const sets = {tune: set(games(62), games(50)), holdout: set(games(60), games(54))};
  assert.equal(decideAttempt({violations: [], properties: null, sets}).pass, false);
  assert.equal(decideAttempt({violations: [], properties: passing, sets: {}}).pass, false);
  assert.equal(decideAttempt({violations: [], properties: passing, sets: undefined}).pass, false);
  assert.equal(decideAttempt({violations: ["no card file changed"], properties: passing, sets}).pass, false);
  assert.equal(decideAttempt({violations: [], properties: {baseline: {passed: true}, candidate: {passed: false}}, sets}).pass, false);
  const same = games(50);
  assert.match(decideAttempt({violations: [], properties: passing, sets: {tune: set(same, same), holdout: sets.holdout}}).reasons.join(), /altered no game/);
});

test("draws count for neither faction, so a draw-heavy result can miss the band", () => {
  const drawn = games(50).map((g, i) => (i >= 50 && i < 62 ? {...g, winner: null} : g));
  const s = shares(drawn);
  assert.equal(s.cowboyShare, 50);
  assert.equal(s.wizardShare, 38);
  assert.equal(decideAttempt({violations: [], properties: passing, sets: {tune: set(games(62), drawn), holdout: set(games(62), drawn)}}).pass, false);
});

test("first-seat skew may not grow past the tolerance", () => {
  const seated = (n) => games(50).map((g, i) => ({...g, winner: i < n ? g.first : g.first === "cowboy" ? "wizard" : "cowboy"}));
  // Same faction shares (50%) but first seat wins every game: skew 0 -> 50 pp.
  const base = games(62), cand = seated(100);
  const d = decideAttempt({violations: [], properties: passing, sets: {tune: set(base, cand), holdout: set(base, cand)}});
  assert.match(d.reasons.join(), /first-seat skew grew/);
});

test("per-card cohorts label unmeasured and sparse cards and never mix sides", () => {
  const records = games(50, 100, (i) => ({cowboy: i < 80 ? ["cowboy-sheriff"] : [], wizard: i < 10 ? ["wizard-dragon"] : []}));
  const out = perCardCohorts(records, {cowboy: ["cowboy-sheriff", "cowboy-deadeye"], wizard: ["wizard-dragon"]}, 15);
  assert.equal(out["cowboy-deadeye"].status, "unmeasured");
  assert.equal(out["cowboy-deadeye"].sideWinShareWithCard, null);
  assert.equal(out["wizard-dragon"].status, "sparse");
  assert.equal(out["wizard-dragon"].gamesWithCard, 10);
  assert.equal(out["cowboy-sheriff"].status, "measured");
  assert.equal(out["cowboy-sheriff"].gamesWithCard, 80);
  assert.equal(out["cowboy-sheriff"].sideWinShareWithCard, 62.5);
  assert.equal(out["cowboy-sheriff"].gamesWithoutCard, 20);
  assert.equal(out["cowboy-sheriff"].sideWinShareWithoutCard, 0);
});

test("scratch tree comparison catches added, removed, changed and linked files", () => {
  const make = () => { const d = mkdtempSync(join(tmpdir(), "balancer-tree-")); dirs.push(d); mkdirSync(join(d, "cards")); return d; };
  const base = make(), scratch = make();
  for (const d of [base, scratch]) { writeFileSync(join(d, "cards/a.json"), "1"); writeFileSync(join(d, "rules.js"), "x"); }
  writeFileSync(join(scratch, "marker"), "m");
  assert.deepEqual(compareTrees(base, scratch, ["marker"]), {added: [], removed: [], changed: []});
  writeFileSync(join(scratch, "cards/a.json"), "2");
  writeFileSync(join(scratch, "extra.js"), "y");
  rmSync(join(scratch, "rules.js"));
  symlinkSync(join(base, "rules.js"), join(scratch, "rules.js"));
  const diff = compareTrees(base, scratch, ["marker"]);
  assert.deepEqual(diff.changed, ["cards/a.json"]);
  assert.deepEqual(diff.added.sort(), ["extra.js", "rules.js (symlink)"]);
  assert.deepEqual(diff.removed, ["rules.js"]);
});

test("night-shift-review is a native repeat capped at 6 that stops only on pass === true", () => {
  const wf = JSON.parse(readFileSync(new URL("../../.kiro/workflows/night-shift-review.workflow.json", import.meta.url), "utf8"));
  const ids = wf.steps.map((s) => s.id);
  const loop = wf.steps.find((s) => s.type === "repeat");
  assert.ok(ids.indexOf("reset-run") < ids.indexOf(loop.id), "status is reset to pass=false before the loop");
  assert.equal(loop.maxIterations, 6);
  assert.equal(loop.maxIterations, MAX_ATTEMPTS);
  assert.equal(loop.onMaxIterations, "abort");
  assert.deepEqual(loop.stopCondition, {fileCheck: {path: STATUS, jsonPath: "$.pass", value: true}});
  assert.equal(typeof loop.stopCondition.fileCheck.value, "boolean");
  assert.deepEqual(loop.steps.map((s) => [s.type, s.id, s.agent]), [
    ["step", "prepare-attempt", "contest-balance-preparer"],
    ["step", "draft-change", "showdown-balancer"],
    ["step", "review-attempt", "contest-balance-reviewer"],
  ]);
  const [, draftStep, reviewStep] = loop.steps;
  assert.doesNotMatch(draftStep.prompt, /node scripts|--test|shell/);
  assert.match(reviewStep.prompt, /node scripts\/contest-balance\.mjs review/);
  assert.ok(wf.steps.at(-1).prompt.includes("node scripts/contest-balance.mjs verify"));
  for (const step of [...wf.steps, ...loop.steps]) if (step.prompt) assert.doesNotMatch(step.prompt, /git (push|merge)|gh pr create/);
});

const GATE = "node scripts/contest-release-gate.mjs release";
const readWorkflow = (name) => JSON.parse(readFileSync(new URL(`../../.kiro/workflows/${name}.workflow.json`, import.meta.url), "utf8"));

test("both workflows run the same release-gate preflight as step 1, before their existing steps", () => {
  const night = readWorkflow("night-shift-review"), billy = readWorkflow("billy-seat-audit");
  for (const wf of [night, billy]) {
    const [first] = wf.steps;
    assert.deepEqual([first.type, first.id, first.agent], ["step", "release-preflight", "contest-balance-preparer"]);
    assert.equal(first.prompt.split(GATE).length, 2, "the gate command appears exactly once");
    assert.match(first.prompt, /long timeout/);
    assert.match(first.prompt, /severity "success"[^]*severity "error"/);
    assert.equal(wf.steps.filter((s) => s.id === "release-preflight").length, 1);
  }
  assert.deepEqual(night.steps[0], billy.steps[0]);
  // Existing steps, repeat and termination follow unchanged.
  assert.deepEqual(night.steps.map((s) => [s.type, s.id]), [["step", "release-preflight"], ["step", "reset-run"], ["repeat", "balance-attempts"], ["step", "verify-receipt"]]);
  const loop = night.steps[2];
  assert.deepEqual([loop.maxIterations, loop.onMaxIterations], [6, "abort"]);
  assert.deepEqual(loop.stopCondition, {fileCheck: {path: STATUS, jsonPath: "$.pass", value: true}});
  assert.deepEqual(billy.steps.map((s) => [s.id, s.agent]), [
    ["release-preflight", "contest-balance-preparer"],
    ["verify-billy-replay", "showdown-seat-auditor"],
    ["verify-seat-audit", "showdown-seat-auditor"],
    ["balance-gate", "showdown-seat-auditor"],
  ]);
});

test("only contest-balance-preparer gains the exact gate command", () => {
  const agent = JSON.parse(readFileSync(new URL("../../.kiro/agents/contest-balance-preparer.json", import.meta.url), "utf8"));
  const shell = agent.permissions.rules.filter((r) => r.capability === "shell");
  assert.equal(shell.length, 1);
  assert.deepEqual(shell[0].match, ["node scripts/contest-balance.mjs reset", "node scripts/contest-balance.mjs prepare", GATE]);
  assert.deepEqual(agent.permissions.rules.find((r) => r.capability === "fs_write"), {capability: "fs_write", match: ["**"], effect: "deny"});
});

test("the release stamp watches the balance policy, decider and Billy proof inputs, once each", async () => {
  const {WATCHED_FILES} = await import("../../scripts/contest-release-gate.mjs");
  assert.equal(new Set(WATCHED_FILES).size, WATCHED_FILES.length);
  for (const path of [
    "scripts/contest-balance.mjs", "scripts/showdown-balance-contract.mjs", ".kiro/specs/night-shift-balance-contract/requirements.md",
    "scripts/billy-balance-gate.mjs", "scripts/billy-seat-audit.mjs", "scripts/billy-replay-engine.mjs", "scripts/verify-billy-replay.mjs",
    "docs/evidence/billy-seat-audit/protocol.json", "docs/evidence/billy-seat-audit/result.json", "docs/evidence/billy-seat-audit/outcomes.csv.gz",
  ]) assert.ok(WATCHED_FILES.includes(path), path);
});
