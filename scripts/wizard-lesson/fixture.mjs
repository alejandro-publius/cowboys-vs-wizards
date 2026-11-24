// SIMULATED lesson fixture for tests and the browser witness. No model and no Kiro process is involved: the
// "coach" is a fixed proposal, the "rival" is the first engine-found counterexample, and the "reviser" is the first
// policy on a fixed grid that passes verifyLessonBundle. Every receipt it makes carries fixture: "simulated" and
// run ids that start with "simulated-", and the app labels it as a simulated fixture. scripts/wizard-lesson/train.mjs
// never writes either marker. This is not evidence that a native Kiro lesson exists.
import {DEFAULT_LESSON_POLICY, compareAtMarkedTurn, validatePolicy, verifyLessonBundle} from "../../src/game/showdown/wizard-lesson-policy.js";
import {RECEIPT_SCHEMA, loadBait} from "./coach.mjs";
import {findCounterexamples, rivalSetup} from "./challenge.mjs";

// Proposals tried in order: the module's default one-target-vs-crowd hold, then a wider hold.
export const SIMULATED_PROPOSALS = Object.freeze([DEFAULT_LESSON_POLICY,
  validatePolicy({...DEFAULT_LESSON_POLICY, holdBelowTargets: 3})]);
const RUN_TIME = "2026-11-22T00:00:00.000Z";
const prov = (role) => ({tool: "kiro-cli", native: true, role, runId: `simulated-${role}`, model: "simulated", finishedAt: RUN_TIME});

function grid() {
  const out = [];
  for (const holdBelowTargets of [2, 3, 1]) for (let holdWhenMaxAttackAtMost = 10; holdWhenMaxAttackAtMost >= 0; holdWhenMaxAttackAtMost--) {
    for (let holdWhenBaseAtLeast = 1; holdWhenBaseAtLeast <= 10; holdWhenBaseAtLeast++) {
      out.push(validatePolicy({version: 1, kind: "wizard-hellfire-hold", holdBelowTargets, holdWhenBaseAtLeast, holdWhenMaxAttackAtMost, emergencyLethal: true}));
    }
  }
  return out;
}

// Returns {proposal, counterexample, revised, bundle, search} or null when the seed range holds no usable fixture.
export function simulatedLesson(bait, {seeds = {from: 0, to: 200}} = {}) {
  const {episode, key} = loadBait(bait);
  const searches = [];
  for (const proposal of SIMULATED_PROPOSALS) {
    if (compareAtMarkedTurn(episode, proposal).lesson.usedHellfire) continue;
    const {candidates, search} = findCounterexamples(proposal, {setup: rivalSetup(episode), seeds, maxCandidates: 2});
    searches.push({proposal, search});
    for (const counter of candidates) {
      for (const revised of grid()) {
        const bundle = {version: 1, episodeKey: key, source: "fresh", proposal: {policy: proposal, provenance: prov("coach")},
          counterexample: {episode: counter.episode, provenance: prov("rival")}, revised: {policy: revised, provenance: prov("reviser")}};
        const verdict = verifyLessonBundle(bundle, episode);
        if (verdict.ok) return {proposal, counterexample: counter, revised, bundle, report: verdict.report, searches};
      }
    }
  }
  return {none: true, searches};
}

// A wizard-lesson-receipt/2 that says, in three places, that it is simulated.
export function simulatedReceipt(fixture, episodeKey) {
  const run = (role) => ({role, agent: "simulated", runId: `simulated-${role}`, sessionId: null, model: "simulated", cli: "none", cliVersion: null,
    startedAt: RUN_TIME, finishedAt: RUN_TIME, durationMs: 0, exit: 0, error: null, promptSha256: null, outputSha256: null, outputBytes: 0});
  return {schema: RECEIPT_SCHEMA, fixture: "simulated", status: "validated", reasons: [], episodeKey, startedAt: RUN_TIME, finishedAt: RUN_TIME,
    limits: {maxNativeRuns: 0, maxRevisions: 0}, runs: ["coach", "rival", "reviser"].map(run),
    proposal: {policy: fixture.proposal, rationale: "simulated"}, counterexample: {id: fixture.counterexample.id, episodeKey: fixture.counterexample.episodeKey, claim: "simulated"},
    revised: {policy: fixture.revised, rationale: "simulated", attempt: 1}, verification: fixture.report, lesson: fixture.bundle};
}
