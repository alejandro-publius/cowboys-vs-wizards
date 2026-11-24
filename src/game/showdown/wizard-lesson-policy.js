// Wizard lesson policy: an opt-in rule for when the Wizard CPU holds Hellfire, and replay
// validation for recorded lesson episodes. Pure: no DOM, network, filesystem or model calls.
// Cards and rules are unchanged. This module only picks among rules.js legalActions for the
// Wizard seat, and with no policy it plays exactly the original level-2 bot (planTurn).
// A policy is data from a fixed whitelist (validatePolicy). Nothing in a policy, an episode or
// a lesson bundle is executed or read as an instruction.
import {TYPES, cardOf, has} from "./cards.js";
import {isDealSeed} from "./seed.js";
import {applyAction, attackOf, createShowdown, legalActions, planTurn, playTurn} from "./rules.js";

export const LESSON_VERSION = 1;
export const POLICY_KIND = "wizard-hellfire-hold";
export const CPU_SIDE = "wizard";
export const PLAYER_SIDE = "cowboy";
// What a Cowboy hand, deck or face-down trap card looks like to the Wizard policy.
export const HIDDEN_CARD = "hidden";
export const MAX_EPISODE_ACTIONS = 2000;

// Numeric policy knobs and their bounds. emergencyLethal is fixed to true: the lesson may never
// switch off the forced Hellfire when it is the only answer to lethal on the board.
const POLICY_FIELDS = Object.freeze({
  holdBelowTargets: [1, 3], // hold Hellfire while the Cowboys have fewer troops than this (1 = never hold)
  holdWhenBaseAtLeast: [0, 10], // ...and the Wizard Base has at least this many orbs
  holdWhenMaxAttackAtMost: [0, 10], // ...and no Cowboy troop hits harder than this
});

export const DEFAULT_LESSON_POLICY = deepFreeze({
  version: 1, kind: POLICY_KIND, holdBelowTargets: 2, holdWhenBaseAtLeast: 1, holdWhenMaxAttackAtMost: 10, emergencyLethal: true,
});

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const each of Object.values(value)) deepFreeze(each);
    Object.freeze(value);
  }
  return value;
}

const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const isPlain = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function exactKeys(value, required, optional, where) {
  if (!isPlain(value)) throw new Error(`${where} must be a plain object`);
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) throw new Error(`${where} has unknown key ${JSON.stringify(key)}`);
  }
  for (const key of required) if (!Object.hasOwn(value, key)) throw new Error(`${where} is missing ${key}`);
}

// Returns a frozen copy of a valid policy, or throws. Accepts only the whitelisted keys and integer values.
export function validatePolicy(input) {
  exactKeys(input, ["version", "kind", ...Object.keys(POLICY_FIELDS), "emergencyLethal"], [], "policy");
  if (input.version !== LESSON_VERSION) throw new Error("policy version must be 1");
  if (input.kind !== POLICY_KIND) throw new Error(`policy kind must be ${POLICY_KIND}`);
  if (input.emergencyLethal !== true) throw new Error("policy emergencyLethal must be true");
  const policy = {version: LESSON_VERSION, kind: POLICY_KIND};
  for (const [key, [min, max]] of Object.entries(POLICY_FIELDS)) {
    if (!isInt(input[key], min, max)) throw new Error(`policy ${key} must be an integer from ${min} to ${max}`);
    policy[key] = input[key];
  }
  policy.emergencyLethal = true;
  return deepFreeze(policy);
}

// The policy for a rematch, only when the player opted in. Anything else plays the original Wizard.
export function loadRematchPolicy(input, {optIn = false} = {}) {
  if (optIn !== true || input == null) return null;
  return validatePolicy(input);
}

// The Wizard's picture of the duel: Cowboy hand, deck and traps become same-length lists of
// HIDDEN_CARD. planTurn on this view cannot depend on the Cowboy's hidden cards.
export function lessonView(state) {
  if (state.active !== CPU_SIDE) throw new Error("lesson view is for the Wizard's turn");
  const view = structuredClone(state);
  const cowboy = view.sides[PLAYER_SIDE];
  for (const zone of ["hand", "deck", "traps"]) cowboy[zone] = cowboy[zone].map(() => HIDDEN_CARD);
  return view;
}

