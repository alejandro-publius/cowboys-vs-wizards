// UI selection for one Orb Duel phase: the chosen hand card, then its
// tribute, slot, target and destination. Pure: no DOM, no rendering and no
// full Engine state. Every option offered comes from the
// legalActions(view, view.viewer) entries for the selected card, so no rule
// is re-implemented here; the messages only explain why a card has no entry.
//
// Steps: idle, tribute, slot, target, destination, confirm.
//   troop: idle -> tribute (cost > 0) -> slot -> confirm
//   spell: idle -> target -> destination (only with a relocation entry) -> confirm
// Inputs: { type: "card", cardId } | { type: "slot", side, slot } |
//         { type: "confirm" } | { type: "cancel" } | { type: "skip" }
// Neither `view` nor `selection` is ever mutated; selections are frozen.
import { CARDS, opponent, tributeCost } from "../game/cards.js";
import { legalActions } from "../game/legal.js";

export const emptySelection = Object.freeze({ step: "idle" });

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const ascending = (slots) => [...new Set(slots)].sort((a, b) => a - b);
const sameSlots = (a, b) => a.length === b.length && a.every((slot, i) => slot === b[i]);
const isSubset = (part, whole) => part.every((slot) => whole.includes(slot));

function selection(fields) {
  const copy = { ...fields };
  if (copy.tributes) copy.tributes = Object.freeze([...copy.tributes]);
  return Object.freeze(copy);
}

// Legal entries for one card; [] outside the viewer's phase.
const entriesFor = (view, cardId) => legalActions(view, view.viewer).filter((action) => action.cardId === cardId);

// The legal entry a "confirm" selection stands for.
function matches(entry, chosen) {
  if (entry.type === "summon") return entry.slot === chosen.slot && sameSlots(entry.tributes, chosen.tributes ?? []);
  return entry.type === "spell" && entry.target === chosen.target && entry.destination === chosen.destination;
}

// Why a hand card has no legal entry. The shortfall comes first (Req 4.2),
// then the blocking allowance, then the board.
function blockedReason(view, card) {
  const { summonUsed, castUsed } = view.allowances[view.viewer];
  if (card.kind === "spell") {
    if (castUsed) return "You have already cast a spell this round.";
    if (view.sides[opponent(view.viewer)].board.every((troop) => troop === null)) {
      return `${card.name} has no target: the enemy has no troops on the board.`;
    }
    return `${card.name} cannot be cast now.`;
  }
  const { board } = view.sides[view.viewer];
  const troops = board.filter((troop) => troop !== null).length;
  const cost = tributeCost(card.stars);
  if (troops < cost) return `${card.name} needs ${plural(cost, "tribute troop")}; you have ${troops} on the board.`;
  if (summonUsed) return "You have already summoned this round.";
  if (castUsed) return "A spell was cast this round, and summons must come first.";
  if (cost === 0 && troops === board.length) return `No open tile for ${card.name}.`;
  return `${card.name} cannot be summoned now.`;
}

function clickCard(current, cardId, view) {
  if (current.cardId !== undefined && current.cardId === cardId) return { selection: emptySelection };
  if (!view.sides[view.viewer].hand.includes(cardId)) return { selection: current, message: "That card is not in your hand." };
  const card = CARDS[cardId];
  if (entriesFor(view, cardId).length === 0) return { selection: emptySelection, message: blockedReason(view, card) };
  if (card.kind === "spell") return { selection: selection({ step: "target", cardId }) };
  const step = tributeCost(card.stars) > 0 ? "tribute" : "slot";
  return { selection: selection({ step, cardId, tributes: [] }) };
}

function clickSlot(current, { side, slot }, view) {
  if (current.step === "idle") return { selection: current, message: "Choose a card first." };
  if (current.step === "confirm") return { selection: current, message: "Confirm or cancel." };
  const own = side === view.viewer;
  const enemy = side === opponent(view.viewer);
  const entries = entriesFor(view, current.cardId);

  if (current.step === "tribute") {
    const picks = current.tributes.includes(slot)
      ? current.tributes.filter((each) => each !== slot)
      : ascending([...current.tributes, slot]);
    if (!own || !entries.some((entry) => isSubset(picks, entry.tributes))) {
      return { selection: current, message: "Choose one of your own troops to sacrifice." };
    }
    const done = picks.length === tributeCost(CARDS[current.cardId].stars);
    return { selection: selection({ step: done ? "slot" : "tribute", cardId: current.cardId, tributes: picks }) };
  }

  if (current.step === "slot") {
    const open = entries.filter((entry) => sameSlots(entry.tributes, current.tributes)).map((entry) => entry.slot);
    if (!own || !open.includes(slot)) return { selection: current, message: "Slot is invalid." };
    return { selection: selection({ ...current, step: "confirm", slot }) };
  }

  if (current.step === "target") {
    const onTarget = entries.filter((entry) => entry.target === slot);
    if (!enemy || onTarget.length === 0) return { selection: current, message: "Choose an enemy troop to target." };
    const moves = onTarget.some((entry) => entry.destination !== undefined);
    return { selection: selection({ step: moves ? "destination" : "confirm", cardId: current.cardId, target: slot }) };
  }

  // destination
  const destinations = entries
    .filter((entry) => entry.target === current.target && entry.destination !== undefined)
    .map((entry) => entry.destination);
  if (!enemy || !destinations.includes(slot)) {
    return { selection: current, message: "Choose an empty enemy tile next to the target, or skip." };
  }
  return { selection: selection({ ...current, step: "confirm", destination: slot }) };
}

