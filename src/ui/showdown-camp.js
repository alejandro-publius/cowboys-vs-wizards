// The graybox Camp (issue 143 slices 2 and 3), adapted from the reference camp in prototypes/showdown/main.js:
// the card still on offer and packs to open, the six Trail duels, then (after the Trail) the rivals,
// the Wanted hunts and Open range (the even match and best of three), two players on one screen at any
// time, the saved deck and collection, Build deck, the save code with Start over, and the playtest report.
// Every rule (what is open, what a win pays, what a pack holds) comes from progress.js through the campaign.
import {TYPES} from "../game/showdown/cards.js";
import {BOUNTIES, HUNTS, RIVALS, duelList, packOpens, pool, trailDone} from "../game/showdown/progress.js";
import {decodeSaveCode, describeSave, encodeSave, sameSave} from "../game/showdown/savecode.js";
import {TRAIL} from "../game/showdown/trail.js";
import {OFFER_HEADING, face, offerRow, pays, rewardDeckButton} from "./showdown-screen.js";
import {mountLedger} from "./sheriffs-ledger.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sum = (counts) => Object.values(counts).reduce((total, copies) => total + copies, 0);
const rivalReward = (rival) => [pays(rival.reward.map((type) => [type, 1])), plural(rival.packs, "pack")].filter(Boolean).join(" and ");

// A rival tile's note. i: the rival's place in RIVALS; state: its duelList state.
export function rivalNote(save, i, state) {
  const rival = RIVALS[i];
  if (state === "won") return pool(save).length >= 2 ? "Beaten. Rematch for a card." : "Beaten."; // a rematch offers two cards or none
  if (state === "locked") return trailDone(save) ? `Beat ${RIVALS[i - 1].name} first` : "After the Trail";
  return !rival.reward.length && !pool(save).length ? `Win to beat ${rival.name}.` : `Win to earn ${rivalReward(rival)}`;
}

// After the Trail, the one next duel (#camp-next): the first open rival, then the first open hunt, in duelList order.
export function nextLine(save, list = duelList(save)) {
  const rivals = list.filter((duel) => duel.kind === "rival");
  const at = rivals.findIndex((duel) => duel.state === "open");
  const hunt = list.find((duel) => duel.kind === "hunt" && duel.state === "open");
  const huntName = (duel) => `<strong>${duel.name}</strong>, hunt ${duel.cleared + 1} of ${HUNTS}.`;
  if (at >= 0) {
    // With nothing left to earn the line stops at the rival (Fable's ruling); its tile still reads "Win to beat <name>.".
    const pay = RIVALS[at].reward.length || pool(save).length ? ` ${rivalNote(save, at, "open")}.` : "";
    const or = hunt && (save.losses[rivals[at].id] ?? 0) > 0 ? ` Or hunt ${huntName(hunt)}` : "";
    return `Next: <strong>${RIVALS[at].name}</strong>, rival ${at + 1} of ${RIVALS.length}.${pay}${or}`;
  }
  if (hunt) return `Next: ${huntName(hunt)} Five capture ${TYPES[BOUNTIES.find((each) => `hunt:${each.id}` === hunt.id).reward].name}.`;
  return "Every rival is beaten and both bosses are captured. Open range and two players stay open.";
}

const TEMPLATE = `
  <header><h1>Camp</h1><button id="camp-home" type="button">Main menu</button></header>
  <p id="camp-changed" class="sd-note" role="status" tabindex="-1" hidden></p>
  <p id="camp-storage" class="sd-note" role="status" hidden>This browser did not save your progress, so a reload will lose it. To keep it, open Save code in the Camp and copy the code.</p>
  <div id="camp-claim" aria-live="polite"></div>
  <section class="camp-map" aria-labelledby="camp-trail-title"><h2 id="camp-trail-title">The Trail</h2><ol id="camp-trail" class="sd-row"></ol></section>
  <section class="camp-stop-list" aria-labelledby="camp-rivals-title"><h2 id="camp-rivals-title">Rivals</h2><ol id="camp-rivals" class="sd-row"></ol></section>
  <section class="camp-stop-list" aria-labelledby="camp-bounties-title"><h2 id="camp-bounties-title">Wanted</h2><ol id="camp-bounties" class="sd-row"></ol></section>
  <section class="camp-stop-list" aria-labelledby="camp-open-title"><h2 id="camp-open-title">Open range</h2><div id="camp-open" class="sd-row"></div></section>
  <section class="camp-stop-list" id="camp-collection-room" aria-label="Your cards"><h2>Your cards</h2><p id="camp-collection" class="sd-note"></p>
    <div class="sd-row"><button type="button" id="camp-build">Build deck</button></div></section>
  <details id="camp-save"><summary>Save code</summary>
    <p class="sd-note">Progress is saved in this browser. Copy this code to move it, or paste one and press Load.</p>
    <textarea id="camp-code" rows="3" cols="60" aria-label="Save code" spellcheck="false"></textarea>
    <div class="sd-row">
      <button type="button" id="camp-load">Load</button>
      <button type="button" id="camp-reset">Start over</button>
      <span id="camp-code-note" class="sd-note" role="status"></span>
    </div>
    <div id="camp-code-preview" data-testid="save-import-preview" role="group" aria-labelledby="camp-code-preview-text" hidden>
      <p id="camp-code-preview-text" class="sd-note"></p>
      <div class="sd-row">
        <button type="button" id="camp-code-replace" data-testid="save-import-replace">Replace my progress</button>
        <button type="button" id="camp-code-cancel" data-testid="save-import-cancel">Cancel</button>
      </div>
    </div>
  </details>
  <details id="camp-report"><summary>Playtest report</summary>
    <p class="sd-note">What you played and how it went. Select all of it, copy it and send it to whoever asked you to play.</p>
    <p id="camp-report-storage" class="sd-note" role="status" hidden>This browser did not save the playtest report, so a reload will lose it.</p>
    <textarea id="camp-report-text" rows="10" cols="60" readonly aria-label="Playtest report"></textarea>
    <p><button id="camp-report-copy" type="button">Copy report</button> <span id="camp-report-copied" role="status" aria-live="polite"></span></p>
  </details>
  <details id="camp-ledger" class="sd-ledger"></details>`;

