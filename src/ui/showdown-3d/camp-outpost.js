import {BOUNTIES, RIVALS} from "../../game/showdown/progress.js";
import {cardArtwork} from "./table-ui.js";
import {ledgerSectionHtml, mountNightShiftSaloon} from "./night-shift-saloon.js";
import {createSaloonStage} from "./saloon-stage.js";
import RECORDING from "../night-shift-recording.json" with {type: "json"};

const RIVAL_ART = {
  stargazer: "wizard-wizard",
  imp: "wizard-imp",
  bonewright: "wizard-skeleton",
  coven: "wizard-singularity",
};
const ROOMS = [
  ["camp-rivals-title", "rivals", "Rivals", "stone"],
  ["camp-bounties-title", "wanted", "Wanted", "stone"],
  ["camp-open-title", "range", "Open range", "wood"],
  ["camp-practice", "practice", "Practice", "wood"],
  ["camp-save", "save", "Save code", "wood"],
  ["camp-collection-room", "ledger", "Camp ledger", "wood"],
];

// Move the existing controls into their rooms so their rules and event handlers stay in Camp.
export function mountCampOutpost(root) {
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
  root.querySelector(".camp-rail-utility").insertAdjacentHTML("beforeend",
    '<button type="button" data-camp-destination="camp-collection-room">Camp ledger</button>');

  // The Night Shift saloon: same dialog, focus and back pattern as the other rooms.
  const saloonRoom = document.createElement("dialog");
  saloonRoom.className = "camp-outpost outpost-saloon outpost-wood";
  saloonRoom.setAttribute("aria-labelledby", "outpost-saloon-title");
  saloonRoom.innerHTML = `<header><h2 id="outpost-saloon-title">Night Shift saloon</h2><button type="button" autofocus>Back to map</button></header>
      <div class="outpost-room"></div>`;
  saloonRoom.querySelector("header button").addEventListener("click", () => saloonRoom.close());
  root.append(saloonRoom);
  rooms.set("night-shift-saloon", {room: saloonRoom, content: saloonRoom.querySelector(".outpost-room")});
  byId("camp-ledger").insertAdjacentHTML("beforeend", ledgerSectionHtml());
  const saloon = mountNightShiftSaloon({
    content: rooms.get("night-shift-saloon").content,
    recording: RECORDING,
    portrait: cardArtwork,
    ledger: byId("camp-ledger").querySelector(".ledger-night-shift"),
    createStage: createSaloonStage,
  });
  saloonRoom.addEventListener("close", () => {
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

  for (const key of ["camp-rivals-title", "camp-bounties-title"]) {
    rooms.get(key).content.insertAdjacentHTML("afterbegin", '<p class="outpost-trail-lock">Finish the Trail to unlock these duels.</p>');
  }
  for (const [target, {room}] of rooms) {
    const control = root.querySelector(`[data-camp-destination="${target}"]`);
    room.id = `room-for-${target}`;
    control.setAttribute("aria-haspopup", "dialog");
    control.setAttribute("aria-controls", room.id);
  }

  function close() {
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
    for (const [list, cards] of [
      [byId("camp-rivals"), RIVALS.map(({id}) => RIVAL_ART[id])],
      [byId("camp-bounties"), BOUNTIES.map(({boss}) => boss)],
    ]) {
      const content = list.closest(".outpost-room");
      content.querySelector(".outpost-trail-lock").hidden = trailComplete;
      for (const [index, button] of [...list.querySelectorAll("button")].entries()) {
        const art = cardArtwork(cards[index]);
        if (!art) continue;
        art.classList.add("outpost-portrait");
        button.prepend(art);
        button.querySelector(".sd-note").classList.toggle("outpost-lock-note", !trailComplete);
      }
    }
  }

  return {
    close, open, dressNotices,
    restoreFocus(control) {
      const room = control.closest(".camp-outpost");
      if (!room) return false;
      const opener = root.querySelector(`[aria-controls="${room.id}"]`);
      show(room, opener);
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
