// Paired Ride Out experiment (.kiro/specs/ride-out, RO-9 and RO-10). Usage:
//   node scripts/compare-ride-out.mjs --lane development|holdout --cpu normal|hard [--out <file>]
// Every seed of a lane is played with each faction in the first seat, once on
// the shipped rules and once with rideOut: true, with the same shuffles and the
// same CPU level on both sides of both arms. The seed lanes were fixed before
// the first run. Checked for every paired match: card conservation and troop
// health after every action; the same actions and events before the first
// ride-out; a ride-out match without a ride-out equal to its shipped pair, so
// every changed result follows an actual ride-out; and, at the first ride-out,
// the level's choice from the view without the move equal to the action the
// paired shipped match played there.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CARDS, DECKS, SIDES, opponent } from "../src/game/cards.js";
import { RIDE_OUT_RULES_VERSION, RULES_VERSION, createMatch } from "../src/game/state.js";
import { legalActions } from "../src/game/legal.js";
import { shiftTroop } from "../src/game/lanes.js";
import { openingMatch } from "../src/game/opening-policy.js";
import { cpuFor } from "../src/game/cpu.js";
import { playMatch } from "./play-match.mjs";

export const LANES = Object.freeze({ development: { from: 60000, count: 1000 }, holdout: { from: 61000, count: 2000 } });
const LEVELS = ["normal", "hard"];
// Files whose git blob IDs identify the code behind a receipt.
const SOURCES = [
  "scripts/compare-ride-out.mjs",
  "scripts/play-match.mjs",
  ...["actions", "card-specs.generated", "cards", "clash", "cpu", "deck-builder", "lanes", "legal", "opening-policy", "state", "view"].map((file) => `src/game/${file}.js`),
];

// Historical baseline: the study compares all troops moving with no moves, so
// both bots read CARDS with card-level rides removed (read-only clone). Newer
// card-level rides (e.g. Mounted Billy) stay legal in the engine but are never chosen.
export const HISTORICAL_CARDS = Object.freeze(Object.fromEntries(Object.entries(CARDS).map(([id, card]) => {
  const { rides, ...rest } = card;
  return [id, Object.freeze(rest)];
})));
export const historicalBot = (choose) => (view) => choose(view, { cards: HISTORICAL_CARDS });

const name = (cardId) => CARDS[cardId].name;
const pct = (n, of) => Number(((100 * n) / of).toFixed(2));
const fixed = (x, digits = 3) => Number(x.toFixed(digits));
const value = (result, side) => (result.winner === null ? 0 : result.winner === side ? 1 : -1);
const SORTED_DECKS = Object.fromEntries(SIDES.map((side) => [side, [...DECKS[side]].sort()]));

function sourceIdentity() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  return Object.fromEntries(SOURCES.map((file) => {
    const bytes = readFileSync(path.join(root, file));
    return [file, createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")];
  }));
}

function assertSound(state, label) {
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const all = [...deck, ...hand, ...board.filter(Boolean).map((troop) => troop.cardId), ...discard].sort();
    assert.deepEqual(all, SORTED_DECKS[side], `${label}: ${side} cards not conserved`);
    for (const troop of board) {
      if (troop) assert.ok(troop.health >= 1 && troop.health <= CARDS[troop.cardId].health, `${label}: ${side} ${troop.cardId} health ${troop.health}`);
    }
  }
}

// Attack from `mine` that would reach the other Base in one clash.
const pressure = (mine, theirs) => mine.reduce((sum, troop, lane) => sum + (troop && !theirs[lane] ? CARDS[troop.cardId].attack : 0), 0);

// The brief's alternatives: spread (free summon), tribute, or hold (cast only, or end the phase).
function planOf(action) {
  if (action.type === "summon") return action.tributes.length ? "tribute" : "spread";
  return action.type === "spell" ? "cast" : action.type === "ride-out" ? "rideOut" : "hold";
}

