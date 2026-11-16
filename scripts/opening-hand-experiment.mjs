// Opening-hand balance experiment: the current rules against one variant in
// which each side's opening four cards hold at least one free-summon troop.
// The variant exists only in this file; the engine and RULES_VERSION are
// unchanged. Every seeded deal is played four times: both variants, each with
// the cowboy and then the wizard acting first in round 1. Usage:
//   node scripts/opening-hand-experiment.mjs [--out <directory>]
// With --out it writes report.json and traces.txt there.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CARDS, SIDES, tributeCost } from "../src/game/cards.js";
import { createMatch, RULES_VERSION } from "../src/game/state.js";
import { makeBot, playMatch, traceLines } from "./play-match.mjs";

const SEEDS = 1000; // seeds 0-999
const TRACE_SEEDS = [14, 27, 47];
const KINDS = { cowboy: "cpu", wizard: "cpu" };
const VARIANTS = ["current", "guaranteed"];

const isFree = (id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0;
const hasFree = (hand) => hand.some(isFree);

// The variant. A side dealt no free-summon troop swaps its fourth card with
// the free-summon troop nearest the top of its deck; the swapped-out card
// takes that troop's place in the deck. Every other card stays where the seed
// put it, so a deal that already qualifies is returned untouched.
export function guaranteeFreeSummon(opening) {
  if (SIDES.every((side) => hasFree(opening.sides[side].hand))) return opening;
  const sides = {};
  for (const side of SIDES) {
    const { hand, deck } = opening.sides[side];
    const at = deck.findIndex(isFree);
    sides[side] = hasFree(hand) ? opening.sides[side] : { ...opening.sides[side], hand: [...hand.slice(0, -1), deck[at]], deck: deck.with(at, hand.at(-1)) };
  }
  return { ...opening, sides };
}

// The same deal with `side` acting first in round 1.
const withStarter = (opening, side) => ({ ...opening, startingSide: side, activeSide: side });

const winCounts = () => ({ cowboy: 0, wizard: 0, draw: 0 });
const newTally = () => ({ matches: 0, wins: winCounts(), byStartingSide: { cowboy: winCounts(), wizard: winCounts() }, actedFirstWins: 0, actedSecondWins: 0, endings: {}, rounds: 0, actions: 0 });
const newOutcomes = () => ({ wins: 0, losses: 0, draws: 0 });

function record(tally, starter, winner, state, log) {
  tally.matches += 1;
  tally.wins[winner] += 1;
  tally.byStartingSide[starter][winner] += 1;
  if (winner !== "draw") tally[winner === starter ? "actedFirstWins" : "actedSecondWins"] += 1;
  tally.endings[state.result.reason] = (tally.endings[state.result.reason] ?? 0) + 1;
  tally.rounds += state.result.round;
  tally.actions += log.length;
}

function finish({ rounds, actions, ...tally }) {
  const mean = (sum) => (tally.matches ? Number((sum / tally.matches).toFixed(2)) : null);
  return { ...tally, meanRounds: mean(rounds), meanActions: mean(actions) };
}

export function experiment(seeds = SEEDS) {
  const bots = Object.fromEntries(SIDES.map((side) => [side, makeBot(KINDS[side], 0, side)]));
  const each = (make) => Object.fromEntries(VARIANTS.map((variant) => [variant, make()]));
  const all = each(newTally);
  // Only the deals the variant changes: at least one side was dealt no free summon.
  const changedDeals = each(newTally);
  // Results for a side that was dealt no free summon, in those same matches.
  const shortSide = each(() => ({ actedFirst: newOutcomes(), actedSecond: newOutcomes() }));
  const noFree = each(() => ({ cowboy: 0, wizard: 0, eitherSide: 0, bothSides: 0 }));
  // Current rules with the starting side the seed picked: must match the earlier cpu-vs-cpu report.
  const seededStart = winCounts();
  let winnerChanged = 0;

  for (let seed = 0; seed < seeds; seed++) {
    const dealt = createMatch(seed);
    const deals = { current: dealt, guaranteed: guaranteeFreeSummon(dealt) };
    const short = SIDES.filter((side) => !hasFree(dealt.sides[side].hand));
    assert.deepEqual(withStarter(dealt, dealt.startingSide), dealt);
    assert.equal(deals.guaranteed === dealt, short.length === 0, `seed ${seed}: variant changed the wrong deals`);
    for (const side of SIDES) {
      const cards = ({ hand, deck }) => [...hand, ...deck].sort();
      assert.deepEqual(cards(deals.guaranteed.sides[side]), cards(dealt.sides[side]), `seed ${seed}: variant changed the ${side} card set`);
    }
    for (const variant of VARIANTS) {
      const lacking = SIDES.filter((side) => !hasFree(deals[variant].sides[side].hand));
      for (const side of lacking) noFree[variant][side] += 1;
      if (lacking.length > 0) noFree[variant].eitherSide += 1;
      if (lacking.length === SIDES.length) noFree[variant].bothSides += 1;
    }

    for (const starter of SIDES) {
      const winners = {};
      for (const variant of VARIANTS) {
        const { state, log } = playMatch(seed, bots, withStarter(deals[variant], starter));
        const winner = state.result.winner ?? "draw";
        winners[variant] = winner;
        record(all[variant], starter, winner, state, log);
        if (short.length > 0) record(changedDeals[variant], starter, winner, state, log);
        for (const side of short) shortSide[variant][side === starter ? "actedFirst" : "actedSecond"][winner === "draw" ? "draws" : winner === side ? "wins" : "losses"] += 1;
        if (variant === "current" && starter === dealt.startingSide) seededStart[winner] += 1;
      }
      if (winners.current !== winners.guaranteed) winnerChanged += 1;
    }
  }
  assert.equal(noFree.guaranteed.eitherSide, 0, "variant left a hand with no free summon");

  const finishEach = (tallies) => Object.fromEntries(VARIANTS.map((variant) => [variant, finish(tallies[variant])]));
  return {
    rulesVersion: RULES_VERSION,
    seeds: { from: 0, to: seeds - 1, deals: seeds },
    bots: KINDS,
    variants: {
      current: "the deal createMatch(seed) produces",
      guaranteed: "a side dealt no free-summon troop swaps its fourth card with the free-summon troop nearest the top of its deck",
    },
    // Deals, out of `seeds.deals`, in which a side was dealt no free-summon troop.
    dealsWithoutFreeSummon: noFree,
    // Every deal, played with each side acting first: 2 x deals matches per variant.
    allMatches: finishEach(all),
    changedDeals: finishEach(changedDeals),
    sideDealtNoFreeSummon: shortSide,
    matchesWithDifferentWinner: winnerChanged,
    currentRulesSeededStart: seededStart,
  };
}

function summaryLines(report) {
  const { seeds, dealsWithoutFreeSummon: noFree } = report;
  const tallyLines = (label, tally) => [
    `${label} (${tally.matches} matches): cowboy ${tally.wins.cowboy}, wizard ${tally.wins.wizard}, draws ${tally.wins.draw}`,
    ...SIDES.map((side) => `  ${side} starts: cowboy ${tally.byStartingSide[side].cowboy}, wizard ${tally.byStartingSide[side].wizard}, draws ${tally.byStartingSide[side].draw}`),
    `  acted first in round 1 won ${tally.actedFirstWins}, acted second won ${tally.actedSecondWins}; endings ${JSON.stringify(tally.endings)}`,
    `  mean length: ${tally.meanRounds} rounds, ${tally.meanActions} actions`,
  ];
  const outcome = ({ wins, losses, draws }) => `won ${wins}, lost ${losses}, drew ${draws}`;
  return [
    `seeds ${seeds.from}-${seeds.to} (${seeds.deals} deals, each played with either side starting)  rules ${report.rulesVersion}  cowboy=${report.bots.cowboy} wizard=${report.bots.wizard}`,
    ...VARIANTS.map((variant) => `deals with no free summon, ${variant}: cowboy ${noFree[variant].cowboy}, wizard ${noFree[variant].wizard}, either side ${noFree[variant].eitherSide}, both sides ${noFree[variant].bothSides}`),
    ...VARIANTS.flatMap((variant) => tallyLines(`all deals, ${variant}`, report.allMatches[variant])),
    ...VARIANTS.flatMap((variant) => tallyLines(`changed deals only, ${variant}`, report.changedDeals[variant])),
    ...VARIANTS.flatMap((variant) =>
      Object.entries(report.sideDealtNoFreeSummon[variant]).map(([role, each]) => `side dealt no free summon, ${variant}, ${role}: ${outcome(each)}`),
    ),
    `matches whose winner differs between the variants: ${report.matchesWithDifferentWinner}`,
    `current rules, seeded starting side: cowboy ${report.currentRulesSeededStart.cowboy}, wizard ${report.currentRulesSeededStart.wizard}, draws ${report.currentRulesSeededStart.draw}`,
  ];
}

function traceText() {
  const lines = [];
  for (const seed of TRACE_SEEDS) {
    const dealt = createMatch(seed);
    const guaranteed = guaranteeFreeSummon(dealt);
    for (const starter of SIDES) {
      lines.push(`== seed ${seed}, ${starter} starts, current rules ==`, ...traceLines(seed, KINDS, withStarter(dealt, starter)), "");
      if (guaranteed === dealt) lines.push(`== seed ${seed}, ${starter} starts, guaranteed free summon: both hands already hold one, so the match is the same ==`, "");
      else lines.push(`== seed ${seed}, ${starter} starts, guaranteed free summon ==`, ...traceLines(seed, KINDS, withStarter(guaranteed, starter)), "");
    }
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { out: { type: "string" } } });
  const report = experiment();
  console.log(summaryLines(report).join("\n"));
  if (values.out) {
    mkdirSync(values.out, { recursive: true });
    writeFileSync(join(values.out, "report.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(values.out, "traces.txt"), traceText());
    console.log(`report.json and traces.txt written to ${values.out}`);
  }
}
