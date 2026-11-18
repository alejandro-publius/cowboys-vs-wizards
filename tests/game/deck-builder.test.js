import test from "node:test";
import assert from "node:assert/strict";
import { CARD_SPECS } from "../../src/game/card-specs.generated.js";
import { CARDS, DECKS } from "../../src/game/cards.js";
import { COWBOY_CATALOG, DEFAULT_COUNTS, validateDeck, deckIds, validateDeckIds } from "../../src/game/deck-builder.js";
import { createMatch } from "../../src/game/state.js";
import { openingMatch, drought } from "../../src/game/opening-policy.js";

const DEFAULT_COWBOY_IDS = [
  "cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-sheriff-3", "cowboy-sheriff-4", "cowboy-sheriff-5", "cowboy-sheriff-6",
  "cowboy-billy-1", "cowboy-billy-2", "cowboy-billy-3", "cowboy-mounted-billy-1", "cowboy-deadeye-1", "cowboy-deadeye-2",
];
const DEFAULT_WIZARD_IDS = [
  "wizard-skeleton-1", "wizard-skeleton-2", "wizard-skeleton-3", "wizard-skeleton-4", "wizard-skeleton-5", "wizard-skeleton-6",
  "wizard-wizard-1", "wizard-wizard-2", "wizard-wizard-3", "wizard-dragon-1", "wizard-singularity-1", "wizard-singularity-2",
];
const CUSTOM_COUNTS = Object.freeze({
  "cowboy-sheriff": 6, "cowboy-billy": 2, "cowboy-mounted-billy": 2, "cowboy-deadeye": 2,
});

test("catalog and defaults retain all existing stats and default ID order", () => {
  assert.deepEqual(COWBOY_CATALOG, CARD_SPECS.filter((spec) => spec.side === "cowboy" && !spec.bounty));
  assert.deepEqual(DEFAULT_COUNTS, {
    "cowboy-sheriff": 6, "cowboy-billy": 3, "cowboy-mounted-billy": 1, "cowboy-deadeye": 2,
  });
  assert.deepEqual(DECKS.cowboy, DEFAULT_COWBOY_IDS);
  assert.deepEqual(DECKS.wizard, DEFAULT_WIZARD_IDS);
  assert.deepEqual(deckIds(DEFAULT_COUNTS), DEFAULT_COWBOY_IDS);
  assert(Object.isFrozen(COWBOY_CATALOG) && COWBOY_CATALOG.every(Object.isFrozen));
  assert(Object.isFrozen(DEFAULT_COUNTS));
});

test("the Cowboy pool has six copies per type without expanding the Wizard pool", () => {
  for (const { type, order, copies, ...card } of COWBOY_CATALOG) {
    for (let copy = 1; copy <= 6; copy++) {
      const id = `${type}-${copy}`;
      assert.deepEqual(CARDS[id], { id, ...card });
      assert(Object.isFrozen(CARDS[id]));
    }
    assert.equal(Object.hasOwn(CARDS, `${type}-7`), false);
  }
  assert.equal(Object.values(CARDS).filter(({ side, bounty }) => side === "cowboy" && !bounty).length, 24);
  assert.deepEqual(Object.values(CARDS).filter(({ side }) => side === "wizard").map(({ id }) => id), DEFAULT_WIZARD_IDS);
  assert.equal(Object.hasOwn(CARDS, "wizard-dragon-2"), false);
});

test("seed zero exactly retains the pre-builder default match", () => {
  const expected = {
    seed: 0, revision: 0, rng: 3471308035, round: 1, startingSide: "cowboy", activeSide: "cowboy",
    allowances: { cowboy: { summonUsed: false, castUsed: false }, wizard: { summonUsed: false, castUsed: false } },
    actionIds: [], result: null,
    sides: {
      cowboy: {
        baseOrbs: 5,
        deck: ["cowboy-sheriff-6", "cowboy-billy-1", "cowboy-billy-2", "cowboy-deadeye-2", "cowboy-sheriff-2", "cowboy-sheriff-3", "cowboy-sheriff-1", "cowboy-sheriff-4"],
        hand: ["cowboy-mounted-billy-1", "cowboy-deadeye-1", "cowboy-sheriff-5", "cowboy-billy-3"],
        board: [null, null, null], discard: [],
      },
      wizard: {
        baseOrbs: 5,
        deck: ["wizard-skeleton-3", "wizard-skeleton-4", "wizard-wizard-2", "wizard-skeleton-6", "wizard-wizard-1", "wizard-skeleton-5", "wizard-dragon-1", "wizard-skeleton-2"],
        hand: ["wizard-singularity-1", "wizard-singularity-2", "wizard-wizard-3", "wizard-skeleton-1"],
        board: [null, null, null], discard: [],
      },
    },
  };
  assert.deepEqual(createMatch(0), expected);
  assert.deepEqual(createMatch(0, { cowboyDeck: deckIds(DEFAULT_COUNTS) }), expected);
});

test("a custom deck conserves its counts and seeded behavior without changing Wizard setup", () => {
  const ids = Object.freeze(deckIds(CUSTOM_COUNTS));
  for (const seed of [0, 37, -1, 4294967295]) {
    const match = createMatch(seed, { cowboyDeck: ids });
    assert.deepEqual(match, createMatch(seed, { cowboyDeck: ids }));
    const selected = [...match.sides.cowboy.hand, ...match.sides.cowboy.deck];
    assert.equal(new Set(selected).size, 12);
    assert.deepEqual([...selected].sort(), [...ids].sort());
    for (const { type } of COWBOY_CATALOG) {
      assert.equal(selected.filter((id) => id.slice(0, id.lastIndexOf("-")) === type).length, CUSTOM_COUNTS[type]);
    }
    const standard = createMatch(seed);
    assert.deepEqual(match.sides.wizard, standard.sides.wizard);
    assert.equal(match.startingSide, standard.startingSide);
    assert.equal(match.rng, standard.rng);
  }
  assert.deepEqual(DECKS.cowboy, DEFAULT_COWBOY_IDS);
  assert.deepEqual(DECKS.wizard, DEFAULT_WIZARD_IDS);
});

