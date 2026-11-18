import {CARDS, SIDES, opponent} from "../game/cards.js";
import {resolveClash} from "../game/clash.js";
import {SLOT_COUNT} from "../game/state.js";

// Preview only the candidate lane, using the public board and the engine's
// simultaneous damage resolver. The opponent's next move is unknown.
export function summonForecasts(view, options) {
  if (!view || !options || view.traps?.enabled) return {};
  const card = CARDS[options.cardId];
  if (card?.kind !== "troop") return {};
  const lanes = options.step === "slot" ? options.ownSlots
    : options.step === "confirm" && options.canConfirm ? [options.slot] : [];
  const own = view.viewer;
  const enemy = opponent(own);
  return Object.fromEntries(lanes.map((slot) => {
    const blocker = view.sides[enemy].board[slot];
    const sides = Object.fromEntries(SIDES.map((side) => [side, {
      baseOrbs: view.sides[side].baseOrbs, board: Array(SLOT_COUNT).fill(null), discard: [],
    }]));
    sides[own].board[slot] = {cardId: card.id, health: card.health};
    if (blocker) sides[enemy].board[slot] = {...blocker};
    const hits = [];
    resolveClash({sides}, (event) => {
      if (event.type !== "damage") return;
      const {target, before, after} = event;
      const name = target.kind === "base" ? "Enemy base" : CARDS[target.cardId].name;
      hits.push(`${name} ${before} → ${after}`);
    });
    return [slot, hits.join(" · ")];
  }));
}
