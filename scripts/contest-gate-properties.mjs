// fast-check properties for the Showdown release gate (scripts/contest-release-gate.mjs) and
// tests/game/showdown-fast-check.test.js. Each case is a whole game: a legal deal from the
// boundary-property generator (tests/helpers/boundary-properties/showdown/generate.js, picked
// by `setupSeed`), the generated choices legalActions(state)[choice % length], then "end"
// until the game has a result. fast-check shrinks the choices, the setup seed and the optional
// Base override, so a counterexample is a short legal game.
//   G1 the hard turn cap ends every game, and no turn takes more actions than the rules allow
//   G2 no Base, troop or event orb count goes below zero (or a Base above its start)
//   G3 the same seed, options and actions replay the same full game, step for step
//   G4 no viewFor(state, side) or event shows a card id hidden from that side
// Replay one failure: CONTEST_FC_PROPERTY=<id> CONTEST_FC_SEED=<seed> CONTEST_FC_PATH=<path>
//   node scripts/contest-release-gate.mjs fast
// fast-check is a devDependency the coordinator adds (package.json is not owned here).
import fc from "fast-check";
import { Violation, need } from "../tests/helpers/boundary-properties/invariants.js";
import { makeRng } from "../tests/helpers/boundary-properties/rng.js";
import { ENGINE } from "../tests/helpers/boundary-properties/showdown/engine.js";
import { SIDE_NAMES, generateInput } from "../tests/helpers/boundary-properties/showdown/generate.js";

// Recorded fast-check seed. Every run without CONTEST_FC_SEED uses it, so results repeat.
export const FC_SEED = 0x5d0c;
export const MAX_CHOICES = 160;
const json = JSON.stringify;

// One troop, one other card, one trap, then one act per board slot, then "end" (RULEBOOK.md, rules.js header).
export const maxActionsPerTurn = (engine) => 3 + engine.BOARD_SIZE + 1;
// Turns 1..TURN_CAP each end once; nothing is legal after the cap.
export const stepBudget = (engine) => engine.TURN_CAP * maxActionsPerTurn(engine);

export const caseArbitrary = fc.record({
  setupSeed: fc.integer({ min: 0, max: 0x7fffffff }),
  // null keeps the duel's own Bases; a number overrides both (an existing createShowdown option),
  // so long games reach the turn cap.
  baseOrbs: fc.oneof({ arbitrary: fc.constant(null), weight: 3 }, { arbitrary: fc.integer({ min: 1, max: 120 }), weight: 1 }),
  choices: fc.array(fc.nat({ max: 0xffff }), { maxLength: MAX_CHOICES }),
});

export function inputOf({ setupSeed, baseOrbs, choices }) {
  const { seed, duel, options } = generateInput(makeRng(setupSeed), { choices: 0 });
  const opts = structuredClone(options);
  if (baseOrbs !== null) opts.baseOrbs = baseOrbs;
  return { seed, duel, options: opts, choices };
}

// Plays one whole game. onStart(state) sees the deal, onStep({...}) each applied action.
export function playFull(input, engine, { onStart, onStep } = {}) {
  let state = engine.createShowdown(input.seed, structuredClone(input.options));
  const actions = [];
  let step = 0;
  try {
    onStart?.(state);
    while (!state.result) {
      need(step < stepBudget(engine), "no-result", () => `no result after ${step} actions (turn ${state.turn}, cap ${engine.TURN_CAP})`);
      const legal = engine.legalActions(state);
      need(legal.length > 0, "stuck", () => `step ${step}: no legal action and no result at turn ${state.turn}`);
      const action = step < input.choices.length
        ? legal[input.choices[step] % legal.length]
        : legal.find((entry) => entry.type === "end");
      need(action !== undefined, "stuck", () => `step ${step}: "end" is not legal at turn ${state.turn}`);
      const before = state;
      let applied;
      try { applied = engine.applyAction(before, action); } catch (error) {
        throw new Violation("legal-throws", `step ${step}: listed ${json(action)} threw ${error.message}`);
      }
      actions.push(action);
      onStep?.({ step, before, action, state: applied.state, events: applied.events });
      state = applied.state;
      step++;
    }
  } catch (error) {
    if (error instanceof Violation && error.step === undefined) error.step = step;
    throw error;
  }
  return { state, actions };
}

