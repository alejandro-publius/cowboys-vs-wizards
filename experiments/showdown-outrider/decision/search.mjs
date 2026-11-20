// Runs one pre-registered range and writes its raw output.
//   node experiments/showdown-outrider/decision/search.mjs a        # seeds 1000-1099 -> results/search-1000-1099.json
//   node experiments/showdown-outrider/decision/search.mjs b        # seeds 1100-1199 -> results/search-1100-1199.json
//   node experiments/showdown-outrider/decision/search.mjs cue      # derive the cue from a+b -> results/cue.json
//   node experiments/showdown-outrider/decision/search.mjs holdout  # needs results/cue.json; 1200-1299 -> results/holdout-1200-1299.json
import {existsSync, readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {RANGES, deriveCue, scoreCue, search, supported} from "./decision.js";

const dir = new URL("./results/", import.meta.url);
mkdirSync(dir, {recursive: true});
const file = ({from, to}, name = "search") => new URL(`${name}-${from}-${to}.json`, dir);
const read = (url) => JSON.parse(readFileSync(url, "utf8"));
const write = (url, data) => { writeFileSync(url, `${JSON.stringify(data, null, 1)}\n`); console.log(`wrote ${url.pathname}`); };
const which = process.argv[2];

if (which === "a" || which === "b") {
  const out = search(RANGES[which]);
  write(file(RANGES[which]), out);
  console.log(JSON.stringify(out.counts));
} else if (which === "cue") {
  const rows = [RANGES.a, RANGES.b].flatMap((range) => read(file(range)).seeds.filter((seed) => seed.branch));
  const cue = deriveCue(rows);
  const fit = scoreCue(cue, rows);
  write(new URL("cue.json", dir), {derivedFrom: "1000-1199", rule: {feature: cue.feature, op: cue.op, threshold: cue.threshold}, fit, supportedOnSearch: supported(fit)});
  console.log(JSON.stringify({cue, fit}));
} else if (which === "holdout") {
  const cueFile = new URL("cue.json", dir);
  if (!existsSync(cueFile)) throw new Error("results/cue.json must be derived and committed before the holdout runs");
  if (existsSync(file(RANGES.holdout, "holdout"))) throw new Error("holdout already run; it is run once");
  const {rule} = read(cueFile);
  const out = search(RANGES.holdout);
  const rows = out.seeds.filter((seed) => seed.branch);
  const result = scoreCue(rule, rows);
  write(file(RANGES.holdout, "holdout"), {...out, rule, score: result, supported: supported(result)});
  console.log(JSON.stringify({counts: out.counts, score: result, supported: supported(result)}));
} else {
  throw new Error("usage: search.mjs a|b|cue|holdout");
}
