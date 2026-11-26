// The two games keep their seed parsing and use the same generator. Compare streams, deals and historical replays.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import * as rngModule from "../../packages/frontier-kit/seeded-rng.js";
import {mulberry32} from "../../packages/frontier-kit/seeded-rng.js";
import {createHash} from "node:crypto";
import * as showdown from "../../src/game/showdown/rules.js";
import {deckIds} from "../../src/game/showdown/cards.js";
import * as poker from "../../experiments/boot-hill-poker/engine.js";

const KIT_RNG = "src/game/frontier-kit/seeded-rng.js";
const SHOWDOWN_RULES = "src/game/showdown/rules.js";
const POKER_ENGINE = "experiments/boot-hill-poker/engine.js";
const url = (path) => new URL(`../../${path}`, import.meta.url);
const source = (path) => readFileSync(url(path), "utf8").replace(/\r\n/g, "\n");

const GAMMA = 0x6d2b79f5;
const TWO32 = 2 ** 32;
const take = (next, n) => Array.from({length: n}, () => next());
const range = (n, from = 0) => Array.from({length: n}, (_, i) => from + i);
const label = (seed) => (typeof seed === "string" ? JSON.stringify(seed) : Object.is(seed, -0) ? "-0" : String(seed));

// An independent mulberry32 in BigInt arithmetic: every step is reduced modulo 2^32 explicitly, without Math.imul or
// 32-bit operators, so agreement shows all three compute mulberry32 itself, not merely the same code as each other.
const MASK = 0xffffffffn;
function reference(seed) {
  let a = BigInt(seed) & MASK;
  return () => {
    a = (a + 0x6d2b79f5n) & MASK;
    let t = ((a ^ (a >> 15n)) * (a | 1n)) & MASK;
    t = (t ^ ((t + (((t ^ (t >> 7n)) * (t | 61n)) & MASK)) & MASK)) & MASK;
    return Number((t ^ (t >> 14n)) & MASK) / 4294967296;
  };
}
// The wrap both games apply to a finite number, also in BigInt: truncate toward zero, then modulo 2^32.
const toUint32 = (x) => Number(((BigInt(Math.trunc(x)) % 2n ** 32n) + 2n ** 32n) % 2n ** 32n);

// Zero; the increment; the seed whose first step lands the state on 0 (and the one before it); the int32 sign
// boundary; the top of uint32.
const WRAPS_TO_ZERO = TWO32 - GAMMA; // 0x92d4860b
const EDGE_SEEDS = [0, 1, 2, 17, GAMMA, WRAPS_TO_ZERO - 1, WRAPS_TO_ZERO, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff];
// Finite numbers outside [0, 2^32): negatives, fractions, -0, 2^32 and up, safe-integer and float extremes.
const WRAPPED = [-0, -1, -2, 0.25, 1.5, 1.9999, -1.5, 2 ** 32, 2 ** 32 + 17, -(2 ** 31), -(2 ** 32) - 1,
  Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 1e21, -1e21, Number.MAX_VALUE, Number.MIN_VALUE, -Number.MIN_VALUE];
function lcg(x, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push((x = (Math.imul(x, 1664525) + 1013904223) >>> 0));
  return out;
}
const SWEEP = [...range(2048), ...lcg(0x5eed, 2048)];
// Seeds the games read differently. Showdown wraps with >>> 0 after ToNumber ("0x10" is 16; "", null, NaN are 0);
// Poker reads decimal integer text and FNV-1a hashes everything else that is not a finite number.
const DISAGREE = [NaN, Infinity, -Infinity, "", undefined, null, "abc", "0x10", "1e3", "+17", "1.5", true];
// Text both games read as the same integer.
const AGREE_TEXT = ["17", "-1", " 42 ", "007", "4294967296"];

test("the package exposes the same function both games use for deals", async () => {
  const core = await import(url(KIT_RNG));
  assert.equal(mulberry32, core.mulberry32);
  for (const path of [SHOWDOWN_RULES, POKER_ENGINE]) {
    assert.doesNotMatch(source(path), /0x6d2b79f5/);
  }
});

