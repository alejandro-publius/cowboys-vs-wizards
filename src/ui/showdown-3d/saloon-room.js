import {cardArtwork} from "./table-ui.js";
import {mountNightShiftSaloon} from "./night-shift-saloon.js";
import {createSaloonStage} from "./saloon-stage.js";
import {mountForgeShelf} from "../forge-shelf.js";
import {mountRulesDesk} from "../rules-desk.js";
import {mountArenaTable} from "../arena-table.js";
import {mountScoutRuling} from "../scout-ruling.js";
import RECORDING from "../night-shift-recording.json" with {type: "json"};

const stations = {
  table: "Billy’s duel",
  forge: "Card Forge",
  journal: "Journal",
  shift: "Shift recording",
  ruling: "Balance ruling",
  rules: "Rules desk",
  arena: "Agent arena",
  poker: "Boot Hill Poker",
};
const readers = {forge: host => mountForgeShelf(host, {portrait: cardArtwork}), ruling: mountScoutRuling, rules: mountRulesDesk, arena: mountArenaTable};
const archived = ["shift", "ruling", "rules", "arena"];
const button = (page, label = stations[page]) => `<button type="button" data-saloon-show="${page}">${label}</button>`;

// The book and the tables share a booth. Only the station the player chose is on screen.
export function mountSaloonRoom({room, ledger, book, pokerURL}) {
  room.innerHTML = `<header class="saloon-rail">
      <button type="button" class="saloon-exit" data-saloon-back autofocus><span aria-hidden="true">‹</span> <span>Map</span></button>
      <h2 id="outpost-saloon-title">Night Shift Saloon</h2>
      <button type="button" data-saloon-show="journal">Journal</button>
    </header>
    <div class="saloon-booth">
      <section data-saloon-page="home" aria-label="Character book"><div class="saloon-book-dock"></div></section>
      <section data-saloon-page="table" aria-label="Billy’s duel" hidden></section>
      <section data-saloon-page="forge" aria-label="Card Forge" hidden><div class="outpost-drawer-host"></div></section>
      <section data-saloon-page="journal" aria-label="Journal" hidden>
        <nav class="saloon-journal-index" aria-label="Journal entries">${archived.map(key => button(key)).join("")}</nav>
      </section>
      <section data-saloon-page="shift" aria-label="Shift recording" hidden><div class="outpost-room"></div></section>
      ${archived.slice(1).map(key => `<section data-saloon-page="${key}" aria-label="${stations[key]}" hidden><div class="outpost-drawer-host"></div></section>`).join("")}
      <section data-saloon-page="poker" aria-label="Boot Hill Poker" hidden></section>
    </div>
    <nav class="saloon-table-rail" aria-label="Saloon tables">
      ${button("table")} ${button("forge", "Forge")} <a data-saloon-wanted href="?room=wanted">Wanted</a>
      <a class="outpost-poker-link">Poker</a>
    </nav>`;
  const get = selector => room.querySelector(selector);
  const pages = new Map(Array.from(room.querySelectorAll("[data-saloon-page]"), node => [node.dataset.saloonPage, node]));
  const title = get("h2"), back = get("[data-saloon-back]"), journal = get('[data-saloon-show="journal"]');
  const rail = get(".saloon-table-rail"), dock = get(".saloon-book-dock");
  const shift = mountNightShiftSaloon({content: get(".outpost-room"), recording: RECORDING, portrait: cardArtwork, ledger, createStage: createSaloonStage});
  const table = get(".saloon-billy-table");
  pages.get("table").append(table);
  const unavailable = table.hidden;
  if (unavailable) get('[data-saloon-show="table"]').hidden = true;

  const poker = get(".outpost-poker-link");
  poker.href = pokerURL;
  const portable = typeof __CVW_POCKET_POKER__ !== "undefined" && __CVW_POCKET_POKER__;
  if (portable) poker.addEventListener("click", event => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    visit("poker");
  });

  let at = "home", active = false;
  const mounted = new Set();
  const parentOf = page => archived.includes(page) ? "journal" : "home";
  function pageControl(page) {
    return page === "poker" ? poker : get(`[data-saloon-show="${page}"]`);
  }
  function enterStation(page) {
    if (page === "shift") shift.opened();
    if (page === "home") book?.dock(dock);
    if (mounted.has(page)) return;
    if (readers[page]) {
      const host = pages.get(page).querySelector(".outpost-drawer-host");
      try { readers[page](host); }
      catch { host.textContent = `${stations[page]} could not open.`; return; }
    } else if (page === "poker" && portable) {
      const frame = document.createElement("iframe");
      frame.title = stations.poker;
      frame.srcdoc = portable;
      pages.get(page).append(frame);
    }
    mounted.add(page);
  }
  function visit(page, returningFrom) {
    if (!pages.has(page) || (page === "table" && unavailable)) return;
    const previous = at;
    if (previous === "shift" && active && page !== previous) shift.closed();
    if (previous === "home" && page !== previous) book?.undock();
    at = page;
    for (const [name, node] of pages) node.hidden = name !== page;
    room.dataset.station = page;
    rail.hidden = page !== "home";
    journal.hidden = page !== "home";
    const home = page === "home";
    back.lastElementChild.textContent = home ? "Map" : archived.includes(page) ? "Journal" : "Saloon";
    back.setAttribute("aria-label", home ? "Back to map" : archived.includes(page) ? "Back to journal" : "Back to Saloon");
    title.textContent = home ? "Night Shift Saloon" : stations[page];
    enterStation(page);
    const focus = returningFrom ? pageControl(returningFrom) : null;
    (focus ?? (page === "home" ? dock.querySelector('[aria-pressed="true"][data-id]') : back) ?? back).focus({preventScroll: true});
  }
  function retreat() {
    if (at === "home") room.close();
    else visit(parentOf(at), at);
  }
  room.addEventListener("click", event => {
    const trigger = event.target.closest("[data-saloon-show]");
    if (trigger) visit(trigger.dataset.saloonShow);
  });
  back.addEventListener("click", retreat);
  room.addEventListener("cancel", event => {
    if (at === "home") return;
    event.preventDefault();
    retreat();
  });
  return {
    opened(page = "home") {
      active = true;
      visit(page);
    },
    closed() {
      if (!active) return;
      active = false;
      if (at === "home") book?.undock();
      if (at === "shift") shift.closed();
    },
    review: () => shift.review(),
    restore(control) {
      const page = control.closest("[data-saloon-page]")?.dataset.saloonPage;
      if (page && at !== page) visit(page);
    },
  };
}

