import test from "node:test";
import assert from "node:assert/strict";
import {EVENTS, viewFor} from "./contract.js";
import {applyAction, createShowdown, legalActions, opponent, planTurn, playTurn} from "./rules.js";
import {duelFor} from "./progress.js";
import {LADDER} from "./trail-sim.mjs";

// One bot game of every duel on the ladder, both sides planning, calling `each` after every action.
function everyDuel(each) {
  for (const [label, save, id] of LADDER) {
    const duel = duelFor(save, id);
    let state = createShowdown(11, duel.options);
    while (!state.result) {
      // One action at a time, so the state between any two actions is seen.
      const action = planTurn(state)[0];
      const applied = applyAction(state, action);
      each({label, before: state, action, ...applied});
      state = applied.state;
    }
  }
}

test("every event the rules report is in the contract with exactly its fields, and every contract event occurs", () => {
  const met = new Set();
  everyDuel(({label, events}) => {
    for (const event of events) {
      assert.ok(EVENTS[event.type], `${label}: the rules reported "${event.type}", which the contract does not list`);
      const {type, ...fields} = event;
      assert.deepEqual(Object.keys(fields).sort(), [...EVENTS[type].fields].sort(), `${label}: fields of "${type}"`);
      met.add(type);
    }
  });
  // Events the planner's games do not produce are forced here, so the contract lists nothing the rules cannot report.
  let state = createShowdown(3);
  state.sides[state.active].deck = [];
  state.sides[opponent(state.active)].deck = [];
  for (const event of [...applyAction(state, {type: "end"}).events, ...playTurn(createShowdown(5, duelFor(LADDER.at(-1)[1], "open").options), 0).events]) met.add(event.type);
  const full = createShowdown(3);
  full.sides[opponent(full.active)].hand = full.sides[opponent(full.active)].deck.splice(0, 6);
  for (const event of applyAction(full, {type: "end"}).events) met.add(event.type);
  const fire = createShowdown(3, {first: "wizard"});
  const stand = (cardId) => ({cardId, health: 3, attacked: false, stunned: false, cover: false, gear: [], arrived: 0, ready: true});
  Object.assign(fire, {turn: 4});
  fire.sides.wizard.board[0] = stand("wizard-dragon-1");
  fire.sides.cowboy.board = [stand("cowboy-sheriff-1"), stand("cowboy-sheriff-2"), null];
  for (const event of applyAction(fire, {type: "attack", slot: 0, target: 0}).events) met.add(event.type);
  assert.deepEqual([...met].sort(), Object.keys(EVENTS).sort());
});

test("a side's view names its own hand and traps and nothing hidden of the other side's", () => {
  let checked = 0;
  everyDuel(({state}) => {
    for (const side of ["cowboy", "wizard"]) {
      const other = state.sides[opponent(side)];
      const view = viewFor(state, side);
      const text = JSON.stringify(view);
      // Card ids are quoted in the text, so "wizard-skeleton-1" is not found inside "wizard-skeleton-16".
      for (const hidden of [...other.hand, ...other.traps, ...other.deck, ...state.sides[side].deck]) {
        assert.ok(!text.includes(`"${hidden}"`), `${side}'s view shows ${hidden}`);
      }
      assert.deepEqual(view.sides[side].hand, state.sides[side].hand);
      assert.deepEqual(view.sides[side].traps, state.sides[side].traps);
      assert.deepEqual([view.sides[opponent(side)].handCount, view.sides[opponent(side)].trapCount, view.sides[opponent(side)].deckCount], [other.hand.length, other.traps.length, other.deck.length]);
      assert.deepEqual(view.sides[opponent(side)].board, other.board);
      assert.deepEqual(view.sides[opponent(side)].discard, other.discard);
      assert.deepEqual(view.location, state.location);
      assert.ok(!("seed" in view), "the seed would let a viewer deal the game again and read every hidden card");
      checked += 1;
    }
  });
  assert.ok(checked > 500, `only ${checked} views checked`);
  // The view is a copy: changing it cannot change the game.
  const state = createShowdown(2);
  viewFor(state, "cowboy").sides.cowboy.board[0] = "x";
  assert.equal(state.sides.cowboy.board[0], null);
  assert.ok(legalActions(state).length > 0);
});
