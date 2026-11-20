// Pure parts of scripts/night-review.mjs: finding validation, the one-number edit, paired
// comparison, the reviewer decision and the bundle seal. The full git/simulation path is
// exercised by the dry runs recorded in docs/evidence/night-shift-review.md.
import test from "node:test";
import assert from "node:assert/strict";
import {POLICY, bundleSealIntact, changeField, decide, findingProblems, paired, sealBundle, summarize} from "../../scripts/night-review.mjs";

const real = {mode: "showdown", firstSeed: 0, count: 1000, rules: {state: "passed", tests: 318},
  candidate: {commit: "3dd47f1fb668f1b42edd72b50c898a0b1e622d74", counts: {games: 2000, cowboy: 1188, wizard: 812, draw: 0, first: 1142, second: 858}}};

test("a Night Watch Showdown report with consistent counts is a usable finding", () => {
  assert.deepEqual(findingProblems(real), []);
});

test("fake or missing finding input is refused", () => {
  assert.notDeepEqual(findingProblems(null), []);
  assert.notDeepEqual(findingProblems({...real, mode: "lanes"}), []);
  assert.notDeepEqual(findingProblems({...real, rules: {state: "failed"}}), []);
  assert.notDeepEqual(findingProblems({...real, candidate: {...real.candidate, commit: "3dd47f1"}}), []);
  const counts = {...real.candidate.counts, cowboy: 1300};
  assert.match(findingProblems({...real, candidate: {...real.candidate, counts}}).join(), /does not equal games/);
  const {first, ...noFirst} = real.candidate.counts;
  assert.match(findingProblems({...real, candidate: {...real.candidate, counts: noFirst}}).join(), /first is missing/);
});

test("the candidate edit changes exactly one number and keeps the formatting", () => {
  const text = '{ "type": "cowboy-sheriff", "stars": 2, "health": 3, "attack": 1, "copies": 6, "showdown": { "rarity": "basic" } }\n';
  assert.equal(changeField(text, "health", 3, 2), text.replace('"health": 3', '"health": 2'));
  assert.throws(() => changeField(text, "health", 4, 2), /exactly one/);
  assert.throws(() => changeField(text, "health", 3, 3), /different/);
  assert.throws(() => changeField(text, "copies", 6, 5), /field must be/);
  assert.throws(() => changeField(text, "health", 3, 2.5), /whole number/);
});

const games = (winners) => winners.map((winner, i) => ({seed: i >> 1, first: i % 2 ? "wizard" : "cowboy", winner}));
const set = (base, cand) => ({baseline: summarize(games(base)), candidate: summarize(games(cand)), flips: paired(games(base), games(cand))});
const skewed = ["cowboy", "cowboy", "cowboy", "wizard"];
const better = ["cowboy", "cowboy", "wizard", "wizard"]; // Cowboy 50%, first seat 50%
const worse = ["cowboy", "cowboy", "cowboy", "cowboy"];
const passed = {baseline: {passed: true}, candidate: {passed: true}};
const ok = {reproduced: true, holdsAtBase: true};

test("paired comparison counts flips per game and refuses unpaired runs", () => {
  assert.deepEqual(paired(games(skewed), games(better)), {towardCowboy: 0, towardWizard: 1, other: 0, same: 3});
  assert.throws(() => paired(games(skewed), games(skewed).reverse()), /not paired/);
});

test("the reviewer accepts only a reproduced finding, passing properties and improvement on tune and holdout", () => {
  const accepted = decide({finding: ok, properties: passed, sets: {tune: set(skewed, better), holdout: set(skewed, better)}});
  assert.equal(accepted.verdict, "accepted");
  assert.match(accepted.meaning, /Fable\/Alex/);
  const cases = {
    "worse result": [{finding: ok, properties: passed, sets: {tune: set(skewed, better), holdout: set(skewed, worse)}}, /holdout: faction skew/],
    "no effect": [{finding: ok, properties: passed, sets: {tune: set(skewed, skewed), holdout: set(skewed, better)}}, /altered no game/],
    "failed property": [{finding: ok, properties: {...passed, candidate: {passed: false}}, sets: {tune: set(skewed, better), holdout: set(skewed, better)}}, /property/],
    "unreproduced finding": [{finding: {reproduced: false}, properties: passed, sets: {tune: set(skewed, better), holdout: set(skewed, better)}}, /did not reproduce/],
    "stale finding": [{finding: {reproduced: true, holdsAtBase: false}, properties: passed, sets: {tune: set(skewed, better), holdout: set(skewed, better)}}, /no longer hold/],
    "missing holdout": [{finding: ok, properties: passed, sets: {tune: set(skewed, better)}}, /no holdout/],
  };
  for (const [name, [input, reason]] of Object.entries(cases)) {
    const decision = decide(input);
    assert.equal(decision.verdict, "rejected", name);
    assert.match(decision.reasons.join("\n"), reason, name);
  }
  assert.equal(POLICY.seatTolerancePp, 1);
});

test("a growing first-seat skew beyond the tolerance rejects the candidate", () => {
  const seatSkewed = set(skewed, ["cowboy", "wizard", "cowboy", "wizard"]); // Cowboy 50%, but the first seat wins every game
  const decision = decide({finding: ok, properties: passed, sets: {tune: seatSkewed, holdout: seatSkewed}});
  assert.equal(decision.verdict, "rejected");
  assert.match(decision.reasons.join(), /first-seat skew grew/);
});

test("the bundle seal detects any edit", () => {
  const bundle = sealBundle({id: "x", decision: {verdict: "rejected"}, sets: {tune: {a: 1}}});
  assert.ok(bundleSealIntact(bundle));
  assert.ok(!bundleSealIntact({...bundle, decision: {verdict: "accepted"}}));
  assert.ok(!bundleSealIntact({...bundle, sets: {tune: {a: 2}}}));
});