test("debug opening variants preserve a selected deck, including a single Sheriff", () => {
  const singleSheriff = { "cowboy-sheriff": 1, "cowboy-billy": 5, "cowboy-mounted-billy": 3, "cowboy-deadeye": 3 };
  for (const counts of [CUSTOM_COUNTS, singleSheriff]) {
    const cowboyDeck = Object.freeze(deckIds(counts));
    for (const seed of [0, 37]) for (const variant of ["shipped", "both"]) for (const starter of ["cowboy", "wizard"]) {
      const match = openingMatch(seed, variant, starter, { cowboyDeck });
      assert.deepEqual(match, openingMatch(seed, variant, starter, { cowboyDeck }));
      assert.equal(match.startingSide, starter);
      assert.equal(match.activeSide, starter);
      for (const side of ["cowboy", "wizard"]) {
        const { hand, deck } = match.sides[side];
        const selected = [...hand, ...deck];
        const expected = side === "cowboy" ? cowboyDeck : DEFAULT_WIZARD_IDS;
        assert.equal(new Set(selected).size, 12);
        assert.deepEqual(selected.sort(), [...expected].sort());
        assert.equal(hand.length, variant === "both" && side !== starter ? 5 : 4);
        if (variant === "both") assert.equal(drought(hand), false);
      }
    }
    assert.deepEqual(cowboyDeck, deckIds(counts));
  }
});

test("count validation accepts zeros and missing types but rejects invalid compositions", () => {
  assert.deepEqual(validateDeck(CUSTOM_COUNTS), { ok: true, error: null, total: 12 });
  assert.deepEqual(validateDeck({ "cowboy-sheriff": 6, "cowboy-billy": 6 }), { ok: true, error: null, total: 12 });
  assert.equal(deckIds({ "cowboy-sheriff": 6, "cowboy-billy": 6 }).length, 12);
  for (const counts of [null, [], new Date(), "deck", {},
    { ...DEFAULT_COUNTS, "wizard-dragon": 1 },
    { ...DEFAULT_COUNTS, "cowboy-sheriff": 7 },
    { ...DEFAULT_COUNTS, "cowboy-sheriff": -1 },
    { ...DEFAULT_COUNTS, "cowboy-sheriff": 5.5 },
    { ...DEFAULT_COUNTS, "cowboy-sheriff": "6" },
    { ...DEFAULT_COUNTS, "cowboy-sheriff": NaN },
    { ...DEFAULT_COUNTS, "cowboy-sheriff": Infinity },
    { "cowboy-sheriff": 0, "cowboy-billy": 6, "cowboy-mounted-billy": 6, "cowboy-deadeye": 0 },
  ]) {
    const result = validateDeck(counts);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, "string");
    assert(result.error.length > 0);
    assert.throws(() => deckIds(counts), TypeError);
  }
  assert.equal(validateDeck({ ...DEFAULT_COUNTS, "cowboy-sheriff": 7 }).total, 13);
});

test("match creation rejects duplicate, foreign, unknown, oversized and Sheriff-free ID decks", () => {
  const noSheriff = [
    ...Array.from({ length: 6 }, (_, i) => `cowboy-billy-${i + 1}`),
    ...Array.from({ length: 6 }, (_, i) => `cowboy-deadeye-${i + 1}`),
  ];
  const duplicate = [...DEFAULT_COWBOY_IDS]; duplicate[11] = duplicate[0];
  const foreign = [...DEFAULT_COWBOY_IDS]; foreign[11] = "wizard-skeleton-1";
  const unknown = [...DEFAULT_COWBOY_IDS]; unknown[11] = "cowboy-sheriff-7";
  const malformed = [...DEFAULT_COWBOY_IDS]; malformed[11] = {};
  for (const ids of [null, {}, "deck", [], DEFAULT_COWBOY_IDS.slice(1), [...DEFAULT_COWBOY_IDS, "cowboy-billy-4"], duplicate, foreign, unknown, malformed, noSheriff]) {
    assert.equal(validateDeckIds(ids).ok, false);
    assert.throws(() => createMatch(0, { cowboyDeck: ids }), TypeError);
  }
  assert.deepEqual(validateDeckIds(deckIds(CUSTOM_COUNTS)), { ok: true, error: null, total: 12 });
});

test("selection and match creation do not mutate callers or share mutable ID lists", () => {
  const counts = Object.freeze({ ...CUSTOM_COUNTS });
  const first = deckIds(counts), second = deckIds(counts);
  assert.notEqual(first, second);
  first.pop();
  assert.equal(second.length, 12);
  const ids = Object.freeze([...second]);
  const before = [...ids];
  const one = createMatch(0, { cowboyDeck: ids });
  one.sides.cowboy.hand.pop();
  assert.deepEqual(ids, before);
  assert.equal(createMatch(0, { cowboyDeck: ids }).sides.cowboy.hand.length, 4);
  assert.deepEqual(counts, CUSTOM_COUNTS);
  assert.throws(() => { CARDS["cowboy-billy-6"].attack = 99; }, TypeError);
});
