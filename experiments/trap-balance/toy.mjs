// Bounded toy scenarios: one clash, hand-built boards, exact numbers (no sampling).
// Usage: node experiments/trap-balance/toy.mjs   (prints a markdown table; used in the evidence note)
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { shadowClash } from "./shadow.js";

const troop = (cardId) => ({ cardId, health: CARDS[cardId].health });
function run({ cowboy, wizard, round = 4, zones, effect }) {
  const state = createMatch(0);
  state.round = round;
  state.sides.cowboy.board = cowboy.map((id) => (id ? troop(id) : null));
  state.sides.wizard.board = wizard.map((id) => (id ? troop(id) : null));
  const z = structuredClone(zones);
  const out = shadowClash(state, z, effect);
  const lost = (kind) => out.events.filter((e) => e.type === "damage" && e.target.side === "cowboy" && e.target.kind === kind).reduce((sum, e) => sum + e.before - e.after, 0);
  return { triggers: out.triggers.length, cowboyBaseLoss: lost("base"), cowboyTroopLoss: lost("troop"), zonesLeft: Object.entries(z).filter(([, v]) => v).map(([k]) => k).join("+") || "none" };
}
const S = "cowboy-sheriff-1", B = "cowboy-billy-1", M = "cowboy-mounted-billy-1";
const sk = "wizard-skeleton-1", W = "wizard-wizard-1", D = "wizard-dragon-1";
const armedCowboy = { cowboy: { cardId: "t", setRound: 1 }, wizard: null };
const armedBoth = { cowboy: { cardId: "tc", setRound: 1 }, wizard: { cardId: "tw", setRound: 1 } };
const cases = [
  ["Cowboy trap vs lone attack-1 troop (lane 0, no blocker)", { cowboy: [null, null, null], wizard: [sk, null, null], zones: armedCowboy }],
  ["Cowboy trap vs lone attack-2 troop", { cowboy: [null, null, null], wizard: [W, null, null], zones: armedCowboy }],
  ["Cowboy trap vs lone attack-3 troop", { cowboy: [null, null, null], wizard: [D, null, null], zones: armedCowboy }],
  ["Cowboy trap vs 1+2+3 attackers (targets the 3)", { cowboy: [null, null, null], wizard: [sk, W, D], zones: armedCowboy }],
  ["Same, but Cowboy blockers in all lanes (damage lands on troops)", { cowboy: [S, S, S], wizard: [sk, W, D], zones: armedCowboy }],
  ["Tie: two attack-2 troops (lanes 0 and 2): lowest lane is targeted", { cowboy: [null, null, null], wizard: [W, null, W], zones: armedCowboy }],
  ["Empty enemy board: trap stays set", { cowboy: [S, null, null], wizard: [null, null, null], zones: armedCowboy }],
  ["Both traps armed, 2 vs 3 attackers (double trigger)", { cowboy: [B, M, null], wizard: [W, sk, D], zones: armedBoth }],
  ["Round 9, trap set in round 8 (last clash still fires)", { cowboy: [null, null, null], wizard: [W, null, null], zones: { cowboy: { cardId: "t", setRound: 8 }, wizard: null }, round: 9 }],
  ["Round 9, trap set in round 9 (dead set)", { cowboy: [null, null, null], wizard: [W, null, null], zones: { cowboy: { cardId: "t", setRound: 9 }, wizard: null }, round: 9 }],
];
console.log("| scenario | effect | triggers | Cowboy base orbs lost | Cowboy troop health lost | trap left set |");
console.log("|---|---|---|---|---|---|");
for (const [name, c] of cases) {
  for (const effect of ["inert", "X", "Y"]) {
    const r = run({ ...c, effect });
    console.log(`| ${name} | ${effect === "inert" ? "none (control)" : effect} | ${r.triggers} | ${r.cowboyBaseLoss} | ${r.cowboyTroopLoss} | ${r.zonesLeft} |`);
  }
}
