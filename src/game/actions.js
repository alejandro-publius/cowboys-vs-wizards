import { CARDS, SPELL_DAMAGE, opponent, tributeCost } from "./cards.js";
import { MAX_ROUNDS } from "./state.js";
import { resolveClash, resultAfterClash } from "./clash.js";
import { adjacentLanes, isSlot, shiftDestinations, shiftTroop } from "./lanes.js";

// On a trap match (issue #89/#90, A + X) the cast and the set share castUsed;
// tactical records which one used it. Off, tactical is absent and this is false.
const trapUsed = (state, side) => state.traps?.enabled === true && state.allowances[side].tactical === "trap";

// Each *Rejection reads only and returns why the action cannot be applied, or
// null when it is legal. The first failing check wins.
function summonRejection(state, action) {
  const { summonUsed, castUsed } = state.allowances[action.side];
  if (summonUsed) return "summon-used";
  if (castUsed) return trapUsed(state, action.side) ? "summon-after-trap" : "summon-after-spell";

  const { hand, board } = state.sides[action.side];
  if (!hand.includes(action.cardId)) return "card-not-in-hand";
  const card = CARDS[action.cardId];
  if (card?.kind !== "troop") return "not-a-troop";

  const tributes = action.tributes;
  if (
    !Array.isArray(tributes) ||
    new Set(tributes).size !== tributes.length ||
    !tributes.every((slot) => isSlot(slot) && board[slot] !== null && board[slot].cardId !== state.bountyTarget)
  ) {
    return "invalid-tribute";
  }
  const cost = tributeCost(card.stars);
  if (tributes.length < cost) return "unpaid";
  if (tributes.length > cost) return "overpaid";

  if (!isSlot(action.slot)) return "invalid-slot";
  // A tribute vacates its slot, so the summon may land there.
  if (board[action.slot] !== null && !tributes.includes(action.slot)) return "slot-occupied";
  return null;
}

function spellRejection(state, action) {
  if (state.allowances[action.side].castUsed) return trapUsed(state, action.side) ? "cast-after-trap" : "cast-used";
  if (!state.sides[action.side].hand.includes(action.cardId)) return "card-not-in-hand";
  const card = CARDS[action.cardId];
  if (card?.kind !== "spell") return "not-a-spell";

  // Every troop on a board is alive: defeated troops leave as they die.
  const enemyBoard = state.sides[opponent(action.side)].board;
  if (!isSlot(action.target) || enemyBoard[action.target] === null) return "invalid-target";

  // undefined or null means no relocation.
  if (action.destination == null) return null;
  const legalMove =
    card.relocates &&
    enemyBoard[action.target].health > SPELL_DAMAGE &&
    shiftDestinations(enemyBoard, action.target).includes(action.destination);
  return legalMove ? null : "invalid-destination";
}

// Ride Out experiment (.kiro/specs/ride-out, RO-4): the move uses the summon
// allowance, so it shares the summon's reason and, like a summon, cannot
// follow a spell. Reached only on a match created with rideOut: true.
function rideOutRejection(state, action) {
  const { summonUsed, castUsed } = state.allowances[action.side];
  if (summonUsed) return "summon-used";
  if (castUsed) return "ride-out-after-spell";
  const { board } = state.sides[action.side];
  if (!isSlot(action.slot) || board[action.slot] === null) return "invalid-slot";
  if (!adjacentLanes(action.slot).includes(action.destination)) return "invalid-destination";
  if (board[action.destination] !== null) return "destination-occupied";
  return null;
}

// Contract section 3 order. `cards` is the lookup for the card kind; it is
// CARDS unless a caller (only tests today) passes a catalog holding a trap
// card, since the shipped catalog has none.
function setTrapRejection(state, action, cards) {
  if (state.traps?.enabled !== true) return "traps-disabled";
  const own = state.sides[action.side];
  if (!own.hand.includes(action.cardId)) return "card-not-in-hand";
  if (cards[action.cardId]?.kind !== "trap") return "not-a-trap";
  if (state.round === MAX_ROUNDS) return "trap-too-late";
  if (own.trap !== null) return "trap-zone-full";
  if (state.allowances[action.side].castUsed) return "trap-after-spell";
  return null;
}

const REJECTIONS = {
  summon: summonRejection,
  spell: spellRejection,
  "set-trap": setTrapRejection,
  "ride-out": rideOutRejection,
  "end-phase": () => null,
};

function rejection(state, action, cards) {
  if (state.result) return "match-over";
  if (action === null || typeof action !== "object" || !Object.hasOwn(REJECTIONS, action.type)) return "invalid-action";
  // Without the flag the move does not exist: same reason and order as an unknown type.
  if (action.type === "ride-out" && state.rideOut?.enabled !== true) return "invalid-action";
  const { actionId } = action;
  if (actionId !== undefined) {
    if (typeof actionId !== "string" || actionId === "") return "invalid-action";
    if (state.actionIds.includes(actionId)) return "duplicate-action";
  }
  if (action.revision !== state.revision) return "stale";
  if (action.side !== state.activeSide) return "wrong-side";
  return REJECTIONS[action.type](state, action, cards);
}

