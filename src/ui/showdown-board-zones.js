import {cardOf} from "../game/showdown/cards.js";
import {opponent} from "../game/showdown/rules.js";
import {FACTION} from "./showdown-zones.js";

const name = (id) => cardOf(id).name;

export function boardZonesHtml(view, {shared, challenge, recent}) {
  const sides = [opponent(view.viewer), view.viewer];
  const piles = sides.map((side) => {
    const pile = view.sides[side].discard;
    if (!pile.length) return "";
    const label = `${FACTION[side]} graveyard · ${pile.length} ${pile.length === 1 ? "card" : "cards"} · newest ${name(pile.at(-1))}`;
    return `<button type="button" data-graveyard="${side}" aria-haspopup="dialog" aria-label="${label}"><span class="sd-pile-count" aria-hidden="true">${pile.length}</span><span class="sd-pile-side" aria-hidden="true">${FACTION[side]}</span></button>`;
  }).join("");
  if (challenge) return piles;

  const rows = sides.map((side) => {
    const s = view.sides[side];
    const traps = !shared && side === view.viewer ? s.traps.map(name).join(", ") : "";
    const troops = s.board.filter(Boolean).map((t) => name(t.cardId) + (t.gear.length ? ` (${t.gear.map(name).join(", ")})` : ""));
    return `<section><h3>${FACTION[side]}s</h3>
      <p>Base ${s.base}/${s.baseMax} orbs · Hand ${s.handCount} · Deck ${s.deckCount}</p>
      <p>Traps ${s.trapCount}${traps ? ` (${traps})` : ""} · Graveyard ${s.discard.length}</p>
      ${troops.length ? `<p>Troops · ${troops.join(", ")}</p>` : ""}</section>`;
  }).join("");
  const location = view.location ? `<p>Location · ${name(view.location.cardId)}</p>` : "";
  return `<details data-board-zone-details><summary>Board details</summary><div>${rows}${location}${recent ? `<p>${recent}</p>` : ""}</div></details>${piles}`;
}
