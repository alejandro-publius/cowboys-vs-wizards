// EXPERIMENT ONLY. Held-out search against the seed-3 C5 Ranger claim (counter.mjs `s3-C5-dragon-resting`).
// Canonical engine in src/game/showdown/ unchanged; nothing in src/ imports this file. Existing experiment
// files are read, never written.
//
//   node experiments/showdown-dragon-strategy/rival-search.mjs           # seeds 64-127, writes rival-cases.json
//   node experiments/showdown-dragon-strategy/rival-search.mjs --print   # same, prints the JSON only
//
// Claim under test (seed 3, hunt 5, Cowboy turn 5, Dragon resting): after the policy's own card plays,
// "Ranger attacks the resting Dragon" wins (C T15) where the policy's pick, "Ranger attacks the Jack", loses (W T10).
// Held-out protocol: hunt 5 seeds 64-127 ascending (disjoint from 0-63 used by every earlier script). For each
// seed the same pair is built exactly as counter.mjs builds it: same public-view Cowboy policy, same unchanged
// Wizard bot, same C5 picker (A = first legal attack on the bounty Dragon, B = first legal attack on the Base or a
// non-Dragon troop), both lines from one reachable state. A seed is a counterexample when the visible conditions
// the README names for the claim hold (A's attacker survives the hit-back, or a Cowboy trap is set) and yet A loses
// while the opposite choice B wins.
import {createHash} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";
import {applyAction, legalActions, planTurn, playTurn, createShowdown, attackOf, attackOutcome, random, opponent} from "../../src/game/showdown/rules.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {cardOf} from "../../src/game/showdown/cards.js";
import {BOUNTIES, deckProblems, duelFor, newSave} from "../../src/game/showdown/progress.js";
import {deckAfter} from "../../src/game/showdown/trail.js";

const OUT = new URL("./rival-cases.json", import.meta.url);
const COUNTER = new URL("./counter-output.json", import.meta.url);
const FROM = 64, TO = 127, HUNT = 5, TURN = 5;
const BOUNTY = BOUNTIES.find((each) => each.id === "graveyard-dragon");
const DRAGON = "wizard-dragon-0";

// ---- copied verbatim from counter.mjs (encounter, publicState, cowboyTurn, advanceTo, playOut core) ----
const TRAIL_DECK = deckAfter(6);
const collection = Object.fromEntries(Object.entries(TRAIL_DECK).filter(([type]) => !["cowboy-sheriff", "cowboy-billy"].includes(type)));
const trailSave = (hunt) => ({...newSave(), wins: 6, collection, deck: TRAIL_DECK, hunts: {[BOUNTY.id]: hunt - 1}});
function encounter(seed, hunt, deck) {
  const save = trailSave(hunt);
  const problems = deckProblems(save, deck);
  if (problems.length) throw new Error(problems.join(" "));
  const duel = duelFor(save, `hunt:${BOUNTY.id}`, deck);
  return {duel, state: createShowdown(seed, duel.options)};
}
function publicState(state) {
  const view = viewFor(state, "cowboy");
  const fill = (n, id) => Array.from({length: n}, (_, i) => `${id}-${900 + i}`);
  const side = (name) => {
    const {handCount, deckCount, trapCount, hand, traps, ...open} = view.sides[name];
    return {...open, hand: hand ?? fill(handCount, "wizard-skeleton"), traps: traps ?? [],
      deck: fill(deckCount, name === "cowboy" ? "cowboy-sheriff" : "wizard-skeleton")};
  };
  const {viewer, sides, ...table} = view;
  return {...table, seed: null, sides: {cowboy: side("cowboy"), wizard: side("wizard")}};
}
const cowboyPlan = (state) => planTurn(publicState(state));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function cowboyTurn(state, forced = null) {
  const events = [];
  const actions = [];
  forced = forced && !Array.isArray(forced) ? [forced] : forced;
  let plan = forced ? [...forced] : cowboyPlan(state);
  while (!state.result && state.active === "cowboy") {
    if (!plan.length) plan = cowboyPlan(state);
    const action = plan.shift();
    if (!legalActions(state).some((legal) => same(legal, action))) {
      if (forced) throw new Error(`forced action not legal: ${JSON.stringify(action)}`);
      plan = cowboyPlan(state); continue;
    }
    const applied = applyAction(state, action);
    state = applied.state;
    actions.push(action);
    events.push(...applied.events);
    // Deviation from counter.mjs: do not re-plan once the forced move has ended the game (counter.mjs never hit
    // this on seeds 0-19; held-out seeds can end the game with a forced Base attack, and planTurn has no plan then).
    if (forced && actions.length === forced.length) { plan = state.result ? [] : cowboyPlan(state); forced = null; }
    else if (applied.events.some((e) => e.type === "trap" || ((e.type === "draw" || e.type === "burn") && e.side === "cowboy"))) plan = cowboyPlan(state);
  }
  return {state, events, actions};
}
function advanceTo(state, level, turn) {
  while (!state.result && !(state.active === "cowboy" && state.turn === turn)) {
    state = state.active === "cowboy" ? cowboyTurn(state).state : playTurn(state, level).state;
  }
  return state;
}
// C5 picker from counter.mjs CHECKPOINTS[1].
const isDragon = (s, slot) => typeof slot === "number" && s.sides.wizard.board[slot]?.cardId === DRAGON;
const pickA = (s, legal) => legal.find((a) => a.type === "attack" && isDragon(s, a.target));
const pickB = (s, legal) => legal.find((a) => a.type === "attack" && (a.target === "base" || (typeof a.target === "number" && !isDragon(s, a.target))));

