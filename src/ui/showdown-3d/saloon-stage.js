// Night Shift saloon stage: four real Showdown miniatures share one lamp-lit Western room.
// Visual only. The CSS room around it keeps every word, control and status; this canvas is aria-hidden.
// Renders on demand through the shared PixelRenderer and never disposes card-model geometry.
// All set dressing is static stage-owned primitives: no textures, fonts, requests or idle animation.
import * as T from "three";
import { TYPES } from "../../game/showdown/cards.js";
import { makeCardModel } from "./card-models.js";
import { PixelRenderer } from "./graphics/pixel-renderer.js";

const CAST = [
  ["hunter", "cowboy-ranger", -3.2, -0.55],
  ["sheriff", "cowboy-sheriff", -1.1, 0.2],
  ["wizard", "wizard-wizard", 1.1, 0.2],
  ["singularity", "wizard-singularity", 3.15, -0.55],
];
const OWNER = { job: "singularity", bell: "singularity", block: "sheriff", cast: "wizard", wanted: "hunter" };
const LENGTH = { job: 1100, block: 1200, cast: 1300, wanted: 1200, bell: 1500 };
const TURN_MS = 700;
const MAX_BACKING = 1280;
// The camera always contains the actors and signature props; the set is built far wider and
// taller so wide theaters fill with room instead of gutters and portrait never clips a figure.
const ACTION = new T.Box3(new T.Vector3(-4.3, -0.05, -2.9), new T.Vector3(4.3, 3.1, 2.3));
const SET_X = 13.5;
const WALL_TOP = 16.2;
const FLOOR_FRONT = 12;
const FOCUS = new T.Vector3(0, 1.4, 0);
const VIEW = new T.Vector3(0, 4.11, 12.33); // same distance as before, lower angle: more wall, frontal figures
const TABLE = new T.Vector3(0, 0.66, 1.5);
const POSTER = new T.Vector3(-3.25, 1.75, -2.76);
const BELL = new T.Vector3(3.8, 3.34, -1.6);
const WINDOW = { x: 0, y: 2.0, w: 2.0, h: 1.2 };
const STAT = { none: 0xb89a64, up: 0x6f9a4a, down: 0xa8463a, same: 0xc49a4a };
const clamp = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => clamp(x) * clamp(x) * (3 - 2 * clamp(x));
const arc = (out, a, b, lift, q) => out.lerpVectors(a, b, q).setY(out.y + lift * 4 * q * (1 - q));

// Stage-owned geometry and materials, disposed with the stage. Card models stay untouched.
function kit() {
  const shapes = {
    box: new T.BoxGeometry(1, 1, 1),
    round: new T.CylinderGeometry(0.5, 0.5, 1, 12),
    cone: new T.ConeGeometry(0.5, 1, 8, 1, true),
    orb: new T.SphereGeometry(0.5, 8, 6),
  };
  const cached = new Map();
  const owned = [];
  const make = (color, glow) =>
    glow ? new T.MeshBasicMaterial({ color }) : new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, side: T.DoubleSide });
  return {
    own(color) {
      const material = make(color, false);
      owned.push(material);
      return material;
    },
    mesh(parent, kind, color, [x, y, z], [w, h, d], glow = false) {
      const name = `${glow ? "glow" : "paint"}${color}`;
      const material = color instanceof T.Material ? color : cached.get(name) ?? make(color, glow);
      if (!(color instanceof T.Material)) cached.set(name, material);
      const node = new T.Mesh(shapes[kind], material);
      node.position.set(x, y, z);
      node.scale.set(w, h, d);
      parent.add(node);
      return node;
    },
    // A flat disc lying on the back wall, facing the camera.
    disc(parent, color, [x, y, z], radius, glow = false) {
      const node = this.mesh(parent, "round", color, [x, y, z], [radius * 2, 0.004, radius * 2], glow);
      node.rotation.x = Math.PI / 2;
      return node;
    },
    dispose() {
      for (const geometry of Object.values(shapes)) geometry.dispose();
      for (const material of [...cached.values(), ...owned]) material.dispose();
    },
  };
}

