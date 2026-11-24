// Frontier kit seeded RNG: packages/frontier-kit/seeded-rng.js against the two game generators it could replace.
//   Showdown: random(seed) in src/game/showdown/rules.js (createShowdown's deal, progress.js rolls).
//   Poker:    createRng(seed) in experiments/boot-hill-poker/engine.js (shuffleDeck, newDeal).
// Evidence, in order:
//   1. the transition lines are the same text in all three files;
//   2. all three streams equal an independent BigInt mulberry32 at seed 0, the uint32 edges, wrapped finite numbers
//      and a 4096-seed sweep, and the state steps by 0x6d2b79f5 in each;
//   3. the games read finite numbers and decimal text the same way and other seeds differently, and the kit
//      refuses every non-number;
//   4. both games' real deals can be rebuilt from the kit alone;
//   5. an in-memory copy of each engine, with its generator switched to the kit, gives the same streams, deals and
//      duels (including Poker's recorded 500-seed cohort), and a deliberately wrong switch is caught.
// Neither game imports the kit RNG. The switch is only rehearsed here, in Node, never in a browser build (see README.md).
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import * as rngModule from "../../packages/frontier-kit/seeded-rng.js";
import {mulberry32} from "../../packages/frontier-kit/seeded-rng.js";
import {measurePairedCohort} from "../../packages/frontier-kit/index.js";
import * as showdown from "../../src/game/showdown/rules.js";
import {deckIds} from "../../src/game/showdown/cards.js";
import * as poker from "../../experiments/boot-hill-poker/engine.js";

const KIT_RNG = "packages/frontier-kit/seeded-rng.js";
const SHOWDOWN_RULES = "src/game/showdown/rules.js";
const SHOWDOWN_CARDS = "src/game/showdown/cards.js";
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

// ---------------------------------------------------------------- 1. the same transition, and still two copies

const TRANSITION = /a = \(a \+ 0x6d2b79f5\) >>> 0;[\s\S]*?return \(\(t \^ \(t >>> 14\)\) >>> 0\) \/ 4294967296;/g;
function transitionOf(path) {
  const found = [...source(path).matchAll(TRANSITION)].map(([text]) => text.replace(/\s+/g, " "));
  assert.equal(found.length, 1, `${path} holds exactly one mulberry32 transition`);
  return found[0];
}

