// Seed 0 gives the same wounded Sheriff and open flank whenever this lesson starts.
// Replay the opening through the engine so the hand, health and draw order are real.
import {applyAction} from "../game/actions.js";
import {CARDS} from "../game/cards.js";
import {chooseAction} from "../game/cpu.js";
import {legalActions} from "../game/legal.js";
import {createMatch} from "../game/state.js";
import {publicState} from "../game/view.js";

export const RIDE_OUT_LESSON_SEED = 0;

export function createRideOutLesson() {
  let state = createMatch(RIDE_OUT_LESSON_SEED, {rideOut: true});
  function play(action) {
    const next = applyAction(state, action);
    if (!next.ok) throw new Error(`Ride Out lesson setup refused: ${next.reason}`);
    state = next.state;
  }
  play(legalActions(state, "cowboy").find((action) =>
    action.type === "summon" && action.slot === 1 && CARDS[action.cardId].name === "Sheriff"));
  play(legalActions(state, "cowboy").find((action) => action.type === "end-phase"));
  while (state.activeSide === "wizard") {
    play(chooseAction(publicState(state, "wizard")));
  }
  return state;
}
