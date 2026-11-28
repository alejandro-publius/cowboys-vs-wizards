// Card props for Cowboys vs Wizards Showdown. Each model is grounded in its art.js brief.
// b.box(hex,x,y,z,w,h,d,rx,ry,rz) / b.piece(kind,hex,...) / optional b.glow(kind,hex,...).
const P = Math.PI;
const C = {
  gold: 0xffc928,
  brass: 0xc99a2e,
  copper: 0xb8642a,
  steel: 0x8f99a6,
  iron: 0x3a3b42,
  ivory: 0xf0e6c8,
  wood: 0x7a4a24,
  plank: 0xa8743f,
  dark: 0x3a2414,
  dirt: 0x8a6a44,
  rope: 0xcda56a,
  glove: 0x5c3a1e,
  red: 0xa8301c,
  violet: 0xa04dff,
  deep: 0x5a1f9e,
  green: 0x45ff6a,
  bone: 0xe8dcbc,
  stone: 0x80838c,
  night: 0x2a2833,
  moss: 0x3b4a33,
  chalk: 0xf2efe4,
  amber: 0xffa63a,
  black: 0x111014,
  ember: 0xff8a2a,
};
const glow = (b, ...a) => (b.glow ? b.glow(...a) : b.piece(...a));
const base = (b, hex, w = 2.2, d = 1.5) => b.piece("round", hex, 0, 0.04, 0, w, 0.08, d);

// Side-view revolver pointing +x, origin at the frame, scale s.
function gun(b, x, y, z, s) {
  const p = (k, h, dx, dy, dz, w, hh, d, rx = 0, ry = 0, rz = 0) =>
    b.piece(k, h, x + dx * s, y + dy * s, z + dz * s, w * s, hh * s, d * s, rx, ry, rz);
  p("box", C.steel, 0.35, 0.08, 0, 0.8, 0.12, 0.12); // long engraved barrel
  p("box", C.brass, 0.3, 0.12, 0, 0.6, 0.02, 0.13); // brass vine inlay line
  p("box", C.steel, 0.72, 0.17, 0, 0.04, 0.06, 0.04); // front sight
  p("round", C.steel, -0.06, 0.05, 0, 0.27, 0.24, 0.27, 0, 0, P / 2); // cylinder
  p("box", C.brass, -0.14, 0.03, 0, 0.4, 0.22, 0.1); // brass frame
  p("box", C.iron, -0.33, 0.18, 0, 0.08, 0.12, 0.06, 0, 0, -0.4); // hammer
  p("ring", C.brass, -0.14, -0.12, 0, 0.18, 0.03, 0.18, P / 2); // trigger guard
  p("box", C.ivory, -0.4, -0.2, 0, 0.17, 0.42, 0.12, 0, 0, 0.35); // ivory grip
  p("gem", C.brass, -0.42, -0.2, 0.07, 0.08, 0.08, 0.03); // small brass star inlay
}
// Five-point star facing +z.
function star(b, hex, x, y, z, s) {
  glow(b, "gem", hex, x, y, z, s * 0.45, s * 0.45, s * 0.2);
  for (let k = 0; k < 5; k++) {
    const a = (k * 2 * P) / 5;
    glow(
      b,
      "cone",
      hex,
      x - Math.sin(a) * s * 0.33,
      y + Math.cos(a) * s * 0.33,
      z,
      s * 0.24,
      s * 0.4,
      s * 0.1,
      0,
      0,
      a,
    );
  }
}
// Rounded headstone, leaning by rz.
function stone(b, x, z, rz = 0, s = 1, hex = C.stone) {
  b.box(hex, x - Math.sin(rz) * 0.1 * s, 0.1 + 0.15 * s, z, 0.22 * s, 0.3 * s, 0.07 * s, 0, 0, rz);
  b.piece("orb", hex, x - Math.sin(rz) * 0.28 * s, 0.1 + 0.3 * s, z, 0.22 * s, 0.2 * s, 0.07 * s, 0, 0, rz);
}
const hand = (b, x, y, z, rz = 0) => {
  b.box(C.glove, x, y, z, 0.24, 0.22, 0.22, 0, 0, rz);
  b.box(C.dark, x + 0.12, y - 0.16, z, 0.3, 0.18, 0.26, 0, 0, rz);
};

