import { bluePine, formations } from "./landmarks.js";

// The playable coordinates are shared. These profiles extend the land past the outermost pads.
const ravineWest = [
  [-0.70, -6.8], [-5.9, -6.7], [-8.8, -5.9], [-9.9, -4.2], [-9.7, 2.55], [-8.5, 4.85],
  [-5.8, 5.45], [-0.38, 5.55], [-0.90, 3.8], [-0.46, 1.9], [-1.03, 0], [-0.88, -2.02], [-0.39, -4.72],
];
const ravineEast = [
  [0.49, -6.75], [5.85, -6.9], [8.97, -5.8], [10.16, -3.99], [9.65, 2.55], [8.17, 4.78],
  [5.82, 5.6], [0.62, 5.71], [0.38, 3.82], [0.97, 1.83], [0.59, 0.06], [0.44, -2.1], [1.13, -4.48],
];
const graveyard = [
  [-10.25, -3], [-9.7, -4.65], [-8.65, -5.72], [-4.8, -6.4], [0.25, -6.74], [3.6, -6.91],
  [7, -6.38], [8.8, -5.18], [9.8, -3.64], [10, -0.68], [9.52, 3.44], [7.6, 5.09],
  [3.96, 5.6], [-0.37, 5.37], [-4.8, 5.51], [-8.33, 4.36], [-9.9, 2.55],
];

const fields = {
  "raven-roost": {
    ground: [0x426859, 0x2c4148, 0x718a66],
    creek: true,
    terrain: [
      [[[-1.18, -6], [1.58, -6], [1.56, 5], [-1.3, 5]], [[0x225c68, 0x253950, -0.61, 0.16, 1, 0x0e263d]]],
      [ravineWest, [[0x364b46, 0x283b43, -0.52, 0.91, 0.97], [0x4c6a56, 0x364c50, 0, 0.55, 1]]],
      [ravineEast, [[0x3a4860, 0x2c3b56, -0.52, 0.96, 0.97], [0x415e55, 0x364951, 0, 0.55, 1]]],
    ],
    focus: [0, 0.75, -0.67],
    lighting: { hemi: [0xc5e9d6, 0x52657e, 2.02], sun: [0xffdeab, 1.66], moon: [0x80c5f8, 1.1] },
    decorate: ravenRoost,
  },
  "bone-fence": {
    ground: [0x655c75, 0x938092, 0x534a62],
    terrain: [[graveyard, [[0x484250, 0x332c42, -0.55, 0.97, 0.97], [0x62566b, 0x4e4459, -0.18, 0.40, 0.987],
      [0x64576b, 0x56465f, 0, 0.20, 1]]]],
    focus: [0.25, 0.88, -0.6],
    lighting: { hemi: [0xe4dbf5, 0x675a79, 1.78], sun: [0xffceaf, 1.28], moon: [0xb4a1ec, 1.21] },
    decorate: boneFence,
  },
};

export function battlefield(id) {
  return Object.hasOwn(fields, id) ? fields[id] : null;
}

function timberBridge(b, z, span, width) {
  for (let i = 0; i < 14; i++) {
    b.box(i % 3 ? 0x90674d : 0xa57b56, ((i + 0.5) / 14 - 0.5) * span, -0.053, z, span / 14 - 0.022, 0.224, width);
  }
  for (const side of [-1, 1]) {
    b.box(0x493c3b, 0, -0.11, z + side * (width / 2 - 0.13), span, 0.28, 0.13);
  }
}

function lantern(b, x, y, z, light) {
  b.box(0x4b3841, x, y + 0.18, z, 0.05, 0.15, 0.05);
  b.glow("box", light, x, y, z, 0.17, 0.22, 0.16);
  b.box(0x4b3841, x, y + 0.12, z, 0.23, 0.065, 0.22);
  b.box(0x4b3841, x, y - 0.12, z, 0.20, 0.065, 0.19);
}

