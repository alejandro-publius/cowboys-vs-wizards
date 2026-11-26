// Showdown balance evidence: plays deals through a committed engine snapshot, writes one
// cvw-balance-report/1 receipt (docs/SCORECARD.md) with per-game outcomes and per-card counts,
// and verifies receipts, counting each duel once. Local CLI only. No model, network or Kiro call.
//
//   node scripts/balance-evidence.mjs run    --from <seed> --deals <n> [--commit <ref>=HEAD] [--out <file>]
//   node scripts/balance-evidence.mjs verify [files...] [--rerun <deals>|all] [--json]
//
// run: `git archive <commit> src/game` into a temporary directory and plays each deal from both
//   seats with that snapshot's own level-2 bot, the loop of apps/night-watch/backend/showdown_sim.mjs.
//   Uncommitted engine edits in this checkout therefore never reach a receipt.
// verify (default: every reports/balance/*.json): checks each receipt's arithmetic, outcome string,
//   per-card counts and git provenance; --rerun replays the first <deals> deals (or all) from the
//   receipt's commit and compares. It then deduplicates by duel identity and prints the faction
//   result and per-card coverage separately. Exit 0 only when at least one receipt exists and all pass.
//
// A faction win rate is not an estimate for any single card. Under the fixed even-match decks, every
// card's in-deck rate equals its faction's rate by construction; drawn and played rates are
// conditional on game length and bot choices (selection bias). No card-band verdict is printed:
// which per-card metric the 45-55% target uses is an open Fable/user decision.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = relative(ROOT, fileURLToPath(import.meta.url));
const REPORT_DIR = "reports/balance";
const ENGINE_PATH = "src/game/showdown";
const RNG_PATH = "src/game/frontier-kit/seeded-rng.js";
const SPEC_PATH = "src/game/card-specs.generated.js";
export const SCHEMA = "cvw-balance-report/1";
export const BOT = "playTurn level 2 (both seats)";
export const DECKS_ID = "even-match";
export const SIDES = ["cowboy", "wizard"];
// Within a deal, game 0 has Cowboy first and game 1 Wizard first (the Night Watch order).
export const SEAT_ORDER = SIDES;
export const LEVELS = ["inDeck", "drawn", "played"];
// One run stays a bounded shard; larger totals come from many disjoint shards.
export const MAX_DEALS_PER_RUN = 5000;
const CODE = {c: "cowboy", w: "wizard", d: "draw"};

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const blank = () => ({games: 0, wins: 0, draws: 0});

