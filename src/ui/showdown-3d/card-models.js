import * as T from "three";
import { TYPES, typeOf } from "../../game/showdown/cards.js";
import { makeSheriff } from "./sheriff.js";
import { makeDragon } from "./dragon.js";
import { ART as western } from "./western-rigs.js";
import { ART as wizards } from "./wizard-rigs.js";
import { ART as wraiths } from "./wraith-rigs.js";
import { ART as props } from "./card-props.js";
import { ART as lawmen } from "./lawmen.js";

const shapes = {
  box: new T.BoxGeometry(1, 1, 1),
  cone: new T.ConeGeometry(0.5, 1, 6),
  round: new T.CylinderGeometry(0.5, 0.5, 1, 10),
  rock: new T.DodecahedronGeometry(0.5),
  gem: new T.OctahedronGeometry(0.5),
  orb: new T.SphereGeometry(0.5, 10, 7),
  ring: new T.TorusGeometry(0.45, 0.05, 6, 26).rotateX(Math.PI / 2),
};
const materials = new Map();

class Miniature {
  root = new T.Group();
  parent = this.root;
  group(name, draw) {
    const former = this.parent;
    const sub = new T.Group();
    sub.name = name;
    former.add(sub);
    this.parent = sub;
    draw();
    this.parent = former;
  }
  piece(kind, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    this.add(false, kind, color, x, y, z, w, h, d, rx, ry, rz);
  }
  glow(kind, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    this.add(true, kind, color, x, y, z, w, h, d, rx, ry, rz);
  }
  box(color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    this.piece("box", color, x, y, z, w, h, d, rx, ry, rz);
  }
  add(glow, kind, color, x, y, z, w, h, d, rx, ry, rz) {
    const key = (glow ? "light" : "paint") + color;
    if (!materials.has(key)) {
      materials.set(
        key,
        glow
          ? new T.MeshBasicMaterial({ color })
          : new T.MeshStandardMaterial({ color, roughness: 0.91, flatShading: true }),
      );
    }
    const node = new T.Mesh(shapes[kind], materials.get(key));
    node.position.set(x, y, z);
    node.scale.set(w, h, d);
    node.rotation.set(rx, ry, rz);
    node.castShadow = node.receiveShadow = !glow;
    this.parent.add(node);
  }
}

const modelFactories = {
  ...western,
  ...wizards,
  ...wraiths,
  ...props,
  ...lawmen,
  "cowboy-sheriff": () => makeSheriff().root,
  "wizard-dragon": () => makeDragon().root,
  "cowboy-captured-dragon": () => makeDragon({ captured: true }).root,
};

for (const id of Object.keys(TYPES)) {
  if (!Object.hasOwn(modelFactories, id)) throw new Error("Missing Showdown illustration: " + id);
}
const models = new Map();
function frame(id, root) {
  if (id === "cowboy-sheriff") root.rotation.y = -0.44;
  if (id === "cowboy-captured-dragon") root.rotation.y = -2.54;
  const posed = new T.Group();
  posed.add(root);
  const bounds = new T.Box3().setFromObject(posed);
  const size = bounds.getSize(new T.Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z].every(Number.isFinite))
    throw new Error("Invalid Showdown illustration: " + id);
  const middle = bounds.getCenter(new T.Vector3());
  root.position.sub(new T.Vector3(middle.x, bounds.min.y, middle.z));
  return { posed, size };
}

function template(id) {
  if (models.has(id)) return models.get(id);
  const builder = new Miniature();
  const root = modelFactories[id](builder) ?? builder.root;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.geometry.userData.showdownShared = true;
    for (const material of [mesh.material].flat()) material.userData.showdownShared = true;
  });
  const data = frame(id, root);
  models.set(id, data);
  return data;
}

function fit(model, size, { width = 2.65, height = 1.84, depth = 1.66 } = {}) {
  model.scale.setScalar(Math.min(width / size.x, height / size.y, depth / size.z));
  return model;
}

export function makeCardModel(cardId, { width = 2.65, height = 1.84, depth = 1.66 } = {}) {
  const id = typeOf(cardId);
  const { posed, size } = template(id);
  const model = posed.clone(true);
  model.name = id;
  return fit(model, size, { width, height, depth });
}

export function makeLiveCardModel(cardId, size) {
  const id = typeOf(cardId);
  if (id !== "cowboy-sheriff" && !id.endsWith("-dragon")) return { model: makeCardModel(cardId, size) };
  const rig =
    id === "cowboy-sheriff" ? makeSheriff() : makeDragon({ captured: id === "cowboy-captured-dragon" });
  // The Sheriff shares material definitions with the gallery template.
  if (id === "cowboy-sheriff") template(id);
  const { posed, size: bounds } = frame(id, rig.root);
  return { model: fit(posed, bounds, size), rig };
}