function backCrossing(b) {
  const z = -6.46;
  for (const side of [-1, 1]) {
    const railZ = z + side * 0.68;
    for (const x of [-2.53, -1.28, 1.28, 2.53]) {
      b.box(0x624938, x, 0.33, railZ, 0.13, 0.65, 0.13);
      b.box(0x957154, x, 0.67, railZ, 0.19, 0.06, 0.19);
    }
    b.box(0x785c46, 0, 0.54, railZ, 5.26, 0.11, 0.11);
  }
  for (const x of [-2.57, 2.57]) {
    b.box(0x5d4839, x, 0.65, z + 0.72, 0.11, 1.27, 0.11);
    b.box(0x795b40, x, 1.24, z + 0.88, 0.12, 0.075, 0.40);
    lantern(b, x, 1.0, z + 1.02, 0xffb869);
  }
}

function creekBanks(b) {
  const rapids = [0x67a7ae, 0x83c0c0, 0xb4ddd5];
  for (const [x, z, size, turn] of [
    [-1.22,-9.2,1.4,0.32], [1.56,-8.72,1.2,0.53], [-1.5,-4.4,0.86,0.31],
    [1.58,-3.26,1.07,0.12], [1.43,2.97,1.23,0.52], [-0.97,4.14,1.07,0.28],
    [1.25,5.45,0.87,0.43], [-0.67,8.1,0.75,0.71],
  ]) {
    b.piece("rock", 0x3d5157, x, -0.35, z, size, size * 0.60, size * 0.83, 0, turn);
    b.piece("rock", 0x576d68, x, -0.16, z - 0.13, size * 0.85, size * 0.38, size * 0.67, 0, turn);
    for (let i = 0; i < 4; i++)
      b.box(rapids[i % 3], x + (i - 1.5) * size * 0.32, -0.574, z + size * (0.48 + i * 0.23),
        size * (0.37 - i * 0.04), 0.016, 0.035 + i * 0.027, 0, 0.18 - i * 0.11);
  }
}

function ravenRoost(b) {
  timberBridge(b, 0.3, 6.1, 3.13);
  timberBridge(b, -6.46, 5.7, 1.46);
  timberBridge(b, 6.86, 5.5, 1.3);
  backCrossing(b);
  creekBanks(b);
  for (let i = 0; i < 32; i++) {
    const z = -10.8 + i * 0.647;
    const x = 0.75 * Math.sin(i * 2.1);
    b.glow("box", i % 3 ? 0x6ec5c9 : 0xb6e3df, x, -0.598, z, 0.22 + i % 4 * 0.19, 0.015, 0.043 + i % 3 * 0.058);
  }
  formations(b, [0x3a4d61, 0x4d6171, 0x5e717e], [
    [-18.5, -8.8, 4.5, 3.4, 3.3, 0.4], [-13.9, -11.1, 5.7, 4, 2.7, 0.17],
    [14.1, -11.5, 6.5, 5.45, 2.35, 0.34], [18.2, -8.8, 4.3, 3.93, 3.1, 0.81],
  ]);
  for (const [x, z, h] of [
    [-19.8,-3.82,3], [-20.25,1,2.45], [-18.5,4.7,2.3], [-16.4,6.25,1.67], [-14.8,7.7,2.45],
    [-10.1,8.6,1.65], [-7.7,8.49,2.05], [-5,9.44,2.56], [-3.4,8.42,1.22],
    [-15.7,-9.7,3.14], [-13,-9.4,3], [-9.6,-11.2,4.3], [-6.2,-10.3,2.43], [-4.3,-8.26,2.95],
    [3.7,-9,3.16], [5.25,-10.87,3.63], [8.8,-10.65,4.5], [11.3,-8.4,2.81],
    [17.65,-7.1,2.55], [20.9,-2.86,2.8], [19.2,1.12,3.3], [20.25,4.64,2.15],
    [16.85,6.86,2.44], [14.5,8.14,1.94], [10.55,9.43,2.6], [6.1,8.73,1.58], [3.76,9,2.35],
  ]) bluePine(b, x, z, h);

  // A timber lookout sits on the far bank, above the two crossings.
  const x = 8.5, z = -7.73;
  for (const dx of [-0.84, 0.84]) for (const dz of [-0.66, 0.66]) {
    b.box(0x574747, x + dx, 1.35, z + dz, 0.14, 2.7, 0.16);
    b.box(0x796656, x + dx * 0.59, 0.73, z + dz, 1.36, 0.115, 0.13, 0, 0, 0.64 * dx);
  }
  b.box(0x856d59, x, 2.7, z, 2.14, 0.22, 1.7);
  b.box(0x4a5262, x, 3.26, z, 1.62, 0.94, 1.3);
  b.piece("cone", 0x35455b, x, 4.01, z, 2.58, 0.95, 1.97, 0, 0.49);
  b.glow("box", 0xffbf78, x + 0.18, 3.38, z + 0.658, 0.27, 0.4, 0.025);
  b.box(0x6c574e, x + 0.18, 3.38, z + 0.676, 0.049, 0.4, 0.025);
  // The lookout's ladder opens onto the landing between the two rails.
  b.box(0x876646, x, 2.65, z + 0.92, 2.39, 0.17, 0.48);
  for (const dx of [-1.13, -0.48, 0.52, 1.13]) b.box(0x775940, x + dx, 2.98, z + 1.12, 0.10, 0.62, 0.10);
  for (const dx of [-0.8, 0.82]) b.box(0x957151, x + dx, 3.23, z + 1.12, 0.76, 0.10, 0.11);
  for (const dx of [-0.28, 0.28]) b.box(0x6d5140, x + dx, 1.32, z + 1.42, 0.095, 2.68, 0.096, -0.17);
  for (let i = 0; i < 8; i++)
    b.box(0xa17d55, x, 0.30 + i * 0.28, z + 1.61 - i * 0.049, 0.64, 0.067, 0.090);
  for (const dx of [-0.91, 0.91]) {
    b.box(0x755540, x + dx, 3.77, z + 0.83, 0.13, 0.06, 0.36);
    lantern(b, x + dx, 3.51, z + 0.95, 0xffbc75);
  }
}

