// Orb Duel board view: the renderer interface src/match/presenter.js drives,
// built on the createDuel stage from createBoardScene. Cowboy slot i stands on
// stage.tiles[i] and Wizard slot i on stage.tiles[3 + i]. Billy and Wizard
// cards use the rigged models in the demo's idle poses, and the Sheriff uses
// its own model (src/render/sheriff.js). Mounted Billy, Skeleton and Dragon
// have no models yet, so they get labelled temporary tokens. Each troop has a
// procedural orb row and each Base has five.
//
// The cues are basic placeholders (task 8 refines Billy and Wizard). All
// motion runs through the injected epoch scheduler: scheduler.frame for
// motion, scheduler.after for keyframes and end states. scheduler.advance()
// therefore stops every cue. clear() cancels this board's entries and starts
// a new generation, so a callback from before it never acts.
//
// await createMatchBoard({models, scheduler, makeLabel}) resolves to:
//   scene, camera, stage, light (flash and rift point lights), effects, bases
//   renderer: reset(view), clear(), setTroopOrbs(side, slot, n), setBaseOrbs(side, n),
//     summon({side, slot, cardId, health}), attack({attacker, target}),
//     spell({spell, cardId, caster, target}), remove({side, slot}),
//     move({side, from, to}), highlight({cowboy, wizard}), pick(ndcX, ndcY)
//   helpers: resize(width, height), closeUp(side, slot, wide), piece(side, slot), pieces(),
//     targetPoint(target), animate(ms, step, done), at(ms, fn)
// Cue methods return their times in ms from the call (CUES).
import * as T from "three";
import {CARDS, SIDES} from "../game/cards.js";
import {SLOT_COUNT} from "../game/state.js";
import {attachPistol, attachStaff, createBoardScene, drawKeys, motion, staffKeys, v} from "./scene.js";
import {grip, pose, rigActor} from "./rig.js";
import {createBaseOrbs, createTroopOrbs} from "./orbs.js";
import {SHERIFF_HEIGHT, SHERIFF_LANDING, buildSheriff, idleSheriff, landSheriff} from "./sheriff.js";

export const CUES = Object.freeze({
  summon: Object.freeze({impact: 350, end: 600}),
  attack: Object.freeze({impact: 400, end: 800}),
  spell: Object.freeze({impact: 400, end: 700}),
  remove: Object.freeze({end: 500}),
  move: Object.freeze({end: 700}),
});

// Cards with a rigged model, and the heights the demo uses for them.
const RIGGED = {Billy: {kind: "billy", height: 1.93}, Wizard: {kind: "wizard", height: 2.02}, Sheriff: {kind: "sheriff", height: SHERIFF_HEIGHT}};
const FLASH = {cowboy: 0xffb95e, wizard: 0xc192ff};

// Shared geometry and materials; never disposed.
const UNIT = {
  pedestal: new T.CylinderGeometry(1, 1.1, 1, 28),
  body: new T.CylinderGeometry(.55, 1, 1, 24),
  head: new T.SphereGeometry(1, 20, 14),
  disc: new T.CylinderGeometry(1, 1, 1, 24),
  cone: new T.ConeGeometry(1, 1, 20),
  hit: new T.CylinderGeometry(1, 1, 1, 12),
  flash: new T.IcosahedronGeometry(1, 2),
  glow: new T.PlaneGeometry(1, 1),
};
const TOKEN = Object.fromEntries(SIDES.map((side) => {
  const [body, trim] = side === "cowboy" ? [0x9a6338, 0xeab979] : [0x5a3d82, 0xdfadef];
  return [side, {
    body: new T.MeshStandardMaterial({color: body, roughness: .62, metalness: .08}),
    trim: new T.MeshStandardMaterial({color: trim, roughness: .36, metalness: .42, emissive: trim, emissiveIntensity: .12}),
  }];
}));
const GLOW = Object.fromEntries(SIDES.map((side) => [side, new T.MeshBasicMaterial({
  color: side === "cowboy" ? 0xffc977 : 0xc89cff, transparent: true, opacity: .32,
  blending: T.AdditiveBlending, depthWrite: false, toneMapped: false,
})]));
const HIT = new T.MeshBasicMaterial();

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
const backOut = (x) => {
  const u = clamp01(x) - 1;
  return 1 + 2.7 * u ** 3 + 1.7 * u ** 2;
};

// Index into stage.tiles: Cowboy slot i is tile i, Wizard slot i is tile 3 + i.
export function tileIndex(side, slot) {
  if (!SIDES.includes(side) || !Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) {
    throw new RangeError(`no tile for ${side} slot ${slot}`);
  }
  return SIDES.indexOf(side) * SLOT_COUNT + slot;
}

