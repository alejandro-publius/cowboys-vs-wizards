const wood = 0x8b6350,
  dark = 0x5a4660,
  iron = 0x574756,
  brass = 0xba9468,
  stone = 0x898099;
function link(b, c, a, q, w, d = w) {
  const delta = q.map((v, i) => v - a[i]),
    l = Math.hypot(...delta);
  b.box(
    c,
    ...a.map((v, i) => (v + q[i]) / 2),
    w,
    l,
    d,
    Math.atan2(delta[2], delta[1]),
    0,
    -Math.asin(delta[0] / l),
  );
}
function fence(b, x, z, w, d) {
  for (const dx of [-w / 2, 0, w / 2])
    for (const dz of [-d / 2, d / 2]) b.box(wood, x + dx, 0.43, z + dz, 0.078, 0.86, 0.074);
  for (const y of [0.29, 0.61]) {
    for (const dz of [-d / 2, d / 2]) b.box(0x9d785a, x, y, z + dz, w, 0.063, 0.075, 0, 0, 0.027);
    for (const dx of [-w / 2, w / 2]) b.box(wood, x + dx, y, z, 0.084, 0.069, d);
  }
}
export function westernDetail(b) {
  const x = -16.2,
    z = -3.2;
  for (const dx of [-0.36, 0.36])
    for (const dz of [-0.36, 0.36])
      link(b, wood, [x + dx * 1.2, 0, z + dz * 1.2], [x + dx * 0.84, 1.9, z + dz * 0.84], 0.099);
  b.box(wood, x, 1.86, z, 1.06, 0.128, 1.04);
  b.piece("round", 0xa17358, x, 2.28, z, 0.87, 0.76, 0.88);
  for (const y of [1.97, 2.24, 2.56]) b.piece("round", iron, x, y, z, 0.912, 0.055, 0.932);
  b.piece("cone", 0x765563, x, 2.79, z, 1.05, 0.34, 1.04);
  for (let i = 0; i < 8; i++) b.box(0xab815f, x + 0.2, 0.23 + i * 0.195, z + 0.45, 0.367, 0.046, 0.07);
  fence(b, -11.95, -6.25, 2.51, 1.58);
  b.box(0x624f50, -11.49, 0.16, -6.33, 0.85, 0.29, 0.39);
  b.box(0x74868a, -11.49, 0.303, -6.33, 0.72, 0.021, 0.27);
  b.piece("round", 0x9b7254, -12.21, 0.26, -6.65, 0.433, 0.51, 0.42);
  b.piece("round", brass, -12.21, 0.34, -6.65, 0.442, 0.054, 0.431);
  const poles = [-11, -8, -5, -2];
  poles.forEach((px) => {
    link(b, wood, [px, 0, -5.22], [px + 0.07, 2.39, -5.25], 0.095);
    b.box(wood, px + 0.074, 2.13, -5.24, 0.47, 0.059, 0.08);
    for (const arm of [-1, 1])
      b.piece("round", 0xa2a8a4, px + 0.071 + arm * 0.168, 2.185, -5.245, 0.061, 0.087, 0.06);
  });
  for (let i = 1; i < poles.length; i++) {
    const a = poles[i - 1] + 0.07,
      c = poles[i] + 0.07;
    link(b, iron, [a, 2.15, -5.22], [(a + c) / 2, 2.02, -5.22], 0.024);
    link(b, iron, [(a + c) / 2, 2.02, -5.22], [c, 2.15, -5.22], 0.024);
  }
  link(b, iron, [-1.93, 2.11, -5.22], [-1.3, 1.5, -5.26], 0.034);
  const railZ = 6.7;
  b.box(0x977052, -6.61, 0.117, railZ + 1.02, 2.49, 0.22, 0.77);
  for (let i = 0; i < 13; i++) b.box(0xbd946d, -7.72 + i * 0.192, 0.238, railZ + 1.02, 0.158, 0.039, 0.77);
  b.box(0x9c6952, -6.62, 0.27, railZ, 0.84, 0.113, 0.53);
  for (const dx of [-0.31, 0.32])
    for (const dz of [-0.32, 0.32])
      b.piece("round", iron, -6.62 + dx, 0.173, railZ + dz, 0.24, 0.08, 0.23, Math.PI / 2);
  link(b, iron, [-6.66, 0.285, railZ], [-6.57, 0.55, railZ], 0.078);
  b.box(brass, -6.55, 0.573, railZ, 0.43, 0.045, 0.055, 0, 0, 0.21);
  b.box(wood, -1.2, 0.19, railZ, 0.27, 0.37, 0.9, 0, 0, 0.24);
  const crosses = [
    [-15.57, 5.17],
    [-16.06, 5.71],
    [-15.03, 5.81],
    [-14.56, 5.28],
    [-13.87, 5.73],
  ];
  crosses.forEach(([tx, tz], i) => {
    b.piece("rock", 0x967357, tx + 0.09, 0.049, tz + 0.18, 0.51, 0.13, 0.5);
    b.box(wood, tx, 0.237, tz, 0.055, 0.47, 0.055, 0, 0, 0.13 * (i % 2 ? 1 : -1));
    b.box(brass, tx, 0.332, tz, 0.243, 0.05, 0.058, 0, 0, 0.13 * (i % 2 ? 1 : -1));
    b.box(0x66504c, tx + 0.127, 0.11, tz + 0.25, 0.07, 0.16, 0.125);
  });
  b.sign("BOOT HILL", -15.2, 0.31, 6.22, 0.83, 0.22, "#8f674f", "#f1d4a3");
}
export function wizardDetail(b) {
  const x = 14.95,
    z = -6.79;
  b.piece("round", dark, x, 1.08, z, 1.42, 2.14, 1.42);
  for (let i = 0; i < 7; i++)
    b.piece("round", i % 2 ? stone : 0x716d8d, x, 0.235 + i * 0.278, z, 1.45, 0.081, 1.45);
  b.piece("round", stone, x, 2.16, z, 1.55, 0.207, 1.55);
  b.piece("cone", 0x726189, x, 2.82, z, 1.74, 1.17, 1.74);
  b.piece("crystal", 0xa1c5bf, x, 3.54, z, 0.17, 0.349, 0.17);
  b.box(0x9bd5be, x, 1.27, z + 0.717, 0.205, 0.475, 0.022);
  b.box(brass, x, 1.27, z + 0.732, 0.024, 0.463, 0.027);
  const tree = 8.53,
    back = -6.37;
  link(b, 0x51455f, [tree, 0, back], [tree - 0.13, 1.7, back], 0.191);
  link(b, 0x594966, [tree - 0.085, 1.04, back], [tree - 0.65, 1.69, back + 0.14], 0.106);
  link(b, 0x635575, [tree - 0.133, 1.62, back], [tree + 0.231, 2.16, back + 0.045], 0.085);
  link(b, 0x635575, [tree - 0.14, 1.33, back], [tree + 0.43, 1.63, back - 0.14], 0.107);
  for (const [a, c, e] of [
    [tree - 0.55, 1.73, back + 0.14],
    [tree + 0.34, 1.66, back - 0.14],
  ]) {
    b.piece("rock", 0x30334d, a, c, e, 0.212, 0.163, 0.174);
    b.piece("rock", 0x514966, a + 0.072, c + 0.085, e, 0.118, 0.104, 0.101);
  }
  for (let i = 0; i < 22; i++) {
    const dx = 7.7 + i * 0.328;
    if (dx > 9.6 && dx < 10.5) continue;
    b.box(dark, dx, 0.172, 7.56, 0.044, 0.35, 0.046);
    b.piece("cone", stone, dx, 0.369, 7.56, 0.083, 0.109, 0.084);
    if (i < 21 && !(dx > 9.22 && dx < 10.5)) b.box(iron, dx + 0.16, 0.127, 7.56, 0.334, 0.041, 0.061);
  }
  for (const [a, c] of [
    [14.7, 4.96],
    [15.38, 4.63],
    [16.02, 2.66],
  ]) {
    b.box(0x423950, a, 0.036, c, 0.61, 0.064, 0.97, 0, 0.16);
    b.piece("rock", 0x706180, a + 0.33, 0.092, c, 0.21, 0.18, 0.76, 0, 0.66);
    b.box(stone, a, 0.24, c - 0.56, 0.345, 0.475, 0.1, 0, 0, 0.17);
  }
  b.box(dark, 11.72, 0.197, 5.18, 0.12, 0.395, 0.16);
  b.box(stone, 11.72, 0.411, 5.18, 0.388, 0.086, 0.32, 0.37);
  b.box(0xbf986f, 11.72, 0.461, 5.188, 0.157, 0.053, 0.101, 0.35);
  b.piece("rock", dark, 16.5, 0.81, -1.46, 1.82, 1.63, 1.91, 0, 0.52);
  b.piece("rock", stone, 16.68, 1.8, -1.6, 1.19, 1.34, 1.64, 0, 0.13);
  b.box(0x2f3348, 16.48, 0.681, -0.545, 0.27, 0.825, 0.045, 0, 0, 0.14);
  b.piece("crystal", 0x80c1a5, 16.47, 0.545, -0.51, 0.109, 0.589, 0.033, 0, 0, 0.14);
}
export function duskDetail(b) {
  const tones = [0xb59676, 0xa3927e, 0x928292, 0x80768d, 0x706881];
  for (let row = 0; row < 37; row++)
    for (let col = 0; col < 11; col++) {
      const x = -1.79 + col * 0.35 + (row % 2 ? 0.11 : -0.06),
        z = -7.62 + row * 0.423;
      if ((Math.abs(x) < 1.5 && Math.abs(z - 0.34) < 1.51) || (row * 17 + col * 9) % 10 > 4 + col * 0.34)
        continue;
      const i = Math.min(4, Math.floor(col / 2.25));
      b.box(tones[i], x, 0.013, z, 0.29, 0.018, 0.344, 0, 0.022 * Math.sin(col * 4 + row));
    }
  b.box(wood, -0.33, 0.71, -5.58, 0.109, 1.41, 0.102, 0, 0, 0.09);
  b.box(0xb28b6c, -0.41, 1.346, -5.55, 0.652, 0.155, 0.057, 0, 0, 0.14);
  b.box(0x726779, -0.191, 1.03, -5.52, 0.499, 0.132, 0.068, 0, 0, -0.16);
  b.box(dark, 1.6, 0.48, -5.23, 0.083, 0.955, 0.087);
  b.box(stone, 1.6, 0.958, -5.23, 0.237, 0.091, 0.229);
  b.piece("crystal", 0x95d4ac, 1.6, 0.817, -5.223, 0.147, 0.262, 0.141);
}