function headstone(b, x, z, height, angle) {
  b.box(0x554c61, x, 0.064, z, 0.66, 0.128, 0.48, 0, angle);
  b.box(0xb3a5ae, x, height * 0.48, z, 0.42, height * 0.89, 0.21, 0, angle, 0.07);
  b.piece("rock", 0xc5b6b3, x - 0.03, height * 0.87, z, 0.46, 0.32, 0.22, 0, angle);
}

function cryptEntry(b, x, z) {
  const face = z + 1.17;
  const stone = [0xaba0b5, 0x88809c, 0x9b8ba1];
  for (const side of [-1, 1]) {
    for (let layer = 0; layer < 4; layer++)
      b.box(stone[layer % 3], x + side * 0.53, 0.45 + layer * 0.29, face, 0.21, 0.26, 0.18);
    for (let i = 0; i < 3; i++) {
      const angle = (i + 0.48) * Math.PI / 6;
      b.box(stone[(i + 1) % 3], x + side * 0.53 * Math.cos(angle), 1.55 + 0.49 * Math.sin(angle),
        face + 0.028, 0.22, 0.28, 0.20, 0, 0, side * angle);
    }
    b.box(0x62516d, x + side * 1.43, 1.17, face + 0.072, 0.34, 0.10, 0.27);
    b.box(0x5e4e65, x + side * 1.43, 1.48, face + 0.074, 0.062, 0.68, 0.18);
    b.box(0x5e4e65, x + side * 1.43, 1.57, face + 0.074, 0.34, 0.059, 0.18);
    const pillarX = x + side * 1.42;
    b.box(0x6a5d77, pillarX, 0.31, z + 2.66, 0.60, 0.18, 0.62);
    b.box(0x82728e, pillarX, 0.68, z + 2.66, 0.35, 0.67, 0.36);
    b.box(0x51435a, pillarX, 1.04, z + 2.66, 0.47, 0.12, 0.48);
    lantern(b, pillarX, 1.26, z + 2.66, 0xeec489);
  }
  b.box(0xa69ab3, x, 2.07, face + 0.06, 0.27, 0.31, 0.22);
  const paving = [0x75677e, 0x918299, 0x6c6078];
  for (let i = 0; i < 9; i++) {
    const pathZ = z + 2.13 + i * 0.39;
    b.box(paving[i % 3], x - 0.032 * i * i, 0.23, pathZ, 1.83 - i * 0.052, 0.064, 0.30, 0, 0.07 * Math.sin(i));
  }
}

