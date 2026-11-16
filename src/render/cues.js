// Orb Duel attack and spell cues for the match board (src/render/match-board.js).
// They replay the attack demo's procedural motion (src/render/scene.js) on the
// board's pieces:
//   Billy attack   the demo's draw and fire on the demo timeline (shot .77 s,
//                  impact .86 s, end 1.58 s): drawKeys, the revolver in the grip
//                  and aimed at the target, muzzle flash, tracer, impact sparks
//   Wizard attack  a shortened demo staff raise (staffKeys) with the jewel
//                  glowing, then a violet bolt from the jewel (impact 1.1 s, end 1.6 s)
//   Sheriff attack its own draw, fire and recover (src/render/sheriff.js) with
//                  the same muzzle flash, tracer and sparks (impact 0.89 s, end 1.58 s)
//   token attack   the board's lunge
//   Deadeye        the leftmost Billy's shot, or a tracer from the Saloon
//   Singularity    a dark well with a violet ring at the target while the
//                  leftmost Wizard piece, if there is one, raises its staff
// A Billy or Wizard turns toward a target outside its lane (a Base) and back.
// The Presenter moves a Singularity survivor afterwards through move().
//
// All motion runs through board.animate and board.at, so board.clear() and
// scheduler.advance() cancel every cue. Each cue makes its own effect meshes
// in board.effects (shared geometry and materials of its own, so the attacks
// of a clash can overlap) and disposes them at its end; board.clear() removes
// and disposes them when it comes first. A finished cue leaves its piece in
// the board's idle pose.
//
// withCues(board) -> the board with attack() and spell() replaced. Both return
// {impact, end} in ms from the call: CUE_TIMES, or the board's CUES for tokens.
import * as T from "three";
import {SLOT_COUNT} from "../game/state.js";
import {drawKeys, motion, staffKeys, timings, v} from "./scene.js";
import {grip, pose} from "./rig.js";
import {SHERIFF_SHOT, SHERIFF_YAW, drawSheriff, idleSheriff} from "./sheriff.js";

const ease = (from, to, value) => T.MathUtils.smoothstep(value, from, to);
const pulse = (t, from, peak, to) => ease(from, peak, t) * (1 - ease(peak, to, t));
const mix = T.MathUtils.lerp;
const toMs = (seconds) => Math.round(seconds * 1000);
const UP = v(0, 1, 0), FORWARD = v(0, 0, 1);

// Cue second at which the Saloon fires Deadeye when no Billy stands.
const SALOON_SHOT = .35;
// Cue second at which the Wizard's bolt leaves the jewel.
const RELEASE = .9;

export const CUE_TIMES = Object.freeze({
  billy: Object.freeze({impact: toMs(timings.impact), end: toMs(timings.fireEnd)}),
  sheriff: Object.freeze({impact: toMs(SHERIFF_SHOT.impact), end: toMs(SHERIFF_SHOT.end)}),
  wizard: Object.freeze({impact: 1100, end: 1600}),
  saloon: Object.freeze({impact: toMs(SALOON_SHOT + timings.impact - timings.shot), end: 1000}),
  singularity: Object.freeze({impact: 800, end: 1200}),
});

// Cue second -> second of the demo's cast (staffKeys, chant and staff tip),
// piecewise linear. Both maps end at timings.castEnd, the idle staff pose.
const BOLT_CAST = [[0, 0], [.45, .55], [.7, 2.12], [RELEASE, 2.37], [1.1, 2.51], [1.6, timings.castEnd]];
const SINGULARITY_CAST = [[0, 0], [.4, .55], [.62, 2.12], [.8, 2.37], [1.2, timings.castEnd]];

// The board's idle poses, which are the demo's: Billy turned to face the
// Wizards with the revolver holstered, the Wizard with its staff at rest.
const BILLY_YAW = Math.PI;
const HOLSTERED = [1.38, -.15, .066];
const DRAW_ROLL = [-.13, .12, -.22];
const IDLE_GLOW = .81;
// The farthest a piece turns toward a target outside its lane, in radians.
const MAX_TURN = 1.1;

function remap(map, t) {
  const i = map.findIndex(([time]) => time >= t);
  if (i === 0) return map[0][1];
  if (i < 0) return map.at(-1)[1];
  const [t0, c0] = map[i - 1], [t1, c1] = map[i];
  return mix(c0, c1, (t - t0) / (t1 - t0));
}

