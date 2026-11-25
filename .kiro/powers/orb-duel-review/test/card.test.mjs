// Run: node --test .kiro/powers/orb-duel-review/test/card.test.mjs
// One genuinely changed card proposal through the duel-card-pipeline check and the Power's card review.
// A temporary project holds only the files the smoke sample and the catalog sync load. Billy's attack is
// changed in its spec, the project's own sync regenerates the catalog, a receipt is recorded, and the
// copied plugin, bound by setup.mjs, checks it over MCP. A forged sample that the sample's own validator
// accepts is rejected by the rerun, and a second spec change makes the receipt stale.
import test, {after} from "node:test";
import assert from "node:assert/strict";
import {spawn, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {createInterface} from "node:readline";
import {fileURLToPath, pathToFileURL} from "node:url";
import {closureFingerprint, engineFingerprint} from "../showdown.mjs";
import {RECEIPT, SMOKE, measurement, parseProposal} from "../card.mjs";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(src, "../../../");
const tmp = mkdtempSync(join(tmpdir(), "orb-card-review-"));
const plugin = join(tmp, "installed", "orb-duel-review");
const data = join(tmp, "data");
const project = join(tmp, "project");
const CARDS = ".kiro/specs/duel-card-pipeline/cards";
cpSync(src, plugin, {recursive: true});
for (const rel of [...Object.keys(engineFingerprint(repo, [SMOKE]).files), "scripts/sync-card-specs.mjs", "package.json", CARDS]) {
  cpSync(join(repo, rel), join(project, rel), {recursive: true});
}
mkdirSync(join(project, "assets/models"), {recursive: true});
writeFileSync(join(project, "scripts/audit-assets.mjs"), "");

const billy = join(project, CARDS, "cowboy-billy.json");
const receiptFile = join(project, RECEIPT);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const node = (...args) => spawnSync(process.execPath, args, {cwd: project, encoding: "utf8"});
const record = (proposal) => node(join(plugin, "card.mjs"), "--record", project, "cowboy-billy", proposal);
// The edit the card-summoning-circle author step makes: one field's value, nothing else.
function setBillyAttack(value) {
  const text = readFileSync(billy, "utf8");
  assert.match(text, /"attack": \d+,/);
  writeFileSync(billy, text.replace(/"attack": \d+,/, `"attack": ${value},`));
}

function start() {
  const child = spawn(process.execPath, [join(plugin, "server.mjs")], {cwd: plugin, env: {...process.env, PLUGIN_ROOT: plugin, PLUGIN_DATA: data}, stdio: ["pipe", "pipe", "inherit"]});
  const waiting = new Map();
  createInterface({input: child.stdout}).on("line", (line) => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
  let n = 0;
  const call = (method, params) => new Promise((res) => { const id = ++n; waiting.set(id, res); child.stdin.write(JSON.stringify({jsonrpc: "2.0", id, method, params}) + "\n"); });
  const review = async (args) => { const r = await call("tools/call", {name: "inspect_card_review", arguments: args}); return r.error ?? JSON.parse(r.result.content[0].text); };
  return {review, stop: () => child.kill()};
}
assert.equal(spawnSync(process.execPath, [join(plugin, "setup.mjs"), project, data]).status, 0);
const power = start();
after(() => power.stop());

test("proposal grammar (R5.3) and the R5.5 measured rule", () => {
  assert.deepEqual(parseProposal("attack = 3"), {kind: "stat", field: "attack", value: 3});
  assert.deepEqual(parseProposal("review existing"), {kind: "review"});
  for (const bad of ["attack=3", "attack = 3; echo", "name = 3", "attack = -1", "attack = 03", " attack = 3", "attack = 3\n", 3, null]) assert.equal(parseProposal(bad), null, String(bad));
  const entry = {status: "observed", engineStats: {stars: 5, attack: 3, health: 4}};
  assert.equal(measurement(parseProposal("attack = 3"), entry).measured, true);
  assert.match(measurement(parseProposal("attack = 4"), entry).reasons.join(), /engine played attack 3, not the proposed 4/);
  assert.match(measurement(parseProposal("copies = 3"), entry).reasons.join(), /copies proposal is never measured/);
  assert.match(measurement(parseProposal("attack = 3"), {...entry, status: "in-deck-unobserved"}).reasons.join(), /never played/);
  assert.equal(measurement(parseProposal("review existing"), entry).measured, false);
});

test("recording refuses until the spec shows the proposal and the catalog is regenerated", async () => {
  assert.equal((await power.review({card: "cowboy-billy", proposal: "attack = 3"})).verdict, "absent");
  const unchanged = record("attack = 3");
  assert.equal(unchanged.status, 1);
  assert.match(unchanged.stderr, /shows attack 2, not the proposed 3/);
  setBillyAttack(3);
  const unsynced = record("attack = 3");
  assert.equal(unsynced.status, 1);
  assert.match(unsynced.stderr, /sync-card-specs\.mjs --check exited 1/);
  assert.equal(existsSync(receiptFile), false);
  // The duel-card-pipeline R3 check, as scripts/check-card-specs.sh runs it.
  assert.equal(node("scripts/sync-card-specs.mjs").status, 0);
  assert.equal(node("scripts/sync-card-specs.mjs", "--check").status, 0);
  const ok = record("attack = 3");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /measured: true$/m);
  const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
  assert.deepEqual(receipt.sample.cards["cowboy-billy"].engineStats, {stars: 5, attack: 3, health: 4});
  assert.equal(receipt.sample.results.games, 200);
  // Recorded closure = the canonical fingerprint the replay recomputes, and of its own file map.
  assert.deepEqual(receipt.closure, engineFingerprint(project, [SMOKE]));
  assert.deepEqual(closureFingerprint(receipt.closure.files), receipt.closure);
});

test("the bound Power passes the receipt and refuses another proposal or a bad input", async () => {
  const pass = await power.review({card: "cowboy-billy", proposal: "attack = 3"});
  assert.equal(pass.verdict, "pass", pass.reasons.join("; "));
  assert.equal(pass.measured, true);
  assert.deepEqual(pass.pending, []);
  assert.deepEqual(pass.power, {name: "orb-duel-review", version: "1.6.0"});
  assert.equal(pass.receiptSha256, sha(readFileSync(receiptFile)));
  assert.equal(pass.closure.recorded, pass.closure.current);
  assert.equal(pass.closure.current, engineFingerprint(project, [SMOKE]).sha256);
  assert.deepEqual(pass.closure.changedFiles, []);
  assert.equal(pass.sample.card.status, "observed");
  assert.equal(pass.sample.card.engineStats.attack, 3);
  assert.ok(pass.sample.card.gamesPlayed > 0);
  const other = await power.review({card: "cowboy-billy", proposal: "attack = 4"});
  assert.equal(other.verdict, "rejected");
  assert.equal(other.measured, false);
  for (const args of [{card: "../x", proposal: "attack = 3"}, {card: "cowboy-billy", proposal: "attack = 3; echo"}, {card: "cowboy-billy", proposal: "attack = 3", path: "/etc/passwd"}, {card: "cowboy-billy"}]) {
    assert.equal((await power.review(args)).code, -32602, JSON.stringify(args));
  }
});

test("a saved closure digest that disagrees with its own file map is malformed, not a pass", async (t) => {
  const original = readFileSync(receiptFile);
  t.after(() => writeFileSync(receiptFile, original));
  const valid = JSON.parse(original);
  const flip = (hex) => (hex[0] === "0" ? "1" : "0") + hex.slice(1);
  // Only the aggregate (or the count) changes; every per-file hash and the whole sample stay valid.
  for (const [label, closure, field] of [
    ["aggregate digest", {...valid.closure, sha256: flip(valid.closure.sha256)}, "sha256"],
    ["file count", {...valid.closure, fileCount: valid.closure.fileCount + 1}, "fileCount"],
  ]) {
    assert.deepEqual(closure.files, valid.closure.files, label);
    writeFileSync(receiptFile, JSON.stringify({...valid, closure}, null, 2) + "\n");
    const verdict = await power.review({card: "cowboy-billy", proposal: "attack = 3"});
    assert.equal(verdict.verdict, "malformed", `${label}: ${verdict.reasons.join("; ")}`);
    assert.match(verdict.reasons.join(), new RegExp(`closure is not the canonical fingerprint of its own file map \\(differs in: ${field}\\)`), label);
    assert.equal(verdict.measured, false, label);
    assert.equal(verdict.sample, undefined, `${label}: no rerun on an incoherent receipt`);
  }
  // A coherent closure (aggregate recomputed canonically) over a file hash the project lacks is stale.
  const rules = "src/game/showdown/rules.js";
  assert.ok(rules in valid.closure.files);
  const moved = closureFingerprint({...valid.closure.files, [rules]: flip(valid.closure.files[rules])});
  writeFileSync(receiptFile, JSON.stringify({...valid, closure: moved}, null, 2) + "\n");
  const stale = await power.review({card: "cowboy-billy", proposal: "attack = 3"});
  assert.equal(stale.verdict, "stale", stale.reasons.join("; "));
  assert.deepEqual(stale.closure.changedFiles, [rules]);
});

test("a forged sample that the sample's own validator accepts is rejected by the rerun", async (t) => {
  const original = readFileSync(receiptFile);
  t.after(() => writeFileSync(receiptFile, original));
  const smoke = await import(pathToFileURL(join(project, SMOKE)).href);
  const {canonical, sha256} = await import(pathToFileURL(join(project, "scripts/night-review.mjs")).href);
  const forged = JSON.parse(original);
  const game = forged.sample.records.find((r) => r.winner === "wizard");
  game.winner = "cowboy";
  Object.assign(forged.sample, smoke.summarizeSample(forged.sample.records), {recordsSha256: sha256(canonical(forged.sample.records))});
  assert.deepEqual(smoke.smokeProblems(forged.sample, {from: 0, count: 100}), []);
  writeFileSync(receiptFile, JSON.stringify(forged, null, 2) + "\n");
  const verdict = await power.review({card: "cowboy-billy", proposal: "attack = 3"});
  assert.equal(verdict.verdict, "rejected");
  assert.match(verdict.reasons.join(), /rerun sample differs from the receipt in: .*results.*records/);
  assert.equal(verdict.measured, false);
});

test("a second spec change makes the receipt stale; recording again passes on the same server", async () => {
  setBillyAttack(4);
  assert.equal(node("scripts/sync-card-specs.mjs").status, 0);
  const stale = await power.review({card: "cowboy-billy", proposal: "attack = 3"});
  assert.equal(stale.verdict, "stale");
  assert.deepEqual(stale.closure.changedFiles, [`${CARDS}/cowboy-billy.json`, "src/game/card-specs.generated.js"]);
  assert.equal(stale.measured, false);
  assert.equal(record("attack = 4").status, 0);
  const again = await power.review({card: "cowboy-billy", proposal: "attack = 4"});
  assert.equal(again.verdict, "pass", again.reasons.join("; "));
  assert.equal(again.sample.card.engineStats.attack, 4);
  assert.equal(again.measured, true);
});
