import * as T from "three";
import { typeOf } from "../../game/showdown/cards.js";
import { makeCardModel } from "./card-models.js";
import { zone } from "./layout.js";
import { createHellfireColumns } from "./hellfire-columns.js";

const mounted = new Set(["cowboy-mounted-billy", "cowboy-outrider", "wizard-headless-horseman"]);
const heavy = new Set(["cowboy-covered-wagon", "wizard-bone-wall", "cowboy-gatling-crew"]);
const smooth = (v, a, b) => T.MathUtils.smoothstep(v, a, b);
const pulse = (v, a, b, c) => smooth(v, a, b) * (1 - smooth(v, b, c));
const ground = (mark) => new T.Vector3(...zone(mark.side, mark.at ?? "troop", mark.slot));
const axis = new T.Vector3(1, 0, 0);
const powder = [0x6e5664, 0x987375, 0xcaa08a];
const gunShapes = {
  "cowboy-sheriff": { width: 0.21, burst: 1.25, shots: 1, glow: 0xffb657 },
  "cowboy-billy": { width: 0.14, burst: 0.81, shots: 2, glow: 0xffdb99 },
  "cowboy-mounted-billy": { width: 0.15, burst: 0.89, shots: 2, glow: 0xf7b467 },
  "cowboy-outrider": { width: 0.11, burst: 0.73, shots: 1, glow: 0xffd8a0 },
  "cowboy-ranger": { width: 0.13, burst: 0.77, shots: 1, glow: 0xfff0bd },
  "cowboy-gatling-crew": { width: 0.14, burst: 0.9, shots: 3, glow: 0xf89f59 },
};

function body(cardId = "") {
  const id = typeOf(cardId);
  if (id.endsWith("-dragon")) return "dragon";
  if (id.endsWith("-wraith")) return "ghost";
  if (id === "wizard-skeleton") return "bone";
  if (mounted.has(id)) return "horse";
  if (heavy.has(id)) return "guard";
  return "foot";
}

