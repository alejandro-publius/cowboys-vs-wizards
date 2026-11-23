// Unit tests for scripts/referee/prove.mjs. They use a toy rule set, a toy
// referee process and fake modules; no real comparison runs and no receipt
// is written outside a temporary directory.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {pathToFileURL} from "node:url";
import {
  canonicalJson, compareDuel, evaluateBrowser, evaluateHistory, parseArgs, preserveFirstRun, prove, validateDuel,
} from "../../scripts/referee/prove.mjs";

const TOY = `
export const schema = "toy/1";
const initial = (d) => ({turn: 1, active: d.first, first: d.first, bases: {cowboy: 2, wizard: 2}, winner: null, reason: null});
function step(s, a) {
  if (s.winner) return [false, s];
  const opp = s.active === "cowboy" ? "wizard" : "cowboy";
  if (a.type === "end") return [true, {...s, turn: s.turn + 1, active: opp}];
  if (a.type === "attack" && a.target === "base") {
    const bases = {...s.bases, [opp]: s.bases[opp] - 1};
    const won = bases[opp] === 0;
    return [true, {...s, bases, winner: won ? s.active : null, reason: won ? "base" : null}];
  }
  return [false, s];
}
export function* replay(d) {
  let s = initial(d);
  yield {step: 0, accepted: null, state: s};
  for (let i = 0; i < d.actions.length; i++) {
    const [ok, next] = step(s, d.actions[i]);
    s = next;
    yield {step: i + 1, accepted: ok, state: s};
  }
}
`;

const REFEREE = (header) => `
import readline from "node:readline";
import {replay} from "./toy.mjs";
console.log(JSON.stringify(${JSON.stringify(header)}));
let i = 0;
for await (const line of readline.createInterface({input: process.stdin})) {
  if (!line.trim()) continue;
  for (const r of replay(JSON.parse(line))) console.log(JSON.stringify({duel: i, ...r}));
  console.log(JSON.stringify({duel: i, done: true}));
  i++;
}
`;

const corpus = {
  recipe: ({quick}) => ({name: "toy", seeds: {from: 1, count: quick ? 3 : 4}}),
  * duels(recipe) {
    for (let seed = recipe.seeds.from; seed < recipe.seeds.from + recipe.seeds.count; seed++) {
      yield {
        seed, first: seed % 2 ? "cowboy" : "wizard",
        decks: {cowboy: ["cowboy-sheriff-1", `cowboy-billy-${seed}`], wizard: ["wizard-skeleton-1"]},
        actions: [{type: "attack", slot: 0, target: "base"}, {type: "end"}, {type: "end"},
          {type: "attack", slot: 0, target: "base"}, {type: "end"}],
      };
    }
  },
};

async function fixture(header = {schema: "toy/1"}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "referee-prove-"));
  const fake = path.join(root, "fake");
  fs.mkdirSync(fake);
  fs.mkdirSync(path.join(root, "proof/referee"), {recursive: true});
  fs.mkdirSync(path.join(root, "scripts/referee"), {recursive: true});
  fs.writeFileSync(path.join(root, "proof/referee/referee.py"), "# placeholder oracle\n");
  fs.writeFileSync(path.join(root, "scripts/referee/corpus.mjs"), "// placeholder corpus\n");
  fs.writeFileSync(path.join(fake, "toy.mjs"), TOY);
  fs.writeFileSync(path.join(fake, "referee.mjs"), REFEREE(header));
  const toy = await import(pathToFileURL(path.join(fake, "toy.mjs")).href);
  const buggy = {
    schema: toy.schema,
    * replay(d) {
      for (const r of toy.replay(d)) yield d.seed === 3 && r.step === 2 ? {...r, state: {...r.state, turn: 99}} : r;
    },
  };
  const base = {root, head: "a".repeat(40), log: () => {}, refereeCommand: [process.execPath, path.join(fake, "referee.mjs")]};
  return {root, toy, buggy, base, receipts: path.join(root, "proof/referee/receipts")};
}

const duel = () => ({seed: 7, first: "cowboy", decks: {cowboy: ["cowboy-sheriff-1"], wizard: ["wizard-dragon-1"]}, actions: [{type: "end"}]});

test("canonical JSON sorts keys and is stable", () => {
  assert.equal(canonicalJson({b: 1, a: [{d: 2, c: 3}]}), '{"a":[{"c":3,"d":2}],"b":1}');
});

