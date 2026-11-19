// How often three kinds of player win each duel on the first try (no grit), from the first
// Trail duel to the even match. The player is a bot on the deck the Trail gives:
// level 0 takes any legal action, 1 the best single action, 2 plans the turn.
//   node prototypes/showdown/trail-sim.mjs [deals=300] [only duels whose label contains this]
import {createShowdown, playTurn} from "./rules.js";
import {BOUNTIES, HUNTS, RIVALS, duelFor, newSave, settle} from "./progress.js";
import {TRAIL} from "./trail.js";

// A save with this much done, always on the deck the Trail's own rewards build.
export function saveAt({wins = TRAIL.length, rivals = 0, hunts = {}, losses = {}} = {}) {
  let save = newSave();
  for (let i = 0; i < wins; i++) save = settle(save, "trail", true).save;
  return {...save, rivals: RIVALS.slice(0, rivals).map((rival) => rival.id), hunts, losses, offer: null};
}

export function winRate(save, id, playerLevel, deals) {
  const duel = duelFor(save, id);
  let won = 0;
  for (let seed = 0; seed < deals; seed++) {
    let state = createShowdown(seed, duel.options);
    while (!state.result) state = playTurn(state, state.active === "cowboy" ? playerLevel : duel.level).state;
    if (state.result.winner === "cowboy") won += 1;
  }
  return won / deals;
}

// Every duel in the order a player meets it: [label, save, duel id].
export const LADDER = [
  ...TRAIL.map((duel, wins) => [`Trail ${wins + 1}. ${duel.name}`, saveAt({wins}), "trail"]),
  ...RIVALS.map((rival, i) => [`Rival ${i + 1}. ${rival.name}`, saveAt({rivals: i}), `rival:${rival.id}`]),
  ...BOUNTIES.flatMap((bounty) => Array.from({length: HUNTS}, (_, n) => [`${bounty.name}, hunt ${n + 1}`, saveAt({hunts: {[bounty.id]: n}}), `hunt:${bounty.id}`])),
  ["Open range (the even match)", saveAt(), "open"],
];

if (import.meta.main) {
  const deals = Number(process.argv[2] ?? 300);
  const pct = (rate) => `${(100 * rate).toFixed(0)}%`.padStart(8);
  console.log(`${"duel".padEnd(36)}careless  simple careful`);
  const only = process.argv[3];
  for (const [label, save, id] of LADDER) if (!only || label.includes(only)) console.log(`${label.padEnd(36)}${[0, 1, 2].map((level) => pct(winRate(save, id, level, deals))).join("")}`);
}
