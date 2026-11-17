// Deterministic seeded cross-check. Uses the real createMatch shuffle and draw
// order on the shipped decks, then relabels spell copies as anonymous traps.
// Fisher-Yates moves positions, not labels, so relabelling after the shuffle
// equals shuffling a deck that has a trap at that spell's catalog index.
// This is a finite sample, not the exact calculation in odds.js.
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { roundOfPosition } from "./odds.js";

// Which shipped spell copies become traps (by catalog order: the last copies first).
export function trapIdsFor(side, copies) {
  const spells = Object.values(CARDS)
    .filter((c) => c.side === side && c.kind === "spell" && /-(1|2)$/.test(c.id))
    .map((c) => c.id);
  return spells.slice(spells.length - copies);
}

// Round in which each side first draws a trap for one seed, or null if never.
export function firstTrapRound(seed, copies) {
  const { sides } = createMatch(seed);
  return Object.fromEntries(SIDES.map((side) => {
    const order = [...sides[side].hand, ...sides[side].deck];
    const traps = new Set(trapIdsFor(side, copies));
    const p = order.findIndex((id) => traps.has(id));
    return [side, p < 0 ? null : roundOfPosition(p + 1)];
  }));
}

// Counts of first-trap round 1..9 per side over seeds [from, from + count).
export function sample(copies, from, count) {
  const hist = Object.fromEntries(SIDES.map((s) => [s, Array(10).fill(0)]));
  for (let seed = from; seed < from + count; seed++) {
    const first = firstTrapRound(seed, copies);
    for (const s of SIDES) hist[s][first[s] ?? 0]++;
  }
  return hist; // index 0 = never drawn (impossible in a 12-card deck)
}
