// Builds the case files from the committed search results. Run once; check.mjs verifies them.
//   node experiments/showdown-outrider/decision/cases.mjs
// Selection (fixed): every clean reversal in 1000-1199 whose turn is 3 (the earliest, shortest prefix),
// plus every turn-7 reversal. Labels are neutral: case order comes from a hash of the public view,
// so neither the label nor the order says which arm won.
import {readFileSync, writeFileSync} from "node:fs";
import {boneFence, findBranch, cues} from "./decision.js";

const here = (name) => new URL(name, import.meta.url);
const read = (name) => JSON.parse(readFileSync(here(name), "utf8"));
const write = (name, data) => writeFileSync(here(name), `${JSON.stringify(data, null, 1)}\n`);
const hash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const rows = ["results/search-1000-1099.json", "results/search-1100-1199.json"].flatMap((f) => read(f).seeds);
const picked = rows.filter((row) => row.branch && /-only$/.test(row.kind) && (row.at === 3 || row.at === 7));
const duel = boneFence();
const built = picked.map((row) => {
  const {branch} = findBranch(row.seed, duel);
  return {row, branch, key: hash(JSON.stringify(branch.view))};
}).sort((a, b) => a.key - b.key);

const positions = [];
const replay = {};
const observed = {};
built.forEach(({row, branch}, i) => {
  const label = `case-${String.fromCharCode(97 + i)}`;
  positions.push({label, view: branch.view, choices: branch.choices, cues: cues(branch.view, branch.choices)});
  replay[label] = {seed: row.seed, prefix: branch.prefix, at: branch.at, choices: branch.choices};
  observed[label] = {ride: row.ride, fight: row.fight, kind: row.kind};
});
write("positions.json", positions);
write("replay.json", replay);
write("results/observed.json", observed);
console.log(Object.entries(replay).map(([label, each]) => `${label} seed ${each.seed} ${observed[label].kind}`).join("\n"));
