// Render data for the Orb Duel card overlay (src/ui/cards.js). Pure: it reads
// the displayed Player_View, the selection options and the controller's UI
// state, never the full Engine state. The Wizard side is counts only, so no
// Wizard card identity can reach the overlay.
//
// cardModel({displayed, options, status, seed, seedPinned, message}) takes
// the controller's displayed(), options(), status(), seed(), seedPinned()
// and message(); displayed and options may be null. clashLog is the opt-in
// ?log=1 list from src/match/clash-log.js, or null when the preview is off.
// guide is the ?guide=1 sentence from src/match/guide.js, or null.
// blockedReasons is opt-in (the plain graybox hand): the blockedReasons(view)
// map from src/match/selection.js. With it every hand card gets
// blockedReason, its text while input is accepted and the card is
// unplayable, else null. Without it the hand cards keep their shape.
import {CARDS, tributeCost} from "../game/cards.js";
import {SLOT_COUNT} from "../game/state.js";
import {pendingDrift} from "../game/clash.js";

export const RESULT_LABELS = Object.freeze({win: "Victory", loss: "Defeat", draw: "Draw"});

// Shown instead of the selection prompt while the controller takes no input.
const WAITING = {
  idle: "No match is running.",
  playing: "Playing out the last move…",
  cpu_turn: "The Wizard is choosing a move…",
  terminal: "The match is over.",
  error: "Playback stopped.",
};

function phase(displayed) {
  if (!displayed) return "No match";
  if (displayed.result) return "Match over";
  return displayed.activeSide === "cowboy" ? "Cowboy phase (you)" : "Wizard phase (CPU)";
}

function front(cardId, selected, playable) {
  const card = CARDS[cardId];
  const troop = card.kind === "troop";
  return {
    cardId,
    name: card.name,
    kind: card.kind,
    stars: troop ? card.stars : "Spell",
    health: troop ? card.health : null,
    attack: troop ? card.attack : null,
    selected,
    playable,
    ...(troop && card.rides === true && {rides: true}),
  };
}

// The Imp's public stats and card line, shown on its lane tile. Other troops
// keep the name and orbs only.
const IMP_LINE = "Hits for three. One orb.";

function troopSummary(troop) {
  if (!troop) return null;
  const card = CARDS[troop.cardId];
  return {
    name: card.name, health: troop.health, max: card.health,
    ...(troop.cardId.startsWith("wizard-imp-") ? {attack: card.attack, note: IMP_LINE} : {}),
  };
}

// Plain graybox summon preview: the tributes and destination chosen so far for
// a troop that costs tributes. null outside that choice (spells, free troops,
// Ride Out, no selection, input closed). Built from public board data only.
function summonPreview(accepting, options, board) {
  const card = options?.cardId ? CARDS[options.cardId] : null;
  if (!accepting || card?.kind !== "troop" || !["tribute", "slot", "confirm"].includes(options.step)) return null;
  const cost = tributeCost(card.stars);
  if (cost === 0) return null;
  const chosen = [...(options.tributes ?? [])].sort((a, b) => a - b);
  const names = chosen.map((lane) => `${board[lane] ? CARDS[board[lane].cardId].name : "Troop"} in lane ${lane + 1}`);
  const missing = Math.max(0, cost - chosen.length);
  const parts = [names.length ? `Tribute ${names.join(" and ")}.` : "Choose the troops to tribute."];
  if (missing > 0) parts.push(`Choose ${missing} more tribute${missing === 1 ? "" : "s"}.`);
  else parts.push(Number.isInteger(options.slot) ? `Summon to lane ${options.slot + 1}.` : "Choose a lane to summon to.");
  return parts.join(" ");
}

