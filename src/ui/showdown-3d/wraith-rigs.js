// Wraith rigs: lantern wraith, captured wraith, raven familiar, headless horseman.
// Ground at y=0, +z faces camera, centers of geometry.
const PI = Math.PI;

// Emissive piece if b.glow exists, else plain piece.
const glow = (b, kind, hex, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) =>
  (b.glow ? b.glow : b.piece).call(b, kind, hex, x, y, z, w, h, d, rx, ry, rz);

// Thin bar from (x1,y1) to (x2,y2) in the xy plane at depth z.
const bar = (b, hex, x1, y1, x2, y2, z, t = 0.05, kind = "box") => {
  const dx = x2 - x1,
    dy = y2 - y1,
    len = Math.hypot(dx, dy);
  b.piece(kind, hex, (x1 + x2) / 2, (y1 + y2) / 2, z, t, len, t, 0, 0, Math.atan2(-dx, dy));
};

// Shared wraith core: rising tapered shroud, ragged hem, faceless hood.
const wraithCore = (b, robe, shade, hem) => {
  b.piece("cone", robe, 0, 0.62, 0, 0.95, 1.25, 0.8); // shroud
  b.piece("round", shade, 0, 0.5, 0, 0.82, 0.55, 0.7); // inner body mass
  for (let i = 0; i < 6; i++) {
    // ragged hem tatters
    const a = (i / 6) * PI * 2 + 0.3;
    b.piece(
      "cone",
      hem,
      Math.sin(a) * 0.42,
      0.14,
      Math.cos(a) * 0.34,
      0.2,
      0.3,
      0.16,
      PI,
      0,
      Math.sin(a) * 0.4,
    );
  }
  b.piece("cone", robe, -0.3, 0.95, -0.05, 0.16, 0.5, 0.12, 0, 0, 0.5); // rising wisps
  b.piece("cone", robe, 0.32, 1.0, -0.08, 0.14, 0.45, 0.1, 0, 0, -0.45);
  b.piece("orb", robe, 0, 1.3, 0, 0.56, 0.58, 0.54); // hood
  b.piece("cone", robe, 0, 1.62, -0.08, 0.3, 0.32, 0.28, -0.35); // hood peak swept back
  b.piece("orb", 0x050407, 0, 1.27, 0.2, 0.34, 0.4, 0.16); // faceless void
};

// Short chain of alternating links between two heights.
const chain = (b, hex, x, yTop, yBot, z) => {
  const n = Math.max(2, Math.round((yTop - yBot) / 0.07));
  for (let i = 0; i < n; i++) {
    const y = yTop - ((i + 0.5) * (yTop - yBot)) / n;
    b.piece("ring", hex, x, y, z, 0.07, 0.07, 0.07, PI / 2, i % 2 ? PI / 2 : 0, 0);
  }
};

