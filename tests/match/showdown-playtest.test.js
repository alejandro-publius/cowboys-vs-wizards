import assert from "node:assert/strict";
import test from "node:test";
import {PLAYTEST_KEY, createPlaytestLog} from "../../src/match/showdown-playtest.js";
import {report} from "../../src/game/showdown/playtest.js";
import {newSave} from "../../src/game/showdown/progress.js";

const memory = (seed = {}) => {
  const data = {...seed};
  return {data, getItem: (key) => (key in data ? data[key] : null), setItem: (key, value) => { data[key] = String(value); }};
};
const entry = (run, won = true) => ({name: "Boot Hill", won, turns: 9, seconds: 80, rules: false, run, duel: "trail", seed: 0});

// FH-R3.9 (.kiro/specs/showdown-first-hour/requirements.md)
test("a finished duel is stored once under the prototype key, and a reload reads the same report", () => {
  const storage = memory();
  const log = createPlaytestLog(storage);
  assert.equal(log.add(entry("a")), true);
  assert.equal(log.add(entry("a")), false, "the same run is never logged twice");
  assert.equal(JSON.parse(storage.data[PLAYTEST_KEY]).length, 1);
  const save = {...newSave(), wins: 1};
  const reloaded = createPlaytestLog(storage);
  assert.deepEqual(reloaded.entries(), log.entries());
  assert.equal(reloaded.text(save), report(log.entries(), save, {build: null}));
  assert.match(reloaded.text(save), /^Showdown playtest report\nFinished 1 duel in 80 s of play: won 1, lost 0\./);
  assert.equal(reloaded.add(entry("a")), false, "a reload does not re-add a logged run");
  assert.equal(reloaded.add(entry("b", false)), true);
  assert.equal(createPlaytestLog(storage).entries().length, 2);
});

// FH-R3.9 (.kiro/specs/showdown-first-hour/requirements.md)
test("only known fields of well-formed lines are kept; nothing personal is stored", () => {
  const storage = memory({[PLAYTEST_KEY]: JSON.stringify([entry("a"), {name: 3}, null, {...entry("b"), player: "Ann", when: 1}])});
  const log = createPlaytestLog(storage);
  assert.deepEqual(log.entries().map((e) => e.run), ["a", "b"]);
  assert.deepEqual(Object.keys(log.entries()[1]).sort(), ["duel", "name", "rules", "run", "seconds", "seed", "turns", "won"]);
  assert.equal(log.add({...entry("c"), player: "Ann"}), true);
  assert.doesNotMatch(storage.data[PLAYTEST_KEY], /Ann|player|when/);
  assert.deepEqual(createPlaytestLog(memory({[PLAYTEST_KEY]: "{not json"})).entries(), []);
});

// FH-R3.9 (.kiro/specs/showdown-first-hour/requirements.md)
test("blocked or missing storage keeps the log in memory and says it was not saved", () => {
  const blocked = {getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }};
  for (const storage of [blocked, null]) {
    const log = createPlaytestLog(storage);
    assert.equal(log.add(entry("a")), true);
    assert.equal(log.saved(), false);
    assert.equal(log.entries().length, 1);
    assert.match(log.text(newSave()), /Finished 1 duel/);
  }
  assert.equal(createPlaytestLog(memory()).text(newSave()), "No duel has been finished yet.");
});

// K-087 / K-094: each duel names the public build it was finished under; old lines stay unattributed.
const BUILD_A = "4069bf99cf00", BUILD_B = "aebfd9a3c900+local";
// The two wins Alex pasted (Boot Hill 13 turns / 53 s, Raven Roost 11 / 34 s), as an older build stored them: no build field.
const legacy = [
  {name: "Boot Hill", won: true, turns: 13, seconds: 53, rules: false, run: "old-1", duel: "trail", seed: 7},
  {name: "Raven Roost", won: true, turns: 11, seconds: 34, rules: false, run: "old-2", duel: "trail", seed: 8},
];
const career = () => ({...newSave(), wins: 2});
const LEGACY_TEXT = [
  "Showdown playtest report",
  "Finished 2 duels in 87 s of play: won 2, lost 0.",
  "Reached: Trail 2 of 6 won, rivals 0 of 4, Wanted hunts 0 of 10, even-match wins 0.",
  "Never lost.",
  'Opened "All the rules" during 0 of 2 duels.',
];

test("a legacy log reads unchanged and is never attributed to the build that now shows it", () => {
  const storage = memory({[PLAYTEST_KEY]: JSON.stringify(legacy)});
  const log = createPlaytestLog(storage, {build: BUILD_A});
  assert.deepEqual(log.entries(), legacy, "old lines are kept as stored, with no build added");
  const text = log.text(career());
  // Every line the old report had is still there, in order, outcomes included.
  const old = report(legacy, career());
  assert.ok(old.startsWith(LEGACY_TEXT.join("\n")));
  assert.deepEqual(text.split("\n").filter((line) => old.split("\n").includes(line)), old.split("\n"));
  assert.match(text, /\n1\. Boot Hill: won in 13 turns, 53 s\n2\. Raven Roost: won in 11 turns, 34 s$/);
  assert.match(text, /\nThis report is from game build 4069bf99cf00\.\nDuels by build: 1-2 build not recorded\.\n/);
  assert.doesNotMatch(text, /1-2 on /);
  assert.equal(storage.data[PLAYTEST_KEY], JSON.stringify(legacy), "reading a legacy log writes nothing");
});

