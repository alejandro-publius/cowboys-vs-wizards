// Issue #120: print the T1 trap playtest seed plan as Markdown.
//   node experiments/trap-playtest-kit/run.mjs              print to stdout only
//   node experiments/trap-playtest-kit/run.mjs --out <path> also write exactly that text to <path>
// Writes no file unless --out is given. Deterministic: same output on every run.
import { writeFileSync } from "node:fs";
import { pickSeeds, renderPlan } from "./seeds.js";

const args = process.argv.slice(2);
let out = null;
if (args.length === 2 && args[0] === "--out" && args[1] && !args[1].startsWith("--")) out = args[1];
else if (args.length !== 0) {
  console.error("usage: node experiments/trap-playtest-kit/run.mjs [--out <path>]");
  process.exit(2);
}

const text = renderPlan(pickSeeds());
process.stdout.write(text);
if (out) writeFileSync(out, text);
