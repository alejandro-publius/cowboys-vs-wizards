// Showdown rules: a prototype fight where the player chooses every attack.
// Pure: no DOM. Uses the production cards, decks and seeded shuffle; only the fight differs.
//
// A turn: draw one card, then summon up to one troop (tributes as in the duel) and cast up
// to one spell, then attack once with each troop, then end the turn. Once you attack, the
// summon and the spell are gone for that turn, so a troop cannot attack and then be tributed
// for a second attacker.
// An attack: your troop deals its attack to an enemy troop you choose. Damage beyond the
// target's last orb hits its owner's Base. A target that survives hits back.
// A troop may strike a Base directly only when that side has no troops.
// A free troop cannot attack on the turn it arrives. A troop paid for with a tribute can.
import {CARDS, opponent, tributeCost} from "../../src/game/cards.js";
import {createMatch} from "../../src/game/state.js";

export const BOARD_SIZE = 3;
// shortcut: a turn cap stands in for running out of cards; replace with a real deck-out rule if this fight is kept.
export const TURN_CAP = 30;

// Same deal as the duel on this seed: hands, deck order and who goes first.
export function createShowdown(seed, {baseOrbs = 5} = {}) {
  const deal = createMatch(seed);
  const sides = {};
  for (const side of ["cowboy", "wizard"]) {
    const {hand, deck} = deal.sides[side];
    sides[side] = {base: baseOrbs, hand: [...hand], deck: [...deck], board: Array(BOARD_SIZE).fill(null), discard: []};
  }
  return {seed, turn: 1, active: deal.startingSide, first: deal.startingSide, summonUsed: false, castUsed: false, attacking: false, result: null, sides};
}

// Free troops rest on the turn they arrive; tribute-summoned troops strike at once.
export const canAttack = (state, troop) => Boolean(troop) && state.turn > 1 && !troop.attacked
  && !(troop.arrived === state.turn && tributeCost(CARDS[troop.cardId].stars) === 0);

const combinations = (items, size) => size === 0 ? [[]]
  : items.flatMap((item, i) => combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]));

