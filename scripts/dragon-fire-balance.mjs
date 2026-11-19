// Balance gate harness for Dragon Fire (Fable's question: could Dragon Fire
// ever ship in counted play?). Usage:
//   node scripts/dragon-fire-balance.mjs [--from 70000] [--count 8] [--groups 2] [--out <file>]
// With no options this is the small dry smoke (2 groups x 8 seeds). A real run
// passes a larger --count, for example:
//   node scripts/dragon-fire-balance.mjs --count 512 --groups 2 --out .artifacts/dragon-fire/balance.json
//
// Design:
// - Seeds are split into equal-size, disjoint groups: group g plays seeds
//   [from + g*count, from + (g+1)*count). Every arm plays every seed of a group.
// - Each seed is played with both forced first seats (openingMatch, as in
//   scripts/screen-cowboy-decks.mjs), so the per-seed unit is the Cowboy's
//   win share over its two seats.
// - Both seats use the same CPU level (normal or hard, src/game/cpu.js).
// - Arms (Cowboy deck, Dragon Fire):
//     dragon-4N        Dragon Posse (src/game/deck-presets.js), shipped rules
//     dragon-4+fire    the same Dragon Posse, createMatch(..., { dragonFire: true })
//     billy-ref        Dragon Posse with the Captured Dragon replaced by a Billy
//                      (6 Sheriff, 3 Billy, 3 Deadeye), shipped rules
//     billy-ref+fire   the same Billy deck with dragonFire: true. Control: it has
//                      no Captured Dragon, so any change from billy-ref comes from
//                      the Wizard's Dragon burning through.
// - Wizard decks: "default" (DECKS.wizard) and "stargazer" (STARGAZER_DECK).
// - Dragon Fire in the current engine (src/game/clash.js, fireBurn) applies to
//   BOTH dragon kinds, wizard-dragon-* and cowboy-captured-dragon-*, on every
//   dragonFire match, and src/game/cpu.js projects the burn for both sides.
//   The report counts burn events by attacker kind so that is visible.
// No thresholds are applied here. The output is counts and paired differences.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CARDS, DECKS, SIDES } from "../src/game/cards.js";
import { DRAGON_FIRE_RULES_VERSION, RULES_VERSION } from "../src/game/state.js";
import { cpuFor } from "../src/game/cpu.js";
import { isFireCard } from "../src/game/clash.js";
import { deckIds, validateDeck } from "../src/game/deck-builder.js";
import { DRAGON_POSSE, STARGAZER_DECK } from "../src/game/deck-presets.js";
import { openingMatch } from "../src/game/opening-policy.js";
import { playMatch, wholeNumber } from "./play-match.mjs";

export const DEFAULTS = Object.freeze({ from: 70000, count: 8, groups: 2 });
const MAX_SEEDS = 20000;
const LEVELS = ["normal", "hard"];
const SOURCES = [
  "scripts/dragon-fire-balance.mjs",
  "scripts/play-match.mjs",
  ...["actions", "card-specs.generated", "cards", "clash", "cpu", "deck-builder", "deck-presets", "legal", "opening-policy", "state", "view"].map((file) => `src/game/${file}.js`),
];

const BILLY_REF_COUNTS = Object.freeze({
  ...DRAGON_POSSE,
  "cowboy-captured-dragon": 0,
  "cowboy-billy": DRAGON_POSSE["cowboy-billy"] + DRAGON_POSSE["cowboy-captured-dragon"],
});

function cowboyDeck(counts) {
  const checked = validateDeck(counts, { bountyReward: true });
  if (!checked.ok) throw new Error(`illegal deck: ${checked.error}`);
  return deckIds(counts, { bountyReward: true });
}

export const ARMS = Object.freeze([
  { name: "dragon-4N", deck: cowboyDeck(DRAGON_POSSE), dragonFire: false },
  { name: "dragon-4+fire", deck: cowboyDeck(DRAGON_POSSE), dragonFire: true },
  { name: "billy-ref", deck: cowboyDeck(BILLY_REF_COUNTS), dragonFire: false },
  { name: "billy-ref+fire", deck: cowboyDeck(BILLY_REF_COUNTS), dragonFire: true },
]);
export const WIZARD_DECKS = Object.freeze([
  { name: "default", deck: undefined, ids: DECKS.wizard },
  { name: "stargazer", deck: STARGAZER_DECK, ids: STARGAZER_DECK },
]);
// [candidate, reference, why]
export const COMPARISONS = Object.freeze([
  ["dragon-4+fire", "dragon-4N", "opt-in fire on the same Dragon Posse"],
  ["dragon-4+fire", "billy-ref", "fire Dragon Posse against the Billy replacement"],
  ["dragon-4N", "billy-ref", "Dragon Posse without fire against the Billy replacement"],
  ["billy-ref+fire", "billy-ref", "control: Wizard Dragon fire only, no Captured Dragon in the deck"],
]);

