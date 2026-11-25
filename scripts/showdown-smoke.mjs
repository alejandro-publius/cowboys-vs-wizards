// Showdown smoke sample: a small fixed-seed bot sample on the engine the public game uses
// (src/game/showdown/rules.js) with the even-match decks (src/game/showdown/cards.js DECKS). Each seed
// is played once from each opener, level-2 bot on both sides, through the existing play() in
// scripts/billy-replay-engine.mjs. Each game records its winner, ending, turn count, the card types
// each side played from hand and the traps that sprang.
// Coverage: a deck card is "observed" only if some game played it. A deck card that no game played is
// "in-deck-unobserved", and a catalog card in neither deck is "outside-sample". Neither gets credit.
// Each troop's engine stars, attack and health are printed. Deck copies come from DECKS alone, so a
// change to a card spec's `copies` field is not measured by this sample.
// A regression signal only: it decides no balance question and approves no card change.
//   node scripts/showdown-smoke.mjs [--from 0] [--count 8] [--json]
// The output holds no time or machine detail; the same command on the same tree prints the same bytes.
// Exit 0: a complete, valid sample. Exit 1: an engine error or an invalid or incomplete sample
// (problems on stderr). Exit 2: usage.
import {readFileSync} from "node:fs";
import {parseArgs} from "node:util";
import * as engine from "../src/game/showdown/rules.js";
import {DECKS, TYPES, typeOf} from "../src/game/showdown/cards.js";
import {isDealSeed} from "../src/game/showdown/seed.js";
import {BOT_LEVEL, play} from "./billy-replay-engine.mjs";
import {canonical, sha256, summarize} from "./night-review.mjs";

export const SCHEMA = "showdown-smoke/1";
export const ENGINE = Object.freeze({rules: "src/game/showdown/rules.js", cards: "src/game/showdown/cards.js", catalog: "src/game/card-specs.generated.js"});
export const DECK_SET = Object.freeze({name: "even-match", source: "src/game/showdown/cards.js DECKS"});
export const PLAYER = Object.freeze({function: "scripts/billy-replay-engine.mjs play()", botLevel: BOT_LEVEL, sides: "both"});
export const OPENERS = Object.freeze(["cowboy", "wizard"]);
export const MAX_DEALS = 200;
const WINNERS = ["cowboy", "wizard", "draw"];
const COVERAGE = {observed: "observed", "in-deck-unobserved": "inDeckUnobserved", "outside-sample": "outsideSample"};
const SCOPE = "smoke regression signal only; not a balance verdict and not approval of any card change";
const ROOT = new URL("../", import.meta.url);
const fileHash = (path) => sha256(readFileSync(new URL(path, ROOT)));
const bump = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1; };
const sorted = (counts) => Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
const count = (n) => Number.isSafeInteger(n) && n > 0;

// One game. A card counts as played when it leaves the acting side's hand (summon, spell, gear,
// location or trap set); a card leaves the hand no other way, and a burned draw never enters it.
function playOne(seed, first) {
  const played = {cowboy: {}, wizard: {}};
  const sprung = {cowboy: {}, wizard: {}};
  let last = null;
  const {winner, endTurn} = play(engine, seed, first, (before, applied) => {
    const side = before.active;
    const hand = applied.state.sides[side].hand;
    for (const id of before.sides[side].hand) if (!hand.includes(id)) bump(played[side], typeOf(id));
    for (const event of applied.events) if (event.type === "trap") bump(sprung[event.side], typeOf(event.cardId));
    last = applied.state;
  });
  if (!last?.result || last.turn !== endTurn) throw new Error(`seed ${seed}, ${first} first: the game ended without a recorded result`);
  return {seed, first, winner, reason: last.result.reason, turns: endTurn,
    played: {cowboy: sorted(played.cowboy), wizard: sorted(played.wizard)}, sprung: {cowboy: sorted(sprung.cowboy), wizard: sorted(sprung.wizard)}};
}

