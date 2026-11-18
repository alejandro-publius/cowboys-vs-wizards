// Round-one tempo experiment (.kiro/specs/round-one-tempo). Four policies on
// the released engine: the shipped and Both openings of
// src/game/opening-policy.js, each without and with the experimental round-1
// Base shield (`experimentalRoundOneBaseShield` on the opening state, read by
// src/game/clash.js).
//   node scripts/compare-round-one-tempo.mjs --from 20000 --count 512 --out .artifacts/card-rd/round-one-tempo/holdout/results.json
// Every seed is played once with each faction in the first seat under every
// policy, with the same shuffles and the released CPU on both sides. The CPU
// reads publicState, which never shows the flag. Rows are paired by
// (seed, first seat). --out writes results.json (with rows) and summary.json
// (the printed report, without rows) in that directory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { CARDS, DECKS, SIDES } from "../src/game/cards.js";
import { BASE_ORBS, createMatch, RULES_VERSION } from "../src/game/state.js";
import { legalActions } from "../src/game/legal.js";
import { chooseAction } from "../src/game/cpu.js";
import { drought, openingMatch } from "../src/game/opening-policy.js";
import { playMatch, wholeNumber } from "./play-match.mjs";

const FLAG = "experimentalRoundOneBaseShield";
export const POLICIES = {
  shipped: { opening: "shipped", shield: false },
  both: { opening: "both", shield: false },
  shield: { opening: "shipped", shield: true },
  bothShield: { opening: "both", shield: true },
};
// The policy each shield policy differs from by the flag alone.
const TWIN = { shield: "shipped", bothShield: "both" };
// [policy, baseline] pairs. "bothShield vs both" is the primary test (RT-10).
const COMPARISONS = [
  ["both", "shipped"],
  ["shield", "shipped"],
  ["bothShield", "both"],
  ["shield", "both"],
  ["bothShield", "shipped"],
];
const SEATS = ["firstSeat", "secondSeat"];
const BOTS = { cowboy: chooseAction, wizard: chooseAction };
const SORTED_DECKS = Object.fromEntries(SIDES.map((side) => [side, [...DECKS[side]].sort()]));
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const counted = { actions: 0, damageEvents: 0, shieldedEvents: 0, unchangedTwins: 0 };

function assertConserved(state, label) {
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const all = [...deck, ...hand, ...board.filter(Boolean).map((troop) => troop.cardId), ...discard].sort();
    assert.deepEqual(all, SORTED_DECKS[side], `${label}: ${side} cards not conserved`);
  }
}

// Checks every step of one match (RT-6, RT-7) and returns its measures. Base
// damage is the orbs removed, before - after: `amount` is the attack, which
// can exceed the orbs a Base had left.
function measure(label, opening, log, state, shield) {
  const firstSeat = opening.startingSide;
  const seat = (side) => (side === firstSeat ? "firstSeat" : "secondSeat");
  const firstClash = { firstSeat: 0, secondSeat: 0 }; // orbs each seat's Base lost in the round-1 clash
  const later = { firstSeat: 0, secondSeat: 0 }; // orbs lost in the clashes of rounds 2 to 9
  const shielded = { hits: 0, absorbed: 0, byAttacker: { cowboy: 0, wizard: 0 } };
  let openRound1Lanes = 0; // attacks into an empty lane in the round-1 clash
  const summoned = new Set();
  let previous = opening;
  let clashRound = null;
  for (const [index, { round, side, action, events, state: after }] of log.entries()) {
    const step = `${label} action ${index}`;
    assert.ok(
      legalActions(previous, side).some((legal) => isDeepStrictEqual(legal, action)),
      `${step}: not listed by legalActions`,
    );
    assertConserved(after, step);
    counted.actions += 1;
    if (round === 1 && action.type === "summon") summoned.add(side);
    for (const event of events) {
      if (event.type === "clash") clashRound = event.round;
      if (event.type !== "damage") continue;
      counted.damageEvents += 1;
      assert.equal(event.after, Math.max(0, event.before - event.amount), `${step}: damage before, amount and after disagree`);
      if (shield && clashRound === 1 && event.target.kind === "base") {
        assert.deepEqual([event.amount, event.after, event.shielded], [0, event.before, true], `${step}: round-1 Base hit not shielded`);
        counted.shieldedEvents += 1;
        shielded.hits += 1;
        shielded.absorbed += Math.min(CARDS[event.attacker.cardId].attack, event.before);
        shielded.byAttacker[event.attacker.side] += 1;
      } else {
        assert.equal(Object.hasOwn(event, "shielded"), false, `${step}: shielded outside a round-1 Base hit under the flag`);
        assert.equal(event.amount, CARDS[event.attacker.cardId].attack, `${step}: amount is not the attack`);
      }
      if (event.target.kind !== "base") continue;
      if (clashRound === 1) openRound1Lanes += 1;
      (clashRound === 1 ? firstClash : later)[seat(event.target.side)] += event.before - event.after;
    }
    previous = after;
  }
  for (const side of SIDES) {
    assert.equal(firstClash[seat(side)] + later[seat(side)], BASE_ORBS - state.sides[side].baseOrbs, `${label}: ${side} Base events do not add up`);
  }
  return {
    firstClash,
    later,
    shielded,
    openRound1Lanes,
    noRound1Summon: SIDES.filter((side) => !summoned.has(side)).map(seat),
    droughtHands: SIDES.filter((side) => drought(opening.sides[side].hand)).map(seat),
  };
}

