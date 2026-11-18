// Compare five legal deck plans, or isolate one Mounted Billy-to-Deadeye swap.
// Use --isolate for the disjoint holdout and paired win-share interval.
import {CARDS} from "../src/game/cards.js";
import {cpuFor} from "../src/game/cpu.js";
import {COWBOY_CATALOG, deckIds} from "../src/game/deck-builder.js";
import {drought, openingDroughtRate, openingMatch} from "../src/game/opening-policy.js";
import {playMatch} from "./play-match.mjs";

const isolate = process.argv.includes("--isolate");
const plans = isolate ? [
  ["stock", [6, 3, 1, 2]],
  ["swap-mounted-for-deadeye", [6, 3, 0, 3]],
] : [
  ["stock", [6, 3, 1, 2]],
  ["wide-control", [6, 2, 0, 4]],
  ["tribute-heavy", [3, 5, 3, 1]],
  ["spell-heavy", [5, 1, 0, 6]],
  ["one-sheriff", [1, 3, 4, 4]],
];
const seeds = isolate ? {from: 24256, count: 512} : {from: 24000, count: 256};
const rows = [];
const paired = [];
for (const cpu of ["normal", "hard"]) {
  const choose = cpuFor(cpu);
  let stock;
  for (const [name, counts] of plans) {
    const cowboyDeck = deckIds(Object.fromEntries(COWBOY_CATALOG.map(({type}, i) => [type, counts[i]])));
    const result = {cpu, name, counts, wins: 0, losses: 0, draws: 0, noFreeTroop: 0,
      tributeSummons: 0, successfulDeadeyes: 0, rounds: 0, cardUses: {}};
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
          if (action.type === "spell") result.successfulDeadeyes++;
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
    rows.push({...result, exactNoFreeTroopPct: Number((openingDroughtRate(cowboyDeck) * 100).toFixed(2))});
  }
}
console.log(JSON.stringify({catalog: COWBOY_CATALOG.map(x => x.name), seeds, matchesPerRow: seeds.count * 2, rows, paired}, null, 2));
