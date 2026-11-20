// Paired comparison: the two Outriders a two-win career holds vs the two Sheriffs they replaced,
// on The Bone Fence. Pure: no DOM, storage or network. See README.md for the acceptance rules.
import {TYPES, cardOf, has, typeOf} from "../../src/game/showdown/cards.js";
import {applyAction, attackOf, canAttack, createShowdown, legalActions, playTurn} from "../../src/game/showdown/rules.js";
import {deckProblems, duelFor, newSave, settle} from "../../src/game/showdown/progress.js";

export const SEEDS = Object.freeze({from: 0, to: 999});
const OUTRIDER = "cowboy-outrider";
const SHERIFF = "cowboy-sheriff";
const STEP_CAP = 5000; // a safety stop; a game that hits it is reported, not hidden

// The career after two Trail wins, kept in memory. Throws if any setup rule from README.md fails.
export function setup() {
  let save = newSave();
  for (let i = 0; i < 2; i++) save = settle(save, "trail", true).save;
  save = {...save, offer: null};
  const treatment = {...save.deck};
  if (treatment[OUTRIDER] !== 2) throw new Error(`two-win deck holds ${treatment[OUTRIDER]} Outriders, not 2`);
  const {[OUTRIDER]: _, ...rest} = treatment;
  const control = {...rest, [SHERIFF]: (rest[SHERIFF] ?? 0) + 2};
  for (const [name, deck] of [["treatment", treatment], ["control", control]]) {
    const problems = deckProblems(save, deck);
    if (problems.length) throw new Error(`${name} deck is not legal: ${problems.join(" ")}`);
  }
  const duel = duelFor(save, "trail");
  if (duel?.name !== "The Bone Fence") throw new Error(`third Trail duel is ${duel?.name}`);
  return {save, treatment, control, duel};
}

// The two cards side by side: every field, and which ones differ.
export function cardDiff() {
  const a = TYPES[OUTRIDER];
  const b = TYPES[SHERIFF];
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return fields.map((field) => ({field, outrider: a[field], sheriff: b[field], same: JSON.stringify(a[field]) === JSON.stringify(b[field])}));
}

// Renames card ids everywhere in a state. Used to build the control deal from the treatment deal,
// so every card keeps its position in hand and deck.
export function rename(state, map) {
  const swap = (id) => map[id] ?? id;
  const next = structuredClone(state);
  for (const side of Object.values(next.sides)) {
    side.hand = side.hand.map(swap);
    side.deck = side.deck.map(swap);
    side.discard = side.discard.map(swap);
    side.traps = side.traps.map((trap) => (typeof trap === "string" ? swap(trap) : {...trap, cardId: swap(trap.cardId)}));
    side.board = side.board.map((troop) => troop && {...troop, cardId: swap(troop.cardId), gear: troop.gear.map(swap)});
  }
  return next;
}
export const TO_CONTROL = Object.freeze({"cowboy-outrider-1": "cowboy-sheriff-5", "cowboy-outrider-2": "cowboy-sheriff-6"});
// Same cards, different copy ids: a deal that must play identically.
export const RELABEL = Object.freeze({"cowboy-sheriff-1": "cowboy-sheriff-5", "cowboy-sheriff-5": "cowboy-sheriff-1",
  "cowboy-sheriff-2": "cowboy-sheriff-6", "cowboy-sheriff-6": "cowboy-sheriff-2"});

export function deals(seed, ctx = setup()) {
  const treatment = createShowdown(seed, ctx.duel.options);
  return {treatment, control: rename(treatment, TO_CONTROL)};
}

// What the Cowboy player can see: the Wizard hand, deck and trap identities and its own deck order are removed.
export function cowboyView(state) {
  const view = structuredClone(state);
  const wizard = view.sides.wizard;
  view.hidden = {wizardHand: wizard.hand.length, wizardDeck: wizard.deck.length, wizardTraps: wizard.traps.length, cowboyDeck: view.sides.cowboy.deck.length};
  wizard.hand = [];
  wizard.deck = [];
  wizard.traps = [];
  view.sides.cowboy.deck = [];
  return view;
}

const worth = (state, troop) => (troop ? 2 * attackOf(state, troop) + troop.health : 0);
function score(state) {
  if (state.result) return state.result.winner === "cowboy" ? 1e6 : state.result.winner === null ? 0 : -1e6;
  const {cowboy, wizard} = state.sides;
  const material = (side) => side.board.reduce((sum, troop) => sum + worth(state, troop), 0);
  return 8 * (cowboy.base - wizard.base) + material(cowboy) - material(wizard);
}

