import test from "node:test";
import assert from "node:assert/strict";
import { resolveClash } from "../../src/game/clash.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";

// Hand-built clash: `cowboy` and `wizard` are [cardId, health] or null per lane.
function clash(cowboy, wizard, { fire = true, cowboyBase = 2, wizardBase = 5 } = {}) {
  const state = createMatch(1, { dragonFire: fire });
  const fill = (side, lanes) => {
    state.sides[side].board = lanes.map((lane) => lane && { cardId: lane[0], health: lane[1] });
  };
  fill("cowboy", cowboy);
  fill("wizard", wizard);
  state.sides.cowboy.baseOrbs = cowboyBase;
  state.sides.wizard.baseOrbs = wizardBase;
  const events = [];
  resolveClash(state, (event) => events.push(event));
  return { state, events, fires: events.filter((event) => event.fire) };
}

test("createMatch enables Dragon Fire only on request, and the view carries it", () => {
  assert.equal(createMatch(1).dragonFire, undefined);
  assert.equal(publicState(createMatch(1), "cowboy").dragonFire, undefined);
  const match = createMatch(1, { dragonFire: true });
  assert.equal(match.dragonFire.enabled, true);
  assert.equal(publicState(match, "wizard").dragonFire.enabled, true);
  assert.throws(() => createMatch(1, { dragonFire: "yes" }), TypeError);
});

test("Dragon against a 1-orb Sheriff burns 2 into the Cowboy Base", () => {
  const { state, fires } = clash([null, ["cowboy-sheriff-1", 1], null], [null, ["wizard-dragon-1", 3], null]);
  assert.equal(state.sides.cowboy.baseOrbs, 0);
  assert.equal(fires.length, 1);
  assert.deepEqual(fires[0].target, { kind: "base", side: "cowboy" });
  assert.deepEqual(fires[0].attacker, { side: "wizard", slot: 1, cardId: "wizard-dragon-1" });
  assert.equal(fires[0].lane, 1);
  assert.equal(fires[0].amount, 2);
  assert.equal(fires[0].before, 2);
  assert.equal(fires[0].after, 0);
});

test("Captured Dragon against a 1-orb Skeleton burns 3 into the Wizard Base", () => {
  const { state, fires } = clash([null, ["cowboy-captured-dragon-1", 2], null], [null, ["wizard-skeleton-1", 1], null], { wizardBase: 3 });
  assert.equal(state.sides.wizard.baseOrbs, 0);
  assert.equal(fires[0].amount, 3);
  assert.deepEqual(fires[0].target, { kind: "base", side: "wizard" });
});

test("a 4-orb Wizard absorbs the Captured Dragon: no burn", () => {
  const { state, fires } = clash([null, ["cowboy-captured-dragon-1", 2], null], [null, ["wizard-wizard-1", 4], null]);
  assert.equal(fires.length, 0);
  assert.equal(state.sides.wizard.baseOrbs, 5);
});

test("an open lane behaves as before: one ordinary damage event, no fire", () => {
  const { state, events, fires } = clash([null, ["cowboy-captured-dragon-1", 2], null], [null, null, null]);
  assert.equal(fires.length, 0);
  assert.equal(state.sides.wizard.baseOrbs, 1);
  assert.equal(events.filter((event) => event.type === "damage").length, 1);
});

test("other cards never burn, and a disabled match is unchanged", () => {
  const sheriff = clash([null, ["cowboy-sheriff-1", 1], null], [null, ["wizard-wizard-1", 4], null]);
  assert.equal(sheriff.fires.length, 0);
  const off = clash([null, ["cowboy-sheriff-1", 1], null], [null, ["wizard-dragon-1", 3], null], { fire: false });
  assert.equal(off.fires.length, 0);
  assert.equal(off.state.sides.cowboy.baseOrbs, 2);
});

test("the CPU projection counts burn-through only on a Dragon Fire match", () => {
  // Wizard holds a 1-orb Skeleton in lane 1 against nothing; Cowboy Base 2 with a 1-orb Sheriff
  // facing the Dragon. With fire on, ending the phase loses the Base, so the CPU must act.
  const build = (fire) => {
    const state = createMatch(7, { dragonFire: fire });
    state.sides.cowboy.board = [null, { cardId: "cowboy-sheriff-1", health: 1 }, null];
    state.sides.wizard.board = [null, { cardId: "wizard-dragon-1", health: 3 }, null];
    state.sides.cowboy.baseOrbs = 2;
    state.sides.cowboy.hand = ["cowboy-billy-1"];
    state.sides.wizard.baseOrbs = 5;
    state.activeSide = "cowboy";
    state.allowances.cowboy = { summonUsed: false, castUsed: false };
    return publicState(state, "cowboy");
  };
  const withFire = chooseAction(build(true));
  assert.equal(withFire.type, "summon");
  assert.equal(withFire.cardId, "cowboy-billy-1");
  assert.deepEqual(withFire.tributes, [1]);
  assert.equal(withFire.slot, 1);
});