// ---- this script ----
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);
const name = (id) => cardOf(id).name;
const boardText = (state, side) => state.sides[side].board.map((t) => (t ? `${name(t.cardId)} ${attackOf(state, t)}/${t.health}${t.cover ? " cover" : ""}${t.arrived === state.turn && !t.ready ? " resting" : ""}` : "-")).join(" | ");
const describe = (s, a) => a.type !== "attack" ? JSON.stringify(a)
  : `${name(s.sides.cowboy.board[a.slot].cardId)} (slot ${a.slot}) attacks ${a.target === "base" ? "Wizard Base" : `${name(s.sides.wizard.board[a.target].cardId)} (slot ${a.target})`}`;

// Plays a line to the end; returns result plus the public trace for the next few turns.
function line(at, level, forced) {
  let state = at;
  const trace = [];
  let first = true;
  while (!state.result) {
    const turn = state.turn, side = state.active;
    const played = side === "cowboy" ? cowboyTurn(state, first ? forced : null) : playTurn(state, level);
    if (side === "cowboy") first = false;
    state = played.state;
    if (trace.length < 6) trace.push({turn, side, bases: {cowboy: state.sides.cowboy.base, wizard: state.sides.wizard.base},
      cowboyBoard: boardText(state, "cowboy"), wizardBoard: boardText(state, "wizard"), dragonOnBoard: state.sides.wizard.board.some((t) => t?.cardId === DRAGON)});
  }
  return {winner: state.result.winner, reason: state.result.reason, endTurn: state.turn, bases: {cowboy: state.sides.cowboy.base, wizard: state.sides.wizard.base}, trace};
}

// Visible facts at the choice (all present in viewFor(state, "cowboy")).
function visible(s, a) {
  const attacker = s.sides.cowboy.board[a.slot];
  const dragon = s.sides.wizard.board[a.target];
  const out = attackOutcome(s, a.slot, a.target);
  return {attacker: name(attacker.cardId), attackerIsRanger: attacker.cardId.startsWith("cowboy-ranger"), attackerAttack: attackOf(s, attacker), attackerHealth: attacker.health,
    dragonAttack: attackOf(s, dragon), dragonHealth: dragon.health, attackerSurvivesHitBack: out.attackerLeft > 0, dragonLeft: out.targetLeft,
    cowboyTrapsSet: s.sides.cowboy.traps.map(name), wizardTrapsFaceDown: s.sides.wizard.traps.length,
    cowboyTroops: s.sides.cowboy.board.filter(Boolean).length, wizardTroops: s.sides.wizard.board.filter(Boolean).length, bases: {cowboy: s.sides.cowboy.base, wizard: s.sides.wizard.base}};
}

