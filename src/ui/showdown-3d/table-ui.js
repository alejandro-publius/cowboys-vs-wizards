import { EFFECTS, KEYWORDS, TYPES, typeOf, tributes } from "../../game/showdown/cards.js";
import { portrait as cardArtwork } from "./gallery.js";
import { bindAttackForecasts } from "./attack-forecasts.js";

export { cardArtwork };

const icons = { troop: "◆", spell: "✦", trap: "△", gear: "◇", location: "▰" };

export const COMPACT_CARD_RULES = Object.freeze({
  shot: "−1 ●",
  tie: "Stun",
  hellfire: "All foes −1 ●",
  snare: "−2 ●",
  hex: "Cancel",
  sixshooter: "+1 ATK",
  bonearmor: "+2 ●",
  office: "Lawmen +1",
  boneyard: "Undead +1",
});

export function compactSelectionPrompt(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const payments = [...text.matchAll(/Pay ([^:]+): ([^.]+)\./g)];
  if (payments.length) {
    return payments
      .map(([, who, outcome]) => {
        const raised = /(\S+) returns with (\d+) orb/.exec(outcome);
        if (raised) return `${who.trim()} → Raise ${raised[2]}●`;
        if (/no .* to return/i.test(outcome)) return `${who.trim()} → none`;
        return `${who.trim()} → ${outcome.trim()}`;
      })
      .join(" · ");
  }
  const multiTribute = /^Choose (\d+) of your troops .* for ([^.]+)\./.exec(text);
  if (multiTribute) return `Tribute ${multiTribute[1]} for ${multiTribute[2].trim()}`;
  const oneTribute = /^Choose a tribute for ([^.]+)\./.exec(text);
  if (oneTribute) return `Tribute for ${oneTribute[1].trim()}`;
  const gear = /^Choose one of your troops to carry ([^.]+)\./.exec(text);
  if (gear) return `Equip ${gear[1].trim()}`;
  const spell = /^Choose an enemy troop for ([^.]+)\./.exec(text);
  if (spell) return `Target foe · ${spell[1].trim()}`;
  const hasTrap = text.includes("A face-down trap springs before damage.");
  const hasCover = /\bOr take cover:/.test(text);
  if (/^This troop cannot attack now\./.test(text)) return "Rests this turn · Take cover";
  if (hasTrap) {
    const lead = /^No enemy troops:/.test(text) ? "Strike Base" : /^A Guard/.test(text) ? "Strike Guard" : "Pick target";
    return `${lead} · Trap set!${hasCover ? " · or Cover" : ""}`;
  }
  if (/^No enemy troops:/.test(text)) return hasCover ? "Strike Base · or Take cover" : "Strike Base";
  if (/^A Guard/.test(text)) return hasCover ? "Strike Guard · or Take cover" : "Strike Guard";
  if (/^Choose what to attack\./.test(text)) return hasCover ? "Pick target · or Take cover" : "Pick target";
  return "";
}

const el = (tag, cls, word) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (word) node.textContent = word;
  return node;
};
function paintedFace(type) {
  const card = TYPES[type];
  const face = el("span", "table-card-face");
  face.setAttribute("aria-hidden", "true");
  const title = el("span", "table-card-title", card.name);
  const artwork = cardArtwork(type);
  const notes = el("span", "table-card-copy");
  if (card.kind === "troop") {
    const stats = el("span", "table-card-stats");
    stats.append(el("span", "", card.attack + " ATK"), el("span", "", card.health + " ●"));
    const cost = tributes(type + "-1");
    notes.append(stats);
    if (cost || card.keys?.length)
      notes.append(
        el(
          "span",
          "table-card-rule",
          [...(card.keys ?? []).map((key) => KEYWORDS[key][0]), ...(cost ? ["★" + cost] : [])].join(" · "),
        ),
      );
  } else {
    const badge = COMPACT_CARD_RULES[card.effect] ?? EFFECTS[card.effect].text;
    notes.append(el("span", "table-card-rule", icons[card.kind] + " " + badge));
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
  const choices = el("div", "table-pick");
  choices.append(prompt);
  const forecasts = bindAttackForecasts(root, choices);
  const turn = el("p", "table-turn");
  // A best of three's game and tally, copied from the status line, which screen readers already hear.
  const series = el("p", "table-series");
  const headline = el("p", "table-award");
  for (const node of [prompt, turn, series, headline]) node.setAttribute("aria-hidden", "true");
  field.append(turn, series, choices, headline);
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
      paintCardFaces(root, "#sd-hand [data-card], #sd-result [data-choose], #sd-result [data-face]");
      const handCards = [...hand.querySelectorAll("[data-card]")];
      handCards.forEach((button, i) => {
        const fan = i - (handCards.length - 1) / 2;
        button.style.setProperty("--fan", fan * 2.1 + "deg");
        button.style.setProperty("--lift", Math.abs(fan) * 3 + "px");
      });
      const added = [...result.querySelectorAll(".sd-good")].find((line) =>
        line.textContent.startsWith("Added "),
      );
      const location = field.dataset.battlefield !== "boot-hill" ? status.textContent.split(" · ")[0] : "";
      turn.textContent = location ? `${location} · Turn ${view.turn}` : `Turn ${view.turn}`;
      turn.hidden = ended;
      series.textContent = status.querySelector("[data-series]")?.textContent ?? "";
      series.hidden = !series.textContent;
      forecasts.paint();
      headline.textContent = result.querySelector("[data-capture-title]")?.textContent ?? (result.querySelector("[data-choose]")
        ? "Choose a card"
        : (added?.textContent.split(":")[0] ?? status.textContent.split(" · ")[0]));
      if (!goHome.hasAttribute("data-return-wanted")) goHome.textContent = "Camp";
      // A pick's compact HUD cue; #sd-prompt retains the full sentence for assistive descriptions.
      const shortPrompt = !ended ? compactSelectionPrompt(originalPrompt.textContent) : "";
      if (shortPrompt) {
        prompt.textContent = shortPrompt;
        prompt.hidden = false;
      } else {
        prompt.textContent = "";
        prompt.hidden = true;
      }
      finish();
    },
    restore() {
      forecasts.clear();
      hand.inert = false;
      table.classList.remove("table-resolved");
      root.classList.remove("table-resolved");
      if (!goHome.hasAttribute("data-return-wanted")) goHome.textContent = "Back to camp";
      prompt.textContent = "";
      prompt.hidden = turn.hidden = series.hidden = headline.hidden = true;
    },
  };
}
