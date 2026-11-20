// EXPERIMENT ONLY. Cowboy counterplay against the existing Wizard Dragon (Graveyard Dragon bounty).
// Uses the canonical engine in src/game/showdown/ unchanged; no rule, card, AI or reward is changed here.
//
//   node experiments/showdown-dragon-strategy/counter.mjs                # matched checkpoints + deck sample, writes counter-output.json
//   node experiments/showdown-dragon-strategy/counter.mjs --explore 0 9  # print Cowboy decision points around the landing
//
// Wizard side: the unchanged bot, playTurn(state, hunt.level), on the real state and real draws.
// Cowboy side: planTurn (the engine's own planner) run on a state rebuilt from viewFor(state, "cowboy")
// only: Wizard hand and both decks are replaced by placeholders of the visible size, Wizard traps by nothing.
// A forced choice replaces only the first Cowboy action at a checkpoint; everything after it uses the same
// policies, so both branches share the base game, the deck orders and the opponent policy.
import {createHash} from "node:crypto";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {applyAction, legalActions, planTurn, playTurn, createShowdown, attackOf} from "../../src/game/showdown/rules.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {DECKS, cardOf} from "../../src/game/showdown/cards.js";
import {BOUNTIES, deckProblems, duelFor, newSave} from "../../src/game/showdown/progress.js";
import {deckAfter} from "../../src/game/showdown/trail.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
// Referee: the shared contract is committed beside this script (byte-identical copy of ../graywave-dragon-contract.json, same sha256).
const CONTRACT = resolve(here, "contract.json");
const BOUNTY = BOUNTIES.find((each) => each.id === "graveyard-dragon");

// Decks. Baseline: the Trail-complete deck every player holds when the bounty opens.
// Alternate tempo plan, built from that same collection plus basic Sheriffs: no tribute troops at all, so the
// board is never thinned to pay for a summon before or after the Dragon lands.
const TRAIL_DECK = deckAfter(6);
const NO_TRIBUTE_DECK = {"cowboy-sheriff": 8, "cowboy-outrider": 2, "cowboy-covered-wagon": 2, "cowboy-dynamiter": 1,
  "cowboy-deadeye": 1, "cowboy-lasso": 1, "cowboy-bear-trap": 1};
const collection = Object.fromEntries(Object.entries(TRAIL_DECK).filter(([type]) => !["cowboy-sheriff", "cowboy-billy"].includes(type)));
const trailSave = (hunt) => ({...newSave(), wins: 6, collection, deck: TRAIL_DECK, hunts: {[BOUNTY.id]: hunt - 1}});

function encounter(seed, hunt, deck) {
  const save = trailSave(hunt);
  const problems = deckProblems(save, deck);
  if (problems.length) throw new Error(problems.join(" "));
  const duel = duelFor(save, `hunt:${BOUNTY.id}`, deck);
  return {duel, state: createShowdown(seed, duel.options)};
}

// ---- Cowboy policy: public information only ----
function publicState(state) {
  const view = viewFor(state, "cowboy");
  const fill = (n, id) => Array.from({length: n}, (_, i) => `${id}-${900 + i}`);
  const side = (name) => {
    const {handCount, deckCount, trapCount, hand, traps, ...open} = view.sides[name];
    // Placeholder cards only fill counts; the planner scores hand size, never hidden card names.
    return {...open, hand: hand ?? fill(handCount, "wizard-skeleton"), traps: traps ?? [],
      deck: fill(deckCount, name === "cowboy" ? "cowboy-sheriff" : "wizard-skeleton")};
  };
  const {viewer, sides, ...table} = view;
  return {...table, seed: null, sides: {cowboy: side("cowboy"), wizard: side("wizard")}};
}
const cowboyPlan = (state) => planTurn(publicState(state));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One Cowboy turn: optional forced first action, then the public-info plan, re-planned after any reveal.
function cowboyTurn(state, forced = null) {
  const events = [];
  const actions = [];
  // forced: a list of actions played first (the policy's own card plays, then the tested choice).
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
    if (forced && actions.length === forced.length) { plan = cowboyPlan(state); forced = null; }
    else if (applied.events.some((e) => e.type === "trap" || ((e.type === "draw" || e.type === "burn") && e.side === "cowboy"))) plan = cowboyPlan(state);
  }
  return {state, events, actions};
}

