// TEMPORARY import adapter for issue 143 slice 1 (Showdown graybox screen).
// The Showdown engine is being moved into src/game/showdown/{rules,cards,contract,presenter}.js
// by a parallel worker with the same exports as prototypes/showdown/. Until that lands, the
// screen imports everything through this one file. At integration the coordinator rebinds it:
//   export * from "../game/showdown/rules.js"; (and cards.js, contract.js, presenter.js)
// and deletes the local presentEvent below in favour of the canonical presenter.
// TRAIL and STARTER stay on the prototype until slice 2 moves trail.js in.
export {DECKS, EFFECTS, KEYWORDS, RARITY, TYPES, cardOf, tributes} from "../../prototypes/showdown/cards.js";
export {EVENTS, viewFor} from "../../prototypes/showdown/contract.js";
export {TRAP_SLOTS, applyAction, attackOf, attackOutcome, canAttack, createShowdown, legalActions, opponent, playTurn} from "../../prototypes/showdown/rules.js";
export {STARTER, TRAIL} from "../../prototypes/showdown/trail.js";
import {cardOf} from "../../prototypes/showdown/cards.js";
import {EVENTS} from "../../prototypes/showdown/contract.js";
import {opponent} from "../../prototypes/showdown/rules.js";

// Temporary presenter with the canonical signature: presentEvent(event) returns the visible text.
// It uses only the fields EVENTS lists, so it never names a card the contract keeps hidden.
const name = (cardId) => cardOf(cardId).name;
const faction = (side) => (side === "cowboy" ? "Cowboy" : "Wizard");
const own = (side, cardId) => `${faction(side)} ${name(cardId)}`;
const orbs = (n) => `${n} orb${n === 1 ? "" : "s"}`;
const base = (side) => `the ${faction(side)} Base`;
const PRESENT = {
  turn: (e) => `Turn ${e.turn}: the ${faction(e.side)}s.`,
  draw: (e) => `The ${faction(e.side)}s drew a card.`,
  burn: (e) => `The ${faction(e.side)} hand was full: ${name(e.cardId)} was discarded.`,
  fatigue: (e) => `The ${faction(e.side)} deck is empty: ${base(e.side)} lost 1 orb.`,
  tribute: (e) => `${own(e.side, e.cardId)} was paid as tribute.`,
  summon: (e) => `${own(e.side, e.cardId)} arrived.`,
  raise: (e) => `Raise: ${own(e.side, e.cardId)} returned from the graveyard with 1 orb.`,
  spell: (e) => `${own(e.side, e.cardId)} hit ${name(e.target)}: ${e.stunned ? "stunned for its next turn" : e.left === 0 ? "defeated" : `${orbs(e.left)} left`}.`,
  gear: (e) => `${own(e.side, e.target)} now carries ${name(e.cardId)}.`,
  location: (e) => `${own(e.side, e.cardId)} is now the location.`,
  set: (e) => `The ${faction(e.side)}s set a card face down.`,
  cover: (e) => `${own(e.side, e.cardId)} took cover.`,
  trap: (e) => `Trap! ${own(e.side, e.cardId)} caught ${name(e.target)}: ${e.stopped ? (e.left === 0 ? "defeated before it struck" : "its attack was cancelled") : `it dropped to ${e.left} and attacked anyway`}.`,
  attack: (e) => {
    if (e.target === "base") return `${own(e.side, e.cardId)} struck ${base(opponent(e.side))} for ${e.baseDamage}.`;
    const result = e.targetLeft === 0 ? `defeated it${e.baseDamage ? `, and ${e.baseDamage} went through to ${base(opponent(e.side))}` : e.covered ? "; it was in cover, so nothing reached the Base" : ""}`
      : e.covered ? `left it on ${e.targetLeft}; it was in cover and did not hit back`
      : !e.hitBack ? `left it on ${e.targetLeft}; it has no attack, so it did not hit back`
      : `left it on ${e.targetLeft}, and it hit back for ${e.hitBack}${e.attackerLeft === 0 ? `, defeating ${name(e.cardId)}` : ""}`;
    return `${own(e.side, e.cardId)} attacked ${name(e.target)} and ${result}.`;
  },
  laststand: (e) => `Last Stand: ${name(e.cardId)} took an orb off ${name(e.target)}${e.left === 0 ? ", defeating it" : ""}.`,
  sweep: (e) => `Sweep: ${name(e.cardId)} also hit ${e.count} other troop${e.count === 1 ? "" : "s"} for 1.`,
};
export function presentEvent(event) {
  if (!Object.hasOwn(EVENTS, event.type) || !PRESENT[event.type]) throw new Error(`no presenter for event ${JSON.stringify(event.type)}`);
  return PRESENT[event.type](event);
}
export const PRESENTED = Object.freeze(Object.keys(PRESENT));
