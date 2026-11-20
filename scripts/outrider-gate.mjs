// K-011 Outrider gate: semantic freshness for the Outrider decision claims before any Camp link is shown.
// A claim is "at case <id>, the ride arm and the fight arm each end as results.json records". This script replays
// both arms of every case through the shipped session (src/match/showdown-outrider.js) in this tree and compares:
//   1. each arm's outcome (winner, final turn, both Bases) with the measured results.json;
//   2. each arm's full event transcript digest with the committed receipt (docs/evidence/outrider-gate/receipt.json).
// File hashes are recorded for the reader but decide nothing: refreshing them cannot make a changed line fresh,
// and an edit that leaves both lines identical stays fresh. Any missing file, throw or difference = stale.
//   node scripts/outrider-gate.mjs --check            exit 1 when a claim is stale; exit 0 when fresh or when no cases exist
//   node scripts/outrider-gate.mjs --write            write the receipt, only when every outcome matches results.json
//   --dir <path>                                       the decision directory (default experiments/showdown-outrider/decision)
//                                                      (results.json or results/observed.json, see LAYOUTS)
//   --receipt <path>                                   the receipt (default docs/evidence/outrider-gate/receipt.json)
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, relative} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {ARMS, playArm} from "../src/match/showdown-outrider.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_DIR = "experiments/showdown-outrider/decision";
export const DEFAULT_RECEIPT = "docs/evidence/outrider-gate/receipt.json";
// Two accepted layouts. The search worker's (../contract.json): replay.json {label: {seed, prefix, at, choices}},
// results/observed.json {label: {ride, fight}}, decision.js policy(view, legal). The gate's own (../gate-contract.md,
// used by the test fixture): replay.json {cases: [{id, setup, seed, prefix, at, arms}]}, results.json, policy.js continuation.
const LAYOUTS = [
  {replay: "replay.json", results: "results/observed.json", policy: "decision.js", fn: "policy"},
  {replay: "replay.json", results: "results.json", policy: "policy.js", fn: "continuation"},
];
// The files the claims run through, hashed for the record only.
const SOURCES = ["src/game/showdown/rules.js", "src/game/showdown/cards.js", "src/game/card-specs.generated.js", "src/game/showdown/progress.js",
  "src/game/showdown/trail.js", "src/game/showdown/contract.js", "src/match/showdown-session.js", "src/match/showdown-outrider.js"];

const sha = (text) => createHash("sha256").update(text).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One case list in the gate's shape, from either layout.
function normalCases(replay) {
  if (Array.isArray(replay.cases)) return replay.cases;
  return Object.entries(replay).map(([id, c]) => ({id, setup: {wins: 2}, seed: c.seed, prefix: c.prefix, at: c.at, arms: c.choices}));
}

// Reads the frozen decision files. Returns {missing: [...]} when no layout is complete.
export async function loadDecision(dir = DEFAULT_DIR, root = ROOT) {
  const abs = join(root, dir);
  const layout = LAYOUTS.find((l) => [l.replay, l.results, l.policy].every((f) => existsSync(join(abs, f))));
  if (!layout) return {dir, missing: [LAYOUTS[0].replay, LAYOUTS[0].results, LAYOUTS[0].policy].filter((f) => !existsSync(join(abs, f)))};
  const read = (f) => JSON.parse(readFileSync(join(abs, f), "utf8"));
  const continuation = (await import(pathToFileURL(join(abs, layout.policy)).href))[layout.fn];
  if (typeof continuation !== "function") throw new Error(`${dir}/${layout.policy} exports no ${layout.fn}(view, legal)`);
  const files = Object.fromEntries([layout.replay, layout.results, layout.policy].map((f) => [`${dir}/${f}`, sha(readFileSync(join(abs, f)))]));
  return {dir, missing: [], cases: normalCases(read(layout.replay)), results: read(layout.results), continuation, files};
}

const resultFor = (results, id, arm) => (results.cases?.[id] ?? results[id])?.[arm] ?? null;
// The measured fields only: winner and final turn always, both Bases when the measurement recorded them.
const measuredPart = (outcome, measured) => (measured.bases ? outcome : {winner: outcome.winner, turn: outcome.turn});
const pick = ({winner, turn, bases}) => (bases ? {winner, turn, bases: {cowboy: bases.cowboy, wizard: bases.wizard}} : {winner, turn});

