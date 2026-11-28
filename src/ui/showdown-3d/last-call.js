import * as T from "three";
import { LAST_CALL_TIMING } from "./event-positions.js";
import { zone } from "./layout.js";

const { smoothstep: smooth, clamp } = T.MathUtils;
const pulse = (t, a, b, c) => smooth(t, a, b) * (1 - smooth(t, b, c));
const times = [LAST_CALL_TIMING.release, ...LAST_CALL_TIMING.bounces, LAST_CALL_TIMING.contact]
  .map(ms => ms / 1000);
const [release, bellTime, signTime, shoeTime, contact] = times;
const duration = LAST_CALL_TIMING.duration / 1000;
const sparks = [0xffdb8e, 0xfff0c3, 0xe69a58];
const stone = [0xa28370, 0xc6a38a, 0x896e69];
const floor = mark => new T.Vector3(...zone(mark.side, "troop", mark.slot));

// The props use the same flat-shaded materials and shapes as the Boot Hill table.
function makeSet(parent) {
  const set = new T.Group();
  parent.add(set);
  const solid = (color, metalness = 0) => new T.MeshStandardMaterial({
    color, metalness, roughness: 0.82, flatShading: true,
  });
  const wood = solid(0x694039);
  const worn = solid(0xaa7252);
  const iron = solid(0x565366, 0.18);
  const brass = solid(0xa76333, 0.22);
  const cube = new T.BoxGeometry(1, 1, 1);
  function piece(group, geometry, material, x, y, z) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  function plank(group, material, x, y, z, w, h, d) {
    const mesh = piece(group, cube, material, x, y, z);
    mesh.scale.set(w, h, d);
    return mesh;
  }
  function station() {
    const group = new T.Group();
    set.add(group);
    return group;
  }

  const bellPost = station();
  plank(bellPost, wood, -0.71, 1.24, -0.20, 0.22, 2.48, 0.24);
  plank(bellPost, worn, -0.32, 2.44, -0.20, 1.03, 0.20, 0.31);
  plank(bellPost, wood, -0.48, 2.17, -0.20, 0.13, 0.58, 0.15).rotation.z = -0.68;
  const bell = new T.Group();
  bell.position.set(0, 2.34, -0.20);
  bellPost.add(bell);
  const profile = [[0, -0.08], [0.17, -0.08], [0.23, -0.18], [0.26, -0.33],
    [0.32, -0.44], [0.38, -0.49], [0.38, -0.56], [0.30, -0.56], [0.24, -0.39], [0, -0.24]];
  piece(bell, new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 12), brass, 0, 0, 0);
  piece(bell, new T.SphereGeometry(0.077, 8, 5), iron, 0, -0.57, 0.04);
  const rim = piece(bell, new T.TorusGeometry(0.35, 0.028, 4, 18), worn, 0, -0.48, 0);
  rim.rotation.x = Math.PI / 2;

  const signPost = station();
  plank(signPost, wood, -0.99, 0.94, -0.18, 0.18, 1.88, 0.21);
  plank(signPost, worn, -0.47, 1.84, -0.18, 1.23, 0.13, 0.21);
  const sign = new T.Group();
  sign.position.set(0, 1.79, -0.10);
  signPost.add(sign);
  for (const x of [-0.54, 0.54]) plank(sign, iron, x, -0.13, 0, 0.043, 0.27, 0.048);
  plank(sign, wood, 0, -0.46, 0, 1.61, 0.65, 0.19);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#532e27";
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = "#c18a53";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 84);
  ctx.fillStyle = "#f1c98d";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 51px Georgia, serif";
  ctx.fillText("WANTED", 128, 51, 224);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  piece(sign, new T.PlaneGeometry(1.53, 0.57),
    new T.MeshBasicMaterial({ map }), 0, -0.46, 0.10);

  const shoePost = station();
  plank(shoePost, wood, 0, 0.83, -0.15, 0.42, 1.66, 0.28).rotation.z = -0.05;
  plank(shoePost, worn, 0, 0.29, -0.15, 0.55, 0.15, 0.37);
  const shoe = new T.Group();
  shoePost.add(shoe);
  const shoeArc = 1.54 * Math.PI;
  const heel = piece(shoe, new T.TorusGeometry(0.29, 0.074, 6, 16, shoeArc), iron, 0, 0, 0);
  heel.rotation.z = Math.PI / 2 + (2 * Math.PI - shoeArc) / 2;
  for (const x of [-0.27, 0.27]) plank(shoe, brass, x, 0.07, 0.065, 0.065, 0.06, 0.035);
  return { set, bellPost, bell, signPost, sign, shoePost, shoe };
}

