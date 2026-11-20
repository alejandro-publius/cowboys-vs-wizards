// K-011: the Outrider section of the Sheriff's Ledger, assembled at build time from the gate's verdicts
// (scripts/outrider-gate.mjs), the search worker's research record and the checked-in Night Watch receipt.
// Fail closed: a measured outcome or research number is included only when every curated case is fresh now.
// The page gets this object through build-graybox.mjs (__CVW_OUTRIDER_LEDGER__); the build also writes it to
// dist/outrider-ledger.json as the build receipt.
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {dirname, join, normalize} from "node:path";
import {cardOf} from "../src/game/showdown/cards.js";
import {createShowdownSession} from "../src/match/showdown-session.js";
import {outriderDuel} from "../src/match/showdown-outrider.js";

// Same text as build-sheriffs-ledger.mjs laTime (not imported: that module loads the whole Ledger's inputs).
const LA = new Intl.DateTimeFormat("en-US", {timeZone: "America/Los_Angeles", year: "numeric", month: "long", day: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short"});
function laTime(iso) {
  const p = Object.fromEntries(LA.formatToParts(new Date(iso)).map(({type, value}) => [type, value]));
  return `${p.month} ${p.day}, ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod} ${p.timeZoneName}`;
}

export const NIGHT_WATCH_RECEIPT = "docs/evidence/night-shift/receipt.json";
// The file the Night Watch simulator imports (apps/night-watch/backend/showdown_sim.mjs) and hashes as rulesBlob.
export const NIGHT_WATCH_ENTRY = "prototypes/showdown/rules.js";
export const OUTRIDER_ENTRY = "src/match/showdown-outrider.js";

// Relative static and dynamic imports of a module's text.
const importsOf = (text) => [...text.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1]);

// The relative-import closure of `entry`, read through `read(path)` (null when absent). Sorted paths.
export function closure(entry, read) {
  const seen = new Set(), todo = [entry];
  while (todo.length) {
    const file = todo.pop();
    if (seen.has(file)) continue;
    const text = read(file);
    if (text === null) continue;
    seen.add(file);
    for (const spec of importsOf(text)) todo.push(normalize(join(dirname(file), spec)));
  }
  return [...seen].sort();
}

const git = (root, args) => { try { return execFileSync("git", args, {cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}); } catch { return null; } };

// Byte identity of the engine the Night Watch run measured (its commit) against this tree's working files.
export function engineIdentity(commit, root) {
  if (!commit || git(root, ["cat-file", "-e", `${commit}^{commit}`]) === null) return {checked: false, reason: `commit ${commit?.slice(0, 7) ?? "?"} is not in this checkout`};
  const atCommit = closure(NIGHT_WATCH_ENTRY, (f) => git(root, ["show", `${commit}:${f}`]));
  const here = closure(NIGHT_WATCH_ENTRY, (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : null));
  const files = [...new Set([...atCommit, ...here])].sort();
  const blob = (f) => git(root, ["rev-parse", "--verify", "--quiet", `${commit}:${f}`])?.trim() ?? null;
  const now = (f) => (existsSync(join(root, f)) ? git(root, ["hash-object", "--", f])?.trim() ?? null : null);
  const differ = files.filter((f) => blob(f) !== now(f));
  const outrider = closure(OUTRIDER_ENTRY, (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : null));
  const entryBlob = now(NIGHT_WATCH_ENTRY);
  return {checked: true, files: files.length, same: differ.length === 0, differ, entryBlob, notMeasured: outrider.filter((f) => !files.includes(f))};
}

export function nightWatch(root) {
  const path = join(root, NIGHT_WATCH_RECEIPT);
  if (!existsSync(path)) return null;
  const r = JSON.parse(readFileSync(path, "utf8"));
  const engine = engineIdentity(r.candidate.commit, root);
  return {source: NIGHT_WATCH_RECEIPT, at: r.generatedAt, local: laTime(r.generatedAt), trigger: r.trigger, bot: r.bot,
    commit: r.candidate.commit, rulesBlob: r.candidate.rulesBlob, seeds: {from: r.seeds.from, to: r.seeds.to}, games: r.seeds.games,
    engine, rulesBlobMatch: engine.checked ? engine.entryBlob === r.candidate.rulesBlob : null};
}

const SIDE = {cowboy: "Cowboys", wizard: "Wizards"};
const boardText = (side) => side.board.map((t) => (t ? `${cardOf(t.cardId).name} ${t.health}${t.cover ? " (cover)" : ""}` : "empty")).join(" · ");

// The public picture at a case's landing, from the replay itself (names, orbs, Bases only).
function position(entry) {
  const {seed, duel} = outriderDuel(entry);
  const view = createShowdownSession({seed, duel}).view();
  return {turn: view.turn, bases: {cowboy: view.sides.cowboy.base, wizard: view.sides.wizard.base},
    cowboy: boardText(view.sides.cowboy), wizard: boardText(view.sides.wizard)};
}

// Aggregate research counts from the search worker's range files; null when any is missing.
function research(root, dir) {
  const read = (f) => { const p = join(root, dir, "results", f); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };
  const ranges = ["search-1000-1099.json", "search-1100-1199.json", "holdout-1200-1299.json"].map(read);
  const cue = read("cue.json");
  if (ranges.some((r) => !r) || !cue) return null;
  const sum = (key) => ranges.reduce((n, r) => n + (r.counts[key] ?? r.counts.kinds?.[key] ?? 0), 0);
  const holdout = ranges[2];
  return {tried: sum("tried"), reached: sum("branch"), rideOnly: sum("ride-only"), fightOnly: sum("fight-only"),
    cue: `${cue.rule.feature} ${cue.rule.op} ${cue.rule.threshold} → fight`, derivedOn: cue.derivedFrom, fit: {correct: cue.fit.correct, flips: cue.fit.flips},
    holdout: {range: `${holdout.range.from}-${holdout.range.to}`, correct: holdout.score.correct, flips: holdout.score.flips,
      alwaysRide: holdout.score.alwaysRide, alwaysFight: holdout.score.alwaysFight, supported: holdout.supported},
    record: dir};
}

// curated: {camp, compare: [id, id]}. verdicts: judge() rows. decision: loadDecision(). verified: ids shipped as links.
export function outriderLedger({curated, verdicts, decision, root, dir}) {
  const base = {schema: "outrider-ledger/1", nightWatch: nightWatch(root), record: dir};
  if (!decision || decision.missing?.length) return {...base, status: "missing", statusText: "No Outrider cases are recorded for this build, so there is nothing to compare.", positions: []};
  const byId = Object.fromEntries(verdicts.map((v) => [v.id, v]));
  const stale = curated.compare.filter((id) => !byId[id]?.fresh);
  if (stale.length) {
    return {...base, status: "stale", positions: [],
      statusText: `The Outrider comparison no longer replays as measured in this build (${stale.join(", ")}), so its results and links are withheld. `
        + "Run node scripts/outrider-gate.mjs --check for the details."};
  }
  const entries = Object.fromEntries(decision.cases.map((c) => [c.id, c]));
  const measured = (id, arm) => { const m = (decision.results.cases?.[id] ?? decision.results[id])[arm]; return {winner: m.winner, turn: m.turn}; };
  return {...base, status: "fresh",
    statusText: `Both positions replay in this build exactly as measured (${verdicts.filter((v) => v.fresh).length} of ${verdicts.length} recorded cases fresh).`,
    // Public positions and measured results are kept apart: the position objects never carry an outcome.
    positions: curated.compare.map((id, i) => ({id, label: `Position ${i + 1}`, ...position(entries[id])})),
    results: Object.fromEntries(curated.compare.map((id) => [id, {ride: measured(id, "ride"), fight: measured(id, "fight")}])),
    research: research(root, dir), sides: SIDE};
}