// Base damage the Cowboy board could deal on its next turn, from public information only: the
// troops on both boards and the location. It ignores Cowboy cards still in hand, traps on either
// side, and blockers that fall during the turn, so it is an estimate, not a proof of lethal.
export function boardThreat(view) {
  const wizard = view.sides[CPU_SIDE];
  const defenders = wizard.board.filter(Boolean);
  const guards = defenders.filter((troop) => has(troop.cardId, "guard"));
  let total = 0;
  for (const troop of view.sides[PLAYER_SIDE].board) {
    if (!troop || troop.stunned) continue;
    const hit = attackOf(view, troop);
    if (hit <= 0) continue;
    if (!defenders.length) {
      total += hit;
      continue;
    }
    let best = Math.max(0, ...(guards.length ? guards : defenders).map((each) => (each.cover ? 0 : Math.max(0, hit - each.health))));
    if (!guards.length && has(troop.cardId, "ride")) best = Math.max(best, 1);
    total += best;
  }
  return total;
}

const isHellfire = (action) => action.type === "spell" && cardOf(action.cardId).effect === "hellfire";
export const hellfireAction = (state) => legalActions(state).find(isHellfire) ?? null;
const sameAction = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What the policy does now: "force" Hellfire, "hold" it, or play as the original bot ("baseline").
// Returns the plan (legal actions for this state) and the public facts behind the decision.
export function decideHellfire(state, policy) {
  const rule = validatePolicy(policy);
  const view = lessonView(state);
  const wizard = view.sides[CPU_SIDE];
  const troops = view.sides[PLAYER_SIDE].board.filter(Boolean);
  const hellfire = hellfireAction(state);
  const facts = {turn: state.turn, hellfireLegal: Boolean(hellfire), targets: troops.length, base: wizard.base, threat: boardThreat(view),
    maxAttack: Math.max(0, ...troops.map((troop) => attackOf(view, troop)))};
  if (!hellfire) return {decision: "baseline", ...facts, plan: planTurn(view)};
  facts.threatAfter = boardThreat(applyAction(view, hellfire).state);
  if (rule.emergencyLethal && facts.threat >= facts.base && facts.threatAfter < facts.base) {
    return {decision: "force", reason: "lethal-on-board", ...facts, plan: [hellfire]};
  }
  const hold = facts.targets < rule.holdBelowTargets && facts.base >= rule.holdWhenBaseAtLeast && facts.maxAttack <= rule.holdWhenMaxAttackAtMost;
  if (!hold) return {decision: "baseline", ...facts, plan: planTurn(view)};
  // Hold: plan as if Hellfire were not in the Wizard's own hand, so no plan can contain it.
  const held = structuredClone(view);
  held.sides[CPU_SIDE].hand = held.sides[CPU_SIDE].hand.filter((cardId) => cardOf(cardId).effect !== "hellfire");
  return {decision: "hold", reason: "low-threat", ...facts, plan: planTurn(held)};
}

// One whole turn for the active side, in the same loop as rules.js playTurn at level 2: plan,
// play, plan again after a sprung trap or the side's own draw, or when the plan runs out.
// Every action is checked against the real engine's legalActions before it is applied.
function runTurn(state, planner, onAction) {
  const side = state.active;
  const actions = [];
  const events = [];
  const decisions = [];
  const replan = (current) => {
    const {plan, ...decision} = planner(current);
    decisions.push(decision);
    return [...plan];
  };
  let plan = replan(state);
  while (!state.result && state.active === side) {
    if (!plan.length) plan = replan(state);
    const action = plan.shift();
    if (!legalActions(state).some((legal) => sameAction(legal, action))) throw new Error(`policy produced an illegal action ${JSON.stringify(action)}`);
    const applied = applyAction(state, action);
    onAction?.(state, applied, action);
    actions.push(action);
    state = applied.state;
    events.push(...applied.events);
    if (state.result || state.active !== side) break;
    if (applied.events.some((event) => event.type === "trap" || ((event.type === "draw" || event.type === "burn") && event.side === side))) plan = replan(state);
  }
  return {state, events, actions, decisions};
}

