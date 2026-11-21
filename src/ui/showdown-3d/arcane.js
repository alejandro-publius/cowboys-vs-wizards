const mortar = 0x48445d;
const stone = 0x7a8194;
const roof = 0x5c4675;
const brass = 0xd2a775;
const glass = 0x78c9c5;

function window(b, x, y, z, width, height, side = false) {
  const ry = side ? Math.PI / 2 : 0;
  const dx = side ? 0.035 : 0;
  const dz = side ? 0 : 0.035;
  b.box(mortar, x, y, z, width * 1.29, height * 0.89, 0.049, 0, ry);
  b.piece(
    "rock",
    mortar,
    x,
    y + height * 0.37,
    z,
    side ? 0.11 : width * 1.27,
    height * 0.55,
    side ? width * 1.27 : 0.11,
  );
  b.box(glass, x + dx, y, z + dz, width * 0.79, height * 0.73, 0.035, 0, ry);
  b.piece(
    "rock",
    glass,
    x + dx,
    y + height * 0.29,
    z + dz,
    side ? 0.087 : width * 0.77,
    height * 0.49,
    side ? width * 0.77 : 0.087,
  );
  b.box(brass, x + dx * 1.64, y, z + dz * 1.64, 0.034, height * 0.83, 0.035, 0, ry);
  b.box(stone, x + dx * 1.64, y - height * 0.42, z + dz * 1.64, width * 1.49, 0.076, 0.124, 0, ry);
}

function tower(b, x, z, r, h) {
  b.piece("round", mortar, x, 0.15, z, r * 1.22, 0.3, r * 1.22);
  b.piece("round", stone, x, h / 2, z, r, h, r);
  for (let i = 0; i < Math.floor(h / 0.22); i++) {
    const y = 0.26 + i * 0.22;
    for (let j = 0; j < 10; j++) {
      const a = ((j + (i % 2) * 0.5) * Math.PI) / 5;
      const r2 = r * (j % 2 ? 0.44 : 0.448);
      b.box(
        [0x666d84, 0x8f849c, 0x737990, 0x9697a0][(i * 3 + j * 5) % 4],
        x + r2 * Math.sin(a),
        y,
        z + r2 * Math.cos(a),
        r * 0.285,
        0.14,
        r * 0.09,
        0,
        a,
      );
    }
  }
  b.piece("round", mortar, x, h - 0.16, z, r * 1.08, 0.087, r * 1.08);
  b.piece("round", 0x9b8fa6, x, h, z, r * 1.18, 0.14, r * 1.18);
  b.piece("cone", roof, x, h + 0.48, z, r * 1.25, 0.95, r * 1.25);
  b.piece("cone", 0x79608b, x, h + 0.64, z, r * 0.89, 0.72, r * 0.89, 0, 0.12);
  b.piece("crystal", brass, x, h + 1.03, z, 0.13, 0.27, 0.13);
  window(b, x, h * 0.66, z + r * 0.47, r * 0.24, 0.56);
  window(b, x + r * 0.47, h * 0.66, z, r * 0.24, 0.56, true);
}

function hall(b, x, z) {
  b.box(mortar, x, 0.089, z, 1.98, 0.18, 1.39);
  b.box(stone, x, 0.58, z, 1.85, 1.16, 1.23);
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 7; col++)
      b.box(
        (col + row) % 3 ? 0x716b83 : 0x918198,
        x - 0.8 + col * 0.249 + (row % 2) * 0.035,
        0.14 + row * 0.167,
        z + 0.625,
        0.228,
        0.128,
        0.045,
      );
  b.box(roof, x, 1.24, z + 0.34, 2.03, 0.105, 0.86, -0.47);
  b.box(0x6c538a, x, 1.24, z - 0.34, 2.03, 0.106, 0.86, 0.47);
  for (let i = 0; i < 13; i++) {
    const ridge = i % 3 === 0 ? 0x806897 : 0x614f7d;
    b.box(ridge, x - 0.93 + i * 0.156, 1.299, z + 0.344, 0.06, 0.035, 0.86, -0.47);
  }
  b.box(mortar, x, 0.42, z + 0.652, 0.46, 0.66, 0.054);
  b.box(0x533e67, x, 0.37, z + 0.69, 0.34, 0.6, 0.06);
  for (const side of [-1, 1]) window(b, x + side * 0.64, 0.56, z + 0.659, 0.25, 0.43);
  b.piece("ring", brass, x, 1.52, z, 0.27, 0.27, 0.27, Math.PI / 2);
  b.piece("crystal", glass, x, 1.52, z, 0.112, 0.21, 0.118);
}

function lookout(b, x, z) {
  b.piece("round", mortar, x, 0.045, z, 0.55, 0.08, 0.51);
  b.piece("cone", 0x5a3d79, x, 0.259, z, 0.41, 0.46, 0.31);
  b.box(0x725098, x, 0.32, z, 0.28, 0.26, 0.24);
  b.piece("rock", 0xe9c9b0, x, 0.56, z + 0.019, 0.2, 0.211, 0.19);
  b.piece("round", 0x604781, x, 0.642, z, 0.38, 0.053, 0.33);
  b.piece("cone", 0x745399, x + 0.022, 0.782, z, 0.29, 0.29, 0.28, 0, 0, -0.22);
  b.box(0x61445a, x + 0.244, 0.35, z + 0.08, 0.045, 0.69, 0.045, 0, 0, 0.13);
  b.piece("crystal", glass, x + 0.204, 0.742, z + 0.08, 0.115, 0.18, 0.109);
}
export function addArcane(b) {
  hall(b, 2.06, -3.62);
  b.box(mortar, 4.79, 0.63, -3.57, 2.99, 1.26, 1.07);
  b.box(0x746b8a, 4.79, 1.225, -3.56, 2.91, 0.16, 1.2);
  tower(b, 6.08, -3.19, 1.17, 1.66);
  lookout(b, 5.34, -0.85);
  for (const [x, z, size] of [
    [6.72, -1.96, 0.4],
    [7.11, -1.38, 0.46],
    [6.96, -0.74, 0.29],
  ]) {
    b.box(mortar, x, 0.039, z, size * 0.98, 0.078, 0.23);
    b.box(stone, x, size * 0.57, z, size * 0.62, size, 0.16, 0, 0.13, 0.095);
    b.piece("rock", stone, x - 0.01, size, z, size * 0.62, size * 0.44, 0.18);
  }
  for (const [x, z] of [
    [1.16, -2.49],
    [6.4, 0.25],
  ]) {
    b.piece("round", mortar, x, 0.15, z, 0.27, 0.3, 0.27);
    b.piece("crystal", glass, x, 0.36, z, 0.15, 0.29, 0.14, 0, 0.37);
  }
}
