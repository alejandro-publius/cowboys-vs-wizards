import { EFFECTS, KEYWORDS, TYPES, tributes } from "../../game/showdown/cards.js";
import { attackPreviews } from "./attack-preview.js";

const leafSize = 6;
const factions = { cowboy: "Cowboys", wizard: "Wizards" };
const entries = Object.entries(TYPES);
const roster = [...entries.filter(([, card]) => card.kind === "troop"), ...entries.filter(([, card]) => card.kind !== "troop")];

export function bookSpread(side, page, id) {
  const cards = roster.filter(([, card]) => card.side === side);
  if (id) page = Math.floor(cards.findIndex(([type]) => type === id) / leafSize);
  return {page, leaves: Math.ceil(cards.length / leafSize), visible: cards.slice(page * leafSize, (page + 1) * leafSize)};
}

export function setBookMove(button, selected, openReplay) {
  const [move] = attackPreviews(selected);
  button.hidden = !move;
  if (!move) {
    button.onclick = null;
    return;
  }
  const card = TYPES[selected];
  let verb = "Attack";
  if (card.kind !== "troop") verb = "Cast";
  else if (move[0] === "guard") verb = "Guard";
  else if (card.keys.includes("sweep")) verb = "Sweep";
  button.textContent = verb;
  button.setAttribute("aria-label", `${verb} with ${card.name}`);
  button.onclick = () => {
    button.focus({preventScroll: true});
    openReplay(selected);
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountCharacterBook(title, duel, {ownedBySide, openReplay}) {
  const art = __CVW_BOOK_ART__;
  const book = element("dialog", "character-book");
  book.setAttribute("aria-labelledby", "field-guide-title");
  book.innerHTML = `
    <div class="book-cover">
      <button class="book-close" type="button" aria-label="Close character book">×</button>
      <section class="book-index">
        <h2 id="field-guide-title">Character book</h2>
        <div class="book-tabs" role="group" aria-label="Faction"></div>
        <div class="book-grid" role="group" aria-label="Card index"></div>
        <div class="book-pages">
          <button type="button" aria-label="Previous page">‹</button>
          <span></span>
          <button type="button" aria-label="Next page">›</button>
        </div>
      </section>
      <section class="book-entry" aria-labelledby="book-character-name">
        <h3 id="book-character-name" aria-live="polite"></h3>
        <div class="book-leaf">
          <figure class="book-hero"><img alt=""></figure>
          <button class="book-watch" type="button" hidden></button>
          <details class="book-details">
            <summary>Card details</summary>
            <div class="book-notes">
              <p class="book-faction"></p>
              <dl class="book-stats" aria-label="Troop stats"></dl>
              <div class="book-rule"></div>
              <p class="book-ownership"></p>
            </div>
          </details>
        </div>
      </section>
    </div>`;
  document.body.append(book);
  const find = selector => book.querySelector(selector);
  const grid = find(".book-grid");
  const watch = find(".book-watch");
  const ownership = find(".book-ownership");
  const details = find(".book-details");
  const build = element("button", "book-build");
  build.type = "button";
  const [back, next] = book.querySelectorAll(".book-pages button");
  let side = "cowboy";
  let page = 0;
  let selected;
  let onBuild;

  function select(id) {
    selected = id;
    const card = TYPES[id];
    details.open = false;
    find(".book-hero img").src = art[id];
    find(".book-entry h3").textContent = card.name;
    find(".book-faction").textContent = [card.tag ?? card.kind, card.rarity].join(" · ");
    const troop = card.kind === "troop";
    const stats = troop ? [["Attack", card.attack], ["Orbs", card.health], ["Stars", card.stars], ["Tribute", tributes(id)]] : [];
    find(".book-stats").replaceChildren(...stats.map(([label, value]) => {
      const stat = element("div");
      stat.append(element("dt", "", label), element("dd", "", value));
      return stat;
    }));
    const rules = find(".book-rule");
    rules.replaceChildren(...(troop ? card.keys.map(key => {
      const [name, rule] = KEYWORDS[key];
      const detail = element("details");
      detail.append(element("summary", "", name), element("p", "", rule));
      return detail;
    }) : [element("p", "", EFFECTS[card.effect].text)]));
    rules.hidden = !rules.childElementCount;

    setBookMove(watch, id, openReplay);
    const copies = ownedBySide[card.side](id);
    ownership.textContent = card.side === "wizard" ? `In Wizard deck · ${copies}`
      : copies === Infinity ? "Unlimited copies" : copies === 0 ? "Uncollected" : `Owned · ${copies}`;
    if (onBuild && card.side === "cowboy" && copies > 0) {
      build.dataset.buildBookCard = id;
      build.textContent = `Build with ${card.name}`;
      find(".book-entry").append(build);
    } else build.remove();
    for (const button of grid.children) button.setAttribute("aria-pressed", String(button.dataset.id === id));
  }

  build.onclick = () => {
    if (!book.open || !onBuild || TYPES[selected].side !== "cowboy" || !ownedBySide.cowboy(selected)) return;
    book.close();
    onBuild(selected);
  };
  function turn(id) {
    const spread = bookSpread(side, page, id);
    const {leaves, visible} = spread;
    page = spread.page;
    for (const tab of find(".book-tabs").children) tab.setAttribute("aria-pressed", String(tab.dataset.side === side));
    grid.replaceChildren(...visible.map(([id, card]) => {
      const stamp = element("button", "book-portrait");
      stamp.type = "button";
      stamp.dataset.id = id;
      stamp.setAttribute("aria-label", card.name);
      stamp.title = card.name;
      const image = element("img");
      image.alt = "";
      image.src = art[id];
      stamp.append(image, element("span", "book-caption", card.name));
      stamp.onclick = () => select(id);
      return stamp;
    }));
    find(".book-pages span").textContent = (page + 1) + " / " + leaves;
    back.disabled = page === 0;
    next.disabled = page === leaves - 1;
    select(id ?? visible[0][0]);
  }

  for (const [id, name] of Object.entries(factions)) {
    const tab = element("button", "", name);
    tab.type = "button";
    tab.dataset.side = id;
    tab.onclick = () => { side = id; page = 0; turn(); };
    find(".book-tabs").append(tab);
  }
  back.onclick = () => { page--; turn(); if (back.disabled) next.focus(); };
  next.onclick = () => { page++; turn(); if (next.disabled) back.focus(); };
  find(".book-close").onclick = () => book.close();
  book.addEventListener("keydown", (event) => {
    if (event.key === "Escape") event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if ((event.key === "PageUp" || event.key === "PageDown") && event.target.closest(".book-notes")) return;
    const previous = event.key === "ArrowLeft" || event.key === "PageUp";
    const forward = event.key === "ArrowRight" || event.key === "PageDown";
    if (!previous && !forward) return;
    event.preventDefault();
    event.stopPropagation();
    const control = previous ? back : next;
    if (control.disabled) return;
    control.click();
    grid.querySelector('[aria-pressed="true"]').focus({preventScroll: true});
  });
  function open(id, source = document.activeElement, buildDeck) {
    if (id !== undefined && !Object.hasOwn(TYPES, id)) return;
    const show = (focus) => {
      // The native dialog returns focus to this control, including inside the Wanted room.
      source?.focus({preventScroll: true});
      book.showModal();
      focus.focus();
    };
    onBuild = buildDeck && (type => buildDeck(type, () => show(build)));
    if (id) side = TYPES[id].side;
    turn(id ?? selected);
    show(watch.hidden ? find('.book-portrait[aria-pressed="true"]') : watch);
  }
  for (const gallery of [title, duel].map(screen => screen.querySelector(".sd-open-gallery")).filter(Boolean)) {
    const button = element("button", "book-launch", "Character book");
    button.type = "button";
    button.onclick = () => open(undefined, button);
    button.setAttribute("aria-label", "Character book");
    button.title = "Character book";
    const icon = '<svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true" shape-rendering="crispEdges"><path fill="#80512f" d="M0 2h9v1h6V2h9v15H14v1h-4v-1H0z"/><path fill="#f2d49b" d="M2 0h7v1h2v13H9v-1H2zm11 1h2V0h7v13h-7v1h-2z"/><path fill="#987043" d="M4 4h4v1H4zm12 0h4v1h-4zM4 7h5v1H4zm11 0h5v1h-5z"/></svg>';
    button.innerHTML = icon;
    if (title.contains(gallery)) {
      const shelf = element("div", "book-shelf");
      button.append(" Character book");
      gallery.before(shelf);
      shelf.append(button, gallery);
    } else {
      gallery.before(button);
    }
  }
  if (new URLSearchParams(location.search).get("book") === "1") open(undefined, title.querySelector(".book-launch"));
  return open;
}
