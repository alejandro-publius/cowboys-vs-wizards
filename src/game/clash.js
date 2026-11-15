import { CARDS, SIDES, opponent } from "./cards.js";
import { MAX_ROUNDS, SLOT_COUNT } from "./state.js";

// One simultaneous clash on `state`, which must be the working copy inside
// applyAction (it is changed in place). Every number a renderer needs is
// computed here once and reported through `emit`.
export function resolveClash(state, emit) {
  // Snapshot first: a troop brought to zero during this clash still attacks.
  const attacks = [];
  for (let lane = 0; lane < SLOT_COUNT; lane++) {
    for (const side of SIDES) {
      const troop = state.sides[side].board[lane];
      if (troop) attacks.push({ lane, side, cardId: troop.cardId, amount: CARDS[troop.cardId].attack });
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

// Result after a clash, or null when the match goes on. `winner` and `loser`
// are both null for a draw.
export function resultAfterClash(state) {
  const [a, b] = SIDES;
  const orbs = { [a]: state.sides[a].baseOrbs, [b]: state.sides[b].baseOrbs };
  const destroyed = orbs[a] === 0 || orbs[b] === 0;
  if (!destroyed && state.round < MAX_ROUNDS) return null;
  const reason = destroyed ? "base-destroyed" : "round-limit";
  if (orbs[a] === orbs[b]) return { winner: null, loser: null, reason, round: state.round };
  const winner = orbs[a] > orbs[b] ? a : b;
  return { winner, loser: opponent(winner), reason, round: state.round };
}