// The default label: a canvas sprite in the browser. Without a document
// (Node), a plain Object3D that carries the text in userData.text.
export function makeTextLabel(text) {
  if (typeof document === "undefined") {
    const label = new T.Object3D();
    label.name = "label";
    label.userData.text = text;
    return label;
  }
  const canvas = document.createElement("canvas");
  const font = '600 30px "Instrument Sans", system-ui, sans-serif';
  let context = canvas.getContext("2d");
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + 32;
  canvas.height = 48;
  context = canvas.getContext("2d"); // resizing reset the context state
  context.font = font;
  context.fillStyle = "rgba(25,17,27,.86)";
  context.strokeStyle = "rgba(234,185,121,.8)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff0dd";
  context.textBaseline = "middle";
  context.fillText(text, 16, canvas.height / 2 + 1);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({map: texture, transparent: true, depthWrite: false, fog: false, toneMapped: false}));
  sprite.scale.set(.3 * canvas.width / canvas.height, .3, 1);
  sprite.name = "label";
  sprite.userData.text = text;
  return sprite;
}

// A temporary stand-in in faction colours, taller and wider for more stars.
function tokenModel(card, side) {
  const tall = .8 + .11 * card.stars, radius = .24 + .022 * card.stars, head = radius * .6;
  const look = TOKEN[side];
  const group = new T.Group();
  group.name = `${card.name} temporary token`;
  group.userData.temporary = true;
  const part = (geometry, material, width, height, y) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.scale.set(width, height, width);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const base = .09, body = tall * .5, neck = base + body, brim = neck + head * 1.5;
  part(UNIT.pedestal, look.trim, radius * 1.3, base, base / 2);
  part(UNIT.body, look.body, radius, body, base + body / 2);
  part(UNIT.head, look.body, head, head, neck + head * .8);
  if (side === "cowboy") {
    part(UNIT.disc, look.trim, head * 1.8, .035, brim);
    part(UNIT.disc, look.trim, head * .9, head * .75, brim + head * .375);
    return {group, height: brim + head * .75};
  }
  const hat = Math.max(.24, tall - brim);
  part(UNIT.cone, look.trim, head * 1.2, hat, brim + hat / 2);
  return {group, height: brim + hat};
}

