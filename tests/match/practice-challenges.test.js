import test from "node:test";
import assert from "node:assert/strict";
import {CARDS} from "../../src/game/cards.js";
import {createPractice} from "../../src/match/practice-challenges.js";

const handNames = (side) => side.hand.map((id) => CARDS[id].name);
const lanes = (side) => side.board.map((troop) => troop && [CARDS[troop.cardId].name, troop.health]);

test("Dynamiter practice opens on the first choice with an empty board", () => {
  const state = createPractice("dynamiter");
  const {cowboy, wizard} = state.sides;
  assert.equal(state.seed, 4);
  assert.equal(state.round, 1);
  assert.equal(state.activeSide, "cowboy");
  assert.deepEqual(handNames(cowboy), ["Outrider", "Dynamiter", "Outrider", "Ranger"]);
  assert.deepEqual(handNames(wizard), ["Skeleton", "Skeleton", "Wizard", "Singularity"]);
  assert.deepEqual(lanes(cowboy), [null, null, null]);
  assert.deepEqual(lanes(wizard), [null, null, null]);
});

test("tribute practice replays the opening up to the Imp's round-four threat", () => {
  const state = createPractice("tribute");
  const {cowboy, wizard} = state.sides;
  assert.equal(state.seed, 4671);
  assert.equal(state.round, 4);
  assert.equal(state.revision, 16);
  assert.equal(state.activeSide, "cowboy");
  assert.deepEqual(handNames(cowboy), ["Billy", "Sheriff", "Gatling Crew"]);
  assert.deepEqual(lanes(cowboy), [["Sheriff", 2], ["Covered Wagon", 2], null]);
  assert.deepEqual(lanes(wizard), [["Skeleton", 2], ["Skeleton", 1], ["Imp", 1]]);
  assert.equal(cowboy.baseOrbs, 5);
  assert.equal(wizard.baseOrbs, 5);
});
