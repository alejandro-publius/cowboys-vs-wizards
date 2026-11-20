// One Outrider decision on The Bone Fence: ride past a Wizard troop to the Base, or fight that troop.
// Pure: no DOM, storage or network. Every decision is made from a fresh createShowdownSession and
// reads only session.view() (viewFor(state, "cowboy")) and session.legal(). The Wizard is the shipped
// bot the session runs (playTurn(state, duel.level), level 0 on The Bone Fence). See README.md.
import {has, cardOf} from "../../../src/game/showdown/cards.js";
import {applyAction, attackOf, attackOutcome} from "../../../src/game/showdown/rules.js";
import {createShowdownSession} from "../../../src/match/showdown-session.js";
import {setup} from "../compare.js";

export const RANGES = Object.freeze({a: {from: 1000, to: 1099}, b: {from: 1100, to: 1199}, holdout: {from: 1200, to: 1299}});
export const DECISION_CAP = 400; // Cowboy decisions per game; a game that reaches it is reported as "cap"
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const boneFence = () => setup().duel;

// The view a policy may simulate on: the public view with the hidden lists left empty, so
// applyAction can run on it. Sizes stay visible only as viewFor's counts.
export function simView(view) {
  const next = structuredClone(view);
  next.sides.cowboy.deck = [];
  next.sides.wizard.hand = [];
  next.sides.wizard.deck = [];
  next.sides.wizard.traps = [];
  return next;
}

const worth = (state, troop) => (troop ? 2 * attackOf(state, troop) + troop.health : 0);
function score(state) {
  if (state.result) return state.result.winner === "cowboy" ? 1e6 : state.result.winner === null ? 0 : -1e6;
  const {cowboy, wizard} = state.sides;
  const material = (side) => side.board.reduce((sum, troop) => sum + worth(state, troop), 0);
  return 8 * (cowboy.base - wizard.base) + material(cowboy) - material(wizard);
}

// Continuation policy (fixed before any run; the Outrider experiment's one-ply greedy):
// over session.legal() in its order, skip cover and end, apply each to the public view, keep the
// first strictly best score; end when nothing beats the current score.
export function policy(view, legal) {
  const sim = simView(view);
  let best = {type: "end"};
  let value = score(sim);
  for (const action of legal) {
    if (action.type === "end" || action.type === "cover") continue;
    const after = score(applyAction(sim, action).state);
    if (after > value) [best, value] = [action, after];
  }
  if (!legal.some((each) => same(each, best))) throw new Error("policy chose an action that is not legal");
  return best;
}

// The branch: a ready Ride troop (lowest slot) that may legally strike the Base past standing Wizard
// troops and may legally attack one of them. fight = that slot on the first troop target in legal order.
export function branchAt(view, legal) {
  if (!view.sides.wizard.board.some(Boolean)) return null;
  const own = view.sides.cowboy.board;
  for (let slot = 0; slot < own.length; slot++) {
    if (!own[slot] || !has(own[slot].cardId, "ride")) continue;
    const ride = {type: "attack", slot, target: "base"};
    if (!legal.some((each) => same(each, ride))) continue;
    const fight = legal.find((each) => each.type === "attack" && each.slot === slot && typeof each.target === "number");
    if (fight) return {ride, fight};
  }
  return null;
}

// Public cues at the branch, all read from the view. Numbers only, so a rule can threshold them.
export function cues(view, choices) {
  const sim = simView(view);
  const {cowboy, wizard} = view.sides;
  const rider = cowboy.board[choices.ride.slot];
  const target = wizard.board[choices.fight.target];
  const fight = attackOutcome(sim, choices.fight.slot, choices.fight.target);
  const power = (side) => side.board.reduce((sum, troop) => sum + (troop ? attackOf(sim, troop) : 0), 0);
  const count = (side) => side.board.filter(Boolean).length;
  return {
    turn: view.turn, cowboyBase: cowboy.base, wizardBase: wizard.base, baseGap: cowboy.base - wizard.base,
    cowboyTroops: count(cowboy), wizardTroops: count(wizard), troopGap: count(cowboy) - count(wizard),
    cowboyPower: power(cowboy), wizardPower: power(wizard),
    riderHealth: rider.health, targetHealth: target.health, targetAttack: attackOf(sim, target),
    fightKills: fight.targetLeft === 0 ? 1 : 0, riderSurvivesFight: fight.attackerLeft > 0 ? 1 : 0,
    cowboyHand: cowboy.handCount, wizardHand: wizard.handCount, wizardTraps: wizard.trapCount,
    target: cardOf(target.cardId).name,
  };
}
export const CUE_FEATURES = Object.freeze(["turn", "cowboyBase", "wizardBase", "baseGap", "cowboyTroops", "wizardTroops", "troopGap",
  "cowboyPower", "wizardPower", "riderHealth", "targetHealth", "targetAttack", "fightKills", "riderSurvivesFight",
  "cowboyHand", "wizardHand", "wizardTraps"]);

// Plays a session to the end with the policy. Returns the public result.
export function playOut(session) {
  for (let n = 0; n < DECISION_CAP; n++) {
    const view = session.view();
    if (view.result) return {winner: view.result.winner ?? "draw", reason: view.result.reason ?? null, turn: view.turn, decisions: n};
    session.act(policy(view, session.legal()));
  }
  return {winner: "cap", reason: "decision-cap", turn: session.view().turn, decisions: DECISION_CAP};
}