test("duels finished on different builds, offline or hosted, keep their own build; a resumed career is flagged", () => {
  const storage = memory({[PLAYTEST_KEY]: JSON.stringify(legacy)});
  // An older standalone file (build B) adds a duel, then the current page (build A) adds two more.
  assert.equal(createPlaytestLog(storage, {build: BUILD_B}).add(entry("b1", false)), true);
  const current = createPlaytestLog(storage, {build: BUILD_A});
  assert.equal(current.add(entry("a1")), true);
  assert.equal(current.add({...entry("a2"), build: BUILD_B}), true, "a caller cannot claim another build");
  assert.deepEqual(current.entries().map((e) => e.build ?? null), [null, null, BUILD_B, BUILD_A, BUILD_A]);
  const reopenedOnB = createPlaytestLog(storage, {build: BUILD_B});
  assert.deepEqual(reopenedOnB.entries(), current.entries(), "showing the log on another build relabels nothing");
  const text = current.text(career());
  assert.match(text, /\nDuels by build: 1-2 build not recorded; 3 on aebfd9a3c900\+local; 4-5 on 4069bf99cf00\.\n/);
  assert.match(text, /\nReached and the deck are the saved career, which can include duels finished on other builds or before this log began\.\n/);
  assert.match(reopenedOnB.text(career()), /\nThis report is from game build aebfd9a3c900\+local\./);
});

test("only a public build label is stored: malformed or private-looking values are dropped, and no label means not identified", () => {
  const junk = ["", "main", "4069bf99cf00 Ann", "/Users/alex/build", "4069BF99CF00", "4069bf99cf0", "4069bf99cf00+dirty", 12, {id: 1}];
  const storage = memory({[PLAYTEST_KEY]: JSON.stringify(junk.map((build, i) => ({...entry(`j${i}`), build})))});
  assert.ok(createPlaytestLog(storage).entries().every((e) => !("build" in e)));
  for (const build of [null, "not-a-build", "/Users/alex"]) {
    const log = createPlaytestLog(memory(), {build});
    log.add(entry("x"));
    assert.deepEqual(Object.keys(log.entries()[0]).sort(), ["duel", "name", "rules", "run", "seconds", "seed", "turns", "won"]);
    assert.match(log.text(newSave()), /\nThis report is from game build not identified\.\nDuels by build: 1 build not recorded\.\n/);
  }
  const log = createPlaytestLog(memory(), {build: BUILD_A});
  log.add(entry("y"));
  assert.deepEqual(Object.keys(log.entries()[0]).sort(), ["build", "duel", "name", "rules", "run", "seconds", "seed", "turns", "won"]);
  // Run ids and seeds stay out of the copied text, as before.
  assert.doesNotMatch(log.text(newSave()), /\by\b|seed/);
  assert.equal(createPlaytestLog(memory(), {build: BUILD_A}).text(newSave()), "No duel has been finished yet.");
});

test("the prototype's report call, with no build option, is byte-for-byte the old text", () => {
  assert.equal(report(legacy, career()), [...LEGACY_TEXT, "Cards in the deck now: " +
    Object.entries(newSave().deck).map(([t, c]) => `${t.replace(/^cowboy-/, "")} x${c}`).join(", ") + ".",
    "", "Duel by duel:", "1. Boot Hill: won in 13 turns, 53 s", "2. Raven Roost: won in 11 turns, 34 s"].join("\n"));
});

// K-094: the report a tester copies prints only each line's public fields, whatever else a stored line carries.
test("stored lines with private extras, a non-label build or two-player fields report only public fields", () => {
  const canary = (what) => `ZZCANARY-${what}`;
  const storage = memory({[PLAYTEST_KEY]: JSON.stringify([
    {...entry(canary("run")), duel: canary("duel"), note: canary("note"), player: canary("player")},
    {name: "Raven Roost", won: false, turns: 6, seconds: 30, rules: false, build: canary("build")},
    {name: "Raven Roost", won: true, turns: 7, seconds: 60, rules: true, seat: "wizard", hand: [canary("hand")], otherHand: [canary("other")]},
    {mode: "hotseat", hand: [canary("dropped")]},
  ])});
  const text = createPlaytestLog(storage, {build: BUILD_A}).text(career());
  assert.doesNotMatch(text, /ZZCANARY/);
  assert.match(text, /\nDuels by build: 1-3 build not recorded\.\n/);
  assert.match(text, /\n1\. Boot Hill: won in 9 turns, 80 s\n2\. Raven Roost: lost in 6 turns, 30 s\n3\. Raven Roost: won in 7 turns, 60 s, read the rules$/);
});