export async function createMatchBoard({models, scheduler, makeLabel = makeTextLabel} = {}) {
  if (!models || !scheduler) throw new TypeError("createMatchBoard needs models and a scheduler");
  const {scene, camera, stage, light} = await createBoardScene(models);
  const group = new T.Group();
  group.name = "match-pieces";
  const effects = new T.Group();
  effects.name = "match-effects";
  scene.add(group, effects);

  const slots = Object.fromEntries(SIDES.map((side) => [side, Array(SLOT_COUNT).fill(null)]));
  const leaving = new Set(); // removed from their slot, still fading out
  const pickable = new Map(); // tile model or piece hitbox -> {side, slot}
  const pending = new Set(); // this generation's scheduler ids
  let generation = 0;

  const structures = {cowboy: stage.saloon, wizard: stage.gate};
  const bases = Object.fromEntries(SIDES.map((side) => [side, createBaseOrbs(side, structures[side])]));
  const basePoints = Object.fromEntries(SIDES.map((side) => [side, new T.Box3().setFromObject(structures[side]).getCenter(v())]));
  for (const side of SIDES) scene.add(bases[side].group);

  const glows = stage.tiles.map((tile, index) => {
    const size = new T.Box3().setFromObject(tile.model).getSize(v());
    const glow = new T.Mesh(UNIT.glow, GLOW[tile.faction]);
    glow.name = `${tile.faction}-tile-glow-${index % SLOT_COUNT}`;
    glow.rotation.x = -Math.PI / 2;
    glow.scale.set(size.x * .9, size.z * .88, 1);
    glow.position.set(tile.x, tile.top + .015, tile.z);
    glow.renderOrder = 1;
    glow.visible = false;
    scene.add(glow);
    pickable.set(tile.model, {side: tile.faction, slot: index % SLOT_COUNT});
    return glow;
  });

  const tilePoint = (side, slot) => {
    const tile = stage.tiles[tileIndex(side, slot)];
    return v(tile.x, tile.top, tile.z);
  };

  // fn after ms, unless clear() or a scheduler epoch change came first.
  function at(ms, fn) {
    const gen = generation, epoch = scheduler.epoch();
    const id = scheduler.after(ms, () => {
      pending.delete(id);
      if (gen === generation && epoch === scheduler.epoch()) fn();
    });
    pending.add(id);
    return id;
  }

  // step(u, elapsedMs) now with u = 0, then on every scheduler frame, and
  // with u = 1 at exactly ms through scheduler.after, followed by done().
  // The end state is therefore in place before any callback the caller
  // schedules for the same time.
  function animate(ms, step, done) {
    const gen = generation, epoch = scheduler.epoch();
    let elapsed = 0;
    step(0, 0);
    const frame = scheduler.frame((dt) => {
      if (gen !== generation || epoch !== scheduler.epoch()) {
        pending.delete(frame);
        return false;
      }
      elapsed = Math.min(ms, elapsed + dt);
      step(elapsed / ms, elapsed);
    });
    pending.add(frame);
    at(ms, () => {
      scheduler.cancel(frame);
      pending.delete(frame);
      step(1, ms);
      done?.();
    });
  }

  function build(side, slot, cardId) {
    const card = CARDS[cardId];
    if (card?.kind !== "troop" || card.side !== side) throw new TypeError(`"${cardId}" is not a ${side} troop card`);
    const root = new T.Group(), body = new T.Group();
    root.name = `${side}-piece-${slot}`;
    root.userData = {piece: true, side, slot, cardId};
    root.add(body);
    const piece = {side, slot, cardId, name: card.name, kind: "token", temporary: false, acting: false, root, body, height: 0,
      actor: null, gun: null, holster: null, staff: null, token: null, label: null, orbs: null, hitbox: null, owned: []};
    const rigged = RIGGED[card.name];
    if (rigged?.kind === "sheriff") {
      Object.assign(piece, buildSheriff(models), rigged);
      piece.owned.push(piece.actor.body.geometry, piece.actor.body.skeleton);
      // Breathes whenever it is drawn and no cue is posing it. Idle keeps no
      // scheduler entry, so it survives scheduler.advance() and never counts as pending.
      // The idle clock restarts after each cue, so the idle begins in the pose the cue ended in.
      let idleFrom = null;
      piece.actor.body.onBeforeRender = () => {
        const now = performance.now() / 1000;
        if (piece.acting) idleFrom = null;
        else idleSheriff(piece, now - (idleFrom ??= now));
      };
      body.add(piece.actor.root);
    } else if (rigged) {
      const actor = rigActor(models[rigged.kind], rigged.kind, rigged.height);
      piece.owned.push(actor.body.geometry, actor.body.skeleton);
      if (rigged.kind === "billy") {
        // Faces the Wizards with the revolver holstered, as in the demo's idle pose.
        actor.root.rotation.y = Math.PI;
        piece.gun = attachPistol(actor, models.revolver);
        pose(actor, {right: motion(drawKeys, .34, [-.13, .12, -.22])});
        piece.holster = grip(actor, "right");
        pose(actor, {});
        piece.gun.holder.position.copy(piece.holster);
        piece.gun.holder.rotation.set(1.38, -.15, .066);
      } else {
        piece.staff = attachStaff(actor);
        pose(actor, {spine: [.008, 0, 0], left: {goal: v(...staffKeys[0][1]), bend: .79, roll: [-1.475, .06, -.14]}});
        piece.staff.jewel.material.emissiveIntensity = .81;
        piece.staff.holder.traverse((node) => {
          if (node.isMesh) piece.owned.push(node.geometry, node.material);
        });
      }
      body.add(actor.root);
      Object.assign(piece, {kind: rigged.kind, actor, height: rigged.height});
    } else {
      const {group: token, height} = tokenModel(card, side);
      const label = makeLabel(`${card.name} - temporary token`);
      label.position.y = height + .55;
      label.traverse((node) => {
        for (const material of [node.material].flat()) {
          if (!material) continue;
          piece.owned.push(material);
          if (material.map) piece.owned.push(material.map);
        }
      });
      body.add(token, label);
      Object.assign(piece, {kind: "token", temporary: true, token, label, height});
    }
    piece.orbs = createTroopOrbs(side);
    piece.orbs.group.position.y = piece.height + .22;
    body.add(piece.orbs.group);
    piece.hitbox = new T.Mesh(UNIT.hit, HIT);
    piece.hitbox.name = "hitbox";
    piece.hitbox.visible = false;
    piece.hitbox.scale.set(.5, piece.height, .5);
    piece.hitbox.position.y = piece.height / 2;
    root.add(piece.hitbox);
    root.position.copy(tilePoint(side, slot));
    return piece;
  }

  function place(side, slot, cardId) {
    tileIndex(side, slot);
    if (slots[side][slot]) throw new Error(`${side} slot ${slot} is occupied`);
    const piece = build(side, slot, cardId);
    slots[side][slot] = piece;
    group.add(piece.root);
    pickable.set(piece.hitbox, piece);
    return piece;
  }

  function destroy(piece) {
    piece.root.removeFromParent();
    pickable.delete(piece.hitbox);
    leaving.delete(piece);
    for (const resource of piece.owned) resource.dispose();
    piece.owned.length = 0;
  }

  function occupant(side, slot, purpose) {
    const piece = slots[side]?.[slot];
    if (!piece) throw new Error(`no ${side} piece in slot ${slot} ${purpose}`);
    return piece;
  }

  function targetPoint(target) {
    if (target.kind === "base") {
      const point = basePoints[target.side];
      if (!point) throw new TypeError(`unknown side "${target.side}"`);
      return point.clone();
    }
    const piece = occupant(target.side, target.slot, "to target");
    return piece.root.position.clone().setY(piece.root.position.y + piece.height * .55);
  }

  // A short additive flash; removed and disposed when it ends or on clear().
  function effect(point, side, ms, step) {
    const mesh = new T.Mesh(UNIT.flash, new T.MeshBasicMaterial({color: FLASH[side], transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
    mesh.name = "effect";
    mesh.position.copy(point);
    effects.add(mesh);
    animate(ms, (u, elapsed) => step(mesh, elapsed), () => {
      mesh.removeFromParent();
      mesh.material.dispose();
    });
    return mesh;
  }

  function clear() {
    generation += 1;
    for (const id of pending) scheduler.cancel(id);
    pending.clear();
    for (const side of SIDES) {
      for (const piece of slots[side]) if (piece) destroy(piece);
      slots[side].fill(null);
    }
    for (const piece of [...leaving]) destroy(piece);
    for (const mesh of [...effects.children]) {
      mesh.removeFromParent();
      mesh.material.dispose();
    }
    for (const side of SIDES) bases[side].set(0);
    highlight({});
  }

  function reset(view) {
    clear();
    for (const side of SIDES) {
      const {board, baseOrbs} = view.sides[side];
      board.forEach((troop, slot) => {
        if (troop) place(side, slot, troop.cardId).orbs.set(troop.health);
      });
      bases[side].set(baseOrbs);
    }
  }

  function setTroopOrbs(side, slot, n) {
    occupant(side, slot, "for orbs").orbs.set(n);
  }

  function setBaseOrbs(side, n) {
    if (!bases[side]) throw new TypeError(`unknown side "${side}"`);
    bases[side].set(n);
  }

  // Drops in and scales up by impact; the Presenter shows the orbs at impact.
  function summon({side, slot, cardId}) {
    const piece = place(side, slot, cardId);
    if (piece.kind === "sheriff") {
      // Falls onto the tile, lands on bent knees at impact and straightens by end.
      piece.acting = true;
      animate(SHERIFF_LANDING.end, (u, ms) => {
        const {height, scale} = landSheriff(piece, ms);
        piece.body.position.y = height;
        piece.body.scale.setScalar(scale);
      }, () => {
        piece.acting = false;
      });
      return {...SHERIFF_LANDING};
    }
    const {impact, end} = CUES.summon;
    animate(end, (u, ms) => {
      piece.body.scale.setScalar(Math.max(.001, backOut(ms / impact)));
      piece.body.position.y = .6 * (1 - smooth(ms / impact));
    });
    return {...CUES.summon};
  }

  // Lunges toward the target (the opposing troop, or the Base when the lane
  // is empty), flashes there at impact and returns home by end.
  function attack({attacker, target}) {
    const piece = occupant(attacker.side, attacker.slot, "to attack");
    const {impact, end} = CUES.attack;
    const reach = targetPoint(target).sub(piece.root.position).setY(0);
    reach.setLength(Math.min(1, reach.length() * .3));
    animate(end, (u, ms) => {
      const k = ms <= impact ? smooth(ms / impact) : 1 - smooth((ms - impact) / (end - impact));
      piece.body.position.set(reach.x * k, 0, reach.z * k);
    });
    at(impact, () => effect(targetPoint(target), attacker.side, 260, (mesh, ms) => {
      const u = ms / 260;
      mesh.scale.setScalar(.45 * (.25 + .75 * u));
      mesh.material.opacity = .9 * (1 - u);
    }));
    return {...CUES.attack};
  }

  // A placeholder flash at the target in the caster's colour.
  function spell({caster, target}) {
    const {impact, end} = CUES.spell;
    effect(targetPoint({kind: "troop", side: target.side, slot: target.slot}), caster, end, (mesh, ms) => {
      const rise = smooth(ms / impact);
      mesh.scale.setScalar(.2 + .5 * rise);
      mesh.material.opacity = .85 * (ms <= impact ? rise : 1 - smooth((ms - impact) / (end - impact)));
    });
    return {...CUES.spell};
  }

  // The slot is free at once; the model sinks, fades and is gone at end.
  function remove({side, slot}) {
    const piece = occupant(side, slot, "to remove");
    slots[side][slot] = null;
    pickable.delete(piece.hitbox);
    leaving.add(piece);
    const faded = new Map(); // original material -> transparent copy owned by the piece
    piece.root.traverse((node) => {
      if (!node.material || !node.visible) return;
      const swap = (material) => {
        if (!faded.has(material)) {
          const copy = material.clone();
          copy.transparent = true;
          faded.set(material, copy);
          piece.owned.push(copy);
        }
        return faded.get(material);
      };
      node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
    });
    animate(CUES.remove.end, (u) => {
      piece.body.position.y = -.7 * smooth(u);
      for (const [original, copy] of faded) copy.opacity = original.opacity * (1 - smooth(u));
    }, () => destroy(piece));
    return {...CUES.remove};
  }

  // Arcs to the destination tile; the orbs travel with the model.
  function move({side, from, to}) {
    const piece = occupant(side, from, "to move");
    const goal = tilePoint(side, to);
    if (slots[side][to]) throw new Error(`${side} slot ${to} is occupied`);
    slots[side][from] = null;
    slots[side][to] = piece;
    piece.slot = to;
    piece.root.userData.slot = to;
    const start = piece.root.position.clone();
    animate(CUES.move.end, (u) => {
      if (u >= 1) return piece.root.position.copy(goal);
      const s = smooth(u);
      piece.root.position.lerpVectors(start, goal, s);
      piece.root.position.y += .9 * Math.sin(Math.PI * s);
    });
    return {...CUES.move};
  }

  // Glows exactly the listed tiles.
  function highlight({cowboy = [], wizard = []} = {}) {
    const lit = new Set([
      ...cowboy.map((slot) => tileIndex("cowboy", slot)),
      ...wizard.map((slot) => tileIndex("wizard", slot)),
    ]);
    glows.forEach((glow, index) => {
      glow.visible = lit.has(index);
    });
  }

  // The {side, slot} under a point in normalized device coordinates (x and y
  // from -1 to 1, y up), from tiles and standing pieces, or null.
  const raycaster = new T.Raycaster(), pointer = new T.Vector2();
  function pick(ndcX, ndcY) {
    scene.updateMatrixWorld();
    raycaster.setFromCamera(pointer.set(ndcX, ndcY), camera);
    for (const hit of raycaster.intersectObjects([...pickable.keys()], true)) {
      for (let node = hit.object; node; node = node.parent) {
        const found = pickable.get(node);
        if (found) return {side: found.side, slot: found.slot};
      }
    }
    return null;
  }

  // Same rule as the demo camera in src/main.js.
  function resize(width, height) {
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.fov = camera.aspect < 1 ? 59 : 40;
    camera.updateProjectionMatrix();
  }

  // Moves the camera in front of one tile, low enough to see the model's face.
  // `wide` views the whole lane from the side instead, so the attacker and
  // its target are both in frame.
  function closeUp(side, slot, wide = false) {
    const tile = tilePoint(side, slot), toward = -Math.sign(tile.z);
    if (wide) {
      camera.position.set(tile.x + (slot === SLOT_COUNT - 1 ? -5.6 : 5.6), tile.y + 2.3, tile.z + toward * 2);
      camera.lookAt(tile.x, tile.y + .75, tile.z + toward * 2);
    } else {
      camera.position.set(tile.x + 1.5, tile.y + 1.7, tile.z + toward * 3.3);
      camera.lookAt(tile.x, tile.y + .78, tile.z);
    }
    camera.updateMatrixWorld(true);
  }

  return {
    scene, camera, stage, light, effects, bases,
    reset, clear, setTroopOrbs, setBaseOrbs, summon, attack, spell, remove, move, highlight, pick,
    resize, closeUp,
    piece: (side, slot) => slots[side]?.[slot] ?? null,
    pieces: () => [...SIDES.flatMap((side) => slots[side].filter(Boolean)), ...leaving],
    targetPoint,
    animate,
    at,
  };
}
