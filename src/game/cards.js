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

// Copy limit of a Cowboy card: its spec's `limit`, else one for a bounty card,
// else MAX_COWBOY_COPIES. Registration and deck validation both use it.
export const cowboyCopyLimit = (card) => card.limit ?? (card.bounty ? 1 : MAX_COWBOY_COPIES);

for (const side of SIDES) {
  DECKS[side] = [];
  for (const { type, order, copies, ...card } of CARD_SPECS.filter((spec) => spec.side === side)) {
    const available = side === "cowboy" ? cowboyCopyLimit(card) : card.bounty ? 1 : copies;
    for (let copy = 1; copy <= available; copy++) {
      const id = `${type}-${copy}`;
      CARDS[id] = Object.freeze({ id, side, ...card });
      if (copy <= copies) DECKS[side].push(id);
    }
  }
  Object.freeze(DECKS[side]);
}
// The Stargazer's third Singularity. Registered for optional `wizardDeck`
// lists only; DECKS.wizard stays as generated.
{
  const { id: _id, ...singularity } = CARDS["wizard-singularity-2"];
  CARDS["wizard-singularity-3"] = Object.freeze({ id: "wizard-singularity-3", ...singularity });
}
Object.freeze(CARDS);
Object.freeze(DECKS);

// Ride Out: every troop on a hunt, lesson or rideOut match; otherwise only
// troops whose card says `rides`.
export const canRide = (state, cardId, cards = CARDS) => state.rideOut?.enabled === true || cards[cardId]?.rides === true;

// Friendly troops a summon must sacrifice: 1-4 stars none, 5-6 one, 7+ two.
export function tributeCost(stars) {
  return stars >= 7 ? 2 : stars >= 5 ? 1 : 0;
}