// The Wizard CPU's turn. No policy: the original bot (planTurn on the real state, exactly as
// playTurn level 2; other levels go straight to playTurn and return actions: null).
// With a policy: level 2 only, planned on lessonView. Returns {state, events, actions, decisions}.
export function wizardTurn(state, {policy = null, level = 2, onAction} = {}) {
  if (state.result) return {state, events: [], actions: [], decisions: []};
  if (state.active !== CPU_SIDE) throw new Error("not the Wizard's turn");
  if (!policy) {
    if (level !== 2) return {...playTurn(state, level, onAction && ((before, applied) => onAction(before, applied, null))), actions: null, decisions: []};
    return runTurn(state, (current) => ({decision: "original", plan: planTurn(current)}), onAction);
  }
  if (level !== 2) throw new Error("a lesson policy runs only on the level-2 Wizard");
  const rule = validatePolicy(policy);
  return runTurn(state, (current) => decideHellfire(current, rule), onAction);
}

// The level-2 bot for the Cowboy seat, used for recorded fixtures and counterexample checks.
export const cowboyBotTurn = (state, onAction) => runTurn(state, (current) => ({decision: "bot", plan: planTurn(current)}), onAction);

// ----- Episodes -----

const CARD_ID = /^[a-z0-9-]{1,60}$/;
const isSlot = (value) => isInt(value, 0, 2);

// Rebuilds an action in the engine's key order (applyAction compares JSON), or throws.
export function canonicalAction(action) {
  if (!isPlain(action) || typeof action.type !== "string") throw new Error("action must be an object with a type");
  const card = () => {
    if (typeof action.cardId !== "string" || !CARD_ID.test(action.cardId) || !cardOf(action.cardId)) throw new Error(`unknown card ${JSON.stringify(action.cardId)}`);
    return action.cardId;
  };
  const slot = (key) => {
    if (!isSlot(action[key])) throw new Error(`action ${key} must be a slot 0-2`);
    return action[key];
  };
  switch (action.type) {
    case "summon":
      exactKeys(action, ["type", "cardId", "tributes"], [], "summon");
      if (!Array.isArray(action.tributes) || action.tributes.length > 2 || !action.tributes.every(isSlot)) throw new Error("summon tributes must be slots");
      return {type: "summon", cardId: card(), tributes: [...action.tributes]};
    case "spell":
      exactKeys(action, ["type", "cardId"], ["target"], "spell");
      return Object.hasOwn(action, "target") ? {type: "spell", cardId: card(), target: slot("target")} : {type: "spell", cardId: card()};
    case "gear":
      exactKeys(action, ["type", "cardId", "slot"], [], "gear");
      return {type: "gear", cardId: card(), slot: slot("slot")};
    case "location":
    case "set":
      exactKeys(action, ["type", "cardId"], [], action.type);
      return {type: action.type, cardId: card()};
    case "attack":
      exactKeys(action, ["type", "slot", "target"], [], "attack");
      if (action.target !== "base" && !isSlot(action.target)) throw new Error("attack target must be a slot or base");
      return {type: "attack", slot: slot("slot"), target: action.target};
    case "cover":
      exactKeys(action, ["type", "slot"], [], "cover");
      return {type: "cover", slot: slot("slot")};
    case "end":
      exactKeys(action, ["type"], [], "end");
      return {type: "end"};
    default:
      throw new Error(`unknown action type ${JSON.stringify(action.type)}`);
  }
}