// Wilson 95% interval for k of n, as shares 0..1; null without games.
export function wilson(k, n, z = 1.959964) {
  if (!n) return null;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export const decksSha256 = (DECKS) => sha256(canonical(DECKS));

// Plays `deals` deals from seed `from`, each from both seats. engine: {createShowdown, playTurn, TYPES, DECKS, typeOf}.
// Per card type (its owner's view of the game): inDeck = its side's deck holds a copy; drawn = a copy reached
// its owner's hand (opening hand, turn draw or Scout; a burned draw never reaches the hand); played = a copy left
// the hand by its owner's action (summon, spell, gear, location or set trap).
export function playDeals(engine, from, deals) {
  const {createShowdown, playTurn, TYPES, DECKS, typeOf} = engine;
  const types = Object.keys(TYPES).sort();
  const perCard = Object.fromEntries(types.map((type) => [type, {side: TYPES[type].side, inDeck: blank(), drawn: blank(), played: blank()}]));
  const reasons = {};
  let outcomes = "";
  for (let seed = from; seed < from + deals; seed++) {
    for (const first of SEAT_ORDER) {
      let state = createShowdown(seed, {first});
      const drawn = new Set();
      const played = new Set();
      for (const side of SIDES) for (const id of state.sides[side].hand) drawn.add(typeOf(id));
      const watch = (before, applied) => {
        const after = applied.state;
        for (const side of SIDES) for (const id of after.sides[side].hand) drawn.add(typeOf(id));
        const kept = new Set(after.sides[before.active].hand);
        for (const id of before.sides[before.active].hand) if (!kept.has(id)) played.add(typeOf(id));
      };
      while (!state.result) state = playTurn(state, 2, watch).state;
      const winner = state.result.winner;
      outcomes += winner === null ? "d" : winner[0];
      reasons[state.result.reason] = (reasons[state.result.reason] ?? 0) + 1;
      const credit = (row, type) => {
        row.games += 1;
        if (winner === null) row.draws += 1;
        else if (winner === TYPES[type].side) row.wins += 1;
      };
      for (const side of SIDES) for (const type of Object.keys(DECKS[side])) credit(perCard[type].inDeck, type);
      for (const type of drawn) credit(perCard[type].drawn, type);
      for (const type of played) credit(perCard[type].played, type);
    }
  }
  return {outcomes, reasons, perCard, decksSha256: decksSha256(DECKS)};
}

// Results, seats and starting-side splits recomputed from the outcome string.
export function tally(outcomes) {
  const zero = () => ({cowboy: 0, wizard: 0, draw: 0});
  const t = {results: zero(), seats: {first: 0, second: 0}, byStartingSide: {cowboy: zero(), wizard: zero()}};
  [...outcomes].forEach((code, i) => {
    const first = SEAT_ORDER[i % 2];
    const winner = CODE[code];
    t.results[winner] += 1;
    t.byStartingSide[first][winner] += 1;
    if (winner !== "draw") t.seats[winner === first ? "first" : "second"] += 1;
  });
  return t;
}

export function coverageOf(perCard) {
  const types = Object.keys(perCard).sort();
  const measured = (level) => types.filter((type) => perCard[type][level].games > 0).length;
  return {catalog: types.length, inDeck: measured("inDeck"), drawn: measured("drawn"), played: measured("played"),
    missing: types.filter((type) => perCard[type].inDeck.games === 0)};
}

// The receipt, from a run and its provenance. Pure.
export function buildReport({commit, engine, run, from, deals, generatedAt, runner, elapsedMs}) {
  const games = run.outcomes.length;
  const t = tally(run.outcomes);
  return {
    schema: SCHEMA, ruleset: "showdown", commit, bot: BOT, decks: DECKS_ID,
    seeds: {from, to: from + deals - 1, gamesPerDeal: 2}, games, results: t.results, generatedAt,
    engine: {...engine, decksSha256: run.decksSha256, paths: engine.rngBlob ? [ENGINE_PATH, SPEC_PATH, RNG_PATH] : [ENGINE_PATH, SPEC_PATH]},
    runner, elapsedMs,
    seatOrder: "game 2k has Cowboy first, game 2k+1 Wizard first, for deal seed from+k",
    seats: t.seats, byStartingSide: t.byStartingSide, reasons: run.reasons,
    outcomes: run.outcomes, outcomesSha256: sha256(run.outcomes),
    perCard: run.perCard, coverage: coverageOf(run.perCard),
    cardsOmitted: "The scorecard's cards field is left out: no per-card metric (in deck, drawn, played) has been chosen for the 45-55% target, and the in-deck rate is the faction rate under fixed decks.",
  };
}

function perCardProblems(r) {
  const pc = r.perCard;
  if (!pc || typeof pc !== "object" || Array.isArray(pc) || !Object.keys(pc).length) return ["perCard is missing"];
  const out = [];
  for (const [type, row] of Object.entries(pc)) {
    if (!SIDES.includes(row?.side)) { out.push(`perCard.${type}.side is missing`); continue; }
    const bad = LEVELS.filter((level) => {
      const c = row[level];
      return !c || !isCount(c.games) || !isCount(c.wins) || !isCount(c.draws) || c.wins + c.draws > c.games
        || c.games > r.games || c.wins > r.results[row.side] || c.draws > r.results.draw;
    });
    if (bad.length) { out.push(`perCard.${type}: ${bad.join(", ")} counts are not valid`); continue; }
    const {inDeck, drawn, played} = row;
    if (played.games > drawn.games || drawn.games > inDeck.games || played.wins > drawn.wins || drawn.wins > inDeck.wins) {
      out.push(`perCard.${type}: played <= drawn <= in deck does not hold`);
    }
    if (inDeck.games !== 0 && inDeck.games !== r.games) out.push(`perCard.${type}: in-deck games must be 0 or every game under fixed decks`);
    if (inDeck.games === r.games && (inDeck.wins !== r.results[row.side] || inDeck.draws !== r.results.draw)) {
      out.push(`perCard.${type}: in-deck wins differ from its faction's wins`);
    }
  }
  if (!out.length && canonical(coverageOf(pc)) !== canonical(r.coverage)) out.push("coverage does not match perCard");
  return out;
}

// Problems with one receipt on its own (no git, no replay). Empty means internally consistent.
export function reportProblems(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return ["report is not a JSON object"];
  const p = [];
  if (r.schema !== SCHEMA) p.push(`schema is ${JSON.stringify(r.schema)}, not ${SCHEMA}`);
  if (r.ruleset !== "showdown") p.push("ruleset is not showdown");
  if (!HEX40.test(r.commit ?? "")) p.push("commit is not a full 40-character commit id");
  if (typeof r.bot !== "string" || !r.bot) p.push("bot is missing");
  if (typeof r.decks !== "string" || !r.decks) p.push("decks is missing");
  if (typeof r.generatedAt !== "string" || Number.isNaN(Date.parse(r.generatedAt))) p.push("generatedAt is not a time");
  const s = r.seeds ?? {};
  if (!isCount(s.from) || !isCount(s.to) || s.to < s.from) p.push("seeds.from and seeds.to are not a whole-number range");
  if (s.gamesPerDeal !== 2) p.push("seeds.gamesPerDeal must be 2: each deal is played from both seats");
  if (!isCount(r.games) || r.games < 1) p.push("games is not a positive count");
  const res = r.results ?? {};
  for (const key of ["cowboy", "wizard", "draw"]) if (!isCount(res[key])) p.push(`results.${key} is missing`);
  if (!HEX40.test(r.engine?.tree ?? "")) p.push("engine.tree is not a git tree id");
  if (!HEX40.test(r.engine?.specBlob ?? "")) p.push("engine.specBlob is not a git blob id");
  if (r.engine?.rngBlob !== undefined && !HEX40.test(r.engine.rngBlob)) p.push("engine.rngBlob is not a git blob id");
  if (!HEX64.test(r.engine?.decksSha256 ?? "")) p.push("engine.decksSha256 is missing");
  if (p.length) return p;
  if (r.games !== (s.to - s.from + 1) * s.gamesPerDeal) p.push("games does not equal (to - from + 1) x gamesPerDeal");
  if (res.cowboy + res.wizard + res.draw !== r.games) p.push("results do not sum to games");
  if (typeof r.outcomes !== "string") return [...p, "outcomes are missing: a report with only totals is rejected"];
  if (r.outcomes.length !== r.games || !/^[cwd]*$/.test(r.outcomes)) return [...p, "outcomes must hold one c, w or d per game"];
  if (sha256(r.outcomes) !== r.outcomesSha256) p.push("outcomesSha256 does not match outcomes");
  const t = tally(r.outcomes);
  if (canonical(t.results) !== canonical(res)) p.push("results do not match the per-game outcomes");
  if (canonical(t.seats) !== canonical(r.seats)) p.push("seats do not match the per-game outcomes");
  if (canonical(t.byStartingSide) !== canonical(r.byStartingSide)) p.push("byStartingSide does not match the per-game outcomes");
  const reasons = Object.values(r.reasons ?? {});
  if (!reasons.length || reasons.some((n) => !isCount(n)) || reasons.reduce((a, b) => a + b, 0) !== r.games) p.push("reasons do not sum to games");
  if (p.length) return p;
  p.push(...perCardProblems(r));
  if ("cards" in r) {
    const cards = r.cards;
    if (!cards || typeof cards !== "object" || Object.values(cards).some((c) => !isCount(c?.games) || !isCount(c?.wins) || c.wins > c.games || c.games > r.games)) {
      p.push("cards entries must be {games, wins} with wins <= games <= games of the report");
    }
  }
  return p;
}

// Duel identity (docs/SCORECARD.md): engine (showdown tree + card-spec blob), decks, bot, games per deal; then the seed.
export const duelKey = (r) => [r.engine.tree, r.engine.specBlob, ...(r.engine.rngBlob ? [r.engine.rngBlob] : []), r.engine.decksSha256, r.bot, r.decks, r.seeds.gamesPerDeal].join("|");

const addCounts = (into, from) => { into.games += from.games; into.wins += from.wins; into.draws += from.draws; };

// Combines valid receipts: [{name, report}]. Each duel counts once. Faction totals come from the union of
// per-game outcomes; per-card totals only from receipts whose seed range overlaps no receipt already used,
// because per-card counts are not stored per game.
export function combine(entries) {
  const problems = [];
  if (!entries.length) problems.push(`no ${SCHEMA} receipts: 0 duels, every card unknown`);
  const groups = new Map();
  for (const entry of entries) {
    const key = duelKey(entry.report);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const out = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.report.seeds.from - b.report.seeds.from || b.report.seeds.to - a.report.seeds.to || a.name.localeCompare(b.name));
    for (let i = 0; i < list.length; i++) {
      const a = list[i].report;
      for (let j = i + 1; j < list.length && list[j].report.seeds.from <= a.seeds.to; j++) {
        const b = list[j].report;
        const lo = Math.max(a.seeds.from, b.seeds.from);
        const hi = Math.min(a.seeds.to, b.seeds.to);
        const slice = (r) => r.outcomes.slice((lo - r.seeds.from) * 2, (hi - r.seeds.from + 1) * 2);
        if (slice(a) !== slice(b)) problems.push(`${list[i].name} and ${list[j].name} record different outcomes for seeds ${lo}-${hi} of the same engine, bot and decks`);
      }
    }
    let covered = -1;
    let union = "";
    let rawGames = 0;
    const seedRanges = [];
    const perCard = {};
    let perCardGames = 0;
    const perCardExcluded = [];
    let usedTo = -1;
    for (const {name, report} of list) {
      const {from, to} = report.seeds;
      rawGames += report.games;
      const start = Math.max(from, covered + 1);
      if (start <= to) {
        union += report.outcomes.slice((start - from) * 2);
        const last = seedRanges.at(-1);
        if (last && last.to + 1 === start) last.to = to; else seedRanges.push({from: start, to});
        covered = to;
      }
      if (from > usedTo) {
        usedTo = to;
        perCardGames += report.games;
        for (const [type, row] of Object.entries(report.perCard)) {
          perCard[type] ??= {side: row.side, inDeck: blank(), drawn: blank(), played: blank()};
          for (const level of LEVELS) addCounts(perCard[type][level], row[level]);
        }
      } else perCardExcluded.push(name);
    }
    const t = tally(union);
    const decided = t.results.cowboy + t.results.wizard;
    out.push({key, engine: list[0].report.engine, bot: list[0].report.bot, decks: list[0].report.decks,
      receipts: list.map((entry) => entry.name), commits: [...new Set(list.map((entry) => entry.report.commit))],
      seedRanges, rawGames, uniqueGames: union.length, duplicateGames: rawGames - union.length,
      faction: {...t.results, games: union.length, cowboyShareOfDecided: decided ? t.results.cowboy / decided : null,
        cowboyWilson95: wilson(t.results.cowboy, decided)},
      seats: t.seats,
      perCardGames, perCardExcluded, perCard, coverage: Object.keys(perCard).length ? coverageOf(perCard) : null});
  }
  return {problems, uniqueGames: out.reduce((sum, g) => sum + g.uniqueGames, 0), groups: out};
}

