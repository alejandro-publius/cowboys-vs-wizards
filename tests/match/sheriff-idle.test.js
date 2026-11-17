// The approved Sheriff headShake idle in the real match board (real GLBs, no WebGL). Checks
// the extracted track data against the approved GLB, the playback in the board's render
// callback, and its lifecycle. Appearance is NOT checked here: it still needs a visual review.
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import * as T from "three";
import {localModels} from "../../scripts/load-local.mjs";
import {APPROVED_GLB, APPROVED_SHA256, clipFromGlb} from "../../scripts/extract-approved-sheriff-clip.mjs";
import {CARDS} from "../../src/game/cards.js";
import {createMatch} from "../../src/game/state.js";
import {publicState} from "../../src/game/view.js";
import {createScheduler} from "../../src/match/scheduler.js";
import {createMatchBoard} from "../../src/render/match-board.js";
import {withCues} from "../../src/render/cues.js";
import {SHERIFF_LANDING, SHERIFF_SHOT, SHERIFF_BLEND_SECONDS, drawSheriff, idleSheriff, restSheriff} from "../../src/render/sheriff.js";

const models = await localModels();
const idOf = (name) => Object.values(CARDS).find((card) => card.name === name).id;
const data = JSON.parse(readFileSync(new URL("../../assets/animations/sheriff-headShake.json", import.meta.url), "utf8"));
const source = JSON.parse(readFileSync(new URL("../../assets/animations/sheriff-headShake.SOURCE.json", import.meta.url), "utf8"));

async function setup(cowboy = [null, null, null], wizard = [null, null, null]) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const board = await createMatchBoard({models, scheduler});
  const view = publicState(createMatch(0), "cowboy");
  view.sides.cowboy.board = cowboy;
  view.sides.wizard.board = wizard;
  board.reset(view);
  return {board, scheduler};
}
const run = (scheduler, until) => {
  while (scheduler.now() < until) scheduler.tick(Math.min(until, scheduler.now() + 16));
};
const SHERIFF = (health = 3) => ({cardId: idOf("Sheriff"), health});
// Every bone's local quaternion and position, as flat numbers.
const channels = (piece) => piece.actor.rig.bones.flatMap((bone) => [...bone.quaternion.toArray(), ...bone.position.toArray()]);
const apart = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
// The board's render callback with the browser clock replaced by `clock.seconds`.
const clock = {seconds: 100};
test.beforeEach((t) => t.mock.method(performance, "now", () => clock.seconds * 1000));
const frame = (piece) => piece.actor.body.onBeforeRender();

test("the extracted track data equals the approved GLB accessors and keeps its provenance", () => {
  const bytes = Buffer.from(readFileSync(new URL("../../assets/animations/sheriff-headShake.json", import.meta.url)));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), source.clipDataSha256);
  assert.equal(source.approvedGlb.sha256, APPROVED_SHA256);
  assert.equal(source.approvedGlb.bytes, 3891912);
  assert.equal(source.clip, "Mixamo_headShake_retargeted");
  assert.equal(data.name, source.clip);
  assert.ok(Math.abs(data.duration - 2.566666603) < 1e-8);
  assert.equal(data.tracks.length, 17);
  assert.match(source.terms, /Mixamo/);
  assert.match(source.motionSources[0], /three\.js\/r180\/examples\/models\/gltf\/Xbot\.glb/);

  const file = process.env.SHERIFF_APPROVED_GLB ?? APPROVED_GLB;
  if (!existsSync(file)) return console.log(`approved GLB not present at ${file}; accessor comparison not run`);
  const glb = readFileSync(file);
  assert.equal(createHash("sha256").update(glb).digest("hex"), APPROVED_SHA256);
  const clip = clipFromGlb(glb);
  assert.equal(clip.name, data.name);
  assert.equal(clip.duration, data.duration);
  assert.equal(clip.tracks.length, data.tracks.length);
  clip.tracks.forEach((track, i) => {
    assert.equal(data.tracks[i].name, `${track.bone}.${track.path}`);
    assert.equal(data.tracks[i].times.length, track.times.length);
    assert.ok(data.tracks[i].times.every((value, k) => Math.fround(value) === track.times[k]), `${track.bone} times`);
    assert.ok(data.tracks[i].values.every((value, k) => Math.fround(value) === track.values[k]), `${track.bone} values`);
  });
});