// Walnut board wall with dark seams, a planked wainscot, cornice, rafters and pilasters.
function walls(scene, k) {
  const span = SET_X * 2;
  k.mesh(scene, "box", 0x24160f, [0, WALL_TOP / 2, -3.05], [span, WALL_TOP, 0.1]);
  const tones = [0x5e3b29, 0x553423, 0x63402c];
  const upper = [0x3a251b, 0x33201a];
  for (let i = 0, x = -SET_X + 0.4; x < SET_X; i++, x += 0.8) {
    k.mesh(scene, "box", tones[i % 3], [x, 1.95, -2.95], [0.76, 3.9, 0.1]);
    k.mesh(scene, "box", upper[i % 2], [x, (3.9 + WALL_TOP) / 2, -2.95], [0.76, WALL_TOP - 3.9, 0.1]);
  }
  k.mesh(scene, "box", 0x3a2418, [0, 3.92, -2.86], [span, 0.12, 0.12]);
  for (const y of [6.6, 10.2, 13.8]) k.mesh(scene, "box", 0x2e1d16, [0, y, -2.8], [span, 0.3, 0.3]);
  // Wainscot: individual planks over a dark backing so every joint reads as a pixel line.
  k.mesh(scene, "box", 0x24160f, [0, 0.45, -2.885], [span, 0.9, 0.03]);
  for (let i = 0, x = -SET_X + 0.25; x < SET_X; i++, x += 0.5) {
    k.mesh(scene, "box", i % 2 ? 0x4a2c1e : 0x553422, [x, 0.46, -2.86], [0.46, 0.84, 0.03]);
  }
  k.mesh(scene, "box", 0x3a2418, [0, 0.93, -2.83], [span, 0.08, 0.1]);
  k.mesh(scene, "box", 0x2e1c14, [0, 0.07, -2.83], [span, 0.14, 0.06]);
  for (const x of [-11.8, -8.3, -4.85, 4.85, 8.3, 11.8]) {
    k.mesh(scene, "box", 0x3e2619, [x, 1.95, -2.8], [0.3, 3.9, 0.2]);
    k.mesh(scene, "box", 0xa8803a, [x, 3.78, -2.69], [0.34, 0.06, 0.04]);
  }
  // Cross beam that carries the hanging lanterns.
  k.mesh(scene, "box", 0x45291f, [0, 3.72, -0.4], [span, 0.22, 0.26]);
}

// Floor planks with staggered butt joints, running from the wall toward the viewer.
function floor(scene, k) {
  const depth = FLOOR_FRONT + 3;
  const mid = (FLOOR_FRONT - 3) / 2;
  k.mesh(scene, "box", 0x1e120c, [0, -0.06, mid], [SET_X * 2, 0.1, depth]);
  const tones = [0x5c3a2a, 0x523324, 0x60402c];
  for (let i = 0, x = -SET_X + 0.3; x < SET_X; i++, x += 0.6) {
    k.mesh(scene, "box", tones[i % 3], [x, -0.05, mid], [0.56, 0.1, depth]);
    const joint = -2.2 + ((i * 37) % 50) / 10;
    k.mesh(scene, "box", 0x2a1810, [x, 0.002, joint], [0.56, 0.004, 0.04]);
    k.mesh(scene, "box", 0x2a1810, [x, 0.002, joint + 4.6], [0.56, 0.004, 0.04]);
  }
}

// Oxblood rug with a gold border and diamond band; it anchors the centre pair and the table.
function rug(scene, k) {
  const z = 0.8;
  k.mesh(scene, "box", 0xa8803a, [0, 0.004, z], [4.2, 0.004, 3.3]);
  k.mesh(scene, "box", 0x6a2620, [0, 0.008, z], [4.0, 0.004, 3.1]);
  k.mesh(scene, "box", 0x3a1a18, [0, 0.012, z], [3.6, 0.004, 2.7]);
  k.mesh(scene, "box", 0x7a2e24, [0, 0.016, z], [3.3, 0.004, 2.4]);
  for (let x = -1.6; x <= 1.61; x += 0.4) {
    for (const dz of [-1.2, 1.2]) {
      const diamond = k.mesh(scene, "box", 0xc49a4a, [x, 0.018, z + dz], [0.16, 0.004, 0.16]);
      diamond.rotation.y = Math.PI / 4;
    }
  }
}