export function cardModel({displayed = null, options = null, status = "idle", seed = null, seedPinned = false, message = null, clashLog = null, guide = null, blockedReasons = null} = {}) {
  const accepting = status === "accepting_input";
  const cowboy = displayed?.sides.cowboy ?? null;
  const wizard = displayed?.sides.wizard ?? null;
  const selected = options?.cardId ?? null;
  const playable = new Set(accepting ? options?.playableCardIds : []);
  const hand = (cowboy?.hand ?? []).map((cardId) => front(cardId, cardId === selected, playable.has(cardId)));
  if (blockedReasons) {
    for (const card of hand) card.blockedReason = accepting && !card.playable ? blockedReasons[card.cardId] ?? null : null;
  }
  const outcome = displayed?.result?.outcome;
  // Lantern Wraith hunts: the one marked Wizard lane, until the marked clash.
  // "drift" when the Wraith will move there (the same pendingDrift the clash
  // runs), "blocked" when that lane is taken and the Wraith will hold.
  const driftPlan = displayed?.bountyDrift;
  const mark = driftPlan && displayed.round === driftPlan.round && !displayed.result
    && wizard?.board.some((troop) => troop?.cardId === displayed.bountyTarget)
    ? {lane: driftPlan.destination, state: pendingDrift(displayed) ? "drift" : "blocked"} : null;
  return {
    status,
    round: displayed?.round ?? null,
    phase: phase(displayed),
    seed: {value: seed, pinned: seed !== null && Boolean(seedPinned), text: seed === null ? "–" : String(seed)},
    cowboy: {
      deckCount: cowboy?.deckCount ?? null,
      handCount: cowboy?.handCount ?? null,
      baseOrbs: cowboy?.baseOrbs ?? null,
      hand,
    },
    // Counts only: never the Wizard hand or deck.
    wizard: {
      deckCount: wizard?.deckCount ?? null,
      handCount: wizard?.handCount ?? null,
      baseOrbs: wizard?.baseOrbs ?? null,
    },
    // The opt-in ?guide=1 line (src/match/guide.js) follows the prompt in the same element.
    prompt: accepting || status === "submitting"
      ? (options?.prompt ?? "") + (accepting && guide ? ` ${guide}` : "")
      : WAITING[status] ?? "",
    // True only when a ?guide=1 line is part of the prompt, so the overlay keeps the prompt visible.
    guideShown: accepting && Boolean(guide),
    message: message ?? "",
    clashLog,
    lanes: Array.from({length: SLOT_COUNT}, (_, lane) => ({
      lane,
      cowboy: troopSummary(cowboy?.board[lane]),
      wizard: troopSummary(wizard?.board[lane]),
      ...(displayed?.bountyTarget && {wanted: wizard?.board[lane]?.cardId === displayed.bountyTarget}),
      ...(lane === mark?.lane && {mark: mark.state}),
    })),
    // Slots a click can choose now: own (Cowboy) and enemy (Wizard).
    slots: {
      cowboy: accepting ? [...(options?.ownSlots ?? [])] : [],
      wizard: accepting ? [...(options?.enemySlots ?? [])] : [],
    },
    tributes: [...(options?.tributes ?? [])],
    summonPreview: summonPreview(accepting, options, cowboy?.board ?? []),
    // Hunts and opt-in Ride Out always; a standard duel only while a ride is legal or being chosen.
    ...((displayed?.rideOut?.enabled || (accepting && (options?.canRideOut || options?.step?.startsWith("ride-")))) && {ride: {
      available: accepting && Boolean(options?.canRideOut),
      choosing: accepting && Boolean(options?.step?.startsWith("ride-")),
      from: options?.rideFrom ?? null,
      destination: options?.rideDestination ?? null,
    }}),
    // The pending choice: cardId and, once a tile is chosen, its slot. The
    // overlay uses it to fly a confirmed summon from the hand to its lane.
    selection: {cardId: selected, slot: options?.slot ?? null},
    // A Cowboy draw being played, with the new card's position in the hand.
    draw: options?.draw?.side === "cowboy" && cowboy?.hand[options.draw.handIndex] === options.draw.cardId
      ? {key: options.draw.key, handIndex: options.draw.handIndex, ms: options.draw.ms}
      : null,
    buttons: {
      hand: accepting,
      confirm: accepting && Boolean(options?.canConfirm),
      cancel: accepting && Boolean(options?.canCancel),
      skip: accepting && Boolean(options?.canSkip),
      endPhase: accepting,
      restart: status !== "idle",
    },
    result: outcome === undefined ? null : {
      outcome,
      label: displayed.result.reason === "bounty-captured" ? "Bounty captured" : RESULT_LABELS[outcome] ?? outcome,
      ...(displayed.bountyTarget && {boss: CARDS[displayed.bountyTarget].name}),
      reason: displayed.result.reason ?? null,
      round: displayed.result.round ?? null,
    },
  };
}
