// Issue 143 slice 2: Showdown progress through a Storage, joined read-only to the lane profile.
import test from "node:test";
import assert from "node:assert/strict";
import {BOSSES, earnedRewards} from "../../src/game/bounty-hunt.js";
import {createProfileStore} from "../../src/profile/player-profile.js";
import {OLD_SAVE_KEY, REFUSED_KEY, SAVE_KEY, laneCapturedCards, loadCampaign, saveCampaign} from "../../src/game/showdown/campaign-store.js";
import {choose, duelFor, migrate, newSave, owned, settle} from "../../src/game/showdown/progress.js";
import {TRAIL} from "../../src/game/showdown/trail.js";
import {decodeSaveCode, encodeSave, sameSave} from "../../prototypes/showdown/savecode.js";

const LANE_KEY = "cvw-player-v1";
const [DRAGON, WRAITH] = BOSSES;

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  const writes = [];
  return {data, writes,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { writes.push(key); data.set(key, String(value)); }};
}

// A lane-era profile string, written by the real lane store through its public calls.
function laneProfile(steps) {
  const storage = memoryStorage();
  steps(createProfileStore(storage));
  return storage.data.get(LANE_KEY);
}
const capture = (store, boss, count = 5) => boss.hunts.slice(0, count).forEach((id) => store.recordBounty(id));
const LANE = {
  dragon: laneProfile((s) => { s.record("match-complete", {matchId: 1, won: true}); capture(s, DRAGON); }),
  both: laneProfile((s) => { capture(s, DRAGON); capture(s, WRAITH); s.updateSettings({sound: true}); }),
  partial: laneProfile((s) => capture(s, WRAITH, 3)),
};

// Wins the current Trail duel and takes the first card offered, as the screen does.
function winTrail(save) {
  const {save: next, earned} = settle(save, "trail", true);
  return {save: next.offer ? choose(next, next.offer[0]) : next, earned};
}

// FH-R3.1 (.kiro/specs/showdown-first-hour/requirements.md)
test("a new profile loads as a new save and loading writes nothing", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadCampaign(storage), newSave());
  assert.deepEqual(storage.writes, []);
});

// FH-R6.5 (.kiro/specs/showdown-first-hour/requirements.md)
test("Trail duels 1 and 2 each pay their card once, and reloads keep them without paying again", () => {
  const storage = memoryStorage();
  let save = loadCampaign(storage);
  for (const duel of TRAIL.slice(0, 2)) {
    const before = save;
    const won = winTrail(save);
    assert.deepEqual(won.earned.cards, duel.reward.map(([type, , copies]) => [type, copies]));
    assert.deepEqual(saveCampaign(storage, won.save), {ok: true});
    save = loadCampaign(storage);
    assert.ok(sameSave(save, won.save), `${duel.name}: the reload is the saved progress`);
    // The Trail reward is paid on settle; the offered card taken after it can be a second copy of any met card.
    const paid = settle(before, "trail", true).save;
    for (const [type, , copies] of duel.reward) assert.equal(owned(paid, type), owned(before, type) + copies);
    for (const type of Object.keys(save.collection)) assert.ok(owned(save, type) >= owned(paid, type), `${type} kept after the reload`);
  }
  assert.equal(save.wins, 2);
  assert.equal(duelFor(save, "trail").name, TRAIL[2].name, "the next duel is Trail 3, not a repeat");
  // Ten more reload-and-save cycles change nothing: no reward is paid twice and nothing is lost.
  const settled = JSON.stringify(save);
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(saveCampaign(storage, loadCampaign(storage)), {ok: true});
    assert.equal(JSON.stringify(loadCampaign(storage)), settled);
  }
});

// FH-R3.6 (.kiro/specs/showdown-first-hour/requirements.md)
test("an unclaimed card offer survives a reload, so it cannot be rolled again", () => {
  const storage = memoryStorage();
  const {save} = settle(newSave(), "trail", true);
  assert.ok(save.offer);
  saveCampaign(storage, save);
  const loaded = loadCampaign(storage);
  assert.deepEqual(loaded.offer, save.offer);
  assert.equal(loaded.rolls, save.rolls);
  assert.equal(duelFor(loaded, "trail"), null, "the offer must be taken before the next duel");
});

