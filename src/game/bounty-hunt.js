import {DRAGON_HUNTS} from "./bounty-notices.js";
import {CARDS} from "./cards.js";
import {createMatch} from "./state.js";

export const HUNT_GOAL = 5;
export const HUNTS_BY_ID = new Map(DRAGON_HUNTS.map((hunt) => [hunt.id, hunt]));
export const dragonRewardEarned = (profile) => profile.clearedHunts.length >= HUNT_GOAL;

export function createDragonHunt(hunt) {
  const state = createMatch(hunt.seed, {rideOut: true});
  state.startingSide = state.activeSide = "cowboy";
  const {cowboy, wizard} = state.sides;
  cowboy.baseOrbs = hunt.cowboyBase;
  const cowboyPool = [...cowboy.hand, ...cowboy.deck];
  const wizardPool = [...wizard.hand, ...wizard.deck];

  function take(pool, name) {
    const index = pool.findIndex((cardId) => CARDS[cardId].name === name);
    if (index < 0) throw new Error(`Hunt ${hunt.id} ran out of ${name} cards`);
    return pool.splice(index, 1)[0];
  }

  cowboy.board = hunt.cowboys.map((troop) => troop && {
    cardId: take(cowboyPool, troop.troop), health: troop.orbs,
  });
  cowboy.hand = hunt.hand.map((name) => take(cowboyPool, name));
  cowboy.deck = cowboyPool;
  state.bountyTarget = take(wizardPool, "Dragon");
  wizard.board[hunt.dragonLane] = {cardId: state.bountyTarget, health: hunt.dragonOrbs};
  if (hunt.skeletonLane !== null) {
    const cardId = take(wizardPool, "Skeleton");
    wizard.board[hunt.skeletonLane] = {cardId, health: CARDS[cardId].health};
  }
  wizard.hand = wizardPool.splice(0, wizard.hand.length);
  wizard.deck = wizardPool;
  return state;
}
