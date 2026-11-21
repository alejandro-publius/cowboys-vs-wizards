// The Wizard preview section (Fable's ruling, "Wizard preview"): one collapsed block at the end of the Camp, shown
// once the Cowboy save has won Boot Hill, and the same block on its own after ?wizard=1 ("direct"). It lists the
// four Wizard duels and Open range, Wizard seat, says what the next one pays and why, shows the Wizard deck and
// has its own Start preview over. Everything it shows comes from the preview object
// (src/match/showdown-wizard-campaign.js); it reads and writes no Cowboy progress.
// Selectors are listed for the browser check in the release notes (entry-api.md).
import {TYPES} from "../game/showdown/cards.js";
import {GRIT_CAP} from "../game/showdown/trail.js";
import {pays} from "./showdown-screen.js";

const TEMPLATE = `<summary>Wizard preview</summary>
  <header id="wizard-direct" hidden><h1>Wizard preview</h1><button type="button" id="wizard-to-camp">Cowboy Camp</button></header>
  <p class="sd-note">A preview: you play the Wizards against the Cowboy bot. Four duels with fixed rewards, then Open range. It has its own save in this browser and never changes your Cowboy career.</p>
  <p id="wizard-storage" class="sd-note" role="status" hidden>This browser did not save the Wizard preview, so a reload will lose it.</p>
  <p id="wizard-next" role="status"></p>
  <ol id="wizard-track" class="sd-row"></ol>
  <p id="wizard-deck" class="sd-note"></p>
  <div class="sd-row"><button type="button" id="wizard-reset">Start preview over</button> <span id="wizard-reset-note" class="sd-note" role="status"></span></div>`;

const swaps = (reward) => reward.map(([type, replaced, copies]) => `${TYPES[type].name} ×${copies} in place of ${TYPES[replaced].name} ×${copies}`).join(" and ");
const earned = (reward) => pays(reward.map(([type, , copies]) => [type, copies]));
const tileId = (id) => `wizard-duel-${id.replace(/^wizard:/, "")}`;

// root: an empty <details> element. preview: createWizardPreview(storage). track: WIZARD_TRACK.
// onDuel(id): start that preview duel. onCowboyCamp(): leave the direct preview for the Cowboy Camp.
export function mountWizardCamp(root, {preview, track, onDuel, onCowboyCamp, confirm = (text) => window.confirm(text)}) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);

  function render() {
    const progress = preview.progress();
    const list = preview.duels();
    const next = track[progress.wins];
    const grit = Math.min(progress.losses, GRIT_CAP);
    $("wizard-storage").hidden = preview.saved();
    $("wizard-next").innerHTML = next
      ? `Next: <strong>${next.name}</strong>. Win it to put ${swaps(next.reward)} into your Wizard deck${progress.wins + 1 < track.length ? `, then ${track[progress.wins + 1].name} opens` : ", then Open range opens"}. ${next.lesson}${
        grit ? ` Grit: your Base starts with ${5 + grit} orbs after your ${progress.losses > 1 ? "losses" : "loss"}.` : ""}`
      : "You have won all four Wizard duels, and the Dragon is in your deck. Next: <strong>Open range, Wizard seat</strong>, your final deck against the full Cowboy deck played with a plan. It pays nothing; play it to test the deck you earned.";
    $("wizard-track").innerHTML = list.map((duel) => {
      const step = track[duel.index];
      const note = !step ? (duel.state === "open" ? "Even match · pays nothing" : "Locked · after High Noon")
        : duel.state === "won" ? `Earned ${earned(step.reward)}` : duel.state === "locked" ? `Locked · win to earn ${earned(step.reward)}` : `Win to earn ${earned(step.reward)}`;
      return `<li><button type="button" class="sd-tile ${duel.state}" id="${tileId(duel.id)}" data-wizard-duel="${duel.id}"${duel.state === "open" ? "" : " disabled"}>
        <strong>${duel.state === "won" ? "✓ " : ""}${duel.name}</strong><span class="sd-note">${note}</span></button></li>`;
    }).join("");
    $("wizard-deck").innerHTML = `<strong>Wizard deck:</strong> ${Object.entries(progress.deck).map(([type, copies]) => `${TYPES[type].name} ×${copies}`).join(", ")}.`;
  }

  // mode "camp": collapsed inside the Camp; "direct": open on its own, with the way to the Cowboy Camp.
  function show(mode, {unlocked = true} = {}) {
    root.dataset.mode = mode;
    const direct = mode === "direct";
    root.hidden = !direct && !unlocked;
    root.querySelector("summary").hidden = direct;
    $("wizard-direct").hidden = !direct;
    if (direct) root.open = true;
    $("wizard-reset-note").textContent = "";
    render();
  }
  // Focus after a preview duel: the tile that started it, or the next open one when that is now won.
  function focus(id) {
    root.open = true;
    const usable = (selector) => root.querySelector(`${selector}:not(:disabled)`);
    (usable(`#${tileId(id)}`) ?? usable("[data-wizard-duel]") ?? $("wizard-reset")).focus();
  }

  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.wizardDuel) onDuel(b.dataset.wizardDuel);
    else if (b.id === "wizard-to-camp") onCowboyCamp();
    else if (b.id === "wizard-reset") {
      if (!confirm("Start the Wizard preview over? Its wins and the cards they put in your Wizard deck are erased. Your Cowboy career is not touched.")) return;
      const saved = preview.reset();
      render();
      $("wizard-reset-note").textContent = saved ? "Started over." : "Started over for this visit only: the browser did not save it.";
    }
  });
  return {show, focus};
}
