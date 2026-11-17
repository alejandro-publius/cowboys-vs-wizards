// The deck balance script on a tiny sample: same input, same bytes.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COUNTS, validateDeck } from "../../src/game/deck-builder.js";
import { balance, sampleDecks } from "../../scripts/deck-balance.mjs";

test("deck balance: a tiny sample is byte-identical on a second run and starts each side equally", () => {
  const options = { decks: 3, from: 0, count: 2 };
  const first = balance(options);
  assert.equal(JSON.stringify(balance(options)), JSON.stringify(first));

  assert.equal(first.decks.length, 4, "three sampled decks plus the starter");
  assert.equal(first.decks.filter((deck) => deck.starter).length, 1);
  assert.equal(first.matches, 4 * 2 * 2);
  assert.equal(first.byStartingSide.cowboy.matches, first.byStartingSide.wizard.matches);
  for (const deck of first.decks) {
    assert.equal(deck.wins + deck.losses + deck.draws, deck.matches);
    assert.equal(deck.byStartingSide.cowboy.matches, deck.byStartingSide.wizard.matches);
  }
});

test("deck balance: the sample is the starter plus distinct valid decks", () => {
  const sample = sampleDecks(200);
  assert.deepEqual(sample[0], DEFAULT_COUNTS);
  assert.equal(new Set(sample.map((counts) => JSON.stringify(counts))).size, 201);
  for (const counts of sample) assert.equal(validateDeck(counts).ok, true);
});
