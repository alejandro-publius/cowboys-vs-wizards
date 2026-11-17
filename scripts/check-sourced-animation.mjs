// Read-only structural preflight for skinned glTF 2.0 binary (GLB) animation clips.
// Node built-ins only. Usage: node scripts/check-sourced-animation.mjs file.glb [more.glb ...]
// Exit 0: every file passed. 1: a file failed or uses an unsupported feature. 2: bad usage.
//
// Supported subset: one embedded BIN buffer, uncompressed FLOAT animation data,
// no sparse accessors, no external or data-URI buffers/images, no weights channels.
// Anything outside that subset is reported as "unsupported:" and fails the file.
// The check proves the arrays are well formed and in range. It does not prove
// good movement, foot contact, skin weights or visual quality, and it never decodes images.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseGlb } from "./audit-assets.mjs";

const BIN_CHUNK = 0x004e4942;
const JSON_CHUNK = 0x4e4f534a;
const COMPONENTS = {
  5120: { size: 1, name: "BYTE", read: (b, o) => b.readInt8(o) },
  5121: { size: 1, name: "UNSIGNED_BYTE", read: (b, o) => b.readUInt8(o) },
  5122: { size: 2, name: "SHORT", read: (b, o) => b.readInt16LE(o) },
  5123: { size: 2, name: "UNSIGNED_SHORT", read: (b, o) => b.readUInt16LE(o) },
  5125: { size: 4, name: "UNSIGNED_INT", read: (b, o) => b.readUInt32LE(o) },
  5126: { size: 4, name: "FLOAT", read: (b, o) => b.readFloatLE(o) },
};
const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const PATH_TYPE = { translation: "VEC3", rotation: "VEC4", scale: "VEC3" };
const FLOAT = 5126;
const list = (v) => (Array.isArray(v) ? v : []);
const isIndex = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Shape check before any property access: every listed array must be an array of
// plain objects. Returns errors naming the JSON path; nothing is defaulted or skipped.
function shapeErrors(g) {
  const out = [];
  const arrayOf = (parent, key, path, each) => {
    const v = parent[key];
    if (v === undefined) return;
    if (!Array.isArray(v)) return void out.push(`malformed: ${path}.${key} must be an array`);
    v.forEach((e, i) => {
      if (!isObj(e)) out.push(`malformed: ${path}.${key}[${i}] must be an object`);
      else each?.(e, `${path}.${key}[${i}]`);
    });
  };
  const ints = (parent, key, path) => {
    if (parent[key] !== undefined && !Array.isArray(parent[key])) out.push(`malformed: ${path}.${key} must be an array`);
  };
  for (const k of ["buffers", "bufferViews", "accessors", "images"]) arrayOf(g, k, "$");
  arrayOf(g, "nodes", "$", (n, p) => ints(n, "children", p));
  arrayOf(g, "skins", "$", (s, p) => ints(s, "joints", p));
  arrayOf(g, "meshes", "$", (m, p) => arrayOf(m, "primitives", p, (pr, pp) => {
    if (pr.attributes !== undefined && !isObj(pr.attributes)) out.push(`malformed: ${pp}.attributes must be an object`);
  }));
  arrayOf(g, "animations", "$", (a, p) => {
    arrayOf(a, "samplers", p);
    arrayOf(a, "channels", p, (c, cp) => {
      if (c.target !== undefined && !isObj(c.target)) out.push(`malformed: ${cp}.target must be an object`);
    });
  });
  return out;
}

function binChunk(buf) {
  let bin;
  for (let at = 12, i = 0; at < buf.length; i++) {
    const len = buf.readUInt32LE(at);
    const type = buf.readUInt32LE(at + 4);
    if (type === BIN_CHUNK && i === 1) bin = buf.subarray(at + 8, at + 8 + len);
    at += 8 + len;
  }
  return bin;
}

function jsonOf(buf) {
  const len = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== JSON_CHUNK) throw new Error("first chunk is not JSON");
  return JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
}

