import * as T from "three";

const tau = Math.PI * 2;
const up = new T.Vector3(0, 1, 0);
const floor = 0.18;
const smooth = T.MathUtils.smoothstep;
const jewels = [0x14756e, 0x41d2c5, 0x34438c, 0x8764cb, 0x9a315f, 0xe25478, 0xd99b47];

function ground(p) {
  return p.clone().setY(floor);
}

function contactStar(b, p, age, color, count, radius) {
  if (age < 0 || age >= 0.24) return;
  const flash = 1 - smooth(age, 0, 0.24);
  const center = p.clone().addScaledVector(b.toward, 0.13);
  for (let i = 0; i < count; i++) {
    const angle = tau * i / count + 0.18;
    const ray = b.cameraRight.clone().multiplyScalar(Math.cos(angle)).addScaledVector(b.cameraUp, Math.sin(angle));
    const length = radius * (i % 2 ? 0.56 : 1);
    b.bar(center.clone().addScaledVector(ray, 0.09 + length * (1 - flash)),
      center.clone().addScaledVector(ray, 0.09 + length), color, 0.082 * flash);
  }
}

function drawVoid(b, source, target, t, edge) {
  const age = t - edge;
  const flight = smooth(t, 0.26, 0.85);
  const fall = smooth(age, -0.32, 0);
  const crown = target.clone().addScaledVector(up, 1.52);
  const center = source.clone().lerp(crown, flight).lerp(target, fall);
  center.y += 0.42 * Math.sin(Math.PI * flight);
  const disc = (0.23 + 0.77 * smooth(t, 0.68, edge - 0.38)) * smooth(t, 0, 0.30) * (1 - fall);
  if (disc > 0.008) {
    const core = disc * 0.54;
    b.mesh("sphere", 0x0d0818, center, 2 * core);
    b.ring(center, core * 1.04, 0xefb9ff, 0.055 * disc, "screen");
    // Tilt the orbit through the silhouette so its near arm eclipses the black core.
    const major = b.cameraRight.clone().multiplyScalar(0.972).addScaledVector(b.cameraUp, 0.235);
    const minor = b.cameraUp.clone().multiplyScalar(0.40).addScaledVector(b.cameraRight, -0.097)
      .addScaledVector(b.toward, 0.91);
    for (let arm = 0; arm < 5; arm++) {
      const points = [];
      for (let j = 0; j <= 27; j++) {
        const f = j / 27;
        const angle = t * 2.4 + arm * tau / 5 + f * 3.85;
        const r = disc * (0.71 + f * (0.82 + 0.07 * arm));
        points.push(center.clone().addScaledVector(major, r * Math.cos(angle))
          .addScaledVector(minor, r * Math.sin(angle)));
      }
      b.ribbon(points, disc * (arm % 2 ? 0.075 : 0.14), [0xad63e3, 0xdd9af2, 0x7943b7, 0xf5cda7, 0x9856d2][arm]);
    }
  }
  const lift = smooth(t, 0.60, 1.10) * (1 - fall);
  if (lift > 0.005) {
    for (let i = 0; i < 30; i++) {
      const f = ((t - 0.60) * (0.48 + (i % 4) * 0.04) + i * 0.618034) % 1;
      const angle = i * 2.39996 + f * (1.4 + f * 2.7);
      const r = (1.52 + (i % 5) * 0.15) * (1 - f * f);
      const p = ground(target).lerp(center, f * f);
      p.x += Math.cos(angle) * r;
      p.z += Math.sin(angle) * r;
      const size = lift * Math.sin(Math.PI * f) * (i % 3 ? 0.13 : 0.24);
      b.mesh(i % 3 ? "shard" : "box", [0x856983, 0xc18adb, 0x74547d][i % 3], p,
        [size, size * 1.3, size * 0.85], [f * 5, angle, i]);
    }
  }
  const echo = smooth(t, 0.66, 1.24) * (1 - smooth(age, 0.18, 1.25));
  if (echo > 0.005) {
    const base = ground(target);
    base.y += 0.035;
    for (let i = 0; i < 7; i++) {
      const points = [];
      for (let j = 0; j <= 12; j++) {
        const f = j / 12;
        const a = i * tau / 7 + t * 1.32 + f * 1.9;
        const r = (0.50 + f * 1.33) * (0.80 + 0.20 * echo + 0.24 * smooth(age, 0, 0.32));
        points.push(base.clone().addScaledVector(new T.Vector3(Math.cos(a), 0, Math.sin(a)), r));
      }
      b.ribbon(points, echo * 0.075, i % 2 ? 0x8150bb : 0xab64d0);
    }
  }
  contactStar(b, target, age, 0xffead6, 10, 1.04);
  if (age >= 0 && age < 0.52) {
    const fade = 1 - smooth(age, 0, 0.52);
    b.ring(target, 0.20 + 1.20 * (1 - fade), 0xcf8af2, 0.085 * fade, "screen");
    b.light(target, 0xe1aaff, 8 * fade, 4.5);
  }
}

