import {RIVALS} from "../../game/showdown/progress.js";
import {cardArtwork} from "./table-ui.js";
import {ledgerSectionHtml} from "./night-shift-saloon.js";
import {mountSaloonRoom} from "./saloon-room.js";

// Pure: where the staged Boot Hill Poker page sits for a page served at `base`. This build is
// staged at the site root and at its /3d/ copy; both reach the one poker/ next to the root.
// Opened straight from disk, a directory has no index page, so the file is named.
export function pokerHref(base) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/[^/]*$/, "").replace(/3d\/$/, "") + "poker/" + (url.protocol === "file:" ? "index.html" : "");
  return url.href;
}

const RIVAL_ART = {
  stargazer: "wizard-wizard",
  imp: "wizard-imp",
  bonewright: "wizard-skeleton",
  coven: "wizard-singularity",
};
const ROOMS = [
  ["camp-rivals-title", "rivals", "Rivals", "stone"],
  ["camp-bounties-title", "wanted", "Wanted", "wood"],
  ["camp-open-title", "range", "Open range", "wood"],
  ["camp-practice", "practice", "Practice", "wood"],
  ["camp-save", "save", "Save code", "wood"],
  ["camp-collection-room", "ledger", "Camp ledger", "wood"],
];

// Move the existing controls into their rooms so their rules and event handlers stay in Camp.
export function mountCampOutpost(root, book) {
  const byId = (id) => root.querySelector("#" + id);
  const wizard = byId("camp-wizard");
  const rooms = new Map();
  let current;

  for (const [target, key, title, material] of ROOMS) {
    const room = document.createElement("dialog");
    room.className = `camp-outpost outpost-${key} outpost-${material}`;
    room.setAttribute("aria-labelledby", `outpost-${key}-title`);
    room.innerHTML = `<header><h2 id="outpost-${key}-title">${title}</h2><button type="button" autofocus>Back to map</button></header>
      <div class="outpost-room"></div>`;
    room.querySelector("header button").addEventListener("click", () => room.close());
    const content = room.querySelector(".outpost-room");
    const original = byId(target);
    content.append(original.closest("section") ?? original);
    if (original.matches("details")) {
      original.open = true;
      original.querySelector("summary").hidden = true;
    }
    root.append(room);
    rooms.set(target, {room, content});
    room.addEventListener("close", () => {
      if (current === room && !room.open) current = null;
    });
  }

  const ledger = rooms.get("camp-collection-room").content;
  ledger.append(byId("camp-report"), byId("camp-ledger"));
  for (const slot of ledger.querySelectorAll("[data-ledger-portrait]")) {
    const art = cardArtwork(slot.dataset.ledgerPortrait);
    if (art) slot.append(art);
  }
  root.querySelector(".camp-rail-utility").insertAdjacentHTML("beforeend",
    '<button type="button" data-camp-destination="camp-collection-room">Camp ledger</button>');

  // The Night Shift saloon: same dialog, focus and back pattern as the other rooms.
  const saloonRoom = document.createElement("dialog");
  saloonRoom.className = "camp-outpost outpost-saloon outpost-wood";
  saloonRoom.setAttribute("aria-labelledby", "outpost-saloon-title");
  root.append(saloonRoom);
  rooms.set("night-shift-saloon", {room: saloonRoom});
  byId("camp-ledger").insertAdjacentHTML("beforeend", ledgerSectionHtml());
  const saloon = mountSaloonRoom({room: saloonRoom, book, pokerURL: pokerHref(document.baseURI),
    ledger: byId("camp-ledger").querySelector(".ledger-night-shift")});
  saloonRoom.addEventListener("close", event => {
    if (event.target !== saloonRoom || saloonRoom.open) return;
    saloon.closed();
    if (current === saloonRoom) current = null;
  });
  root.querySelector('[data-camp-destination="camp-collection-room"]').insertAdjacentHTML("afterend",
    '<button type="button" data-camp-destination="night-shift-saloon">Night Shift saloon</button>');

  const practice = rooms.get("camp-practice").content;
  const replays = document.createElement("details");
  replays.innerHTML = "<summary>Challenge replays</summary>";
  replays.append(byId("camp-experiment"));
  practice.append(replays, wizard);

  rooms.get("camp-rivals-title").content.insertAdjacentHTML("afterbegin",
    '<p class="outpost-trail-lock">Finish the Trail to unlock these duels.</p>');
  for (const [target, {room}] of rooms) {
    const control = root.querySelector(`[data-camp-destination="${target}"]`);
    room.id = `room-for-${target}`;
    control.setAttribute("aria-haspopup", "dialog");
    control.setAttribute("aria-controls", room.id);
  }

  function close() {
    if (current === saloonRoom) saloon.closed();
    current?.close();
    current = null;
  }

  function show(room, control) {
    if (room.open) return;
    close();
    control.focus({preventScroll: true});
    room.showModal();
    current = room;
    if (room === saloonRoom) saloon.opened();
  }

  function open(id, control = root.querySelector(`[data-camp-destination="${id}"]`)) {
    const entry = rooms.get(id);
    if (!entry) return false;
    show(entry.room, control);
    return true;
  }

  function dressNotices(trailComplete) {
    const list = byId("camp-rivals");
    list.closest(".outpost-room").querySelector(".outpost-trail-lock").hidden = trailComplete;
    for (const [index, button] of list.querySelectorAll("button.sd-tile").entries()) {
      const card = RIVAL_ART[RIVALS[index].id];
      const art = cardArtwork(card);
      if (!art) continue;
      art.classList.add("outpost-portrait");
      art.dataset.portrait = card;
      button.prepend(art);
      button.querySelector(".sd-note").classList.toggle("outpost-lock-note", !trailComplete);
    }
  }

  return {
    close, open, dressNotices,
    // ?saloon=review: the normal Saloon entry, with the recorded room set to the archived decision first.
    // Without a decision that checks out, the room opens at its usual start.
    openSaloonReview() {
      saloon.review();
      return open("night-shift-saloon");
    },
    restoreFocus(control) {
      const room = control.closest(".camp-outpost");
      if (!room) return false;
      const opener = root.querySelector(`[aria-controls="${room.id}"]`);
      show(room, opener);
      if (room === saloonRoom) saloon.restore(control);
      for (let group = control.parentElement; group !== room; group = group.parentElement) {
        if (group.matches("details")) group.open = true;
      }
      control.focus();
      return true;
    },
    wizardInCamp() { if (wizard.parentElement !== practice) practice.append(wizard); },
    wizardOnItsOwn() { close(); root.append(wizard); },
  };
}
