// One-lane moves on a single board. Singularity's relocation of an enemy
// survivor and the opt-in ride-out of a friendly troop both use these, so the
// two moves follow one rule. The troop object itself moves, so its card and
// remaining health go with it.
import { SLOT_COUNT } from "./state.js";

export const isSlot = (slot) => Number.isInteger(slot) && slot >= 0 && slot < SLOT_COUNT;

// The lanes one step left and right of `slot` that exist, ascending.
export const adjacentLanes = (slot) => [slot - 1, slot + 1].filter(isSlot);

// Those of the adjacent lanes that are empty on `board`.
export const shiftDestinations = (board, slot) => adjacentLanes(slot).filter((lane) => board[lane] === null);

// Moves the troop in `slot` to `destination` in place. Callers validate first.
export function shiftTroop(board, slot, destination) {
  board[destination] = board[slot];
  board[slot] = null;
}
