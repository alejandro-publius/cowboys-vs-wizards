import {opponent} from "../game/cards.js";

// The publicly marked rival lane of the fire arc, or null. The mark only
// matters while the rival still acts after the viewer's turn and a troop
// stands in the marked lane. fireArc is {mark: zero-based lane | null, stage}.
export function rebuildLane(view, fireArc) {
  if (!view || !Number.isInteger(fireArc?.mark) || view.startingSide !== view.viewer) return null;
  return view.sides[opponent(view.viewer)].board[fireArc.mark] ? fireArc.mark : null;
}

// Prefix for Base changes that assume the marked troop is not replaced.
export const IF_NO_REBUILD = "If no rebuild: ";

// Why a shown prediction is conditional. The marked troop can be replaced by a
// fresh Wizard, and a spell that removes it may only move the mark.
export function rebuildNote(lane, {removesMarked = false, markedLane = lane} = {}) {
  if (removesMarked) {
    return `This removes the marked troop, but the rival can still rebuild a weakened troop, so this is not a promised win.`;
  }
  return lane === markedLane
    ? `The marked troop in lane ${markedLane + 1} can be replaced by a fresh Wizard first, so this is not a promised win.`
    : `The marked troop in lane ${markedLane + 1} can still be rebuilt first, so this is not a promised win.`;
}