// The move as the riding side saw it: which lanes had an enemy troop opposite, and Base pressure both ways.
function describeMove(view, action) {
  const mine = view.sides[view.viewer].board;
  const theirs = view.sides[opponent(view.viewer)].board;
  const after = [...mine];
  shiftTroop(after, action.slot, action.destination);
  const fromBlocked = theirs[action.slot] !== null;
  const toBlocked = theirs[action.destination] !== null;
  return {
    cardId: mine[action.slot].cardId,
    health: mine[action.slot].health,
    kind: fromBlocked ? (toBlocked ? "rematch" : "breakOut") : toBlocked ? "block" : "reposition",
    givesUpProtection: fromBlocked,
    ownPressure: [pressure(mine, theirs), pressure(after, theirs)],
    enemyPressure: [pressure(theirs, mine), pressure(theirs, after)],
    lead: view.sides[view.viewer].baseOrbs - view.sides[opponent(view.viewer)].baseOrbs,
  };
}

// Wraps a chooser for the ride-out arm. At each phase's first decision (both
// allowances unused) it records whether a ride-out was legal and, if so, what
// else was legal and what the same level picks from the same view without the move.
function observed(choose, starter, decisions) {
  return (view) => {
    const action = choose(view);
    const side = view.viewer;
    const { summonUsed, castUsed } = view.allowances[side];
    if (summonUsed || castUsed) return action;
    const legal = legalActions(view, side);
    const moves = legal.filter((each) => each.type === "ride-out").length;
    const decision = { index: view.revision, round: view.round, side, seat: side === starter ? "first" : "second", moves };
    if (moves) {
      const summons = legal.filter((each) => each.type === "summon");
      decision.legal = {
        spread: summons.some((each) => each.tributes.length === 0),
        tribute: summons.some((each) => each.tributes.length > 0),
        spell: legal.some((each) => each.type === "spell"),
      };
      const { rideOut, ...withoutMove } = view;
      decision.shipped = choose(withoutMove);
      decision.action = action;
      if (action.type === "ride-out") decision.move = describeMove(view, action);
    }
    decisions.push(decision);
    return action;
  };
}

const boardText = (board) => board.map((troop) => (troop ? `${name(troop.cardId)} ${troop.health}` : "-"));
const positionOf = (state) => Object.fromEntries(SIDES.map((side) => [side, { base: state.sides[side].baseOrbs, board: boardText(state.sides[side].board) }]));
function actionText(action) {
  if (action.type === "summon") return `summon ${name(action.cardId)} to lane ${action.slot}${action.tributes.length ? ` (tribute lane ${action.tributes.join(", ")})` : ""}`;
  if (action.type === "spell") return `cast ${name(action.cardId)} on enemy lane ${action.target}${action.destination == null ? "" : `, moving it to lane ${action.destination}`}`;
  if (action.type === "ride-out") return `ride out lane ${action.slot} to lane ${action.destination}`;
  return "end phase";
}

// From log index `at`: the rest of that phase, the opponent's actions before the next clash, and that clash.
function sequel(log, at) {
  const { side, round } = log[at];
  const clashAt = log.findIndex((entry, i) => i >= at && entry.events.some((event) => event.type === "clash"));
  const between = log.slice(at, clashAt + 1);
  const clash = log[clashAt];
  return {
    phase: between.filter((entry) => entry.side === side && entry.round === round).map(({ action }) => actionText(action)),
    opponent: between.filter((entry) => entry.side !== side).map(({ action }) => actionText(action)),
    clash: {
      round: clash.round,
      damage: clash.events.filter((event) => event.type === "damage").map(({ lane, attacker, target, before, after }) =>
        `L${lane} ${attacker.side} ${name(attacker.cardId)} > ${target.kind === "base" ? `${target.side} Base` : `${target.side} ${name(target.cardId)}`} ${before}->${after}`),
      after: positionOf(clash.state),
    },
  };
}

