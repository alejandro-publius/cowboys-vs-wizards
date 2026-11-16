// The Sheriff piece: assets/models/sheriff.glb (a static Tripo mesh) on the
// procedural rig in rig.js, holding the shared revolver. Everything here is a
// pure pose function of time; match-board.js and cues.js decide when to call
// them. Seconds are cue seconds, points are in the rig frame (height 1, feet
// at y = 0, facing +z) unless a comment says otherwise.
import * as T from "three";
import {attachPistol, v} from "./scene.js";
import {grip, pose, rigActor} from "./rig.js";

const ease = (from, to, value) => T.MathUtils.smoothstep(value, from, to);
const pulse = (t, from, peak, to) => ease(from, peak, t) * (1 - ease(peak, to, t));
const mix = T.MathUtils.lerp;
const X = v(1, 0, 0), FORWARD = v(0, 0, 1);

// World height on the board. Billy is 1.93, so the two-star Sheriff stands shorter.
export const SHERIFF_HEIGHT = 1.62;
// Turned to face the Wizards, like Billy.
export const SHERIFF_YAW = Math.PI;
// Draw, fire and recover: the shot leaves at `shot`, the target is hit at `impact`.
export const SHERIFF_SHOT = Object.freeze({grab: .34, aimed: .8, shot: .95, impact: 1.04, holstered: 1.6, end: 1.85});
// Summon: the boots touch the tile at `impact`, the Sheriff is upright at `end`.
export const SHERIFF_LANDING = Object.freeze({impact: 350, end: 900});

const HOLSTERED = [1.38, -.15, .066];
const REVOLVER_SIZE = .27;
const REST_WRIST = [-.335, .435, .06];
// The revolver hangs at the right hip; the hand closes on it there.
const HOLSTER = [-.2, .44, .005];
const HOLSTER_WRIST = [-.25, .485, 0];
const AIM_WRIST = [-.168, .6, .22];
// [second, right wrist goal, elbow bend]
const DRAW = [
  [0, REST_WRIST, 0], [.3, HOLSTER_WRIST, .55], [.42, HOLSTER_WRIST, .55], [.62, [-.24, .53, .1], .8],
  [.8, AIM_WRIST, .5], [.95, [-.166, .604, .222], .5], [1.02, [-.176, .668, .15], .62], [1.26, [-.172, .6, .2], .5],
  [1.6, HOLSTER_WRIST, .55], [1.85, REST_WRIST, 0],
];

function arm(keys, t) {
  const found = keys.findIndex(([time]) => time >= t);
  const i = found < 0 ? keys.length - 1 : Math.max(1, found);
  const [start, first, bend1] = keys.at(i - 1), [end, last, bend2] = keys.at(i);
  const u = ease(start, end, t);
  return {goal: v(...first).lerp(v(...last), u), bend: mix(bend1, bend2, u), roll: [0, 0, 0], follow: true};
}

// Bends both knees by `bend` radians and lowers the hips by what the legs
// lose, so the soles stay where they were.
function legs(actor, bend) {
  const {rig} = actor, [side] = rig.sides;
  const knee = side.shin.position, ankle = side.foot.position;
  const drop = knee.clone().add(ankle).sub(knee.clone().applyAxisAngle(X, -bend)).sub(ankle.clone().applyAxisAngle(X, bend));
  rig.pelvis.position.fromArray(rig.spec.pelvis).add(drop.setX(0));
  return rig.sides.map(() => ({thigh: [-bend, 0, 0], shin: [2 * bend, 0, 0], foot: [-bend, 0, 0]}));
}

// The holstered revolver rides on the hips, so it sinks with them in a crouch.
function holster({actor, gun, holster: at}) {
  gun.holder.position.copy(actor.rig.pelvis.position).sub(v(...actor.rig.spec.pelvis)).add(at);
  gun.holder.rotation.set(...HOLSTERED);
}

// Idle: slow breathing and a small sway. `seconds` is any running clock.
export function idleSheriff(piece, seconds) {
  const {actor} = piece;
  const breath = Math.sin(seconds * 1.9), sway = Math.sin(seconds * .83);
  actor.root.rotation.y = SHERIFF_YAW;
  pose(actor, {
    spine: [.012 * breath, .02 * sway, 0],
    chest: [.022 * breath, 0, 0],
    head: [-.02 * breath, .05 * sway, 0],
    right: {goal: v(REST_WRIST[0] + .004 * breath, REST_WRIST[1] + .007 * breath, REST_WRIST[2]), bend: 0, roll: [0, 0, 0], follow: true},
    left: {goal: v(-REST_WRIST[0] - .004 * breath, REST_WRIST[1] + .007 * breath, REST_WRIST[2]), bend: 0, roll: [0, 0, 0], follow: true},
    legs: legs(actor, 0),
  });
  holster(piece);
}