// The apply* functions run only after validation, on the working copy.
function finishMatch(state, result, emit) {
  state.result = result;
  state.activeSide = null;
  emit({type: "result", result: {...result}});
}
function applySummon(next, action, emit) {
  const own = next.sides[action.side];
  for (const slot of action.tributes) {
    own.discard.push(own.board[slot].cardId);
    own.board[slot] = null;
  }
  own.hand.splice(own.hand.indexOf(action.cardId), 1);
  own.board[action.slot] = { cardId: action.cardId, health: CARDS[action.cardId].health };
  next.allowances[action.side].summonUsed = true;
  emit({ type: "summon", side: action.side, cardId: action.cardId, slot: action.slot, tributes: [...action.tributes] });
}

function applySpell(next, action, emit) {
  const own = next.sides[action.side];
  const enemySide = opponent(action.side);
  const enemy = next.sides[enemySide];
  const troop = enemy.board[action.target];
  const before = troop.health;
  troop.health = before - SPELL_DAMAGE;
  own.hand.splice(own.hand.indexOf(action.cardId), 1);
  own.discard.push(action.cardId);
  next.allowances[action.side].castUsed = true;
  if (next.traps?.enabled === true) next.allowances[action.side].tactical = "spell";

  const moved = action.destination != null;
  emit({
    type: "spell",
    spell: CARDS[action.cardId].name,
    cardId: action.cardId,
    caster: action.side,
    target: { side: enemySide, slot: action.target, cardId: troop.cardId },
    before,
    after: troop.health,
    ...(moved && { destination: action.destination }),
  });
  if (troop.health === 0) {
    enemy.board[action.target] = null;
    enemy.discard.push(troop.cardId);
    emit({ type: "defeat", side: enemySide, slot: action.target, cardId: troop.cardId });
    if (troop.cardId === next.bountyTarget) finishMatch(next, resultAfterClash(next), emit);
  } else if (moved) {
    shiftTroop(enemy.board, action.target, action.destination);
  }
}

// Own troop one lane over, health kept; no card changes zone and no RNG draw.
function applyRideOut(next, action, emit) {
  const { board } = next.sides[action.side];
  const { cardId, health } = board[action.slot];
  shiftTroop(board, action.slot, action.destination);
  next.allowances[action.side].summonUsed = true;
  emit({ type: "ride-out", side: action.side, cardId, slot: action.slot, destination: action.destination, health });
}

// Hand to own trap zone. No RNG draw. The event names the card; hiding it
// from the opponent is the public view's job (T4).
function applySetTrap(next, action, emit) {
  const own = next.sides[action.side];
  own.hand.splice(own.hand.indexOf(action.cardId), 1);
  own.trap = { cardId: action.cardId, setRound: next.round };
  next.allowances[action.side].castUsed = true;
  next.allowances[action.side].tactical = "trap";
  emit({ type: "trap-set", side: action.side, cardId: action.cardId });
}

// The first side's end hands the phase over. The second side's end runs the
// clash, then either records the result or starts the next round.
function applyEndPhase(next, action, emit) {
  emit({ type: "phase-end", side: action.side, round: next.round });
  if (action.side === next.startingSide) {
    next.activeSide = opponent(action.side);
    emit({ type: "phase-start", side: next.activeSide, round: next.round });
    return;
  }

  emit({ type: "clash", round: next.round });
  resolveClash(next, emit);
  const result = resultAfterClash(next);
  if (result) {
    finishMatch(next, result, emit);
    return;
  }

  next.round += 1;
  next.startingSide = opponent(next.startingSide);
  next.activeSide = next.startingSide;
  emit({ type: "round-start", round: next.round, startingSide: next.startingSide });
  for (const side of [next.startingSide, opponent(next.startingSide)]) {
    next.allowances[side] = next.traps?.enabled
      ? { summonUsed: false, castUsed: false, tactical: null }
      : { summonUsed: false, castUsed: false };
    const own = next.sides[side];
    if (own.deck.length === 0) continue; // an empty deck just draws nothing
    own.hand.push(own.deck.shift());
    emit({ type: "draw", side }); // the card itself is not public
  }
  emit({ type: "phase-start", side: next.activeSide, round: next.round });
}

const APPLY = { summon: applySummon, spell: applySpell, "set-trap": applySetTrap, "ride-out": applyRideOut, "end-phase": applyEndPhase };

// Apply one action to a match state. Never mutates `state`.
//   accepted: { ok: true, state: <new state>, events: [...] }
//   rejected: { ok: false, reason, state: <the same input object> }
// Actions (all take `side`, `revision` and an optional `actionId` string):
//   { type: "summon", cardId, slot, tributes }   tributes: own slots to sacrifice
//   { type: "spell", cardId, target, destination? }   enemy slot indexes
//   { type: "set-trap", cardId }   only on a match created with traps: true
//   { type: "ride-out", slot, destination }   own lanes; only with rideOut: true
//   { type: "end-phase" }
// `options.cards` replaces CARDS for the set-trap kind check only (tests use
// it for a fixture trap card; the shipped catalog has no trap).
// Every event carries `revision` (the revision the action was applied to; the
// new state is one higher) and the action's `actionId` when it had one.
export function applyAction(state, action, { cards = CARDS } = {}) {
  const reason = rejection(state, action, cards);
  if (reason) return { ok: false, reason, state };

  // Everything validated: change a copy, so the action is all-or-nothing.
  const next = structuredClone(state);
  const events = [];
  const stamp = { revision: state.revision };
  if (action.actionId !== undefined) {
    stamp.actionId = action.actionId;
    next.actionIds.push(action.actionId);
  }
  APPLY[action.type](next, action, (event) => events.push({ ...event, ...stamp }));
  next.revision += 1;
  return { ok: true, state: next, events };
}
