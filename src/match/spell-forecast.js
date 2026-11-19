import {CARDS, SIDES, SPELL_DAMAGE, opponent} from "../game/cards.js";
import {pendingDrift, resolveClash} from "../game/clash.js";
import {shiftTroop} from "../game/lanes.js";
import {SLOT_COUNT} from "../game/state.js";
import {IF_NO_REBUILD, rebuildLane, rebuildNote} from "./fire-arc-forecast.js";

// Deadeye target previews for the plain graybox, keyed by enemy lane: the
// target's life orbs before and after the catalog SPELL_DAMAGE, "(removed)"
// when the shot is lethal and, when that opens the lane, the Base hit your
// troop in it lands at the next clash. Only the Cowboys' non-relocating spell
// in your own phase, on legal targets: every options.enemySlots lane while
// choosing, the chosen options.target while confirming. Public board data
// only; the preview assumes no Wizard reply before the clash.
export function spellForecasts(view, options, fireArc = null) {
  if (!view || !options || view.result || view.traps?.enabled || view.activeSide !== view.viewer) return {};
  const own = view.viewer;
  const card = CARDS[options.cardId];
  if (card?.kind !== "spell" || card.relocates || card.side !== "cowboy" || card.side !== own) return {};
  const lanes = options.step === "target" ? (options.enemySlots ?? [])
    : options.step === "confirm" && options.canConfirm && Number.isInteger(options.target) ? [options.target] : [];
  const enemy = opponent(own);
  const marked = rebuildLane(view, fireArc);
  return Object.fromEntries(lanes.flatMap((lane) => {
    const troop = view.sides[enemy].board[lane];
    if (!troop) return [];
    const after = Math.max(0, troop.health - SPELL_DAMAGE);
    const parts = [`${CARDS[troop.cardId].name} ${troop.health} → ${after}${after === 0 ? " (removed)" : ""}`];
    // A lethal shot on a Lantern Wraith hunt can open the Wraith's marked lane.
    let filled = false;
    const cond = [];
    if (after === 0) {
      const board = view.sides[enemy].board.map((each) => each && {...each});
      board[lane] = null;
      const drift = pendingDrift({...view, sides: {...view.sides, [enemy]: {...view.sides[enemy], board}}});
      if (drift) {
        shiftTroop(board, drift.slot, drift.destination);
        parts.push(`${CARDS[view.bountyTarget].name} drifts to lane ${drift.destination + 1}`);
        filled = board[lane] !== null;
      }
    }
    if (after === 0 && !filled) {
      // The opened lane alone, on a detached copy: your troop there, if any, meets no blocker.
      const sides = Object.fromEntries(SIDES.map((side) => [side, {
        baseOrbs: view.sides[side].baseOrbs, board: Array(SLOT_COUNT).fill(null), discard: [],
      }]));
      const yours = view.sides[own].board[lane];
      if (yours) sides[own].board[lane] = {...yours};
      resolveClash({sides}, (event) => {
        if (event.type !== "damage" || event.target.kind !== "base") return;
        const falls = event.after === 0 ? " (falls)" : "";
        cond.push(`Lane ${lane + 1} opens: Enemy Base ${event.before} → ${event.after}${falls}`);
      });
    }
    // Dragon Fire arc: a wounded blocker that survives the shot may still not absorb your attacker.
    const yours = view.sides[own].board[lane];
    if (after > 0 && yours && view.dragonFire?.enabled) {
      const sides = Object.fromEntries(SIDES.map((side) => [side, {
        baseOrbs: view.sides[side].baseOrbs, board: Array(SLOT_COUNT).fill(null), discard: [],
      }]));
      sides[own].board[lane] = {...yours};
      sides[enemy].board[lane] = {...troop, health: after};
      resolveClash({sides, dragonFire: view.dragonFire}, (event) => {
        if (event.type !== "damage" || event.fire !== true) return;
        cond.push(`Dragon Fire: ${event.target.side === own ? "your" : "enemy"} Base ${event.before} → ${event.after}${event.after === 0 ? " (falls)" : ""}`);
      });
    }
    // The marked rival lane can be rebuilt after your turn. The shot itself is
    // certain; Base changes assume the shown board, and removing the marked
    // blocker may only move the mark.
    if (marked !== null && cond.length) {
      parts.push(`${IF_NO_REBUILD}${cond.join(" · ")}`, rebuildNote(lane, {markedLane: marked, removesMarked: after === 0 && lane === marked}));
    } else parts.push(...cond);
    return [[lane, parts.join(" · ")]];
  }));
}
