// One board for comparing current Ride Out with the cover-swap variant
// (docs/evidence/fable-cover-swap.md). Seed 162 under current Ride Out rules,
// both sides played by the Normal CPU, stopped at the Cowboy's round-six turn:
// a wounded Sheriff faces a Wizard next to a healthier Billy facing a weak
// Skeleton. The Cowboy acts second that round, so End turn resolves the clash.
// The opening is the same for both variants; `swap` only sets the rule in force
// from this turn on.
import {applyAction} from "../game/actions.js";
import {chooseAction} from "../game/cpu.js";
import {createMatch} from "../game/state.js";
import {publicState} from "../game/view.js";

export const COVER_LESSON_SEED = 162;
const COVER_LESSON_ROUND = 6;

export function createCoverLesson({swap = false} = {}) {
  let state = createMatch(COVER_LESSON_SEED, {rideOut: true});
  while (!(state.round === COVER_LESSON_ROUND && state.activeSide === "cowboy")) {
    const next = applyAction(state, chooseAction(publicState(state, state.activeSide)));
    if (!next.ok || next.state.result) throw new Error("Cover lesson setup did not reach its board.");
    state = next.state;
  }
  return {...state, rideOut: createMatch(COVER_LESSON_SEED, {rideOut: true, rideSwap: swap}).rideOut};
}
