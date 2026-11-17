// The one reducer demonstration: disposable mutant M1 (see mutants.js), a generated
// failing walk, and its reduction. Independent of BOUNDARY_SEED so the committed
// receipt stays comparable. This verifies the harness; it reports no production bug.
import { applyAction } from "../../../src/game/actions.js";
import { buildFixtureWith } from "./generate.js";
import { applyM1DropsSecondTribute } from "./mutants.js";
import { hashSeed, makeRng } from "./rng.js";
import { MAX_CANDIDATES, generateFailingInput, reduce, runSequence, size } from "./shrink.js";

export const MUTANTS = { m1: applyM1DropsSecondTribute, real: applyAction };

export function buildShrinkDemo() {
  for (let index = 0; index < 500; index++) {
    const rng = makeRng(hashSeed("shrink-demo", index));
    const { state } = buildFixtureWith(rng, { fresh: true });
    const failing = generateFailingInput(rng, state, applyM1DropsSecondTribute);
    // Take the first generated failure that needs a multi-action walk, not the shortest one.
    if (!failing || failing.input.actions.length < 6) continue;
    const { minimized, evaluations, exhausted } = reduce(failing.input, failing.kind, applyM1DropsSecondTribute);
    const describe = (input) => ({
      size: size(input),
      mutantResult: (({ status, step, kind }) => ({ status, step, kind }))(runSequence(input, applyM1DropsSecondTribute)),
      originalEngineResult: runSequence(input, applyAction),
      input,
    });
    return {
      label: "HARNESS VERIFICATION: disposable test mutant M1, not a production bug",
      mutant: "M1 (tests/helpers/boundary-properties/mutants.js): a two-tribute summon loses its second tribute card from the discard",
      property: "conservation: each card in exactly one zone of its side (R1.6, R3.6)",
      generator: `buildFixtureWith + random legal walk, seed = hashSeed("shrink-demo", ${index})`,
      generatorIndex: index,
      violationKind: failing.kind,
      reducer: "greedy deletion to a fixpoint: actions, cards, troops; active side; base orbs to 5; troop health to 1",
      maxCandidates: MAX_CANDIDATES,
      evaluations,
      budgetExhausted: exhausted,
      original: describe(failing.input),
      minimized: describe(minimized),
    };
  }
  throw new Error("no multi-action failing walk found for the reducer demonstration");
}
