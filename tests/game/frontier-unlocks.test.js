import assert from "node:assert/strict";
import test from "node:test";
import {FRONTIER_UNLOCKS, NIGHT_RIDERS, WAGON_TRAIN, frontierUnlocked} from "../../src/game/deck-presets.js";
import {validateDeck} from "../../src/game/deck-builder.js";

const total = (counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);
const withWins = (wins) => ({stats: {wins}});

test("one Frontier card unlocks per counted win, starting at the second", () => {
  assert.deepEqual(FRONTIER_UNLOCKS.map(({type, wins}) => [type, wins]), [
    ["cowboy-lasso", 2], ["cowboy-covered-wagon", 3], ["cowboy-outrider", 4],
    ["cowboy-dynamiter", 5], ["cowboy-ranger", 6], ["cowboy-gatling-crew", 7],
  ]);
  assert.deepEqual(frontierUnlocked(withWins(0)), []);
  assert.deepEqual(frontierUnlocked(withWins(1)), []);
  assert.deepEqual(frontierUnlocked(withWins(2)), ["cowboy-lasso"]);
  assert.equal(frontierUnlocked(withWins(6)).length, 5);
  assert.equal(frontierUnlocked(withWins(99)).length, 6);
  assert.deepEqual(frontierUnlocked(null), []);
  assert.deepEqual(frontierUnlocked({stats: {}}), []);
});

test("preset lists have 12 cards and the exact counts", () => {
  assert.equal(WAGON_TRAIN.name, "Wagon Train");
  assert.equal(WAGON_TRAIN.wins, 7);
  assert.equal(NIGHT_RIDERS.name, "Night Riders");
  assert.equal(NIGHT_RIDERS.wins, 6);
  assert.equal(total(WAGON_TRAIN.counts), 12);
  assert.equal(total(NIGHT_RIDERS.counts), 12);
  const nonzero = (counts) => Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
  assert.deepEqual(nonzero(WAGON_TRAIN.counts), {
    "cowboy-sheriff": 3, "cowboy-covered-wagon": 2, "cowboy-billy": 2,
    "cowboy-gatling-crew": 1, "cowboy-deadeye": 2, "cowboy-lasso": 2,
  });
  assert.deepEqual(nonzero(NIGHT_RIDERS.counts), {
    "cowboy-sheriff": 3, "cowboy-outrider": 2, "cowboy-dynamiter": 2,
    "cowboy-ranger": 2, "cowboy-deadeye": 2, "cowboy-lasso": 1,
  });
});

test("each preset's threshold is the win count of its last needed card", () => {
  const winsFor = (counts) => Math.max(...FRONTIER_UNLOCKS.filter(({type}) => counts[type] > 0).map(({wins}) => wins));
  assert.equal(winsFor(WAGON_TRAIN.counts), WAGON_TRAIN.wins);
  assert.equal(winsFor(NIGHT_RIDERS.counts), NIGHT_RIDERS.wins);
});

test("presets are immutable", () => {
  assert.ok(Object.isFrozen(WAGON_TRAIN) && Object.isFrozen(WAGON_TRAIN.counts));
  assert.ok(Object.isFrozen(NIGHT_RIDERS) && Object.isFrozen(NIGHT_RIDERS.counts));
  assert.ok(Object.isFrozen(FRONTIER_UNLOCKS));
});

test("the duel entrypoint accepts each preset as soon as it unlocks", () => {
  for (const preset of [NIGHT_RIDERS, WAGON_TRAIN]) {
    const entitlementAt = (wins) => ({frontierCards: frontierUnlocked(withWins(wins))});
    assert.equal(validateDeck(preset.counts, entitlementAt(preset.wins - 1)).ok, false);
    assert.equal(validateDeck(preset.counts, entitlementAt(preset.wins)).ok, true);
  }
});