export const ART = {
  "wizard-lantern-wraith": function (b) {
    wraithCore(b, 0x746186, 0x43384e, 0x897697);
    bar(b, 0x746186, 0.22, 1.08, 0.62, 1.02, 0.12, 0.16); // reaching sleeve
    b.piece("cone", 0x746186, -0.32, 0.86, 0.12, 0.2, 0.42, 0.16, 0, 0, 0.25); // other sleeve
    b.piece("orb", 0xb9c2b0, 0.66, 1.0, 0.14, 0.09, 0.09, 0.09); // bony fingers
    chain(b, 0x8a8f96, 0.68, 0.97, 0.66, 0.16);
    // green lantern
    b.piece("ring", 0x3c3f46, 0.68, 0.65, 0.16, 0.12, 0.12, 0.12, PI / 2);
    b.piece("cone", 0x2a2d33, 0.68, 0.58, 0.16, 0.24, 0.12, 0.24);
    glow(b, "orb", 0x5cff7a, 0.68, 0.42, 0.16, 0.2, 0.24, 0.2);
    for (const s of [-1, 1]) b.piece("box", 0x2a2d33, 0.68 + s * 0.1, 0.42, 0.16, 0.025, 0.28, 0.025);
    b.piece("box", 0x2a2d33, 0.68, 0.27, 0.16, 0.24, 0.05, 0.24);
    for (const x of [-0.06, 0.06]) glow(b, "orb", 0x8be593, x, 1.28, 0.273, 0.066, 0.051, 0.063);
  },

  "cowboy-captured-wraith": function (b) {
    wraithCore(b, 0x8d98a8, 0x5e6878, 0xa9b3c0);
    // sleeves pulled together in front, wrists bound with rope
    bar(b, 0x8d98a8, -0.3, 1.05, -0.06, 0.82, 0.24, 0.15);
    bar(b, 0x8d98a8, 0.3, 1.05, 0.06, 0.82, 0.24, 0.15);
    b.piece("orb", 0xd8d2c4, 0, 0.78, 0.3, 0.14, 0.1, 0.1); // pale hands
    for (const y of [0.8, 0.86]) b.piece("ring", 0xb08447, 0, y, 0.27, 0.3, 0.07, 0.3);
    bar(b, 0xb08447, 0.05, 0.76, 0.55, 0.02, 0.3, 0.035, "round"); // lead rope to ground
    // warm brass railroad lantern hung from the bound wrists
    b.piece("ring", 0xc8962e, 0, 0.66, 0.32, 0.12, 0.12, 0.12, PI / 2); // bail handle
    b.piece("round", 0xc8962e, 0, 0.6, 0.32, 0.24, 0.05, 0.24); // top plate
    glow(b, "round", 0xffb347, 0, 0.47, 0.32, 0.18, 0.22, 0.18); // amber globe
    for (const a of [0, PI / 2]) b.piece("box", 0xa8781f, 0, 0.47, 0.32, 0.22, 0.24, 0.02, 0, a, 0); // wire guard
    b.piece("round", 0xc8962e, 0, 0.34, 0.32, 0.26, 0.06, 0.26); // base
    glow(b, "orb", 0xffc46b, 0, 1.24, 0.24, 0.07, 0.05, 0.03); // warm reflection in void
  },

  "wizard-raven-familiar": function (b) {
    const ink = 0x14122a,
      gloss = 0x2c2f8a,
      sheen = 0x4a54c8;
    b.piece("rock", 0x4b4652, 0, 0.18, 0, 0.6, 0.36, 0.5); // perch stone
    for (const s of [-1, 1]) {
      b.piece("box", 0x2a2a30, s * 0.1, 0.46, 0.05, 0.035, 0.22, 0.035); // legs
      b.piece("ring", 0xd6b04a, s * 0.1, 0.45, 0.05, 0.09, 0.09, 0.09); // ankle bands
      b.piece("box", 0x2a2a30, s * 0.1, 0.37, 0.1, 0.08, 0.025, 0.12); // feet
    }
    b.piece("orb", ink, 0, 0.78, 0, 0.42, 0.5, 0.38, -0.25); // body
    b.piece("orb", ink, 0, 1.12, 0.06, 0.28, 0.27, 0.28); // head
    b.piece("box", ink, 0, 0.6, -0.26, 0.2, 0.06, 0.32, -0.6); // tail
    for (const s of [-1, 1]) {
      // raised glossy wings
      b.piece("box", gloss, s * 0.42, 1.0, -0.04, 0.6, 0.3, 0.05, 0, 0, s * 0.55);
      b.piece("box", sheen, s * 0.72, 1.24, -0.06, 0.36, 0.18, 0.04, 0, 0, s * 0.9);
      for (
        let i = 0;
        i < 3;
        i++ // flight-feather tips
      )
        b.piece(
          "cone",
          gloss,
          s * (0.55 + i * 0.12),
          0.82 + i * 0.08,
          -0.04,
          0.08,
          0.26,
          0.04,
          0,
          0,
          s * (2.4 - i * 0.2),
        );
      glow(b, "orb", 0x6dff6a, s * 0.1, 1.15, 0.17, 0.06, 0.06, 0.04); // green eyes
    }
    b.piece("cone", 0x3a3a40, 0, 1.08, 0.3, 0.1, 0.24, 0.1, PI / 2); // beak forward
    b.piece("round", 0xeee0b8, 0, 1.07, 0.33, 0.07, 0.34, 0.07, 0, 0, PI / 2); // scroll
    for (const s of [-1, 1]) b.piece("round", 0xb8402e, s * 0.17, 1.07, 0.33, 0.08, 0.03, 0.08, 0, 0, PI / 2); // scroll caps
  },

  "wizard-headless-horseman": function (b) {
    const bone = 0x373344,
      rib = 0x616070,
      robe = 0x514066,
      fire = 0x52ff6e;
    // skeletal horse in side profile, facing +x
    for (const [x, z] of [
      [-0.55, 0.14],
      [-0.5, -0.14],
      [0.5, 0.14],
      [0.55, -0.14],
    ]) {
      b.piece("round", bone, x, 0.33, z, 0.07, 0.5, 0.07); // leg bones
      b.piece("orb", rib, x, 0.42, z, 0.1, 0.1, 0.1); // knee joint
      glow(b, "round", fire, x, 0.05, z, 0.13, 0.1, 0.13); // green hooves
    }
    b.piece("box", bone, 0, 0.84, 0, 1.3, 0.1, 0.12); // spine
    for (
      let i = 0;
      i < 5;
      i++ // ribs
    )
      b.piece("ring", rib, -0.3 + i * 0.15, 0.7, 0, 0.32, 0.32, 0.32, 0, PI / 2, 0);
    b.piece("box", bone, -0.52, 0.72, 0, 0.3, 0.26, 0.3); // pelvis
    b.piece("cone", bone, -0.78, 0.66, 0, 0.1, 0.4, 0.08, 0, 0, 2.3); // tail
    bar(b, bone, 0.6, 0.82, 0.86, 1.18, 0, 0.14); // neck
    b.piece("box", bone, 1.0, 1.08, 0, 0.42, 0.16, 0.16, 0, 0, -0.5); // skull
    for (const s of [-1, 1]) glow(b, "orb", fire, 0.94, 1.16, s * 0.09, 0.07, 0.06, 0.03); // eyes
    // tall black-violet rider, no head
    for (const s of [-1, 1]) bar(b, robe, -0.05, 0.92, 0.12, 0.6, s * 0.18, 0.1); // legs
    b.piece("box", robe, -0.05, 1.2, 0, 0.3, 0.5, 0.26); // torso
    b.piece("box", 0x150c1e, -0.2, 1.05, 0, 0.08, 0.6, 0.4, 0, 0, 0.15); // cape
    b.piece("cone", robe, -0.05, 1.5, 0, 0.36, 0.16, 0.32, PI); // flared high collar
    glow(b, "cone", fire, -0.05, 1.6, 0, 0.24, 0.28, 0.20); // neck flame
    glow(b, "cone", 0xb8ff9a, -0.05, 1.72, 0.02, 0.08, 0.16, 0.08, 0, 0, 0.2);
    bar(b, robe, 0.06, 1.38, 0.3, 1.2, 0.16, 0.09); // sword arm
    b.piece("box", 0x9a8a3a, 0.32, 1.2, 0.16, 0.12, 0.03, 0.06); // guard
    // curved sabre in short segments
    let x = 0.33,
      y = 1.22,
      a = 0.3;
    for (let i = 0; i < 5; i++, a -= 0.18) {
      const nx = x + Math.sin(a) * 0.11,
        ny = y + Math.cos(a) * 0.11;
      bar(b, 0xcfd6de, x, y, nx, ny, 0.16, 0.035);
      x = nx;
      y = ny;
    }
  },
};
