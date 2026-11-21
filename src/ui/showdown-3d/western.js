// Western half scenery: main street behind the card zone, water tower + cacti on the outer left.
// Assumes b.box / b.piece position (x,y,z) is the CENTER of the piece; helpers below take a bottom y.
// Clear zones respected: card x -4.35..-1.3, z -1.15..2.1, and everything stays at x <= -1.35 (lane clear).
const P = {
  ochre: 0xd99a3e,
  ochreDk: 0xa8702a,
  adobe: 0xc9794a,
  adobeDk: 0x9c5534,
  brick: 0x9e2f22,
  brickDk: 0x6e1e17,
  teal: 0x5f8c88,
  tealDk: 0x3f615e,
  wood: 0x8a5a32,
  woodDk: 0x5a3a20,
  woodLt: 0xb98a55,
  plank: 0x7a4e2b,
  stone: 0x7d7468,
  glass: 0x22303a,
  glow: 0xf2c25c,
  roof: 0x4a3328,
  tin: 0x8f9396,
  rust: 0xa4512a,
  cactus: 0x3f8a3c,
  cactusDk: 0x2c6430,
  gold: 0xf0c53a,
  white: 0xeee2c4,
  sage: 0x8a9a5b,
  dark: 0x1c1410,
};
const R = Math.PI / 180;