// ---- side effects below: git, snapshots, files ----

const git = (args, options = {}) => spawnSync("git", args, {cwd: ROOT, maxBuffer: 512 * 1024 * 1024, encoding: options.binary ? undefined : "utf8"});
const gitOut = (...args) => {
  const r = git(args);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${String(r.stderr).trim()}`);
  return r.stdout.trim();
};

export function engineIds(commit) {
  const ids = {tree: gitOut("rev-parse", `${commit}:${ENGINE_PATH}`), specBlob: gitOut("rev-parse", `${commit}:${SPEC_PATH}`)};
  const rng = gitOut("ls-tree", commit, "--", RNG_PATH);
  if (rng) ids.rngBlob = gitOut("rev-parse", `${commit}:${RNG_PATH}`);
  return ids;
}

// Problems with a receipt's git provenance in this clone, and whether it counts as shippable (commit behind HEAD).
export function provenance(report) {
  if (git(["cat-file", "-e", `${report.commit}^{commit}`]).status !== 0) return {problems: [`commit ${report.commit} is not in this clone`], shippable: false};
  const ids = engineIds(report.commit);
  const problems = [];
  if (ids.tree !== report.engine.tree) problems.push(`engine.tree is not ${ENGINE_PATH} at ${report.commit.slice(0, 12)}`);
  if (ids.rngBlob !== report.engine.rngBlob) problems.push(`engine.rngBlob does not match the shared deal generator at ${report.commit.slice(0, 12)}`);
  if (ids.specBlob !== report.engine.specBlob) problems.push(`engine.specBlob is not ${SPEC_PATH} at ${report.commit.slice(0, 12)}`);
  return {problems, shippable: git(["merge-base", "--is-ancestor", report.commit, "HEAD"]).status === 0};
}

function snapshot(commit) {
  const dir = mkdtempSync(join(tmpdir(), "balance-evidence-"));
  const archive = git(["archive", "--format=tar", commit, "src/game"], {binary: true});
  if (archive.status !== 0) throw new Error(`git archive ${commit}: ${archive.stderr}`);
  const tar = spawnSync("tar", ["-x", "-C", dir], {input: archive.stdout});
  if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`);
  writeFileSync(join(dir, "package.json"), '{"type": "module"}\n');
  return dir;
}

