// Writes src/ui/sheriffs-ledger.data.js, the static payload behind the Sheriff's Ledger in the Showdown Camp
// ("The Night Shift" loop). Inputs, all checked in and read offline:
//   - the 29-card catalog (src/game/card-specs.generated.js via src/game/showdown/cards.js) and the starter decks;
//   - the newest Showdown run in a Night Watch report file (default docs/evidence/night-watch-showdown/scout-pair-reports.json);
//   - the Showdown engine properties SP1-SP7 (tests/helpers/boundary-properties/showdown/properties.js);
//   - or --receipt <file>: a Night Watch receipt (schema night-watch-receipt/1, ../graywave-night-meter-contract.md),
//     used instead of the report file. Its `cards.measured` must be false: the receipt defines no per-card counts.
//   - optionally --per-card <file>: per-card counts from a run. They are kept only when the file names the same
//     mode, commit and seed range as the chosen ruleset run, and only for card types in the catalog.
// With --check it only compares and exits 1 when the payload is stale. Output depends only on these inputs.
import {createHash} from "node:crypto";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, relative} from "node:path";
import {fileURLToPath} from "node:url";
import {SHOWDOWN_SPECS} from "../src/game/card-specs.generated.js";
import {DECKS, RARITY, TYPES} from "../src/game/showdown/cards.js";
import {PROPERTIES} from "../tests/helpers/boundary-properties/showdown/properties.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(root, "src/ui/sheriffs-ledger.data.js");
const DEFAULT_REPORT = "docs/evidence/night-watch-showdown/scout-pair-reports.json";
const SPEC_DIR = ".kiro/specs/duel-card-pipeline/cards";
const REQUIREMENTS = ".kiro/specs/duel-card-pipeline/requirements.md";
// R1.1 names the initial migration's cards exactly; every later card is covered by R1 as a "further spec".
export const R1_1_CARDS = ["Sheriff", "Billy", "Mounted Billy", "Deadeye", "Skeleton", "Wizard", "Dragon", "Singularity"];

