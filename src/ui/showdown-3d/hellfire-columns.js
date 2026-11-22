import * as T from "three";
import { EFFECT_COLOR_ALPHA } from "./graphics/pixel-renderer.js";
import { zone } from "./layout.js";

const sections = 37;
const forks = 13;
const widths = [0.64, 0.43, 0.15];
const strands = 8;
const indices = [];
for (let row = 0; row < sections; row++) {
  const a = row * 2;
  indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
}

export function createHellfireColumns(parent, camera) {
  const materials = [0x47b989, 0x70ffb7, 0xe0ffcb, 0xa940ef, 0xf295ff, 0x78ffb1, 0xca63f6].map((color) => {
    const material = new T.MeshBasicMaterial({ color, side: T.DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>",
        `#include <opaque_fragment>\ngl_FragColor.a = ${EFFECT_COLOR_ALPHA};`);
    };
    return material;
  });
  const columns = [];
  const right = new T.Vector3();
  const toward = new T.Vector3();
  function layersAt(lane) {
    if (columns[lane]) return columns[lane];
    columns[lane] = materials.map((material, layer) => {
      const geometry = new T.BufferGeometry();
      const strike = layer < widths.length;
      const coordinates = strike ? (sections + 1) * 6 : (layer < 5 ? forks : strands) * 9;
      geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(coordinates), 3));
      if (strike) geometry.setIndex(indices);
      const mesh = new T.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      parent.add(mesh);
      return mesh;
    });
    return columns[lane];
  }
  return {
    clear() {
      for (const layers of columns) for (const layer of layers ?? []) layer.visible = false;
    },
    draw(mark, lane, age) {
      const lead = T.MathUtils.smoothstep(age, -0.62, 0);
      const tail = T.MathUtils.smoothstep(age, 0.06, 0.41);
      const decay = 1 - T.MathUtils.smoothstep(age, 0.08, 0.47);
      const [x, , z] = zone(mark.side, "troop", mark.slot);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      toward.setFromMatrixColumn(camera.matrixWorld, 2);
      const beat = Math.floor(age * 15) + lane * 7;
      const height = 12 + lane % 2 * 1.3;
      const slant = 2.35 + (lane % 3 - 1) * 0.47;
      layersAt(lane).forEach((mesh, layer) => {
        const position = mesh.geometry.attributes.position;
        if (layer >= 5) {
          if (lead <= tail) return;
          for (let i = 0; i < strands; i++) {
            const f = (i + 0.6) / strands;
            const visible = f > tail && f < lead;
            const side = i % 2 ? -1 : 1;
            const center = slant * (1 - f) + side * (layer === 5 ? 0.64 : 1.06);
            const y = 0.21 + (1 - f) * height;
            const width = visible ? decay * (layer === 5 ? 0.11 : 0.064) : 0;
            const end = width > 0 ? 0.30 + i % 3 * 0.23 : 0;
            position.setXYZ(i * 3, x + right.x * center, y - end, z + right.z * center);
            position.setXYZ(i * 3 + 1, x + right.x * (center - width), y, z + right.z * (center - width));
            position.setXYZ(i * 3 + 2, x + right.x * (center + width + end * 0.44), y + end, z + right.z * (center + width + end * 0.44));
          }
          position.needsUpdate = true;
          mesh.visible = true;
          return;
        }
        if (layer >= widths.length) {
          if (age < 0 || age >= 0.52) return;
          const flash = 1 - T.MathUtils.smoothstep(age, 0.10, 0.52);
          const spread = 0.68 + T.MathUtils.smoothstep(age, 0, 0.28) * 1.05;
          for (let fork = 0; fork < forks; fork++) {
            const angle = fork * Math.PI * 2 / forks + lane * 1.1;
            const dx = Math.cos(angle), dz = Math.sin(angle);
            const length = spread * (0.53 + (fork % 4) * 0.16) * (layer === 3 ? 1 : 0.74);
            const w = flash * (layer === 3 ? 0.30 : 0.12);
            const root = fork * 3;
            const y = 0.24 + (layer - 3) * 0.025;
            position.setXYZ(root, x + dx * 0.12 - dz * w, y, z + dz * 0.12 + dx * w);
            position.setXYZ(root + 1, x + dx * 0.12 + dz * w, y, z + dz * 0.12 - dx * w);
            position.setXYZ(root + 2, x + dx * length, y + flash * (fork % 3) * 0.19, z + dz * length);
          }
          position.needsUpdate = true;
          mesh.visible = true;
          return;
        }
        if (lead <= tail) return;
        for (let row = 0; row <= sections; row++) {
          const f = T.MathUtils.lerp(tail, lead, row / sections);
          const step = Math.floor(f * 37);
          const jitter = Math.sin(step * 12.9 + lane * 4) * 0.43;
          const drift = slant * (1 - f) + jitter;
          const flare = 0.55 + f * f * 0.91;
          const torn = 0.35 + 0.65 * ((Math.sin(step * 5.23 + beat) + 1) * 0.5);
          const tip = Math.min(1, (lead - f) * 26 + 0.1);
          const width = flare * torn * decay * tip * widths[layer];
          const y = 0.21 + (1 - f) * height;
          const depth = toward.z * (0.17 + layer * 0.016);
          const offset = (0.17 + layer * 0.016) * toward.x;
          for (const edge of [-1, 1]) {
            const across = drift + width * edge;
            position.setXYZ(row * 2 + (edge + 1) / 2,
              x + across * right.x + offset, y, z + across * right.z + depth);
          }
        }
        position.needsUpdate = true;
        mesh.visible = true;
      });
    },
  };
}
