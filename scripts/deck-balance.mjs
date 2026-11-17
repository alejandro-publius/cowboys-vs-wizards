// Deck balance sample: a fixed, seeded sample of valid Cowboy decks, each
// played CPU against CPU versus the default Wizard deck over the same seeds,
// once with each side acting first. Prints a short summary and, with --out,
// writes the full JSON. The JSON holds no time or machine detail, so the same
// command gives the same bytes. Usage:
//   node scripts/deck-balance.mjs [--decks 200] [--from 0] [--count 200] [--out <file>]
// Results are from the Cowboy side. A match that does not finish throws.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CARDS, MAX_COWBOY_COPIES, SIDES } from "../src/game/cards.js";
import { COWBOY_CATALOG, DECK_SIZE, DEFAULT_COUNTS, deckIds, validateDeck } from "../src/game/deck-builder.js";
import { openingMatch } from "../src/game/opening-policy.js";
import { RULES_VERSION } from "../src/game/state.js";
import { MAX_STEPS, makeBot, playMatch, wholeNumber } from "./play-match.mjs";

export const SAMPLE_SEED = 0xdecc;
const TYPES = COWBOY_CATALOG.map(({ type }) => type);
const NAMES = COWBOY_CATALOG.map(({ name }) => name);
const key = (counts) => TYPES.map((type) => counts[type]).join("/");
const rate = (part, whole) => Number((part / whole).toFixed(4));
const tally = () => ({ matches: 0, wins: 0, losses: 0, draws: 0 });
const add = (into, from) => {
  for (const field of ["matches", "wins", "losses", "draws"]) into[field] += from[field];
};
const withRates = (t) => ({ ...t, winRate: rate(t.wins, t.matches), lossRate: rate(t.losses, t.matches), drawRate: rate(t.draws, t.matches) });
const bump = (counts, name) => {
  counts[name] = (counts[name] ?? 0) + 1;
};

// Every card-count selection the deck builder accepts, in catalog order.
export function validDecks() {
  const out = [];
  const fill = (index, left, counts) => {
    if (index === TYPES.length) {
      if (left === 0 && validateDeck(counts).ok) out.push(counts);
      return;
    }
    for (let copies = 0; copies <= Math.min(left, MAX_COWBOY_COPIES); copies++) fill(index + 1, left - copies, { ...counts, [TYPES[index]]: copies });
  };
  fill(0, DECK_SIZE, {});
  return out;
}