// From a fresh deal, plays the policy until the first branch. Returns the minimal prefix (every
// Cowboy action before the branch) or null when the game ends without one.
export function findBranch(seed, duel = boneFence()) {
  const session = createShowdownSession({seed, duel});
  const prefix = [];
  for (let n = 0; n < DECISION_CAP; n++) {
    const view = session.view();
    if (view.result) return {seed, branch: null, ended: view.result.winner ?? "draw", decisions: n};
    const legal = session.legal();
    const choices = branchAt(view, legal);
    if (choices) return {seed, branch: {prefix, at: view.turn, choices, view, policyChoice: same(policy(view, legal), choices.ride) ? "ride" : same(policy(view, legal), choices.fight) ? "fight" : "other"}};
    const action = policy(view, legal);
    session.act(action);
    prefix.push(action);
  }
  return {seed, branch: null, ended: "cap", decisions: DECISION_CAP};
}

// A fresh session opened at the branch through the session's own allowlisted-prefix replay.
export function openAt(seed, branch, duel = boneFence()) {
  return createShowdownSession({seed, duel: {...duel, prefix: branch.prefix, at: branch.at}});
}

// Both arms of one seed, each from its own fresh session. Throws if the two arms do not start
// from the same public position with the same legal actions.
export function playArms(seed, branch, duel = boneFence()) {
  const out = {};
  for (const arm of ["ride", "fight"]) {
    const session = openAt(seed, branch, duel);
    if (!same(session.view(), branch.view)) throw new Error(`seed ${seed} ${arm}: branch view differs`);
    if (!session.legal().some((each) => same(each, branch.choices[arm]))) throw new Error(`seed ${seed} ${arm}: action not legal`);
    session.act(branch.choices[arm]);
    out[arm] = playOut(session);
  }
  return out;
}

export const pairKind = ({ride, fight}) => (ride.winner === fight.winner ? `both-${ride.winner}`
  : ride.winner === "cowboy" && fight.winner === "wizard" ? "ride-only"
    : fight.winner === "cowboy" && ride.winner === "wizard" ? "fight-only" : "other");

// The whole search over one range. Every seed is listed, with or without a branch.
export function search({from, to}, duel = boneFence()) {
  const seeds = [];
  for (let seed = from; seed <= to; seed++) {
    const found = findBranch(seed, duel);
    if (!found.branch) { seeds.push({seed, branch: false, ended: found.ended}); continue; }
    const arms = playArms(seed, found.branch, duel);
    seeds.push({seed, branch: true, at: found.branch.at, prefix: found.branch.prefix, choices: found.branch.choices,
      policyChoice: found.branch.policyChoice, cues: cues(found.branch.view, found.branch.choices), ...arms, kind: pairKind(arms)});
  }
  return {range: {from, to}, tried: seeds.length, seeds, counts: tally(seeds)};
}

export function tally(seeds) {
  const counts = {tried: seeds.length, branch: 0, noBranch: 0, kinds: {}};
  for (const each of seeds) {
    if (!each.branch) { counts.noBranch += 1; continue; }
    counts.branch += 1;
    counts.kinds[each.kind] = (counts.kinds[each.kind] ?? 0) + 1;
  }
  return counts;
}

// A cue rule: `feature op threshold` says fight, otherwise ride.
export const predicts = (rule, cue) => ((rule.op === "<=" ? cue[rule.feature] <= rule.threshold : cue[rule.feature] >= rule.threshold) ? "fight" : "ride");
const winnerArm = (kind) => (kind === "ride-only" ? "ride" : kind === "fight-only" ? "fight" : null);

// Pre-registered cue derivation: over every feature, threshold seen in the data and both directions,
// the rule that names the winning arm in the most clean reversals; ties go to the earlier feature,
// "<=" before ">=", then the lower threshold. Constant rules (always ride / always fight) are the baselines.
export function deriveCue(rows) {
  const flips = rows.filter((row) => winnerArm(row.kind));
  let best = null;
  for (const feature of CUE_FEATURES) {
    const values = [...new Set(flips.map((row) => row.cues[feature]))].sort((x, y) => x - y);
    for (const op of ["<=", ">="]) {
      for (const threshold of values) {
        const rule = {feature, op, threshold};
        const correct = flips.filter((row) => predicts(rule, row.cues) === winnerArm(row.kind)).length;
        if (!best || correct > best.correct) best = {...rule, correct, of: flips.length};
      }
    }
  }
  return best;
}

export function scoreCue(rule, rows) {
  const flips = rows.filter((row) => winnerArm(row.kind));
  const correct = flips.filter((row) => predicts(rule, row.cues) === winnerArm(row.kind)).length;
  const rideFlips = flips.filter((row) => row.kind === "ride-only").length;
  const branches = rows.length;
  const winsFollowing = rows.filter((row) => row[predicts(rule, row.cues)].winner === "cowboy").length;
  return {flips: flips.length, correct, alwaysRide: rideFlips, alwaysFight: flips.length - rideFlips, branches, winsFollowing,
    winsAlwaysRide: rows.filter((row) => row.ride.winner === "cowboy").length, winsAlwaysFight: rows.filter((row) => row.fight.winner === "cowboy").length};
}

// Pre-registered support rule for the holdout (README.md): at least 5 clean reversals, the cue right
// in at least 2/3 of them, and right in strictly more of them than either constant rule.
export const supported = (s) => s.flips >= 5 && s.correct * 3 >= s.flips * 2 && s.correct > s.alwaysRide && s.correct > s.alwaysFight;