// Setup: what createShowdown needs besides the seed. `first` is always recorded resolved.
export function validateSetup(input) {
  exactKeys(input, ["first", "cpu"], ["baseOrbs", "decks", "opening"], "setup");
  if (![PLAYER_SIDE, CPU_SIDE].includes(input.first)) throw new Error("setup first must be cowboy or wizard");
  exactKeys(input.cpu, ["side", "level"], [], "setup cpu");
  if (input.cpu.side !== CPU_SIDE || input.cpu.level !== 2) throw new Error("setup cpu must be {side: wizard, level: 2}");
  const setup = {first: input.first, cpu: {side: CPU_SIDE, level: 2}};
  if (Object.hasOwn(input, "baseOrbs")) {
    const orbs = input.baseOrbs;
    if (isInt(orbs, 1, 20)) setup.baseOrbs = orbs;
    else {
      exactKeys(orbs, [PLAYER_SIDE, CPU_SIDE], [], "setup baseOrbs");
      if (!isInt(orbs.cowboy, 1, 20) || !isInt(orbs.wizard, 1, 20)) throw new Error("setup baseOrbs must be 1-20");
      setup.baseOrbs = {cowboy: orbs.cowboy, wizard: orbs.wizard};
    }
  }
  if (Object.hasOwn(input, "decks")) {
    exactKeys(input.decks, [], [PLAYER_SIDE, CPU_SIDE], "setup decks");
    setup.decks = {};
    for (const [side, counts] of Object.entries(input.decks)) {
      exactKeys(counts, [], Object.keys(counts), `setup decks.${side}`);
      setup.decks[side] = {};
      for (const [type, count] of Object.entries(counts)) {
        if (!Object.hasOwn(TYPES, type) || TYPES[type].side !== side) throw new Error(`setup deck card ${JSON.stringify(type)} is not a ${side} card`);
        if (!isInt(count, 0, 10)) throw new Error("setup deck counts must be 0-10");
        setup.decks[side][type] = count;
      }
    }
  }
  if (Object.hasOwn(input, "opening")) {
    exactKeys(input.opening, [], [PLAYER_SIDE, CPU_SIDE], "setup opening");
    setup.opening = {};
    for (const [side, troops] of Object.entries(input.opening)) {
      if (!Array.isArray(troops) || troops.length > 3) throw new Error("setup opening lists at most 3 troops");
      setup.opening[side] = troops.map((troop) => {
        exactKeys(troop, ["type", "health"], [], "setup opening troop");
        if (!Object.hasOwn(TYPES, troop.type) || TYPES[troop.type].side !== side || TYPES[troop.type].kind !== "troop") throw new Error(`setup opening ${JSON.stringify(troop.type)} is not a ${side} troop`);
        if (!isInt(troop.health, 1, 20)) throw new Error("setup opening health must be 1-20");
        return {type: troop.type, health: troop.health};
      });
    }
  }
  return deepFreeze(setup);
}

const createOptions = (setup) => {
  const options = {first: setup.first};
  for (const key of ["baseOrbs", "decks", "opening"]) if (Object.hasOwn(setup, key)) options[key] = structuredClone(setup[key]);
  return options;
};

export const createEpisodeState = (seed, setup) => createShowdown(seed, createOptions(validateSetup(setup)));

// Checks the episode's shape only (no replay). Returns a frozen canonical copy, or throws.
export function validateEpisode(input) {
  exactKeys(input, ["version", "seed", "setup", "actions", "markedIndex", "tag"], [], "episode");
  if (input.version !== LESSON_VERSION) throw new Error("episode version must be 1");
  if (input.tag !== "bait") throw new Error("episode tag must be bait");
  if (!isDealSeed(input.seed)) throw new Error("episode seed must be a 32-bit unsigned integer");
  if (!Array.isArray(input.actions) || !input.actions.length || input.actions.length > MAX_EPISODE_ACTIONS) throw new Error("episode actions must be a non-empty list");
  if (!isInt(input.markedIndex, 0, input.actions.length - 1)) throw new Error("episode markedIndex must point into actions");
  const actions = input.actions.map((entry, index) => {
    exactKeys(entry, ["side", "action"], [], `episode action ${index}`);
    if (![PLAYER_SIDE, CPU_SIDE].includes(entry.side)) throw new Error(`episode action ${index} side must be cowboy or wizard`);
    return {side: entry.side, action: canonicalAction(entry.action)};
  });
  return deepFreeze({version: LESSON_VERSION, seed: input.seed, setup: validateSetup(input.setup), actions, markedIndex: input.markedIndex, tag: "bait"});
}

