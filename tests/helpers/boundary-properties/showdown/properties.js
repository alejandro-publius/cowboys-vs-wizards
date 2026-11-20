// The seven Showdown engine properties of docs/design/showdown-integration-kiro-brief.md
// ("Property tests worth writing"), checked over generated legal play (generate.js).
// Each property: check(input, engine, categories) throws a Violation on failure and adds
// the boundary categories it reached; makeInput(rng) builds one case from its seeded stream.
import { EFFECTS, cardOf, typeOf } from "../../../../src/game/showdown/cards.js";
import { Violation, need } from "../invariants.js";
import { caseRng } from "../rng.js";
import { ENGINE } from "./engine.js";
import { SIDE_NAMES, generateInput, startOf, walk } from "./generate.js";

const json = JSON.stringify;
const sameAction = (a, b) => json(a) === json(b);
const isDraw = (event, side) => (event.type === "draw" || event.type === "burn") && event.side === side;

// Actions that are not in `legal` but sit next to it: a moved slot or target, another copy of
// the same card, a card from the wrong zone or side, an extra field, an unknown type.
export function nearMisses(state, legal, engine) {
  const listed = new Set(legal.map((action) => json(action)));
  const own = state.sides[state.active];
  const other = state.sides[engine.opponent(state.active)];
  const out = [];
  const add = (tag, action) => { if (!listed.has(json(action))) out.push([tag, action]); };
  for (const action of legal) {
    if ("slot" in action) {
      add("slot", { ...action, slot: (action.slot + 1) % engine.BOARD_SIZE });
      add("slot-range", { ...action, slot: engine.BOARD_SIZE });
    }
    if ("target" in action) add("target", { ...action, target: action.target === "base" ? 0 : "base" });
    if (action.type === "summon") add("tributes", { ...action, tributes: action.tributes.length ? action.tributes.slice(1) : [0] });
    if ("cardId" in action) {
      const copy = own.hand.find((id) => id !== action.cardId && typeOf(id) === typeOf(action.cardId));
      if (copy) add("second-copy", { ...action, cardId: copy });
      if (other.hand.length) add("other-hand", { ...action, cardId: other.hand[0] });
      if (own.deck.length) add("own-deck", { ...action, cardId: own.deck[0] });
    }
    add("extra-field", { ...action, extra: 1 });
  }
  add("unknown-type", { type: "draw" });
  return out;
}

// ---------------------------------------------------------------- SP1
function checkPure(input, engine, seen) {
  walk(input, engine, {
    onStep({ step, before, beforeJson, legal, action }) {
      need(json(before) === beforeJson, "input-mutated", () => `step ${step}: applyAction(${json(action)}) changed its input state`);
      seen.add(`applied:${action.type}`);
      // The refused path must leave its input alone too.
      for (const [tag, miss] of nearMisses(before, legal, engine).slice(0, 4)) {
        try { engine.applyAction(before, miss); } catch { /* refused, as property 2 requires */ }
        need(json(before) === beforeJson, "input-mutated", () => `step ${step}: refused ${tag} ${json(miss)} changed its input state`);
        seen.add("refused-input-unchanged");
      }
    },
  });
}

// ---------------------------------------------------------------- SP2
function checkLegal(input, engine, seen) {
  walk(input, engine, {
    onStep({ step, before, legal }) {
      for (const action of legal) {
        try { engine.applyAction(before, action); } catch (error) {
          throw new Violation("legal-throws", `step ${step}: listed ${json(action)} threw ${error.message}`);
        }
      }
      seen.add("every-listed-action-applied");
      for (const [tag, miss] of nearMisses(before, legal, engine)) {
        let threw = false;
        try { engine.applyAction(before, miss); } catch { threw = true; }
        need(threw, "unlisted-applied", () => `step ${step}: ${tag} ${json(miss)} is not in legalActions but applied`);
        seen.add(`refused:${tag}`);
      }
    },
  });
}

// ---------------------------------------------------------------- SP3
// Limits: Base 0..its starting orbs; hand 0..HAND_CAP; traps 0..TRAP_SLOTS; a troop on the
// board 1..its starting orbs plus its gear's orbs (0 orbs means it has left the board). A boss
// (id ending -0) starts with the orbs its bounty hunt gives it; any other troop with its card's.
const bossOrbs = (options) => Object.fromEntries(Object.values({ ...options.opening, ...options.arrivals }).flat()
  .map(({ type, health }) => [`${type}-0`, health]));