const dragonOf = (state) => state.sides.wizard.board.find((t) => t?.cardId === "wizard-dragon-0") ?? null;
const boardText = (state, side) => state.sides[side].board.map((t) => (t ? `${cardOf(t.cardId).name} ${attackOf(state, t)}/${t.health}${t.cover ? " cover" : ""}${t.arrived === state.turn && !t.ready ? " resting" : ""}` : "-")).join(" | ");
const snapshot = (state) => ({turn: state.turn, active: state.active, bases: {cowboy: state.sides.cowboy.base, wizard: state.sides.wizard.base},
  cowboyBoard: boardText(state, "cowboy"), wizardBoard: boardText(state, "wizard"), dragonOrbs: dragonOf(state)?.health ?? null,
  dragonDue: state.arrivals.length > 0, wizardTrapsFaceDown: state.sides.wizard.traps.length, cowboyTraps: state.sides.cowboy.traps.map((id) => cardOf(id).name), cowboyHand: state.sides.cowboy.hand.map((id) => cardOf(id).name)});
const describe = (state, a) => {
  if (a.type === "end") return "end turn";
  if (a.type === "cover") return `${cardOf(state.sides.cowboy.board[a.slot].cardId).name} (slot ${a.slot}) takes cover`;
  if (a.type === "attack") {
    const tgt = a.target === "base" ? (state.sides.wizard.board.some(Boolean) ? "Wizard Base (ride past)" : "Wizard Base") : `${cardOf(state.sides.wizard.board[a.target].cardId).name} (slot ${a.target})`;
    return `${cardOf(state.sides.cowboy.board[a.slot].cardId).name} (slot ${a.slot}) attacks ${tgt}`;
  }
  const extra = a.tributes?.length ? ` paying ${a.tributes.map((s) => cardOf(state.sides.cowboy.board[s].cardId).name).join(" + ")}` : "";
  const target = a.target !== undefined ? ` on ${cardOf(state.sides.wizard.board[a.target].cardId).name}` : a.slot !== undefined ? ` on slot ${a.slot}` : "";
  return `${a.type} ${cardOf(a.cardId).name}${target}${extra}`;
};

// Plays from `state` to the end. checkpoint: {turn, forced} applies one forced first action on that Cowboy turn.
function playOut(state, level, checkpoint = null, trace = null) {
  const sweeps = {count: 0, orbs: 0};
  let firstWizardAfter = null;
  while (!state.result) {
    if (state.active === "cowboy") {
      const forced = checkpoint && state.turn === checkpoint.turn ? checkpoint.forced : null;
      const turn = cowboyTurn(state, forced);
      trace?.push({turn: state.turn, side: "cowboy", actions: turn.actions.map((a, i) => i === 0 ? describe(state, a) : JSON.stringify(a))});
      state = turn.state;
    } else {
      const before = state.turn;
      const played = playTurn(state, level);
      for (const e of played.events) if (e.type === "sweep") { sweeps.count += 1; sweeps.orbs += e.count; }
      trace?.push({turn: before, side: "wizard", events: played.events.filter((e) => ["summon", "attack", "sweep", "raise", "spell", "trap"].includes(e.type))
        .map((e) => `${e.type} ${e.cardId ? cardOf(e.cardId).name : ""}${e.target ? ` -> ${e.target === "base" ? "Base" : cardOf(e.target).name}` : ""}${e.baseDamage ? ` base-${e.baseDamage}` : ""}${e.count ? ` x${e.count}` : ""}`)});
      state = played.state;
      if (checkpoint && !firstWizardAfter && before > checkpoint.turn) firstWizardAfter = snapshot(state);
    }
  }
  return {result: state.result, turn: state.turn, bases: {cowboy: state.sides.cowboy.base, wizard: state.sides.wizard.base},
    dragonSweeps: sweeps, afterNextWizardTurn: firstWizardAfter};
}

// Advances the base game with both policies to the start of Cowboy turn `turn` (all actions unforced).
function advanceTo(state, level, turn) {
  while (!state.result && !(state.active === "cowboy" && state.turn === turn)) {
    state = state.active === "cowboy" ? cowboyTurn(state).state : playTurn(state, level).state;
  }
  return state;
}

// ---- wizard worker's fixture (../graywave-dragon-contract.json): replay its prefixes with the engine ----
const optionsFor = (mode) => (mode === "hunt5" ? encounter(0, 5, TRAIL_DECK).duel.options : {decks: {cowboy: DECKS.cowboy, wizard: DECKS.wizard}});
const levelFor = (mode) => (mode === "hunt5" ? encounter(0, 5, TRAIL_DECK).duel.level : 2);
function fromContract(entry) {
  let state = createShowdown(entry.seed, optionsFor(entry.mode));
  for (const action of entry.prefix) state = applyAction(state, action).state; // throws if any move is illegal here
  if (state.turn !== entry.rotation.turn || state.active !== entry.rotation.active) throw new Error(`${entry.id}: rotation mismatch`);
  // The fixture stops on a Wizard decision; the unchanged Wizard bot plays that turn, then the Cowboy decides.
  return {state: playTurn(state, levelFor(entry.mode)).state, level: levelFor(entry.mode)};
}
const contractCases = () => (existsSync(CONTRACT) ? JSON.parse(readFileSync(CONTRACT, "utf8")).cases : []);
if (process.argv[2] === "--contract") {
  for (const entry of contractCases()) {
    const {state} = fromContract(entry);
    const s = snapshot(state);
    console.log(`${entry.id} -> C${s.turn} bases ${JSON.stringify(s.bases)} | C: ${s.cowboyBoard} | W: ${s.wizardBoard} | hand ${s.cowboyHand.join(", ")} | traps ${s.cowboyTraps} W-traps ${s.wizardTrapsFaceDown}`);
    console.log(`  legal: ${legalActions(state).map((a) => describe(state, a)).join("; ")}`);
    console.log(`  policy: ${cowboyPlan(state).map((a) => describe(state, a)).join(" ; ")}`);
  }
  process.exit(0);
}

