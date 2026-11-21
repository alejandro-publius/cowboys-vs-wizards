// Graveyard Dragon: original chunky toy-miniature model.
// Root sits with feet at Y=0, faces -X. Tail runs toward +X. Best viewed from (+.2,+.49,+1).
import * as T from "three";

const C = {
  body: 0x77465f, // plum scales
  bodyDark: 0x50364f,
  belly: 0xd9cfae, // old bone
  plum: 0x4a2a4f, // wing supports, ridges
  lavender: 0x9674ae, // membranes
  lavenderHi: 0xbb9acb,
  horn: 0xece3c8,
  brass: 0xc9963a,
  glow: 0x6dff8a,
  socket: 0x2a1830,
  dark: 0x141014,
};

// ---------- geometry helpers ----------

// Box with rounded/bevelled edges; normals point away from the inner core for soft carved shading.
function rbox(w, h, d, r = 0.06, seg = 4) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const g = new T.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position,
    n = g.attributes.normal;
  const hx = w / 2 - r,
    hy = h / 2 - r,
    hz = d / 2 - r;
  const v = new T.Vector3(),
    c = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(T.MathUtils.clamp(v.x, -hx, hx), T.MathUtils.clamp(v.y, -hy, hy), T.MathUtils.clamp(v.z, -hz, hz));
    v.sub(c).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

// Scale Y/Z of a geometry along X: f(t) with t=0 at min X, 1 at max X.
function taperX(g, f) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) - min.x) / (max.x - min.x || 1);
    const s = f(t);
    p.setY(i, p.getY(i) * s);
    p.setZ(i, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

// Painted look: bake a top-lit gradient plus soft normal shading into vertex colours.
function paint(g, hex, lo = 0.6, hi = 1.12) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const p = g.attributes.position,
    n = g.attributes.normal;
  const base = new T.Color(hex),
    col = new T.Color();
  const arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - min.y) / (max.y - min.y || 1);
    const k = T.MathUtils.lerp(lo, hi, t) + (n ? 0.1 * n.getY(i) : 0);
    col.copy(base).multiplyScalar(k);
    arr[i * 3] = Math.min(col.r, 1);
    arr[i * 3 + 1] = Math.min(col.g, 1);
    arr[i * 3 + 2] = Math.min(col.b, 1);
  }
  g.setAttribute("color", new T.BufferAttribute(arr, 3));
  return g;
}

function makeMats() {
  const std = (o) => new T.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, ...o });
  return {
    paint: std({ roughness: 0.85, metalness: 0 }),
    brass: std({ roughness: 0.38, metalness: 0.6 }),
    membrane: std({ roughness: 0.9, side: T.DoubleSide }),
    glow: new T.MeshStandardMaterial({
      color: C.glow,
      emissive: C.glow,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    }),
    eye: new T.MeshStandardMaterial({
      color: 0xc8ffb0,
      emissive: C.glow,
      emissiveIntensity: 1.0,
      roughness: 0.3,
    }),
    dark: new T.MeshStandardMaterial({ color: C.dark, roughness: 0.6 }),
  };
}

function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  if (parent) parent.add(o);
  return o;
}

// Bar from a to b (Vector2 in XY plane), square section with bevel.
function bar(a, b, th, m, parent, z = 0) {
  const len = a.distanceTo(b);
  const o = mesh(
    paint(rbox(len + th * 0.6, th, th, th * 0.3, 2), C.plum, 0.7, 1.15),
    m,
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    z,
    parent,
  );
  o.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  return o;
}

// ---------- parts ----------

function makeLeg(M, back) {
  const g = new T.Group();
  const s = back ? 1.12 : 1;
  mesh(paint(rbox(0.36 * s, 0.48, 0.3 * s, 0.1), C.body), M.paint, back ? 0.03 : 0, -0.2, 0, g); // thigh / haunch
  mesh(paint(rbox(0.26, 0.42, 0.25, 0.08), C.bodyDark, 0.7, 1.1), M.paint, back ? 0.05 : -0.02, -0.56, 0, g); // shin
  mesh(paint(rbox(0.22, 0.14, 0.2, 0.05), C.belly), M.paint, back ? 0.0 : -0.07, -0.44, 0, g); // knee cap
  mesh(paint(rbox(0.4, 0.13, 0.32, 0.05), C.bodyDark, 0.65, 1.05), M.paint, -0.07, -0.785, 0, g); // foot
  const clawG = paint(new T.ConeGeometry(0.045, 0.14, 6).rotateZ(Math.PI / 2), C.horn);
  for (const z of [-0.1, 0, 0.1]) mesh(clawG, M.paint, -0.31, -0.81, z, g);
  return g;
}

