// Bounded bot-against-bot simulation over a seed range. Prints a compact
// summary and, with --out, writes it as a small JSON report. Usage:
//   node scripts/simulate-matches.mjs --from 0 --count 1000 --cowboy cpu --wizard cpu [--out <file>]
// A match that does not finish within the step bound throws (non-zero exit).
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CARDS, SIDES, opponent, tributeCost } from "../src/game/cards.js";
import { RULES_VERSION } from "../src/game/state.js";
import { BOT_KINDS, MAX_STEPS, makeBot, playMatch, wholeNumber } from "./play-match.mjs";

export const MAX_COUNT = 10000;

const bump = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1;
};
const noFreeSummon = (hand) => !hand.some((id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0);

export function simulate({ from, count, cowboy, wizard }) {
  const kinds = { cowboy, wizard };
  const tally = () => ({ cowboy: 0, wizard: 0, draw: 0 });
  const wins = tally();
  const byStartingSide = { cowboy: { matches: 0, ...tally() }, wizard: { matches: 0, ...tally() } };
  const noFreeOpening = { cowboy: 0, wizard: 0, startingSide: 0 };
  // Outcomes for a side that opened with no free summon, by whether it acted first in round 1.
  const noFreeOutcome = { startingSide: { wins: 0, losses: 0, draws: 0 }, secondSide: { wins: 0, losses: 0, draws: 0 } };
  // In matches with a winner: did the winner act first or second in the final round?
  const winnerActed = { first: 0, second: 0 };
  const endings = { "base-destroyed": 0, "round-limit": 0 };
  const finalRound = {};
  const actionCounts = {};
  let actions = 0;
  // Per card name: times played, and matches in which it was played at least once.
  const played = {};
  for (const card of Object.values(CARDS)) played[card.name] = { side: card.side, kind: card.kind, plays: 0, matches: 0 };

  for (let seed = from; seed < from + count; seed++) {
    const bots = Object.fromEntries(SIDES.map((side) => [side, makeBot(kinds[side], seed, side)]));
    const { opening, state, log } = playMatch(seed, bots);
    const winner = state.result.winner ?? "draw";
    const starter = opening.startingSide;
    wins[winner] += 1;
    byStartingSide[starter].matches += 1;
    byStartingSide[starter][winner] += 1;
    for (const side of SIDES) if (noFreeSummon(opening.sides[side].hand)) noFreeOpening[side] += 1;
    if (noFreeSummon(opening.sides[starter].hand)) noFreeOpening.startingSide += 1;
    for (const [role, side] of [["startingSide", starter], ["secondSide", opponent(starter)]]) {
      if (noFreeSummon(opening.sides[side].hand)) noFreeOutcome[role][winner === "draw" ? "draws" : winner === side ? "wins" : "losses"] += 1;
    }
    // The last action of a match is the end-phase of the side acting second in that round.
    if (winner !== "draw") winnerActed[winner === log.at(-1).side ? "second" : "first"] += 1;
    endings[state.result.reason] += 1;
    bump(finalRound, state.result.round);
    bump(actionCounts, log.length);
    actions += log.length;

    const inMatch = new Set();
    for (const { events } of log) {
      const [first] = events;
      if (first.type !== "summon" && first.type !== "spell") continue;
      const card = CARDS[first.cardId].name;
      played[card].plays += 1;
      inMatch.add(card);
    }
    for (const card of inMatch) played[card].matches += 1;
  }

  const cardReport = (kind, label) =>
    Object.fromEntries(
      Object.entries(played)
        .filter(([, card]) => card.kind === kind)
        .map(([card, { side, plays, matches }]) => [card, { side, [label]: plays, matches }]),
    );
  const lengths = Object.keys(actionCounts).map(Number);
  return {
    rulesVersion: RULES_VERSION,
    seeds: { from, to: from + count - 1, matches: count },
    bots: kinds,
    stepBound: MAX_STEPS,
    results: Object.fromEntries(SIDES.map((side) => [side, { wins: wins[side], losses: wins[opponent(side)], draws: wins.draw }])),
    // Keyed by the side that acted first in round 1; values are wins per side.
    byStartingSide,
    openingHandsWithoutFreeSummon: noFreeOpening,
    outcomesWithoutFreeSummon: noFreeOutcome,
    winnerActedInFinalRound: winnerActed,
    endings,
    finalRound,
    actionsPerMatch: { min: Math.min(...lengths), max: Math.max(...lengths), mean: Number((actions / count).toFixed(2)), distribution: actionCounts },
    summons: cardReport("troop", "summons"),
    spells: cardReport("spell", "casts"),
  };
}

function summaryLines(report) {
  const { seeds, bots, results, byStartingSide, openingHandsWithoutFreeSummon: noFree, endings, actionsPerMatch } = report;
  const cards = (group, label) => Object.entries(group).map(([card, each]) => `${card} ${each[label]} (in ${each.matches} matches)`).join(", ");
  return [
    `seeds ${seeds.from}-${seeds.to} (${seeds.matches} matches)  rules ${report.rulesVersion}  cowboy=${bots.cowboy} wizard=${bots.wizard}`,
    `wins: cowboy ${results.cowboy.wins}, wizard ${results.wizard.wins}, draws ${results.cowboy.draws}`,
    ...SIDES.map((side) => {
      const each = byStartingSide[side];
      return `${side} starts (${each.matches}): cowboy ${each.cowboy}, wizard ${each.wizard}, draws ${each.draw}`;
    }),
    `opening hands with no free summon: cowboy ${noFree.cowboy}, wizard ${noFree.wizard}, starting side ${noFree.startingSide}`,
    ...Object.entries(report.outcomesWithoutFreeSummon).map(([role, each]) => `${role} opened with no free summon: won ${each.wins}, lost ${each.losses}, drew ${each.draws}`),
    `winner acted in the final round: first ${report.winnerActedInFinalRound.first}, second ${report.winnerActedInFinalRound.second}`,
    `endings: base destroyed ${endings["base-destroyed"]}, round limit ${endings["round-limit"]}`,
    `final round: ${JSON.stringify(report.finalRound)}`,
    `actions per match: min ${actionsPerMatch.min}, mean ${actionsPerMatch.mean}, max ${actionsPerMatch.max} (bound ${report.stepBound})`,
    `summons: ${cards(report.summons, "summons")}`,
    `spells: ${cards(report.spells, "casts")}`,
  ];
}

if (import.meta.main) {
  const usage = `usage: node scripts/simulate-matches.mjs [--from <integer >= 0>] [--count <1-${MAX_COUNT}>] [--cowboy ${BOT_KINDS.join("|")}] [--wizard ${BOT_KINDS.join("|")}] [--out <file>]`;
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        from: { type: "string", default: "0" },
        count: { type: "string", default: "1000" },
        cowboy: { type: "string", default: "cpu" },
        wizard: { type: "string", default: "cpu" },
        out: { type: "string" },
      },
    }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const from = wholeNumber(values.from);
  const count = wholeNumber(values.count);
  if (from === null || count === null || count < 1 || count > MAX_COUNT || !SIDES.every((side) => BOT_KINDS.includes(values[side]))) {
    console.error(usage);
    process.exit(2);
  }
  const report = simulate({ from, count, cowboy: values.cowboy, wizard: values.wizard });
  console.log(summaryLines(report).join("\n"));
  if (values.out) {
    writeFileSync(values.out, JSON.stringify(report, null, 2) + "\n");
    console.log(`report written to ${values.out}`);
  }
}
