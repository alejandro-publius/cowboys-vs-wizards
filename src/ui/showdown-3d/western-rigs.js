const cream = 0xded0ad,
  brass = 0xd5a054,
  brown = 0x80543d,
  dark = 0x44343e,
  iron = 0x5b5667,
  skin = 0xc98e6e,
  teal = 0x48968a;
function person(b, x, y, z, s, scout = false, apron = false) {
  const part = (kind, color, dx, dy, dz, w, h, d, rx = 0, rz = 0) =>
    b.piece(kind, color, x + dx * s, y + dy * s, z + dz * s, w * s, h * s, d * s, rx, 0, rz);
  for (const side of [-1, 1]) {
    part("box", 0x62505b, side * 0.118, 0.33, 0, 0.174, 0.49, 0.2, 0, side * 0.093);
    part("box", dark, side * 0.124, 0.113, 0.072, 0.214, 0.18, 0.33);
    part(
      "round",
      cream,
      side * 0.237,
      0.88,
      0.015,
      0.157,
      0.31,
      0.156,
      side === 1 && !apron && !scout ? -0.81 : 0.35,
      side * 0.33,
    );
  }
  part("rock", apron ? dark : scout ? 0x8f7556 : 0xa06443, 0, 0.896, 0, 0.465, 0.55, 0.363);
  part("box", dark, 0, 0.671, 0.115, 0.401, 0.084, 0.15);
  part("gem", brass, 0, 0.668, 0.215, 0.07, 0.077, 0.052);
  part(
    "box",
    apron ? 0x694e3d : scout ? 0xb9976a : teal,
    0,
    1.103,
    0.088,
    0.347,
    scout ? 0.187 : 0.117,
    0.241,
  );
  if (scout) part("box", 0xa24c45, 0, 1.18, 0.177, 0.29, 0.13, 0.059);
  part("rock", skin, 0, 1.282, 0.03, 0.338, 0.326, 0.336);
  part("box", dark, -0.057, 1.288, -0.106, 0.22, 0.244, 0.154, 0.084);
  part("round", apron ? dark : 0xc49a69, 0, 1.434, -0.025, 0.558, 0.073, 0.478, -0.19);
  part("rock", apron ? 0x7f5e55 : 0xbe9261, 0, 1.509, -0.057, 0.332, 0.225, 0.327, -0.12);
  if (!scout && !apron) {
    part("rock", skin, 0.307, 1.129, 0.13, 0.141, 0.161, 0.133);
    part("box", iron, 0.313, 1.294, 0.16, 0.089, 0.35, 0.096, 0, -0.14);
    part("box", brown, 0.322, 1.15, 0.203, 0.105, 0.121, 0.083, 0, -0.32);
  }
  if (scout) part("box", 0xb4a083, 0.133, 0.68, -0.202, 0.45, 0.53, 0.062, -0.35, 0.59);
}
function horse(b, gray) {
  const hide = gray ? 0x9c9390 : 0x995d47,
    mane = gray ? 0x5b5460 : dark;
  b.piece("rock", hide, 0.1, 0.76, 0, 1.37, 0.635, 0.63, 0, 0, gray ? 0.04 : 0.16);
  b.piece("rock", hide, 0.603, 1.015, 0, 0.553, 0.779, 0.43, 0, 0, -0.45);
  b.piece("rock", hide, 0.91, 1.34, 0.013, 0.49, 0.394, 0.334, 0, 0, 0.21);
  b.piece("rock", cream, 1.054, 1.282, 0.025, 0.281, 0.267, 0.288, 0, 0, 0.14);
  b.piece("rock", gray ? cream : brown, -0.35, 0.798, 0.139, 0.549, 0.521, 0.446);
  for (const side of [-1, 1]) {
    b.piece("cone", hide, 0.791, 1.521, side * 0.092, 0.145, 0.27, 0.128, 0.19, 0, -0.25);
    b.piece("gem", dark, 0.989, 1.389, side * 0.157, 0.067, 0.061, 0.046);
    for (const front of [-1, 1]) {
      const x = front * 0.471 + (front === 1 ? 0.25 : 0),
        angle = gray ? front * 0.45 : side * 0.33 - front * 0.19;
      b.box(
        hide,
        x,
        0.411 + (front === 1 && !gray ? 0.094 : 0),
        side * 0.219,
        0.117,
        0.644,
        0.141,
        0,
        0,
        angle,
      );
      b.box(
        dark,
        x + Math.sin(angle) * 0.3,
        0.139 + (front === 1 && !gray ? 0.094 : 0),
        side * 0.22,
        0.163,
        0.15,
        0.167,
      );
    }
  }
  b.box(mane, -0.71, 0.637, 0.042, 0.151, 0.52, 0.156, 0, 0, -0.65);
  b.box(mane, 0.477, 1.015, 0, 0.139, 0.651, 0.301, 0, 0, -0.57);
  b.box(brown, 0.035, 1.041, 0, 0.54, 0.19, 0.677, 0.06);
  b.box(gray ? 0xa48764 : teal, 0.019, 0.981, 0, 0.49, 0.13, 0.674);
  b.box(brass, 0.106, 0.868, 0.349, 0.082, 0.235, 0.062);
}
function wheel(b, x, y, z, size) {
  b.piece("ring", iron, x, y, z, size, 0.401, size, Math.PI / 2);
  b.piece("round", brass, x, y, z, 0.15, 0.16, 0.15, Math.PI / 2);
  for (let j = 0; j < 5; j++) b.box(brown, x, y, z, 0.049, size * 0.92, 0.037, 0, 0, (j * Math.PI) / 5);
}
export const ART = {
  "cowboy-billy"(b) {
    person(b, 0, 0, 0, 1);
  },
  "cowboy-mounted-billy"(b) {
    horse(b, false);
    b.group("rider", () => person(b, -0.048, 0.854, 0.01, 0.73));
    b.box(brass, 0.322, 1.535, 0.076, 0.639, 0.036, 0.037, 0, 0, -0.45);
  },
  "cowboy-outrider"(b) {
    horse(b, true);
    b.group("rider", () => {
      person(b, 0.299, 0.77, 0, 0.72, true);
      b.piece("box", 0x9a805e, -0.065, 1.359, 0.018, 0.572, 0.187, 0.249, 0, 0, 0.34);
    });
  },
  "cowboy-covered-wagon"(b) {
    b.box(brown, 0, 0.5, 0, 1.99, 0.33, 0.948);
    b.box(0xa47a55, 0, 0.695, -0.083, 1.84, 0.31, 0.94);
    b.piece("round", cream, -0.19, 0.827, 0, 1.27, 1.65, 1.35, 0, 0, Math.PI / 2);
    b.box(brown, -0.18, 0.536, 0, 1.69, 0.51, 1.34);
    for (const z of [-0.584, 0.587]) {
      for (const x of [-0.63, 0.55]) wheel(b, x, 0.356, z, 0.702);
      for (let i = 0; i < 5; i++) {
        b.box(iron, -0.758 + i * 0.27, 0.635, z, 0.234, 0.235, 0.05, 0, 0, 0.08 * (i % 2));
        b.box(brass, -0.758 + i * 0.27, 0.653, z * 1.05, 0.035, 0.04, 0.02);
      }
    }
    for (let i = 0; i < 4; i++)
      b.box(i % 2 ? 0xa99878 : 0xc5b792, -0.765 + i * 0.37, 1.06, 0.58, 0.028, 0.357, 0.033, -0.15);
    b.box(0xb7a07c, -0.43, 1.079, 0.62, 0.312, 0.108, 0.031, -0.14, 0.07, -0.2);
    b.box(dark, 0.867, 0.763, 0, 0.322, 0.304, 0.532);
    b.piece("round", 0x917354, 0.931, 1.018, 0.006, 0.362, 0.073, 0.321, 0.11);
    b.box(iron, 1.053, 0.881, 0.04, 0.406, 0.064, 0.096, 0, 0, 0.02);
  },
  "cowboy-gatling-crew"(b) {
    b.box(brown, 0, 0.42, 0, 1.51, 0.233, 0.867);
    for (const z of [-0.491, 0.49]) wheel(b, -0.276, 0.323, z, 0.657);
    b.box(iron, -0.128, 0.651, 0, 0.285, 0.424, 0.36);
    b.group("gatling-pivot", () => {
      b.group("gatling-barrels", () => {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          b.piece("round", i % 2 ? brass : 0xb08853, 0.35, 0.82 + 0.105 * Math.cos(a),
            0.108 * Math.sin(a), 0.098, 0.9, 0.098, 0, 0, Math.PI / 2);
        }
        for (const x of [-0.023, 0.675])
          b.piece("round", iron, x, 0.824, 0, 0.359, 0.091, 0.358, 0, 0, Math.PI / 2);
      }, [0, 0.824, 0]);
      b.anchor("muzzle", 0.8, 0.824, 0);
    }, [-0.128, 0.824, 0]);
    b.box(brass, -0.108, 1.049, -0.025, 0.182, 0.436, 0.211, 0, 0, -0.19);
    person(b, -0.647, 0.009, 0.191, 0.81, false, true);
    person(b, 0.43, 0.017, -0.565, 0.81, true, true);
  },
};
