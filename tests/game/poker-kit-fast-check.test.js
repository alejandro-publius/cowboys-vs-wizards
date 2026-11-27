// Fast-check properties for Boot Hill Poker, seeded RNG, paired cohort kit, Wilson CIs, and NSB balance math (PROP-066..PROP-085).
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  HAND_SIZE,
  SEATS,
  STRATEGIES,
  chooseDiscards,
  compareHands,
  evaluateHand,
  isCard,
  makeDeck,
  newDeal,
  nextDeal,
  nextSeed,
  normalizeSeed,
  otherSeat,
  playPokerDuel,
  rankValue,
  replayDeal,
  shuffleDeck,
  submitDraw,
  toggleDiscard,
  viewState,
} from "../../experiments/boot-hill-poker/engine.js";
import {DRAW, PairedCohortError, measurePairedCohort} from "../../packages/frontier-kit/index.js";
import {mulberry32} from "../../packages/frontier-kit/seeded-rng.js";
import {wilson} from "../../scripts/balance-evidence.mjs";
import {evaluateBalanceRequirements, loadBalanceContract} from "../../scripts/showdown-balance-contract.mjs";
import {assertProp} from "../helpers/dec4-prop-harness.js";

const FILE = "tests/game/poker-kit-fast-check.test.js";
const FULL_DECK = makeDeck();

const handArb = fc.shuffledSubarray(FULL_DECK, {minLength: HAND_SIZE, maxLength: HAND_SIZE});

test("PROP-066: mulberry32 deterministically emits floats strictly inside [0, 1)", () => {
  assertProp("PROP-066", FILE, fc.property(fc.integer({min: -0x80000000, max: 0x7fffffff}), fc.integer({min: 1, max: 25}), (seed, count) => {
    const a = mulberry32(seed >>> 0);
    const b = mulberry32(seed >>> 0);
    for (let i = 0; i < count; i += 1) {
      const va = a();
      const vb = b();
      assert.equal(va, vb);
      assert.ok(va >= 0 && va < 1);
    }
  }));
});

test("PROP-067: normalizeSeed maps numbers, integer strings, and text to uint32 deterministically", () => {
  assertProp("PROP-067", FILE, fc.property(fc.integer({min: -1000000, max: 1000000}), fc.string({maxLength: 30}), (num, text) => {
    const n1 = normalizeSeed(num);
    const n2 = normalizeSeed(String(num));
    assert.equal(n1, n2);
    assert.ok(Number.isInteger(n1) && n1 >= 0 && n1 <= 0xffffffff);
    const t1 = normalizeSeed(text);
    const t2 = normalizeSeed(text);
    assert.equal(t1, t2);
    assert.ok(Number.isInteger(t1) && t1 >= 0 && t1 <= 0xffffffff);
  }));
});

test("PROP-068: shuffleDeck produces a deterministic 52-card bijection of makeDeck", () => {
  assertProp("PROP-068", FILE, fc.property(fc.oneof(fc.integer(), fc.string({maxLength: 20})), (seed) => {
    const d1 = shuffleDeck(seed);
    const d2 = shuffleDeck(seed);
    assert.deepEqual(d1, d2);
    assert.equal(d1.length, 52);
    assert.ok(d1.every(isCard));
    assert.deepEqual([...d1].sort(), [...FULL_DECK].sort());
  }));
});

test("PROP-069: evaluateHand is invariant under all 5-card permutations", () => {
  assertProp("PROP-069", FILE, fc.property(handArb, fc.shuffledSubarray([0, 1, 2, 3, 4], {minLength: 5, maxLength: 5}), (hand, order) => {
    const permuted = order.map((i) => hand[i]);
    const reversed = [...hand].reverse();
    const e0 = evaluateHand(hand);
    const e1 = evaluateHand(permuted);
    const e2 = evaluateHand(reversed);
    assert.deepEqual([e1.category, e1.ranks, e1.wheel, e1.label], [e0.category, e0.ranks, e0.wheel, e0.label]);
    assert.deepEqual([e2.category, e2.ranks, e2.wheel, e2.label], [e0.category, e0.ranks, e0.wheel, e0.label]);
  }));
});

