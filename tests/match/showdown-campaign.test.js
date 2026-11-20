// Issue 143 slice 2: the graybox Camp -> Trail -> settle -> choice -> Camp cycle, on the canonical
// progress and store modules, with an in-memory Storage standing in for localStorage.
import assert from "node:assert/strict";
import test from "node:test";
import {createCampaign} from "../../src/match/showdown-campaign.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {TRAIL} from "../../src/game/showdown/trail.js";

const memoryStorage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return {getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), map};
};

// Plays the duel the way the browser check clicks it: attacks first, then any card, then End turn.
function play(duel, seed) {
  const session = createShowdownSession({seed, duel});
  for (let step = 0; step < 400 && !session.view().result; step += 1) {
    const legal = session.legal();
    session.act(legal.find((a) => a.type === "attack") ?? legal.find((a) => a.type !== "end" && a.type !== "cover") ?? legal.find((a) => a.type === "end"));
  }
  return session.view().result;
}
const firstWinningSeed = (duel) => {
  for (let seed = 0; seed < 50; seed += 1) if (play(duel, seed)?.winner === "cowboy") return seed;
  throw new Error(`no seed in 0-49 wins ${duel.name}`);
};

test("a fresh profile wins Trail duels 1 and 2, is paid the designed cards, and a reload keeps them", () => {
  const storage = memoryStorage();
  let campaign = createCampaign(storage);
  assert.equal(campaign.progress().wins, 0);
  assert.deepEqual(campaign.duels().filter((d) => d.kind === "trail").map((d) => d.state), ["open", "locked", "locked", "locked", "locked", "locked"]);

  for (const [index, expected] of [[0, [["cowboy-covered-wagon", 2]]], [1, [["cowboy-outrider", 2]]]]) {
    const duel = campaign.trailDuel();
    assert.equal(duel.name, TRAIL[index].name);
    assert.equal(play(duel, firstWinningSeed(duel))?.winner, "cowboy");
    const before = campaign.progress();
    const outcome = campaign.settle(duel, true);
    // Exactly the cards TRAIL[index].reward lists, each swapped in for the plain card it names.
    assert.deepEqual(outcome.earned.cards, expected);
    const [[type, replaced, copies]] = TRAIL[index].reward;
    assert.deepEqual(outcome.intoDeck, [[type, copies, replaced]]);
    assert.equal(campaign.progress().deck[replaced], before.deck[replaced] - copies);
    assert.equal(campaign.progress().collection[type], copies);
    // The choice comes first: no duel can start while a card is on offer, and it survives a reload.
    const offer = campaign.progress().offer;
    assert.equal(offer.length, 2);
    assert.equal(campaign.trailDuel(), null);
    assert.deepEqual(createCampaign(storage).progress().offer, offer);
    const owned = campaign.owned(offer[0]);
    campaign.choose(offer[0]);
    assert.equal(campaign.owned(offer[0]), owned + 1);
    assert.equal(campaign.progress().offer, null);
    assert.ok(campaign.saved());
    const kept = campaign.progress();
    campaign = createCampaign(storage);
    assert.deepEqual(campaign.progress(), kept, "a reload restores the same progress");
    assert.equal(campaign.progress().wins, index + 1);
  }
  assert.equal(campaign.trailDuel().name, TRAIL[2].name, "the third Trail duel is next after a reload");
  assert.deepEqual(campaign.duels().filter((d) => d.kind === "trail").map((d) => d.state), ["won", "won", "open", "locked", "locked", "locked"]);
});

test("a loss pays nothing and gives the rematch one more Base orb, kept across a reload", () => {
  const storage = memoryStorage();
  const campaign = createCampaign(storage);
  const outcome = campaign.settle(campaign.trailDuel(), false);
  assert.deepEqual(outcome.earned.cards, []);
  assert.equal(outcome.grit, 1);
  assert.equal(campaign.progress().offer, null);
  assert.equal(createCampaign(storage).trailDuel().options.baseOrbs.cowboy, 6);
});

test("the lane profile is left as it was, and blocked storage plays on in memory", () => {
  const lane = JSON.stringify({deck: null, clearedHunts: ["wanted-lantern-wraith"], stats: {matches: 3, wins: 2}});
  const storage = memoryStorage({"cvw-player-v1": lane});
  const campaign = createCampaign(storage);
  campaign.settle(campaign.trailDuel(), true);
  assert.equal(storage.getItem("cvw-player-v1"), lane);

  const blocked = {getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }};
  const offline = createCampaign(blocked);
  offline.settle(offline.trailDuel(), true);
  assert.equal(offline.saved(), false);
  assert.equal(offline.progress().wins, 1);
  assert.equal(createCampaign(null).progress().wins, 0);
});
