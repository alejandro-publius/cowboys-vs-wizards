import * as T from "three";
import { SIDES, zone } from "./layout.js";

const box = new T.BoxGeometry(1, 1, 1);
const colors = new Map();
function wood(parent, color, x, y, z, w, h, d) {
  if (!colors.has(color))
    colors.set(color, new T.MeshStandardMaterial({ color, roughness: 0.94, flatShading: true }));
  const n = new T.Mesh(box, colors.get(color));
  n.position.set(x, y, z);
  n.scale.set(w, h, d);
  n.castShadow = n.receiveShadow = true;
  parent.add(n);
  return n;
}
const open = (t, end) => T.MathUtils.smoothstep(t, 0, 125) * (1 - T.MathUtils.smoothstep(t, end - 160, end));
export function dressTable(scene) {
  const deck = {},
    grave = {};
  const fore = new T.Group();
  fore.position.set(0, -0.24, 9.33);
  scene.add(fore);
  wood(fore, 0x563e42, 0, -0.11, 0, 18.8, 0.36, 2.1);
  for (let i = -10; i <= 10; i++) {
    const x = i * 0.878;
    wood(fore, i % 3 === 0 ? 0x94654f : 0x855c4e, x, 0.087, 0, 0.857, 0.08, 2);
    wood(fore, 0xa87757, x + 0.129, 0.132, 0.23, 0.068, 0.016, 1.32);
  }
  for (const z of [-1.04, 0.91]) wood(fore, 0x694638, 0, 0.173, z, 18.9, 0.301, 0.147);
  for (const x of [-8.8, -4.4, 0, 4.4, 8.8]) wood(fore, 0xb98b59, x, 0.336, 0.926, 0.111, 0.03, 0.082);
  for (const side of SIDES) {
    const left = side === "cowboy";
    const [x, , z] = zone(side, "deck");
    const crate = new T.Group();
    crate.position.set(x, 0.117, z);
    scene.add(crate);
    const c = left ? 0x78523e : 0x514769,
      panel = left ? 0xb58456 : 0x827396;
    wood(crate, c, 0, 0.13, -0.57, 1.58, 0.24, 0.1);
    wood(crate, c, 0, 0.115, 0.59, 1.58, 0.21, 0.095);
    for (const dx of [-0.755, 0.755]) {
      wood(crate, c, dx, 0.13, 0, 0.12, 0.24, 1.22);
      for (const dz of [-0.43, 0.45]) wood(crate, panel, dx, 0.158, dz, 0.133, 0.26, 0.17);
    }
    const lid = new T.Group();
    lid.position.set(0, 0.277, -0.6);
    crate.add(lid);
    for (let i = 0; i < 5; i++) wood(lid, i % 2 ? panel : c, (i - 2) * 0.29, 0, 0.6, 0.276, 0.075, 1.217);
    for (const x of [-0.49, 0.49]) wood(lid, 0xa49187, x, 0.053, 0.6, 0.095, 0.026, 1.22);
    wood(lid, 0xdfb575, 0, 0.06, 1.14, 0.188, 0.074, 0.094);
    deck[side] = lid;
    const [gx, , gz] = zone(side, "discard");
    const site = new T.Group();
    site.position.set(gx, 0.122, gz);
    scene.add(site);
    const parts = [];
    for (const s of [-1, 1]) {
      const wing = new T.Group();
      wing.position.set(s * 0.772, 0.063, 0);
      site.add(wing);
      wood(wing, panel, -s * 0.187, 0, 0, 0.378, 0.135, 1.38);
      wood(wing, c, -s * 0.172, 0.078, 0.014, 0.093, 0.027, 0.91);
      parts.push({ wing, s });
    }
    grave[side] = parts;
  }
  return {
    reset() {
      for (const side of SIDES) {
        deck[side].rotation.x = 0;
        for (const { wing } of grave[side]) wing.rotation.z = 0;
      }
    },
    frame(step, time) {
      this.reset();
      if (step.kind === "draw" || step.kind === "burn")
        deck[step.from.side].rotation.x = -1.25 * open(time, step.duration);
      if (step.kind === "burial" || step.kind === "tribute") {
        for (const { wing, s } of grave[step.targets[0].side])
          wing.rotation.z = s * 1.23 * open(time, step.duration);
      }
    },
  };
}
