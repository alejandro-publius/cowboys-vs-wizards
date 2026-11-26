// Replay Room lesson data: contract, whitelist, winner flips and staleness.
// Run: node --test apps/replay-room/test/lessons.test.mjs
// One test reruns experiments/showdown-dragon-strategy/rival-search.mjs --print (about 2 s); the tracked fixture
// is never written.
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {FIXTURE, OUT, check, fromFixtureText, project, render, rerunText, validate} from "../generate-lessons.mjs";

const fixtureText = readFileSync(FIXTURE, "utf8");
const outText = readFileSync(OUT, "utf8");
const lessons = JSON.parse(outText);
const fixture = JSON.parse(fixtureText);
const GENERATOR = fileURLToPath(new URL("../generate-lessons.mjs", import.meta.url));
const HIDDEN = /^(hand|deck|traps|handCount|deckCount|trapCount|stateHash|cowboyViewHash|atChoiceHash|sharedPrefix|action|lines|visible|reason|dragonOnBoard)$/;

const keysOf = (value, path = "$", out = []) => {
  if (Array.isArray(value)) value.forEach((v, i) => keysOf(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.push([`${path}.${k}`, k]); keysOf(v, `${path}.${k}`, out); }
  return out;
};

test("tracked lessons.json is the current projection and passes the contract", () => {
  assert.equal(outText, render(fromFixtureText(fixtureText)));
  assert.doesNotThrow(() => validate(lessons));
  assert.deepEqual(lessons.map((l) => [l.id, l.seed]), [["dragon-c5", 3], ["dragon-c5-70", 70]]);
});

test("both cases flip the winner between the Dragon and Jack branches, as recorded", () => {
  const got = lessons.map((l) => [l.id, l.branches.dragon.winner, l.branches.dragon.endTurn, l.branches.jack.winner, l.branches.jack.endTurn]);
  assert.deepEqual(got, [["dragon-c5", "cowboy", 15, "wizard", 10], ["dragon-c5-70", "wizard", 14, "cowboy", 17]]);
  for (const l of lessons) assert.notEqual(l.branches.dragon.winner, l.branches.jack.winner, l.id);
  // Matches the fixture's own short results for the same cases.
  const results = Object.fromEntries(fixture.cases.map((c) => [c.seed, c.result]));
  for (const l of lessons) {
    assert.equal(`${l.branches.dragon.winner[0]}${l.branches.dragon.endTurn}`, results[l.seed].A);
    assert.equal(`${l.branches.jack.winner[0]}${l.branches.jack.endTurn}`, results[l.seed].B);
  }
});

test("public fields only: no hidden hand, deck, trap or engine-internal keys", () => {
  const hits = keysOf(lessons).filter(([, k]) => HIDDEN.test(k)).map(([p]) => p);
  assert.deepEqual(hits, []);
  // ownTraps is the Cowboys' own set traps (open in viewFor(state, "cowboy")); there is no Wizard trap field.
  assert.deepEqual(lessons.map((l) => l.ownTraps), [["Bear Trap"], []]);
  for (const l of lessons) assert.equal(JSON.stringify(l).includes("wizard-skeleton-9"), false, "no placeholder hidden-card ids");
});

test("whitelist drops hidden fields injected into the fixture", () => {
  const poisoned = structuredClone(fixture);
  for (const c of poisoned.cases) {
    Object.assign(c, {hand: ["wizard-dragon-0"], deck: ["x"], traps: ["Hex Snare"]});
    Object.assign(c.board, {wizardHand: ["secret"]});
    Object.assign(c.visible.bases, {wizardDeck: 9});
    for (const l of Object.values(c.lines)) { l.hand = ["secret"]; for (const t of l.trace) Object.assign(t, {wizardHand: ["secret"], deckCount: 3}); }
  }
  assert.deepEqual(project(poisoned), lessons);
});

test("contract rejects a lost flip, a third lesson and an extra field", () => {
  const same = structuredClone(lessons); same[1].branches.dragon.winner = "cowboy";
  assert.throws(() => validate(same), /do not flip/);
  assert.throws(() => validate([...lessons, lessons[0]]), /exactly two/);
  const extra = structuredClone(lessons); extra[0].branches.jack.trace[0].wizardHand = [];
  assert.throws(() => validate(extra), /keys are/);
  const wrongAttack = structuredClone(fixture); wrongAttack.cases[0].A.text = "Ranger (slot 0) attacks Wizard Base";
  assert.throws(() => project(wrongAttack), /line A/);
});

test("--check rejects stale output and a rerun that projects differently", () => {
  const rerun = rerunText();
  assert.deepEqual(check({fixtureText, outText, rerun}), []);
  const stale = outText.replace('"endTurn": 15', '"endTurn": 16');
  assert.notEqual(stale, outText);
  assert.match(check({fixtureText, outText: stale, rerun}).join("\n"), /stale/);
  const drifted = structuredClone(JSON.parse(rerun)); drifted.cases[1].lines.B.endTurn += 1;
  assert.match(check({fixtureText, outText, rerun: JSON.stringify(drifted)}).join("\n"), /rerun differs/);
  // The fresh engine rerun reproduces the tracked fixture byte for byte.
  assert.equal(rerun, fixtureText);
});

test("CLI --check exits 0 and leaves the tracked fixture unchanged", () => {
  const run = spawnSync(process.execPath, [GENERATOR, "--check"], {encoding: "utf8"});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ok:/);
  assert.equal(readFileSync(FIXTURE, "utf8"), fixtureText);
  assert.equal(readFileSync(OUT, "utf8"), outText);
});
