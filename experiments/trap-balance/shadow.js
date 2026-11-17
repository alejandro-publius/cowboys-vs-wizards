// SHADOW MODEL for issue #78. Throwaway, dependency-free, headless.
//
// What is real: createMatch, applyAction, publicState, resultAfterClash and the
// production CPU (chooseAction) are imported read-only from src/game and run
// unchanged for every non-trap action. What is shadow: the trap zone, the trap
// fixture card, the trap-set action, the trap trigger inside the clash, and the
// end-phase that runs the clash when a trap variant is active. Those are
// re-implemented here (production has none of them) and validated against the
// real engine by shadow.test.js (a no-trap shadow run must equal real play).
//
// Not real: the CPU does not know traps exist (it reads the unchanged public
// view), the trap fixture is an EXTRA card outside the 12-card deck, and
// set-trap does not bump `revision`. Results are therefore a shadow-model
// comparison, not shipped-game win shares.

import { CARDS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch, MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { publicState } from "../../src/game/view.js";
import { resultAfterClash } from "../../src/game/clash.js";
import { chooseAction } from "../../src/game/cpu.js";

export const ACTIONS = ["A", "B"]; // A: trap shares the spell (cast) allowance. B: own trapSet allowance.
export const EFFECTS = ["X", "Y"]; // X: cancel the attack. Y: prevent at most 1 damage of that attack.
// "inert" is a negative control: the trap costs its allowance and a card, and does nothing.
export const fixtureId = (side) => `trap-fixture-${side}`; // not in CARDS; test only

const attackOf = (troop) => CARDS[troop.cardId].attack;

// Highest-attack troop on `board`, ties to the lowest lane. null for an empty board.
export function pickTarget(board) {
  let pick = null;
  for (let lane = 0; lane < SLOT_COUNT; lane++) {
    const troop = board[lane];
    if (troop && (pick === null || attackOf(troop) > pick.attack)) pick = { lane, attack: attackOf(troop), cardId: troop.cardId };
  }
  return pick;
}

export const isArmed = (zone, round) => zone !== null && zone.setRound < round;

// Shadow clash on a working copy `state` (changed in place). Same order and
// damage rules as src/game/clash.js, plus triggers decided from the pre-trigger
// snapshot and applied together. zones: { side: null | { cardId, setRound } }.
// Returns { triggers, events, spent } and clears the zones that fired.
export function shadowClash(state, zones, effect) {
  const events = [];
  const triggers = [];
  const hits = new Map(); // "side:lane" -> trigger that touches that attacker
  if (effect) {
    for (const side of SIDES) {
      if (!isArmed(zones[side], state.round)) continue;
      const target = pickTarget(state.sides[opponent(side)].board);
      if (target === null) continue; // no target: the trap stays set
      triggers.push({ side, cardId: zones[side].cardId, round: state.round, target: { side: opponent(side), slot: target.lane, cardId: target.cardId }, attack: target.attack });
      hits.set(`${opponent(side)}:${target.lane}`, side);
    }
  }
  for (const trigger of triggers) events.push({ type: "trap-trigger", ...trigger });

  const attacks = [];
  for (let lane = 0; lane < SLOT_COUNT; lane++) {
    for (const side of SIDES) {
      const troop = state.sides[side].board[lane];
      if (troop) attacks.push({ lane, side, cardId: troop.cardId, amount: CARDS[troop.cardId].attack });
    }
  }
  for (const { lane, side, cardId, amount: nominal } of attacks) {
    const warded = hits.has(`${side}:${lane}`);
    if (warded && effect === "X") continue; // cancelled: no damage event, the troop still blocks
    const amount = warded && effect === "Y" ? Math.max(0, nominal - 1) : nominal; // "inert" leaves it unchanged
    const enemySide = opponent(side);
    const enemy = state.sides[enemySide];
    const blocker = enemy.board[lane];
    const before = blocker ? blocker.health : enemy.baseOrbs;
    const after = Math.max(0, before - amount);
    if (blocker) blocker.health = after;
    else enemy.baseOrbs = after;
    events.push({ type: "damage", lane, attacker: { side, slot: lane, cardId }, target: blocker ? { kind: "troop", side: enemySide, slot: lane } : { kind: "base", side: enemySide }, amount, before, after });
  }
  for (let lane = 0; lane < SLOT_COUNT; lane++) {
    for (const side of SIDES) {
      const own = state.sides[side];
      const troop = own.board[lane];
      if (troop?.health !== 0) continue;
      own.board[lane] = null;
      own.discard.push(troop.cardId);
      events.push({ type: "defeat", side, slot: lane, cardId: troop.cardId });
    }
  }
  const spent = [];
  for (const { side, cardId } of triggers) {
    zones[side] = null;
    spent.push({ side, cardId });
  }
  return { triggers, events, spent };
}

// The second side's end-phase with a shadow clash. Mirrors applyEndPhase in
// src/game/actions.js (clash, result or round advance and draws).
export function shadowSecondEnd(state, zones, effect) {
  const next = structuredClone(state);
  next.revision += 1;
  const clash = shadowClash(next, zones, effect);
  const result = resultAfterClash(next);
  if (result) {
    next.result = result;
    next.activeSide = null;
    return { state: next, ...clash };
  }
  next.round += 1;
  next.startingSide = opponent(next.startingSide);
  next.activeSide = next.startingSide;
  for (const side of [next.startingSide, opponent(next.startingSide)]) {
    next.allowances[side] = { summonUsed: false, castUsed: false };
    const own = next.sides[side];
    if (own.deck.length === 0) continue;
    own.hand.push(own.deck.shift());
  }
  return { state: next, ...clash };
}

// What `side` may see of the shadow zones. Own card visible; the opponent's is face down.
export function trapView(zones, side) {
  const view = {};
  for (const each of SIDES) {
    const zone = zones[each];
    view[each] = zone === null ? null : each === side ? { cardId: zone.cardId, setRound: zone.setRound } : { faceDown: true, setRound: zone.setRound };
  }
  return view;
}

// Seeded shadow match. variant: null (no traps, parity run) or { action, effect }.
// options: policy "S" (spell first: set a trap only when the CPU would end its phase)
// or "T" (trap first: set when the CPU would cast or end; under A this forgoes the cast),
// arrival (round from which the fixture is in hand), holders (sides that own a fixture),
// record (keep every post-action state for parity checks). variant with holders [] runs the
// shadow end-phase with no trap in play.
// The CPU never sets a trap in round 9 (it could never fire). Set rounds are recorded.
export function playShadow(seed, variant, { policy = "S", arrival = 1, holders = SIDES, record = false } = {}) {
  let state = createMatch(seed);
  const zones = { cowboy: null, wizard: null };
  const inHand = Object.fromEntries(SIDES.map((side) => [side, holders.includes(side) && variant ? [fixtureId(side)] : []]));
  const trapSet = { cowboy: false, wizard: false };
  const m = {
    seed, startingSide: state.startingSide, actions: 0, sets: { cowboy: 0, wizard: 0 }, setRounds: [], triggers: [], spent: [],
    forgoneCasts: 0, phases4: 0, trapAndCastPhases: 0, maxPhaseActions: 0, states: [],
  };
  let phaseKey = "";
  let phaseActions = 0;
  let phaseCount = { summon: 0, spell: 0, trap: 0 };
  let lastRound = state.round;
  const closePhase = () => {
    m.maxPhaseActions = Math.max(m.maxPhaseActions, phaseActions);
    if (phaseCount.summon && phaseCount.spell && phaseCount.trap) m.phases4 += 1; // summon + cast + trap + end
    if (phaseCount.spell && phaseCount.trap) m.trapAndCastPhases += 1;
  };

  while (!state.result) {
    const side = state.activeSide;
    if (state.round !== lastRound) {
      trapSet.cowboy = trapSet.wizard = false; // trapSet allowance resets each round (flag-on design)
      lastRound = state.round;
    }
    const key = `${state.round}:${side}`;
    if (key !== phaseKey) {
      if (phaseKey) closePhase();
      phaseKey = key;
      phaseActions = 0;
      phaseCount = { summon: 0, spell: 0, trap: 0 };
    }
    const action = chooseAction(publicState(state, side));
    if (variant && inHand[side].length && zones[side] === null && state.round >= arrival && state.round < MAX_ROUNDS) {
      const { castUsed } = state.allowances[side];
      const free = variant.action === "A" ? !castUsed : !trapSet[side];
      const wants = policy === "S" ? action.type === "end-phase" : action.type !== "summon";
      if (free && wants) {
        zones[side] = { cardId: inHand[side].shift(), setRound: state.round };
        if (variant.action === "A") {
          if (action.type === "spell") m.forgoneCasts += 1;
          state.allowances[side].castUsed = true; // trap uses the shared cast allowance
        } else trapSet[side] = true;
        m.sets[side] += 1;
        m.setRounds.push(state.round);
        m.actions += 1;
        phaseActions += 1;
        phaseCount.trap += 1;
        continue;
      }
    }
    m.actions += 1;
    phaseActions += 1;
    if (action.type in phaseCount) phaseCount[action.type] += 1;
    if (variant && action.type === "end-phase" && side !== state.startingSide) {
      const out = shadowSecondEnd(state, zones, variant.effect === "inert" ? "inert" : variant.effect);
      state = out.state;
      for (const t of out.triggers) m.triggers.push(t);
      for (const s of out.spent) m.spent.push(s);
    } else {
      const applied = applyAction(state, action);
      if (!applied.ok) throw new Error(`seed ${seed}: ${side} rejected (${applied.reason})`);
      state = applied.state;
    }
    if (record) m.states.push(state);
  }
  closePhase();
  m.result = state.result;
  m.finalState = state;
  m.zonesAtEnd = { ...zones };
  m.leftInHand = Object.fromEntries(SIDES.map((side) => [side, inHand[side].length]));
  return m;
}
