// The Sheriff piece (src/render/sheriff.js) on the match board in Node: the
// real GLBs, no WebGL, the real scheduler on a fake clock. Geometry and timing
// only; appearance is checked in Chrome (docs/evidence/fable-sheriff-integration.md).
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { localModels } from "../../scripts/load-local.mjs";
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createController } from "../../src/match/controller.js";
import { createMatchBoard } from "../../src/render/match-board.js";
import { CUE_TIMES, withCues } from "../../src/render/cues.js";
import { grip } from "../../src/render/rig.js";
import { SHERIFF_HEIGHT, SHERIFF_LANDING, SHERIFF_SHOT, drawSheriff, idleSheriff, landSheriff, restSheriff } from "../../src/render/sheriff.js";

const models = await localModels();
const idOf = (name) => Object.values(CARDS).find((card) => card.name === name).id;
const shownOrbs = (piece) => piece.orbs.group.children.filter((orb) => orb.userData.orb && orb.visible).length;

async function setup(cowboy = [null, null, null], wizard = [null, null, null]) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const board = await createMatchBoard({ models, scheduler });
  const view = publicState(createMatch(0), "cowboy");
  view.sides.cowboy.board = cowboy;
  view.sides.wizard.board = wizard;
  board.reset(view);
  return { board, scheduler };
}
const run = (scheduler, until) => {
  while (scheduler.now() < until) scheduler.tick(Math.min(until, scheduler.now() + 16));
};

// World positions of the boot-sole vertices (the lowest 1% of the mesh).
function soles(piece) {
  const { body } = piece.actor, position = body.geometry.getAttribute("position"), out = [];
  piece.root.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < .01) out.push(body.getVertexPosition(i, new T.Vector3()).applyMatrix4(body.matrixWorld));
  }
  return out;
}

test("the Sheriff stands on its tile at board scale, facing the Wizards with the revolver at its hip", async () => {
  const { board } = await setup([{ cardId: idOf("Sheriff"), health: 3 }, { cardId: idOf("Billy"), health: 4 }, null]);
  const sheriff = board.piece("cowboy", 0), billy = board.piece("cowboy", 1), tile = board.stage.tiles[0];
  assert.equal(sheriff.kind, "sheriff");
  assert.equal(sheriff.temporary, false);
  assert.equal(sheriff.actor.body.isSkinnedMesh, true);
  assert.equal(sheriff.actor.body.geometry.userData.asset, "sheriff");
  assert.equal(sheriff.actor.root.rotation.y, Math.PI, "faces the Wizards");

  const size = new T.Box3().setFromObject(sheriff.actor.body, true).getSize(new T.Vector3());
  assert.ok(Math.abs(size.y - SHERIFF_HEIGHT) < .01, `height ${size.y}`);
  assert.ok(sheriff.height < billy.height, "shorter than Billy");
  const tileSize = new T.Box3().setFromObject(tile.model).getSize(new T.Vector3());
  assert.ok(size.x < tileSize.x && size.z < tileSize.z, "fits on the tile");

  // The approved clip moves the hips, so the actor is seated: the lowest boot of each foot is
  // on the tile, none is under it, and both boots stay over the tile. (Fidelity to the source
  // is in sheriff-idle.test.js.)
  restSheriff(sheriff);
  const restFeet = soles(sheriff);
  for (const point of restFeet) assert.ok(Math.abs(point.y - tile.top) < .02, `rest sole at ${point.y}, tile at ${tile.top}`);
  for (const seconds of [0, .7, 1.3, 1.9, 2.4]) {
    idleSheriff(sheriff, seconds);
    const feet = soles(sheriff);
    assert.ok(feet.length > 20);
    assert.ok(Math.min(...feet.map((point) => point.y)) > tile.top - .005, `a sole is under the tile at idle second ${seconds}`);
    assert.ok(Math.min(...feet.map((point) => point.y)) < tile.top + .02, `no boot on the tile at idle second ${seconds}`);
    assert.ok(feet.every((point) => Math.abs(point.x - tile.x) < tileSize.x / 2 && Math.abs(point.z - tile.z) < tileSize.z / 2), "both boots are over the tile");
  }
  restSheriff(sheriff);
  const gun = sheriff.gun.holder.position;
  assert.ok(gun.distanceTo(sheriff.holster) < 1e-9, "holstered");
  assert.ok(gun.x < -.15 && gun.x > -.25 && Math.abs(gun.y - .44) < .03, "at the right hip, belt height");
});

