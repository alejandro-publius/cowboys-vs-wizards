// Prints the matched-seed deck replacement tables (issue #114) as Markdown.
//   node experiments/trap-deck-sim/run.mjs [--from 0] [--count 200] [--blocks 2] [--json out.json]
// Default: seeds 0-199 and 200-399, levels easy, normal and hard on both
// sides, scenarios BASE, T1 and T2. Deterministic: the same arguments print
// the same text. --json writes the bounded summary (no traces).
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { SIDES } from "../../src/game/cards.js";
import { RULES_VERSION, TRAP_RULES_VERSION } from "../../src/game/state.js";
import { firstInRound, toNumber } from "../trap-deck-odds/odds.js";
import { SCENARIOS, SIM_VERSION, openingFor, pairedDelta, runConfig, summarize } from "./sim.js";

const { values } = parseArgs({
  options: {
    from: { type: "string", default: "0" },
    count: { type: "string", default: "200" },
    blocks: { type: "string", default: "2" },
    json: { type: "string" },
  },
});
const from = Number(values.from);
const count = Number(values.count);
const blocks = Number(values.blocks);
const LEVELS = ["normal", "hard", "easy"];
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const signed = (x) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1)}`;
const out = [];
const print = (line = "") => out.push(line);

// Unconditional first-trap round from the opening order alone (as in the #87 sample).
function openingFirstRound(seeds, scenario, side) {
  const hist = Array(10).fill(0);
  for (const seed of seeds) {
    const { hand, deck } = openingFor(seed, scenario).sides[side];
    const p = [...hand, ...deck].findIndex((id) => id.startsWith("test-fixture-deck-trap-"));
    hist[p < 0 ? 0 : p < 4 ? 1 : p - 2]++;
  }
  return hist;
}

const ranges = Array.from({ length: blocks }, (_, b) => Array.from({ length: count }, (_, i) => from + b * count + i));
const all = ranges.flat();
const label = (seeds) => `${seeds[0]}-${seeds.at(-1)}`;
const summary = { simVersion: SIM_VERSION, rulesVersion: RULES_VERSION, trapRulesVersion: TRAP_RULES_VERSION, seeds: label(all), configs: {} };

print(`# Trap deck replacement simulation (${SIM_VERSION})`);
print();
print(`Rules: BASE \`${RULES_VERSION}\`, T1/T2 \`${TRAP_RULES_VERSION}\` with anonymous fixture traps (effect X, shared allowance A).`);
print(`Seeds ${ranges.map(label).join(" and ")}; same CPU level on both sides. Decks 12 cards per side; T1/T2 relabel shipped spell copies after the shuffle.`);
print("Synthetic fixture cards, CPU against CPU, deterministic seeds. Not a human balance measurement.");

const results = {};
for (const level of LEVELS) for (const scenario of SCENARIOS) results[`${level}/${scenario}`] = runConfig(all, scenario, level);

print();
print("## Results per configuration (all seeds)");
print();
print("| CPU | Deck | n | Cowboy starts | Cowboy wins | Wizard wins | Draws | Starter wins | Base destroyed | Mean end round | Actions | Casts C / W |");
print("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const level of LEVELS) {
  for (const scenario of SCENARIOS) {
    const s = summarize(results[`${level}/${scenario}`]);
    summary.configs[`${level}/${scenario}`] = s;
    const { cowboy: c, wizard: w } = s.perSide;
    print(`| ${level} | ${scenario} | ${s.n} | ${c.starts} | ${c.wins} | ${w.wins} | ${s.draws} | ${s.startingSideWins} | ${s.baseDestroyed} | ${s.meanCompletionRound.toFixed(2)} | ${s.actions} | ${c.casts} / ${w.casts} |`);
  }
}

print();
print("## Completion round histogram (rounds 1-9, all seeds)");
print();
print("| CPU | Deck | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 |");
print("|---|---|---|---|---|---|---|---|---|---|---|");
for (const level of LEVELS) for (const scenario of SCENARIOS) {
  const h = summary.configs[`${level}/${scenario}`].completionRoundHist;
  print(`| ${level} | ${scenario} | ${h.slice(1).join(" | ")} |`);
}