// ---------------------------------------------------------------- G1
function checkTurnCap(input, engine) {
  let turnStart = 0;
  const { state, actions } = playFull(input, engine, {
    onStep({ step, before, action, state: after }) {
      need(after.turn <= engine.TURN_CAP + 1, "turn-cap", () => `step ${step}: turn ${after.turn} passed cap ${engine.TURN_CAP}`);
      need(step - turnStart < maxActionsPerTurn(engine), "turn-actions",
        () => `step ${step}: turn ${before.turn} took more than ${maxActionsPerTurn(engine)} actions`);
      if (action.type === "end") turnStart = step + 1;
      if (after.turn > engine.TURN_CAP) {
        need(after.result?.reason === "turn-cap", "turn-cap", () => `step ${step}: turn ${after.turn} without a turn-cap result (${json(after.result)})`);
        need(engine.legalActions(after).length === 0, "turn-cap", () => `step ${step}: actions still legal after the cap`);
      }
    },
  });
  if (state.result.reason === "turn-cap") {
    const { cowboy, wizard } = state.sides;
    const winner = cowboy.base === wizard.base ? null : cowboy.base > wizard.base ? "cowboy" : "wizard";
    need(state.turn === engine.TURN_CAP + 1, "turn-cap", () => `turn-cap result at turn ${state.turn}`);
    need(state.result.winner === winner, "turn-cap", () => `turn-cap winner ${state.result.winner}, Bases ${cowboy.base}/${wizard.base}`);
  }
  need(actions.length <= stepBudget(engine), "no-result", `${actions.length} actions`);
  return state.result.reason;
}

// ---------------------------------------------------------------- G2
const ORB_FIELDS = ["left", "targetLeft", "attackerLeft", "baseDamage", "hitBack"];

function orbsOf(state, label) {
  for (const name of SIDE_NAMES) {
    const side = state.sides[name];
    need(Number.isInteger(side.base) && side.base >= 0 && side.base <= side.baseMax, "orbs",
      () => `${label}: ${name} Base ${side.base} outside 0..${side.baseMax}`);
    for (const troop of side.board.filter(Boolean)) {
      need(Number.isInteger(troop.health) && troop.health >= 1, "orbs", () => `${label}: ${name} ${troop.cardId} on the board with ${troop.health} orbs`);
    }
  }
}

function checkOrbs(input, engine) {
  playFull(input, engine, {
    onStart: (state) => orbsOf(state, "deal"),
    onStep({ step, state, events }) {
      for (const event of events) for (const field of ORB_FIELDS) {
        // An attack on the Base has no troop target, so rules.js reports targetLeft: null.
        if (event.type === "attack" && event.target === "base" && field === "targetLeft" && event[field] === null) continue;
        if (field in event) need(Number.isInteger(event[field]) && event[field] >= 0, "orbs", () => `step ${step}: ${event.type}.${field} = ${event[field]}`);
      }
      orbsOf(state, `step ${step}`);
    },
  });
}

// ---------------------------------------------------------------- G3
function traceOf(input, engine) {
  const trace = [];
  const { actions } = playFull(input, engine, {
    onStart: (state) => trace.push(json(state)),
    onStep: ({ state, events }) => trace.push(json(state) + json(events)),
  });
  return { trace, actions };
}

function checkReplay(input, engine) {
  const first = traceOf(input, engine);
  const second = traceOf(input, engine);
  const at = first.trace.findIndex((entry, index) => entry !== second.trace[index]);
  need(at < 0 && first.trace.length === second.trace.length, "replay-diverged",
    () => `two plays of one input differ at ${at < 0 ? `length ${first.trace.length}/${second.trace.length}` : at === 0 ? "the deal" : `step ${at - 1}`}`);
  // The recorded actions alone, applied to a fresh deal, give the same game.
  let state = engine.createShowdown(input.seed, structuredClone(input.options));
  need(json(state) === first.trace[0], "replay-diverged", "the same seed dealt a different game");
  first.actions.forEach((action, step) => {
    let applied;
    try { applied = engine.applyAction(state, action); } catch (error) {
      throw new Violation("replay-diverged", `replay step ${step}: recorded ${json(action)} refused: ${error.message}`);
    }
    need(json(applied.state) + json(applied.events) === first.trace[step + 1], "replay-diverged", `replay step ${step} differs`);
    state = applied.state;
  });
  need(state.result !== null, "replay-diverged", "the replayed game has no result");
}

// ---------------------------------------------------------------- G4
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { out.push(key); strings(item, out); }
  return out;
}

const hiddenFrom = (state, viewer, engine) => {
  const other = state.sides[engine.opponent(viewer)];
  return new Set([...other.hand, ...other.traps, ...state.sides.cowboy.deck, ...state.sides.wizard.deck]);
};

