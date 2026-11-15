import { CARDS, tributeCost } from "./cards.js";
import { SLOT_COUNT } from "./state.js";

const isSlot = (slot) => Number.isInteger(slot) && slot >= 0 && slot < SLOT_COUNT;

// Why a summon cannot be applied to this state, or null when it is legal.
// Reads only; the first failing check wins.
function summonRejection(state, action) {
  if (action?.type !== "summon") return "invalid-action";
  if (action.revision !== state.revision) return "stale";
  if (action.side !== state.activeSide) return "wrong-side";
  if (state.summonUsed) return "summon-used";

  const { hand, board } = state.sides[action.side];
  if (!hand.includes(action.cardId)) return "card-not-in-hand";
  const card = CARDS[action.cardId];
  if (card?.kind !== "troop") return "not-a-troop";

  const tributes = action.tributes;
  if (
    !Array.isArray(tributes) ||
    new Set(tributes).size !== tributes.length ||
    !tributes.every((slot) => isSlot(slot) && board[slot] !== null)
  ) {
    return "invalid-tribute";
  }
  const cost = tributeCost(card.stars);
  if (tributes.length < cost) return "unpaid";
  if (tributes.length > cost) return "overpaid";

  if (!isSlot(action.slot)) return "invalid-slot";
  // A tribute vacates its slot, so the summon may land there.
  if (board[action.slot] !== null && !tributes.includes(action.slot)) return "slot-occupied";
  return null;
}

// Apply one action to a match state. Never mutates `state`.
//   accepted: { ok: true, state: <new state> }
//   rejected: { ok: false, reason, state: <the same input object> }
// Summon action: { type: "summon", side, revision, cardId, slot, tributes }
// where `tributes` lists the acting side's own slot indexes to sacrifice.
export function applyAction(state, action) {
  const reason = summonRejection(state, action);
  if (reason) return { ok: false, reason, state };

  // Everything validated: pay tributes, place the troop and spend the
  // summon allowance on a copy, so the change is all-or-nothing.
  const next = structuredClone(state);
  const own = next.sides[action.side];
  for (const slot of action.tributes) {
    own.discard.push(own.board[slot].cardId);
    own.board[slot] = null;
  }
  own.hand.splice(own.hand.indexOf(action.cardId), 1);
  own.board[action.slot] = { cardId: action.cardId, health: CARDS[action.cardId].health };
  next.summonUsed = true;
  next.revision += 1;
  return { ok: true, state: next };
}
