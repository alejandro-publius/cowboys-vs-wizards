// Balance receipts (scripts/balance-evidence.mjs): a real short run through the working-tree engine,
// then corrupt, fabricated, overlapping and empty evidence. Engine ids here are placeholders: these
// receipts are built in memory and never written to reports/balance/.
import test from "node:test";
import assert from "node:assert/strict";
import {DECKS, TYPES, typeOf} from "../../src/game/showdown/cards.js";
import {createShowdown, playTurn} from "../../src/game/showdown/rules.js";
import {buildReport, combine, coverageOf, playDeals, reportProblems, rerunProblems, sha256, tally} from "../../scripts/balance-evidence.mjs";

const engine = {createShowdown, playTurn, TYPES, DECKS, typeOf};
const ids = {tree: "b".repeat(40), specBlob: "c".repeat(40)};
const make = (from, deals, {commit = "a".repeat(40), engineIds = ids} = {}) => buildReport({
  commit, engine: engineIds, run: playDeals(engine, from, deals), from, deals,
  generatedAt: "2026-11-23T00:00:00.000Z", runner: {path: "test"}, elapsedMs: 0,
});
const copy = (value) => structuredClone(value);
const twoDeals = make(0, 2);
const deckTypes = new Set([...Object.keys(DECKS.cowboy), ...Object.keys(DECKS.wizard)]);

test("a real two-deal run is deterministic, passes its own check and replays", () => {
  assert.deepEqual(reportProblems(twoDeals), []);
  assert.equal(twoDeals.games, 4);
  assert.equal(twoDeals.outcomes.length, 4);
  assert.deepEqual(playDeals(engine, 0, 2), playDeals(engine, 0, 2));
  assert.deepEqual(rerunProblems(twoDeals, engine), []);
});

test("per-card counts are separate from the faction result: in-deck rates are the faction rate, other cards are unknown", () => {
  const {perCard, results, coverage} = twoDeals;
  assert.equal(Object.keys(perCard).length, Object.keys(TYPES).length);
  for (const [type, row] of Object.entries(perCard)) {
    if (deckTypes.has(type)) {
      assert.equal(row.inDeck.games, twoDeals.games, type);
      assert.equal(row.inDeck.wins, results[row.side], `${type}: in-deck wins are its faction's wins, so they say nothing about the card`);
    } else {
      assert.deepEqual([row.inDeck.games, row.drawn.games, row.played.games], [0, 0, 0], type);
      assert.ok(coverage.missing.includes(type), `${type} is reported missing, not 0% or 50%`);
    }
    assert.ok(row.played.games <= row.drawn.games && row.drawn.games <= row.inDeck.games, type);
  }
  assert.equal(coverage.inDeck, deckTypes.size);
  assert.deepEqual(coverageOf(perCard), coverage);
  assert.ok(!("cards" in twoDeals), "the scorecard's cards field is not filled from faction or biased counts");
});