// Replays every case and arm. Pure apart from the engine run; returns one row per case.
export function replayAll({cases, results, continuation}) {
  return cases.map((entry) => {
    const row = {id: entry.id, arms: {}, problems: []};
    for (const arm of ARMS) {
      try {
        const {outcome, transcript} = playArm(entry, arm, continuation);
        const measured = resultFor(results, entry.id, arm);
        row.arms[arm] = {outcome, transcript: sha(JSON.stringify(transcript))};
        if (!measured) row.problems.push(`${arm}: no measured result`);
        else if (!same(measuredPart(outcome, measured), pick(measured))) row.problems.push(`${arm}: replayed ${JSON.stringify(measuredPart(outcome, measured))} but measured ${JSON.stringify(pick(measured))}`);
      } catch (error) { row.problems.push(`${arm}: ${error.message}`); }
    }
    return row;
  });
}

// Fresh rows: outcomes match the measurement and transcripts match the receipt. Everything else is stale.
export function judge(rows, receipt) {
  return rows.map((row) => {
    const problems = [...row.problems];
    const recorded = receipt?.cases?.find((c) => c.id === row.id);
    if (!receipt) problems.push("no receipt");
    else if (!recorded) problems.push("not in the receipt");
    else for (const arm of ARMS) {
      if (row.arms[arm] && recorded.arms?.[arm]?.transcript !== row.arms[arm].transcript) problems.push(`${arm}: line differs from the receipt`);
    }
    return {id: row.id, fresh: problems.length === 0, problems};
  });
}

export function sourceHashes(root = ROOT) {
  return Object.fromEntries(SOURCES.map((f) => [f, sha(readFileSync(join(root, f)))]));
}

// What the build may ship: the replay setup of fresh cases only (no outcome, no transcript). [] when anything is off.
export async function verifiedForBuild({dir = DEFAULT_DIR, receiptPath = DEFAULT_RECEIPT, root = ROOT} = {}) {
  try {
    const decision = await loadDecision(dir, root);
    if (decision.missing.length) return {cases: [], note: `no frozen Outrider cases in ${dir} (missing ${decision.missing.join(", ")})`};
    const receipt = existsSync(join(root, receiptPath)) ? JSON.parse(readFileSync(join(root, receiptPath), "utf8")) : null;
    const verdicts = judge(replayAll(decision), receipt);
    const fresh = new Set(verdicts.filter((v) => v.fresh).map((v) => v.id));
    const stale = verdicts.filter((v) => !v.fresh);
    return {cases: decision.cases.filter((c) => fresh.has(c.id)).map(({id, setup, seed, prefix, at}) => ({id, setup, seed, prefix, at})),
      note: stale.length ? `withheld stale: ${stale.map((v) => `${v.id} (${v.problems.join("; ")})`).join(", ")}` : `${fresh.size} verified`};
  } catch (error) { return {cases: [], note: `gate error, nothing shipped: ${error.message}`}; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const dir = opt("--dir", DEFAULT_DIR), receiptPath = opt("--receipt", DEFAULT_RECEIPT);
  const decision = await loadDecision(dir);
  const receiptFile = join(ROOT, receiptPath);
  const receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : null;
  if (decision.missing.length) {
    // No candidate: nothing is claimed and the Camp shows no Outrider link. A leftover receipt is a stale claim.
    console.log(`Outrider gate: no frozen cases in ${dir} (missing ${decision.missing.join(", ")}); no Camp link.`);
    if (receipt?.cases?.length) { console.error(`stale: ${receiptPath} records ${receipt.cases.length} case(s) but their files are missing`); process.exit(1); }
    process.exit(0);
  }
  const rows = replayAll(decision);
  if (args.includes("--write")) {
    const bad = rows.filter((r) => r.problems.length);
    if (bad.length) { for (const r of bad) console.error(`refused: ${r.id}: ${r.problems.join("; ")}`); process.exit(1); }
    const out = {schema: "outrider-gate-receipt/1", decision: decision.files, sources: sourceHashes(),
      note: "Transcript digests are sha256 of each arm's full event list; source hashes are informational only.",
      cases: rows.map(({id, arms}) => ({id, arms}))};
    mkdirSync(dirname(receiptFile), {recursive: true});
    writeFileSync(receiptFile, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${relative(ROOT, receiptFile)} (${rows.length} case(s), both arms matched the measured results)`);
    process.exit(0);
  }
  const verdicts = judge(rows, receipt);
  if (args.includes("--json")) console.log(JSON.stringify(verdicts, null, 2));
  for (const v of verdicts) console.log(`${v.fresh ? "fresh" : "STALE"} ${v.id}${v.problems.length ? `: ${v.problems.join("; ")}` : ""}`);
  const stale = verdicts.filter((v) => !v.fresh).length;
  console.log(`Outrider gate: ${verdicts.length - stale} fresh, ${stale} stale${stale ? "; stale cases get no Camp link" : ""}.`);
  process.exit(stale ? 1 : 0);
}
