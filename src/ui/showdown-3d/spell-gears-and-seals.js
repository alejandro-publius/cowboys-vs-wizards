import * as T from "three";

const TAU = Math.PI * 2;
const { smoothstep: smooth, lerp } = T.MathUtils;
const brass = 0xc8803a, gold = 0xffca62, mint = 0x8bf3b5, ivory = 0xfff4c5;
const wine = 0x912444, scarlet = 0xe94258, coral = 0xff8991;
const rose = 0xe882be, pearl = 0xffe2f2;

function floorAt(target) {
  return new T.Vector3(target.x, 0.18, target.z);
}

function polar(center, radius, angle, height = 0) {
  return new T.Vector3(center.x + radius * Math.cos(angle), center.y + height, center.z + radius * Math.sin(angle));
}

function face(b, center, x, y) {
  return center.clone().addScaledVector(b.cameraRight, x).addScaledVector(b.cameraUp, y);
}

function flight(source, end, u, lift) {
  const point = source.clone().lerp(end, u);
  point.y += 4 * u * (1 - u) * lift;
  return point;
}

function sparks(b, center, age, color, accent, count) {
  if (age < 0 || age >= 0.52) return;
  const spread = smooth(age, 0, 0.52), fade = 1 - spread;
  for (let i = 0; i < count; i++) {
    const a = TAU * i / count + 0.18;
    const r = 0.12 + spread * (0.77 + (i % 3) * 0.31);
    const end = r + (0.22 + (i % 2) * 0.13) * fade;
    b.bar(face(b, center, r * Math.cos(a), r * 0.8 * Math.sin(a)),
      face(b, center, end * Math.cos(a), end * 0.8 * Math.sin(a)), i % 3 ? color : accent, 0.062 * fade);
  }
}

function gear(b, center, pitch, teeth, phase, rim) {
  const point = (r, a) => face(b, center, pitch * r * Math.cos(a), pitch * r * Math.sin(a));
  b.ring(center, pitch * 0.87, rim, pitch * 0.11, "screen");
  b.ring(center, pitch * 0.23, brass, pitch * 0.07, "screen");
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * TAU / teeth;
    b.bar(point(0.88, a), point(1.09, a), rim, pitch * 2.85 / teeth);
    if (i % 2 === 0) b.bar(point(0.23, a), point(0.85, a + 0.10), brass, pitch * 0.115);
  }
}

function clockwork(b, source, target, t, age) {
  const floor = floorAt(target);
  const pivot = target.clone();
  pivot.y += 1.20;
  const key = smooth(t, 0.16, 0.68);
  if (t < 0.72) {
    const size = smooth(t, 0, 0.15) * (1 - smooth(t, 0.58, 0.72));
    if (size > 0) {
      const at = flight(source, pivot, key, 0.48);
      gear(b, at, 0.28 * size, 8, t * 6, gold);
      b.bar(flight(source, pivot, Math.max(0, key - 0.10), 0.48), face(b, at, -0.19 * size, 0), brass, 0.07 * size);
    }
  }

  const dial = smooth(t, 0.39, 0.87) * (1 - smooth(age, 0.47, 1.25));
  if (dial > 0.008) {
    const r = 1.88 * dial;
    b.ring(floor, r, brass, 0.063 * dial);
    b.ring(floor, r * 0.78, age < 0 ? gold : mint, 0.036 * dial);
    for (let i = 0; i < 48; i++) {
      const a = i * TAU / 48, hour = i % 4 === 0;
      b.bar(polar(floor, r * (hour ? 0.81 : 0.93), a, 0.028), polar(floor, r * 0.98, a, 0.028),
        hour ? gold : brass, (hour ? 0.073 : 0.035) * dial);
      if (i % 12 === 0) b.bar(polar(floor, r * 0.81, a + 0.062, 0.028), polar(floor, r * 0.98, a + 0.062, 0.028), gold, 0.052 * dial);
    }
    const ticks = t * 4, beat = Math.floor(ticks) + smooth(ticks % 1, 0.04, 0.29);
    for (const [a, length, width] of [[beat * TAU / 12, 0.72, 0.063], [beat * TAU / 60 + 2.3, 0.49, 0.094]]) {
      b.bar(polar(floor, r * -0.12, a, 0.055), polar(floor, r * length, a, 0.055), gold, width * dial);
    }
  }

  const collapse = smooth(age, -0.22, 0);
  const train = (1 - 0.86 * collapse) * (1 - smooth(age, 0, 0.13));
  pivot.lerp(target, collapse);
  const phase = t * 1.45 + collapse * 0.8;
  for (const [teeth, bearing, start] of [[12, 0, 0.49], [8, -2.58, 0.71], [10, -0.58, 0.90]]) {
    const enter = smooth(t, start, start + 0.43), size = enter * train;
    if (size < 0.01) continue;
    const satellite = teeth !== 12, pitch = teeth * 0.056;
    const d = satellite ? (0.672 + pitch + 0.48 * (1 - enter)) * train : 0;
    const center = face(b, pivot, d * Math.cos(bearing), d * Math.sin(bearing));
    // Matching circular pitch and opposite tooth phase keep each pinion in the central wheel's gaps.
    const turn = satellite ? bearing + Math.PI + ((bearing - phase) * 12 - Math.PI) / teeth : phase;
    gear(b, center, pitch * size, teeth, turn, teeth === 8 ? 0xebac65 : gold);
  }

  if (age >= -0.27 && age < 0.22) {
    const squeeze = smooth(age, -0.27, 0), fade = 1 - smooth(age, 0, 0.22);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + squeeze * 0.5, r = 1.72 - 1.64 * squeeze;
      const len = 0.38 * squeeze * fade;
      if (len > 0.002) b.bar(face(b, target, r * Math.cos(a), r * 0.72 * Math.sin(a)),
        face(b, target, (r + len) * Math.cos(a + 0.07), (r + len) * 0.72 * Math.sin(a + 0.07)), mint, 0.083 * squeeze * fade);
    }
  }
  if (age >= 0 && age < 0.45) {
    const flash = 1 - smooth(age, 0, 0.45);
    b.mesh("shard", ivory, target, [0.48 * flash, 1.05 * flash, 0.48 * flash]);
    b.light(target, mint, 8 * flash, 5);
    b.ring(floor, 0.42 + 1.54 * (1 - flash), mint, 0.09 * flash);
  }
  sparks(b, target, age, mint, ivory, 12);
}

