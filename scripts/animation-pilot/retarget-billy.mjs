// Bind-space retarget of one upstream clip onto Billy's existing 16-bone rig (src/render/rig.js).
// No curve is authored here. Every output rotation is computed from the source skeleton's own
// animated joint positions and rotations, converted into Billy's rig frame (rest direction ->
// source direction swing, plus the source's own twist about the bone). Billy's pelvis position
// is the source pelvis offset scaled by the leg-length ratio. Nothing is smoothed or edited.
//
// Usage: node scripts/animation-pilot/retarget-billy.mjs <UAL1_Standard.glb> <clipName> <out.json>
// Reads the GLB only; never writes next to it. Prints the report the receipt quotes.
import {readFileSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import * as T from "three";
import {rigActor} from "../../src/render/rig.js";
import {readGlb} from "../extract-approved-sheriff-clip.mjs";

const [glbPath, clipName, outPath] = process.argv.slice(2);
if (!outPath) { console.error("usage: retarget-billy.mjs <glb> <clipName> <out.json>"); process.exit(2); }
const bytes = readFileSync(glbPath);
const {json, accessor} = readGlb(bytes);
const animation = json.animations.find((a) => a.name === clipName);
if (!animation) throw new Error(`clip ${clipName} not in ${glbPath}`);

// ---- source skeleton -------------------------------------------------------------------------
const nodes = json.nodes.map((n) => {
  const o = new T.Object3D();
  o.name = n.name;
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  return o;
});
json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => nodes[i].add(nodes[c])));
const sceneRoot = new T.Group();
for (const i of json.scenes[0].nodes) sceneRoot.add(nodes[i]);
const src = Object.fromEntries(nodes.map((o) => [o.name, o]));

const tracks = new Map();
let times = null;
for (const ch of animation.channels) {
  const s = animation.samplers[ch.sampler], t = accessor(s.input), values = accessor(s.output);
  if (s.interpolation !== "LINEAR") throw new Error("only LINEAR samplers supported");
  if (times && (t.length !== times.length)) throw new Error("tracks do not share key times");
  times = t;
  tracks.set(`${nodes[ch.target.node].name}.${ch.target.path}`, values);
}
function applyFrame(i) {
  for (const [key, values] of tracks) {
    const [name, path] = key.split(".");
    if (path === "rotation") src[name].quaternion.fromArray(values, i * 4);
    else if (path === "translation") src[name].position.fromArray(values, i * 3);
    else if (path === "scale") src[name].scale.fromArray(values, i * 3);
  }
  sceneRoot.updateMatrixWorld(true);
}
const wpos = (name) => src[name].getWorldPosition(new T.Vector3());
const wquat = (name) => src[name].getWorldQuaternion(new T.Quaternion());

// ---- rest of the source, and the source -> Billy rig frame -------------------------------------
const restQuat = {}, restPos = {};
sceneRoot.updateMatrixWorld(true);
// rest world positions/orientations come from the node rest TRS, before any frame is applied
const jointNames = Object.keys(src);
for (const n of jointNames) { restQuat[n] = wquat(n); restPos[n] = wpos(n); }
// Source forward = from heel joint to ball joint on a rest foot; rig forward is +z.
const fwd = restPos.ball_l.clone().sub(restPos.foot_l).setY(0).normalize();
const F = new T.Quaternion().setFromUnitVectors(fwd, new T.Vector3(0, 0, 1)); // yaw only
const toRig = (p) => p.clone().applyQuaternion(F);
const FQ = (q) => F.clone().multiply(q).multiply(F.clone().invert()); // rotation conjugated into rig frame

// ---- Billy rig rest (built by the production rigActor on a stand-in mesh; height 1) ----------
const stand = new T.Group();
stand.add(new T.Mesh(new T.BoxGeometry(.5, 1, .3), new T.MeshBasicMaterial()));
const actor = rigActor(stand, "billy", 1);
actor.root.updateMatrixWorld(true);
const rig = actor.rig;
const rigPos = (bone) => bone.getWorldPosition(new T.Vector3());
const restDir = (a, b) => rigPos(b).sub(rigPos(a)).normalize();

// Which source side lands on which rig side: match by the sign of x after the frame change.
const sideOf = (sign) => (toRig(restPos.upperarm_l).x * sign > 0 ? "l" : "r");
const [rightSuffix, leftSuffix] = [sideOf(-1), sideOf(1)];
if (rightSuffix === leftSuffix) throw new Error("could not tell left from right");

