// Bounded failure reduction for Showdown inputs, with the same acceptance rule and
// candidate budget as ../shrink.js. A candidate is accepted only if
//   1. the real engine passes the property on it (so it is still legal play), and
//   2. the faulty engine fails the property with the same Violation kind.
// Moves, greedy to a fixpoint: cut the choices after the failing step, delete one choice,
// lower one choice (to 0, then halved), lower the seed, play the even match instead of the
// generated duel, and for property 7 fewer bot turns and level 0 bots. Choices index into
// legalActions modulo its length, so every candidate is legal play by construction.
// The result is locally minimal for these moves, not a global minimum.
import { MAX_CANDIDATES } from "../shrink.js";
import { Violation } from "../invariants.js";
import { ENGINE } from "./engine.js";

export { MAX_CANDIDATES };

// Runs one input. status "pass", or "violation" with its kind, failing step and message.
export function runInput(property, input, engine = ENGINE) {
  try {
    property.check(input, engine, new Set());
    return { status: "pass" };
  } catch (error) {
    if (!(error instanceof Violation)) return { status: "error", message: error.message };
    return { status: "violation", kind: error.kind, step: error.step ?? null, message: error.message };
  }
}

export const sizeOf = (input) => ({ choices: input.choices.length, turns: input.turns ?? 0, total: input.choices.length + (input.turns ?? 0) });

export function reduce(property, original, kind, makeFault) {
  let evaluations = 0;
  const failing = (candidate) => runInput(property, candidate, makeFault(ENGINE));
  const accepts = (candidate) => {
    if (evaluations >= MAX_CANDIDATES) return false;
    evaluations += 1;
    if (runInput(property, candidate).status !== "pass") return false;
    const under = failing(candidate);
    return under.status === "violation" && under.kind === kind;
  };
  if (!accepts(original)) throw new Error(`${property.id}: the original input does not fail as ${kind}`);
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
    const step = failing(current).step;
    if (step !== null && step + 1 < current.choices.length) changed = attempt((c) => { c.choices.length = Math.max(0, step + 1); }) || changed;
    for (let i = current.choices.length - 1; i >= 0; i--) changed = attempt((c) => { c.choices.splice(i, 1); }) || changed;
    for (let i = 0; i < current.choices.length; i++) {
      changed = attempt((c) => { if (c.choices[i] === 0) return false; c.choices[i] = 0; })
        || attempt((c) => { if (c.choices[i] < 2) return false; c.choices[i] = Math.floor(c.choices[i] / 2); }) || changed;
    }
    changed = attempt((c) => { if (c.seed === 0) return false; c.seed = 0; })
      || attempt((c) => { if (c.seed < 2) return false; c.seed = Math.floor(c.seed / 2); }) || changed;
    changed = attempt((c) => { if (c.duel === "even") return false; c.duel = "even"; c.options = {}; }) || changed;
    if (current.turns !== undefined) {
      changed = attempt((c) => { if (c.turns <= 1) return false; c.turns -= 1; }) || changed;
      for (const side of ["cowboy", "wizard"]) changed = attempt((c) => { if (c.levels[side] === 0) return false; c.levels[side] = 0; }) || changed;
    }
  }
  return { minimized: current, evaluations, exhausted: evaluations >= MAX_CANDIDATES };
}

// The first failing generated case for a property's fault, reduced: the committed receipt.
export function minimalCase(property, makeFault, inputFor) {
  for (let index = 0; index < property.cases; index++) {
    const input = inputFor(property, index);
    const under = runInput(property, input, makeFault(ENGINE));
    if (under.status !== "violation") continue;
    const { minimized, evaluations, exhausted } = reduce(property, input, under.kind, makeFault);
    return {
      property: property.id, fault: makeFault.name, index, kind: under.kind,
      originalSize: sizeOf(input), minimizedSize: sizeOf(minimized), evaluations, exhausted,
      minimized, realEngine: runInput(property, minimized), faultyEngine: runInput(property, minimized, makeFault(ENGINE)),
    };
  }
  return null;
}
