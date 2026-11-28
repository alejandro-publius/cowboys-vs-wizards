import { cardOf, typeOf, EFFECTS } from "../../game/showdown/cards.js";
import { attackOf, opponent } from "../../game/showdown/rules.js";

const orbs = (n) => `${n} orb${n === 1 ? "" : "s"}`;

function troopState(troop) {
  if (!troop?.health) return "Defeated";
  return troop.stunned ? `${orbs(troop.health)} · Stunned` : orbs(troop.health);
}

// Keep the same portraits through every contact, even after a defeated troop leaves its slot.
export function replayCards(id, example, view = example.end) {
  const { before, end } = example;
  const events = example.trace[0].events;
  const [action] = events;
  const { side } = action;
  const enemy = opponent(side);
  const pieces = [];
  const changes = [];

  function troopPiece(owner, slot) {
    const board = before.sides[owner].board;
    const start = board[slot];
    const finish = end.sides[owner].board[slot];
    const art = typeOf(start.cardId);
    const duplicate = board.some((t, i) => i !== slot && t && typeOf(t.cardId) === art);
    const name = cardOf(art).name + (duplicate ? ` (slot ${slot + 1})` : "");
    if (!finish) changes.push(`${name} defeated`);
    else if (finish.stunned && !start.stunned) changes.push(`${name} stunned for its next turn`);
    else if (start.health !== finish.health) changes.push(`${name} ${start.health} → ${finish.health}`);
    return { id: art, name, before: troopState(start), after: troopState(view.sides[owner].board[slot]) };
  }

  if (action.type === "trap") {
    const slot = before.sides[enemy].board.findIndex(t => t?.cardId === action.target);
    const troop = troopPiece(enemy, slot);
    const sprung = view.sides[side].trapCount < before.sides[side].trapCount;
    const base = side === "wizard" ? "Wizard Base" : "Cowboy Base";
    pieces.push({id, name: cardOf(id).name, before: "Face down", after: sprung ? "Sprung" : "Face down"}, troop,
      {id: null, name: base, before: orbs(before.sides[side].base), after: orbs(view.sides[side].base)});
    const lost = before.sides[side].base - end.sides[side].base;
    const outcome = action.stopped ? (action.left ? "Attack cancelled · No orbs lost" : troop.name + " defeated · Base unharmed")
      : troop.name + " survives · " + base + " loses " + orbs(lost);
    return {pieces, outcome};
  }

  if (action.type === "location") {
    const tag = EFFECTS[cardOf(id).effect].tag;
    pieces.push({id, name: cardOf(id).name, before: "In hand",
      after: view.location?.cardId === action.cardId ? "On the field" : "In hand"});
    for (const owner of ["cowboy", "wizard"]) {
      for (const troop of before.sides[owner].board) {
        if (!troop || cardOf(troop.cardId).tag !== tag) continue;
        const who = typeOf(troop.cardId);
        pieces.push({id: who, name: cardOf(who).name, before: attackOf(before, troop) + " attack",
          after: attackOf(view, troop) + " attack"});
      }
    }
    return {pieces, outcome: tag + " troops gain +1 attack"};
  }

  if (action.type === "gear") {
    const slot = before.sides[side].board.findIndex(t => t?.cardId === action.target);
    const bearer = cardOf(action.target).name;
    const first = attackOf(before, before.sides[side].board[slot]);
    const last = attackOf(end, end.sides[side].board[slot]);
    const current = view.sides[side].board[slot];
    return { pieces: [
      {id, name: cardOf(id).name, before: "In hand", after: current.gear.includes(action.cardId) ? "Equipped" : "In hand"},
      {id: typeOf(action.target), name: bearer, before: first + " attack", after: attackOf(view, current) + " attack"},
    ], outcome: `${bearer} attack ${first} → ${last}` };
  }

  const summoned = events.find(event => event.type === "summon");
  if (summoned) {
    const live = view.sides[side].board.find(t => t?.cardId === summoned.cardId);
    const drawn = end.sides[side].hand.find(cardId => !before.sides[side].hand.includes(cardId));
    pieces.push({id, name: cardOf(id).name, before: "In hand", after: live ? troopState(live) : "In hand"});
    if (drawn) pieces.push({id: typeOf(drawn), name: cardOf(drawn).name, before: "In deck",
      after: view.sides[side].hand.includes(drawn) ? "Drawn" : "In deck"});
    return {pieces, outcome: `${cardOf(id).name} enters${drawn ? " · Scout draws a card" : ""}`};
  }

  for (const [slot, target] of before.sides[enemy].board.entries()) {
    if (target && troopState(target) !== troopState(end.sides[enemy].board[slot])) {
      pieces.push(troopPiece(enemy, slot));
    }
  }

  if (action.type === "spell") {
    const casterRole = { "cowboy-lasso": "cowboy-sheriff", "cowboy-deadeye": "cowboy-ranger" }[id];
    const caster = action.caster ?? (casterRole &&
      before.sides[side].board.find((t) => t && typeOf(t.cardId) === casterRole)?.cardId);
    const cast = view.sides[side].discard.includes(action.cardId) || pieces.some((p) => p.before !== p.after);
    const after = cast ? (caster ? `Cast by ${cardOf(caster).name}` : "Cast") : "In hand";
    pieces.unshift({ id, name: cardOf(id).name, before: "In hand", after });
  } else {
    const slot = before.sides[side].board.findIndex((t) => t?.cardId === action.cardId);
    pieces.unshift(troopPiece(side, slot));
  }

  const base = before.sides[enemy].base;
  const baseLeft = end.sides[enemy].base;
  if (base !== baseLeft) {
    const name = enemy === "wizard" ? "Wizard Base" : "Cowboy Base";
    if (pieces.length < 4) pieces.push({ id: null, name, before: orbs(base), after: orbs(view.sides[enemy].base) });
    changes.push(`${name} ${base} → ${baseLeft}`);
  }

  if (events.some((e) => e.type === "laststand")) changes.unshift("Last Stand");
  if (typeOf(action.target) === id && cardOf(id).keys?.includes("guard")) changes.unshift("Guard");
  return { pieces, outcome: id === "wizard-singularity" ? example.summary : changes.join(" · ") };
}