// No hidden reads: the pair (prefix, A, B) is unchanged when the Wizard hand, deck and traps and the Cowboy deck order are re-dealt.
function redeal(state, salt) {
  const next = structuredClone(state);
  const rng = random(salt + 1);
  const shuffle = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const enemy = next.sides.wizard;
  const pool = shuffle([...enemy.hand, ...enemy.deck, ...enemy.traps]);
  enemy.hand = pool.splice(0, enemy.hand.length); enemy.traps = pool.splice(0, enemy.traps.length); enemy.deck = pool;
  shuffle(next.sides.cowboy.deck);
  next.seed = (state.seed + 7919 * (salt + 1)) >>> 0;
  return next;
}

function pairAt(seed) {
  const {duel, state} = encounter(seed, HUNT, TRAIL_DECK);
  const at = advanceTo(state, duel.level, TURN);
  if (at.result) return {seed, skipped: `game over before C${TURN} (${at.result.winner} T${at.turn})`};
  const dragon = at.sides.wizard.board.find((t) => t?.cardId === DRAGON);
  if (!dragon) return {seed, skipped: "no bounty Dragon on the board at C5"};
  const choosePair = (s) => {
    const prefix = [];
    let here = s;
    for (const a of cowboyPlan(s)) {
      if (!["summon", "spell", "gear", "location", "set"].includes(a.type)) break;
      prefix.push(a); here = applyAction(here, a).state;
    }
    const legal = legalActions(here);
    return {prefix, here, A: pickA(here, legal), B: pickB(here, legal), policyFirst: cowboyPlan(here)[0]};
  };
  const pick = choosePair(at);
  if (!pick.A || !pick.B) return {seed, skipped: `pair incomplete at C5 (A ${Boolean(pick.A)}, B ${Boolean(pick.B)})`};
  const hiddenStable = [0, 1, 2].every((salt) => { const p = choosePair(redeal(at, salt)); return same([p.prefix, p.A, p.B], [pick.prefix, pick.A, pick.B]); });
  const facts = visible(pick.here, pick.A);
  const lines = {A: line(at, duel.level, [...pick.prefix, pick.A]), B: line(at, duel.level, [...pick.prefix, pick.B])};
  const conditionsHold = facts.attackerSurvivesHitBack || facts.cowboyTrapsSet.length > 0;
  return {seed, stateHash: hash(at), cowboyViewHash: hash(viewFor(at, "cowboy")), atChoiceHash: hash(pick.here),
    sharedPrefix: pick.prefix, A: {action: pick.A, text: describe(pick.here, pick.A), isPolicy: same(pick.A, pick.policyFirst)},
    B: {action: pick.B, text: describe(pick.here, pick.B), isPolicy: same(pick.B, pick.policyFirst)},
    bothLegal: legalActions(pick.here).some((x) => same(x, pick.A)) && legalActions(pick.here).some((x) => same(x, pick.B)),
    hiddenReadFree: hiddenStable, board: {cowboy: boardText(pick.here, "cowboy"), wizard: boardText(pick.here, "wizard")}, visible: facts,
    claimConditionsHold: conditionsHold, result: {A: `${lines.A.winner[0]}${lines.A.endTurn}`, B: `${lines.B.winner[0]}${lines.B.endTurn}`},
    counterexample: conditionsHold && lines.A.winner === "wizard" && lines.B.winner === "cowboy", lines};
}

