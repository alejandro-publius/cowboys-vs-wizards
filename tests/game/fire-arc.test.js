import assert from "node:assert/strict";
import test from "node:test";
import { applyAction } from "../../src/game/actions.js";
import { createFireArcStage, FIRE_ARC, rebuildLane, rebuildLossCause, rebuildMark, rivalAction } from "../../src/game/fire-arc.js";
import { legalActions } from "../../src/game/legal.js";

const BILLY = "cowboy-billy-1";
const DEADEYE = "cowboy-deadeye-1";
const DRAGON = "cowboy-captured-dragon-1";

function apply(state, action) {
  const result = applyAction(state, { ...action, side: action.side ?? "cowboy", revision: state.revision });
  assert.ok(result.ok, `${JSON.stringify(action)} rejected: ${result.reason}`);
  return result;
}
const summon = (state, cardId, slot, tributes = []) => apply(state, { type: "summon", cardId, slot, tributes }).state;
const shoot = (state, target) => apply(state, { type: "spell", cardId: DEADEYE, target }).state;
// The Ember Gulch boss only ends its turn; the Bonewright uses rivalAction.
const bossEnd = (state) => legalActions(state, "wizard").at(-1);
// End the Cowboy's phase, then run every Wizard phase until the next Cowboy turn
// (or the result). That includes a Wizard phase that opens the next round.
function endTurn(state, rival = rivalAction) {
  let current = apply(state, { type: "end-phase" }).state;
  for (let guard = 0; guard < 6 && !current.result && current.activeSide === "wizard"; guard++) {
    current = apply(current, { ...rival(current) }).state;
  }
  return current;
}
const orbs = (state, side) => state.sides[side].board.map((troop) => troop && troop.health);

test("every stage holds each card once and enables Dragon Fire", () => {
  for (const stage of Object.keys(FIRE_ARC)) {
    const state = createFireArcStage(stage);
    assert.equal(state.dragonFire.enabled, true);
    for (const side of ["cowboy", "wizard"]) {
      const own = state.sides[side];
      const ids = [...own.hand, ...own.deck, ...own.board.filter(Boolean).map((troop) => troop.cardId)];
      assert.equal(new Set(ids).size, ids.length, `${stage} ${side} repeats a card`);
    }
  }
});

test("Ember Gulch solution: Billy tributes the wounded Sheriff, Deadeye, end turn captures in round 1", () => {
  let state = createFireArcStage("ember-gulch");
  state = summon(state, BILLY, 1, [1]);
  state = shoot(state, 1);
  state = endTurn(state, bossEnd);
  assert.equal(state.result.reason, "bounty-captured");
  assert.equal(state.result.winner, "cowboy");
  assert.equal(state.result.round, 1);
  assert.equal(state.sides.cowboy.baseOrbs, 2);
  assert.deepEqual(orbs(state, "cowboy"), [null, 1, null]);
});

test("Ember Gulch slower capture: Billy, end turn, then Deadeye captures in round 2", () => {
  let state = createFireArcStage("ember-gulch");
  state = summon(state, BILLY, 1, [1]);
  state = endTurn(state, bossEnd); // the boss also ends its round 2 opening phase
  assert.equal(state.result, null);
  assert.equal(state.round, 2);
  state = shoot(state, 1);
  assert.equal(state.result.reason, "bounty-captured");
  assert.equal(state.result.round, 2);
});

test("Ember Gulch tempting mistake: Deadeye alone burns through and the Dragon escapes", () => {
  let state = createFireArcStage("ember-gulch");
  state = shoot(state, 1);
  state = endTurn(state, bossEnd);
  assert.equal(state.result.reason, "bounty-escaped");
  assert.equal(state.sides.cowboy.baseOrbs, 0);
});

test("position A has no mark; position B marks lane 2 (index 1)", () => {
  assert.equal(rebuildMark(createFireArcStage("position-a")), null);
  assert.equal(rebuildMark(createFireArcStage("position-b")), 1);
});

test("the mark needs a below-printed troop, a Wizard in hand and an unacted Bonewright", () => {
  const state = createFireArcStage("position-b");
  const healed = structuredClone(state);
  healed.sides.wizard.board[1].health = 3;
  assert.equal(rebuildMark(healed), null);
  const noWizard = structuredClone(state);
  noWizard.sides.wizard.hand = ["wizard-skeleton-3"];
  assert.equal(rebuildMark(noWizard), null);
  const acted = structuredClone(state);
  acted.allowances.wizard.summonUsed = true;
  assert.equal(rebuildMark(acted), null);
  const tie = structuredClone(state);
  tie.sides.wizard.board[2].health = 2;
  assert.equal(rebuildMark(tie), 1);
  tie.sides.wizard.board[0].health = 2;
  assert.equal(rebuildMark(tie), 0);
});