// The yaw offset that turns a piece resting at `rest` toward a world point.
function turnToward(piece, rest, point) {
  const dx = point.x - piece.root.position.x, dz = point.z - piece.root.position.z;
  if (dx * dx + dz * dz < 1e-9) return 0;
  const offset = Math.atan2(dx, dz) - rest;
  return T.MathUtils.clamp(Math.atan2(Math.sin(offset), Math.cos(offset)), -MAX_TURN, MAX_TURN);
}

// Billy at second t of the demo's draw and fire, turned by `turn` and
// aiming at `aim`, a world point. createDuel's draw() without the flight.
function drawAndFire({actor, gun, holster}, t, turn, aim) {
  const anticipate = pulse(t, .03, .35, .65), kick = pulse(t, .77, .835, 1.06);
  actor.root.rotation.y = BILLY_YAW + turn * ease(.1, .55, t) * (1 - ease(1.19, 1.58, t));
  pose(actor, {
    spine: [.11 * anticipate - .13 * kick, -.15 * anticipate + .1 * kick, .065 * anticipate],
    chest: [.078 * anticipate - .18 * kick, .12 * anticipate, -.09 * kick],
    head: [.1 * anticipate, .07 * anticipate, 0],
    right: motion(drawKeys, t, DRAW_ROLL),
  });
  if (t < .34 || t > 1.37) {
    gun.holder.position.copy(holster);
    gun.holder.rotation.set(...HOLSTERED);
    return;
  }
  gun.holder.position.copy(grip(actor, "right"));
  const pitch = mix(1.38, -.08, ease(.34, .68, t)) - .43 * kick + 1.42 * ease(1.04, 1.37, t);
  gun.holder.rotation.set(pitch, -.15 * (1 - ease(.35, .65, t)), .066 * anticipate);
  if (t >= .666 && t <= .785) {
    const toward = actor.root.worldToLocal(aim.clone()).sub(gun.holder.position).normalize();
    gun.holder.quaternion.slerp(new T.Quaternion().setFromUnitVectors(FORWARD, toward), ease(.666, .765, t));
  }
}

function restBilly({actor, gun, holster}) {
  actor.root.rotation.y = BILLY_YAW;
  pose(actor, {});
  gun.holder.position.copy(holster);
  gun.holder.rotation.set(...HOLSTERED);
}

// The Wizard at second c of the demo's cast, turned by `turn`; createDuel's
// staff arm, chant and pull without the bullet reaction. Returns the chant,
// 0 to 1. At c = 0 and c >= timings.castEnd this is the idle pose.
function raiseStaff({actor, staff}, c, turn) {
  const chant = ease(.06, .47, c) * (1 - ease(2.43, 3.58, c));
  const pull = pulse(c, .55, 2.17, 2.42), tip = pulse(c, 2.23, 2.37, 2.82);
  const arm = motion(staffKeys, c, [0, 0, 0]) ?? {goal: v(...staffKeys[0][1]), bend: .79};
  arm.roll = [-1.475 + .45 * chant + .34 * tip, .06 + .22 * chant, -.14 - .19 * chant];
  actor.root.rotation.y = turn * ease(0, .55, c) * (1 - ease(2.51, timings.castEnd, c));
  pose(actor, {spine: [.008 + .12 * pull, .07 * pull, 0], chest: [.08 * pull, 0, .049 * pull], head: [-.13 * pull, 0, 0], left: arm});
  staff.jewel.material.emissiveIntensity = IDLE_GLOW + 2.7 * chant;
  return chant;
}

const restWizard = (piece) => raiseStaff(piece, 0, 0);

// Additive glow, like the demo's effect materials.
const neon = (color, opacity = 1) => new T.MeshBasicMaterial({color, transparent: true, opacity,
  blending: T.AdditiveBlending, depthWrite: false, toneMapped: false});

