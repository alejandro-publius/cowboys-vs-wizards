import * as T from "three";
import { BOARD_SIZE, TRAP_SLOTS } from "../../game/showdown/rules.js";
import { cardOf } from "../../game/showdown/cards.js";
import { PixelRenderer } from "./graphics/pixel-renderer.js";
import { makeBoard } from "./board.js";
import { addLandmarks } from "./landmarks.js";
import { eventPositions } from "./event-positions.js";
import { makeSheriff } from "./sheriff.js";
import { makeDragon } from "./dragon.js";
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

function skeleton(group) {
  const bone = solid(0xddcfaa);
  const shade = solid(0x595368);
  mesh(group, "box", bone, [0, 1.16, 0], [0.43, 0.39, 0.36]);
  mesh(group, "box", bone, [0.02, 0.958, 0.01], [0.29, 0.11, 0.31]);
  mesh(group, "box", bone, [0, 0.68, -0.03], [0.13, 0.5, 0.16]);
  for (const y of [0.6, 0.7, 0.8]) mesh(group, "box", bone, [0, y, 0.012], [0.44, 0.058, 0.25]);
  for (const side of [-1, 1]) {
    mesh(group, "box", shade, [side * 0.102, 1.194, 0.181], [0.098, 0.1, 0.035]);
    const arm = mesh(group, "box", bone, [side * 0.284, 0.699, 0.03], [0.096, 0.39, 0.105]);
    arm.rotation.z = side * 0.2;
    mesh(group, "box", bone, [side * 0.132, 0.31, 0], [0.1, 0.39, 0.126]);
  }
}

function jack(group) {
  mesh(group, "gem", solid(0xde6e2e), [0, 0.61, 0], [0.98, 0.9, 0.96]);
  mesh(group, "box", solid(0x5a7850), [0, 1.05, -0.02], [0.13, 0.22, 0.13]).rotation.z = 0.22;
  const glow = flat(0xffcb64);
  for (const side of [-1, 1])
    mesh(group, "box", glow, [side * 0.166, 0.69, 0.21], [0.102, 0.114, 0.059]).rotation.z = side * 0.38;
  mesh(group, "box", glow, [0, 0.535, 0.305], [0.19, 0.042, 0.042]);
}

function pawn(side, id) {
  const group = new T.Group();
  const { tile, line, dark, orb } = COLORS[side];
  mesh(group, "box", solid(dark), [0, 0.052, 0], [2.64, 0.105, 1.76]);
  mesh(group, "box", solid(tile), [0, 0.112, 0], [2.46, 0.025, 1.6]);
  const name = cardOf(id).name;
  const isDragon = name === "Dragon" || name === "Captured Dragon";
  const figure = name === "Sheriff" ? makeSheriff() : isDragon ? makeDragon() : null;
  if (figure) {
    figure.root.scale.setScalar(name === "Sheriff" ? 0.84 : 0.69);
    figure.root.position.set(0, 0.145, -0.07);
    figure.root.rotation.y = isDragon && side === "cowboy" ? Math.PI : 0;
    group.add(figure.root);
  } else if (name === "Skeleton") {
    skeleton(group);
  } else if (name === "Jack-o'-Lantern") {
    jack(group);
  } else {
    // The actual card name and game values are displayed by the original control above this standee.
    const badge = mesh(group, "badge", solid(tile), [0, 0.73, -0.06], [0.96, 0.15, 0.96]);
    badge.rotation.x = Math.PI / 2;
    const face = mesh(group, "badge", flat(line), [0, 0.73, 0.035], [0.67, 0.042, 0.67]);
    face.rotation.x = Math.PI / 2;
    const mark = mesh(group, "box", solid(dark), [0, 0.73, 0.074], [0.28, 0.3, 0.056]);
    mark.rotation.z = Math.PI / 4;
    mesh(group, "box", solid(dark), [0, 0.31, -0.055], [0.37, 0.38, 0.18]);
  }
  const pips = new T.Group();
  pips.position.set(0, 0.21, 0.72);
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
        mesh(pips, "gem", pipsMaterial, [0, 0, 0], [0.19, 0.19, 0.19]);
      pips.children.forEach((pip, i) => {
        pip.position.x = (i - (troop.health - 1) / 2) * 0.224;
      });
      cover.visible = troop.cover;
      if (figure)
        figure.pose(name === "Sheriff" ? { brace: troop.cover ? 1 : 0 } : { charge: troop.cover ? 0.6 : 0 });
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
        mesh(group, "gem", flat(orb), [0, 0.69, 0], [0.85, 1.22, 0.85]);
        mesh(group, "gem", solid(line), [0, 0.49, 0], [0.64, 0.71, 0.64]);
      } else cardPiece(group, line, at === "location" ? 1.24 : 0.81);
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
  function arrange() {
    if (!view || canvas.hidden) return;
    // Exactly the same native buttons continue to receive clicks, focus and screen-reader text.
    for (const side of SIDES) {
      const s = view.sides[side];
      const [bx, , bz] = zone(side, "base");
      place(host.querySelector(`[data-base="${side}"]`), bx, 0.05, bz + 1.25);
      pieceAt(side, "base").visible = s.base > 0;
      for (let slot = 0; slot < BOARD_SIZE; slot++) {
        const [x, , z] = zone(side, "troop", slot);
        place(host.querySelector(`[data-slot="${side}-${slot}"]`), x, 0.22, z + 0.75);
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
    const tile = pieceAt(null, "location");
    tile.visible = Boolean(location);
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
    const spread = Math.max(8.4, 19.55 / aspect);
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
    const beat = 245;
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
    materials.add(node.material);
    if (!Object.values(meshes).includes(node.geometry)) geometries.add(node.geometry);
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
