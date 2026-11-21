import * as T from "three";
import { BOARD_SIZE, TRAP_SLOTS } from "../../game/showdown/rules.js";
import { cardOf, typeOf } from "../../game/showdown/cards.js";
import { PixelRenderer } from "./graphics/pixel-renderer.js";
import { makeBoard } from "./board.js";
import { addLandmarks } from "./landmarks.js";
import { eventPositions } from "./event-positions.js";
import { makeCardModel } from "./card-models.js";
import { portrait } from "./gallery.js";
export { mountGallery } from "./gallery.js";
import { COLORS, SIDES, zone } from "./layout.js";

const FACEDOWN = 0x2a213b;
const BROAD = window.matchMedia("(min-width: 800px)");
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
const solid = (color) => new T.MeshStandardMaterial({ color, roughness: 0.88, flatShading: true });
const flat = (color) => new T.MeshBasicMaterial({ color });
const meshes = {
  box: new T.BoxGeometry(1, 1, 1),
  gem: new T.OctahedronGeometry(0.5),
  badge: new T.CylinderGeometry(0.5, 0.5, 1, 8),
};
function mesh(parent, geometry, material, position, scale) {
  const node = new T.Mesh(meshes[geometry], material);
  node.position.set(...position);
  node.scale.set(...scale);
  parent.add(node);
  return node;
}

function cardPiece(parent, color, scale = 1) {
  mesh(parent, "box", solid(color), [0, 0.055, 0], [1.1 * scale, 0.105, 1.28 * scale]);
  mesh(parent, "box", solid(FACEDOWN), [0, 0.116, 0], [0.94 * scale, 0.018, 1.12 * scale]);
  const mark = mesh(parent, "box", solid(color), [0, 0.133, 0], [0.17, 0.012, 0.17]);
  mark.rotation.y = Math.PI / 4;
}

