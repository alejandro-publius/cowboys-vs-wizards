// Writes the blind reviewer's payload from positions.json only (no replay.json, no results/).
// Card copy numbers are dropped, so the text names card types only.
//   node experiments/showdown-outrider/decision/reviewer/payload.mjs > experiments/showdown-outrider/decision/reviewer/payload.txt
import {readFileSync} from "node:fs";
import {cardOf, has} from "../../../../src/game/showdown/cards.js";

const positions = JSON.parse(readFileSync(new URL("../positions.json", import.meta.url), "utf8"));
const troop = (t, slot) => (t ? `slot ${slot}: ${cardOf(t.cardId).name} attack ${cardOf(t.cardId).attack} orbs ${t.health}`
  + `${has(t.cardId, "ride") ? " [Ride]" : ""}${has(t.cardId, "guard") ? " [Guard]" : ""}${t.attacked ? " (has attacked)" : ""}${t.gear.length ? ` gear: ${names(t.gear)}` : ""}` : `slot ${slot}: empty`);
const names = (ids) => ids.map((id) => cardOf(id).name).join(", ") || "none";

const lines = ["Positions from The Bone Fence, Cowboy seat, your turn. Choose RIDE or FIGHT for each.", ""];
for (const {label, view, choices} of positions) {
  const {cowboy: c, wizard: w} = view.sides;
  const rider = cardOf(c.board[choices.ride.slot].cardId).name;
  const target = cardOf(w.board[choices.fight.target].cardId).name;
  lines.push(`## ${label}`, `Turn ${view.turn}. Cowboy Base ${c.base}/${c.baseMax}. Wizard Base ${w.base}/${w.baseMax}.`,
    `Cowboy board: ${c.board.map(troop).join("; ")}`, `Wizard board: ${w.board.map(troop).join("; ")}`,
    `Cowboy hand: ${names(c.hand)}. Cowboy deck ${c.deckCount} cards. Cowboy graveyard: ${names(c.discard)}.`,
    `Wizard hand ${w.handCount} cards (hidden), deck ${w.deckCount}, face-down traps ${w.trapCount}. Wizard graveyard: ${names(w.discard)}.`,
    `RIDE: your ${rider} in slot ${choices.ride.slot} strikes the Wizard Base for 1 orb.`,
    `FIGHT: your ${rider} in slot ${choices.fight.slot} attacks the ${target} in Wizard slot ${choices.fight.target}.`, "");
}
console.log(lines.join("\n"));
