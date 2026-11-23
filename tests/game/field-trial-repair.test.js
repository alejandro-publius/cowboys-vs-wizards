// Night Shift field-trial repair: engine observer contract, change validation, workflow order,
// protocol separation, and the witness reading the confirm record's real `base` and declared protocol.
// Needs only this checkout's HEAD commit (works with a single-ref, depth-1 PR clone). No network, no
// secrets, and nothing under this checkout's .artifacts is read or written: scratch lives in os.tmpdir().
//
// The fresh.json records handed to the witness are built the way scripts/field-trial-confirm.mjs builds
// them: the real measurePairedCohort pair stream, the real exported evaluateBlock and decide, the current
// balance contract and protocol, and the real seal. Only the game outcomes are synthetic: deterministic
// labelled results, so the records are fast and both confirm blocks genuinely pass the production gates.
import test, {after} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {measurePairedCohort} from "../../src/review/paired-duel-kit.js";
import {BOUNDS, FACTIONS, FIELDS, INPUT_PATHS, openTrialEngine, playTrial} from "../../scripts/field-trial-engine.mjs";
import {cohortProblems, decide, evaluateBlock, PROTOCOL_PATH, protocolProblems, seal, separationProblems} from "../../scripts/field-trial-confirm.mjs";
import {canonical, changeField, sha256} from "../../scripts/night-review.mjs";
import {CONTRACT_PATH, parseBalanceContract} from "../../scripts/showdown-balance-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW = join(ROOT, ".kiro/workflows/night-shift-field-trial.workflow.json");
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
const SEED = 4242; // any fixed seed; no outcome is asserted for it
const WITNESS_TIMEOUT_MS = 180_000;

