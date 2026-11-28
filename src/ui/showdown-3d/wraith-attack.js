import * as T from "three";
import { EFFECT_COLOR_ALPHA } from "./graphics/pixel-renderer.js";

const smooth = T.MathUtils.smoothstep;
const pulse = (t, start, peak, end) => smooth(t, start, peak) * (1 - smooth(t, peak, end));
const jade = { ring: 0x5cdeb0, rune: 0xc0ffdb, star: 0xa2ffcd, wick: 0xc4ffe6, trail: 0x59c69c };
const amber = { ring: 0xea9f48, rune: 0xffdf9c, star: 0xffcc7d, wick: 0xffebbd, trail: 0xd39456 };
const tau = Math.PI * 2;
const glyphs = [
  [[-1, 0], [0, -1], [1, 0], [0, 1], [-1, 0]],
  [[0, 1], [0, -1], [1, 0], [0, 0.2]],
  [[-1, -0.6], [0, 0.2], [1, -0.6], [0, 0.2], [0, 1]],
  [[-1, 1], [0, -1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [1, 1], [-1, 1]],
  [[0, -1], [-1, 0], [1, 0], [0, 1]],
  [[-1, -1], [0, 0], [1, -1], [0, 0], [0.7, 1]],
  [[-1, 1], [-1, -0.6], [1, 0.4], [1, -1]],
];
const radial = (angle, radius) => [radius * Math.sin(angle), -radius * Math.cos(angle)];

// Bake each stroke into the floor plane. Subdividing the five long strokes lets
// drawRange write the pentagram in one continuous motion without rebuilding it.
function stroke(positions, a, b, width, divisions = 1) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const x = -dz * width / (2 * length), z = dx * width / (2 * length);
  for (let i = 0; i < divisions; i++) {
    const ax = a[0] + dx * i / divisions, az = a[1] + dz * i / divisions;
    const bx = ax + dx / divisions, bz = az + dz / divisions;
    positions.push(ax - x, 0, az - z, ax + x, 0, az + z, bx + x, 0, bz + z,
      ax - x, 0, az - z, bx + x, 0, bz + z, bx - x, 0, bz - z);
  }
}

function makeSeal() {
  const root = new T.Group(), ring = [], star = [], runes = [];
  const radius = 2.05;
  for (let i = 0; i < 80; i++) {
    stroke(ring, radial(tau * i / 80, radius), radial(tau * (i + 1) / 80, radius), 0.067);
  }
  for (let i = 0; i < 5; i++) {
    stroke(star, radial(tau * i * 2 / 5, radius * 0.75),
      radial(tau * (i + 1) * 2 / 5, radius * 0.75), 0.084, 24);
  }
  glyphs.forEach((glyph, i) => {
    const [x, z] = radial(tau * i / glyphs.length, radius * 0.87);
    const points = glyph.map(([u, v]) => [x + u * 0.126, z + v * 0.14]);
    for (let j = 1; j < points.length; j++) stroke(runes, points[j - 1], points[j], 0.067);
  });
  for (const points of [ring, star, runes]) {
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    const material = new T.MeshBasicMaterial({ side: T.DoubleSide, depthWrite: false });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>",
        `#include <opaque_fragment>\ngl_FragColor.a = ${EFFECT_COLOR_ALPHA};`);
    };
    root.add(new T.Mesh(geo, material));
  }
  root.visible = false;
  return root;
}

function showStroke(mesh, progress, hue, alpha) {
  mesh.visible = progress > 0.002 && alpha > 0.015;
  const drawn = progress * Math.min(1, alpha * 1.10);
  mesh.geometry.setDrawRange(0, 6 * Math.ceil(mesh.geometry.attributes.position.count * drawn / 6));
  mesh.material.color.setHex(hue);
}

// Each pawn shares its painted materials with the card gallery and other copies.
// Scope the shroud's phase to this beat; the swung lantern and its flame stay solid.
function phaseBody(model, chain) {
  const originals = new Map(), replacements = new Map();
  const visit = (node) => {
    if (node === chain) return;
    if (node.isMesh && !node.material.isMeshBasicMaterial) {
      const original = node.material;
      let replacement = replacements.get(original);
      if (!replacement) {
        replacement = original.clone();
        replacement.transparent = true;
        replacement.depthWrite = false;
        replacements.set(original, replacement);
      }
      originals.set(node, original);
      node.material = replacement;
    }
    node.children.forEach(visit);
  };
  visit(model);
  return {
    opacity(amount) {
      for (const material of replacements.values()) {
        material.opacity = amount;
        material.depthWrite = amount > 0.96;
      }
    },
    restore() {
      for (const [node, original] of originals) node.material = original;
      for (const material of replacements.values()) material.dispose();
    },
  };
}

