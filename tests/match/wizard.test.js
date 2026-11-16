// The Wizard piece's staff grip and cast (src/render/wizard.js) on the match
// board in Node: the real GLB, no WebGL, the real scheduler on a fake clock.
// Geometry and timing only; appearance is checked in Chrome
// (docs/evidence/fable-wizard-cast.md). Lengths are in rig units (the Wizard's
// height is 1) unless a message says world.
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { localModels } from "../../scripts/load-local.mjs";
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createMatchBoard } from "../../src/render/match-board.js";
import { CUE_TIMES, withCues } from "../../src/render/cues.js";
import { STAFF_DROP, WIZARD_CAST, WIZARD_HEIGHT, castWizard, idleWizard } from "../../src/render/wizard.js";

const models = await localModels();
const idOf = (name) => Object.values(CARDS).find((card) => card.name === name).id;
// The staff as attachStaff builds it: shaft radius, and its foot and jewel along the holder's y axis.
const SHAFT_RADIUS = .016, FOOT = new T.Vector3(.02, -.371, 0);

async function setup() {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const board = await createMatchBoard({ models, scheduler });
  const view = publicState(createMatch(0), "cowboy");
  view.sides.cowboy.board = [{ cardId: idOf("Sheriff"), health: 3 }, null, null];
  view.sides.wizard.board = [{ cardId: idOf("Wizard"), health: 4 }, null, null];
  board.reset(view);
  return { board, scheduler, wizard: board.piece("wizard", 0) };
}
const run = (scheduler, until) => {
  while (scheduler.now() < until) scheduler.tick(Math.min(until, scheduler.now() + 16));
};

// Measures the posed hand and body against the staff, in the staff's own frame.
function staffProbe(wizard) {
  const { actor, staff } = wizard, { body } = actor;
  const position = body.geometry.getAttribute("position"), index = body.geometry.getAttribute("skinIndex"), weight = body.geometry.getAttribute("skinWeight");
  const handBone = actor.rig.bones.indexOf(actor.rig.sides[1].hand);
  const hand = [], rest = [];
  for (let i = 0; i < position.count; i++) {
    let held = 0;
    for (let j = 0; j < 4; j++) if (index.getComponent(i, j) === handBone) held += weight.getComponent(i, j);
    if (held >= .5) hand.push(i);
    else if (position.getX(i) > -.05) rest.push(i); // the staff side of the body
  }
  const point = new T.Vector3(), inverse = new T.Matrix4();
  return () => {
    wizard.root.updateMatrixWorld(true);
    inverse.copy(staff.holder.matrixWorld).invert();
    const local = (i) => body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld).applyMatrix4(inverse);
    // Hand vertices at the shaft where the fist is, and how far round the shaft they reach.
    let touching = 0;
    const sectors = new Set();
    for (const i of hand) {
      const p = local(i);
      if (Math.abs(p.y - STAFF_DROP) < .059 && Math.hypot(p.x, p.z) < .027) {
        touching += 1;
        sectors.add(Math.floor((Math.atan2(p.z, p.x) + Math.PI) / (Math.PI / 6)));
      }
    }
    // The nearest the rest of the body comes to the staff's axis, foot to jewel.
    let clearance = Infinity;
    for (const i of rest) {
      const p = local(i);
      if (p.y > -.38 && p.y < .5) clearance = Math.min(clearance, Math.hypot(p.x, p.z));
    }
    const foot = staff.holder.localToWorld(FOOT.clone()), jewel = staff.jewel.getWorldPosition(new T.Vector3());
    return { touching, wrap: sectors.size * 30, clearance, foot, jewel };
  };
}

test("the Wizard holds the staff in its fist with the foot of the staff on the tile", async () => {
  const { board, wizard } = await setup();
  assert.equal(wizard.kind, "wizard");
  assert.equal(wizard.height, WIZARD_HEIGHT);
  assert.equal(wizard.staff.holder.parent, wizard.actor.rig.sides[1].hand, "the staff is on the hand bone, so it cannot drift in the palm");
  const top = board.stage.tiles[3].top;
  const probe = staffProbe(wizard);
  for (const seconds of [0, .9, 2.4]) {
    idleWizard(wizard, seconds);
    const { foot, touching, wrap } = probe();
    assert.ok(Math.abs(foot.y - top) < .02, `staff foot ${foot.y - top} world units above the tile at idle second ${seconds}`);
    assert.ok(touching >= 150 && wrap === 360, `fist: ${touching} vertices on the shaft, ${wrap} degrees round it`);
  }
});

test("through idle and both casts the fist stays closed on the shaft and the staff stays clear of the body", async () => {
  const { board, wizard } = await setup();
  const top = board.stage.tiles[3].top, probe = staffProbe(wizard);
  const frames = [];
  for (let s = 0; s <= 4; s += 1 / 10) frames.push(["idle", s, () => idleWizard(wizard, s)]);
  for (const [name, cast] of Object.entries(WIZARD_CAST)) {
    for (let t = 0; t <= cast.end; t += 1 / 30) frames.push([name, t, () => castWizard(wizard, t, 0, cast)]);
  }
  let fewest = Infinity, tightest = Infinity, lowest = Infinity;
  for (const [name, t, frame] of frames) {
    frame();
    const { touching, wrap, clearance, foot } = probe();
    assert.equal(wrap, 360, `${name} ${t}: the fist reaches ${wrap} degrees round the shaft`);
    fewest = Math.min(fewest, touching);
    tightest = Math.min(tightest, clearance);
    lowest = Math.min(lowest, foot.y - top);
  }
  assert.ok(fewest >= 150, `fewest hand vertices on the shaft: ${fewest}`);
  assert.ok(tightest >= SHAFT_RADIUS + .005, `the body comes within ${tightest} of the staff axis (shaft radius ${SHAFT_RADIUS})`);
  assert.ok(lowest > -.01, `staff foot ${lowest} world units under the tile`);
  console.log(JSON.stringify({ fewestHandVerticesOnShaft: fewest, tightestBodyClearance: tightest, lowestStaffFootWorld: lowest }));
});

