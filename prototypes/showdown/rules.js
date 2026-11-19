// Showdown rules: a prototype fight where the player chooses every attack.
// Pure: no DOM. Cards, keywords and decks are in cards.js.
//
// A turn: draw one card, then summon up to one troop, cast up to one spell and set up to one
// trap face down, then attack once with each troop, then end the turn. Once you attack, the
// summon, spell and trap are gone for that turn, so a troop cannot attack and then be
// tributed for a second attacker.
// An attack: your troop deals its attack to an enemy troop you choose. Damage beyond the
// target's last orb hits its owner's Base. A target that survives hits back.
// A troop may strike a Base directly only when that side has no troops.
// A free troop cannot attack on the turn it arrives. A troop paid for with a tribute can.
// A trap waits face down and springs on the next enemy attack, one trap per attack.
// Drawing from an empty deck costs your Base one orb instead. A seventh card is discarded.
import {EFFECTS, cardOf, deckIds, has, tributes} from "./cards.js";

export const BOARD_SIZE = 3;
export const OPENING_HAND = 4;
export const HAND_CAP = 6;
export const TRAP_SLOTS = 2;
// Whoever goes second starts with this many extra cards, to offset the first move.
export const SECOND_PLAYER_CARDS = 1;
// Only a guard against an endless game: an empty deck already ends games.
export const TURN_CAP = 80;

export const opponent = (side) => (side === "cowboy" ? "wizard" : "cowboy");

// mulberry32: the same seed always gives the same deal.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// baseOrbs is one number for both sides or {cowboy, wizard}; decks is {cowboy, wizard} card counts (cards.js DECKS by default).
export function createShowdown(seed, {baseOrbs = 5, first, secondPlayerCards = SECOND_PLAYER_CARDS, decks = {}} = {}) {
  const next = random(seed);
  const sides = {};
  for (const side of ["cowboy", "wizard"]) {
    const deck = deckIds(side, decks[side]);
    const base = baseOrbs[side] ?? baseOrbs;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    sides[side] = {base, baseMax: base, hand: [], deck, board: Array(BOARD_SIZE).fill(null), traps: [], discard: []};
  }
  const starter = next() < .5 ? "cowboy" : "wizard";
  first ??= starter;
  for (const side of ["cowboy", "wizard"]) {
    sides[side].hand = sides[side].deck.splice(0, OPENING_HAND + (side === first ? 0 : secondPlayerCards));
  }
  return {seed, turn: 1, active: first, first, summonUsed: false, castUsed: false, setUsed: false, attacking: false, result: null, sides};
}

// Free troops rest on the turn they arrive; tribute-summoned and Quickdraw troops strike at once.
export const canAttack = (state, troop) => Boolean(troop) && state.turn > 1 && !troop.attacked && !troop.stunned
  && cardOf(troop.cardId).attack > 0
  && !(troop.arrived === state.turn && tributes(troop.cardId) === 0 && !has(troop.cardId, "quickdraw"));

const combinations = (items, size) => size === 0 ? [[]]
  : items.flatMap((item, i) => combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]));

// What the troop in `slot` may attack: Guard troops first; the Base when it is undefended, or past the troops for a rider.
function targetsFor(state, slot) {
  const enemy = state.sides[opponent(state.active)];
  const troops = enemy.board.flatMap((troop, at) => (troop ? [at] : []));
  const guards = troops.filter((at) => has(enemy.board[at].cardId, "guard"));
  const open = troops.length === 0 || (guards.length === 0 && has(state.sides[state.active].board[slot].cardId, "ride"));
  return [...(guards.length ? guards : troops), ...(open ? ["base"] : [])];
}

