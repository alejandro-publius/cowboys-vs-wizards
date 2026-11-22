import * as T from "three";
import { typeOf } from "../../game/showdown/cards.js";
import { PAINTED_SPRITE_ALPHA } from "./graphics/pixel-renderer.js";

const source = typeof __CVW_DUEL_POSES__ === "undefined" ? "" : __CVW_DUEL_POSES__;
const billy = typeof __CVW_BILLY_POSES__ === "undefined" ? "" : __CVW_BILLY_POSES__;
const heights = { "cowboy-sheriff": 2.59, "cowboy-billy": 2.52, "wizard-skeleton": 2.49 };
const artwork = typeof __CVW_ACTOR_ART__ === "undefined" ? {} : __CVW_ACTOR_ART__;
const illustrated = {
  "cowboy-mounted-billy": { height: 2.53, width: 3.52, hips: 0.46, muzzle: [0.21, 0.95] },
  "cowboy-covered-wagon": { height: 2.04, width: 3.15, hips: 0.43, muzzle: [0.62, 0.56] },
  "cowboy-outrider": { height: 2.39, width: 3.44, hips: 0.49, muzzle: [0.78, 0.62] },
  "cowboy-ranger": { height: 2.55, muzzle: [0.91, 0.76] },
  "cowboy-dynamiter": { height: 2.38, muzzle: [0.86, 0.88] },
  "cowboy-gatling-crew": { height: 2.69, width: 3.10, hips: 0.41, muzzle: [0.95, 0.52], exactPaint: true },
  "cowboy-captured-wraith": { height: 2.66, hips: 0.53 },
  "cowboy-captured-dragon": { height: 2.93, width: 3.53, hips: 0.39, mouth: [0.91, 0.74] },
  "wizard-dragon": { height: 2.84, width: 3.76, hips: 0.42, mouth: [0.456, 0.60], exactPaint: true },
  "wizard-wizard": { height: 2.79, "staff-tip": [0.12, 0.93] },
  "wizard-lantern-wraith": { height: 2.60, width: 2.83, hips: 0.53 },
  "wizard-raven-familiar": { height: 1.58, width: 2.23, hips: 0.46 },
  "wizard-jack-o-lantern": { height: 1.62, width: 1.79 },
  "wizard-imp": { height: 1.66, width: 1.95 },
  "wizard-headless-horseman": { height: 2.62, width: 3.50, hips: 0.46 },
  "wizard-bone-wall": { height: 1.75, width: 2.69, hips: 0.45 },
};
const portraitPlane = new T.PlaneGeometry(1, 1, 1, 16);
const frames = new Map();
let ready;

function readPose(image, col, row, split, rows, mirror) {
  const divide = Math.floor(image.naturalWidth * split);
  const width = col ? image.naturalWidth - divide : divide,
    height = Math.floor(image.naturalHeight / rows);
  const crop = document.createElement("canvas");
  crop.width = width;
  crop.height = height;
  const ink = crop.getContext("2d", { willReadFrequently: true });
  ink.drawImage(image, col ? divide : 0, row * height, width, height, 0, 0, width, height);
  const { data } = ink.getImageData(0, 0, width, height);
  let left = width,
    right = 0,
    top = height,
    bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 150) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (left >= right || top >= bottom || left < 3 || right > width - 4 || top < 3 || bottom > height - 4)
    return null;
  const imagePose = document.createElement("canvas");
  imagePose.width = right - left + 1;
  imagePose.height = bottom - top + 1;
  const ctx = imagePose.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.translate(imagePose.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(crop, left, top, imagePose.width, imagePose.height, 0, 0, imagePose.width, imagePose.height);
  const map = new T.CanvasTexture(imagePose);
  map.colorSpace = T.SRGBColorSpace;
  map.minFilter = T.NearestFilter;
  map.magFilter = T.NearestFilter;
  map.generateMipmaps = false;
  return { map, aspect: imagePose.width / imagePose.height, height: imagePose.height };
}