// Framed night window: cobalt-to-turquoise sky, a moon, and mesas silhouetted on the horizon.
// Everything stays inside the opening so the frame hides every edge.
function nightWindow(scene, k, { x, y, w, h }) {
  const bottom = y - h / 2;
  const bands = [[0, 0.2, 0x3a9c9c], [0.2, 0.42, 0x2a7096], [0.42, 0.68, 0x234c92], [0.68, 1, 0x1a2a66]];
  for (const [a, b, color] of bands) k.mesh(scene, "box", color, [x, bottom + ((a + b) / 2) * h, -2.893], [w, (b - a) * h, 0.01], true);
  for (const [fx, fy] of [[-0.38, 0.86], [-0.2, 0.72], [-0.06, 0.92], [0.12, 0.8], [0.44, 0.92]]) {
    k.mesh(scene, "box", 0xd8e4f0, [x + fx * w, bottom + fy * h, -2.886], [0.035, 0.035, 0.01], true);
  }
  const moon = [x + 0.3 * w, bottom + 0.78 * h];
  k.disc(scene, 0x3a66a8, [moon[0], moon[1], -2.886], Math.min(w, h) * 0.17, true);
  k.mesh(scene, "orb", 0xeef0d0, [moon[0], moon[1], -2.875], [h * 0.17, h * 0.17, 0.04], true);
  // [centre, width, height] as fractions of the opening.
  for (const [fx, fw, fh] of [[-0.33, 0.34, 0.34], [-0.12, 0.16, 0.2], [0.17, 0.2, 0.42], [0.37, 0.26, 0.18]]) {
    const mx = x + fx * w, mw = fw * w, top = bottom + fh * h;
    k.mesh(scene, "box", 0x16142a, [mx, bottom + fh * h * 0.275, -2.884], [mw, fh * h * 0.55, 0.01], true);
    k.mesh(scene, "box", 0x16142a, [mx, bottom + (fh * h) / 2, -2.884], [mw * 0.72, fh * h, 0.01], true);
    k.mesh(scene, "box", 0x3f8f9a, [mx + mw * 0.06, top - 0.018, -2.878], [mw * 0.6, 0.035, 0.01], true);
  }
  k.mesh(scene, "box", 0x100e1e, [x, bottom + 0.04 * h, -2.882], [w, 0.08 * h, 0.01], true);
  const ft = 0.1;
  for (const dy of [-1, 1]) k.mesh(scene, "box", 0x3a2418, [x, y + dy * (h / 2 + ft / 2), -2.85], [w + ft * 2, ft, 0.1]);
  for (const dx of [-1, 1]) k.mesh(scene, "box", 0x3a2418, [x + dx * (w / 2 + ft / 2), y, -2.85], [ft, h, 0.1]);
  k.mesh(scene, "box", 0x2e1c14, [x, y, -2.86], [0.045, h, 0.04]);
  k.mesh(scene, "box", 0x2e1c14, [x, bottom + 0.6 * h, -2.86], [w, 0.045, 0.04]);
  k.mesh(scene, "box", 0x5a3a26, [x, bottom - ft - 0.035, -2.8], [w + 0.36, 0.07, 0.24]);
  k.mesh(scene, "box", 0x4a2c1e, [x, y + h / 2 + ft + 0.06, -2.84], [w + 0.3, 0.12, 0.12]);
}

// Brass wall sconce with a painted warm wash on the boards; flank sconces also light the room.
function sconce(scene, k, x, y, lit) {
  k.disc(scene, 0x6e4630, [x, y + 0.1, -2.897], 0.62);
  k.disc(scene, 0x82553a, [x, y + 0.1, -2.895], 0.34);
  k.mesh(scene, "box", 0xc8963c, [x, y, -2.86], [0.16, 0.34, 0.04]);
  k.mesh(scene, "box", 0x9a7030, [x, y - 0.08, -2.76], [0.05, 0.05, 0.2]);
  k.mesh(scene, "round", 0xc8963c, [x, y - 0.03, -2.66], [0.15, 0.08, 0.15]);
  k.mesh(scene, "round", 0xffd890, [x, y + 0.11, -2.66], [0.09, 0.2, 0.09], true);
  if (!lit) return;
  const light = new T.PointLight(0xffb060, 5, 4, 1.4);
  light.position.set(x, y + 0.1, -2.3);
  scene.add(light);
}

// Faceted bottle: tall round, square case bottle or squat jug, each with a cork and one glint.
function bottle(scene, k, x, y, z, kind, color, s = 1) {
  let neck, front;
  if (kind === "jug") {
    k.mesh(scene, "orb", color, [x, y + 0.11 * s, z], [0.22 * s, 0.22 * s, 0.22 * s]);
    neck = [y + 0.26 * s, 0.08 * s];
    front = 0.115 * s;
  } else if (kind === "square") {
    k.mesh(scene, "box", color, [x, y + 0.13 * s, z], [0.15 * s, 0.26 * s, 0.15 * s]);
    neck = [y + 0.31 * s, 0.1 * s];
    front = 0.08 * s;
  } else {
    k.mesh(scene, "round", color, [x, y + 0.15 * s, z], [0.13 * s, 0.3 * s, 0.13 * s]);
    neck = [y + 0.36 * s, 0.12 * s];
    front = 0.07 * s;
  }
  k.mesh(scene, "round", color, [x, neck[0], z], [0.05 * s, neck[1], 0.05 * s]);
  k.mesh(scene, "box", 0x8a6a4a, [x, neck[0] + neck[1] / 2 + 0.02 * s, z], [0.06 * s, 0.04 * s, 0.06 * s]);
  k.mesh(scene, "box", 0xf0e6c8, [x - 0.035 * s, y + 0.15 * s, z + front], [0.022, 0.1 * s, 0.01], true);
}

