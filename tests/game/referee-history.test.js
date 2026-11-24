// Checks for scripts/referee/history.mjs. Everything here runs on in-memory fakes: the duels, commit
// ids and outputs are harness data, not mined defects, and nothing here counts as a finding.
// The last test checks the committed proof/history set as it really is (empty and unsealed).
import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import test from "node:test";
import {
  blindInputProblems, checkFrozen, classifyPaths, judge, loadSealed, mine, pointer, seal, sealProblems, sha256, verifyRevisions,
  HISTORY_RECEIPT_SCHEMA, historyReceipt, historyReceiptPath, pinnedHistories, writeHistoryReceipt,
  REFEREE_ARGS, frozenRefereePin, runAdapter, runReferee,
} from "../../scripts/referee/history.mjs";
import {actionTypesIn, runDuel} from "../../scripts/referee/history-adapter.mjs";
import {evaluateHistory} from "../../scripts/referee/prove.mjs";

const duel = (seed, extra = {}) => ({
  seed, first: "cowboy",
  decks: {cowboy: ["cowboy-sheriff-1", "cowboy-billy-1"], wizard: [`wizard-skeleton-${seed + 1}`, "wizard-imp-1"]},
  actions: [{type: "summon", cardId: "cowboy-sheriff-1", tributes: []}, {type: "end"}, {type: "attack", slot: 0, target: "base"}],
  ...extra,
});
const FAKE = {parent: "a".repeat(40), fix: "b".repeat(40)};
const answer = (category, extra = {}) => ({
  category, ...FAKE, knownFix: {paths: ["src/game/showdown/rules.js"]}, rule: {source: "RULEBOOK.md §5"},
  observable: {pointer: "/final/sides/wizard/base"}, ...extra,
});

test("a blind input is a deal and moves only", () => {
  assert.deepEqual(blindInputProblems(duel(1)), []);
  assert.deepEqual(blindInputProblems(duel(1, {cardNames: {"cowboy-sheriff": "Sheriff"}})), []);
  for (const key of ["expected", "state", "result", "fix", "parent"]) {
    assert.ok(blindInputProblems(duel(1, {[key]: 1})).includes(`unexpected key ${key}`), key);
  }
  const bad = duel(1);
  bad.decks.cowboy.push("wizard-imp-1", "Sheriff");
  bad.actions.push({type: "attack", slot: 0, target: "face"}, {type: "summon", cardId: "cowboy-billy-1", tributes: [0, 0]},
    {type: "cast", cardId: "x-1"}, {type: "end", winner: "cowboy"});
  const problems = blindInputProblems(bad);
  for (const expected of ["decks.cowboy holds the other side's card wizard-imp-1", "instance id wizard-imp-1 appears twice",
    'decks.cowboy has bad instance id "Sheriff"', "actions[3].target is invalid", "actions[4].tributes is invalid",
    'actions[5] has unknown type "cast"', "actions[6] has unexpected field winner"]) {
    assert.ok(problems.includes(expected), expected);
  }
  assert.ok(blindInputProblems({...duel(1), first: "random"}).includes("first must be cowboy or wizard"));
  assert.ok(blindInputProblems(duel(1, {cardNames: {"cowboy-sheriff-1": "Sheriff"}})).some((p) => p.includes("not a catalog id")));
});

test("fix commits are sorted into engine, test-expectation and out-of-scope candidates by path", () => {
  assert.equal(classifyPaths(["src/game/showdown/rules.js", "prototypes/showdown/rules.test.js"]).kind, "engine-defect-candidate");
  assert.equal(classifyPaths([".kiro/specs/duel-card-pipeline/cards/cowboy-billy.json"]).kind, "engine-defect-candidate");
  // The engine lived in prototypes/showdown/ before it moved to src/game/showdown/.
  assert.equal(classifyPaths(["prototypes/showdown/rules.js", "prototypes/showdown/rules.test.js"]).kind, "engine-defect-candidate");
  assert.equal(classifyPaths(["prototypes/showdown/rules.test.js"]).kind, "test-expectation-candidate");
  assert.equal(classifyPaths(["src/game/showdown/presenter.js"]).kind, "excluded-out-of-scope");
  assert.equal(classifyPaths(["src/main.js"]).kind, "excluded-out-of-scope");
  assert.equal(classifyPaths(["README.md"]).kind, "excluded-unrelated");
});