test("duel input refuses engine state, expected answers and malformed IDs", () => {
  assert.doesNotThrow(() => validateDuel(duel(), 0));
  assert.doesNotThrow(() => validateDuel({...duel(), cardNames: {"cowboy-sheriff-1": "Sheriff"}}, 0));
  assert.throws(() => validateDuel({...duel(), expected: {}}, 0), /unexpected key "expected"/);
  assert.throws(() => validateDuel({...duel(), decks: {cowboy: ["Sheriff"], wizard: ["wizard-dragon-1"]}}, 0), /bad instance ID/);
  assert.throws(() => validateDuel({...duel(), actions: [{type: "boss-roar"}]}, 0), /unsupported type/);
  assert.throws(() => validateDuel({...duel(), first: "dragon"}, 0), /first must be/);
});

test("per-duel comparison records initial state, rejection, omission and first divergent turn", () => {
  const d = {...duel(), actions: [{type: "end"}, {type: "end"}]};
  const s = (turn) => ({turn, winner: null});
  const ref = [{step: 0, accepted: null, state: s(1)}, {step: 1, accepted: true, state: s(2)}, {step: 2, accepted: true, state: s(3)}];
  const eng = [{step: 0, accepted: null, state: {turn: 1, winner: null, extra: 1}}, {step: 1, accepted: false, state: s(1)}];
  const {line, stats} = compareDuel({index: 0, duel: d, deal: "x", ref, eng});
  assert.deepEqual(line.mismatches.map((m) => m.kind), ["initial-state", "rejected-by-engine", "omitted-by-engine"]);
  assert.equal(line.firstStep, 0);
  assert.equal(line.firstTurn, 1);
  assert.deepEqual(line.initial, s(1));
  assert.deepEqual(line.mismatches[0].paths, ["$.extra"]);
  assert.equal(stats.actions, 2);
  assert.equal(stats.accepted, 2);
});

test("an oracle that changes state on a rejection is reported as a contract violation", () => {
  const ref = [{step: 0, accepted: null, state: {turn: 1}}, {step: 1, accepted: false, state: {turn: 2}}];
  const {violations} = compareDuel({index: 0, duel: duel(), deal: "x", ref, eng: ref});
  assert.deepEqual(violations.map((v) => v.kind), ["rejection-changed-state"]);
});

test("pinned histories need five caught defects across engine and tests, for this freeze", () => {
  const defect = (id, area, verdict = "caught") => ({id, area, verdict, commit: "abcdef1"});
  const five = [defect("a", "engine"), defect("b", "engine"), defect("c", "engine"), defect("d", "tests"), defect("e", "tests"), defect("f", "tests", "missed")];
  assert.equal(evaluateHistory({freezeKey: "k", defects: five}, {freezeKey: "k"}).status, "pass");
  assert.equal(evaluateHistory({freezeKey: "old", defects: five}, {freezeKey: "k"}).status, "stale");
  assert.equal(evaluateHistory(null, {freezeKey: "k"}).status, "missing");
  const engineOnly = ["a", "b", "c", "d", "e"].map((id) => defect(id, "engine"));
  assert.equal(evaluateHistory({freezeKey: "k", defects: engineOnly}, {freezeKey: "k"}).status, "fail");
  assert.equal(evaluateHistory({freezeKey: "k", defects: [...five, defect("g", "engine", "maybe")]}, {freezeKey: "k"}).status, "unsupported");
  assert.equal(evaluateHistory({freezeKey: "k", defects: [...five, {...defect("h", "tests"), skipped: true}]}, {freezeKey: "k"}).status, "skipped");
});

test("browser verdicts need 250 distinct completed illustrated duels from this freeze and HEAD", () => {
  const head = "b".repeat(40);
  const v = (i) => ({seed: i, dealDigest: `d${i}`, completed: true, illustrated: true, verdict: "agree"});
  const all = Array.from({length: 250}, (_, i) => v(i));
  const ok = {freezeKey: "k", build: {commit: head}, verdicts: all};
  assert.equal(evaluateBrowser(ok, {freezeKey: "k", head}).status, "pass");
  assert.equal(evaluateBrowser({...ok, verdicts: all.slice(1)}, {freezeKey: "k", head}).status, "fail");
  assert.equal(evaluateBrowser({...ok, verdicts: [...all.slice(1), v(0), v(0)]}, {freezeKey: "k", head}).status, "fail");
  assert.equal(evaluateBrowser({...ok, freezeKey: "prior-sheriff-wins"}, {freezeKey: "k", head}).status, "stale");
  assert.equal(evaluateBrowser({...ok, build: {commit: "c".repeat(40)}}, {freezeKey: "k", head}).status, "stale");
  assert.equal(evaluateBrowser({...ok, verdicts: [...all, {...v(300), verdict: "skipped"}]}, {freezeKey: "k", head}).status, "skipped");
});