// Bar counter, back-bar mirror with two shelves of bottles, and the bracket that carries the bell.
function bar(scene, k) {
  k.mesh(scene, "box", 0x5c3a28, [2.5, 0.5, -2.2], [2.8, 1, 0.7]);
  for (let i = 0; i < 4; i++) k.mesh(scene, "box", 0x6a442e, [1.45 + i * 0.7, 0.52, -1.84], [0.56, 0.6, 0.03]);
  k.mesh(scene, "box", 0x8a5a36, [2.5, 1.04, -2.2], [3, 0.08, 0.86]);
  k.mesh(scene, "round", 0xc49a4a, [2.5, 0.16, -1.8], [0.05, 2.8, 0.05]).rotation.z = Math.PI / 2;
  for (const x of [1.5, 1.72]) k.mesh(scene, "round", 0xb8b8a0, [x, 1.13, -2.1], [0.08, 0.1, 0.08]);
  k.mesh(scene, "box", 0x2a3040, [2.8, 2.35, -2.885], [2.3, 1.0, 0.02]);
  for (const dy of [-1, 1]) k.mesh(scene, "box", 0xa8803a, [2.8, 2.35 + dy * 0.52, -2.87], [2.42, 0.05, 0.04]);
  for (const dx of [-1, 1]) k.mesh(scene, "box", 0xa8803a, [2.8 + dx * 1.18, 2.35, -2.87], [0.05, 1.0, 0.04]);
  k.mesh(scene, "box", 0x4a2e22, [2.8, 1.95, -2.82], [2.2, 0.06, 0.3]);
  k.mesh(scene, "box", 0x4a2e22, [2.8, 2.52, -2.82], [2.2, 0.06, 0.3]);
  const lower = [["tall", 0x3f6a4a], ["square", 0x9a6a2a], ["tall", 0x2f4a8a], ["jug", 0x6a2a2a], ["tall", 0x9a6a2a], ["square", 0x3f6a4a], ["tall", 0x6a2a2a]];
  lower.forEach(([kind, color], i) => bottle(scene, k, 1.95 + i * 0.29, 1.98, -2.78, kind, color, 0.95));
  const upper = [["square", 0x2f4a8a], ["jug", 0x9a6a2a], ["square", 0x6a2a2a], ["jug", 0x3f6a4a], ["square", 0x8a9a8a]];
  upper.forEach(([kind, color], i) => bottle(scene, k, 2.05 + i * 0.38, 2.55, -2.78, kind, color, 0.75));
  // Bell bracket: wall plate, arm and brace to the hanging bell.
  k.mesh(scene, "box", 0x3a2a22, [BELL.x, 3.2, -2.88], [0.14, 0.5, 0.04]);
  k.mesh(scene, "box", 0x2e2420, [BELL.x, BELL.y + 0.03, (BELL.z - 2.9) / 2], [0.05, 0.05, 2.9 + BELL.z]);
  const brace = k.mesh(scene, "box", 0x2e2420, [BELL.x, 3.13, -2.44], [0.04, 0.04, 1.0]);
  brace.rotation.x = -Math.atan2(0.47, 0.88);
}

// A weathered parchment notice with its brass tack, tilted slightly on the board.
function notice(scene, k, x, y, w, h, tilt) {
  const sheet = new T.Group();
  sheet.position.set(x, y, -2.835);
  sheet.rotation.z = tilt;
  k.mesh(sheet, "box", 0x9a7448, [0, 0, 0], [w + 0.05, h + 0.05, 0.012]);
  k.mesh(sheet, "box", 0xdcc58e, [0, 0, 0.007], [w, h, 0.012]);
  k.mesh(sheet, "box", 0xc4a870, [0, -h * 0.2, 0.014], [w * 0.7, h * 0.3, 0.004]);
  k.mesh(sheet, "orb", 0xd8a848, [0, h / 2 - 0.07, 0.03], [0.08, 0.08, 0.04], true);
  scene.add(sheet);
}

