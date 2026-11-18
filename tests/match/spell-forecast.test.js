import assert from "node:assert/strict";
import {test} from "node:test";
import {createMatch} from "../../src/game/state.js";
import {publicState} from "../../src/game/view.js";
import {clashForecast} from "../../src/match/clash-forecast.js";
import {emptySelection, selectionOptions, selectionStep} from "../../src/match/selection.js";
import {spellForecasts} from "../../src/match/spell-forecast.js";

const deadeye = "cowboy-deadeye-1";
const sheriff = "cowboy-sheriff-1";
const lethal = "Skeleton 1 → 0 (removed) · Lane 1 opens: Enemy Base 5 → 4";
const nonlethal = "Wizard 4 → 3";
const open = {accepting: true, newActionId: () => "spell-forecast"};
const click = (view, selection, input) => selectionStep(selection, input, view, open).selection;

// The Cowboy phase with Deadeye in hand: a 1-life Skeleton blocks your Sheriff
// in lane 1, lane 2 is empty and a full-life Wizard holds lane 3.
function board() {
  const view = publicState(createMatch(0), "cowboy");
  view.startingSide = view.activeSide = "cowboy";
  view.sides.cowboy.hand = [deadeye];
  view.sides.cowboy.board = [{cardId: sheriff, health: 3}, null, null];
  view.sides.wizard.board = [{cardId: "wizard-skeleton-1", health: 1}, null, {cardId: "wizard-wizard-1", health: 4}];
  return view;
}
const targeting = (view) => click(view, emptySelection, {type: "card", cardId: deadeye});

test("previews each legal Deadeye target: a lethal shot opens its lane, a nonlethal one costs one orb", () => {
  const view = board();
  const before = structuredClone(view);
  const options = selectionOptions(targeting(view), view);
  assert.deepEqual(options.enemySlots, [0, 2]);
  assert.deepEqual(spellForecasts(view, options), {0: lethal, 2: nonlethal});
  assert.deepEqual(view, before);

  view.sides.wizard.baseOrbs = 1;
  assert.equal(spellForecasts(view, options)[0], "Skeleton 1 → 0 (removed) · Lane 1 opens: Enemy Base 1 → 0 (falls)");
  view.sides.cowboy.board[0] = null;
  assert.equal(spellForecasts(view, options)[0], "Skeleton 1 → 0 (removed)", "no troop of yours to hit the Base");
});

test("confirmation keeps only the chosen target's preview, and Cancel brings back the Next clash preview", () => {
  const view = board();
  const choosing = targeting(view);
  for (const [slot, preview] of [[0, lethal], [2, nonlethal]]) {
    const chosen = click(view, choosing, {type: "slot", side: "wizard", slot});
    const options = selectionOptions(chosen, view);
    assert.equal(options.step, "confirm");
    assert.equal(options.target, slot);
    assert.deepEqual(spellForecasts(view, options), {[slot]: preview});
    for (const from of [choosing, chosen]) {
      const idle = selectionOptions(click(view, from, {type: "cancel"}), view);
      assert.equal(idle.target, null);
      assert.deepEqual(spellForecasts(view, idle), {});
      assert.notEqual(clashForecast(view, idle), null);
    }
  }
});

test("shows nothing for another card, an unconfirmable choice, the Wizard phase, a result or a trap match", () => {
  const view = board();
  const options = selectionOptions(targeting(view), view);
  for (const other of [null, {...options, cardId: "wizard-singularity-1"}, {...options, cardId: sheriff},
    {...options, step: "confirm", canConfirm: false, target: 0}]) {
    assert.deepEqual(spellForecasts(view, other), {});
  }
  for (const blocked of [{activeSide: "wizard"}, {result: {outcome: "win"}}, {traps: {enabled: true}}]) {
    assert.deepEqual(spellForecasts({...view, ...blocked}, options), {});
  }
});
