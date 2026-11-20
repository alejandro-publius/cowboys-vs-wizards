// Pure parts of scripts/night-review.mjs: finding validation, the one-number edit, paired
// comparison, the reviewer decision and the bundle seal. The full git/simulation path is
// exercised by the dry runs recorded in docs/evidence/night-shift-review.md.
import test from "node:test";
import assert from "node:assert/strict";
import {PACKAGE_POLICY, POLICY, bundleSealIntact, changeField, decide, decidePackage, findingProblems, paired, sealBundle, summarize, trailDeltas, trailTable} from "../../scripts/night-review.mjs";

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

// Rules-package review (night-review/package@1). Synthetic numbers; no measured result is implied.
const share = (firstShare, cowboyShare) => ({candidate: {firstShare, cowboyShare}});
const trailOf = (rows, deals = 100) => ({deals, rows: rows.map(([label, id, wins]) => ({label, id, wins}))});
const testsOk = {baseline: {passed: true}, candidate: {passed: true}};
const steadyTrail = trailDeltas(trailOf([["Trail 1", "trail", [50, 60, 70]], ["Open range", "open", [10, 14, 65]]]),
  trailOf([["Trail 1", "trail", [52, 60, 67]], ["Open range", "open", [10, 14, 52]]]));

test("the package gate passes only inside Fable's band on both sets with a steady Trail", () => {
  const input = {tests: testsOk, entry: {consistent: true}, sets: {tune: share(49.5, 51.8), holdout: share(51.4, 54.1)}, trail: steadyTrail};
  const passed = decidePackage(input);
  assert.equal(passed.verdict, "passed");
  assert.match(passed.meaning, /not a release approval/);
  assert.equal(steadyTrail.maxGatedMovePp, 3);
  assert.equal(steadyTrail.maxMovePp, 13, "the Open range move is reported");
  const cases = {
    "holdout Cowboy share above the band": [{...input, sets: {...input.sets, holdout: share(51.4, 55.1)}}, /holdout: Cowboy share 55\.10% is outside 45–55%/],
    "tune first share below the band": [{...input, sets: {...input.sets, tune: share(44.9, 50)}}, /tune: first player share 44\.90%/],
    "missing holdout": [{...input, sets: {tune: input.sets.tune}}, /no holdout results/],
    "Trail move over three points": [{...input, trail: trailDeltas(trailOf([["Trail 1", "trail", [50, 60, 70]]]), trailOf([["Trail 1", "trail", [50, 64, 70]]]))}, /Trail 1, level 1: 60\.0% -> 64\.0%/],
    "Trail rows differ": [{...input, trail: trailDeltas(trailOf([["Trail 1", "trail", [1, 1, 1]]]), trailOf([["Trail 2", "trail", [1, 1, 1]]]))}, /rows differ/],
    "candidate tests fail": [{...input, tests: {...testsOk, candidate: {passed: false, failed: ["cover"]}}}, /candidate tests failed: cover/],
    "measured setup is not the Open range": [{...input, entry: {consistent: false}}, /Open range setup/],
  };
  for (const [name, [args, reason]] of Object.entries(cases)) {
    const decision = decidePackage(args);
    assert.equal(decision.verdict, "failed", name);
    assert.match(decision.reasons.join("\n"), reason, name);
    assert.match(decision.meaning, /Do not retune/, name);
  }
  assert.deepEqual([PACKAGE_POLICY.band, PACKAGE_POLICY.trailTolerancePp], [[45, 55], 3]);
});

test("the Trail table shows before, after and the move per level", () => {
  const text = trailTable(steadyTrail);
  assert.match(text, /Trail 1\s+50\.0%\s+52\.0% \+2\.0/);
  assert.match(text, /limit 3\); including the Open range .*: 13\.0 points/);
});