test("PROP-070: evaluateHand and compareHands are invariant under suit permutations", () => {
  const suitPermArb = fc.shuffledSubarray(["S", "H", "D", "C"], {minLength: 4, maxLength: 4});
  assertProp("PROP-070", FILE, fc.property(handArb, suitPermArb, (hand, perm) => {
    const map = {S: perm[0], H: perm[1], D: perm[2], C: perm[3]};
    const relabeled = hand.map((c) => c[0] + map[c[1]]);
    const eOrig = evaluateHand(hand);
    const eRel = evaluateHand(relabeled);
    assert.deepEqual([eOrig.category, eOrig.ranks, eOrig.wheel, eOrig.label], [eRel.category, eRel.ranks, eRel.wheel, eRel.label]);
    assert.equal(compareHands(eOrig, eRel), 0);
  }));
});

test("PROP-071: compareHands forms a total preorder (reflexive, antisymmetric, transitive)", () => {
  assertProp("PROP-071", FILE, fc.property(handArb, handArb, handArb, fc.boolean(), (a, other, c, tie) => {
    const b = tie ? [...a].reverse() : other;
    assert.equal(compareHands(a, a), 0);
    const ab = compareHands(a, b);
    const ba = compareHands(b, a);
    assert.equal(ab + ba, 0);
    const bc = compareHands(b, c);
    const ac = compareHands(a, c);
    if (ab >= 0 && bc >= 0) assert.ok(ac >= 0);
    if (ab > 0 && bc >= 0) assert.equal(ac, 1);
    if (ab <= 0 && bc <= 0) assert.ok(ac <= 0);
  }));
});

test("PROP-072: evaluateHand strictly orders all 9 poker categories and ranks 6-high straight above wheel", () => {
  const ladder = [
    ["9S", "7H", "5D", "4C", "2S"], // 0 High Card
    ["6S", "6H", "KD", "9C", "2S"], // 1 One Pair
    ["8S", "8H", "3D", "3C", "AS"], // 2 Two Pair
    ["JS", "JH", "JD", "7C", "2S"], // 3 Three of a Kind
    ["AS", "2H", "3D", "4C", "5S"], // 4 Straight (wheel)
    ["2S", "3H", "4D", "5C", "6S"], // 4 Straight (6-high)
    ["KS", "TS", "8S", "4S", "2S"], // 5 Flush
    ["QS", "QH", "QD", "9C", "9S"], // 6 Full House
    ["7S", "7H", "7D", "7C", "AS"], // 7 Four of a Kind
    ["5H", "6H", "7H", "8H", "9H"], // 8 Straight Flush
  ];
  assertProp("PROP-072", FILE, fc.property(fc.integer({min: 0, max: ladder.length - 2}), (i) => {
    const lo = evaluateHand(ladder[i]);
    const hi = evaluateHand(ladder[i + 1]);
    assert.equal(compareHands(hi, lo), 1);
    assert.equal(evaluateHand(ladder[4]).wheel, true);
    assert.equal(evaluateHand(ladder[5]).wheel, false);
  }));
});

test("PROP-073: evaluateHand rejects wrong hand sizes, invalid codes, and duplicate cards", () => {
  assertProp("PROP-073", FILE, fc.property(fc.constantFrom(
    ["AS", "KS", "QS", "JS"],
    ["AS", "KS", "QS", "JS", "TS", "9S"],
    ["AS", "AS", "KH", "QD", "JC"],
    ["1S", "KH", "QD", "JC", "9S"]
  ), (badHand) => {
    assert.throws(() => evaluateHand(badHand), TypeError);
  }));
});

