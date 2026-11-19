import test from "node:test";
import assert from "node:assert/strict";
import {CARDS} from "../../src/game/cards.js";
import {applyAction, attackOutcome, canAttack, createShowdown, legalActions, planTurn} from "./rules.js";

const troop = (cardId, health = CARDS[cardId].health, arrived = 0) => ({cardId, health, attacked: false, arrived});
// Turn 4, Cowboy to act, nothing spent, boards as given.
function position(cowboy, wizard) {
  const state = createShowdown(690);
  Object.assign(state, {turn: 4, active: "cowboy"});
  state.sides.cowboy.board = cowboy;
  state.sides.wizard.board = wizard;
  return state;
}
const attacks = (state) => legalActions(state).filter((a) => a.type === "attack").map((a) => `${a.slot}>${a.target}`);

test("seed 690 deals the duel's hands and first seat", () => {
  const state = createShowdown(690);
  assert.equal(state.first, "wizard");
  assert.deepEqual(state.sides.cowboy.hand.map((id) => CARDS[id].name), ["Sheriff", "Sheriff", "Deadeye", "Billy"]);
});

test("a Base can be struck directly only when its side has no troops", () => {
  const guarded = position([troop("cowboy-mounted-billy-1"), null, null], [troop("wizard-skeleton-1"), null, null]);
  assert.deepEqual(attacks(guarded), ["0>0"]);
  const open = position([troop("cowboy-mounted-billy-1"), null, null], [null, null, null]);
  assert.deepEqual(attacks(open), ["0>base"]);
  assert.equal(applyAction(open, {type: "attack", slot: 0, target: "base"}).state.sides.wizard.base, 2);
});

test("damage beyond the target's last orb hits its Base, and a defeated target does not hit back", () => {
  const state = position([troop("cowboy-mounted-billy-1"), null, null], [troop("wizard-skeleton-1", 1), null, null]);
  assert.deepEqual(attackOutcome(state, 0, 0), {baseDamage: 2, targetLeft: 0, attackerLeft: 5});
  const after = applyAction(state, {type: "attack", slot: 0, target: 0}).state;
  assert.equal(after.sides.wizard.board[0], null);
  assert.equal(after.sides.wizard.base, 3);
  assert.equal(after.sides.cowboy.board[0].health, 5);
});

test("a target that survives hits back, and neither Base is touched", () => {
  const state = position([troop("cowboy-sheriff-1"), null, null], [troop("wizard-wizard-1"), null, null]);
  const after = applyAction(state, {type: "attack", slot: 0, target: 0}).state;
  assert.equal(after.sides.wizard.board[0].health, 3);
  assert.equal(after.sides.cowboy.board[0].health, 1);
  assert.deepEqual([after.sides.cowboy.base, after.sides.wizard.base], [5, 5]);
});

test("free troops rest on arrival, tribute troops strike at once, and nothing is summoned after an attack", () => {
  let state = position([troop("cowboy-sheriff-1"), null, null], [troop("wizard-skeleton-1"), null, null]);
  state.sides.cowboy.hand = ["cowboy-sheriff-2", "cowboy-billy-1"];
  const withSheriff = applyAction(state, {type: "summon", cardId: "cowboy-sheriff-2", tributes: []}).state;
  assert.equal(canAttack(withSheriff, withSheriff.sides.cowboy.board[1]), false);
  const withBilly = applyAction(state, {type: "summon", cardId: "cowboy-billy-1", tributes: [0]}).state;
  assert.equal(canAttack(withBilly, withBilly.sides.cowboy.board[0]), true);
  const attacked = applyAction(state, {type: "attack", slot: 0, target: 0}).state;
  assert.ok(legalActions(attacked).every((a) => a.type === "attack" || a.type === "end"));
  assert.throws(() => applyAction(attacked, {type: "summon", cardId: "cowboy-sheriff-2", tributes: []}), /illegal/);
});

test("the opponent's plan is legal and bot games end", () => {
  for (let seed = 0; seed < 40; seed++) {
    let state = createShowdown(seed);
    while (!state.result) {
      for (const action of planTurn(state)) {
        state = applyAction(state, action).state; // throws if the plan holds an illegal action
        if (state.result) break;
      }
    }
    assert.ok(["base", "turn-cap"].includes(state.result.reason));
  }
});
