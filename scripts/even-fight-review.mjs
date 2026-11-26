// Paired measurements for the optional rules on the current checkout. Both policies use the same bot.
//   node scripts/even-fight-review.mjs seats 0 1000       (repeat with start 1000 for the holdout)
//   node scripts/even-fight-review.mjs progression 0 300
import {EVEN_FIGHT_DECKS, createShowdown, playTurn} from "../src/game/showdown/rules.js";
import {duelFor} from "../src/game/showdown/progress.js";
import {LADDER} from "../prototypes/showdown/trail-sim.mjs";

const [study, from, count] = process.argv.slice(2);
const start = Number(from), deals = Number(count);
if (!["seats", "progression"].includes(study) || !/^\d+$/.test(from) || !/^\d+$/.test(count)
    || deals < 1 || start + deals > 2 ** 32) {
  console.error("Usage: node scripts/even-fight-review.mjs seats|progression START DEALS");
  process.exit(2);
}

function winner(seed, options, cowboyLevel, wizardLevel) {
  let state = createShowdown(seed, options);
  while (!state.result) state = playTurn(state, state.active === "cowboy" ? cowboyLevel : wizardLevel).state;
  return state.result.winner;
}

if (study === "seats") {
  for (const evenFight of [false, true]) {
    let cowboyWins = 0, firstWins = 0, draws = 0;
    for (let seed = start; seed < start + deals; seed++) {
      for (const first of ["cowboy", "wizard"]) {
        const won = winner(seed, {first, evenFight}, 2, 2);
        if (won === "cowboy") cowboyWins++;
        if (won === first) firstWins++;
        if (won === null) draws++;
      }
    }
    const games = 2 * deals;
    console.log(JSON.stringify({study, rules: evenFight ? "preview" : "released", start, deals, games, cowboyWins, firstWins, draws}));
    if (evenFight && deals === 1000 && [0, 1000].includes(start)
      && [cowboyWins, firstWins].some((wins) => wins * 100 < games * 45 || wins * 100 > games * 55)) process.exitCode = 1;
  }
} else {
  for (const [name, save, id] of LADDER) {
    const duel = duelFor(save, id), baseline = duel.options;
    // A hypothetical promotion changes cover throughout the ladder. Scripted decks and Bases keep their values.
    const preview = {...baseline, evenFight: true};
    if (duel.kind === "open") preview.decks = {...baseline.decks, wizard: EVEN_FIGHT_DECKS.wizard};
    for (const playerLevel of [0, 1, 2]) {
      let releasedWins = 0, previewWins = 0;
      for (let seed = start; seed < start + deals; seed++) {
        if (winner(seed, baseline, playerLevel, duel.level) === "cowboy") releasedWins++;
        if (winner(seed, preview, playerLevel, duel.level) === "cowboy") previewWins++;
      }
      console.log(JSON.stringify({study, name, playerLevel, start, deals, releasedWins, previewWins}));
      if (duel.kind === "trail" && start === 0 && deals === 300 && Math.abs(previewWins - releasedWins) > 9) process.exitCode = 1;
    }
  }
}
