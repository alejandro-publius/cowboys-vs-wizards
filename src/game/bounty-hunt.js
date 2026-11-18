import {DRAGON_HUNTS} from "./bounty-notices.js";
import {WRAITH_HUNTS} from "./wraith-notices.js";
import {CARDS} from "./cards.js";
import {createMatch} from "./state.js";

export const HUNT_GOAL = 5;

// Each Wanted boss: its ID, the wanted Wizard troop, five authored hunts and
// one unlockable one-copy reward. Progress is the boss's own cleared hunts.
export const BOSSES = Object.freeze([
  {
    id: "graveyard-dragon", name: "Graveyard Dragon", card: "wizard-dragon-1",
    reward: "cowboy-captured-dragon", achievement: "bounty-hunter", hunts: DRAGON_HUNTS,
    brief: "Bring down the Dragon and keep your Base standing. Monsters hold their lanes and strike at the clash.",
  },
  {
    id: "lantern-wraith", name: "Lantern Wraith", card: "wizard-lantern-wraith-1",
    reward: "cowboy-captured-wraith", achievement: "lantern-snuffer", hunts: WRAITH_HUNTS,
    brief: "Before the first clash the Wraith drifts into the marked Wizard lane, unless that lane is taken or it has fallen. Then it holds.",
  },
].map((boss) => Object.freeze({...boss, hunts: Object.freeze(boss.hunts.map((hunt) => hunt.id))})));

const ALL_HUNTS = [...DRAGON_HUNTS, ...WRAITH_HUNTS];
export const HUNTS_BY_ID = new Map(ALL_HUNTS.map((hunt) => [hunt.id, hunt]));
export const BOSSES_BY_ID = new Map(BOSSES.map((boss) => [boss.id, boss]));
export const bossOfHunt = (huntId) => BOSSES.find((boss) => boss.hunts.includes(huntId)) ?? null;

export const clearedFor = (profile, boss) => boss.hunts.filter((id) => profile.clearedHunts.includes(id)).length;
export const rewardEarned = (profile, boss) => clearedFor(profile, boss) >= HUNT_GOAL;
export const dragonRewardEarned = (profile) => rewardEarned(profile, BOSSES[0]);
// Reward card types the profile has earned, for deck validation.
export const earnedRewards = (profile) => BOSSES.filter((boss) => rewardEarned(profile, boss)).map((boss) => boss.reward);

// Dragon notices name dragonLane/dragonOrbs/skeletonLane; Wraith notices name
// bossLane/bossOrbs/markLane and skeletons [{lane, orbs}].
export function createHunt(hunt) {
  const boss = bossOfHunt(hunt.id);
  if (!boss) throw new Error(`Unknown hunt ${hunt.id}`);
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
  // A boss from the starter deck (the Dragon) leaves it; a Wanted-only boss joins this board.
  state.bountyTarget = wizardPool.includes(boss.card) ? take(wizardPool, CARDS[boss.card].name) : boss.card;
  wizard.board[hunt.bossLane ?? hunt.dragonLane] = {cardId: state.bountyTarget, health: hunt.bossOrbs ?? hunt.dragonOrbs};
  const skeletons = hunt.skeletons ?? (hunt.skeletonLane === null ? [] : [{lane: hunt.skeletonLane}]);
  for (const {lane, orbs} of skeletons) {
    const cardId = take(wizardPool, "Skeleton");
    wizard.board[lane] = {cardId, health: orbs ?? CARDS[cardId].health};
  }
  if (Number.isInteger(hunt.markLane)) state.bountyDrift = {round: 1, destination: hunt.markLane};
  wizard.hand = wizardPool.splice(0, wizard.hand.length);
  wizard.deck = wizardPool;
  return state;
}

export const createDragonHunt = createHunt;
