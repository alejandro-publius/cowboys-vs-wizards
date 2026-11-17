// State invariants shared by every property. Violations carry a `kind` so a
// reducer can check that a smaller input fails for the same reason.
import { CARDS, SIDES } from "../../../src/game/cards.js";
import { BASE_ORBS, MAX_ROUNDS, SLOT_COUNT } from "../../../src/game/state.js";

export class Violation extends Error {
  constructor(kind, message) {
    super(`${kind}: ${message}`);
    this.name = "Violation";
    this.kind = kind;
  }
}

export function need(ok, kind, message) {
  if (!ok) throw new Violation(kind, typeof message === "function" ? message() : message);
}

export const zoneIds = (zone) => [...zone.deck, ...zone.hand, ...zone.discard, ...zone.board.filter(Boolean).map((troop) => troop.cardId)];

// The sorted card IDs each side owns. Taken once from a legal starting state.
export const expectedOf = (state) => Object.fromEntries(SIDES.map((side) => [side, zoneIds(state.sides[side]).sort()]));

// Card conservation (each ID in exactly one zone of its own side), health and
// orb bounds, and the result/active-side relationship. Does not assume a
// round-dependent deck size, so it holds for constructed fixtures and
// reachable states alike.
export function checkState(state, expected, label = "state") {
  for (const side of SIDES) {
    const zone = state.sides[side];
    const ids = zoneIds(zone).sort();
    need(JSON.stringify(ids) === JSON.stringify(expected[side]), "conservation", () => `${label}: ${side} cards ${ids.join(",")} != ${expected[side].join(",")}`);
    for (const id of ids) need(CARDS[id]?.side === side, "ownership", () => `${label}: ${id} is not a ${side} card`);
    need(zone.board.length === SLOT_COUNT, "board-size", () => `${label}: ${side} board length ${zone.board.length}`);
    for (const troop of zone.board.filter(Boolean)) {
      const card = CARDS[troop.cardId];
      need(card.kind === "troop", "board-kind", () => `${label}: ${troop.cardId} on a board`);
      need(Number.isInteger(troop.health) && troop.health >= 1 && troop.health <= card.health && card.health <= 5, "health-bounds", () => `${label}: ${troop.cardId} health ${troop.health}`);
    }
    need(Number.isInteger(zone.baseOrbs) && zone.baseOrbs >= 0 && zone.baseOrbs <= BASE_ORBS, "base-bounds", () => `${label}: ${side} base ${zone.baseOrbs}`);
  }
  need(Number.isInteger(state.round) && state.round >= 1 && state.round <= MAX_ROUNDS, "round-bounds", () => `${label}: round ${state.round}`);
  const baseDown = SIDES.some((side) => state.sides[side].baseOrbs === 0);
  if (state.result) {
    need(state.activeSide === null, "result-state", () => `${label}: active side after result`);
    need(baseDown || state.round === MAX_ROUNDS, "result-state", () => `${label}: result without a destroyed base or round ${MAX_ROUNDS}`);
  } else {
    need(SIDES.includes(state.activeSide), "result-state", () => `${label}: no active side without a result`);
    need(!baseDown, "result-state", () => `${label}: destroyed base without a result`);
  }
}

// One accepted action: exactly one revision, no RNG use, the ID recorded, and
// the input state untouched.
export function checkAccepted(before, beforeJson, action, result, label) {
  need(result.ok === true, "accepted", () => `${label}: ${result.reason}`);
  need(JSON.stringify(before) === beforeJson, "input-mutated", () => `${label}: applyAction changed its input state`);
  need(result.state.revision === before.revision + 1, "revision", () => `${label}: revision ${before.revision} -> ${result.state.revision}`);
  need(result.state.rng === before.rng && result.state.seed === before.seed, "rng", () => `${label}: rng or seed changed`);
  if (action.actionId !== undefined) need(result.state.actionIds.at(-1) === action.actionId, "action-id", () => `${label}: action ID not recorded`);
  for (const event of result.events) need(event.revision === before.revision, "event-revision", () => `${label}: event revision`);
}

// A rejected action: reported reason, the very same state object, nothing changed.
export function assertRejected(apply, state, action, reason, label) {
  const before = JSON.stringify(state);
  const result = apply(state, action);
  need(result.ok === false, "rejected", () => `${label}: accepted an invalid action ${JSON.stringify(action)}`);
  need(result.reason === reason, "reason", () => `${label}: reason ${result.reason}, expected ${reason}`);
  need(result.state === state, "atomicity", () => `${label}: rejection returned a different state object`);
  need(JSON.stringify(state) === before, "atomicity", () => `${label}: rejected action changed state, zones or RNG`);
}