test("the sealed answers must name both commits, the fix, the rule and the observable; inputs must differ", () => {
  const inputs = {cases: {h01: duel(1), h02: duel(2)}};
  const answers = {cases: {h01: answer("engine-defect"), h02: answer("test-expectation", {test: {path: "t.js"}, parentExpected: 4, fixExpected: 3})}};
  assert.deepEqual(sealProblems(inputs, answers), []);
  const broken = structuredClone(answers);
  delete broken.cases.h02.parentExpected;
  broken.cases.h01.fix = "HEAD";
  broken.cases.h01.category = "ui";
  const problems = sealProblems({cases: {...inputs.cases, h03: duel(1)}}, broken);
  for (const expected of ["h01: category must be engine-defect or test-expectation", "h01: parent and fix must be commit ids",
    "h02: test-expectation needs test.path, parentExpected and fixExpected", "h03: input has no sealed answer",
    "held-out inputs reuse a seed", "held-out inputs reuse a deal"]) {
    assert.ok(problems.includes(expected), expected);
  }
});

test("answers stay closed until asked for, and a changed file breaks its seal", () => {
  const files = {"/m/inputs.json": JSON.stringify({cases: {h01: duel(1)}}), "/m/answers.json": JSON.stringify({cases: {h01: answer("engine-defect")}})};
  const manifest = {inputs: {path: "inputs.json", sha256: sha256(files["/m/inputs.json"])},
    answers: {path: "answers.json", sha256: sha256(files["/m/answers.json"])}};
  files["/m/manifest.json"] = JSON.stringify(manifest);
  const opened = [];
  const read = (p) => { opened.push(p); return files[p]; };
  const sealed = loadSealed("/m/manifest.json", read);
  assert.deepEqual(opened, ["/m/manifest.json", "/m/inputs.json"]);
  assert.equal(sealed.openAnswers().cases.h01.category, "engine-defect");
  files["/m/answers.json"] = files["/m/answers.json"].replace("engine-defect", "test-expectation");
  assert.throws(() => sealed.openAnswers(), /answers seal broken/);
  files["/m/manifest.json"] = JSON.stringify({...manifest, inputs: {path: "inputs.json", sha256: null}});
  assert.throws(() => loadSealed("/m/manifest.json", read), /inputs are not sealed/);
});

test("seal refuses an empty set and writes both digests for a valid one", () => {
  const files = {"/m/manifest.json": JSON.stringify({inputs: {path: "inputs.json"}, answers: {path: "answers.json"}}),
    "/m/inputs.json": JSON.stringify({cases: {}}), "/m/answers.json": JSON.stringify({cases: {}})};
  const io = {read: (p) => files[p], write: (p, text) => { files[p] = text; }};
  assert.throws(() => seal("/m/manifest.json", io), /empty held-out set/);
  files["/m/inputs.json"] = JSON.stringify({cases: {h01: duel(1)}});
  files["/m/answers.json"] = JSON.stringify({cases: {h01: answer("engine-defect")}});
  seal("/m/manifest.json", io);
  const written = JSON.parse(files["/m/manifest.json"]);
  assert.equal(written.inputs.sha256, sha256(files["/m/inputs.json"]));
  assert.equal(written.answers.sha256, sha256(files["/m/answers.json"]));
});