function checkBoundsOf(state, engine, label, seen, bosses) {
  const within = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;
  for (const name of SIDE_NAMES) {
    const side = state.sides[name];
    need(within(side.base, 0, side.baseMax), "bounds", () => `${label}: ${name} Base ${side.base} outside 0..${side.baseMax}`);
    need(within(side.hand.length, 0, engine.HAND_CAP), "bounds", () => `${label}: ${name} hand ${side.hand.length}`);
    need(within(side.traps.length, 0, engine.TRAP_SLOTS), "bounds", () => `${label}: ${name} traps ${side.traps.length}`);
    need(side.board.length === engine.BOARD_SIZE, "bounds", () => `${label}: ${name} board length ${side.board.length}`);
    for (const troop of side.board.filter(Boolean)) {
      const start = bosses[troop.cardId] ?? cardOf(troop.cardId).health;
      const max = start + troop.gear.reduce((sum, id) => sum + EFFECTS[cardOf(id).effect].orbs, 0);
      need(within(troop.health, 1, max), "bounds", () => `${label}: ${name} ${troop.cardId} has ${troop.health} orbs, limit 1..${max}`);
      if (troop.health === 1) seen.add("troop-one-orb");
      if (troop.health > start) seen.add("troop-over-start-orbs-by-gear");
      if (troop.cardId in bosses) seen.add("boss-on-board");
    }
    if (side.base === 0) seen.add("base-zero");
    if (side.hand.length === engine.HAND_CAP) seen.add("hand-at-cap");
    if (side.hand.length === 0) seen.add("hand-empty");
    if (side.traps.length === engine.TRAP_SLOTS) seen.add("traps-full");
  }
}

function checkBounds(input, engine, seen) {
  const bosses = bossOrbs(input.options);
  walk(input, engine, {
    onStart: (state) => checkBoundsOf(state, engine, "deal", seen, bosses),
    onStep({ step, before, state, events }) {
      for (const event of events) {
        if (event.type === "burn" || event.type === "fatigue") seen.add(event.type);
        if (event.type === "attack" && event.baseDamage > before.sides[engine.opponent(event.side)].base) seen.add("base-overkill");
      }
      checkBoundsOf(state, engine, `step ${step}`, seen, bosses);
    },
  });
}

// ---------------------------------------------------------------- SP4
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { out.push(key); strings(item, out); }
  return out;
}

function checkViewOf(state, engine, label, seen) {
  for (const viewer of SIDE_NAMES) {
    const other = state.sides[engine.opponent(viewer)];
    const hidden = new Set([...other.hand, ...other.traps, ...state.sides.cowboy.deck, ...state.sides.wizard.deck]);
    const leaked = strings(engine.viewFor(state, viewer)).filter((text) => hidden.has(text));
    need(leaked.length === 0, "hidden-leak", () => `${label}: viewFor(state, ${viewer}) shows ${leaked.join(", ")}`);
    if (other.hand.length) seen.add("other-hand-held");
    if (other.traps.length) seen.add("other-trap-set");
    if (!state.sides[viewer].deck.length) seen.add("own-deck-empty");
    checkFinishedViewOf(state, engine, label, viewer, seen);
  }
}

// Once `result` is set (the even-fight brief, item 4) the finished view adds the other hand and
// nothing else hidden: the other side's traps and both decks stay out. While the duel runs it is refused.
function checkFinishedViewOf(state, engine, label, viewer, seen) {
  const other = state.sides[engine.opponent(viewer)];
  let view;
  try { view = engine.finishedViewFor(state, viewer); } catch { view = null; }
  if (!state.result) {
    need(view === null, "hidden-leak", () => `${label}: finishedViewFor(state, ${viewer}) answered while the duel runs`);
    return;
  }
  need(view !== null, "finished-hands", () => `${label}: finishedViewFor(state, ${viewer}) refused a finished duel`);
  const hidden = new Set([...other.traps, ...state.sides.cowboy.deck, ...state.sides.wizard.deck]);
  const leaked = strings(view).filter((text) => hidden.has(text));
  need(leaked.length === 0, "hidden-leak", () => `${label}: finishedViewFor(state, ${viewer}) shows ${leaked.join(", ")}`);
  need(json(view.sides.cowboy.hand) === json(state.sides.cowboy.hand) && json(view.sides.wizard.hand) === json(state.sides.wizard.hand),
    "finished-hands", () => `${label}: finishedViewFor(state, ${viewer}) does not show both hands`);
  seen.add("finished-both-hands");
}

