// Focused checks for scripts/scorecard.mjs (Dec 4 Step 0): the evidence each row accepts and rejects, on small
// fixtures, plus the actual default command. Run: node --test tests/game/dec4-scorecard.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {SHOWDOWN_SPECS} from "../../src/game/card-specs.generated.js";
import * as sc from "../../scripts/scorecard.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const HEAD = spawnSync("git", ["rev-parse", "HEAD"], {cwd: ROOT, encoding: "utf8"}).stdout.trim();
const IDS = ["shall", "night-shift-prs", "reviews", "duels", "card-band", "properties", "hooks", "agents", "frontier-kit",
  "submission-licence", "submission-kiro", "submission-site", "submission-video", "submission-category"];

function fixture(t, files) {
  const dir = mkdtempSync(join(tmpdir(), "cvw-scorecard-"));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), {recursive: true});
    writeFileSync(join(dir, path), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

test("SHALL: numbered items (wrapped continuations, ID table rows) count once per distinct substantial text; raw counts kept", (t) => {
  const dir = fixture(t, {
    ".kiro/specs/a/requirements.md": [
      "# A", "",
      "1. WHEN a duel ends, THE Engine SHALL record the winner.",
      "2. `readPatches(root)` in the reader",
      "   SHALL read local Git only.",
      "| CL-1 | THE log SHALL list each clash once. | test |",
      "3. THE Engine SHALL.",
      "The prose SHALL not count without a number.", "",
    ].join("\n"),
    ".kiro/specs/b/requirements.md": "1. WHEN a duel ends, THE Engine SHALL record the winner.\n",
    ".kiro/specs/b/bugfix.md": "1. THE fix SHALL be ignored because it is not a requirements.md file.\n",
  });
  const r = sc.measureShall(dir);
  assert.equal(r.value, 3);
  assert.deepEqual(r.details, {files: 2, raw: 6, numbered: 5, short: 1, repeated: 1});
  assert.equal(r.pass, false);
});

test("night-shift PRs: merged with a merge commit and citing their own sealed review; one seal backs one PR", () => {
  const seal = "a".repeat(64), other = "b".repeat(64);
  const seals = new Map([[seal, "docs/evidence/night-shift/x/bundle.json"], [other, "docs/evidence/night-shift/y/bundle.json"]]);
  const merged = (number, body, extra = {}) => ({number, body, mergedAt: "2026-11-30T00:00:00Z", mergeCommit: {oid: "c".repeat(40)}, author: {login: "someone"}, ...extra});
  const {counted, rejected} = sc.auditNightShiftPrs([
    merged(1, `Night Shift review ${seal}`),
    merged(2, `The same review again ${seal}`),
    merged(3, "No review cited"),
    merged(4, `Opened, never merged ${other}`, {mergedAt: null}),
    merged(5, `Unknown seal ${"d".repeat(64)}`),
    merged(6, `No merge commit ${other}`, {mergeCommit: null}),
  ], seals, (oid) => ({authors: [`author of ${oid.slice(0, 4)}`], coAuthors: ["Kiro"]}));
  assert.deepEqual(counted, [{number: 1, bundle: "docs/evidence/night-shift/x/bundle.json", author: "someone", mergeCommit: "c".repeat(40),
    commitAuthors: ["author of cccc"], coAuthors: ["Kiro"]}]);
  assert.deepEqual(rejected.map((r) => r.number), [2, 3, 4, 5, 6]);
  // Attribution is whatever local git records for the merged commits; an unknown commit is not verifiable.
  const head = sc.localAttribution(ROOT, HEAD);
  assert.ok(head.authors.includes(spawnSync("git", ["log", "-1", "--format=%an", HEAD], {cwd: ROOT, encoding: "utf8"}).stdout.trim()));
  assert.equal(sc.localAttribution(ROOT, "f".repeat(40)), null);
});

test("sealed bundles: an intact checked-in Night Shift seal is accepted, a tampered copy is not", (t) => {
  const path = "docs/evidence/night-shift-review/cowboy-sheriff-health-3-to-4-2417d71c-fd2e069/bundle.json";
  const bundle = JSON.parse(readFileSync(join(ROOT, path), "utf8"));
  assert.equal(sc.sealedBundles(ROOT).get(bundle.bundleSha256), path);
  const dir = fixture(t, {"docs/evidence/night-shift/t/bundle.json": {...bundle, decision: {...bundle.decision, verdict: "accepted"}}});
  assert.equal(sc.sealedBundles(dir).size, 0);
});

test("reviews: a review outcome and a real finding are required; identical findings count once", (t) => {
  const review = (status, findings) => `# Review\n\nStatus: ${status}\n\n## Findings\n\n${findings}\n\n## Notes\n\n- This note is not a finding at all.\n`;
  const finding = "- The Dragon tribute check skips an empty slot on turn one.";
  const dir = fixture(t, {
    ".kiro/specs/a/rules-review.md": review("changes requested", finding),
    ".kiro/specs/b/rules-review.md": review("changes requested", finding),
    ".kiro/specs/c/ui-review.md": review("TBD", "- The focus ring disappears after Cancel on the Camp screen."),
    ".kiro/specs/d/ui-review.md": review("approved", "- None"),
    ".kiro/specs/e/notes.md": review("approved", "- The file name does not end in the review suffix."),
    ".kiro/specs/f/deck-review.md": "**Status:** approved\n\n### Findings\n1. The deck builder keeps the Save button reachable at 390px.\n",
  });
  const r = sc.measureReviews(dir);
  assert.equal(r.value, 2);
  assert.deepEqual(r.details.rejected.map((x) => x.file), [".kiro/specs/b/rules-review.md", ".kiro/specs/c/ui-review.md", ".kiro/specs/d/ui-review.md"]);
});

test("duels and card band: cumulative, duplicate and baseline-equals-candidate games count once; naked or unreal reports are rejected", (t) => {
  const [t0, t1, t2] = SHOWDOWN_SPECS.map((s) => s.type);
  const report = (from, to, extra = {}) => ({schema: "cvw-balance-report/1", ruleset: "showdown", commit: HEAD, bot: "playTurn level 2 (both seats)", decks: "starter",
    seeds: {from, to, gamesPerDeal: 2}, games: (to - from + 1) * 2, results: {cowboy: to - from + 1, wizard: to - from + 1, draw: 0}, generatedAt: "2026-11-22T00:00:00Z", ...extra});
  const files = {
    "a.json": report(0, 999, {generatedAt: "2026-11-20T00:00:00Z", cards: {[t0]: {games: 400, wins: 200}, [t1]: {games: 400, wins: 300}}}),
    "b-cumulative.json": report(0, 1999, {cards: {[t1]: {games: 800, wins: 400}, "cowboy-unicorn": {games: 10, wins: 5}, [t2]: {games: 10, wins: 11}}}),
    "c-duplicate.json": report(0, 999),
    "d-bad-total.json": {...report(0, 9), games: 999},
    "e-unreal-commit.json": report(0, 9, {commit: "f".repeat(40)}),
    "f-other-decks.json": report(0, 9, {decks: "wagon-ring"}),
    "g-naked-counter.json": {schema: "cvw-balance-report/1", ruleset: "showdown", commit: HEAD, games: 10_000_000},
    "h-receipt.json": {schema: "night-watch-receipt/1", mode: "showdown", bot: "playTurn level 2 (both seats)", generatedAt: "2026-11-21T00:00:00Z",
      candidate: {commit: HEAD}, baseline: {commit: HEAD}, seeds: {from: 0, to: 4, gamesPerDeal: 2},
      samples: {candidate: {games: 10, cowboy: 6, wizard: 4, draw: 0}, baseline: {games: 10, cowboy: 6, wizard: 4, draw: 0}}},
  };
  const dir = fixture(t, files);
  const b = sc.measureBalance(ROOT, Object.keys(files).map((f) => join(dir, f)));
  assert.equal(b.duels, 2000 * 2 + 10 * 2 + 5 * 2);
  assert.equal(b.claimed, 2000 + 4000 + 2000 + 20 + 10 + 10);
  assert.deepEqual(b.rejected.map((r) => r.reason), [
    "games differs from seeds x gamesPerDeal", "bot or decks missing", `commit ${"f".repeat(12)} or its Showdown engine files are not in this repository`]);
  const duels = sc.duelRow(b);
  assert.deepEqual([duels.value, duels.pass], [4030, false]);

  const band = sc.bandRow(b);
  const byType = Object.fromEntries(band.details.cards.map((c) => [c.type, c]));
  assert.deepEqual([byType[t0].rate, byType[t1].rate, byType[t2].rate], [50, 50, null]);
  assert.ok(byType[t1].file.endsWith("b-cumulative.json"), "the newer report supersedes a.json's 75%");
  assert.equal(band.value, `2/${SHOWDOWN_SPECS.length}`);
  assert.deepEqual(band.details.problems.map((p) => p.reason), ["not in the card catalog", "bad games/wins"]);
  assert.equal(band.pass, false);

  const all = (wins) => ({cards: Object.fromEntries(SHOWDOWN_SPECS.map((s) => [s.type, {games: 100, wins}]))});
  const full = fixture(t, {"in.json": report(0, 99, all(55)), "out.json": report(0, 99, {...all(56), generatedAt: "2026-11-23T00:00:00Z"})});
  assert.equal(sc.bandRow(sc.measureBalance(ROOT, [join(full, "in.json")])).pass, true);
  assert.equal(sc.bandRow(sc.measureBalance(ROOT, [join(full, "in.json"), join(full, "out.json")])).value, `0/${SHOWDOWN_SPECS.length}`);
});

test("properties: only executed passing fast-check entries from a real commit count, once per id; a fresh gate stamp adds its ids", (t) => {
  const fcFile = "tests/game/showdown-fast-check.test.js";
  const receipt = {schema: "cvw-property-receipt/1", commit: HEAD, generatedAt: "2026-11-22T00:00:00Z", properties: [
    {id: "SP-1", file: fcFile, status: "passed", numRuns: 100, seed: 1},
    {id: "SP-1", file: fcFile, status: "passed", numRuns: 100, seed: 1},
    {id: "SP-2", file: fcFile, status: "skipped", numRuns: 0},
    {id: "SP-3", file: fcFile, status: "failed", numRuns: 12},
    {id: "SP-4", file: fcFile, status: "passed", numRuns: 0},
    {id: "SP-5", file: "scripts/contest-submission-check.mjs", status: "passed", numRuns: 50},
    {id: "SP-6", file: "tests/game/no-such.test.js", status: "passed", numRuns: 50},
    {id: "SP-7", file: "../outside.test.js", status: "passed", numRuns: 50},
    {id: "SP-8", file: fcFile, status: "passed", numRuns: 25},
  ]};
  const {passed, rejected} = sc.auditPropertyReceipt(receipt, ROOT);
  assert.deepEqual([...passed.keys()], ["SP-1", "SP-8"]);
  assert.equal(rejected.length, 7);
  assert.equal(sc.auditPropertyReceipt({...receipt, commit: "f".repeat(40)}, ROOT).passed.size, 0);
  assert.equal(sc.auditPropertyReceipt({...receipt, schema: "fast-check-names"}, ROOT).passed.size, 0);
  const dir = fixture(t, {"latest.json": receipt});
  const r = sc.propertiesRow(ROOT, {ids: ["G1", "G2", "G3", "G4", "SP-1"], note: "fresh passing release-gate stamp"}, join(dir, "latest.json"));
  assert.deepEqual([r.value, r.pass], [6, false]);
});

test("hooks: enabled supported triggers with runnable actions count once; IDE names map; the Saloon must be enabled", (t) => {
  const command = (trigger, script = "scripts/check.mjs", extra = {}) => ({name: trigger, trigger, action: {type: "command", command: `node ${script}`}, ...extra});
  const dir = fixture(t, {
    "scripts/saloon-activity.mjs": "", "scripts/check.mjs": "",
    ".kiro/hooks/night-shift-activity.json": {version: "v1", hooks: [command("Stop", "scripts/saloon-activity.mjs Stop"), command("PreToolUse", "scripts/saloon-activity.mjs PreToolUse")]},
    ".kiro/hooks/save.json": {version: "v1", hooks: [command("PostFileSave"), command("Stop"), command("OnMoonrise"),
      command("PreTaskExecution", undefined, {enabled: false}), command("PostTaskExecution", "scripts/gone.mjs")]},
    ".kiro/hooks/create.kiro.hook": {enabled: true, name: "ide", when: {type: "fileCreated", patterns: ["**/*.js"]}, then: {type: "askAgent", prompt: "Check the new file."}},
    ".kiro/hooks/manual.kiro.hook": {enabled: true, name: "manual", when: {type: "userTriggered"}, then: {type: "askAgent", prompt: "Run it."}},
    ".kiro/hooks/broken.json": "{",
  });
  const r = sc.measureHooks(dir);
  assert.deepEqual([r.value, r.pass], [4, false]);
  assert.deepEqual(Object.keys(r.details.triggers).sort(), ["PostFileCreate", "PostFileSave", "PreToolUse", "Stop"]);
  const listed = Object.fromEntries(r.details.listed.map((l) => [l.trigger, l]));
  assert.equal(r.details.listed.length, 9);
  assert.deepEqual(listed.PostFileCreate.ideFiles, ["create.kiro.hook"]);
  assert.deepEqual(listed.Stop.cliFiles, ["night-shift-activity.json", "save.json"]);
  assert.deepEqual([listed.PostTaskExecution.cliFiles, listed.PreTaskExecution.cliFiles], [[], []]);
  assert.equal(r.details.problems.length, 4);

  const eight = ["Stop", "PreToolUse", "PostToolUse", "PostFileSave", "PostFileCreate", "PostFileDelete", "PreTaskExecution", "PostTaskExecution"];
  const noSaloon = fixture(t, {"scripts/check.mjs": "", ".kiro/hooks/all.json": {version: "v1", hooks: eight.map((x) => command(x))}});
  assert.deepEqual([sc.measureHooks(noSaloon).value, sc.measureHooks(noSaloon).pass], [8, false]);
  writeFileSync(join(noSaloon, "scripts/saloon-activity.mjs"), "");
  writeFileSync(join(noSaloon, ".kiro/hooks/night-shift-activity.json"), JSON.stringify({version: "v1", hooks: [command("Stop", "scripts/saloon-activity.mjs Stop")]}));
  assert.equal(sc.measureHooks(noSaloon).pass, true);

  // The repository's own hooks, including the new Stop hook, all resolve.
  const real = sc.measureHooks(ROOT);
  assert.deepEqual(real.details.problems, []);
  const scorecardHook = JSON.parse(readFileSync(join(ROOT, ".kiro/hooks/dec4-scorecard.json"), "utf8")).hooks;
  assert.deepEqual(scorecardHook.map((h) => [h.trigger, h.action.command]), [["Stop", "node scripts/scorecard.mjs --log"]]);
});

test("agents: a counted writer has narrow write paths, a fenced shell, its own paths and an invoker; read-only roles never count", (t) => {
  const allow = (capability, match) => ({capability, match, effect: "allow"});
  const deny = (capability, match) => ({capability, match, effect: "deny"});
  const agent = (tools, ...rules) => ({tools, permissions: {rules}});
  const cases = {
    writer: [agent(["read", "write"], allow("fs_write", ["src/app.js"])), true, "protected"],
    neverInvoked: [agent(["read", "write"], allow("fs_write", ["src/app.js"])), false, "protected-inactive"],
    shellReader: [agent(["read", "shell"], allow("shell", ["node scripts/x.mjs verify"]), deny("fs_write", ["**"])), true, "read-only"],
    noTools: [{tools: []}, true, "read-only"],
    everyPath: [agent(["write"], allow("fs_write", ["**"])), true, "unprotected-writer"],
    leadingWildcard: [agent(["write"], allow("fs_write", ["*.json"])), true, "unprotected-writer"],
    noAllowList: [{tools: ["write"]}, true, "unprotected-writer"],
    openShell: [agent(["write", "shell"], allow("fs_write", ["tasks/**"])), true, "unprotected-writer"],
    interpreterShell: [agent(["write", "shell"], allow("fs_write", ["tasks/**"]), allow("shell", ["node *"])), true, "unprotected-writer"],
    namedShell: [agent(["write", "shell"], allow("fs_write", ["tasks/**"]), allow("shell", ["git status*", "node --test tests/game/x-*.test.js*"])), true, "protected"],
    deniedShell: [agent(["write", "shell"], allow("fs_write", ["tasks/**"]), deny("shell", ["*"])), true, "protected"],
    allTools: [agent(["*"], allow("fs_write", ["tasks/**"])), true, "unprotected-writer"],
  };
  for (const [name, [config, invoked, expected]] of Object.entries(cases)) assert.equal(sc.classifyAgent(config, invoked).class, expected, name);

  const writer = (name, path) => ({name, tools: ["read", "write"], permissions: {rules: [allow("fs_write", [path])]}});
  const dir = fixture(t, {
    ".kiro/agents/alpha-writer.json": writer("alpha-writer", "src/app.js"),
    ".kiro/agents/beta-writer.json": writer("beta-writer", "src/app.js"),
    ".kiro/agents/gamma-writer.json": writer("gamma-writer", "tasks/gamma.md"),
    ".kiro/workflows/run.workflow.json": {steps: [{agent: "alpha-writer"}, {agent: "beta-writer"}, {agent: "gamma-writer"}]},
  });
  const shared = sc.measureAgents(dir);
  assert.deepEqual(shared.details.agents.map((a) => a.class), ["unprotected-writer", "unprotected-writer", "protected"]);
  assert.equal(shared.value, 1);

  const real = sc.measureAgents(ROOT);
  const byName = Object.fromEntries(real.details.agents.map((a) => [a.name, a.class]));
  assert.equal(byName["showdown-field-scout"], "read-only");
  assert.equal(real.value, real.details.agents.filter((a) => a.class === "protected").length);
});

test("frontier kit: the kit must exist, the staged second game must import it, nothing crosses games, and the live page decides", (t) => {
  const stage = {"scripts/stage-pages.mjs": 'const POKER_SOURCE = new URL("../experiments/boot-hill-poker/", import.meta.url);'};
  assert.equal(sc.frontierKitLocal(fixture(t, {...stage, "experiments/boot-hill-poker/app.js": "import {x} from './engine.js';"})).kit, false);
  const good = sc.frontierKitLocal(fixture(t, {...stage,
    "packages/frontier-kit/package.json": {name: "frontier-kit"},
    "packages/frontier-kit/index.js": "export const deal = () => 1;",
    "experiments/boot-hill-poker/app.js": "import {deal} from '../../packages/frontier-kit/index.js';",
    "src/game/showdown/rules.js": "export const rules = 1;",
  }));
  assert.deepEqual(good, {kit: true, staged: true, importers: ["experiments/boot-hill-poker/app.js"], cross: []});
  const crossing = sc.frontierKitLocal(fixture(t, {...stage,
    "packages/frontier-kit/index.js": "import {rules} from '../../src/game/showdown/rules.js';",
    "experiments/boot-hill-poker/app.js": "import 'frontier-kit';\nimport {rules} from '../../src/game/showdown/rules.js';",
    "src/app.js": "const poker = await import('../experiments/boot-hill-poker/engine.js');",
  }));
  assert.equal(crossing.cross.length, 3);
  assert.equal(sc.kitRow(crossing, "https://x.github.io/y/", null).pass, false);

  const site = "https://x.github.io/y/";
  assert.deepEqual([sc.kitRow(good, site, {error: "offline: not requested"}).status, sc.kitRow(good, site, {error: "offline"}).pass], ["unavailable", false]);
  assert.equal(sc.kitRow(good, site, {value: ["<html>", "import {deal} from '../packages/frontier-kit/index.js';"]}).pass, true);
  assert.deepEqual([sc.kitRow(good, site, {value: ["<html>", "const deal = 1;"]}).status, sc.kitRow(good, site, {value: ["", ""]}).pass], ["measured", false]);
});

test("the actual default command prints every target with value, target and PASS/FAIL, exits 1 on any FAIL, within 60 s", () => {
  const started = Date.now();
  const run = spawnSync(process.execPath, ["scripts/scorecard.mjs"], {cwd: ROOT, encoding: "utf8", timeout: 60_000});
  assert.ok(Date.now() - started < 60_000, "over the 60 s budget");
  const rows = IDS.map((id) => new RegExp(`^(PASS|FAIL)  ${id} +value .+ target `, "m").exec(run.stdout)?.[1]);
  assert.deepEqual(rows.map((r) => r !== undefined), IDS.map(() => true), run.stdout + run.stderr);
  assert.equal(run.status, rows.includes("FAIL") ? 1 : 0);
  assert.match(run.stdout, new RegExp(`^${rows.filter((r) => r === "PASS").length} of ${IDS.length} targets pass; exit ${run.status}$`, "m"));
});

test("--json --offline: machine-readable rows; unreachable evidence is unavailable, not a measured zero, and fails", () => {
  const run = spawnSync(process.execPath, ["scripts/scorecard.mjs", "--json", "--offline"], {cwd: ROOT, encoding: "utf8", timeout: 60_000});
  const card = JSON.parse(run.stdout);
  assert.equal(card.schema, "cvw-scorecard/1");
  assert.deepEqual(card.rows.map((r) => r.id), IDS);
  for (const id of ["night-shift-prs", "submission-site"]) {
    const r = card.rows.find((x) => x.id === id);
    assert.deepEqual([r.status, r.value, r.pass], ["unavailable", "unavailable", false], id);
  }
  assert.ok(card.rows.filter((r) => r.status !== "measured").every((r) => r.pass === false));
  assert.equal(run.status, card.ok ? 0 : 1);
  assert.equal(spawnSync(process.execPath, ["scripts/scorecard.mjs", "--bogus"], {cwd: ROOT, encoding: "utf8"}).status, 2);
});

test("--log never re-enters: a nested run or a re-fired Stop writes nothing and exits 0; a log line is timestamped", () => {
  const log = join(ROOT, sc.LOG), before = readFileSync(log, "utf8");
  const env = {...process.env};
  delete env.SCORECARD_ACTIVE;
  const nested = spawnSync(process.execPath, ["scripts/scorecard.mjs", "--log", "--offline"], {cwd: ROOT, encoding: "utf8", env: {...env, SCORECARD_ACTIVE: "1"}, input: "{}", timeout: 10_000});
  const refired = spawnSync(process.execPath, ["scripts/scorecard.mjs", "--log", "--offline"], {cwd: ROOT, encoding: "utf8", env,
    input: JSON.stringify({hook_event_name: "Stop", stop_hook_active: true}), timeout: 10_000});
  assert.deepEqual([nested.status, nested.stdout, refired.status, refired.stdout], [0, "", 0, ""]);
  assert.equal(readFileSync(log, "utf8"), before);
  const card = {generatedAt: "2026-11-22T00:00:00.000Z", head: "e1e2d32abcdef", elapsedMs: 1234, rows: [{id: "shall", value: 219, pass: false}, {id: "hooks", value: 14, pass: true}]};
  assert.equal(sc.logLine(card, "Stop hook"), "- 2026-11-22T00:00:00.000Z `e1e2d32` Stop hook: 1/2 pass; failing: shall 219 (1.2 s)");
});
