// The Trail: a new player's first six duels. Each one is easier than an even match, shows one
// new thing on the Wizard side, and pays a new card on the first win. Progress and saving are in progress.js.
import {DECKS} from "./cards.js";

// What a new player starts with: three card names and no keywords.
export const STARTER = Object.freeze({"cowboy-sheriff": 8, "cowboy-billy": 5, "cowboy-deadeye": 3});

// level: how well the Wizards play (0 any legal action, 1 best single action, 1.5 plans every other turn, 2 plans every turn).
// base: Wizard Base orbs. first: who opens (the Cowboys open every Trail duel).
// The settings come from trail-sim.mjs: a sure win twice, then a ramp. The even match waits until after the Trail.
// reward: [card earned, card it replaces, copies].
export const TRAIL = Object.freeze([
  {id: "boot-hill", name: "Boot Hill", lesson: "Win by removing every orb from the Wizard Base. You can strike it only when the Wizards have no troops: pick one of your troops, then the enemy troop it hits.",
    level: 0, base: 3, first: "cowboy", deck: {"wizard-skeleton": 16},
    reward: [["cowboy-covered-wagon", "cowboy-sheriff", 2]]},
  {id: "raven-roost", name: "Raven Roost", lesson: "Their cards now have keywords, listed under the board. A Jack-o'-Lantern has Last Stand: when it falls in a fight, your troop loses an orb.",
    level: 0, base: 4, first: "cowboy", deck: {"wizard-skeleton": 9, "wizard-raven-familiar": 4, "wizard-jack-o-lantern": 3},
    reward: [["cowboy-outrider", "cowboy-sheriff", 2]]},
  {id: "bone-fence", name: "The Bone Fence", lesson: "A Bone Wall has Guard: it must fall first. Their Wizard raises a Skeleton from the graveyard.",
    level: 0, base: 4, first: "cowboy", deck: {"wizard-skeleton": 8, "wizard-bone-wall": 3, "wizard-wizard": 3, "wizard-singularity": 2},
    reward: [["cowboy-ranger", "cowboy-billy", 1], ["cowboy-lasso", "cowboy-deadeye", 1]]},
  {id: "imp-hollow", name: "Imp Hollow", lesson: "An Imp strikes the turn it arrives. Keep a troop in front of your Base.",
    level: 1, base: 4, first: "cowboy", deck: {"wizard-skeleton": 6, "wizard-imp": 3, "wizard-jack-o-lantern": 3, "wizard-singularity": 2, "wizard-hellfire": 2},
    reward: [["cowboy-dynamiter", "cowboy-sheriff", 1], ["cowboy-bear-trap", "cowboy-deadeye", 1]]},
  {id: "hexed-mile", name: "The Hexed Mile", lesson: "A face-down card is a trap: it springs on your next attack. Send a cheap troop in first.",
    level: 1, base: 4, first: "cowboy", deck: {"wizard-skeleton": 6, "wizard-wizard": 3, "wizard-headless-horseman": 2, "wizard-bone-wall": 2, "wizard-hex": 2, "wizard-singularity": 1},
    reward: [["cowboy-mounted-billy", "cowboy-billy", 1]]},
  {id: "dragons-roost", name: "Dragon's Roost", lesson: "The whole coven, and the Dragon. Everything you have earned is in your deck.",
    level: 1.5, base: 4, first: "cowboy", deck: DECKS.wizard,
    reward: [["cowboy-gatling-crew", "cowboy-billy", 1]]},
]);

// A lost duel gives the rematch one more Base orb, twice at most.
export const GRIT_CAP = 2;

// Your deck after `wins` duels: the starter with each earned card swapped in.
export function deckAfter(wins) {
  const deck = {...STARTER};
  for (const {reward} of TRAIL.slice(0, wins)) {
    for (const [earned, replaced, copies] of reward) {
      deck[replaced] -= copies;
      deck[earned] = (deck[earned] ?? 0) + copies;
    }
  }
  return Object.fromEntries(Object.entries(deck).filter(([, copies]) => copies > 0));
}
