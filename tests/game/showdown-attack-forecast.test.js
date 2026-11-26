import test from "node:test";
import assert from "node:assert/strict";
import {viewFor} from "../../src/game/showdown/contract.js";
import {presentAttackForecast} from "../../src/game/showdown/presenter.js";
import {applyAction, createShowdown, forecastAttack, opponent} from "../../src/game/showdown/rules.js";

function position(active, cowboys, wizards) {
  const state = createShowdown(0, {first: active, opening: {cowboy: cowboys, wizard: wizards}});
  state.turn = 3;
  return state;
}

// The prediction reads the seat's view. Compare its events and the defending board
// with a legal attack in the live engine and check that inspecting it spent no action.
function compare(state, target) {
  const view = viewFor(state, state.active);
  const untouched = structuredClone(view);
  const predicted = forecastAttack(view, 0, target);
  const actual = applyAction(state, {type: "attack", slot: 0, target});
  assert.deepEqual(predicted.events, actual.events);
  assert.deepEqual(predicted.defendingBoard, actual.state.sides[opponent(state.active)].board);
  const forecast = presentAttackForecast(view, 0, target);
  assert.deepEqual(view, untouched);
  return forecast.text;
}

test("a losing attacker can defeat the target or leave it on its last orb with Last Stand", () => {
  for (const health of [2, 3]) {
    const state = position("wizard", [{type: "cowboy-sheriff", health}], [{type: "wizard-jack-o-lantern"}]);
    const text = compare(state, 0);
    assert.match(text, /Sheriff hits back and defeats Jack-o'-Lantern/);
    assert.match(text, health === 2 ? /Last Stand defeats Sheriff too/ : /Last Stand leaves Sheriff on 1 orb/);
    assert.doesNotMatch(text, /Survives on/);
  }
});

test("CARD-COWBOY-DYNAMITER-09: a defeated Jack can take the attacker with it", () => {
  const state = position("cowboy", [{type: "cowboy-dynamiter"}], [{type: "wizard-jack-o-lantern"}]);
  assert.match(compare(state, 0), /2 through to the Base\. Its Last Stand defeats yours too/);
  state.sides.wizard.board[0].cover = true;
  assert.match(compare(state, 0), /nothing reaches the Base\. Its Last Stand defeats yours too/);
});

test("Sweep names the other slots, including a lethal hit on a Last Stand troop", () => {
  const state = position("wizard", [
    {type: "cowboy-sheriff", health: 4}, {type: "cowboy-dynamiter"}, {type: "cowboy-sheriff", health: 3}
  ], [{type: "wizard-dragon", health: 1}]);
  const text = compare(state, 0);
  assert.match(text, /yours is defeated/);
  assert.match(text, /Sweep also defeats Dynamiter and leaves Sheriff \(slot 3\) on 2 orbs/);
  assert.doesNotMatch(text, /Last Stand/);
});

test("a direct strike and a ride past the troops have no collateral effects", () => {
  assert.equal(compare(position("wizard", [], [{type: "wizard-dragon"}]), "base"), "Hit the Base for 3");
  assert.equal(compare(position("cowboy", [{type: "cowboy-outrider"}], [{type: "wizard-jack-o-lantern"}]), "base"),
    "Ride past: Hit the Base for 1");
});

test("face-down traps on either seat condition the entire forecast and keep their identities hidden", () => {
  for (const [active, trap] of [["cowboy", "wizard-hex-1"], ["wizard", "cowboy-bear-trap-1"]]) {
    const state = position(active, [{type: "cowboy-dynamiter"}], [{type: "wizard-jack-o-lantern"}]);
    const visible = compare(state, 0);
    state.sides[opponent(active)].traps = [trap];
    const view = viewFor(state, state.active);
    assert.equal(presentAttackForecast(view, 0, 0).text, "Without trap effects: " + visible);
    assert.equal(applyAction(state, {type: "attack", slot: 0, target: 0}).events[0].type, "trap");
  }
});
