// The Sheriff's standing idle: the user-approved Mixamo headShake track data
// (assets/animations/sheriff-headShake.json, provenance in its .SOURCE.json), played
// unchanged on the Sheriff's own 16 sheriff_* bones. Each Sheriff owns one AnimationMixer
// and its own clip, so two Sheriffs never share playback state. The clip drives every bone
// rotation and the hips position, so release() puts all of them back to the bind pose before
// a procedural cue (draw, landing) writes its own.
import * as T from "three";
import data from "../../assets/animations/sheriff-headShake.json" with {type: "json"};

export const SHERIFF_IDLE_DURATION = data.duration;

const makeClip = () => new T.AnimationClip(data.name, data.duration, data.tracks.map(({name, times, values}) =>
  new (name.endsWith(".quaternion") ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack)(name, Float32Array.from(times), Float32Array.from(values))));

export function createSheriffIdle(actor) {
  const {rig, root} = actor, bones = rig.bones;
  const mixer = new T.AnimationMixer(root), clip = makeClip(), action = mixer.clipAction(clip);
  const bind = rig.spec.pelvis;
  let playing = false, initialized = false, seconds = null;

  // Clip pose at `time` (it repeats every SHERIFF_IDLE_DURATION).
  function play(time) {
    if (!playing) {
      action.reset().play();
      playing = true;
    }
    initialized = true;
    mixer.setTime(time);
    seconds = time;
  }

  // Stops playback and restores every channel the clip owns, so no source rotation or hips
  // translation can leak into a cue. Harmless when not playing.
  function release() {
    if (!playing) return;
    action.stop();
    resetPose();
    playing = false;
    seconds = null;
  }

  // A blend may leave source channels in the displayed pose after playback stops.
  // Restore those channels before evaluating the next frame of an existing cue.
  function resetPose() {
    for (const bone of bones) bone.quaternion.identity();
    rig.pelvis.position.fromArray(bind);
    root.position.y = 0;
  }

  function dispose() {
    release();
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    mixer.uncacheClip(clip);
  }

  return {play, release, resetPose, dispose, get initialized() {return initialized;}, get playing() {return playing;}, get seconds() {return seconds;}, clip};
}