// One-ply greedy on the public view: the legal action (not cover, not end) that most improves the
// score, the first one in legal order on a tie; end when nothing improves it.
// noRide: never strike the Base past troops (a probe that turns the keyword off in play).
export function cowboyAct(view, {noRide = false} = {}) {
  let best = {type: "end"};
  let value = score(view);
  const troops = view.sides.wizard.board.some(Boolean);
  for (const action of legalActions(view)) {
    if (action.type === "end" || action.type === "cover") continue;
    if (noRide && troops && action.type === "attack" && action.target === "base") continue;
    const after = score(applyAction(view, action).state);
    if (after > value) [best, value] = [action, after];
  }
  return best;
}

const hash = (text) => [...text].reduce((h, char) => (Math.imul(h, 31) + char.charCodeAt(0)) >>> 0, 7);

// Primary Wizard: the level-0 rule (any legal action but cover, traps blind), picked by (seed, turn, step).
export function wizardFixed(state, step) {
  const blind = structuredClone(state);
  blind.sides.cowboy.traps = [];
  const moves = legalActions(blind).filter((action) => action.type !== "end" && action.type !== "cover");
  return moves.length ? moves[hash(`${state.seed}:${state.turn}:${step}`) % moves.length] : {type: "end"};
}

// One Cowboy decision point: what an Outrider could do here.
export function inspect(state) {
  const own = state.sides.cowboy.board;
  const enemy = state.sides.wizard.board.filter(Boolean);
  const riders = own.flatMap((troop, slot) => (troop && has(troop.cardId, "ride") && cardOf(troop.cardId).name === "Outrider" && canAttack(state, troop) ? [slot] : []));
  const legal = legalActions(state);
  const pastTroops = legal.filter((action) => action.type === "attack" && action.target === "base" && enemy.length > 0);
  return {
    riderReady: riders.length > 0 && enemy.length > 0,
    offered: pastTroops.some((action) => riders.includes(action.slot)),
    guardBlocked: riders.length > 0 && enemy.length > 0 && enemy.some((troop) => has(troop.cardId, "guard")),
    pastTroops: pastTroops.length,
    rideActions: pastTroops.filter((action) => riders.includes(action.slot)),
  };
}

// Plays one deal to the end. wizard: "fixed" (primary) or "shipped" (playTurn level 0).
// stopAt(point) may return true to stop at a Cowboy decision point (for the replay).
export function play(start, {wizard = "fixed", stopAt, noRide = false} = {}) {
  let state = start;
  const log = [];
  const tally = {decisions: 0, riderReady: 0, offered: 0, guardBlocked: 0, taken: 0, pastTroops: 0, drawn: false};
  const sawRider = () => { if (state.sides.cowboy.hand.some((id) => id.startsWith(`${OUTRIDER}-`))) tally.drawn = true; };
  sawRider();
  let step = 0;
  let steps = 0;
  while (!state.result && steps++ < STEP_CAP) {
    if (state.active === "cowboy") {
      const point = inspect(state);
      const action = cowboyAct(cowboyView(state), {noRide});
      if (stopAt?.(point, state)) return {state, log, tally, point, action};
      tally.decisions += 1;
      tally.riderReady += point.riderReady;
      tally.offered += point.offered;
      tally.guardBlocked += point.guardBlocked;
      tally.pastTroops += point.pastTroops;
      if (point.rideActions.some((ride) => ride.slot === action.slot && action.type === "attack" && action.target === "base")) tally.taken += 1;
      state = applyAction(state, action).state;
      log.push(action);
    } else if (wizard === "shipped") {
      state = playTurn(state, 0).state;
      log.push({type: "wizard-turn"});
    } else {
      const turn = state.turn;
      const action = wizardFixed(state, step);
      state = applyAction(state, action).state;
      log.push(action);
      step = state.turn === turn ? step + 1 : 0;
    }
    sawRider();
  }
  return {state, log, tally, result: state.result ?? {winner: null, reason: "step-cap"}};
}

const outcome = (result) => result.winner ?? "draw";
// A game's actions with copy ids reduced to card types, so two copies of one card compare equal,
// and Outrider written as Sheriff, so "identical" means the same play apart from the card's name.
const plain = (log) => JSON.stringify(log, (key, value) => (key === "cardId" ? typeOf(value).replace(OUTRIDER, SHERIFF) : value));

