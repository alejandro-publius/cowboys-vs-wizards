// Original chunky stylized Sheriff for Cowboys vs Wizards / Our Castle.
// Faces +X (toward the Dragon), grounded at Y=0, ~2.3 units tall.
import * as T from "three";

const PAL = {
  coat: 0x825336,
  coatDark: 0x5e3b2e,
  coatLight: 0xcead81,
  shirt: 0xf1e3c4,
  scarf: 0xae4737,
  scarfDark: 0x7e3029,
  skin: 0xe9b48c,
  skinRuddy: 0xd98c6c,
  hair: 0x5b3a22,
  stache: 0x4a2c18,
  hat: 0xc79a5c,
  hatBand: 0x5a3820,
  boots: 0x7a4a26,
  bootsDark: 0x4e2f18,
  pants: 0x4b4256,
  belt: 0x4a2c16,
  brass: 0xd8a63a,
  iron: 0x4f555c,
  wood: 0x7b4a2a,
  eye: 0x1c1410,
  thread: 0xd3a26d,
  feltEdge: 0xe9bd78,
  moustacheGrey: 0x9a7353,
};

function mat(color, o = {}) {
  return new T.MeshStandardMaterial({
    color,
    roughness: o.r ?? 0.72,
    metalness: o.m ?? 0,
    side: o.side ?? T.FrontSide,
  });
}
const M = {
  coat: mat(PAL.coat),
  coatDark: mat(PAL.coatDark),
  coatLight: mat(PAL.coatLight),
  coatPanel: mat(PAL.coat, { side: T.DoubleSide }),
  lining: mat(PAL.coatDark, { side: T.DoubleSide }),
  shirt: mat(PAL.shirt),
  scarf: mat(PAL.scarf, { r: 0.8 }),
  scarfDark: mat(PAL.scarfDark, { r: 0.8 }),
  skin: mat(PAL.skin, { r: 0.6 }),
  ruddy: mat(PAL.skinRuddy, { r: 0.6 }),
  hair: mat(PAL.hair),
  stache: mat(PAL.stache, { r: 0.85 }),
  hat: mat(PAL.hat, { r: 0.8 }),
  hatBrim: mat(PAL.hat, { r: 0.8, side: T.DoubleSide }),
  band: mat(PAL.hatBand),
  boots: mat(PAL.boots, { r: 0.5 }),
  bootsDark: mat(PAL.bootsDark, { r: 0.55 }),
  pants: mat(PAL.pants),
  belt: mat(PAL.belt, { r: 0.55 }),
  brass: mat(PAL.brass, { r: 0.32, m: 0.85 }),
  iron: mat(PAL.iron, { r: 0.4, m: 0.75 }),
  wood: mat(PAL.wood, { r: 0.6 }),
  eye: mat(PAL.eye, { r: 0.3 }),
  thread: mat(PAL.thread, { r: 0.88 }),
  feltEdge: mat(PAL.feltEdge, { r: 0.84 }),
  moustacheGrey: mat(PAL.moustacheGrey),
};

function add(parent, geo, material, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new T.Mesh(geo, material);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function group(parent, p = [0, 0, 0], name = "") {
  const g = new T.Group();
  g.name = name;
  g.position.set(p[0], p[1], p[2]);
  parent.add(g);
  return g;
}
function anchor(parent, p, name) {
  const o = new T.Object3D();
  o.name = name;
  o.position.set(p[0], p[1], p[2]);
  parent.add(o);
  return o;
}
const sphere = (r, w = 18, h = 14) => new T.SphereGeometry(r, w, h);
const capsule = (r, len, seg = 12) => new T.CapsuleGeometry(r, len, 5, seg);
const cyl = (rt, rb, h, seg = 18) => new T.CylinderGeometry(rt, rb, h, seg);
const lathe = (pts, seg = 24) =>
  new T.LatheGeometry(
    pts.map(([x, y]) => new T.Vector2(x, y)),
    seg,
  );

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const lerp = (a, b, t) => a + (b - a) * t;
const clampN = (v) => Math.min(1, Math.max(-1, v));

function starGeometry() {
  const s = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.032 : 0.072;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  g.center();
  return g;
}

function brimGeometry() {
  // Wide oval brim, sides curled up, front dipped slightly.
  const g = new T.CylinderGeometry(1, 1, 0.032, 40, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const rn = Math.hypot(x, z);
    const curl = 0.12 * z * z * rn * rn;
    const dip = -0.035 * Math.max(0, x) * rn;
    p.setXYZ(i, x * 0.44, y + curl + dip, z * 0.52);
  }
  g.computeVertexNormals();
  return g;
}

function crownGeometry() {
  const g = lathe(
    [
      [0, 0],
      [0.235, 0],
      [0.245, 0.08],
      [0.232, 0.2],
      [0.2, 0.275],
      [0.11, 0.3],
      [0.03, 0.27],
      [0, 0.265],
    ],
    28,
  );
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const k = Math.max(0, y - 0.14) / 0.16;
    const pinch = 1 - 0.28 * k * Math.max(0, x / 0.24); // front pinch
    p.setXYZ(i, x * 0.92, y, z * pinch);
  }
  g.computeVertexNormals();
  return g;
}