test("the kit module exports one function, imports nothing and touches no runtime global", () => {
  assert.deepEqual(Object.keys(rngModule), ["mulberry32"]);
  const code = source(KIT_RNG).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");
  assert.doesNotMatch(code, /\bimport\b|\bexport\s*[{*]|\brequire\b/, "no imports or re-exports");
  assert.doesNotMatch(code, /\b(document|window|globalThis|localStorage|fetch|WebSocket|process|Date|performance|crypto)\b|Math\.random/,
    "no runtime globals");
});

// ---------------------------------------------------------------- 2. the streams

test("seed 0 and the uint32 edge seeds: kit, Showdown and Poker all give the reference stream for 10,000 values", () => {
  for (const seed of EDGE_SEEDS) {
    const expected = take(reference(seed), 10_000);
    assert.deepEqual(take(mulberry32(seed), 10_000), expected, `kit, seed ${seed}`);
    assert.deepEqual(take(showdown.random(seed), 10_000), expected, `Showdown random, seed ${seed}`);
    assert.deepEqual(take(poker.createRng(seed), 10_000), expected, `Poker createRng, seed ${seed}`);
    assert.ok(expected.every((value) => value >= 0 && value < 1 && Number.isInteger(value * TWO32)), `seed ${seed}: k / 2^32 in [0, 1)`);
  }
  // By hand: a state of 0 makes every mixing step 0, so the lowest value, exactly 0, is reachable.
  for (const make of [mulberry32, showdown.random, poker.createRng]) assert.equal(make(WRAPS_TO_ZERO)(), 0);
});

test("finite numbers outside uint32 wrap the same way in all three: truncate, then modulo 2^32", () => {
  assert.deepEqual([-1, 2 ** 32 + 5, 1.9, -1.5, -0].map(toUint32), [0xffffffff, 5, 1, 0xffffffff, 0]);
  for (const seed of WRAPPED) {
    const expected = take(reference(toUint32(seed)), 256);
    assert.deepEqual(take(mulberry32(seed), 256), expected, `kit, seed ${label(seed)} -> ${toUint32(seed)}`);
    assert.deepEqual(take(showdown.random(seed), 256), expected, `Showdown, seed ${label(seed)}`);
    assert.deepEqual(take(poker.createRng(seed), 256), expected, `Poker, seed ${label(seed)}`);
  }
});

test("a 4096-seed sweep: the first 16 values agree in all three and with the reference", () => {
  for (const seed of SWEEP) {
    const expected = take(reference(seed), 16);
    assert.deepEqual(take(mulberry32(seed), 16), expected, `kit, seed ${seed}`);
    assert.deepEqual(take(showdown.random(seed), 16), expected, `Showdown, seed ${seed}`);
    assert.deepEqual(take(poker.createRng(seed), 16), expected, `Poker, seed ${seed}`);
  }
});

test("transition: each state is a uint32 stepping by 0x6d2b79f5, so value k of seed s is value 0 of s + k * 0x6d2b79f5", () => {
  for (const seed of [0, 1, WRAPS_TO_ZERO, 0xffffffff, 0x5eed]) {
    const [kit, sd, pk] = [mulberry32(seed), showdown.random(seed), poker.createRng(seed)];
    for (let k = 0; k < 2000; k++) {
      const shifted = (seed + k * GAMMA) % TWO32;
      const value = kit();
      assert.equal(value, mulberry32(shifted)(), `kit, seed ${seed}, step ${k}`);
      assert.equal(sd(), value, `Showdown, seed ${seed}, step ${k}`);
      assert.equal(pk(), value, `Poker, seed ${seed}, step ${k}`);
      assert.equal(showdown.random(shifted)(), value);
      assert.equal(poker.createRng(shifted)(), value);
    }
  }
});

test("repeatable and side-effect free: same seed, same stream; generators never share state; no global changes", async () => {
  const first = take(mulberry32(0), 1000);
  take(mulberry32(0), 500);
  assert.deepEqual(take(mulberry32(0), 1000), first, "running another generator first changes nothing");
  const [a, b, c] = [mulberry32(0), mulberry32(0), mulberry32(1)];
  const seen = {a: [], b: [], c: []};
  for (let i = 0; i < 1000; i++) {
    seen.a.push(a());
    if (i % 3 === 0) seen.c.push(c());
    seen.b.push(b());
  }
  assert.deepEqual(seen.a, first);
  assert.deepEqual(seen.b, first);
  assert.deepEqual(seen.c, take(mulberry32(1), seen.c.length));
  // A second, freshly evaluated copy of the module: importing and running it leaves Math.random and globalThis alone.
  const random = Math.random;
  const globals = Reflect.ownKeys(globalThis);
  const fresh = await import(`${url(KIT_RNG).href}?side-effect-probe`);
  assert.notEqual(fresh.mulberry32, mulberry32, "a separate module instance");
  assert.deepEqual(take(fresh.mulberry32(0), 1000), first);
  assert.equal(Math.random, random);
  assert.deepEqual(Reflect.ownKeys(globalThis), globals);
});

// ---------------------------------------------------------------- 3. seed parsing

test("seed parsing: the games differ only outside finite numbers and decimal text, and the kit refuses every non-number", () => {
  for (const seed of DISAGREE) {
    const sd = take(showdown.random(seed), 8), pk = take(poker.createRng(seed), 8);
    assert.notDeepEqual(sd, pk, `the games read seed ${label(seed)} differently`);
    // The whole difference is the parsing: the kit after each game's own parser reproduces that game.
    assert.deepEqual(take(mulberry32(seed >>> 0), 8), sd, `kit after >>> 0 is Showdown, seed ${label(seed)}`);
    assert.deepEqual(take(mulberry32(poker.normalizeSeed(seed)), 8), pk, `kit after normalizeSeed is Poker, seed ${label(seed)}`);
    assert.throws(() => mulberry32(seed), TypeError, `kit refuses ${label(seed)}`);
  }
  for (const seed of AGREE_TEXT) {
    assert.deepEqual(take(showdown.random(seed), 8), take(poker.createRng(seed), 8), `both games read ${label(seed)} as ${seed >>> 0}`);
    assert.throws(() => mulberry32(seed), TypeError, "text is each game's parsing, not the kit's");
  }
  for (const seed of [10n, {}, [], Symbol("seed"), () => 1]) assert.throws(() => mulberry32(seed), TypeError);
  assert.throws(() => mulberry32(NaN), {name: "TypeError", message: "mulberry32 seed must be a finite number, got NaN"});
  assert.throws(() => mulberry32("17"), {message: "mulberry32 seed must be a finite number, got string"});
});

// ---------------------------------------------------------------- 4. the games' deals, rebuilt from the kit

const shuffle = (deck, next) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// createShowdown's deal: one generator shuffles the cowboy deck, then the wizard deck, then one more value picks the
// side that starts; the other side's opening hand is SECOND_PLAYER_CARDS larger.
function showdownDealFromKit(seed) {
  const next = mulberry32(seed >>> 0);
  const decks = {cowboy: shuffle(deckIds("cowboy"), next), wizard: shuffle(deckIds("wizard"), next)};
  const first = next() < .5 ? "cowboy" : "wizard";
  const hand = (side) => showdown.OPENING_HAND + (side === first ? 0 : showdown.SECOND_PLAYER_CARDS);
  const sides = Object.fromEntries(Object.entries(decks).map(([side, deck]) => [side, {hand: deck.slice(0, hand(side)), deck: deck.slice(hand(side))}]));
  return {first, sides};
}
const showdownDeal = (state) => ({first: state.first,
  sides: Object.fromEntries(["cowboy", "wizard"].map((side) => [side, {hand: state.sides[side].hand, deck: state.sides[side].deck}]))});

test("Showdown: createShowdown's deal (both decks, both hands, who starts) rebuilds from the kit, seed 0 included", () => {
  const starts = {cowboy: 0, wizard: 0};
  for (const seed of [...EDGE_SEEDS, ...range(1000)]) {
    const real = showdown.createShowdown(seed);
    assert.deepEqual(showdownDeal(real), showdownDealFromKit(seed), `seed ${seed}`);
    starts[real.first] += 1;
  }
  assert.ok(starts.cowboy > 0 && starts.wizard > 0, `both sides start in the sample: ${JSON.stringify(starts)}`);
});

test("Poker: shuffleDeck and the dealt hands rebuild from the kit, seed 0 and text seeds included", () => {
  for (const seed of [...EDGE_SEEDS, ...range(1000), -1, 2 ** 32 + 17, "boot hill", "", "17"]) {
    const deck = shuffle(poker.makeDeck(), mulberry32(poker.normalizeSeed(seed)));
    assert.deepEqual(poker.shuffleDeck(seed), deck, `shuffleDeck(${label(seed)})`);
    for (const first of poker.SEATS) {
      // The human seat draws first, so no bot draw has run: these are the hands as dealt, alternating from first.
      const dealt = poker.newDeal({seed, first, human: first});
      const second = poker.otherSeat(first);
      assert.equal(dealt.seed, poker.normalizeSeed(seed));
      assert.deepEqual(dealt.hands, {[first]: [0, 2, 4, 6, 8].map((i) => deck[i]), [second]: [1, 3, 5, 7, 9].map((i) => deck[i])}, `seed ${label(seed)}, ${first} first`);
      assert.deepEqual(dealt.deck, deck.slice(10));
    }
  }
});

// Fingerprints recorded on main 094af9b before removing either original generator.
const fingerprint = values => createHash("sha256").update(JSON.stringify(values)).digest("hex");

test("500 old Showdown deals in both seats and 120 level-0 duel outcomes replay exactly", () => {
  const deals = [], duels = [];
  for (let seed = 0; seed < 500; seed++) {
    for (const first of ["cowboy", "wizard"]) {
      let state = showdown.createShowdown(seed, {first});
      deals.push(state);
      if (seed < 60) {
        while (!state.result) state = showdown.playTurn(state, 0).state;
        duels.push([seed, first, state.result.winner, state.turn]);
      }
    }
  }
  assert.equal(fingerprint(deals), "59eb499d69e37046d016c7cd2b0461362e625d83de0b55b14163063f7f291a70");
  assert.equal(fingerprint(duels), "44f6413a1e2f97445bea6d7ac951235245eee54cb783f7cef06dda22047f19e2");
});

test("400 Poker deals with their next deal and 1,000 mirrored outcomes match the original engine", () => {
  const deals = [], results = [];
  for (let seed = 0; seed < 500; seed++) {
    for (const first of poker.SEATS) {
      if (seed < 200) {
        const state = poker.newDeal({seed, first, human: null});
        deals.push([state, poker.nextDeal(state)]);
      }
      results.push(poker.playPokerDuel(seed + 1, first, "standard"));
    }
  }
  assert.equal(fingerprint(deals), "0d77a46c73de2cef5a84a19e25101de80668c4e509a281751843c593ef2d4a9b");
  assert.equal(fingerprint(results), "a8d2066027019018ab4bdc2ae11d2ac39c84ea6aacb06436b401166fad49813d");
});