// campaign: progress(), saved(), duels(), holdings(), owned(type), choose(type), openPack(), replace(save), reset().
// onDuel(id, {players, best}): start a Camp duel ("trail", "rival:<id>", "hunt:<id>", "open", or "two" for two players).
// onBuild(): open the deck builder. playtest (optional): text(progress), saved(), clear().
// confirm: asks before Start over (window.confirm in the page).
export function mountCamp(root, {campaign, writeCamp = (change) => change(), playtest, paintCardFaces, openDestination, dressNotices, onDuel, onHome, onBuild, confirm = (text) => window.confirm(text)}) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);
  if (paintCardFaces) {
    $("camp-trail").insertAdjacentHTML("afterend", `<aside class="camp-trail-rail" aria-label="Trail actions">
      <h3 id="camp-current-stop"></h3><p id="camp-current-reward" aria-live="polite"></p>
      <button type="button" class="frontier-plaque" id="camp-start-trail">Play</button>
      <nav class="camp-rail-tools" aria-label="Camp destinations">
        <button type="button" data-camp-destination="camp-rivals-title">Rivals</button>
        <button type="button" data-camp-destination="camp-bounties-title">Wanted</button>
        <button type="button" data-camp-destination="camp-open-title">Open range</button>
      </nav>
      <nav class="camp-rail-utility" aria-label="Camp utilities">
        <button type="button" data-camp-destination="camp-practice">Practice</button>
        <button type="button" data-camp-destination="camp-save">Save code</button>
      </nav>
    </aside>`);
    root.querySelector(".camp-rail-tools").prepend($("camp-build"));
    root.classList.add("camp-diorama");
  }
  mountLedger($("camp-ledger")); // The Night Shift: Sheriff's Ledger, static and collapsed (src/ui/sheriffs-ledger.js).
  let picked = null;
  let opened = null; // the pack just opened, shown once

  function render() {
    const progress = campaign.progress();
    const list = campaign.duels();
    const next = TRAIL[progress.wins];
    $("camp-storage").hidden = campaign.saved();
    const opens = packOpens(progress);
    const afterTrail = next ? "" : nextLine(progress, list);
    const held = progress.packs && !opens
      ? `<p id="camp-packs-empty" class="sd-note">${plural(progress.packs, "pack")} ${progress.packs === 1 ? "holds" : "hold"} nothing new: every card you can earn now is yours.</p>` : "";
    const trailNote = next
      ? `<p id="camp-next">${progress.wins === 0 ? "Start here" : "Next"}: click <strong>${next.name}</strong> to play ${progress.wins === 0 ? "your first duel" : "it"}.</p>`
      : !paintCardFaces ? `<p id="camp-next">${afterTrail}</p>` : "";
    const hint = picked ? `<p class="sd-good">Added ${TYPES[picked].name}: you now own ${campaign.owned(picked)}. Your deck has ${progress.deck[picked] ?? 0}.</p><div class="sd-row">${rewardDeckButton(picked)}</div>` : "";
    // First things first: a card to choose, then a pack to open. While a card is on offer no solo duel can start.
    $("camp-claim").innerHTML = progress.offer ? `<h2>${OFFER_HEADING}</h2><p class="sd-note">You won. The one you pick goes into your collection.</p>${offerRow(progress.offer, campaign.owned)}`
      : opened ? `<h2>In the pack</h2><div class="sd-row">${opened.map((type) => `<div class="sd-card cowboy ${TYPES[type].rarity}" data-frame="${TYPES[type].kind}" data-opened="${type}">${face(type)}</div>`).join("")}</div>
        <div class="sd-row"><button type="button" id="camp-pack-done">${opens ? `Open the next pack (${progress.packs} left)` : "Add them to my collection"}</button></div>`
      : opens ? `${hint}<h2>${plural(progress.packs, "pack")} to open</h2><div class="sd-row"><button type="button" id="camp-pack">Open a pack</button></div>`
      : `${hint}${held}${trailNote}`;

    paintCardFaces?.($("camp-claim"), "[data-choose], [data-opened]");

    const tile = (duel, note, off = duel.state !== "open") => `<li><button type="button" class="sd-tile ${duel.state}" ${duel.kind === "trail" ? `data-trail="${duel.index}" ` : ""}${off || progress.offer ? "disabled" : `data-duel="${duel.id}"`}>
      <strong>${duel.state === "won" ? "✓ " : ""}${duel.name}</strong><span class="sd-note">${note}</span></button></li>`;
    $("camp-trail").innerHTML = list.filter((duel) => duel.kind === "trail").map((duel) => {
      const reward = pays(TRAIL[duel.index].reward.map(([type, , copies]) => [type, copies]));
      return tile(duel, duel.state === "won" ? `Earned ${reward}` : duel.state === "locked" ? `Locked · win to earn ${reward}` : `Win to earn ${reward}`);
    }).join("");
    if (paintCardFaces) {
      const choice = $("camp-trail").querySelector(".open");
      const start = $("camp-start-trail");
      $("camp-current-stop").textContent = next?.name ?? "Trail complete";
      const reward = $("camp-current-reward");
      if (progress.offer) reward.textContent = "Choose your reward to continue.";
      else if (next) reward.textContent = choice?.querySelector(".sd-note").textContent ?? "";
      else reward.innerHTML = afterTrail;
      start.hidden = !next;
      start.disabled = !choice || choice.disabled;
      start.textContent = next ? `Play ${next.name}` : "Play";
    }
    $("camp-rivals").innerHTML = list.filter((duel) => duel.kind === "rival").map((duel, i) =>
      tile(duel, rivalNote(progress, i, duel.state), duel.state === "locked")).join("");
    $("camp-bounties").innerHTML = list.filter((duel) => duel.kind === "hunt").map((duel) => {
      const bounty = BOUNTIES.find((each) => `hunt:${each.id}` === duel.id);
      return tile(duel, duel.state === "won" ? `Captured: ${TYPES[bounty.reward].name}` : duel.state === "locked" ? "After the Trail"
        : `${duel.cleared} of ${HUNTS} hunts won. Five capture ${TYPES[bounty.reward].name}.`);
    }).join("");
    dressNotices?.(trailDone(progress));
    const open = trailDone(progress) && !progress.offer;
    $("camp-open").innerHTML = `<button type="button" data-duel="open" ${open ? "" : "disabled"}>The even match${open ? "" : " (after the Trail)"}</button>
      <button type="button" data-match="open" ${open ? "" : "disabled"}>Best of three, with your side deck</button>
      <button type="button" data-two="1">Two players, one screen</button>
      <button type="button" data-two="3">Two players, best of three</button>`;

    const count = (counts) => Object.entries(counts).map(([type, copies]) => `${TYPES[type].name} ×${copies}`).join(", ");
    const rows = campaign.holdings();
    const listed = rows.map(({type, copies, inherited}) => `${TYPES[type].name} ×${copies}${inherited ? " (from the lane game)" : ""}`).join(", ");
    $("camp-collection").innerHTML = `<strong>Deck:</strong> ${count(progress.deck)}.${sum(progress.side) ? ` <strong>Side deck:</strong> ${count(progress.side)}.` : ""}<br><strong>Collection:</strong> Sheriff and Billy in any number${
      listed ? `, ${listed}` : ""}.${rows.some((row) => row.inherited) ? `<br>Cards from the lane game stay owned. They are not in your Trail deck and are not in save codes.` : ""}`;
    // Save codes hold the progress object only, never keepsakes (Fable's F1 ruling).
    if (!pending) $("camp-code").value = encodeSave(progress);
    $("camp-report").hidden = !playtest;
    if (playtest) {
      $("camp-report-text").value = playtest.text(progress);
      $("camp-report-storage").hidden = playtest.saved();
      $("camp-report-copied").textContent = "";
    }
  }

  // Clipboard first; where it is refused (file:// pages, older browsers) the text is selected for a manual copy.
  async function copyReport() {
    const box = $("camp-report-text");
    try {
      await navigator.clipboard.writeText(box.value);
      $("camp-report-copied").textContent = "Copied.";
    } catch {
      box.focus();
      box.select();
      $("camp-report-copied").textContent = "Selected: press Ctrl+C or Cmd+C to copy.";
    }
  }

  // A pasted code is read strictly, and a different save replaces this one only after Replace is pressed.
  // The preview belongs to the exact text it was read from: any edit withdraws it, and Replace re-checks the text.
  let pending = null;
  const closePreview = () => { pending = null; $("camp-code-preview").hidden = true; };
  const note = (text) => { $("camp-code-note").textContent = text; };
  // A button from an old render may have disappeared while another tab was finishing its save.
  const writeFrom = (button, change) => writeCamp(() => {
    if (!root.hidden && root.contains(button) && !button.disabled) {
      $("camp-changed").hidden = true;
      change();
    }
  });
  $("camp-code").addEventListener("input", () => {
    if (!pending) return;
    closePreview();
    note("The code changed, so the preview was closed. Press Load to preview it. Nothing was changed.");
  });
  function load() {
    closePreview();
    const read = decodeSaveCode($("camp-code").value);
    if (!read.ok) return note(`${read.reason} Nothing was changed.`);
    if (sameSave(read.save, campaign.progress())) return note("That code is the progress you already have. Nothing was changed.");
    pending = {save: read.save, text: $("camp-code").value};
    $("camp-code-preview-text").textContent = `This code${read.legacy ? " (from an older version)" : ""} holds: ${describeSave(read.save)} You have: ${describeSave(campaign.progress())} Replace your progress in this browser with it?`;
    $("camp-code-preview").hidden = false;
    note("");
    $("camp-code-cancel").focus();
  }
  function replace() {
    if (!pending) return;
    const preview = pending;
    writeFrom($("camp-code-replace"), () => {
      if (pending !== preview) return;
      closePreview();
      if ($("camp-code").value !== preview.text) return note("The code changed, so the preview was closed. Press Load to preview it. Nothing was changed.");
      const saved = campaign.replace(preview.save);
      opened = picked = null;
      render();
      note(saved ? "Loaded." : "Loaded for this visit only: the browser did not save it.");
      $("camp-load").focus();
    });
  }
  // Start over: Showdown progress and the playtest report only; keepsakes and the lane profile stay.
  function reset() {
    if (!confirm("Start over? Your cards, progress and playtest report in this browser are erased.")) return;
    closePreview();
    writeFrom($("camp-reset"), () => {
      campaign.reset();
      playtest?.clear();
      opened = picked = null;
      render();
      note("Started over.");
    });
  }

  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.choose && campaign.progress().offer?.includes(d.choose)) {
      writeFrom(b, () => {
        campaign.choose(d.choose);
        picked = d.choose;
        render();
        ($("camp-claim").querySelector("button:not([data-build-reward])") ?? root.querySelector("[data-duel]:not(:disabled)") ?? $("camp-claim").querySelector("[data-build-reward]"))?.focus();
      });
    } else if (b.hasAttribute("data-build-reward") && picked) onBuild(picked);
    else if (b.id === "camp-start-trail") $("camp-trail").querySelector("[data-duel=trail]")?.click();
    else if (d.campDestination) {
      if (openDestination?.(d.campDestination, b)) return;
      const destination = $(d.campDestination);
      if (!destination) return;
      if (destination instanceof HTMLDetailsElement) {
        destination.open = true;
        destination.querySelector("summary")?.focus();
      } else {
        destination.tabIndex = -1;
        destination.focus();
      }
      destination.scrollIntoView({block: "start"});
    } else if (d.duel && !campaign.progress().offer) onDuel(d.duel, {});
    else if (d.match && !campaign.progress().offer) onDuel(d.match, {best: 3});
    else if (d.two) onDuel("two", {players: 2, best: Number(d.two)});
    else if ((b.id === "camp-pack" || b.id === "camp-pack-done") && packOpens(campaign.progress())) {
      writeFrom(b, () => {
        opened = campaign.openPack();
        picked = null;
        render();
        $("camp-pack-done")?.focus();
      });
    } else if (b.id === "camp-pack-done") { opened = null; render(); ($("camp-claim").querySelector("button") ?? root.querySelector("[data-duel]:not(:disabled)"))?.focus(); }
    else if (b.id === "camp-build") { picked = null; onBuild(); }
    else if (b.id === "camp-load") load();
    else if (b.id === "camp-code-cancel") { closePreview(); note("Cancelled. Nothing was changed."); $("camp-load").focus(); }
    else if (b.id === "camp-code-replace") replace();
    else if (b.id === "camp-reset") reset();
    else if (b.id === "camp-home") onHome();
    else if (b.id === "camp-report-copy") copyReport();
  });
  return {show(message = "") {
    picked = null;
    if (message) { opened = null; note(""); }
    $("camp-changed").textContent = message;
    $("camp-changed").hidden = !message;
    closePreview();
    render();
  }};
}
