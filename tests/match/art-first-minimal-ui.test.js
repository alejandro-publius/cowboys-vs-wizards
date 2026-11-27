import test from "node:test";
import assert from "node:assert/strict";
import {EFFECTS, TYPES} from "../../src/game/showdown/cards.js";
import {COMPACT_CARD_RULES, compactSelectionPrompt} from "../../src/ui/showdown-3d/table-ui.js";

const wordsOf = (s) => String(s).trim().split(/\s+/).filter(Boolean);

test("every non-troop Showdown effect has an explicit compact card-face rule <= 4 tokens", () => {
  for (const [effectId] of Object.entries(EFFECTS)) {
    assert.equal(typeof COMPACT_CARD_RULES[effectId], "string", `missing compact card rule for ${effectId}`);
    const tokens = wordsOf(COMPACT_CARD_RULES[effectId]);
    assert.ok(tokens.length >= 1 && tokens.length <= 4, `${effectId} rule "${COMPACT_CARD_RULES[effectId]}" exceeds 4 tokens`);
    assert.doesNotMatch(COMPACT_CARD_RULES[effectId], /\.\.\.|…/, `${effectId} must not pre-truncate`);
  }
  for (const [id, card] of Object.entries(TYPES)) {
    if (card.kind !== "troop") {
      assert.ok(COMPACT_CARD_RULES[card.effect], `${id} (${card.effect}) maps to a compact micro-rule`);
    }
  }
});

test("compactSelectionPrompt condenses verbose board instructions to <= 10 visual tokens", () => {
  const cover = "cover: until your next turn it keeps extra damage off your Base, but it will not hit back.";
  const cases = [
    [`Choose what to attack. Or take ${cover}`, "Pick target · or Take cover"],
    [`No enemy troops: strike the Base. Or take ${cover}`, "Strike Base · or Take cover"],
    [`No enemy troops: strike the Base. A face-down trap springs before damage. Or take ${cover}`, "Strike Base · Trap set! · or Cover"],
    [`Choose what to attack. A face-down trap springs before damage. Or take ${cover}`, "Pick target · Trap set! · or Cover"],
    [`This troop cannot attack now. Take ${cover}`, "Rests this turn · Take cover"],
    ["A Guard troop stands in front: choose a Guard target.", "Guard blocks · Pick Guard"],
    ["Choose an enemy troop for Lasso.", "Pick target"],
    ["Choose one of your troops to carry Six-Shooter.", "Pick troop"],
    [
      "Choose 1 troop to pay as tribute. Pay Skeleton: Skeleton returns with 1 orb. Pay Imp: no Undead to return.",
      "Skeleton → Raise 1● · Imp → none",
    ],
  ];
  for (const [full, expected] of cases) {
    const out = compactSelectionPrompt(full);
    assert.equal(out, expected);
    assert.ok(wordsOf(out).length <= 10, `"${out}" exceeds 10 visual tokens`);
  }
  assert.equal(compactSelectionPrompt(""), "");
  assert.equal(compactSelectionPrompt("Your turn."), "");
});