// Shared by every cue and never disposed; a cue owns only its materials.
const GEOMETRY = {
  flashCone: new T.ConeGeometry(.068, .195, 8).rotateX(Math.PI / 2).translate(0, 0, .084),
  flashCore: new T.IcosahedronGeometry(.053, 0),
  tracer: new T.CylinderGeometry(.012, .02, 1, 6),
  spark: new T.IcosahedronGeometry(.036, 0),
  glow: new T.IcosahedronGeometry(1, 2),
  trail: new T.CylinderGeometry(.03, .008, 1, 8),
  ring: new T.TorusGeometry(1, .03, 8, 64),
  edge: new T.TorusGeometry(1, .018, 7, 64),
  well: new T.SphereGeometry(1, 28, 18),
};

// One cue's effect meshes in board.effects, hidden until the cue shows them.
function cueEffects(board) {
  const meshes = [];
  return {
    add(name, geometry, material) {
      const mesh = new T.Mesh(geometry, material);
      mesh.name = `cue-${name}`;
      mesh.visible = false;
      board.effects.add(mesh);
      meshes.push(mesh);
      return mesh;
    },
    dispose() {
      for (const mesh of meshes) mesh.removeFromParent();
      for (const material of new Set(meshes.map((mesh) => mesh.material))) material.dispose();
      meshes.length = 0;
    },
  };
}

// Stretches a cylinder mesh (axis +y) from `from` to `to`.
function span(mesh, from, to) {
  const along = v().subVectors(to, from);
  mesh.position.lerpVectors(from, to, .5);
  mesh.scale.set(1, Math.max(.001, along.length()), 1);
  mesh.quaternion.setFromUnitVectors(UP, along.normalize());
}

// The demo's impact sparks: thrown back toward `from` and falling, `since`
// seconds after the impact at `contact`, gone after `life` seconds.
function sparkSpray(fx, [main, accent], count, life) {
  const materials = [neon(main), neon(accent)];
  const meshes = Array.from({length: count}, (_, i) => fx.add("spark", GEOMETRY.spark, materials[i % 3 === 0 ? 1 : 0]));
  const back = v(), side = v();
  return (since, contact, from) => {
    const live = since >= 0 && since < life;
    for (const mesh of meshes) mesh.visible = live;
    if (!live) return;
    back.subVectors(from, contact).setY(0);
    if (back.lengthSq() < 1e-9) back.copy(FORWARD);
    back.normalize();
    side.set(back.z, 0, -back.x);
    for (const material of materials) material.opacity = .86 * (1 - since / life);
    meshes.forEach((mesh, i) => {
      const angle = i * 2.4, speed = .63 + (i % 6) * .13;
      mesh.position.copy(contact)
        .addScaledVector(side, Math.sin(angle) * since * speed)
        .addScaledVector(UP, Math.cos(angle) * since * speed - 1.7 * since ** 2)
        .addScaledVector(back, .07 + since * (i % 3) * .14);
      mesh.scale.setScalar(1.05 - since);
    });
  };
}

// One revolver shot at second t of the demo's timeline: the muzzle flash at
// `muzzle`, the tracer from `origin` to `contact`, then sparks at `contact`.
function shotEffects(fx) {
  const cone = fx.add("muzzle-flash", GEOMETRY.flashCone, neon(0xffe2ac));
  const core = fx.add("muzzle-flash", GEOMETRY.flashCore, neon(0xffa44a));
  const tracer = fx.add("tracer", GEOMETRY.tracer, neon(0xffb95e));
  const sparks = sparkSpray(fx, [0xffd279, 0xd28cff], 16, .51);
  const first = v(), last = v();
  return (t, {muzzle, quaternion, origin, contact}) => {
    const flash = pulse(t, .762, .795, .865), size = .62 + flash * .92;
    for (const mesh of [cone, core]) {
      mesh.visible = flash > .001;
      mesh.position.copy(muzzle);
      mesh.quaternion.copy(quaternion);
    }
    cone.scale.setScalar(size);
    core.scale.set(1.52 * size, 1.24 * size, size);
    tracer.visible = t >= timings.shot && t < .925;
    if (tracer.visible) {
      const travel = ease(timings.shot, timings.impact, t);
      first.lerpVectors(origin, contact, Math.max(0, travel - .7) + .52 * ease(.86, .93, t));
      last.lerpVectors(origin, contact, travel);
      span(tracer, first, last);
      tracer.material.opacity = .93 * (1 - ease(.85, .925, t));
    }
    sparks(t - timings.impact, contact, origin);
  };
}

