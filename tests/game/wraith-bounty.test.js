import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {DRAGON_HUNTS} from "../../src/game/bounty-notices.js";
import {WRAITH_HUNTS} from "../../src/game/wraith-notices.js";
import {BOSSES, createDragonHunt, createHunt, dragonRewardEarned, earnedRewards} from "../../src/game/bounty-hunt.js";
import {applyAction} from "../../src/game/actions.js";
import {CARDS, DECKS} from "../../src/game/cards.js";
import {pendingDrift} from "../../src/game/clash.js";
import {DEFAULT_COUNTS, deckIds, validateDeck} from "../../src/game/deck-builder.js";
import {legalActions} from "../../src/game/legal.js";
import {createMatch} from "../../src/game/state.js";
import {publicState} from "../../src/game/view.js";
import {createProfileStore} from "../../src/profile/player-profile.js";
import {label, playPlan, winningPlans} from "../helpers/hunt-solver.js";

const WRAITH = BOSSES.find((boss) => boss.id === "lantern-wraith");
const DRAGON = BOSSES.find((boss) => boss.id === "graveyard-dragon");
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const memory = () => {
  const data = new Map();
  return {getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
};
const endTurn = (state) => applyAction(state, legalActions(state, state.activeSide).at(-1));

// One-clash solution and one tempting mistake per board, as shown to players (lanes 1-3).
export const SOLUTIONS = {
  "gallows-lantern": {win: ["Ride Out lane 2 → 1", "End turn"], miss: ["End turn"], missResult: "bounty-escaped"},
  "chapel-bell-tower": {win: ["Summon Sheriff lane 3", "End turn"], miss: ["Deadeye Wizard lane 3", "End turn"], missResult: "bounty-escaped"},
  "ferry-crossing": {win: ["End turn"], miss: ["Ride Out lane 3 → 2", "End turn"], missResult: "bounty-escaped"},
  "blacksmith-forge": {win: ["Deadeye Wizard lane 3", "End turn"], miss: ["End turn"], missResult: "bounty-escaped"},
  "lamplighter-row": {win: ["Summon Billy lane 1 (tribute lane 1)", "End turn"], miss: ["Summon Billy lane 3 (tribute lane 3)", "End turn"], missResult: null},
};

test("Dragon hunts, IDs and a normal seeded match are unchanged by the shared boss model", () => {
  assert.deepEqual(DRAGON.hunts, ["coffin-creek-crossing", "bone-choir-chapel", "hanging-tree-pass", "dusk-at-dry-well", "lantern-row-standoff"]);
  assert.equal(DRAGON.reward, "cowboy-captured-dragon");
  // Hashes of createDragonHunt at 64d3849, before the Lantern Wraith work.
  const before = {
    "coffin-creek-crossing": "ae41b6c16d7911bf8d6ff298b086360331030cf3d9a6a23623b4bfc88b45f3c3",
    "bone-choir-chapel": "2db6780e9cbbf889e35d2584bd18dacab3982c08bb7ad5a2915196d2a37eee56",
    "hanging-tree-pass": "0dccc962dee4a00d5ec192df14c4a345d414a9d8f6cdeb598ef9ec1e5007b0a8",
    "dusk-at-dry-well": "6fccbaf2eb94c1e5cf3ae462813b79e4f3ac5fe244cf3491e0d0c0b9fb1f0abd",
    "lantern-row-standoff": "95f1685935bf21bc91089496e6ba0a9bc3a066850e2db233cf0e62ad86a4a61d",
  };
  for (const hunt of DRAGON_HUNTS) {
    const state = createDragonHunt(hunt);
    assert.equal(sha(state), before[hunt.id], hunt.id);
    assert.equal(pendingDrift(state), null);
  }
  assert.equal(sha(createMatch(15)), "305e96bee085878d3a6ea98c1ac23c9e09cf405a16fd567a9c08a75e9a2ad755");
  assert.equal(DECKS.wizard.includes("wizard-lantern-wraith-1"), false);
  assert.equal(DECKS.cowboy.some((id) => CARDS[id].bounty), false);
});

test("five different Wraith boards use legal pieces and the Wanted-only boss", () => {
  assert.equal(WRAITH.hunts.length, 5);
  assert.equal(new Set([...WRAITH.hunts, ...DRAGON.hunts]).size, 10);
  assert.equal(new Set(WRAITH_HUNTS.map((hunt) => hunt.seed)).size, 5);
  for (const hunt of WRAITH_HUNTS) {
    const state = createHunt(hunt);
    assert.equal(state.activeSide, "cowboy");
    assert.equal(state.bountyTarget, "wizard-lantern-wraith-1");
    assert.deepEqual(state.bountyDrift, {round: 1, destination: hunt.markLane});
    assert.deepEqual(Math.abs(hunt.markLane - hunt.bossLane), 1);
    const pieces = (side) => {
      const {board, hand, deck} = state.sides[side];
      return [...board.filter(Boolean).map((troop) => troop.cardId), ...hand, ...deck].sort();
    };
    assert.deepEqual(pieces("cowboy"), [...DECKS.cowboy].sort());
    assert.deepEqual(pieces("wizard"), [...DECKS.wizard, "wizard-lantern-wraith-1"].sort());
    for (const side of ["cowboy", "wizard"]) {
      for (const troop of state.sides[side].board.filter(Boolean)) {
        assert.ok(troop.health > 0 && troop.health <= CARDS[troop.cardId].health, hunt.id);
      }
    }
  }
});

test("each Wraith board has the documented one-clash solution and a different set of answers", () => {
  const answers = new Set();
  for (const hunt of WRAITH_HUNTS) {
    const {win, miss, missResult} = SOLUTIONS[hunt.id];
    const won = playPlan(createHunt(hunt), [win]);
    assert.equal(won.result?.reason, "bounty-captured", hunt.id);
    assert.equal(won.round, 1, `${hunt.id} is won at the first clash`);
    const missed = playPlan(createHunt(hunt), [miss]);
    assert.equal(missed.result?.reason ?? null, missResult, `${hunt.id} mistake`);
    const quick = winningPlans(createHunt(hunt), 1).map((plan) => plan[0].join(" + ")).sort();
    assert.ok(quick.includes(win.join(" + ")));
    assert.ok(!quick.includes(miss.join(" + ")));
    answers.add(JSON.stringify(quick));
  }
  assert.equal(answers.size, 5, "no two boards share the same winning first turns");
});

test("the lane mark and the clash follow one pending drift", () => {
  for (const hunt of WRAITH_HUNTS) {
    // Every legal first action, then the end of the turn: the telegraph must match what happens.
    const start = createHunt(hunt);
    for (const first of [null, ...legalActions(start, "cowboy")]) {
      let state = first ? applyAction(start, first).state : start;
      if (state.result || state.activeSide !== "cowboy") continue;
      const view = publicState(state, "cowboy");
      const plan = pendingDrift(view);
      state = endTurn(state);
      assert.ok(state.ok);
      const wizardEnd = endTurn(state.state);
      const drift = wizardEnd.events.find((event) => event.type === "ride-out");
      assert.deepEqual(drift ? {slot: drift.slot, destination: drift.destination, side: drift.side} : null, plan && {...plan, side: "wizard"});
      // No second move after the first clash.
      if (!wizardEnd.state.result) {
        assert.equal(pendingDrift(wizardEnd.state), null);
      }
    }
  }
});

test("a defeated or blocked Wraith does not move", () => {
  const hunt = WRAITH_HUNTS.find((each) => each.id === "chapel-bell-tower");
  const blocked = createHunt(hunt);
  assert.equal(pendingDrift(blocked), null, "the cracked skeleton holds the marked lane");
  const shot = playPlan(createHunt(hunt), [["Deadeye Wizard lane 3"]]);
  assert.deepEqual(pendingDrift(shot), {slot: 1, destination: 2}, "clearing the blocker frees the move");
  const gone = createHunt(WRAITH_HUNTS[0]);
  gone.sides.wizard.board[WRAITH_HUNTS[0].bossLane] = null;
  assert.equal(pendingDrift(gone), null);
});

test("each boss unlocks only its own reward; repeats, reloads and old saves keep the count", () => {
  const storage = memory();
  // A save from before the Wraith: four Dragon clears, one repeated, one unknown ID.
  storage.setItem("cvw-player-v1", JSON.stringify({clearedHunts: [...DRAGON.hunts.slice(0, 4), DRAGON.hunts[0], "unlisted"]}));
  let store = createProfileStore(storage);
  assert.deepEqual(store.get().clearedHunts, DRAGON.hunts.slice(0, 4));
  for (const id of WRAITH.hunts) store.recordBounty(id);
  store.recordBounty(WRAITH.hunts[0]);
  let saved = createProfileStore(storage).get();
  assert.equal(saved.clearedHunts.length, 9);
  assert.ok(saved.achievements["lantern-snuffer"]);
  assert.equal(saved.achievements["bounty-hunter"], undefined, "Wraith clears do not count for the Dragon");
  assert.equal(dragonRewardEarned(saved), false);
  assert.deepEqual(earnedRewards(saved), ["cowboy-captured-wraith"]);
  const wraithPosse = {...DEFAULT_COUNTS, "cowboy-sheriff": 5, "cowboy-captured-wraith": 1};
  const dragonPosse = {...DEFAULT_COUNTS, "cowboy-mounted-billy": 0, "cowboy-captured-dragon": 1};
  assert.equal(validateDeck(wraithPosse, {rewards: earnedRewards(saved)}).ok, true);
  assert.equal(validateDeck(dragonPosse, {rewards: earnedRewards(saved)}).ok, false, "the Dragon reward stays locked");
  assert.equal(validateDeck({...wraithPosse, "cowboy-sheriff": 4, "cowboy-captured-wraith": 2}, {rewards: earnedRewards(saved)}).ok, false);
  store = createProfileStore(storage);
  store.recordBounty(DRAGON.hunts[4]);
  saved = createProfileStore(storage).get();
  assert.ok(saved.achievements["bounty-hunter"]);
  assert.deepEqual(earnedRewards(saved), ["cowboy-captured-dragon", "cowboy-captured-wraith"]);
  assert.equal(validateDeck(dragonPosse, {rewards: earnedRewards(saved)}).ok, true);

  // The other order: only the Dragon cleared keeps the Wraith reward locked.
  const dragonOnly = createProfileStore(memory());
  for (const id of DRAGON.hunts) dragonOnly.recordBounty(id);
  assert.deepEqual(earnedRewards(dragonOnly.get()), ["cowboy-captured-dragon"]);
  assert.equal(dragonOnly.get().achievements["lantern-snuffer"], undefined);
  assert.equal(validateDeck(wraithPosse, {rewards: earnedRewards(dragonOnly.get())}).ok, false);
});

test("seed 15 with the Wraith Posse summons Captured Wraith for free in a normal duel", () => {
  const cowboyDeck = deckIds({...DEFAULT_COUNTS, "cowboy-sheriff": 5, "cowboy-captured-wraith": 1}, {rewards: ["cowboy-captured-wraith"]});
  const state = createMatch(15, {cowboyDeck});
  assert.equal(state.startingSide, "cowboy");
  assert.equal(state.bountyTarget, undefined);
  assert.ok(state.sides.cowboy.hand.includes("cowboy-captured-wraith-1"));
  const summon = legalActions(state, "cowboy").find((action) => action.type === "summon"
    && action.cardId === "cowboy-captured-wraith-1" && action.slot === 0);
  assert.deepEqual(summon.tributes, []);
  const result = applyAction(state, summon);
  assert.ok(result.ok);
  assert.deepEqual(result.state.sides.cowboy.board[0], {cardId: "cowboy-captured-wraith-1", health: 2});
});
