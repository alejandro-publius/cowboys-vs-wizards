// Matched-seed 12-card deck replacement simulation for anonymous fixture traps
// (issue #114, follow-up to the #87 draw odds). Test-only analysis: CARDS and
// DECKS stay as shipped, and no trap card exists outside this file.
//
// Scenarios, the same for both factions:
//   BASE  shipped 6 free / 3 mid / 1 legendary / 2 spells, createMatch(seed), traps off.
//   T1    createMatch(seed, { traps: true }), then spell copy 2 is relabelled to
//         an anonymous fixture trap wherever it sits in the shuffled hand or deck.
//         One real spell remains.
//   T2    as T1, with both spell copies relabelled. No real spell remains.
// Relabelling happens after the shuffle, so the RNG, the starting side and the
// position of every other ID are those of BASE for the same seed (Fisher-Yates
// moves positions, not labels; see experiments/trap-deck-odds/sample.js).
// No card is added: every side holds exactly its 12 shuffled IDs.
//
// Every action comes from a shipped CPU level on its own public view, is
// checked against legalActions and is applied by applyAction. The fixture
// catalog reaches only legalActions, applyAction and the CPU chooser through
// `{ cards: TEST_CARDS }`. Each step checks the invariants listed at
// `checkStep`. Pure: no clock, no random source, no filesystem.
import { createHash } from "node:crypto";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { BASE_ORBS, MAX_ROUNDS, createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicEvents, publicState } from "../../src/game/view.js";
import { cpuFor } from "../../src/game/cpu.js";
import { resultAfterClash } from "../../src/game/clash.js";

// Nine rounds, two sides, at most summon + one tactical action + end-phase.
export const MAX_STEPS = MAX_ROUNDS * SIDES.length * 3;
export const SCENARIOS = Object.freeze(["BASE", "T1", "T2"]);
export const SIM_VERSION = "trap-deck-sim-114-v1";

// Shipped spell copies per side, in catalog order (copy 1, copy 2).
export const SPELL_IDS = Object.freeze(
  Object.fromEntries(SIDES.map((side) => [side, Object.freeze(DECKS[side].filter((id) => CARDS[id].kind === "spell"))])),
);
export const fixtureTrapId = (side, copy) => `test-fixture-deck-trap-${side}-${copy}`;

// Spell ID -> fixture trap ID for a scenario. T1 takes the last copy, as in
// the #87 sample; T2 takes both.
export function relabelMap(scenario) {
  const copies = { BASE: 0, T1: 1, T2: 2 }[scenario];
  if (copies === undefined) throw new RangeError(`unknown scenario ${scenario}`);
  const map = {};
  for (const side of SIDES) {
    const spells = SPELL_IDS[side];
    for (let i = spells.length - copies; i < spells.length; i++) map[spells[i]] = fixtureTrapId(side, i + 1);
  }
  return map;
}

const FIXTURE = Object.fromEntries(
  SIDES.flatMap((side) =>
    SPELL_IDS[side].map((_, i) => {
      const id = fixtureTrapId(side, i + 1);
      return [id, Object.freeze({ id, side, kind: "trap", name: "Test fixture trap (anonymous)" })];
    }),
  ),
);
export const FIXTURE_IDS = Object.freeze(Object.keys(FIXTURE));
export const TEST_CARDS = Object.freeze({ ...CARDS, ...FIXTURE });
const OPT = Object.freeze({ cards: TEST_CARDS });
const isTrap = (id) => TEST_CARDS[id]?.kind === "trap";
const isSpell = (id) => TEST_CARDS[id]?.kind === "spell";

// Opening state for a seed and scenario.
export function openingFor(seed, scenario) {
  if (scenario === "BASE") return createMatch(seed);
  const map = relabelMap(scenario);
  const state = structuredClone(createMatch(seed, { traps: true }));
  for (const side of SIDES) {
    const own = state.sides[side];
    own.hand = own.hand.map((id) => map[id] ?? id);
    own.deck = own.deck.map((id) => map[id] ?? id);
  }
  return state;
}

// Every card ID a side holds anywhere, sorted, so multiplicity is compared.
export function holdings(state, side) {
  const own = state.sides[side];
  return [
    ...own.deck,
    ...own.hand,
    ...own.board.filter(Boolean).map((troop) => troop.cardId),
    ...(own.trap ? [own.trap.cardId] : []),
    ...own.discard,
  ].sort();
}

const fail = (label, message) => {
  throw new Error(`${label}: ${message}`);
};