const pct = (n, of) => (of ? Number(((100 * n) / of).toFixed(2)) : null);
const fixed = (x, digits = 2) => Number(x.toFixed(digits));
const fireKind = (cardId) => (CARDS[cardId].side === "cowboy" ? "captured-dragon" : "wizard-dragon");
const dragonInDeck = (ids) => ids.filter(isFireCard).map((id) => id);

function sourceIdentity() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  return Object.fromEntries(SOURCES.map((file) => {
    const bytes = readFileSync(path.join(root, file));
    return [file, createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")];
  }));
}

function emptyTally() {
  const seat = () => ({ matches: 0, cowboyWins: 0, wizardWins: 0, draws: 0 });
  return {
    matches: 0, cowboyWins: 0, wizardWins: 0, draws: 0,
    bySeat: { cowboy: seat(), wizard: seat() }, // keyed by who acted first in round 1
    endings: { "base-destroyed": 0, "round-limit": 0 },
    rounds: 0,
    dragons: {
      matchesCowboyDragonSummoned: 0, matchesWizardDragonSummoned: 0,
      matchesWithFireBurn: 0, fireBurnEvents: 0, fireBurnOrbs: 0,
      byAttacker: { "captured-dragon": { events: 0, orbs: 0 }, "wizard-dragon": { events: 0, orbs: 0 } },
      baseDestroyedByFireBurn: 0,
    },
  };
}

function playOne(seed, starter, arm, wizard, choose) {
  const options = { cowboyDeck: arm.deck, dragonFire: arm.dragonFire };
  if (wizard.deck) options.wizardDeck = wizard.deck;
  const opening = openingMatch(seed, "shipped", starter, options);
  assert.equal(opening.dragonFire?.enabled === true, arm.dragonFire, `seed ${seed}: dragonFire flag`);
  const played = playMatch(seed, { cowboy: choose, wizard: choose }, opening);
  assert.equal(played.opening.startingSide, starter, `seed ${seed}: first seat`);
  return played;
}

function record(tally, played, starter, fireOn) {
  const { result } = played.state;
  const winner = result.winner ?? "draw";
  const seat = tally.bySeat[starter];
  tally.matches += 1;
  seat.matches += 1;
  if (winner === "draw") {
    tally.draws += 1;
    seat.draws += 1;
  } else {
    tally[`${winner}Wins`] += 1;
    seat[`${winner}Wins`] += 1;
  }
  tally.endings[result.reason] += 1;
  tally.rounds += result.round;
  const d = tally.dragons;
  const summoned = new Set();
  let burned = false;
  for (const { events } of played.log) {
    for (const event of events) {
      if (event.type === "summon" && isFireCard(event.cardId)) summoned.add(fireKind(event.cardId));
      if (event.type === "damage" && event.fire === true) {
        assert.ok(fireOn, "a fire burn event on a match without dragonFire");
        assert.ok(isFireCard(event.attacker.cardId), "fire burn from a card that is not a dragon");
        const kind = fireKind(event.attacker.cardId);
        const orbs = event.before - event.after;
        d.fireBurnEvents += 1;
        d.fireBurnOrbs += orbs;
        d.byAttacker[kind].events += 1;
        d.byAttacker[kind].orbs += orbs;
        burned = true;
        if (event.before > 0 && event.after === 0 && result.reason === "base-destroyed") d.baseDestroyedByFireBurn += 1;
      }
    }
  }
  if (summoned.has("captured-dragon")) d.matchesCowboyDragonSummoned += 1;
  if (summoned.has("wizard-dragon")) d.matchesWizardDragonSummoned += 1;
  if (burned) d.matchesWithFireBurn += 1;
}

// Paired per-seed difference (candidate minus reference), in percentage points
// of the Cowboy's share over the seed's two first seats, with a normal 95% interval.
function paired(candidate, reference, key) {
  const diffs = candidate.map((c, i) => 100 * (c[key] - reference[i][key]));
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean: fixed(mean), ci95: null };
  const se = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) / n);
  return { n, mean: fixed(mean), ci95: [fixed(mean - 1.96 * se), fixed(mean + 1.96 * se)] };
}

