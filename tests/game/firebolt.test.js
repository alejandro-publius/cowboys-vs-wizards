import test from "node:test";
import assert from "node:assert/strict";
import {CARDS, DECKS} from "../../src/game/cards.js";
import {createMatch} from "../../src/game/state.js";
import {applyAction} from "../../src/game/actions.js";
import {legalActions} from "../../src/game/legal.js";

// Isolate the Firebolt card without changing rules, random draws or game code.
function fireboltFixture(health = 3) {
  const state = createMatch(7);
  const spell = "wizard-firebolt-1";
  const troop = "cowboy-sheriff-1";
  state.startingSide = state.activeSide = "wizard";
  state.sides.wizard = {
    deck: DECKS.wizard.filter((id) => id !== spell),
    hand: [spell], board: [null, null, null], discard: [], baseOrbs: 5,
  };
  state.sides.cowboy = {
    deck: DECKS.cowboy.filter((id) => id !== troop),
    hand: [], board: [{cardId: troop, health}, null, null], discard: [], baseOrbs: 5,
  };
  return state;
}

test("Firebolt registers exactly one Wizard spell without increasing deck size", () => {
  const spell = CARDS["wizard-firebolt-1"];
  assert.equal(spell.side, "wizard");
  assert.equal(spell.name, "Firebolt");
  assert.equal(spell.kind, "spell");
  assert.equal(spell.relocates, false);
  assert.equal(DECKS.wizard.length, 12);
  assert.equal(DECKS.wizard.filter((id) => id.startsWith("wizard-firebolt-")).length, 1);
  assert.equal(DECKS.wizard.filter((id) => id.startsWith("wizard-singularity-")).length, 1);
});

test("Firebolt accepts one legal target, removes one orb and never relocates", () => {
  const state = fireboltFixture();
  const before = structuredClone(state);
  const action = {type: "spell", side: "wizard", revision: state.revision, cardId: "wizard-firebolt-1", target: 0};
  assert.ok(legalActions(state, "wizard").some((candidate) =>
    candidate.type === "spell" && candidate.cardId === action.cardId && candidate.target === 0));
  const result = applyAction(state, action);
  assert.equal(result.ok, true);
  assert.deepEqual(state, before, "the engine must not mutate the input state");
  assert.equal(result.state.sides.cowboy.board[0].health, 2);
  assert.equal(result.state.sides.cowboy.board[1], null);
  assert.deepEqual(result.state.sides.wizard.discard, ["wizard-firebolt-1"]);
  assert.equal(result.state.allowances.wizard.castUsed, true);
  assert.deepEqual(result.events.map(({revision, ...event}) => event), [{
    type: "spell", spell: "Firebolt", cardId: "wizard-firebolt-1",
    caster: "wizard",
    target: {side: "cowboy", slot: 0, cardId: "cowboy-sheriff-1"},
    before: 3, after: 2,
  }]);
  assert.equal(result.state.sides.cowboy.baseOrbs, 5);

  const illegal = applyAction(state, {...action, destination: 1});
  assert.equal(illegal.ok, false);
  assert.equal(illegal.reason, "invalid-destination");
  assert.equal(illegal.state, state);
  assert.deepEqual(state, before);
});

test("Firebolt defeats a one-orb target, rejects an empty target and is consumed once", () => {
  const state = fireboltFixture(1);
  const action = {type: "spell", side: "wizard", revision: state.revision, cardId: "wizard-firebolt-1", target: 0};
  const hit = applyAction(state, action);
  assert.equal(hit.ok, true);
  assert.equal(hit.state.sides.cowboy.board[0], null);
  assert.deepEqual(hit.state.sides.cowboy.discard, ["cowboy-sheriff-1"]);
  assert.deepEqual(hit.events.map((e) => e.type), ["spell", "defeat"]);
  assert.equal(hit.events[0].after, 0);

  const again = applyAction(hit.state, {...action, revision: hit.state.revision});
  assert.equal(again.ok, false);
  assert.ok(["cast-used", "card-not-in-hand"].includes(again.reason));

  const empty = fireboltFixture();
  empty.sides.cowboy.board[0] = null;
  empty.sides.cowboy.deck.push("cowboy-sheriff-1");
  const rejected = applyAction(empty, {...action, target: 2});
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "invalid-target");
  assert.equal(rejected.state, empty);
});
