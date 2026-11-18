// Deterministic CPU for either side. Pure: no DOM, filesystem, network, model
// call, clock or random source. Its only input is publicState(state, side)
// for the side it plays, so it cannot see the opponent's hand, a deck order
// or the seed.
//
// Heuristic: one clash of lookahead, no search. An action is scored by the
// position it would leave after the next clash if the opponent added nothing:
//   +5 per own base orb left, -4 per enemy base orb left (defence weighs a
//   little more, so an even block beats an even race),
//   +1000 if the enemy base would be at zero, -1000 if its own would be,
//   + worth of each own surviving troop, - worth of each enemy surviving
//   troop, where worth = 2 x attack + remaining health.
// A tribute is therefore paid only when the new troop is worth more than what
// it replaces, lanes included.
//
// Order within a phase (the engine forbids a summon after a spell):
//   1. the best summon, if it scores strictly higher than ending the phase now;
//   2. else the best spell, if it gains at least SPELL_MIN_GAIN over ending
//      now: a kill, a kill set up for this clash, or a move that changes base
//      damage. One point of chip damage alone gains 1 and is held back;
//   3. else end-phase.
// Ties go to the action listed first by legalActions (hand order, then slot).
// The engine allows one summon and one cast per phase, so a phase is at most
// summon, spell, end-phase.
//
// Trap matches only (view.traps.enabled, issue #95 T5, contract section 6):
// between steps 1 and 2, if its own hand holds a trap card, its own zone is
// empty, the round is before the last and a set-trap is legal, it sets the
// first such trap (hand order) instead of casting. The set uses the phase's
// one tactical action. It reads only its own hand and zone; the opponent's
// face-down trap is never consulted. With traps off, or on with no trap in
// hand, the choice is the one above, unchanged.
//
// Ride Out matches only (view.rideOut.enabled, .kiro/specs/ride-out RO-8):
// legalActions also lists ride-outs, after every shipped action type. Step 1
// above becomes "the best summon or ride-out", scored by the same one-clash
// projection with the troop in its new lane. Summons are listed first and a
// later action must score strictly higher, so a summon wins a tie. A spell may
// still follow a ride-out. Off, or with no ride-out listed, nothing changes.
import { CARDS, SPELL_DAMAGE, opponent } from "./cards.js";
import { legalActions } from "./legal.js";
import { shiftTroop } from "./lanes.js";
import { MAX_ROUNDS } from "./state.js";

const OWN_ORB = 5;
const ENEMY_ORB = 4;
const BASE_DOWN = 1000;
const SPELL_MIN_GAIN = 3;

const worth = (cardId, health) => (health > 0 ? 2 * CARDS[cardId].attack + health : 0);

// Both boards as they would stand after `action`, from public information.
function boardsAfter(view, action) {
  const mine = view.sides[view.viewer].board.map((troop) => troop && { ...troop });
  const theirs = view.sides[opponent(view.viewer)].board.map((troop) => troop && { ...troop });
  if (action.type === "summon") {
    for (const slot of action.tributes) mine[slot] = null;
    mine[action.slot] = { cardId: action.cardId, health: CARDS[action.cardId].health };
  } else if (action.type === "spell") {
    const troop = theirs[action.target];
    theirs[action.target] = null;
    troop.health -= SPELL_DAMAGE;
    if (troop.health > 0) theirs[action.destination ?? action.target] = troop;
  } else if (action.type === "ride-out") {
    shiftTroop(mine, action.slot, action.destination);
  }
  return { mine, theirs };
}

