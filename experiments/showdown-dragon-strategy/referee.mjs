// EXPERIMENT ONLY. Independent referee for wizard.mjs (Wizard Dragon lines) and counter.mjs (Cowboy
// counterplay). It re-checks their checkpoints on the canonical engine (src/game/showdown/, unchanged)
// and runs three generated properties. Nothing in src/ imports this folder.
//
//   node experiments/showdown-dragon-strategy/referee.mjs            all checks, writes referee-receipt.json
//   node experiments/showdown-dragon-strategy/referee.mjs --print    same checks, prints the receipt only
//
// Checks
//   R1 reachability: each wizard-cases.json prefix replays with applyAction from createShowdown, and each
//      turn of it equals what the canonical playTurn(state, 2) does from that turn's start (both seats).
//   R2 matched alternatives: both lines start from one state (same hash, same deck orders); the first
//      action of each is in legalActions; after the forced actions the rest equals canonical playTurn;
//      the replayed results equal the receipts.
//   P1 no hidden reads (generated): planTurn gives the same plan when the opponent's hand, deck and traps,
//      the seed and the planner's own deck order are re-dealt. Failures are shrunk to the smallest
//      (turn, seed). A fault-injected planner that reads the opponent's hand is run through the same
//      property and shrinker, to show the property can fail.
//   P2 counter policy vs engine planner (generated): counter.mjs's Cowboy policy (planTurn on a state
//      rebuilt from viewFor) against planTurn on the real state. A difference is shrunk and explained.
//   P3 Dragon entry and Sweep (generated games): the bounty Dragon (wizard-dragon-0) lands inside an `end`
//      action with no tribute and rests; a hand Dragon needs a summon with 2 tributes and is ready; a
//      Sweep never changes a Base (Base loss equals the fight's own baseDamage), and an attack on a Base
//      never sweeps.
import {readFileSync, writeFileSync} from "node:fs";
import {applyAction, createShowdown, legalActions, opponent, planTurn, playTurn, random} from "../../src/game/showdown/rules.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {cardOf, tributes} from "../../src/game/showdown/cards.js";
import {options, replay} from "./wizard.mjs";

const FIXTURE = new URL("./wizard-cases.json", import.meta.url);
const RECEIPT = new URL("./referee-receipt.json", import.meta.url);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isLegal = (state, action) => legalActions(state).some((legal) => same(legal, action));
const LEVEL = 2; // hunt 5 and open range both use the level-2 planner

