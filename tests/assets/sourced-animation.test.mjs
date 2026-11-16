import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { main, validateGlb } from "../../scripts/check-sourced-animation.mjs";

const SCRIPT = fileURLToPath(new URL("../../scripts/check-sourced-animation.mjs", import.meta.url));

// Everything is built in memory; only the CLI tests touch disk, under os.tmpdir().
function chunk(type, data, pad) {
  const body = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4, pad)]);
  const head = Buffer.alloc(8);
  head.writeUInt32LE(body.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, body]);
}
function glb(json, bin) {
  const body = Buffer.concat([chunk(0x4e4f534a, Buffer.from(JSON.stringify(json)), 0x20), chunk(0x004e4942, bin, 0)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([head, body]);
}

// BIN layout: times 0..12, rotation 12..60, translation 60..96, inverse binds 96..224,
// JOINTS_0 224..232, POSITION 232..256, image 256..264.
function fixture({ times = [0, 0.5, 1], mutate } = {}) {
  const bin = Buffer.alloc(264);
  times.forEach((t, i) => bin.writeFloatLE(t, i * 4));
  for (let i = 0; i < 3; i++) bin.writeFloatLE(1, 12 + i * 16 + 12); // unit quaternion w=1
  for (let i = 0; i < 2; i++) bin.writeFloatLE(1, 96 + i * 64 + i * 20); // identity-ish diagonal
  bin.set([0, 0, 0, 0, 1, 0, 0, 0], 224);
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 264 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 12 },
      { buffer: 0, byteOffset: 12, byteLength: 48 },
      { buffer: 0, byteOffset: 60, byteLength: 36 },
      { buffer: 0, byteOffset: 96, byteLength: 128 },
      { buffer: 0, byteOffset: 224, byteLength: 8 },
      { buffer: 0, byteOffset: 232, byteLength: 24 },
      { buffer: 0, byteOffset: 256, byteLength: 8 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "SCALAR" },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC4" },
      { bufferView: 2, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 3, componentType: 5126, count: 2, type: "MAT4" },
      { bufferView: 4, componentType: 5121, count: 2, type: "VEC4" },
      { bufferView: 5, componentType: 5126, count: 2, type: "VEC3" },
    ],
    images: [{ bufferView: 6, mimeType: "image/png" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 5, JOINTS_0: 4 } }] }],
    nodes: [{ mesh: 0, skin: 0 }, { children: [2] }, {}],
    skins: [{ joints: [1, 2], inverseBindMatrices: 3 }],
    animations: [{
      name: "clip",
      samplers: [{ input: 0, output: 1 }, { input: 0, output: 2, interpolation: "STEP" }],
      channels: [
        { sampler: 0, target: { node: 1, path: "rotation" } },
        { sampler: 1, target: { node: 2, path: "translation" } },
      ],
    }],
  };
  mutate?.(json, bin);
  return glb(json, bin);
}
const reasons = (buf) => validateGlb(buf).errors.join("\n");

test("valid skinned clip passes with its summary", () => {
  const r = validateGlb(fixture());
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.summary.skins, 1);
  assert.equal(r.summary.joints, 2);
  assert.equal(r.summary.channels, 2);
  assert.equal(r.summary.jointChannels, 2);
  assert.deepEqual(r.summary.durations, [1]);
});

test("a source clip needs a skin and an animation", () => {
  assert.match(reasons(fixture({ mutate: (j) => { delete j.skins; j.nodes[0] = { mesh: 0 }; } })), /no skins/);
  assert.match(reasons(fixture({ mutate: (j) => { delete j.animations; } })), /no animations/);
});

