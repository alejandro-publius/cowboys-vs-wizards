import * as T from "three";
import { typeOf } from "../../game/showdown/cards.js";
import { makeCardModel } from "./card-models.js";
import { zone } from "./layout.js";

const mounted = new Set(["cowboy-mounted-billy", "cowboy-outrider", "wizard-headless-horseman"]);
const heavy = new Set(["cowboy-covered-wagon", "wizard-bone-wall", "cowboy-gatling-crew"]);
const smooth = (v, a, b) => T.MathUtils.smoothstep(v, a, b);
const pulse = (v, a, b, c) => smooth(v, a, b) * (1 - smooth(v, b, c));
const ground = (mark) => new T.Vector3(...zone(mark.side, mark.at ?? "troop", mark.slot));

function body(cardId = "") {
  const id = typeOf(cardId);
  if (id.endsWith("-dragon")) return "dragon";
  if (id.endsWith("-wraith")) return "ghost";
  if (id === "wizard-skeleton") return "bone";
  if (mounted.has(id)) return "horse";
  if (heavy.has(id)) return "guard";
  return "foot";
}

export function createCombatEffects(parent, pawnAt, bases) {
  const effect = new T.Group();
  parent.add(effect);
  const shapes = {
    shard: new T.OctahedronGeometry(0.5),
    flame: new T.ConeGeometry(0.5, 1, 5),
    chip: new T.BoxGeometry(1, 1, 1),
    ring: new T.TorusGeometry(0.5, 0.034, 5, 24),
  };
  const palette = {
    gold: [0xffd27c, 0xffe3af, 0xcb7448],
    green: [0x91e48a, 0xc8f7a8, 0x9b7bb9],
    violet: [0xb38dd3, 0xe1b1e2, 0x795e9f],
    bone: [0xdccfb6, 0xf6e6ca, 0x9d9089],
  };
  const pool = Array.from({ length: 49 }, () => {
    const child = new T.Mesh(shapes.shard, new T.MeshBasicMaterial());
    child.visible = false;
    effect.add(child);
    return child;
  });
  let index = 0,
    prop,
    active,
    spare,
    discardSpare;
  const at = (mark, key, y = 1.0) => {
    const v = ground(mark);
    v.y = y;
    if (mark.at === "base") return bases[mark.side].anchor(v);
    const node = pawnAt(mark)?.rig?.[key];
    if (node?.getWorldPosition) return node.getWorldPosition(v);
    if (key === "muzzle") v.x += mark.side === "cowboy" ? 0.39 : -0.39;
    return v;
  };
  function dot(part, color, pos, w, h = w, d = w, rx = 0, ry = 0, rz = 0) {
    const n = pool[index++];
    if (!n) return;
    n.visible = true;
    n.geometry = shapes[part];
    n.material.color.setHex(color);
    n.position.copy(pos);
    n.scale.set(w, h, d);
    n.rotation.set(rx, ry, rz);
  }
  function flecks(point, t, colors, count = 7) {
    if (t < 0 || t > 0.34) return;
    for (let i = 0; i < count; i++) {
      const rad = (i + 1) * 2.4,
        drift = t * (0.35 + (i % 4) * 0.77),
        scale = 0.19 * (1 - t / 0.37);
      const v = point
        .clone()
        .add(
          new T.Vector3(
            Math.cos(rad) * drift,
            Math.sin(Math.PI * Math.min(1, t / 0.45)) * 0.27 + (i % 3) * drift * 0.2,
            Math.sin(rad) * drift,
          ),
        );
      dot(i % 3 ? "shard" : "chip", colors[i % 3], v, scale, scale * 0.72, scale, rad * t, rad, rad);
    }
  }
  function explode(point, t, colors, strength = 1) {
    if (t < 0 || t > 0.28) return;
    const k = Math.max(0.05, 1 - t / 0.28) * strength;
    dot("flame", colors[0], point, 0.41 * k, 0.57 * k, 0.45 * k, 0.17, t * 7, 0.4);
    dot("shard", colors[1], point.clone().add(new T.Vector3(0, 0.11, 0)), 0.26 * k, 0.34 * k, 0.256 * k);
    flecks(point, t, colors, 9);
  }
  function fly(a, b, t, y = 0) {
    const v = a.clone().lerp(b, T.MathUtils.clamp(t, 0, 1));
    v.y += Math.sin(Math.PI * T.MathUtils.clamp(t, 0, 1)) * y;
    return v;
  }
  function trail(a, b, t, colors, n = 9, spread = 0.4) {
    if (t < 0 || t > 1.42) return;
    for (let i = 0; i < n; i++) {
      const f = t - i * 0.066;
      if (f < 0 || f > 1) continue;
      const p = fly(a, b, f, Math.sin(i * 2) * 0.08);
      const w = 0.19 + Math.sin(i * 2.4) * 0.079 + spread * f;
      dot(i % 3 ? "shard" : "flame", colors[i % 3], p, w, w * 1.28, w * 0.8, i * 0.29, i, i * 0.27);
    }
  }
  function showProp(id, a, b, progress, path, dimensions) {
    if (!prop) {
      prop = makeCardModel(id, dimensions ?? { width: 1.79, height: 1.22, depth: 1.18 });
      effect.add(prop);
    }
    prop.visible = true;
    prop.position.copy(fly(a, b, progress, path));
  }
  function movePawn(token, x, y, z, tilt = 0, yaw = 0) {
    if (!token) return;
    token.model.position.set(0.0 + x, token.restY + y, -0.07 + z);
    token.model.rotation.z = tilt;
    token.model.rotation.y = yaw;
  }
  function react(token, t, defeated, dir, point) {
    if (!token || t < 0) return;
    const klass = body(token.id),
      impact = pulse(t, 0, 0.07, 0.37),
      falling = defeated ? smooth(t, 0.032, 0.31) : 0;
    switch (klass) {
      case "bone":
        movePawn(
          token,
          dir * 0.13 * impact,
          -0.24 * falling,
          -0.09 * impact,
          dir * (0.15 * impact + 1.18 * falling),
        );
        if (point) flecks(point, t, palette.bone, 5);
        break;
      case "horse":
        {
          const rider = token.model.getObjectByName("rider");
          if (rider) {
            rider.rotation.z = -dir * 0.17 * pulse(t, 0.06, 0.13, 0.43);
            rider.visible = !defeated || t < 0.12;
          }
          const flee = (token.side === "cowboy" ? -1 : 1) * 1.17 * falling;
          movePawn(
            token,
            dir * 0.22 * impact + flee,
            0.16 * impact,
            0,
            dir * 0.31 * impact,
            falling * (token.side === "cowboy" ? Math.PI : 0),
          );
        }
        break;
      case "guard":
        movePawn(token, 0, -0.2 * falling, 0, dir * (0.067 * impact + 0.23 * falling));
        break;
      case "dragon":
        token.rig?.pose({ recoil: impact, charge: falling * 0.61, time: 0 });
        movePawn(token, 0, -0.32 * falling, 0, dir * 0.25 * falling);
        break;
      case "ghost":
        token.model.scale.set(
          token.restScale * (1 - 0.2 * impact),
          token.restScale * (1 - 0.68 * falling),
          token.restScale,
        );
        movePawn(token, 0, -0.28 * falling, 0, dir * (0.12 * impact + 0.28 * falling));
        break;
      default:
        token.rig?.pose({ brace: impact, fall: falling, time: 0 });
        movePawn(
          token,
          dir * 0.27 * impact,
          -0.31 * falling,
          0,
          dir * (0.18 * impact + (token.rig ? 0 : 1.12 * falling)),
        );
    }
  }
  function teardown() {
    if (prop) effect.remove(prop);
    prop = null;
    if (spare) {
      effect.remove(spare.group);
      discardSpare?.(spare);
    }
    spare = null;
    active = null;
    for (const n of pool) n.visible = false;
  }
  return {
    clear: teardown,
    begin(beat, makeCameo, disposeCameo) {
      teardown();
      active = beat;
      discardSpare = disposeCameo;
      if (beat.fromTroop && !pawnAt(beat.from) && beat.from.slot !== undefined) {
        spare = makeCameo(beat.from, beat.fromTroop);
        effect.add(spare.group);
      }
    },
    frame(ms) {
      if (!active) return;
      const step = active,
        { kind, from, targets, contact } = step;
      const t = ms / 1000,
        edge = contact / 1000,
        age = t - edge;
      const actor = pawnAt(from) ?? spare;
      const target = targets[0],
        victim = pawnAt(target);
      const dir = from.side === "wizard" ? -1 : 1;
      const dragon = body(step.cardId) === "dragon";
      const colors = step.cardId?.startsWith("cowboy-") ? palette.gold : palette.green;
      index = 0;
      for (const piece of pool) piece.visible = false;
      if (prop) prop.visible = false;
      const a = at(from, kind === "breath" || kind === "sweep" ? "mouth" : "muzzle");
      const b = at(target, "hit", kind === "trap" ? 0.32 : 1.06);
      const origin = ground(from),
        ending = ground(target);
      const dx = ending.x - origin.x,
        dz = ending.z - origin.z;
      const easeHit = smooth(t, 0.09, edge);
      const recover = 1 - smooth(t, edge + 0.07, step.duration / 1000);
      switch (kind) {
        case "gun":
        case "shell":
        case "overflow": {
          const trigger = edge - 0.118;
          const power = Math.max(1, Math.min(6, step.damage ?? 1));
          const n = Math.min(power, 3);
          if (kind === "gun") {
            actor?.rig?.pose({
              aim: smooth(t, 0, 0.21) * recover,
              recoil: pulse(t, trigger, trigger + 0.035, trigger + 0.13),
              time: 0,
            });
            if (!actor?.rig)
              movePawn(
                actor,
                -dir * 0.15 * pulse(t, trigger, trigger + 0.04, trigger + 0.22),
                0.05 * easeHit,
                0,
                dir * 0.12 * pulse(t, 0.08, 0.19, 0.51),
              );
          }
          const muzzle = at(from, "muzzle", 0.98);
          for (let i = 0; i < n; i++) {
            const offset = (i - n + 1) * 0.043,
              f = (t - trigger - offset) / 0.118;
            if (f >= 0 && f <= 1)
              dot(
                "shard",
                palette.gold[i % 3],
                fly(muzzle, b, f, 0.04),
                0.49,
                0.119,
                0.128,
                0,
                -Math.atan2(dz, dx),
              );
          }
          if (Math.abs(t - trigger) < 0.043) explode(muzzle, Math.max(0, t - trigger), palette.gold, 0.86);
          if (step.blocked) {
            const slab = b.clone().add(new T.Vector3(-dir * 0.84, -0.48, 0));
            const arriving = (t - trigger - 0.071) / 0.122;
            if (arriving >= 0 && arriving <= 1)
              dot("shard", palette.gold[2], fly(muzzle, slab, arriving), 0.38, 0.094, 0.108);
            flecks(slab, t - trigger - 0.195, palette.bone, 4);
          }
          explode(b, age, palette.gold);
          break;
        }
        case "blade": {
          const reach = pulse(t, 0, edge, step.duration / 1000) * 0.84;
          movePawn(
            actor,
            dx * reach,
            0.18 * Math.sin(reach * Math.PI),
            dz * reach,
            -dir * 0.21 * easeHit * recover,
          );
          if (t > edge - 0.07 && age < 0.09)
            dot("ring", palette.bone[1], fly(a, b, 0.87, 0.23), 1.17, 1.17, 0.45, 0.17, dir * 0.4, t * 7);
          flecks(b, age, palette.bone);
          break;
        }
        case "ride": {
          const go = smooth(t, 0.17, edge),
            returning = smooth(t, edge + 0.11, step.duration / 1000);
          const run = go * (1 - returning);
          const lane = (returning > 0 ? -1.8 : 1.4) - origin.z;
          const swing = Math.sin(run * Math.PI);
          movePawn(
            actor,
            dx * 0.92 * run,
            0.25 * easeHit * Math.abs(Math.sin(t * 25)) * recover,
            dz * run + lane * swing,
            -dir * 0.29 * pulse(t, 0, 0.135, 0.34),
            dir * 0.24 * run,
          );
          if (run > 0.07 && run < 0.96)
            flecks(fly(origin, ending, run, 0.1), (0.32 * t) % 0.29, palette.bone, 4);
          explode(b, age, from.side === "cowboy" ? palette.gold : palette.violet);
          break;
        }
        case "breath":
        case "sweep": {
          const start = edge - 0.22;
          actor?.rig?.pose({
            charge: smooth(t, 0, start) * (1 - smooth(t, edge, edge + 0.19)),
            breath: pulse(t, start, edge, edge + 0.31),
            time: 0,
          });
          const mouth = at(from, "mouth", 1.31);
          targets.forEach((mark, i) => {
            const chest = at(mark, "hit", 1.09);
            const time = (t - start - (kind === "sweep" ? i * 0.046 : 0)) / 0.22;
            trail(mouth, chest, time, colors, kind === "sweep" ? 13 : 15, kind === "sweep" ? 0.55 : 0.31);
            explode(chest, age, colors, kind === "sweep" ? 0.71 : 1);
            if (age > 0.105 && age < 0.39) flecks(chest, age - 0.08, colors, 4);
          });
          break;
        }
        case "trap": {
          const hex = typeOf(step.cardId) === "wizard-hex";
          const sourcePoint = ground(from);
          sourcePoint.y = 0.19;
          const foot = ground(target);
          foot.y = 0.22;
          const lift = smooth(t, 0.12, edge);
          showProp(step.cardId, sourcePoint, hex ? sourcePoint : foot, lift, 0.31);
          if (hex) {
            dot("ring", palette.violet[0], foot, 1.37 * lift, 1.37 * lift, 0.2, Math.PI / 2, 0, t * 2.3);
            if (actor !== victim && step.stopped)
              movePawn(victim, 0, -0.038 * lift, 0, dir * 0.17 * lift * recover);
          } else explode(foot, age, palette.bone, 0.64);
          break;
        }
        case "lasso": {
          const ring = fly(a, b, smooth(t, 0.18, edge), 1.05);
          const torus = 1.42 - 0.41 * smooth(t, edge - 0.06, edge + 0.12);
          dot("ring", palette.gold[0], ring, torus, torus, 0.72, 1.1 + easeHit * 0.47, 0.1, t * 3.8);
          break;
        }
        case "hellfire":
          targets.forEach((mark, i) => {
            const chest = at(mark, "hit", 1.01);
            const sky = chest.clone().add(new T.Vector3(0, 2.14, 0));
            const c = i % 2 ? palette.green : palette.violet;
            trail(sky, chest, (t - (edge - 0.19)) / 0.19, c, 14, 0.22);
            explode(chest, age, c, 0.93);
          });
          break;
        case "vortex": {
          const drift = fly(a, b, smooth(t, 0.04, edge), 0.18);
          showProp(step.cardId, drift, drift, 1, 0, { width: 1.37, height: 1.11, depth: 0.89 });
          prop.rotation.y = t * 3.7;
          explode(b, age, palette.violet, 0.71);
          break;
        }
        case "laststand": {
          const spin = fly(a, b, smooth(t, 0.12, edge), 0.86);
          const pumpkin = step.cardId.startsWith("wizard-");
          dot(
            pumpkin ? "shard" : "chip",
            pumpkin ? 0xd88646 : 0xbd4934,
            spin,
            0.27,
            pumpkin ? 0.27 : 0.46,
            0.25,
            t * 10,
            0,
            t * 6,
          );
          if (spare) movePawn(actor, 0, -0.29 * smooth(t, 0.3, 0.66), 0, t * 0.36);
          explode(b, age, pumpkin ? palette.green : palette.gold, 1.12);
          break;
        }
        case "summon":
        case "raise": {
          const rise = smooth(t, edge, edge + 0.22);
          if (victim) movePawn(victim, 0, kind === "raise" ? -0.65 * (1 - rise) : 0.7 * (1 - rise), 0);
          flecks(
            ground(target).add(new T.Vector3(0, 0.17, 0)),
            age,
            kind === "raise" ? palette.violet : palette.bone,
            6,
          );
          break;
        }
        case "tribute":
        case "burn":
        case "set":
          dot(
            "chip",
            kind === "set" ? 0x493657 : palette.bone[0],
            fly(a, b, easeHit, 0.48),
            0.52,
            0.07,
            0.69,
            t * 7,
            dir * 0.31,
            t * 0.7,
          );
          break;
        default:
          flecks(b, age, from.side === "wizard" ? palette.violet : palette.gold, 5);
      }
      if (
        !["lasso", "summon", "raise", "cover", "set", "gear", "location", "tribute", "burn"].includes(kind) &&
        !(kind === "trap" && typeOf(step.cardId) === "wizard-hex")
      ) {
        for (const mark of targets) {
          const token = pawnAt(mark);
          const troop = mark.slot === undefined ? null : step.hit.sides[mark.side].board[mark.slot];
          react(token, age, troop?.health === 0, dir, at(mark, "hit", 0.93));
        }
      }
    },
  };
}
