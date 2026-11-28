import * as T from "three";

// Original geometry; motion reference: Alex's 2:29 AM recording, 0:36–0:40 and 0:44–0:49.
const floor = 0.18;
const turn = Math.PI * 2;
const up = new T.Vector3(0, 1, 0);
const smooth = T.MathUtils.smoothstep;
const iceFaces = [0x79e7ec, 0x429abf, 0x295a83, 0x347f98, 0x83d4df, 0xb9f5ed];

function polar(center, radius, angle, lift = 0) {
  return new T.Vector3(center.x + radius * Math.cos(angle), center.y + lift, center.z + radius * Math.sin(angle));
}

function frostSpire(b, foot, height, radius, lean, yaw) {
  if (height < 0.035 || radius < 0.012) return;
  const axis = up.clone().add(lean).normalize();
  const tilt = new T.Quaternion().setFromUnitVectors(up, axis);
  const waist = foot.clone().addScaledVector(axis, height * 0.53);
  const tip = foot.clone().addScaledVector(axis, height);
  for (let i = 0; i < 6; i++) {
    const angle = yaw + (i + 0.5) * turn / 6;
    const face = new T.Vector3(Math.sin(angle), 0, Math.cos(angle)).applyQuaternion(tilt);
    const center = foot.clone().lerp(waist, 0.5).addScaledVector(face, radius * 0.866);
    const rotation = tilt.clone().multiply(new T.Quaternion().setFromAxisAngle(up, angle));
    b.mesh("box", iceFaces[i], center, [radius, height * 0.53, radius * 0.044], rotation);
  }
  const cap = tilt.clone().multiply(new T.Quaternion().setFromAxisAngle(up, yaw));
  b.mesh("crystal", 0x91deed, waist.clone().lerp(tip, 0.5), [radius * 2, height * 0.47, radius * 2], cap);
  const ridge = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).applyQuaternion(tilt);
  b.bar(waist.addScaledVector(ridge, radius), tip, 0xe1fff7, radius * 0.18);
}

function snowflake(b, ground, t, edge) {
  const age = t - edge;
  const reveal = smooth(t, edge - 0.62, edge - 0.04);
  const life = reveal * (1 - smooth(age, 0.36, 1.12));
  if (life < 0.01) return;
  const crack = smooth(age, 0, 0.45);
  const flash = age >= 0 ? 1 - smooth(age, 0, 0.22) : 0;
  const radius = 1.65 * reveal + 0.43 * crack;
  const width = (0.055 + flash * 0.065) * life;
  const color = flash > 0.3 ? 0xf2fffa : age < 0 ? 0x6ab9ca : 0x8bdae0;
  for (let i = 0; i < 6; i++) {
    const angle = i * turn / 6 + Math.PI / 12;
    const outer = polar(ground, radius, angle);
    const next = polar(ground, radius, angle + turn / 6);
    const gap = 0.03 + crack * 0.23;
    b.bar(outer.clone().lerp(next, gap), outer.clone().lerp(next, 1 - gap), color, width);
    b.bar(polar(ground, (0.20 + 0.18 * crack) * radius, angle), outer, color, width);
    for (const side of [-1, 1]) {
      b.bar(polar(ground, radius * 0.52, angle), polar(ground, radius * 0.77, angle + side * 0.22), color, width);
      b.bar(polar(ground, radius * 0.77, angle), polar(ground, radius * 0.91, angle + side * 0.12), color, width * 0.8);
    }
  }
}

