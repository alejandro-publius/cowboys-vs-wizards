import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { CARDS, DECKS, SIDES, tributeCost } from "../../src/game/cards.js";
import { CARD_SPECS, SHOWDOWN_SPECS } from "../../src/game/card-specs.generated.js";
import { DECKS as SHOWDOWN_DECKS, EFFECTS, KEYWORDS, RARITY, TYPES } from "../../src/game/showdown/cards.js";
import { cardsCsv } from "../../prototypes/showdown/export-cards.mjs";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";

// The JSON specs are the source of truth; the tests compare the engine to them.
const specDir = new URL("../../.kiro/specs/duel-card-pipeline/cards/", import.meta.url);
const allSpecs = readdirSync(specDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(new URL(name, specDir), "utf8")));
// The lane duel reads every spec except Showdown-only ones, and none of the `showdown` block.
const specs = allSpecs.filter((spec) => !spec.showdownOnly).map(({ showdown, ...lane }) => lane);
const sideSpecs = (side) => specs.filter((spec) => spec.side === side).sort((a, b) => a.order - b.order);
const idOf = (spec, copy) => `${spec.type}-${copy}`;

test("generated card list matches the JSON specs in deck order", () => {
  assert.deepEqual(CARD_SPECS, SIDES.flatMap(sideSpecs));
});

test("registry holds available copies; default decks retain each spec's copies and order", () => {
  const expectedRegistry = [];
  for (const side of SIDES) {
    const expectedDeck = [];
    for (const { type, order, copies, ...fields } of sideSpecs(side)) {
      const availableCopies = fields.limit ?? (fields.bounty ? 1 : side === "cowboy" ? 6 : copies);
      for (let copy = 1; copy <= availableCopies; copy++) {
        const id = idOf({ type }, copy);
        expectedRegistry.push(id);
        if (copy <= copies) expectedDeck.push(id);
        assert.deepEqual(CARDS[id], { id, ...fields });
        assert.ok(Object.isFrozen(CARDS[id]), `${id} is frozen`);
      }
    }
    assert.equal(expectedDeck.length, 12);
    assert.deepEqual(DECKS[side], expectedDeck);
    assert.ok(Object.isFrozen(DECKS[side]));
  }
  const extraSingularity = "wizard-singularity-3";
  expectedRegistry.push(extraSingularity);
  assert.deepEqual(CARDS[extraSingularity], {...CARDS["wizard-singularity-2"], id: extraSingularity});
  assert.ok(Object.isFrozen(CARDS[extraSingularity]));
  assert.equal(expectedRegistry.length, 52);
  assert.deepEqual(Object.keys(CARDS).sort(), expectedRegistry.sort());
  assert.ok(Object.isFrozen(CARDS) && Object.isFrozen(DECKS));
});