// Results, endings, turns and per-card coverage, recomputed from the game records alone.
export function summarizeSample(records, decks = DECKS) {
  const {games, cowboy, wizard, draw, first, second} = summarize(records.map((r) => ({...r, winner: r.winner === "draw" ? null : r.winner})));
  const byOpener = Object.fromEntries(OPENERS.map((opener) => {
    const mine = records.filter((r) => r.first === opener);
    return [opener, Object.fromEntries([["games", mine.length], ...WINNERS.map((w) => [w, mine.filter((r) => r.winner === w).length])])];
  }));
  const endings = {};
  for (const r of records) bump(endings, r.reason);
  const turns = records.map((r) => r.turns);
  const cards = {};
  const coverage = {observed: [], inDeckUnobserved: [], outsideSample: []};
  for (const [type, card] of Object.entries(TYPES)) {
    const copies = decks[card.side]?.[type] ?? 0;
    const gamesPlayed = records.filter((r) => r.played[card.side]?.[type]).length;
    const plays = records.reduce((sum, r) => sum + (r.played[card.side]?.[type] ?? 0), 0);
    const status = !copies ? "outside-sample" : gamesPlayed ? "observed" : "in-deck-unobserved";
    // engineStats: the values the engine played with (a spec's `showdown` block can override its top-level numbers).
    cards[type] = {side: card.side, name: card.name, kind: card.kind, showdownOnly: Boolean(card.fresh), copies, status, gamesPlayed, plays,
      ...(card.kind === "troop" ? {engineStats: {stars: card.stars, attack: card.attack, health: card.health}} : {}),
      ...(card.kind === "trap" ? {sprung: records.reduce((sum, r) => sum + (r.sprung[card.side]?.[type] ?? 0), 0)} : {})};
    coverage[COVERAGE[status]].push(type);
  }
  return {results: {games, cowboy, wizard, draw, first, second}, byOpener, endings: sorted(endings),
    turns: {min: Math.min(...turns), max: Math.max(...turns), mean: Number((turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(2))}, cards, coverage};
}

// A plan is 1 to MAX_DEALS consecutive Showdown deal seeds (src/game/showdown/seed.js).
export const validPlan = ({from, count: deals}) => isDealSeed(from) && Number.isSafeInteger(deals) && deals >= 1 && deals <= MAX_DEALS && isDealSeed(from + deals - 1);

// Everything a report for this plan declares before its results, field for field.
export function cohortHeader({from, count: deals}) {
  return {
    schema: SCHEMA, scope: SCOPE,
    engine: {...ENGINE, sha256: Object.fromEntries(Object.values(ENGINE).map((path) => [path, fileHash(path)]))},
    player: PLAYER, decks: {...DECK_SET, counts: DECKS},
    seeds: {from, to: from + deals - 1, count: deals}, openers: OPENERS,
    command: `node scripts/showdown-smoke.mjs --from ${from} --count ${deals}`,
  };
}

export function smoke(plan) {
  if (!validPlan(plan)) throw new RangeError(`from and from + count - 1 must be deal seeds (0 to ${0xffffffff}) and count 1 to ${MAX_DEALS}`);
  const records = [];
  for (let seed = plan.from; seed < plan.from + plan.count; seed++) for (const first of OPENERS) records.push(playOne(seed, first));
  return {...cohortHeader(plan), ...summarizeSample(records), recordsSha256: sha256(canonical(records)), records};
}

// Problems that make a report unusable as this sample, judged against the plan {from, count} and this
// checkout's engine files and decks. Empty means a complete sample on the active engine whose summary
// follows from its records. A lane report (scripts/deck-balance.mjs or simulate-matches.mjs) fails here.
// Every header field must equal cohortHeader(plan) exactly, so a stamp built from a valid report only
// carries values checked here or recomputed from the records.
export function smokeProblems(report, plan) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return ["the sample is not a JSON object"];
  if (!validPlan(plan)) return [`the plan ${JSON.stringify(plan)} is not 1 to ${MAX_DEALS} consecutive deal seeds`];
  const {from, count: deals} = plan;
  const header = cohortHeader(plan);
  const same = (key) => canonical(report[key]) === canonical(header[key]);
  const problems = [];
  if (report.schema !== SCHEMA) problems.push(`schema is ${JSON.stringify(report.schema ?? null)}, not ${SCHEMA}`);
  if (report.engine?.rules !== ENGINE.rules) {
    problems.push(`engine is ${JSON.stringify(report.engine?.rules ?? report.rulesVersion ?? null)}, not the active Showdown engine ${ENGINE.rules}`);
  }
  for (const path of Object.values(ENGINE)) if (report.engine?.sha256?.[path] !== header.engine.sha256[path]) problems.push(`${path} hash does not match this checkout`);
  if (!problems.length && !same("engine")) problems.push("engine does not declare exactly the active engine paths and hashes");
  if (!same("decks")) problems.push(`decks are not the ${DECK_SET.name} decks of ${DECK_SET.source}`);
  if (!same("player")) problems.push("player is not the level-2 bot on both sides through play()");
  if (!same("seeds")) problems.push(`seeds are ${JSON.stringify(report.seeds ?? null)}, the plan is ${JSON.stringify(header.seeds)}`);
  if (!same("openers")) problems.push(`openers are ${JSON.stringify(report.openers ?? null)}, the plan is exactly ${JSON.stringify(OPENERS)}`);
  for (const key of ["scope", "command"]) if (!same(key)) problems.push(`${key} is ${JSON.stringify(report[key] ?? null)}, the plan declares ${JSON.stringify(header[key])}`);
  const records = Array.isArray(report.records) ? report.records : [];
  if (records.length !== deals * OPENERS.length) problems.push(`${records.length} game records, a complete sample has ${deals * OPENERS.length} (${deals} seeds x ${OPENERS.length} openers)`);
  const seen = new Set();
  for (const [i, r] of records.entries()) {
    const at = `record ${i} (seed ${r?.seed}, ${r?.first} first)`;
    if (!Number.isSafeInteger(r?.seed) || r.seed < from || r.seed >= from + deals || !OPENERS.includes(r.first)) { problems.push(`${at} is outside the plan`); continue; }
    if (seen.has(`${r.seed}/${r.first}`)) problems.push(`${at} is a duplicate`);
    seen.add(`${r.seed}/${r.first}`);
    if (!WINNERS.includes(r.winner) || typeof r.reason !== "string" || !r.reason || !count(r.turns)) problems.push(`${at} has no finished result`);
    for (const side of OPENERS) for (const field of ["played", "sprung"]) {
      const counts = r[field]?.[side];
      if (!counts || typeof counts !== "object" || Array.isArray(counts)) { problems.push(`${at} has no ${side} ${field} record`); continue; }
      for (const [type, n] of Object.entries(counts)) {
        if (!DECKS[side][type]) problems.push(`${at}: ${side} ${field} ${type}, which is outside the sampled decks`);
        if (!count(n)) problems.push(`${at}: ${side} ${field} ${type} count ${n} is not a whole number >= 1`);
      }
    }
  }
  if (problems.length) return problems;
  const again = summarizeSample(records);
  for (const key of Object.keys(again)) if (canonical(report[key]) !== canonical(again[key])) problems.push(`${key} does not follow from the game records`);
  if (report.recordsSha256 !== sha256(canonical(records))) problems.push("recordsSha256 does not match the game records");
  for (const side of OPENERS) if (!again.coverage.observed.some((type) => TYPES[type].side === side)) problems.push(`no ${side} card was played in any game`);
  return problems;
}

