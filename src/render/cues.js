// Orb Duel attack and spell cues for the match board (src/render/match-board.js).
// They replay the attack demo's procedural motion (src/render/scene.js) on the
// board's pieces:
//   Billy attack   the demo's draw and fire on the demo timeline (shot .77 s,
//                  impact .86 s, end 1.58 s): drawKeys, the revolver in the grip
//                  and aimed at the target, muzzle flash, tracer, impact sparks
//   Wizard attack  its own wind-up, thrust and recovery (src/render/wizard.js): the
//                  jewel charges, then a violet bolt leaves it at 0.9 s and bursts
//                  on the target (impact 1.1 s, end 1.6 s)
//   Sheriff attack its own draw, fire and recover (src/render/sheriff.js) with
//                  the same muzzle flash, tracer and sparks (impact 0.89 s, end 1.58 s)
//   token attack   the board's lunge
//   Deadeye        the leftmost Billy's shot, or a tracer from the Saloon
//   Firebolt       a staff ember or a bolt from the Wizard Gateway
//   Singularity    a dark well with a violet ring at the target while the
//                  leftmost Wizard piece, if there is one, casts with its staff
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
import {drawKeys, motion, timings, v} from "./scene.js";
import {reactToFire} from "./fire-reaction.js";
import {grip, pose} from "./rig.js";
import {SHERIFF_SHOT, SHERIFF_YAW, drawSheriff, idleSheriff} from "./sheriff.js";
import {WIZARD_CAST, castWizard, idleWizard} from "./wizard.js";

const ease = (from, to, value) => T.MathUtils.smoothstep(value, from, to);
const pulse = (t, from, peak, to) => ease(from, peak, t) * (1 - ease(peak, to, t));
const mix = T.MathUtils.lerp;
const toMs = (seconds) => Math.round(seconds * 1000);
const UP = v(0, 1, 0), FORWARD = v(0, 0, 1);

const VIOLET_BOLT = {
  halo: 0xc6a0ff, head: 0xb27dff, core: 0xf4e4ff, trail: 0x9c63ff,
  burst: 0xd9b8ff, ring: 0xdd9aff, sparks: [0xc89cff, 0xf3e2ff], lift: 0, impactSize: 1,
};
const FIRE_BOLT = {
  halo: 0xffa33d, head: 0xff632b, core: 0xffecb0, trail: 0xe74d1e,
  burst: 0xff8638, ring: 0xffae55, sparks: [0xff6726, 0xffcc68], lift: .32, impactSize: .65,
};

// Cue second at which the Saloon fires Deadeye when no Billy stands.
const SALOON_SHOT = .35;
const FIRE_REACTION_MS = 1020;
export const CUE_TIMES = Object.freeze({
  billy: Object.freeze({impact: toMs(timings.impact), end: toMs(timings.fireEnd)}),
  sheriff: Object.freeze({impact: toMs(SHERIFF_SHOT.impact), end: toMs(SHERIFF_SHOT.end)}),
  wizard: Object.freeze({impact: 1100, end: 1600}),
  saloon: Object.freeze({impact: toMs(SALOON_SHOT + timings.impact - timings.shot), end: 1000}),
  singularity: Object.freeze({impact: 800, end: 1200}),
});