test("corrupt receipts are rejected with a reason", () => {
  const cases = {
    "not an object": () => null,
    "wrong schema": (r) => { r.schema = "cvw-balance-report/0"; },
    "short commit": (r) => { r.commit = "abc123"; },
    "games do not match the seed range": (r) => { r.games = 6; },
    "results do not sum": (r) => { r.results.draw += 1; },
    "totals only": (r) => { delete r.outcomes; },
    "outcome changed without its hash": (r) => { r.outcomes = (r.outcomes[0] === "c" ? "w" : "c") + r.outcomes.slice(1); },
    "bad outcome letters": (r) => { r.outcomes = "x".repeat(r.games); },
    "seats do not match outcomes": (r) => { r.seats.first += 1; r.seats.second -= 1; },
    "reasons do not sum": (r) => { r.reasons = {base: 1}; },
    "played more often than drawn": (r) => { const row = Object.values(r.perCard).find((c) => c.drawn.games); row.played.games = row.drawn.games + 1; },
    "card wins above its faction's wins": (r) => { const row = Object.values(r.perCard).find((c) => c.inDeck.games); row.drawn.wins = r.results[row.side] + 1; },
    "in-deck wins differ from faction": (r) => { const row = Object.values(r.perCard).find((c) => c.inDeck.games); row.inDeck.wins = row.inDeck.wins ? row.inDeck.wins - 1 : 1; },
    "coverage claims more cards": (r) => { r.coverage.played += 1; },
    "no per-card section": (r) => { delete r.perCard; },
    "cards field with wins above games": (r) => { r.cards = {"cowboy-sheriff": {games: 1, wins: 2}}; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const r = copy(twoDeals);
    const out = mutate(r);
    const problems = reportProblems(out === undefined ? r : out);
    assert.ok(problems.length > 0, `${name} should be rejected`);
  }
});

test("a fabricated but self-consistent receipt is caught by replay", () => {
  const singles = Array.from({length: 6}, (_, seed) => make(seed, 1));
  const shape = (r) => JSON.stringify([r.outcomes, r.perCard]);
  const pair = singles.flatMap((a, i) => singles.map((b, j) => [i, j]).filter(([, j]) => j !== i && shape(singles[j]) !== shape(a)))[0];
  assert.ok(pair, "two of seeds 0-5 play differently");
  const [real, claimed] = pair;
  const fake = copy(singles[real]);
  fake.seeds = {...fake.seeds, from: claimed, to: claimed};
  assert.deepEqual(reportProblems(fake), [], "arithmetic alone cannot tell it apart");
  assert.ok(rerunProblems(fake, engine).length > 0, "a replay of the claimed seed disagrees");
});

test("overlapping, repeated and baseline-equals-candidate receipts count each duel once", () => {
  const a = make(0, 2);
  const b = make(1, 2);
  const sameEngineOtherCommit = {...copy(a), commit: "d".repeat(40)};
  const result = combine([{name: "a", report: a}, {name: "a-copy", report: copy(a)}, {name: "b", report: b}, {name: "baseline", report: sameEngineOtherCommit}]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.groups.length, 1);
  const [g] = result.groups;
  assert.equal(g.uniqueGames, 6);
  assert.equal(g.rawGames, 4 + 4 + 4 + 4);
  assert.equal(g.duplicateGames, 10);
  assert.deepEqual(g.seedRanges, [{from: 0, to: 2}]);
  const union = playDeals(engine, 0, 3).outcomes;
  assert.deepEqual({cowboy: g.faction.cowboy, wizard: g.faction.wizard, draw: g.faction.draw}, tally(union).results);
  assert.equal(g.perCardGames, 4, "per-card totals use only receipts that overlap nothing already used");
  assert.deepEqual(g.perCardExcluded.sort(), ["a-copy", "b", "baseline"]);
  assert.equal(g.commits.length, 2);

  const otherEngine = combine([{name: "a", report: a}, {name: "c", report: make(0, 2, {engineIds: {...ids, tree: "e".repeat(40)}})}]);
  assert.equal(otherEngine.uniqueGames, 8, "a different engine tree is a different duel");
  assert.equal(otherEngine.groups.length, 2);
});

test("overlapping receipts that disagree on a shared seed are reported", () => {
  const a = make(0, 2);
  const b = copy(make(1, 2));
  b.outcomes = (b.outcomes[0] === "c" ? "w" : "c") + b.outcomes.slice(1);
  b.outcomesSha256 = sha256(b.outcomes);
  const result = combine([{name: "a", report: a}, {name: "b", report: b}]);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /different outcomes for seeds 1-1/);
});

test("empty evidence is 0 duels with every card unknown, never a pass", () => {
  const result = combine([]);
  assert.equal(result.uniqueGames, 0);
  assert.deepEqual(result.groups, []);
  assert.equal(result.problems.length, 1);
});

test("full study replay rejects a card win count that differs from the draws", () => {
  const control = copy(twoDeals);
  control.cardStudy = {metric: "owner wins among games drawn", focus: "control"};
  control.cards = Object.fromEntries(Object.entries(control.perCard)
    .filter(([, row]) => row.drawn.games)
    .map(([type, {drawn}]) => [type, {games: drawn.games, wins: drawn.wins}]));
  assert.deepEqual(reportProblems(control), []);
  assert.deepEqual(rerunProblems(control, engine), []);
  const measured = Object.values(control.cards)[0];
  measured.wins = measured.wins ? 0 : 1;
  assert.ok(reportProblems(control).includes("study card estimates differ from recorded draw counts"));
  assert.ok(rerunProblems(control, engine).includes("card win rates differ from a full replay"));
});