// Replays an episode on the real engine. Every action must be legal for the side to move, and every
// Wizard action must be the one the Wizard CPU actually plays there (`policy` null = original bot).
// Returns {episode, turnStart, marked, final}: the state at the start of the marked Wizard turn,
// the state just before the marked action, and the state after the last action.
export function replayEpisode(input, {policy = null} = {}) {
  const episode = validateEpisode(input);
  if (episode.actions[episode.markedIndex].side !== CPU_SIDE) throw new Error("marked action must be a Wizard action");
  const rule = policy ? validatePolicy(policy) : null;
  let state = createEpisodeState(episode.seed, episode.setup);
  let expected = null;
  let wizardTurnStart = state.active === CPU_SIDE ? state : null;
  let turnStart = null;
  let marked = null;
  episode.actions.forEach(({side, action}, index) => {
    if (state.result) throw new Error(`episode action ${index} comes after the duel ended`);
    if (side !== state.active) throw new Error(`episode action ${index} is recorded for ${side}, but ${state.active} is to move`);
    if (!legalActions(state).some((legal) => sameAction(legal, action))) throw new Error(`episode action ${index} is not legal: ${JSON.stringify(action)}`);
    if (side === CPU_SIDE) {
      expected ??= wizardTurn(state, {policy: rule}).actions;
      const cpu = expected.shift();
      if (!cpu || !sameAction(cpu, action)) throw new Error(`episode action ${index} is not what the Wizard CPU plays there`);
    }
    if (index === episode.markedIndex) [turnStart, marked] = [wizardTurnStart, state];
    const before = state.active;
    state = applyAction(state, action).state;
    if (state.active !== before) {
      expected = null;
      wizardTurnStart = state.active === CPU_SIDE ? state : null;
    }
  });
  return {episode, turnStart, marked, final: state};
}

// Bait: the original Wizard spent Hellfire on a lone Cowboy troop that was not lethal on the board.
export function baitReport(input) {
  const {episode, turnStart, marked} = replayEpisode(input);
  const action = episode.actions[episode.markedIndex].action;
  const view = lessonView(marked);
  const targets = view.sides[PLAYER_SIDE].board.filter(Boolean).length;
  const threat = boardThreat(view);
  const threatAfter = isHellfire(action) ? boardThreat(applyAction(view, action).state) : null;
  const reasons = [];
  if (!isHellfire(action)) reasons.push("marked action is not Hellfire");
  if (targets !== 1) reasons.push(`Cowboys had ${targets} troops, not 1`);
  if (threatAfter !== null && threat >= view.sides[CPU_SIDE].base && threatAfter < view.sides[CPU_SIDE].base) reasons.push("the lone troop was lethal on the board");
  return {ok: reasons.length === 0, reasons, targets, threat, base: view.sides[CPU_SIDE].base, turn: turnStart?.turn ?? null};
}

// The same turn-start state played by the original Wizard and by a policy Wizard.
export function compareAtMarkedTurn(input, policy) {
  const {turnStart} = replayEpisode(input);
  const original = wizardTurn(turnStart);
  const lesson = wizardTurn(turnStart, {policy: validatePolicy(policy)});
  return {
    turn: turnStart.turn,
    original: {actions: original.actions, usedHellfire: original.actions.some(isHellfire)},
    lesson: {actions: lesson.actions, decisions: lesson.decisions, usedHellfire: lesson.actions.some(isHellfire)},
  };
}