test("PROP-074: chooseDiscards obeys pat and standard retention rules", () => {
  assertProp("PROP-074", FILE, fc.property(handArb, (hand) => {
    assert.deepEqual(chooseDiscards(hand, "pat"), []);
    const toss = chooseDiscards(hand, "standard");
    assert.deepEqual(toss, [...toss].sort((a, b) => a - b));
    assert.ok(toss.every((idx) => Number.isInteger(idx) && idx >= 0 && idx < HAND_SIZE));
    const ev = evaluateHand(hand);
    if (ev.category >= 4) {
      assert.deepEqual(toss, []);
    } else if (ev.category >= 1) {
      const rankCounts = new Map();
      for (const c of hand) rankCounts.set(rankValue(c), (rankCounts.get(rankValue(c)) ?? 0) + 1);
      for (const idx of toss) assert.equal(rankCounts.get(rankValue(hand[idx])), 1);
    }
  }));
});

test("PROP-075: newDeal and submitDraw conserve all 52 unique cards across hands, deck, and muck", () => {
  const tossArb = fc.shuffledSubarray([0, 1, 2, 3, 4], {minLength: 0, maxLength: 5});
  assertProp("PROP-075", FILE, fc.property(
    fc.integer({min: 0, max: 100000}),
    fc.constantFrom(...SEATS),
    fc.constantFrom(...SEATS),
    tossArb,
    (seed, first, human, toss) => {
      const mid = newDeal({seed, first, human});
      const check52 = (st) => {
        const all = [...st.hands.cowboy, ...st.hands.wizard, ...st.deck, ...st.muck];
        assert.equal(all.length, 52);
        assert.deepEqual([...all].sort(), [...FULL_DECK].sort());
      };
      check52(mid);
      const done = submitDraw(mid, toss);
      assert.equal(done.phase, "showdown");
      check52(done);
    }
  ));
});

test("PROP-076: toggleDiscard keeps marked sorted and is an involution per card index", () => {
  assertProp("PROP-076", FILE, fc.property(
    fc.integer({min: 0, max: 10000}),
    fc.array(fc.integer({min: 0, max: 4}), {minLength: 1, maxLength: 8}),
    (seed, clicks) => {
      let st = newDeal({seed, first: "cowboy", human: "cowboy"});
      for (const idx of clicks) {
        st = toggleDiscard(st, idx);
        assert.deepEqual(st.marked.cowboy, [...new Set(st.marked.cowboy)].sort((a, b) => a - b));
      }
      const twice = toggleDiscard(toggleDiscard(st, clicks[0]), clicks[0]);
      assert.deepEqual(twice.marked.cowboy, st.marked.cowboy);
    }
  ));
});

test("PROP-077: viewState redacts opponentHand, deck, and muck during draw and reveals at showdown", () => {
  assertProp("PROP-077", FILE, fc.property(fc.integer({min: 0, max: 50000}), fc.constantFrom(...SEATS), (seed, seat) => {
    const drawSt = newDeal({seed, first: seat, human: seat});
    const vDraw = viewState(drawSt, seat);
    assert.deepEqual(vDraw.opponentHand, [null, null, null, null, null]);
    assert.equal(vDraw.result, null);
    assert.equal("deck" in vDraw, false);
    assert.equal("muck" in vDraw, false);

    const endSt = submitDraw(drawSt, []);
    const vEnd = viewState(endSt, seat);
    assert.deepEqual(vEnd.opponentHand, endSt.hands[otherSeat(seat)]);
    assert.notEqual(vEnd.result, null);
  }));
});

test("PROP-078: replayDeal reproduces identical state and nextDeal alternates seat and advances seed", () => {
  assertProp("PROP-078", FILE, fc.property(fc.integer({min: 0, max: 50000}), fc.constantFrom(...SEATS), (seed, first) => {
    const st = newDeal({seed, first, human: null});
    assert.deepEqual(replayDeal(st), st);
    const nxt = nextDeal(st);
    assert.equal(nxt.dealNumber, st.dealNumber + 1);
    assert.equal(nxt.first, otherSeat(st.first));
    assert.equal(nxt.seed, nextSeed(st.seed));
  }));
});

