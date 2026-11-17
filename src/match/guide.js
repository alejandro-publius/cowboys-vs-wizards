// Guided first match: one sentence of advice for the opt-in ?guide=1 preview.
// Pure: no DOM, no timers, no full Engine state. It reads only the Cowboy
// public view, the selection options for the current step and a small
// progress record built from Engine events, so it cannot name a Wizard hand
// card. It returns text or null and never chooses, blocks or changes a move.
//
// guideLine({view, options, progress}) -> string | null
//   view: publicState(state, "cowboy"); options: selectionOptions(...) output;
//   progress: from guideProgress() / trackGuide().
// The guide stops once round two is over and the first Cowboy tribute summon
// has happened (whichever is later), and at the match result.
import { CARDS, tributeCost } from "../game/cards.js";
import { clashLog } from "./clash-log.js";

export const guideProgress = () => Object.freeze({ events: Object.freeze([]), clash: null, tributeSummoned: false });

// Fold the Engine events of one applied action into the progress record.
// Events are kept only until the first clash is described.
export function trackGuide(progress, events) {
  const tributeSummoned =
    progress.tributeSummoned || events.some((e) => e.type === "summon" && e.side === "cowboy" && e.tributes.length > 0);
  if (progress.clash) return Object.freeze({ ...progress, tributeSummoned });
  const seen = [...progress.events, ...events];
  const clash = clashLog(seen);
  return Object.freeze({ events: Object.freeze(clash ? [] : seen), clash, tributeSummoned });
}

const lanes = (slots) => slots.map((slot) => `lane ${slot + 1}`).join(", ");
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function idleLine(view, options, progress) {
  const { summonUsed, castUsed } = view.allowances[view.viewer];
  if (view.round === 2 && progress.clash && !summonUsed && !castUsed) {
    const { lines } = progress.clash;
    const more = lines.length > 1 ? ` (and ${plural(lines.length - 1, "more event")})` : "";
    return `The ${progress.clash.title.replace(/^Round/, "round")}: ${lines[0]}${more}.`;
  }
  const playable = options.playableCardIds;
  if (!progress.tributeSummoned) {
    const tribute = playable.find((id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) > 0);
    if (tribute) {
      const cost = tributeCost(CARDS[tribute].stars);
      return `${CARDS[tribute].name} is playable and costs ${plural(cost, "friendly troop")} to sacrifice, so choose it for your first tribute summon.`;
    }
  }
  if (playable.length === 0) return "You have no playable card, so end your phase to start the clash.";
  if (summonUsed) return "You have already summoned this round, so cast a spell or end your phase.";
  return "Choose a glowing card in your hand to summon a troop or cast a spell, or end your phase.";
}

export function guideLine({ view, options, progress }) {
  if (!view || !options || !progress || view.result || view.activeSide !== view.viewer) return null;
  if (view.round >= 3 && progress.tributeSummoned) return null;
  if (options.step === "idle") return idleLine(view, options, progress);
  const card = CARDS[options.cardId];
  switch (options.step) {
    case "tribute":
      return `Choose ${tributeCost(card.stars)} of your troops to sacrifice for ${card.name}, then pick a lane.`;
    case "slot":
      return `Pick one of your open lanes (${lanes(options.ownSlots)}) for ${card.name}.`;
    case "target":
      return `Choose an enemy troop to hit with ${card.name} (${lanes(options.enemySlots)}).`;
    case "destination":
      return `Pick an empty enemy lane (${lanes(options.enemySlots)}) to move the target to${options.canSkip ? ", or skip" : ""}.`;
    case "confirm":
      return `Confirm to ${card.kind === "spell" ? "cast" : "summon"} ${card.name}, or cancel to choose again.`;
    default:
      return null;
  }
}
