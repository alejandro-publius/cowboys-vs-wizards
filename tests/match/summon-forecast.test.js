import assert from "node:assert/strict";
import {test} from "node:test";
import {summonForecasts} from "../../src/match/summon-forecast.js";

const sheriff = "cowboy-sheriff-1";
const skeleton = "wizard-skeleton-1";
const view = () => ({
  viewer: "cowboy",
  sides: {
    cowboy: {baseOrbs: 5, board: [null, null, null]},
    wizard: {baseOrbs: 5, board: [null, {cardId: skeleton, health: 1}, null]},
  },
});
const placement = {step: "slot", cardId: sheriff, ownSlots: [0, 1]};

test("shows open-lane Base pressure and both hits against a blocker that falls", () => {
  const board = view();
  const before = structuredClone(board);
  assert.deepEqual(summonForecasts(board, placement), {
    0: "Enemy base 5 → 4",
    1: "Skeleton 1 → 0 · Sheriff 3 → 2",
  });
  assert.deepEqual(board, before);
});

test("only forecasts legal troop placements during choice or confirmation", () => {
  const board = view();
  assert.deepEqual(summonForecasts(board, {step: "confirm", canConfirm: true, slot: 1, cardId: sheriff}),
    {1: "Skeleton 1 → 0 · Sheriff 3 → 2"});
  for (const options of [null, {...placement, step: "tribute"}, {...placement, step: "idle"},
    {...placement, step: "confirm", canConfirm: false}, {...placement, cardId: "cowboy-deadeye-1"}]) {
    assert.deepEqual(summonForecasts(board, options), {});
  }
  assert.deepEqual(summonForecasts({...board, traps: {enabled: true}}, placement), {});
});