function compare(perSeed, [candidate, reference, why], groupIndexes) {
  const pick = (name, indexes) => indexes.flatMap((g) => perSeed[g][name]);
  const one = (indexes) => ({
    cowboyScoreShareChangePoints: paired(pick(candidate, indexes), pick(reference, indexes), "score"),
    drawShareChangePoints: paired(pick(candidate, indexes), pick(reference, indexes), "draw"),
  });
  return {
    candidate, reference, why,
    pooled: one(groupIndexes),
    groups: groupIndexes.map((g) => ({ group: g, ...one([g]) })),
    // Descriptive only: whether every group moved the Cowboy win share the same way.
    sameSignInEveryGroup: groupIndexes.every((g) => Math.sign(one([g]).cowboyScoreShareChangePoints.mean) === Math.sign(one(groupIndexes).cowboyScoreShareChangePoints.mean)),
  };
}

export function run({ from, count, groups }) {
  const cells = [];
  const arms = ARMS;
  for (const cpu of LEVELS) {
    const choose = cpuFor(cpu);
    for (const wizard of WIZARD_DECKS) {
      const tallies = Object.fromEntries(arms.map((arm) => [arm.name, Array.from({ length: groups }, emptyTally)]));
      const perSeed = Array.from({ length: groups }, () => Object.fromEntries(arms.map((arm) => [arm.name, []])));
      for (let g = 0; g < groups; g++) {
        for (let seed = from + g * count; seed < from + (g + 1) * count; seed++) {
          for (const arm of arms) {
            let wins = 0;
            let draws = 0;
            for (const starter of SIDES) {
              const played = playOne(seed, starter, arm, wizard, choose);
              record(tallies[arm.name][g], played, starter, arm.dragonFire);
              const winner = played.state.result.winner;
              if (winner === "cowboy") wins += 1;
              else if (winner === null) draws += 1;
            }
            perSeed[g][arm.name].push({ score: (wins + draws * 0.5) / 2, draw: draws / 2 });
          }
        }
      }
      const armReports = Object.fromEntries(arms.map((arm) => {
        const total = emptyTally();
        for (const t of tallies[arm.name]) {
          for (const key of ["matches", "cowboyWins", "wizardWins", "draws", "rounds"]) total[key] += t[key];
          for (const key of Object.keys(total.endings)) total.endings[key] += t.endings[key];
          for (const s of SIDES) for (const key of Object.keys(total.bySeat[s])) total.bySeat[s][key] += t.bySeat[s][key];
          for (const key of Object.keys(total.dragons)) {
            if (key === "byAttacker") {
              for (const kind of Object.keys(total.dragons.byAttacker)) {
                total.dragons.byAttacker[kind].events += t.dragons.byAttacker[kind].events;
                total.dragons.byAttacker[kind].orbs += t.dragons.byAttacker[kind].orbs;
              }
            } else total.dragons[key] += t.dragons[key];
          }
        }
        const { rounds, ...rest } = total;
        return [arm.name, {
          ...rest,
          cowboyWinPct: pct(total.cowboyWins, total.matches),
          wizardWinPct: pct(total.wizardWins, total.matches),
          drawPct: pct(total.draws, total.matches),
          meanRounds: fixed(rounds / total.matches),
          firstSeatCowboyWinPct: pct(total.bySeat.cowboy.cowboyWins, total.bySeat.cowboy.matches),
          secondSeatCowboyWinPct: pct(total.bySeat.wizard.cowboyWins, total.bySeat.wizard.matches),
          perGroup: tallies[arm.name].map((t) => ({ matches: t.matches, cowboyWins: t.cowboyWins, wizardWins: t.wizardWins, draws: t.draws })),
        }];
      }));
      const indexes = Array.from({ length: groups }, (_, g) => g);
      cells.push({
        cpu, wizardDeck: wizard.name,
        arms: armReports,
        comparisons: COMPARISONS.map((pair) => compare(perSeed, pair, indexes)),
      });
    }
  }
  return {
    experiment: "dragon-fire-balance",
    rulesVersion: { shipped: RULES_VERSION, dragonFire: DRAGON_FIRE_RULES_VERSION },
    seeds: { from, count, groups, groupRanges: Array.from({ length: groups }, (_, g) => [from + g * count, from + (g + 1) * count - 1]), seedsPerArm: count * groups },
    matchesPerArmPerCell: count * groups * SIDES.length,
    firstSeats: SIDES,
    cpuLevels: LEVELS,
    bots: "src/game/cpu.js, the same level on both sides of every arm",
    engine: {
      fireAppliesTo: ["wizard-dragon-*", "cowboy-captured-dragon-*"],
      note: "fireBurn in src/game/clash.js applies to both dragon kinds on every dragonFire match; cpu.js projects the burn for both sides.",
      dragonStats: Object.fromEntries(Object.values(CARDS).filter((card) => isFireCard(card.id)).map((card) => [card.id, { attack: card.attack, health: card.health, stars: card.stars }])),
    },
    decks: {
      cowboy: Object.fromEntries(ARMS.map((arm) => [arm.name, { dragonFire: arm.dragonFire, ids: arm.deck, dragonCards: dragonInDeck(arm.deck) }])),
      wizard: Object.fromEntries(WIZARD_DECKS.map((w) => [w.name, { dragonCards: dragonInDeck(w.ids), cards: w.ids.length }])),
    },
    sourceBlobs: sourceIdentity(),
    cells,
    limits: [
      "Bots only: the CPU levels are not human play and Hard is a heuristic, not a solver.",
      "Estimates under these decks, seeds and bot levels; they do not show clarity, fun or how humans play around fire.",
      "Dragon-4N and billy-ref are different decks, so their shuffles differ; the paired unit is the seed, not an identical hand.",
      "The Wizard Dragon burns too, so dragon-4+fire vs dragon-4N mixes both dragon kinds. billy-ref+fire vs billy-ref isolates the Wizard Dragon.",
      "No win-rate threshold is applied here; judging a gate is Fable's call.",
    ],
  };
}