test("the summon lands the Sheriff on the tile at impact and keeps the boots planted while it straightens", async () => {
  const { board, scheduler } = await setup();
  const cue = board.summon({ side: "cowboy", slot: 0, cardId: idOf("Sheriff"), health: 3 });
  assert.deepEqual(cue, { ...SHERIFF_LANDING });
  const sheriff = board.piece("cowboy", 0), top = board.stage.tiles[0].top;
  run(scheduler, cue.impact / 2);
  assert.ok(sheriff.body.position.y > .3, "still in the air");
  assert.equal(sheriff.acting, true);
  run(scheduler, cue.impact);
  let lowestHips = Infinity;
  const hips = new T.Vector3();
  for (let ms = cue.impact; ms <= cue.end; ms += 16) {
    run(scheduler, ms);
    assert.ok(sheriff.body.position.y < 1e-6, `on the tile at ${ms} ms`);
    for (const point of soles(sheriff)) assert.ok(Math.abs(point.y - top) < .02, `sole at ${point.y} at ${ms} ms`);
    lowestHips = Math.min(lowestHips, sheriff.actor.rig.pelvis.getWorldPosition(hips).y - top);
  }
  run(scheduler, cue.end);
  const standing = sheriff.actor.rig.pelvis.getWorldPosition(hips).y - top;
  assert.ok(standing - lowestHips > .08, `the knees bend on landing (hips ${lowestHips} against ${standing})`);
  assert.equal(sheriff.acting, false);
  assert.equal(sheriff.body.scale.x, 1);
  assert.equal(scheduler.pending(), 0);
});

test("draw, fire, recover: the revolver is in the hand and on the target at the shot, and back at the hip at the end", async () => {
  const { board, scheduler } = await setup([{ cardId: idOf("Sheriff"), health: 3 }, null, null], [{ cardId: idOf("Skeleton"), health: 3 }, null, null]);
  const sheriff = board.piece("cowboy", 0);
  const target = { kind: "troop", side: "wizard", slot: 0, cardId: idOf("Skeleton") };
  const contact = board.targetPoint(target);
  const cue = withCues(board).attack({ attacker: { side: "cowboy", slot: 0, cardId: sheriff.cardId }, target });
  assert.deepEqual(cue, { impact: 890, end: 1580 });
  assert.deepEqual(cue, { ...CUE_TIMES.sheriff });
  const hand = () => sheriff.gun.holder.position.distanceTo(grip(sheriff.actor, "right"));
  const named = (name) => board.effects.children.filter((mesh) => mesh.name === name && mesh.visible);

  run(scheduler, 200);
  assert.ok(sheriff.gun.holder.position.distanceTo(sheriff.holster) < .08, "still holstered during the wind-up");
  assert.equal(named("cue-muzzle-flash").length, 0);

  // Aimed, just before the shot: gripped, level and pointing at the target.
  run(scheduler, SHERIFF_SHOT.shot * 1000 - 16);
  assert.ok(hand() < 1e-9, "the revolver is at the palm");
  const muzzle = sheriff.gun.tip.getWorldPosition(new T.Vector3());
  const barrel = new T.Vector3(0, 0, 1).applyQuaternion(sheriff.gun.holder.getWorldQuaternion(new T.Quaternion()));
  const error = T.MathUtils.radToDeg(barrel.angleTo(contact.clone().sub(muzzle)));
  assert.ok(error < 1.5, `barrel is ${error} degrees off the target`);
  assert.ok(muzzle.z < sheriff.root.position.z - .3, "the muzzle is ahead of the Sheriff, toward the Wizards");
  assert.ok(muzzle.y > sheriff.root.position.y + .8, "raised to chest height");
  assert.equal(named("cue-tracer").length, 0, "nothing has left the barrel yet");

  run(scheduler, SHERIFF_SHOT.shot * 1000 + 32);
  assert.ok(named("cue-muzzle-flash").length > 0, "muzzle flash at the shot");
  assert.ok(named("cue-tracer").length > 0, "tracer in flight");
  run(scheduler, cue.impact + 32);
  assert.ok(named("cue-spark").length > 0, "sparks at the target at impact");
  assert.ok(named("cue-spark").every((mesh) => mesh.position.distanceTo(contact) < .5));

  run(scheduler, cue.end);
  assert.equal(sheriff.acting, false);
  assert.ok(sheriff.gun.holder.position.distanceTo(sheriff.holster) < 1e-9, "holstered again");
  assert.equal(sheriff.actor.root.rotation.y, Math.PI);
  assert.equal(board.effects.children.length, 0);
  assert.equal(scheduler.pending(), 0);
});

