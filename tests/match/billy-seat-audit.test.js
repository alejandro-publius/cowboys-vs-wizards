import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {summarizeRows} from "../../scripts/billy-seat-audit.mjs";

// The frozen protocol's fields, shrunk to a mini sample: 4 deals from seed 123, blocks of 2 deals.
const PROTOCOL = Object.freeze({
  schema: 1,
  sourceCommit: "eedab9385931e093e156fdb7885c470eb2ec64eb",
  card: "cowboy-billy",
  field: "attack",
  baseline: 2,
  candidate: 1,
  firstSeed: 123,
  deals: 4,
  blockDeals: 2,
  seats: Object.freeze(["cowboy", "wizard"]),
  botLevel: 2,
});
const PROTOCOL_SHA = "a".repeat(64);
const HEADER = "seed,first,baseline_winner,candidate_winner,baseline_turn,candidate_turn";

// One row per (seed, opening seat): cowboy opens first, then wizard. Seed 124/wizard moves cowboy -> draw
// and seed 125/cowboy moves draw -> cowboy, so both directions of a draw transition are present.
const ROWS = [
  "123,cowboy,cowboy,cowboy,13,15",
  "123,wizard,wizard,wizard,12,14",
  "124,cowboy,cowboy,wizard,11,20",
  "124,wizard,cowboy,draw,16,30",
  "125,cowboy,draw,cowboy,30,18",
  "125,wizard,wizard,cowboy,14,17",
  "126,cowboy,cowboy,cowboy,10,12",
  "126,wizard,cowboy,wizard,15,19",
];
const csv = (rows) => [HEADER, ...rows].map((line) => line + "\n").join("");
const CSV = csv(ROWS);
const SIDES = ["cowboy", "wizard", "draw"];
const zero = () => ({cowboy: 0, wizard: 0, draw: 0});

const sum = (cells) => SIDES.reduce((n, side) => n + cells[side], 0);

test("the mini sample summarizes to the shared result schema with no run-specific fields", () => {
  const result = summarizeRows(CSV, PROTOCOL, PROTOCOL_SHA);
  assert.deepEqual(Object.keys(result).sort(),
    ["blocks", "byFirst", "csvSha256", "deals", "firstSeed", "protocolSha256", "schema", "sourceCommit", "totalDuels"]);
  assert.equal(result.schema, 1);
  assert.equal(result.protocolSha256, PROTOCOL_SHA);
  assert.equal(result.sourceCommit, PROTOCOL.sourceCommit);
  assert.equal(result.firstSeed, 123);
  assert.equal(result.deals, 4);
  // 4 deals x 2 opening seats x 2 arms = 16 played games (the full run: 25,000 -> 100,000).
  assert.equal(result.totalDuels, 16);
  assert.deepEqual(Object.keys(result.byFirst).sort(), ["cowboy", "wizard"]);
});

test("before and after counts by opening seat match the rows", () => {
  const {byFirst} = summarizeRows(CSV, PROTOCOL, PROTOCOL_SHA);
  assert.deepEqual(byFirst.cowboy.baseline, {cowboy: 3, wizard: 0, draw: 1});
  assert.deepEqual(byFirst.cowboy.candidate, {cowboy: 3, wizard: 1, draw: 0});
  assert.deepEqual(byFirst.wizard.baseline, {cowboy: 2, wizard: 2, draw: 0});
  assert.deepEqual(byFirst.wizard.candidate, {cowboy: 1, wizard: 2, draw: 1});
  for (const first of ["cowboy", "wizard"]) {
    const seat = byFirst[first];
    assert.equal(seat.gamesPerArm, 4);
    assert.equal(sum(seat.baseline), seat.gamesPerArm);
    assert.equal(sum(seat.candidate), seat.gamesPerArm);
  }
});

