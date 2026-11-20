// The graybox Camp's progress (issue 143 slice 2). Holds the current progress object in memory and
// writes it through the canonical store after every change. Every rule (what a duel is, what a win
// pays, what is on offer) comes from src/game/showdown/progress.js; nothing here decides a reward.
import {laneCapturedCards, loadCampaign, saveCampaign} from "../game/showdown/campaign-store.js";
import {holdings, joinInherited} from "../game/showdown/inherited.js";
import {choose, duelFor, duelList, owned, settle} from "../game/showdown/progress.js";
import {GRIT_CAP, TRAIL} from "../game/showdown/trail.js";

export function createCampaign(storage) {
  let progress = loadCampaign(storage);
  let saved = true;
  // Cards already won in the lane game stay owned. They are kept in their own record, not in the
  // progress object, so the Trail deck, bounties and offers are unchanged (see inherited.js).
  const inherited = joinInherited(storage, laneCapturedCards(storage));
  // saveCampaign returns {ok} and never throws. Storage can be blocked or full: play on with the
  // progress in memory, and the Camp says so.
  const keep = (next) => {
    progress = next;
    saved = saveCampaign(storage, progress).ok === true;
  };
  return {
    progress: () => progress,
    saved: () => saved && inherited.saved,
    // Owned cards for the Camp list, each once: [{type, copies, inherited}].
    holdings: () => holdings(progress, inherited.cards),
    inherited: () => inherited.cards,
    duels: () => duelList(progress),
    // The open Trail duel for this progress, or null while a card is on offer or the Trail is done.
    trailDuel: () => duelFor(progress, "trail"),
    owned: (type) => owned(progress, type),
    // Records a finished duel once. Returns what it paid and which earned cards went into the deck.
    settle(duel, won) {
      const before = progress;
      const settled = settle(before, duel.id, won);
      const swaps = duel.kind === "trail" && won ? TRAIL[before.wins].reward : [];
      const intoDeck = swaps.map(([type, replaced]) => [type, (settled.save.deck[type] ?? 0) - (before.deck[type] ?? 0), replaced]).filter(([, copies]) => copies > 0);
      keep(settled.save);
      return {won, earned: settled.earned, intoDeck, grit: Math.min(settled.save.losses[duel.id] ?? 0, GRIT_CAP)};
    },
    choose(type) { keep(choose(progress, type)); },
  };
}