// Every action the active side may take now. One entry per card name, so copies are not listed twice.
export function legalActions(state) {
  if (state.result) return [];
  const own = state.sides[state.active];
  const enemy = state.sides[opponent(state.active)];
  const slots = [...own.board.keys()];
  const actions = [];
  const seen = new Set();
  for (const cardId of own.hand) {
    const card = CARDS[cardId];
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    if (state.attacking) break;
    if (card.kind === "troop" && !state.summonUsed) {
      const occupied = slots.filter((slot) => own.board[slot]);
      for (const tributes of combinations(occupied, tributeCost(card.stars))) {
        if (occupied.length - tributes.length < BOARD_SIZE) actions.push({type: "summon", cardId, tributes});
      }
    }
    if (card.kind === "spell" && !state.castUsed) {
      enemy.board.forEach((troop, target) => { if (troop) actions.push({type: "spell", cardId, target}); });
    }
  }
  // Whoever goes first cannot attack on the opening turn.
  if (state.turn > 1) {
    const targets = enemy.board.flatMap((troop, slot) => (troop ? [slot] : []));
    for (const slot of slots) {
      if (!canAttack(state, own.board[slot])) continue;
      if (targets.length === 0) actions.push({type: "attack", slot, target: "base"});
      else for (const target of targets) actions.push({type: "attack", slot, target});
    }
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

// What one attack would do, without changing anything. The screen and the bot both use it.
export function attackOutcome(state, slot, target) {
  const attacker = state.sides[state.active].board[slot];
  const attack = CARDS[attacker.cardId].attack;
  if (target === "base") return {baseDamage: attack, targetLeft: null, attackerLeft: attacker.health};
  const defender = state.sides[opponent(state.active)].board[target];
  const targetLeft = Math.max(0, defender.health - attack);
  const baseDamage = Math.max(0, attack - defender.health);
  const attackerLeft = targetLeft > 0 ? Math.max(0, attacker.health - CARDS[defender.cardId].attack) : attacker.health;
  return {baseDamage, targetLeft, attackerLeft};
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
    const slot = own.board.indexOf(null);
    own.board[slot] = {cardId: action.cardId, health: CARDS[action.cardId].health, attacked: false, arrived: next.turn};
    next.summonUsed = true;
    events.push({type: "summon", side, cardId: action.cardId, slot});
  } else if (action.type === "spell") {
    const troop = enemy.board[action.target];
    own.hand.splice(own.hand.indexOf(action.cardId), 1);
    own.discard.push(action.cardId);
    troop.health -= 1;
    next.castUsed = true;
    events.push({type: "spell", side, cardId: action.cardId, target: troop.cardId, left: troop.health});
    if (troop.health === 0) defeat(enemy, action.target);
  } else if (action.type === "attack") {
    const attacker = own.board[action.slot];
    const outcome = attackOutcome(next, action.slot, action.target);
    attacker.attacked = true;
    next.attacking = true;
    const event = {type: "attack", side, cardId: attacker.cardId, target: action.target === "base" ? "base" : enemy.board[action.target].cardId, ...outcome};
    if (action.target !== "base") {
      enemy.board[action.target].health = outcome.targetLeft;
      if (outcome.targetLeft === 0) defeat(enemy, action.target);
      attacker.health = outcome.attackerLeft;
      if (outcome.attackerLeft === 0) defeat(own, action.slot);
    }
    enemy.base = Math.max(0, enemy.base - outcome.baseDamage);
    events.push(event);
    finish(next);
  } else {
    next.active = enemySide;
    next.turn += 1;
    next.summonUsed = next.castUsed = next.attacking = false;
    for (const troop of enemy.board) if (troop) troop.attacked = false;
    if (next.turn > TURN_CAP) {
      const [a, b] = [next.sides.cowboy.base, next.sides.wizard.base];
      next.result = {winner: a === b ? null : a > b ? "cowboy" : "wizard", reason: "turn-cap"};
    } else if (enemy.deck.length) {
      enemy.hand.push(enemy.deck.shift());
      events.push({type: "draw", side: enemySide});
    }
    events.push({type: "turn", side: enemySide, turn: next.turn});
  }
  return {state: next, events};
}

// The opponent: tries every way to play out its turn and keeps the best final position.
const worth = (troop) => 2 * CARDS[troop.cardId].attack + troop.health;
function evaluate(state, side) {
  if (state.result) return state.result.winner === side ? 10000 : state.result.winner === null ? 0 : -10000;
  const own = state.sides[side];
  const enemy = state.sides[opponent(side)];
  const material = (s) => s.board.reduce((sum, troop) => sum + (troop ? worth(troop) : 0), 0);
  // An empty board is an open Base: count the hits the other side's troops would land.
  const exposed = own.board.some(Boolean) ? 0 : enemy.board.reduce((sum, troop) => sum + (troop ? CARDS[troop.cardId].attack : 0), 0);
  return 8 * (own.base - enemy.base) + material(own) - material(enemy) - 6 * exposed + own.hand.length;
}

// Returns the list of actions for the active side's whole turn, ending with {type: "end"}.
export function planTurn(state) {
  const side = state.active;
  let best = null;
  const seen = new Set();
  (function explore(current, plan) {
    const key = JSON.stringify([current.sides, current.summonUsed, current.castUsed, current.attacking]);
    if (seen.has(key)) return;
    seen.add(key);
    for (const action of legalActions(current)) {
      if (action.type === "end") {
        const value = evaluate(current, side);
        if (!best || value > best.value) best = {value, plan: [...plan, action]};
        continue;
      }
      const next = applyAction(current, action).state;
      if (next.result) {
        const value = evaluate(next, side);
        if (!best || value > best.value) best = {value, plan: [...plan, action]};
      } else explore(next, [...plan, action]);
    }
  })(state, []);
  return best.plan;
}
