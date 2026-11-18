import {CARDS, SIDES, SPELL_DAMAGE, opponent} from "../game/cards.js";
import {resolveClash} from "../game/clash.js";
import {SLOT_COUNT} from "../game/state.js";

// Deadeye target previews for the plain graybox, keyed by enemy lane: the
// target's life orbs before and after the catalog SPELL_DAMAGE, "(removed)"
// when the shot is lethal and, when that opens the lane, the Base hit your
// troop in it lands at the next clash. Only the Cowboys' non-relocating spell
// in your own phase, on legal targets: every options.enemySlots lane while
// choosing, the chosen options.target while confirming. Public board data
// only; the preview assumes no Wizard reply before the clash.
export function spellForecasts(view, options) {
  if (!view || !options || view.result || view.traps?.enabled || view.activeSide !== view.viewer) return {};
  const own = view.viewer;
  const card = CARDS[options.cardId];
  if (card?.kind !== "spell" || card.relocates || card.side !== "cowboy" || card.side !== own) return {};
  const lanes = options.step === "target" ? (options.enemySlots ?? [])
    : options.step === "confirm" && options.canConfirm && Number.isInteger(options.target) ? [options.target] : [];
  const enemy = opponent(own);
  return Object.fromEntries(lanes.flatMap((lane) => {
    const troop = view.sides[enemy].board[lane];
    if (!troop) return [];
    const after = Math.max(0, troop.health - SPELL_DAMAGE);
    const parts = [`${CARDS[troop.cardId].name} ${troop.health} → ${after}${after === 0 ? " (removed)" : ""}`];
    if (after === 0) {
      // The opened lane alone, on a detached copy: your troop there, if any, meets no blocker.
      const sides = Object.fromEntries(SIDES.map((side) => [side, {
        baseOrbs: view.sides[side].baseOrbs, board: Array(SLOT_COUNT).fill(null), discard: [],
      }]));
      const yours = view.sides[own].board[lane];
      if (yours) sides[own].board[lane] = {...yours};
      resolveClash({sides}, (event) => {
        if (event.type !== "damage" || event.target.kind !== "base") return;
        const falls = event.after === 0 ? " (falls)" : "";
        parts.push(`Lane ${lane + 1} opens: Enemy Base ${event.before} → ${event.after}${falls}`);
      });
    }
    return [[lane, parts.join(" · ")]];
  }));
}
