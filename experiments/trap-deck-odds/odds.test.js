// Focused checks. Run: node --test experiments/trap-deck-odds/odds.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { DECKS, SIDES } from "../../src/game/cards.js";
import { MAX_ROUNDS as GAME_MAX_ROUNDS, OPENING_HAND as GAME_OPENING, createMatch } from "../../src/game/state.js";
import {
  DECK_SIZE, MAX_ROUNDS, OPENING_HAND, SCENARIOS, atLeastOne, choose, firstAt, firstInRound,
  frac, report, roundOfPosition, seenByRound, total,
} from "./odds.js";
import { firstTrapRound, sample, trapIdsFor } from "./sample.js";

const eq = (a, n, d) => assert.deepEqual(a, frac(n, d));

test("model constants match the shipped rules and decks", () => {
  assert.equal(OPENING_HAND, GAME_OPENING);
  assert.equal(MAX_ROUNDS, GAME_MAX_ROUNDS);
  for (const side of SIDES) assert.equal(DECKS[side].length, DECK_SIZE);
  assert.deepEqual([1, 2, 4, 6, 9].map(seenByRound), [4, 5, 7, 9, 12]);
  assert.deepEqual([1, 4, 5, 9, 12].map(roundOfPosition), [1, 1, 2, 6, 9]);
});

test("every scenario keeps 12 cards; T1 and T2 keep all troop counts", () => {
  for (const s of Object.values(SCENARIOS)) assert.equal(total(s), DECK_SIZE);
  for (const key of ["T1", "T2"]) {
    const { free, mid, legendary } = SCENARIOS[key];
    assert.deepEqual({ free, mid, legendary }, { free: 6, mid: 3, legendary: 1 });
  }
});

test("hypergeometric values, hand-checked", () => {
  assert.equal(choose(12, 4), 495n);
  eq(atLeastOne(12, 1, 4), 1, 3); // 4/12
  eq(atLeastOne(12, 2, 4), 19, 33); // 1 - 28/66
  eq(atLeastOne(12, 1, 5), 5, 12);
  eq(atLeastOne(12, 2, 7), 28, 33); // 1 - C(10,7)/C(12,7) = 1 - 120/792
  eq(atLeastOne(12, 2, 9), 21, 22);
});

test("first-appearance distributions sum to 1 and agree by position and by round", () => {
  for (const K of [1, 2]) {
    let pos = 0, rnd = 0;
    for (let p = 1; p <= DECK_SIZE; p++) pos += Number(firstAt(DECK_SIZE, K, p).n) / Number(firstAt(DECK_SIZE, K, p).d);
    for (let r = 1; r <= MAX_ROUNDS; r++) rnd += Number(firstInRound(DECK_SIZE, K, r).n) / Number(firstInRound(DECK_SIZE, K, r).d);
    assert.ok(Math.abs(pos - 1) < 1e-12 && Math.abs(rnd - 1) < 1e-12);
    assert.deepEqual(firstInRound(DECK_SIZE, K, 9), firstAt(DECK_SIZE, K, 12));
  }
});

test("too-late odds: round 9 first draw is 1/12 for one copy and impossible for two", () => {
  const t1 = report(SCENARIOS.T1), t2 = report(SCENARIOS.T2);
  eq(t1.tooLate, 1, 12);
  eq(t1.tooLateGivenNoneBy6, 1, 3);
  eq(t2.tooLate, 0, 1);
  eq(t2.onlyLastClash, 1, 66);
});

test("spell access: T1 halves spell copies, T2 removes them; spell-or-trap access is unchanged", () => {
  const base = report(SCENARIOS.baseline), t1 = report(SCENARIOS.T1), t2 = report(SCENARIOS.T2);
  eq(t1.spellBy[4], 7, 12);
  eq(t2.spellBy[9], 0, 1);
  for (const r of [1, 2, 4, 6, 9]) {
    assert.deepEqual(t1.tacticalBy[r], base.tacticalBy[r]);
    assert.deepEqual(t2.tacticalBy[r], base.tacticalBy[r]);
  }
  eq(t1.bothBy[1], 1, 11); // C(10,2)/C(12,4) = 45/495
  eq(report(SCENARIOS.TF).noFreeOpener, 7, 99); // free-opener risk of the text-only troop swap
  eq(base.noFreeOpener, 1, 33);
});

test("seeded sample uses the real shuffle and is deterministic", () => {
  assert.deepEqual(trapIdsFor("cowboy", 1), ["cowboy-deadeye-2"]);
  assert.deepEqual(trapIdsFor("wizard", 2), ["wizard-singularity-1", "wizard-singularity-2"]);
  // Seed 0 order from createMatch, recomputed by hand here.
  const { sides } = createMatch(0);
  for (const side of SIDES) {
    const order = [...sides[side].hand, ...sides[side].deck];
    const p = order.indexOf(trapIdsFor(side, 1)[0]) + 1;
    assert.equal(firstTrapRound(0, 1)[side], roundOfPosition(p));
  }
  assert.deepEqual(sample(2, 0, 300), sample(2, 0, 300));
  const hist = sample(1, 0, 300);
  for (const side of SIDES) assert.equal(hist[side][0], 0); // every trap is eventually drawn
});