export function createLastCall(parent, { at, movePawn, bar, dot, gunFlash, impactSparks, flecks }) {
  let props, stations, muzzle;
  function stage({ from, targets: [target] }) {
    props ??= makeSet(parent);
    const start = floor(from);
    const end = floor(target);
    stations = [
      start.clone().lerp(end, 0.24).add(new T.Vector3(0, 1.85, -1.74)),
      start.clone().lerp(end, 0.48).add(new T.Vector3(0, 1.41, 2.04)),
      start.clone().lerp(end, 0.73).add(new T.Vector3(0, 1.16, -1.53)),
    ];
    [props.bellPost, props.signPost, props.shoePost].forEach((prop, i) => {
      prop.position.set(stations[i].x, 0.08, stations[i].z);
    });
    muzzle = undefined;
    props.set.visible = true;
  }
  function scenery(t) {
    const bellAge = Math.max(0, t - bellTime);
    const signAge = Math.max(0, t - signTime);
    const air = clamp((t - shoeTime) / 0.53, 0, 1);
    props.bell.rotation.z = 0.31 * Math.sin((t + 0.42) * 7) * (1 - smooth(t, -0.47, release - 0.22)) +
      Math.sin(bellAge * 23) * 0.53 * (1 - smooth(bellAge, 0.02, 0.56));
    props.sign.rotation.x = Math.sin(signAge * 25) * 0.78 * (1 - smooth(signAge, 0.05, 0.64));
    props.sign.rotation.z = Math.sin(signAge * 19) * 0.22 * (1 - smooth(signAge, 0.05, 0.68));
    props.shoe.position.set(0.72 * air, 1.31 * (1 - air) + 0.095 * air + 0.87 * Math.sin(air * Math.PI), air * 0.96);
    props.shoe.rotation.set(air * 1.5 * Math.PI, air * 1.6 * Math.PI, air * 2 * Math.PI);
  }
  function draw(step, sheriff, wizard, t) {
    const age = t - contact;
    const [target] = step.targets;
    const hit = at(target, "hit", 1.14);
    const first = stations[0];
    const aim = smooth(t, release - 0.34, release - 0.055) * (1 - smooth(t, release + 0.13, release + 0.40));
    const recoil = pulse(t, release, release + 0.055, release + 0.26);
    const turn = -Math.atan2(first.z - sheriff.group.position.z, first.x - sheriff.group.position.x);
    movePawn(sheriff, -0.14 * recoil, 0, 0, 0.18 * recoil, turn * aim);
    sheriff.rig?.pose({ aim, recoil, brace: 0.31 * aim, time: 0 });
    if (t >= release) {
      muzzle ??= at(step.from, "muzzle", 1.1);
      const waypoints = [muzzle, ...stations, hit];
      gunFlash(muzzle, first, t - release, 1.27);
      for (let i = 0; i < times.length - 1; i++) {
        if (t < times[i]) break;
        const end = waypoints[i].clone().lerp(waypoints[i + 1], clamp((t - times[i]) / (times[i + 1] - times[i]), 0, 1));
        const light = 1 - smooth(t, times[i + 1] + 0.07, contact + 0.26);
        if (light > 0.02) {
          const rim = new T.Vector3(0, 0.035, 0.06);
          bar(waypoints[i], end, 0xc07442, 0.14 * light);
          bar(waypoints[i].clone().add(rim), end.clone().add(rim), 0xffe6a8, 0.063 * light);
        }
        if (t < times[i + 1]) dot("shard", 0xfff4ca, end, 0.19, 0.11, 0.12, 0, 0, t * 19);
      }
      stations.forEach((point, i) => {
        const after = t - times[i + 1];
        impactSparks(point, after, sparks, [0.92, 1.12, 0.73][i]);
        if (after >= 0 && after < 0.08) dot("shard", 0xfff3c4, point, 0.26, 0.43, 0.22, 0, 0, 0.52);
      });
    }
    const glance = 0.30 * pulse(t, bellTime, bellTime + 0.13, shoeTime) -
      0.52 * pulse(t, signTime + 0.05, shoeTime + 0.07, contact + 0.10);
    const jolt = pulse(age, 0, 0.074, 0.35);
    const skid = pulse(age, 0, 0.18, duration - contact - 0.015);
    movePawn(wizard, 0.81 * skid, -0.085 * jolt, 0.27 * skid, -0.39 * jolt, glance - 0.19 * jolt);
    impactSparks(hit, age, sparks, 1.38);
    if (age > 0.055 && age < 0.42) {
      const foot = at(target, "staff-foot", 0.24);
      foot.y = 0.29;
      flecks(foot, age - 0.055, sparks, 8);
      flecks(floor(target).add(new T.Vector3(0.21, 0.21, 0.26)), age - 0.11, stone, 9);
    }
  }
  return {
    stage, scenery, draw,
    clear() {
      if (props) props.set.visible = false;
    },
  };
}
