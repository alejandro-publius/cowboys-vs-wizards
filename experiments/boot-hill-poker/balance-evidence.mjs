import { readFileSync } from 'node:fs';
import { measurePairedCohort } from '../../packages/frontier-kit/index.js';
import { playPokerDuel } from './engine.js';

const args = process.argv.slice(2);
if (args.length !== 1 || !['standard', 'pat'].includes(args[0])) {
  console.error('Usage: node experiments/boot-hill-poker/balance-evidence.mjs standard|pat');
  process.exit(2);
}

const plan = JSON.parse(readFileSync(new URL('./balance-plan.json', import.meta.url), 'utf8'));
const baseline = { cowboy: 'pat', wizard: 'standard' };
const candidate = { cowboy: args[0], wizard: 'standard' };

function recordPairs(range) {
  const pairs = [];
  measurePairedCohort({
    ...range,
    sides: plan.sides,
    playBaseline: (seed, first) => playPokerDuel(seed, first, baseline),
    playCandidate: (seed, first) => playPokerDuel(seed, first, candidate),
    onPair: (pair) => pairs.push(pair),
  });
  return pairs;
}

console.log(JSON.stringify({ tune: recordPairs(plan.tune), holdout: recordPairs(plan.holdout) }));