// Targets from docs/character-animation-plan.md and the Lucca references it
// names (character-clips.md sections 5 and 6b), taking one world unit as a metre.
test("reference targets: poses join within 1 mm, planted boots do not drift, nothing goes under the tile, the shot reads", async () => {
  const { board } = await setup([{ cardId: idOf("Sheriff"), health: 3 }, null, null], [{ cardId: idOf("Skeleton"), health: 3 }, null, null]);
  const sheriff = board.piece("cowboy", 0), top = board.stage.tiles[0].top;
  const { actor, gun } = sheriff, { rig } = actor;
  const aim = board.targetPoint({ kind: "troop", side: "wizard", slot: 0 });
  const joints = [rig.head, rig.chest, rig.pelvis, ...rig.sides.flatMap((side) => [side.hand, side.fore, side.foot])];
  const snapshot = () => {
    sheriff.root.updateMatrixWorld(true);
    return [...joints.map((bone) => bone.getWorldPosition(new T.Vector3())), gun.holder.getWorldPosition(new T.Vector3())];
  };
  const apart = (a, b) => Math.max(...a.map((point, i) => point.distanceTo(b[i])));
  const position = actor.body.geometry.getAttribute("position"), point = new T.Vector3();
  const lowest = () => {
    let y = Infinity;
    for (let i = 0; i < position.count; i++) y = Math.min(y, actor.body.getVertexPosition(i, point).applyMatrix4(actor.body.matrixWorld).y);
    return y;
  };

  // Every cue starts in the pose the idle is in, and ends in the pose the idle starts from.
  restSheriff(sheriff);
  const rest = snapshot(), planted = soles(sheriff);
  // A cue starts in the rest pose, also when the approved idle was playing before it.
  idleSheriff(sheriff, 1.3);
  assert.ok(apart(snapshot(), rest) > .01, "the approved idle moves");
  drawSheriff(sheriff, 0, 0, aim);
  assert.ok(apart(snapshot(), rest) < .001, `draw start is ${apart(snapshot(), rest)} from rest`);
  drawSheriff(sheriff, SHERIFF_SHOT.end, 0, aim);
  assert.ok(apart(snapshot(), rest) < .001, `draw end is ${apart(snapshot(), rest)} from rest`);
  landSheriff(sheriff, SHERIFF_LANDING.end);
  assert.ok(apart(snapshot(), rest) < .001, `landing end is ${apart(snapshot(), rest)} from rest`);

  // Planted boots and the floor, sampled at 60 per second through landing and draw.
  const frames = [];
  for (let ms = SHERIFF_LANDING.impact; ms <= SHERIFF_LANDING.end; ms += 1000 / 60) frames.push(() => landSheriff(sheriff, ms));
  restSheriff(sheriff);
  for (let t = 0; t <= SHERIFF_SHOT.end; t += 1 / 60) frames.push(() => drawSheriff(sheriff, t, 0, aim));
  let drift = 0, under = 0;
  for (const frame of frames) {
    frame();
    drift = Math.max(drift, apart(soles(sheriff), planted));
    under = Math.max(under, top - lowest());
  }
  assert.ok(drift < .001, `boot soles drift ${drift}`);
  assert.ok(under < .005, `${under} under the tile`);

  // The fall is free fall from rest: after t seconds the body has dropped 0.5 g t^2,
  // and it reaches the tile exactly at the impact time.
  const total = SHERIFF_LANDING.impact / 1000;
  for (const ms of [0, 100, 250, SHERIFF_LANDING.impact]) {
    const expected = .5 * 9.81 * (total ** 2 - (ms / 1000) ** 2);
    assert.ok(Math.abs(landSheriff(sheriff, ms).height - expected) < 1e-9, `height at ${ms} ms`);
  }

  // Reading: the shot comes within 0.8 s, the muzzle travels at least 0.35 heights
  // from rest, and the chest leans at least 10 degrees at the shot.
  assert.ok(SHERIFF_SHOT.shot <= .8);
  restSheriff(sheriff);
  sheriff.root.updateMatrixWorld(true);
  const muzzleAtRest = gun.tip.getWorldPosition(new T.Vector3());
  drawSheriff(sheriff, SHERIFF_SHOT.shot, 0, aim);
  sheriff.root.updateMatrixWorld(true);
  const travel = gun.tip.getWorldPosition(new T.Vector3()).distanceTo(muzzleAtRest) / SHERIFF_HEIGHT;
  assert.ok(travel >= .35, `muzzle travels ${travel} heights`);
  const lean = T.MathUtils.radToDeg(new T.Vector3(0, 1, 0).applyQuaternion(rig.chest.getWorldQuaternion(new T.Quaternion())).angleTo(new T.Vector3(0, 1, 0)));
  assert.ok(lean >= 10, `chest leans ${lean} degrees`);
  console.log(JSON.stringify({ soleDrift: drift, underTile: under, muzzleTravelHeights: travel, chestLeanDegrees: lean }));
});

