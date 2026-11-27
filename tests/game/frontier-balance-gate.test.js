import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const cli = fileURLToPath(new URL("../../packages/frontier-kit/balance-gate.mjs", import.meta.url));
const bothPass = {"NSB-1": true, "NSB-2": true};

function fixture(deals = 50) {
  const sides = ["ember", "tide"];
  const plan = {sides, tune: {firstSeed: 10, deals}, holdout: {firstSeed: 10 + deals, deals}};
  const evidence = {};
  for (const name of ["tune", "holdout"]) {
    evidence[name] = [];
    const {firstSeed, deals} = plan[name];
    for (let i = 0; i < deals; i++) {
      const winner = sides[i % 2];
      for (const first of sides) {
        evidence[name].push({seed: firstSeed + i, first, baseline: {winner, endTurn: 3}, candidate: {winner, endTurn: 4}});
      }
    }
  }
  return {plan, evidence};
}

function caller(t) {
  const cwd = mkdtempSync(join(tmpdir(), "frontier-caller-"));
  t.after(() => rmSync(cwd, {recursive: true, force: true}));
  return ({plan, evidence, evidenceText = JSON.stringify(evidence)}) => {
    writeFileSync(join(cwd, "plan.json"), JSON.stringify(plan));
    writeFileSync(join(cwd, "evidence.json"), evidenceText);
    return spawnSync(process.execPath, [cli, "plan.json", "evidence.json"], {cwd, encoding: "utf8"});
  };
}

test("Boot Hill Poker's recorded discard policies pass and reject through the external caller", t => {
  const poker = new URL("../../experiments/boot-hill-poker/", import.meta.url);
  const plan = JSON.parse(readFileSync(new URL("balance-plan.json", poker), "utf8"));
  const run = caller(t);
  for (const [policy, exit] of [["standard", 0], ["pat", 2]]) {
    const pairs = spawnSync(process.execPath, [fileURLToPath(new URL("balance-evidence.mjs", poker)), policy], {encoding: "utf8"});
    assert.equal(pairs.status, 0, pairs.stderr);
    const gate = run({plan, evidenceText: pairs.stdout});
    assert.equal(gate.status, exit, gate.stderr);
    const {tune, holdout} = JSON.parse(gate.stdout).cohorts;
    assert.deepEqual([tune.baseline.wins.cowboy, holdout.baseline.wins.cowboy], [295, 308]);
    assert.deepEqual([tune.candidate.wins.cowboy, holdout.candidate.wins.cowboy], policy === "standard" ? [500, 500] : [295, 308]);
    assert.deepEqual([tune.switchedWinners, holdout.switchedWinners], policy === "standard" ? [291, 274] : [0, 0]);
  }
});

test("the caller receives a pass at the inclusive faction and seat boundaries, with draws counted", t => {
  const inputs = fixture();
  const {tune, holdout} = inputs.evidence;
  // Five Tide wins switch to Ember. Three switches favor the opening seat and two favor the second.
  for (const i of [2, 3, 6, 7, 10]) tune[i].candidate.winner = "ember";
  // Five wins on each side turn into draws. Every changed game had been won by the second seat.
  for (let i = 0; i < 5; i++) {
    holdout[4 * i + 1].candidate.winner = null;
    holdout[4 * i + 2].candidate.winner = "draw";
  }

  const run = caller(t)(inputs);
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.verdict, "PASS");
  assert.deepEqual(report.sides, inputs.plan.sides);
  assert.deepEqual(report.policy.band, [45, 55]);
  assert.equal(report.policy.seatTolerancePp, 1);
  for (const name of ["tune", "holdout"]) {
    const cohort = report.cohorts[name];
    assert.equal(cohort.firstSeed, inputs.plan[name].firstSeed);
    assert.equal(cohort.deals, 50);
    assert.equal(cohort.gamesPerArm, 100);
    assert.deepEqual(cohort.baseline.wins, {ember: 50, tide: 50});
    assert.equal(cohort.baseline.firstWins, 50);
    assert.deepEqual(cohort.checks, bothPass);
  }
  assert.deepEqual(report.cohorts.tune.candidate.wins, {ember: 55, tide: 45});
  assert.equal(report.cohorts.tune.candidate.firstWins, 51);
  assert.equal(report.cohorts.tune.switchedWinners, 5);
  assert.deepEqual(report.cohorts.holdout.candidate.wins, {ember: 45, tide: 45});
  assert.equal(report.cohorts.holdout.candidate.draws, 10);
  assert.equal(report.cohorts.holdout.switchedWinners, 10);
});