// Every action the active side may take now. One entry per card type, so copies are not listed twice.
export function legalActions(state) {
  if (state.result) return [];
  const own = state.sides[state.active];
  const enemy = state.sides[opponent(state.active)];
  const slots = [...own.board.keys()];
  const actions = [];
  const seen = new Set();
  for (const cardId of state.attacking ? [] : own.hand) {
    const card = cardOf(cardId);
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    if (card.kind === "troop" && !state.summonUsed) {
      const occupied = slots.filter((slot) => own.board[slot]);
      for (const paid of combinations(occupied, tributes(cardId))) {
        if (occupied.length - paid.length < BOARD_SIZE) actions.push({type: "summon", cardId, tributes: paid});
      }
    }
    if (card.kind === "spell" && !state.castUsed) {
      if (!EFFECTS[card.effect].target) {
        if (enemy.board.some(Boolean)) actions.push({type: "spell", cardId});
      } else {
        enemy.board.forEach((troop, target) => {
          if (!troop || has(troop.cardId, "ghostly") || (card.effect === "tie" && troop.stunned)) return;
          actions.push({type: "spell", cardId, target});
        });
      }
    }
    if (card.kind === "trap" && !state.setUsed && own.traps.length < TRAP_SLOTS) actions.push({type: "set", cardId});
  }
  for (const slot of slots) {
    if (canAttack(state, own.board[slot])) for (const target of targetsFor(state, slot)) actions.push({type: "attack", slot, target});
  }
  actions.push({type: "end"});
  return actions;
}

const sameAction = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function defeat(side, slot) {
  side.discard.push(side.board[slot].cardId);
  side.board[slot] = null;
}

function finish(next) {
  for (const side of ["cowboy", "wizard"]) {
    if (next.sides[side].base <= 0) next.result = {winner: opponent(side), reason: "base"};
  }
}

function draw(next, sideName, events, {fatigue = false} = {}) {
  const side = next.sides[sideName];
  if (!side.deck.length) {
    if (!fatigue) return;
    side.base = Math.max(0, side.base - 1);
    events.push({type: "fatigue", side: sideName});
    return;
  }
  const cardId = side.deck.shift();
  if (side.hand.length >= HAND_CAP) {
    side.discard.push(cardId);
    events.push({type: "burn", side: sideName, cardId});
  } else {
    side.hand.push(cardId);
    events.push({type: "draw", side: sideName});
  }
}

// What one attack would do to the two troops and the Base, without changing anything and
// without traps, Last Stand or Sweep. The screen and the bot both use it.
export function attackOutcome(state, slot, target) {
  const attacker = state.sides[state.active].board[slot];
  const enemy = state.sides[opponent(state.active)];
  const attack = cardOf(attacker.cardId).attack;
  // Riding past standing troops is a 1-orb strike, whatever the rider's attack.
  if (target === "base") return {baseDamage: enemy.board.some(Boolean) ? 1 : attack, targetLeft: null, attackerLeft: attacker.health};
  const defender = enemy.board[target];
  const targetLeft = Math.max(0, defender.health - attack);
  const baseDamage = Math.max(0, attack - defender.health);
  const attackerLeft = targetLeft > 0 ? Math.max(0, attacker.health - cardOf(defender.cardId).attack) : attacker.health;
  return {baseDamage, targetLeft, attackerLeft};
}

