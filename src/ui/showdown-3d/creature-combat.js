import * as T from "three";
import { EFFECT_COLOR_ALPHA } from "./graphics/pixel-renderer.js";

const ease = T.MathUtils.smoothstep;
const beat = (t, begin, apex, end) => ease(t, begin, apex) * (1 - ease(t, apex, end));
const vec = (x, y, z) => new T.Vector3(x, y, z);
const up = new T.Vector3(0, 1, 0);
const hoofGreen = 0x88f49b;
const fireColors = { wizard: [0x479982, 0x86ed99, 0xe1ffc3], cowboy: [0xc36d47, 0xffb959, 0xffecc0] };

// Each blade, feather or flame is a single tapered brushstroke in the actual 3D scene.
function makeStroke(parent) {
  const segments = 12;
  const positions = new T.BufferAttribute(new Float32Array((segments + 1) * 6), 3);
  positions.setUsage(T.DynamicDrawUsage);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", positions);
  const indices = [];
  for (let i = 0; i < segments * 2; i += 2) indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  geometry.setIndex(indices);
  const ink = new T.MeshBasicMaterial({ side: T.DoubleSide, toneMapped: false });
  ink.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>",
      `#include <opaque_fragment>\ngl_FragColor.a = ${EFFECT_COLOR_ALPHA};`);
  };
  const mesh = new T.Mesh(geometry, ink);
  mesh.visible = false;
  mesh.frustumCulled = false;
  parent.add(mesh);
  return { mesh, draw(color, path, across, width) {
    mesh.visible = true;
    mesh.material.color.setHex(color);
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const center = path(u);
      const radius = width * Math.sin(Math.PI * u) ** 0.74;
      const side = typeof across === "function" ? across(u) : across;
      positions.setXYZ(i * 2, center.x - side.x * radius, center.y - side.y * radius, center.z - side.z * radius);
      positions.setXYZ(i * 2 + 1, center.x + side.x * radius, center.y + side.y * radius, center.z + side.z * radius);
    }
    positions.needsUpdate = true;
  } };
}