test("bad joint, skin joint slot and animation target indices are named", () => {
  assert.match(reasons(fixture({ mutate: (j) => { j.skins[0].joints = [1, 9]; } })), /skin 0 joint 9 is out of range/);
  assert.match(reasons(fixture({ mutate: (j) => { j.animations[0].channels[0].target.node = 7; } })), /target node 7 is out of range/);
  assert.match(reasons(fixture({ mutate: (j) => { j.animations[0].channels[0].target.path = "scale2"; } })), /target path "scale2"/);
  assert.match(reasons(fixture({ mutate: (j) => { j.animations[0].channels[1].sampler = 5; } })), /sampler 5 is out of range/);
  assert.match(reasons(fixture({ mutate: (j, b) => { b[224 + 4] = 2; } })), /joint slot 2, skin 0 has 2 joints/);
});

test("nonfinite, negative and nonincreasing times are rejected", () => {
  assert.match(reasons(fixture({ times: [0, NaN, 1] })), /time\[1\] is not finite/);
  assert.match(reasons(fixture({ times: [0, Infinity, 1] })), /not finite/);
  assert.match(reasons(fixture({ times: [-1, 0, 1] })), /time\[0\] = -1 is negative/);
  assert.match(reasons(fixture({ times: [0, 0.5, 0.5] })), /does not increase/);
  assert.match(reasons(fixture({ times: [0, 0, 0] })), /does not increase/);
});

test("duration must be positive", () => {
  const r = fixture({ times: [0, 0, 0], mutate: (j) => { j.accessors[0].count = 1; j.accessors[1].count = 1; j.accessors[2].count = 1; } });
  assert.match(reasons(r), /duration is 0/);
});

test("output type, count and rotation normalization must match the path", () => {
  assert.match(reasons(fixture({ mutate: (j) => { j.animations[0].channels[0].target.path = "translation"; } })), /must be VEC3, got VEC4/);
  assert.match(reasons(fixture({ mutate: (j) => { j.accessors[1].count = 2; j.bufferViews[1].byteLength = 32; } })), /output has 2 elements for 3 times, need 3/);
  assert.match(reasons(fixture({ mutate: (j) => { j.animations[0].samplers[0].interpolation = "CUBICSPLINE"; } })), /need 9/);
  assert.match(reasons(fixture({ mutate: (j) => { j.accessors[0].componentType = 5123; } })), /time input accessor 0 must be FLOAT SCALAR/);
  assert.match(reasons(fixture({ mutate: (j, b) => { b.writeFloatLE(3, 12 + 12); } })), /not a unit quaternion/);
});

test("out-of-bounds bufferView, accessor and image references are rejected", () => {
  assert.match(reasons(fixture({ mutate: (j) => { j.bufferViews[1].byteOffset = 250; } })), /bufferView 1 spans bytes 250-298, past the 264 BIN bytes/);
  assert.match(reasons(fixture({ mutate: (j) => { j.accessors[2].count = 4; } })), /accessor 2 needs 48 bytes but bufferView 2 has 36/);
  assert.match(reasons(fixture({ mutate: (j) => { j.accessors[2].bufferView = 99; } })), /accessor 2 bufferView 99 is out of range/);
  assert.match(reasons(fixture({ mutate: (j) => { j.accessors[2].byteOffset = 2; } })), /not 4-byte aligned/);
  assert.match(reasons(fixture({ mutate: (j) => { j.images[0].bufferView = 12; } })), /image 0 bufferView 12 is out of range/);
  assert.match(reasons(fixture({ mutate: (j) => { j.buffers[0].byteLength = 4000; } })), /exceeds BIN chunk/);
});

test("features outside the supported subset are reported as unsupported", () => {
  assert.match(reasons(fixture({ mutate: (j) => { j.extensionsRequired = ["KHR_draco_mesh_compression"]; } })), /unsupported: required extension KHR_draco/);
  assert.match(reasons(fixture({ mutate: (j) => { j.buffers[0].uri = "x.bin"; } })), /unsupported: buffer 0 has a uri/);
  assert.match(reasons(fixture({ mutate: (j) => { j.images[0] = { uri: "a.png" }; } })), /unsupported: image 0 uses a uri/);
  assert.match(reasons(fixture({ mutate: (j) => { j.animations[0].channels[0].target.path = "weights"; } })), /unsupported: .*morph target weights/);
});

