// The Sheriff's Ledger in the Showdown Camp ("The Night Shift" loop): a collapsed, read-only view of the
// 29 catalog cards and the latest Night Watch check. Data is the checked-in payload from
// scripts/build-sheriffs-ledger.mjs; nothing here calls Crew or the network.
// Ruleset-wide numbers are labelled as such. A card shows its own result only when the payload holds per-card
// counts matched to the same run; otherwise it reads "Not observed" (or "Pending" when no run is recorded).
import {LEDGER} from "./sheriffs-ledger.data.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;
const short = (sha) => sha.slice(0, 7);
const SIDE = {cowboy: "Cowboy", wizard: "Wizard"};

// Pure: one row per catalog card, with the text each cell shows.
export function ledgerRows(ledger = LEDGER) {
  return ledger.cards.map((card) => ({
    type: card.type, name: card.name, side: card.side,
    detail: `${SIDE[card.side]} ${card.kind} · ${card.rarity}`,
    provenance: `Spec ${card.spec} · requirement ${card.requirement}`,
    starter: card.starter ? `${card.starter}` : "None",
    latest: card.latest ? `Side won ${card.latest.wins} of ${card.latest.games} (${pct(card.latest.wins, card.latest.games)}) at ${short(ledger.run.revision)}`
      : ledger.run ? "Not observed" : "Pending",
  }));
}

// Pure: the ruleset-wide line, or the pending note when no run is recorded.
export function rulesetSummary(ledger = LEDGER) {
  const r = ledger.run;
  if (!r) return "Pending: no Night Watch run is recorded for this ruleset.";
  return `Night Watch run ${r.id} (${r.trigger}), ${r.local}: commit ${short(r.revision)} against ${short(r.baseline)}, `
    + `seeds ${r.firstSeed}–${r.firstSeed + r.count - 1}, ${r.games.toLocaleString("en-US")} games, each deal played once with each side first. `
    + `First player won ${r.first.toLocaleString("en-US")} (${pct(r.first, r.games)}). Cowboys won ${r.cowboy.toLocaleString("en-US")} (${pct(r.cowboy, r.games)}). `
    + `Draws ${r.draw}. Rule tests passed: ${r.rulesTests}. Shift against the baseline: ${r.state}.`;
}

export function ledgerHtml(ledger = LEDGER) {
  const rows = ledgerRows(ledger);
  const observed = rows.filter((row) => ledger.cards.find((c) => c.type === row.type).latest).length;
  const r = ledger.run;
  return `<summary>Sheriff's Ledger <span class="sd-note">${ledger.catalog.count} cards · ${r ? `last check ${esc(r.state)} at ${short(r.revision)}` : "no check yet"}</span></summary>
  <h3 id="ledger-ruleset">Whole ruleset (not per card)</h3>
  <p id="ledger-run" class="sd-note">${esc(rulesetSummary(ledger))}</p>
  ${r ? `<p class="sd-note">Estimates for ${esc(r.bot)} on these seeds only. Commits after ${short(r.revision)} are not measured here. Method: <code>${esc(r.method)}</code>; records: <code>${esc(r.source)}</code>.</p>` : ""}
  <p class="sd-note">Engine properties tested over every card (<code>${esc(ledger.properties.source)}</code>):</p>
  <ul class="sd-ledger-props">${ledger.properties.list.map((p) => `<li><strong>${esc(p.id)}</strong> ${esc(p.title)}</li>`).join("")}</ul>
  <p class="sd-note">Each card has one spec under ${esc(ledger.requirement.id)} ${esc(ledger.requirement.title)} (<code>${esc(ledger.requirement.path)}</code>), checked by <code>${esc(ledger.requirement.check)}</code>. R1.1 marks the eight cards it names.</p>
  <h3 id="ledger-cards">Cards</h3>
  <p class="sd-note" id="ledger-per-card">${observed ? `Per-card results from <code>${esc(ledger.perCardSource)}</code>, matched to the run above.` : "No per-card results are recorded for this run, so every card reads Not observed."}</p>
  <div class="sd-ledger-wrap" role="region" aria-labelledby="ledger-cards" tabindex="0">
  <table class="sd-ledger-table"><thead><tr><th scope="col">Card</th><th scope="col">Starter deck</th><th scope="col">Latest result</th></tr></thead>
  <tbody>${rows.map((row) => `<tr class="${row.side}"><th scope="row"><strong>${esc(row.name)}</strong><span class="sd-type">${esc(row.detail)}</span><span class="sd-note sd-ledger-src">${esc(row.provenance)}</span></th><td>${esc(row.starter)}</td><td>${esc(row.latest)}</td></tr>`).join("")}</tbody></table>
  </div>`;
}

// Fills a <details> element once; it starts collapsed so it never covers the Trail or the first turn.
export function mountLedger(details, ledger = LEDGER) {
  if (!details) return;
  details.innerHTML = ledgerHtml(ledger);
  details.open = false;
}