test("transitions are keyed baseline winner then candidate winner and agree with both arms", () => {
  const {byFirst} = summarizeRows(CSV, PROTOCOL, PROTOCOL_SHA);
  assert.deepEqual(byFirst.cowboy.transitions, {
    cowboy: {cowboy: 2, wizard: 1, draw: 0},
    wizard: zero(),
    draw: {cowboy: 1, wizard: 0, draw: 0},
  });
  assert.deepEqual(byFirst.wizard.transitions, {
    cowboy: {cowboy: 0, wizard: 1, draw: 1},
    wizard: {cowboy: 1, wizard: 1, draw: 0},
    draw: zero(),
  });
  for (const first of ["cowboy", "wizard"]) {
    const {baseline, candidate, transitions} = byFirst[first];
    for (const before of SIDES) {
      assert.equal(sum(transitions[before]), baseline[before], `${first}: row ${before} sums to baseline`);
    }
    for (const after of SIDES) {
      const column = SIDES.reduce((n, before) => n + transitions[before][after], 0);
      assert.equal(column, candidate[after], `${first}: column ${after} sums to candidate`);
    }
    for (const before of SIDES) for (const after of SIDES) assert.ok(Number.isInteger(transitions[before][after]));
  }
});

test("blocks split the deals into consecutive seed ranges with Cowboy wins from both opening seats", () => {
  const {blocks} = summarizeRows(CSV, PROTOCOL, PROTOCOL_SHA);
  assert.deepEqual(blocks, [
    {firstSeed: 123, deals: 2, baselineCowboyWins: 3, candidateCowboyWins: 1},
    {firstSeed: 125, deals: 2, baselineCowboyWins: 2, candidateCowboyWins: 3},
  ]);
});

test("csvSha256 is the SHA-256 of the exact CSV bytes, and summarizing is repeatable", () => {
  const first = summarizeRows(CSV, PROTOCOL, PROTOCOL_SHA);
  assert.equal(first.csvSha256, createHash("sha256").update(CSV, "utf8").digest("hex"));
  assert.match(first.csvSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(summarizeRows(CSV, PROTOCOL, PROTOCOL_SHA), first);
});

const swap = (rows, i, j) => { const copy = [...rows]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy; };
const replace = (rows, i, line) => rows.map((row, k) => (k === i ? line : row));

const REJECTED = [
  ["opening seats out of order within a seed", csv(swap(ROWS, 0, 1))],
  ["seeds out of order", csv([...ROWS.slice(2, 4), ...ROWS.slice(0, 2), ...ROWS.slice(4)])],
  ["a duplicated row in place of the next one", csv(replace(ROWS, 1, ROWS[0]))],
  ["a duplicated row appended", csv([...ROWS, ROWS[7]])],
  ["a missing final deal", csv(ROWS.slice(0, 6))],
  ["a missing final row", csv(ROWS.slice(0, 7))],
  ["a seed gap", csv(replace(replace(ROWS, 6, "127,cowboy,cowboy,cowboy,10,12"), 7, "127,wizard,cowboy,wizard,15,19"))],
  ["a row missing its last field", csv(replace(ROWS, 3, "124,wizard,cowboy,draw,16"))],
  ["an invalid baseline winner", csv(replace(ROWS, 2, "124,cowboy,cowboys,wizard,11,20"))],
  ["an invalid candidate winner", csv(replace(ROWS, 5, "125,wizard,wizard,Cowboy,14,17"))],
  ["an invalid opening seat", csv(replace(ROWS, 4, "125,draw,draw,cowboy,30,18"))],
  ["a wrong header", CSV.replace("candidate_turn", "Candidate_Turn")],
  ["no final LF", CSV.slice(0, -1)],
  ["CRLF line endings", CSV.replace(/\n/g, "\r\n")],
];

for (const [label, text] of REJECTED) {
  test(`rejects ${label}`, () => {
    assert.throws(() => summarizeRows(text, PROTOCOL, PROTOCOL_SHA), Error);
  });
}
