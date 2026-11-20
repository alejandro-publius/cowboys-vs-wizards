// Camp controls for the Outrider decision turns (K-011), added to the existing Experiment section.
// The list is what scripts/outrider-gate.mjs verified when the page was built (build-graybox.mjs defines
// __CVW_OUTRIDER__). An empty list, a stale claim or a page built without the gate shows no control and no link.
// Labels are neutral: no outcome, seed or recommendation.
/* global __CVW_OUTRIDER__ */
export const VERIFIED = typeof __CVW_OUTRIDER__ === "undefined" ? [] : __CVW_OUTRIDER__;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);

// Pure: the buttons for the verified list, or "" when there is none.
export function outriderControls(verified = VERIFIED) {
  if (!verified.length) return "";
  const label = (i) => (verified.length === 1 ? "Try an Outrider turn" : `Try Outrider turn ${LETTERS[i]}`);
  return `<div class="sd-row" id="camp-outrider">${verified.map((c, i) =>
    `<button type="button" id="camp-outrider-${i}" data-outrider="${esc(c.id)}">${label(i)}</button>`).join("")}</div>`;
}