// The part of a valid report the release stamp keeps. Call it only after smokeProblems returned no
// problems: every field read here is then the plan's header or recomputed from the records.
export const smokeSummary = (r) => ({
  command: r.command, engine: r.engine.rules, engineSha256: r.engine.sha256, decks: r.decks.name, player: r.player,
  seeds: `${r.seeds.from}-${r.seeds.to}`, openers: r.openers, results: r.results, byOpener: r.byOpener, endings: r.endings,
  observed: Object.fromEntries(r.coverage.observed.map((type) => [type, r.cards[type].gamesPlayed])),
  showdownOnlyObserved: r.coverage.observed.filter((type) => r.cards[type].showdownOnly),
  inDeckUnobserved: r.coverage.inDeckUnobserved, outsideSample: r.coverage.outsideSample, recordsSha256: r.recordsSha256, scope: r.scope,
});

export function summaryLines(r) {
  const {results: t, cards} = r;
  const decks = OPENERS.map((side) => `${side} ${Object.values(r.decks.counts[side]).reduce((a, b) => a + b, 0)} cards`).join(", ");
  const card = (type) => {
    const c = cards[type];
    const stats = c.engineStats ? [`stars ${c.engineStats.stars} attack ${c.engineStats.attack} health ${c.engineStats.health}`] : [];
    const tags = [c.side, c.kind, ...(c.showdownOnly ? ["Showdown-only"] : []), `${c.copies} in deck`, ...stats].join(", ");
    return `  ${type} [${tags}]: played in ${c.gamesPlayed} of ${t.games} games, ${c.plays} plays${c.kind === "trap" ? `, sprung ${c.sprung}` : ""}`;
  };
  return [
    `Showdown smoke sample (${r.scope})`,
    `engine: ${r.engine.rules} sha256 ${r.engine.sha256[r.engine.rules]}; level-${r.player.botLevel} bot on both sides via ${r.player.function}`,
    `decks: ${r.decks.name} from ${r.decks.source} (${decks})`,
    `deck copies are the ${r.decks.name} counts above; a card spec's copies field does not change them, so a copies proposal is not measured here`,
    `seeds ${r.seeds.from}-${r.seeds.to}, each once from each opener: ${t.games} games, all finished`,
    `results: cowboy ${t.cowboy}, wizard ${t.wizard}, draws ${t.draw}; first seat ${t.first}, second seat ${t.second}`,
    ...OPENERS.map((o) => `${o} opens (${r.byOpener[o].games}): cowboy ${r.byOpener[o].cowboy}, wizard ${r.byOpener[o].wizard}, draws ${r.byOpener[o].draw}`),
    `endings: ${Object.entries(r.endings).map(([k, n]) => `${k} ${n}`).join(", ")}; turns min ${r.turns.min}, mean ${r.turns.mean}, max ${r.turns.max}`,
    `observed, played from hand in at least one game (${r.coverage.observed.length} of ${r.coverage.observed.length + r.coverage.inDeckUnobserved.length} deck card types):`,
    ...r.coverage.observed.map(card),
    `in the decks but never played, no coverage: ${r.coverage.inDeckUnobserved.join(", ") || "none"}`,
    `outside the sampled decks, no coverage (${r.coverage.outsideSample.length}): ${r.coverage.outsideSample.join(", ") || "none"}`,
    `records sha256 ${r.recordsSha256}`,
  ];
}

if (import.meta.main) {
  const usage = `usage: node scripts/showdown-smoke.mjs [--from <deal seed 0-${0xffffffff}>] [--count <1-${MAX_DEALS}, last seed a deal seed>] [--json]`;
  let values;
  try {
    ({values} = parseArgs({options: {from: {type: "string", default: "0"}, count: {type: "string", default: "8"}, json: {type: "boolean", default: false}}}));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const [from, deals] = [values.from, values.count].map((text) => (/^\d{1,10}$/.test(text) ? Number(text) : null));
  const plan = {from, count: deals};
  if (!validPlan(plan)) {
    console.error(usage);
    process.exit(2);
  }
  const report = smoke(plan);
  const problems = smokeProblems(report, plan);
  console.log(values.json ? JSON.stringify(report) : summaryLines(report).join("\n"));
  if (problems.length) {
    // One "error:" line per problem, so the release gate's failure summary quotes them.
    console.error(problems.map((problem) => `showdown smoke sample INVALID error: ${problem}`).join("\n"));
    process.exit(1);
  }
}