function scarletSpell(b, source, target, t, age) {
  const floor = floorAt(target);
  const mark = smooth(t, 0.37, 0.89) * (1 - smooth(age, 0.54, 1.25));
  if (mark > 0.008) {
    const r = 1.72 * (0.78 + 0.22 * mark);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + TAU * i / 5;
      const p = polar(floor, r, a), q = polar(floor, r, a + TAU * 2 / 5);
      for (const [start, end] of [[0.025, 0.31], [0.35, 0.64], [0.68, 0.975]]) {
        b.bar(p.clone().lerp(q, start), p.clone().lerp(q, lerp(start, end, mark)), scarlet, 0.065 * mark);
      }
      b.arc(floor, r * 1.07, a + 0.08, a + 0.08 + mark * 0.95, wine, 0.086 * mark, "ground", 7);
    }
  }

  for (let i = 0; i < 3; i++) {
    const untilHit = age + (2 - i) * 0.23;
    const fly = smooth(untilHit, -0.85, 0), fade = 1 - smooth(untilHit, 0, 0.23);
    const size = smooth(untilHit, -1, -0.74) * fade;
    if (size < 0.005) continue;
    const hand = i === 1 ? -1 : 1, radius = size * (0.3 + 0.63 * fly);
    // Offset the first two cuts to flank the body; the last blade's inner edge reaches the chest.
    const landing = face(b, target, hand * (i === 2 ? -0.91 : 0.60), i === 0 ? 0.22 : 0);
    const at = flight(source, landing, fly, (i - 0.6) * 0.33);
    const points = [];
    for (let j = 0; j <= 16; j++) {
      const u = j / 16, a = lerp(-1.65, 1.48, u) - 0.60 * (1 - fly);
      points.push(face(b, at, hand * radius * (Math.cos(a) + 0.38 * Math.sin(a)), radius * Math.sin(a)));
      if (j === 0) continue;
      const belly = Math.sin(Math.PI * (j - 0.5) / 16);
      b.bar(points[j - 1], points[j], scarlet, size * (0.02 + 0.17 * belly));
    }
    b.ribbon(points.slice(3, 14).map(p => p.clone().addScaledVector(b.cameraRight, hand * 0.05 * size)
      .addScaledVector(b.toward, 0.08 * size)), 0.038 * size, coral);
  }

  const sweep = smooth(age, -0.23, 0.28), erase = smooth(age, 0.31, 0.88);
  if (sweep - erase > 0.002) {
    for (let i = 0; i < 3; i++) {
      const points = [];
      for (let j = 0; j <= 24; j++) {
        const a = Math.PI * lerp(erase, sweep, j / 24);
        // Twist the three meridians around a common crown, like crossed strips of rawhide.
        const bearing = i * TAU / 3 + 0.58 * Math.sin(a);
        points.push(polar(floor, 1.67 * Math.cos(a), bearing, 2.47 * Math.sin(a) + 0.04));
      }
      const width = (1 - erase) * (0.096 + 0.052 * (1 - smooth(Math.abs(age), 0, 0.22)));
      b.ribbon(points, width, i === 1 ? scarlet : wine);
      b.ribbon(points.map(p => p.clone().addScaledVector(b.cameraUp, width * 0.28)
        .addScaledVector(b.toward, 0.012)), width * 0.31, coral);
    }
  }
  if (age >= 0 && age < 0.28) {
    const flash = 1 - smooth(age, 0, 0.28);
    for (const hand of [-1, 1]) b.bar(face(b, target, -0.46 * flash, hand * -0.55 * flash),
      face(b, target, 0.46 * flash, hand * 0.55 * flash), 0xffd9ce, 0.093 * flash);
    b.light(target, scarlet, 7.8 * flash, 5);
  }
  sparks(b, target, age, coral, scarlet, 9);
}

