import assert from "node:assert/strict";
import test from "node:test";
import { EFFECTS, KEYWORDS, TYPES, tributes } from "../../src/game/showdown/cards.js";

test("painted hand faces identify all 29 cards and distinguish both spell-cover rules", async (t) => {
  t.after(() => { delete globalThis.document; delete globalThis.__CVW_DIORAMA_ATLAS__; });
  globalThis.__CVW_DIORAMA_ATLAS__ = "test-atlas";
  globalThis.document = {
    createElement: () => ({
      children: [], style: {},
      append(...nodes) { this.children.push(...nodes); },
      setAttribute(key, value) { this[key] = value; },
    }),
  };
  const { paintedFace } = await import("../../src/ui/showdown-3d/table-ui.js");
  const cues = {
    shot: "1 enemy troop −1 orb", tie: "Stun 1 enemy troop", hellfire: "Each enemy troop −1 orb",
    snare: "Enemy attacker −2 orbs first", hex: "Cancel enemy attack",
    sixshooter: "Carrier +1 ATK", bonearmor: "Carrier +2 orbs",
    office: "All Lawman troops +1 ATK", boneyard: "All Undead troops +1 ATK",
  };
  assert.equal(Object.keys(TYPES).length, 29);
  for (const [type, card] of Object.entries(TYPES)) {
    for (const evenFight of [false, true]) {
      const face = paintedFace(type, true, evenFight);
      const [title, art, copy] = face.children;
      assert.equal(face["aria-hidden"], "true", type);
      assert.equal(title.textContent, card.name);
      assert.equal(art.className, "sd-card-art");
      assert.equal(art.children[0].textContent, card.tag ?? card.kind[0].toUpperCase() + card.kind.slice(1));
      if (card.kind === "troop") {
        const [stats, rule] = copy.children;
        assert.deepEqual(stats.children.map((s) => s.textContent),
          [`${card.attack} ATK`, `${card.health} orb${card.health === 1 ? "" : "s"}`], type);
        const cost = tributes(type);
        const labels = card.keys.map((key) => KEYWORDS[key][0]);
        if (cost) labels.push(cost === 1 ? "1 tribute" : "2 tributes");
        assert.equal(rule?.textContent ?? "", labels.join(" · "), type);
      } else {
        const cue = cues[card.effect];
        assert.equal(copy.children[0].textContent,
          evenFight && card.kind === "spell" ? cue.replace("enemy troop", "uncovered enemy troop") : cue, type);
      }
    }
    if (card.kind !== "troop") {
      const [, art, copy] = paintedFace(type, false, false).children;
      assert.equal(art.children.length, 0, type);
      assert.equal(copy.children[1].textContent, EFFECTS[card.effect].text, type);
    }
  }
});
