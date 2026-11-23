// Boot Hill poker check of the shared paired duel kit (src/review/paired-duel-kit.js), the same kit Showdown uses.
// Plays a seeded cohort of experiments/boot-hill-poker/engine.js playPokerDuel(seed, first, "standard") as both
// arms, so every pair must agree, then replays it and checks:
//   - completeness: every seed opened once by each seat, in seed then cowboy, wizard order, with counts that add up;
//   - replay: a second cohort and direct engine calls give identical records;
//   - classification: every game is cowboy, wizard or draw with a positive whole endTurn; draws are counted, never dropped;
//   - fail-closed: copies of real outcomes with the winner or endTurn removed are rejected (labelled fixtures, never counted);
//   - balance contract: the Night Shift NSB-1/NSB-2 requirements are evaluated on the measured poker shares.
// The contract result is descriptive. Poker is a different game, so a share outside the Showdown band is reported,
// not treated as a defect, and a pass is not a fairness claim. Only an unmeasured or malformed evaluation fails.
//
//   node scripts/verify-poker-kit.mjs [--first-seed <n>=1] [--deals <n>=500]
// Exit status: 0 all checks passed, 1 a check failed, 2 usage error.
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {DRAW, PairedCohortError, measurePairedCohort} from "../src/review/paired-duel-kit.js";
import {playPokerDuel} from "../experiments/boot-hill-poker/engine.js";
import {evaluateBalanceRequirements, loadBalanceContract} from "./showdown-balance-contract.mjs";

export const SIDES = Object.freeze(["cowboy", "wizard"]);
export const STRATEGY = "standard";
export const DEFAULTS = Object.freeze({firstSeed: 1, deals: 500});
const MAX_DEALS = 20_000;

const pct = (n, games) => (100 * n) / games;

function parseArgs(args) {
  const opts = {...DEFAULTS};
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = {"--first-seed": "firstSeed", "--deals": "deals"}[args[i]];
    const raw = args[i + 1];
    if (!key || seen.has(key) || !/^(0|[1-9][0-9]*)$/.test(raw ?? "")) return null;
    seen.add(key);
    opts[key] = Number(raw);
  }
  if (!Number.isSafeInteger(opts.firstSeed) || !Number.isSafeInteger(opts.deals) || opts.deals < 1 || opts.deals > MAX_DEALS) return null;
  return opts;
}

const play = (seed, first) => playPokerDuel(seed, first, STRATEGY);

// One cohort with every pair recorded in the order the kit produced it.
function runCohort(firstSeed, deals) {
  const pairs = [];
  const result = measurePairedCohort({firstSeed, deals, sides: [...SIDES], playBaseline: play, playCandidate: play,
    onPair: (pair) => pairs.push(pair)});
  return {result, pairs};
}

function checkCompleteness({result, pairs}, firstSeed, deals) {
  const games = deals * SIDES.length;
  assert.equal(result.gamesPerArm, games, "gamesPerArm must be two games per deal");
  assert.equal(pairs.length, games, "onPair must see every game once");
  pairs.forEach((pair, i) => {
    assert.equal(pair.seed, firstSeed + Math.floor(i / SIDES.length), `pair ${i}: seed out of order, duplicated or missing`);
    assert.equal(pair.first, SIDES[i % SIDES.length], `pair ${i}: opening seat out of order, duplicated or missing`);
  });
  for (const arm of ["baseline", "candidate"]) {
    const a = result[arm];
    assert.equal(a.wins.cowboy + a.wins.wizard + a.draws, games, `${arm}: wins and draws must cover every game`);
    // Recount from the records so the totals cannot drift from the games they describe.
    const recount = {cowboy: 0, wizard: 0, draws: 0, firstWins: 0};
    for (const pair of pairs) {
      const o = pair[arm];
      assert.ok([...SIDES, DRAW].includes(o.winner), `seed ${pair.seed} ${pair.first} first ${arm}: winner ${o.winner} is not a valid classification`);
      assert.ok(Number.isSafeInteger(o.endTurn) && o.endTurn >= 1, `seed ${pair.seed} ${pair.first} first ${arm}: endTurn ${o.endTurn}`);
      if (o.winner === DRAW) recount.draws += 1;
      else { recount[o.winner] += 1; if (o.winner === pair.first) recount.firstWins += 1; }
    }
    assert.deepEqual({cowboy: a.wins.cowboy, wizard: a.wins.wizard, draws: a.draws, firstWins: a.firstWins}, recount, `${arm}: totals differ from the recorded games`);
  }
}

