// UI selection for one Orb Duel phase: the chosen hand card, then its
// tribute, slot, target and destination. Pure: no DOM, no rendering and no
// full Engine state. Every option offered comes from the
// legalActions(view, view.viewer) entries for the selected card, so no rule
// is re-implemented here; the messages only explain why a card has no entry.
// blockedReasons(view) lists those messages for the hand before any click.
//
// Steps: idle, tribute, slot, target, destination, confirm.
//   troop: idle -> tribute (cost > 0) -> slot -> confirm
//   spell: idle -> target -> destination (only with a relocation entry) -> confirm
//   trap:  idle -> confirm (a set-trap entry; trap matches only)
//   ride:  idle -> ride-source (if needed) -> ride-destination -> ride-confirm
// Inputs: { type: "card", cardId } | { type: "slot", side, slot } |
//         { type: "confirm" } | { type: "cancel" } | { type: "skip" } | { type: "ride-out" }
// Neither `view` nor `selection` is ever mutated; selections are frozen.
//
// `options.cards` (default CARDS) is the card catalog for kind and name
// lookups and is passed to legalActions, as in applyAction. Only tests pass
// another one (CARDS plus a fixture trap card, issue #106); the shipped
// catalog has no trap card. Only the viewer's own hand is looked up.
import { CARDS, opponent, tributeCost } from "../game/cards.js";
import { legalActions } from "../game/legal.js";
import { MAX_ROUNDS } from "../game/state.js";

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

// The viewer's legal entries. A hand card missing from the catalog is a
// development error, reported by its ID instead of a lookup TypeError.
function legalFor(view, cards) {
  const missing = view.sides[view.viewer].hand?.find((cardId) => cards[cardId] === undefined);
  if (missing !== undefined) throw new TypeError(`Card ${missing} is in the hand but not in the card catalog`);
  return legalActions(view, view.viewer, { cards });
}

// Legal entries for one card; [] outside the viewer's phase.
const entriesFor = (view, cardId, cards) => legalFor(view, cards).filter((action) => action.cardId === cardId);
const rideActions = (actions) => actions.filter((action) => action.type === "ride-out");

// Hand cards with at least one legal entry.
const playableIds = (actions) => [...new Set(actions.map((action) => action.cardId).filter(Boolean))];

// The legal entry a "confirm" selection stands for.
function matches(entry, chosen) {
  if (entry.type === "summon") return entry.slot === chosen.slot && sameSlots(entry.tributes, chosen.tributes ?? []);
  if (entry.type === "set-trap") return chosen.trap === true;
  return entry.type === "spell" && entry.target === chosen.target && entry.destination === chosen.destination;
}

