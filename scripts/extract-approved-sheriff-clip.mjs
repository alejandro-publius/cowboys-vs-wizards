// Copies the user-approved Sheriff headShake track data out of the approved preview GLB into
// assets/animations/sheriff-headShake.json (+ .SOURCE.json provenance). Only the glTF animation
// accessors are read; times and values are Float32 numbers copied unchanged (a Float32 widens to
// a double exactly, so Math.fround(JSON value) is the original). Nothing is resampled or edited.
// Usage: node scripts/extract-approved-sheriff-clip.mjs [approved.glb]
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";

export const APPROVED_GLB = "/Users/alexvintera/Documents/Codex/2026-11-14/new-chat/cowboys-vs-wizards-board/.worktrees/codex-sourced-motion-preview/tmp/sourced-motion/sheriff-mixamo-headShake-preview.glb";
export const APPROVED_SHA256 = "d9d2ea2e0dc4808f3b220bae0e21440a5109de0e87e82845e93abc6bd1655c99";
const SIZES = {SCALAR: 1, VEC3: 3, VEC4: 4};
const PATHS = {rotation: "quaternion", translation: "position"};

// {json, accessor(index) -> Float32Array copy} for a binary glTF.
export function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  let json = null, bin = null;
  for (let at = 12; at < bytes.length;) {
    const length = bytes.readUInt32LE(at), type = bytes.readUInt32LE(at + 4), body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    else if (type === 0x004e4942) bin = body;
    at += 8 + length;
  }
  const accessor = (index) => {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    if (a.componentType !== 5126 || view.byteStride) throw new Error("expected tightly packed float accessors");
    const count = a.count * SIZES[a.type], start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new Float32Array(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + count * 4));
  };
  return {json, accessor};
}

// The first animation as {name, duration, tracks: [{name, path, times, values}]}, Float32Arrays.
export function clipFromGlb(bytes) {
  const {json, accessor} = readGlb(bytes), [animation] = json.animations;
  const tracks = animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler], path = PATHS[channel.target.path];
    if (!path || sampler.interpolation !== "LINEAR") throw new Error(`unsupported track ${channel.target.path} ${sampler.interpolation}`);
    return {bone: json.nodes[channel.target.node].name, path, times: accessor(sampler.input), values: accessor(sampler.output)};
  });
  const duration = Math.max(...tracks.map((track) => track.times.at(-1)));
  return {name: animation.name, duration, tracks};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] ?? APPROVED_GLB, bytes = readFileSync(input);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== APPROVED_SHA256) throw new Error(`${input} is ${sha}, not the approved ${APPROVED_SHA256}`);
  const clip = clipFromGlb(bytes);
  const data = {
    name: clip.name, duration: clip.duration,
    units: "normalized Sheriff rig (height 1, feet at y 0); position values are used as authored, never scaled",
    tracks: clip.tracks.map(({bone, path, times, values}) => ({name: `${bone}.${path}`, times: [...times], values: [...values]})),
  };
  const out = new URL("../assets/animations/", import.meta.url);
  mkdirSync(out, {recursive: true});
  const text = JSON.stringify(data) + "\n";
  writeFileSync(new URL("sheriff-headShake.json", out), text);
  const source = {
    clip: clip.name, durationSeconds: clip.duration, keyframes: clip.tracks[0].times.length, tracks: clip.tracks.length,
    approvedGlb: {file: "sheriff-mixamo-headShake-preview.glb", bytes: bytes.length, sha256: sha},
    clipDataSha256: createHash("sha256").update(text).digest("hex"),
    conversion: "glTF rotation/translation LINEAR samplers -> track names '<bone>.quaternion'/'<bone>.position'; Float32 values unchanged",
    motion: "Mixamo headShake, via three.js r180 Xbot.glb",
    motionSources: [
      "https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/Xbot.glb",
      "https://threejs.org/examples/webgl_animation_skinning_additive_blending.html",
    ],
    terms: "Adobe/Mixamo terms apply, not the three.js MIT code license: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html",
    retarget: "Codex (codex-sourced-motion-preview); user approved the visible standing gesture with 'perfect!!!' on 2026-11-16",
    art: "User's Tripo Sheriff, assets/models/sheriff.glb, unchanged",
  };
  writeFileSync(new URL("sheriff-headShake.SOURCE.json", out), JSON.stringify(source, null, 2) + "\n");
  console.log(JSON.stringify(source, null, 2));
}