function attack(next, action, events) {
  const side = next.active;
  const own = next.sides[side];
  const enemySide = opponent(side);
  const enemy = next.sides[enemySide];
  const attacker = own.board[action.slot];
  attacker.attacked = true;
  next.attacking = true;
  if (enemy.traps.length) {
    const trapId = enemy.traps.shift();
    enemy.discard.push(trapId);
    const effect = cardOf(trapId).effect;
    if (effect === "snare") attacker.health = Math.max(0, attacker.health - 2);
    const stopped = effect === "hex" || attacker.health === 0;
    events.push({type: "trap", side: enemySide, cardId: trapId, target: attacker.cardId, left: attacker.health, stopped});
    if (attacker.health === 0) defeat(own, action.slot);
    if (stopped) return;
  }
  const outcome = attackOutcome(next, action.slot, action.target);
  events.push({type: "attack", side, cardId: attacker.cardId, target: action.target === "base" ? "base" : enemy.board[action.target].cardId, ...outcome});
  if (action.target !== "base") {
    const defender = enemy.board[action.target];
    defender.health = outcome.targetLeft;
    attacker.health = outcome.attackerLeft;
    // Last Stand: the one defeated takes an orb off the one still standing.
    for (const [fallen, standing] of [[defender, attacker], [attacker, defender]]) {
      if (fallen.health === 0 && standing.health > 0 && has(fallen.cardId, "laststand")) {
        standing.health -= 1;
        events.push({type: "laststand", side: fallen === defender ? enemySide : side, cardId: fallen.cardId, target: standing.cardId, left: standing.health});
      }
    }
    if (defender.health === 0) defeat(enemy, action.target);
    if (has(attacker.cardId, "sweep")) {
      const swept = enemy.board.flatMap((troop, slot) => (troop && slot !== action.target ? [slot] : []));
      for (const slot of swept) if ((enemy.board[slot].health -= 1) === 0) defeat(enemy, slot);
      if (swept.length) events.push({type: "sweep", side, cardId: attacker.cardId, count: swept.length});
    }
    if (attacker.health === 0) defeat(own, action.slot);
  }
  enemy.base = Math.max(0, enemy.base - outcome.baseDamage);
}

// Applies one legal action. Returns {state, events}; throws on an illegal one.
export function applyAction(state, action) {
  if (!legalActions(state).some((legal) => sameAction(legal, action))) throw new Error(`illegal action ${JSON.stringify(action)}`);
  const next = structuredClone(state);
  const side = next.active;
  const own = next.sides[side];
  const enemySide = opponent(side);
  const enemy = next.sides[enemySide];
  const events = [];
  if (action.type === "summon") {
    for (const slot of action.tributes) {
      events.push({type: "tribute", side, cardId: own.board[slot].cardId});
      defeat(own, slot);
    }
    own.hand.splice(own.hand.indexOf(action.cardId), 1);
    own.board[own.board.indexOf(null)] = {cardId: action.cardId, health: cardOf(action.cardId).health, attacked: false, stunned: false, arrived: next.turn};
    next.summonUsed = true;
    events.push({type: "summon", side, cardId: action.cardId});
    if (has(action.cardId, "scout")) draw(next, side, events);
    const risen = has(action.cardId, "raise") ? own.discard.findLastIndex((id) => cardOf(id).kind === "troop" && cardOf(id).tag === "Undead") : -1;
    if (risen >= 0 && own.board.includes(null)) {
      const [cardId] = own.discard.splice(risen, 1);
      own.board[own.board.indexOf(null)] = {cardId, health: 1, attacked: false, stunned: false, arrived: next.turn};
      events.push({type: "raise", side, cardId});
    }
  } else if (action.type === "spell") {
    const effect = cardOf(action.cardId).effect;
    own.hand.splice(own.hand.indexOf(action.cardId), 1);
    own.discard.push(action.cardId);
    next.castUsed = true;
    const hit = effect === "hellfire" ? enemy.board.flatMap((troop, slot) => (troop ? [slot] : [])) : [action.target];
    for (const slot of hit) {
      const troop = enemy.board[slot];
      if (effect === "tie") troop.stunned = true;
      else troop.health -= 1;
      events.push({type: "spell", side, cardId: action.cardId, target: troop.cardId, left: troop.health, stunned: effect === "tie"});
      if (troop.health === 0) defeat(enemy, slot);
    }
  } else if (action.type === "set") {
    own.hand.splice(own.hand.indexOf(action.cardId), 1);
    own.traps.push(action.cardId);
    next.setUsed = true;
    events.push({type: "set", side});
  } else if (action.type === "attack") {
    attack(next, action, events);
    finish(next);
  } else {
    for (const troop of own.board) if (troop) troop.stunned = false;
    next.active = enemySide;
    next.turn += 1;
    next.summonUsed = next.castUsed = next.setUsed = next.attacking = false;
    for (const troop of enemy.board) if (troop) troop.attacked = false;
    events.push({type: "turn", side: enemySide, turn: next.turn});
    if (next.turn > TURN_CAP) {
      const [a, b] = [next.sides.cowboy.base, next.sides.wizard.base];
      next.result = {winner: a === b ? null : a > b ? "cowboy" : "wizard", reason: "turn-cap"};
    } else {
      draw(next, enemySide, events, {fatigue: true});
      finish(next);
    }
  }
  return {state: next, events};
}