test("the Sheriff on the board plays exactly the approved clip, sampled at fixed timestamps", async () => {
  const {board} = await setup([SHERIFF(), null, null]);
  const sheriff = board.piece("cowboy", 0), {rig} = sheriff.actor;
  const approved = existsSync(process.env.SHERIFF_APPROVED_GLB ?? APPROVED_GLB) ? clipFromGlb(readFileSync(process.env.SHERIFF_APPROVED_GLB ?? APPROVED_GLB)) : null;
  // Reference sampling straight from the tracks: linear for position, slerp for rotation.
  const sample = (track, time) => {
    const times = track.times, size = track.path === "position" ? 3 : 4;
    let k = 0;
    while (k < times.length - 2 && times[k + 1] <= time) k++;
    const u = Math.min(1, Math.max(0, (time - times[k]) / (times[k + 1] - times[k])));
    const a = track.values.slice(k * size, k * size + size), b = track.values.slice((k + 1) * size, (k + 1) * size + size);
    if (size === 3) return a.map((value, i) => value + (b[i] - value) * u);
    return new T.Quaternion().fromArray(a).slerp(new T.Quaternion().fromArray(b), u).toArray();
  };
  const tracks = approved ? approved.tracks : data.tracks.map((track) => ({bone: track.name.split(".")[0], path: track.name.split(".")[1], times: Float32Array.from(track.times), values: Float32Array.from(track.values)}));
  clock.seconds = 100;
  frame(sheriff); // the first rendered frame is the clip's second 0
  for (const seconds of [0, .4, 1.0, 1.7, 2.3]) {
    clock.seconds = 100 + seconds;
    frame(sheriff);
    assert.ok(Math.abs(sheriff.idle.seconds - seconds) < 1e-9);
    for (const track of tracks) {
      const bone = rig.bones.find((one) => one.name === track.bone);
      const expected = sample(track, seconds), actual = track.path === "position" ? bone.position.toArray() : bone.quaternion.toArray();
      const error = track.path === "position" ? apart(actual, expected) : Math.min(apart(actual, expected), apart(actual, expected.map((value) => -value)));
      assert.ok(error < 2e-6, `${track.bone}.${track.path} at ${seconds}: ${error}`);
    }
  }
  // The approved gesture's head excursion (about 34.8 degrees from its first sample) is visible
  // on the board's rig.
  const first = new T.Quaternion();
  clock.seconds = 100; frame(sheriff); first.copy(rig.head.quaternion);
  let degrees = 0;
  for (let seconds = 0; seconds <= data.duration; seconds += 1 / 60) {
    clock.seconds = 100 + seconds; frame(sheriff);
    degrees = Math.max(degrees, T.MathUtils.radToDeg(first.angleTo(rig.head.quaternion)));
  }
  assert.ok(degrees > 30, `the head turns ${degrees} degrees at most`);
  const start = tracks.map((t) => t.values.slice(0, t.path === "position" ? 3 : 4)), end = tracks.map((t) => t.values.slice(-(t.path === "position" ? 3 : 4)));
  console.log(JSON.stringify({maxHeadTurnDegrees: degrees, loopSeamMaxDifference: Math.max(...start.map((value, i) => apart(value, end[i])))}));
});

test("two Sheriffs play independently and stay seated on their tiles", async () => {
  const {board} = await setup([SHERIFF(), null, SHERIFF()]);
  const [one, two] = [board.piece("cowboy", 0), board.piece("cowboy", 2)];
  assert.notEqual(one.idle, two.idle);
  assert.notEqual(one.idle.clip, two.idle.clip);
  clock.seconds = 10; frame(one); frame(two);
  const twoBefore = channels(two);
  clock.seconds = 10.9; frame(one);
  assert.deepEqual(channels(two), twoBefore, "advancing one Sheriff does not touch the other");
  assert.ok(apart(channels(one), channels(two)) > .05, "the two are at different clip times");
  for (const [piece, index] of [[one, 0], [two, 2]]) {
    for (const seconds of [0, .5, 1, 1.5, 2, 2.5]) {
      clock.seconds = 20 + seconds; frame(piece);
      piece.root.updateMatrixWorld(true);
      const {body} = piece.actor, position = body.geometry.getAttribute("position"), tile = board.stage.tiles[index], point = new T.Vector3();
      let lowest = Infinity;
      for (let i = 0; i < position.count; i++) if (position.getY(i) < .02) lowest = Math.min(lowest, body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld).y);
      assert.ok(lowest > tile.top - .005 && lowest < tile.top + .02, `lowest boot ${lowest} on tile top ${tile.top} at ${seconds}`);
    }
  }
});

