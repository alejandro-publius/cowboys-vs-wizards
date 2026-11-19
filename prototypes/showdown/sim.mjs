// Bot-versus-bot games, each deal played twice with the first seat swapped.
//   node prototypes/showdown/sim.mjs [deals=200] [secondPlayerCards] [baseOrbs]
import {createShowdown, playTurn} from "./rules.js";

const deals = Number(process.argv[2] ?? 200);
const options = {...(process.argv[3] === undefined ? {} : {secondPlayerCards: Number(process.argv[3])}), ...(process.argv[4] === undefined ? {} : {baseOrbs: Number(process.argv[4])})};
const tally = {games: 0, firstWins: 0, cowboyWins: 0, draws: 0, turns: 0, longest: 0, reasons: {}, events: {}};
for (let seed = 0; seed < deals; seed++) {
  for (const first of ["cowboy", "wizard"]) {
    let state = createShowdown(seed, {...options, first});
    while (!state.result) {
      const played = playTurn(state);
      state = played.state;
      for (const event of played.events) tally.events[event.type] = (tally.events[event.type] ?? 0) + 1;
    }
    tally.games += 1;
    tally.turns += state.turn;
    tally.longest = Math.max(tally.longest, state.turn);
    tally.reasons[state.result.reason] = (tally.reasons[state.result.reason] ?? 0) + 1;
    if (state.result.winner === null) tally.draws += 1;
    else {
      if (state.result.winner === first) tally.firstWins += 1;
      if (state.result.winner === "cowboy") tally.cowboyWins += 1;
    }
  }
}
const pct = (n) => `${(100 * n / tally.games).toFixed(1)}%`;
console.log(`${tally.games} games: first player wins ${pct(tally.firstWins)}, Cowboys win ${pct(tally.cowboyWins)}, draws ${pct(tally.draws)}`);
console.log(`turns: ${(tally.turns / tally.games).toFixed(1)} on average, longest ${tally.longest}; ended by ${JSON.stringify(tally.reasons)}`);
console.log(`per game: ${Object.entries(tally.events).map(([type, n]) => `${type} ${(n / tally.games).toFixed(2)}`).join(", ")}`);