// mulberry32, local so the sample does not depend on the engine's generator.
function picker(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The starter deck first, then `size` others from a seeded shuffle of the rest.
export function sampleDecks(size) {
  const pool = validDecks().filter((counts) => key(counts) !== key(DEFAULT_COUNTS));
  if (size > pool.length) throw new RangeError(`only ${pool.length} valid decks besides the starter`);
  const random = picker(SAMPLE_SEED);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [{ ...DEFAULT_COUNTS }, ...pool.slice(0, size)];
}

export function balance({ decks, from, count }) {
  const bots = Object.fromEntries(SIDES.map((side) => [side, makeBot("cpu", 0, side)]));
  const overall = tally();
  const byStartingSide = Object.fromEntries(SIDES.map((side) => [side, tally()]));
  const byCopies = Object.fromEntries(NAMES.map((name) => [name, {}]));
  const endings = {};
  const finalRound = {};
  const matchesWithCard = Object.fromEntries([...new Set(Object.values(CARDS).map((card) => card.name))].map((name) => [name, 0]));
  let actions = 0;
  let minActions = Infinity;
  let maxActions = 0;

  const results = sampleDecks(decks).map((counts, index) => {
    const ids = deckIds(counts);
    const deck = { ...tally(), byStartingSide: Object.fromEntries(SIDES.map((side) => [side, tally()])) };
    let deckActions = 0;
    for (let seed = from; seed < from + count; seed++) {
      for (const starter of SIDES) {
        let played;
        try {
          played = playMatch(seed, bots, openingMatch(seed, "shipped", starter, { cowboyDeck: ids }));
        } catch (error) {
          throw new Error(`deck ${key(counts)}, ${starter} first: ${error.message}`);
        }
        const { state, log } = played;
        const { winner, reason, round } = state.result;
        const one = { matches: 1, wins: winner === "cowboy" ? 1 : 0, losses: winner === "wizard" ? 1 : 0, draws: winner ? 0 : 1 };
        add(deck, one);
        add(deck.byStartingSide[starter], one);
        add(byStartingSide[starter], one);
        bump(endings, reason);
        bump(finalRound, round);
        deckActions += log.length;
        minActions = Math.min(minActions, log.length);
        maxActions = Math.max(maxActions, log.length);
        const seen = new Set(log.map(({ events }) => events[0]).filter(({ type }) => type === "summon" || type === "spell").map(({ cardId }) => CARDS[cardId].name));
        for (const name of seen) matchesWithCard[name] += 1;
      }
    }
    actions += deckActions;
    add(overall, deck);
    NAMES.forEach((name, at) => {
      const group = (byCopies[name][counts[TYPES[at]]] ??= { decks: 0, ...tally() });
      group.decks += 1;
      add(group, deck);
    });
    const { byStartingSide: starts, ...totals } = deck;
    return {
      deck: key(counts),
      starter: index === 0,
      cards: Object.fromEntries(NAMES.map((name, at) => [name, counts[TYPES[at]]])),
      ...withRates(totals),
      meanActions: Number((deckActions / deck.matches).toFixed(2)),
      byStartingSide: Object.fromEntries(SIDES.map((side) => [side, withRates(starts[side])])),
    };
  });

  // Best first: more wins, then fewer losses, then the deck key, so ties are stable.
  const ranked = [...results].sort((a, b) => b.wins - a.wins || a.losses - b.losses || (a.deck < b.deck ? -1 : 1));
  return {
    rulesVersion: RULES_VERSION,
    bots: { cowboy: "cpu", wizard: "cpu" },
    wizardDeck: "default",
    perspective: "cowboy",
    deckKey: NAMES.join("/"),
    sample: { seed: SAMPLE_SEED, validDecks: validDecks().length, decks: results.length, includesStarter: true },
    seeds: { from, to: from + count - 1, count },
    startsPerSeed: SIDES,
    matchesPerDeck: count * SIDES.length,
    matches: overall.matches,
    stepBound: MAX_STEPS,
    overall: withRates(overall),
    // Keyed by the side that acted first in round 1.
    byStartingSide: Object.fromEntries(SIDES.map((side) => [side, withRates(byStartingSide[side])])),
    starterDeck: results[0],
    starterRank: ranked.indexOf(results[0]) + 1,
    best: ranked.slice(0, 10),
    worst: ranked.slice(-10).reverse(),
    // Pooled over every sampled deck holding that many copies. Counts sum to twelve, so cards are not independent.
    byCopies: Object.fromEntries(NAMES.map((name) => [name, Object.fromEntries(Object.entries(byCopies[name]).map(([copies, group]) => [copies, withRates(group)]))])),
    actionsPerMatch: { min: minActions, max: maxActions, mean: Number((actions / overall.matches).toFixed(2)) },
    endings,
    finalRound,
    matchesWithCard,
    decks: ranked,
  };
}

if (import.meta.main) {
  const usage = "usage: node scripts/deck-balance.mjs [--decks <1 or more>] [--from <integer >= 0>] [--count <1 or more>] [--out <file>]";
  let values;
  try {
    ({ values } = parseArgs({
      options: { decks: { type: "string", default: "200" }, from: { type: "string", default: "0" }, count: { type: "string", default: "200" }, out: { type: "string" } },
    }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const [decks, from, count] = [values.decks, values.from, values.count].map(wholeNumber);
  if (decks === null || from === null || count === null || decks < 1 || count < 1) {
    console.error(usage);
    process.exit(2);
  }
  const report = balance({ decks, from, count });
  const line = (r) => `${r.deck}  won ${r.wins} lost ${r.losses} drew ${r.draws} (${(r.winRate * 100).toFixed(1)}% wins)`;
  console.log(
    [
      `${report.sample.decks} decks x seeds ${from}-${report.seeds.to} x 2 starts = ${report.matches} matches  rules ${report.rulesVersion}  cpu vs cpu`,
      `deck key: ${report.deckKey}`,
      `all decks: ${line({ deck: "", ...report.overall }).trim()}`,
      `starter (rank ${report.starterRank} of ${report.sample.decks}): ${line(report.starterDeck)}`,
      `best:  ${line(report.best[0])}`,
      `worst: ${line(report.worst[0])}`,
    ].join("\n"),
  );
  if (values.out) {
    writeFileSync(values.out, JSON.stringify(report, null, 2) + "\n");
    console.log(`report written to ${values.out}`);
  }
}