// Invariants after one accepted action (`prev` -> `next`, `events`):
//   card conservation by exact ID multiplicity, 12 per side;
//   orbs in 0..BASE_ORBS, troop health in 1..printed health, round <= 9;
//   a set-trap only before round 9, a trigger only for a trap set in an earlier round;
//   no hidden ID (hand, deck, own trap zone) in the opponent's view or events.
function checkStep(label, prev, next, events, start) {
  for (const side of SIDES) {
    const held = holdings(next, side);
    if (held.length !== 12 || JSON.stringify(held) !== JSON.stringify(start[side])) fail(label, `${side} card conservation broken`);
    const own = next.sides[side];
    if (!(own.baseOrbs >= 0 && own.baseOrbs <= BASE_ORBS)) fail(label, `${side} orbs out of bounds`);
    for (const troop of own.board) {
      if (troop && !(troop.health >= 1 && troop.health <= CARDS[troop.cardId].health)) fail(label, `${side} troop health out of bounds`);
    }
  }
  if (next.round > MAX_ROUNDS) fail(label, "round beyond the limit");
  for (const event of events) {
    if (event.type === "trap-set" && prev.round >= MAX_ROUNDS) fail(label, "trap set in the last round");
    if (event.type === "trap-trigger") {
      const zone = prev.sides[event.side].trap;
      if (!zone || zone.cardId !== event.cardId || !(zone.setRound < prev.round)) fail(label, "trap triggered in its set round or from nowhere");
    }
  }
  for (const side of SIDES) {
    const own = next.sides[side];
    const hidden = [...own.hand, ...own.deck, ...(own.trap ? [own.trap.cardId] : [])];
    const viewer = opponent(side);
    const seen = JSON.stringify(publicState(next, viewer)) + JSON.stringify(publicEvents(events, viewer));
    for (const id of hidden) if (seen.includes(`"${id}"`)) fail(label, `${side} hidden card ${id} visible to ${viewer}`);
  }
}

const key = (action) => JSON.stringify(action);

// Plays one match. `levels` maps side -> CPU level. Returns the trace, the
// result, a digest of actions/events/result and per-side metrics read only
// from events and the owner's known state.
export function playMatch(seed, scenario, levels) {
  const opening = openingFor(seed, scenario);
  let state = opening;
  const start = Object.fromEntries(SIDES.map((side) => [side, holdings(state, side)]));
  const trace = [];
  const metrics = Object.fromEntries(
    SIDES.map((side) => [
      side,
      {
        cards: start[side].length,
        spellsInDeck: start[side].filter(isSpell).length,
        trapsInDeck: start[side].filter(isTrap).length,
        actions: 0,
        casts: 0,
        trapFirstSeen: null, // round a trap first stood in the owner's hand
        trapPlaced: [], // rounds of trap-set events
        trapTriggered: [], // clash rounds of trap-trigger events
        heldWithFullZone: 0, // own phases starting with a trap in hand and the zone occupied
        spellAndTrapPhases: 0, // own phases starting with both a spell and a trap in hand
        round9TrapInHand: false, // a trap in hand at the start of its round-9 phase (set rejected)
      },
    ]),
  );
  const noteSeen = (s) => {
    for (const side of SIDES) {
      if (metrics[side].trapFirstSeen === null && s.sides[side].hand.some(isTrap)) metrics[side].trapFirstSeen = s.round;
    }
  };
  const phases = new Set();
  noteSeen(state);
  while (!state.result) {
    if (trace.length >= MAX_STEPS) fail(`seed ${seed} ${scenario}`, `no result after ${MAX_STEPS} actions`);
    const { activeSide: side, round } = state;
    const label = `seed ${seed} ${scenario} round ${round} ${side}`;
    const own = state.sides[side];
    if (!phases.has(`${round}:${side}`)) {
      phases.add(`${round}:${side}`);
      const trapInHand = own.hand.some(isTrap);
      if (trapInHand && own.trap) metrics[side].heldWithFullZone++;
      if (trapInHand && own.hand.some(isSpell)) metrics[side].spellAndTrapPhases++;
      if (trapInHand && round === MAX_ROUNDS) metrics[side].round9TrapInHand = true;
    }
    const action = cpuFor(levels[side])(publicState(state, side), OPT);
    if (!legalActions(state, side, OPT).some((legal) => key(legal) === key(action))) fail(label, `illegal choice ${key(action)}`);
    const applied = applyAction(state, action, OPT);
    if (!applied.ok) fail(label, `rejected ${applied.reason}`);
    checkStep(label, state, applied.state, applied.events, start);
    metrics[side].actions++;
    for (const event of applied.events) {
      if (event.type === "spell") metrics[event.caster].casts++;
      if (event.type === "trap-set") metrics[event.side].trapPlaced.push(round);
      if (event.type === "trap-trigger") metrics[event.side].trapTriggered.push(round);
    }
    trace.push({ round, side, action, events: applied.events });
    state = applied.state;
    noteSeen(state);
  }
  if (key(resultAfterClash(state)) !== key(state.result)) fail(`seed ${seed} ${scenario}`, "result does not match the final board");
  const digest = createHash("sha256").update(JSON.stringify({ trace, result: state.result })).digest("hex");
  return { seed, scenario, levels, startingSide: opening.startingSide, result: state.result, final: state, trace, digest, metrics };
}