const outcomes = () => ({ better: 0, same: 0, worse: 0 });
const byPlan = (make) => ({ spread: make(), tribute: make(), cast: make(), hold: make() });
const byKind = (make) => ({ breakOut: make(), block: make(), rematch: make(), reposition: make() });
const leadOf = (lead) => (lead < 0 ? "behind" : lead === 0 ? "even" : "ahead");
const bump = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

export function run({ from, count, cpu, lane = null }) {
  const choose = historicalBot(cpuFor(cpu));
  const bots = { cowboy: choose, wizard: choose };
  const arm = () => ({
    matches: 0, firstSeatWins: 0, secondSeatWins: 0, draws: 0, drawsByReason: { "base-destroyed": 0, "round-limit": 0 },
    factionWins: { cowboy: 0, wizard: 0 }, endings: { "base-destroyed": 0, "round-limit": 0 }, rounds: 0, roundHistogram: {},
  });
  const arms = { shipped: arm(), rideOut: arm() };
  const usage = {
    phases: { total: 0, first: 0, second: 0 },
    opportunities: { total: 0, first: 0, second: 0, cowboy: 0, wizard: 0, moveOptions: 0, spreadLegal: 0, tributeLegal: 0, noSummonLegal: 0 },
    uses: { total: 0, first: 0, second: 0, cowboy: 0, wizard: 0 },
    // What the level plays from the same view without the move, at each opportunity, and how often it rode out instead.
    shippedPlanAtOpportunity: byPlan(() => ({ opportunities: 0, uses: 0 })),
    atUse: {
      spreadLegal: 0, tributeLegal: 0, noSummonLegal: 0, kinds: byKind(() => 0), givesUpProtection: 0,
      stalled: 0, racing: 0, mutualStall: 0, lead: { behind: 0, even: 0, ahead: 0 }, followedBySpell: 0,
    },
    matchesWithUse: 0,
    usesPerMatch: {},
  };
  // First ride-out of a paired match: both arms share the whole history up to it.
  const divergence = {
    matches: 0, ridingSide: outcomes(), byShippedPlan: byPlan(outcomes), byKind: byKind(outcomes),
    stalled: outcomes(), racing: outcomes(), mutualStall: outcomes(), byLead: { behind: outcomes(), even: outcomes(), ahead: outcomes() },
    givesUpProtection: outcomes(),
    // The riding side's result, shipped -> ride-out arm; and match length when that result is unchanged.
    transitions: {},
    sameResultRounds: Object.fromEntries(["won", "drew", "lost"].map((result) => [result, { shorter: 0, equal: 0, longer: 0 }])),
  };
  // First first-divergence use in seed order for each slot; one use fills at most one slot.
  const examples = { givesUpProtection: null, changedResult: null, displacedSummon: null };
  const perSeed = new Map();
  const flow = {};
  const matches = [];
  let naturalOpenings = 0;
  let changed = 0;

  for (let seed = from; seed < from + count; seed++) {
    const natural = createMatch(seed).startingSide;
    for (const starter of SIDES) {
      const label = `${cpu} seed ${seed} first ${starter}`;
      const opening = openingMatch(seed, "shipped", starter);
      if (starter === natural) {
        assert.deepEqual(opening, createMatch(seed), `${label}: shipped opening`);
        naturalOpenings += 1;
      }
      const off = playMatch(seed, bots, opening);
      const decisions = [];
      const watch = observed(choose, starter, decisions);
      const on = playMatch(seed, { cowboy: watch, wizard: watch }, openingMatch(seed, "shipped", starter, { rideOut: true }));
      for (const [key, played] of [["shipped", off], ["rideOut", on]]) {
        assertSound(played.opening, `${label} ${key} opening`);
        played.log.forEach((entry, i) => assertSound(entry.state, `${label} ${key} action ${i}`));
        const { result } = played.state;
        const s = arms[key];
        s.matches += 1;
        s.rounds += result.round;
        bump(s.roundHistogram, result.round);
        s.endings[result.reason] += 1;
        if (result.winner === null) {
          s.draws += 1;
          s.drawsByReason[result.reason] += 1;
        } else {
          s.factionWins[result.winner] += 1;
          s[result.winner === starter ? "firstSeatWins" : "secondSeatWins"] += 1;
        }
      }

      // RO-9: identical up to the first ride-out; with none, identical throughout.
      const firstRide = on.log.findIndex(({ action }) => action.type === "ride-out");
      const shared = firstRide === -1 ? on.log.length : firstRide;
      for (let i = 0; i < shared; i++) {
        assert.deepEqual([on.log[i].action, on.log[i].events], [off.log[i].action, off.log[i].events], `${label}: differs at action ${i} before any ride-out`);
      }
      if (firstRide === -1) {
        assert.equal(on.log.length, off.log.length, `${label}: no ride-out but a different length`);
        assert.deepEqual(on.state.result, off.state.result, `${label}: no ride-out but a different result`);
      }

      const rides = on.log.filter(({ action }) => action.type === "ride-out").length;
      bump(usage.usesPerMatch, rides);
      if (rides) usage.matchesWithUse += 1;
      for (const decision of decisions) {
        usage.phases.total += 1;
        usage.phases[decision.seat] += 1;
        if (!decision.moves) continue;
        const o = usage.opportunities;
        o.total += 1;
        o[decision.seat] += 1;
        o[decision.side] += 1;
        o.moveOptions += decision.moves;
        if (decision.legal.spread) o.spreadLegal += 1;
        if (decision.legal.tribute) o.tributeLegal += 1;
        if (!decision.legal.spread && !decision.legal.tribute) o.noSummonLegal += 1;
        const plan = planOf(decision.shipped);
        usage.shippedPlanAtOpportunity[plan].opportunities += 1;
        if (!decision.move) continue;
        usage.shippedPlanAtOpportunity[plan].uses += 1;
        const u = usage.uses;
        u.total += 1;
        u[decision.seat] += 1;
        u[decision.side] += 1;
        const a = usage.atUse;
        if (decision.legal.spread) a.spreadLegal += 1;
        if (decision.legal.tribute) a.tributeLegal += 1;
        if (!decision.legal.spread && !decision.legal.tribute) a.noSummonLegal += 1;
        a.kinds[decision.move.kind] += 1;
        if (decision.move.givesUpProtection) a.givesUpProtection += 1;
        a[decision.move.ownPressure[0] === 0 ? "stalled" : "racing"] += 1;
        if (decision.move.ownPressure[0] === 0 && decision.move.enemyPressure[0] === 0) a.mutualStall += 1;
        a.lead[leadOf(decision.move.lead)] += 1;
        const next = on.log[decision.index + 1];
        if (next && next.side === decision.side && next.round === decision.round && next.action.type === "spell") a.followedBySpell += 1;
      }

      if (firstRide !== -1) {
        const decision = decisions.find((each) => each.index === firstRide);
        assert.deepEqual(decision.shipped, off.log[firstRide].action, `${label}: shipped choice differs from the paired shipped match`);
        const side = decision.side;
        const delta = value(on.state.result, side) - value(off.state.result, side);
        const verdict = delta > 0 ? "better" : delta < 0 ? "worse" : "same";
        const plan = planOf(decision.shipped);
        const d = divergence;
        d.matches += 1;
        d.ridingSide[verdict] += 1;
        d.byShippedPlan[plan][verdict] += 1;
        d.byKind[decision.move.kind][verdict] += 1;
        d[decision.move.ownPressure[0] === 0 ? "stalled" : "racing"][verdict] += 1;
        if (decision.move.ownPressure[0] === 0 && decision.move.enemyPressure[0] === 0) d.mutualStall[verdict] += 1;
        d.byLead[leadOf(decision.move.lead)][verdict] += 1;
        if (decision.move.givesUpProtection) d.givesUpProtection[verdict] += 1;
        const word = (result) => ["lost", "drew", "won"][value(result, side) + 1];
        bump(d.transitions, `${word(off.state.result)}->${word(on.state.result)}`);
        if (on.state.result.winner === off.state.result.winner) {
          const rounds = on.state.result.round - off.state.result.round;
          d.sameResultRounds[word(on.state.result)][rounds < 0 ? "shorter" : rounds === 0 ? "equal" : "longer"] += 1;
        }
        const wanted = decision.move.givesUpProtection && !examples.givesUpProtection ? "givesUpProtection"
          : verdict !== "same" && !examples.changedResult ? "changedResult"
          : (plan === "spread" || plan === "tribute") && !examples.displacedSummon ? "displacedSummon" : null;
        if (wanted) {
          const before = firstRide === 0 ? on.opening : on.log[firstRide - 1].state;
          examples[wanted] = {
            seed, firstSeat: starter, round: decision.round, side, actionIndex: firstRide,
            before: positionOf(before),
            hand: before.sides[side].hand.map(name),
            legal: decision.legal,
            move: decision.move,
            ridingSide: verdict,
            shipped: { ...sequel(off.log, firstRide), result: off.state.result },
            rideOut: { ...sequel(on.log, firstRide), result: on.state.result },
          };
        }
      }

      const offResult = off.state.result;
      const onResult = on.state.result;
      if (offResult.winner !== onResult.winner) changed += 1;
      const seat = (result) => (result.winner === null ? "draw" : result.winner === starter ? "firstSeat" : "secondSeat");
      bump(flow, `${seat(offResult)}->${seat(onResult)}`);
      const p = perSeed.get(seed) ?? { seat: 0, faction: 0, draw: 0, rounds: 0 };
      p.seat += (value(onResult, starter) - value(offResult, starter)) / 2;
      p.faction += (value(onResult, "cowboy") - value(offResult, "cowboy")) / 2;
      p.draw += ((onResult.winner === null) - (offResult.winner === null)) / 2;
      p.rounds += (onResult.round - offResult.round) / 2;
      perSeed.set(seed, p);
      matches.push({ seed, firstSeat: starter, shipped: offResult.winner ?? "draw", rideOut: onResult.winner ?? "draw", rounds: [offResult.round, onResult.round], rideOuts: rides });
    }
  }

  const summary = {};
  for (const [key, s] of Object.entries(arms)) {
    const { rounds, ...rest } = s;
    summary[key] = {
      ...rest,
      firstSeatWinPct: pct(s.firstSeatWins, s.matches),
      secondSeatWinPct: pct(s.secondSeatWins, s.matches),
      seatGapPoints: pct(s.firstSeatWins - s.secondSeatWins, s.matches),
      factionGapPoints: pct(s.factionWins.cowboy - s.factionWins.wizard, s.matches),
      drawPct: pct(s.draws, s.matches),
      meanRounds: fixed(rounds / s.matches),
    };
  }
  // Paired change per seed (its two first-seat matches), with a normal 95% interval.
  const stat = (key, scale) => {
    const values = [...perSeed.values()].map((p) => scale * p[key]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const se = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1) / values.length);
    return { mean: fixed(mean, 2), ci95: [fixed(mean - 1.96 * se, 2), fixed(mean + 1.96 * se, 2)] };
  };
  usage.opportunities.meanMoveOptions = usage.opportunities.total ? fixed(usage.opportunities.moveOptions / usage.opportunities.total, 2) : 0;
  delete usage.opportunities.moveOptions;

  return {
    experiment: "ride-out",
    spec: ".kiro/specs/ride-out",
    rulesVersion: { shipped: RULES_VERSION, rideOut: RIDE_OUT_RULES_VERSION },
    cpu,
    lane,
    seeds: { from, to: from + count - 1, count },
    firstSeats: SIDES,
    matchesPerArm: matches.length,
    bots: `src/game/cpu.js ${cpu} on both sides of both arms`,
    sourceBlobs: sourceIdentity(),
    checks: {
      cardConservationAndHealthAfterEveryAction: "passed",
      sameActionsAndEventsBeforeFirstRideOut: "passed",
      noRideOutMeansShippedMatch: "passed",
      shippedChoiceEqualsPairedShippedAction: "passed",
      naturalSeatOpeningsEqualToCreateMatch: naturalOpenings,
    },
    summary,
    paired: {
      matchesWithRideOut: usage.matchesWithUse,
      matchesWithChangedWinner: changed,
      seatGapChangePoints: stat("seat", 100),
      factionGapChangePoints: stat("faction", 100),
      drawRateChangePoints: stat("draw", 100),
      roundsChange: stat("rounds", 1),
      outcomeFlow: flow,
    },
    usage,
    firstDivergence: divergence,
    examples,
    matches,
  };
}