export function loadStoryActors() {
  if (ready) return ready;
  function decode(url, roster, split) {
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        roster.forEach((id, row) => {
          const idle = readPose(image, 0, row, split, roster.length, id === "wizard-skeleton");
          const strike = readPose(image, 1, row, split, roster.length, false);
          if (idle && strike) frames.set(id, { idle, strike });
        });
        resolve();
      };
      image.onerror = () => resolve();
      image.src = url;
    });
  }
  async function cutout(id, url) {
    if (!url) return;
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      return;
    }
    const map = new T.Texture(image);
    map.colorSpace = T.SRGBColorSpace;
    map.minFilter = T.NearestFilter;
    map.magFilter = T.NearestFilter;
    map.generateMipmaps = false;
    map.needsUpdate = true;
    const pose = { map, aspect: image.naturalWidth / image.naturalHeight };
    frames.set(id, { idle: pose, strike: pose });
  }
  // Separate at the clear columns of the two painted sheets.
  ready = Promise.all([
    decode(source, ["cowboy-sheriff", "wizard-skeleton"], 0.39),
    decode(billy, ["cowboy-billy"], 0.5),
    ...Object.entries(artwork).map(([id, url]) => cutout(id, url)),
  ]);
  return ready;
}

export function storyActor(cardId, holder, model, camera) {
  const type = typeOf(cardId);
  const art = artwork[type] && illustrated[type];
  const height = art?.height ?? heights[type];
  if (!height || (!art && !(type === "cowboy-billy" ? billy : source))) return null;
  const hips = art?.hips ?? 0.49;
  const bend = { value: 0 };
  const sheriff = type === "cowboy-sheriff";
  const painted = { value: Boolean(art) || sheriff };
  const shadow = { value: art && !art.exactPaint ? 0.30 : 0 };
  const material = new T.SpriteMaterial({ alphaTest: art ? 0.38 : 0.52, transparent: false, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hipBend = bend;
    shader.uniforms.actorPainted = painted;
    shader.uniforms.actorShadow = shadow;
    // The illustrated cutouts arrive with brighter midtones than the painted pose sheets.
    shader.fragmentShader = "uniform bool actorPainted;\nuniform float actorShadow;\n" + shader.fragmentShader
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb *= mix(1.0 - actorShadow, 1.0, smoothstep(0.025, 0.48, luma));`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        if (actorPainted) gl_FragColor.a = ${PAINTED_SPRITE_ALPHA};`,
      );
    shader.vertexShader = "uniform float hipBend;\n" + shader.vertexShader.replace(
      "vec2 rotatedPosition;",
      "alignedPosition.x -= hipBend * abs(position.y + 0.5 - center.y); vec2 rotatedPosition;",
    );
  };
  const sprite = new T.Sprite(material);
  sprite.geometry = portraitPlane;
  sprite.center.set(0.5, 0.005);
  sprite.visible = false;
  holder.add(sprite);
  const world = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3();
  let position = "idle", fallingApart = false, float = 0;
  function sync() {
    const poses = frames.get(type);
    const pose = poses?.[position];
    if (!pose) return;
    sprite.visible = !fallingApart;
    model.visible = false;
    if (material.map !== pose.map) {
      if (!material.map) material.needsUpdate = true;
      material.map = pose.map;
    }
    const poseHeight = sheriff ? height * pose.height / poses.idle.height : height;
    const h = Math.min(poseHeight, (art?.width ?? Infinity) / pose.aspect);
    sprite.scale.set(pose.aspect * h, h, 1);
    sprite.center.x = position === "strike" && type === "wizard-skeleton" ? 0.61 : 0.5;
    sprite.center.y = float > 0 ? hips : 0.005;
    sprite.position.copy(model.position);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    sprite.position.addScaledVector(up, (sprite.center.y - 0.005) * h);
    material.rotation = model.rotation.z * (float > 0 ? 1 : art ? 0.72 : 0.45);
  }
  return {
    sync,
    effect(light, broken = false) {
      material.color.setScalar(light);
      fallingApart = broken;
      sync();
    },
    suspend(amount, direction) {
      float = amount;
      bend.value = 0.82 * float * direction;
      sync();
    },
    pose(name) {
      position = name;
      sync();
    },
    anchor(key, target) {
      if (!sprite.visible) return null;
      let coordinates = key === "hips" ? [0.5, hips] : key === "hit" ? [0.5, 0.61] : art?.[key];
      if (!coordinates && position === "strike") {
        if (key === "muzzle" && type !== "wizard-skeleton") coordinates = [0.98, 0.78];
        if (key === "dagger-tip" && type === "wizard-skeleton") coordinates = [0.04, 0.75];
      }
      if (!coordinates) return null;
      const [x, y] = coordinates;
      const width = (x - sprite.center.x) * sprite.scale.x - bend.value * Math.abs(y - sprite.center.y);
      const height = (y - sprite.center.y) * sprite.scale.y;
      const cos = Math.cos(material.rotation), sin = Math.sin(material.rotation);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      return target
        .copy(sprite.getWorldPosition(world))
        .addScaledVector(right, width * cos - height * sin)
        .addScaledVector(up, width * sin + height * cos);
    },
  };
}
