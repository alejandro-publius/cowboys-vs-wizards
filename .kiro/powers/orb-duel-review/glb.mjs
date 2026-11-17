// Bundled copy of parseGlb from the project's scripts/audit-assets.mjs. Node built-ins only.
const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const list = (v) => (Array.isArray(v) ? v : []);

// A count is "unknown", never 0, when the JSON does not pin it down:
// - Draco primitive: the decoder's output defines the counts, not the accessors.
// - no usable POSITION accessor: no vertex count, so no triangle count either.
// - any mode other than 4 (TRIANGLES), or an index count that is missing or
//   not a multiple of 3: triangles unknown, vertices still counted.
// Meshopt compresses buffer views below the accessors, so accessor counts
// stay authoritative there and are counted. Primitives are counted once each,
// not once per node that instances the mesh.
function primitiveCounts(p, count) {
  if (p.extensions?.KHR_draco_mesh_compression) return { why: "Draco-compressed primitive" };
  const vertices = count(p.attributes?.POSITION);
  if (vertices === undefined) return { why: "primitive without a usable POSITION accessor" };
  if ((p.mode ?? 4) !== 4) return { vertices, why: `primitive mode ${p.mode} is not TRIANGLES` };
  const n = p.indices === undefined ? vertices : count(p.indices);
  if (n === undefined || n % 3) return { vertices, why: "index count missing or not a multiple of 3" };
  return { vertices, triangles: n / 3 };
}

const add = (total, n) => (total === "unknown" || n === undefined ? "unknown" : total + n);

// Validates a GLB v2 container held in a Buffer and summarises its JSON chunk.
// Throws an Error with a plain message when the container is not valid.
export function parseGlb(buf) {
  if (buf.length < 12) throw new Error(`truncated header: ${buf.length} bytes, need 12`);
  if (buf.readUInt32LE(0) !== MAGIC) throw new Error("bad magic: not a GLB file");
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}, need 2`);
  const length = buf.readUInt32LE(8);
  if (length !== buf.length) throw new Error(`header length ${length} does not match file length ${buf.length}`);

  let jsonBytes;
  for (let at = 12, i = 0; at < length; i++) {
    if (at + 8 > length) throw new Error(`chunk ${i} header at byte ${at} runs past end of file`);
    const end = at + 8 + buf.readUInt32LE(at);
    if (end > length) throw new Error(`chunk ${i} ends at byte ${end}, past end of file at ${length}`);
    if (i === 0) {
      if (buf.readUInt32LE(at + 4) !== JSON_CHUNK) throw new Error("first chunk is not JSON");
      jsonBytes = buf.subarray(at + 8, end);
    }
    at = end;
  }
  if (!jsonBytes) throw new Error("missing JSON chunk");

  let gltf;
  try {
    gltf = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(jsonBytes));
  } catch (e) {
    throw new Error(`invalid JSON chunk: ${e.message}`);
  }
  if (gltf === null || typeof gltf !== "object" || Array.isArray(gltf)) throw new Error("invalid JSON chunk: not an object");

  const accessors = list(gltf.accessors);
  const count = (i) => (Number.isInteger(accessors[i]?.count) && accessors[i].count > 0 ? accessors[i].count : undefined);
  const meshes = list(gltf.meshes);
  let vertices = 0;
  let triangles = 0;
  const unknown = new Set();
  for (const mesh of meshes) {
    for (const p of list(mesh.primitives)) {
      const c = primitiveCounts(p, count);
      vertices = add(vertices, c.vertices);
      triangles = add(triangles, c.triangles);
      if (c.why) unknown.add(c.why);
    }
  }
  const skins = list(gltf.skins);
  return {
    bytes: buf.length,
    meshes: meshes.length,
    vertices,
    triangles,
    unknown: [...unknown],
    skins: skins.length,
    joints: new Set(skins.flatMap((s) => list(s.joints))).size, // distinct joint nodes
    clips: list(gltf.animations).map((a, i) => a.name || `(unnamed ${i})`),
    extensions: list(gltf.extensionsUsed),
  };
}
