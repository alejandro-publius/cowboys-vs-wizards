import { KEYWORDS, TYPES } from "../../game/showdown/cards.js";

const leafSize = 6;
const factions = { cowboy: "Cowboys", wizard: "Wizards" };
const roster = Object.entries(TYPES).filter(([, card]) => card.kind === "troop");
const art = __CVW_BOOK_ART__;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountCharacterBook(title, duel) {
  const book = element("dialog", "character-book");
  book.setAttribute("aria-labelledby", "field-guide-title");
  book.innerHTML = `
    <div class="book-cover">
      <section class="book-index">
        <h2 id="field-guide-title">Field Guide</h2>
        <div class="book-tabs" role="group" aria-label="Faction"></div>
        <div class="book-grid" role="group" aria-label="Characters"></div>
        <div class="book-pages">
          <button type="button" aria-label="Previous page">‹</button>
          <span></span>
          <button type="button" aria-label="Next page">›</button>
        </div>
      </section>
      <section class="book-entry" aria-labelledby="book-character-name">
        <button class="book-close" type="button" aria-label="Close character book">×</button>
        <p class="book-faction"></p>
        <h3 id="book-character-name" aria-live="polite"></h3>
        <figure class="book-hero"><img alt=""></figure>
        <div class="book-stats" role="group" aria-label="Character stats"></div>
        <div class="book-rule"></div>
      </section>
    </div>`;
  document.body.append(book);
  const find = selector => book.querySelector(selector);
  const grid = find(".book-grid");
  const [back, next] = book.querySelectorAll(".book-pages button");
  let side = "cowboy";
  let page = 0;
  let opener;

  function select(id) {
    const card = TYPES[id];
    find(".book-hero img").src = art[id];
    find(".book-entry h3").textContent = card.name;
    find(".book-faction").textContent = [card.tag, card.rarity].filter(Boolean).join(" · ");
    const stats = [["⚔", "Attack", card.attack], ["♥", "Life orbs", card.health], ["★", "Stars", card.stars]];
    find(".book-stats").replaceChildren(...stats.map(([icon, label, value]) => {
      const stat = element("span", "", icon + " " + value);
      stat.setAttribute("role", "img");
      stat.setAttribute("aria-label", label + ": " + value);
      stat.title = label + ": " + value;
      return stat;
    }));
    const rules = find(".book-rule");
    rules.hidden = !card.keys?.length;
    rules.replaceChildren(...(card.keys ?? []).map(key => {
      const [name, rule] = KEYWORDS[key];
      const detail = element("details");
      detail.append(element("summary", "", name), element("p", "", rule));
      return detail;
    }));
    for (const button of grid.children) button.setAttribute("aria-pressed", String(button.dataset.id === id));
  }

  function turn() {
    const entries = roster.filter(([, card]) => card.side === side);
    const leaves = Math.ceil(entries.length / leafSize);
    const visible = entries.slice(page * leafSize, (page + 1) * leafSize);
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
      stamp.append(image);
      stamp.onclick = () => select(id);
      return stamp;
    }));
    find(".book-pages span").textContent = (page + 1) + " / " + leaves;
    back.disabled = page === 0;
    next.disabled = page === leaves - 1;
    select(visible[0][0]);
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
  book.addEventListener("close", () => opener?.focus());
  function open(source) {
    opener = source;
    if (!grid.childElementCount) turn();
    book.showModal();
    find('.book-tabs [aria-pressed="true"]').focus();
  }
  for (const gallery of [title, duel].map(screen => screen.querySelector(".sd-open-gallery")).filter(Boolean)) {
    const button = element("button", "book-launch", "Character book");
    button.type = "button";
    button.onclick = () => open(button);
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
  if (new URLSearchParams(location.search).get("book") === "1") open(title.querySelector(".book-launch"));
}