function drawPrism(b, source, target, t, edge) {
  const age = t - edge;
  const origin = ground(source);
  origin.y += 0.035;
  const forward = ground(target).sub(ground(source));
  const distance = forward.length();
  if (distance > 0.001) forward.divideScalar(distance);
  else forward.set(1, 0, 0);
  const side = forward.clone().cross(up);
  const length = distance + 0.72;
  const half = Math.min(1.98, length * 0.40);
  const pane = (f, lateral) => origin.clone().addScaledVector(forward, f * length).addScaledVector(side, lateral);
  const front = smooth(t, 0.32, edge - 0.12);
  const clear = smooth(age, 0.24, 1.22);
  const charge = smooth(t, 0, 0.25) * (1 - smooth(t, 0.50, 1.04));
  if (charge > 0.005) {
    b.mesh("shard", 0xffd4ad, source, [0.22 * charge, 0.43 * charge, 0.22 * charge], [0, t * 3, 0]);
    const corners = [0, 1, 2].map(i => {
      const a = tau * i / 3 + t * 0.85;
      return source.clone().addScaledVector(b.cameraRight, Math.sin(a) * charge * 0.45)
        .addScaledVector(b.cameraUp, Math.cos(a) * charge * 0.45);
    });
    for (let i = 0; i < 3; i++) {
      b.bar(corners[i], corners[(i + 1) % 3], jewels[i * 2 + 1], 0.062 * charge);
      if (front > 0.001) b.bar(corners[i], pane(front, (i - 1) * half * front), jewels[i * 2 + 1], 0.036 * charge);
    }
  }
  // Alternate the tips of adjacent panes. The exposed board forms dark leading between them.
  const rows = 8;
  const face = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side, forward, up));
  const reversed = face.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI));
  for (let row = 0; row < rows; row++) {
    const reveal = smooth(front * rows, row, row + 1) * (1 - smooth(clear * rows, row, row + 1));
    if (reveal < 0.005) continue;
    for (let col = 0; col <= row * 2; col++) {
      const odd = col % 2;
      const lane = col - row;
      const p = pane((row + (odd ? 1 / 3 : 2 / 3)) / rows, lane * half / rows);
      const color = jewels[(row + Math.abs(lane) * 2 + odd) % jewels.length];
      b.mesh("triangle", color, p, [2 * half / rows * 0.94 * reveal, length / rows * 0.94 * reveal, 1],
        odd ? face : reversed);
    }
  }
  if (front - clear > 0.005) {
    for (const sign of [-1, 1]) {
      b.bar(pane(clear, sign * half * clear), pane(front, sign * half * front), 0xe3bd94, 0.062);
    }
    for (const f of [0.375, 0.75, 1]) {
      const spread = smooth(front, f - 0.08, f) * (1 - smooth(clear, f - 0.08, f));
      if (spread > 0.005) b.bar(pane(f, -half * f * spread), pane(f, half * f * spread), 0xe3bd94, 0.055);
    }
  }
  if (age < 0) return;
  contactStar(b, target, age, 0xfff3de, 8, 0.98);
  const glow = 1 - smooth(age, 0, 0.30);
  if (glow > 0) b.light(target, 0xfad9ff, 8 * glow, 4.4);
  for (let i = 0; i < 11; i++) {
    const a = i * tau / 11;
    const away = forward.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
    const base = ground(target).addScaledVector(away, 0.88 + (i % 3) * 0.24);
    const grow = (0.14 + 0.86 * smooth(age, 0, 0.18 + i % 3 * 0.05)) *
      (1 - smooth(age, 0.34 + i % 3 * 0.06, 0.85 + i % 3 * 0.06));
    if (grow < 0.005) continue;
    const axis = up.clone().addScaledVector(away, 0.22).normalize();
    const h = (1.04 + 0.39 * (i % 4)) * grow;
    const p = base.addScaledVector(axis, h / 2);
    const q = new T.Quaternion().setFromUnitVectors(up, axis);
    b.mesh("crystal", jewels[(i * 3 + 1) % 7], p, [0.38 * grow, h, 0.38 * grow], q);
    b.mesh("crystal", i % 2 ? 0xf3cfdd : 0xbaffef, p.clone().addScaledVector(b.toward, grow * 0.095),
      [0.066 * grow, h * 0.90, 0.066 * grow], q);
  }
  for (let i = 0; i < 26; i++) {
    const f = (age - 0.18 - (i % 5) * 0.036) / 0.90;
    if (f <= 0 || f >= 1) continue;
    const a = i * 2.39996;
    const r = 0.48 + (0.88 + i % 4 * 0.16) * f;
    const p = ground(target).addScaledVector(forward, r * Math.cos(a)).addScaledVector(side, r * Math.sin(a));
    p.y += (1 - f) * 0.58 + Math.sin(f * Math.PI) * (1.15 + i % 3 * 0.35);
    const size = (0.16 + i % 3 * 0.05) * Math.sin(f * Math.PI);
    b.mesh("shard", jewels[i % 7], p, [size, size * 1.65, size * 0.5], [a, f * 6, a + f * 4]);
  }
}