// One checked match: the policy's opening for (seed, first seat), played out.
export function playPolicy(seed, firstSeat, policy) {
  const { opening: variant, shield } = POLICIES[policy];
  const opening = openingMatch(seed, variant, firstSeat);
  if (shield) opening[FLAG] = true;
  const label = `seed ${seed} ${firstSeat} first ${policy}`;
  assertConserved(opening, `${label} opening`);
  const { state, log } = playMatch(seed, BOTS, opening);
  return { opening, state, log, ...measure(label, opening, log, state, shield) };
}

// A shield policy plays the same round 1 as its twin (the CPU cannot see the
// flag). With no shielded hit nothing else may differ; with one, the shield
// absorbs exactly the orbs the twin's first clash removed.
function assertTwin(label, run, twin) {
  const actions = (each, round1) => each.log.filter(({ round }) => !round1 || round === 1).map(({ action }) => action);
  assert.deepEqual(actions(run, true), actions(twin, true), `${label}: round-1 actions differ from the unshielded twin`);
  assert.equal(run.shielded.hits, twin.openRound1Lanes, `${label}: shielded hits differ from the twin's open lanes`);
  assert.equal(run.shielded.absorbed, twin.firstClash.firstSeat + twin.firstClash.secondSeat, `${label}: absorbed orbs differ`);
  if (run.shielded.hits > 0) return;
  const { [FLAG]: flag, ...rest } = run.state;
  assert.equal(flag, true);
  assert.deepEqual(actions(run), actions(twin), `${label}: no shielded hit, but the route changed`);
  assert.deepEqual(rest, twin.state, `${label}: no shielded hit, but the final state changed`);
  counted.unchangedTwins += 1;
}

function rowFor(seed, firstSeat, natural, runs) {
  const row = { seed, firstSeat, naturalFirstSeat: firstSeat === natural };
  for (const [policy, each] of Object.entries(runs)) {
    row[policy] = {
      outcome: each.state.result.winner ?? "draw",
      reason: each.state.result.reason,
      rounds: each.state.result.round,
      firstClash: each.firstClash,
      later: each.later,
      openRound1Lanes: each.openRound1Lanes,
      ...(POLICIES[policy].shield && { shielded: each.shielded }),
      noRound1Summon: each.noRound1Summon,
      droughtHands: each.droughtHands,
    };
  }
  return row;
}

const pct = (n, of) => Number(((100 * n) / of).toFixed(2));
const fixed = (value, digits) => Number(value.toFixed(digits));

