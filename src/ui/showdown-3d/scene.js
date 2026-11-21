import * as T from "three";
import { BOARD_SIZE, TRAP_SLOTS } from "../../game/showdown/rules.js";
import { cardOf, typeOf } from "../../game/showdown/cards.js";
import { PixelRenderer } from "./graphics/pixel-renderer.js";
import { makeBoard } from "./board.js";
import { addLandmarks } from "./landmarks.js";
import { presentationBeats } from "./event-positions.js";
import { createCombatEffects } from "./combat-effects.js";
import { makeBases } from "./bases.js";
import { makeCardModel, makeLiveCardModel } from "./card-models.js";
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
  ring: new T.TorusGeometry(0.5, 0.037, 5, 22),
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
  const { model: miniature, rig } = makeLiveCardModel(id, {
    width: wide ? 3.23 : 2.65,
    height: wide ? 2.25 : 1.91,
    depth: 1.87,
  });
  const restScale = miniature.scale.x;
  miniature.position.set(0, 0.146, -0.07);
  group.add(miniature);
  const gear = new T.Group();
  group.add(gear);
  let equipped = "";
  const pips = new T.Group();
  pips.position.set(0, 0.21, 0.76);
  group.add(pips);
  const pipsMaterial = flat(orb);
  const cover = new T.Group(),
    left = side === "cowboy";
  cover.position.set(left ? 1.11 : -1.11, 0.12, 0.043);
  group.add(cover);
  if (left) {
    mesh(cover, "box", solid(0x775044), [0, 0.16, 0], [0.28, 0.31, 1.18]);
    for (const z of [-0.38, 0.38]) {
      const wood = mesh(cover, "box", solid(0xb0805b), [0.015, 0.35, z], [0.14, 0.57, 0.23]);
      wood.rotation.z = z * 0.67;
    }
  } else {
    const slab = mesh(cover, "box", solid(0x8a8299), [0, 0.27, 0], [0.24, 0.65, 0.93]);
    slab.rotation.z = 0.21;
  }
  const stun = mesh(group, "ring", flat(0xe4b57b), [0, 0.66, 0.14], [0.91, 0.91, 0.91]);
  stun.rotation.x = 0.85;
  stun.rotation.y = 0.12;
  group.traverse((node) => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  return {
    group,
    model: miniature,
    rig,
    restScale,
    id,
    side,
    restY: 0.146,
    update(troop) {
      this.restY = troop.cover ? 0.066 : 0.146;
      miniature.position.set(0, this.restY, -0.07);
      miniature.rotation.set(0, 0, 0);
      const rider = miniature.getObjectByName("rider");
      if (rider) {
        rider.visible = true;
        rider.rotation.z = 0;
      }
      miniature.scale.set(restScale, restScale * (troop.stunned ? 0.92 : troop.cover ? 0.9 : 1), restScale);
      if (rig) rig.pose({});
      stun.visible = Boolean(troop.stunned);
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
  const sun = new T.DirectionalLight(0xffd2a4, 2.34);
  sun.position.set(-19, 20, 13);
  const moon = new T.DirectionalLight(0x9397de, 0.83);
  moon.position.set(24, 17, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 0.1, far: 60 });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00025;
  scene.add(hemi, sun, moon);
  makeBoard(scene, addLandmarks);
  const bases = makeBases(scene);
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
  let view,
    display,
    epoch = 0,
    width = 0,
    height = 0,
    locationId = null;
  const pawnAt = (mark) => (mark?.slot === undefined || mark.at ? null : held.get(mark.side + mark.slot));
  const fx = createCombatEffects(moves, pawnAt, bases);

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
      const { line } = COLORS[side] ?? COLORS.wizard;
      cardPiece(group, line, 0.88);
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
  function paintOrbs(button, hp, maximum) {
    const attr = button?.querySelector(".sd-orbs");
    if (!attr) return;
    const label = hp + " of " + Math.max(hp, maximum) + " orbs";
    if (attr.dataset.visualCount === label) return;
    attr.dataset.visualCount = label;
    // The native accessible label already names the resolved result. Stage only the drawn pips.
    attr.firstChild?.remove();
    attr.replaceChildren(document.createTextNode("●".repeat(hp)));
    const lost = document.createElement("span");
    lost.className = "sd-lost";
    lost.textContent = "○".repeat(Math.max(0, maximum - hp));
    attr.append(lost);
  }
  function arrange() {
    if (!display || canvas.hidden) return;
    // Exactly the same native buttons continue to receive clicks, focus and screen-reader text.
    for (const side of SIDES) {
      const s = display.sides[side];
      const [bx, , bz] = zone(side, "base");
      placeControl(`[data-base="${side}"]`, bx, 0.05, bz + 1.25);
      bases[side].update(s.base, s.baseMax);
      paintOrbs(host.querySelector(`[data-base="${side}"]`), s.base, s.baseMax);
      for (let slot = 0; slot < BOARD_SIZE; slot++) {
        const [x, , z] = zone(side, "troop", slot);
        const selector = `[data-slot="${side}-${slot}"]`;
        const troop = s.board[slot];
        const actual = view.sides[side].board[slot];
        // The tag sits beside the miniature so a rear slot never hides the next figure.
        const shift = width < 1010 ? 1.38 : 1.59;
        placeControl(selector, x + (troop ? shift : 0), 0.22, z + 0.73);
        const btn = host.querySelector(selector);
        const temporary = troop?.cardId !== actual?.cardId;
        if (btn) btn.dataset.previewSwap = temporary ? "1" : "";
        const word = temporary && troop ? cardOf(troop.cardId).name + " " + "●".repeat(troop.health) : "";
        label(side + "snapshot" + slot, [x + shift, 0.18, z + 0.71], word);
        if (troop && !temporary) paintOrbs(btn, troop.health, cardOf(troop.cardId).health);
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
      label(
        side + "traps",
        [x + (side === "wizard" ? 1.04 : -0.28), 0.066, z + 0.81],
        "Traps " + s.trapCount + "/" + TRAP_SLOTS,
        s.trapCount > 0,
      );
    }
    const location = display.location?.cardId;
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
    if (width && height && view && !canvas.hidden) {
      bases.wizard.ambient(performance.now());
      pipeline.render(scene, camera);
    }
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

  function makePawn(mark, troop) {
    const token = pawn(mark.side, troop.cardId);
    token.group.position.set(...zone(mark.side, "troop", mark.slot));
    token.group.position.y = 0.14;
    token.update(troop);
    return token;
  }

  function synchronize(next) {
    display = next;
    for (const side of SIDES)
      next.sides[side].board.forEach((troop, slot) => {
        const key = side + slot;
        let token = held.get(key);
        if (token?.id !== troop?.cardId) {
          if (token) {
            moves.remove(token.group);
            disposePawn(token.group);
            held.delete(key);
          }
          if (troop) {
            token = makePawn({ side, slot }, troop);
            moves.add(token.group);
            held.set(key, token);
          }
        }
        if (troop) token.update(troop);
      });
    size();
  }

  function stop() {
    epoch++;
    fx.clear();
    delete canvas.dataset.motion;
  }
  function paint(next, start) {
    stop();
    view = next;
    canvas.hidden = false;
    for (const button of host.closest("#showdown").querySelectorAll("#sd-hand [data-card]")) {
      if (button.querySelector(".sd-card-art")) continue;
      const id = typeOf(button.dataset.card),
        art = portrait(id);
      if (art) button.prepend(art);
      button.classList.toggle("sd-captured-art", id.startsWith("cowboy-captured-"));
    }
    synchronize(start && BROAD.matches && !REDUCED.matches ? start : next);
  }
  function clear() {
    stop();
    view = display = null;
    canvas.hidden = true;
    labelLayer.replaceChildren();
    worldLabels.clear();
  }
  function animate(trace) {
    stop();
    if (!view) return;
    const beats = BROAD.matches && !REDUCED.matches ? presentationBeats(trace) : [];
    if (!beats.length) return synchronize(view);
    const run = epoch;
    const initial = performance.now();
    let index = 0,
      edge = 0,
      phase = "";
    function frame(now) {
      if (run !== epoch) return;
      const elapsed = now - initial;
      while (index < beats.length && elapsed >= edge + beats[index].duration) {
        edge += beats[index].duration;
        index++;
      }
      const beat = beats[index];
      if (!beat) {
        stop();
        synchronize(view);
        return;
      }
      const local = elapsed - edge,
        hit = local >= beat.contact;
      const next = index + ":" + (hit ? "hit" : "pre");
      if (next !== phase) {
        const newBeat = !phase.startsWith(index + ":");
        phase = index + ":" + (hit ? "hit" : "pre");
        synchronize(hit ? beat.hit : beat.pre);
        if (newBeat) fx.begin(beat, makePawn, (token) => disposePawn(token.group));
      }
      canvas.dataset.motion = beat.kind;
      fx.frame(local);
      draw();
      requestAnimationFrame(frame);
    }
    canvas.dataset.motion = beats[0].kind;
    requestAnimationFrame(frame);
  }

  new ResizeObserver(size).observe(canvas);
  const screen = host.closest("#showdown");
  window.setInterval(() => {
    if (view && !screen.hidden && !canvas.hidden && !canvas.dataset.motion && !REDUCED.matches) draw();
  }, 145);
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
    paint(view, start) {
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
      game.paint(view, start);
    },
    clear() {
      game?.clear();
      root.classList.remove("sd-diorama");
    },
    animate(trace) {
      if (!failed) game?.animate(trace);
    },
  };
}