test("CLI arguments: --limit only with --quick, no quick freeze", () => {
  assert.equal(parseArgs(["--quick", "--limit", "5"]).limit, 5);
  assert.throws(() => parseArgs(["--limit", "5"]), /only allowed with --quick/);
  assert.throws(() => parseArgs(["--quick", "--print-freeze"]), /cannot be combined/);
  assert.throws(() => parseArgs(["--overwrite"]), /unknown argument/);
});

test("full mode refuses to compare before the coordinator freezes", async () => {
  const f = await fixture();
  const r = await prove({...f.base, modules: {corpus, engine: f.toy}});
  assert.equal(r.exitCode, 1);
  assert.equal(r.report.status, "not-frozen");
  assert.match(r.report.next, /--print-freeze/);
  assert.equal(fs.existsSync(f.receipts), false);
});

test("quick mode streams a comparison but writes no proof receipt", async () => {
  const f = await fixture();
  const r = await prove({...f.base, quick: true, modules: {corpus, engine: f.toy}});
  assert.equal(r.exitCode, 0);
  assert.equal(r.report.counts.duels, 3);
  assert.equal(r.report.counts.actions, 15);
  assert.ok(r.report.counts.rejected > 0 && r.report.counts.accepted > 0);
  assert.equal(r.report.counts.completed, 3);
  assert.ok(fs.existsSync(path.join(f.root, ".artifacts/referee/quick-current.json")));
  assert.equal(fs.existsSync(f.receipts), false);
  assert.throws(() => preserveFirstRun({receiptsDir: f.receipts, key: "k", quick: true}), /quick mode cannot/);
  const limited = await prove({...f.base, quick: true, limit: 1, modules: {corpus, engine: f.toy}});
  assert.equal(limited.report.counts.duels, 1);
});

test("first full comparison is preserved once; a fixed rerun cannot erase its mismatches", async () => {
  const f = await fixture();
  let printed = "";
  const frozen = await prove({...f.base, printFreeze: true, log: (m) => { printed += m; }, modules: {corpus}});
  assert.equal(frozen.exitCode, 0);
  fs.writeFileSync(path.join(f.root, "proof/referee/freeze.json"), printed);

  const first = await prove({...f.base, modules: {corpus, engine: f.buggy}});
  assert.equal(first.exitCode, 1, "toy corpus misses the release thresholds");
  const cmp = first.report.sections.comparison;
  assert.equal(cmp.firstRun.status, "created");
  assert.equal(first.report.counts.mismatches, 1);
  assert.deepEqual(first.report.counts.firstDivergence, {duel: 2, seed: 3, step: 2, turn: 2, kind: "state"});
  assert.equal(first.report.sections.history.status, "missing");
  assert.equal(first.report.sections.browser.status, "missing");
  const receiptBytes = fs.readFileSync(cmp.firstRun.path, "utf8");
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.kind, "first-run");
  assert.equal(receipt.counts.initialStates, 4);
  const lines = fs.readFileSync(path.join(f.receipts, receipt.mismatches.file), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].seed, 3);
  assert.ok(lines[0].initial);

  const rerun = await prove({...f.base, modules: {corpus, engine: f.toy}});
  assert.equal(rerun.report.counts.mismatches, 0);
  assert.equal(rerun.report.sections.comparison.firstRun.status, "existing");
  assert.equal(rerun.report.sections.comparison.firstRun.reproduced, true);
  assert.equal(fs.readFileSync(cmp.firstRun.path, "utf8"), receiptBytes);
  assert.equal(fs.readdirSync(f.receipts).filter((n) => n.startsWith("first-run-")).length, 2);
});

test("edited oracle files after the freeze are stale and nothing runs", async () => {
  const f = await fixture();
  let printed = "";
  await prove({...f.base, printFreeze: true, log: (m) => { printed += m; }, modules: {corpus}});
  fs.writeFileSync(path.join(f.root, "proof/referee/freeze.json"), printed);
  fs.appendFileSync(path.join(f.root, "proof/referee/referee.py"), "# edit\n");
  const r = await prove({...f.base, modules: {corpus, engine: f.toy}});
  assert.equal(r.exitCode, 1);
  assert.equal(r.report.status, "stale");
  assert.equal(fs.existsSync(f.receipts), false);
});

test("a referee schema the adapter does not emit is unsupported, never rewritten", async () => {
  const f = await fixture({schema: "toy/2"});
  const r = await prove({...f.base, quick: true, modules: {corpus, engine: f.toy}});
  assert.equal(r.exitCode, 1);
  assert.equal(r.report.sections.comparison.status, "unsupported");
  assert.match(r.report.errors.join(" "), /schema mismatch/);
});