function skirtPanel(theta0, len) {
  // Half-shell coat tail: flared tapered cylinder segment, hanging down from pivot.
  const h = 0.5;
  const g = new T.CylinderGeometry(0.255, 0.37, h, 14, 3, true, theta0, len);
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * 0.86);
  g.computeVertexNormals();
  return g;
}

function buildLeg(parent, side) {
  const L1 = 0.4,
    L2 = 0.4;
  const leg = group(parent, [0, 0.92, 0.13 * side], side > 0 ? "legNear" : "legFar");
  const thigh = group(leg, [0, 0, 0], "thigh");
  add(thigh, capsule(0.1, 0.24), M.pants, [0, -0.19, 0], [0, 0, 0], [1, 1, 0.95]);
  const knee = group(thigh, [0, -L1, 0], "knee");
  add(knee, sphere(0.088), M.pants);
  add(knee, capsule(0.082, 0.22), M.pants, [0, -0.17, 0]);
  const ankle = group(knee, [0, -L2, 0], "ankle");
  // Boot: flared shaft, rounded toe, heel, stitched top band.
  add(ankle, cyl(0.1, 0.085, 0.24), M.boots, [0, 0.07, 0]);
  add(ankle, new T.TorusGeometry(0.098, 0.018, 8, 18), M.bootsDark, [0, 0.19, 0], [Math.PI / 2, 0, 0]);
  add(ankle, sphere(1, 18, 12), M.boots, [0.06, -0.07, 0], [0, 0, 0.08], [0.165, 0.075, 0.09]);
  add(ankle, new T.BoxGeometry(0.075, 0.06, 0.12), M.bootsDark, [-0.07, -0.11, 0]);
  add(ankle, new T.BoxGeometry(0.3, 0.022, 0.15), M.bootsDark, [0.02, -0.129, 0]);
  return { leg, thigh, knee, ankle, L1, L2, side };
}

function solveLeg(L, hx, hy, ax, ay, footTilt = 0) {
  L.leg.position.x = hx;
  L.leg.position.y = hy;
  const vx = ax - hx,
    vy = ay - hy;
  const D = Math.min(L.L1 + L.L2 - 1e-3, Math.max(0.25, Math.hypot(vx, vy)));
  const base = Math.atan2(vx, -vy);
  const a = Math.acos(clampN((L.L1 * L.L1 + D * D - L.L2 * L.L2) / (2 * L.L1 * D)));
  const k = Math.acos(clampN((L.L1 * L.L1 + L.L2 * L.L2 - D * D) / (2 * L.L1 * L.L2)));
  L.thigh.rotation.z = base + a;
  L.knee.rotation.z = -(Math.PI - k);
  L.ankle.rotation.z = -(L.thigh.rotation.z + L.knee.rotation.z) + footTilt;
}

