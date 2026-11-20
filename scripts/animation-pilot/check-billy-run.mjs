// Numeric checks over the preview run output. Usage: node scripts/animation-pilot/check-billy-run.mjs <run-output.txt>
// These are measurements, not visual approval. p = [ankleL, wristL, ankleR, wristR] world xyz per frame.
import {readFileSync} from "node:fs";
const text = readFileSync(process.argv[2], "utf8");
const run = JSON.parse(text.slice(text.indexOf("{")).split("\n")[0]);
const {frames, events} = run.log, D = 1.6666666269302368;
const report = {consoleProblems: run.problems.length, teardown: run.teardown, events};
const idleSpans = (name) => {  // contiguous frames where the idle plays and is past its blend-in
  const spans = []; let cur = null;
  for (const f of frames) {
    const p = f.pieces[name], ok = !p.acting && p.idlePlaying && p.idleSeconds >= .2;
    if (ok) (cur ??= []).push(f); else if (cur) {spans.push(cur); cur = null;}
  }
  if (cur) spans.push(cur);
  return spans;
};
const range = (rows, name, k) => {const v = rows.map((f) => f.pieces[name].p[k]); return Math.max(...v) - Math.min(...v);};
for (const name of ["A", "B"]) {
  const spans = idleSpans(name);
  report[name] = {
    idleSpans: spans.map((s) => ({from: s[0].clock, to: s.at(-1).clock})),
    // ankles: indices 0-2 left, 6-8 right
    ankleDriftXZ_m: Math.max(...spans.map((s) => Math.max(Math.hypot(range(s, name, 0), range(s, name, 2)), Math.hypot(range(s, name, 6), range(s, name, 8))))),
    ankleHeightRange_m: Math.max(...spans.map((s) => Math.max(range(s, name, 1) , range(s, name, 7)))),
    wristTravel_m: Math.max(...spans.map((s) => Math.max(range(s, name, 3), range(s, name, 4), range(s, name, 5), range(s, name, 9), range(s, name, 10), range(s, name, 11)))),
    nonFinite: frames.some((f) => f.pieces[name].p.some((x) => !Number.isFinite(x))),
  };
}
// Independence: Billy B's idle clock must advance one frame at a time through Billy A's attack.
const b = frames.map((f) => f.pieces.B.idleSeconds);
let worst = 0;
for (let i = 1; i < b.length; i++) worst = Math.max(worst, Math.abs(((b[i] - b[i - 1]) % D + D) % D - 1 / 30));
const attackFrames = frames.filter((f) => f.pieces.A.acting);
report.independence = {billyBWorstClockStepError_s: +worst.toExponential(2), attackFrames: attackFrames.length, billyBPlayingDuringAttack: attackFrames.every((f) => f.pieces.B.idlePlaying), billyAIdlePlayingDuringAttack: attackFrames.some((f) => f.pieces.A.idlePlaying)};
console.log(JSON.stringify(report, null, 1));
