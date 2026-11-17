// Issue #120: deterministic seed picker for a later human playtest of the T1
// trap placeholder scenario in the local lab (experiments/trap-placeholder).
// Pure and browser-safe: no DOM, clock, random source, filesystem or node:
// import. It reads only the T1 opening from scenarios.js openingFor(seed, "T1")
// and cross-checks every scanned seed against createMatch(seed) (BASE).
//
// Position: index in the Cowboy's shuffled 12-card T1 deck. Positions 0..3 are
// the opening hand; position p >= 4 is the top of the deck at the start of
// round p - 2 (one draw per side per round from round 2, src/game/actions.js).
// A position says when the card WOULD be drawn if the match is still going at
// that round start. It is not a draw observed in a played match: a match can
// end before round 8 or 9, and nothing here says what a player does with a card.
//
// The kit picks Cowboy positions only (the human plays the Cowboy). It does not
// print the Wizard's deck order or trap position, which are hidden in play.
import { SIDES } from "../../src/game/cards.js";
import { MAX_ROUNDS, OPENING_HAND, TRAP_RULES_VERSION, createMatch } from "../../src/game/state.js";
import { SPELL_IDS, deckTrapId, openingFor } from "../trap-placeholder/scenarios.js";

export const KIT_VERSION = "trap-playtest-kit-120-v1";
// Seeds 0..SCAN_LIMIT-1 are scanned, in ascending order. Never more.
export const SCAN_LIMIT = 10000;
export const SIDE = "cowboy";
// T1 keeps spell copy 1 and relabels copy 2 to the synthetic trap.
export const T1_SPELL_ID = SPELL_IDS[SIDE][0];
export const T1_TRAP_ID = deckTrapId(SIDE, 2);
const T1_RELABEL = Object.freeze(Object.fromEntries(SIDES.map((side) => [SPELL_IDS[side][1], deckTrapId(side, 2)])));
const T2_RELABEL = Object.freeze(
  Object.fromEntries(SIDES.flatMap((side) => SPELL_IDS[side].map((id, i) => [id, deckTrapId(side, i + 1)]))),
);
const T2_TRAP_IDS = [deckTrapId(SIDE, 1), deckTrapId(SIDE, 2)];

// Round whose start puts position p in hand (1 = dealt in the opening four).
export const roundForPosition = (position) => (position < OPENING_HAND ? 1 : position - OPENING_HAND + 2);
const inOpener = (position) => position < OPENING_HAND;

// Shuffled 12-card order of one side: hand then deck, index 0 is the top.
export const orderOf = (state, side) => [...state.sides[side].hand, ...state.sides[side].deck];

// Opportunity categories. Each test reads only the Cowboy T1 trap and spell
// positions. `starter` is the fixed starting side the slot is filled with,
// alternating A..F so exactly three Cowboy-start and three Wizard-start seeds
// are picked. Categories C and D overlap (trap at 6 with the spell in the
// opener); a seed's full match list is reported as `matches`.
export const CATEGORIES = Object.freeze(
  [
    {
      id: "A",
      starter: "cowboy",
      rule: "trap and spell both at 0-3",
      meaning: "trap and remaining spell both in the opening four: a spell-or-trap choice is possible from round 1",
      test: ({ trap, spell }) => inOpener(trap) && inOpener(spell),
    },
    {
      id: "B",
      starter: "wizard",
      rule: "trap at 0-3, spell at 4-11",
      meaning: "trap in the opening four, spell not in the opener",
      test: ({ trap, spell }) => inOpener(trap) && !inOpener(spell),
    },
    {
      id: "C",
      starter: "cowboy",
      rule: "spell at 0-3, trap at 5 or 6",
      meaning: "spell in the opening four; trap first reaches hand at round 3 or 4",
      test: ({ trap, spell }) => inOpener(spell) && (trap === 5 || trap === 6),
    },
    {
      id: "D",
      starter: "wizard",
      rule: "trap at 6 or 7 (spell anywhere)",
      meaning: "trap first reaches hand at round 4 or 5; no assumption about what is still held",
      test: ({ trap }) => trap === 6 || trap === 7,
    },
    {
      id: "E",
      starter: "cowboy",
      rule: "trap at 10",
      meaning: "trap first reaches hand at round 8; set then, it arms only for the round 9 clash",
      test: ({ trap }) => trap === 10,
    },
    {
      id: "F",
      starter: "wizard",
      rule: "trap at 11",
      meaning: "trap first reaches hand at round 9, where setting is rejected (trap-too-late)",
      test: ({ trap }) => trap === 11,
    },
  ].map(Object.freeze),
);