function buildArm(parent, side, burn) {
  const shoulder = group(parent, [0, 0.54, 0.33 * side], side > 0 ? "armNear" : "armFar");
  add(shoulder, sphere(0.115), M.shirt, [0, 0.01, 0], [0, 0, 0], [1, 0.95, 1]);
  add(shoulder, capsule(0.088, 0.19), M.shirt, [0, -0.15, 0]);
  const elbow = group(shoulder, [0, -0.3, 0], "elbow");
  add(elbow, sphere(0.084), M.skin);
  add(elbow, new T.CylinderGeometry(0.078, 0.07, 0.2, 14), M.skin, [0, -0.1, 0]);
  // Chunky turned-back cuff.
  add(elbow, cyl(0.1, 0.092, 0.075), M.coatLight, [0, -0.22, 0]);
  add(elbow, new T.TorusGeometry(0.098, 0.014, 6, 16), M.coatDark, [0, -0.185, 0], [Math.PI / 2, 0, 0]);
  burn.push(anchor(elbow, [0.02, -0.22, 0.09 * side], side > 0 ? "burnCuffNear" : "burnCuffFar"));
  const wrist = group(elbow, [0, -0.28, 0], "wrist");
  add(wrist, sphere(0.068), M.skin, [0, -0.03, 0], [0, 0, 0], [1.05, 1, 0.9]);
  add(wrist, capsule(0.026, 0.04, 8), M.skin, [0.04, -0.01, 0.045 * side], [0.6 * side, 0, 0]);
  return { shoulder, elbow, wrist, side };
}

function buildRevolver(parent) {
  const gun = group(parent, [0.01, -0.035, 0], "revolver");
  add(gun, new T.BoxGeometry(0.05, 0.11, 0.045), M.wood, [-0.025, -0.045, 0], [0, 0, 0.32]);
  add(gun, cyl(0.032, 0.032, 0.06, 12), M.brass, [0.045, 0.04, 0], [0, 0, Math.PI / 2]);
  add(gun, new T.BoxGeometry(0.1, 0.05, 0.04), M.iron, [0.035, 0.035, 0]);
  add(gun, cyl(0.016, 0.018, 0.2, 12), M.iron, [0.18, 0.05, 0], [0, 0, Math.PI / 2]);
  add(gun, cyl(0.022, 0.022, 0.025, 12), M.brass, [0.275, 0.05, 0], [0, 0, Math.PI / 2]);
  add(gun, new T.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), M.brass, [0.02, 0.0, 0], [0, 0, Math.PI]);
  add(gun, new T.BoxGeometry(0.02, 0.025, 0.012), M.iron, [-0.01, 0.07, 0], [0, 0, -0.4]);
  const muzzle = anchor(gun, [0.3, 0.05, 0], "muzzle");
  return { gun, muzzle };
}