function drawChains(b, source, target, t, edge) {
  const age = t - edge;
  const right = b.cameraRight.clone().setY(0).normalize();
  const front = right.clone().cross(up);
  for (let i = 0; i < 4; i++) {
    const radial = right.clone().multiplyScalar(i % 2 ? 0.78 : -0.78).addScaledVector(front, i < 2 ? -0.62 : 0.62);
    const across = radial.clone().cross(up);
    const base = ground(target).addScaledVector(radial, 1.95);
    const start = i * 0.07;
    const seed = smooth(t, start, start + 0.46);
    if (seed > 0 && seed < 1) {
      const p = source.clone().lerp(base, seed);
      p.y += 0.66 * Math.sin(Math.PI * seed);
      const size = 0.20 * Math.sin(Math.PI * seed);
      b.mesh("shard", 0xa5e697, p, [size, size * 1.75, size], [t, i, t * 3]);
    }
    const anchor = smooth(t, start + 0.42, start + 0.72) * (1 - smooth(age, 0.72, 1.25));
    if (anchor < 0.005) continue;
    const axis = up.clone().addScaledVector(radial, 0.18).normalize();
    const q = new T.Quaternion().setFromUnitVectors(up, axis);
    const h = (i < 2 ? 1.36 : 0.98) * anchor;
    const socket = base.clone().addScaledVector(axis, h * 0.72);
    b.mesh("box", 0x195448, base.clone().addScaledVector(axis, h * 0.33), [0.33 * anchor, h * 0.66, 0.33 * anchor], q);
    b.mesh("box", 0x9fe999, socket, [0.36 * anchor, 0.095 * anchor, 0.36 * anchor], q);
    b.mesh("crystal", 0x39a678, base.clone().addScaledVector(axis, h * 0.92), [0.44 * anchor, h * 0.40, 0.44 * anchor], q);
    const end = target.clone().addScaledVector(radial, -0.34).addScaledVector(up, i < 2 ? 0.035 : -0.065);
    const cinch = smooth(age, -0.22, 0);
    const extension = (0.70 * smooth(t, start + 0.63, edge - 0.25) + 0.30 * cinch) * (1 - smooth(age, 0.22, 0.84));
    if (extension <= 0.001) continue;
    const path = f => {
      const bend = Math.sin(Math.PI * f);
      return socket.clone().lerp(end, f).addScaledVector(up, bend * (0.64 - 0.50 * cinch))
        .addScaledVector(across, bend * (i % 2 ? -1 : 1) * (0.46 - 0.32 * cinch));
    };
    const links = 8;
    for (let j = 0; j < links && j / links < extension; j++) {
      const a = path(j / links);
      const z = path(Math.min((j + 1) / links, extension));
      const along = z.clone().sub(a);
      const span = along.length();
      if (span < 0.035) continue;
      along.divideScalar(span);
      const cross = b.toward.clone().cross(along);
      if (cross.lengthSq() < 0.0001) cross.copy(b.cameraRight).cross(along);
      cross.normalize().applyAxisAngle(along, j % 2 ? 0.76 : -0.76).multiplyScalar(Math.min(0.12, span * 0.5));
      a.addScaledVector(along, -span * 0.12);
      z.addScaledVector(along, span * 0.12);
      const l = a.clone().sub(cross), r = a.clone().add(cross);
      const s = z.clone().sub(cross), v = z.clone().add(cross);
      b.bar(l, s, 0x247851, 0.059);
      b.bar(s, v, 0x56c082, 0.055);
      b.bar(v, r, j % 2 ? 0x83dc94 : 0x53be87, 0.059);
      b.bar(r, l, 0x389969, 0.055);
    }
    const tip = path(extension);
    const heading = tip.clone().sub(path(extension - 0.01)).normalize();
    b.mesh("crystal", age < 0 ? 0x96e390 : 0xb6f4aa, tip, [0.19, 0.32, 0.19],
      new T.Quaternion().setFromUnitVectors(up, heading));
  }
  contactStar(b, target, age, 0xe7ffc0, 6, 0.70);
  if (age >= 0 && age < 0.32) b.light(target, 0xa9ff98, 7 * (1 - smooth(age, 0, 0.32)), 4);
  // Bent two-sided remnants fly free when the four strands start to recoil.
  if (age < 0.22 || age >= 0.96) return;
  const f = (age - 0.22) / 0.74;
  for (let i = 0; i < 9; i++) {
    const a = tau * i / 9 + 0.3;
    const dir = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(front, Math.sin(a));
    const p = target.clone().addScaledVector(dir, 0.20 + 1.28 * f);
    p.y = T.MathUtils.lerp(target.y, floor + 0.08, f) + Math.sin(Math.PI * f) * (0.50 + i % 3 * 0.20);
    const size = 0.18 * (1 - smooth(f, 0.52, 1));
    const arm = up.clone().applyAxisAngle(dir, i + 5 * f);
    b.bar(p, p.clone().addScaledVector(arm, size), 0x85d59c, size * 0.31);
    b.bar(p, p.clone().addScaledVector(dir, size * 0.75), 0x409768, size * 0.31);
  }
}

export function drawVoidPrismChains(brush, name, { source, target, t, edge }) {
  if (t < 0 || t >= edge + 1.25) return;
  if (name === "void") drawVoid(brush, source, target, t, edge);
  if (name === "prism") drawPrism(brush, source, target, t, edge);
  if (name === "chains") drawChains(brush, source, target, t, edge);
}
