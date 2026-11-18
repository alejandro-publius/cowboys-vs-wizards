import assert from "node:assert/strict";
import {test} from "node:test";
import {summonForecasts} from "../../src/match/summon-forecast.js";

const sheriff = "cowboy-sheriff-1";
const skeleton = "wizard-skeleton-1";
const dragon = "wizard-dragon-1";
const mountedBilly = "cowboy-mounted-billy-1";
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

test("warns when a tribute opens a defended lane and omits the warning if that lane is refilled", () => {
  const board = view();
  board.sides.cowboy.board = [{cardId: sheriff, health: 2}, {cardId: sheriff, health: 2}, null];
  board.sides.cowboy.baseOrbs = 3;
  board.sides.wizard.board[1] = {cardId: dragon, health: 5};
  const before = structuredClone(board);
  const options = {step: "slot", cardId: mountedBilly, ownSlots: [0, 1, 2], tributes: [0, 1]};
  assert.deepEqual(summonForecasts(board, options), {
    0: "Enemy base 5 → 2 · Tribute opens lane 2: your Base 3 → 0",
    1: "Dragon 5 → 2 · Mounted Billy 5 → 2",
    2: "Enemy base 5 → 2 · Tribute opens lane 2: your Base 3 → 0",
  });
  assert.deepEqual(board, before);
  board.sides.wizard.board[0] = {cardId: skeleton, health: 3};
  assert.equal(summonForecasts(board, options)[2],
    "Enemy base 5 → 2 · Tributes open lanes 1, 2: your Base 3 → 0");
});
