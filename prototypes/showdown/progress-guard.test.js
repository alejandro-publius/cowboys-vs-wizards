import test from "node:test";
import assert from "node:assert/strict";
import {deckProblems, duelFor, migrate, newSave, withDeck} from "./progress.js";
import {GRIT_CAP, STARTER, TRAIL} from "./trail.js";

test("a legacy v1 save keeps its losses on the unfinished Trail duel", () => {
  const save = migrate({wins: 2, losses: 2});
  assert.equal(save.v, 2);
  assert.equal(save.wins, 2);
  assert.equal(save.losses.trail, 2);
  assert.equal(duelFor(save, "trail").options.baseOrbs.cowboy, 5 + Math.min(2, GRIT_CAP));
  assert.deepEqual(migrate(save), save, "the migrated save is a valid v2 save");
});

test("a legacy v1 save with no usable losses or a finished Trail carries none", () => {
  assert.equal(migrate({wins: 1, losses: 0}).losses.trail, 0);
  assert.equal(migrate({wins: 1, losses: -3}).losses.trail, 0);
  assert.equal(migrate({wins: 1, losses: 1.5}).losses.trail, 0);
  assert.equal(migrate({wins: TRAIL.length, losses: 4}).losses.trail, 0);
});

test("negative or fractional deck and side counts are refused before they can cancel out", () => {
  const save = newSave();
  const [a, b] = Object.keys(STARTER);
  const deck = {...STARTER, [a]: STARTER[a] + 1, [b]: STARTER[b] - STARTER[b] - 1};
  assert.ok(deckProblems(save, deck).length, "a -1 count does not make a 16-card deck legal");
  assert.throws(() => withDeck(save, deck));
  assert.throws(() => withDeck(save, STARTER, {[a]: 1, [b]: -1}));
  assert.throws(() => withDeck(save, {...STARTER, [a]: STARTER[a] + 0.5, [b]: STARTER[b] - 0.5}));
  assert.deepEqual(withDeck(save, STARTER).deck, STARTER, "a valid deck still saves");
  assert.equal(migrate({...save, deck}).deck[b], STARTER[b], "a stored bad count falls back to a new save");
});
