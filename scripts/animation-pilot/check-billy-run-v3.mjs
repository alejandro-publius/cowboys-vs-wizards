// Numeric checks over the v3 run output. Usage: node scripts/animation-pilot/check-billy-run-v3.mjs <run-output-v3.txt>
// Measurements only; they do not approve appearance. Distances are board units (Billy height is 1 in rig frame, scaled by his actor height).
import {readFileSync} from "node:fs";
const text = readFileSync(process.argv[2], "utf8");
const r = JSON.parse(text.slice(text.indexOf("{")).split("\n")[0]);
const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const range = (rows, f) => {const v = rows.map(f); return [+Math.min(...v).toFixed(4), +Math.max(...v).toFixed(4)];};
const out = {frames: r.frames, consoleProblems: r.problems.length, pageErrors: r.log.errors.length, events: r.log.events, teardown: r.teardown};
for (const n of ["A", "B"]) {
  const rows = r.log.frames.map((f) => f.pieces[n]), shoot = rows.filter((p) => p.state !== "idle"), idle = rows.filter((p) => p.state === "idle");
  out[n] = {
    shootFrames: shoot.length,
    gunToRightPalm: range(rows, (p) => p.gunMinusRightPalm),
    leftPalmToGun_idle: range(idle, (p) => d(p.leftPalm, p.gun)),
    leftPalmToGun_shoot: range(shoot, (p) => d(p.leftPalm, p.gun)),
    muzzleTravelDuringShoot: Math.max(...shoot.map((p) => d(p.tip, shoot[0].tip))),
    lowestSoleClearance: range(rows, (p) => Math.min(...p.soles)),
    lift: range(rows, (p) => p.lift),
    nonFinite: rows.some((p) => [...p.gun, ...p.tip].some((x) => !Number.isFinite(x))),
  };
}
console.log(JSON.stringify(out, null, 1));
