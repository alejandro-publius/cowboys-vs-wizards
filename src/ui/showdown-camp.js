// The graybox Camp (issue 143 slice 2), adapted from the reference camp in prototypes/showdown/main.js:
// the card still on offer, the six Trail duels with what each pays, and the saved deck and collection.
// Only the Trail is playable here; rivals, Wanted hunts, packs and the deck builder wait for slice 3.
import {TYPES} from "../game/showdown/cards.js";
import {TRAIL} from "../game/showdown/trail.js";
import {OFFER_HEADING, offerRow, pays} from "./showdown-screen.js";

const TEMPLATE = `
  <header><h1>Camp</h1><button id="camp-home" type="button">Main menu</button></header>
  <p id="camp-storage" class="sd-note" role="status" hidden>This browser did not save your progress, so a reload will lose it.</p>
  <div id="camp-claim" aria-live="polite"></div>
  <section aria-labelledby="camp-trail-title"><h2 id="camp-trail-title">The Trail</h2><ol id="camp-trail" class="sd-row"></ol></section>
  <section aria-label="Your cards"><h2>Your cards</h2><p id="camp-collection" class="sd-note"></p></section>
  <details id="camp-report"><summary>Playtest report</summary>
    <p class="sd-note">What you played and how it went. Select all of it, copy it and send it to whoever asked you to play.</p>
    <p id="camp-report-storage" class="sd-note" role="status" hidden>This browser did not save the playtest report, so a reload will lose it.</p>
    <textarea id="camp-report-text" rows="10" cols="60" readonly aria-label="Playtest report"></textarea>
    <p><button id="camp-report-copy" type="button">Copy report</button> <span id="camp-report-copied" role="status" aria-live="polite"></span></p>
  </details>`;

// campaign: progress(), saved(), duels(), owned(type), choose(type). onDuel(): start the open Trail duel.
// playtest (optional): text(progress), saved(); the report is plain text the player or moderator copies.
export function mountCamp(root, {campaign, playtest, onDuel, onHome}) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);
  let picked = null;

  function render() {
    const progress = campaign.progress();
    const next = TRAIL[progress.wins];
    $("camp-storage").hidden = campaign.saved();
    // While a card is on offer nothing else can be started: the choice comes first.
    $("camp-claim").innerHTML = progress.offer ? `<h2>${OFFER_HEADING}</h2><p class="sd-note">You won. The one you pick goes into your collection.</p>${offerRow(progress.offer, campaign.owned)}`
      : `${picked ? `<p class="sd-good">Added ${TYPES[picked].name}: you now own ${campaign.owned(picked)}.</p>` : ""}${next
        ? `<p id="camp-next">${progress.wins === 0 ? "Start here" : "Next"}: click <strong>${next.name}</strong> to play ${progress.wins === 0 ? "your first duel" : "it"}.</p>` : "<p>You have won the whole Trail.</p>"}`;
    $("camp-trail").innerHTML = campaign.duels().filter((duel) => duel.kind === "trail").map((duel) => {
      const reward = pays(TRAIL[duel.index].reward.map(([type, , copies]) => [type, copies]));
      const on = duel.state === "open" && !progress.offer;
      return `<li><button type="button" class="sd-tile ${duel.state}" data-trail="${duel.index}" ${on ? 'data-duel="trail"' : "disabled"}>
        <strong>${duel.state === "won" ? "✓ " : ""}${duel.name}</strong><span class="sd-note">${duel.state === "won" ? `Earned ${reward}` : duel.state === "locked" ? `Locked · win to earn ${reward}` : `Win to earn ${reward}`}</span></button></li>`;
    }).join("");
    const count = (counts) => Object.entries(counts).map(([type, copies]) => `${TYPES[type].name} ×${copies}`).join(", ");
    $("camp-collection").innerHTML = `<strong>Deck:</strong> ${count(progress.deck)}.<br><strong>Collection:</strong> Sheriff and Billy in any number${
      Object.keys(progress.collection).length ? `, ${count(progress.collection)}` : ""}.`;
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

  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.choose && campaign.progress().offer?.includes(b.dataset.choose)) {
      campaign.choose(b.dataset.choose);
      picked = b.dataset.choose;
      render();
      root.querySelector("[data-duel]")?.focus();
    } else if (b.dataset.duel === "trail" && !campaign.progress().offer) onDuel();
    else if (b.id === "camp-home") onHome();
    else if (b.id === "camp-report-copy") copyReport();
  });
  return {show() { picked = null; render(); }};
}
