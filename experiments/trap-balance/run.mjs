// Study runner for issue #78. Usage: node experiments/trap-balance/run.mjs [--out experiments/trap-balance/results]
// Pre-declared design (fixed before the first run, nothing dropped afterwards):
//   seed blocks 0-999 and 1000-1999, every seed is used by every configuration (matched),
//   baseline = no trap shadow run (equal to real play, checked below against scripts/simulate-matches.mjs),
//   variants = action {A,B} x effect {X,Y} plus a negative control effect "inert" (trap costs allowance, does nothing),
//   policy {S,T}, fixture arrival round {1,4}, holders {both, cowboy only, wizard only}.
// Every configuration is written out. Primary slice for the headline text: holders=both, arrival 1, policy S and T.
import { mkdirSync, writeFileSync } from "node:fs";
import { SIDES } from "../../src/game/cards.js";
import { RULES_VERSION } from "../../src/game/state.js";
import { simulate } from "../../scripts/simulate-matches.mjs";
import { playShadow } from "./shadow.js";

const BLOCKS = [{ from: 0, count: 1000 }, { from: 1000, count: 1000 }];
const ACTIONS = ["A", "B"];
const EFFECTS = ["X", "Y", "inert"];
const POLICIES = ["S", "T"];
const ARRIVALS = [1, 4];
const HOLDERS = { both: SIDES, cowboy: ["cowboy"], wizard: ["wizard"] };

const code = (m) => (m.result.winner === "cowboy" ? 1 : m.result.winner === "wizard" ? -1 : 0);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fix = (x, d = 3) => Number(x.toFixed(d));

function aggregate(matches, base) {
  const n = matches.length;
  const count = (f) => matches.filter(f).length;
  const wins = { cowboy: count((m) => code(m) === 1), wizard: count((m) => code(m) === -1), draw: count((m) => code(m) === 0) };
  const startWins = {};
  for (const side of SIDES) {
    const group = matches.filter((m) => m.startingSide === side);
    startWins[side] = { matches: group.length, cowboy: group.filter((m) => code(m) === 1).length, wizard: group.filter((m) => code(m) === -1).length };
  }
  const triggers = matches.flatMap((m) => m.triggers);
  const attackHist = { 1: 0, 2: 0, 3: 0 };
  for (const t of triggers) attackHist[t.attack] += 1;
  const nominalSaved = (effect) => triggers.reduce((sum, t) => sum + (effect === "X" ? t.attack : effect === "Y" ? Math.min(1, t.attack) : 0), 0);
  const row = {
    n,
    wins,
    cowboyShare: fix(wins.cowboy / n),
    wizardShare: fix(wins.wizard / n),
    drawShare: fix(wins.draw / n),
    startWins,
    meanFinalRound: fix(mean(matches.map((m) => m.result.round)), 2),
    baseDestroyedShare: fix(count((m) => m.result.reason === "base-destroyed") / n),
    actionsPerMatch: fix(mean(matches.map((m) => m.actions)), 2),
    setsPerMatch: fix(mean(matches.map((m) => m.sets.cowboy + m.sets.wizard)), 3),
    triggersPerMatch: fix(triggers.length / n, 3),
    matchesWithTrigger: count((m) => m.triggers.length > 0),
    attackHistOfTriggers: attackHist,
    meanTriggerRound: triggers.length ? fix(mean(triggers.map((t) => t.round)), 2) : null,
    nominalDamagePreventedPerMatch: { X: null, Y: null },
    forgoneCastsPerMatch: fix(mean(matches.map((m) => m.forgoneCasts)), 3),
    phasesWithSummonCastTrap: count((m) => m.phases4 > 0),
    maxActionsInOnePhase: Math.max(...matches.map((m) => m.maxPhaseActions)),
    trapStillSetAtEnd: count((m) => SIDES.some((s) => m.zonesAtEnd[s] !== null)),
    sidesWithTrapNeverSet: matches.reduce((sum, m) => sum + SIDES.filter((s) => m.leftInHand[s] > 0).length, 0),
  };
  if (base) {
    const delta = matches.map((m, i) => code(m) - code(base[i]));
    const cw = matches.map((m, i) => (code(m) === 1 ? 1 : 0) - (code(base[i]) === 1 ? 1 : 0));
    const se = (xs) => {
      const mu = mean(xs);
      return Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / (xs.length - 1) / xs.length);
    };
    row.paired = {
      winnerChanged: matches.filter((m, i) => code(m) !== code(base[i])).length,
      cowboyWinShareDelta: fix(mean(cw)),
      cowboyWinShareDeltaCI95: [fix(mean(cw) - 1.96 * se(cw)), fix(mean(cw) + 1.96 * se(cw))],
      cowboyMinusWizardDelta: fix(mean(delta)),
    };
  }
  return row;
}