test("the source blends continuously into a cue and clears before the gun is drawn", async () => {
  const {board} = await setup([SHERIFF(), SHERIFF(), null], [{cardId: idOf("Skeleton"), health: 3}, null, null]);
  const [played, fresh] = [board.piece("cowboy", 0), board.piece("cowboy", 1)];
  const aim = board.targetPoint({kind: "troop", side: "wizard", slot: 0});
  clock.seconds = 5; frame(played);
  clock.seconds = 6.2; frame(played);
  assert.equal(played.idle.playing, true);
  assert.ok(Math.abs(played.actor.rig.pelvis.position.y - played.actor.rig.spec.pelvis[1]) > 1e-4 || played.actor.root.position.y > 1e-4 || played.actor.rig.pelvis.quaternion.angleTo(new T.Quaternion()) > 1e-3, "the source moved the hips");
  const before = channels(played), beforeLift = played.actor.root.position.y;
  drawSheriff(played, 0, 0, aim);
  assert.ok(apart(channels(played), before) < 1e-9, "the first cue frame preserves the displayed pose");
  assert.equal(played.actor.root.position.y, beforeLift);
  drawSheriff(played, .0001, 0, aim);
  assert.ok(apart(channels(played), before) < .001, "no jump just after ownership changes");
  assert.ok(SHERIFF_BLEND_SECONDS < SHERIFF_SHOT.grab, "the blend ends before the gun is handled");
  for (const t of [SHERIFF_SHOT.grab, .3, SHERIFF_SHOT.shot, SHERIFF_SHOT.end]) {
    drawSheriff(played, t, 0, aim);
    drawSheriff(fresh, t, 0, aim);
    for (const [index, bone] of played.actor.rig.bones.entries()) assert.ok(apart(bone.matrix.elements, fresh.actor.rig.bones[index].matrix.elements) < 1e-9, `${bone.name} at ${t}`);
    assert.equal(played.actor.root.position.y, 0);
  }
  assert.equal(played.idle.playing, false);
  frame(played); // acting is false: the idle resumes from its first frame
  assert.equal(played.idle.playing, true);
});

test("returning to the approved idle preserves the cue endpoint, then reaches the unmodified clip", async () => {
  const {board} = await setup([SHERIFF(), SHERIFF(), null]);
  const [piece, reference] = [board.piece("cowboy", 0), board.piece("cowboy", 1)];
  restSheriff(piece);
  const before = channels(piece), lift = piece.actor.root.position.y;
  idleSheriff(piece, 0);
  assert.ok(apart(channels(piece), before) < 1e-9, "idle starts at the displayed cue endpoint");
  assert.equal(piece.actor.root.position.y, lift);
  idleSheriff(piece, .0001);
  assert.ok(apart(channels(piece), before) < .001, "the first idle advance stays continuous");
  idleSheriff(piece, .3);
  idleSheriff(reference, .3);
  assert.ok(apart(channels(piece), channels(reference)) < 1e-9, "after blending, the original clip is unchanged");
  assert.equal(piece.idleBlendIn, null);
  board.clear();
});

test("attack and summon suppress the idle, which resumes afterwards from the first frame", async () => {
  const {board, scheduler} = await setup([SHERIFF(), null, null], [{cardId: idOf("Skeleton"), health: 3}, null, null]);
  const sheriff = board.piece("cowboy", 0), cues = withCues(board);
  clock.seconds = 1; frame(sheriff);
  clock.seconds = 1.8; frame(sheriff);
  const cue = cues.attack({attacker: {side: "cowboy", slot: 0}, target: {kind: "troop", side: "wizard", slot: 0}});
  assert.equal(sheriff.acting, true);
  assert.equal(sheriff.idle.playing, false, "the draw took the pose from the clip");
  clock.seconds = 2.5;
  run(scheduler, cue.impact);
  const during = channels(sheriff);
  clock.seconds = 3.1; frame(sheriff);
  assert.deepEqual(channels(sheriff), during, "a render during the attack leaves the cue's pose alone");
  assert.ok(sheriff.gun.holder.position.distanceTo(sheriff.actor.root.localToWorld(new T.Vector3())) > 0);
  run(scheduler, cue.end);
  assert.equal(sheriff.acting, false);
  assert.ok(sheriff.gun.holder.position.distanceTo(sheriff.holster) < 1e-9, "holstered at the cue's end, before the idle resumes");
  clock.seconds = 4; frame(sheriff);
  clock.seconds = 4.5; frame(sheriff);
  assert.ok(Math.abs(sheriff.idle.seconds - .5) < 1e-9, "the clip restarted from its first frame");
  assert.equal(scheduler.pending(), 0);

  // Summon: the landing owns the pose; idle starts at the landing's end.
  const {board: other, scheduler: later} = await setup();
  const landing = other.summon({side: "cowboy", slot: 1, cardId: idOf("Sheriff"), health: 3});
  const piece = other.piece("cowboy", 1);
  assert.deepEqual({...landing}, {...SHERIFF_LANDING});
  clock.seconds = 7; frame(piece);
  assert.equal(piece.idle.playing, false);
  run(later, landing.end);
  clock.seconds = 8; frame(piece);
  assert.equal(piece.idle.playing, true);
  assert.equal(later.pending(), 0);
});