// Shrink (reduce the counterexample): among all counterexamples keep the one with the fewest visible differences
// from the seed-3 position (attacker card and stats, Dragon stats, the B target's card, trap set, Wizard face-down
// traps, the cards on each board, both Bases), then the lowest seed. Report those differences, and the first turn where the
// two lines' public boards part.
const PROFILE = (p) => ({attacker: p.visible.attacker, attackerStats: `${p.visible.attackerAttack}/${p.visible.attackerHealth}`, dragonStats: `${p.visible.dragonAttack}/${p.visible.dragonHealth}`,
  bTarget: p.B.text.replace(/.* attacks /, "").replace(/ \(slot \d\)/, ""), cowboyTrapSet: p.visible.cowboyTrapsSet.length > 0, wizardTrapsFaceDown: p.visible.wizardTrapsFaceDown,
  cowboyCards: p.board.cowboy.replace(/ \d+\/\d+( resting| cover)*/g, ""), wizardCards: p.board.wizard.replace(/ \d+\/\d+( resting| cover)*/g, ""), cowboyBase: p.visible.bases.cowboy, wizardBase: p.visible.bases.wizard});
function shrink(counterexamples, reference) {
  if (!counterexamples.length) return null;
  const ref = PROFILE(reference);
  const diff = (p) => Object.fromEntries(Object.entries(PROFILE(p)).filter(([k, v]) => v !== ref[k]).map(([k, v]) => [k, {seed3: ref[k], counterexample: v}]));
  const order = counterexamples.map((p) => ({seed: p.seed, differences: Object.keys(diff(p)).length})).sort((x, y) => x.differences - y.differences || x.seed - y.seed);
  const best = counterexamples.find((p) => p.seed === order[0].seed);
  const at = (t) => ({c: t?.cowboyBoard, w: t?.wizardBoard, b: t?.bases});
  const firstSplit = best.lines.A.trace.findIndex((t, i) => !same(at(t), at(best.lines.B.trace[i])));
  return {rule: "fewest visible differences from the seed-3 position, then lowest seed", order, pickedSeed: best.seed, board: best.board,
    pair: {A: `${best.A.text} -> ${best.result.A}`, B: `${best.B.text} -> ${best.result.B}`, policy: best.A.isPolicy ? "A" : best.B.isPolicy ? "B" : "other"},
    visibleDifferencesFromSeed3: diff(best), firstSplit: firstSplit >= 0 ? {A: best.lines.A.trace[firstSplit], B: best.lines.B.trace[firstSplit]} : null};
}

