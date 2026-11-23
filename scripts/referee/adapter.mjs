// Engine adapter for scripts/referee/prove.mjs.
//
// Translates the production engine's replay (engine.mjs replayDuel) into the published referee
// state schema, proof/referee/SCHEMA.md version 1, and frames it as the per-step records the
// runner compares: step 0 is the initial state (accepted null), step i is the state after
// actions[i - 1]. The schema is fixed; this file only renames and derives fields from engine
// state. It never reads referee output and never adjusts a value toward it.
//
// Derivations the engine does not store directly (each is the schema's own definition):
//   attack     effective attack, from attackOf (printed + gear + location).
//   statuses   sorted subset of ["cover", "stunned"] from the engine's two flags.
//   acted      the engine's `attacked` flag (set by an attack or cover, cleared at stand-up).
//   rest       a free troop without Quickdraw (engine `ready` false) that has not stood up since it
//              arrived. The schema clears rest at the owner's next stand-up (SCHEMA.md, "end"),
//              which is global turn arrived + 2.
//   traps      the engine keeps a list, oldest first. Each trap is placed in the lowest empty of
//              two fixed slots when it first appears, with setTurn = the turn it appeared, and
//              removed when the engine removes it. Which trap the engine springs stays visible.
//   reason     "base" -> "base-destroyed"; "turn-cap" -> "turn-limit" or "turn-limit-draw".
//              Any other engine reason is passed through unchanged so it shows as a difference.
// Turn numbers, active side and turn-cap timing are passed through as the engine has them.
import {TRAP_SLOTS, attackOf} from "../../src/game/showdown/rules.js";
import {cardOf} from "../../src/game/showdown/cards.js";
import {SIDES, replayDuel} from "./engine.mjs";

export const REFEREE_SCHEMA_VERSION = 1;
export const schema = `showdown-referee/${REFEREE_SCHEMA_VERSION}`;

const REASONS = Object.freeze({base: "base-destroyed"});

export function refereeReason(result) {
  if (!result) return null;
  if (result.reason === "turn-cap") return result.winner === null ? "turn-limit-draw" : "turn-limit";
  return REASONS[result.reason] ?? result.reason ?? null;
}

// Fixed-slot trap view; one tracker per duel because slot placement depends on history.
export function trapTracker() {
  const slots = Object.fromEntries(SIDES.map((side) => [side, Array(TRAP_SLOTS).fill(null)]));
  return (side, engineTraps, turn) => {
    const live = slots[side];
    for (let i = 0; i < live.length; i++) if (live[i] && !engineTraps.includes(live[i].id)) live[i] = null;
    for (const id of engineTraps) {
      if (live.some((t) => t?.id === id)) continue;
      const free = live.indexOf(null);
      if (free < 0) throw new Error(`engine holds more than ${TRAP_SLOTS} traps for ${side}`);
      live[free] = {id, card: cardOf(id).name, setTurn: turn};
    }
    return live.map((t) => (t ? {...t} : null));
  };
}

export function troopView(state, troop) {
  if (!troop) return null;
  const card = cardOf(troop.cardId);
  const statuses = [];
  if (troop.cover) statuses.push("cover");
  if (troop.stunned) statuses.push("stunned");
  return {
    id: troop.cardId,
    card: card.name,
    type: card.tag ?? null,
    attack: attackOf(state, troop),
    orbs: troop.health,
    gear: [...troop.gear],
    statuses,
    rest: !troop.ready && state.turn < troop.arrived + 2,
    acted: troop.attacked,
  };
}

export function refereeNormalizer() {
  const traps = trapTracker();
  return (state) => ({
    turn: state.turn,
    active: state.active,
    first: state.first,
    over: Boolean(state.result),
    winner: state.result ? state.result.winner ?? null : null,
    reason: refereeReason(state.result),
    location: state.location && {id: state.location.cardId, card: cardOf(state.location.cardId).name, owner: state.location.side},
    allowances: {troop: !state.summonUsed, other: !state.castUsed, trap: !state.setUsed, cards: !state.attacking},
    players: Object.fromEntries(SIDES.map((side) => {
      const s = state.sides[side];
      return [side, {
        base: s.base,
        hand: [...s.hand],
        deck: [...s.deck],
        discard: [...s.discard],
        troops: s.board.map((troop) => troopView(state, troop)),
        traps: traps(side, s.traps, state.turn),
      }];
    })),
  });
}

// Runner interface: records {step, accepted, state, reason?}.
export function* replay(duel) {
  const run = replayDuel(duel, {normalizer: refereeNormalizer()});
  yield {step: 0, accepted: null, state: run.initial};
  for (const s of run.steps) yield {step: s.index + 1, accepted: s.accepted, state: s.state, ...(s.error ? {reason: s.error} : {})};
}

// Referee side: frame one `referee.py --stream` result line as the same records, values untouched.
// Python's "step N" in `unsupported` is the zero-based action index, so it belongs to record N + 1.
export function refereeRecords(result) {
  const notes = new Map();
  const extra = [];
  for (const note of Array.isArray(result?.unsupported) ? result.unsupported : [`malformed referee result`]) {
    const m = /^step (\d+): (.*)$/.exec(note);
    if (m) notes.set(Number(m[1]) + 1, m[2]);
    else extra.push(note);
  }
  const records = [{step: 0, accepted: null, state: result?.initial ?? null, ...(extra.length ? {unsupported: extra.join("; ")} : {})}];
  (Array.isArray(result?.steps) ? result.steps : []).forEach((s, i) => {
    records.push({step: i + 1, accepted: s?.accepted, state: s?.state ?? null, reason: s?.error ?? null,
      ...(notes.has(i + 1) ? {unsupported: notes.get(i + 1)} : {})});
  });
  return records;
}