function checkView(input, engine, seen) {
  walk(input, engine, {
    onStart: (state) => checkViewOf(state, engine, "deal", seen),
    onStep: ({ step, state }) => checkViewOf(state, engine, `step ${step}`, seen),
  });
}

// ---------------------------------------------------------------- SP5
function checkEvents(input, engine, seen) {
  walk(input, engine, {
    onStep({ step, events }) {
      for (const event of events) {
        const entry = engine.EVENTS[event.type];
        need(entry !== undefined, "event-shape", () => `step ${step}: unknown event ${json(event)}`);
        const keys = Object.keys(event).filter((key) => key !== "type").sort();
        need(json(keys) === json([...entry.fields].sort()), "event-shape", () => `step ${step}: ${event.type} carries ${keys.join(",")}, EVENTS lists ${entry.fields.join(",")}`);
        need(keys.every((key) => event[key] !== undefined), "event-shape", () => `step ${step}: ${event.type} has an undefined field`);
        seen.add(`event:${event.type}`);
      }
    },
  });
}

// ---------------------------------------------------------------- SP6
function checkReplay(input, engine, seen) {
  const trace = [];
  walk(input, engine, {
    onStart: (state) => trace.push({ state: json(state) }),
    onStep: ({ action, state, events }) => trace.push({ action, state: json(state), events: json(events) }),
  });
  let state = startOf(input, engine);
  need(json(state) === trace[0].state, "replay-diverged", "the same seed dealt a different game");
  for (let step = 1; step < trace.length; step++) {
    let applied;
    try { applied = engine.applyAction(state, trace[step].action); } catch (error) {
      throw new Violation("replay-diverged", `replay step ${step - 1}: recorded action refused: ${error.message}`);
    }
    need(json(applied.state) === trace[step].state && json(applied.events) === trace[step].events, "replay-diverged", `replay step ${step - 1} differs`);
    state = applied.state;
  }
  seen.add(trace.length > 1 ? "replayed-actions" : "replayed-deal");
  if (state.result) seen.add(`replayed-to:${state.result.reason}`);
  if (!input.options.first) seen.add("seed-chooses-first");
}

// ---------------------------------------------------------------- SP7
export const BOT_LEVELS = [0, 1, 1.5, 2];
const MAX_REPLANS = 24;

// Walks a level-2 plan on the real state, checking each action against legalActions when it is
// taken. Like playTurn, it plans again after a sprung trap or its own draw. A plan may stop
// before {type: "end"} only right after its own draw (the Scout cut of the fair bot).
function checkPlan(state, engine, seen) {
  const side = state.active;
  let plan = engine.planTurn(state);
  need(Array.isArray(plan) && plan.length > 0, "bot-plan", "planTurn returned no actions");
  if (plan.some((action) => action.type === "summon")) seen.add("plan-summons");
  if (plan.at(-1)?.type !== "end") seen.add("plan-stops-before-end");
  let drew = false;
  let replans = 0;
  let current = state;
  while (!current.result && current.active === side) {
    if (!plan.length) {
      need(drew, "bot-plan", `turn ${current.turn}: the plan stopped before the end of the turn without a draw`);
      seen.add("replan-after-scout-cut");
      plan = engine.planTurn(current);
      need(++replans <= MAX_REPLANS && plan.length > 0, "bot-plan", "replanning did not finish the turn");
    }
    const action = plan.shift();
    need(engine.legalActions(current).some((legal) => sameAction(legal, action)), "bot-illegal",
      () => `turn ${current.turn} ${side}: planned ${json(action)} is not legal`);
    const { state: next, events } = engine.applyAction(current, action);
    current = next;
    drew = events.some((event) => isDraw(event, side));
    if (current.result || current.active !== side) {
      need(plan.length === 0, "bot-illegal", () => `turn ${state.turn} ${side}: ${plan.length} planned actions after the turn ended`);
      break;
    }
    const trap = events.some((event) => event.type === "trap");
    if (trap || drew) {
      seen.add(trap ? "replan-after-trap" : "replan-after-draw");
      plan = engine.planTurn(current);
      need(++replans <= MAX_REPLANS, "bot-plan", "too many replans");
    }
  }
}