// Seed-3 reference re-built with this script's own code, and checked against counter-output.json.
const ref = pairAt(3);
const counter = JSON.parse(readFileSync(COUNTER, "utf8")).checkpoints.find((c) => c.id === "s3-C5-dragon-resting");
const refMatchesCounter = counter.choices.map((c) => `${c.outcome.result.winner[0]}${c.outcome.turn}`).join(" ") === `${ref.result.A} ${ref.result.B}`;
const pairs = [];
for (let seed = FROM; seed <= TO; seed++) pairs.push(pairAt(seed));
const tested = pairs.filter((p) => !p.skipped);
const counterexamples = tested.filter((p) => p.counterexample);
const shrinkSeed = shrink(counterexamples, ref)?.pickedSeed ?? null;
const tally = (pred) => tested.filter(pred).length;
const out = {experiment: "showdown-dragon-strategy/rival-search", engine: "src/game/showdown (unchanged)", encounter: `hunt:${BOUNTY.id} #${HUNT}, Cowboys first, deckAfter(6)`,
  heldOut: `seeds ${FROM}-${TO} ascending (earlier scripts used 0-63)`, cowboyPolicy: "planTurn on viewFor(cowboy) rebuild (counter.mjs, copied)", wizardPolicy: "playTurn(state, hunt level)",
  claim: {id: "s3-C5-dragon-resting", text: "At C5 with the bounty Dragon resting, the Ranger hitting the Dragon beats the policy's other attack, when the attacker survives the hit-back or a Cowboy trap is set.",
    seed3: {result: ref.result, visible: ref.visible, board: ref.board, matchesCounterOutput: refMatchesCounter}},
  summary: {seeds: pairs.length, tested: tested.length, skipped: pairs.length - tested.length, allBothLegal: tested.every((p) => p.bothLegal), allHiddenReadFree: tested.every((p) => p.hiddenReadFree),
    aWins: tally((p) => p.result.A[0] === "c"), bWins: tally((p) => p.result.B[0] === "c"), flips: tally((p) => p.result.A[0] !== p.result.B[0]),
    conditionsHold: tally((p) => p.claimConditionsHold), conditionsHoldAndAWins: tally((p) => p.claimConditionsHold && p.result.A[0] === "c"),
    counterexamples: counterexamples.map((p) => p.seed),
    rangerSurvivesByTrap: Object.fromEntries([true, false].map((trap) => { const rows = tested.filter((p) => p.visible.attackerIsRanger && p.visible.attackerSurvivesHitBack && (p.visible.cowboyTrapsSet.length > 0) === trap);
      return [trap ? "trapSet" : "noTrap", {pairs: rows.length, aWins: rows.filter((p) => p.result.A[0] === "c").length, bWinsWhereALoses: rows.filter((p) => p.result.A[0] !== "c" && p.result.B[0] === "c").length, seeds: rows.map((p) => `${p.seed}:A=${p.result.A},B=${p.result.B}`)}]; })), firstCounterexample: counterexamples[0]?.seed ?? null},
  shrink: shrink(counterexamples, ref),
  rows: pairs.map((p) => p.skipped ? {seed: p.seed, skipped: p.skipped} : {seed: p.seed, A: p.A.text, B: p.B.text, policy: p.A.isPolicy ? "A" : p.B.isPolicy ? "B" : "other", result: p.result,
    survives: p.visible.attackerSurvivesHitBack, trap: p.visible.cowboyTrapsSet.length > 0, ranger: p.visible.attackerIsRanger, counterexample: p.counterexample, stateHash: p.stateHash}),
  // Full replayable fixtures only for the seed-3 reference and the shrunk counterexample; the rest are in rows.
  cases: [ref, ...counterexamples.filter((p) => p.seed === shrinkSeed)].map(({lines, ...rest}) => ({id: `hunt5-s${rest.seed}-C5-ranger`, ...rest,
    lines: {A: {...lines.A, trace: lines.A.trace.slice(0, 4)}, B: {...lines.B, trace: lines.B.trace.slice(0, 4)}}}))};
const text = `${JSON.stringify(out, null, 1)}\n`;
if (process.argv[2] === "--print") process.stdout.write(text);
else {
  writeFileSync(OUT, text);
  const s = out.summary;
  console.log(`seed 3 reference: A ${ref.result.A} B ${ref.result.B}, matches counter-output ${refMatchesCounter}`);
  console.log(`held-out ${out.heldOut}: tested ${s.tested}/${s.seeds}, legal ${s.allBothLegal}, hidden-read-free ${s.allHiddenReadFree}, A wins ${s.aWins}, B wins ${s.bWins}, flips ${s.flips}, conditions hold ${s.conditionsHold} (A wins ${s.conditionsHoldAndAWins})`);
  console.log(`counterexamples: ${s.counterexamples.join(", ") || "none"}; shrunk to ${out.shrink?.pickedSeed ?? "-"}`);
  for (const r of out.rows) console.log(r.skipped ? `  s${r.seed}: ${r.skipped}` : `  s${r.seed}: A=${r.result.A} B=${r.result.B} policy=${r.policy} survives=${r.survives} trap=${r.trap} ranger=${r.ranger}${r.counterexample ? " COUNTEREXAMPLE" : ""}`);
}