// Cowboy score for one result: win 1, draw 0.5, loss 0.
export const cowboyScore = (result) => (result.winner === "cowboy" ? 1 : result.winner === null ? 0.5 : 0);

// Summary of matches for one scenario and level pair.
export function summarize(matches) {
  const n = matches.length;
  const count = (f) => matches.filter(f).length;
  const sum = (f) => matches.reduce((total, x) => total + f(x), 0);
  const perSide = Object.fromEntries(
    SIDES.map((side) => {
      const ms = matches.map((x) => x.metrics[side]);
      const firstSeenHist = Array(MAX_ROUNDS + 1).fill(0); // index 0: no trap seen before the match ended
      for (const x of ms) if (x.trapsInDeck > 0) firstSeenHist[x.trapFirstSeen ?? 0]++;
      return [
        side,
        {
          starts: count((x) => x.startingSide === side),
          wins: count((x) => x.result.winner === side),
          winsWhenStarting: count((x) => x.startingSide === side && x.result.winner === side),
          actions: sum((x) => x.metrics[side].actions),
          casts: sum((x) => x.metrics[side].casts),
          spellsInDeck: [...new Set(ms.map((x) => x.spellsInDeck))],
          trapsInDeck: [...new Set(ms.map((x) => x.trapsInDeck))],
          spellRoleRemoved: ms.every((x) => x.spellsInDeck === 0),
          trapFirstSeenHist: firstSeenHist,
          trapPlaced: sum((x) => x.metrics[side].trapPlaced.length),
          matchesWithPlacement: count((x) => x.metrics[side].trapPlaced.length > 0),
          trapTriggered: sum((x) => x.metrics[side].trapTriggered.length),
          matchesWithTrigger: count((x) => x.metrics[side].trapTriggered.length > 0),
          heldWithFullZonePhases: sum((x) => x.metrics[side].heldWithFullZone),
          matchesHeldWithFullZone: count((x) => x.metrics[side].heldWithFullZone > 0),
          spellAndTrapPhases: sum((x) => x.metrics[side].spellAndTrapPhases),
          matchesRound9TrapInHand: count((x) => x.metrics[side].round9TrapInHand),
        },
      ];
    }),
  );
  const completionRoundHist = Array(MAX_ROUNDS + 1).fill(0);
  for (const x of matches) completionRoundHist[x.result.round]++;
  return {
    n,
    draws: count((x) => x.result.winner === null),
    startingSideWins: count((x) => x.result.winner === x.startingSide),
    baseDestroyed: count((x) => x.result.reason === "base-destroyed"),
    roundLimit: count((x) => x.result.reason === "round-limit"),
    completionRoundHist,
    meanCompletionRound: sum((x) => x.result.round) / n,
    actions: sum((x) => x.trace.length),
    cowboyShare: sum((x) => cowboyScore(x.result)) / n,
    perSide,
  };
}

// Paired delta of the Cowboy score (win 1, draw 0.5, loss 0) against BASE on
// the same seeds and levels. Interval: mean +- 1.96 * sd / sqrt(n), a normal
// approximation that treats the seeds as independent draws of the shuffle.
// The Wizard delta is the negative of this one.
export function pairedDelta(base, other) {
  if (base.length !== other.length) throw new RangeError("unpaired lists");
  const d = base.map((b, i) => {
    if (b.seed !== other[i].seed) throw new RangeError("seeds not paired");
    return cowboyScore(other[i].result) - cowboyScore(b.result);
  });
  const n = d.length;
  const mean = d.reduce((t, x) => t + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(d.reduce((t, x) => t + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const half = (1.96 * sd) / Math.sqrt(n);
  return { n, mean, low: mean - half, high: mean + half, changedResults: d.filter((x) => x !== 0).length };
}

// All matches for a list of seeds, one scenario and one level on both sides.
export function runConfig(seeds, scenario, level) {
  return seeds.map((seed) => playMatch(seed, scenario, { cowboy: level, wizard: level }));
}
