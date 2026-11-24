// Engine adapter for scripts/referee/history.mjs run: replays one blind duel on an ARCHIVED engine.
//
// history.mjs extracts a revision with `git archive` into a temporary folder and calls
// runDuel(engineRoot, duel). This file loads that folder's own rules.js and cards.js (never the
// checkout's src/game) and frames the replay like one `referee.py --stream` result line, so the
// same JSON pointer reads the referee and both revisions:
//   {seed, engine: {path, actionTypes}, initial, steps: [{accepted, state, error, engineEvents?}], unsupported: [...]}
// engineEvents (accepted steps only) is the archived engine's own event list, outside the referee
// schema. The referee has no value there, so a pointer into it is always judged unsupported; it only
// shows that an event-level defect is reachable on the blind input.
//
// The pinned adapter (scripts/referee/adapter.mjs) stays as frozen. It statically imports the current
// engine, so it cannot replay a past revision; history.mjs refuses it for `run`.
//
// Unsupported historical APIs are explicit, never filled in from current rules:
//   - the revision lacks createShowdown, applyAction or cardOf, or its createShowdown does not deal
//     exactly the counted deck with the requested first side: runDuel throws, and the case is not run;
//   - an action type the revision's applyAction has no branch for: that step and every later step
//     carry only {error}, with no `accepted` or `state`, so any pointer into them reads as missing;
//   - a schema field the revision's state cannot express (no location, gear, cover, `ready` flag or
//     attackOf): the field is omitted from every state and named once in `unsupported`.
// The only translations are the pinned adapter's own (proof/referee/SCHEMA.md version 1): result
// reasons, allowance names, fixed trap slots with setTurn, statuses, rest from the engine's
// `ready`/`arrived` flags, and actions rebuilt in the engine's key order with tributes ascending
// (the engine matches actions by JSON text against its legal list).
import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

export const REFEREE_SCHEMA_VERSION = 1;
export const schema = `showdown-referee/${REFEREE_SCHEMA_VERSION}`;
export const SIDES = Object.freeze(["cowboy", "wizard"]);
export const ACTION_TYPES = Object.freeze(["summon", "spell", "gear", "location", "set", "attack", "cover", "end"]);
// Where a revision keeps its engine: after f44af67 src/game/showdown, before it prototypes/showdown.
export const ENGINE_DIRS = Object.freeze(["src/game/showdown", "prototypes/showdown"]);

export class UnsupportedHistoricalApi extends Error {
  constructor(message) { super(`unsupported-historical-api: ${message}`); this.name = "UnsupportedHistoricalApi"; }
}
const unsupported = (message) => new UnsupportedHistoricalApi(message);

export function locateEngine(engineRoot) {
  for (const rel of ENGINE_DIRS) {
    if (existsSync(join(engineRoot, rel, "rules.js")) && existsSync(join(engineRoot, rel, "cards.js"))) return {rel, dir: join(engineRoot, rel)};
  }
  throw unsupported(`no rules.js and cards.js under ${ENGINE_DIRS.join(" or ")} in ${engineRoot}`);
}

// Action types the revision's applyAction handles. `end` is its fall-through branch, so it is
// present when the legal list offers {type: "end"}.
export function actionTypesIn(source) {
  return ACTION_TYPES.filter((type) => (type === "end"
    ? /\{type: "end"\}/.test(source)
    : new RegExp(`action\\.type === "${type}"`).test(source)));
}

export async function loadEngine(engineRoot) {
  const {rel, dir} = locateEngine(engineRoot);
  const rules = await import(pathToFileURL(join(dir, "rules.js")).href);
  const cards = await import(pathToFileURL(join(dir, "cards.js")).href);
  for (const [name, fn] of [["rules.createShowdown", rules.createShowdown], ["rules.applyAction", rules.applyAction], ["cards.cardOf", cards.cardOf]]) {
    if (typeof fn !== "function") throw unsupported(`${rel} exports no ${name}`);
  }
  return {rel, rules, cards, actionTypes: actionTypesIn(readFileSync(join(dir, "rules.js"), "utf8"))};
}

const typeOfInstance = (id) => id.replace(/-\d+$/, "");
const sorted = (list) => [...list].sort();

