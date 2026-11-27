import test from "node:test";
import assert from "node:assert/strict";
import {applyAction, createShowdown} from "../../src/game/showdown/rules.js";

function firstWizardTurn(cowboys, boss) {
  const start = createShowdown(62, {first: "cowboy", opening: {cowboy: cowboys, wizard: [boss]}});
  return applyAction(start, {type: "end"}).state;
}

test("CARD-WIZARD-DRAGON-14: the Wagon's lethal hit-back still lets Sweep bury the Sheriff before the Dragon", (t) => {
  const game = firstWizardTurn([{type: "cowboy-covered-wagon"}, {type: "cowboy-sheriff", health: 1}], {type: "wizard-dragon", health: 1});
  let cowboyGraveAtDragonBurial;
  // The event stream has no burial event. Observe one insertion in the engine's working copy.
  const clone = globalThis.structuredClone;
  t.mock.method(globalThis, "structuredClone", (input) => {
    const next = clone(input);
    next.sides.wizard.discard = new Proxy(next.sides.wizard.discard, {
      set(grave, key, card) {
        if (card === "wizard-dragon-0") cowboyGraveAtDragonBurial = [...next.sides.cowboy.discard];
        return Reflect.set(grave, key, card);
      },
    });
    return next;
  }, {times: 1});

  const {events, state: after} = applyAction(game, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(events, [
    {type: "attack", side: "wizard", cardId: "wizard-dragon-0", target: "cowboy-covered-wagon-0",
      covered: false, hitBack: 1, baseDamage: 0, targetLeft: 1, attackerLeft: 0},
    {type: "sweep", side: "wizard", cardId: "wizard-dragon-0", count: 1},
  ]);
  assert.deepEqual(after.sides.cowboy.board.map((troop) => troop && troop.health), [1, null, null]);
  assert.equal(after.sides.wizard.board[0], null);
  assert.deepEqual(after.sides.cowboy.discard, ["cowboy-sheriff-0"]);
  assert.deepEqual(after.sides.wizard.discard, ["wizard-dragon-0"]);
  assert.deepEqual(cowboyGraveAtDragonBurial, ["cowboy-sheriff-0"]);
});

test("CARD-WIZARD-LANTERN-WRAITH-15: Bear Trap leaves two Wraith orbs for the Sheriff's hit-back", () => {
  const game = firstWizardTurn([{type: "cowboy-sheriff"}], {type: "wizard-lantern-wraith"});
  game.sides.cowboy.traps = ["cowboy-bear-trap-1"];
  const {events, state: after} = applyAction(game, {type: "attack", slot: 0, target: 0});
  assert.equal(game.sides.wizard.board[0].health, 4);
  assert.deepEqual(events, [
    {type: "trap", side: "cowboy", cardId: "cowboy-bear-trap-1", target: "wizard-lantern-wraith-0", left: 2, stopped: false},
    {type: "attack", side: "wizard", cardId: "wizard-lantern-wraith-0", target: "cowboy-sheriff-0",
      covered: false, hitBack: 1, baseDamage: 0, targetLeft: 1, attackerLeft: 1},
  ]);
  assert.equal(after.sides.wizard.board[0].health, 1);
  assert.equal(after.sides.cowboy.board[0].health, 1);
});
