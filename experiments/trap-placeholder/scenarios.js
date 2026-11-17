// Issue #116: browser-safe deck scenarios for the local-only trap placeholder
// lab. Pure: no DOM, no clock, no random source, no node: import. The #114
// simulation (experiments/trap-deck-sim/sim.js) imports node:crypto, so the
// page cannot load it; this file repeats only its opening relabel, and
// tests/experiments/trap-placeholder-scenarios.test.js checks that
// openingFor() here deep-equals sim.js openingFor() for seeds 0..199.
//
// Scenarios, the same for both factions:
//   FIXTURE  the #108 lab: traps on, one extra fixture trap in each opening
//            hand (13 cards per side). Built in lab.js; the default.
//   BASE     createMatch(seed): shipped 12-card decks, traps off.
//   T1       createMatch(seed, { traps: true }), then spell copy 2 is
//            relabelled to an anonymous synthetic trap wherever it sits.
//            12 cards: one real spell, one synthetic trap.
//   T2       as T1 with both spell copies relabelled. 12 cards: no spell,
//            two synthetic traps.
// The relabel runs after the shuffle, so the seed, the shuffle, the starting
// side and every other ID's position match BASE. No card is added. The
// synthetic traps are developer-only labels, not cards, deck entries or a
// claim about any real trap card. CARDS and DECKS are never written.
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";

export const SCENARIOS = Object.freeze(["FIXTURE", "BASE", "T1", "T2"]);
export const DEFAULT_SCENARIO = "FIXTURE";

// Shipped spell copies per side, in catalog order (copy 1, copy 2).
export const SPELL_IDS = Object.freeze(
  Object.fromEntries(SIDES.map((side) => [side, Object.freeze(DECKS[side].filter((id) => CARDS[id].kind === "spell"))])),
);
// Same IDs as sim.js fixtureTrapId, so openings compare exactly.
export const deckTrapId = (side, copy) => `test-fixture-deck-trap-${side}-${copy}`;
const DECK_TRAP_NAME = "Placeholder deck trap (synthetic)";

export const DECK_TRAP_CARDS = Object.freeze(
  Object.fromEntries(
    SIDES.flatMap((side) =>
      SPELL_IDS[side].map((_, i) => {
        const id = deckTrapId(side, i + 1);
        return [id, Object.freeze({ id, side, kind: "trap", name: DECK_TRAP_NAME })];
      }),
    ),
  ),
);
export const DECK_TRAP_IDS = Object.freeze(Object.keys(DECK_TRAP_CARDS));
// CARDS unchanged plus the four synthetic deck traps (T1 and T2 catalog).
export const DECK_TRAP_CATALOG = Object.freeze({ ...CARDS, ...DECK_TRAP_CARDS });

// Spell ID -> synthetic trap ID. T1 takes the last copy, T2 takes both.
export function relabelMap(scenario) {
  const copies = { T1: 1, T2: 2 }[scenario];
  if (copies === undefined) throw new RangeError(`no relabel for scenario ${scenario}`);
  const map = {};
  for (const side of SIDES) {
    const spells = SPELL_IDS[side];
    for (let i = spells.length - copies; i < spells.length; i++) map[spells[i]] = deckTrapId(side, i + 1);
  }
  return map;
}

// Opening state for BASE, T1 or T2. FIXTURE is built in lab.js.
export function openingFor(seed, scenario) {
  if (scenario === "BASE") return createMatch(seed);
  const map = relabelMap(scenario);
  const state = createMatch(seed, { traps: true });
  for (const side of SIDES) {
    const own = state.sides[side];
    own.hand = own.hand.map((id) => map[id] ?? id);
    own.deck = own.deck.map((id) => map[id] ?? id);
  }
  return state;
}

// One status phrase per scenario; deck sizes are the real counts.
export const SCENARIO_LABELS = Object.freeze({
  FIXTURE: "FIXTURE (traps on; 13 cards per side: shipped 12 plus one extra fixture trap in hand, not a 12-card deck)",
  BASE: "BASE (shipped 12-card decks, traps off)",
  T1: "T1 (12-card decks: 1 spell and 1 synthetic trap per side, traps on)",
  T2: "T2 (12-card decks: 0 spells and 2 synthetic traps per side, traps on)",
});