// The board's idle poses, which are the demo's: Billy turned to face the
// Wizards with the revolver holstered, the Wizard with its staff at rest.
const BILLY_YAW = Math.PI;
const HOLSTERED = [1.38, -.15, .066];
const DRAW_ROLL = [-.13, .12, -.22];
// The farthest a piece turns toward a target outside its lane, in radians.
const MAX_TURN = 1.1;

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
  flame: new T.LatheGeometry([
    new T.Vector2(0, 0), new T.Vector2(.58, .04), new T.Vector2(.93, .23),
    new T.Vector2(.73, .48), new T.Vector2(.31, .76), new T.Vector2(0, 1),
  ], 8),
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

  // Charge at the staff jewel or the Gateway, then send a bolt to `contact`. The effects are sized to read from the board camera.
  function staffBolt(piece, contact, colors = VIOLET_BOLT, gateway) {
    const {impact, end} = CUE_TIMES.wizard, cast = WIZARD_CAST.bolt;
    const fx = cueEffects(board);
    const halo = fx.add("jewel-glow", GEOMETRY.glow, neon(colors.halo, 0));
    const head = fx.add("bolt", GEOMETRY.glow, neon(colors.head, .95));
    const core = fx.add("bolt", GEOMETRY.glow, neon(colors.core));
    const trail = fx.add("bolt-trail", GEOMETRY.trail, neon(colors.trail, .8));
    const burst = fx.add("bolt-burst", GEOMETRY.glow, neon(colors.burst, 0));
    const ring = fx.add("bolt-ring", GEOMETRY.ring, neon(colors.ring));
    const sparks = sparkSpray(fx, colors.sparks, 12, .45);
    const turn = piece ? turnToward(piece, 0, contact) : 0;
    const flight = impact / 1000 - cast.release;
    const jewel = piece ? v() : gateway.clone(), tail = v();
    let origin = null;
    if (piece) piece.acting = true;
    board.animate(end, (u, elapsed) => {
      const t = elapsed / 1000;
      const charge = piece
        ? castWizard(piece, t, turn, cast)
        : pulse(t, .06, .70, cast.release);
      if (piece) piece.staff.jewel.getWorldPosition(jewel);
      // The charge gathers at the jewel and flares as the bolt leaves it.
      const flare = pulse(t, cast.release - .04, cast.release + .02, cast.release + .16);
      halo.visible = charge > .01 || flare > .01;
      halo.position.copy(jewel);
      halo.scale.setScalar(.08 + .2 * charge + .15 * flare);
      halo.material.opacity = Math.min(1, .6 * charge + .8 * flare);
      if (origin === null && t >= cast.release) origin = jewel.clone();
      const progress = (t - cast.release) / flight;
      head.visible = core.visible = trail.visible = progress >= 0 && progress < 1;
      if (head.visible) {
        head.position.lerpVectors(origin, contact, progress);
        head.position.y += colors.lift * Math.sin(Math.PI * progress);
        head.scale.setScalar(.19 + .025 * Math.sin(t * 90));
        core.position.copy(head.position);
        core.scale.setScalar(.1);
        const tailProgress = Math.max(0, progress - .45);
        tail.lerpVectors(origin, contact, tailProgress);
        tail.y += colors.lift * Math.sin(Math.PI * tailProgress);
        span(trail, tail, head.position);
        trail.scale.x = trail.scale.z = 2.6;
      }
      const since = t - impact / 1000;
      burst.visible = since >= 0 && since < .22;
      if (burst.visible) {
        burst.position.copy(contact);
        burst.scale.setScalar(colors.impactSize * (.25 + 2.4 * since));
        burst.material.opacity = .9 * (1 - since / .22);
      }
      ring.visible = since >= 0 && since < .45;
      if (ring.visible) {
        ring.position.copy(contact);
        ring.quaternion.copy(board.camera.quaternion);
        ring.scale.setScalar(colors.impactSize * (.2 + .85 * ease(0, .45, since)));
        ring.material.opacity = .9 * (1 - since / .45);
      }
      sparks(since, contact, origin ?? jewel);
    }, () => {
      if (piece) {
        idleWizard(piece, 0);
        piece.acting = false;
      }
      fx.dispose();
    });
    return {...CUE_TIMES.wizard};
  }

  function fireAtFeet(ground, height, impact, end) {
    const fx = cueEffects(board);
    const amber = neon(0xff641c, 0), gold = neon(0xffd672, 0);
    const circle = fx.add("fire-ground", GEOMETRY.edge, neon(0xf58934, 0));
    circle.position.copy(ground).y += .018;
    circle.rotation.x = -Math.PI / 2;
    const size = T.MathUtils.clamp(height, .9, 1.7);
    const flames = Array.from({length: 6}, (_, i) => ({
      tongue: fx.add("fire-feet", GEOMETRY.flame, amber),
      core: fx.add("fire-core", GEOMETRY.flame, gold),
      angle: i * Math.PI / 3 + .18,
    }));
    board.animate(end, (u, elapsed) => {
      const t = elapsed - impact;
      const duration = end - impact;
      const strength = ease(0, 85, t) * (1 - ease(duration * .64, duration, t));
      circle.visible = strength > 0;
      circle.scale.setScalar(size * (.29 + .07 * ease(0, 250, t)));
      circle.material.opacity = .24 * strength;
      amber.opacity = .73 * strength;
      gold.opacity = .8 * strength;
      flames.forEach(({tongue, core, angle}, i) => {
        const wave = .8 + .2 * Math.sin(t * .033 + i * 1.7);
        const width = size * (.043 + .017 * wave);
        const reach = size * (.11 + .21 * wave) * Math.sqrt(strength);
        const radius = size * (.17 + .045 * (i % 2));
        tongue.position.copy(ground);
        tongue.position.x += radius * Math.cos(angle);
        tongue.position.z += radius * Math.sin(angle);
        tongue.position.y += .02;
        tongue.rotation.set(.25 * Math.sin(angle), 0, -.25 * Math.cos(angle));
        tongue.scale.set(width, reach, width);
        core.position.copy(tongue.position);
        core.rotation.copy(tongue.rotation);
        core.scale.set(width * .55, reach * .62, width * .55);
        tongue.visible = core.visible = strength > 0;
      });
    }, () => fx.dispose());
  }

  function firebolt(caster, target) {
    const wizard = leftmost(caster, "wizard");
    const gateway = wizard ? undefined : board.targetPoint({kind: "base", side: caster});
    const victim = board.piece(target.side, target.slot);
    const ground = victim.root.position.clone();
    const hit = ground.clone().setY(ground.y + .1);
    const cue = staffBolt(wizard, hit, FIRE_BOLT, gateway);
    const end = cue.impact + FIRE_REACTION_MS;
    fireAtFeet(ground, victim.height, cue.impact, end);
    reactToFire(board, victim, FIRE_REACTION_MS, cue.impact);
    return {impact: cue.impact, end};
  }

  // A dark well with a violet ring grows in front of the target and
  // collapses after the impact; the leftmost Wizard of `caster` casts it.
  function singularity(contact, caster) {
    const {impact, end} = CUE_TIMES.singularity;
    const wizard = leftmost(caster, "wizard");
    if (wizard) {
      const turn = turnToward(wizard, 0, contact);
      wizard.acting = true;
      board.animate(end, (u, elapsed) => castWizard(wizard, elapsed / 1000, turn, WIZARD_CAST.singularity), () => {
        idleWizard(wizard, 0);
        wizard.acting = false;
      });
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
    if (name !== "Deadeye" && name !== "Singularity" && name !== "Firebolt") return board.spell(event);
    if (name === "Firebolt") return firebolt(caster, target);
    const contact = board.targetPoint({kind: "troop", side: target.side, slot: target.slot});
    if (name === "Singularity") return singularity(contact, caster);
    const billy = leftmost(caster, "billy");
    return billy ? billyShot(billy, contact) : saloonShot(contact);
  }

  return {...board, attack, spell};
}
