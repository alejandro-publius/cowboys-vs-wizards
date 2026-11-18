import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { deckIds } from "../../src/game/deck-builder.js";
import { createMatch } from "../../src/game/state.js";
import {
  GRAYBOX_OPENINGS, drought, guaranteeFree, isFree, openingDroughtRate, openingMatch, parseOpeningParams,
} from "../../src/game/opening-policy.js";

const seeds = [0, 60, ...Array.from({ length: 300 }, (_, i) => 1000 + i)];
const params = (query) => new URLSearchParams(query);

test("standard opening risk is exact for stock and one-Sheriff decks", () => {
  const heavyDeck = deckIds({
    "cowboy-sheriff": 1, "cowboy-billy": 3, "cowboy-mounted-billy": 4, "cowboy-deadeye": 4,
  });
  assert.ok(Math.abs(openingDroughtRate(DECKS.cowboy) - 15 / 495) < 1e-12);
  assert.ok(Math.abs(openingDroughtRate(heavyDeck) - 330 / 495) < 1e-12);
});

test("shipped opening equals createMatch for natural and forced seats", () => {
  for (const seed of seeds) assert.deepEqual(openingMatch(seed, "shipped"), createMatch(seed));
  const forced = openingMatch(0, "shipped", "wizard");
  assert.equal(forced.startingSide, "wizard");
  assert.equal(forced.activeSide, "wizard");
});

test("both: free opener for each seat, hand 4 first / 5 second, cards conserved", () => {
  let droughts = 0;
  for (const seed of seeds) {
    for (const first of SIDES) {
      const base = openingMatch(seed, "shipped", first);
      const both = openingMatch(seed, "both", first);
      const second = SIDES.find((side) => side !== first);
      droughts += SIDES.filter((side) => drought(base.sides[side].hand)).length;
      assert.equal(both.sides[first].hand.length, 4);
      assert.equal(both.sides[second].hand.length, 5);
      for (const side of SIDES) {
        const { hand, deck } = both.sides[side];
        assert.ok(hand.some(isFree), `seed ${seed} ${side} has a free opener`);
        assert.deepEqual([...hand, ...deck].sort(), [...DECKS[side]].sort());
        assert.ok([...hand, ...deck].every((id) => CARDS[id].side === side));
      }
    }
  }
  assert.ok(droughts > 0, "sample includes a hand with no free summon");
});

test("parseOpeningParams opts in only for a recognized opening", () => {
  assert.equal(parseOpeningParams(params("")), null);
  assert.equal(parseOpeningParams(params("seed=60&first=wizard")), null);
  assert.equal(parseOpeningParams(params("opening=nope&first=wizard")), null);
  assert.deepEqual(parseOpeningParams(params("opening=both&first=wizard")), { opening: "both", first: "wizard" });
  assert.deepEqual(parseOpeningParams(params("opening=shipped&first=bogus")), { opening: "shipped", first: undefined });
});

test("freeOpener opts in only for the graybox opening list", () => {
  // Illustrated entry (default list): unchanged, freeOpener is the default game.
  assert.equal(parseOpeningParams(params("opening=freeOpener&first=wizard")), null);
  assert.equal(parseOpeningParams(params("opening=extraCard")), null);
  // Graybox list: freeOpener with or without first; the old openings still parse.
  assert.deepEqual(parseOpeningParams(params("seed=14&opening=freeOpener&first=cowboy&cpu=normal"), GRAYBOX_OPENINGS),
    { opening: "freeOpener", first: "cowboy" });
  assert.deepEqual(parseOpeningParams(params("opening=freeOpener&first=bogus"), GRAYBOX_OPENINGS),
    { opening: "freeOpener", first: undefined });
  assert.deepEqual(parseOpeningParams(params("opening=both&first=wizard"), GRAYBOX_OPENINGS), { opening: "both", first: "wizard" });
  assert.equal(parseOpeningParams(params("seed=14"), GRAYBOX_OPENINGS), null);
  assert.equal(parseOpeningParams(params("opening=FreeOpener"), GRAYBOX_OPENINGS), null);
});

test("seed 14 freeOpener: a dry hand swaps only its last card; other state unchanged", () => {
  for (const first of [undefined, ...SIDES]) {
    const base = openingMatch(14, "shipped", first);
    const free = openingMatch(14, "freeOpener", first);
    assert.ok(SIDES.some((side) => drought(base.sides[side].hand)), "seed 14 deals a hand with no free summon");
    assert.equal(free.startingSide, base.startingSide);
    assert.equal(free.rng, base.rng);
    for (const side of SIDES) {
      const was = base.sides[side], now = free.sides[side];
      assert.equal(now.hand.length, 4);
      assert.ok(now.hand.some(isFree), `seed 14 ${side} has a free opener`);
      if (!drought(was.hand)) {
        assert.deepEqual(now, was, `seed 14 ${side} already had a free summon`);
        continue;
      }
      const at = was.deck.findIndex(isFree);
      assert.deepEqual(now.hand, [...was.hand.slice(0, 3), was.deck[at]]);
      assert.deepEqual(now.deck, was.deck.map((id, i) => (i === at ? was.hand[3] : id)));
    }
  }
});

test("guaranteeFree leaves a hand unchanged when its deck has no free troop", () => {
  const paid = Object.keys(CARDS).filter((id) => CARDS[id].side === "cowboy" && !isFree(id));
  const pick = (n) => Array.from({ length: n }, (_, i) => paid[i % paid.length]);
  const state = createMatch(0);
  state.sides.cowboy.hand = pick(4);
  state.sides.cowboy.deck = pick(6);
  const before = structuredClone(state.sides.cowboy);
  guaranteeFree(state);
  assert.deepEqual(state.sides.cowboy, before);
});
