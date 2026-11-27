import assert from "node:assert/strict";
import test from "node:test";
import { EFFECTS, KEYWORDS, TYPES, tributes } from "../../src/game/showdown/cards.js";
import { face } from "../../src/ui/showdown-screen.js";

const badges = {
  shot: "✦ −1 ●", tie: "✦ Stun", hellfire: "✦ Foes −1 ●",
  snare: "△ −2 ●", hex: "△ Cancel",
  sixshooter: "◇ +1 ⚔︎", bonearmor: "◇ +2 ●",
  office: "▰ Lawman +1", boneyard: "▰ Undead +1",
};

class Element {
  className = "";
  childNodes = [];
  dataset = {};
  style = {};
  classList = { add() {}, toggle() {} };
  get children() { return this.childNodes.filter(node => node instanceof Element); }
  get textContent() { return this.childNodes.map(node => node.textContent ?? node).join(""); }
  set textContent(text) { this.childNodes = [text]; }
  append(...nodes) { this.childNodes.push(...nodes); }
  setAttribute(key, value) { this[key] = value; }
  querySelectorAll(selector) {
    if (selector === ".sd-key[title]") return this.children.filter(node => node.className === "sd-key" && node.title);
    return this.children.filter(node => "." + node.className === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0]; }
}

test("all painted cards share the hand and book layout, original art, and compact stats or effect", async (t) => {
  t.after(() => { delete globalThis.document; delete globalThis.__CVW_DIORAMA_ATLAS__; });
  globalThis.__CVW_DIORAMA_ATLAS__ = "test-atlas";
  globalThis.document = { createElement: () => new Element() };
  const { paintedFace, paintCardFaces } = await import("../../src/ui/showdown-3d/table-ui.js");
  const cards = Object.entries(TYPES);
  assert.equal(cards.length, 29);

  for (const [index, [type, card]] of cards.entries()) {
    const book = paintedFace(type);
    const [title, art, copy] = book.children;
    assert.equal(book["aria-hidden"], "true", type);
    assert.equal(title.textContent, card.name);
    assert.equal(art.className, "sd-card-art");
    assert.equal(art.style.backgroundPosition, `${index % 6 * 20}% ${Math.floor(index / 6) * 20}%`, type);
    if (card.kind === "troop") {
      const [stats, rule] = copy.children;
      assert.deepEqual(stats.children.map(node => [node.dataset.stat, node.textContent]),
        [["attack", "⚔︎" + card.attack], ["health", "●" + card.health]], type);
      assert.equal(art.children[0].textContent, card.tag, type);
      const cost = tributes(type);
      assert.deepEqual(art.children.slice(1).map(node => [node.dataset.stat, node.textContent]),
        cost ? [["tribute", "★" + cost]] : [], type);
      assert.equal(rule?.textContent ?? "", card.keys.map(key => KEYWORDS[key][0]).join(" · "), type);
    } else {
      assert.equal(art.children.length, 0);
      assert.equal(copy.children.length, 1);
      assert.equal(copy.children[0].textContent, badges[card.effect], type);
    }

    for (const evenFight of [false, true]) {
      const button = new Element();
      button.dataset.card = type + "-1";
      // The hand renderer supplies the catalog text, keyword titles and turn-specific availability.
      const base = face(type, "", evenFight);
      const baseText = base.replace(/<[^>]+>/g, " ");
      button.append(baseText);
      for (const key of card.keys ?? []) {
        const keyword = new Element();
        keyword.className = "sd-key";
        [keyword.textContent, keyword.title] = KEYWORDS[key];
        assert.ok(base.includes(`title="${keyword.title}"`), type);
        button.append(keyword);
      }
      button.append("Current availability.");
      paintCardFaces({ querySelectorAll: () => [button] }, "[data-card]", evenFight);
      const hand = button.querySelector(".table-card-face");
      assert.equal(JSON.stringify(hand), JSON.stringify(book), type);
      const details = button.querySelector(".table-card-original").textContent.replace(/\s+/g, " ").trim();
      assert.equal(button["aria-label"], "Play " + card.name, type);
      assert.equal(button["aria-describedby"], button.querySelector(".table-card-original").id, type);
      assert.ok(details.includes("Current availability."), type);
      for (const key of card.keys ?? []) assert.ok(details.includes(KEYWORDS[key][1]), type);
      if (card.keys?.includes("raise")) assert.match(details, /Pay tributes first.*open slot/);
      if (card.kind === "troop") {
        const cost = tributes(type);
        assert.ok(details.includes(cost ? `Cost: ${cost} of your troops` : "Cost: none."), type);
      } else if (card.effect === "hellfire" && evenFight) {
        assert.match(details, /each enemy troop outside cover/);
      } else {
        assert.ok(details.includes(EFFECTS[card.effect].text), type);
      }
      if (EFFECTS[card.effect]?.target) {
        assert.match(details, /Cannot target Ghostly troops/);
        assert.equal(details.includes("troops in cover"), evenFight, type);
      }
      if (card.effect === "hellfire") assert.match(details, /Hits Ghostly troops/);
      if (card.effect === "tie") assert.match(details, /not already stunned/);
      if (card.kind === "gear") assert.match(details, /one of your troops/);
      if (card.kind === "location") assert.match(details, /both sides/);
      if (card.kind === "trap") assert.match(details, /oldest trap springs first, one per attack/);
    }
  }
});