// The revision's own constructor with the input's order put in place of its shuffle, as the pinned
// engine.mjs does for the current engine. The opening-hand size is the one this revision dealt.
export function initialState(engine, duel) {
  const {rules, cards, rel} = engine;
  for (const side of SIDES) {
    for (const id of duel.decks[side]) {
      const card = cards.cardOf(id);
      if (!card) throw unsupported(`${id} names no card in ${rel}/cards.js at this revision`);
      if (card.side !== side) throw unsupported(`${id} is a ${card.side} card at this revision`);
    }
  }
  for (const [type, name] of Object.entries(duel.cardNames ?? {})) {
    const card = cards.cardOf(`${type}-1`);
    if (card && card.name !== name) throw unsupported(`cardNames says ${type} is ${JSON.stringify(name)}; this revision prints ${JSON.stringify(card.name)}`);
  }
  const counts = Object.fromEntries(SIDES.map((side) => {
    const c = {};
    for (const id of duel.decks[side]) c[typeOfInstance(id)] = (c[typeOfInstance(id)] ?? 0) + 1;
    return [side, c];
  }));
  let state;
  try { state = rules.createShowdown(duel.seed, {first: duel.first, decks: counts}); }
  catch (error) { throw unsupported(`createShowdown(seed, {first, decks}) threw: ${error.message}`); }
  if (state.first !== duel.first) throw unsupported("createShowdown ignores the `first` option at this revision");
  for (const side of SIDES) {
    const s = state.sides[side];
    const dealt = [...s.hand, ...s.deck];
    if (JSON.stringify(sorted(dealt)) !== JSON.stringify(sorted(duel.decks[side]))) {
      throw unsupported(`createShowdown at this revision does not deal the counted ${side} deck as these instance ids`);
    }
    if (s.board.some(Boolean)) throw unsupported(`createShowdown put troops on the ${side} board before turn 1`);
    const n = s.hand.length;
    s.hand = duel.decks[side].slice(0, n);
    s.deck = duel.decks[side].slice(n);
  }
  return state;
}

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const FIELDS = {
  summon: ["cardId", "tributes"], spell: ["cardId"], gear: ["cardId", "slot"], location: ["cardId"],
  set: ["cardId"], attack: ["slot", "target"], cover: ["slot"], end: [],
};
const OPTIONAL = {spell: ["target"]};

// Same canonical form as the pinned engine.mjs canonicalAction.
export function canonicalAction(input) {
  const malformed = (why) => ({error: `malformed: ${why}`});
  if (!isObject(input) || !Object.hasOwn(FIELDS, input.type)) return malformed("unknown action");
  const {type} = input;
  const allowed = new Set(["type", ...FIELDS[type], ...(OPTIONAL[type] ?? [])]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) return malformed(`${type} has no field ${key}`);
  for (const key of FIELDS[type]) if (input[key] === undefined) return malformed(`${type} needs ${key}`);
  if ("cardId" in input && typeof input.cardId !== "string") return malformed("cardId must be a string");
  if ("slot" in input && !Number.isInteger(input.slot)) return malformed("slot must be an integer");
  if (type === "attack" && !(Number.isInteger(input.target) || input.target === "base")) return malformed("bad attack target");
  if (type === "spell" && input.target !== undefined && !Number.isInteger(input.target)) return malformed("bad spell target");
  if (type === "summon" && !(Array.isArray(input.tributes) && input.tributes.every(Number.isInteger))) return malformed("bad tributes");
  switch (type) {
    case "summon": return {action: {type, cardId: input.cardId, tributes: [...input.tributes].sort((a, b) => a - b)}};
    case "spell": return {action: input.target === undefined ? {type, cardId: input.cardId} : {type, cardId: input.cardId, target: input.target}};
    case "gear": return {action: {type, cardId: input.cardId, slot: input.slot}};
    case "location": case "set": return {action: {type, cardId: input.cardId}};
    case "attack": return {action: {type, slot: input.slot, target: input.target}};
    case "cover": return {action: {type, slot: input.slot}};
    default: return {action: {type: "end"}};
  }
}

function refereeReason(result) {
  if (!result) return null;
  if (result.reason === "turn-cap") return result.winner === null ? "turn-limit-draw" : "turn-limit";
  return result.reason === "base" ? "base-destroyed" : result.reason ?? null;
}

