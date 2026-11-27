import assert from "node:assert/strict";
import test from "node:test";
import {abandon, enroll, grade, newCohort, recordExplanation, stopTrial, summarize} from "./study.js";

const build = "a1".repeat(32);
const choice = {deal: "dragon-c5", target: "jack"};
const quote = "  It was free. I would need five hunt wins to keep it.  ";
const fresh = () => newCohort("synthetic", build);

function complete(cohort, {elapsed = 15_000, text = quote, assisted = false, practice = true, wins = true} = {}) {
  const trial = enroll(cohort);
  stopTrial(trial, "choice", elapsed, choice);
  recordExplanation(trial, text, assisted);
  return grade(trial, practice, wins);
}

test("records the first accepted choice, locks the verbatim answer before grading and closes the slot", () => {
  const cohort = fresh();
  const trial = enroll(cohort);
  assert.deepEqual([trial.slot, trial.kind, trial.build, trial.status], [1, "synthetic", build, "active"]);
  assert.throws(() => grade(trial, true, true));
  assert.throws(() => enroll(cohort));
  const selected = {...choice};
  stopTrial(trial, "choice", 60_000, selected);
  selected.target = "dragon";
  assert.deepEqual(trial.choice, choice);
  assert.equal(trial.elapsedMs, 60_000);
  assert.throws(() => { trial.choice.target = "dragon"; });
  assert.throws(() => stopTrial(trial, "choice", 59_999, selected));
  assert.throws(() => grade(trial, true, true));
  recordExplanation(trial, quote, false);
  assert.equal(trial.explanation, quote);
  assert.equal(trial.notes, "");
  assert.throws(() => recordExplanation(trial, "replacement", true));
  assert.throws(() => enroll(cohort));
  assert.equal(grade(trial, true, true).passed, true);
  assert.throws(() => grade(trial, false, false));
  assert.throws(() => { trial.slot = 2; });
  assert.deepEqual(summarize(cohort), {count: 1, passed: 1, verdict: "pending"});
});

test("a late choice times out and a timely miss stays a miss even with a correct quote", () => {
  const cohort = fresh();
  for (const [outcome, elapsed, target, expected] of [
    ["choice", 60_000.01, choice, "timeout"], ["timeout", 60_000, null, "timeout"], ["miss", 4_000, null, "miss"],
  ]) {
    const trial = enroll(cohort);
    stopTrial(trial, outcome, elapsed, target);
    assert.deepEqual([trial.status, trial.outcome, trial.elapsedMs, trial.choice], ["interview", expected, elapsed, null]);
    recordExplanation(trial, quote, false);
    assert.equal(grade(trial, true, true).passed, false);
  }
});

test("every individual passing condition is required and a blank quote is a recorded nonanswer", () => {
  const cohort = fresh();
  for (const options of [{text: ""}, {text: "  \n"}, {assisted: true}, {practice: false}, {wins: false}]) {
    assert.equal(complete(cohort, options).passed, false);
  }
  assert.deepEqual(summarize(cohort), {count: 5, passed: 0, verdict: "fail"});
});

test("interruption costs its slot while stopped trials resume at their saved interview stage", () => {
  const cohort = fresh();
  const first = abandon(enroll(cohort));
  assert.deepEqual([first.status, first.outcome, first.elapsedMs, first.passed], ["abandoned", "abandoned", null, false]);
  const second = stopTrial(enroll(cohort), "abandoned", 2100);
  assert.deepEqual([second.elapsedMs, second.passed], [2100, false]);
  stopTrial(enroll(cohort), "choice", 29_900, {deal: "dragon-c5-70", target: "dragon"});
  const resumed = JSON.parse(JSON.stringify(cohort));
  assert.deepEqual(summarize(resumed), {count: 2, passed: 0, verdict: "pending"});
  const interview = resumed.trials[2];
  assert.equal(interview.status, "interview");
  assert.throws(() => abandon(interview));
  const notes = "Paused at the bounty poster.\nContinued without a hint.";
  recordExplanation(interview, quote, false, notes);
  const reopened = JSON.parse(JSON.stringify(resumed));
  const rubric = reopened.trials[2];
  assert.equal(rubric.status, "rubric");
  assert.deepEqual([rubric.explanation, rubric.notes], [quote, notes]);
  assert.throws(() => recordExplanation(rubric, quote, false, "Replacement"));
  assert.equal(grade(rubric, true, true).passed, true);
  assert.equal(rubric.notes, notes);
  assert.equal(enroll(reopened).slot, 4);
});

test("the gate uses five resolved slots and does not replace a failed or abandoned slot", () => {
  for (const winners of [3, 4, 5]) {
    const cohort = newCohort("human", build);
    for (let i = 0; i < 5; i++) {
      if (i < winners) complete(cohort);
      else abandon(enroll(cohort));
      if (i < 4) assert.equal(summarize(cohort).verdict, "pending");
    }
    assert.deepEqual(summarize(cohort), {count: 5, passed: winners, verdict: winners >= 4 ? "pass" : "fail"});
    assert.throws(() => enroll(cohort));
  }
});

test("rejects bad identity, timing, targets and nonboolean scores without advancing the trial", () => {
  assert.throws(() => newCohort("unknown", build));
  for (const bad of [null, 123, build.slice(1), build.toUpperCase()]) assert.throws(() => newCohort("human", bad));
  const trial = enroll(fresh());
  for (const args of [
    ["choice", -1, choice], ["choice", NaN, choice], ["choice", Infinity, choice], ["choice", null, choice],
    ["choice", 42, null], ["choice", 42, {...choice, deal: "wrong"}], ["choice", 42, {...choice, target: "base"}],
    ["other", 30], ["miss", 50, choice], ["timeout", 59_999],
  ]) assert.throws(() => stopTrial(trial, ...args));
  assert.equal(trial.status, "active");
  stopTrial(trial, "choice", 42, choice);
  assert.throws(() => recordExplanation(trial, true, false));
  assert.throws(() => recordExplanation(trial, quote, "no"));
  assert.throws(() => recordExplanation(trial, quote, false, null));
  recordExplanation(trial, quote, false);
  for (const bad of [null, 1, "yes", undefined]) {
    assert.throws(() => grade(trial, bad, true));
    assert.throws(() => grade(trial, true, bad));
  }
  assert.equal(trial.status, "rubric");
});

test("rejects malformed restored cohorts, including duplicate slots, mixed builds/kinds and invented passes", () => {
  const cohort = fresh();
  complete(cohort);
  complete(cohort);
  for (const corrupt of [
    t => { t.slot = 1; }, t => { t.slot = 3; }, t => { t.kind = "human"; }, t => { t.build = "b".repeat(64); },
    t => { t.status = "rubric"; }, t => { t.fiveHuntWins = null; }, t => { t.explanation = ""; },
    t => { t.assisted = true; }, t => { t.elapsedMs = 65_000; }, t => { t.notes = 2; },
  ]) {
    const forged = structuredClone(cohort);
    corrupt(forged.trials[1]);
    assert.throws(() => summarize(forged));
    assert.throws(() => enroll(forged));
  }
  const outOfOrder = structuredClone(cohort);
  outOfOrder.trials[0] = enroll(fresh());
  assert.throws(() => summarize(outOfOrder));
});