// A point just outside the Saloon on the side facing `contact`, at its upper storey.
function saloonMuzzle(saloon, contact) {
  const box = new T.Box3().setFromObject(saloon);
  const center = box.getCenter(v()), size = box.getSize(v());
  const out = v(contact.x - center.x, 0, contact.z - center.z).normalize();
  return center.setY(box.min.y + .62 * size.y).addScaledVector(out, .5 * Math.hypot(size.x, size.z));
}

export function withCues(board) {
  if (typeof board?.animate !== "function" || !board.effects) throw new TypeError("withCues needs a match board");

  function leftmost(side, kind) {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const piece = board.piece(side, slot);
      if (piece?.kind === kind) return piece;
    }
    return null;
  }

  // A piece with a revolver draws and fires at `contact`, a world point.
  // `fired` is the cue second of its shot; the effects run on the demo's shot timeline.
  function revolverShot(piece, contact, {yaw, times, fired, draw, rest}) {
    const fx = cueEffects(board);
    const shot = shotEffects(fx);
    const turn = turnToward(piece, yaw, contact);
    const muzzle = v(), quaternion = new T.Quaternion();
    let origin = null;
    piece.acting = true;
    board.animate(times.end, (u, elapsed) => {
      const t = elapsed / 1000;
      draw(piece, t, turn, contact);
      piece.gun.tip.getWorldPosition(muzzle);
      piece.gun.holder.getWorldQuaternion(quaternion);
      if (origin === null && t >= fired) origin = muzzle.clone();
      shot(t + timings.shot - fired, {muzzle, quaternion, origin: origin ?? muzzle, contact});
    }, () => {
      rest(piece);
      piece.acting = false;
      fx.dispose();
    });
    return {...times};
  }
  const billyShot = (piece, contact) => revolverShot(piece, contact,
    {yaw: BILLY_YAW, times: CUE_TIMES.billy, fired: timings.shot, draw: drawAndFire, rest: restBilly});
  // The Sheriff's own draw, fire and recover (src/render/sheriff.js).
  const sheriffShot = (piece, contact) => revolverShot(piece, contact,
    {yaw: SHERIFF_YAW, times: CUE_TIMES.sheriff, fired: SHERIFF_SHOT.shot, draw: drawSheriff, rest: (resting) => idleSheriff(resting, 0)});

  // Deadeye with no Billy on the board: the shot comes from the Saloon.
  function saloonShot(contact) {
    const fx = cueEffects(board);
    const shot = shotEffects(fx);
    const origin = saloonMuzzle(board.stage.saloon, contact);
    const quaternion = new T.Quaternion().setFromUnitVectors(FORWARD, v().subVectors(contact, origin).normalize());
    const shift = timings.shot - SALOON_SHOT; // cue seconds -> the demo's shot timeline
    board.animate(CUE_TIMES.saloon.end, (u, elapsed) => {
      shot(elapsed / 1000 + shift, {muzzle: origin, quaternion, origin, contact});
    }, () => fx.dispose());
    return {...CUE_TIMES.saloon};
  }

  // The Wizard raises its staff and sends a violet bolt from the jewel to `contact`.
  function staffBolt(piece, contact) {
    const {impact, end} = CUE_TIMES.wizard;
    const fx = cueEffects(board);
    const halo = fx.add("jewel-glow", GEOMETRY.glow, neon(0xc6a0ff, 0));
    const head = fx.add("bolt", GEOMETRY.glow, neon(0xb27dff, .95));
    const core = fx.add("bolt", GEOMETRY.glow, neon(0xf4e4ff));
    const trail = fx.add("bolt-trail", GEOMETRY.trail, neon(0x9c63ff, .8));
    const ring = fx.add("bolt-ring", GEOMETRY.ring, neon(0xdd9aff));
    const sparks = sparkSpray(fx, [0xc89cff, 0xf3e2ff], 12, .45);
    const turn = turnToward(piece, 0, contact);
    const flight = impact / 1000 - RELEASE;
    const jewel = v(), tail = v();
    let origin = null;
    board.animate(end, (u, elapsed) => {
      const t = elapsed / 1000;
      const chant = raiseStaff(piece, remap(BOLT_CAST, t), turn);
      piece.staff.jewel.getWorldPosition(jewel);
      halo.visible = chant > .01;
      halo.position.copy(jewel);
      halo.scale.setScalar(.05 + .12 * chant);
      halo.material.opacity = .55 * chant;
      if (origin === null && t >= RELEASE) origin = jewel.clone();
      const progress = (t - RELEASE) / flight;
      head.visible = core.visible = trail.visible = progress >= 0 && progress < 1;
      if (head.visible) {
        head.position.lerpVectors(origin, contact, progress);
        head.scale.setScalar(.085 + .012 * Math.sin(t * 90));
        core.position.copy(head.position);
        core.scale.setScalar(.045);
        span(trail, tail.lerpVectors(origin, contact, Math.max(0, progress - .35)), head.position);
      }
      const since = t - impact / 1000;
      ring.visible = since >= 0 && since < .45;
      if (ring.visible) {
        ring.position.copy(contact);
        ring.quaternion.copy(board.camera.quaternion);
        ring.scale.setScalar(.12 + .5 * ease(0, .45, since));
        ring.material.opacity = .85 * (1 - since / .45);
      }
      sparks(since, contact, origin ?? jewel);
    }, () => {
      restWizard(piece);
      fx.dispose();
    });
    return {...CUE_TIMES.wizard};
  }

  // A dark well with a violet ring grows in front of the target and
  // collapses after the impact; the leftmost Wizard of `caster` raises its staff.
  function singularity(contact, caster) {
    const {impact, end} = CUE_TIMES.singularity;
    const wizard = leftmost(caster, "wizard");
    if (wizard) {
      const turn = turnToward(wizard, 0, contact);
      board.animate(end, (u, elapsed) => raiseStaff(wizard, remap(SINGULARITY_CAST, elapsed / 1000), turn),
        () => restWizard(wizard));
    }
    const fx = cueEffects(board);
    const hole = fx.add("well", GEOMETRY.well, new T.MeshBasicMaterial({color: 0x030108, toneMapped: false}));
    const ring = fx.add("well-ring", GEOMETRY.ring, neon(0xdd9aff, .9));
    const edge = fx.add("well-edge", GEOMETRY.edge, neon(0xffad58, .65));
    const wave = fx.add("well-wave", GEOMETRY.ring, neon(0xc192ff));
    // In the target's lane, toward the middle of the board.
    const center = contact.clone().add(v(0, .1, -.62 * Math.sign(contact.z)));
    for (const mesh of [hole, ring, edge, wave]) mesh.position.copy(center);
    edge.rotation.set(-1.05, 0, .16);
    board.animate(end, (u, elapsed) => {
      const t = elapsed / 1000;
      const size = ease(.05, impact / 1000, t) * (1 - ease(.86, 1.15, t));
      hole.visible = ring.visible = edge.visible = size > .001;
      hole.scale.setScalar(.34 * size * (1 + .06 * Math.sin(t * 14) ** 2));
      ring.quaternion.copy(board.camera.quaternion);
      ring.scale.setScalar(.47 * size);
      edge.scale.setScalar(.66 * size);
      const since = t - impact / 1000;
      wave.visible = since >= 0 && since < .3;
      if (wave.visible) {
        wave.quaternion.copy(board.camera.quaternion);
        wave.scale.setScalar(.45 + since / .3);
        wave.material.opacity = .85 * (1 - since / .3);
      }
    }, () => fx.dispose());
    return {...CUE_TIMES.singularity};
  }

  function attack(event) {
    const piece = board.piece(event.attacker.side, event.attacker.slot);
    if (piece?.kind === "billy") return billyShot(piece, board.targetPoint(event.target));
    if (piece?.kind === "sheriff") return sheriffShot(piece, board.targetPoint(event.target));
    if (piece?.kind === "wizard") return staffBolt(piece, board.targetPoint(event.target));
    return board.attack(event);
  }

  function spell(event) {
    const {spell: name, caster, target} = event;
    if (name !== "Deadeye" && name !== "Singularity") return board.spell(event);
    const contact = board.targetPoint({kind: "troop", side: target.side, slot: target.slot});
    if (name === "Singularity") return singularity(contact, caster);
    const billy = leftmost(caster, "billy");
    return billy ? billyShot(billy, contact) : saloonShot(contact);
  }

  return {...board, attack, spell};
}