export function createCreatureCombat(parent, { movePawn, bar, dot, at }) {
  const strokes = [];
  let used = 0;
  const joints = new Map();

  function frame() {
    for (const { mesh } of strokes) mesh.visible = false;
    used = 0;
  }
  function clear() {
    frame();
    for (const parts of joints.values()) {
      for (const { node, rest } of parts.values()) {
        node.rotation.set(0, 0, 0);
        node.position.copy(rest);
      }
    }
    joints.clear();
  }
  function joint(actor, name) {
    if (!joints.has(actor)) joints.set(actor, new Map());
    const parts = joints.get(actor);
    if (!parts.has(name)) {
      const node = actor.model.getObjectByName(name);
      parts.set(name, { node, rest: node.position.clone() });
    }
    return parts.get(name);
  }
  function stroke(color, path, across, width) {
    if (width < 0.012) return;
    strokes[used] ??= makeStroke(parent);
    strokes[used++].draw(color, path, across, width);
  }

  function horseman(actor, origin, hit, t, edge, duration, ride) {
    const turn = ease(t, 0, edge * 0.34);
    const ready = beat(t, 0, edge * 0.37, edge * 0.68);
    const charge = ease(t, edge * 0.29, edge);
    const home = ease(t, edge + 0.12, duration);
    const travel = charge * (1 - home);
    const cut = ease(t, edge - 0.15, edge) * (1 - ease(t, edge + 0.08, edge + 0.29));
    const dx = hit.x - origin.x, dz = hit.z - origin.z;
    const heading = -Math.atan2(dz, dx);
    const sign = Math.sign(dx);
    // The rider passes on the near side of the target; the saber crosses its silhouette.
    const path = (f) => vec(origin.x + (dx - sign * 0.36) * f, 0.31,
      origin.z + dz * f + Math.sin(Math.PI * f) * (ride ? 1.32 : 0.61) + f * 0.23);
    const spot = path(travel);
    const gallop = Math.sin(Math.PI * 4 * charge);
    const galloping = Math.sin(Math.PI * charge) * (1 - home);
    movePawn(actor, spot.x - origin.x - sign * 0.19 * ready, 0.28 * ready + 0.18 * galloping * Math.abs(gallop),
      spot.z - origin.z, -0.40 * ready + 0.09 * galloping * gallop, heading * turn * (1 - home));
    for (const front of [true, false]) {
      for (const near of [true, false]) {
        const phase = (front ? 0 : Math.PI) + (near ? 0 : 0.72);
        const leg = joint(actor, 'horse-leg-' + (front ? 'front-' : 'back-') + (near ? 'near' : 'far')).node;
        leg.rotation.z = (front ? 0.68 : -0.20) * ready + Math.sin(charge * Math.PI * 4 + phase) * galloping * 0.79;
      }
    }
    joint(actor, "rider").node.rotation.z = 0.20 * ready - 0.70 * cut;
    const arm = joint(actor, "saber-arm").node;
    const lifted = ease(t, 0.03, edge * 0.53) * (1 - ease(t, edge - 0.15, edge));
    arm.rotation.z = 1.10 * lifted - 1.94 * cut;
    if (cut > 0.02) {
      const tip = actor.model.getObjectByName("saber-tip");
      const local = tip.position.clone();
      const progress = ease(t, edge - 0.15, edge);
      const fade = 1 - ease(t, edge + 0.04, edge + 0.21);
      // Sample the equipped blade's actual shoulder pivot, from the raised tip to its present tip.
      const sweep = (u) => {
        const angle = 1.10 - progress * 3.04 * u;
        const p = vec(Math.cos(angle) * local.x - Math.sin(angle) * local.y,
          Math.sin(angle) * local.x + Math.cos(angle) * local.y, local.z);
        return arm.parent.localToWorld(p.add(arm.position));
      };
      stroke(0x518b89, sweep, up, 0.24 * fade);
      stroke(0xe1ffdb, u => sweep(u).add(vec(0, 0.04, 0.045)), up, 0.135 * fade);
      if (t < edge + 0.10) dot("shard", 0xf6ffdd, tip.getWorldPosition(vec()), 0.19, 0.32, 0.14);
    }
    // Each U stays on the ground where the gallop placed it.
    for (let i = 0; i < 4; i++) {
      const f = 0.16 + i * 0.19;
      if (charge < f) continue;
      const fade = (1 - ease(charge, f + 0.35, f + 0.91)) * (1 - ease(t, edge + 0.04, edge + 0.32));
      if (fade < 0.05) continue;
      const mark = path(f);
      mark.z += i % 2 ? 0.24 : -0.24;
      const angle = u => (u - 0.5) * Math.PI * 1.51;
      const hoof = u => mark.clone().add(vec(-sign * Math.cos(angle(u)) * 0.29, 0, Math.sin(angle(u)) * 0.27));
      const radial = u => vec(-sign * Math.cos(angle(u)), 0, Math.sin(angle(u)));
      stroke(0x24594f, hoof, radial, 0.15 * fade);
      stroke(hoofGreen, u => hoof(u).add(vec(0, 0.026, 0)), radial, 0.092 * fade);
    }
  }

  function raven(actor, hit, t, edge, duration) {
    const launch = ease(t, 0.015, edge * 0.55);
    const dive = ease(t, edge * 0.46, edge);
    const home = ease(t, edge + 0.055, duration - 0.045);
    const out = (0.20 * launch + 0.80 * dive) * (1 - home);
    const climb = Math.sin(Math.PI * (0.45 * launch + 0.55 * dive)) * (1 - home);
    const flare = Math.sin(Math.PI * home);
    const { node: bird, rest } = joint(actor, "raven-flight");
    bird.position.copy(rest);
    const start = bird.getWorldPosition(vec());
    const heading = Math.atan2(hit.x - start.x, hit.z - start.z);
    bird.rotation.set(0.89 * dive * (1 - home) - 0.49 * climb - 0.35 * flare,
      heading * (0.24 * launch + 0.54 * dive) * (1 - home), 0.26 * climb - 0.42 * flare);
    for (const s of [-1, 1]) {
      const wing = joint(actor, s < 0 ? "raven-left-wing" : "raven-right-wing").node;
      wing.rotation.set(0, s * (0.84 * dive * (1 - home) - 0.16 * flare),
        s * (-0.62 * climb - 0.19 * dive * (1 - home) - 0.34 * flare));
    }
    const beak = actor.model.getObjectByName("raven-beak").getWorldPosition(vec());
    bird.position.addScaledVector(hit.clone().sub(beak), out / actor.restScale);
    bird.position.y += (1.81 * climb + 1.20 * flare) / actor.restScale;
    bird.position.z += (0.81 * climb - 0.81 * flare) / actor.restScale;
    for (let i = 0; i < 3; i++) {
      const f = (t - edge + 0.095 - i * 0.04) / 0.41;
      if (f < 0 || f > 1) continue;
      const center = hit.clone().add(vec(-Math.sign(hit.x - start.x) * (0.70 + i * 0.62 + f * 1.32),
        0.29 + i * 0.25 + 0.57 * Math.sin(Math.PI * f) - 0.54 * f, 0.20 + f * 0.42));
      const tilt = 0.42 + i * 0.38 + f * 2.0;
      const axis = vec(Math.cos(tilt), Math.sin(tilt), 0).multiplyScalar(0.83 - i * 0.07);
      const across = vec(-Math.sin(tilt), Math.cos(tilt), 0);
      const shaft = (u) => center.clone().addScaledVector(axis, u - 0.45);
      stroke(i % 2 ? 0x8c84d7 : 0x6864a8, shaft, across, 0.137 * Math.sin(Math.PI * f));
      bar(shaft(0), shaft(0.77), 0xb2abde, 0.031 * Math.sin(Math.PI * f));
    }
  }

  function imp(actor, origin, hit, t, edge, duration) {
    const jump = ease(t, 0.005, edge - 0.02);
    const home = ease(t, edge + 0.095, duration);
    const travel = jump * (1 - home);
    const claw = ease(t, edge - 0.105, edge) * (1 - ease(t, edge + 0.07, duration - 0.04));
    const gather = beat(t, 0, edge * 0.27, edge * 0.63);
    const dx = hit.x - origin.x, dz = hit.z - origin.z;
    const dir = Math.sign(dx);
    const leap = Math.sin(Math.PI * jump) * (1 - home);
    movePawn(actor, (dx - dir * 1.05) * travel, 1.15 * leap + 0.33 * Math.sin(Math.PI * home),
      dz * travel + 0.40 * leap + 0.45 * travel, dir * (0.27 * gather - 0.37 * claw),
      Math.atan2(dx, dz) * (0.70 * travel));
    for (const s of [-1, 1]) {
      const arm = joint(actor, s < 0 ? "imp-left-claw" : "imp-right-claw").node;
      arm.rotation.set(-0.65 * gather - 1.76 * claw, s * (-0.66 * gather + 0.24 * claw),
        s * (0.77 * gather + 0.46 * leap + 0.12 * claw));
    }
    const intensity = ease(t, edge - 0.055, edge) * (1 - ease(t, edge + 0.055, edge + 0.20));
    for (let i = 0; i < 2 && intensity > 0; i++) {
      const slash = (u) => hit.clone().add(vec(dir * (1.38 * u - 0.65 - i * 0.30),
        1.03 - 1.52 * u * u - i * 0.36, 0.52 + i * 0.06));
      stroke(i ? 0xa5f46f : 0xe7ffbc, slash, vec(dir * 0.65, 0.76, 0), intensity * 0.145);
    }
  }

  function dragon(actor, from, targets, t, edge, duration) {
    const release = edge - 0.25;
    const puff = beat(t, 0.015, release - 0.025, release + 0.085);
    const blow = ease(t, release - 0.035, release + 0.08) * (1 - ease(t, edge + 0.09, duration - 0.02));
    const dir = from.side === "cowboy" ? 1 : -1;
    const sweep = targets.length > 1;
    const first = at(targets[0], "hit", 1.08), last = at(targets.at(-1), "hit", 1.08);
    const nozzle = at(from, "mouth", 1.31);
    const aim = first.clone().lerp(last, ease(t, release, edge));
    const yaw = -dir * Math.atan2(aim.z - nozzle.z, Math.max(1, Math.abs(aim.x - nozzle.x)));
    movePawn(actor, dir * (0.24 * blow - 0.20 * puff), 0.06 * puff, 0,
      dir * (0.11 * puff - 0.06 * blow), yaw * blow);
    actor?.rig?.pose({ charge: puff, breath: blow, time: 0 });
    const mouth = at(from, "mouth", 1.31);
    const reach = ease(t, release, edge);
    const fade = 1 - ease(t, edge + 0.055, edge + 0.24);
    if (!reach || !fade) return;
    const colors = fireColors[from.side];
    const front = sweep ? first.clone().lerp(last, reach) : first;
    const path = (u) => {
      const f = u * reach;
      const p = mouth.clone().lerp(front, f);
      p.y += Math.sin(Math.PI * f) * (sweep ? 0.85 : 0.78);
      // Bending the far end exposes the sweep across both occupied slots.
      if (sweep) p.z -= (last.z - first.z) * Math.sin(Math.PI * f) * 0.46;
      return p;
    };
    const width = (sweep ? 0.68 : 0.52) * blow * fade;
    stroke(colors[0], path, up, width);
    stroke(colors[1], u => path(u).add(vec(0, 0.035, 0.069)), up, width * 0.74);
    stroke(colors[2], u => path(u).add(vec(0, 0.095, 0.11)), up, width * 0.28);
    // Two short tongues peel off the crest; their tail stays attached to the stream.
    for (let i = 0; i < 2; i++) {
      const tongue = u => {
        const f = 0.32 + i * 0.35 + 0.30 * u;
        const p = path(f);
        p.y += width * (0.41 + 1.02 * u * u) + 0.10 * Math.sin(11 * t + i) * u;
        return p;
      };
      stroke(colors[i], tongue, up, width * (0.31 - i * 0.04));
    }
    for (const mark of targets) {
      const land = at(mark, "hit", 1.08);
      const flare = beat(t, edge - 0.015, edge + 0.055, edge + 0.27);
      for (let i = 0; i < 3 && flare > 0; i++) {
        const point = land.clone().add(vec(0, 0, 0.27));
        const ray = vec(dir * (0.46 + i * 0.23), (i - 0.82) * 0.89, i * 0.13);
        stroke(colors[i], u => point.clone().addScaledVector(ray, u * flare),
          vec(-ray.y, ray.x, 0).normalize(), flare * 0.14);
        const ember = land.clone().add(vec(dir * (i - 0.6) * 0.24, 0.08 + i * 0.11, 0.08 + i * 0.08));
        dot("flame", colors[i], ember, 0.32 * flare, (0.77 + 0.18 * i) * flare, 0.28 * flare, 0, 0, dir * (i - 1) * 0.38);
      }
    }
  }

  function boneWall(token, age, impact, falling, dir) {
    movePawn(token, dir * 0.12 * impact, -0.22 * falling, 0, dir * (0.09 * impact + 0.23 * falling));
    const { node, rest } = joint(token, "bone-cap");
    const bounce = beat(age, 0.014, 0.105, 0.31);
    node.position.y = rest.y + 0.19 * bounce;
    node.rotation.z = dir * (0.16 * bounce - 0.07 * beat(age, 0.20, 0.27, 0.40));
  }

  return { frame, clear, horseman, raven, imp, dragon, boneWall };
}
