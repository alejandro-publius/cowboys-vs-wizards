// Issue 143 slice 2 keepsake ruling (Fable, PR 148 issuecomment-7031816529): nothing from the lane game
// carries into Showdown progress. A lane capture stays in its own keepsake record and shows in the Camp;
// it is not in the Showdown collection, deck or progress, and is not equippable. Every Showdown bounty
// still pays its Legendary, lane veteran or not. Partial lane hunts and Frontier cards do not carry.
// Start over resets Showdown progress only. Keepsakes stay out of save codes.
//
// The 14 A1-A5 cases are imported from the slice 2 readiness harness
// (cli-progression experiments/showdown-profile-compat, commit d2efc98), with A1 flipped as Fable ruled
// and the loader now the real slice 2 one, createCampaign(storage). Fixtures are built by driving the
// real lane store and the Showdown progress functions; nothing is hand-typed save JSON.
import test from "node:test";
import assert from "node:assert/strict";
import {BOSSES as LANE_BOSSES, earnedRewards} from "../../src/game/bounty-hunt.js";
import {validateDeck} from "../../src/game/deck-builder.js";
import {frontierUnlocked} from "../../src/game/deck-presets.js";
import {createProfileStore} from "../../src/profile/player-profile.js";
import {OLD_SAVE_KEY, SAVE_KEY, loadCampaign, saveCampaign} from "../../src/game/showdown/campaign-store.js";
import {INHERITED_KEY, readInherited} from "../../src/game/showdown/inherited.js";
import {BOUNTIES, HUNTS, migrate, newSave, owned, settle, trailDone} from "../../src/game/showdown/progress.js";
import {createCampaign} from "../../src/match/showdown-campaign.js";
import {createPlaytestLog} from "../../src/match/showdown-playtest.js";
import {decodeSaveCode, encodeSave, sameSave} from "../../prototypes/showdown/savecode.js";

const LANE_KEY = "cvw-player-v1";
const LOG_KEY = "cvw-showdown-playtest-v1";
const STAMP = "2026-11-01T17:00:00.000Z";
const [DRAGON, WRAITH] = LANE_BOSSES;
const LANE_STARTER = {"cowboy-sheriff": 6, "cowboy-billy": 3, "cowboy-mounted-billy": 1, "cowboy-deadeye": 2};

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  const writes = [];
  return {data, writes,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { writes.push(key); data.set(key, String(value)); },
    removeItem: (key) => { writes.push(key); data.delete(key); }};
}

// ---- Fixtures (from the readiness harness, fixtures.js) ----
function laneDeck(counts, rewards = [], frontierCards = []) {
  const result = validateDeck(counts, {rewards, frontierCards});
  if (!result.ok) throw new Error(`fixture deck rejected by the lane validator: ${result.error}`);
  return counts;
}
function laneProfile(steps) {
  const storage = memoryStorage();
  steps(createProfileStore(storage));
  const raw = storage.data.get(LANE_KEY);
  if (raw === undefined) return null;
  const parsed = JSON.parse(raw);
  for (const id of Object.keys(parsed.achievements)) parsed.achievements[id] = STAMP;
  return JSON.stringify(parsed);
}
const matches = (store, played, won) => {
  for (let i = 0; i < played; i++) store.record("match-complete", {matchId: `m${i}`, won: i < won});
};
const hunts = (store, boss, count, {clean = false} = {}) => {
  boss.hunts.slice(0, count).forEach((id, i) => store.recordBounty(id, {clean: clean && i === 0}));
};

