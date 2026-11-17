// DISPOSABLE HARNESS MUTANTS. These wrap the real applyAction in test code to
// check that the properties and the reducer can see a fault. They are not
// production bugs and nothing in src/ is changed or imported from here.
import { applyAction } from "../../../src/game/actions.js";
import { CARDS } from "../../../src/game/cards.js";
import { publicState } from "../../../src/game/view.js";
import { cpuFor } from "../../../src/game/cpu.js";

// M1: a two-tribute summon loses its second tribute card (it never reaches the discard).
export function applyM1DropsSecondTribute(state, action) {
  const result = applyAction(state, action);
  if (result.ok && action.type === "summon" && action.tributes.length === 2) result.state.sides[action.side].discard.pop();
  return result;
}

// M2: a rejection still advances the RNG, so a refused action leaves a trace.
export function applyM2RejectionTouchesRng(state, action) {
  const result = applyAction(state, action);
  return result.ok ? result : { ...result, state: { ...result.state, rng: result.state.rng + 1 } };
}

// M3: a Singularity aimed at a one-orb target with a destination is accepted (as a plain cast)
// instead of being rejected whole.
export function applyM3AcceptsDestinationForDefeatedTarget(state, action) {
  const result = applyAction(state, action);
  if (!result.ok && result.reason === "invalid-destination" && action.destination != null) {
    const target = state.sides[action.side === "cowboy" ? "wizard" : "cowboy"].board[action.target];
    if (target?.health === 1 && CARDS[action.cardId].relocates) {
      const { destination, ...plain } = action;
      return applyAction(state, plain);
    }
  }
  return result;
}

// M4: a clash that destroys both bases reports a Cowboy win instead of a draw.
export function applyM4MutualBaseZeroIsAWin(state, action) {
  const result = applyAction(state, action);
  if (result.ok && result.state.result?.reason === "base-destroyed" && result.state.result.winner === null) {
    result.state.result = { ...result.state.result, winner: "cowboy", loser: "wizard" };
  }
  return result;
}

// M5: an event carries a random stamp, so replaying the same log differs.
export function applyM5NondeterministicEvents(state, action) {
  const result = applyAction(state, action);
  if (result.ok) for (const event of result.events) event.stamp = Math.random();
  return result;
}

// M6 (CPU): a decider that reads the opponent's hidden hand and ends its phase when it holds a spell.
export const deciderM6PeeksAtEnemyHand = (level) => (state, side) => {
  const enemy = side === "cowboy" ? "wizard" : "cowboy";
  const view = publicState(state, side);
  const peek = state.sides[enemy].hand.some((id) => CARDS[id].kind === "spell");
  const choose = cpuFor(level);
  const decision = choose(view);
  return peek ? { type: "end-phase", side, revision: view.revision } : decision;
};