export async function loadEngine(dir) {
  const rules = await import(pathToFileURL(join(dir, ENGINE_PATH, "rules.js")).href);
  const cards = await import(pathToFileURL(join(dir, ENGINE_PATH, "cards.js")).href);
  return {createShowdown: rules.createShowdown, playTurn: rules.playTurn, TYPES: cards.TYPES, DECKS: cards.DECKS, typeOf: cards.typeOf};
}

export function rerunProblems(report, engine, deals = Infinity) {
  const total = report.seeds.to - report.seeds.from + 1;
  const n = Math.min(deals, total);
  const run = playDeals(engine, report.seeds.from, n);
  const p = [];
  if (run.decksSha256 !== report.engine.decksSha256) p.push("decks at the commit differ from engine.decksSha256");
  if (run.outcomes !== report.outcomes.slice(0, 2 * n)) p.push(`outcomes differ from a replay of seeds ${report.seeds.from}-${report.seeds.from + n - 1}`);
  if (n === total) {
    if (canonical(run.perCard) !== canonical(report.perCard)) p.push("perCard differs from a full replay");
    if (canonical(run.reasons) !== canonical(report.reasons)) p.push("reasons differ from a full replay");
  }
  return p;
}

function options(args) {
  const named = {};
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      named[key] = args[i + 1] === undefined || args[i + 1].startsWith("--") ? true : args[++i];
    } else files.push(args[i]);
  }
  return {named, files};
}

