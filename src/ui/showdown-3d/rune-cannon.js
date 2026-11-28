import * as T from "three";
import { EFFECT_COLOR_ALPHA } from "./graphics/pixel-renderer.js";

const smooth = T.MathUtils.smoothstep;
const facets = 8;
const fractions = [0.23, 0.47, 0.71];
const beamSections = 24;
const normal = new T.Vector3(0, 0, 1);

function ink(color) {
  const material = new T.MeshBasicMaterial({ color, side: T.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "#include <opaque_fragment>\ngl_FragColor.a = " + EFFECT_COLOR_ALPHA + ";",
    );
  };
  return material;
}

function makeGate(metal, brass, light, glyph) {
  const gate = new T.Group();
  const disk = new T.Group();
  gate.add(disk);
  const rims = [
    [0.95, 0.105, -0.055, metal],
    [0.993, 0.055, 0.084, brass],
    [0.865, 0.035, 0.11, light],
  ];
  for (const [radius, lip, depth, material] of rims) {
    const rim = new T.Mesh(new T.TorusGeometry(radius, lip, 4, facets), material);
    rim.position.z = depth;
    disk.add(rim);
  }
  for (let i = 0; i < facets; i++) {
    const angle = (i + 0.5) * Math.PI * 2 / facets;
    const stamp = new T.Group();
    stamp.position.set(Math.cos(angle) * 0.921, Math.sin(angle) * 0.921, 0.127);
    stamp.rotation.z = angle;
    if (i % 2 === 0) {
      const shoe = new T.Mesh(glyph, brass);
      shoe.scale.set(0.26, 0.22, 0.30);
      shoe.position.set(0.117, 0, -0.04);
      stamp.add(shoe);
    }
    const tooth = new T.Mesh(glyph, light);
    tooth.scale.set(i % 2 === 0 ? 0.152 : 0.216, 0.045, 0.048);
    tooth.position.z = 0.117;
    stamp.add(tooth);
    const serif = new T.Mesh(glyph, brass);
    serif.scale.set(0.039, 0.115, 0.047);
    serif.position.x = i % 2 === 0 ? -0.045 : 0.059;
    stamp.add(serif);
    disk.add(stamp);
  }
  return { gate, disk, light };
}

function makeRibbon(color, width, depth) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(6 * (beamSections + 1)), 3));
  const indices = [];
  for (let i = 0; i < beamSections * 2; i += 2) {
    indices.push(i, i + 1, i + 2, i + 2, i + 1, i + 3);
  }
  geometry.setIndex(indices);
  const mesh = new T.Mesh(geometry, ink(color));
  mesh.frustumCulled = false;
  return { mesh, width, depth };
}

