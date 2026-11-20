// The graybox deck builder (issue 143 slice 3), adapted from the reference builder in
// prototypes/showdown/main.js (openBuilder, renderBuilder, buildStep). Two uses:
//   - from the Camp: the saved deck (16 cards) and side deck (up to 4), from owned cards within each
//     card's limit; Save keeps it through the campaign, which checks progress.js deckProblems.
//   - between the games of a best of three: only cards of this match move between the deck and the
//     side deck; nothing is saved and there is no cancel (src/match/showdown-match.js).
import {RARITY, TYPES} from "../game/showdown/cards.js";
import {DECK_SIZE, SIDE_SIZE} from "../game/showdown/progress.js";
import {swapProblems} from "../match/showdown-match.js";
import {face} from "./showdown-screen.js";

const sum = (counts) => Object.values(counts).reduce((total, copies) => total + copies, 0);
const TEMPLATE = `
  <header><h1 id="builder-title">Build deck</h1></header>
  <p id="builder-note" class="sd-note"></p>
  <div id="builder-rows"></div>
  <p id="builder-problems" role="status"></p>
  <div class="sd-row">
    <button type="button" id="builder-save">Save deck</button>
    <button type="button" id="builder-cancel">Cancel</button>
  </div>`;

// campaign: progress(), owned(type), deckProblems(deck, side), withDeck(deck, side).
export function mountBuilder(root, {campaign}) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);
  let draft = null; // {pool, deck, side, done, cancel}

  const limit = (type) => (draft.pool ? draft.pool[type] : Math.min(campaign.owned(type), RARITY[TYPES[type].rarity][1]));
  const problems = () => (draft.pool ? swapProblems(draft.pool, draft.deck, draft.side) : campaign.deckProblems(draft.deck, draft.side));

  function render() {
    const types = Object.keys(TYPES).filter((type) => TYPES[type].side === "cowboy" && (draft.pool ? draft.pool[type] : campaign.owned(type) > 0));
    $("builder-title").textContent = draft.pool ? "Between games: swap with your side deck" : "Build deck";
    $("builder-note").textContent = draft.pool ? "Move cards between your deck and your side deck. The change lasts for this match."
      : `A deck is ${DECK_SIZE} cards. A side deck is up to ${SIDE_SIZE} more, to swap in between the games of a best of three.`;
    $("builder-rows").innerHTML = types.map((type) => {
      const [deck, side] = [draft.deck[type] ?? 0, draft.side[type] ?? 0];
      const room = deck + side < limit(type);
      const step = (zone, by, on, text) => `<button type="button" data-zone="${zone}" data-type="${type}" data-by="${by}" ${on ? "" : "disabled"} aria-label="${text} ${TYPES[type].name}">${by > 0 ? "+" : "−"}</button>`;
      // Between games a card moves from one pile to the other, so "+" on the deck takes it from the side deck.
      return `<div class="sd-build-row" data-row="${type}"><div class="sd-card cowboy ${TYPES[type].rarity}" data-frame="${TYPES[type].kind}">${face(type)}</div>
        <div><span class="sd-note">Deck</span>${step("deck", -1, deck > 0, "One fewer in the deck:")} <strong data-count="deck">${deck}</strong> ${step("deck", 1, draft.pool ? side > 0 : room, "One more in the deck:")}</div>
        <div><span class="sd-note">Side deck</span>${step("side", -1, side > 0, "One fewer in the side deck:")} <strong data-count="side">${side}</strong> ${step("side", 1, draft.pool ? deck > 0 : room, "One more in the side deck:")}</div>
        <span class="sd-note">${Number.isFinite(limit(type)) ? `Limit: ${limit(type)} in deck and side deck together` : "Limit: none"}</span></div>`;
    }).join("");
    const listed = problems();
    $("builder-problems").innerHTML = `Deck ${sum(draft.deck)} of ${DECK_SIZE} · side deck ${sum(draft.side)} of ${SIDE_SIZE}.${listed.length ? ` <span class="sd-warn">${listed.join(" ")}</span>` : ""}`;
    $("builder-save").disabled = listed.length > 0;
    $("builder-save").textContent = draft.pool ? "Play the next game" : "Save deck";
    $("builder-cancel").hidden = !draft.cancel;
  }

  function step(zone, type, by) {
    const other = zone === "deck" ? "side" : "deck";
    draft[zone] = {...draft[zone], [type]: (draft[zone][type] ?? 0) + by};
    if (draft.pool) draft[other] = {...draft[other], [type]: (draft[other][type] ?? 0) - by};
    render();
    // The rows are redrawn, which drops keyboard focus. Keep it on the same button; at a bound move to
    // the other button of the same pile, then the other pile, then Save.
    const button = (z, b) => $("builder-rows").querySelector(`[data-zone="${z}"][data-type="${type}"][data-by="${b}"]:not(:disabled)`);
    (button(zone, by) ?? button(zone, -by) ?? button(other, by) ?? button(other, -by) ?? $("builder-save")).focus();
  }

  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled || !draft) return;
    if (b.dataset.zone) step(b.dataset.zone, b.dataset.type, Number(b.dataset.by));
    else if (b.id === "builder-save" && !problems().length) {
      const {deck, side, done} = draft;
      draft = null;
      done(deck, side);
    } else if (b.id === "builder-cancel" && draft.cancel) {
      const {cancel} = draft;
      draft = null;
      cancel();
    }
  });

  return {
    // The saved deck: done() after it is kept, cancel() leaves it as it was.
    openDeck({done, cancel}) {
      const progress = campaign.progress();
      draft = {pool: null, deck: {...progress.deck}, side: {...progress.side},
        done: (deck, side) => { campaign.withDeck(deck, side); done(); }, cancel};
      render();
      ($("builder-rows").querySelector("button:not(:disabled)") ?? $("builder-save")).focus({preventScroll: true});
    },
    // Between games: done(deck, side) plays the next game with them.
    openSwap({pool, deck, side, done}) {
      draft = {pool, deck: {...deck}, side: {...side}, done, cancel: null};
      render();
      ($("builder-rows").querySelector("button:not(:disabled)") ?? $("builder-save")).focus({preventScroll: true});
    },
  };
}