async function run(named) {
  const from = Number(named.from);
  const deals = Number(named.deals);
  if (!isCount(from) || !Number.isSafeInteger(deals) || deals < 1 || deals > MAX_DEALS_PER_RUN) {
    throw new Error(`--from <seed> and --deals 1..${MAX_DEALS_PER_RUN} are required`);
  }
  const commit = gitOut("rev-parse", `${named.commit ?? "HEAD"}^{commit}`);
  const out = resolve(ROOT, named.out ?? join(REPORT_DIR, `showdown-${commit.slice(0, 12)}-s${from}-${from + deals - 1}.json`));
  if (existsSync(out)) throw new Error(`${relative(ROOT, out)} exists; receipts are never overwritten`);
  const runnerText = readFileSync(fileURLToPath(import.meta.url));
  const committed = git(["rev-parse", `${commit}:${SELF}`]);
  const runner = {path: SELF, sha256: sha256(runnerText), node: process.version,
    committedAtCommit: committed.status === 0 && committed.stdout.trim() === gitOut("hash-object", SELF)};
  const dir = snapshot(commit);
  try {
    const engine = await loadEngine(dir);
    const started = Date.now();
    const played = playDeals(engine, from, deals);
    const elapsedMs = Date.now() - started;
    const report = buildReport({commit, engine: engineIds(commit), run: played, from, deals, generatedAt: new Date().toISOString(), runner, elapsedMs});
    const problems = reportProblems(report);
    if (problems.length) throw new Error(`generated receipt failed its own check: ${problems.join("; ")}`);
    mkdirSync(dirname(out), {recursive: true});
    writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
    console.log(`${relative(ROOT, out)}: ${report.games} games, cowboy ${report.results.cowboy}, wizard ${report.results.wizard}, draw ${report.results.draw}, ${elapsedMs} ms`);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

const pct = (x) => (x === null ? "n/a" : `${(100 * x).toFixed(1)}%`);
const rate = (c) => (c.games ? `${c.wins}/${c.games} (${pct(c.wins / c.games)})` : "0 games");

async function verify(named, files) {
  const dir = resolve(ROOT, REPORT_DIR);
  const paths = files.length ? files.map((file) => resolve(ROOT, file))
    : existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".json")).sort().map((file) => join(dir, file)) : [];
  const checked = [];
  const engines = new Map();
  try {
    for (const path of paths) {
      const name = relative(ROOT, path);
      let report;
      try { report = JSON.parse(readFileSync(path, "utf8")); } catch (error) { checked.push({name, problems: [`not readable JSON: ${error.message}`]}); continue; }
      let problems = reportProblems(report);
      let shippable = false;
      if (!problems.length) ({problems, shippable} = provenance(report));
      if (!problems.length && named.rerun) {
        if (!engines.has(report.commit)) { const snap = snapshot(report.commit); engines.set(report.commit, {dir: snap, engine: await loadEngine(snap)}); }
        problems = rerunProblems(report, engines.get(report.commit).engine, named.rerun === "all" ? Infinity : Number(named.rerun));
      }
      checked.push({name, report, problems, shippable});
    }
  } finally {
    for (const {dir: snap} of engines.values()) rmSync(snap, {recursive: true, force: true});
  }
  const counted = checked.filter((c) => !c.problems.length && c.shippable);
  const summary = combine(counted.map(({name, report}) => ({name, report})));
  const failed = checked.filter((c) => c.problems.length);
  const ok = paths.length > 0 && !failed.length && !summary.problems.length;
  if (named.json) {
    console.log(JSON.stringify({ok, receipts: checked.map(({name, problems, shippable}) => ({name, problems, shippable})), ...summary}, null, 1));
    return ok;
  }
  for (const c of checked) console.log(`${c.problems.length ? "FAIL" : c.shippable ? "ok  " : "ok (not behind HEAD, not counted)"} ${c.name}${c.problems.length ? `: ${c.problems.join("; ")}` : ""}`);
  for (const problem of summary.problems) console.log(`FAIL ${problem}`);
  console.log(`Unique duels: ${summary.uniqueGames} (replays: ${named.rerun ? `first ${named.rerun} deals of each receipt` : "none"}).`);
  for (const g of summary.groups) {
    console.log(`\nEngine ${g.engine.tree.slice(0, 12)} / specs ${g.engine.specBlob.slice(0, 12)}, ${g.bot}, decks ${g.decks}; commits ${g.commits.map((c) => c.slice(0, 12)).join(", ")}`);
    console.log(`  Seeds ${g.seedRanges.map((r) => `${r.from}-${r.to}`).join(", ")}: ${g.uniqueGames} unique games of ${g.rawGames} recorded (${g.duplicateGames} duplicates not counted).`);
    const ci = g.faction.cowboyWilson95;
    console.log(`  Faction (not a per-card estimate): cowboy ${g.faction.cowboy}, wizard ${g.faction.wizard}, draw ${g.faction.draw}; Cowboy share of decided ${pct(g.faction.cowboyShareOfDecided)}, Wilson 95% ${ci ? `${pct(ci[0])}-${pct(ci[1])}` : "n/a"}. Seats: first ${g.seats.first}, second ${g.seats.second}.`);
    if (!g.coverage) continue;
    console.log(`  Per-card counts over ${g.perCardGames} games${g.perCardExcluded.length ? ` (left out for partial overlap: ${g.perCardExcluded.join(", ")})` : ""}. Coverage: ${g.coverage.inDeck}/${g.coverage.catalog} in a deck, ${g.coverage.drawn} drawn, ${g.coverage.played} played; never in a deck (unknown): ${g.coverage.missing.join(", ") || "none"}.`);
    console.log("  type | in deck wins/games | drawn wins/games | played wins/games");
    for (const [type, row] of Object.entries(g.perCard).sort()) {
      if (row.inDeck.games) console.log(`  ${type} | ${rate(row.inDeck)} | ${rate(row.drawn)} | ${rate(row.played)}`);
    }
  }
  console.log("\nNo card-band verdict: the per-card metric for the 45-55% target is not chosen; in-deck rates equal the faction rate under fixed decks, and drawn/played rates are selection-biased.");
  if (!paths.length) console.log("FAIL no receipts found");
  return ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...rest] = process.argv.slice(2);
  const {named, files} = options(rest);
  try {
    if (command === "run") await run(named);
    else if (command === "verify") process.exitCode = (await verify(named, files)) ? 0 : 1;
    else { console.error("Usage: node scripts/balance-evidence.mjs run --from <seed> --deals <n> [--commit <ref>] [--out <file>] | verify [files...] [--rerun <deals>|all] [--json]"); process.exitCode = 2; }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
