import { CARD_SPECS } from "./card-specs.generated.js";
import { CARDS, MAX_COWBOY_COPIES } from "./cards.js";

export const DECK_SIZE = 12;
export const COWBOY_CATALOG = Object.freeze(
  CARD_SPECS.filter((spec) => spec.side === "cowboy").map((spec) => Object.freeze({ ...spec })),
);
export const DEFAULT_COUNTS = Object.freeze(
  Object.fromEntries(COWBOY_CATALOG.map(({ type, copies }) => [type, copies])),
);

const types = new Set(COWBOY_CATALOG.map(({ type }) => type));
const typeById = new Map(COWBOY_CATALOG.flatMap(({ type }) =>
  Array.from({ length: MAX_COWBOY_COPIES }, (_, index) => [`${type}-${index + 1}`, type]),
));
const invalid = (error, total = 0) => ({ ok: false, error, total });

// Missing known types count as zero. Unknown types and coerced numbers are
// rejected so stored or user-provided selections cannot change the catalog.
export function validateDeck(counts) {
  if (!counts || typeof counts !== "object" || Array.isArray(counts) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(counts))) {
    return invalid("Choose card counts for your Cowboy deck.");
  }
  if (Object.keys(counts).some((type) => !types.has(type))) {
    return invalid("Only Cowboy cards can be added to this deck.");
  }
  const entries = COWBOY_CATALOG.map(({ type, name }) => ({
    name, copies: Object.hasOwn(counts, type) ? counts[type] : 0,
  }));
  const total = entries.reduce((sum, { copies }) => sum + (Number.isFinite(copies) ? copies : 0), 0);
  for (const { name, copies } of entries) {
    if (!Number.isInteger(copies) || copies < 0 || copies > MAX_COWBOY_COPIES) {
      return invalid(`${name} must have between 0 and ${MAX_COWBOY_COPIES} whole copies.`, total);
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
export function deckIds(counts) {
  const result = validateDeck(counts);
  if (!result.ok) throw new TypeError(result.error);
  return COWBOY_CATALOG.flatMap(({ type }) =>
    Array.from({ length: Object.hasOwn(counts, type) ? counts[type] : 0 }, (_, index) => `${type}-${index + 1}`),
  );
}

// Validate the actual IDs at the match boundary as well as the builder counts.
// No card instances or caller-owned arrays are changed by this check.
export function validateDeckIds(ids) {
  if (!Array.isArray(ids)) return invalid("The Cowboy deck must be a list of card IDs.");
  if (ids.length !== DECK_SIZE) return invalid(`Choose exactly ${DECK_SIZE} cards.`, ids.length);
  const seen = new Set();
  const counts = Object.fromEntries(COWBOY_CATALOG.map(({ type }) => [type, 0]));
  for (const id of ids) {
    if (typeof id !== "string" || !Object.hasOwn(CARDS, id) || CARDS[id].side !== "cowboy" || !typeById.has(id)) {
      return invalid("The Cowboy deck contains an unknown or non-Cowboy card.", ids.length);
    }
    if (seen.has(id)) return invalid("Each card copy must have a unique ID.", ids.length);
    seen.add(id);
    counts[typeById.get(id)]++;
  }
  return validateDeck(counts);
}
