// Opening-policy variants for the human A/B playtest. Each edits only the
// opening state returned by createMatch; nothing here runs unless a caller
// opts in. scripts/compare-opening-policies.mjs uses the same functions.
import { CARDS, SIDES, opponent, tributeCost } from "./cards.js";
import { createMatch, OPENING_HAND } from "./state.js";

export const isFree = (id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0;
export const drought = (hand) => !hand.some(isFree);

// Chance that all standard opening draws miss the deck's free troops.
export function openingDroughtRate(deck) {
  const otherCards = deck.filter((id) => !isFree(id)).length;
  if (otherCards < OPENING_HAND) return 0;
  let rate = 1;
  for (let draw = 0; draw < OPENING_HAND; draw++) {
    rate *= (otherCards - draw) / (deck.length - draw);
  }
  return rate;
}

// A hand with no free troop trades its last-dealt card for the topmost free
// troop in its own deck. Sizes and deck order are otherwise unchanged.
export function guaranteeFree(state) {
  for (const side of SIDES) {
    const { hand, deck } = state.sides[side];
    if (!drought(hand)) continue;
    const at = deck.findIndex(isFree); // six free troops per deck, four cards dealt: always found
    [hand[hand.length - 1], deck[at]] = [deck[at], hand[hand.length - 1]];
  }
}
// The side acting second in round 1 draws the top of its deck early.
export function extraCard(state) {
  const own = state.sides[opponent(state.startingSide)];
  own.hand.push(own.deck.shift());
}
export const VARIANTS = {
  shipped: () => {},
  freeOpener: guaranteeFree,
  extraCard,
  both(state) {
    guaranteeFree(state);
    extraCard(state);
  },
};

// createMatch(seed) with an optional forced first seat, then the variant.
export function openingMatch(seed, variant, starter, options) {
  const state = createMatch(seed, options);
  if (starter) state.startingSide = state.activeSide = starter;
  VARIANTS[variant](state);
  return state;
}

// Reads ?opening=shipped|both and ?first=cowboy|wizard. Returns null (default
// game) unless opening is recognized; first is ignored without it, and an
// unknown first falls back to the seeded first seat.
export function parseOpeningParams(params) {
  const opening = params.get("opening");
  if (opening !== "shipped" && opening !== "both") return null;
  const first = params.get("first");
  return { opening, first: SIDES.includes(first) ? first : undefined };
}