const LANE_FIXTURES = Object.freeze({
  "fresh-no-key": {raw: null, captured: []},
  "settings-only": {raw: laneProfile((s) => s.updateSettings({sound: true, reducedMotion: true, performance: "low"})), captured: []},
  "partial-early": {raw: laneProfile((s) => { s.record("summon", {id: 1}); s.record("spell", {id: 2}); matches(s, 3, 1); }), captured: []},
  "partial-frontier-deck": {
    raw: laneProfile((s) => {
      matches(s, 6, 4);
      s.saveDeck(laneDeck({...LANE_STARTER, "cowboy-sheriff": 4, "cowboy-lasso": 1, "cowboy-covered-wagon": 1},
        [], ["cowboy-lasso", "cowboy-covered-wagon", "cowboy-outrider"]));
    }),
    captured: [],
  },
  "dragon-hunts-3-of-5": {raw: laneProfile((s) => { matches(s, 5, 3); hunts(s, DRAGON, 3, {clean: true}); }), captured: []},
  "dragon-captured": {raw: laneProfile((s) => { matches(s, 9, 5); hunts(s, DRAGON, 5); }), captured: [DRAGON.reward]},
  "wraith-captured": {raw: laneProfile((s) => { matches(s, 8, 5); hunts(s, WRAITH, 5); }), captured: [WRAITH.reward]},
  "wraith-captured-dragon-4-of-5": {
    raw: laneProfile((s) => { matches(s, 12, 9); hunts(s, WRAITH, 5); hunts(s, DRAGON, 4); }),
    captured: [WRAITH.reward],
  },
  "both-captured-in-deck": {
    raw: laneProfile((s) => {
      matches(s, 14, 11);
      hunts(s, DRAGON, 5, {clean: true});
      hunts(s, WRAITH, 5);
      s.saveDeck(laneDeck({...LANE_STARTER, "cowboy-sheriff": 4, "cowboy-captured-dragon": 1, "cowboy-captured-wraith": 1},
        [DRAGON.reward, WRAITH.reward]));
    }),
    captured: [DRAGON.reward, WRAITH.reward],
  },
  "dragon-captured-extra-key": {
    raw: JSON.stringify({...JSON.parse(laneProfile((s) => { matches(s, 9, 5); hunts(s, DRAGON, 5); })), showdown: {v: 2}}),
    captured: [DRAGON.reward],
  },
  "corrupt-json": {raw: "{\"clearedHunts\": [", captured: []},
});

const winTrail = (save) => ({...settle(save, "trail", true).save, offer: null});
const trailWins = (wins) => { let save = newSave(); for (let i = 0; i < wins; i++) save = winTrail(save); return save; };
const SHOWDOWN_FIXTURES = Object.freeze({
  "none": null,
  "v1-trail-3": {key: OLD_SAVE_KEY, raw: JSON.stringify({wins: 3, losses: 1})},
  "v2-trail-2": {key: SAVE_KEY, raw: JSON.stringify(trailWins(2))},
  "v2-trail-done-dragon-3": {key: SAVE_KEY, raw: JSON.stringify((() => {
    let save = trailWins(6);
    for (let i = 0; i < 3; i++) save = {...settle(save, "hunt:graveyard-dragon", true).save, offer: null};
    return save;
  })())},
});

function storageFor(laneName, showdownName = "none") {
  const entries = {};
  const lane = LANE_FIXTURES[laneName].raw;
  if (lane !== null) entries[LANE_KEY] = lane;
  const showdown = SHOWDOWN_FIXTURES[showdownName];
  if (showdown) entries[showdown.key] = showdown.raw;
  return memoryStorage(entries);
}

const CASES = Object.freeze([
  ...Object.keys(LANE_FIXTURES).map((laneName) => ({laneName, showdownName: "none"})),
  {laneName: "fresh-no-key", showdownName: "v1-trail-3"},
  {laneName: "dragon-captured", showdownName: "v2-trail-2"},
  {laneName: "both-captured-in-deck", showdownName: "v2-trail-done-dragon-3"},
]);

const laneView = (storage) => {
  const profile = createProfileStore(storage).get();
  return JSON.stringify([earnedRewards(profile), frontierUnlocked(profile)]);
};
// What Showdown alone would load from this browser: the same storage with no lane key.
const showdownOnly = (showdownName) => loadCampaign(storageFor("fresh-no-key", showdownName));
const sorted = (list) => [...list].sort();