function makeWing(M, side) {
  // side = +1 near (camera) wing, -1 far wing. Local plane XY: +X back, +Y up.
  const pivot = new T.Group(); // flap about X
  const fold = new T.Group(); // sweep about Y
  pivot.add(fold);
  const root = new T.Vector2(0, 0);
  const tips = [
    [-0.12, 1.42],
    [0.38, 1.22],
    [0.82, 0.92],
    [1.14, 0.52],
    [1.26, 0.12],
  ].map(([x, y]) => new T.Vector2(x, y));
  // supports
  tips.forEach((t, i) => bar(root, t, i === 0 ? 0.085 : 0.065, M.paint, fold));
  // gate rail across the supports
  const rail = tips.map((t) => root.clone().lerp(t, 0.5));
  for (let i = 0; i < rail.length - 1; i++) bar(rail[i], rail[i + 1], 0.05, M.paint, fold);
  // spear finials
  const finG = paint(new T.ConeGeometry(0.055, 0.2, 4), C.plum, 0.8, 1.3);
  tips.forEach((t) => {
    const f = mesh(finG, M.paint, 0, 0, 0, fold);
    const dir = t.clone().sub(root).normalize();
    f.position.set(t.x + dir.x * 0.08, t.y + dir.y * 0.08, 0);
    f.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;
  });
  // shoulder knuckle
  mesh(paint(new T.SphereGeometry(0.11, 10, 8), C.plum), M.paint, 0, 0, 0, fold);
  // carved membranes with scalloped, peaked trailing edges
  const ex = {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 6,
  };
  for (let i = 0; i < tips.length - 1; i++) {
    const a = tips[i],
      b = tips[i + 1];
    const mid = a.clone().lerp(b, 0.5);
    const notch = root.clone().lerp(mid, 0.78);
    const sh = new T.Shape();
    const shrink = (v, k) => v.clone().lerp(root.clone().lerp(mid, 0.45), k);
    const A = shrink(a, 0.06),
      B = shrink(b, 0.06);
    sh.moveTo(0.04, 0.04);
    sh.lineTo(A.x, A.y);
    const c1 = A.clone().lerp(notch, 0.5).lerp(mid, 0.35);
    const c2 = B.clone().lerp(notch, 0.5).lerp(mid, 0.35);
    sh.quadraticCurveTo(c1.x, c1.y, notch.x, notch.y);
    sh.quadraticCurveTo(c2.x, c2.y, B.x, B.y);
    sh.lineTo(0.04, 0.04);
    const g = new T.ExtrudeGeometry(sh, ex).translate(0, 0, -0.011);
    mesh(paint(g, C.lavender, 0.72, 1.08), M.membrane, 0, 0, 0, fold);
    // raised inner carved panel, both faces
    const inner = new T.ShapeGeometry(sh, 6);
    const cen = root.clone().lerp(mid, 0.5);
    inner.translate(-cen.x, -cen.y, 0).scale(0.62, 0.62, 1).translate(cen.x, cen.y, 0);
    for (const z of [0.026, -0.026])
      mesh(paint(inner.clone(), C.lavenderHi, 0.85, 1.1), M.membrane, 0, 0, z, fold);
  }
  return { pivot, fold, side };
}