function boneFence(b) {
  for (const [start, count, z] of [[-19, 16, -8.98], [2.2, 22, -9.25], [-17, 7, 7.35], [12.2, 8, 7.61]]) {
    for (let i = 0; i < count; i++) {
      const x = start + i * 0.72;
      const h = 0.91 + (i % 5) * 0.125;
      b.box(0x716675, x, 0.066, z, 0.34, 0.13, 0.4);
      b.piece("round", i % 3 ? 0xcbb8a9 : 0xac99a3, x, h / 2, z, 0.145, h, 0.16, 0, 0, 0.11 * Math.sin(i * 2));
      b.piece("rock", 0xdac5af, x + 0.02, h - 0.045, z, 0.31, 0.225, 0.255, 0, i);
    }
    for (const height of [0.35, 0.63])
      b.box(0x9d8a8c, start + (count - 1) * 0.36, height, z - 0.04, (count - 1) * 0.72, 0.099, 0.097);
  }
  for (const [x, z] of [[-16.8,-5.4], [-9.5,-7.35], [5.5,-7], [14.4,-6.2], [-7.6,6.33], [8.5,6.46], [17.7,2]]) {
    for (let i = 0; i < 5; i++)
      headstone(b, x + (i % 3 - 1) * 0.82, z + Math.floor(i / 3) * 0.76, 0.68 + 0.1 * i, i * 0.31);
  }
  for (const [x, z] of [[-7.38,-5.7], [6.95,-5.92], [-3.4,5.15], [4.27,5.77]]) {
    b.box(0x615b70, x, 0.15, z, 0.54, 0.3, 0.52);
    b.box(0x99899c, x, 0.63, z, 0.25, 0.94, 0.24);
    b.box(0x716079, x, 1.17, z, 0.49, 0.23, 0.48);
    b.glow("crystal", 0xd29bea, x, 1.48, z, 0.33, 0.50, 0.39, -0.19, 0.37, 0.13);
    b.glow("crystal", 0xecceff, x + 0.04, 1.54, z + 0.11, 0.16, 0.31, 0.19, 0, 0.38);
  }
  const x = 1.3, z = -9.34;
  b.box(0x66536c, x, 0.17, z, 5, 0.34, 3.2);
  b.box(0x938298, x, 1.32, z - 0.3, 4.08, 2.49, 2.84);
  for (let level = 0; level < 5; level++)
    b.box(0x85748b, x, 2.60 + level * 0.14, z - 0.3, 4.01 - level * 0.78, 0.15, 2.79);
  b.box(0x473c51, x, 0.98, z + 1.132, 0.93, 1.65, 0.055);
  b.piece("round", 0x473c51, x, 1.75, z + 1.17, 0.92, 0.075, 0.92, Math.PI / 2);
  b.box(0x938494, x, 0.10, z + 1.81, 1.74, 0.20, 0.58);
  b.box(0x817183, x, 0.22, z + 1.59, 1.45, 0.18, 0.45);
  b.box(0x665772, x, 3.32, z - 0.25, 0.21, 0.17, 3.31);
  for (const side of [-1, 1]) {
    b.box(0x534767, x + side * 1.07, 2.89, z - 0.25, 2.36, 0.17, 3.26, 0, 0, -side * 0.37);
    b.box(0x75617d, x + side * 1.07, 2.89, z + 1.416, 2.38, 0.18, 0.058, 0, 0, -side * 0.37);
    b.box(0x665972, x + side * 0.89, 1.16, z + 1.18, 0.17, 2.06, 0.14);
    b.glow("box", 0xc295d2, x + side * 1.43, 1.59, z + 1.15, 0.27, 0.73, 0.06);
  }
  cryptEntry(b, x, z);
  formations(b, [0x4f435c, 0x665970, 0x8e7b8f], [
    [-17.5,-9.9,6.2,2.45,2.75,0.2], [-9.2,-10.65,6.8,3.03,2.05,0.76],
    [10.4,-10.6,6.9,3.1,2.25,0.4], [18.2,-8.53,5.4,2.88,2.65,0.67],
  ]);
}