export function makeSheriff() {
  const root = new T.Group();
  root.name = "Sheriff";
  const burn = [];

  // ---- Hips & coat tails ----
  const hips = group(root, [0, 0.94, 0], "hips");
  add(hips, sphere(1, 20, 14), M.pants, [0, -0.02, 0], [0, 0, 0], [0.2, 0.13, 0.25]);
  add(hips, cyl(0.26, 0.255, 0.075, 22), M.belt, [0, 0.03, 0], [0, 0, 0], [0.86, 1, 1]);
  add(hips, new T.BoxGeometry(0.03, 0.065, 0.1), M.brass, [0.225, 0.03, 0]);
  add(
    hips,
    new T.TorusGeometry(0.035, 0.008, 6, 16),
    M.thread,
    [0.249, 0.03, 0],
    [0, Math.PI / 2, 0],
    [1.31, 1, 1],
  );
  for (let i = 0; i < 5; i++) {
    const a = 0.42 + i * 0.18;
    add(hips, new T.CylinderGeometry(0.013, 0.015, 0.084, 8), M.brass, [
      Math.cos(a) * 0.229,
      0.018,
      Math.sin(a) * 0.249,
    ]);
  }
  add(hips, new T.BoxGeometry(0.12, 0.13, 0.07), M.belt, [0.04, -0.07, 0.27], [0, 0, 0.12]); // holster
  const gap = 0.42,
    split = 0.12;
  const tailNear = group(hips, [0, 0.03, 0], "tailNear");
  const tailFar = group(hips, [0, 0.03, 0], "tailFar");
  // theta 0 = +Z, PI/2 = +X (front). Near (+Z) panel spans back-split to front-gap.
  add(tailNear, skirtPanel(1.5 * Math.PI + split, Math.PI - gap - split), M.coatPanel);
  add(tailFar, skirtPanel(0.5 * Math.PI + gap, Math.PI - gap - split), M.coatPanel);
  add(
    tailNear,
    new T.TorusGeometry(0.37, 0.016, 6, 24, Math.PI - gap - split),
    M.coatDark,
    [0, -0.5, 0],
    [Math.PI / 2, 0, -(1.5 * Math.PI + split) + Math.PI / 2 - (Math.PI - gap - split)],
    [0.86, 1, 1],
  );
  add(
    tailFar,
    new T.TorusGeometry(0.37, 0.016, 6, 24, Math.PI - gap - split),
    M.coatDark,
    [0, -0.5, 0],
    [Math.PI / 2, 0, -(0.5 * Math.PI + gap) + Math.PI / 2 - (Math.PI - gap - split)],
    [0.86, 1, 1],
  );
  burn.push(anchor(tailNear, [-0.3, -0.45, 0.12], "burnTailNear"));
  burn.push(anchor(tailFar, [-0.3, -0.45, -0.12], "burnTailFar"));
  burn.push(anchor(tailNear, [0.1, -0.4, 0.33], "burnHemNear"));

  // ---- Legs (IK, attached to root so boots stay planted) ----
  const legs = [buildLeg(root, 1), buildLeg(root, -1)];

  // ---- Torso ----
  const torso = group(hips, [0, 0.04, 0], "torso");
  const chest = group(torso, [0, 0, 0], "chest");
  add(
    chest,
    lathe(
      [
        [0, -0.06],
        [0.24, -0.06],
        [0.255, 0.08],
        [0.27, 0.3],
        [0.29, 0.47],
        [0.25, 0.58],
        [0.13, 0.66],
        [0, 0.67],
      ],
      26,
    ),
    M.coat,
    [0, 0, 0],
    [0, 0, 0],
    [0.82, 1, 1],
  );
  add(chest, sphere(1, 18, 14), M.shirt, [0.13, 0.37, 0], [0, 0, 0.08], [0.12, 0.25, 0.12]);
  for (const s of [1, -1]) {
    add(
      chest,
      new T.BoxGeometry(0.05, 0.3, 0.09),
      M.coatDark,
      [0.215, 0.43, 0.095 * s],
      [0.28 * s, 0.25 * s, 0.05],
    );
    add(chest, sphere(0.018, 10, 8), M.brass, [0.235, 0.15 + (s > 0 ? 0 : 0.1), 0.07 * s]);
    for (let j = 0; j < 7; j++) {
      const y = 0.152 + j * 0.043;
      add(
        chest,
        new T.BoxGeometry(0.014, 0.024, 0.009),
        M.thread,
        [0.192 + Math.sin(j * 0.27) * 0.027, y, s * (0.141 + 0.008 * j)],
        [0, 0.24 * s, -0.1],
      );
    }
    add(
      chest,
      new T.BoxGeometry(0.053, 0.131, 0.127),
      M.coatDark,
      [0.135, 0.23, s * 0.227],
      [0, 0.44 * s, -0.14],
    );
    add(
      chest,
      new T.BoxGeometry(0.057, 0.022, 0.143),
      M.thread,
      [0.141, 0.303, s * 0.231],
      [0, 0.44 * s, -0.14],
    );
  }
  add(chest, starGeometry(), M.brass, [0.23, 0.4, 0.14], [0, Math.PI / 2 - 0.35, 0.05]);
  add(chest, sphere(0.014, 8, 6), M.brass, [0.255, 0.4, 0.15]);
  burn.push(anchor(chest, [0.2, 0.3, -0.12], "burnCoatChest"));
  burn.push(anchor(chest, [-0.2, 0.35, 0.05], "burnCoatBack"));

  // Scarf: thick ring, knot, and two hanging tails.
  add(
    chest,
    new T.TorusGeometry(0.135, 0.055, 10, 22),
    M.scarf,
    [0, 0.66, 0],
    [Math.PI / 2, 0, 0],
    [0.95, 1.05, 1],
  );
  add(chest, sphere(0.06, 12, 10), M.scarf, [0.15, 0.62, 0.02]);
  add(chest, new T.ConeGeometry(0.06, 0.17, 4), M.scarfDark, [0.17, 0.52, 0.05], [0, 0.3, Math.PI + 0.15]);
  add(chest, new T.ConeGeometry(0.05, 0.14, 4), M.scarf, [0.165, 0.53, -0.04], [0, -0.3, Math.PI - 0.2]);
  for (const [px, py, pz] of [
    [0.185, 0.652, 0.088],
    [0.16, 0.627, 0.118],
    [0.169, 0.612, -0.106],
    [0.179, 0.65, -0.081],
  ]) {
    add(chest, sphere(0.012, 8, 6), M.thread, [px, py, pz], [0, 0, 0], [0.73, 1.13, 1]);
  }

  const arms = [buildArm(chest, 1, burn), buildArm(chest, -1, burn)];
  const { muzzle } = buildRevolver(arms[0].wrist);
  const ropeGrip = anchor(arms[1].wrist, [0.03, -0.056, 0], "rope-grip");

  // ---- Head ----
  const head = group(chest, [0, 0.68, 0], "head");
  add(head, cyl(0.075, 0.085, 0.1, 12), M.skin, [0, 0.03, 0]);
  add(head, sphere(0.2, 22, 18), M.skin, [0.01, 0.2, 0], [0, 0, 0], [0.98, 1.0, 1.02]);
  add(head, sphere(0.16, 18, 14), M.skin, [0.05, 0.12, 0], [0, 0, 0], [1, 0.8, 1.05]); // round jowl/jaw
  add(head, sphere(0.15, 16, 12), M.hair, [-0.07, 0.19, 0], [0, 0, 0], [0.9, 1, 1.12]);
  add(head, sphere(0.055, 14, 12), M.ruddy, [0.205, 0.17, 0], [0, 0, 0], [0.9, 0.85, 1]); // nose
  for (const s of [1, -1]) {
    add(head, sphere(0.045, 10, 8), M.skin, [-0.01, 0.18, 0.2 * s], [0, 0, 0], [0.6, 1, 0.5]); // ears
    add(head, sphere(0.028, 10, 8), M.eye, [0.18, 0.235, 0.075 * s], [0, 0, 0], [0.6, 1.1, 1]);
    add(head, new T.BoxGeometry(0.03, 0.022, 0.07), M.stache, [0.19, 0.285, 0.078 * s], [0.18 * s, 0, 0]);
    add(head, sphere(0.035, 10, 8), M.ruddy, [0.165, 0.15, 0.12 * s], [0, 0, 0], [0.5, 0.7, 1]); // cheeks
    add(head, capsule(0.03, 0.09, 8), M.stache, [0.205, 0.105, 0.065 * s], [0.95 * s, 0, 0]);
    add(head, sphere(0.032, 10, 8), M.stache, [0.19, 0.07, 0.13 * s]);
    add(head, capsule(0.019, 0.071, 7), M.moustacheGrey, [0.222, 0.103, s * 0.091], [0.91 * s, 0, -0.04]);
    add(head, new T.BoxGeometry(0.008, 0.012, 0.051), M.ruddy, [0.178, 0.194, s * 0.109], [s * 0.27, 0, 0]);
  }
  // ---- Hat ----
  const hat = group(head, [0, 0.3, 0], "hat");
  hat.rotation.z = -0.06;
  add(hat, brimGeometry(), M.hatBrim);
  add(hat, crownGeometry(), M.hat, [0, 0.01, 0]);
  add(hat, cyl(0.226, 0.236, 0.05, 28), M.band, [0, 0.045, 0], [0, 0, 0], [0.93, 1, 1]);
  add(hat, cyl(0.022, 0.022, 0.012, 12), M.brass, [0.012, 0.045, 0.232], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const angle = 0.21 + i * 0.43;
    add(hat, sphere(0.0105, 8, 5), M.feltEdge, [0.252 * Math.cos(angle), 0.053, 0.238 * Math.sin(angle)]);
  }

  // ---- Pose ----
  const near = arms[0],
    far = arms[1];
  function pose(state = {}) {
    const aim = clamp01(state.aim),
      recoil = clamp01(state.recoil),
      brace = clamp01(state.brace),
      fall = clamp01(state.fall);
    const t = Number.isFinite(state.time) ? state.time : 0;
    const breathe = Math.sin(t * 2.1);
    const sway = Math.sin(t * 1.3);
    const jolt = Math.sin(t * 31) * 0.015 * fall * (1 - fall) * 4;

    // Hips: grounded height unless hit (fall lifts and throws them back).
    const hy = 0.94 - 0.1 * brace + 0.004 * breathe * (1 - fall) + 0.12 * fall + jolt;
    const hx = -0.03 * recoil - 0.3 * fall;
    hips.position.set(hx, hy, 0);
    hips.rotation.z = 0.3 * fall;

    // Legs: feet planted on Y=0 (ankle 0.14), lead foot forward when bracing.
    const stance = lerp(0.13, 0.17, brace);
    const feet = [
      [lerp(0.04, 0.15, brace) - 0.05 * fall, 0.14 + 0.2 * fall],
      [lerp(-0.03, -0.15, brace) - 0.16 * fall, 0.14 + 0.05 * fall],
    ];
    legs.forEach((L, i) => {
      L.leg.position.z = stance * L.side;
      solveLeg(L, hx, hy - 0.02, feet[i][0], feet[i][1], -0.35 * fall * (i ? 0.4 : 1));
    });

    // Torso lean: forward into brace/aim, back on recoil and fall.
    torso.rotation.z = -0.14 * brace - 0.04 * aim + 0.12 * recoil + 0.35 * fall;
    torso.rotation.y = 0.12 * aim * (1 - fall);
    chest.scale.set(1, 1 + 0.012 * breathe, 1 + 0.008 * breathe);

    // Head: steady along the aim; chin tucks down on hit.
    head.rotation.z = 0.1 * brace + 0.03 * aim - 0.06 * recoil - 0.5 * fall;
    head.rotation.y = -0.12 * aim * (1 - fall);
    head.rotation.x = 0.03 * sway * (1 - aim);

    // Gun arm (near camera, +Z).
    let sz = lerp(0.18, Math.PI / 2 - 0.08, aim),
      sx = lerp(-0.08, 0.1, aim);
    let ez = lerp(0.65, 0.06, aim) + 0.3 * recoil;
    sz += 0.12 * recoil;
    // Support arm (-Z): hangs, or crosses to steady the gun hand when bracing+aiming.
    const support = brace * aim;
    let fz = lerp(lerp(0.08, 0.35, brace), 1.35, support),
      fx = lerp(0.12, -0.55, support);
    let fez = lerp(lerp(0.25, 0.7, brace), 0.45, support);
    // React: arms thrown up when hit.
    const fsz = 2.55 + 0.08 * Math.sin(t * 9),
      fsx = -0.35;
    sz = lerp(sz, fsz, fall);
    sx = lerp(sx, fsx, fall);
    ez = lerp(ez, 0.45, fall);
    fz = lerp(fz, fsz - 0.15, fall);
    fx = lerp(fx, 0.35, fall);
    fez = lerp(fez, 0.5, fall);
    near.shoulder.rotation.set(sx, 0, sz);
    near.elbow.rotation.set(0, 0, ez);
    far.shoulder.rotation.set(fx, 0, fz);
    far.elbow.rotation.set(0, 0, fez);
    // Wrist keeps the revolver level along +X, muzzle flips on recoil, flops on fall.
    near.wrist.rotation.set(0, 0, lerp(-(sz + ez) + 0.05 + 0.5 * recoil, -0.4, fall));
    far.wrist.rotation.set(0, 0, -0.2 * support);

    // Coat tails: gentle sway, flick on recoil, flare under brace, lift on hit.
    const tz =
      0.03 * sway * (1 - fall) - 0.18 * recoil - 0.05 * brace + 0.45 * fall + 0.02 * Math.sin(t * 13) * fall;
    const tx = 0.08 * brace + 0.1 * recoil + 0.55 * fall;
    tailNear.rotation.set(-tx, 0, tz);
    tailFar.rotation.set(tx, 0, tz + 0.02 * Math.sin(t * 1.7));
    return root;
  }

  pose({ aim: 0, recoil: 0, brace: 0, fall: 0, time: 0 });
  root.userData.muzzle = muzzle;
  root.userData.burn = burn;
  return { root, pose, muzzle, ropeGrip, burn };
}

export default makeSheriff;