// One entry per rig bone: how its world rotation is derived.
//   from/to  : source joints whose rig-frame direction the rig bone must point along
//   rigTo    : the rig bone/point the rig bone points at (rest)
//   delta    : source joint whose rest-relative world rotation is copied (no direction available)
const [rightSide, leftSide] = rig.sides;
const plan = [
  {bone: rig.pelvis, parent: null, delta: "pelvis"},
  {bone: rig.spine, parent: rig.pelvis, from: "spine_01", to: "spine_03", rigDir: restDir(rig.spine, rig.chest), twist: "spine_01"},
  {bone: rig.chest, parent: rig.spine, from: "spine_03", to: "neck_01", rigDir: restDir(rig.chest, rig.head), twist: "spine_03"},
  {bone: rig.head, parent: rig.chest, delta: "Head"},
];
for (const [side, sfx] of [[rightSide, rightSuffix], [leftSide, leftSuffix]]) {
  const palm = side.hand.getWorldPosition(new T.Vector3()).add(side.palm.clone().sub(side.wrist));
  plan.push(
    {bone: side.upper, parent: rig.chest, from: `upperarm_${sfx}`, to: `lowerarm_${sfx}`, rigDir: restDir(side.upper, side.fore), twist: `upperarm_${sfx}`},
    {bone: side.fore, parent: side.upper, from: `lowerarm_${sfx}`, to: `hand_${sfx}`, rigDir: restDir(side.fore, side.hand), twist: `lowerarm_${sfx}`},
    {bone: side.hand, parent: side.fore, from: `hand_${sfx}`, to: `middle_01_${sfx}`, rigDir: palm.sub(rigPos(side.hand)).normalize(), twist: `hand_${sfx}`},
    {bone: side.thigh, parent: rig.pelvis, from: `thigh_${sfx}`, to: `calf_${sfx}`, rigDir: restDir(side.thigh, side.shin), twist: `thigh_${sfx}`},
    {bone: side.shin, parent: side.thigh, from: `calf_${sfx}`, to: `foot_${sfx}`, rigDir: restDir(side.shin, side.foot), twist: `calf_${sfx}`},
    {bone: side.foot, parent: side.shin, delta: `foot_${sfx}`},
  );
}

// Source twist about its own bone axis between rest and this frame, as an angle.
function twistAngle(name, to) {
  const d0 = restPos[to].clone().sub(restPos[name]).normalize();
  const d1 = wpos(to).sub(wpos(name)).normalize();
  const swing = new T.Quaternion().setFromUnitVectors(d0, d1);
  const delta = wquat(name).multiply(restQuat[name].clone().invert());
  const twist = swing.invert().multiply(delta);
  const axis = new T.Vector3(twist.x, twist.y, twist.z);
  return 2 * Math.atan2(axis.dot(d0), twist.w);
}

// ---- walk the frames ---------------------------------------------------------------------------
const keyCount = times.length;
const out = new Map(plan.map((p) => [p.bone.name, new Float32Array(keyCount * 4)]));
const hipPos = new Float32Array(keyCount * 3);
const ankleRef = (restFrame) => (toRig(wpos("foot_l")).y + toRig(wpos("foot_r")).y) / 2;
applyFrame(0);
const hipY0 = toRig(wpos("pelvis")).y, ankleY0 = ankleRef(), hipXZ0 = toRig(wpos("pelvis"));
const rigHip = rigPos(rig.pelvis), rigAnkleY = (rigPos(rightSide.foot).y + rigPos(leftSide.foot).y) / 2;
const scale = (rigHip.y - rigAnkleY) / (hipY0 - ankleY0);
for (let i = 0; i < keyCount; i++) {
  applyFrame(i);
  const world = new Map();
  for (const p of plan) {
    let q;
    if (p.delta) q = FQ(wquat(p.delta).multiply(restQuat[p.delta].clone().invert()));
    else {
      const want = toRig(wpos(p.to).sub(wpos(p.from))).normalize();
      q = new T.Quaternion().setFromUnitVectors(p.rigDir, want)
        .multiply(new T.Quaternion().setFromAxisAngle(p.rigDir, twistAngle(p.twist, p.to)));
    }
    world.set(p.bone, q);
    const local = (p.parent ? world.get(p.parent).clone().invert() : new T.Quaternion()).multiply(q);
    local.normalize().toArray(out.get(p.bone.name), i * 4);
  }
  const hip = toRig(wpos("pelvis"));
  hipPos[i * 3] = rigHip.x + scale * (hip.x - hipXZ0.x);
  hipPos[i * 3 + 1] = rigAnkleY + scale * (hip.y - ankleY0);
  hipPos[i * 3 + 2] = rigHip.z + scale * (hip.z - hipXZ0.z);
}

// The rig expresses a bone's position relative to its parent; the pelvis has none.
const data = {
  name: `${clipName}_retargeted_billy`, duration: times.at(-1),
  units: "Billy rig frame (height 1, feet at y 0, facing +z), as built by src/render/rig.js rigActor",
  tracks: [
    ...[...out].map(([name, values]) => ({name: `${name}.quaternion`, times: [...times], values: [...values]})),
    {name: `${rig.pelvis.name}.position`, times: [...times], values: [...hipPos]},
  ],
};
const text = JSON.stringify(data) + "\n";
writeFileSync(outPath, text);
const first = new T.Quaternion(), last = new T.Quaternion();
let loopQuatMax = 0;
for (const [, values] of out) loopQuatMax = Math.max(loopQuatMax, first.fromArray(values, 0).angleTo(last.fromArray(values, (keyCount - 1) * 4)));
console.log(JSON.stringify({
  clip: clipName, sourceGlb: {bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex")},
  keys: keyCount, duration: times.at(-1), tracks: data.tracks.length,
  sourceSides: {rigRight: rightSuffix, rigLeft: leftSuffix}, sourceForward: fwd.toArray().map((x) => +x.toFixed(3)),
  hipScale: +scale.toFixed(4), loopClosureMaxRadians: +loopQuatMax.toExponential(2),
  outSha256: createHash("sha256").update(text).digest("hex"),
}, null, 2));
