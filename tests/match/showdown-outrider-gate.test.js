// K-011: the Outrider gate (scripts/outrider-gate.mjs) and the Outrider turn (src/match/showdown-outrider.js).
// These tests use the TEST FIXTURE in tests/fixtures/outrider-gate/ (seeds 91 and 93, generated from this engine with
// a fixture policy); it is never shipped. The search worker's real cases are checked by the same script with no --dir.
import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {judge, loadDecision, replayAll, verifiedForBuild} from "../../scripts/outrider-gate.mjs";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {outriderTurn} from "../../src/match/showdown-outrider.js";
import {outriderControls} from "../../src/ui/outrider-camp.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const FIX = "tests/fixtures/outrider-gate";
const fixture = () => loadDecision(`${FIX}/decision`);
const receipt = () => JSON.parse(readFileSync(path.join(root, FIX, "receipt.json"), "utf8"));
const fresh = (verdicts) => verdicts.filter((v) => v.fresh).map((v) => v.id);

test("positive: both arms of both fixture cases replay to the measured outcomes and the receipt's lines", async () => {
  const verdicts = judge(replayAll(await fixture()), receipt());
  assert.deepEqual(verdicts.map(({id, fresh: f, problems}) => [id, f, problems]), [["fixture-a", true, []], ["fixture-b", true, []]]);
});

test("a changed branch outcome is stale even with a matching receipt", async () => {
  const decision = await fixture();
  const results = structuredClone(decision.results);
  results.cases["fixture-a"].fight.winner = "cowboy";
  const verdicts = judge(replayAll({...decision, results}), receipt());
  assert.deepEqual(fresh(verdicts), ["fixture-b"]);
  assert.match(verdicts[0].problems.join(), /fight: replayed .* but measured/);
});

test("fail closed: no receipt, a missing case or a throwing policy is stale", async () => {
  const decision = await fixture();
  assert.deepEqual(fresh(judge(replayAll(decision), null)), []);
  assert.deepEqual(fresh(judge(replayAll(decision), {cases: receipt().cases.slice(1)})), ["fixture-b"]);
  const broken = judge(replayAll({...decision, continuation: () => { throw new Error("policy broke"); }}), receipt());
  assert.deepEqual(fresh(broken), []);
  assert.deepEqual(fresh(judge(replayAll({...decision, continuation: () => ({type: "attack", slot: 9, target: "base"})}), receipt())), []);
});

test("the build ships nothing without frozen cases, and only setup fields for verified ones", async () => {
  const none = await verifiedForBuild({dir: "experiments/showdown-outrider/no-such-dir"});
  assert.deepEqual(none.cases, []);
  assert.equal(outriderControls([]), "");
  const built = await verifiedForBuild({dir: `${FIX}/decision`, receiptPath: `${FIX}/receipt.json`});
  assert.deepEqual(built.cases.map((c) => Object.keys(c)), [["id", "setup", "seed", "prefix", "at"], ["id", "setup", "seed", "prefix", "at"]]);
  assert.doesNotMatch(JSON.stringify(built.cases), /winner|bases|transcript|"arms"|"target":"base"/);
  assert.deepEqual((await verifiedForBuild({dir: `${FIX}/decision`, receiptPath: `${FIX}/no-receipt.json`})).cases, []);
});

test("only a verified id opens; the landing is the seat's public view with neutral text", async () => {
  const {cases} = await verifiedForBuild({dir: `${FIX}/decision`, receiptPath: `${FIX}/receipt.json`});
  for (const id of [null, "", "fixture-c", "FIXTURE-A", "fixture-a ", "__proto__", "constructor", '[{"type":"end"}]', "seed:91"]) assert.equal(outriderTurn(id, cases), null, String(id));
  assert.equal(outriderTurn("fixture-a", []), null);
  const {seed, duel} = outriderTurn("fixture-a", cases);
  const session = createShowdownSession({seed, duel});
  const view = session.view();
  assert.deepEqual([view.turn, view.active, duel.kind], [3, "cowboy", "turn"]);
  assert.equal(view.seed, undefined);
  for (const hidden of ["hand", "traps", "deck"]) assert.equal(view.sides.wizard[hidden], undefined);
  assert.equal(view.sides.cowboy.deck, undefined);
  for (const target of ["base", 0]) assert.ok(session.legal().some((a) => a.type === "attack" && a.slot === 0 && a.target === target));
  for (const word of [/win/i, /lose/i, /best|correct|right|wrong|should|better/i, /seed/i, /reward|grit/i, /fixture/i]) assert.doesNotMatch(`${duel.name} ${duel.lesson}`, word);
  assert.doesNotMatch(outriderControls(cases), /\bwin|\blose|best|should|seed|\bride\b|\bfight\b/i);
});

