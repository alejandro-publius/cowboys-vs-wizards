// Wizard faction rigs. Origin on ground (y=0), y up, +z faces camera.
const P = Math.PI;
const C = {
  bone: 0xe6dcc2,
  boneD: 0xb3a27e,
  dark: 0x16101c,
  violet: 0x5e2a8c,
  violetD: 0x3e1a5e,
  rust: 0xa4532a,
  steel: 0xc6ccd6,
  iron: 0x474c55,
  robe: 0x73528f,
  purple: 0x815597,
  gold: 0xe8b830,
  skin: 0xf0c8a0,
  beard: 0xf6f4ee,
  wood: 0x7a4a24,
  cyan: 0x78e797,
  pink: 0xff5cf0,
  magenta: 0xd8288e,
  magentaD: 0x8e1660,
  lime: 0xa8ff1e,
  twig: 0x6b4a2a,
  pump: 0xcb743b,
  pumpD: 0x9b4831,
  fire: 0x9dec79,
  spark: 0xfff070,
};

// glow falls back to a plain piece if the builder lacks b.glow
const glow = (b, ...a) => (b.glow ? b.glow(...a) : b.piece(...a));
// stick from (x1,y1) to (x2,y2) in the xy plane at depth z
const limb = (b, kind, hex, x1, y1, x2, y2, z, t, d = t) => {
  const dx = x2 - x1,
    dy = y2 - y1;
  b.piece(kind, hex, (x1 + x2) / 2, (y1 + y2) / 2, z, t, Math.hypot(dx, dy), d, 0, 0, Math.atan2(-dx, dy));
};
// polyline of sticks
const chain = (b, kind, hex, pts, z, t) => {
  for (let i = 1; i < pts.length; i++) limb(b, kind, hex, ...pts[i - 1], ...pts[i], z, t);
};
// pair of eyes, mirrored on x
const eyes = (b, kind, hex, y, z, s, gap, lit = false) => {
  for (const sx of [-1, 1])
    (lit ? glow : (bb, ...a) => bb.piece(...a))(b, kind, hex, sx * gap, y, z, s, s * 0.9, s * 0.6);
};
// small skull: cranium, sockets, jaw
const skull = (b, x, y, z, s, rz = 0) => {
  b.piece("orb", C.bone, x, y, z, s, s * 0.95, s * 0.9, 0, 0, rz);
  b.box(C.boneD, x, y - s * 0.48, z + s * 0.08, s * 0.6, s * 0.22, s * 0.6, 0, 0, rz);
  for (const sx of [-1, 1])
    b.piece("orb", C.dark, x + sx * s * 0.2, y + s * 0.02, z + s * 0.38, s * 0.24, s * 0.26, s * 0.16);
  b.piece("gem", C.dark, x, y - s * 0.2, z + s * 0.42, s * 0.1, s * 0.12, s * 0.08);
};

