import { DECKS, SIDES } from "./cards.js";

export const SLOT_COUNT = 3;
export const BASE_ORBS = 5;
export const OPENING_HAND = 4;
export const MAX_ROUNDS = 9;
// Names the rule set in reports. Change it whenever a rule or card value changes.
export const RULES_VERSION = "orb-duel-draft-1";

// mulberry32 step. The whole generator is one uint32, so it lives in the
// match state as a plain number and replays from a seed are identical.
function nextRandom(rng) {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { rng: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

// Fisher-Yates on a copy.
function shuffle(ids, rng) {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const step = nextRandom(rng);
    rng = step.rng;
    const j = Math.floor(step.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { ids: out, rng };
}

// New match from an integer seed; calling it again with `state.seed` restarts
// the same match. RNG draws happen in a fixed order: cowboy shuffle, wizard
// shuffle, starting side. Nothing after setup draws from the RNG. Index 0 of
// a deck is its top.
export function createMatch(seed) {
  if (!Number.isInteger(seed)) throw new TypeError("seed must be an integer");
  let rng = seed >>> 0;
  const sides = {};
  for (const side of SIDES) {
    const shuffled = shuffle(DECKS[side], rng);
    rng = shuffled.rng;
    sides[side] = {
      baseOrbs: BASE_ORBS,
      deck: shuffled.ids.slice(OPENING_HAND),
      hand: shuffled.ids.slice(0, OPENING_HAND),
      board: Array(SLOT_COUNT).fill(null),
      discard: [],
    };
  }
  const start = nextRandom(rng);
  const startingSide = SIDES[Math.floor(start.value * SIDES.length)];
  return {
    seed,
    revision: 0, // +1 per accepted action
    rng: start.rng,
    round: 1,
    startingSide, // acts first this round; alternates every round
    activeSide: startingSide, // whose action phase it is; null once the match is over
    // Each side's one summon and one cast for the current round.
    allowances: Object.fromEntries(SIDES.map((side) => [side, { summonUsed: false, castUsed: false }])),
    actionIds: [], // IDs of accepted actions that supplied one
    result: null, // { winner, loser, reason, round } once the match is over
    sides,
  };
}