function wantedBoard(scene, k) {
  const { x, y } = POSTER;
  k.mesh(scene, "box", 0x3e2a20, [x, y, -2.87], [1.9, 1.45, 0.05]);
  for (const dy of [-1, 1]) k.mesh(scene, "box", 0x5a3a26, [x, y + dy * 0.725, -2.84], [1.98, 0.07, 0.07]);
  for (const dx of [-1, 1]) k.mesh(scene, "box", 0x5a3a26, [x + dx * 0.95, y, -2.84], [0.07, 1.45, 0.07]);
  k.mesh(scene, "box", 0x8c3a2e, [x, y + 0.82, -2.84], [1.9, 0.14, 0.08]);
  notice(scene, k, x - 0.67, y - 0.2, 0.36, 0.5, 0.08);
  notice(scene, k, x + 0.67, y + 0.1, 0.34, 0.44, -0.06);
}

// Flanks only show in wide theaters: an upright piano on the left, barrels and a crate on the right,
// a lit sconce and a smaller night window on each side.
function flanks(scene, k) {
  const px = -6.1;
  k.mesh(scene, "box", 0x3a2218, [px, 0.7, -2.55], [1.6, 1.4, 0.6]);
  k.mesh(scene, "box", 0x4a2c1e, [px, 1.43, -2.5], [1.7, 0.06, 0.7]);
  k.mesh(scene, "box", 0x553422, [px, 1.12, -2.24], [1.2, 0.4, 0.02]);
  k.mesh(scene, "box", 0x2e1c14, [px, 0.8, -2.1], [1.5, 0.08, 0.32]);
  k.mesh(scene, "box", 0xd8ccb0, [px, 0.855, -2.06], [1.4, 0.03, 0.22]);
  for (const off of [-0.6, -0.48, -0.3, -0.18, -0.06, 0.12, 0.24, 0.42, 0.54]) {
    k.mesh(scene, "box", 0x1a1210, [px + off, 0.88, -2.12], [0.05, 0.02, 0.11]);
  }
  for (const dx of [-0.68, 0.68]) k.mesh(scene, "box", 0x2e1c14, [px + dx, 0.38, -1.98], [0.08, 0.76, 0.08]);
  bottle(scene, k, px + 0.5, 1.46, -2.5, "tall", 0x3f6a4a, 0.9);
  for (const [bx, bz] of [[5.6, -2.3], [6.45, -2.4]]) {
    k.mesh(scene, "round", 0x6a4430, [bx, 0.45, bz], [0.7, 0.9, 0.7]);
    for (const hy of [0.2, 0.7]) k.mesh(scene, "round", 0x2e2420, [bx, hy, bz], [0.73, 0.05, 0.73]);
  }
  k.mesh(scene, "box", 0x6a4a30, [7.3, 0.35, -2.45], [0.8, 0.7, 0.7]);
  k.mesh(scene, "box", 0x4a2e22, [7.3, 0.35, -2.09], [0.8, 0.08, 0.02]);
  for (const side of [-1, 1]) {
    sconce(scene, k, side * 7.3, 2.3, true);
    nightWindow(scene, k, { x: side * 10.05, y: 2.0, w: 1.5, h: 1.1 });
  }
}

function dressRoom(scene, k) {
  walls(scene, k);
  floor(scene, k);
  rug(scene, k);
  nightWindow(scene, k, WINDOW);
  // Cool moonlight spill below the window, against the warm lamplight.
  k.mesh(scene, "box", 0x2a3048, [WINDOW.x, 0.022, -2.45], [WINDOW.w * 0.95, 0.004, 0.8], true);
  k.mesh(scene, "box", 0x34405e, [WINDOW.x, 0.024, -2.5], [WINDOW.w * 0.6, 0.004, 0.5], true);
  for (const side of [-1, 1]) sconce(scene, k, side * 1.45, 2.3, false);
  wantedBoard(scene, k);
  bar(scene, k);
  flanks(scene, k);
  // Front table that receives jobs and casts.
  k.mesh(scene, "round", 0x7d5232, [TABLE.x, TABLE.y - 0.04, TABLE.z], [1.2, 0.08, 0.9]);
  k.mesh(scene, "round", 0xa8803a, [TABLE.x, TABLE.y - 0.09, TABLE.z], [1.24, 0.03, 0.94]);
  k.mesh(scene, "round", 0x4a2e22, [TABLE.x, TABLE.y / 2 - 0.04, TABLE.z], [0.14, TABLE.y, 0.14]);
  k.mesh(scene, "round", 0x3a2418, [TABLE.x, 0.04, TABLE.z], [0.5, 0.05, 0.4]);
  // Hanging lanterns: their lights put warm highlights on the miniatures.
  for (const x of [-2.15, 2.05]) {
    k.mesh(scene, "box", 0x2e2420, [x, 3.335, -0.4], [0.03, 0.55, 0.03]);
    k.mesh(scene, "box", 0x3a2a22, [x, 2.98, -0.4], [0.26, 0.04, 0.26]);
    k.mesh(scene, "orb", 0xffc46a, [x, 2.82, -0.4], [0.2, 0.28, 0.2], true);
    k.mesh(scene, "box", 0x3a2a22, [x, 2.66, -0.4], [0.2, 0.04, 0.2]);
    const lamp = new T.PointLight(0xffb866, 12, 8, 1.4);
    lamp.position.set(x, 2.7, -0.2);
    scene.add(lamp);
  }
  // Lamplight pools beside the rug and contact shadows under all four figures.
  for (const [, , x, z] of CAST) {
    if (Math.abs(x) > 2.5) k.mesh(scene, "round", 0x8e5e3c, [x, 0.022, z], [1.7, 0.004, 1.2]);
    k.mesh(scene, "round", 0x2a1810, [x, 0.026, z], [0.95, 0.004, 0.7]);
  }
}