// Summon landing at `ms` from the call. Returns the body's height above the
// tile in world units and its scale; the caller applies them to the piece.
export function landSheriff(piece, ms) {
  const {actor} = piece, {impact, end} = SHERIFF_LANDING;
  const fall = Math.min(1, ms / impact);
  const since = (ms - impact) / (end - impact);
  // Knees give on contact, then push back up with a small overshoot.
  const crouch = ms < impact ? .2 * fall : .2 + .5 * pulse(since, 0, .16, .8);
  const settle = ms < impact ? 0 : pulse(since, 0, .16, .8);
  const flare = ms < impact ? fall : 1 - ease(0, .55, since);
  actor.root.rotation.y = SHERIFF_YAW;
  const wrist = (sign) => v(sign * (-REST_WRIST[0] + .02 * flare), REST_WRIST[1] + .12 * flare - .03 * settle, REST_WRIST[2] + .03 * settle);
  pose(actor, {
    spine: [.2 * settle, 0, 0],
    chest: [.14 * settle - .06 * flare, 0, 0],
    head: [-.16 * settle, 0, 0],
    right: {goal: wrist(-1), bend: .3 * flare, roll: [0, 0, 0], follow: true},
    left: {goal: wrist(1), bend: .3 * flare, roll: [0, 0, 0], follow: true},
    legs: legs(actor, crouch),
  });
  holster(piece);
  return {height: 1.5 * (1 - fall * fall), scale: Math.max(.001, ease(0, .3, fall))};
}

// Draw, fire and recover at second t, turned by `turn` radians toward the
// target and aiming at `aim`, a world point.
export function drawSheriff(piece, t, turn, aim) {
  const {actor, gun} = piece, {grab, aimed, shot, holstered, end} = SHERIFF_SHOT;
  const anticipate = pulse(t, .02, .3, .66), kick = pulse(t, shot, shot + .06, 1.3);
  const level = ease(grab + .08, aimed, t) * (1 - ease(1.3, holstered, t));
  actor.root.rotation.y = SHERIFF_YAW + turn * ease(.1, .6, t) * (1 - ease(1.4, end, t));
  pose(actor, {
    // Sinks and coils toward the holster, then squares up behind the gun arm.
    spine: [.1 * anticipate + .05 * level - .12 * kick, -.2 * anticipate + .24 * level, 0],
    chest: [.06 * anticipate - .16 * kick, -.1 * anticipate + .2 * level, 0],
    head: [.08 * anticipate + .05 * kick, .3 * anticipate - .42 * level, 0],
    right: arm(DRAW, t),
    left: {goal: v(-REST_WRIST[0] - .05 * level + .02 * kick, REST_WRIST[1] + .03 * anticipate + .02 * kick, REST_WRIST[2] - .09 * level), bend: .4 * level, roll: [0, 0, 0], follow: true},
    legs: legs(actor, .26 * anticipate + .1 * level - .05 * kick),
  });
  holster(piece);
  if (t < grab || t > holstered) return;
  // Leaves the hip with the hand and is slid back in at the end.
  gun.holder.position.lerp(grip(actor, "right"), ease(grab, grab + .1, t) * (1 - ease(holstered - .1, holstered, t)));
  gun.holder.rotation.set(mix(HOLSTERED[0], -.03, level) - .55 * kick, HOLSTERED[1] * (1 - level), HOLSTERED[2] * (1 - level));
  // On the target from the end of the draw until the shot has left.
  const onTarget = ease(aimed - .12, aimed, t) * (1 - ease(shot + .02, shot + .08, t));
  if (onTarget > 0) {
    const toward = actor.root.worldToLocal(aim.clone()).sub(gun.holder.position).normalize();
    gun.holder.quaternion.slerp(new T.Quaternion().setFromUnitVectors(FORWARD, toward), onTarget);
  }
}

// The actor, its revolver and the holster point for a board piece.
export function buildSheriff(models) {
  const actor = rigActor(models.sheriff, "sheriff", SHERIFF_HEIGHT);
  actor.root.rotation.y = SHERIFF_YAW;
  const gun = attachPistol(actor, models.revolver, REVOLVER_SIZE);
  const piece = {actor, gun, holster: v(...HOLSTER)};
  idleSheriff(piece, 0);
  return piece;
}
