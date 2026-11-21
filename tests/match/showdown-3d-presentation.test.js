import assert from "node:assert/strict";
import test from "node:test";
import { viewFor } from "../../src/game/showdown/contract.js";
import { applyAction, createShowdown, legalActions } from "../../src/game/showdown/rules.js";
import { createShowdownSession } from "../../src/match/showdown-session.js";
import { turnDuel } from "../../src/match/showdown-turn.js";
import { presentationBeats } from "../../src/ui/showdown-3d/event-positions.js";

function fixture(cowboy, wizard, side = "cowboy") {
  const state = createShowdown(7, { first: side, opening: { cowboy, wizard } });
  state.turn = 5;
  return state;
}
const actor = (type, health) => ({ type, health });
function present(before, action) {
  assert.ok(legalActions(before).some((a) => JSON.stringify(a) === JSON.stringify(action)));
  const { state: after, events } = applyAction(before, action);
  return presentationBeats([
    { before: viewFor(before, before.active), after: viewFor(after, before.active), events },
  ]);
}

test("Ranger, Dragon counter, and a cancelled Dragon attack use their own contact snapshots", () => {
  const s = createShowdownSession(turnDuel("dragon-c5"));
  const hit = [];
  s.act({ type: "attack", slot: 0, target: 0 }, (step) => hit.push(step));
  const [shot, bite] = presentationBeats(hit);
  assert.equal(shot.kind, "gun");
  assert.equal(shot.pre.sides.wizard.board[0].health, 4);
  assert.equal(shot.hit.sides.wizard.board[0].health, 2);
  assert.equal(shot.hit.sides.cowboy.board[0].health, 4);
  assert.equal(bite.kind, "breath");
  assert.equal(bite.counter, true);
  assert.equal(bite.hit.sides.cowboy.board[0].health, 1);
  const reply = [];
  s.act({ type: "end" }, (step) => reply.push(step));
  const response = presentationBeats(reply);
  const trap = response.find((step) => step.kind === "trap");
  assert.equal(trap.stopped, true);
  assert.equal(trap.hit.sides.wizard.board[0].health, 0);
  assert.ok(response.every((step) => step.kind !== "sweep" && step.kind !== "breath"));
  assert.ok(reply.every((frame) => !Object.hasOwn(frame.after.sides.wizard, "traps")));
});

test("covered Last Stand, Ride, and lethal Sweep retain distinct contact outcomes", () => {
  const block = fixture([actor("cowboy-billy", 4)], [actor("wizard-jack-o-lantern", 1)]);
  block.sides.wizard.board[0].cover = true;
  const guard = present(block, { type: "attack", slot: 0, target: 0 });
  assert.deepEqual(
    guard.map((s) => s.kind),
    ["gun", "laststand"],
  );
  assert.equal(guard[0].blocked, 1);
  assert.equal(guard[1].hit.sides.cowboy.board[0].health, 3);
  const ride = fixture([actor("cowboy-mounted-billy", 4)], [actor("wizard-skeleton", 3)]);
  const [bypass] = present(ride, { type: "attack", slot: 0, target: "base" });
  assert.equal(bypass.kind, "ride");
  assert.equal(bypass.hit.sides.wizard.base, 4);
  assert.equal(bypass.hit.sides.wizard.board[0].health, 3);
  const dragon = fixture(
    [actor("cowboy-billy", 1), actor("cowboy-sheriff", 4)],
    [actor("wizard-dragon", 5)],
    "wizard",
  );
  const fan = present(dragon, { type: "attack", slot: 0, target: 1 }).find((step) => step.kind === "sweep");
  assert.deepEqual(fan.targets, [{ side: "cowboy", slot: 0 }]);
  assert.equal(fan.hit.sides.cowboy.board[0].health, 0);
});

test("Hex stops an attack, Lasso shows a stun, and Hellfire groups public targets", () => {
  const trap = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-skeleton", 2)]);
  trap.sides.wizard.traps = ["wizard-hex-1"];
  const stopped = present(trap, { type: "attack", slot: 0, target: 0 });
  assert.deepEqual(
    stopped.map((s) => s.kind),
    ["trap"],
  );
  assert.equal(stopped[0].stopped, true);
  assert.equal(stopped[0].hit.sides.cowboy.board[0].health, 3);
  const spell = fixture(
    [actor("cowboy-sheriff", 2), actor("cowboy-billy", 2)],
    [actor("wizard-skeleton", 2)],
    "wizard",
  );
  spell.sides.wizard.hand = ["wizard-hellfire-1"];
  const flame = present(spell, { type: "spell", cardId: "wizard-hellfire-1" });
  assert.equal(flame.length, 1);
  assert.equal(flame[0].kind, "hellfire");
  assert.equal(flame[0].targets.length, 2);
  const rope = fixture([actor("cowboy-billy", 4)], [actor("wizard-skeleton", 2)]);
  rope.sides.cowboy.hand = ["cowboy-lasso-1"];
  const [tie] = present(rope, { type: "spell", cardId: "cowboy-lasso-1", target: 0 });
  assert.equal(tie.kind, "lasso");
  assert.equal(tie.hit.sides.wizard.board[0].stunned, true);
  assert.equal(tie.hit.sides.wizard.board[0].health, 2);
});
