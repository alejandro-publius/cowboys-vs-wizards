import { EFFECTS, KEYWORDS, TYPES, typeOf, tributes } from "../../game/showdown/cards.js";
import { portrait } from "./gallery.js";

const illustrations = typeof __CVW_TABLE_ILLUSTRATIONS__ === "undefined" ? {} : __CVW_TABLE_ILLUSTRATIONS__;
const icons = { troop: "◆", spell: "✦", trap: "△", gear: "◇", location: "▰" };

const el = (tag, cls, word) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (word) node.textContent = word;
  return node;
};
export function cardArtwork(type) {
  if (!illustrations[type]) return portrait(type);
  const artwork = el("img", "table-card-painting");
  artwork.src = illustrations[type];
  artwork.alt = "";
  return artwork;
}

function paintedFace(type) {
  const card = TYPES[type];
  const face = el("span", "table-card-face");
  face.setAttribute("aria-hidden", "true");
  const title = el("span", "table-card-title", card.name);
  const artwork = cardArtwork(type);
  const notes = el("span", "table-card-copy");
  const kind = card.kind[0].toUpperCase() + card.kind.slice(1);
  const category = el("span", "table-card-kind", icons[card.kind] + " " + kind);
  if (card.kind === "troop") {
    const stats = el("span", "table-card-stats");
    stats.append(el("span", "", card.attack + " ATK"), el("span", "", card.health + " ●"));
    const cost = tributes(type + "-1");
    notes.append(category, stats);
    if (cost || card.keys?.length)
      notes.append(
        el(
          "span",
          "table-card-rule",
          [...(card.keys ?? []).map((key) => KEYWORDS[key][0]), ...(cost ? [cost + " tribute"] : [])].join(" · "),
        ),
      );
  } else {
    notes.append(category, el("span", "table-card-rule", EFFECTS[card.effect].text));
  }
  face.append(title);
  if (artwork) face.append(artwork);
  face.append(notes);
  return face;
}

export function paintCardFaces(root, selector) {
  for (const card of root.querySelectorAll(selector)) {
    if (card.querySelector(".table-card-face")) continue;
    const type = card.dataset.face ?? card.dataset.choose ?? card.dataset.opened ?? typeOf(card.dataset.card);
    const original = el("span", "table-card-original");
    original.append(...card.childNodes);
    card.append(original, paintedFace(type));
    card.classList.add("table-card-painted");
    card.classList.toggle("table-captured", type.startsWith("cowboy-captured-"));
    card.title = original.textContent.replace(/\s+/g, " ").trim();
  }
}

export function bindTableUI(root) {
  const table = root.querySelector("#sd-table");
  const field = root.querySelector("#sd-field");
  const prompt = el("p", "table-selection");
  const turn = el("p", "table-turn");
  const headline = el("p", "table-award");
  for (const node of [prompt, turn, headline]) node.setAttribute("aria-hidden", "true");
  field.append(turn, prompt, headline);
  const nav = root.querySelector("header");
  const goHome = nav.querySelector("#sd-home");
  const status = root.querySelector("#sd-status");
  const originalPrompt = root.querySelector("#sd-prompt");
  const hand = root.querySelector("#sd-hand");
  const result = root.querySelector("#sd-result");

  function finish() {
    headline.hidden = !root.classList.contains("table-resolved");
    hand.inert = !headline.hidden;
  }

  return {
    paint(view) {
      const ended = Boolean(view.result);
      table.classList.toggle("table-resolved", ended);
      root.classList.toggle("table-resolved", ended);
      paintCardFaces(root, "#sd-hand [data-card], #sd-result [data-choose]");
      const handCards = [...hand.querySelectorAll("[data-card]")];
      handCards.forEach((button, i) => {
        const fan = i - (handCards.length - 1) / 2;
        button.style.setProperty("--fan", fan * 2.1 + "deg");
        button.style.setProperty("--lift", Math.abs(fan) * 3 + "px");
      });
      const added = [...result.querySelectorAll(".sd-good")].find((line) =>
        line.textContent.startsWith("Added "),
      );
      turn.textContent = "Turn " + view.turn;
      turn.hidden = ended;
      headline.textContent = result.querySelector("[data-choose]")
        ? "Choose a card"
        : (added?.textContent.split(":")[0] ?? status.textContent.split(" · ")[0]);
      goHome.textContent = "Camp";
      if (!ended && /^(Choose|A Guard|No enemy)/.test(originalPrompt.textContent)) {
        const text = originalPrompt.textContent.split(".")[0];
        prompt.textContent = text + (text.endsWith("?") ? "" : ".");
        prompt.hidden = false;
      } else {
        prompt.hidden = true;
      }
      finish();
    },
    restore() {
      hand.inert = false;
      table.classList.remove("table-resolved");
      root.classList.remove("table-resolved");
      goHome.textContent = "Back to camp";
      prompt.hidden = turn.hidden = headline.hidden = true;
    },
  };
}