export const ART = {
  "wizard-skeleton"(b) {
    // legs, feet, pelvis, spine
    for (const s of [-1, 1]) {
      limb(b, "box", C.bone, s * 0.16, 0.06, s * 0.12, 0.62, 0, 0.08);
      b.box(C.boneD, s * 0.17, 0.04, 0.06, 0.12, 0.08, 0.2);
    }
    b.box(C.boneD, 0, 0.66, 0, 0.36, 0.12, 0.18);
    b.piece("round", C.bone, 0, 0.92, -0.04, 0.07, 0.5, 0.07);
    // visible ribcage
    for (let i = 0; i < 4; i++)
      b.piece("ring", C.bone, 0, 0.8 + i * 0.09, 0, 0.44 - i * 0.03 + (i === 3 ? -0.06 : 0), 0.05, 0.3);
    b.box(C.bone, 0, 0.94, 0.14, 0.05, 0.28, 0.04);
    b.box(C.bone, 0, 1.13, 0, 0.56, 0.06, 0.1);
    // tattered violet hood with hanging strips
    b.group("skull", () => {
      b.piece("orb", C.violet, 0, 1.38, -0.08, 0.46, 0.5, 0.42);
      b.piece("cone", C.violet, 0, 1.6, -0.14, 0.32, 0.36, 0.3, -0.35);
      [
        [-0.22, 0.32, 0.1],
        [-0.12, 0.44, -0.08],
        [0.1, 0.26, 0.06],
        [0.22, 0.4, -0.12],
      ].forEach(([x, h, r]) => b.box(C.violetD, x, 1.18 - h / 2, -0.14, 0.09, h, 0.04, 0, 0, r));
      // cracked skull
      skull(b, 0, 1.36, 0.04, 0.3);
      limb(b, "box", C.dark, 0.02, 1.52, 0.06, 1.43, 0.18, 0.025, 0.03);
      limb(b, "box", C.dark, 0.06, 1.43, 0.03, 1.37, 0.18, 0.025, 0.03);
      const seam = 0x9d7998;
      chain(
        b,
        "box",
        seam,
        [
          [-0.16, 1.57],
          [-0.2, 1.47],
          [-0.18, 1.34],
        ],
        0.055,
        0.022,
      );
      chain(
        b,
        "box",
        seam,
        [
          [0.13, 1.51],
          [0.183, 1.42],
          [0.15, 1.29],
        ],
        0.06,
        0.021,
      );
      for (let i = 0; i < 5; i++)
        b.box(C.bone, (i - 2) * 0.035, 1.213, 0.192, 0.026, 0.043, 0.032, 0, 0, 0.07 * (i - 2));
      b.piece("rock", C.boneD, -0.093, 1.295, 0.147, 0.102, 0.077, 0.09, 0, 0, 0.31);
    });
    for (const [x, y, w, angle] of [
      [-0.25, 0.81, 0.3, 0.16],
      [-0.091, 0.71, 0.37, -0.11],
      [0.12, 0.84, 0.27, -0.24],
    ]) {
      b.box(C.violetD, x, y, -0.128, w, 0.56, 0.05, 0.21, 0, angle);
      b.box(0x765b87, x - 0.026, y - 0.11, -0.083, w * 0.48, 0.24, 0.037, 0.21, 0, angle);
    }
    // rust pauldron on left shoulder
    b.piece("orb", C.rust, -0.3, 1.17, 0, 0.28, 0.18, 0.28, 0, 0, 0.3);
    b.piece("ring", 0x6e3218, -0.3, 1.13, 0, 0.3, 0.05, 0.3, 0, 0, 0.3);
    for (const x of [-0.375, -0.308, -0.25]) b.piece("gem", 0xac7f61, x, 1.194, 0.131, 0.057, 0.057, 0.034);
    limb(b, "box", 0x766453, -0.241, 1.151, 0.029, 0.792, 0.181, 0.07, 0.037);
    b.box(C.iron, -0.085, 0.938, 0.205, 0.113, 0.086, 0.051, 0, 0, -0.41);
    // arms
    chain(
      b,
      "box",
      C.bone,
      [
        [-0.32, 1.12],
        [-0.38, 0.92],
        [-0.34, 0.72],
      ],
      0,
      0.07,
    );
    // Keep the notched dagger in the hand throughout the shoulder's swing.
    b.group(
      "dagger-arm",
      () => {
        chain(
          b,
          "box",
          C.bone,
          [
            [0.28, 1.12],
            [0.38, 0.95],
            [0.46, 0.82],
          ],
          0.04,
          0.07,
        );
        b.box(C.dark, 0.47, 0.8, 0.1, 0.06, 0.14, 0.06);
        b.box(C.iron, 0.47, 0.88, 0.1, 0.2, 0.04, 0.06);
        b.box(C.steel, 0.47, 1.06, 0.1, 0.08, 0.32, 0.02);
        b.piece("cone", C.steel, 0.47, 1.25, 0.1, 0.08, 0.08, 0.02);
        for (const y of [1.0, 1.1]) b.box(C.dark, 0.505, y, 0.1, 0.035, 0.04, 0.03, 0, 0, 0.6);
        b.group("dagger-tip", () => {}, [0.47, 1.29, 0.1]);
      },
      [0.28, 1.12, 0.04],
    );
  },

  "wizard-wizard"(b) {
    // embroidered robe
    b.piece("cone", C.robe, 0, 0.56, 0, 0.82, 1.12, 0.72);
    for (const [y, w] of [
      [0.1, 0.78],
      [0.36, 0.6],
    ])
      b.piece("ring", C.gold, 0, y, 0, w, 0.04, w * 0.88);
    for (const y of [0.22, 0.5, 0.74]) b.piece("gem", C.gold, 0, y, 0.38 - y * 0.32, 0.08, 0.1, 0.04);
    b.piece("orb", C.robe, 0, 1.0, 0, 0.5, 0.34, 0.4);
    // head, long white beard, nose
    b.piece("orb", C.skin, 0, 1.24, 0.02, 0.26, 0.26, 0.26);
    b.piece("cone", C.beard, 0, 0.92, 0.17, 0.32, 0.6, 0.16, P);
    b.piece("orb", C.beard, 0, 1.17, 0.12, 0.3, 0.12, 0.14);
    b.piece("orb", 0xe0a880, 0, 1.23, 0.15, 0.07, 0.07, 0.07);
    eyes(b, "orb", C.dark, 1.28, 0.13, 0.04, 0.06);
    // crooked purple hat with gem
    b.piece("ring", C.purple, 0, 1.36, 0, 0.62, 0.07, 0.62);
    b.piece("cone", C.purple, 0.04, 1.6, 0, 0.38, 0.5, 0.38, 0, 0, -0.2);
    b.piece("cone", C.purple, 0.2, 1.86, 0, 0.15, 0.26, 0.15, 0, 0, -0.95);
    b.box(C.gold, 0, 1.4, 0, 0.36, 0.05, 0.36);
    glow(b, "gem", C.cyan, 0, 1.42, 0.2, 0.1, 0.13, 0.06);
    // sleeves and hands
    limb(b, "cone", C.robe, 0.22, 1.05, 0.42, 0.9, 0.04, 0.18);
    limb(b, "cone", C.robe, -0.22, 1.05, -0.4, 0.92, 0.08, 0.18);
    b.piece("orb", C.skin, 0.45, 0.88, 0.06, 0.1, 0.1, 0.1);
    b.piece("orb", C.skin, -0.42, 0.9, 0.12, 0.1, 0.1, 0.1);
    // gem staff
    b.piece("round", C.wood, 0.46, 0.86, 0.06, 0.06, 1.72, 0.06);
    for (const s of [-1, 1]) limb(b, "box", C.wood, 0.46, 1.66, 0.46 + s * 0.08, 1.8, 0.06, 0.03);
    glow(b, "gem", C.cyan, 0.46, 1.8, 0.06, 0.16, 0.24, 0.16);
    b.group("staff-tip", () => {}, [0.46, 1.8, 0.06]);
    b.group("staff-foot", () => {}, [0.46, 0, 0.06]);
    // off-hand magic
    glow(b, "orb", C.pink, -0.46, 1.06, 0.18, 0.2, 0.2, 0.2);
    [
      [-0.6, 1.18],
      [-0.34, 1.24],
      [-0.56, 0.96],
    ].forEach(([x, y]) => glow(b, "gem", C.pink, x, y, 0.2, 0.06, 0.08, 0.06));
  },

  "wizard-imp"(b) {
    // wiry bent legs with dark hooves
    for (const s of [-1, 1]) {
      chain(
        b,
        "box",
        C.magenta,
        [
          [s * 0.1, 0.56],
          [s * 0.2, 0.32],
          [s * 0.14, 0.06],
        ],
        0,
        0.07,
      );
      b.piece("cone", C.dark, s * 0.14, 0.04, 0.03, 0.1, 0.08, 0.12);
    }
    b.piece("orb", C.magenta, 0, 0.72, 0, 0.3, 0.4, 0.24);
    // wiry arms with claws
    for (const s of [-1, 1]) {
      b.group(s < 0 ? "imp-left-claw" : "imp-right-claw", () => {
        chain(
          b,
          "box",
          C.magenta,
          [
            [s * 0.14, 0.86],
            [s * 0.36, 0.7],
            [s * 0.42, 0.5],
          ],
          0.04,
          0.06,
        );
        b.piece("cone", C.dark, s * 0.43, 0.44, 0.06, 0.06, 0.08, 0.06, P);
      }, [s * 0.14, 0.86, 0.04]);
    }
    // big head, large ears, horns, lime eyes, grin
    b.piece("orb", C.magenta, 0, 1.06, 0.02, 0.42, 0.36, 0.34);
    for (const s of [-1, 1]) {
      b.piece("cone", C.magenta, s * 0.34, 1.12, 0, 0.16, 0.4, 0.06, 0, 0, -s * 1.2);
      b.piece("cone", C.magentaD, s * 0.33, 1.12, 0.02, 0.08, 0.26, 0.04, 0, 0, -s * 1.2);
      b.piece("cone", C.dark, s * 0.1, 1.28, 0, 0.08, 0.22, 0.08, 0, 0, -s * 0.35);
    }
    for (const s of [-1, 1]) glow(b, "gem", C.lime, s * 0.09, 1.09, 0.17, 0.11, 0.08, 0.06);
    b.box(C.dark, 0, 0.96, 0.17, 0.18, 0.03, 0.03);
    // arrow-tipped tail curling out to the side
    chain(
      b,
      "box",
      C.magentaD,
      [
        [0.1, 0.56],
        [0.4, 0.42],
        [0.62, 0.56],
        [0.66, 0.84],
      ],
      -0.1,
      0.05,
    );
    b.piece("cone", C.magentaD, 0.66, 0.94, -0.1, 0.18, 0.2, 0.04);
  },

  "wizard-bone-wall"(b) {
    // bone slabs, base and mid courses, tilted cap
    b.box(C.boneD, 0, 0.12, 0, 2.34, 0.24, 0.54);
    [
      [-0.6, 0.76, 1.0, 0.04],
      [0.55, 0.78, 1.1, -0.05],
    ].forEach(([x, y, w, r]) => b.box(C.bone, x, y, -0.02, w, 0.14, 0.46, 0, 0, r));
    b.group("bone-cap", () => {
      b.box(C.boneD, -0.2, 1.42, -0.04, 1.6, 0.12, 0.4, 0, 0, 0.06);
      // Crossed long bones rest on the capstone.
      limb(b, "round", C.bone, -0.9, 1.34, -0.2, 1.62, 0, 0.07);
      limb(b, "round", C.bone, -0.86, 1.62, -0.24, 1.36, 0.04, 0.07);
    }, [-0.2, 1.42, -0.04]);
    // irregular stacked skulls
    [
      [-0.88, 0.46, 0.36, 0.1],
      [-0.36, 0.44, 0.3, -0.12],
      [0.16, 0.48, 0.4, 0.05],
      [0.74, 0.44, 0.32, 0.18],
      [-0.66, 1.08, 0.38, -0.08],
      [-0.06, 1.12, 0.34, 0.14],
      [0.56, 1.06, 0.42, -0.1],
      [0.98, 1.22, 0.26, 0.3],
    ].forEach(([x, y, s, r]) => skull(b, x, y, 0.06, s, r));
    // rib arcs wedged in gaps
    for (const [x, y] of [
      [-0.62, 0.48],
      [0.46, 0.5],
      [0.26, 1.1],
    ])
      for (let i = 0; i < 3; i++) b.piece("ring", C.bone, x, y - 0.1 + i * 0.1, 0.12, 0.2, 0.03, 0.24, P / 2);
    // iron straps with rivets
    for (const y of [0.64, 0.92]) {
      b.box(C.iron, 0, y, 0.25, 2.3, 0.07, 0.05);
      for (const x of [-1.0, -0.4, 0.2, 0.8]) b.piece("orb", 0x8a9099, x, y, 0.28, 0.06, 0.06, 0.04);
    }
    for (const x of [-1.12, 1.12]) b.box(C.iron, x, 0.7, 0, 0.08, 1.2, 0.58);
  },

  "wizard-jack-o-lantern"(b) {
    // twig scarecrow body
    chain(
      b,
      "box",
      C.twig,
      [
        [-0.24, 0],
        [0, 0.5],
        [0.24, 0],
      ],
      0,
      0.06,
    );
    b.piece("round", C.twig, 0, 0.78, 0, 0.08, 0.66, 0.08);
    for (const s of [-1, 0, 1]) limb(b, "box", C.twig, 0, 0.5, s * 0.14, 1.06, 0.04 * s, 0.04);
    limb(b, "box", C.twig, -0.6, 0.98, 0.6, 1.02, 0.02, 0.06);
    for (const s of [-1, 1])
      for (const a of [-0.25, 0, 0.25])
        limb(b, "box", C.twig, s * 0.6, 1.0, s * 0.74, 1.0 + a * 0.6 + 0.04, 0.02, 0.03);
    // green carved pumpkin head with lobes
    b.piece("orb", C.pump, 0, 1.34, 0, 0.6, 0.44, 0.52);
    for (const s of [-1, 1]) b.piece("orb", C.pumpD, s * 0.17, 1.34, 0, 0.3, 0.42, 0.5);
    b.piece("orb", C.pump, 0, 1.34, 0.02, 0.3, 0.44, 0.52);
    // glowing carved face
    for (const s of [-1, 1]) glow(b, "cone", C.fire, s * 0.13, 1.4, 0.25, 0.12, 0.1, 0.04, 0, 0, s * 0.2);
    glow(b, "cone", C.fire, 0, 1.32, 0.26, 0.07, 0.06, 0.04);
    glow(b, "box", C.fire, 0, 1.22, 0.24, 0.3, 0.07, 0.04);
    for (const x of [-0.08, 0.08]) b.box(C.pump, x, 1.245, 0.26, 0.05, 0.035, 0.03);
    // stem with lit fuse
    b.piece("round", C.twig, 0, 1.6, 0, 0.08, 0.14, 0.08, 0, 0, -0.15);
    chain(
      b,
      "box",
      0x3a2a1a,
      [
        [0.02, 1.66],
        [0.1, 1.74],
        [0.08, 1.82],
      ],
      0,
      0.025,
    );
    glow(b, "orb", C.spark, 0.08, 1.86, 0, 0.1, 0.1, 0.1);
    [
      [0.0, 1.92],
      [0.16, 1.9],
    ].forEach(([x, y]) => glow(b, "gem", C.fire, x, y, 0, 0.04, 0.06, 0.04));
  },
};