export function createCombatEffects(parent, pawnAt, bases, camera) {
  const effect = new T.Group();
  parent.add(effect);
  const hellfire = createHellfireColumns(effect, camera);
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
  const lens = new T.Group();
  const disc = new T.CircleGeometry(1, 28);
  for (const [color, radius, depth] of [[0x493975, 1.13, 0], [0xc6a5f1, 1.04, 0.015], [0x080611, 1, 0.035]]) {
    const layer = new T.Mesh(disc, new T.MeshBasicMaterial({color, side: T.DoubleSide}));
    layer.position.z = depth;
    layer.scale.setScalar(radius);
    lens.add(layer);
  }
  lens.visible = false;
  effect.add(lens);
  const pool = Array.from({ length: 148 }, () => {
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
    const actor = pawnAt(mark);
    const node = actor?.rig?.[key] ?? actor?.model?.getObjectByName(key);
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
    return n;
  }
  function bar(from, to, color, width) {
    const path = to.clone().sub(from);
    const length = path.length();
    if (length < 0.015) return;
    const mark = dot("chip", color, from.clone().lerp(to, 0.5), length + width, width, width);
    mark?.quaternion.setFromUnitVectors(axis, path.normalize());
  }
  function tracer(from, to, progress, width, color, reach = 0.15) {
    if (progress < 0 || progress > 1.17) return;
    const tail = fly(from, to, progress - reach);
    const head = fly(from, to, progress);
    for (let i = 0; i < 4; i++) {
      const start = tail.clone().lerp(head, i / 4),
        end = tail.clone().lerp(head, (i + 1) / 4);
      bar(start, end, color, width * (0.45 + i * 0.23));
    }
    const rim = new T.Vector3(0, width * 0.51, width * 0.44);
    bar(tail.clone().lerp(head, 0.51).add(rim), head.clone().add(rim), 0xffedc2, width * 0.42);
  }
  function gunFlash(point, target, age, power) {
    if (age < 0 || age > 0.34) return;
    const f = 1 - smooth(age, 0.05, 0.16);
    if (f > 0) {
      const end = point.clone().lerp(target, 0.088 * power * f);
      bar(point, end, 0xffc578, 0.34 * f * power);
      bar(point, end.clone().lerp(point, 0.22), 0xffedc2, 0.21 * f * power);
      for (let i = -1; i <= 1; i++) {
        const tip = end
          .clone()
          .lerp(point, 0.49)
          .add(new T.Vector3(0, i * 0.43 * f, i * 0.31));
        bar(point, tip, 0xe99b58, 0.16 * f * power);
      }
    }
    for (let i = 0; i < 5; i++) {
      const t = age - i * 0.025;
      if (t < 0.04 || t > 0.28) continue;
      const center = point.clone().add(new T.Vector3((i - 2) * t * 0.78, t * (1.4 + i * 0.39), t * (i - 2)));
      const size = (0.12 + t * 0.56) * (1 - smooth(t, 0.22, 0.29));
      dot("chip", powder[i % 3], center, size, size * 0.85, size, 0, 0, i * 0.3);
    }
  }
  function impactSparks(point, age, shades, size = 1) {
    if (age < 0 || age > 0.37) return;
    const f = 1 - smooth(age, 0.03, 0.34);
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      const reach = size * (0.14 + age * (1.6 + i * 0.27));
      const tip = point
        .clone()
        .add(new T.Vector3(Math.cos(angle) * reach, Math.sin(angle) * reach, 0.28 * i * age));
      bar(point.clone().lerp(tip, 0.48 + age), tip, shades[i % 3], (0.061 + 0.078 * f) * size);
    }
  }
  function cut(point, dir, age, shades, power = 1) {
    if (age < -0.1 || age > 0.2) return;
    const wipe = smooth(age, -0.1, 0.07);
    const width = (1 - smooth(age, 0.025, 0.2)) * power;
    const slash = point.clone().add(new T.Vector3(-dir * 0.39, 0.36, 0.39));
    for (let i = 0; i < 6; i++) {
      if (i / 7 > wipe) break;
      const start = i / 6,
        end = (i + 1) / 6;
      const pos = (n) =>
        slash
          .clone()
          .add(new T.Vector3(dir * (1.58 * n - 0.58) * power, (0.66 - n * n * 1.1) * power, n * 0.13));
      bar(pos(start), pos(end), shades[i % 3], (0.09 + 0.17 * (1 - i / 6)) * width);
    }
    impactSparks(point, age, shades, 0.72 * power);
  }
  function coals(point, age, shades, scale = 1) {
    if (age < 0 || age > 0.51) return;
    for (let i = 0; i < 13; i++) {
      const lift = age - (i % 4) * 0.035;
      if (lift < 0 || lift > 0.39) continue;
      const angle = i * 2.399;
      const radius = scale * (0.23 + lift * (1 + i * 0.1));
      const pos = point
        .clone()
        .add(
          new T.Vector3(
            Math.cos(angle) * radius,
            (0.04 + lift * ((i % 5) + 0.8)) * scale,
            Math.sin(angle) * radius,
          ),
        );
      const w = scale * 0.22 * (1 - smooth(lift, 0.08, 0.4));
      dot("chip", shades[i % 3], pos, w, w * (1.4 + (i % 4) * 0.34), w);
    }
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
  function dynamiteAttack(actor, from, target, t, edge, dir) {
    const release = edge - 0.50;
    const age = t - edge;
    const windup = pulse(t, 0.03, release - 0.10, release);
    const throwPose = pulse(t, release - 0.10, release, release + 0.28);
    movePawn(actor, dir * (0.30 * throwPose - 0.26 * windup), 0, 0.08 * windup, dir * (0.30 * windup - 0.22 * throwPose));
    const held = actor?.model?.getObjectByName("held-dynamite");
    if (held) held.visible = t < release || age > 0.54;
    const fuse = at(from, "fuse", 1.8);
    if (t < release) {
      const glow = 0.21 + 0.07 * Math.sin(t * 62);
      dot("shard", 0xffedbb, fuse, glow, glow * 1.25, glow);
      flecks(fuse, t % 0.32, palette.gold, 7);
      return;
    }

    const impact = ground(target);
    impact.y = target.at === "base" ? 0.47 : 0.30;
    impact.x -= 0.78 * dir;
    if (age < 0) {
      const start = at(from, "throw", 1.53);
      const progress = (t - release) / (edge - release);
      const stick = fly(start, impact, progress, 2.22);
      const angle = -Math.PI * (0.17 + progress * 2.8);
      const tip = stick.clone().add(new T.Vector3(-0.36 * Math.sin(angle), 0.36 * Math.cos(angle), 0));
      dot("chip", 0xa63b33, stick, 0.24, 0.61, 0.24, 0, 0, angle);
      dot("chip", 0xe7a050, stick, 0.255, 0.16, 0.255, 0, 0, angle);
      bar(stick.clone().lerp(tip, 0.7), tip, 0xffba60, 0.09);
      dot("shard", 0xffedbb, tip, 0.22);
      for (let i = 1; i <= 6 && i * 0.041 < progress; i++) {
        const ember = fly(start, impact, progress - i * 0.041, 2.22);
        ember.z += 0.12 * Math.sin(t * 20 + i);
        dot("chip", i < 3 ? 0xffbe65 : powder[i % 3], ember, 0.19 - i * 0.016);
      }
      return;
    }
    const flash = 1 - smooth(age, 0.06, 0.26);
    if (flash > 0.015) {
      const burst = 0.52 + smooth(age, 0, 0.11) * 0.63;
      for (let i = 0; i < 9; i++) {
        const angle = i * 2.399;
        const pos = impact.clone().add(new T.Vector3(Math.cos(angle) * burst, 0.42 + i % 3 * 0.33, Math.sin(angle) * burst));
        const color = [0xb84731, 0xf58c43, 0xffd886][i % 3];
        dot("chip", color, pos, 0.56 * flash, (0.84 + i % 3 * 0.19) * flash, 0.57 * flash, 0.16, angle, i * 0.53);
      }
      dot("shard", 0xfff2bd, impact.clone().add(new T.Vector3(0, 0.77, 0)), 0.95 * flash, 1.55 * flash, 0.93 * flash);
    }
    const spread = 0.61 + age * 5.7;
    const fade = 1 - smooth(age, 0.20, 0.55);
    if (fade <= 0) return;
    for (let i = 0; i < 19; i++) {
      const angle = i * 2.399;
      const reach = spread * (0.43 + i % 5 * 0.16);
      const chip = impact.clone().add(new T.Vector3(Math.cos(angle) * reach,
        Math.max(0, age * (3.4 + i % 4) - age * age * 8.6), Math.sin(angle) * reach));
      const size = (0.16 + i % 4 * 0.09) * fade;
      dot("chip", i % 4 === 0 ? 0xffb960 : powder[i % 3], chip, size, size * 0.85, size, age * 7, angle, age * 5);
    }
    const shock = 1 - smooth(age, 0.12, 0.34);
    if (shock > 0) {
      dot("ring", 0xf1b66b, impact, spread * 2.16, spread * 2.16, shock, Math.PI / 2);
      impactSparks(impact, age, palette.gold, 1.85);
    }
  }
  function crankGatling(actor, from, target, t, start, edge) {
    const pivot = actor?.model?.getObjectByName("gatling-pivot");
    const barrels = actor?.model?.getObjectByName("gatling-barrels");
    const ready = smooth(t, 0.04, start) * (1 - smooth(t, edge + 0.09, edge + 0.37));
    if (pivot) {
      const offset = target.clone().sub(pivot.getWorldPosition(new T.Vector3()));
      pivot.rotation.y = -Math.atan2(offset.z, offset.x) * ready;
    }
    if (barrels) barrels.rotation.x = 1.7 * smooth(t, 0.02, start) + 7.5 * smooth(t, start, edge + 0.20);
    return actor?.model?.getObjectByName("muzzle")?.getWorldPosition(new T.Vector3()) ?? at(from, "muzzle", 1.08);
  }
  function lassoAttack(actor, victim, from, ending, target, t, edge, duration) {
    const cast = smooth(t, 0.06, edge);
    const tug = pulse(t, edge, edge + 0.15, duration - 0.04);
    actor?.rig?.pose({ brace: 0.50 * tug, time: 0 });
    const source = at(from, "rope-grip", 1.18);
    const pull = source.clone().sub(ending).setY(0).normalize().multiplyScalar(0.71 * tug);
    movePawn(victim, pull.x, 0.09 * tug, pull.z, 0.24 * tug);
    const center = fly(source, target, cast, 1.27).add(pull);
    const close = smooth(t, edge - 0.06, edge + 0.14);
    const fade = 1 - smooth(t, duration - 0.18, duration - 0.025);
    const loop = (0.74 + 1.32 * Math.sin(cast * Math.PI / 2) - 1.05 * close) * fade;
    const tilt = 0.62 + close * 0.94;
    if (loop <= 0.01) return;
    dot("ring", 0x774633, center, loop, loop, 1.85, tilt, -0.28, t * 3);
    dot("ring", 0xe5b36f, center.clone().add(new T.Vector3(0, 0.042, 0.026)), loop, loop, 1.3, tilt, -0.28, t * 3);
    const knot = center.clone().add(new T.Vector3(-loop / 2, -0.08, 0));
    dot("chip", 0xe5b36f, knot, 0.16 * fade, 0.19 * fade, 0.19 * fade, 0.4, 0, t);
    const slack = 0.38 * (1 - close) * Math.sin(cast * Math.PI);
    for (let i = 0; i < 14; i++) {
      const start = fly(source, knot, i / 14, -slack);
      const end = fly(source, knot, (i + 1) / 14, -slack);
      bar(start, end, i % 2 ? 0xc18a54 : 0xf0c080, 0.098 * fade);
    }
    flecks(ending.clone().add(new T.Vector3(0, 0.30, 0)), t - edge - 0.06, palette.bone, 5);
  }
  function react(token, t, defeated, dir, point) {
    if (!token || t < 0) return;
    const klass = body(token.id),
      impact = pulse(t, 0, 0.07, 0.37),
      falling = defeated ? smooth(t, 0.032, 0.31) : 0;
    switch (klass) {
      case "bone": {
        const skull = token.model.getObjectByName("skull");
        if (skull) {
          skull.position.set(dir * (0.12 * impact + 0.37 * falling), -0.65 * falling, 0.31 * falling);
          skull.rotation.z = dir * 0.79 * falling;
        }
        movePawn(
          token,
          dir * 0.13 * impact,
          -0.24 * falling,
          -0.09 * impact,
          dir * (0.15 * impact + 1.18 * falling),
        );
        if (point) flecks(point, t, palette.bone, 5);
        break;
      }
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
  function singularity(step, t, edge) {
    const {from, targets} = step;
    const age = t - edge;
    const gather = smooth(t, 0.13, edge - 0.15);
    const collapse = 1 - smooth(age, 0.02, 0.31);
    const pull = gather * (1 - smooth(age, 0.06, 0.52));
    const side = targets[0]?.side;
    if (!side) return;
    const direction = side === "cowboy" ? 1 : -1;
    const center = new T.Vector3(-direction * 1.94, 1.90, -0.18);
    const wizard = pawnAt(from);
    if (wizard) movePawn(wizard, -direction * 0.11 * gather, 0, 0, -direction * 0.22 * pull);

    lens.visible = gather * collapse > 0.025;
    lens.position.copy(center);
    lens.quaternion.copy(camera.quaternion);
    const radius = (0.15 + 1.02 * gather) * collapse;
    lens.scale.set(radius, radius * 0.85, radius);
    const horiz = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    // Broken bands feed into the edge. Their trailing pieces are always farther from the void.
    if (lens.visible) {
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 12; i++) {
          const band = (offset) => {
            const segment = (i + offset) / 12;
            const angle = arm * Math.PI * 2 / 3 + segment * 2.35 - (t * 2.65 + gather * 1.8);
            const r = radius * (1.03 + segment * 1.59);
            return center.clone().addScaledVector(horiz, Math.cos(angle) * r).addScaledVector(up, Math.sin(angle) * r * 0.79);
          };
          bar(band(0), band(0.74), [0x654d91, 0xa282c6, 0xeacdf6][i < 3 ? 2 : i < 7 ? 1 : 0],
            (0.11 - i * 0.005) * gather * collapse);
        }
      }
    }

    // Large chipped cobbles lead the dust. Each piece begins on the floor before it arcs inward.
    for (let i = 0; i < 39; i++) {
      const delay = 0.17 + (i % 9) * 0.063;
      const ingest = edge + 0.12 - (i % 5) * 0.075;
      if (t <= delay || t >= ingest) continue;
      const f = smooth(t, delay, ingest);
      const spiral = i * 2.39996 + f * (1.06 + i % 3 * 0.29);
      const distance = (1 - f) * (3.38 + (i % 7) * 0.57);
      const point = center.clone().add(new T.Vector3(
        Math.cos(spiral) * distance, 0, Math.sin(spiral) * distance * 0.82,
      ));
      point.y = 0.17 + f * 1.18 + Math.sin(Math.PI * f) * (0.68 + (i % 3) * 0.21);
      const stone = i % 5 < 2;
      const width = (stone ? 0.27 + (i % 4) * 0.06 : 0.055 + (i % 4) * 0.022) *
        (1 - smooth(f, 0.79, 1)) * smooth(t, delay, delay + 0.09);
      if (width > 0.008) dot("chip", (stone ? [0x85909d, 0x586779, 0xaba085] : [0xb9a2c1, 0x8e7590, 0xc5aa93])[i % 3],
        point, width, width * (stone ? 0.49 : 0.84), width * 0.66, i + f, t * 2 + i, i + f * 4);
    }

    for (const mark of targets) {
      const token = pawnAt(mark);
      if (!token) continue;
      const [fromX, , fromZ] = zone(mark.side, "troop", mark.slot);
      const isDragon = body(token.id) === "dragon";
      const dead = step.hit.sides[mark.side].board[mark.slot]?.health === 0;
      const shattered = dead && body(token.id) === "bone";
      const recoil = pulse(age, 0.01, 0.10, 0.47);
      const rise = smooth(t, 0.23 + mark.slot * 0.04, edge * 0.81) *
        (1 - smooth(age, 0.10, 0.54));
      const drawIn = smooth(t, edge * 0.34, edge - 0.035) * (1 - smooth(age, 0.06, 0.56));
      const follow = (isDragon ? 0.13 : 0.56) * drawIn;
      const drop = shattered ? 0.43 * smooth(age, 0, 0.15) : 0;
      const shifted = (center.x - fromX) * follow - direction * 0.32 * recoil;
      const lift = isDragon ? 0.14 * rise : (1.21 + 0.13 * mark.slot) * rise;
      const lean = direction * ((isDragon ? 0.15 : 0.61) * rise - 0.21 * recoil);
      token.rig?.pose({brace: isDragon ? pull : 0, charge: isDragon ? 0.55 * pull : 0, recoil, time: 0});
      movePawn(token, shifted, lift - drop, (center.z - fromZ) * follow * 0.67, lean);
      token.model.visible = !(shattered && age > 0.105);
      const hips = token.model.localToWorld(new T.Vector3(0, 1 / token.restScale, 0));
      for (let j = 0; j < 4 && age < 0; j++) {
        const f = (t * 1.95 + j / 4 + mark.slot * 0.13) % 1;
        if (gather > 0.08) bar(hips.clone().lerp(center, f), hips.clone().lerp(center, Math.min(1, f + 0.12)),
          j % 2 ? 0x9b72bd : 0xd1a8d5, 0.047 * gather);
      }
      if (age >= 0.035 && age < 0.47) {
        const height = isDragon ? 2.66 : 3.06;
        const orb = new T.Vector3(fromX, height, fromZ - 0.08);
        flecks(orb, age - 0.035, side === "cowboy" ? palette.gold : [0xa0e7d6, 0xd6fff5, 0x5fa7b0], 5);
      }
      if (shattered && age >= 0.05 && age < 0.73) {
        for (let j = 0; j < 18; j++) {
          const f = age - 0.05;
          const angle = (j + 1) * 2.39996;
          const reach = f * (1.32 + (j % 5) * 0.45);
          const shard = new T.Vector3(
            fromX + (center.x - fromX) * 0.56 + Math.cos(angle) * reach + direction * f * 0.63,
            Math.max(0.39, 1.47 + (j % 5) * 0.24 + f * (1.2 + (j % 4) * 0.46) - f * f * 8.0),
            fromZ + (center.z - fromZ) * 0.375 + Math.sin(angle) * reach,
          );
          const size = (0.13 + (j % 4) * 0.04) * (1 - smooth(f, 0.48, 0.68));
          dot("chip", j % 7 === 0 ? 0x7f465c : palette.bone[j % 3], shard, size, size * 1.7, size * 0.62, angle + f * 5, f * 4, angle - f);
        }
      } else if (isDragon && age > 0.018 && age < 0.30) {
        coals(new T.Vector3(fromX - direction * 0.61, 0.32, fromZ + 0.21), age, [0xb8aac6, 0x807287, 0xc69b76], 0.83);
      }
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
    lens.visible = false;
    hellfire.clear();
    for (const n of pool) n.visible = false;
  }
  return {
    clear: teardown,
    begin(beat, makeCameo, disposeCameo) {
      teardown();
      active = beat;
      discardSpare = disposeCameo;
      if (beat.kind !== "burial" && beat.fromTroop && !pawnAt(beat.from) && beat.from.slot !== undefined) {
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
      const id = typeOf(step.cardId ?? "");
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
          if (kind === "gun" && id === "cowboy-dynamiter") {
            dynamiteAttack(actor, from, target, t, edge, dir);
            break;
          }
          const trigger = edge - 0.18;
          const profile = gunShapes[id] ?? { width: 0.12, burst: 0.65, shots: 1, glow: 0xfcc37b };
          const n = kind === "gun" ? profile.shots : 1;
          if (kind === "gun") {
            actor?.rig?.pose({
              aim: smooth(t, 0.03, Math.max(0.13, trigger - 0.035)) * recover,
              brace: 0.4 * pulse(t, 0, 0.14, trigger + 0.12),
              recoil: pulse(t, trigger, trigger + 0.047, trigger + 0.19),
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
          const muzzle = kind === "gun" && id === "cowboy-gatling-crew"
            ? crankGatling(actor, from, b, t, trigger - 0.12, edge)
            : at(from, "muzzle", 0.98);
          for (let i = 0; i < n; i++) {
            const offset = (i - n + 1) * 0.054;
            const f = (t - trigger - offset) / 0.18;
            const lane = (i - (n - 1) * 0.5) * 0.17;
            const start = muzzle.clone().add(new T.Vector3(0, lane * 0.3, lane));
            const end = b.clone().add(new T.Vector3(0, -lane * 0.35, lane));
            tracer(
              start,
              end,
              f,
              profile.width,
              profile.glow,
              id === "cowboy-sheriff" ? 0.24 : id === "cowboy-ranger" ? 0.2 : 0.16,
            );
            if (kind === "gun") gunFlash(start, end, t - trigger - offset, profile.burst);
          }
          if (step.blocked) {
            const slab = b.clone().add(new T.Vector3(-dir * 0.84, -0.48, 0));
            const arriving = (t - trigger - 0.071) / 0.122;
            if (arriving >= 0 && arriving <= 1)
              dot("shard", palette.gold[2], fly(muzzle, slab, arriving), 0.38, 0.094, 0.108);
            flecks(slab, t - trigger - 0.195, palette.bone, 4);
          }
          impactSparks(b, age, palette.gold, id === "cowboy-sheriff" ? 1.3 : 0.94);
          coals(b, age, body(victim?.id) === "bone" ? palette.bone : palette.gold, 0.54);
          break;
        }
        case "blade": {
          const ready = pulse(t, 0.045, edge - 0.27, edge - 0.095);
          const go = smooth(t, edge - 0.34, edge);
          const back = smooth(t, edge + 0.13, step.duration / 1000);
          const travel = go * (1 - back);
          const yaw = Math.atan2(dx, dz);
          if (id === "wizard-skeleton") {
            const windup = ready * 0.64;
            const crossing = pulse(t, edge - 0.115, edge + 0.015, edge + 0.175);
            movePawn(
              actor,
              dx * travel * 0.87 - dir * windup,
              0.16 * Math.abs(Math.sin(travel * Math.PI * 2)) - 0.085 * ready,
              dz * travel,
              dir * (ready * 0.3 - crossing * 0.54),
              yaw * (0.8 * travel + 0.19 * ready) + dir * (-ready * 0.5 + crossing * 0.46),
            );
            const wrist = actor?.model.getObjectByName("dagger-arm");
            wrist?.rotation.set(
              -ready * 0.83 + crossing * 1.16,
              -0.46 * crossing,
              ready * 1.2 - crossing * 1.55,
            );
            const tip = at(from, "dagger-tip", 1.23);
            if (ready > 0.67) bar(tip, tip.clone().add(new T.Vector3(-0.14, 0.13, 0.09)), 0xf6e6ca, 0.1);
            cut(b, dir, age, palette.bone, 1.36);
          } else if (id === "wizard-wizard") {
            const launch = edge - 0.28;
            const f = (t - launch) / 0.28;
            const staff = at(from, "staff-tip", 1.85);
            movePawn(
              actor,
              -dir * 0.26 * ready,
              0.06 * ready,
              0,
              dir * pulse(t, launch, launch + 0.1, edge + 0.25) * 0.37,
            );
            const fork = (fraction, j) =>
              fly(staff, b, fraction).add(
                new T.Vector3(
                  0,
                  Math.sin(j * 1.8) * 0.54 * Math.sin(Math.PI * fraction),
                  j % 2 ? 0.28 : -0.19,
                ),
              );
            if (f > 0 && f < 1.35) {
              for (let j = Math.max(0, Math.ceil((f - 0.4) * 8)); j < Math.min(8, f * 8); j++)
                bar(fork(j / 8, j), fork((j + 1) / 8, j + 1), palette.violet[j % 3], j % 2 ? 0.23 : 0.14);
              gunFlash(staff, b, t - launch, 0.41);
            }
            impactSparks(b, age, palette.violet, 1.11);
          } else if (id.endsWith("-wraith")) {
            movePawn(
              actor,
              dx * travel * 0.79,
              0.53 * travel,
              dz * travel + 0.38 * Math.sin(travel * Math.PI),
              -dir * 0.24 * travel,
              yaw * 0.34 * travel,
            );
            const drift = a.clone().lerp(b, 0.77);
            if (go > 0) trail(a, drift, travel, palette.violet, 9, 0.27);
            coals(b, age, palette.violet, 1.17);
          } else if (id === "wizard-raven-familiar") {
            const air = Math.sin(Math.PI * travel) * 1.67;
            movePawn(
              actor,
              dx * travel * 0.9,
              air,
              dz * travel,
              dir * (0.46 * travel - 0.28 * air),
              yaw * 0.66,
            );
            cut(b, dir, age, palette.violet, 0.64);
            flecks(b, age, palette.violet, 4);
          } else if (id === "cowboy-covered-wagon" || id === "wizard-bone-wall") {
            movePawn(
              actor,
              dx * travel * 0.83,
              0.13 * Math.sin(travel * Math.PI),
              dz * travel,
              -dir * 0.14 * travel,
              yaw * 0.26 * travel,
            );
            if (travel > 0.09) coals(fly(origin, ending, travel), t % 0.3, palette.bone, 0.75);
            impactSparks(b, age, palette.bone, 1.2);
          } else {
            const leap = id === "wizard-imp" ? 0.76 : id === "wizard-jack-o-lantern" ? 1.01 : 0.29;
            movePawn(
              actor,
              dx * travel * 0.88,
              leap * Math.sin(travel * Math.PI),
              dz * travel + 0.44 * Math.sin(travel * Math.PI),
              (id === "wizard-jack-o-lantern" ? -dir * Math.PI * 2 : dir * -0.51) * travel,
              yaw * 0.55 * travel,
            );
            if (id === "wizard-jack-o-lantern") coals(b, age, palette.gold, 0.96);
            else cut(b, dir, age, id === "wizard-imp" ? palette.green : palette.violet, 1.11);
          }
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
          if (from.side === "cowboy") {
            tracer(at(from, "muzzle", 1.15), b, (t - edge + 0.12) / 0.12, 0.18, 0xffd287);
            impactSparks(b, age, palette.gold, 1.13);
          } else cut(b, dir, age, palette.violet, 1.05);
          break;
        }
        case "breath":
        case "sweep": {
          if (id === "cowboy-gatling-crew") {
            const start = edge - 0.40;
            const span = 0.26;
            const firing = pulse(t, start - 0.06, start + 0.13, edge + 0.23);
            movePawn(actor, -dir * (0.15 + 0.046 * Math.sin(t * 146)) * firing, 0.035 * firing, 0, dir * 0.09 * firing);
            const first = at(targets[0], "hit", 1.09);
            const last = at(targets.at(-1), "hit", 1.09);
            const aim = first.clone().lerp(last, T.MathUtils.clamp((t - start) / span, 0, 1));
            const muzzle = crankGatling(actor, from, aim, t, start, edge);
            for (let shot = 0; shot < 8; shot++) {
              const fraction = shot / 7;
              const shotAge = t - start - span * fraction;
              const landing = first.clone().lerp(last, fraction);
              tracer(muzzle, landing, shotAge / 0.15, 0.15, 0xfca956, 0.28);
              if (shotAge < 0.09) gunFlash(muzzle, landing, shotAge, 0.62);
            }
            for (const mark of targets) {
              const chest = at(mark, "hit", 1.09);
              impactSparks(chest, age, palette.gold, 1.11);
              coals(chest, age - 0.04, powder, 0.66);
            }
            break;
          }
          const start = edge - 0.22;
          const coil = smooth(t, 0.06, start) * (1 - smooth(t, start, edge + 0.22));
          const flame = pulse(t, start, edge, edge + 0.29);
          movePawn(actor, dir * (0.20 * flame - 0.18 * coil), 0.14 * coil, 0, dir * (0.10 * coil - 0.08 * flame));
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
            coals(chest, age, colors, kind === "sweep" ? 0.83 : 1.16);
            impactSparks(chest, age, colors, kind === "sweep" ? 0.93 : 1.28);
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
          lassoAttack(actor, victim, from, ending, b, t, edge, step.duration / 1000);
          break;
        }
        case "hellfire":
          hellfire.clear();
          targets.forEach((mark, i) => {
            hellfire.draw(mark, i, age);
            if (age < 0 || age > 0.52) return;
            const impact = ground(mark);
            impact.y = 0.19;
            const bloom = 1 - smooth(age, 0.10, 0.50);
            for (let spark = 0; spark < 13; spark++) {
              const angle = spark * 2.399 + i * 0.86;
              const reach = 0.30 + age * (2.1 + spark % 4 * 0.57);
              const rim = impact.clone().add(new T.Vector3(Math.cos(angle) * reach,
                0.05 + 0.10 * Math.sin(spark), Math.sin(angle) * reach));
              bar(impact.clone().lerp(rim, 0.20 + age), rim, spark % 3 ? 0xbd59e9 : 0xead4ff, 0.16 * bloom);
              const chip = rim.clone();
              chip.y += Math.max(0, age * (2.9 + spark % 4 * 1.1) - age * age * 8.2);
              const size = (0.12 + spark % 4 * 0.061) * bloom;
              dot("chip", spark % 3 ? 0x50426b : 0xbd7ded, chip, size, size * 1.3, size, t * 4, spark, t * 6);
            }
          });
          break;
        case "area-vortex":
        case "vortex":
          singularity(step, t, edge);
          break;
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
          const mark = ground(target).add(new T.Vector3(0, 0.11, 0));
          const aura = victim ? victim.embers : null;
          if (aura) coals(mark, age, colors, 1.25);
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
        case "draw":
        case "play":
        case "burial":
          break;
        default:
          flecks(b, age, from.side === "wizard" ? palette.violet : palette.gold, 5);
      }
      if (
        !["area-vortex", "vortex", "lasso", "summon", "raise", "cover", "set", "gear", "location", "tribute", "burn"].includes(kind) &&
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