test("retry is a fresh replay: the same landing after a played line", async () => {
  const decision = await fixture();
  const {cases} = await verifiedForBuild({dir: `${FIX}/decision`, receiptPath: `${FIX}/receipt.json`});
  const open = () => { const {seed, duel} = outriderTurn("fixture-a", cases); return createShowdownSession({seed, duel}); };
  const first = open().view();
  const played = open();
  played.act(decision.cases[0].arms.ride);
  while (!played.view().result) played.act(decision.continuation(played.view(), played.legal()));
  assert.deepEqual(open().view(), first);
});

// A disposable copy of the files the gate runs through, so the engine itself can be edited.
function sandbox() {
  const dir = mkdtempSync(path.join(tmpdir(), "outrider-gate-"));
  cpSync(path.join(root, "src"), path.join(dir, "src"), {recursive: true});
  mkdirSync(path.join(dir, "scripts"));
  cpSync(path.join(root, "scripts/outrider-gate.mjs"), path.join(dir, "scripts/outrider-gate.mjs"));
  cpSync(path.join(root, FIX), path.join(dir, FIX), {recursive: true});
  writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
  const gate = (...args) => spawnSync(process.execPath, ["scripts/outrider-gate.mjs", "--dir", `${FIX}/decision`, "--receipt", `${FIX}/receipt.json`, ...args], {cwd: dir, encoding: "utf8"});
  const edit = (file, from, to) => {
    const p = path.join(dir, file), text = readFileSync(p, "utf8");
    assert.ok(text.includes(from), `${file} lacks ${from}`);
    writeFileSync(p, text.replace(from, to));
  };
  return {dir, gate, edit, done: () => rmSync(dir, {recursive: true, force: true})};
}

test("a genuine gameplay mutation (ride strike 1 -> 2 orbs) is stale, and refreshing the hashes cannot fix it", () => {
  const box = sandbox();
  try {
    assert.equal(box.gate("--check").status, 0, "the copy starts fresh");
    box.edit("src/game/showdown/rules.js", "enemy.board.some(Boolean) ? 1 : attack", "enemy.board.some(Boolean) ? 2 : attack");
    const check = box.gate("--check");
    assert.equal(check.status, 1);
    assert.match(check.stdout, /STALE fixture-a: ride: replayed/);
    // Refresh: rewrite the receipt's source hashes to the mutated files. The verdict ignores them.
    const file = path.join(box.dir, FIX, "receipt.json");
    const r = JSON.parse(readFileSync(file, "utf8"));
    const hashes = execFileSync(process.execPath, ["-e", 'import("./scripts/outrider-gate.mjs").then((m)=>console.log(JSON.stringify(m.sourceHashes(process.cwd()))))'], {cwd: box.dir, encoding: "utf8"});
    writeFileSync(file, JSON.stringify({...r, sources: JSON.parse(hashes)}));
    assert.equal(box.gate("--check").status, 1, "refreshed hashes still stale");
    const write = box.gate("--write");
    assert.equal(write.status, 1, "the receipt writer refuses a falsified claim");
    assert.match(write.stderr, /refused: fixture-a/);
  } finally { box.done(); }
});

test("negative control: an unrelated edit (rules comment and a lane-only file) changes source hashes but stays fresh", () => {
  const box = sandbox();
  try {
    box.edit("src/game/showdown/rules.js", "// Riding past standing troops is a 1-orb strike", "// Riding past standing troops (edited comment) is a 1-orb strike");
    writeFileSync(path.join(box.dir, "src/game/clash.js"), `${readFileSync(path.join(box.dir, "src/game/clash.js"), "utf8")}\nexport const UNRELATED = 1;\n`);
    const check = box.gate("--check");
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.match(check.stdout, /2 fresh, 0 stale/);
  } finally { box.done(); }
});

// The search worker's frozen cases (imported from ../cases-ready.json commit 6ab8899 into this tree): every arm
// replays to results/observed.json and to docs/evidence/outrider-gate/receipt.json. Skipped only when not imported.
test("the imported search cases are fresh and ship setup only", async (t) => {
  const decision = await loadDecision();
  if (decision.missing.length) return t.skip("no frozen search cases in this tree");
  const verdicts = judge(replayAll(decision), JSON.parse(readFileSync(path.join(root, "docs/evidence/outrider-gate/receipt.json"), "utf8")));
  assert.deepEqual(verdicts.filter((v) => !v.fresh), []);
  assert.equal(verdicts.length, 10);
  const built = await verifiedForBuild();
  assert.deepEqual(built.cases.map((c) => c.id), verdicts.map((v) => v.id));
  assert.doesNotMatch(JSON.stringify(built.cases), /winner|"arms"|"choices"|"target":"base"|ride-only|fight-only/);
});