// Returns { ok, errors, summary }. Never throws for malformed input.
export function validateGlb(buf) {
  const errors = [];
  const err = (m) => errors.push(m);
  const unsupported = (m) => errors.push(`unsupported: ${m}`);
  // parseGlb reads the clip list and can itself throw on malformed entries, so a
  // container failure is first checked for a more specific JSON-path shape error.
  let container;
  let containerError;
  try {
    container = parseGlb(buf);
  } catch (e) {
    containerError = `container: ${e.message}`;
  }
  let gltf;
  try {
    gltf = jsonOf(buf);
  } catch (e) {
    return { ok: false, errors: [containerError ?? `container: ${e.message}`], summary: {} };
  }
  if (!isObj(gltf)) return { ok: false, errors: ["malformed: $ must be a JSON object"], summary: {} };
  const shape = shapeErrors(gltf);
  if (shape.length) return { ok: false, errors: shape, summary: {} };
  if (containerError) return { ok: false, errors: [containerError], summary: {} };
  const bin = binChunk(buf);

  for (const ext of list(gltf.extensionsRequired)) unsupported(`required extension ${ext}`);
  const nodes = list(gltf.nodes);
  const accessors = list(gltf.accessors);
  const views = list(gltf.bufferViews);
  const buffers = list(gltf.buffers);
  const skins = list(gltf.skins);
  const animations = list(gltf.animations);
  if (skins.length < 1) err("no skins: a skinned source clip needs at least one skin");
  if (animations.length < 1) err("no animations: a skinned source clip needs at least one animation");

  // Buffers and buffer views against the real BIN bytes.
  if (buffers.length > 1) unsupported(`${buffers.length} buffers; only the single embedded BIN buffer is supported`);
  if (buffers.length >= 1) {
    const b = buffers[0];
    if (b.uri !== undefined) unsupported("buffer 0 has a uri (external or data URI)");
    else if (!bin) err("buffer 0 has no uri but the GLB has no BIN chunk");
    else if (!Number.isInteger(b.byteLength) || b.byteLength < 1) err(`buffer 0 byteLength ${b.byteLength} is invalid`);
    else if (b.byteLength > bin.length) err(`buffer 0 byteLength ${b.byteLength} exceeds BIN chunk of ${bin.length} bytes`);
  }
  const binLen = bin && buffers[0] && buffers[0].uri === undefined ? Math.min(bin.length, buffers[0].byteLength ?? 0) : 0;
  const viewOk = views.map((v, i) => {
    if (v.extensions) {
      unsupported(`bufferView ${i} uses extensions (${Object.keys(v.extensions).join(", ")})`);
      return false;
    }
    if (v.buffer !== 0) {
      err(`bufferView ${i} references buffer ${v.buffer}; only buffer 0 exists in the supported subset`);
      return false;
    }
    const off = v.byteOffset ?? 0;
    if (!Number.isInteger(off) || off < 0 || !Number.isInteger(v.byteLength) || v.byteLength < 1) {
      err(`bufferView ${i} has invalid byteOffset/byteLength (${v.byteOffset}, ${v.byteLength})`);
      return false;
    }
    if (off + v.byteLength > binLen) {
      err(`bufferView ${i} spans bytes ${off}-${off + v.byteLength}, past the ${binLen} BIN bytes`);
      return false;
    }
    return true;
  });

  // Accessors: shape, alignment and span inside their bufferView.
  const accOk = accessors.map((a, i) => {
    const c = COMPONENTS[a.componentType];
    const n = TYPES[a.type];
    if (a.sparse) return unsupported(`accessor ${i} is sparse`), false;
    if (!c) return err(`accessor ${i} has unknown componentType ${a.componentType}`), false;
    if (!n) return err(`accessor ${i} has unknown type ${a.type}`), false;
    if (!Number.isInteger(a.count) || a.count < 1) return err(`accessor ${i} count ${a.count} is invalid`), false;
    if (a.bufferView === undefined) return unsupported(`accessor ${i} has no bufferView (implicit zeros)`), false;
    if (!isIndex(a.bufferView, views.length)) return err(`accessor ${i} bufferView ${a.bufferView} is out of range (${views.length} views)`), false;
    if (!viewOk[a.bufferView]) return false;
    const v = views[a.bufferView];
    const off = a.byteOffset ?? 0;
    if (!Number.isInteger(off) || off < 0 || off % c.size) return err(`accessor ${i} byteOffset ${a.byteOffset} is invalid or not ${c.size}-byte aligned`), false;
    const elem = c.size * n;
    const stride = v.byteStride ?? elem;
    if (v.byteStride !== undefined && (v.byteStride < elem || v.byteStride % c.size)) return err(`accessor ${i} bufferView ${a.bufferView} byteStride ${v.byteStride} is invalid for ${elem}-byte elements`), false;
    const end = off + stride * (a.count - 1) + elem;
    if (end > v.byteLength) return err(`accessor ${i} needs ${end} bytes but bufferView ${a.bufferView} has ${v.byteLength}`), false;
    return true;
  });
  const bytesOf = (i) => {
    const a = accessors[i];
    const v = views[a.bufferView];
    const elem = COMPONENTS[a.componentType].size * TYPES[a.type];
    return { base: (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride: v.byteStride ?? elem, elem };
  };
  const readAll = (i) => {
    const a = accessors[i];
    const c = COMPONENTS[a.componentType];
    const n = TYPES[a.type];
    const { base, stride } = bytesOf(i);
    const rows = [];
    for (let r = 0; r < a.count; r++) {
      const row = [];
      for (let k = 0; k < n; k++) row.push(c.read(bin, base + r * stride + k * c.size));
      rows.push(row);
    }
    return rows;
  };

  // Images: embedded bufferView references only. Bytes are never decoded.
  for (const [i, im] of list(gltf.images).entries()) {
    if (im.uri !== undefined) unsupported(`image ${i} uses a uri; only embedded bufferView images are supported`);
    else if (im.bufferView === undefined) err(`image ${i} has neither uri nor bufferView`);
    else if (!isIndex(im.bufferView, views.length)) err(`image ${i} bufferView ${im.bufferView} is out of range (${views.length} views)`);
    else if (im.mimeType !== "image/png" && im.mimeType !== "image/jpeg") err(`image ${i} mimeType ${im.mimeType} must be image/png or image/jpeg`);
  }

  // Nodes.
  for (const [i, nd] of nodes.entries()) {
    for (const c of list(nd.children)) if (!isIndex(c, nodes.length)) err(`node ${i} child ${c} is out of range (${nodes.length} nodes)`);
    if (nd.skin !== undefined && !isIndex(nd.skin, skins.length)) err(`node ${i} skin ${nd.skin} is out of range (${skins.length} skins)`);
    if (nd.mesh !== undefined && !isIndex(nd.mesh, list(gltf.meshes).length)) err(`node ${i} mesh ${nd.mesh} is out of range`);
  }

  // Skins and joints.
  const jointSet = new Set();
  const jointCount = new Map();
  for (const [i, s] of skins.entries()) {
    const joints = list(s.joints);
    if (joints.length < 1) err(`skin ${i} has no joints`);
    const seen = new Set();
    for (const j of joints) {
      if (!isIndex(j, nodes.length)) err(`skin ${i} joint ${j} is out of range (${nodes.length} nodes)`);
      else if (seen.has(j)) err(`skin ${i} lists joint node ${j} twice`);
      else (seen.add(j), jointSet.add(j));
    }
    jointCount.set(i, joints.length);
    if (s.skeleton !== undefined && !isIndex(s.skeleton, nodes.length)) err(`skin ${i} skeleton ${s.skeleton} is out of range`);
    if (s.inverseBindMatrices !== undefined) {
      const a = accessors[s.inverseBindMatrices];
      if (!a) err(`skin ${i} inverseBindMatrices accessor ${s.inverseBindMatrices} is out of range`);
      else if (a.type !== "MAT4" || a.componentType !== FLOAT) err(`skin ${i} inverseBindMatrices must be FLOAT MAT4, got ${a.componentType} ${a.type}`);
      else if (a.count < joints.length) err(`skin ${i} has ${joints.length} joints but only ${a.count} inverse bind matrices`);
    }
  }

  // JOINTS_n vertex attributes must index into their skin's joint list.
  // Every skinned node instance is checked, so a mesh shared by several skins is
  // validated against each skin, not only the last one.
  const meshes = list(gltf.meshes);
  const seenMsg = new Set();
  const once = (m) => { if (!seenMsg.has(m)) (seenMsg.add(m), err(m)); };
  for (const [ni, nd] of nodes.entries()) {
    if (nd.mesh === undefined || !isIndex(nd.mesh, meshes.length) || !isIndex(nd.skin, skins.length)) continue;
    const m = nd.mesh;
    const skin = nd.skin;
    for (const [pi, p] of list(meshes[m].primitives).entries()) {
      for (const [name, idx] of Object.entries(p.attributes ?? {})) {
        if (!/^JOINTS_\d+$/.test(name)) continue;
        if (!accessors[idx] || !accOk[idx]) { once(`mesh ${m} primitive ${pi} ${name} accessor ${idx} is missing or invalid`); continue; }
        const a = accessors[idx];
        if (a.componentType !== 5121 && a.componentType !== 5123) { once(`mesh ${m} primitive ${pi} ${name} must be UNSIGNED_BYTE or UNSIGNED_SHORT`); continue; }
        let max = -1;
        for (const row of readAll(idx)) for (const v of row) if (v > max) max = v;
        if (max >= jointCount.get(skin)) err(`mesh ${m} primitive ${pi} ${name} references joint slot ${max}, skin ${skin} has ${jointCount.get(skin)} joints (node ${ni})`);
      }
    }
  }

  // Animations.
  let channelCount = 0;
  let jointChannels = 0;
  const durations = [];
  for (const [ai, an] of animations.entries()) {
    const tag = `animation ${ai}${an.name ? ` "${an.name}"` : ""}`;
    const samplers = list(an.samplers);
    const channels = list(an.channels);
    if (channels.length < 1) err(`${tag} has no channels`);
    if (samplers.length < 1) err(`${tag} has no samplers`);
    const targets = new Set();
    const samplerOk = new Map();
    let duration = 0;
    for (const [ci, ch] of channels.entries()) {
      channelCount++;
      const where = `${tag} channel ${ci}`;
      const t = ch.target ?? {};
      if (!isIndex(ch.sampler, samplers.length)) err(`${where} sampler ${ch.sampler} is out of range (${samplers.length} samplers)`);
      if (!isIndex(t.node, nodes.length)) err(`${where} target node ${t.node} is out of range (${nodes.length} nodes)`);
      else if (jointSet.has(t.node)) jointChannels++;
      if (t.path === "weights") { unsupported(`${where} animates morph target weights`); continue; }
      if (t.path === "pointer") { unsupported(`${where} uses an animation pointer`); continue; }
      if (!PATH_TYPE[t.path]) { err(`${where} target path ${JSON.stringify(t.path)} must be translation, rotation or scale`); continue; }
      const key = `${t.node}:${t.path}`;
      if (targets.has(key)) err(`${where} duplicates target node ${t.node} ${t.path}`);
      targets.add(key);
      if (!isIndex(ch.sampler, samplers.length) || !isIndex(t.node, nodes.length)) continue;

      const s = samplers[ch.sampler];
      const interp = s.interpolation ?? "LINEAR";
      if (!["LINEAR", "STEP", "CUBICSPLINE"].includes(interp)) { err(`${where} interpolation ${interp} is not LINEAR, STEP or CUBICSPLINE`); continue; }
      const ia = accessors[s.input];
      const oa = accessors[s.output];
      if (!ia) { err(`${where} sampler input accessor ${s.input} is out of range (${accessors.length} accessors)`); continue; }
      if (!oa) { err(`${where} sampler output accessor ${s.output} is out of range (${accessors.length} accessors)`); continue; }
      if (ia.type !== "SCALAR" || ia.componentType !== FLOAT) err(`${where} time input accessor ${s.input} must be FLOAT SCALAR, got ${COMPONENTS[ia.componentType]?.name ?? ia.componentType} ${ia.type}`);
      const want = PATH_TYPE[t.path];
      if (oa.type !== want) err(`${where} ${t.path} output accessor ${s.output} must be ${want}, got ${oa.type}`);
      if (oa.componentType !== FLOAT) unsupported(`${where} ${t.path} output accessor ${s.output} is ${COMPONENTS[oa.componentType]?.name ?? oa.componentType}; only FLOAT output is checked`);
      const wantCount = interp === "CUBICSPLINE" ? ia.count * 3 : ia.count;
      if (oa.count !== wantCount) err(`${where} ${interp} output has ${oa.count} elements for ${ia.count} times, need ${wantCount}`);
      if (interp === "CUBICSPLINE" && ia.count < 2) err(`${where} CUBICSPLINE needs at least 2 keyframes, has ${ia.count}`);

      if (!samplerOk.has(s.input)) {
        let ok = accOk[s.input] && ia.type === "SCALAR" && ia.componentType === FLOAT;
        if (ok) {
          const times = readAll(s.input).map((r) => r[0]);
          let last = -Infinity;
          for (const [k, v] of times.entries()) {
            if (!Number.isFinite(v)) { err(`${where} time[${k}] is not finite`); ok = false; break; }
            if (v < 0) { err(`${where} time[${k}] = ${v} is negative`); ok = false; break; }
            if (v <= last) { err(`${where} time[${k}] = ${v} does not increase past ${last}`); ok = false; break; }
            last = v;
          }
          if (ok) samplerOk.set(s.input, last);
        } else samplerOk.set(s.input, null);
      }
      const end = samplerOk.get(s.input);
      if (end !== null && end !== undefined) duration = Math.max(duration, end);

      if (accOk[s.output] && oa.type === want && oa.componentType === FLOAT) {
        const rows = readAll(s.output);
        for (const [k, row] of rows.entries()) {
          if (!row.every(Number.isFinite)) { err(`${where} output[${k}] is not finite`); break; }
        }
        if (t.path === "rotation") {
          for (const [k, row] of rows.entries()) {
            if (interp === "CUBICSPLINE" && k % 3 !== 1) continue; // tangents are not unit values
            const len = Math.hypot(...row);
            if (Number.isFinite(len) && Math.abs(len - 1) > 1e-3) { err(`${where} rotation output[${k}] has length ${len.toFixed(4)}, not a unit quaternion`); break; }
          }
        }
      }
    }
    if (samplerOk.size && duration <= 0) err(`${tag} duration is ${duration}; it must be positive`);
    durations.push(Number(duration.toFixed(4)));
    for (const [si, s] of samplers.entries()) {
      if (!isIndex(s.input, accessors.length) || !isIndex(s.output, accessors.length)) err(`${tag} sampler ${si} input/output accessor is out of range (${accessors.length} accessors)`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      bytes: buf.length,
      skins: skins.length,
      joints: jointSet.size,
      animations: animations.map((a, i) => a.name || `(unnamed ${i})`),
      channels: channelCount,
      jointChannels,
      durations,
      images: list(gltf.images).length,
      containerClips: container.clips.length,
    },
  };
}

export function checkFile(path) {
  const buf = readFileSync(path);
  return { path, sha256: createHash("sha256").update(buf).digest("hex"), ...validateGlb(buf) };
}

export function main(argv, out = console.log) {
  if (argv.length < 1) {
    out("usage: node scripts/check-sourced-animation.mjs <file.glb> [more.glb ...]");
    return 2;
  }
  let failed = 0;
  for (const path of argv) {
    let r;
    try {
      r = checkFile(path);
    } catch (e) {
      out(`FAIL ${path}\n  cannot read: ${e.message}`);
      failed++;
      continue;
    }
    out(`${r.ok ? "PASS" : "FAIL"} ${path}`);
    out(`  sha256 ${r.sha256}`);
    const s = r.summary;
    if (s.skins !== undefined) out(`  ${s.bytes} bytes, ${s.skins} skin(s), ${s.joints} joint node(s), ${s.images} image(s), animations ${JSON.stringify(s.animations)}, ${s.channels} channel(s) (${s.jointChannels} on skin joints), durations ${JSON.stringify(s.durations)} s`);
    for (const e of r.errors) out(`  - ${e}`);
    if (!r.ok) failed++;
  }
  out(`${argv.length - failed}/${argv.length} file(s) passed structural checks (structure only; not motion quality)`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