// Records chronological Cowboy and Wizard actions from a fresh deal. The Cowboy seat is the level-2
// bot (a deterministic stand-in for a player); the Wizard is the original bot or `policy`.
// stopAt(before, action, side, index) marks an action; recording stops after that turn and the
// episode is cut after the marked action. Returns the episode, or null if nothing was marked.
export function recordEpisode(seed, setup, {policy = null, stopAt, maxActions = 400} = {}) {
  // Without setup.first, the deal's own coin flip decides; the episode records the resolved side.
  const {first: _drop, ...flip} = createOptions(validateSetup({...setup, first: PLAYER_SIDE}));
  const first = setup.first ?? createShowdown(seed, flip).first;
  const initial = validateSetup({...setup, first});
  let state = createEpisodeState(seed, initial);
  const actions = [];
  let markedIndex = null;
  while (!state.result && markedIndex === null && actions.length < maxActions) {
    const side = state.active;
    const onAction = (before, _applied, action) => {
      actions.push({side, action});
      if (markedIndex === null && stopAt?.(before, action, side, actions.length - 1)) markedIndex = actions.length - 1;
    };
    state = (side === CPU_SIDE ? wizardTurn(state, {policy, onAction}) : cowboyBotTurn(state, onAction)).state;
  }
  if (markedIndex === null) return null;
  return validateEpisode({version: LESSON_VERSION, seed, setup: initial, actions: actions.slice(0, markedIndex + 1), markedIndex, tag: "bait"});
}

// Searches seeds for an authentic bait: the original Wizard's own play, no hand-placed state.
// Returns {episode, report, comparison, seedsTried} or {episode: null, seedsTried}.
export function findBaitEpisode({from = 0, to = 50, setup = {cpu: {side: CPU_SIDE, level: 2}}, policy = DEFAULT_LESSON_POLICY, maxActions = 400} = {}) {
  let seedsTried = 0;
  for (let seed = from; seed <= to; seed++) {
    seedsTried += 1;
    const stopAt = (before, action, side) => side === CPU_SIDE && isHellfire(action)
      && before.sides[PLAYER_SIDE].board.filter(Boolean).length === 1;
    const episode = recordEpisode(seed, setup, {stopAt, maxActions});
    if (!episode) continue;
    const report = baitReport(episode);
    if (!report.ok) continue;
    const comparison = compareAtMarkedTurn(episode, policy);
    if (comparison.original.usedHellfire && !comparison.lesson.usedHellfire) return {episode, report, comparison, seedsTried};
  }
  return {episode: null, seedsTried};
}

// Session helper: freeze the setup once, then record each applied action in order.
export function createEpisodeRecorder(seed, setup) {
  const initial = validateSetup(setup);
  const actions = [];
  return {
    setup: initial,
    record(side, action) {
      if (actions.length >= MAX_EPISODE_ACTIONS) throw new Error("episode is full");
      if (![PLAYER_SIDE, CPU_SIDE].includes(side)) throw new Error("side must be cowboy or wizard");
      actions.push(deepFreeze({side, action: canonicalAction(action)}));
      return actions.length - 1;
    },
    toEpisode(markedIndex) {
      return validateEpisode({version: LESSON_VERSION, seed, setup: structuredClone(initial), actions: structuredClone(actions), markedIndex, tag: "bait"});
    },
  };
}

// Stable key for matching an episode to a precomputed lesson: FNV-1a over canonical JSON.
export function episodeKey(input) {
  const text = JSON.stringify(validateEpisode(input));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `ep1-${hash.toString(16).padStart(8, "0")}`;
}

// ----- Counterexamples and lesson bundles -----

// A counterexample to `policy`: an episode whose marked Wizard turn is reachable with `policy`
// playing every earlier Wizard turn, where the policy holds Hellfire and the Cowboy bot then wins
// on its next turn, while the original Wizard from the same state does not lose that turn.
export function checkCounterexample(input, policy) {
  const rule = validatePolicy(policy);
  const {turnStart} = replayEpisode(input, {policy: rule});
  const cowboyWinsAfter = (turn) => {
    if (turn.state.result) return turn.state.result.winner === PLAYER_SIDE;
    return cowboyBotTurn(turn.state).state.result?.winner === PLAYER_SIDE;
  };
  const lesson = wizardTurn(turnStart, {policy: rule});
  const held = lesson.decisions.some((decision) => decision.decision === "hold");
  const winsAfterPolicy = cowboyWinsAfter(lesson);
  const winsAfterOriginal = cowboyWinsAfter(wizardTurn(turnStart));
  return {held, winsAfterPolicy, winsAfterOriginal, refutes: held && winsAfterPolicy && !winsAfterOriginal};
}