// ---- explore: list Cowboy decision points so checkpoints are picked from real states ----
if (process.argv[2] === "--explore") {
  const [from, to] = [Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 9)];
  const hunt = Number(process.env.HUNT ?? 5);
  for (let seed = from; seed <= to; seed++) {
    const {duel, state} = encounter(seed, hunt, TRAIL_DECK);
    const base = playOut(state, duel.level);
    console.log(`seed ${seed}: baseline ${base.result.winner} by ${base.result.reason} on turn ${base.turn}, bases ${JSON.stringify(base.bases)}, sweeps ${JSON.stringify(base.dragonSweeps)}`);
    for (const turn of [3, 5, 7]) {
      const at = advanceTo(state, duel.level, turn);
      if (at.result) break;
      const s = snapshot(at);
      console.log(`  C${turn} bases ${s.bases.cowboy}-${s.bases.wizard} | C: ${s.cowboyBoard} | W: ${s.wizardBoard} | hand ${s.cowboyHand.join(", ")} | policy first: ${describe(at, cowboyPlan(at)[0])}`);
    }
  }
  process.exit(0);
}

// ---- main: matched checkpoints from one base game, then a deck sample ----
const HUNT = 5; // level 2 Wizards, Wizard Base 4, Dragon lands with 4 orbs on Wizard turn 4
const SEED = Number(process.env.SEED ?? 3);
const contract = existsSync(CONTRACT) ? {path: relative(root, CONTRACT), sha256: createHash("sha256").update(readFileSync(CONTRACT)).digest("hex")} : {path: relative(root, CONTRACT), missing: true};

function branchAt(seed, turn, pick, prefixCards = false, start = null) {
  const {duel, state} = encounter(seed, HUNT, TRAIL_DECK);
  const at = start ?? advanceTo(state, duel.level, turn);
  // prefix: the policy's card plays this turn, kept identical in both branches; the choice is the first act after them.
  const prefix = [];
  let here = at;
  if (prefixCards) for (const a of cowboyPlan(at)) {
    if (!["summon", "spell", "gear", "location", "set"].includes(a.type)) break;
    prefix.push(a); here = applyAction(here, a).state;
  }
  const legal = legalActions(here);
  const choices = pick(here, legal);
  return {seed, hunt: HUNT, cowboyTurn: turn, state: snapshot(at), legalMovesAtChoice: legal.map((a) => describe(here, a)),
    policyPlan: cowboyPlan(at).map((a) => JSON.stringify(a)), sharedPrefix: prefix.map((a) => JSON.stringify(a)), atChoice: snapshot(here),
    choices: choices.map(({label, action}) => {
      const trace = [];
      const out = playOut(at, duel.level, {turn, forced: [...prefix, action]}, trace);
      return {label, action: describe(here, action), raw: action, isPolicyChoice: same(action, cowboyPlan(here)[0]), outcome: out, trace: trace.slice(0, 6)};
    })};
}

const CHECKPOINTS = [
  // Before the Dragon lands: develop wide vs develop a tribute body.
  {id: "C3-before-landing", turn: 3, picks: [{label: "A", match: {type: "summon"}, prefer: (a) => a.tributes.length === 0}, {label: "B", match: {type: "summon"}, prefer: (a) => a.tributes.length > 0}]},
  // Dragon on the board, resting: hit the Dragon vs ride past to the Base.
  {id: "C5-dragon-resting", turn: 5, prefixCards: true, picks: [{label: "A", match: {type: "attack"}, prefer: (a, s) => typeof a.target === "number" && s.sides.wizard.board[a.target]?.cardId === "wizard-dragon-0"},
    {label: "B", match: {type: "attack"}, prefer: (a, s) => a.target === "base" || (typeof a.target === "number" && s.sides.wizard.board[a.target]?.cardId !== "wizard-dragon-0")}]},
];