function checkReplay(first, firstSeed, deals) {
  // Both arms run the same engine and strategy on the same seeds, so no game may change winner or length.
  assert.equal(first.result.switchedWinners, 0, "identical arms switched a winner: the engine is not deterministic per seed and seat");
  first.pairs.forEach((p) => assert.deepEqual(p.baseline, p.candidate, `seed ${p.seed} ${p.first} first: arms differ`));
  const again = runCohort(firstSeed, deals);
  assert.deepEqual(again.result, first.result, "replayed cohort totals differ");
  assert.deepEqual(again.pairs, first.pairs, "replayed cohort records differ");
  // Direct engine calls, including the default strategy argument, match the kit's records.
  for (const p of [first.pairs[0], first.pairs[1], first.pairs.at(-2), first.pairs.at(-1)]) {
    for (const outcome of [playPokerDuel(p.seed, p.first, STRATEGY), playPokerDuel(p.seed, p.first)]) {
      assert.deepEqual({winner: outcome.winner, endTurn: outcome.endTurn}, p.baseline, `seed ${p.seed} ${p.first} first: direct call differs`);
    }
  }
}

// Fixtures derived from one real outcome, with a field removed; the kit must reject each. Never counted as poker results.
function checkFailClosed(pair) {
  const real = playPokerDuel(pair.seed, pair.first, STRATEGY);
  const {winner, ...noWinner} = real;
  const {endTurn, ...noEndTurn} = real;
  const fixtures = {"missing winner": noWinner, "missing endTurn": noEndTurn, "missing outcome": undefined};
  for (const [label, fixture] of Object.entries(fixtures)) {
    assert.throws(() => measurePairedCohort({firstSeed: pair.seed, deals: 1, sides: [...SIDES], playBaseline: play,
      playCandidate: (seed, first) => (seed === pair.seed && first === pair.first ? fixture : play(seed, first))}),
    PairedCohortError, `fixture "${label}" was accepted`);
  }
  return Object.keys(fixtures);
}

// Measured shares in percent units, as the Night Shift contract expects.
export function shares(arm, games) {
  return {cowboyShare: pct(arm.wins.cowboy, games), wizardShare: pct(arm.wins.wizard, games),
    drawShare: pct(arm.draws, games), firstShare: pct(arm.firstWins, games), seatSkew: Math.abs(pct(arm.firstWins, games) - 50)};
}

function checkContract(result) {
  const policy = loadBalanceContract();
  const games = result.gamesPerArm;
  const base = shares(result.baseline, games), cand = shares(result.candidate, games);
  const evaluation = evaluateBalanceRequirements(policy, {cowboyShare: cand.cowboyShare, wizardShare: cand.wizardShare,
    seatSkew: cand.seatSkew, baselineSeatSkew: base.seatSkew});
  assert.deepEqual(evaluation.map((r) => r.id), ["NSB-1", "NSB-2"], "contract evaluation must cover NSB-1 and NSB-2");
  for (const r of evaluation) {
    assert.equal(r.measured, true, `${r.id} was not measured`);
    assert.equal(typeof r.pass, "boolean", `${r.id} pass must be true or false`);
  }
  return {policy, measured: cand, evaluation: evaluation.map((r) => ({id: r.id, withinShowdownLimit: r.pass}))};
}

async function main(args) {
  const opts = parseArgs(args);
  if (!opts) {
    console.error(`Usage: node scripts/verify-poker-kit.mjs [--first-seed <n>] [--deals 1..${MAX_DEALS}]`);
    return 2;
  }
  const {firstSeed, deals} = opts;
  const cohort = runCohort(firstSeed, deals);
  checkCompleteness(cohort, firstSeed, deals);
  checkReplay(cohort, firstSeed, deals);
  const rejected = checkFailClosed(cohort.pairs[0]);
  const contract = checkContract(cohort.result);
  const {result} = cohort;
  console.log(JSON.stringify({
    check: "verify-poker-kit", engine: "experiments/boot-hill-poker/engine.js", strategy: STRATEGY,
    seeds: [firstSeed, firstSeed + deals - 1], gamesPerArm: result.gamesPerArm, baseline: result.baseline,
    switchedWinners: result.switchedWinners, replayed: true, fixturesRejected: rejected,
    contract: {band: contract.policy.band, seatTolerancePp: contract.policy.seatTolerancePp, measured: contract.measured, evaluation: contract.evaluation,
      note: "Descriptive only: Showdown's limits applied to poker results; not a fairness claim for poker."},
  }));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(`verify-poker-kit: ${error.message}`);
    process.exitCode = 1;
  });
}