// Git without inherited GIT_DIR/GIT_WORK_TREE etc., so a hook environment cannot redirect it.
const GIT_FREE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
function git(cwd, args, {allowFail = false} = {}) {
  const r = spawnSync("git", args, {cwd, encoding: "utf8", env: {...GIT_FREE_ENV, GIT_TERMINAL_PROMPT: "0"}, maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")}: ${String(r.stderr).trim()}`);
  }
  return r.stdout.trim();
}
const HEAD = git(ROOT, ["rev-parse", "--verify", "HEAD^{commit}"], {allowFail: true});
const NO_GIT = HEAD ? false : "not a Git checkout with a HEAD commit";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const scratch = mkdtempSync(join(tmpdir(), "field-trial-repair-"));
after(() => rmSync(scratch, {recursive: true, force: true}));
let n = 0;
const freshDir = (name) => join(scratch, `${name}-${++n}`); // not created: openTrialEngine makes it private

// One pristine pair at HEAD plus one valid candidate change, built once and shared.
let shared = null;
function setup() {
  shared ??= (async () => {
    const a = await openTrialEngine(freshDir("pristine-a"), "HEAD");
    const b = await openTrialEngine(freshDir("pristine-b"), "HEAD", null, a.inputs);
    // Deck card types come from a real deal; their specs come from the HEAD commit's card JSON.
    const deal = a.rules.createShowdown(SEED);
    const ids = FACTIONS.flatMap((side) => [...deal.sides[side].deck, ...deal.sides[side].hand]);
    const specs = [...new Set(ids.map((id) => String(id).replace(/-\d+$/, "")))].sort().flatMap((type) => {
      const text = git(ROOT, ["cat-file", "blob", `HEAD:${CARD_DIR}/${type}.json`], {allowFail: true});
      return text === null ? [] : [{type, spec: JSON.parse(text)}];
    });
    const troops = specs.filter(({type, spec}) => spec.kind === "troop" && spec.type === type);
    assert.ok(troops.length, "no troop card spec found for the fixed Showdown decks at HEAD");
    // The first adjacent one-number edit the real compiler accepts; which one is not asserted.
    let candidate = null;
    search: for (const {type, spec} of troops) for (const field of FIELDS) for (const delta of [1, -1]) {
      const from = spec[field], to = from + delta;
      if (!Number.isSafeInteger(from) || to < BOUNDS[field][0] || to > BOUNDS[field][1]) continue;
      const change = {card: type, field, from, to};
      try {
        candidate = {change, engine: await openTrialEngine(freshDir("candidate"), "HEAD", change, a.inputs)};
        break search;
      } catch { /* the compiler's stricter spec rules refused this edit; try the next */ }
    }
    assert.ok(candidate, "no adjacent one-number troop edit compiled at HEAD");
    const other = specs.find(({spec}) => spec.kind !== "troop") ?? null;
    return {a, b, candidate, troops, nonTroop: other?.type ?? null};
  })();
  return shared;
}

test("a pristine HEAD engine pair pins the four inputs to HEAD's own objects", {skip: NO_GIT}, async () => {
  const {a, b, candidate} = await setup();
  assert.deepEqual(Object.keys(a.inputs).sort(), [...INPUT_PATHS].sort());
  for (const path of INPUT_PATHS) assert.equal(a.inputs[path], git(ROOT, ["rev-parse", "--verify", `HEAD:${path}`]), path);
  assert.deepEqual(b.inputs, a.inputs);
  assert.deepEqual(candidate.engine.inputs, a.inputs, "a candidate is built from the same frozen inputs");
});

test("playTrial reports the real before state and applied events for both opening seats; action is optional", {skip: NO_GIT}, async () => {
  const {a, b} = await setup();
  assert.throws(() => playTrial(a.rules, SEED, "sheriff"));
  for (const first of FACTIONS) {
    const steps = [];
    const traced = playTrial(a.rules, SEED, first, (before, applied, action) => steps.push({before, applied, action}));
    const untraced = playTrial(b.rules, SEED, first);
    assert.deepEqual(traced, untraced, `${first} first: observing must not change the game, and the pair must agree`);
    assert.ok([...FACTIONS, "draw"].includes(traced.winner) && Number.isSafeInteger(traced.endTurn));
    assert.ok(steps.length > 1, `${first} first: the observer saw no bot actions`);
    assert.equal(steps[0].before.turn, 1);
    assert.equal(steps[0].before.first, first);
    assert.equal(steps[0].before.active, first, "the opening seat acts first");
    const sides = new Set();
    steps.forEach(({before, applied, action}, i) => {
      assert.ok(Number.isSafeInteger(before?.turn) && before.sides?.cowboy && before.sides?.wizard, `step ${i}: before is not a game state`);
      assert.equal(before.result, null, `step ${i}: a finished game was observed again`);
      assert.ok(Array.isArray(applied?.events), `step ${i}: applied.events is missing`);
      assert.ok(applied.state && applied.state !== before, `step ${i}: applied.state is missing`);
      for (const event of applied.events) {
        assert.equal(typeof event.type, "string");
        if (FACTIONS.includes(event.side)) sides.add(event.side);
      }
      if (action !== undefined) assert.equal(typeof action?.type, "string", `step ${i}: a reported action has no type`);
      if (i > 0) assert.deepEqual(before, steps[i - 1].applied.state, `step ${i}: before is not the previous step's result`);
    });
    assert.ok(steps.some((s) => s.applied.events.length), `${first} first: no events were reported`);
    assert.deepEqual([...sides].sort(), [...FACTIONS].sort(), `${first} first: events must come from both seats`);
    const end = steps.at(-1).applied.state;
    assert.ok(end.result, "the last observed step ends the game");
    assert.equal(end.result.winner ?? "draw", traced.winner);
  }
});

// Shape errors (card key form, field name, whole numbers, to !== from, exact keys, ref form) are refused
// by the engine before it resolves Git or creates the directory. The values here need not match any card.
test("openTrialEngine rejects malformed card keys, fields, numbers and refs before touching the directory", async () => {
  const base = {card: "cowboy-billy", field: "attack", from: 3, to: 4};
  const bad = [
    {...base, card: "../cards/cowboy-billy"}, {...base, card: "cowboy-billy.json"}, {...base, card: "Cowboy-Billy"},
    {...base, card: "cowboy/billy"}, {...base, card: ""}, {...base, field: "speed"}, {...base, field: "Attack"},
    {...base, field: "__proto__"}, {...base, from: 3.5}, {...base, from: "3"}, {...base, to: 3},
    {card: base.card, field: base.field, from: 3}, {...base, extra: 1},
  ];
  for (const change of bad) {
    const dir = freshDir("bad-change");
    await assert.rejects(openTrialEngine(dir, "HEAD", change), Error, JSON.stringify(change));
    assert.equal(existsSync(dir), false, `${JSON.stringify(change)} created ${dir}`);
  }
  for (const ref of ["main", "HEAD~1", "abc123", ""]) {
    const dir = freshDir("bad-ref");
    await assert.rejects(openTrialEngine(dir, ref), Error, ref);
    assert.equal(existsSync(dir), false, `ref ${JSON.stringify(ref)} created ${dir}`);
  }
});

// A well-formed whole number passes the shape check even when the card compiler forbids it. The engine
// does not judge legality: it writes the edit into its scratch candidate and the real compiler refuses it
// there. scripts/sync-card-specs.mjs caps troop health at MAX_HEALTH = 5, so health 6 is illegal for every
// troop. (BOUNDS are contest-search bounds, not compiler caps: BOUNDS allows health up to 12, and the
// compiler sets no attack ceiling, so an attack edit is not a reliable rejection.)
const COMPILER_ILLEGAL_HEALTH = 6;
test("openTrialEngine leaves troop health 6, which the compiler caps at 5, to the compiler, which rejects it in scratch", {skip: NO_GIT}, async () => {
  const {a, troops} = await setup();
  const troop = troops.find(({spec}) => Number.isSafeInteger(spec.health) && spec.health !== COMPILER_ILLEGAL_HEALTH);
  assert.ok(troop, "no troop with a whole-number health below the compiler cap at HEAD");
  const card = troop.type, field = "health", from = troop.spec.health;
  const change = {card, field, from, to: COMPILER_ILLEGAL_HEALTH};
  const dir = freshDir("illegal-health");
  await assert.rejects(openTrialEngine(dir, "HEAD", change, a.inputs), /candidate card compile failed:[\s\S]*health must be an integer from 1 to 5/, JSON.stringify(change));
  const edited = join(dir, "candidate", CARD_DIR, `${card}.json`);
  assert.equal(existsSync(edited), true, "the edit never reached the scratch candidate, so the compiler did not judge it");
  assert.equal(readJson(edited)[field], change.to, "the scratch card holds the refused value");
});

test("openTrialEngine rejects a missing or non-troop card and a from-value that is not the card's real value", {skip: NO_GIT}, async () => {
  const {a, candidate, nonTroop} = await setup();
  const {card, field, from, to} = candidate.change;
  await assert.rejects(openTrialEngine(freshDir("missing-card"), "HEAD", {card: "no-such-showdown-card", field, from, to}, a.inputs));
  if (nonTroop) await assert.rejects(openTrialEngine(freshDir("non-troop"), "HEAD", {card: nonTroop, field, from, to}, a.inputs));
  // Same card, field and target value as the accepted edit; only `from` no longer matches the card at HEAD.
  const wrongFrom = [to - 1, to + 1, to - 2, to + 2].find((v) => v !== from && v !== to && Number.isSafeInteger(v));
  await assert.rejects(openTrialEngine(freshDir("wrong-from"), "HEAD", {card, field, from: wrongFrom, to}, a.inputs));
});

function flatten(steps, repeat = null, top = null, out = []) {
  steps.forEach((step, i) => {
    if (step.type === "repeat") flatten(step.steps, step, top ?? i, out);
    else out.push({step, repeat, top: top ?? i});
  });
  return out;
}

test("the workflow nominates inside the balance loop, then confirms once and witnesses once with no retry", () => {
  const workflow = readJson(WORKFLOW);
  const steps = flatten(workflow.steps);
  const running = (script) => steps.filter(({step}) => String(step.prompt ?? "").includes(script));
  const nominations = steps.filter(({step}) => step.agent === "showdown-balancer");
  const confirms = running("scripts/field-trial-confirm.mjs");
  const witnesses = running("scripts/field-trial-witness.mjs");
  assert.ok(nominations.length >= 1, "no nomination step");
  assert.equal(confirms.length, 1, "fresh confirmation must be exactly one step");
  assert.equal(witnesses.length, 1, "the witness must be exactly one step");
  const [confirm] = confirms, [witness] = witnesses;
  for (const nomination of nominations) assert.ok(nomination.top < confirm.top, "nomination must precede fresh confirmation");
  assert.ok(confirm.top < witness.top, "the witness runs only after fresh confirmation");
  assert.equal(confirm.repeat, null, "fresh confirmation must not sit inside a repeat (no automatic retry)");
  assert.equal(witness.repeat, null, "the witness must not sit inside a repeat");
  workflow.steps.forEach((step, i) => {
    if (step.type === "repeat") assert.ok(i < confirm.top, `repeat ${step.id} wraps or follows fresh confirmation`);
  });
  assert.ok(nominations.every((s) => s.repeat), "nomination happens inside the bounded balance loop");
  assert.notEqual(confirm.step.agent, nominations[0].step.agent, "the confirming agent did not nominate the candidate");
});

const closed = ({first, deals}) => ({first, last: first + deals - 1});
const disjoint = (x, y) => x.last < y.first || y.last < x.first;

test("the fixed confirm seed ranges are valid and completely disjoint from scouting and from each other", () => {
  const protocol = readJson(join(ROOT, PROTOCOL_PATH));
  assert.deepEqual(protocolProblems(protocol), []);
  const confirm = protocol.confirm.map(closed), scout = protocol.scout.map(closed);
  confirm.forEach((c, i) => {
    scout.forEach((s, j) => assert.ok(disjoint(c, s), `confirm[${i}] overlaps scout[${j}]`));
    confirm.slice(i + 1).forEach((d, j) => assert.ok(disjoint(c, d), `confirm[${i}] overlaps confirm[${i + j + 1}]`));
  });
});

test("separationProblems rejects a single shared seed with scouting or historical tune/holdout selection", () => {
  const {scout, confirm} = readJson(join(ROOT, PROTOCOL_PATH));
  const top = Math.max(...[...scout, ...confirm].map((r) => closed(r).last));
  const tune = {from: top + 1, last: top + 10}, holdout = {from: top + 11, last: top + 20};
  assert.deepEqual(separationProblems({confirm, scout, tune, holdout}), [], "clear ranges report no problem");
  for (const [i, range] of confirm.entries()) {
    const edge = closed(range).last;
    const touching = {from: edge, last: edge + 5};
    assert.ok(separationProblems({confirm, scout, tune: touching, holdout}).length, `tune sharing confirm[${i}]'s last seed`);
    assert.ok(separationProblems({confirm, scout, tune, holdout: touching}).length, `holdout sharing confirm[${i}]'s last seed`);
    assert.ok(separationProblems({confirm, scout: [...scout, {first: range.first, deals: 1}], tune, holdout}).length, `scout sharing confirm[${i}]'s first seed`);
  }
  assert.ok(separationProblems({confirm, scout, tune: null, holdout}).length, "a missing historical range is not treated as disjoint");
});

// ---- fresh.json fixtures built by the production block code ----

// Deterministic labelled outcomes. Baseline: Cowboy wins exactly half the games and the opening seat wins
// exactly half. Candidate: the cowboy-first games of the first two deals swap winners (Cowboy -> Wizard and
// Wizard -> Cowboy), so faction totals and opening wins stay equal while two results change.
function labelledOutcome(range, seed, first, arm) {
  const i = seed - range.first;
  let winner = (i + (first === "wizard" ? 1 : 0)) % 2 === 0 ? "cowboy" : "wizard";
  const flipped = arm === "candidate" && first === "cowboy" && i < 2;
  if (flipped) winner = winner === "cowboy" ? "wizard" : "cowboy";
  return {winner, endTurn: 8 + (i % 5) + (flipped ? 1 : 0)};
}

// One confirm block exactly as field-trial-confirm.mjs makes it: the shared kit plays the range once, its
// pair stream feeds evaluateBlock, and the kit's own counts must agree with the block.
function measuredBlock(id, range, policy) {
  const pairs = [];
  const counts = measurePairedCohort({firstSeed: range.first, deals: range.deals, sides: [...FACTIONS],
    playBaseline: (seed, first) => labelledOutcome(range, seed, first, "baseline"),
    playCandidate: (seed, first) => labelledOutcome(range, seed, first, "candidate"),
    onPair: (pair) => { pairs.push(pair); }});
  const block = evaluateBlock(id, range, pairs, policy);
  assert.deepEqual(cohortProblems(block, counts), [], `${id}: the block disagrees with measurePairedCohort`);
  assert.equal(block.pass, true, `${id} fixture does not pass the current contract: ${block.reasons.join("; ")}`);
  assert.equal(block.flips.changed, 2, `${id}: the fixture must change exactly two results`);
  return block;
}

// A complete sealed record in the shape field-trial-confirm.mjs writes (the commit is `base`; there is no
// `ref`), under the current balance contract and the given protocol. Only the outcomes and the receipt hash
// are synthetic; the witness does not read the receipt.
function freshRecord({inputs, change}, protocol, protocolText) {
  assert.deepEqual(protocolProblems({schema: 1, ...protocol}), [], "the fixture protocol must satisfy the production protocol rules");
  const contractText = readFileSync(join(ROOT, CONTRACT_PATH), "utf8");
  const contract = parseBalanceContract(contractText);
  const policy = {band: [...contract.band], seatTolerancePp: contract.seatTolerancePp};
  const blocks = protocol.confirm.map((range, i) => measuredBlock(`confirm-${i + 1}`, range, policy));
  const decision = decide(blocks);
  assert.equal(decision.pass, true, `fixture decision rejects: ${decision.reasons.join("; ")}`);
  const top = Math.max(...[...protocol.scout, ...protocol.confirm].map((r) => closed(r).last));
  const separation = {scout: protocol.scout, tune: {from: top + 1, last: top + 100, deals: 100}, holdout: {from: top + 101, last: top + 200, deals: 100}};
  assert.deepEqual(separationProblems({confirm: protocol.confirm, ...separation}), []);
  const path = `${CARD_DIR}/${change.card}.json`;
  const blob = spawnSync("git", ["cat-file", "blob", `HEAD:${path}`], {cwd: ROOT, encoding: "utf8", env: {...GIT_FREE_ENV, GIT_TERMINAL_PROMPT: "0"}});
  assert.equal(blob.status, 0, `git cat-file ${path}: ${blob.stderr}`);
  const cardText = blob.stdout; // untrimmed, as field-trial-confirm.mjs hashes it
  const cardFile = {path, before: sha256(cardText), after: sha256(changeField(cardText, change.field, change.from, change.to))};
  const file = (rel) => sha256(readFileSync(join(ROOT, rel)));
  return seal({schema: 1, kind: "night-shift-repair/fresh-confirmation", base: HEAD, inputs, change, cardFile, attempt: 1,
    receiptSha256: sha256("synthetic receipt: tests/game/field-trial-repair.test.js"), contractSha256: sha256(contractText), policy,
    protocolSha256: sha256(protocolText), protocol: {scout: protocol.scout, confirm: protocol.confirm},
    separation: {...separation, disjoint: true}, blocks, ...decision,
    tool: {script: file("scripts/field-trial-confirm.mjs"), engine: file("scripts/field-trial-engine.mjs"), kit: file("src/review/paired-duel-kit.js"), node: process.version},
    surface: "local-cli", applied: false, recordedAt: "2026-01-01T00:00:00.000Z"});
}

// A throwaway project root for the witness CLI: this checkout's scripts and src, the current protocol,
// and a Git repository that reads this checkout's objects through alternates (no fetch, no ref needed).
function witnessSandbox() {
  const box = mkdtempSync(join(scratch, "witness-"));
  for (const rel of ["scripts", "src"]) cpSync(join(ROOT, rel), join(box, rel), {recursive: true});
  if (existsSync(join(ROOT, "package.json"))) cpSync(join(ROOT, "package.json"), join(box, "package.json"));
  if (existsSync(join(ROOT, "node_modules"))) symlinkSync(join(ROOT, "node_modules"), join(box, "node_modules"), "dir");
  mkdirSync(dirname(join(box, PROTOCOL_PATH)), {recursive: true});
  cpSync(join(ROOT, PROTOCOL_PATH), join(box, PROTOCOL_PATH));
  git(box, ["init", "--quiet"]);
  mkdirSync(join(box, ".git/objects/info"), {recursive: true});
  writeFileSync(join(box, ".git/objects/info/alternates"), resolve(ROOT, git(ROOT, ["rev-parse", "--git-path", "objects"])) + "\n");
  mkdirSync(join(box, ".artifacts/contest-balance/field-trial"), {recursive: true});
  return box;
}

function runWitness(box, record) {
  writeFileSync(join(box, ".artifacts/contest-balance/field-trial/fresh.json"), JSON.stringify(record, null, 2) + "\n");
  rmSync(join(box, ".artifacts/contest-balance/field-trial/witness.json"), {force: true});
  const r = spawnSync(process.execPath, [join(box, "scripts/field-trial-witness.mjs")], {cwd: box, encoding: "utf8", env: GIT_FREE_ENV, timeout: WITNESS_TIMEOUT_MS});
  const out = join(box, ".artifacts/contest-balance/field-trial/witness.json");
  return {status: r.status, signal: r.signal, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""), witness: existsSync(out) ? readJson(out) : null};
}

