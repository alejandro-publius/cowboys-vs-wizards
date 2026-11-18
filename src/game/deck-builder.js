import { CARD_SPECS } from "./card-specs.generated.js";
import { CARDS, MAX_COWBOY_COPIES } from "./cards.js";

export const DECK_SIZE = 12;
export const COWBOY_CATALOG = Object.freeze(
  CARD_SPECS.filter((spec) => spec.side === "cowboy" && !spec.bounty).map((spec) => Object.freeze({ ...spec })),
);
export const DEFAULT_COUNTS = Object.freeze(
  Object.fromEntries(COWBOY_CATALOG.map(({ type, copies }) => [type, copies])),
);

export const BOUNTY_REWARDS = Object.freeze(CARD_SPECS.filter((spec) => spec.bounty).map(Object.freeze));
export const copyLimit = (card) => card.bounty ? 1 : MAX_COWBOY_COPIES;
const catalog = [...COWBOY_CATALOG, ...BOUNTY_REWARDS];
const typeById = new Map(catalog.flatMap((card) =>
  Array.from({ length: copyLimit(card) }, (_, index) => [`${card.type}-${index + 1}`, card.type]),
));
const invalid = (error, total = 0) => ({ ok: false, error, total });

// Missing known types count as zero. Unknown types and coerced numbers are
// rejected so stored or user-provided selections cannot change the catalog.
export function validateDeck(counts, {bountyReward = false} = {}) {
  if (!counts || typeof counts !== "object" || Array.isArray(counts) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(counts))) {
    return invalid("Choose card counts for your Cowboy deck.");
  }
  const available = bountyReward ? catalog : COWBOY_CATALOG;
  if (Object.keys(counts).some((type) => !available.some((card) => card.type === type))) {
    return invalid("Choose cards from your unlocked Cowboy collection.");
  }
  const entries = available.map((card) => ({
    ...card, copies: Object.hasOwn(counts, card.type) ? counts[card.type] : 0,
  }));
  const total = entries.reduce((sum, { copies }) => sum + (Number.isFinite(copies) ? copies : 0), 0);
  for (const card of entries) {
    const {name, copies} = card;
    const limit = copyLimit(card);
    if (!Number.isInteger(copies) || copies < 0 || copies > limit) {
      return invalid(`${name} must have between 0 and ${limit} whole copies.`, total);
    }
  }
  if (total !== DECK_SIZE) return invalid(`Choose exactly ${DECK_SIZE} cards.`, total);
  if (!Object.hasOwn(counts, "cowboy-sheriff") || counts["cowboy-sheriff"] < 1) {
    return invalid("Keep at least one Sheriff so you can summon without a tribute.", total);
  }
  return { ok: true, error: null, total };
}

// Stable catalog order preserves the seeded default shuffle when the user
// saves the original counts. Each call returns a new list of distinct IDs.
export function deckIds(counts, options) {
  const result = validateDeck(counts, options);
  if (!result.ok) throw new TypeError(result.error);
  return catalog.flatMap(({ type }) =>
    Array.from({ length: Object.hasOwn(counts, type) ? counts[type] : 0 }, (_, index) => `${type}-${index + 1}`),
  );
}

// Validate the actual IDs at the match boundary as well as the builder counts.
// No card instances or caller-owned arrays are changed by this check.
export function validateDeckIds(ids) {
  if (!Array.isArray(ids)) return invalid("The Cowboy deck must be a list of card IDs.");
  if (ids.length !== DECK_SIZE) return invalid(`Choose exactly ${DECK_SIZE} cards.`, ids.length);
  const seen = new Set();
  const counts = Object.fromEntries(catalog.map(({ type }) => [type, 0]));
  for (const id of ids) {
    if (typeof id !== "string" || !Object.hasOwn(CARDS, id) || CARDS[id].side !== "cowboy" || !typeById.has(id)) {
      return invalid("The Cowboy deck contains an unknown or non-Cowboy card.", ids.length);
    }
    if (seen.has(id)) return invalid("Each card copy must have a unique ID.", ids.length);
    seen.add(id);
    counts[typeById.get(id)]++;
  }
  return validateDeck(counts, {bountyReward: true});
}
