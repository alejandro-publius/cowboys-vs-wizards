// FH-R2 (.kiro/specs/showdown-first-hour/requirements.md): art-first minimal visual copy on the 3D table and Saloon.
import test from "node:test";
import assert from "node:assert/strict";
import {EFFECTS, TYPES} from "../../src/game/showdown/cards.js";
import {COMPACT_CARD_RULES, compactSelectionPrompt} from "../../src/ui/showdown-3d/table-ui.js";
import {parseWorldLabel} from "../../src/ui/showdown-3d/referee-observer.js";

const tokenCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

test("every non-troop card effect has a compact visual badge of at most 4 tokens", () => {
  for (const [id, card] of Object.entries(TYPES)) {
    if (card.kind === "troop") continue;
    assert.ok(card.effect in EFFECTS, `${id} references a known effect`);
    const compact = COMPACT_CARD_RULES[card.effect];
    assert.equal(typeof compact, "string", `${id} (${card.effect}) has a compact badge`);
    assert.ok(tokenCount(compact) <= 4, `${id} badge "${compact}" stays within 4 tokens`);
  }
});

test("compactSelectionPrompt keeps every 3D table prompt within 10 tokens while preserving public trap and Raise cues", () => {
  const cover = "cover: until your next turn it keeps extra damage off your Base, but it will not hit back.";
  const cases = [
    [`Choose what to attack. Or take ${cover}`, "Pick target · or Take cover"],
    [`No enemy troops: strike the Base. Or take ${cover}`, "Strike Base · or Take cover"],
    [`No enemy troops: strike the Base. A face-down trap springs before damage. Or take ${cover}`, "Strike Base · Trap set! · or Cover"],
    [`A Guard stands in the way: attack it first. Or take ${cover}`, "Strike Guard · or Take cover"],
    [`This troop cannot attack now. Take ${cover}`, "Rests this turn · Take cover"],
    [
      "Choose a tribute for Wizard. Pay Skeleton: Skeleton returns with 1 orb. Pay Imp: no Undead to return.",
      "Skeleton → Raise 1● · Imp → none",
    ],
    ["Choose 1 of your troops to send to the graveyard as payment for Billy.", "Tribute 1 for Billy"],
    ["Choose one of your troops to carry Six-Shooter.", "Equip Six-Shooter"],
    ["Choose an enemy troop for Deadeye.", "Target foe · Deadeye"],
  ];
  for (const [raw, expected] of cases) {
    const actual = compactSelectionPrompt(raw);
    assert.equal(actual, expected);
    assert.ok(tokenCount(actual) <= 10, `"${actual}" exceeds 10 tokens`);
  }
  assert.equal(compactSelectionPrompt("Play your cards: one troop a turn."), "");
});

test("parseWorldLabel reads both verbose and compact 3D zone badges", () => {
  assert.deepEqual(parseWorldLabel("12"), {title: "Deck", count: 12});
  assert.deepEqual(parseWorldLabel("✝ 3"), {title: "Graveyard", count: 3});
  assert.deepEqual(parseWorldLabel("▲ 1"), {title: "Traps", count: 1});
  assert.deepEqual(parseWorldLabel("Deck 12"), {title: "Deck", count: 12});
  assert.deepEqual(parseWorldLabel("Graveyard 3"), {title: "Graveyard", count: 3});
  assert.deepEqual(parseWorldLabel("Traps 1/2"), {title: "Traps", count: 1, of: 2});
});
