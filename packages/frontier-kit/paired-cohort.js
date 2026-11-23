// Paired duel kit: plays one seeded cohort under two versions of any two-sided game and counts the results.
// Every seed in [firstSeed, firstSeed + deals) is played once with each side opening, in a stable order
// (seed, then sides[0], then sides[1]); for each game the baseline is played before the candidate on the
// identical seed and opening side. Pure: no DOM, rendering, filesystem, network or model dependencies.
// Moved unchanged from src/review/paired-duel-kit.js, which now re-exports this module.
//
//   measurePairedCohort({firstSeed, deals, sides: [a, b], playBaseline, playCandidate, onPair?})
//     playBaseline(seed, first) and playCandidate(seed, first) return {winner, endTurn}:
//       winner is a or b, or a genuine draw reported as "draw" or null; endTurn is the positive whole turn the game ended on.
//     onPair({seed, first, baseline, candidate}) receives each pair with winners normalized (null becomes "draw").
//   -> {gamesPerArm, baseline: {wins: {[a]: n, [b]: n}, draws, firstWins}, candidate: {same}, switchedWinners}
//
// Any malformed input or outcome throws PairedCohortError; nothing is skipped, defaulted or guessed.

export const DRAW = "draw";
export const MAX_DEALS = 1_000_000;
const SIDE = /^[a-z][a-z0-9-]{0,31}$/;

export class PairedCohortError extends Error {
  constructor(message) {
    super(message);
    this.name = "PairedCohortError";
  }
}

const fail = (message) => { throw new PairedCohortError(message); };
const isWhole = (value) => Number.isSafeInteger(value);
const describe = (value) => {
  if (typeof value === "function") return "a function";
  if (value === undefined) return "undefined";
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
};

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("input must be an object");
  const {firstSeed, deals, sides, playBaseline, playCandidate, onPair} = input;
  if (!isWhole(firstSeed) || firstSeed < 0) fail(`firstSeed must be a non-negative whole number, got ${describe(firstSeed)}`);
  if (!isWhole(deals) || deals < 1 || deals > MAX_DEALS) fail(`deals must be a whole number from 1 to ${MAX_DEALS}, got ${describe(deals)}`);
  // Last seed is firstSeed + deals - 1; compare without adding so the check cannot round past MAX_SAFE_INTEGER.
  if (deals - 1 > Number.MAX_SAFE_INTEGER - firstSeed) fail("the seed range must stay within safe whole numbers");
  if (!Array.isArray(sides) || sides.length !== 2) fail(`sides must be an array of exactly two side names, got ${describe(sides)}`);
  for (const side of sides) {
    if (typeof side !== "string" || !SIDE.test(side)) fail(`each side must be a lowercase name such as "cowboy", got ${describe(side)}`);
    if (side === DRAW) fail(`"${DRAW}" is reserved for draws and cannot be a side`);
  }
  if (sides[0] === sides[1]) fail(`sides must be two different names, got ${describe(sides)}`);
  if (typeof playBaseline !== "function") fail("playBaseline must be a function (seed, first) -> {winner, endTurn}");
  if (typeof playCandidate !== "function") fail("playCandidate must be a function (seed, first) -> {winner, endTurn}");
  if (onPair !== undefined && typeof onPair !== "function") fail("onPair must be a function when given");
  return {firstSeed, deals, sides: [sides[0], sides[1]], playBaseline, playCandidate, onPair};
}

// Checks one reported outcome and returns {winner, endTurn} with a null draw normalized to "draw".
function checkOutcome(outcome, sides, where) {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) fail(`${where}: outcome must be an object {winner, endTurn}, got ${describe(outcome)}`);
  if (typeof outcome.then === "function") fail(`${where}: outcome is a promise; the play function must return its result directly`);
  if (!("winner" in outcome)) fail(`${where}: outcome has no winner`);
  const {winner, endTurn} = outcome;
  if (winner !== null && winner !== DRAW && !sides.includes(winner)) fail(`${where}: winner must be ${sides.map((s) => `"${s}"`).join(", ")}, "${DRAW}" or null, got ${describe(winner)}`);
  if (!isWhole(endTurn) || endTurn < 1) fail(`${where}: endTurn must be the positive whole turn the game ended on, got ${describe(endTurn)}`);
  return Object.freeze({winner: winner ?? DRAW, endTurn});
}

const emptyArm = (sides) => ({wins: {[sides[0]]: 0, [sides[1]]: 0}, draws: 0, firstWins: 0});

function tally(arm, outcome, first) {
  if (outcome.winner === DRAW) arm.draws += 1;
  else {
    arm.wins[outcome.winner] += 1;
    if (outcome.winner === first) arm.firstWins += 1;
  }
}

export function measurePairedCohort(input) {
  const {firstSeed, deals, sides, playBaseline, playCandidate, onPair} = validateInput(input);
  const baselineArm = emptyArm(sides), candidateArm = emptyArm(sides);
  let gamesPerArm = 0, switchedWinners = 0;
  for (let offset = 0; offset < deals; offset++) {
    const seed = firstSeed + offset;
    for (const first of sides) {
      const where = `seed ${seed}, ${first} first`;
      const baseline = checkOutcome(playBaseline(seed, first), sides, `${where}, baseline`);
      const candidate = checkOutcome(playCandidate(seed, first), sides, `${where}, candidate`);
      tally(baselineArm, baseline, first);
      tally(candidateArm, candidate, first);
      gamesPerArm += 1;
      if (baseline.winner !== candidate.winner) switchedWinners += 1;
      if (onPair) onPair(Object.freeze({seed, first, baseline, candidate}));
    }
  }
  for (const [name, arm] of [["baseline", baselineArm], ["candidate", candidateArm]]) {
    if (arm.wins[sides[0]] + arm.wins[sides[1]] + arm.draws !== gamesPerArm) fail(`${name}: wins and draws do not add up to ${gamesPerArm} games`);
  }
  return {gamesPerArm, baseline: baselineArm, candidate: candidateArm, switchedWinners};
}