// A fake shallow clone that holds only the fix commit.
function fakeGit({have, shallow = true, log = "", diffs = {}}) {
  return (args) => {
    if (args[0] === "rev-parse") return shallow ? "true\n" : "false\n";
    if (args[0] === "cat-file") { if (have.includes(args[2].replace("^{commit}", ""))) return ""; throw new Error("missing"); }
    if (args[0] === "log") return log;
    if (args[0] === "diff") return diffs[`${args[2]}..${args[3]}`] ?? "";
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
}

test("a revision missing from a shallow clone is a reported failure, not a skip", () => {
  const git = fakeGit({have: [FAKE.fix]});
  assert.deepEqual(verifyRevisions(git, {cases: {h01: answer("engine-defect")}}),
    [{id: "h01", status: "revision-missing", missing: [FAKE.parent], shallow: true}]);
  const c = "c".repeat(40), d = "d".repeat(40);
  const log = `${FAKE.fix}\x1f${FAKE.parent}\x1fFix ride damage\x1e${d}\x1f${c}\x1fFix Lasso target test\x1e`;
  const mined = mine(fakeGit({have: [FAKE.fix, c, d], log, diffs: {[`${c}..${d}`]: "prototypes/showdown/rules.test.js\n"}}));
  assert.equal(mined.shallow, true);
  assert.deepEqual(mined.candidates.map((x) => x.kind), ["parent-missing", "test-expectation-candidate"]);
});

test("engine defects and wrong test expectations are judged against different things", () => {
  const out = (base) => ({final: {sides: {wizard: {base}}}});
  const engine = answer("engine-defect");
  assert.equal(judge(engine, {referee: out(4), parent: out(3), fix: out(4)}).verdict, "reproduced");
  assert.equal(judge(engine, {referee: out(3), parent: out(3), fix: out(4)}).verdict, "referee-sides-with-parent");
  assert.equal(judge(engine, {referee: out(4), parent: out(4), fix: out(4)}).verdict, "no-difference");
  assert.equal(judge(engine, {referee: out(4), parent: {error: "boom"}, fix: out(4)}).verdict, "not-run");
  assert.equal(judge(engine, {referee: {}, parent: out(3), fix: out(4)}).verdict, "unsupported");
  const expectation = answer("test-expectation", {test: {path: "t.js"}, parentExpected: 3, fixExpected: 4});
  // The engine did not change; only the test's expected value did. The rules must pick the new one.
  assert.equal(judge(expectation, {referee: out(4), parent: out(4), fix: out(4)}).verdict, "reproduced");
  assert.equal(judge(expectation, {referee: out(3), parent: out(4), fix: out(4)}).verdict, "referee-sides-with-old-expectation");
  assert.equal(pointer({a: {"b/c": [7]}}, "/a/b~1c/0"), 7);
});

test("only the pinned referee bytes may run", () => {
  const bytes = Buffer.from("print('referee')\n");
  const digest = sha256(bytes);
  assert.doesNotThrow(() => checkFrozen("r.py", digest, () => bytes));
  assert.throws(() => checkFrozen("r.py", digest, () => Buffer.from("print('edited')\n")), /not the frozen one/);
  assert.throws(() => checkFrozen("r.py", null, () => bytes), /not pinned/);
});

// --- The bridge: frozen referee CLI and archived engines --------------------------------------

test("the referee is run through its documented --stream CLI with exactly one duel line", () => {
  const calls = [];
  const spawn = (cmd, args, opts) => { calls.push({cmd, args, opts}); return {status: 0, stdout: '{"seed":1,"initial":{},"steps":[],"unsupported":[]}\n'}; };
  assert.deepEqual(runReferee("proof/referee/referee.py", duel(1), spawn), {seed: 1, initial: {}, steps: [], unsupported: []});
  assert.deepEqual(REFEREE_ARGS, ["--stream"]);
  assert.equal(calls[0].cmd, "python3");
  assert.deepEqual(calls[0].args.slice(-1), ["--stream"]);
  assert.equal(calls[0].opts.input, `${JSON.stringify(duel(1))}\n`);
  assert.equal(calls[0].opts.input.trim().split("\n").length, 1);
  const two = () => ({status: 0, stdout: "{}\n{}\n"});
  assert.throws(() => runReferee("r.py", duel(1), two), /2 result lines/);
  assert.throws(() => runReferee("r.py", duel(1), () => ({status: 2, stdout: "", stderr: "usage"})), /exited 2/);
});

// A tiny archived engine with the pre-move layout: no cover, gear, location, ready flag or attackOf.
// It is harness data written for this test, not a real revision.
function fakeArchive({cards = {"cowboy-sheriff": ["cowboy", "Sheriff", 3], "wizard-skeleton": ["wizard", "Skeleton", 3]}} = {}) {
  const root = mkdtempSync(join(tmpdir(), "referee-history-archive-"));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), {recursive: true}); writeFileSync(join(root, rel), text); };
  put("package.json", '{"type":"module"}\n');
  put("prototypes/showdown/cards.js", `const T = ${JSON.stringify(Object.fromEntries(Object.entries(cards).map(([t, [side, name, health]]) => [t, {side, name, health, attack: 1, tag: "X"}])))};
export const cardOf = (id) => T[id.replace(/-\\d+$/, "")];\n`);
  put("prototypes/showdown/rules.js", `import {cardOf} from "./cards.js";
export const TRAP_SLOTS = 2;
const END = {type: "end"};
export function createShowdown(seed, {first, decks}) {
  const sides = {};
  for (const side of ["cowboy", "wizard"]) {
    const deck = Object.entries(decks[side]).flatMap(([t, n]) => Array.from({length: n}, (_, i) => t + "-" + (i + 1)));
    sides[side] = {base: 5, hand: deck.splice(0, side === first ? 1 : 2), deck, board: [null, null, null], traps: [], discard: []};
  }
  return {turn: 1, active: first, first, summonUsed: false, castUsed: false, setUsed: false, attacking: false, result: null, sides};
}
export function applyAction(state, action) {
  const next = structuredClone(state);
  const own = next.sides[next.active];
  if (action.type === "summon") {
    if (!own.hand.includes(action.cardId)) throw new Error("illegal action");
    own.hand.splice(own.hand.indexOf(action.cardId), 1);
    own.board[own.board.indexOf(null)] = {cardId: action.cardId, health: cardOf(action.cardId).health, attacked: false, stunned: false, arrived: next.turn};
  } else if (action.type === "attack") throw new Error("illegal action");
  else { next.active = next.active === "cowboy" ? "wizard" : "cowboy"; next.turn += 1; }
  return {state: next, events: []};
}\n`);
  return {root, done: () => rmSync(root, {recursive: true, force: true})};
}
const archivedDuel = (extra = {}) => ({seed: 7, first: "cowboy",
  decks: {cowboy: ["cowboy-sheriff-2", "cowboy-sheriff-1"], wizard: ["wizard-skeleton-1", "wizard-skeleton-3", "wizard-skeleton-2"]},
  actions: [{type: "summon", cardId: "cowboy-sheriff-1", tributes: []}, {type: "summon", cardId: "cowboy-sheriff-2", tributes: []},
    {type: "cover", slot: 0}, {type: "end"}], ...extra});

