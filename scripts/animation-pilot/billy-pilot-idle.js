// Preview-only Billy idle: the retargeted Quaternius Pistol_Idle_Loop track data (provenance in
// assets/animations/pilots/billy/billy-pistol-idle.SOURCE.json), played unchanged on Billy's own
// 16 billy_* bones. Each Billy owns one AnimationMixer, so two Billys never share playback state.
// This mirrors src/render/sheriff-sourced-idle.js and the Sheriff's runtime blend; it is not
// imported by any production entry point. No curve is authored here: the only runtime moves are
// the 0.18 s crossfade to/from the existing attack pose and a vertical lift that seats the boots.
import * as T from "three";
import {grip} from "../../src/render/rig.js";
import data from "../../assets/animations/pilots/billy/billy-pistol-idle.json" with {type: "json"};

export const BILLY_IDLE_DURATION = data.duration;
export const BILLY_BLEND_SECONDS = .18;
const ease = (from, to, value) => T.MathUtils.smoothstep(value, from, to);

const makeClip = () => new T.AnimationClip(data.name, data.duration, data.tracks.map(({name, times, values}) =>
  new (name.endsWith(".quaternion") ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack)(name, Float32Array.from(times), Float32Array.from(values))));

// Held-revolver orientation in the actor's frame: the level, forward pitch the existing cue reaches
// when the draw is aimed (src/render/cues.js drawAndFire, -0.08 rad), with no yaw or roll.
const HELD = new T.Quaternion().setFromEuler(new T.Euler(-.08, 0, 0));
// Bind-pose height under which a skinned vertex belongs to a boot (src/render/sheriff.js bootVertices).
const BOOT_Y = .02;

export function createBillyIdle(actor, gun) {
  const {rig, root} = actor, bones = rig.bones, bind = rig.spec.pelvis;
  const mixer = new T.AnimationMixer(root), clip = makeClip(), action = mixer.clipAction(clip);
  const legBones = rig.sides.flatMap((side) => [side.thigh, side.shin, side.foot]);
  const point = new T.Vector3();
  let playing = false, initialized = false, seconds = null, blendIn = null, blendOut = null, outStart = 0, disposed = false;
  // Boot quarters (heel/toe of each foot) found once from the bind geometry, as the Sheriff does.
  const position = actor.body.geometry.getAttribute("position"), boots = [[], [], [], []];
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < BOOT_Y) boots[(position.getX(i) < 0 ? 0 : 2) + (position.getZ(i) < 0 ? 0 : 1)].push(i);
  }
  // Lowest skinned boot vertex of each quarter, world y minus the tile surface (the piece origin the actor stands on).
  function soleClearances() {
    actor.body.updateWorldMatrix(true, false);
    actor.body.skeleton.update();   // bone matrices are otherwise refreshed only at render time
    const ground = point.setFromMatrixPosition(root.parent.matrixWorld).y;   // the tile surface: the piece origin, not the lifted body
    return boots.map((quarter) => {
      let lowest = Infinity;
      for (const i of quarter) lowest = Math.min(lowest, actor.body.getVertexPosition(i, point).applyMatrix4(actor.body.matrixWorld).y);
      return lowest - ground;
    });
  }

  const remember = () => ({
    rotations: bones.map((bone) => bone.quaternion.clone()), hips: rig.pelvis.position.clone(), lift: root.position.y,
    gunPosition: gun.holder.position.clone(), gunQuaternion: gun.holder.quaternion.clone(),
  });
  function resetPose() {
    for (const bone of bones) bone.quaternion.identity();
    rig.pelvis.position.fromArray(bind);
    root.position.y = 0;
  }
  function release() {
    if (!playing) return;
    action.stop();
    resetPose();
    playing = false;
    seconds = null;
  }
  // Called just before the existing attack cue starts: the displayed idle pose is kept for the blend.
  function beginAttack(now) {
    if (disposed) return;
    blendOut = playing ? remember() : null;
    blendIn = null;
    outStart = now;
    release();
  }
  // Idle at `time` seconds since it began. `now` is the page clock in seconds.
  function play(time) {
    if (disposed) return;
    if (!playing) {
      blendIn = initialized ? remember() : null;
      action.reset().play();
      playing = true;
    }
    initialized = true;
    mixer.setTime(time);
    seconds = time;
    root.position.y = 0;
    root.updateMatrixWorld(true);
    // Seat the boots: lift just enough that the lowest skinned boot vertex touches the tile (+3 mm, as the Sheriff).
    root.position.y = -Math.min(...soleClearances()) + .003;
    if (blendIn) {
      const remaining = 1 - ease(0, BILLY_BLEND_SECONDS, time);
      bones.forEach((bone, i) => bone.quaternion.slerp(blendIn.rotations[i], remaining));
      rig.pelvis.position.lerp(blendIn.hips, remaining);
      root.position.y = T.MathUtils.lerp(root.position.y, blendIn.lift, remaining);
    }
    root.updateMatrixWorld(true);
    // Rigid prop attachment: the revolver rides the right-hand grip point at the held orientation.
    gun.holder.position.copy(grip(actor, "right"));
    gun.holder.quaternion.copy(HELD);
    if (blendIn) {
      const remaining = 1 - ease(0, BILLY_BLEND_SECONDS, time);
      gun.holder.position.lerp(blendIn.gunPosition, remaining);
      gun.holder.quaternion.slerp(blendIn.gunQuaternion, remaining);
    }
    root.updateMatrixWorld(true);
    if (time >= BILLY_BLEND_SECONDS) blendIn = null;
  }
  // During the existing cue: fade the remembered idle pose out over its first 0.18 s. The cue
  // rewrites torso, arms and head every tick; the legs and hips are written here from absolute
  // values so nothing compounds.
  function fadeOut(now) {
    if (!blendOut) return;
    const t = now - outStart, remaining = 1 - ease(0, BILLY_BLEND_SECONDS, t);
    bones.forEach((bone, i) => {
      if (legBones.includes(bone)) bone.quaternion.identity().slerp(blendOut.rotations[i], remaining);
      else bone.quaternion.slerp(blendOut.rotations[i], remaining);
    });
    rig.pelvis.position.fromArray(bind).lerp(blendOut.hips, remaining);
    root.position.y = blendOut.lift * remaining;
    gun.holder.position.lerp(blendOut.gunPosition, remaining);
    gun.holder.quaternion.slerp(blendOut.gunQuaternion, remaining);
    if (t >= BILLY_BLEND_SECONDS) blendOut = null;
    root.updateMatrixWorld(true);
  }
  function dispose() {
    release();
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    mixer.uncacheClip(clip);
    disposed = true;
  }
  return {play, release, soleClearances, beginAttack, fadeOut, dispose, resetPose, get playing() {return playing;}, get seconds() {return seconds;}, get disposed() {return disposed;}, clip, mixer};
}
