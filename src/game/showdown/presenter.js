// One log line for each Showdown engine event, written from the table's point of view.
// presentEvent handles every entry in EVENTS (contract.js) and throws on any other type, so a
// screen that draws through it cannot silently skip a rule. No DOM: screens decide where the
// text goes. Wording follows the prototype screen's log (prototypes/showdown/main.js).
import {cardOf} from "./cards.js";
import {EVENTS} from "./contract.js";
import {forecastAttack, HAND_CAP, opponent} from "./rules.js";

const FACTION = Object.freeze({cowboy: "Cowboys", wizard: "Wizards"});
const side = (name) => FACTION[name] ?? name;
const name = (cardId) => cardOf(cardId)?.name ?? cardId;
const owned = (owner, cardId) => `The ${side(owner)}' ${name(cardId)}`;
const base = (owner) => `the ${side(owner)}' Base`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const targetName = (target) => (target === "base" ? "the Base" : name(target));

function clashForecast(hit, lastStand) {
  if (hit.targetLeft === 0) {
    let text = "Defeated";
    if (hit.baseDamage) text += `, ${hit.baseDamage} through to the Base`;
    else if (hit.covered) text += ", nothing reaches the Base";
    if (lastStand) text += lastStand.left ? `. Its Last Stand leaves yours on ${plural(lastStand.left, "orb")}.` : ". Its Last Stand defeats yours too.";
    return {text, tone: lastStand?.left === 0 ? "warn" : "good"};
  }
  if (lastStand) {
    const target = name(hit.target);
    const trade = lastStand.left ? `leaves ${target} on ${plural(lastStand.left, "orb")}` : `defeats ${target} too`;
    return {text: `${target} hits back and defeats ${name(hit.cardId)}. Last Stand ${trade}.`, tone: "warn"};
  }
  if (hit.covered) return {text: `Survives on ${hit.targetLeft}. It is in cover and does not hit back.`, tone: ""};
  if (!hit.hitBack) return {text: `Survives on ${hit.targetLeft}. It has no attack, so yours is unharmed.`, tone: ""};
  const yours = hit.attackerLeft ? `drops to ${hit.attackerLeft}` : "is defeated";
  return {text: `Survives on ${hit.targetLeft} and hits back: yours ${yours}`, tone: hit.attackerLeft ? "" : "warn"};
}

// The same words describe a focused target, the illustrated comparison and the graybox.
export function presentAttackForecast(view, slot, target) {
  const foe = opponent(view.active);
  const before = view.sides[foe];
  const {defendingBoard, events} = forecastAttack(view, slot, target);
  const [hit] = events;
  const result = target === "base"
    ? {text: `${before.board.some(Boolean) ? "Ride past: " : ""}Hit the Base for ${hit.baseDamage}`, tone: "good"}
    : clashForecast(hit, events.find((e) => e.type === "laststand"));
  if (events.some((e) => e.type === "sweep")) {
    const changes = [];
    for (const [i, troop] of before.board.entries()) {
      if (!troop || i === target) continue;
      const card = name(troop.cardId);
      const duplicate = before.board.some((other, at) => at !== i && other && name(other.cardId) === card);
      const label = duplicate ? `${card} (slot ${i + 1})` : card;
      const after = defendingBoard[i];
      changes.push(after ? `leaves ${label} on ${plural(after.health, "orb")}` : `defeats ${label}`);
    }
    result.text += `${result.text.endsWith(".") ? "" : "."} Sweep also ${changes.join(" and ")}.`;
  }
  if (before.trapCount) result.text = "Without trap effects: " + result.text;
  return result;
}

function attackText(e) {
  const defender = base(opponent(e.side));
  if (e.target === "base") return `${owned(e.side, e.cardId)} struck ${defender} for ${e.baseDamage}.`;
  const result = e.targetLeft === 0
    ? `defeated it${e.baseDamage ? `, and ${e.baseDamage} went through to ${defender}` : e.covered ? "; it was in cover, so nothing reached the Base" : ""}`
    : e.covered ? `left it on ${e.targetLeft}; it was in cover and did not hit back`
    : !e.hitBack ? `left it on ${e.targetLeft}; it has no attack, so it did not hit back`
    : `left it on ${e.targetLeft}, and it hit back for ${e.hitBack}${e.attackerLeft === 0 ? `, defeating ${name(e.cardId)}` : ""}`;
  return `${owned(e.side, e.cardId)} attacked ${name(e.target)} and ${result}.`;
}

export const PRESENTERS = Object.freeze({
  turn: (e) => `Turn ${e.turn}: the ${side(e.side)}.`,
  draw: (e) => `The ${side(e.side)} drew a card.`,
  burn: (e) => `The ${side(e.side)}' hand was full (${HAND_CAP} cards is the limit): ${name(e.cardId)} was discarded.`,
  fatigue: (e) => `The ${side(e.side)}' deck is empty: ${base(e.side)} lost 1 orb.`,
  tribute: (e) => `${owned(e.side, e.cardId)} was paid as tribute.`,
  summon: (e) => `${owned(e.side, e.cardId)} arrived.`,
  raise: (e) => `Raise: ${owned(e.side, e.cardId)} returned from the graveyard with 1 orb.`,
  spell: (e) => `${owned(e.side, e.cardId)} hit ${targetName(e.target)}: ${e.stunned ? "stunned for its next turn" : e.left === 0 ? "defeated" : `${plural(e.left, "orb")} left`}.`,
  gear: (e) => `${owned(e.side, e.target)} now carries ${name(e.cardId)}.`,
  location: (e) => `${owned(e.side, e.cardId)} is now the location.`,
  set: (e) => `The ${side(e.side)} set a card face down.`,
  cover: (e) => `${owned(e.side, e.cardId)} took cover.`,
  trap: (e) => `Trap! ${owned(e.side, e.cardId)} caught ${name(e.target)}: ${e.left === 0 ? "defeated before it struck" : e.stopped ? "its attack was cancelled" : `it dropped to ${e.left} and attacked anyway`}.`,
  attack: attackText,
  laststand: (e) => `Last Stand: ${name(e.cardId)} took an orb off ${name(e.target)}${e.left === 0 ? ", defeating it" : ""}.`,
  sweep: (e) => `Sweep: ${name(e.cardId)} also hit ${plural(e.count, "other troop")} for 1.`,
});

// The text a player sees for one engine event. Throws for a type EVENTS does not list or this
// module has no handler for.
export function presentEvent(event, presenters = PRESENTERS) {
  const type = event?.type;
  if (!Object.hasOwn(EVENTS, type)) throw new Error(`Unknown Showdown event type: ${type}`);
  if (!Object.hasOwn(presenters, type)) throw new Error(`No presenter for Showdown event type: ${type}`);
  return presenters[type](event);
}