// FNV-1a over the JSON of the full state (decks and hands included): equal hashes = same deal and position.
function hash(value) {
  let h = 0x811c9dc5;
  for (const char of JSON.stringify(value)) h = Math.imul(h ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

// One turn with per-action events, the same loop as playTurn(state, 2). `turnByTurn` checks it equals playTurn.
function stepTurn(state, forced = []) {
  const side = state.active;
  const steps = [];
  let plan = [...forced];
  let free = !forced.length;
  if (free) plan = planTurn(state);
  while (!state.result && state.active === side) {
    if (!plan.length) { plan = planTurn(state); free = true; }
    const action = plan.shift();
    const before = state;
    const applied = applyAction(state, action);
    state = applied.state;
    steps.push({action, events: applied.events, before});
    if (!free && !plan.length) continue;
    if (free && applied.events.some((e) => e.type === "trap" || ((e.type === "draw" || e.type === "burn") && e.side === side))) plan = planTurn(state);
  }
  return {state, steps};
}

function playOut(state) {
  while (!state.result) state = playTurn(state, LEVEL).state;
  return {winner: state.result.winner, reason: state.result.reason, endTurn: state.turn, bases: {cowboy: state.sides.cowboy.base, wizard: state.sides.wizard.base}};
}

// ---- R1 + R2 ----
function checkCase(c) {
  const out = {id: c.id, mode: c.mode, seed: c.seed, prefixActions: c.prefix.length, rotation: c.rotation};
  // R1: replay turn by turn and compare each turn with canonical playTurn from that turn's start.
  let state = createShowdown(c.seed, options(c.mode));
  let i = 0;
  const turns = [];
  while (i < c.prefix.length) {
    const start = state;
    const side = state.active;
    const actions = [];
    while (i < c.prefix.length && state.active === side) {
      if (!isLegal(state, c.prefix[i])) throw new Error(`${c.id}: prefix action ${i} illegal`);
      state = applyAction(state, c.prefix[i]).state;
      actions.push(c.prefix[i++]);
    }
    turns.push({turn: start.turn, side, actions: actions.length, equalsPlayTurn: same(playTurn(start, LEVEL).state, state)});
  }
  out.r1 = {legal: true, turns: turns.length, everyTurnEqualsCanonicalPlayTurn2: turns.every((t) => t.equalsPlayTurn), mismatches: turns.filter((t) => !t.equalsPlayTurn)};
  const fromReplay = replay(c.mode, c.seed, c.prefix).state;
  out.r1.matchesWizardReplay = same(fromReplay, state);
  out.r1.checkpoint = {turn: state.turn, active: state.active, stateHash: hash(state), wizardViewHash: hash(viewFor(state, "wizard"))};
  // R2: both lines from the same state.
  const lines = c.lines.map((line) => {
    const forced = line.name === "planner" ? [] : line.forced;
    const firstLegal = isLegal(state, line.script[0]);
    let s = state;
    for (const action of forced) s = applyAction(s, action).state;
    const rest = line.script.slice(forced.length);
    let r = s;
    for (const action of rest) r = applyAction(r, action).state;
    const restIsPolicy = s.active !== state.active || s.result ? rest.length === 0 : same(playTurn(s, LEVEL).state, r);
    const result = playOut(r);
    const receipt = c.receipt.lines.find((each) => each.name === line.name);
    return {name: line.name, firstAction: line.script[0], firstActionLegal: firstLegal, forced: forced.length, restIsCanonicalPlayTurn2: restIsPolicy,
      afterTurnDecks: {cowboy: hash(r.sides.cowboy.deck), wizard: hash(r.sides.wizard.deck)}, result,
      matchesReceipt: receipt.result.winner === result.winner && receipt.endTurn === result.endTurn};
  });
  out.r2 = {sameStartState: true, lines};
  return out;
}

// ---- generated states ----
const MODES = ["hunt5", "open"];
function stateAt(mode, seed, turn) {
  let state = createShowdown(seed, options(mode));
  while (!state.result && state.turn < turn) state = playTurn(state, LEVEL).state;
  return state.result ? null : state;
}

// Re-deal everything the active side cannot see, plus its own deck order and the seed.
function redeal(state, salt) {
  const next = structuredClone(state);
  const rng = random(salt);
  const shuffle = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const enemy = next.sides[opponent(state.active)];
  const pool = shuffle([...enemy.hand, ...enemy.deck, ...enemy.traps]);
  enemy.hand = pool.splice(0, enemy.hand.length);
  enemy.traps = pool.splice(0, enemy.traps.length);
  enemy.deck = pool;
  shuffle(next.sides[state.active].deck);
  next.seed = (state.seed + 7919 * (salt + 1)) >>> 0;
  return next;
}

// Fault injection: a planner that peeks at the opponent's hand (holds back a summon if it holds a Hex).
const leakyPlan = (state) => {
  const plan = planTurn(state);
  return state.sides[opponent(state.active)].hand.some((id) => id.startsWith("wizard-hex") || id.startsWith("cowboy-bear-trap")) ? plan.filter((a) => a.type !== "summon") : plan;
};

function hiddenReadProperty(plan, cases) {
  const failures = [];
  let checked = 0;
  for (const {mode, seed, turn} of cases) {
    const state = stateAt(mode, seed, turn);
    if (!state) continue;
    for (let salt = 0; salt < 3; salt++) {
      checked += 1;
      if (!same(plan(state), plan(redeal(state, salt)))) { failures.push({mode, seed, turn, salt}); break; }
    }
  }
  return {checked, failures};
}

// Shrinker: smallest turn first, then smallest seed, keeping the mode and salt that failed.
function shrink(plan, failure) {
  const fails = (mode, seed, turn) => {
    const state = stateAt(mode, seed, turn);
    return state && [0, 1, 2].some((salt) => !same(plan(state), plan(redeal(state, salt))));
  };
  let {mode, seed, turn} = failure;
  const path = [{seed, turn}];
  for (let t = 1; t < turn; t++) if (fails(mode, seed, t)) { turn = t; path.push({seed, turn}); break; }
  for (let s = 0; s < seed; s++) if (fails(mode, s, turn)) { seed = s; path.push({seed, turn}); break; }
  const state = stateAt(mode, seed, turn);
  return {mode, seed, turn, active: state.active, path, opponentHand: state.sides[opponent(state.active)].hand};
}

// counter.mjs's Cowboy policy, copied verbatim (publicState + planTurn) so it can be compared.
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

function counterPolicyProperty(cases) {
  const diffs = [];
  let checked = 0;
  for (const {mode, seed, turn} of cases) {
    if (mode !== "hunt5") continue;
    const state = stateAt(mode, seed, turn);
    if (!state || state.active !== "cowboy") continue;
    checked += 1;
    const a = planTurn(state);
    const b = planTurn(publicState(state));
    if (!same(a, b)) diffs.push({seed, turn, engine: a, counter: b});
  }
  if (!diffs.length) return {checked, diffs: 0};
  // Shrink: smallest turn, then smallest seed with a difference.
  const differs = (seed, turn) => { const s = stateAt("hunt5", seed, turn); return s && s.active === "cowboy" && !same(planTurn(s), planTurn(publicState(s))); };
  let {seed, turn} = diffs[0];
  for (let t = 1; t < turn; t += 2) if (differs(seed, t)) { turn = t; break; }
  for (let s = 0; s < seed; s++) if (differs(s, turn)) { seed = s; break; }
  const state = stateAt("hunt5", seed, turn);
  // Which zone explains it: put the real own deck back into the rebuilt state.
  const rebuilt = publicState(state);
  rebuilt.sides.cowboy.deck = [...state.sides.cowboy.deck];
  const ownDeckExplains = same(planTurn(state), planTurn(rebuilt));
  return {checked, diffs: diffs.length, firstSeeds: diffs.slice(0, 8).map((d) => `s${d.seed}-t${d.turn}`),
    shrunk: {seed, turn, engine: planTurn(state), counter: planTurn(publicState(state)), cowboyHand: state.sides.cowboy.hand,
      restoringOwnDeckOrderMakesThemEqual: ownDeckExplains}};
}

// ---- P3: Dragon entry and Sweep over generated games ----
function dragonAndSweep(games) {
  const tally = {games: 0, bountyLandings: 0, handDragonSummons: 0, sweepAttacks: 0, sweptTroops: 0, sweepsWithCoveredVictim: 0, sweepFightsWithOverflow: 0, baseAttacksBySweeper: 0, violations: []};
  const v = (msg) => { if (tally.violations.length < 10) tally.violations.push(msg); };
  for (const {mode, seed, forceDragon} of games) {
    tally.games += 1;
    let state = createShowdown(seed, options(mode));
    const rng = random(seed + 101);
    while (!state.result && state.turn <= 40) {
      let forced = [];
      if (forceDragon && state.active === "wizard" && rng() < .7) {
        const summon = legalActions(state).find((a) => a.type === "summon" && a.cardId.startsWith("wizard-dragon"));
        if (summon) forced = [summon];
      }
      const {state: after, steps} = stepTurn(state, forced);
      for (const {action, events, before} of steps) {
        for (const e of events.filter((each) => each.type === "summon" && each.cardId.startsWith("wizard-dragon"))) {
          const landed = after.sides.wizard.board.find((t) => t?.cardId === e.cardId) ?? null;
          const tributeEvents = events.filter((each) => each.type === "tribute").length;
          if (e.cardId === "wizard-dragon-0") {
            tally.bountyLandings += 1;
            if (action.type !== "end" || tributeEvents) v(`${mode} s${seed}: bounty Dragon not a free landing (${action.type}, ${tributeEvents} tributes)`);
          } else {
            tally.handDragonSummons += 1;
            if (action.type !== "summon" || action.tributes.length !== 2 || tributeEvents !== 2 || tributes(e.cardId) !== 2) v(`${mode} s${seed}: hand Dragon summon without 2 tributes`);
            if (landed && !landed.ready) v(`${mode} s${seed}: paid Dragon not ready`);
          }
        }
        if (action.type !== "attack") continue;
        const attacker = before.sides[before.active].board[action.slot];
        if (!cardOf(attacker.cardId).keys.includes("sweep")) continue;
        const enemyName = opponent(before.active);
        const baseBefore = before.sides[enemyName].base;
        const stepAfter = applyAction(before, action).state;
        const fight = events.find((e) => e.type === "attack");
        const sweep = events.find((e) => e.type === "sweep");
        if (action.target === "base") {
          tally.baseAttacksBySweeper += 1;
          if (sweep) v(`${mode} s${seed}: Base attack swept`);
          continue;
        }
        if (!fight) continue; // stopped by a trap
        tally.sweepAttacks += 1;
        const others = before.sides[enemyName].board.filter((t, slot) => t && slot !== action.target);
        if (others.some((t) => t.cover)) tally.sweepsWithCoveredVictim += 1;
        tally.sweptTroops += sweep?.count ?? 0;
        if ((sweep?.count ?? 0) !== others.length) v(`${mode} s${seed}: sweep count ${sweep?.count} vs ${others.length} other troops`);
        // The Base can only lose the fight's own overflow (clamped at 0); Sweep adds nothing.
        if (stepAfter.sides[enemyName].base !== Math.max(0, baseBefore - fight.baseDamage)) v(`${mode} s${seed}: Base ${baseBefore} -> ${stepAfter.sides[enemyName].base}, fight baseDamage ${fight.baseDamage}`);
        if (fight.baseDamage) tally.sweepFightsWithOverflow += 1;
      }
      if (!same(after, playTurn(state, LEVEL).state) && !forced.length) v(`${mode} s${seed} t${state.turn}: stepTurn differs from playTurn`);
      state = after;
    }
  }
  return tally;
}

// ---- run ----
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
const cases = fixture.cases.map(checkCase);
const generated = [];
for (const mode of MODES) for (let seed = 0; seed < 24; seed++) for (const turn of [2, 3, 4, 5, 6, 7, 8, 10]) generated.push({mode, seed, turn});
// Seeded shuffle of the case order, so the first failure is a random case and the shrinker has work to do.
{ const rng = random(2026); for (let i = generated.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [generated[i], generated[j]] = [generated[j], generated[i]]; } }
const p1 = {property: "planTurn(state) equals planTurn(re-dealt hidden zones), 3 re-deals per state", generator: "modes hunt5/open x seeds 0-23 x turns 2,3,4,5,6,7,8,10, canonical playTurn(…,2) both seats",
  engine: hiddenReadProperty(planTurn, generated)};
p1.engine.result = p1.engine.failures.length ? "FAIL" : "PASS";
p1.engine.shrunk = p1.engine.failures.length ? shrink(planTurn, p1.engine.failures[0]) : null;
const leaky = hiddenReadProperty(leakyPlan, generated);
p1.faultInjection = {mutant: "planTurn that drops summons when the opponent's hidden hand holds a Hex or Bear Trap", checked: leaky.checked, failingStates: leaky.failures.length,
  caught: leaky.failures.length > 0, firstFailure: leaky.failures[0] ?? null, shrunk: leaky.failures.length ? shrink(leakyPlan, leaky.failures[0]) : null};
const p2 = {property: "counter.mjs Cowboy policy (planTurn on viewFor rebuild) equals engine planTurn on the real state", generator: "hunt5 x seeds 0-23 x the Cowboy turns among 2-10 above",
  ...counterPolicyProperty(generated)};
const games = [];
for (let seed = 0; seed < 32; seed++) games.push({mode: "hunt5", seed, forceDragon: false}, {mode: "open", seed, forceDragon: true});
const p3 = {property: "bounty Dragon lands free inside `end` and rests; hand Dragon = summon with 2 tributes, ready; Sweep never changes a Base; a Base attack never sweeps",
  generator: "hunt5 seeds 0-31 (canonical bots) + open seeds 0-31 (Wizard forced to summon the Dragon when legal, 70% of its turns, rest canonical)", ...dragonAndSweep(games)};
p3.result = p3.violations.length ? "FAIL" : "PASS";
const receipt = {experiment: "showdown-dragon-strategy/referee", engine: "src/game/showdown (unchanged)", cases, p1, p2, p3};
const text = `${JSON.stringify(receipt, null, 1)}\n`;
if (process.argv[2] === "--print") process.stdout.write(text);
else {
  writeFileSync(RECEIPT, text);
  for (const c of cases) console.log(`${c.id}: R1 legal ${c.r1.legal}, ${c.r1.turns} turns = playTurn(2) ${c.r1.everyTurnEqualsCanonicalPlayTurn2}, checkpoint T${c.r1.checkpoint.turn} ${c.r1.checkpoint.active} #${c.r1.checkpoint.stateHash} | R2 ${c.r2.lines.map((l) => `${l.name}: legal ${l.firstActionLegal}, rest=policy ${l.restIsCanonicalPlayTurn2}, ${l.result.winner} T${l.result.endTurn}, receipt ${l.matchesReceipt}`).join("; ")}`);
  console.log(`P1 engine: ${p1.engine.result} (${p1.engine.checked} re-deals) | fault injection caught ${p1.faultInjection.caught} (${p1.faultInjection.failingStates} failing states), shrunk ${JSON.stringify(p1.faultInjection.shrunk?.path)}`);
  console.log(`P2 counter policy vs engine: ${p2.diffs} differences in ${p2.checked} Cowboy states${p2.shrunk ? `, shrunk to s${p2.shrunk.seed} t${p2.shrunk.turn}, own deck order explains: ${p2.shrunk.restoringOwnDeckOrderMakesThemEqual}` : ""}`);
  console.log(`P3: ${p3.result} | ${p3.games} games, ${p3.bountyLandings} bounty landings, ${p3.handDragonSummons} hand Dragon summons, ${p3.sweepAttacks} sweep fights (${p3.sweptTroops} troops swept, ${p3.sweepsWithCoveredVictim} with a covered victim, ${p3.sweepFightsWithOverflow} with fight overflow to the Base), ${p3.baseAttacksBySweeper} Base attacks by a sweeper`);
}
