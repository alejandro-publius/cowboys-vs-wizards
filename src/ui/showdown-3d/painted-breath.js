import * as T from "three";
import { PAINTED_SPRITE_ALPHA } from "./graphics/pixel-renderer.js";

const art = typeof __CVW_DRAGON_BREATH__ === "undefined" ? "" : __CVW_DRAGON_BREATH__;
let texture;

export function createPaintedBreath(parent, camera) {
  if (!art) return null;
  if (!texture) {
    texture = new T.TextureLoader().load(art);
    texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = texture.magFilter = T.NearestFilter;
    texture.generateMipmaps = false;
  }
  const material = new T.MeshBasicMaterial({
    map: texture, alphaTest: 0.5, side: T.DoubleSide, toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
        float row = floor(vMapUv.y * 22.0);
        if (vMapUv.x > 0.935 + 0.065 * fract(row * 0.618)) discard;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>\ngl_FragColor.a = ${PAINTED_SPRITE_ALPHA};`,
      );
  };
  const rays = [];
  const across = new T.Vector3();
  const screenUp = new T.Vector3();
  const direction = new T.Vector3();
  const start = new T.Vector3();
  const end = new T.Vector3();

  function rayAt(index) {
    if (rays[index]) return rays[index];
    const geom = new T.BufferGeometry();
    geom.setAttribute("position", new T.BufferAttribute(new Float32Array(12), 3));
    geom.setAttribute("uv", new T.BufferAttribute(new Float32Array(8), 2));
    geom.setIndex([0, 1, 2, 2, 1, 3]);
    const ray = new T.Mesh(geom, material);
    ray.frustumCulled = false;
    parent.add(ray);
    rays[index] = ray;
    return ray;
  }

  return {
    clear() {
      for (const ray of rays) if (ray) ray.visible = false;
    },
    draw(index, mouth, target, time) {
      if (!texture.image || time <= 0 || time >= 2.10) return;
      const first = T.MathUtils.smoothstep(time, 1.00, 2.10);
      const last = T.MathUtils.smoothstep(time, 0, 0.95);
      if (last - first < 0.01) return;
      direction.subVectors(target, mouth);
      camera.getWorldDirection(across).cross(direction).normalize().multiplyScalar(1.39);
      if (across.dot(screenUp.setFromMatrixColumn(camera.matrixWorld, 1)) < 0) across.negate();
      start.copy(mouth).addScaledVector(direction, first);
      end.copy(mouth).addScaledVector(direction, last);
      const ray = rayAt(index);
      const { position, uv } = ray.geometry.attributes;
      position.setXYZ(0, start.x - across.x, start.y - across.y, start.z - across.z);
      position.setXYZ(1, start.x + across.x, start.y + across.y, start.z + across.z);
      position.setXYZ(2, end.x - across.x, end.y - across.y, end.z - across.z);
      position.setXYZ(3, end.x + across.x, end.y + across.y, end.z + across.z);
      uv.setXY(0, first, 0);
      uv.setXY(1, first, 1);
      uv.setXY(2, last, 0);
      uv.setXY(3, last, 1);
      position.needsUpdate = uv.needsUpdate = true;
      ray.visible = true;
    },
  };
}