export function createWraithAttack(parent, camera, bar, dot) {
  let seal, actor, chain, flame, cloth;
  const lamp = new T.Vector3(), next = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3();
  const hit = new T.Vector3(), mark = new T.Vector3(), start = new T.Vector3(), end = new T.Vector3();
  const clear = () => {
    if (seal) seal.visible = false;
    if (chain) chain.rotation.set(0, 0, 0);
    cloth?.restore();
    actor = chain = flame = cloth = null;
  };

  return {
    clear,
    draw(token, origin, target, t, edge, duration, captured) {
      if (!token) return;
      if (actor !== token) {
        clear();
        actor = token;
        hit.copy(target);
        chain = token.model.getObjectByName("lantern-chain");
        flame = chain?.getObjectByName("lantern-flame");
        if (chain && flame) cloth = phaseBody(token.model, chain);
      }
      if (!flame) return;
      if (!seal) {
        seal = makeSeal();
        parent.add(seal);
      }
      const ink = captured ? amber : jade;
      const dir = Math.sign(hit.x - origin.x) || 1;
      const age = t - edge;
      const fade = 1 - smooth(t, edge + 0.075, duration - 0.014);
      const wind = edge - 0.205;
      const lift = edge - 0.33;
      seal.visible = fade > 0.015;
      seal.position.set(origin.x, 0.30, origin.z);
      seal.scale.setScalar(captured ? 0.80 : 1);
      const [rim, star, runes] = seal.children;
      showStroke(rim, smooth(t, 0, wind - 0.035), ink.ring, 0.92 * fade);
      showStroke(star, smooth(t, 0.063, wind + 0.010), ink.star, 0.99 * fade);
      showStroke(runes, smooth(t, 0.045, wind + 0.025), ink.rune, 0.98 * fade);

      function pose(time, point) {
        const gather = pulse(time, 0, lift, edge - 0.095);
        const rush = smooth(time, wind, edge) * (1 - smooth(time, edge + 0.04, duration - 0.06));
        const sweep = pulse(time, wind - 0.075, edge, edge + 0.18);
        const settle = pulse(time, edge + 0.13, edge + 0.27, duration);
        const bank = dir * (0.14 * gather - 0.24 * rush);
        const yaw = dir * (0.28 * gather + (captured ? 0.98 : 1.23) * rush);
        chain.rotation.set(0.46 * gather - (captured ? 0.88 : 1.21) * sweep + 0.24 * settle,
          0, dir * (-0.62 * gather + 0.84 * sweep - 0.34 * settle));
        token.model.rotation.set(0, yaw, bank);
        token.model.position.set(0, token.restY, -0.07);
        flame.getWorldPosition(point);
        // Meet the near edge of the opponent with the lantern out in front.
        // Keep a short magical gap so both silhouettes and the target's pips read.
        const dx = (hit.x - dir * 0.91 - point.x) * rush - dir * 0.27 * gather;
        const dy = (hit.y + 0.23 - point.y) * rush + 0.23 * gather + 0.39 * Math.sin(Math.PI * rush);
        const dz = (hit.z + 0.37 - point.z) * rush + 0.32 * Math.sin(Math.PI * rush);
        token.model.position.add(next.set(dx, dy, dz));
        point.add(next);
      }
      const shimmer = pulse(t, wind - 0.04, edge - 0.085, edge + 0.004)
        + 0.73 * pulse(t, edge + 0.11, edge + 0.20, duration - 0.07);
      cloth.opacity(1 - 0.57 * shimmer);
      // Sample the actual socket arc, including the short return swing. This
      // keeps the wake attached at every frame rate and on skipped replay frames.
      const wake = smooth(t, 0.05, lift) * (1 - smooth(t, edge + 0.12, edge + 0.29));
      if (wake > 0) {
        pose(Math.max(0, t - 0.062), start);
        for (let i = 1; i <= 5; i++) {
          pose(Math.max(0, t - 0.062 * (1 - i / 5)), end);
          bar(start, end, i < 4 ? ink.trail : ink.star, (0.022 + 0.011 * i) * wake);
          start.copy(end);
        }
      }
      pose(t, lamp);
      const spark = 0.16 + 0.10 * pulse(t, wind - 0.12, edge, edge + 0.08);
      dot("shard", ink.wick, lamp, spark, spark * 1.44, spark);
      if (age < -0.044 || age >= 0.25) return;
      if (age < 0.065) {
        const strike = smooth(age, -0.044, 0);
        const width = 0.095 * (1 - smooth(age, 0.012, 0.065));
        mark.lerpVectors(lamp, hit, 0.54 * strike).y += 0.15 * strike;
        bar(lamp, mark, ink.star, width);
        bar(mark, next.lerpVectors(lamp, hit, strike), ink.wick, width * 0.70);
      }
      if (age < 0) return;
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      const decay = 1 - smooth(age, 0.025, 0.25);
      for (let i = 0; i < 7; i++) {
        const angle = tau * i / 7 + 0.21;
      const r = (0.23 + 2.65 * age) * (captured ? 0.79 : 1);
        next.copy(right).multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle) * 0.83);
        start.copy(hit).addScaledVector(next, r);
        end.copy(start).addScaledVector(next, (0.22 + 0.14 * (i % 2)) * decay);
        bar(start, end, i % 2 ? ink.ring : ink.wick, 0.077 * decay);
      }
    },
  };
}
