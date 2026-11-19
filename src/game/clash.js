import { CARDS, SIDES, opponent } from "./cards.js";
import { MAX_ROUNDS, SLOT_COUNT } from "./state.js";
import { adjacentLanes, shiftTroop } from "./lanes.js";
// Lantern Wraith hunts: `state.bountyDrift = { round, destination }` marks the
// Wizard lane the wanted troop moves into just before that round's clash. It
// stays put when it is gone, the lane is taken or the lane is not adjacent.
// The pending move { slot, destination }, or null. The clash, its previews
// and the lane mark all read this one function.
export function pendingDrift(state) {
  const drift = state.bountyDrift;
  if (!drift || !state.bountyTarget || state.round !== drift.round) return null;
  const board = state.sides.wizard.board;
  const slot = board.findIndex((troop) => troop?.cardId === state.bountyTarget);
  if (slot < 0 || board[drift.destination] !== null || !adjacentLanes(slot).includes(drift.destination)) return null;
  return { slot, destination: drift.destination };
}

// Dragon Fire (opt-in, `state.dragonFire.enabled`): the Wizard's Dragon and the
// Captured Dragon send the part of an attack their blocker cannot absorb to
// the blocker's Base. An open lane and every other card are unchanged.
export const isFireCard = (cardId) => /^(wizard-dragon|cowboy-captured-dragon)-\d+$/.test(cardId);

// Damage that burns past a blocker with `blockerHealth` orbs, or 0.
export function fireBurn(enabled, cardId, blockerHealth) {
  return enabled === true && isFireCard(cardId) ? Math.max(0, CARDS[cardId].attack - blockerHealth) : 0;
}

// One simultaneous clash on `state`, which must be the working copy inside
// applyAction (it is changed in place). Every number a renderer needs is
// computed here once and reported through `emit`.
export function resolveClash(state, emit) {
  // The wanted troop's marked move happens first, through the Ride Out seam.
  const drift = pendingDrift(state);
  if (drift) {
    const { board } = state.sides.wizard;
    const { cardId, health } = board[drift.slot];
    shiftTroop(board, drift.slot, drift.destination);
    emit({ type: "ride-out", side: "wizard", cardId, slot: drift.slot, destination: drift.destination, health, drift: true });
  }
  // Traps read the board before any damage, so both sides' choices come from
  // the same snapshot and a cancelled troop still blocks and takes damage.
  const cancelled = state.traps?.enabled === true ? triggerTraps(state, emit) : [];

  // Snapshot first: a troop brought to zero during this clash still attacks.
  const attacks = [];
  for (let lane = 0; lane < SLOT_COUNT; lane++) {
    for (const side of SIDES) {
      const troop = state.sides[side].board[lane];
      if (troop && !cancelled.includes(`${side}:${lane}`)) attacks.push({ lane, side, cardId: troop.cardId, amount: CARDS[troop.cardId].attack });
    }
  }

  // Defeated troops stay in their slots until all damage is applied, so a
  // blocker absorbs the whole attack and nothing spills to the base.
  for (const { lane, side, cardId, amount } of attacks) {
    const enemySide = opponent(side);
    const enemy = state.sides[enemySide];
    const blocker = enemy.board[lane];
    const before = blocker ? blocker.health : enemy.baseOrbs;
    const after = Math.max(0, before - amount);
    if (blocker) blocker.health = after;
    else enemy.baseOrbs = after;
    emit({
      type: "damage",
      lane,
      attacker: { side, slot: lane, cardId },
      target: blocker
        ? { kind: "troop", side: enemySide, slot: lane, cardId: blocker.cardId }
        : { kind: "base", side: enemySide },
      amount,
      before,
      after,
    });
    const burn = blocker ? fireBurn(state.dragonFire?.enabled, cardId, before) : 0;
    if (burn > 0) {
      const baseBefore = enemy.baseOrbs;
      enemy.baseOrbs = Math.max(0, baseBefore - burn);
      emit({
        type: "damage",
        lane,
        attacker: { side, slot: lane, cardId },
        target: { kind: "base", side: enemySide },
        amount: burn,
        before: baseBefore,
        after: enemy.baseOrbs,
        fire: true,
      });
    }
  }

  for (let lane = 0; lane < SLOT_COUNT; lane++) {
    for (const side of SIDES) {
      const own = state.sides[side];
      const troop = own.board[lane];
      if (troop?.health !== 0) continue;
      own.board[lane] = null;
      own.discard.push(troop.cardId);
      emit({ type: "defeat", side, slot: lane, cardId: troop.cardId });
    }
  }
}

// Trap trigger (issue #92, T3; contract sections 2, 4, 5, effect X). Called
// only on a trap match, before any damage. A trap is armed from the round
// after it was set. An armed trap targets the enemy troop with the highest
// printed attack (tie: lowest slot); with no enemy troop it stays set. Every
// choice is made on the untouched board before any trap leaves its zone, so
// the result does not depend on SIDES order. The trap card moves to its
// owner's discard in this transition; there is no separate discard event.
// Returns the cancelled attackers as "side:slot" keys.
function triggerTraps(state, emit) {
  const triggers = [];
  for (const side of SIDES) {
    const trap = state.sides[side].trap;
    if (!trap || !(state.round > trap.setRound)) continue;
    const enemySide = opponent(side);
    let slot = -1;
    state.sides[enemySide].board.forEach((troop, lane) => {
      if (!troop) return;
      const best = slot === -1 ? -Infinity : CARDS[state.sides[enemySide].board[slot].cardId].attack;
      if (CARDS[troop.cardId].attack > best) slot = lane;
    });
    if (slot !== -1) triggers.push({ side, cardId: trap.cardId, enemySide, slot });
  }

  const cancelled = [];
  for (const { side, cardId, enemySide, slot } of triggers) {
    const target = state.sides[enemySide].board[slot];
    state.sides[side].trap = null;
    state.sides[side].discard.push(cardId);
    cancelled.push(`${enemySide}:${slot}`);
    emit({
      type: "trap-trigger",
      side,
      cardId,
      target: { side: enemySide, slot, cardId: target.cardId },
      cancelled: CARDS[target.cardId].attack,
    });
  }
  return cancelled;
}

// Result after a clash, or null when the match goes on. `winner` and `loser`
// are both null for a draw.
export function resultAfterClash(state) {
  const [a, b] = SIDES;
  const orbs = { [a]: state.sides[a].baseOrbs, [b]: state.sides[b].baseOrbs };
  const destroyed = orbs[a] === 0 || orbs[b] === 0;
  if (state.bountyTarget) {
    const captured = orbs.cowboy > 0 && !state.sides.wizard.board.some((troop) => troop?.cardId === state.bountyTarget);
    if (!captured && !destroyed && state.round < MAX_ROUNDS) return null;
    const winner = captured ? "cowboy" : "wizard";
    return {winner, loser: opponent(winner), reason: captured ? "bounty-captured" : "bounty-escaped", round: state.round};
  }
  if (!destroyed && state.round < MAX_ROUNDS) return null;
  const reason = destroyed ? "base-destroyed" : "round-limit";
  if (orbs[a] === orbs[b]) return { winner: null, loser: null, reason, round: state.round };
  const winner = orbs[a] > orbs[b] ? a : b;
  return { winner, loser: opponent(winner), reason, round: state.round };
}