function astral(b, source, target, t, age) {
  const floor = floorAt(target);
  const travel = smooth(t, 0.11, 0.66), tail = smooth(t, 0.23, 0.76);
  if (t > 0 && t < 0.76) {
    const size = smooth(t, 0, 0.14) * (1 - smooth(t, 0.58, 0.76));
    const at = flight(source, floor, travel, 0.88);
    b.mesh("shard", gold, at, [0.19 * size, 0.42 * size, 0.19 * size], [0, t * 4, 0.35]);
    if (travel - tail > 0.002) {
      const trail = Array.from({ length: 13 }, (_, j) => flight(source, floor, lerp(tail, travel, j / 12), 0.88));
      b.ribbon(trail, 0.07 * size, rose);
    }
  }

  for (let i = 0; i < 3; i++) {
    const start = 0.49 + i * 0.25, rise = smooth(t, start, start + 0.65);
    const fade = 1 - smooth(age, 0.51 - i * 0.08, 1.25 - i * 0.12);
    const size = rise * fade;
    if (size < 0.008) continue;
    const at = floor.clone();
    at.y += (0.16 + 1.51 * i) * rise + (1 - fade) * 0.37;
    const r = (1.77 - i * 0.32) * (0.63 + 0.37 * size);
    const phase = (i === 1 ? -1 : 1) * (t * 0.41 + i * 0.31);
    b.ring(at, r, gold, 0.058 * size);
    b.ring(at, r * 0.73, i === 1 ? rose : brass, 0.047 * size);
    for (let j = 0; j < 6; j++) {
      const a = phase + j * TAU / 6;
      const jewel = polar(at, r * 0.865, a);
      b.ring(jewel, r * 0.066, rose, 0.026 * size);
      b.bar(polar(at, r * 0.75, a + 0.31), polar(at, r * 0.98, a + 0.39), gold, 0.052 * size);
      if (i === 0) b.bar(polar(at, r * 0.71, a), polar(at, r * 0.71, a + TAU / 3), brass, 0.048 * size);
    }
  }

  const crown = floor.clone();
  crown.y = 4.05;
  const charge = smooth(t, 1.14, 1.64) * (1 - smooth(age, -0.26, 0));
  if (charge > 0.006) {
    b.mesh("shard", rose, crown, [0.29 * charge, 0.61 * charge, 0.29 * charge], [0, 2 * t, 0]);
    b.ring(crown, 0.35 * charge, gold, 0.047 * charge, "screen");
    b.ring(crown, 0.39 * charge, rose, 0.036 * charge);
  }
  if (age > -0.30 && age < 0.67) {
    const fall = T.MathUtils.clamp((age + 0.30) / 0.30, 0, 1);
    const tip = crown.clone().lerp(target, fall * fall);
    if (age > 0) tip.lerp(floor, smooth(age, 0, 0.12));
    const strength = 1 - smooth(age, 0, 0.67);
    const width = (0.03 + 0.25 * fall * fall) * strength;
    const top = crown.clone().lerp(tip, smooth(age, 0.23, 0.67));
    if (top.distanceToSquared(tip) > 1e-8) {
      b.bar(top, tip, pearl, width);
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + t * 1.4;
        const mid = polar(top.clone().lerp(tip, 0.54), width * 1.44, a);
        b.ribbon([polar(top, width * 0.57, a), mid, tip], width * 0.28, i % 2 ? rose : gold);
      }
    }
  }
  if (age >= 0 && age < 0.44) {
    const flash = 1 - smooth(age, 0, 0.44);
    b.light(target, pearl, 8.4 * flash, 5);
    b.ring(floor, 0.27 + (1 - flash) * 1.5, rose, 0.084 * flash);
  }
  sparks(b, target, age, pearl, gold, 8);
}

export function drawGearsAndSeals(brush, name, { source, target, t, edge }) {
  const age = t - edge;
  if (t < 0 || age >= 1.25) return;
  if (name === "clockwork") clockwork(brush, source, target, t, age);
  if (name === "scarlet") scarletSpell(brush, source, target, t, age);
  if (name === "astral") astral(brush, source, target, t, age);
}