test("each side's first free troop spec can be summoned from hand", () => {
  for (const side of SIDES) {
    const spec = sideSpecs(side).find((item) => item.kind === "troop" && tributeCost(item.stars) === 0);
    const cardId = idOf(spec, 1);
    const state = createMatch(1);
    state.activeSide = side;
    state.sides[side].hand = [cardId];
    state.sides[side].deck = DECKS[side].filter((id) => id !== cardId);
    state.sides[side].board = [null, null, null];

    const result = applyAction(state, { type: "summon", side, revision: state.revision, cardId, slot: 0, tributes: [] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.sides[side].board[0], { cardId, health: spec.health });
    assert.deepEqual(result.state.sides[side].hand, []);
  }
});

// Showdown reads the same catalog. These values are the ones the old OVERLAY and FRESH
// tables in src/game/showdown/cards.js held before the catalog took them over.
const SHOWDOWN_ONLY = [
  "cowboy-bear-trap", "cowboy-six-shooter", "cowboy-sheriffs-office", "wizard-bone-wall", "wizard-raven-familiar",
  "wizard-headless-horseman", "wizard-jack-o-lantern", "wizard-hellfire", "wizard-hex", "wizard-bone-armor", "wizard-boneyard",
];

test("Showdown has exactly 29 catalog cards: the lane cards in lane order, then the Showdown-only ones", () => {
  assert.equal(allSpecs.length, 29);
  assert.equal(SHOWDOWN_SPECS.length, 29);
  assert.deepEqual(SHOWDOWN_SPECS.map((card) => card.type), [...CARD_SPECS.map((spec) => spec.type), ...SHOWDOWN_ONLY]);
  assert.deepEqual(Object.keys(TYPES), SHOWDOWN_SPECS.map((card) => card.type));
  assert.deepEqual(SHOWDOWN_SPECS.filter((card) => card.showdownOnly).map((card) => card.type), SHOWDOWN_ONLY);
  assert.deepEqual(Object.keys(TYPES).filter((type) => TYPES[type].fresh), SHOWDOWN_ONLY);
});

test("every Showdown card has a rarity, and a tag and keywords or an effect, that resolve", () => {
  for (const [type, card] of Object.entries(TYPES)) {
    assert.ok(RARITY[card.rarity], `${type} rarity`);
    if (card.kind === "troop") {
      assert.match(card.tag, /^[A-Z][a-z]+$/, `${type} tag`);
      for (const key of card.keys) assert.ok(KEYWORDS[key], `${type} keyword ${key}`);
      assert.equal(card.effect, undefined, `${type} has no effect`);
    } else {
      assert.ok(EFFECTS[card.effect], `${type} effect`);
      assert.equal(card.tag, undefined, `${type} has no tag`);
    }
  }
});

test("Showdown keeps the lane catalog's numbers for lane cards", () => {
  for (const spec of CARD_SPECS) {
    const { side, name, kind, stars, attack, health } = TYPES[spec.type];
    assert.deepEqual({ side, name, kind, stars, attack, health }, { side: spec.side, name: spec.name, kind: spec.kind, stars: spec.stars, attack: spec.attack, health: spec.health });
    assert.equal(TYPES[spec.type].bounty, Boolean(spec.bounty));
  }
});

test("canonical Showdown values for a sample of cards", () => {
  assert.deepEqual(TYPES["cowboy-sheriff"], { side: "cowboy", name: "Sheriff", kind: "troop", stars: 2, attack: 1, health: 3, bounty: false, keys: [], rarity: "basic", tag: "Lawman" });
  assert.deepEqual(TYPES["cowboy-deadeye"], { side: "cowboy", name: "Deadeye", kind: "spell", stars: undefined, attack: undefined, health: undefined, bounty: false, keys: [], rarity: "common", effect: "shot" });
  assert.deepEqual(TYPES["wizard-lantern-wraith"], { side: "wizard", name: "Lantern Wraith", kind: "troop", stars: 6, attack: 2, health: 4, bounty: true, keys: ["ghostly"], rarity: "legendary", tag: "Undead" });
  assert.deepEqual(TYPES["wizard-bone-wall"], { side: "wizard", name: "Bone Wall", rarity: "common", kind: "troop", stars: 3, attack: 0, health: 4, tag: "Undead", keys: ["guard"], fresh: true });
  assert.deepEqual(TYPES["cowboy-sheriffs-office"], { side: "cowboy", name: "Sheriff's Office", rarity: "rare", kind: "location", effect: "office", fresh: true });
  assert.deepEqual(TYPES["wizard-hex"], { side: "wizard", name: "Hex", rarity: "uncommon", kind: "trap", effect: "hex", fresh: true });
  for (const side of SIDES) for (const type of Object.keys(SHOWDOWN_DECKS[side])) assert.equal(TYPES[type]?.side, side, type);
});

test("cards.csv regenerates byte for byte from the catalog", () => {
  assert.equal(cardsCsv(), readFileSync(new URL("../../prototypes/showdown/cards.csv", import.meta.url), "utf8"));
});
