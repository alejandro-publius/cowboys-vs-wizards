// Paired opening-policy experiment on the released engine. Nothing in src/ is
// changed: each variant edits only the opening state returned by createMatch.
//   node scripts/compare-opening-policies.mjs --from 1000 --count 2000 --out .artifacts/fable/opening-holdout/results.json
// Every seed is played with each faction in the first seat, under every
// variant, with the same shuffles and the same CPU on both sides. Rows are
// paired by (seed, first seat). Asserts card conservation after every action
// and that the unmodified opening replays exactly as scripts/play-match.mjs.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { CARDS, DECKS, SIDES, opponent, tributeCost } from "../src/game/cards.js";
import { createMatch, RULES_VERSION } from "../src/game/state.js";
import { chooseAction } from "../src/game/cpu.js";
import { playMatch, wholeNumber } from "./play-match.mjs";

const isFree = (id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0;
const drought = (hand) => !hand.some(isFree);

// A hand with no free troop trades its last-dealt card for the topmost free
// troop in its own deck. Sizes and deck order are otherwise unchanged.
function guaranteeFree(state) {
  for (const side of SIDES) {
    const { hand, deck } = state.sides[side];
    if (!drought(hand)) continue;
    const at = deck.findIndex(isFree); // six free troops per deck, four cards dealt: always found
    [hand[hand.length - 1], deck[at]] = [deck[at], hand[hand.length - 1]];
  }
}
// The side acting second in round 1 draws the top of its deck early.
function extraCard(state) {
  const own = state.sides[opponent(state.startingSide)];
  own.hand.push(own.deck.shift());
}
export const VARIANTS = {
  shipped: () => {},
  freeOpener: guaranteeFree,
  extraCard,
  both(state) {
    guaranteeFree(state);
    extraCard(state);
  },
};

const SORTED_DECKS = Object.fromEntries(SIDES.map((side) => [side, [...DECKS[side]].sort()]));
function assertConserved(state, label) {
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const all = [...deck, ...hand, ...board.filter(Boolean).map((troop) => troop.cardId), ...discard].sort();
    assert.deepEqual(all, SORTED_DECKS[side], `${label}: ${side} cards not conserved`);
  }
}

const CPU_BOTS = { cowboy: chooseAction, wizard: chooseAction };

// Each variant starts from the same shuffled deck, with both seats measured.
export function playVariant(seed, starter, variant) {
  const opening = createMatch(seed);
  opening.startingSide = opening.activeSide = starter;
  VARIANTS[variant](opening);
  const label = `seed ${seed} ${variant}`;
  assertConserved(opening, `${label} opening`);
  const { state, log } = playMatch(seed, CPU_BOTS, opening);
  for (const [index, step] of log.entries()) {
    assertConserved(step.state, `${label} action ${index}`);
  }
  return { opening, state, actions: log.map(({ action }) => action) };
}

const names = (ids) => ids.map((id) => CARDS[id].name);
const pct = (n, of) => Number(((100 * n) / of).toFixed(2));

// How one seed's opening and CPU-vs-CPU route differ from shipped, with the seed's own first seat.
export function preservation(seed) {
  const starter = createMatch(seed).startingSide;
  const base = playVariant(seed, starter, "shipped");
  const out = { seed, firstSeat: starter };
  for (const variant of Object.keys(VARIANTS)) {
    const run = playVariant(seed, starter, variant);
    const firstDiff = run.actions.findIndex((action, i) => JSON.stringify(action) !== JSON.stringify(base.actions[i]));
    const same = firstDiff === -1 && run.actions.length === base.actions.length;
    out[variant] = {
      hands: Object.fromEntries(SIDES.map((side) => [side, names(run.opening.sides[side].hand)])),
      openingIdenticalToShipped: JSON.stringify(run.opening) === JSON.stringify(base.opening),
      actionsIdenticalToShipped: same,
      ...(!same && { firstChangedAction: firstDiff === -1 ? base.actions.length : firstDiff }),
      result: run.state.result,
    };
  }
  return out;
}