test("the witness refuses a confirm record whose declared protocol differs from the current one", {skip: NO_GIT}, async () => {
  const {a, candidate} = await setup();
  const box = witnessSandbox();
  const current = readJson(join(ROOT, PROTOCOL_PATH));
  // A valid protocol (two 2,000-deal ranges, disjoint from scouting) that is not the current one.
  const declared = {schema: 1, scout: current.scout, confirm: current.confirm.map((r) => ({...r, first: r.first + 1}))};
  assert.notEqual(canonical(declared), canonical(current));
  const record = freshRecord({inputs: a.inputs, change: candidate.change}, declared, JSON.stringify(declared) + "\n");
  // Everything else the witness checks before the protocol holds, so the mismatch is the only failure.
  assert.equal(record.pass, true);
  assert.equal("ref" in record, false);
  const r = runWitness(box, record);
  assert.notEqual(r.status, null, `the witness did not stop (${r.signal}): it searched under a stale protocol`);
  assert.equal(r.status, 1, `unexpected witness exit ${r.status}: ${r.stderr}`);
  assert.equal(r.witness, null, "no witness may be written for a stale record");
  assert.equal(r.stderr.trim(), `.artifacts/contest-balance/field-trial/fresh.json: protocol differs from ${PROTOCOL_PATH}`,
    "the witness must refuse for the protocol mismatch, not for another validation failure");
});