export function createRuneCannon(parent, camera, { bar, dot }) {
  const aim = new T.Vector3();
  const toward = new T.Vector3();
  const gateNormal = new T.Vector3();
  const side = new T.Vector3();
  const line = new T.Vector3();
  const point = new T.Vector3();
  const root = new T.Group();
  const shotLight = new T.PointLight(0xffd692, 0, 4.4);
  const impactLight = new T.PointLight(0xffa66a, 0, 3.8);
  root.visible = false;
  root.add(shotLight, impactLight);
  parent.add(root);
  let gates, ribbons, socket, contact;

  function prepare() {
    const glyph = new T.BoxGeometry(1, 1, 1);
    const metal = ink(0x604552);
    const brass = ink(0xd5a466);
    gates = fractions.map(() => makeGate(metal, brass, ink(0xc6a0e5), glyph));
    ribbons = [
      makeRibbon(0x8045a6, 0.41, 0),
      makeRibbon(0xe6ace9, 0.351, 0.015),
      makeRibbon(0xffda94, 0.261, 0.03),
      makeRibbon(0xfff9db, 0.155, 0.045),
    ];
    root.add(...gates.map(({ gate }) => gate), ...ribbons.map(({ mesh }) => mesh));
  }

  return {
    clear() {
      root.visible = false;
      socket = contact = null;
    },
    draw(staff, hit, t, launch, edge) {
      if (!gates) prepare();
      socket ??= staff.clone();
      contact ??= hit.clone();
      root.visible = true;

      const flight = edge - launch;
      const age = t - edge;
      const progress = T.MathUtils.clamp((t - launch) / flight, 0, 1);
      const charge = smooth(t, 0.10, launch) * (1 - smooth(t, launch + 0.04, launch + 0.16));
      const wind = 1 - smooth(age, 0.09, 0.52);
      aim.subVectors(contact, socket).normalize();
      toward.setFromMatrixColumn(camera.matrixWorld, 2);
      side.crossVectors(toward, aim).normalize();
      gateNormal.copy(aim).addScaledVector(toward, 0.73).normalize();

      gates.forEach(({ gate, disk, light }, i) => {
        const start = 0.15 + i * 0.205;
        const open = smooth(t, start, start + 0.22);
        const cross = (t - launch) - flight * fractions[i];
        const flash = smooth(cross, -0.034, 0) * (1 - smooth(cross, 0.035, 0.23));
        const close = smooth(age, 0.31 + i * 0.065, 0.72 + i * 0.055);
        gate.visible = open * (1 - close) > 0.01;
        if (!gate.visible) return;
        gate.position.copy(socket).lerp(contact, fractions[i]);
        gate.quaternion.setFromUnitVectors(normal, gateNormal);
        disk.rotation.z = Math.PI / 8 + (i % 2 ? -1 : 1) * (0.68 * (1 - open) + close * 1.2);
        const radius = (0.69 + i * 0.23) * open * (1 - close);
        gate.scale.set(radius * (1 + flash * 0.14), radius * (1 + flash * 0.14), 0.78);
        light.color.setHex(flash > 0.27 ? 0xfff2bc : charge > 0.70 ? 0xdcb3f2 : 0xb697d9);
        if (cross < 0 || cross > 0.31) return;
        const scatter = 1 - smooth(cross, 0.025, 0.31);
        for (let j = 0; j < 5; j++) {
          const angle = j * Math.PI * 2 / 5 + i * 0.77;
          point.set(Math.cos(angle), Math.sin(angle), 0)
            .applyQuaternion(gate.quaternion)
            .multiplyScalar(radius * 0.62 + cross * (2 + j % 3))
            .add(gate.position)
            .addScaledVector(aim, cross * 2.9);
          bar(point, point.clone().addScaledVector(aim, scatter * 0.25), 0xffdd9b, scatter * 0.054);
        }
      });

      if (charge > 0.025) {
        dot("shard", 0xffe7ba, staff, 0.29 * charge, 0.53 * charge, 0.31 * charge, t, t * 4, 0);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 + t * 6.2;
          const radius = 0.41 + (1 - charge) * 0.37;
          point.copy(staff).addScaledVector(side, radius * Math.sin(angle));
          point.addScaledVector(toward, radius * Math.cos(angle));
          point.addScaledVector(aim, 0.18 + 0.08 * (i % 2));
          bar(point, point.clone().lerp(staff, 0.32), i % 3 === 0 ? 0xffd998 : 0xc095df, 0.045 * charge);
        }
      }

      line.subVectors(contact, staff);
      shotLight.position.copy(staff).addScaledVector(line, Math.max(0, progress - 0.06));
      shotLight.intensity = (5.6 * smooth(progress, 0, 0.16) + charge * 0.58) * wind;
      impactLight.position.copy(contact).addScaledVector(toward, 0.43);
      impactLight.intensity = age < 0 ? 0 : 7.8 * (1 - smooth(age, 0.035, 0.38));
      const tail = smooth(age, 0.10, 0.51);
      const beamWidth = wind * (0.31 + 0.70 * smooth(progress, 0, 0.72));
      for (const { mesh, width, depth } of ribbons) {
        mesh.visible = progress - tail > 0.008;
        if (!mesh.visible) continue;
        const position = mesh.geometry.attributes.position;
        for (let i = 0; i <= beamSections; i++) {
          const p = i / beamSections;
          const f = T.MathUtils.lerp(tail, progress, p);
          point.copy(staff).addScaledVector(line, f).addScaledVector(toward, depth);
          const taper = Math.min(1, 0.15 + p * 7, 0.10 + (1 - p) * 12);
          const ripple = 0.94 + 0.09 * Math.sin(f * 34 - t * 32) + 0.05 * Math.sin(f * 76 - t * 52);
          const spread = width * beamWidth * taper * ripple * (0.61 + f * 0.62);
          position.setXYZ(i * 2, point.x - side.x * spread, point.y - side.y * spread, point.z - side.z * spread);
          position.setXYZ(i * 2 + 1, point.x + side.x * spread, point.y + side.y * spread, point.z + side.z * spread);
        }
        position.needsUpdate = true;
      }

      if (progress > 0 && age < 0) {
        point.copy(staff).addScaledVector(line, progress);
        dot("shard", 0xfff3bf, point, 0.69 + progress * 0.26, 0.28 + progress * 0.36, 0.26, 0, 0, 0);
      }
      if (age < 0 || age > 0.58) return;
      const flash = 1 - smooth(age, 0.035, 0.17);
      const scatter = 1 - smooth(age, 0.18, 0.57);
      point.copy(contact).addScaledVector(toward, 0.14);
      if (flash > 0) dot("shard", 0xffedaa, point, 0.76 * flash, 0.96 * flash, 0.36 * flash, 0, 0.25, -0.12);
      for (let i = 0; i < 13; i++) {
        const angle = i * 2.39996;
        const spark = contact.clone()
          .addScaledVector(aim, age * (0.91 + (i % 4) * 0.93))
          .addScaledVector(side, Math.sin(angle) * (0.22 + age * (2.2 + i % 3)))
          .addScaledVector(toward, Math.cos(angle) * (0.24 + age * 2.8));
        const end = spark.clone().addScaledVector(aim, 0.39 * scatter);
        bar(spark, end, i % 3 === 0 ? 0xc692e2 : i % 3 === 1 ? 0xffe8ad : 0xe8a463, 0.09 * scatter);
      }
    },
  };
}
