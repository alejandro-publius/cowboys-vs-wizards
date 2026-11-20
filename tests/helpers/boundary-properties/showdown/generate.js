// Generated legal Showdown play. An input is plain data:
//   { seed, duel, options, choices: [int...] }   (property 7 adds levels, turns)
// options are createShowdown options; duel names where they came from (see setup).
// Replaying it deals createShowdown(seed, options) and, at each step, takes
// legalActions(state)[choice % length]. Every edited input (a choice removed, lowered or
// cut off) is therefore still legal play, which is what lets the reducer in shrink.js work.
// Randomness comes from the shared boundary-property streams in ../rng.js
// (caseRng(property, index), base seed 0xB0DA, BOUNDARY_SEED override).
import { TYPES } from "../../../../src/game/showdown/cards.js";
import { BOUNTIES, DECK_SIZE, HUNTS, RIVALS, deckProblems, duelFor, newSave } from "../../../../prototypes/showdown/progress.js";
import { GRIT_CAP, TRAIL } from "../../../../prototypes/showdown/trail.js";
import { Violation } from "../invariants.js";

export const MAX_CHOICES = 400;
export const SIDE_NAMES = ["cowboy", "wizard"];
const COWBOY_TYPES = Object.keys(TYPES).filter((type) => TYPES[type].side === "cowboy");
const total = (counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);

// A random Cowboy deck the camp would save (deckProblems from progress.js), from a collection
// that owns every card: each added card must still leave a valid deck once Sheriffs fill the rest.
function randomDeck(rng, save) {
  const deck = {};
  while (total(deck) < DECK_SIZE) {
    const type = rng.pick(COWBOY_TYPES);
    const next = { ...deck, [type]: (deck[type] ?? 0) + 1 };
    const padded = { ...next, "cowboy-sheriff": (next["cowboy-sheriff"] ?? 0) + DECK_SIZE - total(next) };
    if (!deckProblems(save, padded).length) Object.assign(deck, next);
  }
  return deck;
}

// One match the game can start: the even match createShowdown(seed), or a duel from progress.js
// duelFor (a Trail duel, a rival, a bounty hunt with its boss, or open range) for a random save
// and a Starter, Trail-stage or random valid Cowboy deck.
function setup(rng) {
  if (rng.chance(0.25)) return { duel: "even", options: {} };
  const save = { ...newSave(), wins: rng.int(TRAIL.length + 1), rivals: RIVALS.map(({ id }) => id), hunts: {}, losses: {} };
  save.collection = Object.fromEntries(COWBOY_TYPES.map((type) => [type, 9]));
  const ids = save.wins < TRAIL.length ? ["trail"]
    : [...RIVALS.map(({ id }) => `rival:${id}`), ...BOUNTIES.map(({ id }) => `hunt:${id}`), "open"];
  const id = rng.pick(ids);
  if (id.startsWith("hunt:")) save.hunts[id.slice(5)] = rng.int(HUNTS);
  save.losses[id] = rng.int(GRIT_CAP + 2);
  const deck = rng.chance(0.3) ? save.deck : randomDeck(rng, save);
  const duel = duelFor(save, id, deck);
  if (!duel) throw new Error(`duelFor refused ${id}`);
  return { duel: id === "trail" ? `trail:${save.wins}` : id, options: structuredClone(duel.options) };
}

export function generateInput(rng, { choices = MAX_CHOICES } = {}) {
  const { duel, options } = setup(rng);
  return { seed: rng.int(1_000_000), duel, options, choices: Array.from({ length: choices }, () => rng.int(1 << 16)) };
}

export const startOf = (input, engine) => engine.createShowdown(input.seed, structuredClone(input.options));

// Plays `input` on `engine`. onStart(state) sees the deal; onStep({...}) sees every applied
// action. A Violation raised inside either gets the failing step attached (-1 for the deal).
export function walk(input, engine, { onStart, onStep } = {}) {
  let state = startOf(input, engine);
  let step = -1;
  try {
    onStart?.(state);
    for (step = 0; step < input.choices.length && !state.result; step++) {
      const legal = engine.legalActions(state);
      const action = legal[input.choices[step] % legal.length];
      const before = state;
      const beforeJson = JSON.stringify(before);
      let applied;
      try { applied = engine.applyAction(before, action); } catch (error) {
        throw new Violation("legal-throws", `step ${step}: listed action ${JSON.stringify(action)} threw ${error.message}`);
      }
      const { state: after, events } = applied;
      onStep?.({ step, before, beforeJson, legal, action, state: after, events });
      state = after;
    }
  } catch (error) {
    if (error instanceof Violation && error.step === undefined) error.step = step;
    throw error;
  }
  return { state, steps: step };
}
