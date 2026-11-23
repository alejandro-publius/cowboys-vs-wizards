// Generic paired duel kit: input validation, outcome validation and mirrored seat counting.
// Every outcome here comes from a labelled fixture function of (seed, first); none is a real game result.
import assert from "node:assert/strict";
import test from "node:test";
import {DRAW, MAX_DEALS, PairedCohortError, measurePairedCohort} from "../../src/review/paired-duel-kit.js";

const SIDES = ["cowboy", "wizard"];
const other = (side, sides = SIDES) => (side === sides[0] ? sides[1] : sides[0]);
// Fixtures.
const firstAlwaysWins = (seed, first) => ({winner: first, endTurn: 3});
const secondAlwaysWins = (seed, first) => ({winner: other(first), endTurn: 4});
const sideAlwaysWins = (side) => () => ({winner: side, endTurn: 5});
const alwaysDraw = (winner) => () => ({winner, endTurn: 9});

const cohort = (over = {}) => ({firstSeed: 10, deals: 3, sides: [...SIDES], playBaseline: firstAlwaysWins, playCandidate: firstAlwaysWins, ...over});
const rejects = (input, pattern) => assert.throws(() => measurePairedCohort(input), (error) => error instanceof PairedCohortError && pattern.test(error.message));

test("rejects malformed cohort input", () => {
  rejects(null, /input must be an object/);
  rejects([], /input must be an object/);
  for (const firstSeed of [-1, 1.5, "1", NaN, undefined, Number.MAX_SAFE_INTEGER + 1]) rejects(cohort({firstSeed}), /firstSeed/);
  for (const deals of [0, -2, 2.5, "3", Infinity, MAX_DEALS + 1, undefined]) rejects(cohort({deals}), /deals/);
  rejects(cohort({firstSeed: Number.MAX_SAFE_INTEGER, deals: 2}), /seed range/);
  rejects(cohort({firstSeed: Number.MAX_SAFE_INTEGER - 1, deals: 3}), /seed range/);
  rejects(cohort({firstSeed: Number.MAX_SAFE_INTEGER - MAX_DEALS + 2, deals: MAX_DEALS}), /seed range/);
  for (const sides of [undefined, "cowboy,wizard", ["cowboy"], ["cowboy", "wizard", "ghost"]]) rejects(cohort({sides}), /exactly two/);
  for (const sides of [["cowboy", 1], ["Cowboy", "wizard"], ["", "wizard"], ["__proto__", "wizard"], ["cowboy", "has space"]]) rejects(cohort({sides}), /lowercase name/);
  rejects(cohort({sides: ["cowboy", "draw"]}), /reserved/);
  rejects(cohort({sides: ["cowboy", "cowboy"]}), /two different/);
  rejects(cohort({playBaseline: undefined}), /playBaseline/);
  rejects(cohort({playCandidate: {}}), /playCandidate/);
  rejects(cohort({onPair: "log"}), /onPair/);
});

test("rejects malformed outcomes and names the game and arm", () => {
  const bad = (outcome) => (seed, first) => (seed === 11 && first === "wizard" ? outcome : firstAlwaysWins(seed, first));
  const cases = [
    [undefined, /outcome must be an object/], [null, /outcome must be an object/], [["cowboy", 3], /outcome must be an object/],
    [{endTurn: 3}, /no winner/], [{winner: undefined, endTurn: 3}, /winner must be/], [{winner: "ghost", endTurn: 3}, /winner must be/],
    [{winner: "Cowboy", endTurn: 3}, /winner must be/], [{winner: "", endTurn: 3}, /winner must be/],
    [{winner: "cowboy"}, /endTurn/], [{winner: "cowboy", endTurn: 0}, /endTurn/], [{winner: "cowboy", endTurn: 2.5}, /endTurn/],
    [{winner: "cowboy", endTurn: "3"}, /endTurn/], [{winner: "cowboy", endTurn: NaN}, /endTurn/], [{winner: "cowboy", endTurn: -1}, /endTurn/],
    [Promise.resolve({winner: "cowboy", endTurn: 3}), /promise/],
  ];
  for (const [outcome, pattern] of cases) {
    rejects(cohort({playCandidate: bad(outcome)}), new RegExp(`seed 11, wizard first, candidate: .*${pattern.source}`));
    rejects(cohort({playBaseline: bad(outcome)}), new RegExp(`seed 11, wizard first, baseline: .*${pattern.source}`));
  }
});

test("accepts a seed range that ends exactly on the largest safe seed", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const seen = (firstSeed, deals) => { const seeds = []; measurePairedCohort(cohort({firstSeed, deals, onPair: (p) => seeds.push(p.seed)})); return seeds; };
  assert.deepEqual(seen(max, 1), [max, max]);
  assert.deepEqual(seen(max - 1, 2), [max - 1, max - 1, max, max]);
});