test("an archived engine replays the blind order, and what it lacks is reported, never filled from current rules", async () => {
  const archive = fakeArchive();
  try {
    const out = await runDuel(archive.root, archivedDuel());
    assert.equal(out.engine.path, "prototypes/showdown");
    assert.deepEqual(out.engine.actionTypes, ["summon", "attack", "end"]);
    // The input order replaces the archived shuffle; the hand size is the archived engine's own deal.
    assert.deepEqual(out.initial.players.cowboy.hand, ["cowboy-sheriff-2"]);
    assert.deepEqual(out.initial.players.wizard.deck, ["wizard-skeleton-2"]);
    // sheriff-1 is still in the deck: a real rejection, state unchanged.
    assert.equal(out.steps[0].accepted, false);
    assert.deepEqual(out.steps[0].state, out.initial);
    assert.equal(out.steps[1].accepted, true);
    assert.deepEqual(out.steps[1].state.players.cowboy.troops[0], {id: "cowboy-sheriff-2", card: "Sheriff", type: "X", orbs: 3, acted: false});
    assert.ok(!("location" in out.steps[1].state));
    // Cover does not exist at this revision: that step and the rest carry no accepted or state.
    assert.deepEqual(out.steps[2], {error: "unsupported-historical-api:cover"});
    assert.match(out.steps[3].error, /^not-run: step 2/);
    assert.ok(!("accepted" in out.steps[3]));
    for (const note of ["step 2: unsupported-historical-api:cover", "field troops[].attack", "field troops[].rest", "field location"]) {
      assert.ok(out.unsupported.some((u) => u.startsWith(note)), note);
    }
    // Judged on that step, the missing value is unsupported, not a difference or an agreement.
    const verdict = judge(answer("engine-defect", {observable: {pointer: "/steps/2/accepted"}}),
      {referee: {steps: [{}, {}, {accepted: true}]}, parent: out, fix: {steps: [{}, {}, {accepted: true}]}});
    assert.equal(verdict.verdict, "unsupported");
    assert.match(verdict.reason, /on parent/);
    // A deal the archived constructor cannot produce is refused for the whole duel.
    const renumbered = archivedDuel({decks: {cowboy: ["cowboy-sheriff-1", "cowboy-sheriff-3"], wizard: ["wizard-skeleton-1"]}});
    await assert.rejects(runDuel(archive.root, renumbered), /unsupported-historical-api: createShowdown at this revision does not deal/);
    await assert.rejects(runDuel(archive.root, archivedDuel({cardNames: {"cowboy-sheriff": "Marshal"}})), /this revision prints "Sheriff"/);
  } finally { archive.done(); }
});

