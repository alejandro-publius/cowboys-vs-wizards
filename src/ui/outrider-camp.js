// Camp entry for the Outrider decision turns (K-011), added to the existing Experiment section.
// The list is what scripts/outrider-gate.mjs verified when the page was built (build-graybox.mjs defines
// __CVW_OUTRIDER__ as {cases, camp}). The Camp shows one neutral control for the camp case; the Sheriff's Ledger
// links the curated pair. A stale claim or a page built without the gate shows no control and no link.
/* global __CVW_OUTRIDER__ */
const BUILT = typeof __CVW_OUTRIDER__ === "undefined" ? {cases: [], camp: null} : __CVW_OUTRIDER__;
export const VERIFIED = BUILT.cases;
export const CAMP_CASE = BUILT.camp;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);

// Pure: the one Camp button, or "" when the camp case is not verified.
export function outriderControls(verified = VERIFIED, camp = CAMP_CASE) {
  if (!camp || !verified.some((c) => c.id === camp)) return "";
  return `<div class="sd-row" id="camp-outrider"><button type="button" id="camp-outrider-turn" data-outrider="${esc(camp)}">Try an Outrider turn</button></div>`;
}