test("plays every seed once per opening seat, baseline then candidate, in stable order", () => {
  const calls = [], pairs = [];
  const record = (arm) => (seed, first) => { calls.push([arm, seed, first]); return firstAlwaysWins(seed, first); };
  measurePairedCohort(cohort({firstSeed: 7, deals: 2, playBaseline: record("baseline"), playCandidate: record("candidate"), onPair: (p) => pairs.push(p)}));
  assert.deepEqual(calls, [
    ["baseline", 7, "cowboy"], ["candidate", 7, "cowboy"], ["baseline", 7, "wizard"], ["candidate", 7, "wizard"],
    ["baseline", 8, "cowboy"], ["candidate", 8, "cowboy"], ["baseline", 8, "wizard"], ["candidate", 8, "wizard"],
  ]);
  assert.deepEqual(pairs.map((p) => [p.seed, p.first]), [[7, "cowboy"], [7, "wizard"], [8, "cowboy"], [8, "wizard"]]);
  assert.deepEqual(pairs[1], {seed: 7, first: "wizard", baseline: {winner: "wizard", endTurn: 3}, candidate: {winner: "wizard", endTurn: 3}});
  assert.ok(Object.isFrozen(pairs[0]) && Object.isFrozen(pairs[0].baseline));
});

test("mirrored seats: an opener advantage splits wins evenly between sides", () => {
  const r = measurePairedCohort(cohort({deals: 4, playBaseline: firstAlwaysWins, playCandidate: secondAlwaysWins}));
  assert.deepEqual(r, {
    gamesPerArm: 8,
    baseline: {wins: {cowboy: 4, wizard: 4}, draws: 0, firstWins: 8},
    candidate: {wins: {cowboy: 4, wizard: 4}, draws: 0, firstWins: 0},
    switchedWinners: 8,
  });
});

test("mirrored seats: a side advantage shows as half its games opened", () => {
  const r = measurePairedCohort(cohort({deals: 5, playBaseline: sideAlwaysWins("cowboy"), playCandidate: sideAlwaysWins("wizard")}));
  assert.deepEqual(r.baseline, {wins: {cowboy: 10, wizard: 0}, draws: 0, firstWins: 5});
  assert.deepEqual(r.candidate, {wins: {cowboy: 0, wizard: 10}, draws: 0, firstWins: 5});
  assert.equal(r.switchedWinners, 10);
});

test("null and 'draw' are the same genuine draw and never count as a first-seat win", () => {
  const pairs = [];
  const r = measurePairedCohort(cohort({deals: 2, playBaseline: alwaysDraw(null), playCandidate: alwaysDraw(DRAW), onPair: (p) => pairs.push(p)}));
  assert.deepEqual(r.baseline, {wins: {cowboy: 0, wizard: 0}, draws: 4, firstWins: 0});
  assert.deepEqual(r.candidate, r.baseline);
  assert.equal(r.switchedWinners, 0);
  assert.ok(pairs.every((p) => p.baseline.winner === DRAW && p.candidate.winner === DRAW));
});

test("switchedWinners counts only games whose winner changed, including to or from a draw", () => {
  // Fixture: candidate differs on seed 20 (cowboy first: draw) and seed 21 (wizard first: cowboy wins).
  const candidate = (seed, first) => (seed === 20 && first === "cowboy" ? {winner: null, endTurn: 6}
    : seed === 21 && first === "wizard" ? {winner: "cowboy", endTurn: 6} : firstAlwaysWins(seed, first));
  const r = measurePairedCohort(cohort({firstSeed: 20, deals: 3, playCandidate: candidate}));
  assert.equal(r.switchedWinners, 2);
  assert.deepEqual(r.candidate, {wins: {cowboy: 3, wizard: 2}, draws: 1, firstWins: 4});
  // A changed endTurn alone is not a switched winner.
  const longer = measurePairedCohort(cohort({playCandidate: (seed, first) => ({winner: first, endTurn: 30})}));
  assert.equal(longer.switchedWinners, 0);
});

test("is game-agnostic and deterministic for any two side names", () => {
  const sides = ["north", "south"];
  const fixture = (seed, first) => ({winner: seed % 3 === 0 ? null : seed % 2 ? first : other(first, sides), endTurn: 1 + (seed % 7)});
  const input = cohort({firstSeed: 0, deals: 12, sides, playBaseline: fixture, playCandidate: fixture});
  const a = measurePairedCohort(input), b = measurePairedCohort(input);
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a.baseline.wins), sides);
  assert.equal(a.baseline.wins.north + a.baseline.wins.south + a.baseline.draws, a.gamesPerArm);
  assert.equal(a.gamesPerArm, 24);
  assert.equal(a.switchedWinners, 0);
  rejects(cohort({sides, playBaseline: () => ({winner: "cowboy", endTurn: 2})}), /winner must be "north", "south"/);
});

test("does not alias the caller's sides array", () => {
  const sides = ["cowboy", "wizard"];
  const r = measurePairedCohort(cohort({sides, deals: 1, playBaseline: (seed, first) => { sides[1] = "ghost"; return firstAlwaysWins(seed, first); }}));
  assert.deepEqual(r.baseline.wins, {cowboy: 1, wizard: 1});
});