print();
print("## Trap and spell role metrics (all seeds, matches unless marked phases)");
print();
print("| CPU | Deck | Side | Spells / traps in deck | Spell role removed | Trap seen | Matches with set (sets) | Matches with trigger (triggers) | Held with full zone: matches (phases) | Spell+trap in hand phases | Trap in hand in round 9 |");
print("|---|---|---|---|---|---|---|---|---|---|---|");
for (const level of LEVELS) for (const scenario of SCENARIOS.slice(1)) for (const side of SIDES) {
  const p = summary.configs[`${level}/${scenario}`].perSide[side];
  const seen = p.trapFirstSeenHist.slice(1).reduce((a, b) => a + b, 0);
  print(`| ${level} | ${scenario} | ${side} | ${p.spellsInDeck.join(",")} / ${p.trapsInDeck.join(",")} | ${p.spellRoleRemoved ? "yes" : "no"} | ${seen} | ${p.matchesWithPlacement} (${p.trapPlaced}) | ${p.matchesWithTrigger} (${p.trapTriggered}) | ${p.matchesHeldWithFullZone} (${p.heldWithFullZonePhases}) | ${p.spellAndTrapPhases} | ${p.matchesRound9TrapInHand} |`);
}

print();
print("## First trap round: exact #87 odds, opening order, and seen during play (all seeds)");
print();
print("Exact and opening columns are unconditional (the whole 12-card order). The runtime column counts only rounds the match reached, so it is lower in later rounds and is not a rate comparable to the exact odds. Column 'never' = no trap reached the hand before the match ended.");
print();
print("| Deck | Source | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | never |");
print("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const [scenario, copies] of [["T1", 1], ["T2", 2]]) {
  const exact = Array.from({ length: 9 }, (_, i) => toNumber(firstInRound(12, copies, i + 1)) * all.length);
  print(`| ${scenario} | exact x ${all.length} | ${exact.map((x) => x.toFixed(1)).join(" | ")} | 0 |`);
  for (const side of SIDES) {
    const h = openingFirstRound(all, scenario, side);
    print(`| ${scenario} | opening order, ${side} | ${h.slice(1).join(" | ")} | ${h[0]} |`);
  }
  for (const level of LEVELS) for (const side of SIDES) {
    const h = summary.configs[`${level}/${scenario}`].perSide[side].trapFirstSeenHist;
    print(`| ${scenario} | seen in play, ${level}, ${side} | ${h.slice(1).join(" | ")} | ${h[0]} |`);
  }
}

print();
print("## Matched-seed Cowboy score delta against BASE");
print();
print("Score per match: Cowboy win 1, draw 0.5, loss 0. Delta = T score - BASE score on the same seed and CPU level, in percentage points. Interval: mean +- 1.96 sd / sqrt(n), a normal approximation that treats seeds as independent shuffles. The Wizard delta is the negative.");
print();
print("| CPU | Deck | Seeds | BASE Cowboy share | T Cowboy share | Delta (pp) | 95% interval (pp) | Seeds with a changed result |");
print("|---|---|---|---|---|---|---|---|");
summary.deltas = {};
for (const level of LEVELS) for (const scenario of SCENARIOS.slice(1)) {
  for (const seeds of [...(blocks > 1 ? ranges : []), all]) {
    const pick = (list) => list.filter((m) => seeds.includes(m.seed));
    const base = pick(results[`${level}/BASE`]);
    const other = pick(results[`${level}/${scenario}`]);
    const d = pairedDelta(base, other);
    const share = (list) => summarize(list).cowboyShare;
    summary.deltas[`${level}/${scenario}/${label(seeds)}`] = d;
    print(`| ${level} | ${scenario} | ${label(seeds)} | ${pct(share(base))} | ${pct(share(other))} | ${signed(d.mean)} | ${signed(d.low)} to ${signed(d.high)} | ${d.changedResults} |`);
  }
}

const digests = Object.fromEntries(Object.entries(results).map(([k, list]) => [k, createHash("sha256").update(list.map((m) => m.digest).join("")).digest("hex").slice(0, 16)]));
summary.digests = digests;
print();
print("## Run digests (sha256 of per-match action/event/result digests, first 16 hex)");
print();
for (const [k, v] of Object.entries(digests)) print(`- ${k}: \`${v}\``);

console.log(out.join("\n"));
if (values.json) writeFileSync(values.json, JSON.stringify(summary, null, 1) + "\n");
