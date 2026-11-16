// The Wizard piece's motion on the match board: assets/models/wizard.glb on
// the procedural rig (rig.js) with the code-built staff (attachStaff in
// scene.js) on its left hand bone. Pure pose functions of time; cues.js and
// match-board.js decide when to call them. The attack demo keeps its own
// cast in scene.js. Points are in the rig frame (height 1, feet at y = 0,
// facing +z); seconds are cue seconds.
import * as T from "three";
import {attachStaff, v} from "./scene.js";
import {pose, rigActor} from "./rig.js";

const ease = (from, to, value) => T.MathUtils.smoothstep(value, from, to);
const mix = T.MathUtils.lerp;

// World height on the board, as in the attack demo.
export const WIZARD_HEIGHT = 2.02;
// How far the staff sits lower in the fist than in the demo, along its own
// axis, so that its foot rests on the tile in the idle pose (it hung 0.09 above).
export const STAFF_DROP = .09;
// Jewel emissive at rest, and what a full charge adds.
const IDLE_GLOW = .81, CHARGE_GLOW = 3.2;

// When each cast raises the staff, starts the thrust, releases, and starts and
// ends the recovery. `release` and `end` are the match cue times in cues.js.
export const WIZARD_CAST = Object.freeze({
  bolt: Object.freeze({raised: .5, thrust: .72, release: .9, settle: 1.1, end: 1.6}),
  singularity: Object.freeze({raised: .38, thrust: .6, release: .8, settle: .88, end: 1.2}),
});

// Staff hand: wrist goal, elbow bend and hand roll (the hand carries the staff).
// REST is the demo's idle: the staff upright with its foot by the left boot.
const REST = {goal: [.263, .43, .125], bend: .79, roll: [-1.475, .06, -.14]};
// Wind-up: the staff lifted off the ground and tipped back over the shoulder,
// as far as it goes before the shaft reaches the hat brim.
const RAISED = {goal: [.235, .56, .09], bend: .8, roll: [-1.86, .1, -.2]};
// Release: the jewel swung forward and down at the target. 49 degrees from
// upright is as far as the staff tips before its lower half enters the sleeve cuff.
const THRUST = {goal: [.26, .44, .2], bend: .6, roll: [-1, 0, .2]};
// Free hand: gathers in front during the wind-up, is thrown back at the release.
const FREE_REST = [-.278, .397, .072], FREE_GATHER = [-.2, .5, .2], FREE_BACK = [-.31, .45, -.07];

const blend = (rest, a, b, raise, out) => rest.map((value, i) => value + (a[i] - value) * raise + (b[i] - value) * out);

// The pose for a staff that is `raise` of the way into the wind-up and `out`
// of the way into the thrust (both 0 to 1; 0 and 0 is the idle pose), with a
// small idle `nod` and `sway`, turned by `turn` radians.
function staffPose({actor, staff}, raise, out, turn = 0, nod = 0, sway = 0) {
  actor.root.rotation.y = turn;
  pose(actor, {
    // Coils back over the staff side, then leans in behind the thrust.
    spine: [.008 - .09 * raise + .17 * out, .12 * raise - .14 * out, 0],
    chest: [-.05 * raise + .11 * out, .08 * raise - .12 * out, 0],
    head: [.03 * raise - .12 * out + .025 * nod, -.2 * raise + .26 * out + .05 * sway, 0],
    left: {goal: v(...blend(REST.goal, RAISED.goal, THRUST.goal, raise, out)), bend: mix(mix(REST.bend, RAISED.bend, raise), THRUST.bend, out),
      roll: blend(REST.roll, RAISED.roll, THRUST.roll, raise, out)},
    right: {goal: v(...blend(FREE_REST, FREE_GATHER, FREE_BACK, raise, out)).add(v(0, .006 * nod, .01 * sway)), bend: .5 * Math.min(1, raise + out), roll: [0, 0, 0], follow: true},
  });
  staff.jewel.material.emissiveIntensity = IDLE_GLOW;
}

// Idle: the staff stays planted; the head nods, the free hand drifts and the
// jewel pulses. `seconds` counts from the moment the idle began.
export function idleWizard(piece, seconds) {
  const nod = Math.sin(seconds * 1.7), sway = Math.sin(seconds * .9);
  staffPose(piece, 0, 0, 0, nod, sway);
  piece.staff.jewel.material.emissiveIntensity = IDLE_GLOW + .25 * (1 - Math.cos(seconds * 1.7));
}

// One cast at second t with the phase times of WIZARD_CAST.bolt or
// .singularity, turned by `turn` toward the target. Returns the charge in
// the jewel, 0 to 1: it builds through the wind-up and empties at the release.
export function castWizard(piece, t, turn, {raised, thrust, release, settle, end}) {
  // The thrust ends just after the release, so the jewel is still moving toward
  // the target when the bolt leaves it.
  const wind = ease(.03, raised, t), strike = ease(thrust, release + .05, t), recover = ease(settle, end, t);
  const charge = wind * (1 - ease(release, release + .12, t));
  staffPose(piece, wind * (1 - strike), strike * (1 - recover), turn * ease(0, raised, t) * (1 - recover));
  piece.staff.jewel.material.emissiveIntensity = IDLE_GLOW + CHARGE_GLOW * charge;
  return charge;
}

// The actor and its staff for a board piece, in the idle pose.
export function buildWizard(models) {
  const actor = rigActor(models.wizard, "wizard", WIZARD_HEIGHT), staff = attachStaff(actor);
  staff.holder.position.z -= STAFF_DROP; // the staff's axis is the hand bone's z
  const piece = {actor, staff};
  idleWizard(piece, 0);
  return piece;
}
