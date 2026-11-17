// Bounded failure reduction for sequence inputs { state, actions }. An input
// is a legal starting state plus actions that carry no revision or ID (they
// are stamped on replay), so removing an action keeps the rest replayable.
//
// A candidate is accepted only if all of these hold:
//   1. its starting state satisfies checkState (explicit invariants);
//   2. the original engine accepts every action and holds every invariant;
//   3. the engine under test breaks the same invariant kind as the original.
// Reduction is greedy deletion to a fixpoint (actions, cards, troops), plus
// the active side, troop health to 1, within a fixed number of candidate evaluations. The
// result is locally minimal for these moves; it is not a global minimum.
import { applyAction } from "../../../src/game/actions.js";
import { legalActions } from "../../../src/game/legal.js";
import { SIDES } from "../../../src/game/cards.js";
import { Violation, checkState, expectedOf } from "./invariants.js";

export const MAX_CANDIDATES = 3000;

const stampAction = (action, i, revision) => ({ ...action, revision, actionId: `s-${i}` });

// Runs `input` on `apply`. status: "invalid-input", "rejected" (an action was refused),
// "violation" (an invariant broke after `step`), or "pass".
export function runSequence(input, apply) {
  let state = structuredClone(input.state);
  const expected = expectedOf(state);
  try { checkState(state, expected, "start"); } catch (error) {
    if (error instanceof Violation) return { status: "invalid-input", kind: error.kind };
    throw error;
  }
  for (const [step, action] of input.actions.entries()) {
    const result = apply(state, stampAction(action, step, state.revision));
    if (!result.ok) return { status: "rejected", step, reason: result.reason };
    state = result.state;
    try { checkState(state, expected, `step ${step}`); } catch (error) {
      if (error instanceof Violation) return { status: "violation", step, kind: error.kind, message: error.message };
      throw error;
    }
  }
  return { status: "pass" };
}

export function size(input) {
  const cards = SIDES.reduce((sum, side) => {
    const zone = input.state.sides[side];
    return sum + zone.deck.length + zone.hand.length + zone.discard.length + zone.board.filter(Boolean).length;
  }, 0);
  const troops = SIDES.reduce((sum, side) => sum + input.state.sides[side].board.filter(Boolean).length, 0);
  return { actions: input.actions.length, cards, troops, total: input.actions.length + cards };
}

// A random legal walk from `state` on the mutant: actions are chosen by the original engine's
// legal list and stop at the first invariant violation (the failing action is included).
export function generateFailingInput(rng, state, apply, limit = 60) {
  const actions = [];
  const expected = expectedOf(state);
  let current = structuredClone(state);
  for (let step = 0; step < limit && !current.result; step++) {
    const { revision, ...picked } = rng.pick(legalActions(current, current.activeSide));
    actions.push(picked);
    const result = apply(current, stampAction(picked, step, current.revision));
    if (!result.ok) return null;
    current = result.state;
    try { checkState(current, expected, `step ${step}`); } catch (error) {
      if (error instanceof Violation) return { input: { state: structuredClone(state), actions }, kind: error.kind };
      throw error;
    }
  }
  return null;
}

export function reduce(original, kind, apply) {
  let evaluations = 0;
  const accepts = (candidate) => {
    if (evaluations >= MAX_CANDIDATES) return false;
    evaluations += 1;
    const real = runSequence(candidate, applyAction);
    if (real.status !== "pass") return false;
    const under = runSequence(candidate, apply);
    return under.status === "violation" && under.kind === kind;
  };
  if (!accepts(original)) throw new Error("the original input does not fail for the stated kind");
  evaluations = 0;

  let current = structuredClone(original);
  const attempt = (edit) => {
    const candidate = structuredClone(current);
    if (edit(candidate) === false) return false;
    if (!accepts(candidate)) return false;
    current = candidate;
    return true;
  };
  let changed = true;
  while (changed && evaluations < MAX_CANDIDATES) {
    changed = false;
    const failing = runSequence(current, apply).step;
    if (failing + 1 < current.actions.length) changed = attempt((c) => { c.actions.length = failing + 1; }) || changed;
    for (let i = current.actions.length - 1; i >= 0; i--) changed = attempt((c) => { c.actions.splice(i, 1); }) || changed;
    // Hand the phase to the first remaining action's side, so the actions that only passed the turn can go.
    changed = attempt((c) => { const first = c.actions[0]?.side; if (!first || c.state.activeSide === first) return false; c.state.activeSide = first; }) || changed;
    for (const side of SIDES) {
      // Full bases keep clashes from ending the match, which lets turn-passing actions be dropped.
      changed = attempt((c) => { if (c.state.sides[side].baseOrbs === 5) return false; c.state.sides[side].baseOrbs = 5; }) || changed;
      for (const zone of ["deck", "hand", "discard"]) {
        for (let i = current.state.sides[side][zone].length - 1; i >= 0; i--) changed = attempt((c) => { c.state.sides[side][zone].splice(i, 1); }) || changed;
      }
      for (let slot = 0; slot < 3; slot++) {
        changed = attempt((c) => { if (c.state.sides[side].board[slot] === null) return false; c.state.sides[side].board[slot] = null; }) || changed;
        changed = attempt((c) => { const t = c.state.sides[side].board[slot]; if (!t || t.health === 1) return false; t.health = 1; }) || changed;
      }
    }
  }
  return { minimized: current, evaluations, exhausted: evaluations >= MAX_CANDIDATES };
}