// SHA-256 of the JSON playMatch log per level and seed, recorded on 55a395e
// before any Ride Out change (also pinned in tests/game/ride-out.test.js).
const BASE_LOG_SHA256 = {
  normal: { 0: "a5d304bfc7cbdbd4a6309360a8c239214f2685bd7b7a80d15a51b78d344ed040", 60: "b3d2e4610abaccc9dfc0d56078484ec40932105dd8f9b635a3708985be041db5" },
  hard: { 0: "c9ab16c73b7ebe62e5c18986615c22edb57839e7d61035c23a76f2690a1ab180", 60: "88ec9232ffe4f25211acd8f7ce8a12271799b10a8f530884cc95d39a48c88163" },
};

// Seeds 0 and 60 with their own first seat: shipped parity with 55a395e, and
// whether the ride-out arm leaves the shipped route, and where.
export function preservation(cpu) {
  const choose = historicalBot(cpuFor(cpu));
  const bots = { cowboy: choose, wizard: choose };
  const sha = (log) => createHash("sha256").update(JSON.stringify(log)).digest("hex");
  return [0, 60].map((seed) => {
    const off = playMatch(seed, bots);
    const on = playMatch(seed, bots, createMatch(seed, { rideOut: true }));
    const first = on.log.findIndex(({ action }) => action.type === "ride-out");
    return {
      seed,
      firstSeat: off.opening.startingSide,
      shippedLogSha256: sha(off.log),
      shippedLogEqualTo55a395e: sha(off.log) === BASE_LOG_SHA256[cpu][seed],
      rideOuts: on.log.filter(({ action }) => action.type === "ride-out").length,
      firstRideOut: first === -1 ? null : { actionIndex: first, round: on.log[first].round, side: on.log[first].side, action: actionText(on.log[first].action) },
      result: { shipped: off.state.result, rideOut: on.state.result },
    };
  });
}

if (import.meta.main) {
  const usage = `usage: node scripts/compare-ride-out.mjs --lane ${Object.keys(LANES).join("|")} --cpu ${LEVELS.join("|")} [--out <file>]`;
  let values;
  try {
    ({ values } = parseArgs({ options: { lane: { type: "string" }, cpu: { type: "string" }, out: { type: "string" } } }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  if (!Object.hasOwn(LANES, values.lane ?? "") || !LEVELS.includes(values.cpu)) {
    console.error(usage);
    process.exit(2);
  }
  const report = { ...run({ ...LANES[values.lane], cpu: values.cpu, lane: values.lane }), preservation: preservation(values.cpu) };
  if (values.out) {
    mkdirSync(path.dirname(values.out), { recursive: true });
    writeFileSync(values.out, JSON.stringify(report) + "\n");
  }
  const { matches, sourceBlobs, ...printed } = report;
  console.log(JSON.stringify(printed, null, 2));
}