export function addWestern(b) {
  const box = (c, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => b.box(c, x, y + h / 2, z, w, h, d, rx, ry, rz);
  const pc = (k, c, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) =>
    b.piece(k, c, x, y + h / 2, z, w, h, d, rx, ry, rz);

  const windowAt = (x, y, zf, w, h, trim) => {
    box(trim, x, y - 0.04, zf + 0.03, w + 0.1, 0.05, 0.07); // sill
    box(trim, x, y + h, zf + 0.02, w + 0.08, 0.05, 0.05); // header
    box(trim, x - w / 2 - 0.02, y, zf + 0.02, 0.04, h, 0.05);
    box(trim, x + w / 2 + 0.02, y, zf + 0.02, 0.04, h, 0.05);
    box(P.glass, x, y, zf + 0.01, w, h, 0.02);
    box(P.glow, x, y + h * 0.15, zf + 0.012, w * 0.7, h * 0.35, 0.02); // warm interior glint
    box(trim, x, y + h / 2 - 0.015, zf + 0.025, w, 0.03, 0.02); // muntin
  };

  // Generic false-front storefront with porch + awning.
  const building = (o) => {
    const { x0, x1, zb, zf, h, ff, wall, wallDk, trim } = o;
    const cx = (x0 + x1) / 2,
      w = x1 - x0,
      cz = (zb + zf) / 2,
      d = zf - zb;
    box(P.stone, cx, 0, cz, w + 0.08, 0.1, d + 0.08);
    box(wall, cx, 0.1, cz, w, h, d);
    for (let y = 0.28; y < h; y += 0.2) box(wallDk, cx, 0.1 + y, zf + 0.005, w, 0.025, 0.02); // siding seams
    box(wall, cx, 0.1 + h, zf - 0.05, w, ff, 0.1); // false front
    box(trim, cx, 0.1 + h + ff, zf - 0.05, w + 0.1, 0.07, 0.16); // cornice cap
    box(trim, cx, 0.1 + h + ff - 0.12, zf + 0.01, w, 0.04, 0.03); // cornice band
    for (const s of [-1, 1]) box(trim, cx + s * (w / 2 - 0.02), 0.1, zf + 0.01, 0.06, h + ff, 0.04); // corner boards
    box(P.roof, cx, 0.1 + h - 0.05, cz - 0.05, w - 0.04, 0.08, d - 0.1, -6 * R); // pitched tin roof
    box(P.tin, cx + w * 0.3, 0.1 + h, zb + 0.25, 0.1, 0.35, 0.1); // stovepipe
    // door
    box(P.dark, cx, 0.1, zf + 0.01, 0.34, 0.62, 0.02);
    box(trim, cx, 0.72, zf + 0.02, 0.42, 0.05, 0.05);
    windowAt(cx - w * 0.3, 0.42, zf, 0.26, 0.3, trim);
    windowAt(cx + w * 0.3, 0.42, zf, 0.26, 0.3, trim);
    windowAt(cx - w * 0.25, 1.25, zf, 0.22, 0.26, trim);
    windowAt(cx + w * 0.25, 1.25, zf, 0.22, 0.26, trim);
    // porch deck, boards, step, posts, awning
    const pz = zf + 0.24;
    box(P.woodDk, cx, 0, pz, w + 0.04, 0.12, 0.46);
    for (let x = x0 + 0.1; x < x1; x += 0.14) box(P.plank, x, 0.12, pz, 0.11, 0.015, 0.44);
    box(P.wood, cx, 0, zf + 0.53, 0.5, 0.06, 0.14);
    for (const t of [0, 0.5, 1]) {
      const px = x0 + 0.05 + t * (w - 0.1);
      box(P.woodLt, px, 0.12, zf + 0.44, 0.06, 0.9, 0.06);
      box(P.woodDk, px, 0.12, zf + 0.44, 0.09, 0.06, 0.09);
    }
    box(P.woodDk, cx, 0.42, zf + 0.44, w - 0.1, 0.04, 0.03); // rail
    box(o.awning, cx, 1.02, pz + 0.03, w + 0.08, 0.05, 0.55, 12 * R);
    box(trim, cx, 0.98, zf + 0.53, w + 0.08, 0.06, 0.04); // fascia
    if (o.sign) b.sign(o.sign, cx, 0.1 + h + ff * 0.5, zf + 0.012, w * 0.78, ff * 0.62, o.face, o.ink);
    return { cx, w, x0, zf };
  };

  // 1. SALOON: ochre siding, brick-red trim, tallest false front.
  const s = building({
    x0: -6.75,
    x1: -5.05,
    zb: -4.0,
    zf: -2.62,
    h: 1.65,
    ff: 0.75,
    wall: P.ochre,
    wallDk: P.ochreDk,
    trim: P.brick,
    awning: P.brickDk,
    sign: "SALOON",
    face: "#7a4a24",
    ink: "#f6deb0",
  });
  for (const sx of [-1, 1])
    box(P.ochre, s.cx + sx * 0.085, 0.3, s.zf + 0.04, 0.15, 0.3, 0.025, 0, sx * 18 * R); // batwings
  box(P.brick, s.cx, 1.12, s.zf + 0.08, s.w - 0.1, 0.05, 0.16); // balcony ledge
  for (let x = s.cx - 0.7; x <= s.cx + 0.71; x += 0.14)
    box(P.woodLt, x, 1.17, s.zf + 0.14, 0.025, 0.2, 0.025);
  // 2. MARSHAL office: teal-gray, lower, barred window + star.
  const m = building({
    x0: -4.88,
    x1: -3.42,
    zb: -3.9,
    zf: -2.5,
    h: 1.35,
    ff: 0.5,
    wall: P.teal,
    wallDk: P.tealDk,
    trim: P.white,
    awning: P.tealDk,
    sign: "MARSHAL",
    face: "#e8dcc0",
    ink: "#2b3f3d",
  });
  for (let i = -2; i <= 2; i++)
    box(P.dark, m.cx - m.w * 0.3 + i * 0.05, 0.42, m.zf + 0.04, 0.018, 0.3, 0.018);
  pc("round", P.gold, m.cx, 0.85, m.zf + 0.03, 0.16, 0.03, 0.16, 90 * R);
  pc("cone", P.gold, m.cx, 0.85, m.zf + 0.045, 0.12, 0.02, 0.12, 90 * R, 0, 30 * R);
  // 3. Adobe trading post: rounded parapet, protruding vigas.
  const a = building({
    x0: -3.25,
    x1: -1.45,
    zb: -4.0,
    zf: -2.6,
    h: 1.2,
    ff: 0.42,
    wall: P.adobe,
    wallDk: P.adobeDk,
    trim: P.brick,
    awning: P.wood,
    sign: "GOODS",
    face: "#f0dcaa",
    ink: "#8a2a1c",
  });
  pc("round", P.adobe, a.cx, 1.65, a.zf - 0.05, 0.6, 0.12, 0.1, 90 * R);
  for (let i = 0; i < 6; i++)
    pc("round", P.woodDk, a.x0 + 0.2 + i * 0.28, 1.38, a.zf + 0.05, 0.07, 0.24, 0.07, 90 * R);

  // Alley gaps: fences between buildings.
  for (const fx of [-4.96, -3.33]) {
    for (let z = -3.8; z < -2.75; z += 0.16) box(P.woodLt, fx, 0, z, 0.04, 0.42 + ((z * 7) % 2) * 0.03, 0.12);
    box(P.woodDk, fx, 0.28, -3.25, 0.06, 0.04, 1.1);
  }

  // Street props on porch fronts (z ~ -2.0..-1.4, behind card edge at z -1.15).
  const barrel = (x, z, c = P.wood) => {
    pc("round", c, x, 0, z, 0.24, 0.3, 0.24);
    for (const y of [0.06, 0.22]) pc("round", P.tin, x, y, z, 0.255, 0.025, 0.255);
    pc("round", P.woodDk, x, 0.3, z, 0.2, 0.01, 0.2);
  };
  barrel(-6.6, -1.9);
  barrel(-6.33, -1.95, P.rust);
  barrel(-6.48, -1.68);
  barrel(-1.62, -1.85);
  barrel(-4.75, -1.95, P.plank);
  const crate = (x, y, z, s, ry) => {
    box(P.woodLt, x, y, z, s, s, s, 0, ry);
    box(P.woodDk, x, y + s * 0.45, z, s + 0.01, 0.025, s + 0.01, 0, ry);
  };
  crate(-2.0, 0, -1.9, 0.26, 10 * R);
  crate(-2.28, 0, -1.85, 0.22, -15 * R);
  crate(-2.12, 0.26, -1.9, 0.2, 30 * R);
  crate(-3.65, 0, -1.95, 0.2, 5 * R);
  crate(-5.35, 0, -1.9, 0.24, -8 * R);
  crate(-5.35, 0.24, -1.9, 0.16, 20 * R);
  // hitching rail + water trough in front of saloon
  for (const hx of [-6.0, -5.25]) box(P.woodDk, hx, 0, -1.75, 0.06, 0.4, 0.06);
  box(P.wood, -5.62, 0.36, -1.75, 0.86, 0.05, 0.05);
  box(P.woodDk, -5.62, 0, -1.5, 0.7, 0.16, 0.2);
  box(0x3b6f86, -5.62, 0.15, -1.5, 0.62, 0.015, 0.13);
  // Marshal's bench + wanted board
  box(P.woodDk, -4.4, 0.12, -2.12, 0.4, 0.05, 0.12);
  box(P.woodDk, -4.4, 0.12, -2.03, 0.4, 0.04, 0.03);
  box(P.white, -3.75, 0.45, m.zf + 0.02, 0.14, 0.18, 0.01);

  // Weathered water tower, outer left (x ~ -7.4), clear of card sightlines.
  const tx = -7.35,
    tz = -2.0;
  for (const [dx, dz] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ]) {
    box(P.woodDk, tx + dx, 0, tz + dz, 0.08, 1.85, 0.08, dz * -10 * R, 0, dx * 10 * R);
    box(P.stone, tx + dx * 1.05, 0, tz + dz * 1.05, 0.14, 0.1, 0.14);
  }
  for (const y of [0.55, 1.25]) {
    box(P.wood, tx, y, tz + 0.3, 0.62, 0.04, 0.04, 0, 0, 35 * R);
    box(P.wood, tx, y, tz - 0.3, 0.62, 0.04, 0.04, 0, 0, -35 * R);
    box(P.wood, tx + 0.3, y, tz, 0.04, 0.04, 0.62, 35 * R);
  }
  box(P.plank, tx, 1.82, tz, 0.86, 0.06, 0.86);
  pc("round", 0x8b6a4a, tx, 1.88, tz, 0.84, 0.82, 0.84);
  for (const y of [1.98, 2.3, 2.6]) pc("round", P.rust, tx, y, tz, 0.865, 0.04, 0.865);
  pc("cone", P.roof, tx, 2.7, tz, 1.0, 0.5, 1.0);
  pc("round", P.tin, tx, 3.18, tz, 0.06, 0.1, 0.06);
  box(P.tin, tx + 0.45, 1.85, tz + 0.1, 0.05, 0.05, 0.3, 0, 0, -30 * R); // spout
  for (let y = 0.2; y < 1.8; y += 0.18) box(P.woodLt, tx + 0.36, y, tz + 0.36, 0.14, 0.025, 0.025, 0, 45 * R); // ladder

  // Cacti and scrub along left perimeter.
  const cactus = (x, z, h, arms) => {
    pc("round", P.cactus, x, 0, z, 0.16, h, 0.16);
    pc("round", P.cactusDk, x, h - 0.02, z, 0.12, 0.05, 0.12);
    for (const [s, ah] of arms) {
      box(P.cactus, x + s * 0.12, ah, z, 0.16, 0.08, 0.09);
      pc("round", P.cactus, x + s * 0.18, ah, z, 0.09, 0.28, 0.09);
    }
    pc("round", 0xe0507a, x, h + 0.02, z, 0.05, 0.04, 0.05);
  };
  cactus(-7.45, -0.6, 0.85, [
    [-1, 0.35],
    [1, 0.5],
  ]);
  cactus(-7.3, 0.9, 0.6, [[1, 0.28]]);
  cactus(-7.5, 2.3, 0.75, [
    [-1, 0.3],
    [1, 0.42],
  ]);
  cactus(-6.6, 3.6, 0.5, [[-1, 0.22]]);
  cactus(-5.8, -1.55, 0.45, []);
  for (const [x, z, s] of [
    [-7.0, -0.2, 0.2],
    [-6.85, 1.7, 0.16],
    [-7.2, 3.1, 0.22],
    [-5.2, 3.9, 0.18],
    [-1.6, -1.5, 0.14],
  ]) {
    pc("rock", P.stone, x, 0, z, s, s * 0.7, s);
    pc("cone", P.sage, x + s * 0.7, 0, z + 0.05, s * 0.8, s * 0.6, s * 0.8);
  }
  // Short split-rail fence tracing the left edge.
  for (let z = -0.9; z <= 1.9; z += 0.7) box(P.woodDk, -6.85, 0, z, 0.06, 0.38, 0.06);
  for (const y of [0.15, 0.3]) box(P.wood, -6.85, y, 0.5, 0.04, 0.04, 2.8, 0, 0, (y - 0.2) * 20 * R);
}