function picker(spec) {
  return (state, legal) => spec.picks.map(({label, match, prefer}) => {
    const action = legal.find((a) => Object.entries(match).every(([k, v]) => a[k] === v) && prefer(a, state));
    return action ? {label, action} : null;
  }).filter(Boolean);
}

// --scan: the same two checkpoint choices on every seed, to find where a choice's result reverses.
if (process.argv[2] === "--scan") {
  for (let seed = Number(process.argv[3] ?? 0); seed <= Number(process.argv[4] ?? 19); seed++) {
    const row = CHECKPOINTS.map((spec) => {
      const cp = branchAt(seed, spec.turn, picker(spec), spec.prefixCards);
      if (cp.choices.length < 2) return `${spec.id}: n/a`;
      return `${spec.id}: ${cp.choices.map((c) => `${c.label}${c.isPolicyChoice ? "*" : ""}=${c.outcome.result.winner[0]}${c.outcome.turn}`).join(" ")}`;
    });
    console.log(`seed ${seed} ${row.join(" | ")}`);
  }
  process.exit(0);
}
{
  // Base game SEED at both checkpoints, then the seeds where the scan showed the C3 result reverse (10, 19)
  // and where hitting the Dragon lost sooner (18).
  const cases = [[SEED, 0], [SEED, 1], [10, 0], [19, 0], [18, 1]];
  const checkpoints = cases.map(([seed, at]) => {
    const spec = CHECKPOINTS[at];
    return {id: `s${seed}-${spec.id}`, ...branchAt(seed, spec.turn, picker(spec), spec.prefixCards)};
  });
  // Reused checkpoint: the wizard worker's hunt5 case, one Wizard turn later, with the C5 choice pair.
  for (const entry of contractCases().filter((each) => each.mode === "hunt5")) {
    const {state} = fromContract(entry);
    checkpoints.push({id: `contract-${entry.id}-C${state.turn}`, fromContract: entry.id, ...branchAt(entry.seed, state.turn, picker(CHECKPOINTS[1]), true, state)});
  }
  const sample = {};
  for (const [name, deck] of [["trail-complete", TRAIL_DECK], ["no-tribute", NO_TRIBUTE_DECK]]) {
    const tally = {cases: 0, cowboyWins: 0, wizardWins: 0, draws: 0, reasons: {}, sweeps: 0, perSeed: []};
    for (let seed = 0; seed < 20; seed++) {
      const {duel, state} = encounter(seed, HUNT, deck);
      const out = playOut(state, duel.level);
      tally.cases += 1;
      tally[out.result.winner === "cowboy" ? "cowboyWins" : out.result.winner === "wizard" ? "wizardWins" : "draws"] += 1;
      tally.reasons[out.result.reason] = (tally.reasons[out.result.reason] ?? 0) + 1;
      tally.sweeps += out.dragonSweeps.count;
      tally.perSeed.push(`${seed}:${out.result.winner?.[0] ?? "d"}${out.turn}`);
    }
    sample[name] = {deck, ...tally};
  }
  const output = {experiment: "showdown-dragon-strategy/counter", engine: "src/game/showdown (unchanged)", encounter: `hunt:${BOUNTY.id} #${HUNT}`,
    cowboyPolicy: "planTurn on viewFor(cowboy) rebuild", wizardPolicy: "playTurn(state, hunt level)", wizardContract: contract, baseSeed: SEED, checkpoints, deckSample: {seeds: "0-19", first: "cowboy", ...sample}};
  writeFileSync(resolve(here, "counter-output.json"), `${JSON.stringify(output, null, 1)}\n`);
  for (const cp of checkpoints) {
    console.log(`${cp.id} seed ${cp.seed} C${cp.cowboyTurn}: bases ${JSON.stringify(cp.state.bases)} W: ${cp.state.wizardBoard} | C: ${cp.state.cowboyBoard} | shared prefix ${cp.sharedPrefix.join(" ") || "none"} | legal ${cp.legalMovesAtChoice.length}`);
    for (const c of cp.choices) console.log(`  ${c.label}${c.isPolicyChoice ? "*" : ""} ${c.action} -> ${c.outcome.result.winner} (${c.outcome.result.reason}) T${c.outcome.turn} bases ${JSON.stringify(c.outcome.bases)} sweeps ${c.outcome.dragonSweeps.count}/${c.outcome.dragonSweeps.orbs} next-W ${c.outcome.afterNextWizardTurn ? `${JSON.stringify(c.outcome.afterNextWizardTurn.bases)} dragon ${c.outcome.afterNextWizardTurn.dragonOrbs}` : "-"}`);
  }
  for (const [name, t] of Object.entries(sample)) console.log(`${name}: ${t.cowboyWins}/${t.cases} Cowboy wins, ${t.draws} draws, reasons ${JSON.stringify(t.reasons)}, sweeps ${t.sweeps} | ${t.perSeed.join(" ")}`);
}