function score(view, action) {
  const { mine, theirs } = boardsAfter(view, action);
  let ownBase = view.sides[view.viewer].baseOrbs;
  let enemyBase = view.sides[opponent(view.viewer)].baseOrbs;
  let total = 0;
  for (let lane = 0; lane < mine.length; lane++) {
    const own = mine[lane];
    const enemy = theirs[lane];
    const ownAttack = own ? CARDS[own.cardId].attack : 0;
    const enemyAttack = enemy ? CARDS[enemy.cardId].attack : 0;
    if (own) total += worth(own.cardId, own.health - enemyAttack);
    else ownBase -= enemyAttack;
    if (enemy) total -= worth(enemy.cardId, enemy.health - ownAttack);
    else enemyBase -= ownAttack;
  }
  ownBase = Math.max(0, ownBase);
  enemyBase = Math.max(0, enemyBase);
  total += OWN_ORB * ownBase - ENEMY_ORB * enemyBase;
  if (enemyBase === 0) total += BASE_DOWN;
  if (ownBase === 0) total -= BASE_DOWN;
  return total;
}

// First action of one of `types` with the highest score, if that score reaches `floor`.
function best(view, actions, types, floor) {
  let pick = null;
  let top = floor;
  for (const action of actions) {
    if (!types.includes(action.type)) continue;
    const value = score(view, action);
    if (pick === null ? value >= top : value > top) [pick, top] = [action, value];
  }
  return pick;
}

// The trap-set step above, or null. Every condition reads the viewer's own side.
function trapSet(view, actions, cards) {
  if (view.traps?.enabled !== true || view.round >= MAX_ROUNDS) return null;
  const own = view.sides[view.viewer];
  if (own.trap !== null) return null;
  return actions.find((action) => action.type === "set-trap" && own.hand.includes(action.cardId) && cards[action.cardId]?.kind === "trap") ?? null;
}

// `view` must be publicState(state, side) for the side to act. Returns one of
// legalActions(view, view.viewer, { cards }), or null when that list is empty
// (not this side's phase, or the match is over).
// `options.cards` is passed to legalActions for kind lookups, as there; only
// tests pass it, with a fixture trap card. Board troops are always scored from CARDS.
export function chooseAction(view, { cards = CARDS } = {}) {
  const actions = legalActions(view, view.viewer, { cards });
  if (actions.length === 0) return null;
  const end = actions.at(-1); // end-phase is always listed last
  const stay = score(view, end);
  return (
    best(view, actions, ["summon", "ride-out"], stay + 1) ??
    trapSet(view, actions, cards) ??
    best(view, actions, ["spell"], stay + SPELL_MIN_GAIN) ??
    end
  );
}

// Difficulty levels, an opt-in preview (?cpu=easy|normal|hard). `normal` is
// chooseAction above, unchanged. Each level is pure and deterministic and
// reads only the same public view.
//
// easy: normal's summons, but it never casts a spell. Where normal would
//   cast, easy ends its phase.
// hard: the same kind of scoring as normal with three differences. It plays
//   out the next two clashes instead of one, so it values a troop that will
//   still be standing and sees a Base race one round sooner. It scores a
//   summon together with the best spell that could follow it in the same
//   phase. And it weighs the enemy Base slightly above its own (5 against 4),
//   where normal does the reverse. The weights were chosen on seeds 0-999;
//   docs/evidence/cpu-difficulty.md reports other seeds.
//   On a Ride Out match a ride-out is valued like a summon (alone, or with the
//   best spell that may follow). It comes last in the loop, so it replaces the
//   pick only with a strictly higher value.
//
// Every level takes the same optional `{ cards }` as chooseAction (issue
// #112); only tests pass it, with fixture trap cards. On a trap match:
// easy: chooseAction's choice with `cards`, so it sets a held trap exactly
//   where normal would; a spell is still replaced by end-phase.
// hard: its scoring never sees set-trap. When its pick is not a summon (a
//   spell or end-phase) and normal's trap-set step applies, it sets that trap
//   instead. A summon is kept; the next choice of the phase may then set.
// Without a trap in hand, or with traps off, every level is unchanged.
export const CPU_LEVELS = Object.freeze(["easy", "normal", "hard"]);