// The opponent: tries every way to play out its turn and keeps the best final position.
const worth = (troop) => (2 * cardOf(troop.cardId).attack + troop.health + 2 * cardOf(troop.cardId).keys.length) * (troop.stunned ? .5 : 1);
function evaluate(state, side) {
  if (state.result) return state.result.winner === side ? 10000 : state.result.winner === null ? 0 : -10000;
  const own = state.sides[side];
  const enemy = state.sides[opponent(side)];
  const material = (s) => s.board.reduce((sum, troop) => sum + (troop ? worth(troop) : 0), 0);
  // An empty board is an open Base: count the hits the other side's troops would land.
  const exposed = own.board.some(Boolean) ? 0 : enemy.board.reduce((sum, troop) => sum + (troop ? cardOf(troop.cardId).attack : 0), 0);
  return 8 * (own.base - enemy.base) + material(own) - material(enemy) - 6 * exposed + own.hand.length + 3 * own.traps.length;
}

// The list of actions for the active side's whole turn, ending with {type: "end"}.
// It plans as if the other side had no traps set, because it cannot see them.
// shortcut: the plan can see the top of its own deck through Scout; hide the deck order if this bot is kept.
export function planTurn(state) {
  const side = state.active;
  const blind = structuredClone(state);
  blind.sides[opponent(side)].traps = [];
  let best = null;
  const seen = new Set();
  (function explore(current, plan) {
    const key = JSON.stringify([current.sides, current.summonUsed, current.castUsed, current.setUsed, current.attacking]);
    if (seen.has(key)) return;
    seen.add(key);
    for (const action of legalActions(current)) {
      const next = action.type === "end" ? current : applyAction(current, action).state;
      if (action.type === "end" || next.result) {
        const value = evaluate(next, side);
        if (!best || value > best.value) best = {value, plan: [...plan, action]};
      } else explore(next, [...plan, action]);
    }
  })(blind, []);
  return best.plan;
}

// A weaker opponent's next action, for a new player's first duels.
// Level 0 takes any legal action it has. Level 1 takes the single action that looks best right now.
function simpleStep(state, level) {
  const side = state.active;
  const blind = structuredClone(state);
  blind.sides[opponent(side)].traps = [];
  const moves = legalActions(blind).filter((action) => action.type !== "end");
  if (level === 0) {
    if (!moves.length) return {type: "end"};
    // The position picks the action, so a deal replays the same way.
    let hash = 0;
    for (const char of JSON.stringify(blind.sides)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return moves[hash % moves.length];
  }
  let best = {type: "end"};
  let value = evaluate(blind, side);
  for (const action of moves) {
    const after = evaluate(applyAction(blind, action).state, side);
    if (after > value) [best, value] = [action, after];
  }
  return best;
}

// Plays the active side's whole turn with the bot. Level 2 plans the whole turn; 0, 1 and 1.5 are weaker opponents.
// A sprung trap changes the board, so the rest of a plan is made again.
export function playTurn(state, level = 2) {
  const side = state.active;
  // Level 1.5 plans every other turn of its own and plays the rest as level 1.
  if (level === 1.5) level = Math.floor(state.turn / 2) % 2 ? 1 : 2;
  const events = [];
  let plan = level === 2 ? planTurn(state) : [simpleStep(state, level)];
  while (plan.length && !state.result && state.active === side) {
    const applied = applyAction(state, plan.shift());
    state = applied.state;
    events.push(...applied.events);
    if (state.result || state.active !== side) break;
    if (level !== 2) plan = [simpleStep(state, level)];
    else if (applied.events.some((event) => event.type === "trap")) plan = planTurn(state);
  }
  return {state, events};
}