test("holdout alone can reject on seat skew against its own baseline with both side shares at 50%", t => {
  const inputs = fixture();
  for (const pair of inputs.evidence.tune) {
    pair.candidate.winner = pair.baseline.winner = pair.first;
  }
  for (const pair of inputs.evidence.holdout.slice(0, 4)) pair.candidate.winner = pair.first;
  const run = caller(t)(inputs);
  assert.equal(run.status, 2, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.verdict, "REJECT");
  assert.deepEqual(report.cohorts.tune.checks, bothPass);
  assert.deepEqual(report.cohorts.holdout.candidate.wins, {ember: 50, tide: 50});
  assert.equal(report.cohorts.holdout.candidate.firstWins, 52);
  assert.deepEqual(report.cohorts.holdout.checks, {"NSB-1": true, "NSB-2": false});
});

test("191 opening wins in 300 games can grow to 194 but a 195th fails the seat limit", t => {
  const inputs = fixture(150);
  const run = caller(t);
  const secondSeatWins = inputs.evidence.holdout.filter(row => row.baseline.winner !== row.first);
  // The fixture starts at 150 opening wins. Alternate which side gains the next 41.
  for (const row of secondSeatWins.slice(0, 41)) row.baseline.winner = row.candidate.winner = row.first;
  for (const row of secondSeatWins.slice(41, 44)) row.candidate.winner = row.first;
  const limit = run(inputs);
  assert.equal(limit.status, 0, limit.stdout + limit.stderr);
  const atLimit = JSON.parse(limit.stdout).cohorts.holdout;
  assert.equal(atLimit.gamesPerArm, 300);
  assert.equal(atLimit.baseline.firstWins, 191);
  assert.equal(atLimit.candidate.firstWins, 194);
  assert.deepEqual(atLimit.checks, bothPass);

  secondSeatWins[44].candidate.winner = secondSeatWins[44].first;
  const beyond = run(inputs);
  assert.equal(beyond.status, 2, beyond.stderr);
  const overLimit = JSON.parse(beyond.stdout).cohorts.holdout;
  assert.equal(overLimit.candidate.firstWins, 195);
  assert.deepEqual(overLimit.checks, {"NSB-1": true, "NSB-2": false});
});

test("a faction below the band rejects even when the opposing share and seat skew pass", t => {
  const inputs = fixture();
  for (let i = 0; i < 6; i++) inputs.evidence.tune[4 * i + 2].candidate.winner = "draw";
  const run = caller(t)(inputs);
  assert.equal(run.status, 2, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.verdict, "REJECT");
  assert.deepEqual(report.cohorts.tune.candidate.wins, {ember: 50, tide: 44});
  assert.deepEqual(report.cohorts.tune.checks, {"NSB-1": false, "NSB-2": true});
  assert.deepEqual(report.cohorts.holdout.checks, bothPass);
});

test("invalid plans and incomplete or malformed pairs exit 1 without reporting a verdict", t => {
  const run = caller(t);
  const cases = {
    "truncated evidence JSON": (inputs) => { inputs.evidenceText = '{"tune":'; },
    "missing holdout": ({evidence}) => { delete evidence.holdout; },
    "last seed missing": ({evidence}) => { evidence.holdout.splice(-2); },
    "extra pair": ({evidence}) => { evidence.tune.push(evidence.tune[0]); },
    "duplicate opener": ({evidence}) => { evidence.tune[1].first = evidence.tune[0].first; },
    "duplicate seed": ({evidence}) => { evidence.tune.splice(2, 2, ...evidence.tune.slice(0, 2)); },
    "reordered openers": ({evidence}) => { evidence.tune.splice(0, 2, evidence.tune[1], evidence.tune[0]); },
    "missing baseline": ({evidence}) => { delete evidence.tune[0].baseline; },
    "missing winner": ({evidence}) => { delete evidence.holdout[0].candidate.winner; },
    "unknown winner": ({evidence}) => { evidence.tune[0].baseline.winner = "other"; },
    "invalid ending turn": ({evidence}) => { evidence.tune[0].candidate.endTurn = 0; },
    "overlapping ranges with matching evidence": ({plan, evidence}) => {
      plan.holdout.firstSeed--;
      for (const row of evidence.holdout) row.seed--;
    },
    "fractional deal count": ({plan}) => { plan.tune.deals = 1.5; },
    "duplicate sides": ({plan}) => { plan.sides[1] = plan.sides[0]; },
  };
  for (const [name, edit] of Object.entries(cases)) {
    const inputs = fixture();
    edit(inputs);
    const result = run(inputs);
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, /\S/, name);
    assert.equal(result.stdout, "", name);
  }
});