// ---- A1-A5 over the 14 cases ----
// A1 (flipped by Fable): the keepsake record holds exactly the lane captures, and the progress
//    (collection, deck, hunts, wins, offers) is what Showdown alone would load: no lane carryover.
// A2 a reload gives the same progress and keepsakes, writes nothing, and the progress survives migrate().
// A3 cvw-player-v1 is byte-identical and the lane game reads the same captures and frontier unlocks.
// A4 nothing earned in either game loads as a new save and writes nothing.
// A5 an existing Showdown save is kept.
for (const {laneName, showdownName} of CASES) {
  // FH-R5.1, FH-R5.3, FH-R5.5, FH-R5.6, FH-R7.2 (.kiro/specs/showdown-first-hour/requirements.md)
  test(`keepsake compat A1-A5: lane ${laneName}, showdown ${showdownName}`, () => {
    const storage = storageFor(laneName, showdownName);
    const laneBefore = storage.data.get(LANE_KEY);
    const laneReadBefore = laneView(storageFor(laneName, showdownName));
    const {captured} = LANE_FIXTURES[laneName];
    const campaign = createCampaign(storage);
    const progress = campaign.progress();
    const alone = showdownOnly(showdownName);

    // A1
    assert.deepEqual(sorted(readInherited(storage).cards), sorted(captured), "A1: keepsake record holds exactly the lane captures");
    assert.deepEqual(sorted(campaign.inherited()), sorted(captured), "A1: keepsakes this session");
    assert.ok(sameSave(progress, alone), "A1: progress is what Showdown alone loads");
    for (const type of captured) {
      assert.equal(owned(progress, type), owned(alone, type), `A1: ${type} not added to the Showdown collection`);
      assert.equal(progress.deck[type] ?? 0, 0, `A1: ${type} not in the Showdown deck`);
      assert.equal(progress.side[type] ?? 0, 0, `A1: ${type} not in the side deck`);
    }
    const rows = campaign.holdings();
    for (const type of captured) {
      assert.equal(rows.filter((row) => row.type === type).length, 1, `A1: ${type} listed once in the Camp`);
      assert.ok(rows.find((row) => row.type === type).inherited, `A1: ${type} shown as a keepsake`);
    }
    assert.equal(storage.writes.filter((key) => key !== INHERITED_KEY).length, 0, "A1: the join writes only the keepsake record");

    // A2
    const writes = storage.writes.length;
    const again = createCampaign(storage);
    assert.ok(sameSave(again.progress(), progress), "A2: reload keeps the progress");
    assert.deepEqual(again.inherited(), campaign.inherited(), "A2: reload keeps the keepsakes");
    assert.equal(storage.writes.length, writes, "A2: a reload writes nothing");
    assert.ok(sameSave(migrate(JSON.parse(JSON.stringify(progress))), progress), "A2: progress survives migrate()");

    // A3
    assert.equal(storage.data.get(LANE_KEY), laneBefore, "A3: cvw-player-v1 unchanged");
    assert.equal(laneView(storage), laneReadBefore, "A3: the lane game reads the same captures and frontier unlocks");

    // A4
    if (!captured.length && showdownName === "none") {
      assert.deepEqual(progress, newSave(), "A4: nothing carried loads as a new save");
      assert.deepEqual(storage.writes, [], "A4: and writes nothing");
    }

    // A5
    if (showdownName !== "none") {
      assert.ok(progress.wins >= alone.wins && sameSave(progress, alone), "A5: existing Showdown progress kept");
    }
  });
}

