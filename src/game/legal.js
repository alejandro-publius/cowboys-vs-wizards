import { CARDS, SPELL_DAMAGE, opponent, tributeCost } from "./cards.js";

// Ascending-order subsets of `items` with `size` members.
function combinations(items, size) {
  if (size === 0) return [[]];
  return items.flatMap((item, i) => combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]));
}

// Every action `side` may submit now, each accepted as is by applyAction.
// Empty when it is not that side's phase or the match is over. Order is
// fixed: summons, then spells, both in hand order, then end-phase last.
// Tributes are listed in ascending slot order only; applyAction also accepts
// the same slots in another order, which changes nothing.
// `state` may be the full state or publicState(state, side) for the same side.
export function legalActions(state, side) {
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
      if (CARDS[cardId].kind !== "troop") continue;
      for (const tributes of combinations(occupied, tributeCost(CARDS[cardId].stars))) {
        for (const slot of slots) {
          if (board[slot] !== null && !tributes.includes(slot)) continue;
          actions.push({ type: "summon", ...base, cardId, slot, tributes });
        }
      }
    }
  }

  if (!castUsed) {
    for (const cardId of hand) {
      if (CARDS[cardId].kind !== "spell") continue;
      for (const target of slots) {
        if (enemyBoard[target] === null) continue;
        actions.push({ type: "spell", ...base, cardId, target });
        if (!CARDS[cardId].relocates || enemyBoard[target].health <= SPELL_DAMAGE) continue;
        for (const destination of [target - 1, target + 1]) {
          if (enemyBoard[destination] === null) actions.push({ type: "spell", ...base, cardId, target, destination });
        }
      }
    }
  }

  actions.push({ type: "end-phase", ...base });
  return actions;
}
