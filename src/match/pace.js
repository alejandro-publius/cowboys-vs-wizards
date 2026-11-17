// Opt-in pacing for ?pace=fast (issue #64). Only waits change; cue lengths,
// clash, result, damage and defeat pauses and event order are untouched.
// Only "fast" is recognised. Anything else returns {} so defaults apply.
export const FAST_PACE = Object.freeze({
  cpuDelay: 250,
  roundStart: 250,
  phaseStart: 150,
  phaseEnd: 80,
  // Proposed in #64 but not applied: the presenter's `pauses.draw` covers the
  // visible (450) and hidden (250) draw alike, so a single override would cut
  // the visible card flight to 120. Applying 300/120 needs a presenter change.
  drawHidden: 120,
  drawVisible: 300,
});

export function paceOptions(value) {
  if (value !== "fast") return {};
  return {
    cpuDelay: FAST_PACE.cpuDelay,
    pauses: {
      "round-start": FAST_PACE.roundStart,
      "phase-start": FAST_PACE.phaseStart,
      "phase-end": FAST_PACE.phaseEnd,
    },
  };
}