test("run refuses an adapter that would replay the current engine under a past commit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "referee-history-adapter-"));
  try {
    writeFileSync(join(dir, "pinned-like.mjs"), "export function* replay(duel) { yield {step: 0}; }\n");
    await assert.rejects(runAdapter(join(dir, "pinned-like.mjs"), dir, duel(1)), /exports only replay\(duel\), which runs the current engine/);
    writeFileSync(join(dir, "empty.mjs"), "export const x = 1;\n");
    await assert.rejects(runAdapter(join(dir, "empty.mjs"), dir, duel(1)), /does not export runDuel/);
    // The pinned adapter itself is one of these: it has replay and no runDuel.
    const pinned = readFileSync(new URL("../../scripts/referee/adapter.mjs", import.meta.url), "utf8");
    assert.match(pinned, /export function\* replay\(duel\)/);
    assert.doesNotMatch(pinned, /export (async )?function runDuel/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("action types are read from the archived applyAction, and the referee pin needs the frozen tree", () => {
  assert.deepEqual(actionTypesIn('if (action.type === "summon") {} else if (action.type === "cover") {} actions.push({type: "end"});'), ["summon", "cover", "end"]);
  const dir = mkdtempSync(join(tmpdir(), "referee-history-freeze-"));
  try {
    writeFileSync(join(dir, "referee.py"), "print('frozen')\n");
    writeFileSync(join(dir, "freeze.json"), JSON.stringify({referee: {treeSha256: "a".repeat(64)}}));
    const pin = frozenRefereePin(join(dir, "referee.py"), join(dir, "freeze.json"), {tree: () => "a".repeat(64)});
    assert.equal(pin.sha256, sha256(readFileSync(join(dir, "referee.py"))));
    assert.throws(() => frozenRefereePin(join(dir, "referee.py"), join(dir, "freeze.json"), {tree: () => "b".repeat(64)}), /is not the frozen/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("the committed held-out set is honestly empty and unsealed", () => {
  const url = (rel) => new URL(`../../proof/history/${rel}`, import.meta.url);
  const manifest = JSON.parse(readFileSync(url("manifest.json"), "utf8"));
  assert.deepEqual(JSON.parse(readFileSync(url("inputs.json"), "utf8")).cases, {});
  assert.deepEqual(JSON.parse(readFileSync(url("answers.json"), "utf8")).cases, {});
  assert.equal(manifest.inputs.sha256, null);
  assert.throws(() => loadSealed(url("manifest.json").pathname), /not sealed/);
});

test("the triage record counts nothing as verified while no case is sealed", () => {
  const url = (rel) => new URL(`../../proof/history/${rel}`, import.meta.url);
  const triage = JSON.parse(readFileSync(url("triage.json"), "utf8"));
  const answers = JSON.parse(readFileSync(url("answers.json"), "utf8"));
  const changes = triage.commits.flatMap((c) => c.changes.map((change) => ({...change, commit: c.commit, parent: c.parent})));
  for (const c of triage.commits) {
    assert.match(c.commit, /^[0-9a-f]{40}$/);
    assert.match(c.parent, /^[0-9a-f]{40}$/);
  }
  for (const change of changes) assert.ok(change.status in triage.statuses, `${change.commit}: unknown status ${change.status}`);
  const sealed = changes.filter((change) => change.status === "sealed");
  assert.equal(triage.verified, sealed.length);
  assert.equal(sealed.length, Object.keys(answers.cases).length);
  // A defect seen only in an event field or in bot choices is never a state finding.
  for (const change of changes.filter((c) => c.status.startsWith("excluded-") || c.status === "candidate-unsupported")) {
    assert.ok(!Object.values(answers.cases).some((a) => a.fix === change.commit), `${change.commit} is excluded but has an answer`);
  }
});

// --- pinnedHistories: what prove.mjs counts -------------------------------------------------
// The temporary repositories below hold harness data only. Their commit ids are made up and
// their "reproduced" verdicts are written by the test, so nothing here is a historical finding.

const KEY = "f".repeat(64);
const rev = (n) => n.toString(16).padStart(40, "0");
const ENGINE_CASES = ["h01", "h02", "h03", "h04"];

// A sealed five-case set (four engine defects and one test expectation, each with its own fix
// commit), a pinned referee and adapter, and a receipt for KEY that reports every case.
function fixtureRepo({verdicts = {}, answersEdit = (a) => a} = {}) {
  const root = mkdtempSync(join(tmpdir(), "referee-history-pinned-"));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), {recursive: true}); writeFileSync(join(root, rel), text); };
  put("proof/referee/referee.py", "print('frozen referee')\n");
  put("scripts/referee/adapter.mjs", "export const schema = 'x';\n");
  const ids = [...ENGINE_CASES, "h05"];
  const inputs = {cases: Object.fromEntries(ids.map((id, i) => [id, duel(10 + i)]))};
  const answers = answersEdit({cases: Object.fromEntries(ids.map((id, i) => [id, id === "h05"
    ? answer("test-expectation", {parent: rev(2 * i + 1), fix: rev(2 * i + 2), test: {path: "t.js"}, parentExpected: 3, fixExpected: 4})
    : answer("engine-defect", {parent: rev(2 * i + 1), fix: rev(2 * i + 2)})]))});
  const inputsText = JSON.stringify(inputs);
  const answersText = JSON.stringify(answers);
  put("proof/history/inputs.json", inputsText);
  put("proof/history/answers.json", answersText);
  put("proof/history/manifest.json", JSON.stringify({id: "fixture-v1",
    referee: {path: "proof/referee/referee.py", sha256: sha256(readFileSync(join(root, "proof/referee/referee.py")))},
    inputs: {path: "inputs.json", sha256: sha256(inputsText)}, answers: {path: "answers.json", sha256: sha256(answersText)}}));
  const report = {manifest: "fixture-v1", cases: ids.length,
    results: ids.map((id) => ({id, category: answers.cases[id].category, verdict: verdicts[id] ?? "reproduced"})),
    seals: {inputs: sha256(inputsText), answers: sha256(answersText), referee: sha256(readFileSync(join(root, "proof/referee/referee.py")))}};
  const receipt = historyReceipt(report, {freezeKey: KEY, repo: root,
    refereePath: join(root, "proof/referee/referee.py"), adapterPath: join(root, "scripts/referee/adapter.mjs")});
  const commits = Object.values(answers.cases).flatMap((a) => [a.parent, a.fix]);
  return {root, put, receipt, commits, done: () => rmSync(root, {recursive: true, force: true})};
}
const gitWith = (commits) => fakeGit({have: commits, shallow: false});
const judged = async (repo, extra = {}) => {
  const ctx = {root: repo.root, freezeKey: KEY, git: gitWith(repo.commits), ...extra};
  const result = await pinnedHistories(ctx);
  return {result, verdict: evaluateHistory(result, ctx)};
};

test("five sealed, pinned, independent reproductions pass the history gate", async () => {
  const repo = fixtureRepo();
  try {
    writeHistoryReceipt(repo.root, repo.receipt);
    const {result, verdict} = await judged(repo);
    assert.equal(result.verified, 5);
    assert.deepEqual(result.problems, []);
    assert.equal(verdict.status, "pass");
    assert.deepEqual(verdict.counts, {caught: 5, missed: 0, unknown: 0, caughtEngine: 4, caughtTests: 1});
    assert.throws(() => writeHistoryReceipt(repo.root, repo.receipt), /EEXIST/, "a receipt is never replaced");
  } finally { repo.done(); }
});

test("missing evidence counts an actual zero against the five-case gate", async () => {
  const repo = fixtureRepo();
  try {
    const {result, verdict} = await judged(repo);
    assert.equal(result.freezeKey, KEY);
    assert.deepEqual(result.defects, []);
    assert.equal(result.verified, 0);
    assert.match(result.problems[0], /no history receipt/);
    assert.equal(verdict.status, "fail");
    assert.deepEqual(verdict.gates.map((g) => [g.name, g.actual, g.pass]),
      [["historical defects caught", 0, false], ["caught engine defects", 0, false], ["caught test defects", 0, false]]);
    const none = await pinnedHistories({root: repo.root, freezeKey: null});
    assert.equal(evaluateHistory(none, {freezeKey: KEY}).status, "stale", "no freeze key is never this freeze");
    rmSync(join(repo.root, "proof/history/manifest.json"));
    assert.match((await judged(repo)).result.problems[0], /manifest.json is missing/);
  } finally { repo.done(); }
});

test("a receipt from another freeze is reported stale, not counted", async () => {
  const repo = fixtureRepo();
  try {
    const old = "e".repeat(64);
    writeHistoryReceipt(repo.root, {...repo.receipt, freezeKey: old});
    const {result, verdict} = await judged(repo);
    assert.equal(result.freezeKey, old);
    assert.deepEqual(result.defects, []);
    assert.equal(verdict.status, "stale");
    // A receipt filed under this key but recording another one is also stale.
    writeFileSync(historyReceiptPath(repo.root, KEY), JSON.stringify({...repo.receipt, freezeKey: old}));
    assert.equal((await judged(repo)).verdict.status, "stale");
  } finally { repo.done(); }
});

test("a changed referee, adapter or sealed answer voids the receipt", async () => {
  for (const [what, edit, message] of [
    ["referee", (r) => r.put("proof/referee/referee.py", "print('edited')\n"), /referee/],
    ["adapter", (r) => r.put("scripts/referee/adapter.mjs", "export const schema = 'y';\n"), /adapter.mjs changed/],
    ["adapter removed", (r) => rmSync(join(r.root, "scripts/referee/adapter.mjs")), /adapter.mjs is missing/],
    ["answers", (r) => r.put("proof/history/answers.json", "{\"cases\":{}}"), /answers seal broken/],
  ]) {
    const repo = fixtureRepo();
    try {
      writeHistoryReceipt(repo.root, repo.receipt);
      edit(repo);
      const {result, verdict} = await judged(repo);
      assert.deepEqual(result.defects, [], what);
      assert.ok(result.problems.some((p) => message.test(p)), `${what}: ${result.problems.join("; ")}`);
      assert.equal(verdict.status, "fail", what);
      assert.equal(verdict.counts.caught, 0, what);
    } finally { repo.done(); }
  }
});

test("a receipt that omits, repeats or invents a case counts nothing", async () => {
  for (const [what, results, message] of [
    ["omits", (r) => r.slice(1), /omits sealed cases: h01/],
    ["repeats", (r) => [...r, r[0]], /twice/],
    ["invents", (r) => [...r.slice(1), {id: "h99", verdict: "reproduced"}], /not in the sealed set: h99/],
  ]) {
    const repo = fixtureRepo();
    try {
      writeHistoryReceipt(repo.root, {...repo.receipt, results: results(repo.receipt.results)});
      const {result} = await judged(repo);
      assert.deepEqual(result.defects, [], what);
      assert.ok(result.problems.some((p) => message.test(p)), what);
    } finally { repo.done(); }
  }
});

test("unpinned, missing or shared fix commits do not count as independent caught defects", async () => {
  const short = fixtureRepo({answersEdit: (a) => { a.cases.h01.fix = a.cases.h01.fix.slice(0, 12); return a; }});
  try {
    writeHistoryReceipt(short.root, short.receipt);
    const {result, verdict} = await judged(short);
    assert.equal(result.defects.find((d) => d.id === "h01").verdict, "unknown");
    assert.equal(verdict.counts.caught, 4);
    assert.equal(verdict.status, "fail");
  } finally { short.done(); }

  const shallow = fixtureRepo();
  try {
    writeHistoryReceipt(shallow.root, shallow.receipt);
    const {result, verdict} = await judged(shallow, {git: gitWith(shallow.commits.slice(1))});
    assert.equal(result.defects.find((d) => d.id === "h01").verdict, "unknown");
    assert.ok(result.problems.some((p) => p.includes(rev(1))));
    assert.equal(verdict.status, "fail");
  } finally { shallow.done(); }

  const shared = fixtureRepo({answersEdit: (a) => { a.cases.h02.fix = a.cases.h01.fix; return a; }});
  try {
    writeHistoryReceipt(shared.root, shared.receipt);
    const {result, verdict} = await judged(shared);
    assert.equal(result.verified, 4);
    assert.ok(result.problems.some((p) => /already counted/.test(p)));
    assert.equal(verdict.status, "fail");
  } finally { shared.done(); }
});

test("only a reproduced verdict is caught; other recorded verdicts are missed or unknown", async () => {
  const repo = fixtureRepo({verdicts: {h01: "referee-sides-with-parent", h02: "no-difference", h03: "fail-revision-missing"}});
  try {
    writeHistoryReceipt(repo.root, repo.receipt);
    const {verdict} = await judged(repo);
    assert.deepEqual(verdict.counts, {caught: 2, missed: 1, unknown: 2, caughtEngine: 1, caughtTests: 1});
    assert.equal(verdict.status, "fail");
  } finally { repo.done(); }
});

test("the committed history evidence gives prove.mjs an actual zero", async () => {
  const root = new URL("../../", import.meta.url).pathname;
  const ctx = {root, freezeKey: KEY};
  const result = await pinnedHistories(ctx);
  assert.equal(result.verified, 0);
  assert.deepEqual(result.defects, []);
  assert.match(result.problems[0], /not sealed/);
  const verdict = evaluateHistory(result, ctx);
  assert.equal(verdict.status, "fail");
  assert.equal(verdict.counts.caught, 0);
  assert.equal(HISTORY_RECEIPT_SCHEMA, "referee-history-receipt/1");
});
