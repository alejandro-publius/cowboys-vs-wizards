import { readFileSync, statSync } from 'node:fs';
import { inBand, loadBalanceContract } from '../../scripts/showdown-balance-contract.mjs';
import { measurePairedCohort } from './index.js';

const cohorts = ['tune', 'holdout'];

function readInput(file, keys) {
  const info = statSync(file);
  if (!info.isFile() || info.size > 64 * 1024 * 1024) throw new Error(`${file} must be a regular JSON file of at most 64 MiB`);
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file)));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  if (!value || typeof value !== 'object' || !keys.every(key => Object.hasOwn(value, key)) || Object.keys(value).length !== keys.length) {
    throw new Error(`${file} must contain exactly: ${keys.join(', ')}`);
  }
  return value;
}

function observations(arm, games, sides) {
  const winSharePct = Object.fromEntries(sides.map(side => [side, 100 * arm.wins[side] / games]));
  const firstSharePct = 100 * arm.firstWins / games;
  return { ...arm, winSharePct, firstSharePct, seatSkew: Math.abs(firstSharePct - 50) };
}

function checkCohort({ firstSeed, deals }, rows, sides, policy) {
  if (!Array.isArray(rows) || rows.length !== 2 * deals) throw new Error('expected two paired rows per planned deal');
  let index = 0;
  // The kit requests baseline then candidate for each planned (seed, opener).
  const { gamesPerArm, switchedWinners, baseline, candidate } = measurePairedCohort({
    firstSeed, deals, sides,
    playBaseline(seed, first) {
      const row = rows[index];
      if (row?.seed !== seed || row?.first !== first) throw new Error(`row ${index + 1}: expected seed ${seed}, ${first} first`);
      return row.baseline;
    },
    playCandidate() { return rows[index++].candidate; },
  });
  const base = observations(baseline, gamesPerArm, sides);
  const next = observations(candidate, gamesPerArm, sides);
  // Half the games per arm is exactly 'deals'. Subtract counts before dividing so growth at the inclusive limit passes.
  const skewChange = Math.abs(candidate.firstWins - deals) - Math.abs(baseline.firstWins - deals);
  const seatSkewGrowthPp = 100 * skewChange / gamesPerArm;
  const checks = {
    'NSB-1': sides.every(side => inBand(next.winSharePct[side], policy.band)),
    'NSB-2': seatSkewGrowthPp <= policy.seatTolerancePp,
  };
  return { firstSeed, deals, gamesPerArm, baseline: base, candidate: next, switchedWinners, seatSkewGrowthPp, checks };
}

function run(args) {
  if (args.length !== 2) throw new Error('Usage: node balance-gate.mjs PLAN.json EVIDENCE.json');
  const plan = readInput(args[0], ['sides', ...cohorts]);
  const evidence = readInput(args[1], cohorts);
  const policy = loadBalanceContract();
  const results = {};
  for (const name of cohorts) {
    try {
      results[name] = checkCohort(plan[name], evidence[name], plan.sides, policy);
    } catch (error) {
      throw new Error(`${name}: ${error.message}`);
    }
  }
  const [earlier, later] = [results.tune, results.holdout].sort((a, b) => a.firstSeed - b.firstSeed);
  if (later.firstSeed - earlier.firstSeed < earlier.deals) throw new Error('tune and holdout seed ranges overlap');
  const passed = cohorts.every(name => Object.values(results[name].checks).every(Boolean));
  const verdict = passed ? 'PASS' : 'REJECT';
  console.log(JSON.stringify({ verdict, sides: plan.sides, policy, cohorts: results }, null, 2));
  return passed ? 0 : 2;
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (error) {
  console.error(`INVALID: ${error.message}`);
  process.exitCode = 1;
}
