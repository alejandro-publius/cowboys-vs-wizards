import * as T from "three";
import { cardOf, EFFECTS } from "../../game/showdown/cards.js";

const palettes = {
  Lawman: { bright: 0xffce67, dim: 0x80572e, sky: 0xffda97, sun: 0xffbf76 },
  Undead: { bright: 0x8cebc2, dim: 0x336c66, sky: 0x9bbbdc, sun: 0xadbfd7 },
};

export function locationTag(id) {
  return id ? EFFECTS[cardOf(id).effect].tag : null;
}

function badgeShape(tag) {
  const path = new T.Shape();
  if (tag === "Lawman") {
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? 0.44 : 1;
      path[i ? "lineTo" : "moveTo"](Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  } else {
    path.moveTo(-0.66, 0.24);
    path.bezierCurveTo(-1.14, 0.96, -1.43, 0.09, -1.04, -0.10);
    path.bezierCurveTo(-1.31, -0.72, -0.53, -0.83, -0.55, -0.25);
    path.lineTo(0.55, -0.20);
    path.bezierCurveTo(0.59, -0.78, 1.29, -0.67, 1.05, -0.11);
    path.bezierCurveTo(1.43, 0.28, 0.94, 0.79, 0.63, 0.24);
  }
  path.closePath();
  return new T.ShapeGeometry(path);
}

const badges = new Map();

export function locationBadge(parent, tag) {
  if (!palettes[tag]) return;
  if (!badges.has(tag)) {
    const group = new T.Group();
    const shape = badgeShape(tag);
    shape.userData.showdownShared = true;
    for (const [color, size, z] of [[palettes[tag].dim, 0.31, 0], [palettes[tag].bright, 0.25, 0.018]]) {
      const paint = new T.MeshBasicMaterial({color, side: T.DoubleSide});
      paint.userData.showdownShared = true;
      const layer = new T.Mesh(shape, paint);
      layer.scale.setScalar(size);
      layer.position.z = z;
      group.add(layer);
    }
    badges.set(tag, group);
  }
  const badge = badges.get(tag).clone();
  badge.name = "location-bonus-" + tag;
  badge.position.set(1.05, 0.34, 0.77);
  badge.rotation.set(-0.47, 0, tag === "Undead" ? 0.40 : 0);
  badge.visible = false;
  parent.add(badge);
  return badge;
}

let glowMap;
function glowTexture() {
  if (glowMap) return glowMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.43, "rgba(255,255,255,0.50)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowMap = new T.CanvasTexture(canvas);
  return glowMap;
}

export function createLocationMist(parent) {
  const map = glowTexture();
  const bands = Array.from({length: 4}, (_, i) => {
    const material = new T.SpriteMaterial({map, color: i % 2 ? 0x5fd7a7 : 0x85abc2, opacity: 0.48,
      transparent: true, depthWrite: false});
    const mist = new T.Sprite(material);
    mist.scale.set(1.78 + i * 0.27, 0.34 + i % 2 * 0.10, 1);
    parent.add(mist);
    return mist;
  });
  return (now) => bands.forEach((band, i) => {
    const phase = now * 0.0013 + i * 1.77;
    band.position.set((i - 1.5) * 0.82 + 0.23 * Math.sin(phase), 0.38 + 0.045 * Math.sin(phase * 1.3),
      0.8 + i % 2 * 0.36 + 0.12 * Math.cos(phase));
  });
}

export function tintLocation(tag, lighting, hemi, sun) {
  hemi.color.setHex(lighting.hemi[0]);
  sun.color.setHex(lighting.sun[0]);
  const tone = palettes[tag];
  if (tone) {
    hemi.color.lerp(new T.Color(tone.sky), 0.55);
    sun.color.lerp(new T.Color(tone.sun), tag === "Undead" ? 0.70 : 0.50);
  }
}
