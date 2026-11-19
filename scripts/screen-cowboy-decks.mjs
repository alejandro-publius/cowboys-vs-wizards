// Compare five legal deck plans, or isolate one Mounted Billy-to-Deadeye swap.
// Use --isolate for the disjoint holdout and paired win-share interval.
// Use --candidate <path> [--from <seed>] [--count <n>] to compare one deck-count JSON file
// ({"cowboy-sheriff": 1, ...} keyed by card type) against the unchanged stock deck.
import {readFileSync} from "node:fs";
import {CARDS} from "../src/game/cards.js";
import {cpuFor} from "../src/game/cpu.js";
import {COWBOY_CATALOG, DEFAULT_COUNTS, deckIds, validateDeck} from "../src/game/deck-builder.js";
import {drought, openingDroughtRate, openingMatch} from "../src/game/opening-policy.js";
import {playMatch} from "./play-match.mjs";

const fail = (message) => {
  console.error(`screen-cowboy-decks: ${message}`);
  process.exit(1);
};
const argv = process.argv.slice(2);
const option = (name) => {
  const at = argv.indexOf(name);
  if (at < 0) return undefined;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) fail(`${name} needs a value.`);
  return value;
};
const isolate = argv.includes("--isolate");
const candidatePath = option("--candidate");
const fromText = option("--from");
const countText = option("--count");
if (candidatePath !== undefined && isolate) fail("--candidate cannot be combined with --isolate.");
if (fromText !== undefined && candidatePath === undefined) fail("--from requires --candidate.");
if (countText !== undefined && candidatePath === undefined) fail("--count requires --candidate.");
if (fromText !== undefined && !/^\d+$/.test(fromText)) fail("--from must be a nonnegative whole number.");
if (countText !== undefined && (!/^[1-9]\d*$/.test(countText) || Number(countText) > 1024)) {
  fail("--count must be a whole number between 1 and 1024.");
}

const stockCounts = [6, 3, 1, 2];
const LEGACY_TYPES = ["cowboy-sheriff", "cowboy-billy", "cowboy-mounted-billy", "cowboy-deadeye"];
const countsObject = (counts) => Object.fromEntries(LEGACY_TYPES.map((type, i) => [type, counts[i]]));

// Parse and validate before any simulation. Already-defined rewards are
// allowed here only (bountyReward: true); unknown types, fractions and bad totals are not.
function loadCandidate(path) {
  let counts;
  try {
    counts = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read candidate JSON ${path}: ${error.message}`);
  }
  const result = validateDeck(counts, {bountyReward: true});
  if (!result.ok) fail(`illegal candidate deck: ${result.error}`);
  return counts;
}

let plans;
let seeds;
if (candidatePath !== undefined) {
  seeds = {from: Number(fromText ?? 24000), count: Number(countText ?? 256)};
  if (seeds.from + seeds.count > 2 ** 32) fail("all seeds must fit in the unsigned 32-bit range.");
  const candidate = loadCandidate(candidatePath);
  plans = [["stock", DEFAULT_COUNTS], ["candidate", candidate]];
} else {
  plans = isolate ? [
    ["stock", stockCounts],
    ["swap-mounted-for-deadeye", [6, 3, 0, 3]],
  ] : [
    ["stock", stockCounts],
    ["wide-control", [6, 2, 0, 4]],
    ["tribute-heavy", [3, 5, 3, 1]],
    ["spell-heavy", [5, 1, 0, 6]],
    ["one-sheriff", [1, 3, 4, 4]],
  ];
  seeds = isolate ? {from: 24256, count: 512} : {from: 24000, count: 256};
}

const rows = [];
const paired = [];
const spellMetric = candidatePath === undefined ? "successfulDeadeyes" : "successfulSpells";
for (const cpu of ["normal", "hard"]) {
  const choose = cpuFor(cpu);
  let stock;
  for (const [name, counts] of plans) {
    const cowboyDeck = deckIds(Array.isArray(counts) ? countsObject(counts) : counts, {bountyReward: true});
    const result = {cpu, name, counts, wins: 0, losses: 0, draws: 0, noFreeTroop: 0,
      tributeSummons: 0, [spellMetric]: 0, rounds: 0, cardUses: {}};
    const winsPerSeed = [];
    for (let seed = seeds.from; seed < seeds.from + seeds.count; seed++) {
      let wins = 0;
      for (const seat of ["cowboy", "wizard"]) {
        const opening = openingMatch(seed, "shipped", seat, {cowboyDeck});
        const run = playMatch(seed, {cowboy: choose, wizard: choose}, opening);
        const {winner, round} = run.state.result;
        result[winner === "cowboy" ? "wins" : winner === "wizard" ? "losses" : "draws"]++;
        if (winner === "cowboy") wins++;
        result.rounds += round;
        if (drought(opening.sides.cowboy.hand)) result.noFreeTroop++;
        for (const {action} of run.log) {
          if (action.side !== "cowboy" || !action.cardId) continue;
          const card = CARDS[action.cardId].name;
          result.cardUses[card] = (result.cardUses[card] ?? 0) + 1;
          if (action.type === "summon" && action.tributes.length) result.tributeSummons++;
          if (action.type === "spell") result[spellMetric]++;
        }
      }
      winsPerSeed.push(wins / 2);
    }
    if (name === "stock") stock = winsPerSeed;
    else if (isolate) {
      const changes = winsPerSeed.map((value, index) => 100 * (value - stock[index]));
      const mean = changes.reduce((sum, value) => sum + value, 0) / seeds.count;
      const se = Math.sqrt(changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (seeds.count - 1) / seeds.count);
      paired.push({cpu, winShareChange: mean, ci95: [mean - 1.96 * se, mean + 1.96 * se]});
    }
    const row = {...result, exactNoFreeTroopPct: Number((openingDroughtRate(cowboyDeck) * 100).toFixed(2))};
    if (candidatePath !== undefined) {
      const matches = seeds.count * 2;
      row.meanRounds = result.rounds / matches;
      row.observedNoFreeTroopPct = Number((result.noFreeTroop / matches * 100).toFixed(2));
    }
    rows.push(row);
  }
}
console.log(JSON.stringify({catalog: COWBOY_CATALOG.map(x => x.name), seeds, matchesPerRow: seeds.count * 2, rows, paired}, null, 2));
