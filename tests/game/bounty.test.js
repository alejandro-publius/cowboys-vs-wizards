import test from "node:test";
import assert from "node:assert/strict";
import {DRAGON_HUNTS} from "../../src/game/bounty-notices.js";
import {createDragonHunt, dragonRewardEarned} from "../../src/game/bounty-hunt.js";
import {CARDS, DECKS} from "../../src/game/cards.js";
import {DEFAULT_COUNTS, deckIds, validateDeck, validateDeckIds} from "../../src/game/deck-builder.js";
import {applyAction} from "../../src/game/actions.js";
import {resultAfterClash} from "../../src/game/clash.js";
import {legalActions} from "../../src/game/legal.js";
import {createProfileStore} from "../../src/profile/player-profile.js";

test("the five different hunts use legal pieces from the starter decks", () => {
  assert.equal(new Set(DRAGON_HUNTS.map(hunt => hunt.id)).size, 5);
  assert.equal(new Set(DRAGON_HUNTS.map(hunt => hunt.seed)).size, 5);
  for (const hunt of DRAGON_HUNTS) {
    const state = createDragonHunt(hunt);
    assert.equal(state.activeSide, "cowboy");
    for (const side of ["cowboy", "wizard"]) {
      const {board, hand, deck} = state.sides[side];
      assert.equal(hand.length, 4);
      assert.deepEqual([...board.filter(Boolean).map(troop => troop.cardId), ...hand, ...deck].sort(), [...DECKS[side]].sort());
      for (const troop of board.filter(Boolean)) {
        assert.ok(troop.health > 0 && troop.health <= CARDS[troop.cardId].health);
      }
    }
    assert.equal(CARDS[state.bountyTarget].name, "Dragon");
  }
});

test("finishing the Dragon captures the bounty when your Base still stands", () => {
  const state = createDragonHunt(DRAGON_HUNTS.find(hunt => hunt.hand.includes("Deadeye")));
  const target = state.sides.wizard.board.findIndex(troop => troop?.cardId === state.bountyTarget);
  state.sides.wizard.board[target].health = 1;
  const shot = legalActions(state, "cowboy").find(action => action.type === "spell" && action.target === target);
  const result = applyAction(state, shot);
  assert.ok(result.ok);
  assert.equal(result.state.result.reason, "bounty-captured");
  assert.equal(result.events.at(-1).type, "result");
  result.state.sides.cowboy.baseOrbs = 0;
  assert.equal(resultAfterClash(result.state).winner, "wizard");
  state.sides.wizard.baseOrbs = 0;
  assert.equal(resultAfterClash(state).reason, "bounty-escaped");
});

test("five different captures unlock one playable reward across reloads", () => {
  const data = new Map();
  const storage = {getItem: key => data.get(key), setItem: (key, value) => data.set(key, value)};
  const profile = createProfileStore(storage);
  profile.recordBounty(DRAGON_HUNTS[0].id, {clean: true});
  profile.recordBounty(DRAGON_HUNTS[0].id);
  profile.recordBounty("unlisted");
  assert.equal(profile.get().clearedHunts.length, 1);
  assert.ok(profile.get().achievements["clean-capture"]);
  assert.equal(dragonRewardEarned(profile.get()), false);
  for (const hunt of DRAGON_HUNTS.slice(1)) profile.recordBounty(hunt.id);
  const saved = createProfileStore(storage).get();
  assert.ok(dragonRewardEarned(saved));
  assert.ok(saved.achievements["bounty-hunter"]);
  const rewardDeck = {...DEFAULT_COUNTS, "cowboy-mounted-billy": 0, "cowboy-captured-dragon": 1};
  assert.equal(validateDeck(rewardDeck).ok, false);
  const ids = deckIds(rewardDeck, {bountyReward: true});
  assert.equal(validateDeckIds(ids).ok, true);
  assert.ok(ids.includes("cowboy-captured-dragon-1"));
  assert.equal(validateDeck({...rewardDeck, "cowboy-captured-dragon": 2}, {bountyReward: true}).ok, false);
});
