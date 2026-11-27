const LIMIT_MS = 60_000;
const SLOTS = 5;
const isBoolean = (value) => typeof value === "boolean";
const isTime = (value) => Number.isFinite(value) && value >= 0;
const isResolved = (trial) => trial.status === "complete" || trial.status === "abandoned";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function checkIdentity(kind, build) {
  requireValue(kind === "human" || kind === "synthetic", "Unknown cohort kind");
  requireValue(typeof build === "string" && /^[a-f0-9]{64}$/.test(build), "Expected the game HTML SHA-256");
}

function checkChoice(choice) {
  requireValue(choice && ["dragon-c5", "dragon-c5-70"].includes(choice.deal) &&
    ["dragon", "jack"].includes(choice.target), "Unknown Dragon choice");
}

function passes(trial) {
  return trial.outcome === "choice" && trial.explanation.trim() !== "" && !trial.assisted &&
    trial.freePractice && trial.fiveHuntWins;
}

function checkTrial(trial) {
  const {status, outcome, elapsedMs, choice, explanation, assisted, notes, freePractice, fiveHuntWins, passed} = trial;
  requireValue(["active", "interview", "rubric", "complete", "abandoned"].includes(status), "Unknown trial status");
  if (status === "active") {
    requireValue(outcome === null && elapsedMs === null && choice === null, "Active trial already has an outcome");
  } else {
    requireValue(status === "abandoned" ? outcome === "abandoned" : ["choice", "timeout", "miss"].includes(outcome),
      "Invalid trial outcome");
    requireValue(isTime(elapsedMs) || (status === "abandoned" && elapsedMs === null), "Invalid elapsed time");
    if (outcome === "choice") {
      checkChoice(choice);
      requireValue(elapsedMs <= LIMIT_MS, "Choice after the time limit");
    } else {
      requireValue(choice === null, "Only an accepted choice has a target");
      if (outcome === "timeout") requireValue(elapsedMs >= LIMIT_MS, "Timeout before the time limit");
      if (outcome === "miss") requireValue(elapsedMs <= LIMIT_MS, "Miss after the time limit");
    }
  }
  if (status === "rubric" || status === "complete") {
    requireValue(typeof explanation === "string" && isBoolean(assisted), "Missing locked interview");
    requireValue(notes === undefined || typeof notes === "string", "Invalid moderator notes");
  } else {
    requireValue(explanation === null && assisted === null && notes == null, "Interview recorded out of order");
  }
  if (status === "complete") {
    requireValue(isBoolean(freePractice) && isBoolean(fiveHuntWins) && passed === passes(trial), "Invalid grade");
  } else {
    requireValue(freePractice === null && fiveHuntWins === null && passed === (status === "abandoned" ? false : null),
      "Grade recorded out of order");
  }
}

export function newCohort(kind, build) {
  checkIdentity(kind, build);
  return {kind, build, trials: []};
}

// Trial fields are plain JSON so a moderator can resume after a reload.
export function enroll(cohort) {
  const {count} = summarize(cohort);
  requireValue(count === cohort.trials.length, "Finish the current trial first");
  requireValue(count < SLOTS, "All five slots have been used");
  const trial = {slot: count + 1, kind: cohort.kind, build: cohort.build, status: "active", outcome: null,
    elapsedMs: null, choice: null, explanation: null, assisted: null, notes: null, freePractice: null, fiveHuntWins: null, passed: null};
  cohort.trials.push(trial);
  return trial;
}

export function abandon(trial) {
  requireValue(trial.status === "active", "Only an active trial can be abandoned");
  Object.assign(trial, {status: "abandoned", outcome: "abandoned", elapsedMs: null, passed: false});
  return Object.freeze(trial);
}

export function stopTrial(trial, outcome, elapsedMs, choice = null) {
  requireValue(trial.status === "active", "Trial has already stopped");
  requireValue(["choice", "timeout", "miss", "abandoned"].includes(outcome), "Unknown stop outcome");
  requireValue(isTime(elapsedMs), "Expected nonnegative elapsed milliseconds");
  if (outcome === "choice") checkChoice(choice);
  else requireValue(choice === null, "Only a choice can include a target");
  if (outcome === "timeout") requireValue(elapsedMs >= LIMIT_MS, "Timeout before the time limit");
  if (elapsedMs > LIMIT_MS) outcome = "timeout";
  const accepted = outcome === "choice" ? Object.freeze({deal: choice.deal, target: choice.target}) : null;
  Object.assign(trial, {status: outcome === "abandoned" ? "abandoned" : "interview", outcome, elapsedMs, choice: accepted});
  if (outcome === "abandoned") {
    trial.passed = false;
    Object.freeze(trial);
  }
  return trial;
}

export function recordExplanation(trial, text, assisted, notes = "") {
  requireValue(trial.status === "interview", "Trial is not awaiting an explanation");
  requireValue(typeof text === "string" && isBoolean(assisted), "Expected verbatim text and a boolean assistance flag");
  requireValue(typeof notes === "string", "Expected moderator notes as text");
  return Object.assign(trial, {status: "rubric", explanation: text, assisted, notes});
}

export function grade(trial, freePractice, fiveHuntWins) {
  requireValue(trial.status === "rubric", "Record the explanation before grading");
  requireValue(isBoolean(freePractice) && isBoolean(fiveHuntWins), "Both rubric answers must be booleans");
  Object.assign(trial, {freePractice, fiveHuntWins, status: "complete"});
  trial.passed = passes(trial);
  return Object.freeze(trial);
}

export function summarize(cohort) {
  checkIdentity(cohort.kind, cohort.build);
  requireValue(Array.isArray(cohort.trials) && cohort.trials.length <= SLOTS, "Invalid cohort size");
  let count = 0, passed = 0;
  for (const [index, trial] of cohort.trials.entries()) {
    requireValue(trial?.slot === index + 1 && trial.build === cohort.build && trial.kind === cohort.kind,
      "Each slot must be unique, sequential and from the same cohort and build");
    checkTrial(trial);
    if (isResolved(trial)) {
      count++;
      if (trial.passed) passed++;
    } else {
      requireValue(index === cohort.trials.length - 1, "A later slot follows an unresolved trial");
    }
  }
  return {count, passed, verdict: count < SLOTS ? "pending" : passed >= 4 ? "pass" : "fail"};
}