// Why a hand card has no legal entry. The shortfall comes first (Req 4.2),
// then the blocking allowance, then the board.
// Trap texts are the contract section 3 strings, in its order; `tactical`
// exists only on trap matches, so default matches keep their texts.
function blockedReason(view, card) {
  const { summonUsed, castUsed, tactical } = view.allowances[view.viewer];
  if (card.kind === "trap") {
    if (view.traps?.enabled !== true) return "Traps are not in this match.";
    if (view.round === MAX_ROUNDS) return "Too late: a trap set in the last round can never spring.";
    if (view.sides[view.viewer].trap != null) return "Your trap zone already holds a trap.";
    if (castUsed) return "You already cast a spell this round. A trap uses the same action.";
    return `${card.name} cannot be set now.`;
  }
  if (card.kind === "spell") {
    if (castUsed && tactical === "trap") return "You set a trap this round. A spell uses the same action.";
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
  const canRide = view.rideOut?.enabled || board.some((troop) => troop !== null && CARDS[troop.cardId]?.rides === true);
  if (summonUsed) return canRide
    ? "You already summoned or rode out this round."
    : "You have already summoned this round.";
  if (castUsed && tactical === "trap") return "You set a trap this round, so you cannot summon. Summon first next time.";
  if (castUsed) return "A spell was cast this round, and summons must come first.";
  if (cost === 0 && troops === board.length) return `No open tile for ${card.name}.`;
  return `${card.name} cannot be summoned now.`;
}

function clickCard(current, cardId, view, cards) {
  if (current.cardId !== undefined && current.cardId === cardId) return { selection: emptySelection };
  if (!view.sides[view.viewer].hand.includes(cardId)) return { selection: current, message: "That card is not in your hand." };
  const entries = entriesFor(view, cardId, cards);
  const card = cards[cardId];
  if (entries.length === 0) return { selection: emptySelection, message: blockedReason(view, card) };
  if (card.kind === "trap") return { selection: selection({ step: "confirm", cardId, trap: true }) };
  if (card.kind === "spell") return { selection: selection({ step: "target", cardId }) };
  const step = tributeCost(card.stars) > 0 ? "tribute" : "slot";
  return { selection: selection({ step, cardId, tributes: [] }) };
}

function startRide(current, view, cards) {
  const sources = ascending(rideActions(legalFor(view, cards)).map((action) => action.slot));
  if (!sources.length) return { selection: current, message: "No troop can ride out now." };
  return { selection: selection(sources.length === 1
    ? { step: "ride-destination", slot: sources[0] }
    : { step: "ride-source" }) };
}

function clickRide(current, side, slot, view, cards) {
  if (current.step === "ride-confirm") return { selection: current, message: "Confirm or cancel." };
  const rides = rideActions(legalFor(view, cards));
  if (current.step === "ride-source") {
    if (side === view.viewer && rides.some((action) => action.slot === slot)) {
      return { selection: selection({ step: "ride-destination", slot }) };
    }
    return { selection: current, message: "Choose a highlighted friendly troop." };
  }
  if (side === view.viewer && rides.some((action) => action.slot === current.slot && action.destination === slot)) {
    return { selection: selection({ ...current, step: "ride-confirm", destination: slot }) };
  }
  return { selection: current, message: "Choose an adjacent empty lane." };
}

function clickSlot(current, { side, slot }, view, cards) {
  if (current.step.startsWith("ride-")) return clickRide(current, side, slot, view, cards);
  if (current.step === "idle") return { selection: current, message: "Choose a card first." };
  if (current.step === "confirm") return { selection: current, message: "Confirm or cancel." };
  const own = side === view.viewer;
  const enemy = side === opponent(view.viewer);
  const entries = entriesFor(view, current.cardId, cards);

  if (current.step === "tribute") {
    const picks = current.tributes.includes(slot)
      ? current.tributes.filter((each) => each !== slot)
      : ascending([...current.tributes, slot]);
    if (!own || !entries.some((entry) => isSubset(picks, entry.tributes))) {
      return { selection: current, message: "Choose one of your own troops to sacrifice." };
    }
    const done = picks.length === tributeCost(cards[current.cardId].stars);
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

function skip(current, view, cards) {
  if (current.step !== "destination") return { selection: current };
  const plain = entriesFor(view, current.cardId, cards).some(
    (entry) => entry.target === current.target && entry.destination === undefined,
  );
  if (!plain) return { selection: current, message: "Choose a destination." };
  return { selection: selection({ step: "confirm", cardId: current.cardId, target: current.target }) };
}

function confirm(current, view, newActionId, cards) {
  if (current.step !== "confirm" && current.step !== "ride-confirm") return { selection: current };
  const found = current.step === "ride-confirm"
    ? rideActions(legalFor(view, cards)).filter((entry) => entry.slot === current.slot && entry.destination === current.destination)
    : entriesFor(view, current.cardId, cards).filter((entry) => matches(entry, current));
  if (found.length !== 1) return { selection: emptySelection, message: "That move is no longer legal. Choose again." };
  return { selection: emptySelection, action: { ...structuredClone(found[0]), actionId: newActionId() } };
}

// One UI input. Returns { selection, action?, message? }. `action` appears
// only for a confirm in step "confirm": a copy of the single matching legal
// entry plus `actionId: newActionId()`. Input is ignored (the same selection
// object comes back) unless the caller is accepting input and it is the
// viewer's phase of a match that is not over.
export function selectionStep(current, input, view, { accepting = false, newActionId, cards = CARDS } = {}) {
  if (!accepting || view.result || view.activeSide !== view.viewer) return { selection: current };
  switch (input?.type) {
    case "ride-out":
      return startRide(current, view, cards);
    case "card":
      return clickCard(current, input.cardId, view, cards);
    case "slot":
      return clickSlot(current, input, view, cards);
    case "skip":
      return skip(current, view, cards);
    case "confirm":
      return confirm(current, view, newActionId, cards);
    case "cancel":
      return { selection: emptySelection };
    default:
      return { selection: current };
  }
}

// Why each hand card without a legal entry cannot be played now, keyed by
// card ID: the blockedReason text a click on that card returns. Empty
// outside the viewer's phase of a running match, where clicks are ignored.
export function blockedReasons(view, { cards = CARDS } = {}) {
  if (view.result || view.activeSide !== view.viewer) return {};
  const playable = new Set(playableIds(legalFor(view, cards)));
  const blocked = view.sides[view.viewer].hand.filter((cardId) => !playable.has(cardId));
  return Object.fromEntries(blocked.map((cardId) => [cardId, blockedReason(view, cards[cardId])]));
}

function idlePrompt(view, hasPlayableCards) {
  if (view.result) return "The match is over.";
  if (view.activeSide !== view.viewer) return "Waiting for the opponent.";
  return hasPlayableCards ? "Choose a glowing card, or end your phase." : "End your phase.";
}

// What the overlay may offer for the current step: clickable own and enemy
// slots, the chosen tributes and spell target, button flags and a short prompt.
export function selectionOptions(current, view, { cards = CARDS } = {}) {
  const actions = legalFor(view, cards);
  const playableCardIds = playableIds(actions);
  const options = {
    playableCardIds,
    step: current.step,
    cardId: current.cardId ?? null,
    tributes: [...(current.tributes ?? [])],
    // The chosen spell target from its pick through confirmation, else null.
    target: current.target ?? null,
    ownSlots: [],
    enemySlots: [],
    canConfirm: false,
    canSkip: false,
    canCancel: current.step !== "idle",
    prompt: "",
  };
  // Hunts and opt-in Ride Out always carry the Ride fields. A standard duel
  // carries them only while a legal ride-out exists or a ride is being chosen.
  const rides = rideActions(actions);
  if (view.rideOut?.enabled || rides.length > 0 || current.step.startsWith("ride-")) {
    options.canRideOut = current.step === "idle" && rides.length > 0;
    if (current.step.startsWith("ride-")) {
      options.rideFrom = current.slot ?? null;
      options.rideDestination = current.destination ?? null;
      const moves = rides.filter((action) => action.slot === current.slot);
      if (current.step === "ride-source") {
        options.ownSlots = ascending(rides.map((action) => action.slot));
        options.prompt = "Choose a friendly troop to Ride Out.";
      } else if (current.step === "ride-destination") {
        options.ownSlots = moves.map((action) => action.destination);
        options.prompt = "Choose an adjacent empty lane. This spends your summon.";
      } else {
        options.canConfirm = moves.some((action) => action.destination === current.destination);
        options.prompt = `Ride from lane ${current.slot + 1} to lane ${current.destination + 1}, or cancel.`;
      }
      return options;
    }
  }
  if (current.step === "idle") {
    options.prompt = options.canRideOut
      ? "Choose a card, Ride Out, or end your turn."
      : idlePrompt(view, playableCardIds.length > 0);
    return options;
  }

  const card = cards[current.cardId];
  const entries = actions.filter((action) => action.cardId === current.cardId);
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
      options.prompt = current.trap
        ? `Set ${card.name} face-down, or cancel. It springs from next round.`
        : `Confirm ${card.name}, or cancel.`;
      break;
  }
  return options;
}
