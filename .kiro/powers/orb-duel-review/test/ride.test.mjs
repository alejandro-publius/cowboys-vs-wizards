// Run: node --test .kiro/powers/orb-duel-review/test/ride.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {createInterface} from "node:readline";
import {RIDE_ENTRIES, SEARCH_DATA, SEARCH_ENTRIES, inspectRideDecision} from "../ride.mjs";
import {engineFingerprint} from "../showdown.mjs";
import {historicalEngine} from "./historical-engine.mjs";

const plugin = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(plugin, "../../../");
const ID = "outrider-replay-infrastructure";
const SEARCH = "outrider-ride-search";
const packaged = JSON.parse(readFileSync(join(plugin, "cases", `${ID}.json`), "utf8"));
const searched = JSON.parse(readFileSync(join(plugin, "cases", `${SEARCH}.json`), "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "orb-ride-"));

function boundProject(t, receipt) {
  const {commit, closure, data = {}} = receipt.recorded;
  return historicalEngine(t, repo, commit, [...Object.keys(closure.files), ...Object.keys(data)]);
}

// A copy of the decision's code closure (plus a built page), so edits never touch the checkout.
function copyProject(name) {
  const root = join(tmp, name) + "/";
  const files = [...Object.keys(engineFingerprint(repo, RIDE_ENTRIES).files), ...Object.keys(engineFingerprint(repo, SEARCH_ENTRIES).files), ...SEARCH_DATA];
  for (const rel of new Set(files)) {
    mkdirSync(dirname(join(root, rel)), {recursive: true});
    cpSync(join(repo, rel), join(root, rel));
  }
  mkdirSync(join(root, "dist"), {recursive: true});
  writeFileSync(join(root, "dist/cowboys-vs-wizards-board-duel.html"), "<html>copy</html>");
  return root;
}
const HIDDEN = /"seed"|"prefix"|"salt"|"policyChose"/;

test("the infrastructure case passes on its recorded engine and withholds advice", async (t) => {
  const root = boundProject(t, packaged);
  if (!root) return;
  const out = await inspectRideDecision(root, ID);
  assert.equal(out.verdict, "pass", JSON.stringify(out.reasons));
  assert.equal(out.closure.current, packaged.recorded.closure.sha256);
  assert.equal(out.game.recordedCommit, packaged.recorded.commit);
  assert.equal(out.replayUrl, null);
  assert.equal(out.advice.allowed, false);
  assert.ok(out.advice.reasons.some((r) => /no game route/.test(r)));
  assert.ok(out.advice.reasons.some((r) => /no verified paired outcomes/.test(r)));
  assert.deepEqual(out.decision.ride, {type: "attack", slot: 1, target: "base"});
});

test("the position payload is the Cowboy seat's public view only", async () => {
  const out = await inspectRideDecision(repo, ID);
  const text = JSON.stringify(out);
  assert.ok(!HIDDEN.test(text), "no seed, prefix, salt or policy choice");
  const wizard = out.decision.position.sides.wizard;
  assert.deepEqual([wizard.hand, wizard.deck, wizard.traps], [[], [], []]);
  assert.deepEqual(out.decision.position.sides.cowboy.deck, []);
  assert.equal(out.decision.position.result, null);
});

test("a gameplay edit in the closure makes the decision stale and withholds advice", async (t) => {
  const root = boundProject(t, packaged);
  if (!root) return;
  appendFileSync(join(root, "src/game/showdown/rules.js"), "\n// changed\n");
  const out = await inspectRideDecision(root, ID);
  assert.equal(out.verdict, "stale");
  assert.deepEqual(out.closure.changedFiles, ["src/game/showdown/rules.js"]);
  assert.equal(out.advice.allowed, false);
  assert.ok(out.advice.reasons.includes("decision verdict is stale"));
});

test("an edit outside the closure leaves the verdict unchanged (negative control)", async (t) => {
  const root = boundProject(t, packaged);
  if (!root) return;
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "src/app.js"), "// unrelated\n");
  writeFileSync(join(root, "dist/cowboys-vs-wizards-board-duel.html"), "<html>rebuilt</html>");
  const out = await inspectRideDecision(root, ID);
  assert.equal(out.verdict, "pass");
  assert.deepEqual(out.closure.changedFiles, []);
});

test("a changed position is rejected even when the closure hash is refreshed", async () => {
  const root = copyProject("position");
  const forged = {...packaged, recorded: {...packaged.recorded, closure: engineFingerprint(root, RIDE_ENTRIES)},
    decision: {...packaged.decision, positionSha256: "0".repeat(64)}};
  const out = await inspectRideDecision(root, ID, forged);
  assert.equal(out.verdict, "rejected");
  assert.ok(out.reasons.includes("re-derived position differs from the receipt"));
});

