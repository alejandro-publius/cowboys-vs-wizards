// Pure checks for scripts/scout-ruling.mjs: counts, blocks, the ruling on the committed scout record and the example
// shape. No engine is built and no game is played here; the replay runs only in `node scripts/scout-ruling.mjs`.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {scoutNominationProblems} from "../../scripts/field-trial-confirm.mjs";
import {canonical, sha256} from "../../scripts/night-review.mjs";
import {Problem, blocksOf, countsOf, exampleOf, firstDifference, ruleScout} from "../../scripts/scout-ruling.mjs";

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
function committed() {
  const briefText = read("docs/evidence/night-shift-repair/brief.json");
  return [JSON.parse(read("docs/evidence/night-shift-repair/scout.json")), JSON.parse(briefText), sha256(briefText),
    JSON.parse(read(".kiro/specs/night-shift-repair/protocol.json"))];
}

test("out-of-bounds and compiler-rejected edits are counted apart and add no simulated games", () => {
  const cohorts = {"scout-1": {games: 4}, "scout-2": {games: 4}};
  const result = {baseline: cohorts, excluded: [{}, {}], candidates: [
    {status: "measured", passesNsb1AndNsb2BothCohorts: false, cohorts},
    {status: "measured", passesNsb1AndNsb2BothCohorts: true, cohorts},
    {status: "engine-rejected"}]};
  assert.deepEqual(countsOf(result), {proposed: 3, measured: 2, compilerRejected: 1, eligible: 1, simulatedGames: 24});
});

test("one Cowboy win over the ceiling fails a block; a block at the ceiling holds", () => {
  const row = (wins, pass) => ({games: 320, cowboyWins: wins, cowboyShare: (100 * wins) / 320, requirements: {"NSB-1": {pass}, "NSB-2": {pass: true}}});
  const blocks = blocksOf({cohorts: {"scout-1": row(176, true), "scout-2": row(177, false)}},
    {"scout-1": {cowboyShare: 65}, "scout-2": {cowboyShare: 60}}, [{name: "scout-1"}, {name: "scout-2"}], 55);
  assert.deepEqual(blocks, [
    {id: "scout-1", games: 320, cowboyWins: 176, candidatePct: 55, baselinePct: 65, ceilingPct: 55, overByWins: 0, pass: true},
    {id: "scout-2", games: 320, cowboyWins: 177, candidatePct: 55.3125, baselinePct: 60, ceilingPct: 55, overByWins: 1, pass: false}]);
});

test("the committed scout record is withheld on its nearest measured edit", () => {
  const {nearest, ruling} = ruleScout(...committed());
  assert.equal(nearest.id, "cowboy-sheriff.health-1");
  assert.deepEqual(ruling.change, {card: "cowboy-sheriff", field: "health", from: 3, to: 2});
  assert.deepEqual(ruling.counts, {proposed: 82, measured: 76, compilerRejected: 6, eligible: 0, simulatedGames: 49280});
  assert.deepEqual(ruling.blocks.map((b) => [b.id, b.cowboyWins, b.baselinePct, b.overByWins, b.pass]),
    [["scout-1", 166, 65, 0, true], ["scout-2", 177, 60, 1, false]]);
});

test("an edited scout record fails its canonical seal", () => {
  const [scout, ...rest] = committed();
  scout.result.candidates[0].cohorts["scout-2"].cowboyWins = 176;
  assert.throws(() => ruleScout(scout, ...rest), /canonical resultSha256/);
});

test("a resealed record where an edit meets both checks on both cohorts is not a declined case", () => {
  const [scout, ...rest] = committed();
  const m = scout.result.candidates[0], row = m.cohorts["scout-2"];
  Object.assign(row, {cowboyWins: 176, wizardWins: 144, cowboyShare: 55, wizardShare: 45});
  Object.assign(row.requirements["NSB-1"], {pass: true, cowboyShare: 55, wizardShare: 45, outsidePp: 0});
  Object.assign(m, {passesNsb1AndNsb2BothCohorts: true, worstOutsidePp: 0, evenDistancePp: 5});
  scout.result.counts.passingNsb1AndNsb2BothCohorts = 1;
  scout.resultSha256 = sha256(canonical(scout.result));
  assert.throws(() => ruleScout(scout, ...rest), /not a declined case/);
});

test("the example is the first differing applied event, with its turn, words and both winners", () => {
  const rows = (left) => [{turn: 1, event: {type: "draw", side: "wizard"}, label: "Wizard draws a card"},
    {turn: 2, event: {type: "attack", side: "wizard", cardId: "wizard-imp-1", target: "cowboy-sheriff-1", targetLeft: left},
      label: `Wizard's Imp attacks Cowboy's Sheriff: Sheriff ${left} left`}];
  const move = (left) => ({label: `Wizard's Imp attacks Cowboy's Sheriff: Sheriff ${left} left`, turn: 2, card: "wizard-imp-1", target: "cowboy-sheriff-1"});
  assert.deepEqual(exampleOf(7, "wizard", {rows: rows(1), result: {winner: "cowboy"}}, {rows: rows(0), result: {winner: "wizard"}}),
    {seed: 7, first: "wizard", turn: 2, baseline: {winner: "cowboy", move: move(1)}, candidate: {winner: "wizard", move: move(0)}});
  // A log that is a prefix of the other has no event to compare.
  assert.equal(firstDifference(rows(1).slice(0, 1), rows(0)), -1);
  assert.throws(() => exampleOf(7, "wizard", {rows: rows(1).slice(0, 1), result: {winner: "cowboy"}}, {rows: rows(0), result: {winner: "wizard"}}), Problem);
  // Same sentence, different event: the differing field is named so the two lines stay distinct.
  const tie = (cardId) => [{turn: 3, event: {type: "draw", side: "cowboy", cardId}, label: "Cowboy draws a card"}];
  const t = exampleOf(9, "cowboy", {rows: tie("cowboy-billy-1"), result: {winner: "cowboy"}}, {rows: tie("cowboy-ranger-1"), result: {winner: null}});
  assert.deepEqual([t.baseline.move.label, t.candidate.move.label, t.candidate.winner],
    ['Cowboy draws a card (cardId "cowboy-billy-1")', 'Cowboy draws a card (cardId "cowboy-ranger-1")', "draw"]);
});


test("fresh confirmation independently rejects the Sheriff's sealed scout result and a changed receipt", () => {
  const inputs = committed();
  const [scout, , , protocol] = inputs;
  const {change} = ruleScout(...inputs).ruling;
  const {base, contract} = scout.result;
  const problems = () => scoutNominationProblems(scout, change, base, protocol, contract, contract.sha256);
  assert.deepEqual(problems(), ["scout-2: nominated edit fails NSB-1"]);
  scout.resultSha256 = "0".repeat(64);
  assert.deepEqual(problems(), ["scout measurements failed their seal"]);
});