// Assembled from parts so the text does not depend on the ICU version's joining words.
const LA = new Intl.DateTimeFormat("en-US", {timeZone: "America/Los_Angeles", year: "numeric", month: "long", day: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short"});
export function laTime(iso) {
  const p = Object.fromEntries(LA.formatToParts(new Date(iso)).map(({type, value}) => [type, value]));
  return `${p.month} ${p.day}, ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod} ${p.timeZoneName}`;
}

export function latestShowdownRun(reports) {
  const runs = reports.filter((r) => r.mode === "showdown" && r.candidate?.counts?.games > 0);
  if (!runs.length) return null;
  return runs.reduce((a, b) => (b.at > a.at || (b.at === a.at && b.id > a.id) ? b : a));
}

// Per-card counts are accepted only for the same run (mode, commit, seeds) and catalog types; anything else throws.
export function matchPerCard(perCard, run) {
  if (!perCard) return {};
  const same = perCard.mode === run.mode && perCard.commit === run.candidate.commit
    && perCard.firstSeed === run.firstSeed && perCard.count === run.count;
  if (!same) throw new Error(`per-card data (${perCard.mode} ${perCard.commit} seeds ${perCard.firstSeed}+${perCard.count}) does not match run ${run.id}`);
  const out = {};
  for (const [type, row] of Object.entries(perCard.cards ?? {})) {
    if (!TYPES[type]) throw new Error(`per-card data names ${type}, which is not in the catalog`);
    const {games, wins} = row;
    if (!Number.isInteger(games) || !Number.isInteger(wins) || games < 1 || wins < 0 || wins > games) throw new Error(`bad counts for ${type}`);
    out[type] = {games, wins};
  }
  return out;
}

// A night-watch-receipt/1 object in the report shape used below.
export function runFromReceipt(receipt) {
  if (receipt.schema !== "night-watch-receipt/1") throw new Error(`unknown receipt schema ${receipt.schema}`);
  if (receipt.mode !== "showdown") throw new Error("the ledger reads Showdown receipts only");
  if (receipt.cards?.measured !== false) throw new Error("receipt claims per-card measurements, which night-watch-receipt/1 does not define");
  const c = receipt.samples.candidate;
  return {id: `receipt ${receipt.generatedAt}`, at: receipt.generatedAt, source: receipt.trigger, mode: "showdown", state: receipt.shift?.state ?? "unknown",
    firstSeed: receipt.seeds.from, count: receipt.seeds.deals, bot: receipt.bot, rulesBlob: receipt.candidate.rulesBlob,
    candidate: {commit: receipt.candidate.commit, counts: {games: c.games, cowboy: c.cowboy, wizard: c.wizard, draw: c.draw, first: c.first, second: c.second}},
    baseline: {commit: receipt.baseline.commit}, rules: receipt.rulesTests};
}

export function buildLedger({reports = [], reportPath = DEFAULT_REPORT, receipt = null, perCard = null}) {
  const run = receipt ? runFromReceipt(receipt) : latestShowdownRun(reports);
  const stats = run ? matchPerCard(perCard, run) : {};
  const digest = createHash("sha256").update(JSON.stringify(SHOWDOWN_SPECS)).digest("hex").slice(0, 16);
  const cards = SHOWDOWN_SPECS.map(({type, side, name, kind}) => ({
    type, side, name, kind, rarity: RARITY[TYPES[type].rarity][0], starter: DECKS[side][type] ?? 0,
    spec: `${SPEC_DIR}/${type}.json`, requirement: R1_1_CARDS.includes(name) ? "R1.1" : "R1",
    latest: stats[type] ?? null,
  }));
  const c = run?.candidate.counts;
  return {
    schema: 1,
    catalog: {count: cards.length, digest, source: "src/game/card-specs.generated.js"},
    requirement: {path: REQUIREMENTS, id: "R1", title: "Card specs", check: "tests/game/card-specs.test.js"},
    properties: {source: "tests/game/showdown-properties.test.js", list: PROPERTIES.map(({id, title}) => ({id, title}))},
    run: run && {
      source: reportPath, id: run.id, at: run.at, local: laTime(run.at), trigger: run.source, state: run.state,
      revision: run.candidate.commit, baseline: run.baseline.commit, firstSeed: run.firstSeed, count: run.count,
      games: c.games, first: c.first, cowboy: c.cowboy, wizard: c.wizard, draw: c.draw, rulesTests: run.rules?.tests ?? null,
      method: "docs/evidence/night-watch-showdown.md", bot: run.bot ?? "playTurn level 2 (both seats)", rulesBlob: run.rulesBlob ?? null,
    },
    perCardSource: Object.keys(stats).length ? perCard.source ?? null : null,
    cards,
  };
}

export function render(ledger) {
  const {cards, ...head} = ledger;
  const fields = Object.entries(head).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  return `// Generated by scripts/build-sheriffs-ledger.mjs. Do not edit by hand; run the script (or --check).\n`
    + `export const LEDGER = {\n${fields.join("\n")}\n  "cards": [\n${cards.map((card) => `    ${JSON.stringify(card)}`).join(",\n")}\n  ]\n};\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const reportPath = opt("--report") ?? DEFAULT_REPORT;
  const perCardPath = opt("--per-card");
  const receiptPath = opt("--receipt");
  const receipt = receiptPath ? JSON.parse(readFileSync(join(root, receiptPath), "utf8")) : null;
  const reports = receipt ? [] : JSON.parse(readFileSync(join(root, reportPath), "utf8"));
  const perCard = perCardPath ? {...JSON.parse(readFileSync(join(root, perCardPath), "utf8")), source: relative(root, join(root, perCardPath))} : null;
  const text = render(buildLedger({reports, reportPath: receiptPath ?? reportPath, receipt, perCard}));
  if (args.includes("--check")) {
    const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";
    if (current !== text) { console.error("src/ui/sheriffs-ledger.data.js is stale: run node scripts/build-sheriffs-ledger.mjs"); process.exit(1); }
    console.log("Sheriff's Ledger payload is current.");
  } else {
    writeFileSync(OUTPUT, text);
    console.log(`Wrote ${relative(root, OUTPUT)}`);
  }
}