test("an attack completed between renders still blends back from its endpoint", async () => {
  const {board, scheduler} = await setup([SHERIFF(), null, null], [{cardId: idOf("Skeleton"), health: 3}, null, null]);
  const piece = board.piece("cowboy", 0);
  clock.seconds = 5; frame(piece);
  clock.seconds = 6.2; frame(piece);
  const cue = withCues(board).attack({attacker: {side: "cowboy", slot: 0}, target: {kind: "troop", side: "wizard", slot: 0}});
  // No render callback observes the attack; one delayed scheduler tick drains the cue.
  scheduler.tick(cue.end + 1000);
  const endpoint = channels(piece);
  assert.equal(piece.acting, false);
  clock.seconds = 20; frame(piece);
  assert.equal(piece.idle.seconds, 0, "the old idle clock must not skip the re-entry blend");
  assert.ok(apart(channels(piece), endpoint) < 1e-9, "the resumed frame preserves the cue endpoint");
  clock.seconds = 20.3; frame(piece);
  assert.ok(apart(channels(piece), endpoint) > .01, "the approved idle advances after the blend");
  assert.equal(scheduler.pending(), 0);
  board.clear();
});

test("losing an orb holds the rest pose for a bounded time, then the idle resumes", async () => {
  const {board, scheduler} = await setup([SHERIFF(), null, null]);
  const sheriff = board.piece("cowboy", 0);
  clock.seconds = 1; frame(sheriff);
  clock.seconds = 2; frame(sheriff);
  assert.equal(sheriff.idle.playing, true);
  board.setTroopOrbs("cowboy", 0, 2);
  frame(sheriff);
  assert.equal(sheriff.idle.playing, false, "no idle through the hit");
  const held = channels(sheriff);
  clock.seconds = 2.2; run(scheduler, 200); frame(sheriff);
  assert.deepEqual(channels(sheriff), held);
  run(scheduler, 401);
  clock.seconds = 3; frame(sheriff);
  assert.equal(sheriff.idle.playing, true);
  // More orbs (a summon's first display or a heal) are not a hit.
  board.setTroopOrbs("cowboy", 0, 3);
  clock.seconds = 4; frame(sheriff);
  assert.equal(sheriff.idle.playing, true);
  assert.equal(scheduler.pending(), 0, "the hold keeps no scheduler entry");
});

test("removal, clear and reset stop playback and leave stale render callbacks inert", async () => {
  const {board, scheduler} = await setup([SHERIFF(), SHERIFF(), SHERIFF()]);
  const [removed, cleared, reset] = [0, 1, 2].map((slot) => board.piece("cowboy", slot));
  const stale = [removed, cleared, reset].map((piece) => piece.actor.body.onBeforeRender);
  for (const piece of [removed, cleared, reset]) { clock.seconds = 1; frame(piece); clock.seconds = 1.7; frame(piece); }

  board.remove({side: "cowboy", slot: 0});
  const frozen = channels(removed);
  clock.seconds = 2.4; stale[0]();
  assert.deepEqual(channels(removed), frozen, "a leaving Sheriff is not animated");
  run(scheduler, 600);
  assert.equal(board.pieces().includes(removed), false);
  assert.equal(removed.idle.playing, false, "destroyed with its mixer");
  clock.seconds = 3; stale[0]();
  assert.equal(removed.idle.playing, false);

  board.clear();
  for (const piece of [cleared, reset]) assert.equal(piece.idle.playing, false);
  clock.seconds = 5; stale[1](); stale[2]();
  assert.equal(cleared.idle.playing, false);
  assert.equal(reset.idle.playing, false);
  assert.equal(scheduler.pending(), 0);

  const view = publicState(createMatch(0), "cowboy");
  view.sides.cowboy.board = [SHERIFF(), null, null];
  board.reset(view);
  const fresh = board.piece("cowboy", 0);
  assert.notEqual(fresh.idle, cleared.idle);
  clock.seconds = 6; stale[1]();
  clock.seconds = 7; frame(fresh);
  assert.equal(fresh.idle.playing, true);
  assert.equal(cleared.idle.playing, false);
  assert.equal(scheduler.pending(), 0);
});