// FH-R3.2 (.kiro/specs/showdown-first-hour/requirements.md)
test("the v1 Trail save loads as migrate() and the legacy save code read it, and keeps its key", () => {
  const v1 = JSON.stringify({wins: 2, losses: 2});
  const storage = memoryStorage({[OLD_SAVE_KEY]: v1});
  const save = loadCampaign(storage);
  assert.deepEqual(save, migrate({wins: 2, losses: 2}));
  const code = decodeSaveCode(btoa(v1));
  assert.ok(code.ok && code.legacy && sameSave(code.save, save));
  saveCampaign(storage, save);
  assert.equal(storage.data.get(OLD_SAVE_KEY), v1, "the v1 key is left as it was");
  assert.ok(sameSave(loadCampaign(storage), save), "v2 now wins over v1");
});

// FH-R3.7 (.kiro/specs/showdown-first-hour/requirements.md)
test("whatever loads can be exported and strictly imported back unchanged", () => {
  let save = newSave();
  for (let i = 0; i < TRAIL.length; i++) save = winTrail(save).save;
  const storage = memoryStorage({[SAVE_KEY]: JSON.stringify(save)});
  const code = decodeSaveCode(encodeSave(loadCampaign(storage)));
  assert.ok(code.ok && !code.legacy && sameSave(code.save, save));
});

test("a stored career whose loss keys hold text outside Latin-1 still exports, and its code reads back with every field intact", () => {
  let career = newSave();
  for (let i = 0; i < TRAIL.length; i++) career = winTrail(career).save;
  // The earlier importer accepted any loss key, so a browser may already hold a career like this one.
  career = {...career, losses: {...career.losses, "☃": 1, "🤠": 2}};
  const storage = memoryStorage();
  assert.deepEqual(saveCampaign(storage, career), {ok: true});
  const loaded = loadCampaign(storage);
  assert.deepEqual(loaded, career);
  const code = encodeSave(loaded);
  assert.match(code, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.deepEqual(decodeSaveCode(code), {ok: true, save: career, legacy: false});
});

// FH-R3.3 (.kiro/specs/showdown-first-hour/requirements.md)
test("progress the next load would reset is refused and nothing is written", () => {
  const storage = memoryStorage({[SAVE_KEY]: JSON.stringify(winTrail(newSave()).save)});
  const before = new Map(storage.data);
  const bad = [{...newSave(), collection: {...newSave().collection, "cowboy-captured-dragon": 1}},
    {...newSave(), wins: TRAIL.length + 1}, {...newSave(), deck: {}}, null, {v: 3}];
  for (const progress of bad) assert.equal(saveCampaign(storage, progress).ok, false);
  assert.deepEqual(storage.data, before);
  assert.deepEqual(storage.writes, []);
});

// FH-R3.4 (.kiro/specs/showdown-first-hour/requirements.md)
test("a stored save the load refused is kept once under its own key before it is replaced", () => {
  const newer = JSON.stringify({...newSave(), v: 3, wins: 4});
  const storage = memoryStorage({[SAVE_KEY]: newer});
  assert.deepEqual(loadCampaign(storage), newSave(), "a newer save is not played");
  saveCampaign(storage, winTrail(loadCampaign(storage)).save);
  assert.equal(storage.data.get(REFUSED_KEY), newer);
  saveCampaign(storage, winTrail(loadCampaign(storage)).save);
  assert.equal(storage.data.get(REFUSED_KEY), newer, "a later save does not replace the kept copy");
  // A save that loaded fine is never copied.
  const clean = memoryStorage({[SAVE_KEY]: JSON.stringify(newSave())});
  saveCampaign(clean, winTrail(newSave()).save);
  assert.equal(clean.data.has(REFUSED_KEY), false);
});

// FH-R3.5 (.kiro/specs/showdown-first-hour/requirements.md)
test("blocked storage loads a new save and reports a failed save without throwing", () => {
  const blocked = {getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }};
  assert.deepEqual(loadCampaign(blocked), newSave());
  assert.equal(saveCampaign(blocked, newSave()).ok, false);
  assert.equal(saveCampaign(undefined, newSave()).ok, false);
  assert.deepEqual(laneCapturedCards(blocked), []);
});