function summarize(rows, policy) {
  const s = {
    matches: rows.length,
    firstSeatWins: 0,
    secondSeatWins: 0,
    draws: 0,
    factionWins: { cowboy: 0, wizard: 0 },
    noRound1Summon: { firstSeat: 0, secondSeat: 0 }, // sides, two per match
    droughtHands: { firstSeat: 0, secondSeat: 0 }, // dealt hands with no free troop
    matchesWithOpenRound1Lane: 0,
    firstClashBaseDamage: { firstSeat: 0, secondSeat: 0, total: 0 }, // orbs, by the seat whose Base was hit
    laterBaseDamage: { firstSeat: 0, secondSeat: 0, total: 0 },
  };
  if (POLICIES[policy].shield) s.shielded = { hits: 0, absorbed: 0, byAttacker: { cowboy: 0, wizard: 0 } };
  let rounds = 0;
  for (const row of rows) {
    const m = row[policy];
    rounds += m.rounds;
    if (m.outcome === "draw") s.draws += 1;
    else {
      s.factionWins[m.outcome] += 1;
      if (m.outcome === row.firstSeat) s.firstSeatWins += 1;
      else s.secondSeatWins += 1;
    }
    for (const seat of m.noRound1Summon) s.noRound1Summon[seat] += 1;
    for (const seat of m.droughtHands) s.droughtHands[seat] += 1;
    if (m.openRound1Lanes > 0) s.matchesWithOpenRound1Lane += 1;
    for (const seat of SEATS) {
      s.firstClashBaseDamage[seat] += m.firstClash[seat];
      s.laterBaseDamage[seat] += m.later[seat];
    }
    if (m.shielded) {
      s.shielded.hits += m.shielded.hits;
      s.shielded.absorbed += m.shielded.absorbed;
      for (const side of SIDES) s.shielded.byAttacker[side] += m.shielded.byAttacker[side];
    }
  }
  for (const damage of [s.firstClashBaseDamage, s.laterBaseDamage]) {
    damage.total = damage.firstSeat + damage.secondSeat;
    damage.perMatch = fixed(damage.total / s.matches, 3);
  }
  return {
    ...s,
    firstSeatWinPct: pct(s.firstSeatWins, s.matches),
    secondSeatWinPct: pct(s.secondSeatWins, s.matches),
    drawPct: pct(s.draws, s.matches),
    seatGapPoints: pct(s.firstSeatWins - s.secondSeatWins, s.matches),
    factionGapPoints: pct(s.factionWins.cowboy - s.factionWins.wizard, s.matches), // Cowboy minus Wizard
    meanRounds: fixed(rounds / s.matches, 3),
  };
}

// Paired change of `policy` against `baseline`. Scores are +1 / 0 / -1 for the
// first seat (or for Cowboy). A seed's two matches share shuffles, so each
// seed is one observation: mean and 1.96 standard errors over seeds.
const score = (outcome, side) => (outcome === "draw" ? 0 : outcome === side ? 1 : -1);
function pairedChange(rows, policy, baseline) {
  const perSeed = new Map();
  const flow = {}; // baseline result for the first seat -> policy result
  let changed = 0;
  for (const row of rows) {
    const [before, after] = [row[baseline], row[policy]];
    if (before.outcome !== after.outcome) changed += 1;
    const label = (outcome) => (outcome === "draw" ? "draw" : outcome === row.firstSeat ? "firstSeat" : "secondSeat");
    const key = `${label(before.outcome)}->${label(after.outcome)}`;
    flow[key] = (flow[key] ?? 0) + 1;
    const d = perSeed.get(row.seed) ?? { seat: 0, faction: 0, draw: 0, rounds: 0, n: 0 };
    d.seat += score(after.outcome, row.firstSeat) - score(before.outcome, row.firstSeat);
    d.faction += score(after.outcome, "cowboy") - score(before.outcome, "cowboy");
    d.draw += (after.outcome === "draw") - (before.outcome === "draw");
    d.rounds += after.rounds - before.rounds;
    d.n += 1;
    perSeed.set(row.seed, d);
  }
  const stat = (key, scale) => {
    const values = [...perSeed.values()].map((d) => (scale * d[key]) / d.n);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const se = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1) / values.length);
    return { mean: fixed(mean, 3), ci95: [fixed(mean - 1.96 * se, 3), fixed(mean + 1.96 * se, 3)] };
  };
  return {
    matchesWithChangedOutcome: changed,
    seatGapChangePoints: stat("seat", 100),
    meanRoundsChange: stat("rounds", 1),
    drawShareChangePoints: stat("draw", 100),
    factionGapChangePoints: stat("faction", 100),
    outcomeFlow: Object.fromEntries(Object.entries(flow).sort()),
  };
}

// RT-10, against Both: the seat-gap interval lies below zero and mean rounds
// rise by at most half a round.
function verdict(change) {
  const gapReduced = change.seatGapChangePoints.ci95[1] < 0;
  const roundsWithinHalf = change.meanRoundsChange.mean <= 0.5;
  return { gapReduced, roundsWithinHalf, pass: gapReduced && roundsWithinHalf };
}

// Seeds 0 and 60 with their own first seat (RT-1): the default route's SHA-256
// and how each policy's route compares with shipped.
export function seedRoute(seed) {
  const natural = createMatch(seed).startingSide;
  const plain = playMatch(seed, BOTS);
  const runs = Object.fromEntries(Object.keys(POLICIES).map((policy) => [policy, playPolicy(seed, natural, policy)]));
  assert.deepEqual({ opening: runs.shipped.opening, state: runs.shipped.state, log: runs.shipped.log }, plain, `seed ${seed}: shipped differs from playMatch`);
  for (const [policy, twin] of Object.entries(TWIN)) assertTwin(`seed ${seed} ${policy}`, runs[policy], runs[twin]);
  const actions = (each) => each.log.map(({ action }) => JSON.stringify(action));
  const base = actions(runs.shipped);
  const out = { seed, firstSeat: natural, defaultRouteSha256: sha256(JSON.stringify(plain)) };
  for (const [policy, each] of Object.entries(runs)) {
    const mine = actions(each);
    const firstDiff = mine.findIndex((action, i) => action !== base[i]);
    const same = firstDiff === -1 && mine.length === base.length;
    out[policy] = {
      actionsIdenticalToShipped: same,
      ...(!same && { firstChangedAction: firstDiff === -1 ? Math.min(mine.length, base.length) : firstDiff }),
      openRound1Lanes: each.openRound1Lanes,
      result: each.state.result,
    };
  }
  return out;
}

