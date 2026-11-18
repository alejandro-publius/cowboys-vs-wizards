// Clash log: plain sentences for what one round's spells and clash did, for
// the opt-in ?log=1 list. Pure: no DOM, no timers. Every number, lane and
// card comes from the Engine event; nothing here computes damage. Only
// move, spell, damage and defeat events are described, and each names a troop on
// the board or a spell as it is cast, so no hidden Wizard card can appear.
//
// clashLog(events) -> { title, lines } | null
//   events: the Engine events since the previous clash, in order. Returns
//   null until they include a clash.
import { CARDS } from "../game/cards.js";

const lane = (slot) => `lane ${slot + 1}`;
const orbs = (before, after) => `${before} → ${after} ${after === 1 ? "orb" : "orbs"}`;
const base = (side) => (side === "cowboy" ? "your Base" : "the Wizard Base");
function troop(side, cardId, first = false) {
  const { name } = CARDS[cardId];
  if (side === "cowboy") return `${first ? "Your" : "your"} ${name}`;
  return first ? name : `the ${name}`;
}

function sentence(event) {
  if (event.type === "damage") {
    const { attacker, target } = event;
    const hit = target.kind === "base" ? base(target.side) : troop(target.side, target.cardId);
    return `${troop(attacker.side, attacker.cardId, true)} in ${lane(event.lane)} hit ${hit}: ${orbs(event.before, event.after)}`;
  }
  if (event.type === "spell") {
    const { target } = event;
    const moved = event.destination === undefined ? "" : `, then moved it to ${lane(event.destination)}`;
    return `${event.caster === "cowboy" ? "Your " : ""}${event.spell} hit ${troop(target.side, target.cardId)} in ${lane(target.slot)}: ${orbs(event.before, event.after)}${moved}`;
  }
  if (event.type === "ride-out") {
    return `${troop(event.side, event.cardId, true)} rode from ${lane(event.slot)} to ${lane(event.destination)}`;
  }
  if (event.type === "defeat") return `${troop(event.side, event.cardId, true)} in ${lane(event.slot)} was defeated`;
  return null;
}

export function clashLog(events) {
  const clash = events.findLast((event) => event.type === "clash");
  if (!clash) return null;
  const lines = events.map(sentence).filter(Boolean);
  return { title: `Round ${clash.round} clash`, lines: lines.length ? lines : ["Nothing was hit"] };
}
