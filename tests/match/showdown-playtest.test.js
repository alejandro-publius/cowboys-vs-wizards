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

test("a finished duel is stored once under the prototype key, and a reload reads the same report", () => {
  const storage = memory();
  const log = createPlaytestLog(storage);
  assert.equal(log.add(entry("a")), true);
  assert.equal(log.add(entry("a")), false, "the same run is never logged twice");
  assert.equal(JSON.parse(storage.data[PLAYTEST_KEY]).length, 1);
  const save = {...newSave(), wins: 1};
  const reloaded = createPlaytestLog(storage);
  assert.deepEqual(reloaded.entries(), log.entries());
  assert.equal(reloaded.text(save), report(log.entries(), save));
  assert.match(reloaded.text(save), /^Showdown playtest report\nFinished 1 duel in 80 s of play: won 1, lost 0\./);
  assert.equal(reloaded.add(entry("a")), false, "a reload does not re-add a logged run");
  assert.equal(reloaded.add(entry("b", false)), true);
  assert.equal(createPlaytestLog(storage).entries().length, 2);
});

test("only known fields of well-formed lines are kept; nothing personal is stored", () => {
  const storage = memory({[PLAYTEST_KEY]: JSON.stringify([entry("a"), {name: 3}, null, {...entry("b"), player: "Ann", when: 1}])});
  const log = createPlaytestLog(storage);
  assert.deepEqual(log.entries().map((e) => e.run), ["a", "b"]);
  assert.deepEqual(Object.keys(log.entries()[1]).sort(), ["duel", "name", "rules", "run", "seconds", "seed", "turns", "won"]);
  assert.equal(log.add({...entry("c"), player: "Ann"}), true);
  assert.doesNotMatch(storage.data[PLAYTEST_KEY], /Ann|player|when/);
  assert.deepEqual(createPlaytestLog(memory({[PLAYTEST_KEY]: "{not json"})).entries(), []);
});

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