function pawn(side, id) {
  const group = new T.Group();
  const { tile, line, dark, orb } = COLORS[side];
  mesh(group, "box", solid(dark), [0, 0.052, 0], [2.8, 0.105, 1.87]);
  mesh(group, "box", solid(tile), [0, 0.112, 0], [2.61, 0.025, 1.7]);
  const wide = [
    "wizard-dragon",
    "cowboy-captured-dragon",
    "cowboy-mounted-billy",
    "cowboy-covered-wagon",
    "cowboy-gatling-crew",
    "wizard-bone-wall",
    "wizard-headless-horseman",
  ].includes(typeOf(id));
  const miniature = makeCardModel(id, { width: wide ? 3.23 : 2.65, height: wide ? 2.25 : 1.91, depth: 1.87 });
  miniature.position.set(0, 0.146, -0.07);
  group.add(miniature);
  const gear = new T.Group();
  group.add(gear);
  let equipped = "";
  const pips = new T.Group();
  pips.position.set(0, 0.21, 0.76);
  group.add(pips);
  const pipsMaterial = flat(orb);
  const cover = mesh(group, "box", solid(line), [-1.03, 0.29, 0.16], [0.114, 0.44, 0.79]);
  group.traverse((node) => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  return {
    group,
    update(troop) {
      while (pips.children.length > troop.health) pips.remove(pips.children.at(-1));
      while (pips.children.length < troop.health)
        mesh(pips, "gem", pipsMaterial, [0, 0, 0], [0.21, 0.21, 0.21]);
      pips.children.forEach((pip, i) => {
        pip.position.x = (i - (troop.health - 1) / 2) * 0.241;
      });
      cover.visible = troop.cover;
      if (troop.gear.join() !== equipped) {
        equipped = troop.gear.join();
        gear.clear();
        troop.gear.forEach((id, i) => {
          const object = makeCardModel(id, { width: 0.56, height: 0.53, depth: 0.47 });
          object.position.set((i % 2 ? -1 : 1) * 0.98, 0.135, 0.41 - Math.floor(i / 2) * 0.32);
          gear.add(object);
        });
      }
    },
  };
}

function build(host, canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const pipeline = new PixelRenderer(renderer);
  const scene = new T.Scene();
  scene.background = new T.Color(0x17243a);
  const camera = new T.OrthographicCamera(-20, 20, 10, -10, 0.1, 120);
  const hemi = new T.HemisphereLight(0xffefd6, 0x796b8e, 2.28);
  const sun = new T.DirectionalLight(0xffe0b7, 2.75);
  sun.position.set(-16, 27, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 0.1, far: 60 });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00025;
  scene.add(hemi, sun);
  makeBoard(scene, addLandmarks);
  pipeline.configure({ pixelSize: 2, outlines: true, dither: true, exposure: 1.035 });
  const moves = new T.Group();
  scene.add(moves);
  const held = new Map();
  const labelLayer = host.querySelector(".sd-world-labels");
  const locationGroup = new T.Group();
  moves.add(locationGroup);
  const worldLabels = new Map();
  const sideMarks = new Map();
  const viewTarget = new T.Vector3(0, 0.64, -0.13);
  const projection = new T.Vector3();
  const bolt = mesh(moves, "box", flat(0xffddb4), [0, 0, 0], [0.07, 1, 0.07]);
  const flash = mesh(moves, "gem", flat(0xffffff), [0, 0, 0], [0.38, 0.38, 0.38]);
  const north = new T.Vector3(0, 1, 0);
  const from = new T.Vector3(),
    to = new T.Vector3(),
    direction = new T.Vector3();
  let view,
    epoch = 0,
    width = 0,
    height = 0;
  let locationId = null;
  let eventModel = null;

  function label(key, [x, y, z], word, active = true) {
    if (!worldLabels.has(key)) {
      const text = document.createElement("span");
      labelLayer.append(text);
      worldLabels.set(key, text);
    }
    const text = worldLabels.get(key);
    text.hidden = !word;
    text.textContent = word;
    text.classList.toggle("empty", !active);
    place(text, x, y, z);
  }
  function pieceAt(side, at, index = 0) {
    const key = side + at + index;
    if (!sideMarks.has(key)) {
      const group = new T.Group();
      group.position.set(...zone(side, at, index));
      group.position.y += 0.13;
      const { line, orb } = COLORS[side] ?? COLORS.wizard;
      if (at === "base") {
        mesh(group, "gem", flat(orb), [0, 0.72, 0], [0.93, 1.29, 0.93]);
        mesh(group, "gem", solid(line), [0, 0.49, 0], [0.7, 0.76, 0.7]);
      } else cardPiece(group, line, at === "location" ? 1.33 : 0.88);
      sideMarks.set(key, group);
      moves.add(group);
    }
    return sideMarks.get(key);
  }

  function place(element, x, y, z) {
    if (!element) return;
    projection.set(x, y, z).project(camera);
    element.style.left = (projection.x * 0.5 + 0.5) * width + "px";
    element.style.top = (0.5 - projection.y * 0.5) * height + "px";
  }
  function placeControl(selector, x, y, z) {
    const button = host.querySelector(selector);
    place(button, x, y, z);
    if (!button?.matches("[data-base], [data-frame]")) return;
    const notes = button.querySelectorAll(":scope > .sd-note");
    if (!notes.length) return;
    const detail = document.createElement("span");
    detail.className = "sd-world-detail";
    detail.append(...notes);
    button.append(detail);
  }
  function arrange() {
    if (!view || canvas.hidden) return;
    // Exactly the same native buttons continue to receive clicks, focus and screen-reader text.
    for (const side of SIDES) {
      const s = view.sides[side];
      const [bx, , bz] = zone(side, "base");
      placeControl(`[data-base="${side}"]`, bx, 0.05, bz + 1.25);
      pieceAt(side, "base").visible = s.base > 0;
      for (let slot = 0; slot < BOARD_SIZE; slot++) {
        const [x, , z] = zone(side, "troop", slot);
        placeControl(`[data-slot="${side}-${slot}"]`, x, 0.22, z + 0.75);
      }
      for (const [at, count, title] of [
        ["deck", s.deckCount, "Deck"],
        ["discard", s.discard.length, "Graveyard"],
      ]) {
        const [x, , z] = zone(side, at);
        const stack = pieceAt(side, at);
        stack.visible = count > 0;
        stack.scale.y = Math.min(4, 1 + count / 7);
        label(side + at, [x, 0.071, z + 0.7], title + " " + count, count > 0);
      }
      const [x, , z] = zone(side, "trap", TRAP_SLOTS - 1);
      // A trap's identity never leaves Showdown's own seat-scoped controls.
      for (let slot = 0; slot < TRAP_SLOTS; slot++) pieceAt(side, "trap", slot).visible = s.trapCount > slot;
      label(side + "traps", [x, 0.066, z + 0.74], "Traps " + s.trapCount + "/" + TRAP_SLOTS, s.trapCount > 0);
    }
    const location = view.location?.cardId;
    if ((location ?? null) !== locationId) {
      locationId = location ?? null;
      locationGroup.clear();
      if (locationId) {
        const prop = makeCardModel(locationId, { width: 2.38, height: 1.41, depth: 1.58 });
        prop.position.set(...zone(null, "location"));
        prop.position.y = 0.17;
        locationGroup.add(prop);
      }
    }
    label("location", [0, 0.08, 1.5], location ? cardOf(location).name : "Location", Boolean(location));
  }

  function draw() {
    if (width && height && view && !canvas.hidden) pipeline.render(scene, camera);
  }
  function size() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (width === nextWidth && height === nextHeight) {
      arrange();
      draw();
      return;
    }
    width = nextWidth;
    height = nextHeight;
    if (!width || !height || canvas.hidden) return;
    const aspect = width / height;
    const spread = Math.max(8.4, 19.01 / aspect);
    camera.left = -spread * aspect;
    camera.right = spread * aspect;
    camera.top = spread;
    camera.bottom = -spread;
    camera.position.copy(viewTarget).add(new T.Vector3(13, 34, 45));
    camera.lookAt(viewTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    renderer.setSize(width, height, false);
    pipeline.setSize(width, height);
    arrange();
    draw();
  }

  function paint(next) {
    canvas.hidden = false;
    view = next;
    for (const button of host.closest("#showdown").querySelectorAll("#sd-hand [data-card]")) {
      if (button.querySelector(".sd-card-art")) continue;
      const id = typeOf(button.dataset.card);
      const art = portrait(id);
      if (art) button.prepend(art);
      button.classList.toggle("sd-captured-art", id.startsWith("cowboy-captured-"));
    }
    for (const side of SIDES) {
      view.sides[side].board.forEach((troop, slot) => {
        const k = side + slot;
        let token = held.get(k);
        if (token?.id !== troop?.cardId) {
          if (token) {
            moves.remove(token.group);
            disposePawn(token.group);
            held.delete(k);
          }
          if (troop) {
            token = { id: troop.cardId, ...pawn(side, troop.cardId) };
            token.group.position.set(...zone(side, "troop", slot));
            token.group.position.y = 0.14;
            moves.add(token.group);
            held.set(k, token);
          }
        }
        if (troop) held.get(k).update(troop);
      });
    }
    size();
  }
  function stop() {
    epoch++;
    if (eventModel) moves.remove(eventModel);
    eventModel = null;
    flash.visible = bolt.visible = false;
  }
  function clear() {
    stop();
    view = null;
    canvas.hidden = true;
    labelLayer.replaceChildren();
    worldLabels.clear();
  }
  function animate(events, before, after) {
    stop();
    if (!view || REDUCED.matches) return draw();
    const steps = eventPositions(events, before, after);
    if (!steps.length) return draw();
    const start = performance.now();
    const selected = epoch;
    const beat = 340;
    let previous;
    function frame(now) {
      if (epoch !== selected) return;
      const elapsed = now - start;
      const effect = steps[Math.floor(elapsed / beat)];
      if (!effect) {
        stop();
        draw();
        return;
      }
      const fade = 1 - (elapsed % beat) / beat;
      const pos = (mark, point) => {
        point.set(...zone(mark.side, mark.at ?? "troop", mark.slot));
        point.y = mark.slot === undefined ? 0.75 : 1.06;
      };
      pos(effect.from, from);
      pos(effect.to ?? effect.from, to);
      bolt.visible = Boolean(effect.to) && !from.equals(to);
      flash.visible = true;
      if (effect !== previous) {
        previous = effect;
        if (eventModel) moves.remove(eventModel);
        eventModel = null;
        if (effect.cardId && (effect.kind === "trap" || effect.kind === "spell")) {
          eventModel = makeCardModel(effect.cardId, { width: 2.05, height: 1.45, depth: 1.38 });
          moves.add(eventModel);
        }
      }
      if (eventModel) {
        bolt.visible = flash.visible = false;
        eventModel.position.copy(from).lerp(to, effect.kind === "trap" ? 0 : Math.min(1, (1 - fade) * 3));
        eventModel.position.y = effect.kind === "trap" ? 0.22 : 0.64 + Math.sin(fade * Math.PI) * 0.23;
      }
      bolt.material.color.setHex(effect.from.side === "wizard" ? 0xc1c3ff : 0xffd698);
      bolt.position.copy(from).lerp(to, 0.5);
      direction.copy(to).sub(from);
      bolt.scale.set(0.04 + 0.04 * fade, direction.length(), 0.05 + 0.051 * fade);
      if (bolt.visible) bolt.quaternion.setFromUnitVectors(north, direction.normalize());
      flash.position.copy(to);
      flash.scale.setScalar(0.25 + 0.42 * fade);
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  flash.visible = bolt.visible = false;
  new ResizeObserver(size).observe(canvas);
  return { paint, clear, animate, size };
}

function disposePawn(group) {
  const materials = new Set(),
    geometries = new Set();
  group.traverse((node) => {
    if (!node.isMesh) return;
    for (const material of [node.material].flat())
      if (!material.userData.showdownShared) materials.add(material);
    if (!node.geometry.userData.showdownShared && !Object.values(meshes).includes(node.geometry))
      geometries.add(node.geometry);
  });
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export function mountDiorama(root) {
  const field = root.querySelector("#sd-field");
  const canvas = document.createElement("canvas");
  canvas.className = "sd-world";
  canvas.setAttribute("aria-hidden", "true");
  canvas.hidden = true;
  const labels = document.createElement("div");
  labels.className = "sd-world-labels";
  labels.setAttribute("aria-hidden", "true");
  field.prepend(canvas, labels);
  let game,
    failed = false;
  function fallback() {
    game?.clear();
    canvas.hidden = true;
    root.classList.remove("sd-diorama");
    failed = true;
  }
  canvas.addEventListener("webglcontextlost", fallback);
  return {
    paint(view) {
      if (failed) return;
      if (!game) {
        try {
          game = build(field, canvas);
        } catch (error) {
          console.warn("Showdown 3D unavailable.", error);
          fallback();
          return;
        }
      }
      root.classList.add("sd-diorama");
      game.paint(view);
    },
    clear() {
      game?.clear();
      root.classList.remove("sd-diorama");
    },
    animate(events, before, after) {
      if (!failed && BROAD.matches) game?.animate(events, before, after);
    },
  };
}
