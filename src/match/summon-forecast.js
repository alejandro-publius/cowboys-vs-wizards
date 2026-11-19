import {CARDS, SIDES, opponent} from "../game/cards.js";
import {pendingDrift, resolveClash} from "../game/clash.js";
import {shiftTroop} from "../game/lanes.js";
import {SLOT_COUNT} from "../game/state.js";
import {IF_NO_REBUILD, rebuildLane, rebuildNote} from "./fire-arc-forecast.js";

// Preview the candidate lane and any threats newly opened by paying tributes.
// The opponent's next move is unknown.
export function summonForecasts(view, options, fireArc = null) {
  if (!view || !options || view.traps?.enabled) return {};
  const card = CARDS[options.cardId];
  if (card?.kind !== "troop") return {};
  const lanes = options.step === "slot" ? options.ownSlots
    : options.step === "confirm" && options.canConfirm ? [options.slot] : [];
  const own = view.viewer;
  const enemy = opponent(own);
  // On a Lantern Wraith hunt the lane preview uses the board after the marked move.
  const enemyBoard = view.sides[enemy].board.map((troop) => troop && {...troop});
  const drift = pendingDrift(view);
  const marked = rebuildLane(view, fireArc);
  if (drift) shiftTroop(enemyBoard, drift.slot, drift.destination);
  return Object.fromEntries(lanes.map((slot) => {
    const exposed = (options.tributes ?? []).filter((lane) => lane !== slot && enemyBoard[lane]);
    const blocker = enemyBoard[slot];
    const sides = Object.fromEntries(SIDES.map((side) => [side, {
      baseOrbs: view.sides[side].baseOrbs, board: Array(SLOT_COUNT).fill(null), discard: [],
    }]));
    sides[own].board[slot] = {cardId: card.id, health: card.health};
    if (blocker) sides[enemy].board[slot] = {...blocker};
    for (const lane of exposed) sides[enemy].board[lane] = {...enemyBoard[lane]};
    const hits = [];
    resolveClash({sides, dragonFire: view.dragonFire}, (event) => {
      if (event.type !== "damage" || event.lane !== slot) return;
      const {target, before, after} = event;
      if (event.fire === true) {
        hits.push(`Dragon Fire: ${target.side === own ? "your" : "enemy"} Base ${before} → ${after}`);
        return;
      }
      const name = target.kind === "base" ? "Enemy base" : CARDS[target.cardId].name;
      hits.push(`${name} ${before} → ${after}`);
    });
    if (exposed.length) {
      const lanes = exposed.map((lane) => lane + 1).join(", ");
      const opened = exposed.length === 1 ? `Tribute opens lane ${lanes}` : `Tributes open lanes ${lanes}`;
      hits.push(`${opened}: your Base ${view.sides[own].baseOrbs} → ${sides[own].baseOrbs}`);
    }
    // The marked rival lane can be rebuilt after your turn: this lane's result
    // assumes the shown board and does not promise the outcome.
    let text = hits.join(" · ");
    if (marked !== null && (slot === marked || exposed.includes(marked)) && text) {
      text = `${IF_NO_REBUILD}${text} · ${rebuildNote(slot, {markedLane: marked})}`;
    }
    return [slot, text];
  }));
}