// ---- The rest of the ruling ----
// Plays the Trail to its end and one bounty to its fifth hunt through the real controller.
function playToCapture(campaign, bountyId) {
  while (!trailDone(campaign.progress())) {
    if (campaign.progress().offer) campaign.choose(campaign.progress().offer[0]);
    campaign.settle(campaign.trailDuel(), true);
  }
  const results = [];
  for (let i = 0; i < HUNTS; i++) {
    if (campaign.progress().offer) campaign.choose(campaign.progress().offer[0]);
    const duel = campaign.duels().find((each) => each.id === `hunt:${bountyId}`);
    assert.ok(duel, `hunt ${i + 1} is open`);
    results.push(campaign.settle(duel, true));
  }
  return results;
}

// FH-R7.2 (.kiro/specs/showdown-first-hour/requirements.md)
test("a genuine Showdown bounty pays its Legendary to a lane veteran and a new player alike (F2: no change)", () => {
  for (const bounty of BOUNTIES) {
    const runs = ["both-captured-in-deck", "fresh-no-key"].map((laneName) => {
      const storage = storageFor(laneName);
      const campaign = createCampaign(storage);
      const results = playToCapture(campaign, bounty.id);
      return {storage, campaign, results};
    });
    const [veteran, fresh] = runs;
    for (const {campaign, results} of runs) {
      assert.equal(results.at(-1).earned.captured, bounty.reward, `${bounty.id}: fifth hunt pays ${bounty.reward}`);
      assert.equal(owned(campaign.progress(), bounty.reward), 1, `${bounty.id}: one copy in the Showdown collection`);
    }
    assert.ok(sameSave(veteran.campaign.progress(), fresh.campaign.progress()), `${bounty.id}: identical progress, veteran or not`);
    // The earned copy reloads, and the veteran's keepsake record is still there beside it.
    const reloaded = createCampaign(veteran.storage);
    assert.equal(owned(reloaded.progress(), bounty.reward), 1);
    assert.deepEqual(sorted(reloaded.inherited()), sorted([DRAGON.reward, WRAITH.reward]));
    assert.equal(reloaded.holdings().filter((row) => row.type === bounty.reward).length, 1, "a duplicate is listed once");
    assert.deepEqual(createCampaign(fresh.storage).inherited(), []);
  }
});

// FH-R5.5, FH-R7.3 (.kiro/specs/showdown-first-hour/requirements.md)
test("partial lane hunts and lane Frontier cards do not carry into Showdown", () => {
  for (const laneName of ["dragon-hunts-3-of-5", "partial-frontier-deck", "wraith-captured-dragon-4-of-5"]) {
    const storage = storageFor(laneName);
    const progress = createCampaign(storage).progress();
    assert.deepEqual(progress, newSave(), `${laneName}: a new player's progress`);
    assert.deepEqual(progress.hunts, {}, `${laneName}: no Showdown hunt counted`);
    const lane = createProfileStore(storageFor(laneName)).get();
    for (const type of frontierUnlocked(lane)) assert.equal(progress.collection[type] ?? 0, 0, `${laneName}: ${type} not carried`);
    if (laneName === "partial-frontier-deck") assert.ok(frontierUnlocked(lane).length > 0, "the fixture does unlock Frontier cards");
  }
  // Even after the Trail, a lane 4-of-5 Dragon leaves the Showdown Dragon bounty at zero.
  const storage = storageFor("wraith-captured-dragon-4-of-5", "v2-trail-2");
  assert.equal(createCampaign(storage).progress().hunts["graveyard-dragon"] ?? 0, 0);
});