// Runs two arms on every seed and pairs them. arms: (seed) => [stateA, stateB].
export function paired(arms, {seeds = SEEDS, wizard = "fixed", noRide = false} = {}) {
  const pairs = [];
  for (let seed = seeds.from; seed <= seeds.to; seed++) {
    const [a, b] = arms(seed).map((state) => play(state, {wizard, noRide}));
    pairs.push({seed, a: outcome(a.result), b: outcome(b.result), reasonA: a.result.reason, reasonB: b.result.reason,
      turnsA: a.state.turn, turnsB: b.state.turn, identical: plain(a.log) === plain(b.log) && a.state.turn === b.state.turn, tally: a.tally, tallyB: b.tally});
  }
  return pairs;
}

export function summarize(pairs) {
  const n = pairs.length;
  const count = (fn) => pairs.filter(fn).length;
  const sum = (fn) => pairs.reduce((total, pair) => total + fn(pair), 0);
  const key = (pair) => `${pair.a}/${pair.b}`;
  const table = {};
  for (const pair of pairs) table[key(pair)] = (table[key(pair)] ?? 0) + 1;
  return {
    pairs: n,
    reasons: pairs.reduce((all, p) => ({...all, [`${p.a}:${p.reasonA}/${p.b}:${p.reasonB}`]: (all[`${p.a}:${p.reasonA}/${p.b}:${p.reasonB}`] ?? 0) + 1}), {}),
    discordantRide: {taken: count((p) => p.a !== p.b && p.tally.taken > 0), notTaken: count((p) => p.a !== p.b && p.tally.taken === 0)},
    identical: count((p) => p.identical),
    winsA: count((p) => p.a === "cowboy"), winsB: count((p) => p.b === "cowboy"),
    table,
    discordant: {aOnly: count((p) => p.a === "cowboy" && p.b !== "cowboy"), bOnly: count((p) => p.b === "cowboy" && p.a !== "cowboy")},
    stepCap: count((p) => p.reasonA === "step-cap" || p.reasonB === "step-cap"),
    games: {drawn: count((p) => p.tally.drawn), riderReady: count((p) => p.tally.riderReady > 0), offered: count((p) => p.tally.offered > 0),
      guardBlocked: count((p) => p.tally.guardBlocked > 0), taken: count((p) => p.tally.taken > 0)},
    points: {decisions: sum((p) => p.tally.decisions), riderReady: sum((p) => p.tally.riderReady), offered: sum((p) => p.tally.offered),
      guardBlocked: sum((p) => p.tally.guardBlocked), taken: sum((p) => p.tally.taken)},
    controlPastTroops: sum((p) => p.tallyB.pastTroops),
    meanTurns: {a: sum((p) => p.turnsA) / n, b: sum((p) => p.turnsB) / n},
  };
}

// The full experiment from README.md.
export function experiment({seeds = SEEDS} = {}) {
  const ctx = setup();
  const both = (seed) => { const d = deals(seed, ctx); return [d.treatment, d.control]; };
  const same = (seed) => { const {control} = deals(seed, ctx); return [control, structuredClone(control)]; };
  const relabel = (seed) => { const {control} = deals(seed, ctx); return [control, rename(control, RELABEL)]; };
  return {
    seeds, treatment: ctx.treatment, control: ctx.control, duel: {name: ctx.duel.name, level: ctx.duel.level, ...ctx.duel.options},
    card: cardDiff(),
    primary: summarize(paired(both, {seeds})),
    negativeSame: summarize(paired(same, {seeds})),
    negativeRelabel: summarize(paired(relabel, {seeds})),
    rideDeclined: summarize(paired(both, {seeds, noRide: true})),
    shipped: summarize(paired(both, {seeds, wizard: "shipped"})),
    shippedRelabel: summarize(paired(relabel, {seeds, wizard: "shipped"})),
  };
}

// Replays the treatment arm of `seed` (or the lowest seed in range offering a ride) to the first
// Cowboy decision point where a ride past troops is legal.
export function replay(seed, {seeds = SEEDS} = {}) {
  const ctx = setup();
  const list = seed === undefined ? Array.from({length: seeds.to - seeds.from + 1}, (_, i) => seeds.from + i) : [seed];
  for (const each of list) {
    const run = play(deals(each, ctx).treatment, {stopAt: (point) => point.offered});
    if (run.point) {
      const ride = run.point.rideActions[0];
      const legal = legalActions(run.state).some((action) => JSON.stringify(action) === JSON.stringify(ride));
      return {seed: each, prefix: run.log, ride, legal, chosen: run.action, view: cowboyView(run.state)};
    }
  }
  return null;
}