function makeHead(M, glowMats) {
  const head = new T.Group();
  const skull = new T.Group();
  skull.position.x = -0.2;
  head.add(skull);
  // cranium and tapered snout
  mesh(paint(rbox(0.52, 0.38, 0.42, 0.11), C.body), M.paint, 0, 0.02, 0, skull);
  mesh(
    paint(
      taperX(rbox(0.44, 0.24, 0.32, 0.08, 4), (t) => 0.82 + 0.18 * t),
      C.body,
      0.65,
      1.15,
    ),
    M.paint,
    -0.38,
    -0.03,
    0,
    skull,
  );
  // upper lip plate (bone) above jaw line
  mesh(paint(rbox(0.5, 0.06, 0.3, 0.025), C.belly), M.paint, -0.34, -0.14, 0, skull);
  // nostrils
  const nos = new T.SphereGeometry(0.028, 8, 6);
  for (const z of [-0.09, 0.09]) mesh(nos, M.dark, -0.58, 0.05, z, skull);
  // almond eyes, slanted; no brow stripe
  for (const s of [-1, 1]) {
    const sock = mesh(
      new T.SphereGeometry(0.085, 12, 8),
      new T.MeshStandardMaterial({ color: C.socket, roughness: 0.7 }),
      -0.1,
      0.07,
      s * 0.19,
      skull,
    );
    sock.scale.set(1.25, 0.72, 0.5);
    sock.rotation.z = -0.32;
    const eye = mesh(new T.SphereGeometry(0.06, 12, 8), glowMats.eye, -0.11, 0.07, s * 0.215, skull);
    eye.scale.set(1.2, 0.62, 0.45);
    eye.rotation.z = -0.32;
    const pupil = mesh(new T.BoxGeometry(0.018, 0.07, 0.01), M.dark, -0.1, 0.07, s * 0.24, skull);
    pupil.rotation.z = -0.32;
  }
  // backward pale horns, two per side
  const hornA = paint(new T.ConeGeometry(0.075, 0.42, 7), C.horn, 0.75, 1.1);
  const hornB = paint(new T.ConeGeometry(0.05, 0.26, 6), C.horn, 0.75, 1.1);
  for (const s of [-1, 1]) {
    const h1 = mesh(hornA, M.paint, 0.26, 0.2, s * 0.14, skull);
    h1.rotation.set(s * -0.25, 0, -1.15);
    const h2 = mesh(hornB, M.paint, 0.22, 0.04, s * 0.2, skull);
    h2.rotation.set(s * -0.5, 0, -1.4);
  }
  // upper teeth
  const tooth = paint(new T.ConeGeometry(0.022, 0.07, 5).rotateX(Math.PI), C.horn);
  for (const x of [-0.52, -0.42, -0.32, -0.22])
    for (const z of [-0.12, 0.12]) mesh(tooth, M.paint, x, -0.19, z, skull);

  // lantern-gable brass lower jaw, hinged at the back of the skull
  const jaw = new T.Group();
  jaw.position.set(0.1, -0.15, 0);
  skull.add(jaw);
  const prof = new T.Shape();
  prof.moveTo(0.06, 0);
  prof.lineTo(-0.64, 0);
  prof.lineTo(-0.66, -0.07);
  prof.lineTo(-0.3, -0.22); // gable peak
  prof.lineTo(0.08, -0.1);
  prof.lineTo(0.06, 0);
  const jg = new T.ExtrudeGeometry(prof, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  jg.translate(0, 0, -0.13);
  jg.computeVertexNormals();
  mesh(paint(jg, C.brass, 0.6, 1.15), M.brass, 0, 0, 0, jaw);
  // gable ridge finial
  const fin = mesh(paint(new T.OctahedronGeometry(0.045), C.brass), M.brass, -0.3, -0.24, 0, jaw);
  fin.scale.y = 1.4;
  // three glowing slots per side, plus dark frames
  const slotG = new T.BoxGeometry(0.05, 0.09, 0.012);
  const frameG = paint(rbox(0.08, 0.12, 0.012, 0.004, 1), 0x6b4a1c);
  for (const s of [-1, 1]) {
    for (const x of [-0.46, -0.31, -0.16]) {
      mesh(frameG, M.brass, x, -0.09, s * 0.156, jaw);
      mesh(slotG, glowMats.glow, x, -0.09, s * 0.164, jaw);
    }
  }
  const lowTooth = paint(new T.ConeGeometry(0.02, 0.06, 5), C.horn);
  for (const x of [-0.55, -0.42, -0.29])
    for (const z of [-0.1, 0.1]) mesh(lowTooth, M.paint, x, 0.03, z, jaw);
  // glowing gullet visible when jaw opens
  mesh(new T.BoxGeometry(0.42, 0.02, 0.2), glowMats.glow, -0.32, -0.005, 0, jaw);

  // fire nozzle: local -Z points along head -X
  const mouth = new T.Object3D();
  mouth.name = "mouth";
  mouth.position.set(-0.6, -0.17, 0);
  mouth.rotation.y = Math.PI / 2;
  mouth.userData.forward = new T.Vector3(-1, 0, 0);
  skull.add(mouth);
  return { head, jaw, mouth };
}

// ---------- assembly ----------

export function makeDragon() {
  const M = makeMats();
  const glowMats = { glow: M.glow.clone(), eye: M.eye.clone() };
  const root = new T.Group();
  root.name = "GraveyardDragon";

  const body = new T.Group();
  body.position.set(0, 1.0, 0);
  root.add(body);
  // torso: broad chest, solid hips
  mesh(paint(rbox(0.98, 0.86, 0.86, 0.2), C.body), M.paint, -0.34, 0.05, 0, body);
  mesh(paint(rbox(0.86, 0.72, 0.76, 0.18), C.body), M.paint, 0.4, -0.02, 0, body);
  mesh(paint(rbox(1.2, 0.2, 0.6, 0.08), C.belly), M.paint, -0.1, -0.33, 0, body);
  const chestPlate = mesh(paint(rbox(0.22, 0.62, 0.62, 0.08), C.belly), M.paint, -0.8, -0.04, 0, body);
  chestPlate.rotation.z = -0.15;
  // belly bands
  for (const x of [-0.45, -0.15, 0.15])
    mesh(paint(rbox(0.06, 0.06, 0.62, 0.02), 0xb3a888), M.paint, x, -0.43, 0, body);
  // shoulder bulges
  for (const s of [-1, 1])
    mesh(paint(rbox(0.52, 0.52, 0.16, 0.08), C.bodyDark, 0.75, 1.2), M.paint, -0.44, 0.06, s * 0.43, body);
  // spine ridges
  const ridgeG = paint(new T.ConeGeometry(0.09, 0.2, 4), C.plum, 0.8, 1.25);
  for (const [x, y] of [
    [-0.6, 0.47],
    [-0.32, 0.5],
    [-0.04, 0.47],
    [0.24, 0.38],
    [0.52, 0.36],
  ]) {
    const r = mesh(ridgeG, M.paint, x, y, 0, body);
    r.rotation.z = -0.35;
    r.scale.z = 0.5;
  }

  // shoulder hit target facing the camera side
  const hit = new T.Object3D();
  hit.name = "hit";
  hit.position.set(-0.44, 0.06, 0.52);
  hit.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(0.2, 0.49, 1).normalize());
  body.add(hit);

  // legs (in root so feet stay grounded)
  const legs = [];
  for (const [x, z, back] of [
    [-0.45, 0.34, false],
    [-0.45, -0.34, false],
    [0.45, 0.35, true],
    [0.45, -0.35, true],
  ]) {
    const l = makeLeg(M, back);
    l.position.set(x, 0.85, z);
    root.add(l);
    legs.push({ g: l, back });
  }

  // neck chain
  const n0 = new T.Group();
  n0.position.set(-0.68, 0.3, 0);
  body.add(n0);
  mesh(paint(rbox(0.5, 0.4, 0.38, 0.13), C.body), M.paint, -0.2, 0, 0, n0);
  mesh(paint(rbox(0.42, 0.1, 0.26, 0.04), C.belly), M.paint, -0.2, -0.18, 0, n0);
  const n1 = new T.Group();
  n1.position.x = -0.42;
  n0.add(n1);
  mesh(paint(rbox(0.46, 0.32, 0.31, 0.11), C.body), M.paint, -0.2, 0, 0, n1);
  mesh(paint(rbox(0.38, 0.08, 0.22, 0.03), C.belly), M.paint, -0.2, -0.15, 0, n1);
  for (const [g, x] of [
    [n0, -0.2],
    [n1, -0.2],
  ]) {
    const r = mesh(ridgeG, M.paint, x, g === n0 ? 0.22 : 0.18, 0, g);
    r.rotation.z = -0.4;
    r.scale.set(0.8, 0.8, 0.5);
  }
  const { head, jaw, mouth } = makeHead(M, glowMats);
  head.position.x = -0.4;
  n1.add(head);

  // arcing tail chain
  const tail = [];
  let parent = body;
  const segN = 7,
    segL = 0.15;
  for (let i = 0; i < segN; i++) {
    const j = new T.Group();
    if (i === 0) j.position.set(0.75, -0.05, 0);
    else j.position.x = segL;
    parent.add(j);
    const r = T.MathUtils.lerp(0.2, 0.075, i / (segN - 1));
    mesh(paint(rbox(segL + r * 0.9, r * 2, r * 2, r * 0.6, 3), C.body), M.paint, segL / 2, 0, 0, j);
    if (i % 2 === 0) {
      const sp = mesh(ridgeG, M.paint, segL / 2, r + 0.03, 0, j);
      sp.rotation.z = -0.5;
      sp.scale.setScalar(0.75 - i * 0.05);
      sp.scale.z *= 0.5;
    }
    tail.push(j);
    parent = j;
  }
  // tombstone-spade tail tip
  const tipSh = new T.Shape();
  tipSh.moveTo(0, -0.08);
  tipSh.lineTo(0.12, -0.09);
  tipSh.quadraticCurveTo(0.22, 0, 0.12, 0.09);
  tipSh.lineTo(0, 0.08);
  tipSh.lineTo(0, -0.08);
  const tipG = new T.ExtrudeGeometry(tipSh, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  }).translate(0, 0, -0.025);
  tipG.computeVertexNormals();
  mesh(paint(tipG, C.horn, 0.7, 1.1), M.paint, segL, 0, 0, parent);

  // wings
  const wings = [makeWing(M, 1), makeWing(M, -1)];
  for (const w of wings) {
    w.pivot.position.set(-0.3, 0.42, w.side * 0.36);
    body.add(w.pivot);
  }

  // ---------- deterministic pose ----------
  const clamp01 = (v) => T.MathUtils.clamp(+v || 0, 0, 1);
  const tailBase = [-0.62, 0.22, 0.22, 0.22, 0.22, 0.24, 0.26];

  function pose({ charge = 0, breath = 0, recoil = 0, time = 0 } = {}) {
    const c = clamp01(charge),
      b = clamp01(breath),
      r = clamp01(recoil);
    const t = +time || 0;
    const idle = Math.sin(t * 1.8);
    const kick = Math.sin(r * Math.PI) * 0.4 + r * 0.6; // sharp early, held

    // body: crouch on charge, lunge slightly on breath, jerk back + rear on recoil
    body.position.set(-b * 0.06 + kick * 0.22, 1.0 + idle * 0.012 - c * 0.05 + kick * 0.05, 0);
    body.rotation.set(0, 0, c * 0.04 + b * 0.05 - kick * 0.22);

    for (const { g, back } of legs)
      g.rotation.z = (back ? 0.4 : 1) * (-kick * 0.18) + c * (back ? 0.05 : -0.04);

    // neck leans head forward while breathing; coils on charge; snaps up on recoil
    n0.rotation.z = -0.95 + idle * 0.03 - c * 0.2 + b * 0.45 - kick * 0.35;
    n1.rotation.z = 0.42 - c * 0.1 + b * 0.12 - kick * 0.15;
    head.rotation.z = 0.53 + c * 0.25 - b * 0.42 + kick * 0.25;
    jaw.rotation.z = 0.06 + c * 0.18 + b * 0.5 - kick * 0.06 + Math.max(0, idle) * 0.02;

    glowMats.glow.emissiveIntensity = 1.3 + c * 1.4 + b * 2.4 + Math.sin(t * 3.1) * 0.15;
    glowMats.eye.emissiveIntensity = 0.9 + c * 1.0 + b * 0.8;

    // wings flex: rise on charge, sweep back on breath, flare on recoil
    for (const w of wings) {
      const flap = 0.42 + Math.sin(t * 2.2) * 0.05 + c * 0.2 - b * 0.12 + kick * 0.35;
      w.pivot.rotation.set(w.side * flap, 0, -c * 0.08 - kick * 0.2);
      w.fold.rotation.set(0, w.side * (0.12 + b * 0.22 - kick * 0.25), 0);
    }

    // tail arc with gentle sway and whip on recoil
    tail.forEach((j, i) => {
      j.rotation.z = tailBase[i] + (i === 0 ? c * 0.08 + kick * 0.25 : -kick * 0.06);
      j.rotation.y = Math.sin(t * 1.4 - i * 0.55) * 0.06 + (i > 2 ? kick * 0.08 : 0);
    });
  }

  pose({});
  root.userData = { kind: "graveyardDragon", mouth, hit, pose };
  return { root, pose, mouth, hit };
}

export default makeDragon;
