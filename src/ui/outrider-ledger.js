// K-011: the Outrider section inside the collapsed Sheriff's Ledger. Its data is assembled at build time by
// scripts/outrider-ledger.mjs (build-graybox.mjs defines __CVW_OUTRIDER_LEDGER__) and carries measured results
// only when the gate found both curated cases fresh. Before the reader presses "Show the measured comparison" the
// section shows only the two public positions, their status and the Night Watch identity: no result, score or advice.
/* global __CVW_OUTRIDER_LEDGER__ */
export const OUTRIDER_LEDGER = typeof __CVW_OUTRIDER_LEDGER__ === "undefined"
  ? {status: "missing", statusText: "This page was built without the Outrider gate, so there is nothing to compare.", positions: [], nightWatch: null}
  : __CVW_OUTRIDER_LEDGER__;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const short = (sha) => String(sha).slice(0, 7);
const SIDE = {cowboy: "Cowboys", wizard: "Wizards", draw: "Draw"};

// Pure: the Night Watch relationship line, or null without a receipt.
export function nightWatchLine(section = OUTRIDER_LEDGER) {
  const nw = section.nightWatch;
  if (!nw) return null;
  const head = `Night Watch receipt ${nw.source}, ${nw.local} (${nw.trigger}): commit ${short(nw.commit)}, rules blob ${short(nw.rulesBlob)}, `
    + `${nw.bot}, seeds ${nw.seeds.from}–${nw.seeds.to}, ${nw.games.toLocaleString("en-US")} games. It measures the whole ruleset, not this move.`;
  const e = nw.engine;
  if (!e?.checked) return `${head} Its engine could not be compared with this build: ${e?.reason ?? "unknown"}.`;
  const same = e.same ? `The ${e.files} engine files it ran are byte-identical in this build${nw.rulesBlobMatch ? ", and its rules blob matches" : ""}.`
    : `Its engine differs from this build in ${e.differ.join(", ")}, so its numbers describe the earlier rules.`;
  const extra = e.notMeasured.length ? ` The Outrider positions also run through ${e.notMeasured.join(", ")}, which that run did not exercise.` : "";
  return `${head} ${same}${extra}`;
}

// Pure: the result lines for the revealed comparison; [] unless the section is fresh.
export function comparisonLines(section = OUTRIDER_LEDGER) {
  if (section.status !== "fresh") return [];
  return section.positions.map(({id, label}) => { const r = section.results[id];
    return `${label}: ride to the Base, ${SIDE[r.ride.winner]} won on turn ${r.ride.turn}; fight the troop, ${SIDE[r.fight.winner]} won on turn ${r.fight.turn}.`; });
}

// Pure: what the search found overall and its limits; null unless fresh.
export function researchLine(section = OUTRIDER_LEDGER) {
  const r = section.status === "fresh" ? section.research : null;
  if (!r) return null;
  const h = r.holdout;
  return `These two were picked as one of each kind from ${r.rideOnly + r.fightOnly} measured reversals (${r.rideOnly} won only by riding, `
    + `${r.fightOnly} only by fighting) among ${r.reached} decisions reached in ${r.tried} seeds. Each result depends on every later move: a fixed `
    + `greedy Cowboy policy and the Trail's level-0 Wizard bot played the rest, so other later moves can change it. The pre-registered cue `
    + `(${r.cue}, from seeds ${r.derivedOn}: ${r.fit.correct} of ${r.fit.flips}) was right in ${h.correct} of ${h.flips} fresh reversals on the unused `
    + `seeds ${h.range}, against ${h.alwaysRide} of ${h.flips} for always riding: ${h.supported ? "supported" : "unsupported"}. No general rule is proven.`;
}

export function outriderLedgerHtml(section = OUTRIDER_LEDGER, verified = []) {
  const linkable = new Set(verified.map((c) => c.id));
  const nw = nightWatchLine(section);
  const positions = section.positions.map((p) => `<li data-position="${esc(p.label)}"><strong>${esc(p.label)}</strong>, your turn ${p.turn}. `
    + `Bases: yours ${p.bases.cowboy}, theirs ${p.bases.wizard}. Your board: ${esc(p.cowboy)}. Their board: ${esc(p.wizard)}.`
    + `${linkable.has(p.id) ? ` <button type="button" data-outrider="${esc(p.id)}">Open ${esc(p.label)}</button>` : ""}</li>`).join("");
  const reveal = section.status === "fresh"
    ? `<p><button type="button" id="ledger-outrider-reveal" aria-expanded="false" aria-controls="ledger-outrider-results">Show the measured comparison</button></p>
  <div id="ledger-outrider-results" hidden></div>` : "";
  return `<h3 id="ledger-outrider-title">Outrider experiment (for review, not advice)</h3>
  <p class="sd-note" id="ledger-outrider-status" role="status" data-status="${esc(section.status)}">${esc(section.statusText)}</p>
  ${positions ? `<p class="sd-note">The Outrider may attack the Wizard Base past their troops, or attack a troop.</p><ul class="sd-ledger-props" id="ledger-outrider-positions">${positions}</ul>` : ""}
  ${reveal}
  ${nw ? `<p class="sd-note" id="ledger-outrider-nightwatch">${esc(nw)}</p>` : ""}
  ${section.record ? `<p class="sd-note">Every measured case: <code>${esc(section.record)}</code>. Fable decides whether any of this becomes advice or a bounty.</p>` : ""}`;
}

// Fills the results only when the reader asks; nothing is in the DOM before that.
export function wireReveal(root, section = OUTRIDER_LEDGER) {
  if (typeof root?.querySelector !== "function") return;
  const button = root.querySelector("#ledger-outrider-reveal");
  const box = root.querySelector("#ledger-outrider-results");
  if (!button || !box) return;
  button.addEventListener("click", () => {
    if (box.hidden) {
      const research = researchLine(section);
      box.innerHTML = `<ul class="sd-ledger-props">${comparisonLines(section).map((line) => `<li>${esc(line)}</li>`).join("")}</ul>`
        + (research ? `<p class="sd-note">${esc(research)}</p>` : "");
    } else box.innerHTML = "";
    box.hidden = !box.hidden;
    button.setAttribute("aria-expanded", String(!box.hidden));
    button.textContent = box.hidden ? "Show the measured comparison" : "Hide the measured comparison";
  });
}
