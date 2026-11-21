import * as T from "three";
import { tributes } from "../../game/showdown/cards.js";

const pixel = new T.BoxGeometry(1, 1, 1);
pixel.userData.showdownShared = true;
const shades = {
  cowboy: [0xc26a45, 0xfda954, 0xffe4a8],
  wizard: [0x6454a3, 0x997ce0, 0xc3ecdf],
};
const stamp = new T.Object3D();

export function makeEmbers(holder, side, id) {
  const tier = tributes(id);
  if (!tier) return null;
  const count = tier === 2 ? 21 : 13;
  const palette = shades[side];
  const flames = new T.InstancedMesh(
    pixel,
    new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    count,
  );
  flames.frustumCulled = false;
  const hue = new T.Color();
  for (let i = 0; i < count; i++) flames.setColorAt(i, hue.setHex(palette[i % 3]));
  holder.add(flames);
  return (frame, flare = 0) => {
    for (let i = 0; i < count; i++) {
      // Frames step like sprite animation. Gaps at the front leave the orbs readable.
      const angle = (i / count) * Math.PI * 2 + Math.PI / 15;
      const phase = ((i * 17 + frame) % 14) / 14;
      const height = (0.18 + (tier === 2 ? 0.73 : 0.39) * phase) * (1 + flare * 0.58);
      const radius = 1 - 0.1 * phase;
      stamp.position.set(Math.cos(angle) * 1.43 * radius, height, Math.sin(angle) * 1.02 * radius);
      const width = (i % 3 ? 0.205 : 0.26) * (1 - phase * 0.52) * (1 + flare * 0.65);
      stamp.scale.set(width, width * (1.1 + (i % 4) * 0.31), width);
      stamp.updateMatrix();
      flames.setMatrixAt(i, stamp.matrix);
    }
    flames.instanceMatrix.needsUpdate = true;
  };
}

export function makeFaeries(scene) {
  const small = new T.MeshBasicMaterial({ color: 0xcaf2bd, transparent: true, depthWrite: false });
  const wing = new T.MeshBasicMaterial({ color: 0x7fc8b2, transparent: true, depthWrite: false });
  const lights = [
    [7.35, -5.83],
    [14.52, 3.2],
    [7.55, 6.51],
    [2.53, -6.12],
    [15.69, -2.47],
  ];
  const sprites = lights.map(([x, z]) => {
    const fairy = new T.Group();
    fairy.position.set(x, 1, z);
    const body = new T.Mesh(pixel, small);
    body.scale.set(0.141, 0.244, 0.14);
    fairy.add(body);
    for (const side of [-1, 1]) {
      const fin = new T.Mesh(pixel, wing);
      fin.scale.set(0.24, 0.103, 0.079);
      fin.position.set(side * 0.141, 0.073, 0);
      fin.rotation.z = side * 0.58;
      fairy.add(fin);
      const tail = new T.Mesh(pixel, small);
      tail.scale.set(0.103, 0.103, 0.079);
      tail.position.set(side * 0.194, 0.124, 0);
      fairy.add(tail);
    }
    scene.add(fairy);
    return fairy;
  });
  return (frame) => {
    sprites.forEach((fairy, i) => {
      const progress = (frame + 17 * i) * 0.073;
      const [x, z] = lights[i];
      fairy.position.set(
        x + 0.43 * Math.cos(progress),
        0.72 + 0.26 * Math.sin(progress * 1.61) + 0.16 * (i % 3),
        z + 0.36 * Math.sin(progress),
      );
      fairy.scale.x = frame % 2 ? 0.78 : 1;
      fairy.rotation.y = Math.sin(progress * 0.8) * 0.86;
    });
  };
}
