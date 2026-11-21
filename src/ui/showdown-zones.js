// Boot Hill pass (board-design.md, first slice): the zone rails, the Boot Hill pile sheet, the Raise marker and the
// recent-move ticker of the Showdown screen. Everything here is read from one seat's public view (viewFor), the
// duel's public deck lists and engine events. Only published card names reach the page: no card instance id, no
// rival hand or trap identity, no deck order. No DOM access; the screen places the strings.
import {cardOf, has} from "../game/showdown/cards.js";

export const FACTION = Object.freeze({cowboy: "Cowboy", wizard: "Wizard"});
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pileName = (side) => `${FACTION[side]} Boot Hill graveyard`;

// The pile newest first. discard is pushed in the order cards land, so its end is the newest card.
export const newestFirst = (discard) => [...discard].reverse();

// The card Raise would return from this pile, as an index into discard, or -1. The same rule as applyAction's
// summon (rules.js): the last Undead troop in the owner's graveyard. Shown only for a side whose public deck list
// holds a Raise card, so the Cowboy can read the Wizard threat.
export function raiseTarget(discard, deckCounts) {
  const raises = Object.keys(deckCounts ?? {}).some((type) => has(`${type}-1`, "raise"));
  if (!raises) return -1;
  return discard.findLastIndex((id) => cardOf(id).kind === "troop" && cardOf(id).tag === "Undead");
}

// One side's rail. own: the seat's own side; named: the seat may see its own trap names (never under the curtain or
// on a shared result). sprung: trap names this side spent in the latest batch, already revealed by their trap event.
export function railHtml(side, s, {own, named, raise, sprung = [], grew = false}) {
  const cell = (zone, inner, label) => `<div class="sd-zone" data-zone="${zone}" role="group" aria-label="${label}">${inner}</div>`;
  const deck = cell("deck", `<span class="sd-zone-label">Deck</span> <span class="sd-zone-count">${s.deckCount}</span>`, `${FACTION[side]} deck: ${plural(s.deckCount, "card")}`);
  const backs = `<span class="sd-backs" role="img" aria-label="${FACTION[side]} hand: ${plural(s.handCount, "card")}, face down">${'<span class="card-back" aria-hidden="true"></span>'.repeat(s.handCount)}</span>`;
  const hand = cell("hand-count", `<span class="sd-zone-label">Hand</span> <span class="sd-zone-count">${s.handCount}</span>${backs}`, `${FACTION[side]} hand: ${plural(s.handCount, "card")}`);
  const setLine = own && named ? (s.traps.length ? `Set: ${s.traps.map((id) => cardOf(id).name).join(", ")}` : "No trap set")
    : s.trapCount ? `${plural(s.trapCount, "card")} face down` : "Nothing face down";
  const flip = sprung.length ? `<span class="sd-trap-sprung" data-trap-sprung>Sprung: ${sprung.join(", ")}</span>` : "";
  const traps = cell("traps", `<span class="sd-zone-label">Traps</span> <span class="sd-trap-line">${setLine}</span>${flip}`, `${FACTION[side]} traps: ${setLine}`);
  const top = s.discard.length ? cardOf(s.discard.at(-1)).name : null;
  const dot = raise >= 0 ? `<span class="sd-raise-dot" data-raise-dot aria-hidden="true">●</span>` : "";
  const raiseNote = raise >= 0 ? `, Raise returns ${cardOf(s.discard[raise]).name}` : "";
  // An empty pile is plain text, not a button; it becomes one when the first card lands.
  const pile = top
    ? `<button type="button" class="sd-pile${grew ? " sd-grew" : ""}" data-graveyard="${side}" aria-haspopup="dialog" aria-label="${pileName(side)}: ${plural(s.discard.length, "card")}, newest ${top}${raiseNote}. Open the pile">
        <span class="sd-zone-label">Graveyard</span> <span class="sd-zone-top">${top}</span> <span class="sd-zone-count">${s.discard.length}</span>${dot}</button>`
    : `<span class="sd-zone-label">Graveyard</span> <span class="sd-pile sd-empty" data-graveyard-empty="${side}">Boot Hill · empty</span>`;
  const grave = `<div class="sd-zone" data-zone="graveyard" aria-label="${pileName(side)}">${pile}</div>`;
  const cells = own ? [grave, traps, deck] : [deck, hand, traps, grave];
  return `<div class="sd-zone-rail" data-zone-side="${side}" role="group" aria-label="${own ? "Your" : FACTION[side]} zones">${cells.join("")}</div>`;
}

// The sheet body for one pile: rows newest first, each a button that shows the card's rules text (describe(type)).
// open: the row index whose text is shown. The Raise target row gets the marker.
export function sheetHtml(side, discard, raise, open, describe) {
  const rows = newestFirst(discard).map((id, i) => {
    const at = discard.length - 1 - i;
    const card = cardOf(id);
    const marker = at === raise ? ` <span class="sd-raise-tag" data-raise-target>Raise returns this</span>` : "";
    const text = open === i ? `<span class="sd-graveyard-text">${describe(id)}</span>` : "";
    return `<li><button type="button" data-graveyard-card="${i}" aria-expanded="${open === i}">${card.name}${marker}</button>${text}</li>`;
  }).join("");
  return `<h2 id="sd-graveyard-title">${pileName(side)} · ${plural(discard.length, "card")}, newest first</h2>
    <ol class="sd-graveyard-list">${rows}</ol>
    <button type="button" data-graveyard-close>Close</button>`;
}

// The recent moves of one batch, as short published-name lines, oldest first. Events give the reasons (tribute,
// Raise, a spent trap); every other card new on a pile (a fallen troop, its gear, a cast spell, a burned draw, an old
// location) is read from the views' public discards. Card ids are used only to match and never returned.
// sprung: per side, the names of traps spent in the batch, for the rail's flip.
export function movesOf(events, before, after) {
  const lines = [];
  const sprung = {cowboy: [], wizard: []};
  const told = new Set();
  const into = (side, id, why = "") => `${cardOf(id).name} → ${FACTION[side]} Boot Hill${why}`;
  for (const e of events) {
    if (e.type === "tribute") { lines.push(into(e.side, e.cardId, " (tribute)")); told.add(e.cardId); }
    else if (e.type === "raise") { lines.push(`${cardOf(e.cardId).name} ← ${FACTION[e.side]} Boot Hill (Raise)`); told.add(e.cardId); }
    else if (e.type === "burn") { lines.push(into(e.side, e.cardId, " (burned draw)")); told.add(e.cardId); }
    else if (e.type === "trap") { lines.push(into(e.side, e.cardId, " (trap spent)")); sprung[e.side].push(cardOf(e.cardId).name); told.add(e.cardId); }
  }
  const grew = {cowboy: false, wizard: false};
  for (const side of ["cowboy", "wizard"]) {
    const was = new Set(before?.sides[side].discard ?? []);
    const now = after.sides[side].discard;
    grew[side] = now.some((id) => !was.has(id));
    for (const id of now) if (!was.has(id) && !told.has(id)) lines.push(into(side, id, cardOf(id).kind === "troop" ? " (fell)" : ""));
  }
  return {lines, sprung, grew};
}