function skip(current, view) {
  if (current.step !== "destination") return { selection: current };
  const plain = entriesFor(view, current.cardId).some(
    (entry) => entry.target === current.target && entry.destination === undefined,
  );
  if (!plain) return { selection: current, message: "Choose a destination." };
  return { selection: selection({ step: "confirm", cardId: current.cardId, target: current.target }) };
}

function confirm(current, view, newActionId) {
  if (current.step !== "confirm") return { selection: current };
  const found = entriesFor(view, current.cardId).filter((entry) => matches(entry, current));
  if (found.length !== 1) return { selection: emptySelection, message: "That move is no longer legal. Choose again." };
  return { selection: emptySelection, action: { ...structuredClone(found[0]), actionId: newActionId() } };
}

// One UI input. Returns { selection, action?, message? }. `action` appears
// only for a confirm in step "confirm": a copy of the single matching legal
// entry plus `actionId: newActionId()`. Input is ignored (the same selection
// object comes back) unless the caller is accepting input and it is the
// viewer's phase of a match that is not over.
export function selectionStep(current, input, view, { accepting = false, newActionId } = {}) {
  if (!accepting || view.result || view.activeSide !== view.viewer) return { selection: current };
  switch (input?.type) {
    case "card":
      return clickCard(current, input.cardId, view);
    case "slot":
      return clickSlot(current, input, view);
    case "skip":
      return skip(current, view);
    case "confirm":
      return confirm(current, view, newActionId);
    case "cancel":
      return { selection: emptySelection };
    default:
      return { selection: current };
  }
}

function idlePrompt(view) {
  if (view.result) return "The match is over.";
  if (view.activeSide !== view.viewer) return "Waiting for the opponent.";
  return "Choose a card to play, or end your phase.";
}

// What the overlay may offer for the current step: clickable own and enemy
// slots, the chosen tributes, button flags and a short prompt.
export function selectionOptions(current, view) {
  const options = {
    step: current.step,
    cardId: current.cardId ?? null,
    tributes: [...(current.tributes ?? [])],
    ownSlots: [],
    enemySlots: [],
    canConfirm: false,
    canSkip: false,
    canCancel: current.step !== "idle",
    prompt: "",
  };
  if (current.step === "idle") {
    options.prompt = idlePrompt(view);
    return options;
  }

  const card = CARDS[current.cardId];
  const entries = entriesFor(view, current.cardId);
  switch (current.step) {
    case "tribute": {
      const cost = tributeCost(card.stars);
      const consistent = entries.filter((entry) => isSubset(current.tributes, entry.tributes));
      options.ownSlots = ascending(consistent.flatMap((entry) => entry.tributes));
      options.prompt = `Choose ${plural(cost, "troop")} to sacrifice (${current.tributes.length} chosen).`;
      break;
    }
    case "slot":
      options.ownSlots = ascending(
        entries.filter((entry) => sameSlots(entry.tributes, current.tributes)).map((entry) => entry.slot),
      );
      options.prompt = `Choose a tile for ${card.name}.`;
      break;
    case "target":
      options.enemySlots = ascending(entries.map((entry) => entry.target));
      options.prompt = `Choose a target for ${card.name}.`;
      break;
    case "destination": {
      const onTarget = entries.filter((entry) => entry.target === current.target);
      options.enemySlots = ascending(
        onTarget.filter((entry) => entry.destination !== undefined).map((entry) => entry.destination),
      );
      options.canSkip = onTarget.some((entry) => entry.destination === undefined);
      options.prompt = "Choose an empty tile next to the target to move it to, or skip.";
      break;
    }
    case "confirm":
      options.canConfirm = entries.some((entry) => matches(entry, current));
      options.prompt = `Confirm ${card.name}, or cancel.`;
      break;
  }
  return options;
}