test("seed 0: the Sheriff's shot takes the Skeleton's orb at the cue's impact time, from the Engine's damage event", async () => {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const board = await createMatchBoard({ models, scheduler });
  const controller = createController({ scheduler, renderer: withCues(board) });
  assert.equal(controller.start(0), true);
  const settle = () => {
    for (let ticks = 0; controller.status() !== "accepting_input"; ticks++) {
      assert.ok(ticks < 2000 && controller.status() !== "error", controller.message());
      scheduler.tick(scheduler.now() + 16);
    }
  };
  const sheriffCard = controller.view().sides.cowboy.hand.find((id) => CARDS[id].name === "Sheriff");
  controller.input({ type: "card", cardId: sheriffCard });
  controller.input({ type: "slot", side: "cowboy", slot: 0 });
  controller.input({ type: "confirm" });
  settle();
  const sheriff = board.piece("cowboy", 0);
  assert.equal(sheriff.kind, "sheriff");
  assert.equal(shownOrbs(sheriff), 3);
  assert.equal(controller.endPhase().ok, true);

  // The Wizard CPU answers with a Skeleton in the same lane; then the clash.
  let drawStarted = null, orbLost = null;
  for (let ticks = 0; orbLost === null; ticks++) {
    assert.ok(ticks < 2000, "no clash");
    scheduler.tick(scheduler.now() + 8);
    const skeleton = board.piece("wizard", 0);
    if (drawStarted === null && sheriff.acting) drawStarted = scheduler.now();
    if (skeleton && shownOrbs(skeleton) === 2) orbLost = scheduler.now();
    else if (skeleton && drawStarted !== null) assert.equal(shownOrbs(skeleton), 3, "no orb is lost before the impact");
  }
  assert.equal(CARDS[board.piece("wizard", 0).cardId].name, "Skeleton");
  assert.ok(Math.abs(orbLost - drawStarted - CUE_TIMES.sheriff.impact) <= 8, `orb lost ${orbLost - drawStarted} ms after the draw began`);
  assert.equal(controller.displayed().sides.wizard.board[0].health, 2);
  settle();
  assert.equal(board.piece("cowboy", 0).acting, false);
});