test("null or non-object structural entries fail with their JSON path instead of throwing", () => {
  const cases = [
    ["nodes", (j) => { j.nodes[1] = null; }, /\$\.nodes\[1\] must be an object/],
    ["accessors", (j) => { j.accessors[2] = null; }, /\$\.accessors\[2\] must be an object/],
    ["bufferViews", (j) => { j.bufferViews[0] = 5; }, /\$\.bufferViews\[0\] must be an object/],
    ["skins", (j) => { j.skins[0] = null; }, /\$\.skins\[0\] must be an object/],
    ["sampler", (j) => { j.animations[0].samplers[1] = null; }, /\$\.animations\[0\]\.samplers\[1\] must be an object/],
    ["channel", (j) => { j.animations[0].channels[0] = null; }, /\$\.animations\[0\]\.channels\[0\] must be an object/],
    ["channel target", (j) => { j.animations[0].channels[1].target = 3; }, /\$\.animations\[0\]\.channels\[1\]\.target must be an object/],
    ["primitive attributes", (j) => { j.meshes[0].primitives[0].attributes = []; }, /primitives\[0\]\.attributes must be an object/],
    ["nodes not an array", (j) => { j.nodes = {}; }, /\$\.nodes must be an array/],
    ["skin joints not an array", (j) => { j.skins[0].joints = 1; }, /skins\[0\]\.joints must be an array/],
  ];
  for (const [label, mutate, re] of cases) {
    let r;
    assert.doesNotThrow(() => { r = validateGlb(fixture({ mutate })); }, label);
    assert.equal(r.ok, false, label);
    assert.match(r.errors.join("\n"), re, label);
  }
});

// One shared mesh instanced by nodes 0 and 3, using skins 0 and 1.
// Skin 0 has two joints, skin 1 has three; JOINTS_0 holds slot 2 when `slot` is 2.
function sharedMesh({ slot, firstJoints = [1, 2] }) {
  return fixture({
    mutate: (j, b) => {
      b[224 + 4] = slot;
      j.nodes.push({ mesh: 0, skin: 1 });
      j.skins[0].joints = firstJoints;
      j.skins.push({ joints: [1, 2, 3] });
    },
  });
}
test("a mesh shared by several skins is checked against every skin", () => {
  // Earlier skin (2 joints) is too short for slot 2; the last skin (3 joints) is fine.
  const bad = validateGlb(sharedMesh({ slot: 2 }));
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join("\n"), /joint slot 2, skin 0 has 2 joints \(node 0\)/);
  assert.doesNotMatch(bad.errors.join("\n"), /skin 1 has/);
  // Slot 1 fits both skins.
  const good = validateGlb(sharedMesh({ slot: 1 }));
  assert.deepEqual(good.errors, []);
  assert.equal(good.summary.skins, 2);
});

test("a malformed container is a failure, not a throw", () => {
  assert.match(reasons(Buffer.from("not a glb at all")), /container: bad magic/);
});

test("CLI exits 0 for a valid file, 1 for an invalid one, 2 without arguments", () => {
  const dir = mkdtempSync(join(tmpdir(), "sourced-anim-"));
  try {
    const good = join(dir, "good.glb");
    const bad = join(dir, "bad.glb");
    writeFileSync(good, fixture());
    writeFileSync(bad, fixture({ times: [0, 1, 1] }));
    const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    const ok = run(good);
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /PASS .*good\.glb/);
    assert.match(ok.stdout, /sha256 [0-9a-f]{64}/);
    const both = run(good, bad, join(dir, "missing.glb"));
    assert.equal(both.status, 1);
    assert.match(both.stdout, /FAIL .*bad\.glb[\s\S]*does not increase/);
    assert.match(both.stdout, /cannot read/);
    assert.match(both.stdout, /1\/3 file\(s\) passed/);
    assert.equal(run().status, 2);
    assert.equal(main([], () => {}), 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