function props(scene, k) {
  const bell = new T.Group();
  bell.position.copy(BELL);
  k.mesh(bell, "box", 0x5a4232, [0, -0.12, 0], [0.03, 0.24, 0.03]);
  k.mesh(bell, "cone", 0xc8963c, [0, -0.42, 0], [0.42, 0.38, 0.42]);
  k.mesh(bell, "orb", 0x6a4a2a, [0, -0.62, 0], [0.09, 0.09, 0.09]);
  const halo = k.mesh(scene, "orb", 0xffe08a, [BELL.x, BELL.y - 0.45, BELL.z], [0.6, 0.6, 0.6], true);
  const parchment = k.mesh(scene, "box", 0xe8d3a0, [0, 0, 0], [0.38, 0.02, 0.28]);
  const spell = Array.from({ length: 6 }, (_, i) => k.mesh(scene, "orb", 0xb48cff, [0, 0, 0], Array(3).fill(0.16 - i * 0.015), true));
  const guard = new T.Group();
  k.mesh(guard, "box", 0x9a3a2e, [0, 0.8, 0], [2.1, 0.07, 0.07]);
  for (const x of [-1.05, 1.05]) k.mesh(guard, "round", 0xc49a4a, [x, 0.42, 0], [0.09, 0.84, 0.09]);
  const poster = new T.Group();
  k.mesh(poster, "box", 0x9a7448, [0, 0, -0.012], [0.67, 0.87, 0.02]);
  k.mesh(poster, "box", 0xe2c98e, [0, 0, 0], [0.62, 0.82, 0.03]);
  const face = k.mesh(poster, "box", k.own(0x8a4a32), [0, 0.04, 0.02], [0.42, 0.42, 0.02]);
  k.mesh(poster, "box", 0x5a3a26, [0, -0.3, 0.02], [0.44, 0.05, 0.02]);
  const tack = k.mesh(poster, "orb", 0xc0392b, [0, 0.35, 0.04], [0.09, 0.09, 0.06], true);
  const target = new T.Group();
  target.position.copy(TABLE);
  const plaqueMaterial = k.own(STAT.none);
  k.mesh(target, "box", plaqueMaterial, [0, 0.42, -0.34], [0.95, 0.75, 0.05]);
  const pips = Array.from({ length: 9 }, (_, i) => k.mesh(target, "orb", 0x3a2418, [-0.4 + i * 0.1, 0.1, -0.3], [0.07, 0.07, 0.07]));
  scene.add(bell, guard, poster, target);
  return { bell, halo, parchment, spell, guard, poster, face, tack, target, plaqueMaterial, pips };
}

