import { TYPES } from "../../game/showdown/cards.js";
import { applyAction, createShowdown, legalActions, opponent } from "../../game/showdown/rules.js";
import { viewFor } from "../../game/showdown/contract.js";
import { presentEvent } from "../../game/showdown/presenter.js";

export function attackPreviews(id) {
  const card = TYPES[id];
  if (card?.kind !== "troop") return [];
  if (card.attack === 0) return [["guard", "Watch Guard"]];
  const options = [["attack", "Watch attack"]];
  if (card.keys.includes("ride")) options.push(["ride", "Watch Ride"]);
  if (card.keys.includes("laststand")) options.push(["laststand", "Watch Last Stand"]);
  return options;
}

export function attackExample(id, mode) {
  if (!attackPreviews(id).some(([key]) => key === mode)) return null;
  const card = TYPES[id];
  const side = card.side;
  const enemy = opponent(side);
  const defender = side === "cowboy" ? "wizard-skeleton" : "cowboy-sheriff";
  const returning = mode === "guard" || mode === "laststand";
  const other = [{ type: defender }];
  if (mode === "guard") other.push({ type: "cowboy-billy" });
  if (mode === "attack" && card.keys.includes("sweep"))
    other.push(
      { type: side === "cowboy" ? "wizard-raven-familiar" : "cowboy-billy" },
      { type: side === "cowboy" ? "wizard-skeleton" : "cowboy-dynamiter" },
    );
  const first = returning ? enemy : side;
  const state = createShowdown(7, { first, opening: { [side]: [{ type: id }], [enemy]: other } });
  state.turn = 5;
  const action = legalActions(state).find(
    (each) => each.type === "attack" && each.slot === 0 && each.target === (mode === "ride" ? "base" : 0),
  );
  const { state: after, events } = applyAction(state, action);
  const before = viewFor(state, side),
    end = viewFor(after, side);
  const summary =
    (mode === "guard" ? "Guard makes enemies attack Bone Wall first. " : "") +
    events.map((event) => presentEvent(event)).join(" ");
  return { before, end, trace: [{ before, after: end, events }], summary };
}