test("PROP-079: playPokerDuel deterministically finishes on endTurn 2 with valid winner", () => {
  assertProp("PROP-079", FILE, fc.property(
    fc.integer({min: 0, max: 50000}),
    fc.constantFrom(...SEATS),
    fc.constantFrom(...STRATEGIES),
    fc.constantFrom(...STRATEGIES),
    (seed, first, cStrat, wStrat) => {
      const cfg = {cowboy: cStrat, wizard: wStrat};
      const r1 = playPokerDuel(seed, first, cfg);
      const r2 = playPokerDuel(seed, first, cfg);
      assert.deepEqual(r1, r2);
      assert.equal(r1.endTurn, 2);
      assert.ok(["cowboy", "wizard", "draw"].includes(r1.winner));
    }
  ));
});

test("PROP-080: measurePairedCohort counts 2*deals games in seed-then-seat order and normalizes null draws", () => {
  assertProp("PROP-080", FILE, fc.property(fc.integer({min: 0, max: 1000}), fc.integer({min: 1, max: 12}), (firstSeed, deals) => {
    const pairs = [];
    const fn = (seed, first) => ({winner: (seed + first.length) % 3 === 0 ? null : first, endTurn: 2});
    const res = measurePairedCohort({
      firstSeed,
      deals,
      sides: ["cowboy", "wizard"],
      playBaseline: fn,
      playCandidate: playPokerDuel,
      onPair: (p) => pairs.push(p),
    });
    assert.equal(res.gamesPerArm, deals * 2);
    assert.equal(pairs.length, deals * 2);
    assert.equal(res.baseline.wins.cowboy + res.baseline.wins.wizard + res.baseline.draws, deals * 2);
    assert.equal(res.candidate.wins.cowboy + res.candidate.wins.wizard + res.candidate.draws, deals * 2);
    pairs.forEach((pair, i) => {
      const seed = firstSeed + Math.floor(i / 2);
      const first = ["cowboy", "wizard"][i % 2];
      assert.deepEqual([pair.seed, pair.first, pair.baseline.winner], [seed, first, fn(seed, first).winner ?? DRAW]);
    });
  }));
});

test("PROP-081: swapping playBaseline and playCandidate swaps arm tallies and preserves switchedWinners", () => {
  assertProp("PROP-081", FILE, fc.property(fc.integer({min: 0, max: 1000}), fc.integer({min: 1, max: 10}), (firstSeed, deals) => {
    const baseFn = (s, f) => playPokerDuel(s, f, "pat");
    const candFn = (s, f) => playPokerDuel(s, f, "standard");
    const forward = measurePairedCohort({firstSeed, deals, sides: ["cowboy", "wizard"], playBaseline: baseFn, playCandidate: candFn});
    const swapped = measurePairedCohort({firstSeed, deals, sides: ["cowboy", "wizard"], playBaseline: candFn, playCandidate: baseFn});
    assert.equal(forward.gamesPerArm, swapped.gamesPerArm);
    assert.deepEqual(forward.baseline, swapped.candidate);
    assert.deepEqual(forward.candidate, swapped.baseline);
    assert.equal(forward.switchedWinners, swapped.switchedWinners);
  }));
});