// Same setup as BASE createMatch(seed): starting side, active side and rng
// equal, 12 cards per side, and every ID at its BASE position after `relabel`.
function assertSameSetup(seed, scenarioState, relabel) {
  const base = createMatch(seed);
  if (scenarioState.startingSide !== base.startingSide || scenarioState.activeSide !== base.activeSide || scenarioState.rng !== base.rng) {
    throw new Error(`seed ${seed}: setup differs from BASE`);
  }
  for (const side of SIDES) {
    const a = orderOf(scenarioState, side);
    const b = orderOf(base, side);
    if (a.length !== 12 || b.length !== 12) throw new Error(`seed ${seed}: ${side} deck is not 12 cards`);
    for (let i = 0; i < 12; i++) {
      if (a[i] !== (relabel[b[i]] ?? b[i])) throw new Error(`seed ${seed}: ${side} position ${i} differs from BASE`);
    }
  }
}

// Cowboy T1 trap and spell positions of one seed, after the BASE cross-check
// (the trap sits exactly where BASE has spell copy 2).
export function layoutOf(seed) {
  const t1 = openingFor(seed, "T1");
  assertSameSetup(seed, t1, T1_RELABEL);
  const order = orderOf(t1, SIDE);
  return { seed, startingSide: t1.startingSide, trap: order.indexOf(T1_TRAP_ID), spell: order.indexOf(T1_SPELL_ID) };
}

export const categoriesOf = (layout) => CATEGORIES.filter((c) => c.test(layout)).map((c) => c.id);

// Cowboy T2 trap positions of one seed, after the same BASE cross-check.
export function t2LayoutOf(seed) {
  const t2 = openingFor(seed, "T2");
  assertSameSetup(seed, t2, T2_RELABEL);
  const order = orderOf(t2, SIDE);
  return { seed, startingSide: t2.startingSide, traps: T2_TRAP_IDS.map((id) => order.indexOf(id)) };
}

// Fills A..F in order; each slot takes the lowest scanned seed that passes its
// test, starts with its fixed side and is not already picked. A slot with no
// such seed in range stays seed: null. The optional T2 example is the lowest
// seed with both Cowboy T2 traps in the opening hand. Scan bounded by `limit`.
export function pickSeeds({ limit = SCAN_LIMIT } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > SCAN_LIMIT) throw new RangeError(`limit must be 1..${SCAN_LIMIT}`);
  const layouts = [];
  for (let seed = 0; seed < limit; seed++) layouts.push(layoutOf(seed));
  const used = new Set();
  const picks = CATEGORIES.map((category) => {
    const hit = layouts.find((l) => !used.has(l.seed) && l.startingSide === category.starter && category.test(l));
    if (!hit) return { category: category.id, seed: null, starter: category.starter };
    used.add(hit.seed);
    return {
      category: category.id,
      seed: hit.seed,
      starter: category.starter,
      startingSide: hit.startingSide,
      trap: hit.trap,
      spell: hit.spell,
      trapRound: roundForPosition(hit.trap),
      spellRound: roundForPosition(hit.spell),
      matches: categoriesOf(hit),
    };
  });
  let t2 = null;
  for (let seed = 0; seed < limit && !t2; seed++) {
    const l = t2LayoutOf(seed);
    if (l.traps.every(inOpener)) t2 = l;
  }
  return { version: KIT_VERSION, rulesVersion: TRAP_RULES_VERSION, limit, picks, t2 };
}