test("position A fire now: Dragon tributes the lane 2 Sheriff, Deadeye the Skeleton, Bonewright Base falls", () => {
  let state = createFireArcStage("position-a");
  state = summon(state, DRAGON, 1, [1]);
  state = shoot(state, 1);
  state = endTurn(state);
  assert.equal(state.result.winner, "cowboy");
  assert.equal(state.result.round, 7);
  assert.equal(state.sides.wizard.baseOrbs, 0);
  assert.equal(state.sides.cowboy.baseOrbs, 1);
});

test("position A hold: the next round you move first and the mark appears", () => {
  let state = createFireArcStage("position-a");
  state = summon(state, "cowboy-sheriff-3", 2);
  state = endTurn(state);
  assert.equal(state.result, null);
  assert.equal(state.round, 8);
  assert.equal(state.startingSide, "cowboy");
  assert.ok(Number.isInteger(rebuildMark(state)));
});

test("position B: after your turn the rival rebuilds lane 2 with a Wizard", () => {
  let state = createFireArcStage("position-b");
  state = summon(state, "cowboy-sheriff-3", 2);
  state = apply(state, { type: "end-phase" }).state;
  const rebuild = rivalAction(state);
  assert.equal(rebuild.type, "summon");
  assert.equal(rebuild.cardId, "wizard-wizard-2");
  assert.equal(rebuild.slot, 1);
  assert.deepEqual(rebuild.tributes, [1]);
  assert.equal(rebuildLane(state, rebuild), 1);
  state = apply(state, rebuild).state;
  assert.equal(rebuildMark(state), null);
  assert.equal(rivalAction(state).type, "end-phase");
});

test("position B hold then fire: boards after clashes 7 and 8, victory in round 9", () => {
  let state = createFireArcStage("position-b");
  state = summon(state, "cowboy-sheriff-3", 2);
  state = endTurn(state);
  assert.equal(state.round, 8);
  assert.equal(state.sides.cowboy.baseOrbs, 2);
  assert.deepEqual(orbs(state, "cowboy"), [null, 1, 2]);
  assert.equal(state.sides.wizard.baseOrbs, 3);
  assert.deepEqual(orbs(state, "wizard"), [3, 3, 2]);

  state = summon(state, "cowboy-sheriff-4", 0);
  state = shoot(state, 1);
  state = endTurn(state);
  assert.equal(state.round, 9);
  assert.deepEqual(orbs(state, "cowboy"), [1, null, 1]);
  assert.deepEqual(orbs(state, "wizard"), [2, 1, 1]);
  assert.equal(rebuildMark(state), null);

  state = summon(state, DRAGON, 1, [2]);
  state = endTurn(state);
  assert.equal(state.result.winner, "cowboy");
  assert.equal(state.result.round, 9);
  assert.equal(state.sides.cowboy.baseOrbs, 1);
  assert.equal(state.sides.wizard.baseOrbs, 0);
});

test("position B fire into the mark: the rebuilt Wizard absorbs the Dragon exactly and you lose in round 8", () => {
  let state = createFireArcStage("position-b");
  state = summon(state, DRAGON, 1, [1]);
  state = shoot(state, 1);
  state = apply(state, { type: "end-phase" }).state;
  const rebuild = rivalAction(state);
  assert.equal(rebuildLane(state, rebuild), 1);
  state = apply(state, rebuild).state;
  const clash = apply(state, rivalAction(state));
  assert.ok(clash.events.some((event) => event.type === "clash"));
  assert.equal(rebuildLossCause(clash.events, 1), "The Bonewright rebuilt lane 2 before the clash, so nothing burned through.");
  assert.equal(clash.state.sides.wizard.baseOrbs, 3);

  state = clash.state;
  while (state.activeSide === "wizard") state = apply(state, rivalAction(state)).state; // it moves first in round 8
  assert.equal(state.round, 8);
  state = summon(state, "cowboy-sheriff-3", 0);
  state = endTurn(state);
  assert.equal(state.result.winner, "wizard");
  assert.equal(state.result.round, 8);
});

test("rebuildLossCause stays silent unless the Dragon exactly defeated a troop", () => {
  const hit = (extra) => ({ type: "damage", lane: 1, attacker: { side: "cowboy", cardId: DRAGON }, target: { kind: "troop" }, amount: 4, before: 4, after: 0, ...extra });
  assert.ok(rebuildLossCause([hit({})], 1));
  assert.equal(rebuildLossCause([hit({ before: 5, after: 1 })], 1), null);
  assert.equal(rebuildLossCause([hit({}), hit({ target: { kind: "base" }, fire: true })], 1), null);
  assert.equal(rebuildLossCause([hit({})], 0), null);
});