function summaryLines(report) {
  const lines = [];
  const { seeds } = report;
  lines.push(`dragon-fire-balance  seeds ${seeds.from}.. groups ${seeds.groups} x ${seeds.count} seeds, ${report.matchesPerArmPerCell} matches per arm per cell, rules ${report.rulesVersion.dragonFire}`);
  for (const cell of report.cells) {
    lines.push(`\n[${cell.cpu} / wizard ${cell.wizardDeck}]`);
    for (const [name, a] of Object.entries(cell.arms)) {
      const d = a.dragons;
      lines.push(`  ${name.padEnd(15)} cowboy ${a.cowboyWins} wizard ${a.wizardWins} draw ${a.draws} of ${a.matches} (cowboy ${a.cowboyWinPct}%, draw ${a.drawPct}%)  seat first/second cowboy ${a.firstSeatCowboyWinPct}%/${a.secondSeatCowboyWinPct}%  fire burns ${d.fireBurnEvents} (captured ${d.byAttacker["captured-dragon"].events}, wizard ${d.byAttacker["wizard-dragon"].events}) in ${d.matchesWithFireBurn} matches`);
    }
    for (const c of cell.comparisons) {
      const w = c.pooled.cowboyScoreShareChangePoints;
      const dr = c.pooled.drawShareChangePoints;
      lines.push(`  ${c.candidate} vs ${c.reference}: cowboy score share ${w.mean >= 0 ? "+" : ""}${w.mean} pts [${w.ci95 ? w.ci95.join(", ") : "n/a"}], draw share ${dr.mean >= 0 ? "+" : ""}${dr.mean} pts; same sign in every group: ${c.sameSignInEveryGroup}`);
    }
  }
  return lines;
}

if (import.meta.main) {
  const usage = "usage: node scripts/dragon-fire-balance.mjs [--from <n>] [--count <seeds per group>] [--groups <n>] [--out <file>]";
  let values;
  try {
    ({ values } = parseArgs({ options: { from: { type: "string" }, count: { type: "string" }, groups: { type: "string" }, out: { type: "string" } } }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const from = values.from === undefined ? DEFAULTS.from : wholeNumber(values.from);
  const count = values.count === undefined ? DEFAULTS.count : wholeNumber(values.count);
  const groups = values.groups === undefined ? DEFAULTS.groups : wholeNumber(values.groups);
  if (from === null || !count || !groups || count < 2 || groups < 1 || count * groups > MAX_SEEDS || from + count * groups > 2 ** 32) {
    console.error(`${usage}\n(count >= 2, groups >= 1, count x groups <= ${MAX_SEEDS}, seeds within uint32)`);
    process.exit(2);
  }
  const report = run({ from, count, groups });
  if (values.out) {
    mkdirSync(path.dirname(values.out), { recursive: true });
    writeFileSync(values.out, JSON.stringify(report, null, 1) + "\n");
  }
  console.log(summaryLines(report).join("\n"));
  if (values.out) console.log(`\nfull report: ${values.out}`);
}
