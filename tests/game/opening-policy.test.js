import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { drought, isFree, openingMatch, parseOpeningParams } from "../../src/game/opening-policy.js";

const seeds = [0, 60, ...Array.from({ length: 300 }, (_, i) => 1000 + i)];
const params = (query) => new URLSearchParams(query);

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
