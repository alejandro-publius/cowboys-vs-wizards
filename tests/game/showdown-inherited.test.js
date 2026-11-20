// Issue 143 slice 2 done-when 2: a Captured card already won in the lane game stays owned. The lane
// capture is kept in its own Showdown record (inherited.js); the progress object is not changed.
import test from "node:test";
import assert from "node:assert/strict";
import {BOSSES} from "../../src/game/bounty-hunt.js";
import {createProfileStore} from "../../src/profile/player-profile.js";
import {SAVE_KEY, laneCapturedCards, loadCampaign, saveCampaign} from "../../src/game/showdown/campaign-store.js";
import {INHERITED_KEY, holdings, joinInherited, readInherited} from "../../src/game/showdown/inherited.js";
import {migrate, newSave, owned, settle} from "../../src/game/showdown/progress.js";
import {createCampaign} from "../../src/match/showdown-campaign.js";

const LANE_KEY = "cvw-player-v1";
const [DRAGON, WRAITH] = BOSSES;

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  const writes = [];
  return {data, writes,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { writes.push(key); data.set(key, String(value)); }};
}
function laneProfile(steps) {
  const storage = memoryStorage();
  steps(createProfileStore(storage));
  return storage.data.get(LANE_KEY);
}
const capture = (store, boss, count = 5) => boss.hunts.slice(0, count).forEach((id) => store.recordBounty(id));
const LANE = {
  dragon: laneProfile((s) => capture(s, DRAGON)),
  both: laneProfile((s) => { capture(s, DRAGON); capture(s, WRAITH); }),
  partial: laneProfile((s) => capture(s, WRAITH, 3)),
};
// A Showdown save that already owns the Captured Dragon: Trail done, five Dragon hunts won.
const showdownDragon = (() => {
  let save = newSave();
  for (let i = 0; i < 6; i++) save = {...settle(save, "trail", true).save, offer: null};
  for (let i = 0; i < 5; i++) save = {...settle(save, "hunt:graveyard-dragon", true).save, offer: null};
  return save;
})();
// What the next page load sees: a fresh campaign over the same storage.
const reload = (storage) => createCampaign(storage);

test("a lane capture is owned by name in the Camp list, kept in its own record, and the progress is untouched", () => {
  const storage = memoryStorage({[LANE_KEY]: LANE.dragon});
  const campaign = createCampaign(storage);
  const starter = Object.entries(newSave().collection).map(([type, copies]) => ({type, copies, inherited: false}));
  assert.deepEqual(campaign.holdings(), [...starter, {type: DRAGON.reward, copies: 1, inherited: true}]);
  assert.deepEqual(campaign.progress(), newSave(), "Trail, deck, bounties and offers are those of a new player");
  assert.equal(owned(campaign.progress(), DRAGON.reward), 0, "the capture is not put into the Showdown progress");
  assert.deepEqual(JSON.parse(storage.data.get(INHERITED_KEY)), {v: 1, source: LANE_KEY, cards: [DRAGON.reward]});
  assert.equal(storage.data.get(LANE_KEY), LANE.dragon, "the lane profile is byte-identical");
  assert.ok(!storage.data.has(SAVE_KEY), "no Showdown progress is written by the join");
  assert.equal(campaign.saved(), true);
});

test("the record persists on its own: reloads, a Trail win and a later lane-profile loss keep it", () => {
  const storage = memoryStorage({[LANE_KEY]: LANE.both});
  let campaign = createCampaign(storage);
  const duel = campaign.trailDuel();
  campaign.settle(duel, true);
  campaign.choose(campaign.progress().offer[0]);
  const writes = storage.writes.length;
  for (let i = 0; i < 5; i++) campaign = reload(storage);
  assert.equal(storage.writes.length, writes, "reloads write nothing more");
  assert.deepEqual(campaign.inherited(), [DRAGON.reward, WRAITH.reward]);
  assert.equal(campaign.progress().wins, 1);
  assert.ok(migrate(JSON.parse(storage.data.get(SAVE_KEY))).wins === 1, "the progress still loads through migrate()");
  // Persisted Showdown ownership, not a live read of the lane key: remove the lane profile and reload.
  storage.data.delete(LANE_KEY);
  assert.deepEqual(laneCapturedCards(storage), []);
  campaign = reload(storage);
  assert.deepEqual(campaign.holdings().filter((row) => row.inherited).map((row) => row.type), [DRAGON.reward, WRAITH.reward]);
});

test("a card owned in both games is listed once, at the Showdown count, and both records are kept", () => {
  const storage = memoryStorage({[LANE_KEY]: LANE.dragon, [SAVE_KEY]: JSON.stringify(showdownDragon)});
  const campaign = createCampaign(storage);
  const dragonRows = campaign.holdings().filter((row) => row.type === DRAGON.reward);
  assert.deepEqual(dragonRows, [{type: DRAGON.reward, copies: 1, inherited: true}], "no double credit");
  assert.deepEqual(campaign.progress(), migrate(showdownDragon), "the Showdown save is unchanged");
  assert.deepEqual(readInherited(storage).cards, [DRAGON.reward], "the lane record is kept too");
  assert.equal(storage.data.get(SAVE_KEY), JSON.stringify(showdownDragon));
  assert.equal(storage.data.get(LANE_KEY), LANE.dragon);
});

test("partial lane hunts and a clean profile create no record and write nothing", () => {
  for (const entries of [{}, {[LANE_KEY]: LANE.partial}, {[LANE_KEY]: "{\"clearedHunts\": ["}]) {
    const storage = memoryStorage(entries);
    const campaign = createCampaign(storage);
    assert.deepEqual(storage.writes, []);
    assert.ok(campaign.holdings().every((row) => !row.inherited));
    assert.deepEqual(campaign.progress(), newSave());
  }
});

test("the record only grows, and a damaged record is never overwritten", () => {
  const storage = memoryStorage({[INHERITED_KEY]: JSON.stringify({v: 1, source: LANE_KEY, cards: [WRAITH.reward]})});
  assert.deepEqual(joinInherited(storage, [DRAGON.reward]).cards, [WRAITH.reward, DRAGON.reward]);
  assert.deepEqual(joinInherited(storage, []).cards, [WRAITH.reward, DRAGON.reward]);
  for (const bad of ["{", JSON.stringify({v: 2, cards: []}), JSON.stringify({v: 1, cards: [3]})]) {
    const damaged = memoryStorage({[INHERITED_KEY]: bad});
    const joined = joinInherited(damaged, [DRAGON.reward]);
    assert.deepEqual(joined.cards, [DRAGON.reward], "still owned this session");
    assert.equal(joined.saved, false);
    assert.equal(damaged.data.get(INHERITED_KEY), bad);
    assert.deepEqual(damaged.writes, []);
  }
});

test("blocked storage keeps ownership in memory and says it was not saved", () => {
  const storage = memoryStorage({[LANE_KEY]: LANE.dragon});
  storage.setItem = () => { throw new Error("blocked"); };
  const campaign = createCampaign(storage);
  assert.deepEqual(campaign.inherited(), [DRAGON.reward]);
  assert.equal(campaign.saved(), false);
});

test("holdings lists Showdown cards first and ignores a type the catalog does not know", () => {
  const progress = settle(newSave(), "trail", true).save;
  const rows = holdings(progress, ["not-a-card", DRAGON.reward]);
  assert.deepEqual(rows.map((row) => row.type), [...Object.keys(progress.collection), DRAGON.reward]);
  assert.ok(saveCampaign(memoryStorage(), progress).ok);
  assert.deepEqual(loadCampaign(memoryStorage()), newSave());
});
