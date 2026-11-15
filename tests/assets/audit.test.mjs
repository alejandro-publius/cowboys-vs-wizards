import assert from "node:assert/strict";
import test from "node:test";
import { parseGlb, report } from "../../scripts/audit-assets.mjs";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

// Fixtures are built in memory; nothing here reads or writes a file.
function chunk(type, data, pad = 0x20) {
  const body = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4, pad)]);
  const head = Buffer.alloc(8);
  head.writeUInt32LE(body.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, body]);
}

function glb(json, ...moreChunks) {
  const text = typeof json === "string" ? json : JSON.stringify(json);
  const body = Buffer.concat([chunk(JSON_CHUNK, Buffer.from(text)), ...moreChunks]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([head, body]);
}

const bin = chunk(BIN_CHUNK, Buffer.alloc(40), 0);
const triangle = {
  asset: { version: "2.0" },
  accessors: [{ count: 3 }, { count: 3 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
};
const withPrimitives = (...primitives) => ({ ...triangle, accessors: [{ count: 6 }, { count: 3 }, { count: 4 }], meshes: [{ primitives }] });

test("valid minimal GLB reports its counts", () => {
  const buf = glb(triangle, bin);
  assert.deepEqual(parseGlb(buf), {
    bytes: buf.length, meshes: 1, vertices: 3, triangles: 1, unknown: [],
    skins: 0, joints: 0, clips: [], extensions: [],
  });
});

test("skins, distinct joints, clip names and unindexed triangles", () => {
  const r = parseGlb(glb({
    ...withPrimitives({ attributes: { POSITION: 0 } }, { attributes: { POSITION: 0 }, indices: 1 }),
    skins: [{ joints: [1, 2, 3] }, { joints: [3, 4] }],
    animations: [{ name: "idle" }, {}],
    extensionsUsed: ["EXT_meshopt_compression"],
  }, bin));
  assert.equal(r.vertices, 12);
  assert.equal(r.triangles, 3); // 6 / 3 unindexed + 3 / 3 indexed
  assert.equal(r.skins, 2);
  assert.equal(r.joints, 4);
  assert.deepEqual(r.clips, ["idle", "(unnamed 1)"]);
  assert.deepEqual(r.extensions, ["EXT_meshopt_compression"]);
});

test("header shorter than 12 bytes is rejected", () => {
  assert.throws(() => parseGlb(glb(triangle).subarray(0, 11)), /truncated header/);
});

test("bad magic is rejected", () => {
  const buf = glb(triangle, bin);
  buf.writeUInt32LE(0x46546c68, 0);
  assert.throws(() => parseGlb(buf), /bad magic/);
});

test("wrong version is rejected", () => {
  for (const version of [1, 3]) {
    const buf = glb(triangle, bin);
    buf.writeUInt32LE(version, 4);
    assert.throws(() => parseGlb(buf), /version/);
  }
});

test("header length that differs from the file length is rejected", () => {
  const buf = glb(triangle, bin);
  assert.throws(() => parseGlb(buf.subarray(0, buf.length - 4)), /header length/); // truncated file
  assert.throws(() => parseGlb(Buffer.concat([buf, Buffer.alloc(4)])), /header length/); // trailing bytes
});

test("chunk running past the end of the file is rejected", () => {
  const json = glb(triangle);
  json.writeUInt32LE(json.readUInt32LE(12) + 4, 12); // JSON chunk claims 4 bytes too many
  assert.throws(() => parseGlb(json), /chunk 0 ends .* past end of file/);

  const withBin = glb(triangle, bin);
  const binAt = withBin.length - bin.length;
  withBin.writeUInt32LE(withBin.readUInt32LE(binAt) + 4, binAt); // BIN chunk claims 4 bytes too many
  assert.throws(() => parseGlb(withBin), /chunk 1 ends .* past end of file/);

  const stub = glb(triangle, Buffer.alloc(4)); // 4 trailing bytes cannot hold a chunk header
  assert.throws(() => parseGlb(stub), /chunk 1 header .* past end of file/);
});

test("first chunk must be JSON", () => {
  const buf = glb(triangle, bin);
  buf.writeUInt32LE(BIN_CHUNK, 16);
  assert.throws(() => parseGlb(buf), /first chunk is not JSON/);
  const headerOnly = Buffer.from(glb(triangle).subarray(0, 12));
  headerOnly.writeUInt32LE(12, 8);
  assert.throws(() => parseGlb(headerOnly), /missing JSON chunk/);
});

test("invalid JSON is rejected", () => {
  assert.throws(() => parseGlb(glb('{"asset":')), /invalid JSON chunk/);
  assert.throws(() => parseGlb(glb("[1,2]")), /invalid JSON chunk: not an object/);
});

test("undetermined geometry is unknown, never zero", () => {
  const cases = {
    "no POSITION accessor": [{ attributes: { NORMAL: 0 } }, "unknown", "unknown"],
    "LINES mode": [{ attributes: { POSITION: 0 }, mode: 1 }, 6, "unknown"],
    "Draco": [{ attributes: { POSITION: 0 }, indices: 1, extensions: { KHR_draco_mesh_compression: {} } }, "unknown", "unknown"],
    "index count not a multiple of 3": [{ attributes: { POSITION: 0 }, indices: 2 }, 6, "unknown"],
    "index accessor missing": [{ attributes: { POSITION: 0 }, indices: 9 }, 6, "unknown"],
  };
  for (const [name, [primitive, vertices, triangles]] of Object.entries(cases)) {
    const r = parseGlb(glb(withPrimitives(primitive)));
    assert.equal(r.vertices, vertices, `${name}: vertices`);
    assert.equal(r.triangles, triangles, `${name}: triangles`);
    assert.equal(r.unknown.length, 1, `${name}: one reason given`);
  }
});

test("one undetermined primitive makes the file total unknown, not a partial sum", () => {
  const r = parseGlb(glb(withPrimitives({ attributes: { POSITION: 0 }, indices: 1 }, { attributes: {} })));
  assert.equal(r.vertices, "unknown");
  assert.equal(r.triangles, "unknown");
});

test("report sorts by filename and counts invalid files with a per-file error", () => {
  const { text, failed } = report([["b.glb", glb(triangle, bin)], ["c.glb", glb("{")], ["a.glb", glb(withPrimitives({ attributes: {} }))]]);
  const lines = text.split("\n");
  assert.match(lines[2], /^\| a\.glb .* unknown +\| unknown /);
  assert.match(lines[3], /^\| b\.glb .* 3 +\| 1 /);
  assert.match(lines[4], /^ERROR c\.glb: invalid JSON chunk/);
  assert.equal(lines[5], "3 .glb files, 1 invalid");
  assert.equal(failed, 1);
  assert.equal(report([["b.glb", glb(triangle, bin)]]).failed, 0);
});
