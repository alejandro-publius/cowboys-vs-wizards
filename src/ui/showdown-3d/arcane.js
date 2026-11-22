const mortar = 0x414d5f;
const stone = 0x9ea9ae;
const roof = 0x384f6a;
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
        [0x737f8b, 0x8796a0, 0x9caeb1, 0xacb5b9][(i * 3 + j * 5) % 4],
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
  b.piece("round", 0xb1bdbd, x, h, z, r * 1.18, 0.14, r * 1.18);
  b.piece("cone", roof, x, h + 0.48, z, r * 1.25, 0.95, r * 1.25);
  b.piece("cone", 0x52798b, x, h + 0.64, z, r * 0.89, 0.72, r * 0.89, 0, 0.12);
  b.piece("crystal", brass, x, h + 1.03, z, 0.13, 0.27, 0.13);
  window(b, x, h * 0.66, z + r * 0.47, r * 0.24, 0.56);
  window(b, x + r * 0.47, h * 0.66, z, r * 0.24, 0.56, true);
}
function keep(b, x, z) {
  b.box(mortar, x, 0.28, z, 4.43, 0.56, 1.78);
  b.box(stone, x, 1.4, z, 4.16, 2.8, 1.65);
  const face = z + 0.83;
  const blocks = [0x798e96, 0x95a4ad, 0xa8b5b7, 0xb7c1bf, 0x8593a1];
  for (let row = 0; row < 10; row++) {
    for (let j = 0; j < 9; j++) {
      const dx = (j - 4) * 0.455 + (row % 2 ? 0.07 : -0.03);
      if (row < 4 && Math.abs(dx) < 0.57) continue;
      b.box(blocks[(row * 7 + j * 3) % blocks.length], x + dx, 0.17 + row * 0.263, face, 0.43, 0.224, 0.09);
    }
  }
  b.box(mortar, x, 0.48, face + 0.06, 1.2, 0.92, 0.1);
  b.piece("rock", mortar, x, 0.97, face + 0.067, 1.18, 0.91, 0.16);
  b.box(0x47373c, x, 0.46, face + 0.139, 0.78, 0.9, 0.13);
  b.piece("rock", 0x47373c, x, 0.95, face + 0.143, 0.8, 0.6, 0.13);
  for (let i = -2; i <= 2; i++) b.box(0x80674e, x + i * 0.13, 0.48, face + 0.216, 0.038, 0.87, 0.035);
  b.box(0xb6bfbb, x, 2.79, z, 4.38, 0.22, 1.77);
  for (let i = -4; i <= 4; i++)
    for (const dz of [-0.78, 0.78]) {
      b.box(0xa8b3af, x + i * 0.49, 3.065, z + dz, 0.28, 0.41, 0.24);
      b.box(0xbfc9be, x + i * 0.49, 3.28, z + dz, 0.34, 0.055, 0.27);
    }
  for (const dx of [-1.38, 1.38]) {
    window(b, x + dx, 1.9, face + 0.025, 0.28, 0.56);
    b.box(0x7b4357, x + dx * 0.62, 2.18, face + 0.15, 0.31, 0.85, 0.05, 0, 0, dx * 0.03);
    b.box(0xd9b168, x + dx * 0.62, 2.62, face + 0.15, 0.42, 0.045, 0.045);
  }
  for (let i = 0; i < 21; i++) {
    const down = i / 20;
    const px = x + 1.93 - down * 0.29 + Math.sin(i * 1.8) * 0.17;
    b.box(
      [0x537458, 0x66845a, 0x355b56][i % 3],
      px,
      2.83 - down * 2.16,
      face + 0.08,
      0.14 + 0.1 * Math.sin(i * 2) ** 2,
      0.165,
      0.094,
      0,
      0,
      i * 0.39,
    );
  }
}

function swordRack(b, x, z) {
  const wood = 0x574845;
  b.box(wood, x, 0.12, z, 1.72, 0.22, 0.62);
  for (const dx of [-0.77, 0.77]) {
    b.box(wood, x + dx, 0.77, z, 0.12, 1.33, 0.15, 0, 0, dx * 0.07);
    b.box(0x79614d, x + dx, 0.23, z - 0.16, 0.13, 0.16, 0.57);
  }
  b.box(0x8e684e, x, 0.83, z, 1.64, 0.15, 0.15);
  for (let i = -1; i <= 1; i++) {
    const px = x + i * 0.43;
    const rz = i * 0.12;
    b.box(0xc6d6d7, px, 0.63, z + 0.12, 0.145, 0.91, 0.085, 0, 0, rz);
    b.box(0x7b9aab, px + 0.05, 0.63, z + 0.165, 0.044, 0.82, 0.025, 0, 0, rz);
    b.piece("cone", 0xc6d6d7, px + i * 0.065, 0.175, z + 0.12, 0.145, 0.15, 0.079, 0, 0, Math.PI + rz);
    b.box(brass, px - i * 0.049, 1.11, z + 0.12, 0.34, 0.076, 0.118, 0, 0, rz);
    b.box(wood, px - i * 0.053, 1.24, z + 0.12, 0.069, 0.233, 0.081);
    b.piece("crystal", i === 0 ? 0x94dcc0 : brass, px - i * 0.064, 1.385, z + 0.12, 0.11, 0.1, 0.11);
  }
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
  hall(b, -1.18, -2.91);
  keep(b, 3.59, -3.48);
  tower(b, 0.88, -3.31, 1.53, 2.85);
  tower(b, 6.14, -3.21, 1.64, 3.31);
  swordRack(b, 6.93, 5.82);
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