export const ART = {
  "cowboy-deadeye": function (b) {
    base(b, C.dirt, 2.3, 1.1);
    gun(b, -0.72, 1.05, 0, 1);
    hand(b, -1.08, 0.84, 0, 0.35);
    [
      [0.1, 1.26, 0.12],
      [0.2, 1.4, 0.1],
      [0.12, 1.54, 0.08],
    ].forEach(([x, y, s]) => b.piece("orb", 0xd8d0c4, x, y, 0, s, s, s));
    glow(b, "box", C.gold, 0.5, 1.13, 0, 0.9, 0.025, 0.025); // the one clean gold line
    for (let i = 0; i < 5; i++) {
      const s = 0.36 - i * 0.05,
        a = i * 1.4;
      glow(
        b,
        "ring",
        C.gold,
        0.18 + i * 0.16,
        1.13 + 0.04 * Math.sin(a),
        0.04 * Math.cos(a),
        s,
        0.05,
        s,
        0,
        0,
        P / 2,
      );
    }
    b.piece("round", C.brass, 0.98, 1.13, 0, 0.1, 0.16, 0.1, 0, 0, P / 2);
    b.piece("cone", C.copper, 1.09, 1.13, 0, 0.1, 0.08, 0.1, 0, 0, -P / 2);
    b.box(C.wood, 1.0, 0.5, -0.4, 0.06, 0.84, 0.06); // far-off target
    b.piece("round", C.chalk, 1.0, 1.0, -0.4, 0.34, 0.04, 0.34, P / 2);
    b.piece("ring", C.red, 1.0, 1.0, -0.37, 0.26, 0.04, 0.26, P / 2);
  },
  "cowboy-lasso": function (b) {
    base(b, C.dirt);
    b.piece("ring", C.rope, 0, 1.02, 0, 1.25, 0.1, 1.25, P / 2);
    glow(b, "ring", C.gold, 0, 1.02, -0.01, 1.34, 0.04, 1.34, P / 2);
    glow(b, "orb", 0xc79bff, 0, 1.0, 0, 0.26, 0.34, 0.26);
    for (let i = 0; i < 6; i++)
      glow(
        b,
        "gem",
        C.violet,
        0.13 * Math.cos(i * 1.2),
        0.74 + i * 0.1,
        0.13 * Math.sin(i * 1.2),
        0.15,
        0.2,
        0.15,
        0,
        i * 0.5,
        0,
      );
    b.piece("ring", C.rope, 0, 1.02, 0, 0.4, 0.07, 0.4); // cinched around the mist
    b.piece("ring", C.rope, 0, 0.86, 0, 0.32, 0.06, 0.32);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      b.box(C.rope, t * 0.95, 0.4 - 0.08 * t + 0.05 * Math.sin(t * 7), 0.1, 0.2, 0.06, 0.06, 0, 0, -0.2);
    }
    hand(b, 1.0, 0.32, 0.1, -0.3);
  },
  "wizard-singularity": function (b) {
    base(b, C.night, 2.3, 1.6);
    for (let i = 0; i < 8; i++) {
      // flagstones lifting inward
      const a = (i / 8) * 2 * P,
        r = 0.85,
        x = r * Math.cos(a),
        z = r * 0.7 * Math.sin(a);
      b.box(C.stone, x, 0.12 + (i % 3) * 0.05, z, 0.34, 0.06, 0.28, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    [
      [-0.4, 0.45, 0.1],
      [0.35, 0.6, -0.1],
      [0.15, 0.35, 0.3],
    ].forEach(([x, y, z]) => b.piece("rock", C.stone, x, y, z, 0.14, 0.12, 0.14));
    stone(b, -1.0, -0.4, -0.35);
    stone(b, 1.0, -0.4, 0.35);
    [1.3, 1.0, 0.72, 0.48].forEach((s, i) =>
      glow(b, "ring", i % 2 ? C.deep : C.violet, 0, 1.0, -0.05 + i * 0.03, s, 0.06, s, P / 2),
    );
    b.piece("orb", C.black, 0, 1.0, 0.06, 0.34, 0.34, 0.34);
    for (let i = 0; i < 10; i++) {
      const a = i * 0.9,
        r = 0.24 + i * 0.05;
      glow(b, "gem", C.green, r * Math.cos(a), 1.0 + r * Math.sin(a), 0.12, 0.08, 0.08, 0.08);
    }
  },
  "wizard-hellfire": function (b) {
    base(b, C.night, 2.4, 1.3);
    b.box(0x1a1424, 0, 1.72, -0.3, 2.4, 0.12, 0.2); // split in the sky
    for (let i = 0; i < 4; i++)
      glow(b, "box", C.violet, -0.9 + i * 0.6, 1.68, -0.18, 0.62, 0.03, 0.04, 0, 0, i % 2 ? 0.12 : -0.12);
    for (let i = 0; i < 6; i++) {
      // even fire across the width
      const x = -1.0 + i * 0.4,
        z = i % 2 ? -0.15 : 0.15,
        c = i % 2 ? C.violet : C.green;
      glow(b, "gem", c, x, 1.0, z, 0.19, 1.34, 0.19, 0.12, 0, i % 2 ? 0.092 : -0.068);
      glow(b, "cone", c, x + 0.107, 0.64, z + 0.03, 0.17, 0.77, 0.17, 0.18, 0, -0.29);
      glow(b, "gem", c, x - 0.124, 0.79, z + 0.05, 0.11, 0.17, 0.1, 0, 0, 0.24);
      glow(b, "cone", c, x, 0.27, z, 0.36, 0.36, 0.36);
      glow(b, "orb", i % 2 ? 0xd6a8ff : 0xb8ffc4, x, 0.14, z, 0.34, 0.12, 0.34);
    }
    [-1.15, -0.85, -0.55].forEach((x) => b.box(C.black, x, 0.3, 0.5, 0.07, 0.44, 0.07));
    b.box(C.black, -0.85, 0.42, 0.5, 0.7, 0.05, 0.04);
    b.piece("ring", C.black, 0.8, 0.38, 0.5, 0.6, 0.05, 0.6, P / 2); // wagon wheel silhouette
    for (let k = 0; k < 4; k++) b.box(C.black, 0.8, 0.38, 0.5, 0.03, 0.56, 0.03, 0, 0, (k * P) / 4);
    for (let i = 0; i < 7; i++)
      glow(b, "gem", C.ember, -1.0 + i * 0.33, 0.6 + (i % 3) * 0.35, 0.35, 0.05, 0.05, 0.05);
  },
  "cowboy-bear-trap": function (b) {
    base(b, C.dirt, 2.3, 1.7);
    b.box(C.iron, 0, 0.12, 0, 1.5, 0.06, 0.3); // base bar
    b.group("pressure-plate", () => {
      b.piece("round", C.copper, 0, 0.19, 0, 0.58, 0.10, 0.53);
      b.box(C.brass, 0, 0.25, 0.03, 0.29, 0.025, 0.06);
    }, [0, 0.19, 0]);
    const hy = 0.20;
    for (const side of [-1, 1]) {
      b.group("iron-jaw-" + side, () => {
        // Each D-shaped band turns on the common axle. The teeth interleave when shut.
        for (let i = 0; i < 9; i++) {
          const arc = (i + 0.5) * P / 9;
          const x = 0.86 * Math.cos(arc), z = side * 0.69 * Math.sin(arc);
          b.box(C.iron, x, hy, z, 0.34, 0.14, 0.16, 0, side * (P / 2 - arc), 0);
          b.piece("cone", 0xb8b6b0, x + side * 0.035, hy + 0.13, z, 0.16, 0.31, 0.16,
            -side * 0.25);
        }
      }, [0, hy, 0]);
    }
    for (const x of [-0.78, 0.78]) {
      b.piece("orb", C.brass, x, hy, 0, 0.14, 0.14, 0.14);
      b.box(C.iron, x * 1.12, 0.14, 0, 0.18, 0.1, 0.42);
    }
    for (let i = 0; i < 4; i++)
      b.piece("ring", C.iron, 0.98 + i * 0.1, 0.12, -0.25 - i * 0.06, 0.12, 0.03, 0.12, i % 2 ? P / 2 : 0);
    b.piece("cone", C.iron, 1.06, 0.12, -0.55, 0.06, 0.24, 0.06, P); // stake
    for (let i = 0; i < 7; i++)
      b.piece(
        "cone",
        0xc9b26a,
        -1.0 + i * 0.32,
        0.16,
        0.65 - (i % 2) * 1.2,
        0.04,
        0.18,
        0.04,
        0,
        0,
        ((i % 3) - 1) * 0.3,
      );
    glow(b, "box", C.violet, 0.3, 0.09, 0.72, 0.14, 0.02, 0.26); // glowing footprint
  },
  "wizard-hex": function (b) {
    b.piece("round", 0x3a3026, 0, 0.04, 0, 2.2, 0.08, 2.0);
    b.piece("ring", C.chalk, 0, 0.09, 0, 1.7, 0.03, 1.7);
    glow(b, "ring", C.violet, 0, 0.1, 0, 1.46, 0.02, 1.46);
    for (let i = 0; i < 8; i++) {
      const k = (i / 8) * 2 * P;
      b.box(
        C.chalk,
        0.66 * Math.cos(k),
        0.09,
        0.66 * Math.sin(k),
        0.14,
        0.02,
        0.04,
        0,
        -k + (i % 2) * 0.8,
        0,
      );
    }
    for (let i = 0; i < 6; i++) {
      const k = (i / 6) * 2 * P + 0.3;
      b.box(C.bone, 0.76 * Math.cos(k), 0.1, 0.76 * Math.sin(k), 0.16, 0.04, 0.04, 0, -k, 0);
    }
    for (let i = 0; i < 5; i++) {
      // guttering black candles
      const k = (i / 5) * 2 * P + P / 2,
        x = 0.9 * Math.cos(k),
        z = 0.9 * Math.sin(k);
      b.piece("round", C.black, x, 0.18, z, 0.08, 0.2, 0.08);
      b.group("candle-flame-" + i, () => {
        glow(b, "cone", 0xffb751, x, 0.42, z, 0.12, 0.27, 0.12);
        glow(b, "gem", C.ivory, x, 0.36, z + 0.025, 0.07, 0.15, 0.07);
      }, [x, 0.28, z]);
    }
    [
      [-0.4, 0.3],
      [0.45, -0.2],
      [0.1, 0.5],
    ].forEach(([x, z]) => glow(b, "orb", 0xb48ae0, x, 0.12, z, 0.5, 0.04, 0.35));
    b.group("cloth-charm", () => {
      b.piece("round", C.deep, 0, 0.36, 0, 0.3, 0.42, 0.24); // stitched violet doll
      b.piece("orb", C.deep, 0, 0.7, 0, 0.32, 0.3, 0.28);
      for (const s of [1, -1]) {
        b.box(C.deep, s * 0.22, 0.44, 0, 0.18, 0.08, 0.08, 0, 0, s * 0.5);
        b.box(C.deep, s * 0.08, 0.12, 0.02, 0.08, 0.16, 0.08);
        b.piece("orb", C.black, s * 0.07, 0.73, 0.14, 0.05, 0.05, 0.03);
      }
      b.box(C.black, 0, 0.38, 0.125, 0.02, 0.26, 0.01); // seam
      [
        [0.06, 0.82, 0.05, -0.5],
        [-0.05, 0.42, 0.1, 0.6],
        [0.26, 0.48, 0.02, -0.9],
      ].forEach(([x, y, z, t]) => {
        b.box(C.iron, x, y, z, 0.025, 0.34, 0.025, 0.3, 0, t);
        b.piece("orb", 0xd4d4dc, x - Math.sin(t) * 0.17, y + Math.cos(t) * 0.17, z + 0.05, 0.06, 0.06, 0.06);
      });
    }, [0, 0.13, 0]);
  },
  "cowboy-six-shooter": function (b) {
    b.box(C.wood, 0, 0.12, 0, 2.2, 0.24, 1.1); // timber display table
    b.box(C.red, -0.05, 0.27, -0.05, 1.7, 0.06, 0.7); // folded bandana
    b.box(0x7e2414, 0.3, 0.31, 0, 0.9, 0.03, 0.5, 0, 0.3, 0);
    [-0.55, 0.35].forEach((x) => b.piece("round", C.brass, x, 0.44, -0.05, 0.06, 0.28, 0.06));
    gun(b, -0.1, 0.95, -0.05, 1.45);
    for (let i = 0; i < 6; i++) {
      // six brass cartridges
      const x = -0.6 + i * 0.24;
      b.piece("round", C.brass, x, 0.39, 0.42, 0.1, 0.18, 0.1);
      b.piece("cone", C.copper, x, 0.51, 0.42, 0.1, 0.08, 0.1);
    }
  },
  "wizard-bone-armor": function (b) {
    b.piece("round", C.wood, 0, 0.06, 0, 0.9, 0.12, 0.7);
    b.box(C.wood, 0, 0.75, -0.12, 0.1, 1.3, 0.1);
    b.box(C.wood, 0, 1.38, -0.12, 1.1, 0.08, 0.08);
    for (let i = 0; i < 5; i++) b.piece("ring", C.bone, 0, 1.18 - i * 0.15, 0, 0.84 - i * 0.07, 0.06, 0.5);
    for (let i = 0; i < 6; i++) b.box(C.bone, 0, 1.22 - i * 0.13, 0.25, 0.1, 0.08, 0.06);
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++)
        b.box(C.violet, s * 0.2, 1.1 - i * 0.15, 0.25, 0.035, 0.2, 0.02, 0, 0, i % 2 ? 0.6 : -0.6);
      b.piece("gem", C.bone, s * 0.5, 1.32, 0, 0.38, 0.14, 0.32, 0, 0, -s * 0.35); // shoulder blades
      b.box(C.iron, s * 0.36, 1.27, 0.14, 0.08, 0.08, 0.03); // tarnished buckles
      b.piece("round", 0x2f6b3a, s * 0.34, 0.22, 0.2, 0.06, 0.16, 0.06);
      glow(b, "cone", C.green, s * 0.34, 0.35, 0.2, 0.05, 0.09, 0.05);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * P;
      b.piece("orb", C.bone, 0.2 * Math.cos(a), 1.46, 0.14 * Math.sin(a), 0.08, 0.08, 0.08);
    }
  },
  "cowboy-sheriffs-office": function (b) {
    b.box(C.dirt, 0, 0.04, 0.1, 2.4, 0.08, 2.0);
    b.box(C.plank, 0, 0.68, -0.25, 1.6, 1.2, 0.9);
    b.box(C.dark, 0, 1.32, -0.25, 1.76, 0.08, 1.0);
    b.box(C.plank, 0, 1.46, 0.19, 1.6, 0.32, 0.06); // false front
    star(b, C.gold, 0, 1.46, 0.25, 0.34); // brightest thing: the star
    b.box(C.wood, 0, 0.12, 0.45, 1.7, 0.08, 0.5); // porch
    b.box(C.dark, 0, 1.02, 0.48, 1.76, 0.05, 0.6, -0.18);
    for (const x of [-0.8, 0.8]) {
      b.box(C.wood, x, 0.58, 0.72, 0.07, 0.86, 0.07);
      glow(b, "orb", C.amber, x, 0.84, 0.78, 0.08, 0.1, 0.08);
    }
    b.box(C.black, -0.2, 0.5, 0.21, 0.36, 0.72, 0.03); // open doorway with rifle rack
    [-0.3, -0.2, -0.1].forEach((x) => b.box(C.steel, x, 0.52, 0.225, 0.03, 0.46, 0.02));
    glow(b, "box", C.amber, 0.42, 0.64, 0.21, 0.4, 0.32, 0.02); // barred amber window
    for (let i = 0; i < 4; i++) b.box(C.iron, 0.27 + i * 0.1, 0.64, 0.23, 0.025, 0.34, 0.02);
    b.box(C.dark, -0.64, 0.68, 0.21, 0.24, 0.44, 0.02); // poster board, blank sheets
    [
      [-0.68, 0.78],
      [-0.6, 0.6],
    ].forEach(([x, y]) => b.box(C.chalk, x, y, 0.225, 0.12, 0.15, 0.01));
    [0.5, 1.0].forEach((x) => b.box(C.wood, x, 0.24, 0.95, 0.06, 0.34, 0.06)); // hitching rail
    b.box(C.wood, 0.75, 0.36, 0.95, 0.6, 0.05, 0.05);
  },
  "wizard-boneyard": function (b) {
    b.piece("round", C.moss, 0, 0.05, 0, 2.4, 0.1, 1.8);
    b.piece("rock", C.moss, 0, 0.26, -0.45, 1.8, 0.52, 0.9); // slope up to the gate
    b.box(0x9a8a6a, 0.05, 0.11, 0.25, 0.22, 0.02, 0.9, 0, 0.35, 0); // winding path
    for (const x of [-0.32, 0.32]) b.box(C.stone, x, 0.74, -0.6, 0.16, 0.68, 0.16);
    b.piece("ring", C.stone, 0, 1.1, -0.6, 0.82, 0.14, 0.82, P / 2); // rune-carved arch
    glow(b, "round", C.violet, 0, 1.0, -0.62, 0.5, 0.03, 0.6, P / 2);
    for (const y of [0.6, 0.8, 1.0])
      for (const x of [-0.32, 0.32]) glow(b, "box", C.violet, x, y, -0.51, 0.06, 0.04, 0.01);
    [
      [-0.62, 0.42],
      [0.42, 0.5],
    ].forEach(([x, z]) => {
      // open graves + fresh earth
      b.box(0x120e0a, x, 0.105, z, 0.3, 0.02, 0.48);
      b.piece("rock", C.dirt, x + 0.27, 0.16, z, 0.2, 0.16, 0.42);
      stone(b, x, z - 0.32, x < 0 ? 0.15 : -0.2);
    });
    stone(b, -1.0, -0.15, -0.25, 0.9);
    stone(b, 0.95, 0.2, 0.2, 0.9);
    stone(b, -0.55, -0.35, 0.3, 0.8);
    for (let i = 0; i < 4; i++) b.box(C.iron, -1.15 + i * 0.13, 0.3, 0.75, 0.03, 0.42, 0.03, 0, 0, 0.18); // leaning fence
    b.box(C.iron, -0.97, 0.42, 0.75, 0.52, 0.03, 0.03, 0, 0, 0.18);
    b.box(0x1c1612, 0.85, 0.62, -0.35, 0.1, 1.0, 0.1, 0, 0, -0.1); // dead black tree
    [
      [0.68, 1.02, 0.7],
      [1.0, 0.92, -0.8],
      [0.9, 1.15, -0.3],
    ].forEach(([x, y, r]) => b.box(0x1c1612, x, y, -0.35, 0.05, 0.38, 0.05, 0, 0, r));
    [
      [-0.22, 0.2],
      [0.3, -0.1],
    ].forEach(([x, z]) => {
      b.box(C.iron, x, 0.32, z, 0.03, 0.44, 0.03);
      glow(b, "orb", C.green, x, 0.58, z, 0.1, 0.12, 0.1);
    });
  },
};