function leaksOf(state, engine, label, events = []) {
  for (const viewer of SIDE_NAMES) {
    const hidden = hiddenFrom(state, viewer, engine);
    const view = strings(engine.viewFor(state, viewer)).filter((text) => hidden.has(text));
    need(view.length === 0, "hidden-leak", () => `${label}: viewFor(state, ${viewer}) shows ${[...new Set(view)].join(", ")}`);
    // Events reach both screens, so they may not name a card still hidden from either side.
    for (const event of events) {
      const named = strings(event).filter((text) => hidden.has(text));
      need(named.length === 0, "hidden-leak", () => `${label}: ${event.type} event shows ${viewer} ${named.join(", ")}`);
    }
  }
}

function checkHidden(input, engine) {
  playFull(input, engine, {
    onStart: (state) => leaksOf(state, engine, "deal"),
    onStep: ({ step, state, events }) => leaksOf(state, engine, `step ${step}`, events),
  });
}

export const PROPERTIES = [
  { id: "G1", title: "the hard turn cap ends every game, within the per-turn action limit", check: checkTurnCap },
  { id: "G2", title: "no Base, troop or event orb count goes below zero", check: checkOrbs },
  { id: "G3", title: "the same seed, options and actions replay the same full game", check: checkReplay },
  { id: "G4", title: "no view or event shows a card hidden from that side", check: checkHidden },
];
export const propertyById = (id) => PROPERTIES.find((property) => property.id === id);

// The fast-check property for one check. A Violation (or any throw) fails the case.
export const fcProperty = (property, engine = ENGINE) => fc.property(caseArbitrary, (raw) => { property.check(inputOf(raw), engine); });

// fast-check parameters from the environment, for replaying a reported failure.
export function paramsFromEnv(env = process.env, defaults = {}) {
  const params = { seed: FC_SEED, numRuns: 25, ...defaults };
  if (env.CONTEST_FC_SEED !== undefined) params.seed = Number(env.CONTEST_FC_SEED);
  if (env.CONTEST_FC_PATH) params.path = env.CONTEST_FC_PATH;
  if (env.CONTEST_FC_RUNS !== undefined) params.numRuns = Number(env.CONTEST_FC_RUNS);
  if (!Number.isInteger(params.seed) || !Number.isInteger(params.numRuns) || params.numRuns < 1) {
    throw new TypeError("CONTEST_FC_SEED and CONTEST_FC_RUNS must be integers (runs >= 1)");
  }
  return params;
}

// Runs the properties with fc.check (no throw) and returns one result per property.
// timeLimitMs bounds each property; an interrupted property is reported, not passed silently.
export function runProperties({ engine = ENGINE, ids, seed = FC_SEED, numRuns = 25, path, timeLimitMs } = {}) {
  const chosen = ids?.length ? ids.map((id) => propertyById(id) ?? (() => { throw new RangeError(`unknown property ${id}`); })()) : PROPERTIES;
  return chosen.map((property) => {
    const details = fc.check(fcProperty(property, engine), {
      seed, numRuns, ...(path ? { path } : {}),
      ...(timeLimitMs ? { interruptAfterTimeLimit: timeLimitMs, markInterruptAsFailure: false } : {}),
    });
    return { property, details };
  });
}

// A short, replayable report of one failing property, for hook stderr.
export function formatFailure({ property, details }) {
  const raw = details.counterexample?.[0];
  const error = details.errorInstance ?? details.error;
  const message = String(error?.message ?? error ?? "property returned false").split("\n")[0].slice(0, 300);
  const lines = [`${property.id} FAILED: ${property.title}`, `  ${message}`];
  if (raw) {
    const input = (() => { try { return inputOf(raw); } catch { return null; } })();
    lines.push(`  counterexample: setupSeed=${raw.setupSeed} baseOrbs=${raw.baseOrbs} choices(${raw.choices.length})=${json(raw.choices.slice(0, 12))}${raw.choices.length > 12 ? "..." : ""}`);
    if (input) lines.push(`  deal: createShowdown(${input.seed}, ${json(input.options).slice(0, 200)}) duel=${input.duel}`);
  }
  lines.push(`  shrinks: ${details.numShrinks}; replay: CONTEST_FC_PROPERTY=${property.id} CONTEST_FC_SEED=${details.seed} CONTEST_FC_PATH=${details.counterexamplePath ?? ""} node scripts/contest-release-gate.mjs fast`);
  return lines.join("\n");
}
