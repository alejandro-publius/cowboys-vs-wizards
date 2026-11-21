import * as T from "three";
import { typeOf } from "../../game/showdown/cards.js";

const source = typeof __CVW_DUEL_POSES__ === "undefined" ? "" : __CVW_DUEL_POSES__;
const billy = typeof __CVW_BILLY_POSES__ === "undefined" ? "" : __CVW_BILLY_POSES__;
const heights = { "cowboy-sheriff": 2.59, "cowboy-billy": 2.52, "wizard-skeleton": 2.49 };
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
  return { map, aspect: imagePose.width / imagePose.height };
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
  // Separate at the clear columns of the two painted sheets.
  ready = Promise.all([
    decode(source, ["cowboy-sheriff", "wizard-skeleton"], 0.39),
    decode(billy, ["cowboy-billy"], 0.5),
  ]);
  return ready;
}

export function storyActor(cardId, holder, model, camera) {
  const type = typeOf(cardId);
  const height = heights[type];
  if (!height || (type === "cowboy-billy" ? !billy : !source)) return null;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ alphaTest: 0.52, transparent: true, toneMapped: false }),
  );
  sprite.center.set(0.5, 0.005);
  sprite.visible = false;
  holder.add(sprite);
  const world = new T.Vector3(),
    right = new T.Vector3(),
    up = new T.Vector3();
  let position = "idle", fallingApart = false;
  function sync() {
    const pose = frames.get(type)?.[position];
    if (!pose) return;
    sprite.visible = !fallingApart;
    model.visible = false;
    if (sprite.material.map !== pose.map) {
      if (!sprite.material.map) sprite.material.needsUpdate = true;
      sprite.material.map = pose.map;
      sprite.scale.set(pose.aspect * height, height, 1);
      sprite.center.x = position === "strike" && type === "wizard-skeleton" ? 0.61 : 0.5;
    }
    sprite.position.copy(model.position);
    // The cutout stays planted over its physical tile.
    sprite.material.rotation = model.rotation.z * 0.45;
  }
  return {
    sync,
    effect(light, broken = false) {
      sprite.material.color.setScalar(light);
      fallingApart = broken;
      sync();
    },
    pose(name) {
      position = name;
      sync();
    },
    anchor(key, target) {
      if (!sprite.visible) return null;
      let x = 0.5,
        y = 0.61;
      if (position === "strike" && key === "muzzle" && type !== "wizard-skeleton") {
        x = 0.98;
        y = 0.78;
      } else if (position === "strike" && key === "dagger-tip" && type === "wizard-skeleton") {
        x = 0.04;
        y = 0.75;
      } else if (key !== "hit") return null;
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      return target
        .copy(sprite.getWorldPosition(world))
        .addScaledVector(right, (x - sprite.center.x) * sprite.scale.x)
        .addScaledVector(up, y * sprite.scale.y);
    },
  };
}
