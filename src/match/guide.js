// Guided first match: one sentence of advice for the opt-in ?guide=1 preview.
// Pure: no DOM, no timers, no full Engine state. It reads only the Cowboy
// public view, the selection options for the current step and a small
// progress record built from Engine events, so it cannot name a Wizard hand
// card. It returns text or null and never chooses, blocks or changes a move.
//
// guideLine({view, options, progress}) -> string | null
//   view: publicState(state, "cowboy"); options: selectionOptions(...) output;
//   progress: from guideProgress() / trackGuide().
//   opener: true only for the menu's guided duel (seed 690); it enables the
//   one block-or-trade tip on its first idle decision. ?guide=1 leaves it off.
// The guide stops once round two is over and the first Cowboy tribute summon
// has happened (whichever is later), and at the match result.
import { CARDS, opponent, tributeCost } from "../game/cards.js";
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

export const OPENER_TIP = "Put Sheriff across from the Skeleton to protect your Base, or choose an open lane to trade Base damage.";

// The block-or-trade choice of the guided opener (starter deck, seed 690; seed 60 opens the same way), read
// only from the public board: round 1, the viewer acts second, nothing used yet,
// an empty friendly board, exactly one opposing troop and it is a Skeleton, and
// a playable Sheriff. Called at the idle step only.
function openerChoice(view, options) {
  if (view.round !== 1 || view.startingSide === view.viewer) return false;
  const { summonUsed, castUsed } = view.allowances[view.viewer];
  if (summonUsed || castUsed) return false;
  const own = view.sides[view.viewer].board;
  const enemy = view.sides[opponent(view.viewer)].board.filter(Boolean);
  return (
    own.every((troop) => !troop) &&
    enemy.length === 1 &&
    CARDS[enemy[0].cardId]?.name === "Skeleton" &&
    options.playableCardIds.some((id) => CARDS[id].name === "Sheriff")
  );
}

function idleLine(view, options, progress, opener) {
  if (opener && openerChoice(view, options)) return OPENER_TIP;
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
      return `${CARDS[tribute].name} is playable; its ${CARDS[tribute].stars} stars mean sacrificing ${plural(cost, "friendly troop")} when you summon it.`;
    }
  }
  if (playable.length === 0) return "You have no playable card; ending your phase finishes your part of the round, and the clash follows once both sides have moved.";
  if (summonUsed) return "You have already summoned this round; a spell is still possible.";
  return "Glowing cards in your hand can be played as a troop or a spell.";
}

export function guideLine({ view, options, progress, opener = false }) {
  if (!view || !options || !progress || view.result || view.activeSide !== view.viewer) return null;
  if (view.round >= 3 && progress.tributeSummoned) return null;
  if (options.step === "idle") return idleLine(view, options, progress, opener);
  const card = CARDS[options.cardId];
  switch (options.step) {
    case "tribute":
      return `${card.name} needs ${plural(tributeCost(card.stars), "friendly troop")} sacrificed; lit tiles hold your troops.`;
    case "slot":
      return `Lit tiles you can use for ${card.name}: ${lanes(options.ownSlots)}.`;
    case "target":
      return `Lit enemy tiles ${card.name} can hit: ${lanes(options.enemySlots)}.`;
    case "destination":
      return `Lit enemy tiles the target can move to: ${lanes(options.enemySlots)}${options.canSkip ? "; you may skip the move" : ""}.`;
    case "confirm":
      return `${card.kind === "spell" ? "Cast" : "Summon"} plays ${card.name} as chosen; Cancel returns to your hand.`;
    default:
      return null;
  }
}