function frost(b, source, target, t, edge) {
  const age = t - edge;
  const ground = target.clone().setY(floor + 0.035);
  const start = source.clone().setY(floor + 0.035).lerp(ground, 0.15);
  const along = ground.clone().sub(start).normalize();
  const cross = new T.Vector3(-along.z, 0, along.x);
  const charge = smooth(t, 0, 0.34) * (1 - smooth(t, 0.36, 0.62));
  if (charge > 0.01) {
    for (let i = 0; i < 6; i++) {
      const a = i * turn / 6 + t * 2;
      const point = source.clone().addScaledVector(b.cameraRight, Math.cos(a) * 0.36 * charge)
        .addScaledVector(b.cameraUp, Math.sin(a) * 0.36 * charge);
      b.mesh("shard", i % 2 ? 0x82dade : 0xc6f4ee, point, [0.10 * charge, 0.29 * charge, 0.10 * charge], [0, 0, a - Math.PI / 2]);
    }
  }
  if (t > 0.34 && t < 0.65) {
    const travel = smooth(t, 0.34, 0.65);
    const tail = source.clone().lerp(start, Math.max(0, travel - 0.33));
    b.ribbon([tail, source.clone().lerp(start, travel)], 0.10, 0xadf6f2);
  }

  // A ripple of paired ice teeth carries the cast along the board.
  const step = (edge - 0.92) / 6;
  for (let i = 0; i < 7; i++) {
    const elapsed = t - (0.58 + i * step);
    const rise = smooth(elapsed, 0, 0.20) * (1 - smooth(elapsed, 0.44, 1.12));
    if (rise < 0.012) continue;
    const center = start.clone().lerp(ground, i * 0.135);
    for (const side of [-1, 1]) {
      const foot = center.clone().addScaledVector(cross, side * (0.16 + i * 0.042)).addScaledVector(along, side * 0.10);
      const height = 0.51 + i * 0.067 + (side === 1 ? 0.21 : 0);
      frostSpire(b, foot, height * rise, (0.14 + i * 0.013) * Math.sqrt(rise),
        along.clone().multiplyScalar(0.38).addScaledVector(cross, side * 0.16), 0.17 * i);
    }
  }

  snowflake(b, ground, t, edge);
  const right = b.cameraRight.clone().setY(0).normalize();
  const back = b.toward.clone().setY(0).normalize().negate();
  // The tallest facets bracket the chest in the board camera.
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const tier = Math.floor(i / 2);
    const rise = smooth(t, edge - 0.42 + tier * 0.09, edge + tier * 0.025)
      * (1 - smooth(age, 0.12 + tier * 0.035, 0.64 + tier * 0.08));
    const width = [0.27, 0.25, 0.18][tier];
    const foot = ground.clone().addScaledVector(right, side * [0.78, 1.19, 1.54][tier])
      .addScaledVector(back, [0.78, 0.13, -0.38][tier]);
    frostSpire(b, foot, (2.10 - tier * 0.48 + side * 0.10) * rise, width * Math.sqrt(rise),
      right.clone().multiplyScalar(side * (0.16 + tier * 0.07)), i * 0.39);
  }
  if (age < 0) return;
  const flash = 1 - smooth(age, 0, 0.18);
  if (flash > 0.01) {
    b.light(target, 0xcefffa, flash * 8, 5);
    b.mesh("shard", 0xf4fff9, target, [0.30 * flash, 0.74 * flash, 0.25 * flash]);
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) * turn / 6;
      const ray = b.cameraRight.clone().multiplyScalar(Math.cos(a)).addScaledVector(b.cameraUp, Math.sin(a));
      const inner = 0.17 + 0.70 * (1 - flash);
      b.bar(target.clone().addScaledVector(ray, inner), target.clone().addScaledVector(ray, inner + flash * 0.73), 0xedfff6, 0.075 * flash);
    }
  }
  const scatter = smooth(age, 0, 0.65);
  const settle = 1 - smooth(age, 0.65, 1.21);
  for (let i = 0; i < 24 && settle > 0.01; i++) {
    const a = i * 2.39996;
    const lane = i % 4;
    const lift = (1 - scatter) * (0.34 + lane * 0.26) + Math.sin(Math.PI * scatter) * (0.52 + lane * 0.16);
    const pos = polar(ground, 0.56 + scatter * (1.10 + lane * 0.13), a, 0.06 + lift);
    const size = (0.11 + lane * 0.022) * settle;
    b.mesh("shard", i % 3 ? 0x91dfe9 : 0xe4fff4, pos, [size, size * 1.9, size * 0.8],
      [a + scatter * 2.2, a, a - scatter]);
  }
}

function stormSeal(b, ground, t, edge) {
  const age = t - edge;
  const scale = smooth(t, 0.30, 1.25) * (1 - smooth(age, 0.56, 1.22));
  if (scale < 0.01) return;
  const spin = t * 0.78 + smooth(age, 0, 0.56) * 0.60;
  const flash = age >= 0 ? 1 - smooth(age, 0, 0.22) : 0;
  for (let i = 0; i < 3; i++) {
    const a = spin + i * turn / 3;
    const node = polar(ground, 1.27 * scale, a);
    b.ring(node, 0.22 * scale, flash > 0.4 ? 0xd6fbff : 0x59c9f0, 0.045 * scale);
    b.arc(ground, 1.54 * scale, a + 0.18, a + turn / 3 - 0.18, 0x466bc5, 0.075 * scale, "ground", 8);
    b.ribbon([polar(ground, 0.98 * scale, a), polar(ground, 0.70 * scale, a + 0.29),
      polar(ground, 0.78 * scale, a + 0.44), polar(ground, 0.39 * scale, a + 0.63)],
      (0.062 + flash * 0.045) * scale, flash > 0.3 ? 0xc2efff : 0x62bde7);
  }
}

