import { CARDS, SPELL_DAMAGE, opponent, tributeCost } from "./cards.js";
import { MAX_ROUNDS } from "./state.js";
import { shiftDestinations } from "./lanes.js";

// Ascending-order subsets of `items` with `size` members.
function combinations(items, size) {
  if (size === 0) return [[]];
  return items.flatMap((item, i) => combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]));
}

// Every action `side` may submit now, each accepted as is by applyAction.
// Empty when it is not that side's phase or the match is over. Order is
// fixed: summons, then spells, then trap sets (trap matches only), each in
// hand order, then ride-outs (ride-out matches only) by slot and destination,
// then end-phase last. Ride-outs follow every shipped action type, so a
// chooser that keeps the first of equal scores keeps its shipped choice.
// Tributes are listed in ascending slot order only; applyAction also accepts
// the same slots in another order, which changes nothing.
// `state` may be the full state or publicState(state, side) for the same side.
// `options.cards` replaces CARDS for kind lookups, as in applyAction; it must
// hold every CARDS entry unchanged (tests add one fixture trap card).
export function legalActions(state, side, { cards = CARDS } = {}) {
  if (state.result || state.activeSide !== side) return [];
  const { hand, board } = state.sides[side];
  if (!hand) throw new TypeError("legalActions needs that side's hand; a public view holds only its viewer's");
  const enemyBoard = state.sides[opponent(side)].board;
  const { summonUsed, castUsed } = state.allowances[side];
  const base = { side, revision: state.revision };
  const slots = board.map((_, slot) => slot);
  const actions = [];

  if (!summonUsed && !castUsed) {
    const occupied = slots.filter((slot) => board[slot] !== null);
    for (const cardId of hand) {
      if (cards[cardId].kind !== "troop") continue;
      for (const tributes of combinations(occupied, tributeCost(cards[cardId].stars))) {
        for (const slot of slots) {
          if (board[slot] !== null && !tributes.includes(slot)) continue;
          actions.push({ type: "summon", ...base, cardId, slot, tributes });
        }
      }
    }
  }

  if (!castUsed) {
    for (const cardId of hand) {
      if (cards[cardId].kind !== "spell") continue;
      for (const target of slots) {
        if (enemyBoard[target] === null) continue;
        actions.push({ type: "spell", ...base, cardId, target });
        if (!cards[cardId].relocates || enemyBoard[target].health <= SPELL_DAMAGE) continue;
        for (const destination of shiftDestinations(enemyBoard, target)) {
          actions.push({ type: "spell", ...base, cardId, target, destination });
        }
      }
    }
  }

  if (state.traps?.enabled === true && !castUsed && state.round < MAX_ROUNDS && state.sides[side].trap === null) {
    for (const cardId of hand) {
      if (cards[cardId]?.kind === "trap") actions.push({ type: "set-trap", ...base, cardId });
    }
  }

  // Ride Out experiment: the move takes the summon allowance and cannot follow a spell.
  if (state.rideOut?.enabled === true && !summonUsed && !castUsed) {
    for (const slot of slots) {
      if (board[slot] === null) continue;
      for (const destination of shiftDestinations(board, slot)) actions.push({ type: "ride-out", ...base, slot, destination });
    }
  }

  actions.push({ type: "end-phase", ...base });
  return actions;
}
