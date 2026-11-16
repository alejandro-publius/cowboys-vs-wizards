// The Dragon's and Mounted Billy's attack clips on the match board: independent
// skeletons, the contact pose on the game's impact, a return to rest, anchored
// feet, cancellation by the scheduler and the static-lunge fallback.
import test from "node:test";
import assert from "node:assert/strict";
import { localModels } from "../../scripts/load-local.mjs";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { CUES, createMatchBoard } from "../../src/render/match-board.js";

const models = await localModels();
const idOf = (name) => Object.values(CARDS).find((card) => card.name === name).id;
const troop = (name, health) => ({ cardId: idOf(name), health });

function view(cowboy, wizard) {
  const state = publicState(createMatch(0), "cowboy");
  state.sides.cowboy.board = cowboy;
  state.sides.wizard.board = wizard;
  for (const side of SIDES) state.sides[side].baseOrbs = 5;
  return state;
}
const LANES = () => view([troop("Mounted Billy", 5), null, null], [troop("Dragon", 5), null, troop("Dragon", 5)]);

async function setup(available = models) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const board = await createMatchBoard({ models: available, scheduler });
  board.reset(LANES());
  return { board, scheduler };
}
const run = (scheduler, until) => {
  while (scheduler.now() < until) scheduler.tick(Math.min(until, scheduler.now() + 16));
};
const bones = (piece) => piece.root.getObjectByProperty("isSkinnedMesh", true).skeleton.bones;
const pose = (piece) => bones(piece).flatMap((bone) => [...bone.position.toArray(), ...bone.quaternion.toArray()]);
const distance = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
const attack = (board, side, slot, name) => board.attack({
  attacker: { side, slot, cardId: idOf(name) },
  target: { kind: "troop", side: side === "cowboy" ? "wizard" : "cowboy", slot: 0, cardId: idOf("Dragon") },
});

for (const [side, slot, name, clip] of [["cowboy", 0, "Mounted Billy", "mounted_attack"], ["wizard", 0, "Dragon", "dragon_attack"]]) {
  test(`${name}: the ${clip} contact pose lands on the impact and the pose returns to rest`, async () => {
    const { board, scheduler } = await setup();
    const piece = board.piece(side, slot);
    const rest = pose(piece);
    const anchor = piece.root.position.clone();
    attack(board, side, slot, name);
    let moved = 0;
    for (let ms = 16; ms <= 1000; ms += 16) {
      run(scheduler, ms);
      moved = Math.max(moved, distance(pose(piece), rest));
      assert.equal(piece.body.position.lengthSq(), 0, "articulated attacks do not slide the piece");
      assert.ok(piece.root.position.equals(anchor));
      if (ms === 400 - 400 % 16) {
        const { action, impact } = piece.clip;
        assert.ok(Math.abs(action.time - impact) < 0.04, `clip time ${action.time} at the impact ${impact}`);
        assert.ok(distance(pose(piece), rest) > 0.1, "the contact pose differs from rest");
      }
    }
    assert.ok(moved > 0.1);
    assert.ok(distance(pose(piece), rest) < 1e-5, "the clip returns to the rest pose");
    assert.equal(scheduler.pending(), 0);
  });
}

test("each troop owns its bones, skeleton and mixer, and one attack leaves its twin at rest", async () => {
  const { board, scheduler } = await setup();
  const [left, right] = [board.piece("wizard", 0), board.piece("wizard", 2)];
  const [leftBones, rightBones] = [bones(left), bones(right)];
  assert.ok(leftBones.every((bone) => !rightBones.includes(bone)), "no shared bone");
  assert.notEqual(left.clip.mixer, right.clip.mixer);
  const rest = pose(right);
  attack(board, "wizard", 0, "Dragon");
  run(scheduler, 400);
  assert.ok(distance(pose(left), rest) > 0.1);
  assert.equal(distance(pose(right), rest), 0, "the other Dragon did not move");
  run(scheduler, 1000);
  // Source model keeps its own rest pose.
  assert.ok(models["dragon-rigged"].getObjectByProperty("isSkinnedMesh", true).skeleton.bones.every((bone) => !leftBones.includes(bone)));
});

test("scheduler.advance() mid-attack freezes the pose; a restart builds fresh rest-pose pieces", async () => {
  const { board, scheduler } = await setup();
  const piece = board.piece("wizard", 0), rest = pose(piece);
  attack(board, "wizard", 0, "Dragon");
  run(scheduler, 300);
  const frozen = pose(piece);
  assert.ok(distance(frozen, rest) > 0.01);
  scheduler.advance();
  run(scheduler, 3000);
  assert.equal(distance(pose(piece), frozen), 0);
  board.reset(LANES());
  assert.ok(distance(pose(board.piece("wizard", 0)), rest) < 1e-9);
});

test("without the rigs the static troops keep the whole-piece lunge", async () => {
  const { board, scheduler } = await setup({ ...models, "dragon-rigged": undefined, "mounted-billy-rigged": undefined });
  const dragon = board.piece("wizard", 0);
  assert.equal(dragon.clip, undefined);
  assert.equal(dragon.root.getObjectByProperty("isSkinnedMesh", true), undefined);
  attack(board, "wizard", 0, "Dragon");
  run(scheduler, CUES.attack.impact);
  assert.ok(dragon.body.position.length() > 0.1, "the piece lunges toward its target");
  run(scheduler, CUES.attack.end);
  assert.equal(dragon.body.position.length(), 0);
});