function tempest(b, source, target, t, edge) {
  const age = t - edge;
  const ground = target.clone().setY(floor + 0.04);
  const sky = ground.clone().setY(4.02);
  const wheel = smooth(t, 0.22, 1.35) * (1 - smooth(age, 0.26, 1.16));
  const charge = smooth(t, 0, 0.52) * (1 - smooth(t, 0.72, 1.20));
  if (charge > 0.01) {
    for (let i = 0; i < 3; i++) {
      const a = i * turn / 3 + t * 3.8;
      const ray = b.cameraRight.clone().multiplyScalar(Math.cos(a)).addScaledVector(b.cameraUp, Math.sin(a));
      const elbow = source.clone().addScaledVector(ray, 0.31 * charge);
      b.ribbon([source, elbow, elbow.clone().addScaledVector(b.cameraUp, -0.14 * charge),
        source.clone().addScaledVector(ray, 0.68 * charge)], 0.065 * charge, 0x91d8ff);
      b.bar(elbow, elbow.clone().addScaledVector(b.cameraUp, 0.2 * charge), 0x5a84db, 0.04 * charge);
    }
  }
  if (t > 0.52 && t < 1.24) {
    const head = smooth(t, 0.52, 1.13);
    const tail = smooth(t, 0.65, 1.24);
    const path = [];
    for (let i = 0; i <= 7; i++) {
      const p = T.MathUtils.lerp(tail, head, i / 7);
      const point = source.clone().lerp(sky, p);
      point.y += Math.sin(Math.PI * p) * (0.52 + 0.16 * Math.sin(p * 42));
      path.push(point);
    }
    b.ribbon(path, 0.075, 0x759cef);
  }
  stormSeal(b, ground, t, edge);
  if (wheel > 0.01) {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.9 + i * turn / 3;
      const points = [];
      for (let j = 0; j <= 14; j++) {
        const p = j / 14;
        points.push(polar(sky, (0.67 + p * 0.86) * wheel, a + p * 2.23, (p - 0.5) * 0.36 * wheel));
      }
      b.ribbon(points, 0.19 * wheel, 0x304283);
      const rim = points.slice(6).map(point => point.clone().addScaledVector(b.toward, 0.025));
      b.ribbon(rim, 0.063 * wheel, 0x728cce);
    }
    for (let i = 0; i < 15; i++) {
      const a = i * turn / 15 + t * 1.13;
      const pos = polar(sky, (1.00 + 0.20 * Math.sin(i * 2.1)) * wheel, a, 0.13 * Math.sin(a * 3));
      b.mesh("shard", [0x202c52, 0x344268, 0x424d79][i % 3], pos,
        [0.57 * wheel, (0.28 + i % 3 * 0.05) * wheel, 0.42 * wheel], [0.21, -a, 0.17]);
    }
  }

  // A descending leader stops overhead. The return stroke reaches the chest on the damage beat.
  const leader = smooth(t, edge - 0.64, edge - 0.03);
  const stroke = age >= 0 ? 1 - smooth(age, 0, 0.27) : 0;
  if (leader > 0.01 && (age < 0 || stroke > 0.015)) {
    const offsets = [-0.10, 0.28, 0.09, 0.32, -0.18, -0.04, -0.22, 0];
    const path = offsets.map((offset, i) => sky.clone().lerp(target, i / 7).addScaledVector(b.cameraRight, offset));
    if (age < 0) {
      const reach = 3.8 * leader;
      const knot = Math.floor(reach);
      b.ribbon([...path.slice(0, knot + 1), path[knot].clone().lerp(path[knot + 1], reach - knot)], 0.054 * leader, 0x86ace9);
    } else {
      b.ribbon(path, 0.235 * stroke, 0x778bff);
      const core = path.map(point => point.clone().addScaledVector(b.toward, 0.035));
      b.ribbon(core, 0.13 * stroke, 0xfff4d4);
      for (let i = 0; i < 4; i++) {
        const root = core[i + 1];
        const side = i % 2 ? 1 : -1;
        const elbow = root.clone().addScaledVector(b.cameraRight, side * 0.41).addScaledVector(up, -0.20);
        const knee = elbow.clone().addScaledVector(b.cameraRight, -side * 0.12).addScaledVector(up, -0.23);
        const end = knee.clone().addScaledVector(b.cameraRight, side * (0.46 + 0.12 * i)).addScaledVector(up, -0.34);
        b.ribbon([root, elbow, knee, end], 0.064 * stroke, i % 2 ? 0xffedc8 : 0xc4dcff);
        b.bar(knee, knee.clone().addScaledVector(up, -0.32), 0xa9c3ff, 0.047 * stroke);
      }
      b.light(target, 0xfff0cc, stroke * 10, 5.5);
    }
  }
  if (age < 0) return;
  const shock = 1 - smooth(age, 0, 0.55);
  if (shock > 0.01) {
    const radius = 0.46 + 1.73 * (1 - shock);
    b.ring(ground, radius, shock > 0.76 ? 0xd4edff : 0x72a1ff, 0.11 * shock);
    b.ring(ground, radius * 0.83, 0x536aca, 0.075 * shock);
  }
  for (let i = 0; i < 21; i++) {
    const fall = (age - (i % 7) * 0.065) / 0.73;
    if (fall <= 0 || fall >= 1) continue;
    const a = i * 2.39996;
    const pos = polar(ground, 1.19 + (i % 4) * 0.17 + fall * 0.38, a, (1 - fall * fall) * (2.1 + 0.34 * (i % 5)));
    const size = Math.sin(Math.PI * fall);
    b.mesh("shard", i % 3 ? 0x6596cc : 0xa4c9ff, pos,
      [0.065 * size, 0.32 * size, 0.06 * size], [0.11, a, -0.16]);
  }
}

export function drawFrostAndStorm(brush, name, { source, target, t, edge }) {
  if (t <= 0 || t >= edge + 1.25) return;
  if (name === "frost") frost(brush, source, target, t, edge);
  if (name === "tempest") tempest(brush, source, target, t, edge);
}
