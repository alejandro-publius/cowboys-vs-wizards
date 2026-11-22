const clay = [0xa27559, 0x8f614c, 0xb18464];
const crag = [0x4f4c70, 0x5c577e, 0x777294];

export function formations(b, strata, columns) {
  for (const [x, z, width, height, depth, spin] of columns) {
    for (let layer = 0; layer < 3; layer++) {
      const scale = 1 - layer * 0.13;
      b.piece(
        "rock",
        strata[layer],
        x + layer * 0.1,
        height * (0.23 + 0.235 * layer),
        z,
        width * scale,
        height * 0.54,
        depth * scale,
        0,
        spin + layer * 0.24,
      );
    }
  }
}

function cacti(b, x, z, h) {
  b.piece("round", 0x537e56, x, h * 0.48, z, 0.23 * h, h, 0.23 * h);
  for (const arm of [-1, 1]) {
    const y = h * (0.55 + arm * 0.09);
    b.box(0x639369, x + 0.16 * h * arm, y, z, 0.29 * h, 0.13 * h, 0.12 * h, 0, 0, 0.23 * arm);
    b.piece("round", 0x639369, x + 0.3 * h * arm, y + 0.18 * h, z, 0.14 * h, 0.44 * h, 0.14 * h);
  }
}

function crystal(b, x, z, size) {
  b.piece("rock", 0x474462, x, 0.13 * size, z, 0.8 * size, 0.38 * size, 0.67 * size, 0, 0.8);
  b.piece("crystal", 0x65b5b9, x, 0.52 * size, z, 0.45 * size, 1.01 * size, 0.41 * size, -0.24, 0.42, 0.17);
  b.piece(
    "crystal",
    0x9072b9,
    x + 0.23 * size,
    0.32 * size,
    z + 0.12 * size,
    0.28 * size,
    0.67 * size,
    0.27 * size,
    0.18,
    0.36,
    -0.37,
  );
}

export function bluePine(b, x, z, h) {
  b.piece("round", 0x51435e, x, 0.34 * h, z, 0.14 * h, 0.68 * h, 0.16 * h);
  for (let layer = 0; layer < 3; layer++) {
    const color = [0x3d5a6a, 0x516f83, 0x527b86][layer];
    const spread = h * (0.75 - 0.15 * layer);
    b.piece("cone", color, x, 0.5 * h + layer * 0.24 * h, z, spread, 0.63 * h, spread, 0, layer * 0.64);
  }
}

function ridgeLandmarks(b) {
  const x = -5.8,
    z = -6.25;
  b.box(0x8e674f, x, 0.075, z + 0.1, 3.48, 0.15, 1.56);
  b.box(0x6c4a39, x, 0.46, z - 0.45, 2.91, 0.77, 0.12);
  b.box(0xa47154, x, 1.1, z - 0.17, 3.13, 0.125, 1.41, 0.12);
  for (const dx of [-1.35, 0, 1.35]) {
    b.box(0x8a6348, x + dx, 0.58, z + 0.56, 0.09, 1.03, 0.09);
    b.box(0x584037, x + dx, 1.04, z + 0.62, 0.14, 0.094, 0.14);
  }
  b.sign("DEPOT", x, 1.02, z + 0.66, 1.59, 0.235, "#c49d72", "#513326");
  const archZ = -6.26;
  for (const dx of [-0.69, 0.69]) {
    b.box(0x706680, 6.42 + dx, 0.68, archZ, 0.36, 1.3, 0.49);
    b.box(0x9589a8, 6.42 + dx, 1.3, archZ, 0.48, 0.17, 0.53);
    b.box(0x81acb3, 6.42 + dx, 0.91, archZ + 0.26, 0.13, 0.36, 0.053);
  }
  b.box(0x827091, 6.42, 1.49, archZ, 1.86, 0.24, 0.49);
  b.piece("ring", 0xc0a5d0, 6.42, 1.92, archZ, 0.63, 0.62, 0.63, Math.PI / 2);
  b.piece("crystal", 0x8ce1d0, 6.42, 1.93, archZ, 0.3, 0.52, 0.31, 0, 0.43);
  bluePine(b, 4.48, -7.11, 1.7);
  bluePine(b, 7.56, -7.28, 1.21);
}

export function addLandmarks(b) {
  ridgeLandmarks(b);
  formations(b, clay, [
    [-15.72, -4, 2.34, 2.84, 2.1, 0.41],
    [-16.37, -1.77, 1.62, 1.45, 1.76, 0.97],
    [-14.27, -3.45, 1.42, 1.23, 1.55, 0.2],
    [-16.18, 3.42, 1.24, 0.73, 1.2, 0.78],
    [-13.88, 6.42, 1.17, 0.53, 0.92, 0.28],
  ]);
  formations(b, crag, [
    [15.16, -4.69, 2.08, 1.87, 2.42, 0.62],
    [16.26, -2.4, 1.8, 2.8, 2.01, 0.82],
    [16.3, 1.8, 1.69, 1.28, 2.04, 0.1],
    [13.64, 6.72, 1.29, 0.54, 0.94, 0.78],
  ]);
  for (const [x, z, h] of [
    [-16.95, 0.21, 1.38],
    [-16.22, 0.44, 0.7],
    [-14.61, 1.64, 0.94],
    [-15.01, 4.89, 1.09],
    [-12.18, 5.9, 0.59],
    [-7.01, 6.09, 0.77],
    [-2.71, 6.5, 0.67],
  ])
    cacti(b, x, z, h);
  for (const [x, z, h] of [
    [15.25, -3.37, 1.4],
    [16.88, -1.28, 1.32],
    [16.06, 1.16, 1.17],
    [14.84, 2.55, 0.88],
    [13.99, 6.67, 0.72],
  ])
    bluePine(b, x, z, h);
  for (const [x, z, h] of [
    [7.03, 6.4, 1.03],
    [10.8, 6.48, 0.78],
    [14.35, 6.06, 0.92],
    [15.49, 2.55, 1.01],
    [15.33, -0.46, 1.21],
    [2.55, -6.3, 0.81],
  ])
    crystal(b, x, z, h);
  for (const [x, z] of [
    [14.78, 3.18],
    [15.46, 3.39],
    [14.96, 4.1],
    [15.23, 4.84],
    [16.05, 4.22],
  ]) {
    b.box(0x4c495e, x, 0.065, z, 0.53, 0.13, 0.37);
    b.box(0x8a879b, x, 0.4, z, 0.38, 0.68, 0.141, 0, 0.16, 0.12);
    b.piece("rock", 0x9d96ad, x - 0.048, 0.72, z, 0.38, 0.21, 0.17, 0, 0.26);
  }
  // The canyon passes the saloon through a gate without crossing the playable field.
  for (const x of [-15.35, -14.06]) {
    b.box(0x6b4837, x, 0.58, 6.9, 0.118, 1.16, 0.122);
    b.box(0xba8a61, x, 1.17, 6.9, 0.16, 0.06, 0.153);
  }
  b.box(0x885e46, -14.7, 0.99, 6.9, 1.39, 0.082, 0.112);
}