// FH-R7.3 (.kiro/specs/showdown-first-hour/requirements.md)
// The graybox Camp has no Start over until slice 3. This checks the reference reset that exists today,
// prototypes/showdown/main.js "reset": keep(newSave()) then keepLog([]), i.e. it writes only the
// Showdown save and the Showdown playtest log.
test("reference Start over resets Showdown progress only; keepsakes and cvw-player-v1 are left alone", () => {
  const storage = storageFor("both-captured-in-deck");
  const campaign = createCampaign(storage);
  playToCapture(campaign, BOUNTIES[0].id);
  storage.setItem(LOG_KEY, JSON.stringify([{name: "Boot Hill", won: true}]));
  const lane = storage.data.get(LANE_KEY);
  const keepsakes = storage.data.get(INHERITED_KEY);
  const before = storage.writes.length;

  assert.equal(saveCampaign(storage, newSave()).ok, true);
  storage.setItem(LOG_KEY, JSON.stringify([]));

  assert.deepEqual(storage.writes.slice(before), [SAVE_KEY, LOG_KEY], "the reset writes only Showdown keys");
  assert.equal(storage.data.get(LANE_KEY), lane, "cvw-player-v1 untouched");
  assert.equal(storage.data.get(INHERITED_KEY), keepsakes, "keepsake record untouched");
  const after = createCampaign(storage);
  assert.deepEqual(after.progress(), newSave(), "Showdown progress reset, including the earned Legendary");
  assert.deepEqual(sorted(after.inherited()), sorted([DRAGON.reward, WRAITH.reward]), "keepsakes still shown");
  assert.deepEqual(earnedRewards(createProfileStore(storage).get()), [DRAGON.reward, WRAITH.reward]);
});
// FH-R7.3: the graybox Camp's own Start over (slice 3) is campaign.reset() then playtest.clear(),
// the calls src/ui/showdown-camp.js makes after the confirm.
test("graybox Start over resets Showdown progress only; keepsakes and cvw-player-v1 are left alone", () => {
  const storage = storageFor("both-captured-in-deck");
  const campaign = createCampaign(storage);
  const playtest = createPlaytestLog(storage);
  playToCapture(campaign, BOUNTIES[0].id);
  playtest.add({name: "Boot Hill", won: true, turns: 5, seconds: 60, run: "r1"});
  const lane = storage.data.get(LANE_KEY);
  const keepsakes = storage.data.get(INHERITED_KEY);
  const before = storage.writes.length;

  assert.equal(campaign.reset(), true);
  playtest.clear();

  assert.deepEqual(storage.writes.slice(before), [SAVE_KEY, LOG_KEY], "the reset writes only Showdown keys");
  assert.equal(storage.data.get(LANE_KEY), lane, "cvw-player-v1 untouched");
  assert.equal(storage.data.get(INHERITED_KEY), keepsakes, "keepsake record untouched");
  assert.deepEqual(campaign.progress(), newSave());
  assert.deepEqual(createPlaytestLog(storage).entries(), []);
  const after = createCampaign(storage);
  assert.deepEqual(after.progress(), newSave(), "Showdown progress reset, including the earned Legendary");
  assert.deepEqual(sorted(after.inherited()), sorted([DRAGON.reward, WRAITH.reward]), "keepsakes still shown");
  assert.ok(after.holdings().filter((row) => row.inherited).length === 2, "the Camp still lists both keepsakes");
  assert.deepEqual(earnedRewards(createProfileStore(storage).get()), [DRAGON.reward, WRAITH.reward]);
});

// FH-R7.1 (.kiro/specs/showdown-first-hour/requirements.md)
test("save codes exclude keepsakes: a veteran's code equals a new player's and carries none to a new browser", () => {
  const veteran = createCampaign(storageFor("both-captured-in-deck", "v2-trail-2"));
  const fresh = createCampaign(storageFor("fresh-no-key", "v2-trail-2"));
  const code = encodeSave(veteran.progress());
  assert.equal(code, encodeSave(fresh.progress()), "the code is built from progress only");
  assert.ok(!atob(code).includes("captured"), "no Captured card in the code");
  const decoded = decodeSaveCode(code);
  assert.ok(decoded.ok);
  const elsewhere = memoryStorage();
  assert.equal(saveCampaign(elsewhere, decoded.save).ok, true);
  const loaded = createCampaign(elsewhere);
  assert.deepEqual(loaded.inherited(), []);
  assert.ok(loaded.holdings().every((row) => !row.inherited));
  assert.ok(!elsewhere.data.has(INHERITED_KEY));
});
