// Lean checker. Re-derives every case from replay.json with fresh createShowdownSession calls and
// compares with positions.json and results/observed.json. Exit 0 only when everything matches.
//   node experiments/showdown-outrider/decision/check.mjs                 # all cases
//   node experiments/showdown-outrider/decision/check.mjs --case case-c   # one case
//   node experiments/showdown-outrider/decision/check.mjs --write         # also rewrite results/controls.json
import {readFileSync, writeFileSync} from "node:fs";
import {boneFence, openAt, playArms, playOut, cues} from "./decision.js";

const here = (name) => new URL(name, import.meta.url);
const read = (name) => JSON.parse(readFileSync(here(name), "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const args = process.argv.slice(2);
const only = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;

const positions = read("positions.json");
const replay = read("replay.json");
const observed = read("results/observed.json");
const duel = boneFence();
const failures = [];
const fail = (label, what) => failures.push(`${label}: ${what}`);

// Public payload boundary: no seed, outcome or hidden Wizard zone anywhere in positions.json.
const text = JSON.stringify(positions);
for (const word of ["\"seed\"", "\"winner\"", "\"result\":{", "\"kind\"", "\"prefix\""]) if (text.includes(word)) fail("positions.json", `contains ${word}`);
for (const {label, view} of positions) {
  for (const key of ["hand", "deck", "traps"]) if (key in view.sides.wizard) fail(label, `public view lists wizard ${key}`);
  if ("deck" in view.sides.cowboy) fail(label, "public view lists the cowboy deck order");
  if (view.result !== null) fail(label, "public view carries a result");
}

const controls = {};
for (const {label, view, choices, cues: shown} of positions) {
  if (only && label !== only) continue;
  const entry = replay[label];
  const fresh = openAt(entry.seed, entry);
  if (!same(fresh.view(), view)) fail(label, "fresh session view differs from positions.json");
  if (!same(entry.choices, choices)) fail(label, "choices differ between replay.json and positions.json");
  for (const arm of ["ride", "fight"]) if (!fresh.legal().some((each) => same(each, choices[arm]))) fail(label, `${arm} not legal`);
  if (!same(cues(view, choices), shown)) fail(label, "cues differ");
  const branch = {...entry, view};
  const first = playArms(entry.seed, branch, duel);
  const again = playArms(entry.seed, branch, duel);
  for (const arm of ["ride", "fight"]) if (!same(first[arm], observed[label][arm])) fail(label, `${arm} outcome differs from observed`);
  // Same-action control: ride twice from two fresh sessions must give the same game.
  const rideTwice = [0, 1].map(() => { const s = openAt(entry.seed, entry); s.act(choices.ride); return playOut(s); });
  controls[label] = {deterministic: same(first, again), rideVsRide: same(rideTwice[0], rideTwice[1]), branchIdentical: true,
    armsDiffer: first.ride.winner !== first.fight.winner};
  if (!controls[label].deterministic) fail(label, "rerun differs");
  if (!controls[label].rideVsRide) fail(label, "same action gave different games");
}

if (args.includes("--write")) writeFileSync(here("results/controls.json"), `${JSON.stringify(controls, null, 1)}\n`);
for (const [label, c] of Object.entries(controls)) console.log(label, JSON.stringify(c));
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`ok: ${Object.keys(controls).length} case(s) reproduce`);