test("advice and a replay URL appear only with a routed turn, a build and verified paired outcomes", async () => {
  const root = copyProject("routed");
  appendFileSync(join(root, "src/match/showdown-turn.js"), "\nTURNS[\"ride-test\"] = TURNS[\"dragon-c5\"];\n");
  const recorded = {...packaged, recorded: {commit: null, closure: engineFingerprint(root, RIDE_ENTRIES)}, route: {turn: "ride-test"}};
  const withoutOutcomes = await inspectRideDecision(root, ID, recorded);
  assert.equal(withoutOutcomes.verdict, "pass");
  assert.match(withoutOutcomes.replayUrl, /dist\/cowboys-vs-wizards-board-duel\.html\?turn=ride-test$/);
  assert.equal(withoutOutcomes.advice.allowed, false);
  const verified = {...recorded, evidence: {...recorded.evidence, pairedOutcomes: {pairs: 1}}};
  assert.equal((await inspectRideDecision(root, ID, verified)).advice.allowed, true);
  const unrouted = await inspectRideDecision(root, ID, {...verified, route: {turn: "missing"}});
  assert.equal(unrouted.replayUrl, null);
  assert.equal(unrouted.advice.allowed, false);
});

test("server lists inspect_ride_decision and refuses paths and extra inputs", {timeout: 10000}, async (t) => {
  const child = spawn("node", [join(plugin, "server.mjs")], {stdio: ["pipe", "pipe", "inherit"], env: {...process.env, PLUGIN_DATA: ""}});
  t.after(() => child.kill());
  const waiting = new Map();
  createInterface({input: child.stdout}).on("line", (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); });
  let n = 0;
  const call = (method, params) => new Promise((res) => { const id = ++n; waiting.set(id, res); child.stdin.write(JSON.stringify({jsonrpc: "2.0", id, method, params}) + "\n"); });
  assert.ok((await call("tools/list")).result.tools.some((tool) => tool.name === "inspect_ride_decision"));
  assert.equal((await call("tools/call", {name: "inspect_ride_decision", arguments: {case: "../../x"}})).error.code, -32602);
  assert.equal((await call("tools/call", {name: "inspect_ride_decision", arguments: {path: "/etc"}})).error.code, -32602);
  const ok = JSON.parse((await call("tools/call", {name: "inspect_ride_decision", arguments: {case: SEARCH}})).result.content[0].text);
  const current = engineFingerprint(repo, SEARCH_ENTRIES).sha256;
  assert.equal(ok.power.version, "1.6.0");
  assert.equal(ok.closure.current, current);
  assert.equal(ok.closure.recorded, searched.recorded.closure.sha256);
  assert.equal(ok.verdict, current === searched.recorded.closure.sha256 ? "pass" : "stale");
  assert.equal(ok.advice.allowed, false);
  const camp = JSON.parse((await call("tools/call", {name: "inspect_ride_decision", arguments: {}})).result.content[0].text);
  assert.equal(camp.caseId, "outrider-camp-case");
});

test("the searched case re-verifies its position and both arms, and withholds advice without a route or a supported cue", {timeout: 30000}, async (t) => {
  const root = boundProject(t, searched);
  if (!root) return;
  const out = await inspectRideDecision(root, SEARCH);
  assert.equal(out.verdict, "pass", JSON.stringify(out.reasons));
  assert.equal(out.status, "searched-case");
  assert.deepEqual(out.advice.reasons, ["no game route is recorded for this case: the game does not open this decision",
    "the pre-registered ride/decline cue failed its holdout test: no general reason to decline is supported"]);
  assert.ok(out.decision.decline && out.decision.ride.target === "base");
  const text = JSON.stringify(out);
  assert.ok(!/"winner"|"seed"|"prefix"|"label"|case-[a-j]/.test(text), "no outcome, seed, prefix or case label leaves the tool");
  const wizard = out.decision.position.sides.wizard;
  assert.ok(!["hand", "deck", "traps"].some((key) => key in wizard), "viewFor carries Wizard counts only");
  assert.ok(!("deck" in out.decision.position.sides.cowboy));
});

test("an edited observed result is rejected; a changed data file is stale", {timeout: 30000}, async (t) => {
  const root = boundProject(t, searched);
  if (!root) return;
  const file = join(root, "experiments/showdown-outrider/decision/results/observed.json");
  const observed = JSON.parse(readFileSync(file, "utf8"));
  const label = searched.derive.label;
  observed[label].ride.turn += 1;
  writeFileSync(file, JSON.stringify(observed));
  const out = await inspectRideDecision(root, SEARCH);
  assert.equal(out.verdict, "rejected");
  assert.ok(out.reasons.includes("replayed ride and decline arms differ from results/observed.json"));
  assert.ok(out.reasons.some((r) => /results\/observed\.json differs from the receipt/.test(r)));
  assert.equal(out.advice.allowed, false);
});

test("a gameplay edit makes the searched case stale", {timeout: 30000}, async (t) => {
  const root = boundProject(t, searched);
  if (!root) return;
  appendFileSync(join(root, "src/game/showdown/rules.js"), "\n// changed\n");
  const out = await inspectRideDecision(root, SEARCH);
  assert.equal(out.verdict, "stale");
  assert.deepEqual(out.closure.changedFiles, ["src/game/showdown/rules.js"]);
});
