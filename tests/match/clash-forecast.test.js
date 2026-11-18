import assert from "node:assert/strict";
import {test} from "node:test";
import {createMatch} from "../../src/game/state.js";
import {publicState} from "../../src/game/view.js";
import {clashForecast} from "../../src/match/clash-forecast.js";
import {emptySelection, selectionOptions} from "../../src/match/selection.js";

const sheriff = "cowboy-sheriff-1";
const skeleton = "wizard-skeleton-1";
const idle = {step: "idle", playableCardIds: [sheriff]};

test("previews simultaneous damage, lethal Bases and named blockers without changing the board", () => {
  const view = publicState(createMatch(0), "cowboy");
  view.sides.cowboy.baseOrbs = view.sides.wizard.baseOrbs = 1;
  view.sides.cowboy.board = [{cardId: sheriff, health: 1}, {cardId: sheriff, health: 3}, null];
  view.sides.wizard.board = [{cardId: skeleton, health: 1}, null, {cardId: skeleton, health: 3}];
  const before = structuredClone(view);

  assert.deepEqual(clashForecast(view, idle), {
    bases: "Your Base 1 → 0 (falls) · Enemy Base 1 → 0 (falls)",
    losses: "Troops that fall: Your Sheriff (lane 1), Enemy Skeleton (lane 1).",
    timing: "Wizards still act. Preview assumes the board stays as shown.",
    pass: "",
  });
  assert.deepEqual(view, before);
});

test("points the blocked seed 14 hand to End turn and indicates when the clash is immediate", () => {
  const view = publicState(createMatch(14), "cowboy");
  const options = selectionOptions(emptySelection, view);
  assert.equal(clashForecast(view, options).pass, "No cards can be played. Select End turn.");
  assert.equal(clashForecast({...view, startingSide: "wizard"}, idle).timing, "End turn resolves this clash.");
});

test("hides the forecast during selections, Wizard input, terminal states and trap-enabled matches", () => {
  const view = publicState(createMatch(0), "cowboy");
  for (const step of ["slot", "tribute", "target", "destination", "confirm"]) {
    assert.equal(clashForecast(view, {...idle, step}), null);
  }
  for (const blocked of [{activeSide: "wizard"}, {result: {outcome: "win"}}, {traps: {enabled: true}}]) {
    assert.equal(clashForecast({...view, ...blocked}, idle), null);
  }
});