function checkBot(input, engine, seen) {
  let { state } = walk(input, engine);
  for (let turn = 0; turn < input.turns && !state.result; turn++) {
    const side = state.active;
    const level = input.levels[side];
    seen.add(`level-${level}`);
    if (level === 2) checkPlan(state, engine, seen);
    let out;
    try { out = engine.playTurn(state, level); } catch (error) {
      throw new Violation("bot-illegal", `turn ${state.turn} ${side} level ${level}: playTurn took an illegal action: ${error.message}`);
    }
    need(out.state.result || out.state.active !== side, "bot-plan", () => `turn ${state.turn} ${side} level ${level}: playTurn left the turn unfinished`);
    state = out.state;
  }
  if (state.result) seen.add("bot-game-finished");
}

const botInput = (rng) => ({
  ...generateInput(rng, { choices: rng.int(24) }),
  levels: { cowboy: rng.pick(BOT_LEVELS), wizard: rng.pick(BOT_LEVELS) },
  turns: 4 + rng.int(12),
});

// Categories every run must reach (a declared category never reached fails the test).
const ACTION_TYPES = ["summon", "spell", "gear", "location", "set", "attack", "cover", "end"];
export const PROPERTIES = [
  { id: "SP1", title: "applyAction never changes the state it is given", cases: 60, check: checkPure,
    categories: [...ACTION_TYPES.map((type) => `applied:${type}`), "refused-input-unchanged"] },
  { id: "SP2", title: "every action in legalActions applies without throwing, and nothing outside it does", cases: 30, check: checkLegal,
    categories: ["every-listed-action-applied", "refused:slot", "refused:slot-range", "refused:target", "refused:tributes", "refused:second-copy", "refused:other-hand", "refused:own-deck", "refused:extra-field", "refused:unknown-type"] },
  { id: "SP3", title: "no orb count, Base or hand size goes below zero or above its limit", cases: 150, check: checkBounds,
    categories: ["base-zero", "base-overkill", "hand-at-cap", "traps-full", "troop-one-orb", "troop-over-start-orbs-by-gear", "boss-on-board", "burn", "fatigue"] },
  { id: "SP4", title: "viewFor(state, side) never shows a card id from the other hand or traps, or from either deck", cases: 80, check: checkView,
    categories: ["other-hand-held", "other-trap-set", "own-deck-empty", "finished-both-hands"] },
  { id: "SP5", title: "every event returned matches its EVENTS entry exactly", cases: 150, check: checkEvents,
    categories: Object.keys(ENGINE.EVENTS).map((type) => `event:${type}`) },
  { id: "SP6", title: "the same seed and the same actions give the same game", cases: 60, check: checkReplay,
    categories: ["replayed-actions", "replayed-to:base", "seed-chooses-first"] },
  { id: "SP7", title: "a bot's plan is legal to the last action, at every level", cases: 60, check: checkBot, makeInput: botInput,
    categories: [...BOT_LEVELS.map((level) => `level-${level}`), "plan-summons", "replan-after-trap", "replan-after-draw", "bot-game-finished"] },
];

export const byId = (id) => PROPERTIES.find((property) => property.id === id);
export const inputFor = (property, index, base) => (property.makeInput ?? generateInput)(caseRng(`showdown-${property.id}`, index, base));

// One recorded case: property id + case index (+ base seed) regenerate the same input.
export function runCase(property, index, { engine = ENGINE, base } = {}) {
  const input = inputFor(property, index, base);
  const seen = new Set();
  property.check(input, engine, seen);
  return { input, seen };
}

// All cases, stopping at the first Violation (annotated with the case index and its input).
export function runAll(property, { engine = ENGINE, base } = {}) {
  const counts = new Map();
  for (let index = 0; index < property.cases; index++) {
    try {
      for (const tag of runCase(property, index, { engine, base }).seen) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    } catch (error) {
      if (error instanceof Violation) { error.index = index; error.input = inputFor(property, index, base); }
      throw error;
    }
  }
  return counts;
}