const roundText = (round) => (round === 1 ? "opening hand" : `round ${round}`);
const sideName = (side) => (side === "cowboy" ? "Cowboy" : "Wizard");

// Markdown plan. Deterministic text: no date, time, path or environment detail.
export function renderPlan({ version, rulesVersion, limit, picks, t2 }) {
  const lines = [
    "# T1 trap playtest seed plan (issue #120)",
    "",
    "Generated by `node experiments/trap-playtest-kit/run.mjs`. Do not edit by hand.",
    "",
    `Kit \`${version}\`, rules \`${rulesVersion}\`, scenario T1 of the local trap placeholder lab, seeds 0-${limit - 1} scanned.`,
    "Synthetic developer placeholder only. This plan approves no trap card name, copy count, deck, art or balance, and no match was played to make it.",
    "",
    "## Positions and rounds",
    "",
    `Position is the index in the Cowboy's shuffled 12-card T1 deck. Positions 0-3 are the opening hand. Position p (4-11) is drawn at the start of round p - 2, but only if the match is still going then (${MAX_ROUNDS} rounds at most). A position is not an observed draw.`,
    "",
    "## Algorithm",
    "",
    '1. For each seed from 0 upward, build `openingFor(seed, "T1")` and `createMatch(seed)`. Require the same starting side and rng, 12 cards per side, and every ID at its BASE position (the trap where BASE has spell copy 2).',
    "2. Fill categories A to F in order. Each takes the lowest seed that passes its rule, starts with its fixed side (A, C, E: Cowboy; B, D, F: Wizard) and is not already picked.",
    "3. Separately, the optional T2 example is the lowest seed with both Cowboy T2 traps at positions 0-3.",
    "",
    "## Six T1 seeds",
    "",
    "| Cat | Seed | First side | Cowboy trap position (in hand from) | Cowboy spell position (in hand from) | Opportunity | Rule | Also matches |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const p of picks) {
    const c = CATEGORIES.find((x) => x.id === p.category);
    if (p.seed === null) {
      lines.push(`| ${c.id} | none in range | ${sideName(p.starter)} | - | - | ${c.meaning} | ${c.rule} | - |`);
      continue;
    }
    const also = p.matches.filter((id) => id !== c.id).join(", ") || "-";
    lines.push(
      `| ${c.id} | ${p.seed} | ${sideName(p.startingSide)} | ${p.trap} (${roundText(p.trapRound)}) | ${p.spell} (${roundText(p.spellRound)}) | ${c.meaning} | ${c.rule} | ${also} |`,
    );
  }
  lines.push(
    "",
    "## Optional T2 example (not one of the six)",
    "",
    t2
      ? `Seed ${t2.seed}, ${sideName(t2.startingSide)} first, scenario T2: both Cowboy synthetic traps at positions ${t2.traps.join(" and ")} (opening hand) and no spell. A side has one trap zone, so this is a duplicate-trap saturation example, not a spell-or-trap choice.`
      : `No seed in 0-${limit - 1} has both Cowboy T2 traps in the opening hand.`,
    "",
    "## Reading the categories",
    "",
    "- A choice opportunity means a spell and a trap could both compete for the shared cast allowance. Whether a player notices or takes that choice is known only after a human plays.",
    "- B, C and D depend on what the player has already played; the plan assumes nothing about plays before the trap arrives.",
    "- E and F need the match to reach round 8 or 9. A match can end earlier, so the late trap may never be drawn.",
    "- Only the Cowboy's trap and spell positions are listed. The Wizard's deck order stays hidden.",
    "",
    "Run each seed in the lab as described in [README.md](README.md). This plan holds no human observations or results.",
    "",
  );
  return lines.join("\n");
}