test("the transition lines are the same text in the kit, the Showdown rules and the Poker engine; only the seed line differs", () => {
  const kit = transitionOf(KIT_RNG);
  assert.equal(transitionOf(SHOWDOWN_RULES), kit);
  assert.equal(transitionOf(POKER_ENGINE), kit);
  assert.match(source(SHOWDOWN_RULES), /export function random\(seed\) \{\n {2}let a = seed >>> 0;\n {2}return \(\) => \{\n/);
  assert.match(source(POKER_ENGINE), /export function createRng\(seed\) \{\n {2}let a = normalizeSeed\(seed\);\n {2}return function next\(\) \{\n/);
  assert.match(source(KIT_RNG), /\n {2}let a = seed >>> 0;\n {2}return \(\) => \{\n/);
});

test("not integrated: both games still run their own generator and neither references the kit RNG", () => {
  for (const path of [SHOWDOWN_RULES, POKER_ENGINE]) assert.doesNotMatch(source(path), /frontier-kit|seeded-rng/, `${path} does not use the kit`);
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

// ---------------------------------------------------------------- 5. the switch, rehearsed in memory
// Each engine's own source with its generator body replaced by a call to the kit, loaded from a data: URL so nothing
// is written to disk. Each game keeps its seed parsing (>>> 0 or normalizeSeed); only the transition comes from the kit.

const SHOWDOWN_GENERATOR = `export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}`;
const POKER_GENERATOR = `export function createRng(seed) {
  let a = normalizeSeed(seed);
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}`;
const SHOWDOWN_SWITCHED = "export function random(seed) {\n  return mulberry32(seed >>> 0);\n}";
const POKER_SWITCHED = "export function createRng(seed) {\n  return mulberry32(normalizeSeed(seed));\n}";
const CARDS_IMPORT = `from "./cards.js";`;

const once = (text, part, what) => assert.equal(text.split(part).length, 2, `${what} appears exactly once`);
async function switched(path, original, replacement) {
  let text = source(path);
  once(text, original, `${path}'s own generator`);
  text = text.replace(original, () => replacement);
  if (path === SHOWDOWN_RULES) {
    // A data: module resolves only absolute specifiers, so point the one relative import at the real cards.js.
    once(text, CARDS_IMPORT, `${path}'s cards.js import`);
    text = text.replace(CARDS_IMPORT, () => `from ${JSON.stringify(url(SHOWDOWN_CARDS).href)};`);
  }
  const code = `import {mulberry32} from ${JSON.stringify(url(KIT_RNG).href)};\n${text}`;
  assert.ok(!code.includes("0x6d2b79f5"), "the switched copy has no transition of its own");
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

function showdownDuel(engine, seed, first) {
  let state = engine.createShowdown(seed, {first});
  while (!state.result) state = engine.playTurn(state, 0).state;
  return {winner: state.result.winner, endTurn: state.turn};
}

test("rehearsed switch, Showdown: random() calling the kit keeps every stream, deal and level-0 duel", async () => {
  const sw = await switched(SHOWDOWN_RULES, SHOWDOWN_GENERATOR, SHOWDOWN_SWITCHED);
  // Showdown's own seed handling survives the switch, including the seeds the kit itself refuses.
  for (const seed of [...EDGE_SEEDS, ...WRAPPED, ...DISAGREE, ...AGREE_TEXT]) {
    assert.deepEqual(take(sw.random(seed), 64), take(showdown.random(seed), 64), `random(${label(seed)})`);
  }
  for (const seed of [...EDGE_SEEDS, ...range(500)]) {
    assert.deepEqual(sw.createShowdown(seed), showdown.createShowdown(seed), `createShowdown(${seed})`);
    assert.deepEqual(sw.createShowdown(seed, {first: "wizard"}), showdown.createShowdown(seed, {first: "wizard"}), `createShowdown(${seed}, wizard first)`);
  }
  // Whole duels through the kit's own paired audit: today's engine is the baseline, the switched copy the candidate.
  const result = measurePairedCohort({firstSeed: 0, deals: 60, sides: ["cowboy", "wizard"],
    playBaseline: (seed, first) => showdownDuel(showdown, seed, first), playCandidate: (seed, first) => showdownDuel(sw, seed, first),
    onPair: ({seed, first, baseline, candidate}) => assert.deepEqual(candidate, baseline, `seed ${seed}, ${first} first`)});
  assert.equal(result.gamesPerArm, 120);
  assert.equal(result.switchedWinners, 0);
  assert.deepEqual(result.candidate, result.baseline);
});

test("rehearsed switch, Poker: createRng() calling the kit keeps every stream, deal and the recorded 500-seed cohort", async () => {
  const sw = await switched(POKER_ENGINE, POKER_GENERATOR, POKER_SWITCHED);
  for (const seed of [...EDGE_SEEDS, ...WRAPPED, ...DISAGREE, ...AGREE_TEXT, "boot hill"]) {
    assert.deepEqual(take(sw.createRng(seed), 64), take(poker.createRng(seed), 64), `createRng(${label(seed)})`);
    assert.deepEqual(sw.shuffleDeck(seed), poker.shuffleDeck(seed), `shuffleDeck(${label(seed)})`);
  }
  for (const seed of [...EDGE_SEEDS, ...range(200)]) {
    for (const first of poker.SEATS) {
      const [after, before] = [sw.newDeal({seed, first, human: null}), poker.newDeal({seed, first, human: null})];
      assert.deepEqual(after, before, `newDeal(${seed}, ${first} first)`);
      assert.deepEqual(sw.nextDeal(after), poker.nextDeal(before), `nextDeal after ${seed}, ${first} first`);
    }
  }
  const result = measurePairedCohort({firstSeed: 1, deals: 500, sides: ["cowboy", "wizard"],
    playBaseline: (seed, first) => poker.playPokerDuel(seed, first, "standard"),
    playCandidate: (seed, first) => sw.playPokerDuel(seed, first, "standard"),
    onPair: ({seed, first, baseline, candidate}) => assert.deepEqual(candidate, baseline, `seed ${seed}, ${first} first`)});
  // The totals tests/game/dec4-frontier-kit.test.js records for this cohort (seeds 1-500, standard bot).
  const recorded = {wins: {cowboy: 500, wizard: 500}, draws: 0, firstWins: 488};
  assert.deepEqual(result, {gamesPerArm: 1000, baseline: recorded, candidate: recorded, switchedWinners: 0});
});

test("the rehearsal is not vacuous: a switch that seeds the kit one off changes both games' seed-0 deals", async () => {
  const showdownOff = await switched(SHOWDOWN_RULES, SHOWDOWN_GENERATOR, "export function random(seed) {\n  return mulberry32((seed >>> 0) ^ 1);\n}");
  assert.notDeepEqual(showdownDeal(showdownOff.createShowdown(0)), showdownDeal(showdown.createShowdown(0)));
  const pokerOff = await switched(POKER_ENGINE, POKER_GENERATOR, "export function createRng(seed) {\n  return mulberry32(normalizeSeed(seed) ^ 1);\n}");
  assert.notDeepEqual(pokerOff.shuffleDeck(0), poker.shuffleDeck(0));
});
