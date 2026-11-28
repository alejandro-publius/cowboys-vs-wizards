import * as T from "three";
import { EFFECT_COLOR_ALPHA } from "./graphics/pixel-renderer.js";

const axis = new T.Vector3(1, 0, 0);
const smooth = T.MathUtils.smoothstep;
const pulse = (t, a, b, c) => smooth(t, a, b) * (1 - smooth(t, b, c));

function material(color) {
  const ink = new T.MeshBasicMaterial({color, side: T.DoubleSide});
  ink.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>",
      "#include <opaque_fragment>\ngl_FragColor.a = " + EFFECT_COLOR_ALPHA + ";");
  };
  return ink;
}

// A shared brush makes these sampled attacks use the board's existing pixel pipeline.
export function createSpellBrush(parent, camera) {
  const root = new T.Group();
  parent.add(root);
  const geometry = {
    box: new T.BoxGeometry(1, 1, 1),
    sphere: new T.SphereGeometry(0.5, 12, 8),
    shard: new T.OctahedronGeometry(0.5),
    crystal: new T.ConeGeometry(0.5, 1, 6),
    ring: new T.TorusGeometry(1, 0.035, 5, 40),
    disc: new T.CircleGeometry(1, 40),
    triangle: new T.CircleGeometry(1, 3),
  };
  const meshes = [], strokes = [], lights = [], inks = new Map(), rims = new Map();
  const cameraRight = new T.Vector3(), cameraUp = new T.Vector3(), toward = new T.Vector3();
  const direction = new T.Vector3(), middle = new T.Vector3(), point = new T.Vector3();
  let used = 0, strokeCount = 0, lightCount = 0;

  function ink(color) {
    if (!inks.has(color)) inks.set(color, material(color));
    return inks.get(color);
  }
  function mesh(kind, color, position, scale = 1, rotation) {
    let item = meshes[used];
    if (!item) {
      item = new T.Mesh();
      item.frustumCulled = false;
      meshes.push(item);
      root.add(item);
    }
    used++;
    item.visible = true;
    item.geometry = geometry[kind] ?? geometry.box;
    item.material = ink(color);
    item.position.copy(Array.isArray(position) ? point.set(...position) : position);
    if (Array.isArray(scale)) item.scale.set(...scale);
    else item.scale.setScalar(scale);
    item.rotation.set(0, 0, 0);
    if (Array.isArray(rotation)) item.rotation.set(...rotation);
    else if (rotation) item.quaternion.copy(rotation);
    return item;
  }
  function bar(from, to, color, width) {
    direction.subVectors(to, from);
    const length = direction.length();
    if (length < 0.001 || width < 0.001) return;
    middle.copy(from).lerp(to, 0.5);
    const item = mesh("box", color, middle, [length + width * 0.4, width, width]);
    item.quaternion.setFromUnitVectors(axis, direction.normalize());
    return item;
  }
  function ring(center, radius, color, width = 0.05, plane = "ground") {
    if (radius < 0.005 || width < 0.002) return;
    const thickness = Math.round(Math.min(0.24, width / radius) * 100) / 100;
    if (!rims.has(thickness)) rims.set(thickness, new T.TorusGeometry(1, thickness, 4, 40));
    const item = mesh("ring", color, center, radius);
    item.geometry = rims.get(thickness);
    if (plane === "screen") item.quaternion.copy(camera.quaternion);
    else if (plane === "ground") item.rotation.x = Math.PI / 2;
    return item;
  }
  function arc(center, radius, start, end, color, width, plane = "ground", segments = 24) {
    const count = Math.min(32, segments);
    const at = angle => {
      if (plane === "screen") return center.clone()
        .addScaledVector(cameraRight, radius * Math.cos(angle))
        .addScaledVector(cameraUp, radius * Math.sin(angle));
      return center.clone().add(new T.Vector3(radius * Math.cos(angle),
        plane === "vertical" ? radius * Math.sin(angle) : 0,
        plane === "ground" ? radius * Math.sin(angle) : 0));
    };
    for (let i = 0; i < count; i++) {
      bar(at(T.MathUtils.lerp(start, end, i / count)), at(T.MathUtils.lerp(start, end, (i + 1) / count)), color, width);
    }
  }
  function ribbon(points, width, color) {
    if (points.length < 2 || width < 0.002) return;
    let stroke = strokes[strokeCount];
    if (!stroke) {
      const path = new T.BufferGeometry();
      path.setAttribute("position", new T.BufferAttribute(new Float32Array(128 * 3), 3));
      const indices = [];
      for (let i = 0; i < 126; i += 2) indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      path.setIndex(indices);
      stroke = new T.Mesh(path);
      stroke.frustumCulled = false;
      strokes.push(stroke);
      root.add(stroke);
    }
    strokeCount++;
    stroke.visible = true;
    stroke.material = ink(color);
    const attribute = stroke.geometry.attributes.position;
    const up = new T.Vector3();
    const count = Math.min(64, points.length);
    for (let i = 0; i < count; i++) {
      direction.subVectors(points[Math.min(count - 1, i + 1)], points[Math.max(0, i - 1)]);
      up.crossVectors(toward, direction).normalize().multiplyScalar(width / 2);
      attribute.setXYZ(i * 2, points[i].x - up.x, points[i].y - up.y, points[i].z - up.z);
      attribute.setXYZ(i * 2 + 1, points[i].x + up.x, points[i].y + up.y, points[i].z + up.z);
    }
    attribute.needsUpdate = true;
    stroke.geometry.setDrawRange(0, (count - 1) * 6);
  }
  function sigil(center, radius, color, progress = 1, points = 6) {
    if (progress < 0.01) return;
    ring(center, radius * progress, color, 0.045);
    ring(center, radius * progress * 0.82, color, 0.028);
    for (let i = 0; i < points; i++) {
      const a = i * Math.PI * 2 / points;
      const b = (i + 2) * Math.PI * 2 / points;
      const p = angle => center.clone().add(new T.Vector3(Math.cos(angle) * radius * 0.79 * progress, 0, Math.sin(angle) * radius * 0.79 * progress));
      bar(p(a), p(b), color, 0.034);
    }
    for (let i = 0; i < 14; i++) {
      const a = i * Math.PI / 7;
      const r = radius * progress;
      const from = center.clone().add(new T.Vector3(Math.cos(a) * r * 0.88, 0, Math.sin(a) * r * 0.88));
      const to = center.clone().add(new T.Vector3(Math.cos(a) * r * 0.96, 0, Math.sin(a) * r * 0.96));
      bar(from, to, color, 0.05);
    }
  }
  function light(position, color, power, distance = 6) {
    let lamp = lights[lightCount];
    if (!lamp) {
      lamp = new T.PointLight();
      lights.push(lamp);
      root.add(lamp);
    }
    lightCount++;
    lamp.visible = true;
    lamp.position.copy(position);
    lamp.color.setHex(color);
    lamp.intensity = power;
    lamp.distance = distance;
    return lamp;
  }
  function clear() {
    for (const item of [...meshes, ...strokes, ...lights]) item.visible = false;
    used = strokeCount = lightCount = 0;
  }
  return {
    mesh, bar, arc, ring, ribbon, sigil, light, smooth, pulse, clear, cameraRight, cameraUp, toward,
    begin() {
      clear();
      cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
      cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
      toward.setFromMatrixColumn(camera.matrixWorld, 2);
    },
    size() { return { meshes: used, strokes: strokeCount, lights: lightCount }; },
  };
}
