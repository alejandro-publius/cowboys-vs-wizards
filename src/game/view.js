import { SIDES } from "./cards.js";

// What `side` may know, as an independent copy. Hidden: the opponent's hand,
// both deck orders (counts only), and `seed` and `rng`, because either one
// reproduces the shuffles. `result.outcome` is the result from this side's
// point of view: "win", "loss" or "draw".
export function publicState(state, side) {
  if (!SIDES.includes(side)) throw new TypeError("side must be one of " + SIDES.join(", "));
  const sides = {};
  for (const each of SIDES) {
    const { baseOrbs, deck, hand, board, discard } = state.sides[each];
    sides[each] = { baseOrbs, deckCount: deck.length, handCount: hand.length, board, discard };
    if (each === side) sides[each].hand = hand;
  }
  const { revision, round, startingSide, activeSide, allowances, result } = state;
  const outcome = result && (result.winner === null ? "draw" : result.winner === side ? "win" : "loss");
  return structuredClone({
    viewer: side,
    revision,
    round,
    startingSide,
    activeSide,
    allowances,
    result: result && { ...result, outcome },
    sides,
  });
}
