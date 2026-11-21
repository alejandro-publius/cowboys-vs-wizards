// Wizard preview ramp: first-attempt Wizard-seat win counts for the four track duels, bots on both seats.
// The duels are the runtime ones: createWizardPreview(...).trailDuel() at 0..3 wins, so the deck, Bases,
// opener and Cowboy bot level are exactly what the game starts. The Wizard seat is playTurn level 0
// ("careless", the same bot as prototypes/showdown/trail-sim.mjs) or level 2 ("careful").
// Bots only: nothing here measures a person.
//   node scripts/showdown-wizard-ramp.mjs [--from 0] [--count 300] [--out rows.jsonl]
// --out writes one line per duel played (seed, duel id, policy, winner, reason, turns), so any seed can be re-run with --from N --count 1.
import {writeFileSync} from "node:fs";
import {parseArgs} from "node:util";
import {createShowdown, playTurn} from "../src/game/showdown/rules.js";
import {createWizardPreview, WIZARD_TRACK} from "../src/match/showdown-wizard-campaign.js";

export const POLICIES = {careless: 0, careful: 2};

// The duel the preview opens after `wins` track wins, first attempt (no losses, so no grit).
export function firstAttempt(wins) {
  const stored = JSON.stringify({v: 1, wins, losses: 0});
  return createWizardPreview({getItem: () => stored, setItem() {}}).trailDuel();
}

export function playDuel(duel, seed, policy) {
  let state = createShowdown(seed, duel.options);
  while (!state.result) state = playTurn(state, state.active === "wizard" ? POLICIES[policy] : duel.level).state;
  return {winner: state.result.winner, reason: state.result.reason, turns: state.turn};
}

export function run({from = 0, count = 300} = {}) {
  const rows = [];
  const table = WIZARD_TRACK.map((_, wins) => {
    const duel = firstAttempt(wins);
    const line = {duel: wins + 1, id: duel.id, name: duel.name};
    for (const policy of Object.keys(POLICIES)) {
      let won = 0;
      for (let seed = from; seed < from + count; seed++) {
        const row = {seed, duel: duel.id, side: "wizard", policy, ...playDuel(duel, seed, policy)};
        rows.push(row);
        if (row.winner === "wizard") won += 1;
      }
      line[policy] = won;
    }
    return line;
  });
  return {seeds: [from, from + count - 1], of: count, table, rows};
}

if (import.meta.main) {
  const {values} = parseArgs({options: {from: {type: "string", default: "0"}, count: {type: "string", default: "300"}, out: {type: "string"}}});
  const {seeds, of, table, rows} = run({from: Number(values.from), count: Number(values.count)});
  if (values.out) writeFileSync(values.out, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  console.log(`Wizard preview, first attempt, Wizard wins of ${of} (seeds ${seeds[0]}-${seeds[1]})`);
  console.log(`${"duel".padEnd(22)}careless careful`);
  for (const {duel, name, careless, careful} of table) console.log(`${`${duel}. ${name}`.padEnd(22)}${String(careless).padStart(8)}${String(careful).padStart(8)}`);
}
