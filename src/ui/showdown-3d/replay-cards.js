import { cardOf, typeOf } from "../../game/showdown/cards.js";
import { opponent } from "../../game/showdown/rules.js";

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

  for (const [slot, target] of before.sides[enemy].board.entries()) {
    if (target && troopState(target) !== troopState(end.sides[enemy].board[slot])) {
      pieces.push(troopPiece(enemy, slot));
    }
  }

  if (action.type === "spell") {
    const caster = action.caster ?? (id === "cowboy-lasso" &&
      before.sides[side].board.find((t) => t && typeOf(t.cardId) === "cowboy-sheriff")?.cardId);
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
