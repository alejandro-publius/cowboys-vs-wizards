// Replay Room lesson data. Projects the two replayable cases in
// experiments/showdown-dragon-strategy/rival-cases.json (seed 3 and the shrunk seed-70 counterexample) into
// apps/replay-room/src/lessons.json through an explicit whitelist of public fields. The engine and the experiment
// files are only read.
//
//   node apps/replay-room/generate-lessons.mjs           # writes src/lessons.json
//   node apps/replay-room/generate-lessons.mjs --check   # fails if src/lessons.json is stale, or if a fresh
//                                                         # `rival-search.mjs --print` rerun projects differently
//
// Each branch is one fixed-policy line (Cowboys: planTurn on the Cowboy view; Wizards: playTurn at the hunt level),
// recorded for comparison. Neither branch is a forced win.
import {execFileSync} from "node:child_process";
import {readFileSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const ROOT = new URL("../../", import.meta.url);
export const FIXTURE = new URL("experiments/showdown-dragon-strategy/rival-cases.json", ROOT);
export const SEARCH = new URL("experiments/showdown-dragon-strategy/rival-search.mjs", ROOT);
export const OUT = new URL("./src/lessons.json", import.meta.url);

// Fixture case id -> lesson id. Exactly these two, in this order.
const CASES = [["hunt5-s3-C5-ranger", "dragon-c5"], ["hunt5-s70-C5-ranger", "dragon-c5-70"]];
// Fixture line -> lesson branch, with the attack text that line must start with.
const BRANCHES = [["A", "dragon", /^Ranger \(slot \d\) attacks Dragon \(slot \d\)$/], ["B", "jack", /^Ranger \(slot \d\) attacks Jack-o'-Lantern \(slot \d\)$/]];
const SIDES = new Set(["cowboy", "wizard"]);

const fail = (message) => { throw new Error(`replay-room lessons: ${message}`); };
const int = (v, what) => (Number.isInteger(v) ? v : fail(`${what} is not an integer`));
const str = (v, what) => (typeof v === "string" ? v : fail(`${what} is not a string`));
const side = (v, what) => (SIDES.has(v) ? v : fail(`${what} is not cowboy or wizard`));

// Whitelist projection: every output field is named here; nothing is copied by spread.
export function project(fixture) {
  const cases = fixture?.cases;
  if (!Array.isArray(cases)) fail("fixture has no cases array");
  return CASES.map(([fixtureId, id]) => {
    const c = cases.find((each) => each.id === fixtureId) ?? fail(`fixture case ${fixtureId} missing`);
    if (c.bothLegal !== true || c.hiddenReadFree !== true) fail(`${fixtureId} is not both-legal and hidden-read-free`);
    const branches = {};
    for (const [key, name, text] of BRANCHES) {
      if (!text.test(c[key]?.text ?? "")) fail(`${fixtureId} line ${key} is not "${text.source}"`);
      const l = c.lines?.[key] ?? fail(`${fixtureId} line ${key} missing`);
      branches[name] = {
        winner: side(l.winner, `${fixtureId} ${key} winner`),
        endTurn: int(l.endTurn, `${fixtureId} ${key} endTurn`),
        trace: (Array.isArray(l.trace) ? l.trace : fail(`${fixtureId} ${key} trace missing`)).map((t, i) => ({
          turn: int(t.turn, `${fixtureId} ${key} trace[${i}].turn`),
          side: side(t.side, `${fixtureId} ${key} trace[${i}].side`),
          cowboyBase: int(t.bases?.cowboy, `${fixtureId} ${key} trace[${i}] cowboy base`),
          wizardBase: int(t.bases?.wizard, `${fixtureId} ${key} trace[${i}] wizard base`),
          cowboyBoard: str(t.cowboyBoard, `${fixtureId} ${key} trace[${i}].cowboyBoard`),
          wizardBoard: str(t.wizardBoard, `${fixtureId} ${key} trace[${i}].wizardBoard`),
        })),
      };
    }
    const traps = c.visible?.cowboyTrapsSet;
    if (!Array.isArray(traps)) fail(`${fixtureId} has no Cowboy trap list`);
    return {
      id,
      seed: int(c.seed, `${fixtureId} seed`),
      board: {cowboy: str(c.board?.cowboy, `${fixtureId} cowboy board`), wizard: str(c.board?.wizard, `${fixtureId} wizard board`)},
      bases: {cowboy: int(c.visible.bases?.cowboy, `${fixtureId} cowboy base`), wizard: int(c.visible.bases?.wizard, `${fixtureId} wizard base`)},
      ownTraps: traps.map((t, i) => str(t, `${fixtureId} ownTraps[${i}]`)),
      branches,
    };
  });
}

// Contract checks on a projected lesson list: exact key sets, and both cases flip the winner between branches.
const KEYS = {
  lesson: ["id", "seed", "board", "bases", "ownTraps", "branches"],
  pair: ["cowboy", "wizard"],
  branches: ["dragon", "jack"],
  branch: ["winner", "endTurn", "trace"],
  step: ["turn", "side", "cowboyBase", "wizardBase", "cowboyBoard", "wizardBoard"],
};
const keysAre = (obj, keys, what) => {
  const got = obj && typeof obj === "object" && !Array.isArray(obj) ? Object.keys(obj) : null;
  if (!got || got.length !== keys.length || keys.some((k, i) => got[i] !== k)) fail(`${what} keys are ${JSON.stringify(got)}, expected ${JSON.stringify(keys)}`);
};
export function validate(lessons) {
  if (!Array.isArray(lessons) || lessons.length !== 2) fail("lessons must be an array of exactly two objects");
  lessons.forEach((l, i) => {
    keysAre(l, KEYS.lesson, `lesson ${i}`);
    if (l.id !== CASES[i][1]) fail(`lesson ${i} id is ${l.id}, expected ${CASES[i][1]}`);
    int(l.seed, `${l.id} seed`);
    keysAre(l.board, KEYS.pair, `${l.id} board`); str(l.board.cowboy, `${l.id} board.cowboy`); str(l.board.wizard, `${l.id} board.wizard`);
    keysAre(l.bases, KEYS.pair, `${l.id} bases`); int(l.bases.cowboy, `${l.id} bases.cowboy`); int(l.bases.wizard, `${l.id} bases.wizard`);
    if (!Array.isArray(l.ownTraps)) fail(`${l.id} ownTraps is not an array`);
    l.ownTraps.forEach((t, j) => str(t, `${l.id} ownTraps[${j}]`));
    keysAre(l.branches, KEYS.branches, `${l.id} branches`);
    for (const name of KEYS.branches) {
      const b = l.branches[name];
      keysAre(b, KEYS.branch, `${l.id} ${name}`);
      side(b.winner, `${l.id} ${name} winner`); int(b.endTurn, `${l.id} ${name} endTurn`);
      if (!Array.isArray(b.trace) || !b.trace.length) fail(`${l.id} ${name} trace is empty`);
      b.trace.forEach((t, j) => {
        keysAre(t, KEYS.step, `${l.id} ${name} trace[${j}]`);
        int(t.turn, "turn"); side(t.side, "side"); int(t.cowboyBase, "cowboyBase"); int(t.wizardBase, "wizardBase");
        str(t.cowboyBoard, "cowboyBoard"); str(t.wizardBoard, "wizardBoard");
      });
    }
    if (l.branches.dragon.winner === l.branches.jack.winner) fail(`${l.id} branches do not flip the winner (both ${l.branches.dragon.winner})`);
  });
  return lessons;
}

export const render = (lessons) => `${JSON.stringify(validate(lessons), null, 1)}\n`;
export const fromFixtureText = (text) => project(JSON.parse(text));
export const rerunText = () => execFileSync(process.execPath, [fileURLToPath(SEARCH), "--print"], {encoding: "utf8", maxBuffer: 64 << 20});

// --check: returns a list of problems (empty when current).
export function check({fixtureText = readFileSync(FIXTURE, "utf8"), outText = readFileSync(OUT, "utf8"), rerun = rerunText()} = {}) {
  const problems = [];
  const expected = render(fromFixtureText(fixtureText));
  if (outText !== expected) problems.push("src/lessons.json is stale: regenerate with node apps/replay-room/generate-lessons.mjs");
  try { validate(JSON.parse(outText)); } catch (error) { problems.push(error.message); }
  let rerunExpected = null;
  try { rerunExpected = render(fromFixtureText(rerun)); } catch (error) { problems.push(`engine rerun: ${error.message}`); }
  if (rerunExpected !== null && rerunExpected !== expected) problems.push("projection of a fresh rival-search.mjs --print rerun differs from the tracked fixture's projection");
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === "--check") {
    const problems = check();
    if (problems.length) { for (const p of problems) console.error(`FAIL ${p}`); process.exit(1); }
    console.log("ok: src/lessons.json matches the fixture projection and a fresh rival-search.mjs --print rerun");
  } else if (process.argv.length > 2) {
    console.error(`unknown option ${process.argv[2]}; use --check or no option`); process.exit(2);
  } else {
    const text = render(fromFixtureText(readFileSync(FIXTURE, "utf8")));
    writeFileSync(OUT, text);
    console.log(`wrote ${fileURLToPath(OUT)}`);
  }
}