// FH-R3.8, FH-R5.6 (.kiro/specs/showdown-first-hour/requirements.md)
test("a lane-era profile keeps its Captured cards owned in the lane store across Showdown loads and saves", () => {
  for (const [name, raw, expected] of [["dragon", LANE.dragon, [DRAGON.reward]], ["both", LANE.both, [DRAGON.reward, WRAITH.reward]], ["partial", LANE.partial, []]]) {
    const storage = memoryStorage({[LANE_KEY]: raw});
    assert.deepEqual([...laneCapturedCards(storage)], expected, name);
    let save = loadCampaign(storage);
    save = winTrail(save).save;
    saveCampaign(storage, save);
    loadCampaign(storage);
    assert.equal(storage.data.get(LANE_KEY), raw, `${name}: the lane profile is byte-identical`);
    assert.ok(!storage.writes.includes(LANE_KEY));
    assert.deepEqual(earnedRewards(createProfileStore(storage).get()), expected, `${name}: the lane game still owns them`);
    assert.deepEqual([...laneCapturedCards(storage)], expected, `${name}: still read after a Showdown save`);
  }
});

test("the read-only keepsake import matches the original store for all 1,024 hunt combinations", () => {
  const hunts = [...DRAGON.hunts, ...WRAITH.hunts];
  for (let mask = 0; mask < 2 ** hunts.length; mask++) {
    const cleared = hunts.filter((_, index) => mask & (1 << index));
    const raw = JSON.stringify({clearedHunts: [...cleared, ...cleared, "unknown", null], achievements: {"bounty-hunter": true}});
    const storage = memoryStorage({[LANE_KEY]: raw});
    const actual = laneCapturedCards(storage);
    assert.deepEqual(actual, earnedRewards(createProfileStore(storage).get()), `hunt combination ${mask}`);
    assert.ok(Object.isFrozen(actual));
    assert.deepEqual(storage.writes, []);
    assert.equal(storage.data.get(LANE_KEY), raw);
  }
});

// Fable's F1 ruling (PR 148 issuecomment-7031816529): nothing from the lane game carries into Showdown
// progress. migrate() accepts a Legendary only after the Trail and the Showdown bounty's fifth hunt, so
// the join adds no Showdown ownership, no Trail win, no hunt and no deck card. The full ruling is checked
// in tests/game/showdown-keepsake-compat.test.js.
// FH-R7.2 (.kiro/specs/showdown-first-hour/requirements.md)
test("Fable F1: a lane capture gives no Showdown ownership, Trail progress, hunt or power", () => {
  const storage = memoryStorage({[LANE_KEY]: LANE.both});
  const save = loadCampaign(storage);
  assert.deepEqual(save, newSave());
  for (const type of [DRAGON.reward, WRAITH.reward]) assert.equal(owned(save, type), 0);
  // The contract has no field for it: putting the card in the collection makes the next load reset the save.
  const added = {...save, collection: {...save.collection, [DRAGON.reward]: 1}};
  assert.deepEqual(migrate(added), newSave());
  assert.equal(saveCampaign(storage, added).ok, false);
});

// FH-R5.4 (.kiro/specs/showdown-first-hour/requirements.md)
test("an existing Showdown save is kept when a lane capture is also stored", () => {
  let save = newSave();
  for (let i = 0; i < TRAIL.length; i++) save = winTrail(save).save;
  for (let i = 0; i < 3; i++) save = {...settle(save, `hunt:${"graveyard-dragon"}`, true).save, offer: null};
  const storage = memoryStorage({[LANE_KEY]: LANE.dragon, [SAVE_KEY]: JSON.stringify(save)});
  assert.ok(sameSave(loadCampaign(storage), save));
});
