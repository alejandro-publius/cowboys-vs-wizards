// EXPERIMENT ONLY. Wizard-side Dragon decision checkpoints for Showdown, played on the canonical
// engine (src/game/showdown/rules.js). It changes no rules, cards, AI or rewards.
//
// A case is replayed from createShowdown(seed, options) by applying `prefix`, a list of engine
// actions in order (both sides, each {type:"end"} included). At the checkpoint it is the Wizards'
// turn; two legal continuations of that turn are compared, then both games are played out with
// the same policy: each side's whole turn is the engine's level-2 planner (planTurn, replanned
// after a sprung trap or the side's own draw, exactly as playTurn(state, 2) does). planTurn plans
// from knowable(state): own hand, public boards, no enemy traps, own deck order hidden.
//
//   node experiments/showdown-dragon-strategy/wizard.mjs --scan          find checkpoints, seeds 0..63
//   node experiments/showdown-dragon-strategy/wizard.mjs --case ID       replay one case, both lines
//   node experiments/showdown-dragon-strategy/wizard.mjs --write         replay all, write wizard-cases.json
import {readFileSync, writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {applyAction, createShowdown, legalActions, planTurn} from "../../src/game/showdown/rules.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {DECKS, tributes} from "../../src/game/showdown/cards.js";
import {duelFor, newSave} from "../../src/game/showdown/progress.js";
import {TRAIL, deckAfter} from "../../src/game/showdown/trail.js";

const FIXTURE = new URL("./wizard-cases.json", import.meta.url);
const SEEDS = Array.from({length: 64}, (_, seed) => seed);

// mode "hunt5": Graveyard Dragon hunt 5 of 5 (level 2, Dragon lands turn 4 with 4 orbs, Wizard Base 4),
// Cowboy deck = the deck after all six Trail duels. mode "open": Open range, both standard DECKS.
export function options(mode) {
  if (mode === "open") return {decks: {cowboy: DECKS.cowboy, wizard: DECKS.wizard}};
  const save = {...newSave(), wins: TRAIL.length, deck: deckAfter(TRAIL.length), hunts: {"graveyard-dragon": 4}};
  return duelFor(save, "hunt:graveyard-dragon").options;
}

// One whole turn by the level-2 planner; returns the actions applied (same loop as playTurn level 2).
function botTurn(state) {
  const side = state.active;
  const actions = [];
  let plan = planTurn(state);
  while (!state.result && state.active === side) {
    if (!plan.length) plan = planTurn(state);
    const action = plan.shift();
    const applied = applyAction(state, action);
    state = applied.state;
    actions.push(action);
    if (state.result || state.active !== side) break;
    if (applied.events.some((e) => e.type === "trap" || ((e.type === "draw" || e.type === "burn") && e.side === side))) plan = planTurn(state);
  }
  return {state, actions};
}

export function replay(mode, seed, prefix) {
  let state = createShowdown(seed, options(mode));
  const events = [];
  for (const action of prefix) {
    const applied = applyAction(state, action);
    state = applied.state;
    events.push(...applied.events);
  }
  return {state, events};
}

// Plays `script` (actions for the current Wizard turn, ending with "end"), then both bots to the end.
function playOut(state, script) {
  const start = state.turn;
  const log = [];
  for (const action of script) {
    const applied = applyAction(state, action);
    state = applied.state;
    log.push(...applied.events);
  }
  const after = snapshot(state);
  while (!state.result) {
    const turn = botTurn(state);
    state = turn.state;
  }
  return {afterTurn: after, result: state.result, endTurn: state.turn, turnsPlayed: state.turn - start, events: log.map(brief), final: snapshot(state)};
}

const troop = (t) => (t ? `${t.cardId.replace(/^(cowboy|wizard)-/, "")}:${t.health}${t.cover ? "c" : ""}` : "-");
function snapshot(state) {
  const side = (name) => ({base: state.sides[name].base, board: state.sides[name].board.map(troop), hand: state.sides[name].hand.length,
    deck: state.sides[name].deck.length, grave: state.sides[name].discard.length, traps: state.sides[name].traps.length});
  return {turn: state.turn, active: state.active, cowboy: side("cowboy"), wizard: side("wizard")};
}
const brief = (e) => [e.type, e.side, e.cardId, e.target, e.targetLeft ?? e.left, e.baseDamage, e.count].filter((x) => x !== undefined).join(" ");

// What the Wizard player sees at the checkpoint (contract.viewFor), compressed.
function wizardSees(state) {
  const view = viewFor(state, "wizard");
  return {turn: view.turn, wizardHand: view.sides.wizard.hand, wizardBoard: view.sides.wizard.board.map(troop), wizardBase: view.sides.wizard.base,
    cowboyBoard: view.sides.cowboy.board.map(troop), cowboyBase: view.sides.cowboy.base, cowboyHand: view.sides.cowboy.handCount,
    cowboyTraps: view.sides.cowboy.trapCount, cowboyGrave: view.sides.cowboy.discard, pendingArrivals: view.arrivals};
}

// Bot game from reset, recording the prefix, stopping when `stop(state)` is true at the start of a Wizard action.
function playUntil(mode, seed, stop) {
  let state = createShowdown(seed, options(mode));
  const prefix = [];
  while (!state.result && state.turn <= 30) {
    if (state.active === "wizard" && stop(state)) return {state, prefix};
    const turn = botTurn(state);
    state = turn.state;
    prefix.push(...turn.actions);
  }
  return null;
}

// Plays the bot's own Wizard turn from the checkpoint (to return as the "planner" line).
const plannerLine = (state) => botTurn(state).actions;

// The alternative line: the finder's forced opening actions, then the planner finishes the same turn.
function complete(state, forced) {
  let next = state;
  for (const action of forced) next = applyAction(next, action).state;
  return next.active === state.active && !next.result ? [...forced, ...botTurn(next).actions] : forced;
}

// Checkpoint finders. `alternative` returns the forced opening of the other Wizard line, or null.
const FINDERS = {
  // Hunt: the Dragon's first attacking turn (it landed by itself last Wizard turn, and rested).
  // Alternative: the Dragon fights a different Cowboy troop than the planner chose (Sweep still fires),
  // or, when the planner did not Sweep, a Sweep attack on the first legal troop target.
  "hunt5-first-sweep": {
    mode: "hunt5",
    stop: (s) => s.sides.wizard.board.some((t) => t && t.cardId === "wizard-dragon-0" && t.arrived < s.turn && !t.attacked)
      && s.sides.cowboy.board.filter(Boolean).length >= 2,
    alternative(state, planned) {
      const slot = state.sides.wizard.board.findIndex((t) => t && t.cardId === "wizard-dragon-0");
      const plannedHit = planned.find((a) => a.type === "attack" && a.slot === slot);
      if (!plannedHit) return null;
      // Keep the planner's actions before the Dragon's attack, swap only the target.
      const before = planned.slice(0, planned.indexOf(plannedHit));
      let at = state;
      for (const action of before) at = applyAction(at, action).state;
      const targets = legalActions(at).filter((a) => a.type === "attack" && a.slot === slot && a.target !== "base" && a.target !== plannedHit.target);
      return targets.length ? [...before, targets[0]] : null;
    },
  },
  // Open range: the Wizard holds the Dragon and can pay the two-tribute summon.
  // Alternative: skip the Dragon; play the planner's turn without the summon if it summoned the Dragon,
  // otherwise summon the Dragon with the first legal pair of tributes; the planner finishes the turn.
  "open-dragon-tribute": {
    mode: "open",
    stop: (s) => s.sides.wizard.hand.some((id) => id.startsWith("wizard-dragon"))
      && legalActions(s).some((a) => a.type === "summon" && a.cardId.startsWith("wizard-dragon")),
    alternative(state, planned) {
      const summonsDragon = planned.some((a) => a.type === "summon" && a.cardId.startsWith("wizard-dragon"));
      if (summonsDragon) {
        // Keep the board: play the first free troop if any; the planner finishes the turn.
        const free = legalActions(state).find((a) => a.type === "summon" && tributes(a.cardId) === 0);
        return free ? [free] : [{type: "end"}];
      }
      return [legalActions(state).find((a) => a.type === "summon" && a.cardId.startsWith("wizard-dragon"))];
    },
  },
};

function scan() {
  const found = [];
  for (const [kind, finder] of Object.entries(FINDERS)) {
    for (const seed of SEEDS) {
      const hit = playUntil(finder.mode, seed, finder.stop);
      if (!hit) continue;
      const planned = plannerLine(hit.state);
      const forced = finder.alternative(hit.state, planned);
      if (!forced) continue;
      const alt = complete(hit.state, forced);
      const a = playOut(hit.state, planned);
      const b = playOut(hit.state, alt);
      found.push({kind, seed, turn: hit.state.turn, prefixLength: hit.prefix.length, planned: a.result.winner, alt: b.result.winner,
        plannedTurns: a.endTurn, altTurns: b.endTurn});
      console.log(JSON.stringify(found.at(-1)));
    }
  }
  return found;
}

function runCase(c) {
  const {state} = replay(c.mode, c.seed, c.prefix);
  if (state.active !== "wizard" || state.turn !== c.rotation.turn) throw new Error(`${c.id}: checkpoint mismatch at turn ${state.turn} ${state.active}`);
  const legal = legalActions(state);
  for (const line of c.lines) for (const action of line.script) {
    if (!legal.some((l) => JSON.stringify(l) === JSON.stringify(action)) && action.type !== "end" && line.script.indexOf(action) === 0) {
      throw new Error(`${c.id}: first action of ${line.name} not legal at checkpoint`);
    }
  }
  return {sees: wizardSees(state), legal, lines: c.lines.map((line) => ({name: line.name, ...playOut(state, line.script)}))};
}

// Builds a fixture case for finder `kind` at `seed`: the prefix from reset and the two Wizard lines.
function emit(kind, seed, id) {
  const finder = FINDERS[kind];
  const hit = playUntil(finder.mode, seed, finder.stop);
  const planned = plannerLine(hit.state);
  return {id, mode: finder.mode, seed, kind, prefix: hit.prefix, rotation: {first: hit.state.first, turn: hit.state.turn, active: hit.state.active},
    command: `node experiments/showdown-dragon-strategy/wizard.mjs --case ${id}`,
    lines: [{name: "planner", script: planned}, {name: "alternative", forced: finder.alternative(hit.state, planned), script: complete(hit.state, finder.alternative(hit.state, planned))}]};
}

const args = process.argv.slice(2);
const main = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (!main) { /* imported: replay(), options() only */ }
else if (args[0] === "--scan") scan();
else if (args[0] === "--emit") console.log(JSON.stringify(emit(args[1], Number(args[2]), args[3])));
else if (args[0] === "--case" || args[0] === "--write") {
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const pick = args[0] === "--case" ? fixture.cases.filter((c) => c.id === args[1]) : fixture.cases;
  if (!pick.length) throw new Error(`no case ${args[1]}`);
  for (const c of pick) {
    const out = runCase(c);
    if (args[0] === "--write") c.receipt = {sees: out.sees, legalCount: out.legal.length, lines: out.lines.map(({events, final, ...rest}) => ({...rest, wizardTurnEvents: events, final}))};
    else console.log(JSON.stringify({id: c.id, ...out}, null, 1));
  }
  if (args[0] === "--write") writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 1)}\n`);
} else console.log("usage: --scan | --case ID | --write");
