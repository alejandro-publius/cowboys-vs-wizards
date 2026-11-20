// Preview-only Billy motion v3: retargeted Quaternius Pistol_Idle_Loop and Pistol_Shoot played unchanged
// on Billy's 16 billy_* bones (provenance in assets/animations/pilots/billy/*.SOURCE.json). Each Billy
// owns one AnimationMixer. Allowed operations only: playback retiming (one global time scale for the
// shoot clip), 0.18 s crossfades between the two source clips, a vertical lift that seats the boots, and
// a rigid revolver attachment to the right hand bone. No key, pose or curve is authored here.
// The rigid offset is the only chosen constant: the revolver's orientation relative to the hand bone
// is fixed once, from the first retargeted Pistol_Shoot key, so the barrel points along the actor's
// forward axis there. After that the gun is a rigid child of the hand: position = the existing grip point
// (src/render/rig.js grip), rotation = hand bone rotation * that constant.
import * as T from "three";
import idleData from "../../assets/animations/pilots/billy/billy-pistol-idle.json" with {type: "json"};
import shootData from "../../assets/animations/pilots/billy/billy-pistol-shoot.json" with {type: "json"};

export const FADE_SECONDS = .18;
export const SHOOT_TIME_SCALE = .5;                       // global retiming of the whole shoot clip
export const IDLE_DURATION = idleData.duration;
export const SHOOT_DURATION = shootData.duration / SHOOT_TIME_SCALE;
const BOOT_Y = .02;                                       // bind-pose height under which a skinned vertex is a boot (sheriff.js bootVertices)

const makeClip = (data) => new T.AnimationClip(data.name, data.duration, data.tracks.map(({name, times, values}) =>
  new (name.endsWith(".quaternion") ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack)(name, Float32Array.from(times), Float32Array.from(values))));

export function createBillyMotion(actor, gun) {
  const {rig, root} = actor, bones = rig.bones, bind = rig.spec.pelvis, byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  const mixer = new T.AnimationMixer(root);
  const idleClip = makeClip(idleData), shootClip = makeClip(shootData);
  const idle = mixer.clipAction(idleClip), shoot = mixer.clipAction(shootClip);
  idle.setLoop(T.LoopRepeat, Infinity);
  shoot.setLoop(T.LoopOnce, 1); shoot.clampWhenFinished = true; shoot.timeScale = SHOOT_TIME_SCALE;
  const point = new T.Vector3(), handQ = new T.Quaternion(), rootQ = new T.Quaternion();
  const rightHand = rig.sides[0].hand;
  let state = "idle", shootAt = null, recoverAt = null, clock = 0, disposed = false;

  // Constant rigid offset (hand bone -> gun), fixed from key 0 of the shoot clip.
  for (const t of shootData.tracks) {
    const [name, path] = t.name.split(".");
    if (path === "quaternion") byName[name].quaternion.fromArray(t.values, 0); else byName[name].position.fromArray(t.values, 0);
  }
  root.updateMatrixWorld(true);
  const forward = new T.Quaternion();                     // the actor's own forward, in the root frame
  rightHand.getWorldQuaternion(handQ);
  root.getWorldQuaternion(rootQ);
  const gunOffset = handQ.clone().invert().multiply(rootQ).multiply(forward.identity());
  for (const bone of bones) bone.quaternion.identity();
  rig.pelvis.position.fromArray(bind);
  root.updateMatrixWorld(true);

  // Boot quarters (heel/toe of each foot) from the bind geometry, as the Sheriff does.
  const position = actor.body.geometry.getAttribute("position"), boots = [[], [], [], []];
  for (let i = 0; i < position.count; i++) if (position.getY(i) < BOOT_Y) boots[(position.getX(i) < 0 ? 0 : 2) + (position.getZ(i) < 0 ? 0 : 1)].push(i);
  function soleClearances() {
    actor.body.updateWorldMatrix(true, false);
    actor.body.skeleton.update();
    const ground = point.setFromMatrixPosition(root.parent.matrixWorld).y;
    return boots.map((quarter) => {
      let lowest = Infinity;
      for (const i of quarter) lowest = Math.min(lowest, actor.body.getVertexPosition(i, point).applyMatrix4(actor.body.matrixWorld).y);
      return lowest - ground;
    });
  }

  function attachGun() {
    root.updateMatrixWorld(true);
    gun.holder.position.copy(root.worldToLocal(rightHand.localToWorld(rig.sides[0].palm.clone().sub(rig.sides[0].wrist))));
    rightHand.getWorldQuaternion(handQ);
    root.getWorldQuaternion(rootQ);
    gun.holder.quaternion.copy(rootQ.invert().multiply(handQ).multiply(gunOffset));
    root.updateMatrixWorld(true);
  }

  idle.play();
  // Advance this actor's own mixer by dt seconds, then seat the boots and attach the revolver.
  function update(dt) {
    if (disposed) return;
    clock += dt;
    mixer.update(dt);
    if (state === "shoot" && clock - shootAt >= SHOOT_DURATION - FADE_SECONDS) {
      idle.reset().play();
      shoot.crossFadeTo(idle, FADE_SECONDS, false);
      state = "recover"; recoverAt = clock;
    } else if (state === "recover" && clock - shootAt >= SHOOT_DURATION) {
      shoot.stop(); state = "idle";
    }
    root.position.y = 0;
    root.updateMatrixWorld(true);
    root.position.y = -Math.min(...soleClearances()) + .003;
    attachGun();
  }
  function fire() {
    if (disposed || state !== "idle") return false;
    shoot.reset().play();
    idle.crossFadeTo(shoot, FADE_SECONDS, false);
    state = "shoot"; shootAt = clock;
    return true;
  }
  function dispose() {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    mixer.uncacheClip(idleClip);
    mixer.uncacheClip(shootClip);
    disposed = true;
  }
  const weights = () => ({idle: +idle.getEffectiveWeight().toFixed(3), shoot: +shoot.getEffectiveWeight().toFixed(3)});
  return {update, fire, dispose, soleClearances, weights, setIdlePhase(seconds) {idle.time = seconds;},
    get state() {return state;}, get disposed() {return disposed;}, get idleSeconds() {return idle.time;}, get shootSeconds() {return shoot.time;},
    get clock() {return clock;}, get shootAt() {return shootAt;}, mixer, gunOffset};
}
