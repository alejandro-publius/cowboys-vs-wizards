import { SIDES } from "./cards.js";

function checkSide(side) {
  if (!SIDES.includes(side)) throw new TypeError("side must be one of " + SIDES.join(", "));
}

// What `side` may know, as an independent copy. Hidden: the opponent's hand,
// both deck orders (counts only), and `seed` and `rng`, because either one
// reproduces the shuffles. `result.outcome` is the result from this side's
// point of view: "win", "loss" or "draw".
// On a trap match (`state.traps.enabled`, issue #94 T4, contract section 6)
// the view also holds `traps` (so legalActions can read the flag), each
// side's `trap` zone (own: { cardId, setRound }; opponent: { faceDown: true,
// setRound }; empty: null) and only the viewer's own `tactical` allowance.
// Flag off, the view is exactly what it was before T4.
// On a Ride Out match (`state.rideOut.enabled`) the view also holds `rideOut`,
// so legalActions on the view lists the move. A ride-out is a visible board
// change, so nothing else is added or hidden.
export function publicState(state, side) {
  checkSide(side);
  const traps = state.traps?.enabled === true;
  const sides = {};
  for (const each of SIDES) {
    const { baseOrbs, deck, hand, board, discard, trap } = state.sides[each];
    sides[each] = { baseOrbs, deckCount: deck.length, handCount: hand.length, board, discard };
    if (each === side) sides[each].hand = hand;
    if (traps) {
      sides[each].trap =
        trap == null ? null : each === side ? { cardId: trap.cardId, setRound: trap.setRound } : { faceDown: true, setRound: trap.setRound };
    }
  }
  const { revision, round, startingSide, activeSide, result } = state;
  let { allowances } = state;
  if (traps) {
    allowances = Object.fromEntries(
      SIDES.map((each) => {
        if (each === side) return [each, allowances[each]];
        const { summonUsed, castUsed } = allowances[each];
        return [each, { summonUsed, castUsed }];
      }),
    );
  }
  const outcome = result && (result.winner === null ? "draw" : result.winner === side ? "win" : "loss");
  const view = {
    viewer: side,
    revision,
    round,
    startingSide,
    activeSide,
    allowances,
    result: result && { ...result, outcome },
    sides,
  };
  if (state.bountyTarget) view.bountyTarget = state.bountyTarget;
  // A Lantern Wraith hunt's marked move is public: the board shows it.
  if (state.bountyDrift) view.bountyDrift = state.bountyDrift;
  if (traps) view.traps = { enabled: true, rulesVersion: state.traps.rulesVersion };
  if (state.rideOut?.enabled === true) view.rideOut = { enabled: true, rulesVersion: state.rideOut.rulesVersion };
  return structuredClone(view);
}

// The events `side` may see, as independent copies of the raw events from
// applyAction. Only `trap-set` is changed: an opponent's loses its `cardId`;
// the owner's keeps it. `trap-trigger` keeps its `cardId`, because a trap is
// revealed when it is used. Every other event is copied unchanged.
// Not yet used by the controller or UI (wiring is T6).
export function publicEvents(events, side) {
  checkSide(side);
  return events.map((event) => {
    const copy = structuredClone(event);
    if (copy.type === "trap-set" && copy.side !== side) delete copy.cardId;
    return copy;
  });
}