export function run({ from, count }) {
  const policies = Object.keys(POLICIES);
  const rows = [];
  let replayChecked = 0;
  for (const key of Object.keys(counted)) counted[key] = 0;
  for (let seed = from; seed < from + count; seed++) {
    const natural = createMatch(seed).startingSide;
    for (const firstSeat of SIDES) {
      const runs = Object.fromEntries(policies.map((policy) => [policy, playPolicy(seed, firstSeat, policy)]));
      if (firstSeat === natural) {
        // The harness must be the released game: the same opening, route and final state as the default run.
        const plain = playMatch(seed, BOTS);
        assert.deepEqual({ opening: runs.shipped.opening, state: runs.shipped.state, log: runs.shipped.log }, plain, `seed ${seed}: shipped differs from playMatch`);
        replayChecked += 1;
      }
      for (const [policy, twin] of Object.entries(TWIN)) assertTwin(`seed ${seed} ${firstSeat} first ${policy}`, runs[policy], runs[twin]);
      rows.push(rowFor(seed, firstSeat, natural, runs));
    }
  }

  const paired = Object.fromEntries(COMPARISONS.map(([policy, baseline]) => [`${policy} vs ${baseline}`, pairedChange(rows, policy, baseline)]));
  // The counts cover the sample; the seed 0 and 60 runs pass the same checks.
  const tally = { ...counted };
  const seeds0and60 = [0, 60].map(seedRoute);
  return {
    experiment: "round-one-tempo",
    spec: ".kiro/specs/round-one-tempo/requirements.md",
    rulesVersion: RULES_VERSION,
    shieldFlag: FLAG,
    bots: "src/game/cpu.js chooseAction on both sides, through publicState (the flag is not in the view)",
    policies: POLICIES,
    seeds: { from, to: from + count - 1, count },
    matchesPerPolicy: rows.length,
    checks: {
      passed: [
        "card conservation after every action",
        "every action listed by legalActions and accepted",
        "damage after = max(0, before - amount); amount = attack unless shielded",
        "Base damage events add up to the orbs each Base lost",
        "shielded only on round-1 Base hits under the flag, with amount 0 and before = after",
        "shield policies play the same round-1 actions as their unshielded twins",
        "shielded hits and absorbed orbs equal the twin's round-1 open lanes and Base damage",
        "a shield run with no shielded hit equals its twin, action for action and in its final state",
        "shipped runs with the natural first seat equal playMatch",
      ],
      actionsChecked: tally.actions,
      damageEventsChecked: tally.damageEvents,
      shieldedEvents: tally.shieldedEvents,
      shieldRunsIdenticalToTwin: tally.unchangedTwins,
      shippedRunsEqualToPlayMatch: replayChecked,
    },
    summary: Object.fromEntries(policies.map((policy) => [policy, summarize(rows, policy)])),
    paired,
    verdict: {
      rule: "RT-10: against Both, seat-gap change 95% interval below zero and mean rounds +0.5 or less",
      bothShield: verdict(paired["bothShield vs both"]),
      shield: verdict(paired["shield vs both"]),
    },
    seeds0and60,
    matches: rows,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { from: { type: "string", default: "10000" }, count: { type: "string", default: "64" }, out: { type: "string" } } });
  const from = wholeNumber(values.from);
  const count = wholeNumber(values.count);
  if (from === null || !count || count < 2 || count > 10000 || !Number.isSafeInteger(from + count - 1)) {
    console.error("usage: node scripts/compare-round-one-tempo.mjs [--from <integer >= 0>] [--count <2-10000>] [--out <dir>/results.json]");
    process.exit(2);
  }
  const report = run({ from, count });
  const { matches, ...printed } = report;
  const text = JSON.stringify(printed, null, 2) + "\n";
  if (values.out) {
    mkdirSync(path.dirname(values.out), { recursive: true });
    writeFileSync(values.out, JSON.stringify(report) + "\n");
    writeFileSync(path.join(path.dirname(values.out), "summary.json"), text);
  }
  process.stdout.write(text);
}