export function createSaloonStage(host) {
  if (!host || typeof document === "undefined" || typeof ResizeObserver === "undefined") return null;
  const probe = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
  if (!probe) return null;
  probe.getExtension("WEBGL_lose_context")?.loseContext();
  const canvas = document.createElement("canvas");
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: false });
  } catch {
    return null;
  }
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.setPixelRatio(1);
  const pipeline = new PixelRenderer(renderer);
  pipeline.configure({ pixelSize: 2, outlines: true, dither: true, exposure: 1.05 });
  canvas.className = "saloon-world";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%", imageRendering: "pixelated" });
  host.append(canvas);

  const k = kit();
  const scene = new T.Scene();
  scene.background = new T.Color(0x1a110c);
  const hemi = new T.HemisphereLight(0xffe2c4, 0x4a3240, 1.7);
  const key = new T.DirectionalLight(0xffd29a, 2.3);
  key.position.set(-3, 6, 5);
  // Cool moonlit rim from the window side, against the warm lamps.
  const rim = new T.DirectionalLight(0x6a8fe0, 1.3);
  rim.position.set(4, 4, -6);
  scene.add(hemi, key, rim);
  dressRoom(scene, k);
  const p = props(scene, k);
  const actors = {};
  for (const [id, card, x, z] of CAST) {
    const holder = new T.Group();
    holder.add(makeCardModel(card, { width: 1.55, height: 1.95, depth: 1.45 }));
    scene.add(holder);
    actors[id] = { holder, home: new T.Vector3(x, 0, z) };
  }
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  const v = new T.Vector3(), from = new T.Vector3(), to = new T.Vector3(), seen = new T.Box3();
  let isOpen = false, frame = 0, headline = null, turn = null, jobs = 0, wanted = null, cast = null, model = null;

  const still = () => Boolean(reduced?.matches);
  const progress = (start, length, now) => (still() ? 1 : clamp((now - start) / length));
  const face = (a, x, z) => Math.atan2(x - a.home.x, z - a.home.z);

  function pose(now) {
    const q = headline ? progress(headline.start, LENGTH[headline.kind], now) : 1;
    const kind = headline?.kind, s = ease(q * 2.5), bump = Math.sin(Math.PI * q);
    for (const a of Object.values(actors)) {
      a.holder.position.copy(a.home);
      a.holder.rotation.set(0, 0, 0);
    }
    const { sheriff, wizard, hunter, singularity } = actors;
    // Block: the Sheriff steps forward, squares up and the guard rope stays across the floor.
    p.guard.visible = kind === "block" && q > 0.2;
    if (kind === "block") {
      sheriff.holder.position.z += 0.9 * s;
      sheriff.holder.rotation.y = 0.44 * s;
      p.guard.position.set(sheriff.home.x, 0, sheriff.home.z + 1.25);
      p.guard.scale.set(ease((q - 0.2) / 0.4), 1, 1);
    }
    hemi.intensity = kind === "block" && q < 1 ? 1.1 : 1.7;
    // Cast: the Wizard turns to the table, the spell arcs over, the plaque and pips change.
    if (kind === "cast") wizard.holder.rotation.y = face(wizard, TABLE.x, TABLE.z) * s;
    from.copy(wizard.home).add(v.set(0.3, 1.6, 0.25));
    to.copy(TABLE).add(v.set(0, 0.75, 0));
    p.spell.forEach((orb, i) => {
      const t = still() ? i / (p.spell.length - 1) : q * 1.5 - 0.25 - i * 0.06;
      orb.visible = kind === "cast" && t > 0 && t < 1 && (still() || q < 1);
      if (orb.visible) arc(orb.position, from, to, 1.1, t);
    });
    const after = !cast || kind !== "cast" || q >= 0.62;
    p.target.visible = Boolean(cast);
    if (cast) {
      p.plaqueMaterial.color.setHex(after ? STAT[cast.change] : STAT.none);
      const count = Math.min(9, Math.max(0, Math.round(Number(after ? cast.after : cast.before)) || 0));
      p.pips.forEach((pip, i) => (pip.visible = i < count));
    }
    // Wanted: the Hunter leans in at the board and the poster flies from his hand to stay pinned.
    if (kind === "wanted") {
      hunter.holder.rotation.y = 2.5 * s;
      hunter.holder.position.z -= 1.1 * s;
      hunter.holder.rotation.x = -0.24 * s;
    }
    p.poster.visible = Boolean(wanted);
    const pin = kind === "wanted" ? ease((q - 0.35) / 0.4) : 1;
    from.copy(hunter.home).add(v.set(0, 1.4, -1));
    p.poster.position.lerpVectors(from, POSTER, pin);
    p.poster.rotation.z = (1 - pin) * 0.5;
    p.tack.visible = pin >= 1;
    // Job: the Singularity turns and a small parchment flies out to rest on the table.
    p.parchment.visible = jobs > 0;
    if (kind === "job") {
      singularity.holder.rotation.y = face(singularity, TABLE.x, TABLE.z) * bump * 0.6;
      singularity.holder.position.y += 0.15 * bump;
    }
    const fly = kind === "job" ? ease(q) : 1;
    from.copy(singularity.home).add(v.set(-0.2, 1.5, 0.3));
    arc(p.parchment.position, from, to.copy(TABLE).add(v.set(0.38, 0.02, 0.22)), 1.2, fly);
    p.parchment.rotation.set(0, fly * Math.PI * 3 + 0.3, (1 - fly) * 0.8);
    // Bell: only a bell event swings the hanging bell; reduced motion holds a tilted ring.
    if (kind === "bell") {
      singularity.holder.rotation.y = 0.6 * s;
      singularity.holder.position.y += 0.25 * s;
    }
    p.bell.rotation.z = kind !== "bell" ? 0 : still() ? 0.35 : 0.6 * Math.sin(q * 5 * Math.PI) * (1 - q);
    p.halo.visible = kind === "bell" && (still() || q < 1);
    p.halo.scale.setScalar(0.5 + 0.5 * ((q * 3) % 1));
    // Generic activity: a small turn for the named actor and nothing else.
    const busy = headline && q < 1;
    const t = turn ? progress(turn.start, TURN_MS, now) : 1;
    if (turn && !busy) actors[turn.id].holder.rotation.y += 0.32 * Math.sin(Math.PI * (still() ? 0.5 : t));
    return busy || (turn && t < 1 && !still());
  }

  // Contain the action box at any aspect. Wide views extend sideways into the flanks; tall views
  // spend most of the spare height on wall above (80%) rather than floor below (20%), which keeps
  // the floor and wall filling the frame down to about a 0.44 aspect.
  function fit(aspect) {
    camera.position.copy(FOCUS).add(VIEW);
    camera.lookAt(FOCUS);
    camera.updateMatrixWorld();
    seen.makeEmpty();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? ACTION.max.x : ACTION.min.x, i & 2 ? ACTION.max.y : ACTION.min.y, i & 4 ? ACTION.max.z : ACTION.min.z);
      seen.expandByPoint(v.applyMatrix4(camera.matrixWorldInverse));
    }
    const aw = (seen.max.x - seen.min.x) / 2, ah = (seen.max.y - seen.min.y) / 2;
    const halfW = 1.03 * Math.max(aw, ah * aspect), halfH = halfW / aspect;
    const cx = (seen.min.x + seen.max.x) / 2;
    const cy = (seen.min.y + seen.max.y) / 2 + Math.max(0, halfH - ah) * 0.6;
    Object.assign(camera, { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH });
    camera.updateProjectionMatrix();
  }

  function draw(now) {
    frame = 0;
    const w = host.clientWidth, h = host.clientHeight;
    if (!isOpen || !w || !h) return;
    const scale = Math.min(1, MAX_BACKING / Math.max(w, h));
    const bw = Math.max(1, Math.round(w * scale)), bh = Math.max(1, Math.round(h * scale));
    if (canvas.width !== bw || canvas.height !== bh) {
      renderer.setSize(bw, bh, false);
      pipeline.setSize(bw, bh);
    }
    fit(bw / bh);
    const moving = pose(now);
    pipeline.render(scene, camera);
    if (moving) request();
  }
  function request() {
    if (isOpen && !frame) frame = requestAnimationFrame(draw);
  }
  const resize = new ResizeObserver(request);
  resize.observe(host);

  function setTarget(event) {
    if (model) p.target.remove(model);
    model = null;
    try {
      model = makeCardModel(event.card, { width: 0.8, height: 0.85, depth: 0.7 });
      p.target.add(model);
    } catch {
      model = null;
    }
    const [before, after] = [Number(event.before), Number(event.after)];
    cast = { before, after, change: after > before ? "up" : after < before ? "down" : "same" };
  }

  function close() {
    isOpen = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  return {
    open() {
      isOpen = true;
      request();
    },
    close,
    play(event) {
      if (!event || !OWNER[event.kind]) return;
      if (event.kind === "job") jobs += 1;
      if (event.kind === "wanted") {
        wanted = event.boss;
        p.face.material.color.setHex(TYPES[wanted]?.side === "wizard" ? 0x5a4c86 : 0x8a4a32);
      }
      if (event.kind === "cast") setTarget(event);
      headline = { kind: event.kind, start: isOpen ? performance.now() : -Infinity };
      turn = null;
      request();
    },
    activity(record) {
      const id = actors[record?.actor] ? record.actor : OWNER[record?.kind];
      const now = performance.now();
      if (!id || (headline && progress(headline.start, LENGTH[headline.kind], now) < 1)) return;
      turn = { id, start: isOpen ? now : -Infinity };
      request();
    },
    reset() {
      headline = turn = wanted = cast = null;
      jobs = 0;
      if (model) p.target.remove(model);
      model = null;
      request();
    },
    dispose() {
      close();
      resize.disconnect();
      pipeline.dispose();
      renderer.dispose();
      k.dispose();
      canvas.remove();
    },
  };
}
