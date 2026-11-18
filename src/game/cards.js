// Card data from docs/kiro-task-01.md. Both spells remove one health from a
// chosen enemy troop (see actions.js); `relocates` marks the one that may
// also move the survivor. Spells can never be summoned.
import { CARD_SPECS } from "./card-specs.generated.js";

export const SIDES = ["cowboy", "wizard"];
export const MAX_COWBOY_COPIES = 6;
// Health removed by either spell.
export const SPELL_DAMAGE = 1;
export const opponent = (side) => (side === SIDES[0] ? SIDES[1] : SIDES[0]);

// The card list is generated from .kiro/specs/duel-card-pipeline/cards/*.json
// (node scripts/sync-card-specs.mjs). Edit the specs to change the catalog.

// Available card instances, keyed by their unique ID
// For example "cowboy-mounted-billy-1". State holds IDs only, so no
// instance can be created or altered mid-match. A custom Cowboy deck selects
// twelve IDs from this pool; DECKS retains the original default selections.
export const CARDS = {};
// Unshuffled 12-card deck of IDs per side.
export const DECKS = {};

for (const side of SIDES) {
  DECKS[side] = [];
  for (const { type, order, copies, ...card } of CARD_SPECS.filter((spec) => spec.side === side)) {
    const available = card.bounty ? 1 : side === "cowboy" ? MAX_COWBOY_COPIES : copies;
    for (let copy = 1; copy <= available; copy++) {
      const id = `${type}-${copy}`;
      CARDS[id] = Object.freeze({ id, side, ...card });
      if (copy <= copies) DECKS[side].push(id);
    }
  }
  Object.freeze(DECKS[side]);
}
Object.freeze(CARDS);
Object.freeze(DECKS);

// Friendly troops a summon must sacrifice: 1-4 stars none, 5-6 one, 7+ two.
export function tributeCost(stars) {
  return stars >= 7 ? 2 : stars >= 5 ? 1 : 0;
}