const PROVENANCE_ROLES = ["coach", "rival", "reviser"];
const RUN_ID = /^[A-Za-z0-9_.:-]{4,100}$/;
const MODEL = /^[A-Za-z0-9_. -]{1,60}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function validateProvenance(input, role) {
  exactKeys(input, ["tool", "native", "role", "runId", "model", "finishedAt"], [], `${role} provenance`);
  if (input.tool !== "kiro-cli" || input.native !== true) throw new Error(`${role} provenance must be a native kiro-cli run`);
  if (input.role !== role || !PROVENANCE_ROLES.includes(role)) throw new Error(`${role} provenance role mismatch`);
  if (typeof input.runId !== "string" || !RUN_ID.test(input.runId)) throw new Error(`${role} provenance runId is malformed`);
  if (typeof input.model !== "string" || !MODEL.test(input.model)) throw new Error(`${role} provenance model is malformed`);
  if (typeof input.finishedAt !== "string" || !ISO_TIME.test(input.finishedAt)) throw new Error(`${role} provenance finishedAt must be an ISO time`);
  return {...input};
}

// Checks a lesson bundle against its bait episode on the real engine. A bundle is data only:
// {version: 1, episodeKey, source: "cached" | "fresh", proposal: {policy, provenance},
//  counterexample: {episode, provenance}, revised: {policy, provenance}}.
// Returns {ok, source, revised, report}. `revised` is the frozen policy to offer for an opted-in rematch.
export function verifyLessonBundle(bundle, baitEpisode) {
  exactKeys(bundle, ["version", "episodeKey", "source", "proposal", "counterexample", "revised"], [], "lesson");
  if (bundle.version !== LESSON_VERSION) throw new Error("lesson version must be 1");
  if (!["cached", "fresh"].includes(bundle.source)) throw new Error("lesson source must be cached or fresh");
  if (bundle.episodeKey !== episodeKey(baitEpisode)) throw new Error("lesson does not match this episode");
  exactKeys(bundle.proposal, ["policy", "provenance"], [], "lesson proposal");
  exactKeys(bundle.counterexample, ["episode", "provenance"], [], "lesson counterexample");
  exactKeys(bundle.revised, ["policy", "provenance"], [], "lesson revised");
  const proposal = validatePolicy(bundle.proposal.policy);
  const revised = validatePolicy(bundle.revised.policy);
  const provenance = {coach: validateProvenance(bundle.proposal.provenance, "coach"),
    rival: validateProvenance(bundle.counterexample.provenance, "rival"), reviser: validateProvenance(bundle.revised.provenance, "reviser")};
  const counter = {proposal: checkCounterexample(bundle.counterexample.episode, proposal)};
  // The revised policy faces the same marked state; earlier turns are replayed as the proposal played them.
  const {turnStart} = replayEpisode(bundle.counterexample.episode, {policy: proposal});
  const after = wizardTurn(turnStart, {policy: revised});
  counter.revisedLoses = after.state.result ? after.state.result.winner === PLAYER_SIDE
    : cowboyBotTurn(after.state).state.result?.winner === PLAYER_SIDE;
  const bait = baitReport(baitEpisode);
  const comparison = compareAtMarkedTurn(baitEpisode, revised);
  const report = {bait, counter, revisedHoldsOnBait: !comparison.lesson.usedHellfire, provenance};
  const ok = bait.ok && counter.proposal.refutes && !counter.revisedLoses && report.revisedHoldsOnBait;
  return {ok, source: bundle.source, revised: ok ? revised : null, report};
}
