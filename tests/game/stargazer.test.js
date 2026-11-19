import assert from "node:assert/strict";
import test from "node:test";
import { CARDS, DECKS } from "../../src/game/cards.js";
import { STARGAZER_DECK } from "../../src/game/deck-presets.js";
import { createMatch } from "../../src/game/state.js";

const kind = (id) => id.replace(/^wizard-/, "").replace(/-\d+$/, "");

test("Stargazer preset is 6 Skeleton, 2 Wizard, 1 Dragon, 3 Singularity in ID order", () => {
  assert.equal(STARGAZER_DECK.length, 12);
  assert.deepEqual(STARGAZER_DECK.map(kind), [
    ...Array(6).fill("skeleton"), "wizard", "wizard", "dragon", "singularity", "singularity", "singularity",
  ]);
  assert.ok(STARGAZER_DECK.every((id) => CARDS[id]?.side === "wizard"));
  assert.ok(CARDS["wizard-singularity-3"]);
  assert.ok(!DECKS.wizard.includes("wizard-singularity-3"));
  assert.equal(DECKS.wizard.length, 12);
});

test("wizardDeck leaves the default match and RNG order unchanged", () => {
  for (const seed of [0, 4, 60, 244, 690]) {
    assert.deepEqual(createMatch(seed, { wizardDeck: [...DECKS.wizard] }), createMatch(seed));
    const stargazer = createMatch(seed, { wizardDeck: [...STARGAZER_DECK] });
    const base = createMatch(seed);
    assert.deepEqual(stargazer.sides.cowboy, base.sides.cowboy);
    assert.equal(stargazer.startingSide, base.startingSide);
    assert.equal(stargazer.rng, base.rng);
    assert.deepEqual(stargazer, createMatch(seed, { wizardDeck: [...STARGAZER_DECK] }));
  }
});

test("seed 4 Stargazer hand is Skeleton, Skeleton, Wizard, Singularity", () => {
  const { hand } = createMatch(4, { wizardDeck: [...STARGAZER_DECK] }).sides.wizard;
  assert.deepEqual(hand.map(kind), ["skeleton", "skeleton", "wizard", "singularity"]);
  assert.deepEqual(createMatch(4).sides.wizard.hand.map(kind), ["skeleton", "skeleton", "wizard", "dragon"]);
});

test("invalid wizardDeck lists are refused", () => {
  const deck = [...STARGAZER_DECK];
  const sparse = [...deck];
  delete sparse[3];
  const bad = [
    deck.slice(0, 11),
    [...deck.slice(0, 11), "cowboy-sheriff-1"],
    [...deck.slice(0, 11), deck[0]],
    [...deck.slice(0, 11), "wizard-lantern-wraith-1"],
    sparse,
    [...deck.slice(0, 11), 7],
    "wizard-skeleton-1",
    null,
  ];
  for (const wizardDeck of bad) assert.throws(() => createMatch(4, { wizardDeck }), TypeError);
  const wraith = Object.values(CARDS).find((card) => card.side === "wizard" && card.bounty);
  if (wraith) assert.throws(() => createMatch(4, { wizardDeck: [...deck.slice(0, 11), wraith.id] }), TypeError);
});