test("the cast reads: back for the wind-up, forward and down at the release, and it joins the idle pose at both ends", async () => {
  const { wizard } = await setup();
  const { actor, staff } = wizard, { rig } = actor, cast = WIZARD_CAST.bolt;
  const joints = [rig.head, rig.chest, ...rig.sides.flatMap((side) => [side.hand, side.fore])];
  const snapshot = () => {
    wizard.root.updateMatrixWorld(true);
    return [...joints.map((bone) => bone.getWorldPosition(new T.Vector3())), staff.jewel.getWorldPosition(new T.Vector3())];
  };
  const apart = (a, b) => Math.max(...a.map((point, i) => point.distanceTo(b[i])));
  idleWizard(wizard, 0);
  const rest = snapshot(), jewelAtRest = rest.at(-1);
  for (const each of Object.values(WIZARD_CAST)) {
    castWizard(wizard, 0, 0, each);
    assert.ok(apart(snapshot(), rest) < .001, "a cast starts in the idle pose");
    castWizard(wizard, each.end, 0, each);
    assert.ok(apart(snapshot(), rest) < .001, "a cast ends in the idle pose");
  }
  castWizard(wizard, cast.raised, 0, cast);
  const raised = snapshot().at(-1);
  castWizard(wizard, cast.release, 0, cast);
  assert.ok(staff.jewel.material.emissiveIntensity > 3, "the jewel is charged at the release");
  const leaving = snapshot().at(-1);
  castWizard(wizard, cast.release + 1 / 60, 0, cast);
  const moving = snapshot().at(-1).sub(leaving);
  assert.ok(moving.z > .02 && moving.y < 0, "the jewel is still moving forward and down as the bolt leaves it");
  castWizard(wizard, cast.settle, 0, cast);
  const released = snapshot().at(-1);
  // The Wizard faces +z, toward the Cowboys.
  assert.ok(raised.z < jewelAtRest.z - .4 && raised.y > jewelAtRest.y + .2, "the jewel goes back and up in the wind-up");
  assert.ok(released.z > jewelAtRest.z + .5 && released.y < jewelAtRest.y - .2, "the jewel goes forward and down in the thrust");
  const heights = (a, b) => a.distanceTo(b) / WIZARD_HEIGHT;
  assert.ok(heights(raised, released) >= .5, `the jewel sweeps ${heights(raised, released)} heights from wind-up to the end of the thrust`);
  console.log(JSON.stringify({ windUpTravelHeights: heights(jewelAtRest, raised), releaseTravelHeights: heights(jewelAtRest, released), sweepHeights: heights(raised, released) }));
});

test("the bolt keeps the match cue times: it leaves the jewel at 0.9 s and bursts on the target at 1.1 s", async () => {
  const { board, scheduler, wizard } = await setup();
  const target = { kind: "troop", side: "cowboy", slot: 0, cardId: idOf("Sheriff") };
  const contact = board.targetPoint(target);
  const cue = withCues(board).attack({ attacker: { side: "wizard", slot: 0, cardId: wizard.cardId }, target });
  assert.deepEqual(cue, { impact: 1100, end: 1600 });
  assert.deepEqual(cue, { ...CUE_TIMES.wizard });
  assert.equal(WIZARD_CAST.bolt.release, .9);
  const shown = (name) => board.effects.children.filter((mesh) => mesh.name === name && mesh.visible);

  run(scheduler, 480);
  assert.equal(wizard.acting, true);
  assert.equal(shown("cue-jewel-glow").length, 1, "the jewel glows during the wind-up");
  assert.equal(shown("cue-bolt").length, 0, "nothing has left the staff");
  run(scheduler, 880);
  assert.equal(shown("cue-bolt").length, 0, "nothing has left the staff before 0.9 s");
  const jewel = wizard.staff.jewel.getWorldPosition(new T.Vector3());
  run(scheduler, 928);
  const [bolt] = shown("cue-bolt");
  assert.ok(bolt, "the bolt is in flight");
  assert.ok(bolt.position.distanceTo(jewel) < 1.2, "it starts at the jewel");
  assert.ok(bolt.scale.x >= .15, "large enough for the board camera");
  run(scheduler, 1088);
  assert.equal(shown("cue-bolt-burst").length, 0, "no target feedback before the impact");
  run(scheduler, 1120);
  const [burst] = shown("cue-bolt-burst");
  assert.ok(burst && burst.position.distanceTo(contact) < 1e-9, "the burst is on the target at the impact");
  assert.equal(shown("cue-bolt").length, 0, "the bolt is gone");
  run(scheduler, cue.end);
  assert.equal(wizard.acting, false);
  assert.equal(wizard.actor.root.rotation.y, 0);
  assert.equal(board.effects.children.length, 0);
  assert.equal(scheduler.pending(), 0);

  // Singularity: the same Wizard casts it and returns to idle.
  const spell = withCues(board).spell({ spell: "Singularity", cardId: idOf("Singularity"), caster: "wizard", target: { side: "cowboy", slot: 0, cardId: idOf("Sheriff") } });
  assert.deepEqual(spell, { ...CUE_TIMES.singularity });
  run(scheduler, scheduler.now() + 400);
  assert.equal(wizard.acting, true);
  run(scheduler, scheduler.now() + spell.end);
  assert.equal(wizard.acting, false);
  assert.equal(scheduler.pending(), 0);
});