// Real observer: playTrial with onStep, one row per applied.events entry, keyed by the before state's turn.
function traced(rules, seed, first) {
  const rows = [];
  const result = playTrial(rules, seed, first, (before, applied) => {
    for (const event of applied.events) rows.push({turn: before.turn, event: clone(event)});
  });
  return {rows, result};
}
const rowKey = (row) => canonical([row.turn, row.event]);

// The witness criterion, recomputed independently: the winner flips and both logs have an event at the first difference.
function eligible(baseline, candidate, seed, first) {
  if (playTrial(baseline, seed, first).winner === playTrial(candidate, seed, first).winner) return null;
  const x = traced(baseline, seed, first), y = traced(candidate, seed, first);
  const k = x.rows.findIndex((row, i) => i >= y.rows.length || rowKey(row) !== rowKey(y.rows[i]));
  return k < 0 || k >= y.rows.length ? null : {k, x, y};
}

test("the witness reads the confirm record's actual base and reproduces from it", {skip: NO_GIT}, async () => {
  const {a, candidate} = await setup();
  const box = witnessSandbox();
  const protocolText = readFileSync(join(ROOT, PROTOCOL_PATH), "utf8");
  const protocol = JSON.parse(protocolText);
  const record = freshRecord({inputs: a.inputs, change: candidate.change}, protocol, protocolText);
  assert.equal("ref" in record, false);
  const r = runWitness(box, record);
  assert.notEqual(r.status, null, `the witness did not finish (${r.signal})`);
  assert.equal(r.stderr.trim(), "", `the witness rejected a valid confirm record: ${r.stderr.trim()}`);
  const order = protocol.confirm.flatMap(({first: low, deals}) => Array.from({length: deals}, (_, d) => low + d));
  if (r.status === 0) {
    const w = r.witness;
    assert.ok(w, "exit 0 without witness.json");
    assert.equal(w.base, record.base, "witness.base must be the confirm record's base commit");
    assert.equal(w.fresh, record.recordSha256);
    assert.deepEqual(w.inputs, record.inputs);
    assert.deepEqual(w.change, record.change);
    assert.ok(FACTIONS.includes(w.first));
    assert.ok(protocol.confirm.some((range) => w.seed >= range.first && w.seed < range.first + range.deals), "witness seed is outside the fixed confirm ranges");
    assert.notEqual(w.baseline.winner, w.candidate.winner, "a witness must flip the winner");
    // Every earlier match in search order is ineligible, and this one's first changed event is the real one.
    let found = null;
    search: for (const seed of order) for (const first of FACTIONS) {
      const hit = eligible(a.rules, candidate.engine.rules, seed, first);
      if (seed === w.seed && first === w.first) { found = hit; break search; }
      assert.equal(hit, null, `seed ${seed} ${first} first is an earlier eligible match than the witness`);
    }
    assert.ok(found, "the witness match is not eligible when replayed through the real observer");
    const {k, x, y} = found;
    assert.equal(w.matchedEvents, k, "matchedEvents is not the index of the first changed event");
    assert.equal(w.turn, x.rows[k].turn);
    for (const [side, run] of [["baseline", x], ["candidate", y]]) {
      assert.equal(w[side].winner, run.result.winner, `${side} winner`);
      assert.equal(w[side].endTurn, run.result.endTurn, `${side} end turn`);
      assert.equal(w[side].firstChange.index, k, `${side} first change index`);
      assert.equal(w[side].firstChange.turn, run.rows[k].turn, `${side} first change turn`);
      assert.equal(canonical(w[side].firstChange.event), canonical(run.rows[k].event), `${side} first changed event is not the engine's event`);
    }
    assert.notEqual(rowKey(x.rows[k]), rowKey(y.rows[k]), "the first changed events must differ");
    for (let i = 0; i < k; i++) assert.equal(rowKey(x.rows[i]), rowKey(y.rows[i]), `event ${i} before the first change differs`);
  } else {
    // Accepted but no eligible match: reported on stdout with exit 1, and truly no match qualifies.
    assert.equal(r.status, 1, `unexpected witness exit ${r.status}`);
    assert.equal(r.witness, null);
    assert.match(r.stdout, /No eligible witness/);
    for (const seed of order) for (const first of FACTIONS) {
      assert.equal(eligible(a.rules, candidate.engine.rules, seed, first), null, `seed ${seed} ${first} first is eligible, but the witness found none`);
    }
  }
});