// Schema-v1 state from an archived state. A field the revision cannot express is left out and
// reported through `missing(field, why)`.
export function archivedNormalizer(engine, missing) {
  const {rules, cards} = engine;
  const trapSlots = Number.isInteger(rules.TRAP_SLOTS) ? rules.TRAP_SLOTS : null;
  const live = Object.fromEntries(SIDES.map((side) => [side, trapSlots ? Array(trapSlots).fill(null) : null]));
  const traps = (side, engineTraps, turn) => {
    const slots = live[side];
    for (let i = 0; i < slots.length; i++) if (slots[i] && !engineTraps.includes(slots[i].id)) slots[i] = null;
    for (const id of engineTraps) {
      if (slots.some((t) => t?.id === id)) continue;
      const free = slots.indexOf(null);
      if (free < 0) throw new Error(`archived engine holds more than ${trapSlots} traps for ${side}`);
      slots[free] = {id, card: cards.cardOf(id).name, setTurn: turn};
    }
    return slots.map((t) => (t ? {...t} : null));
  };
  const troop = (state, t) => {
    if (!t) return null;
    const card = cards.cardOf(t.cardId);
    const view = {id: t.cardId, card: card.name, type: card.tag ?? null};
    if (typeof rules.attackOf === "function") view.attack = rules.attackOf(state, t);
    else missing("troops[].attack", "rules.js exports no attackOf (effective attack)");
    view.orbs = t.health;
    if (Array.isArray(t.gear)) view.gear = [...t.gear]; else missing("troops[].gear", "troops carry no gear list");
    if ("cover" in t && "stunned" in t) view.statuses = [...(t.cover ? ["cover"] : []), ...(t.stunned ? ["stunned"] : [])];
    else missing("troops[].statuses", "troops carry no cover flag");
    if ("ready" in t) view.rest = !t.ready && state.turn < t.arrived + 2;
    else missing("troops[].rest", "troops carry no ready flag");
    view.acted = t.attacked;
    return view;
  };
  return (state) => {
    const out = {turn: state.turn, active: state.active, first: state.first,
      over: Boolean(state.result), winner: state.result ? state.result.winner ?? null : null, reason: refereeReason(state.result)};
    if ("location" in state) out.location = state.location && {id: state.location.cardId, card: cards.cardOf(state.location.cardId).name, owner: state.location.side};
    else missing("location", "state has no location");
    const allowances = {};
    for (const [name, key, invert] of [["troop", "summonUsed", true], ["other", "castUsed", true], ["trap", "setUsed", true], ["cards", "attacking", true]]) {
      if (key in state) allowances[name] = invert ? !state[key] : state[key];
      else missing(`allowances.${name}`, `state has no ${key}`);
    }
    out.allowances = allowances;
    out.players = Object.fromEntries(SIDES.map((side) => {
      const s = state.sides[side];
      const p = {base: s.base, hand: [...s.hand], deck: [...s.deck]};
      if (Array.isArray(s.discard)) p.discard = [...s.discard]; else missing("discard", "sides have no discard");
      p.troops = s.board.map((t) => troop(state, t));
      if (Array.isArray(s.traps) && trapSlots) p.traps = traps(side, s.traps, state.turn);
      else missing("traps", "no trap list or TRAP_SLOTS export");
      return [side, p];
    }));
    return out;
  };
}

// Replays `duel` on the engine extracted at engineRoot. Throws UnsupportedHistoricalApi when the
// revision cannot take the duel at all.
export async function runDuel(engineRoot, duel) {
  const engine = await loadEngine(engineRoot);
  const notes = new Map();
  const missing = (field, why) => { if (!notes.has(field)) notes.set(field, `field ${field}: ${why} at this revision`); };
  const normalize = archivedNormalizer(engine, missing);
  let state = initialState(engine, duel);
  const initial = normalize(state);
  const steps = [];
  const stepNotes = [];
  let halted = null;
  duel.actions.forEach((input, index) => {
    if (halted !== null) { steps.push({error: `not-run: step ${halted} is unsupported at this revision`}); return; }
    if (isObject(input) && ACTION_TYPES.includes(input.type) && !engine.actionTypes.includes(input.type)) {
      halted = index;
      stepNotes.push(`step ${index}: unsupported-historical-api:${input.type} (${engine.rel}/rules.js has no ${input.type} action)`);
      steps.push({error: `unsupported-historical-api:${input.type}`});
      return;
    }
    const {action, error} = canonicalAction(input);
    if (!action) { steps.push({accepted: false, state: normalize(state), error}); return; }
    try {
      const applied = engine.rules.applyAction(state, action);
      state = applied.state;
      steps.push({accepted: true, state: normalize(state), error: null, engineEvents: structuredClone(applied.events ?? [])});
    } catch (thrown) {
      if (!String(thrown?.message).startsWith("illegal action")) {
        throw new Error(`archived engine failed on action ${index} ${JSON.stringify(action)}: ${thrown?.message}`, {cause: thrown});
      }
      steps.push({accepted: false, state: normalize(state), error: "illegal"});
    }
  });
  return {seed: duel.seed, engine: {path: engine.rel, actionTypes: engine.actionTypes}, initial, steps,
    unsupported: [...notes.values(), ...stepNotes]};
}
