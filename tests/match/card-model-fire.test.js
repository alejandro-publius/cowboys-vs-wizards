// Dragon Fire line in the card overlay model (src/ui/card-model.js): the
// Captured Dragon in hand and a Dragon or Captured Dragon on the board carry
// `fire` only on a Dragon Fire match. Built from the fire arc's authored
// stages (src/game/fire-arc.js) and from a standard createMatch state.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { createFireArcStage } from "../../src/game/fire-arc.js";
import { FIRE_TEXT, cardModel } from "../../src/ui/card-model.js";

const CAPTURED = "cowboy-captured-dragon-1";
const model = (state, extra = {}) => cardModel({ displayed: publicState(state, "cowboy"), status: "accepting_input", ...extra });

test("the text is the agreed line", () => {
  assert.equal(FIRE_TEXT, "Dragon Fire: damage beyond the blocker's remaining orbs hits the Base");
});

test("Bonewright position: only the Captured Dragon in hand carries the fire line", () => {
  const state = createFireArcStage("position-a");
  const options = { cardId: CAPTURED, playableCardIds: [CAPTURED, "cowboy-deadeye-1"] };
  const built = model(state, { options });
  const byId = Object.fromEntries(built.cowboy.hand.map((card) => [card.cardId, card]));
  assert.equal(byId[CAPTURED].fire, FIRE_TEXT);
  for (const id of ["cowboy-deadeye-1", "cowboy-sheriff-3"]) assert.equal("fire" in byId[id], false, id);
  // Selection, playability and stats are unchanged by the line.
  assert.equal(byId[CAPTURED].selected, true);
  assert.equal(byId[CAPTURED].playable, true);
  assert.equal(byId["cowboy-deadeye-1"].playable, true);
  assert.equal(byId["cowboy-sheriff-3"].playable, false);
  assert.equal(byId[CAPTURED].attack, 4);
  // No lane troop here is a fire card.
  for (const lane of built.lanes) for (const troop of [lane.cowboy, lane.wizard]) if (troop) assert.equal("fire" in troop, false);
  // The Wizard hand stays hidden.
  const json = JSON.stringify(built);
  for (const id of state.sides.wizard.hand) assert.equal(json.includes(id), false, id);
});

test("Ember Gulch: the Wizard's Dragon on the board carries the fire line", () => {
  const built = model(createFireArcStage("ember-gulch"));
  const wizardDragon = built.lanes[1].wizard;
  assert.deepEqual(wizardDragon, { name: CARDS["wizard-dragon-1"].name, health: 3, max: CARDS["wizard-dragon-1"].health, fire: FIRE_TEXT });
  assert.equal("fire" in built.lanes[1].cowboy, false, "the Sheriff blocker has no line");
  for (const card of built.cowboy.hand) assert.equal("fire" in card, false, card.cardId);
});

test("a Captured Dragon on the Cowboy board carries the fire line", () => {
  const state = createFireArcStage("position-a");
  state.sides.cowboy.board[1] = { cardId: CAPTURED, health: 2 };
  state.sides.cowboy.hand = state.sides.cowboy.hand.filter((id) => id !== CAPTURED);
  const built = model(state);
  assert.equal(built.lanes[1].cowboy.fire, FIRE_TEXT);
  assert.equal(built.lanes[1].cowboy.health, 2);
});

test("a standard match keeps every label without a fire line", () => {
  const withHand = createMatch(0);
  withHand.sides.cowboy.hand = [CAPTURED, ...withHand.sides.cowboy.hand.slice(1)];
  assert.equal("fire" in model(withHand).cowboy.hand[0], false);
  const state = createMatch(0);
  state.sides.cowboy.board[0] = { cardId: CAPTURED, health: 2 };
  state.sides.wizard.board[0] = { cardId: "wizard-dragon-1", health: 3 };
  const built = model(state);
  assert.equal(JSON.stringify(built).includes("Dragon Fire"), false);
  assert.equal("fire" in built.lanes[0].cowboy, false);
  assert.equal("fire" in built.lanes[0].wizard, false);
});
