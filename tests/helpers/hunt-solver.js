// Exhaustive search of a Wanted hunt for the tests and the evidence note.
// The Wizard only ends its phase, as in the graybox hunt. Each Cowboy plan
// is one list of plain action labels per round, e.g. "Ride Out lane 2 → 1".
import {applyAction} from "../../src/game/actions.js";
import {CARDS} from "../../src/game/cards.js";
import {legalActions} from "../../src/game/legal.js";

const lane = (slot) => slot + 1;
export function label(action) {
  if (action.type === "end-phase") return "End turn";
  if (action.type === "ride-out") return `Ride Out lane ${lane(action.slot)} → ${lane(action.destination)}`;
  if (action.type === "spell") return `${CARDS[action.cardId].name} Wizard lane ${lane(action.target)}`;
  const paid = action.tributes.length ? ` (tribute lane ${action.tributes.map(lane).join(", ")})` : "";
  return `Summon ${CARDS[action.cardId].name} lane ${lane(action.slot)}${paid}`;
}

// Applies one Cowboy plan; returns the final state.
export function playPlan(state, plan) {
  for (const round of plan) {
    for (const text of round) {
      const action = legalActions(state, "cowboy").find((each) => label(each) === text);
      if (!action) throw new Error(`"${text}" is not legal in round ${state.round}`);
      state = applyAction(state, action).state;
      if (state.result) return state;
    }
    while (!state.result && state.activeSide === "wizard") {
      state = applyAction(state, legalActions(state, "wizard").at(-1)).state;
    }
  }
  return state;
}

// Distinct plans (by label) that capture the boss within `clashes` clashes.
export function winningPlans(start, clashes) {
  const wins = new Map();
  function visit(state, plan, round) {
    if (state.result) {
      if (state.result.reason === "bounty-captured") wins.set(JSON.stringify(plan), plan);
      return;
    }
    if (state.activeSide === "wizard") {
      return visit(applyAction(state, legalActions(state, "wizard").at(-1)).state, plan, round);
    }
    if (state.round > clashes) return;
    const seen = new Set();
    for (const action of legalActions(state, "cowboy")) {
      const text = label(action);
      if (seen.has(text)) continue; // copies of one card play alike
      seen.add(text);
      const next = applyAction(state, action).state;
      const steps = [...round, text];
      if (action.type === "end-phase") visit(next, [...plan, steps], []);
      else if (next.result) visit(next, [...plan, steps], []);
      else visit(next, plan, steps);
    }
  }
  visit(start, [], []);
  return [...wins.values()];
}