function chooseEasy(view, { cards = CARDS } = {}) {
  const action = chooseAction(view, { cards });
  return action?.type === "spell" ? legalActions(view, view.viewer, { cards }).at(-1) : action;
}

const HARD_OWN_ORB = 4;
const HARD_ENEMY_ORB = 5;
const HARD_CLASHES = 2;
const HARD_LATER_WIN = 0.5; // a Base that falls in the second clash counts half
const HARD_SPELL_COST = 2; // a spell must gain more than this to be worth its card

// The viewer's own view as it would stand after `action`: boards, own hand and allowances.
function viewAfter(view, action) {
  const next = structuredClone(view);
  const own = next.sides[next.viewer];
  const { mine, theirs } = boardsAfter(view, action);
  own.board = mine;
  next.sides[opponent(next.viewer)].board = theirs;
  // A ride-out plays no card and uses the summon allowance.
  if (action.type !== "ride-out") own.hand.splice(own.hand.indexOf(action.cardId), 1);
  next.allowances[next.viewer][action.type === "spell" ? "castUsed" : "summonUsed"] = true;
  return next;
}

// Score after HARD_CLASHES clashes if neither side added anything more.
function hardScore(view) {
  let mine = view.sides[view.viewer].board;
  let theirs = view.sides[opponent(view.viewer)].board;
  let ownBase = view.sides[view.viewer].baseOrbs;
  let enemyBase = view.sides[opponent(view.viewer)].baseOrbs;
  let total = 0;
  for (let clash = 0; clash < HARD_CLASHES; clash++) {
    const hit = (board, other) => board.map((troop, lane) => {
      if (!troop) return null;
      const health = troop.health - (other[lane] ? CARDS[other[lane].cardId].attack : 0);
      return health > 0 ? { cardId: troop.cardId, health } : null;
    });
    mine.forEach((own, lane) => {
      if (!own && theirs[lane]) ownBase -= CARDS[theirs[lane].cardId].attack;
      if (own && !theirs[lane]) enemyBase -= CARDS[own.cardId].attack;
    });
    [mine, theirs] = [hit(mine, theirs), hit(theirs, mine)];
    ownBase = Math.max(0, ownBase);
    enemyBase = Math.max(0, enemyBase);
    const weight = clash === 0 ? 1 : HARD_LATER_WIN;
    if (ownBase === 0) {
      total -= BASE_DOWN * weight;
      break;
    }
    if (enemyBase === 0) {
      total += BASE_DOWN * weight;
      break;
    }
  }
  total += HARD_OWN_ORB * ownBase - HARD_ENEMY_ORB * enemyBase;
  for (const troop of mine) if (troop) total += worth(troop.cardId, troop.health);
  for (const troop of theirs) if (troop) total -= worth(troop.cardId, troop.health);
  return total;
}

function chooseHard(view, { cards = CARDS } = {}) {
  const actions = legalActions(view, view.viewer, { cards });
  if (actions.length === 0) return null;
  let pick = actions.at(-1);
  let top = hardScore(view);
  for (const action of actions) {
    if (action.type === "end-phase" || action.type === "set-trap") continue;
    const next = viewAfter(view, action);
    let value = hardScore(next);
    if (action.type === "spell") value -= HARD_SPELL_COST;
    else {
      for (const follow of legalActions(next, next.viewer, { cards })) {
        if (follow.type === "spell") value = Math.max(value, hardScore(viewAfter(next, follow)) - HARD_SPELL_COST);
      }
    }
    if (value > top) [pick, top] = [action, value];
  }
  return pick.type === "summon" ? pick : trapSet(view, actions, cards) ?? pick;
}

// The chooser for a level name. Anything that is not "easy" or "hard",
// including a missing name, is the unchanged normal opponent. Each chooser
// is called as (view, { cards }?).
export function cpuFor(level) {
  return level === "easy" ? chooseEasy : level === "hard" ? chooseHard : chooseAction;
}