export function run({ from, count }) {
  const variants = Object.keys(VARIANTS);
  const matches = []; // raw rows: one per (seed, first seat)
  const summary = {};
  for (const variant of variants) {
    summary[variant] = {
      matches: 0,
      firstSeatWins: 0,
      secondSeatWins: 0,
      draws: 0,
      factionWins: { cowboy: 0, wizard: 0 },
      firstSeatWinsByFaction: { cowboy: 0, wizard: 0 }, // wins by that faction when it had the first seat
      rounds: 0,
      // A side-opening is one side's hand in one match (two per match).
      droughtOpenings: { firstSeat: 0, secondSeat: 0 },
      droughtOutcomes: { wins: 0, losses: 0, draws: 0 },
      noRound1Summon: { firstSeat: 0, secondSeat: 0 },
    };
  }
  let replayChecked = 0;

  for (let offset = 0; offset < count; offset++) {
    const seed = from + offset;
    const natural = createMatch(seed).startingSide;
    for (const starter of SIDES) {
      const row = { seed, firstSeat: starter, naturalFirstSeat: starter === natural, outcome: {}, rounds: {} };
      for (const variant of variants) {
        const { opening, state, actions } = playVariant(seed, starter, variant);
        if (variant === "shipped" && starter === natural) {
          // The harness must be the released game: same final state as the existing runner.
          assert.deepEqual(state, playMatch(seed, { cowboy: chooseAction, wizard: chooseAction }).state, `seed ${seed}: differs from playMatch`);
          replayChecked += 1;
        }
        const winner = state.result.winner;
        const s = summary[variant];
        s.matches += 1;
        s.rounds += state.result.round;
        if (winner === null) s.draws += 1;
        else {
          s.factionWins[winner] += 1;
          if (winner === starter) (s.firstSeatWins += 1), (s.firstSeatWinsByFaction[winner] += 1);
          else s.secondSeatWins += 1;
        }
        // Round-1 summons: the leading actions before the second end-phase.
        const summoned = new Set();
        for (let i = 0, ends = 0; ends < 2; i++) {
          if (actions[i].type === "end-phase") ends += 1;
          else if (actions[i].type === "summon") summoned.add(actions[i].side);
        }
        for (const side of SIDES) {
          const seat = side === starter ? "firstSeat" : "secondSeat";
          if (!summoned.has(side)) s.noRound1Summon[seat] += 1;
          if (!drought(opening.sides[side].hand)) continue;
          s.droughtOpenings[seat] += 1;
          s.droughtOutcomes[winner === null ? "draws" : winner === side ? "wins" : "losses"] += 1;
        }
        row.outcome[variant] = winner ?? "draw";
        row.rounds[variant] = state.result.round;
      }
      matches.push(row);
    }
  }

  for (const s of Object.values(summary)) {
    s.firstSeatWinPct = pct(s.firstSeatWins, s.matches);
    s.secondSeatWinPct = pct(s.secondSeatWins, s.matches);
    s.seatGapPoints = pct(s.firstSeatWins - s.secondSeatWins, s.matches);
    s.factionGapPoints = pct(s.factionWins.cowboy - s.factionWins.wizard, s.matches); // cowboy minus wizard
    s.drawPct = pct(s.draws, s.matches);
    s.meanRounds = Number((s.rounds / s.matches).toFixed(3));
    delete s.rounds;
  }

  // Paired differences against shipped. Scores are +1 / 0 / -1 for the first
  // seat (or for cowboy). The two matches of a seed share shuffles, so the
  // standard error treats each seed as one observation.
  const paired = {};
  const score = (outcome, side) => (outcome === "draw" ? 0 : outcome === side ? 1 : -1);
  for (const variant of variants.slice(1)) {
    const perSeed = new Map();
    let changed = 0;
    const flow = {}; // "shipped result for the first seat -> variant result"
    for (const row of matches) {
      const before = row.outcome.shipped;
      const after = row.outcome[variant];
      if (before !== after) changed += 1;
      const label = (outcome) => (outcome === "draw" ? "draw" : outcome === row.firstSeat ? "firstSeat" : "secondSeat");
      const key = `${label(before)}->${label(after)}`;
      flow[key] = (flow[key] ?? 0) + 1;
      const d = perSeed.get(row.seed) ?? { seat: 0, faction: 0, draw: 0 };
      d.seat += (score(after, row.firstSeat) - score(before, row.firstSeat)) / 2;
      d.faction += (score(after, "cowboy") - score(before, "cowboy")) / 2;
      d.draw += ((after === "draw") - (before === "draw")) / 2;
      perSeed.set(row.seed, d);
    }
    const stat = (key) => {
      const values = [...perSeed.values()].map((d) => 100 * d[key]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const se = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1) / values.length);
      return { meanPoints: Number(mean.toFixed(2)), ci95: [Number((mean - 1.96 * se).toFixed(2)), Number((mean + 1.96 * se).toFixed(2))] };
    };
    paired[variant] = {
      matchesWithChangedOutcome: changed,
      seatGapChange: stat("seat"),
      factionGapChange: stat("faction"),
      drawRateChange: stat("draw"),
      outcomeFlow: flow,
    };
  }

  return {
    rulesVersion: RULES_VERSION,
    bots: "src/game/cpu.js chooseAction on both sides",
    seeds: { from, to: from + count - 1, count },
    matchesPerVariant: matches.length,
    checks: { cardConservationAfterEveryAction: "passed", actionsAccepted: "passed", shippedRunsEqualToPlayMatch: replayChecked },
    summary,
    pairedVsShipped: paired,
    preservation: [0, 60].map(preservation),
    matches,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { from: { type: "string", default: "1000" }, count: { type: "string", default: "2000" }, out: { type: "string" } } });
  const from = wholeNumber(values.from);
  const count = wholeNumber(values.count);
  if (from === null || !count || count < 2 || count > 10000 || !Number.isSafeInteger(from + count - 1)) {
    console.error("usage: node scripts/compare-opening-policies.mjs [--from <integer >= 0>] [--count <2-10000>] [--out <file>]");
    process.exit(2);
  }
  const report = run({ from, count });
  if (values.out) {
    mkdirSync(path.dirname(values.out), { recursive: true });
    writeFileSync(values.out, JSON.stringify(report) + "\n");
  }
  const { matches, ...printed } = report;
  console.log(JSON.stringify(printed, null, 2));
}