const results = [];
const checks = [];
for (const { from, count } of BLOCKS) {
  const seeds = Array.from({ length: count }, (_, i) => from + i);
  const baseline = seeds.map((seed) => playShadow(seed, null));
  const real = simulate({ from, count, cowboy: "cpu", wizard: "cpu" });
  const agg0 = aggregate(baseline, null);
  checks.push({ block: `${from}-${from + count - 1}`, baselineEqualsRealSimulate: real.results.cowboy.wins === agg0.wins.cowboy && real.results.wizard.wins === agg0.wins.wizard && real.results.cowboy.draws === agg0.wins.draw, real: real.results, shadow: agg0.wins });
  results.push({ block: `${from}-${from + count - 1}`, config: "baseline", ...agg0 });
  for (const holders of Object.keys(HOLDERS)) {
    for (const arrival of ARRIVALS) {
      for (const policy of POLICIES) {
        for (const action of ACTIONS) {
          for (const effect of EFFECTS) {
            const matches = seeds.map((seed) => playShadow(seed, { action, effect }, { policy, arrival, holders: HOLDERS[holders] }));
            const row = aggregate(matches, baseline);
            row.nominalDamagePreventedPerMatch = Object.fromEntries(["X", "Y"].map((e) => [e, fix(matches.flatMap((m) => m.triggers).reduce((s, t) => s + (e === "X" ? t.attack : Math.min(1, t.attack)), 0) / matches.length, 3)]));
            results.push({ block: `${from}-${from + count - 1}`, config: `${action}${effect === "inert" ? "-inert" : effect}`, action, effect, policy, arrival, holders, ...row });
          }
        }
      }
    }
  }
}

const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "experiments/trap-balance/results";
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/results.json`, JSON.stringify({ rulesVersion: RULES_VERSION, blocks: BLOCKS, checks, results }, null, 1) + "\n");

const pct = (x) => (x * 100).toFixed(1);
const lines = [
  `# Shadow-model results (generated by run.mjs; rules ${RULES_VERSION}; CPU = production \`chooseAction\`, trap-unaware)`,
  "",
  "Shadow model, not shipped-game win shares. Matched seeds: every row of a block uses the same 1000 seeds and deals. `dCowboy` is the paired change in Cowboy win share versus the baseline of that block, with a 95% normal interval. `chg` is matches whose winner changed.",
  "",
  `Baseline cross-check against scripts/simulate-matches.mjs: ${checks.map((c) => `${c.block} ${c.baselineEqualsRealSimulate ? "equal" : "DIFFERENT"}`).join(", ")}.`,
  "",
  "| block | holders | arr | pol | cfg | C% | W% | D% | dCowboy (95%) | chg | rnd | acts | sets | trig | trig atk 1/2/3 | forgone casts | trap+cast phases | unfired at end |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
];
for (const r of results) {
  if (r.config === "baseline") {
    lines.push(`| ${r.block} | - | - | - | baseline | ${pct(r.cowboyShare)} | ${pct(r.wizardShare)} | ${pct(r.drawShare)} | - | - | ${r.meanFinalRound} | ${r.actionsPerMatch} | 0 | 0 | - | - | - | - |`);
    continue;
  }
  const p = r.paired;
  const h = r.attackHistOfTriggers;
  lines.push(`| ${r.block} | ${r.holders} | ${r.arrival} | ${r.policy} | ${r.config} | ${pct(r.cowboyShare)} | ${pct(r.wizardShare)} | ${pct(r.drawShare)} | ${(p.cowboyWinShareDelta * 100).toFixed(1)} (${(p.cowboyWinShareDeltaCI95[0] * 100).toFixed(1)}..${(p.cowboyWinShareDeltaCI95[1] * 100).toFixed(1)}) | ${p.winnerChanged} | ${r.meanFinalRound} | ${r.actionsPerMatch} | ${r.setsPerMatch} | ${r.triggersPerMatch} | ${h[1]}/${h[2]}/${h[3]} | ${r.forgoneCastsPerMatch} | ${r.phasesWithSummonCastTrap} | ${r.trapStillSetAtEnd} |`);
}
writeFileSync(`${out}/results.md`, lines.join("\n") + "\n");
console.log(`wrote ${results.length} rows to ${out}/results.json and results.md`);
console.log(JSON.stringify(checks));
