import { EFFECTS, KEYWORDS, TYPES, typeOf, tributes } from "../../game/showdown/cards.js";
import { portrait as cardArtwork } from "./gallery.js";
import { bindAttackForecasts } from "./attack-forecasts.js";

export { cardArtwork };

const icons = { troop: "◆", spell: "✦", trap: "△", gear: "◇", location: "▰" };

// Only shorten the visual copy. Keyboard target descriptions and the cover tooltip use the public prompt.
export function compactSelectionPrompt(text, evenFight = false) {
  if (!/^(Choose|A Guard|No enemy|This troop)/.test(text)) return "";
  if (text.startsWith("Choose a tribute for ")) {
    return text
      .replace(/^Choose a tribute for (.+?)\./, "$1 tribute")
      .replace(/ Pay ([^:]+): /g, " · $1 → ")
      .replaceAll(" returns with 1 orb.", " (1 orb)")
      .replaceAll("no Undead to return.", "no Undead")
      .replace(" The Wizard fills your last slot, so nothing returns.", " · Last slot · nothing returns");
  }
  return text
    .replace("Choose what to attack.", "Pick attack target")
    .replace("No enemy troops: strike the Base.", "Strike Base")
    .replace("A Guard stands in the way: attack it first.", "Attack a Guard")
    .replace("This troop cannot attack now.", "Cannot attack")
    .replace(" A face-down trap springs before damage.", " · trap before damage")
    .replace(" Or take cover:", " · or take cover:")
    .replace(" Take cover:", " · Take cover:")
    .replace("cover: until your next turn it keeps extra damage off your Base, but it will not hit back.", "cover")
    .replace(" Spells cannot hit a troop in cover.", " (avoids spells)")
    .replace(/^Choose an enemy troop for (.+)\.$/, evenFight ? "$1 · Pick an uncovered enemy troop" : "$1 · Pick an enemy troop")
    .replace(/^Choose one of your troops to carry (.+)\.$/, "$1 · Pick your troop")
    .replace(/^Choose (\d+) of your troops to send to the graveyard as payment for (.+)\.$/, "$2 · Pay with $1 of your troops");
}

const el = (tag, cls, word) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (word) node.textContent = word;
  return node;
};
// Antigravity PR #242's short hand cues, with the target, unit and current cover rule spelled out.
function handEffect(card, evenFight) {
  const effect = EFFECTS[card.effect];
  if (card.kind === "gear") return effect.attack ? `Carrier +${effect.attack} ATK` : `Carrier +${effect.orbs} orbs`;
  if (card.kind === "location") return `All ${effect.tag} troops +1 ATK`;
  const enemy = evenFight ? "uncovered enemy troop" : "enemy troop";
  switch (card.effect) {
    case "shot": return `1 ${enemy} −1 orb`;
    case "tie": return `Stun 1 ${enemy}`;
    case "hellfire": return `Each ${enemy} −1 orb`;
    case "snare": return "Enemy attacker −2 orbs first";
    case "hex": return "Cancel enemy attack";
    default: return effect.text;
  }
}

export function paintedFace(type, inHand, evenFight) {
  const card = TYPES[type];
  const face = el("span", "table-card-face");
  face.setAttribute("aria-hidden", "true");
  const title = el("span", "table-card-title", card.name);
  const artwork = cardArtwork(type);
  const notes = el("span", "table-card-copy");
  const kind = card.kind[0].toUpperCase() + card.kind.slice(1);
  const category = el("span", "table-card-kind", inHand ? (card.tag ?? kind) : icons[card.kind] + " " + kind);
  if (inHand && artwork) artwork.append(category);
  else notes.append(category);
  if (card.kind === "troop") {
    const stats = el("span", "table-card-stats");
    const health = inHand ? `${card.health} orb${card.health === 1 ? "" : "s"}` : card.health + " ●";
    stats.append(el("span", "", card.attack + " ATK"), el("span", "", health));
    const cost = tributes(type);
    notes.append(stats);
    const labels = (card.keys ?? []).map((key) => KEYWORDS[key][0]);
    if (cost) labels.push(`${cost} tribute${inHand && cost > 1 ? "s" : ""}`);
    if (labels.length) notes.append(el("span", "table-card-rule", labels.join(" · ")));
  } else {
    notes.append(el("span", "table-card-rule", inHand ? handEffect(card, evenFight) : EFFECTS[card.effect].text));
  }
  face.append(title);
  if (artwork) face.append(artwork);
  face.append(notes);
  return face;
}

export function paintCardFaces(root, selector, evenFight = false) {
  for (const card of root.querySelectorAll(selector)) {
    if (card.querySelector(".table-card-face")) continue;
    const type = card.dataset.face ?? card.dataset.choose ?? card.dataset.opened ?? typeOf(card.dataset.card);
    const inHand = card.dataset.card !== undefined;
    const original = el("span", "table-card-original");
    original.append(...card.childNodes);
    if (inHand) {
      for (const key of original.querySelectorAll(".sd-key[title]")) key.append(". " + key.title);
      const effect = EFFECTS[TYPES[type].effect];
      if (effect?.target) original.append(el("span", "sd-note", evenFight
        ? "Cannot target Ghostly troops or troops in cover." : "Cannot target Ghostly troops."));
      if (TYPES[type].kind === "location") original.append(el("span", "sd-note", "Applies to both sides."));
    }
    card.append(original, paintedFace(type, inHand, evenFight));
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
  const cover = root.querySelector("#sd-cover");
  const hand = root.querySelector("#sd-hand");
  const result = root.querySelector("#sd-result");
  const handRules = el("details", "table-hand-rules");
  const rules = el("div");
  handRules.append(el("summary", "", "Hand rules"), rules);
  handRules.hidden = true;
  // Keep the disclosure below the projected controls, including when Ride or Fight hides the zones.
  table.after(handRules);

  function showHandRules(cards) {
    rules.replaceChildren();
    handRules.hidden = cards.length === 0;
    if (handRules.hidden) handRules.open = false;
    for (const button of cards) {
      const rule = el("p");
      rule.append(...button.querySelector(".table-card-original").cloneNode(true).childNodes);
      rules.append(rule);
    }
  }

  function finish() {
    headline.hidden = !root.classList.contains("table-resolved");
    hand.inert = !headline.hidden;
  }

  function restoreBoard() {
    forecasts.clear();
    hand.inert = false;
    table.classList.remove("table-resolved");
    root.classList.remove("table-resolved");
    if (!goHome.matches("[data-return-wanted], [data-return-book]")) goHome.textContent = "Back to camp";
    prompt.textContent = "";
    cover.removeAttribute("title");
    prompt.hidden = turn.hidden = series.hidden = headline.hidden = true;
  }

  return {
    paint(view) {
      const ended = Boolean(view.result);
      paintCardFaces(root, "#sd-hand [data-card], #sd-result [data-choose], #sd-result [data-face]", view.evenFight);
      const handCards = [...hand.querySelectorAll("[data-card]")];
      showHandRules(ended ? [] : handCards);
      if (!root.classList.contains("sd-diorama")) return;
      table.classList.toggle("table-resolved", ended);
      root.classList.toggle("table-resolved", ended);
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
      if (!goHome.matches("[data-return-wanted], [data-return-book]")) goHome.textContent = "Camp";
      prompt.textContent = ended ? "" : compactSelectionPrompt(originalPrompt.textContent, view.evenFight);
      prompt.hidden = !prompt.textContent;
      cover.title = cover.hidden || ended ? "" : originalPrompt.textContent;
      finish();
    },
    restoreBoard,
    clear() {
      restoreBoard();
      showHandRules([]);
    },
  };
}
