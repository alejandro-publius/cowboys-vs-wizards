// When Firebolt hits, the target freezes, tucks its chin toward one foot,
// throws both arms up one after the other, scans to the other foot and
// recovers. Rigged actors are posed as the idle's rest pose plus an overlay,
// so nothing accumulates and the idle resumes from the pose this ends in.
// Pieces without a head/arm rig squash and glance both ways on piece.body,
// whose pivot is the tile, so the feet stay put. piece.root is never moved.
import * as T from "three";
import {pose} from "./rig.js";
import {idleSheriff} from "./sheriff.js";
import {idleWizard} from "./wizard.js";

const ease = (u, from, to) => T.MathUtils.smoothstep(u, from, to);
const turn = new T.Quaternion(), euler = new T.Euler(), squash = new T.Vector3();
// piece -> the body transform a running reaction returns to
const resting = new WeakMap();

// The glance: 0 to 1 while looking down, and which foot (1 left, -1 right).
const glance = (u) => [ease(u, .14, .34) * (1 - ease(u, .78, 1)), 1 - 2 * ease(u, .5, .72)];

function poseRigged(piece, rest, u) {
  if (piece.kind === "sheriff") idleSheriff(piece, 0);
  else if (piece.kind === "wizard") idleWizard(piece, 0);
  else pose(piece.actor, {});
  const {rig} = piece.actor, [look, foot] = glance(u);
  rig.spine.rotation.x += .05 * look;
  rig.chest.rotation.x += .1 * look;
  rig.head.rotation.x += .42 * look;
  rig.head.rotation.y += .36 * foot * look;
  rig.sides.forEach((arm, i) => {
    // The right arm leads; the Wizard's staff arm only twitches so the staff stays near the ground.
    const start = .24 + .09 * i;
    const lift = ease(u, start, start + .2) * (1 - ease(u, .76, .98)) * (piece.staff && i ? .25 : 1);
    arm.upper.quaternion.premultiply(turn.setFromEuler(euler.set(-.3 * lift, 0, .85 * arm.sign * lift)));
    arm.fore.quaternion.premultiply(turn.setFromEuler(euler.set(-1.1 * lift, 0, 0)));
  });
  const carry = 1 - ease(u, 0, .14);
  if (carry > 0) rig.bones.forEach((bone, i) => bone.quaternion.slerp(rest.bones[i], carry));
}

function poseStatic({body}, rest, u) {
  const [look, foot] = glance(u), recoil = ease(u, .12, .26) * (1 - ease(u, .76, 1));
  body.rotation.set(rest.rotation.x, rest.rotation.y + .24 * foot * look, rest.rotation.z + .05 * foot * look);
  body.scale.copy(rest.scale).multiply(squash.set(1 + .03 * recoil, 1 - .07 * recoil, 1 + .03 * recoil));
}

export function reactToFire(board, piece, duration, delay = 0) {
  const {body} = piece;
  let rest = null;
  // Book the entire cue with the spell. Recovery then finishes before the
  // presenter advances, even if one frame skips across the impact.
  board.animate(delay + duration, (_, elapsed) => {
    if (elapsed < delay || board.piece(piece.side, piece.slot) !== piece) return;
    if (!rest) {
      const previous = resting.get(piece);
      if (piece.acting && !previous) return;
      if (previous) {
        body.rotation.copy(previous.rotation);
        body.scale.copy(previous.scale);
      }
      rest = {
        rotation: body.rotation.clone(),
        scale: body.scale.clone(),
        bones: piece.actor?.rig.bones.map(bone => bone.quaternion.clone()),
      };
      resting.set(piece, rest);
      piece.acting = true;
    }
    if (resting.get(piece) !== rest) return;
    const progress = (elapsed - delay) / duration;
    if (piece.actor) poseRigged(piece, rest, progress);
    else poseStatic(piece, rest, progress);
  }, () => {
    if (!rest || resting.get(piece) !== rest) return;
    resting.delete(piece);
    piece.acting = false;
  });
}