test("PROP-082: measurePairedCohort throws PairedCohortError on malformed inputs and bad outcomes", () => {
  assertProp("PROP-082", FILE, fc.property(fc.constantFrom(
    {firstSeed: -1, deals: 1, sides: ["cowboy", "wizard"], playBaseline: playPokerDuel, playCandidate: playPokerDuel},
    {firstSeed: 0, deals: 1, sides: ["draw", "wizard"], playBaseline: playPokerDuel, playCandidate: playPokerDuel},
    {firstSeed: 0, deals: 1, sides: ["cowboy", "cowboy"], playBaseline: playPokerDuel, playCandidate: playPokerDuel},
    {firstSeed: 0, deals: 1, sides: ["cowboy", "wizard"], playBaseline: () => ({winner: "cowboy", endTurn: 0}), playCandidate: playPokerDuel},
    {firstSeed: 0, deals: 1, sides: ["cowboy", "wizard"], playBaseline: () => ({endTurn: 2}), playCandidate: playPokerDuel},
    {firstSeed: 0, deals: 1, sides: ["cowboy", "wizard"], playBaseline: () => Promise.resolve({winner: "cowboy", endTurn: 2}), playCandidate: playPokerDuel}
  ), (badInput) => {
    assert.throws(() => measurePairedCohort(badInput), PairedCohortError);
  }));
});

test("PROP-083: wilson interval contains k/n inside [0, 1] and obeys complement reflection symmetry", () => {
  assertProp("PROP-083", FILE, fc.property(fc.integer({min: 1, max: 10000}), fc.double({min: 0, max: 1, noNaN: true}), (n, frac) => {
    const k = Math.min(n, Math.max(0, Math.round(n * frac)));
    const [lo, hi] = wilson(k, n);
    const p = k / n;
    assert.ok(lo >= 0 && lo <= p + 1e-12);
    assert.ok(hi <= 1 && hi >= p - 1e-12);
    const [compLo, compHi] = wilson(n - k, n);
    assert.ok(Math.abs(compLo - (1 - hi)) < 1e-12);
    assert.ok(Math.abs(compHi - (1 - lo)) < 1e-12);
  }));
});

test("PROP-084: wilson interval width strictly shrinks when sample size scales by integer factor >= 2", () => {
  assertProp("PROP-084", FILE, fc.property(
    fc.integer({min: 2, max: 500}),
    fc.integer({min: 2, max: 10}),
    fc.double({min: 0.05, max: 0.95, noNaN: true}),
    (n, factor, frac) => {
      const k = Math.max(1, Math.min(n - 1, Math.round(n * frac)));
      const [lo1, hi1] = wilson(k, n);
      const [lo2, hi2] = wilson(k * factor, n * factor);
      assert.ok(hi2 - lo2 < hi1 - lo1);
    }
  ));
});

test("PROP-085: evaluateBalanceRequirements enforces NSB-1 [45, 55] band and NSB-2 skew tolerance", () => {
  const policy = loadBalanceContract();
  assertProp("PROP-085", FILE, fc.property(
    fc.double({min: 0, max: 100, noNaN: true}),
    fc.double({min: 0, max: 50, noNaN: true}),
    fc.double({min: 0, max: 50, noNaN: true}),
    (cowboyShare, seatSkew, baselineSeatSkew) => {
      const wizardShare = 100 - cowboyShare;
      const [nsb1, nsb2] = evaluateBalanceRequirements(policy, {cowboyShare, wizardShare, seatSkew, baselineSeatSkew});
      const expected1 = cowboyShare >= policy.band[0] && cowboyShare <= policy.band[1] && wizardShare >= policy.band[0] && wizardShare <= policy.band[1];
      const expected2 = seatSkew <= baselineSeatSkew + policy.seatTolerancePp;
      assert.equal(nsb1.measured, true);
      assert.equal(nsb1.pass, expected1);
      assert.equal(nsb2.measured, true);
      assert.equal(nsb2.pass, expected2);
      const [nanCheck] = evaluateBalanceRequirements(policy, {cowboyShare: Number.NaN, wizardShare: 50, seatSkew: 0, baselineSeatSkew: 0});
      assert.equal(nanCheck.measured, false);
      assert.equal(nanCheck.pass, false);
    }
  ));
});
