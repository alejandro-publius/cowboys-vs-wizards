// How often three kinds of player win each Trail duel, on the first try (no grit).
//   node prototypes/showdown/trail-sim.mjs [deals=400]
// The player is a bot: level 0 takes any legal action, 1 the best single action, 2 plans the turn.
import {createShowdown, playTurn} from "./rules.js";
import {TRAIL, duelOptions} from "./trail.js";

export function winRate(wins, playerLevel, deals, losses = 0) {
  const duel = TRAIL[wins];
  let won = 0;
  for (let seed = 0; seed < deals; seed++) {
    let state = createShowdown(seed, duelOptions({wins, losses}));
    while (!state.result) state = playTurn(state, state.active === "cowboy" ? playerLevel : duel?.level ?? 2).state;
    if (state.result.winner === "cowboy") won += 1;
  }
  return won / deals;
}

if (import.meta.main) {
  const deals = Number(process.argv[2] ?? 400);
  const pct = (rate) => `${(100 * rate).toFixed(0)}%`.padStart(5);
  console.log("duel               careless  simple  careful   careless after 2 losses");
  TRAIL.forEach((duel, wins) => {
    console.log(`${String(wins + 1)}. ${duel.name.padEnd(16)} ${pct(winRate(wins, 0, deals))}    ${pct(winRate(wins, 1, deals))}   ${pct(winRate(wins, 2, deals))}     ${pct(winRate(wins, 0, deals, 2))}`);
  });
  console.log(`after the Trail     ${pct(winRate(TRAIL.length, 0, deals))}    ${pct(winRate(TRAIL.length, 1, deals))}   ${pct(winRate(TRAIL.length, 2, deals))}`);
}
