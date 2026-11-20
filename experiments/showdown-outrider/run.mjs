#!/usr/bin/env node
// Outrider vs Sheriff on The Bone Fence, seeds 0-999 (README.md). Prints to stdout, writes nothing.
//   node experiments/showdown-outrider/run.mjs [--json]
//   node experiments/showdown-outrider/run.mjs --replay [seed]
import {experiment, replay} from "./compare.js";

const args = process.argv.slice(2);
const pct = (n, d) => (d ? `${n}/${d} (${(100 * n / d).toFixed(1)}%)` : `${n}/0`);

function board(side) {
  return side.board.map((troop, slot) => `${slot}:${troop ? `${troop.cardId}(${troop.health})${troop.attacked ? " acted" : ""}` : "-"}`).join("  ");
}

if (args[0] === "--replay") {
  const seed = args[1] === undefined ? undefined : Number(args[1]);
  const found = replay(seed);
  if (!found) {
    console.log(`Null result: no Cowboy decision point offers an Outrider a ride past troops${seed === undefined ? " in seeds 0-999" : ` on seed ${seed}`}.`);
    process.exitCode = seed === undefined ? 1 : 0;
  } else {
    const {view} = found;
    console.log(`Seed ${found.seed}, The Bone Fence, two-win deck, turn ${view.turn} (Cowboys), after ${found.prefix.length} logged actions.`);
    console.log(`Wizard Base ${view.sides.wizard.base}  board ${board(view.sides.wizard)}  hand ${view.hidden.wizardHand} cards  deck ${view.hidden.wizardDeck}`);
    console.log(`Cowboy Base ${view.sides.cowboy.base}  board ${board(view.sides.cowboy)}`);
    console.log(`Cowboy hand ${view.sides.cowboy.hand.join(", ") || "(empty)"}  deck ${view.hidden.cowboyDeck}`);
    console.log(`Ride offered: ${JSON.stringify(found.ride)}  legal: ${found.legal}  policy chose: ${JSON.stringify(found.chosen)}`);
    process.exitCode = found.legal ? 0 : 1;
  }
} else {
  const r = experiment();
  if (args.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    const p = r.primary;
    const lines = [
      `Outrider vs Sheriff, ${r.duel.name}, seeds ${r.seeds.from}-${r.seeds.to} (${p.pairs} pairs), Cowboys first, Base ${r.duel.baseOrbs.cowboy} v ${r.duel.baseOrbs.wizard}`,
      `Treatment deck ${JSON.stringify(r.treatment)}`,
      `Control deck   ${JSON.stringify(r.control)}`,
      `Card fields that differ: ${r.card.filter((f) => !f.same).map((f) => `${f.field} ${JSON.stringify(f.outrider)} vs ${JSON.stringify(f.sheriff)}`).join("; ")}`,
      "",
      "Primary (fixed-stream level-0 Wizard, public-info greedy Cowboy):",
      `  Cowboy wins  Outrider ${pct(p.winsA, p.pairs)}  Sheriff ${pct(p.winsB, p.pairs)}`,
      `  Paired results (Outrider/Sheriff): ${JSON.stringify(p.table)}`,
      `  Discordant: Outrider-only wins ${p.discordant.aOnly}, Sheriff-only wins ${p.discordant.bOnly}; games identical apart from the name ${p.identical}; step cap ${p.stepCap}`,
      `  Mean final turn  Outrider ${p.meanTurns.a.toFixed(2)}  Sheriff ${p.meanTurns.b.toFixed(2)}`,
      `  Games: Outrider drawn ${pct(p.games.drawn, p.pairs)}; could attack into troops ${pct(p.games.riderReady, p.pairs)}; ride offered ${pct(p.games.offered, p.pairs)}; Guard blocked ${pct(p.games.guardBlocked, p.pairs)}; ride taken ${pct(p.games.taken, p.pairs)}`,
      `  Decision points: ${p.points.decisions}; Outrider could attack into troops ${p.points.riderReady}; ride offered ${pct(p.points.offered, p.points.riderReady)}; Guard blocked ${pct(p.points.guardBlocked, p.points.riderReady)}; ride taken ${pct(p.points.taken, p.points.offered)} of offers`,
      `  Control arm Base attacks past troops: ${p.controlPastTroops}`,
      "",
      `Negative control, same deck twice: identical ${pct(r.negativeSame.identical, r.negativeSame.pairs)}`,
      `Negative control, Sheriff ids relabelled: identical ${pct(r.negativeRelabel.identical, r.negativeRelabel.pairs)}`,
      `Probe, Outrider deck with rides never taken vs Sheriff deck: identical ${pct(r.rideDeclined.identical, r.rideDeclined.pairs)}; wins ${r.rideDeclined.winsA} v ${r.rideDeclined.winsB}`,
      `Discordant primary pairs where a ride was taken: ${r.primary.discordantRide.taken}/${r.primary.discordantRide.taken + r.primary.discordantRide.notTaken}`,
      "",
      "Secondary (shipped playTurn level 0 Wizard; its hash reads hidden Cowboy card ids):",
      `  Cowboy wins  Outrider ${pct(r.shipped.winsA, r.shipped.pairs)}  Sheriff ${pct(r.shipped.winsB, r.shipped.pairs)}  paired ${JSON.stringify(r.shipped.table)}`,
      `  Ride offered in ${pct(r.shipped.games.offered, r.shipped.pairs)} games; Guard blocked in ${pct(r.shipped.games.guardBlocked, r.shipped.pairs)}`,
      `  Relabel control under this bot: identical ${pct(r.shippedRelabel.identical, r.shippedRelabel.pairs)}; wins ${r.shippedRelabel.winsA} v ${r.shippedRelabel.winsB}`,
    ];
    console.log(lines.join("\n"));
  }
}
