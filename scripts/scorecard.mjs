// Step 0 of the December 4 Showdown evidence plan as one auditable command: a row per target with the
// measured value, the target and PASS or FAIL.
//
//   npm run scorecard                      text rows; exit 1 when any target fails (2 on a usage error)
//   node scripts/scorecard.mjs --json      the same rows as JSON, for CI
//   node scripts/scorecard.mjs --offline   no GitHub or live-site requests; those rows fail as unavailable
//   node scripts/scorecard.mjs --log       Stop hook (.kiro/hooks/dec4-scorecard.json): appends one timestamped
//                                          line to docs/SCORECARD.md, always exits 0 and never re-enters itself
//
// A row passes only on evidence measured in this run. Missing, malformed or unreachable evidence fails with a
// reason; "unavailable" (could not be measured now) is reported apart from a measured 0, and both fail.
// Requests run in parallel, each bounded by NET_MS, so a run stays well under 60 seconds. The evidence each
// row accepts is described beside its code and in docs/SCORECARD.md, and pinned by
// tests/game/dec4-scorecard.test.js.
import {execFile, execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {appendFileSync, existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {dirname, join, relative, resolve, sep} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {promisify} from "node:util";
import {SHOWDOWN_SPECS} from "../src/game/card-specs.generated.js";
import {linkProblem, runChecks} from "./contest-submission-check.mjs";
import {bundleSealIntact} from "./night-review.mjs";
import {canonicalPhase} from "./saloon-activity.mjs";
import {reportProblems} from "./balance-evidence.mjs";
import {inBand} from "./showdown-balance-contract.mjs";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NET_MS = 15_000;
const execFileAsync = promisify(execFile);

// The Step 0 targets as the plan states them (docs/SCORECARD.md quotes the wording).
export const TARGETS = Object.freeze({
  shall: 4000, prs: 300, reviews: 100, duels: 10_000_000, band: Object.freeze([45, 55]), properties: 100, hooks: 8, agents: 8,
});

const posix = (path) => path.split(sep).join("/");
const rel = (root, file) => posix(relative(root, file));
const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return undefined; } };
const readText = (file) => { try { return readFileSync(file, "utf8"); } catch { return ""; } };
const int = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const SHA = /^[0-9a-f]{40}$/;
function git(root, args, input) {
  try { return execFileSync("git", args, {cwd: root, encoding: "utf8", input, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 64 << 20}); } catch { return null; }
}
const reasonOf = (error) => error?.killed || error?.name === "TimeoutError" ? `timed out after ${NET_MS / 1000} s`
  : error?.code === "ENOENT" ? "command not installed"
  : String(error?.stderr || error?.cause?.code || error?.message || error).trim().split("\n")[0].slice(0, 160);

// A row passes only when it was measured and met its target.
function row(id, name, target, {value, pass = false, status = "measured", reason = "", details}) {
  return {id, name, value, target, status, pass: status === "measured" && pass === true, reason, ...(details === undefined ? {} : {details})};
}
const unavailable = (id, name, target, reason, details) => row(id, name, target, {value: "unavailable", status: "unavailable", reason, details});

async function fetchText(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(NET_MS), headers: {"user-agent": "cvw-scorecard"}});
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.text();
}

// ---------------------------------------------------------------- SHALL lines
// A requirement line is a numbered item carrying SHALL: a list number ("3." or "3.4") or identifier ("NSB-1:",
// "R1.2", or a multi-part ID such as "CARD-COWBOY-BILLY-01:" or "**CARD-WIZARD-HEX-01.**" as scripts/trace.mjs reads it) with its indented
// continuation lines, or an identifier table row ("| CL-1 | ... |"). It is substantial with three or more words
// besides SHALL and NOT, and counted once per distinct normalized text across .kiro/specs/*/requirements.md.
// The raw count of physical lines containing SHALL stays in the reason for comparison with older receipts.
const ID = String.raw`(?:\*\*)?(?:\d+(?:\.\d+)*[.)]?|[A-Z][A-Za-z]*(?:-[A-Z][A-Za-z0-9]*)*-?\d+(?:\.\d+)*[.:]?)(?:\*\*)?:?`;
const LIST_LINE = new RegExp(String.raw`^\s*(?:[-*+]\s+)?${ID}\s+(.+)$`);
const TABLE_LINE = new RegExp(String.raw`^\s*\|\s*${ID}\s*\|(.+)$`);

// The numbered SHALL items of one requirements file, as normalized text.
export function requirementLines(markdown) {
  const items = [];
  let open = null;
  for (const line of markdown.split(/\r?\n/)) {
    const table = TABLE_LINE.exec(line), list = !table && LIST_LINE.exec(line);
    if (table) { items.push({text: table[1].split("|").find((cell) => /\bSHALL\b/.test(cell)) ?? ""}); open = null; }
    else if (list) items.push(open = {text: list[1]});
    else if (open && /^\s+\S/.test(line) && !/^\s*(?:[-*+]\s|#|\|)/.test(line)) open.text += ` ${line.trim()}`;
    else open = null;
  }
  return items.filter((item) => /\bSHALL\b/.test(item.text)).map((item) => item.text.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim());
}
const substantial = (text) => text.split(" ").filter((word) => !/^\W*(?:SHALL|NOT)?\W*$/.test(word)).length >= 3;

export function measureShall(root = ROOT) {
  const specs = join(root, ".kiro/specs");
  const files = existsSync(specs) ? readdirSync(specs).map((dir) => join(specs, dir, "requirements.md")).filter((file) => existsSync(file)).sort() : [];
  let raw = 0, numbered = 0, short = 0;
  const distinct = new Set();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    raw += text.split(/\r?\n/).filter((line) => /\bSHALL\b/.test(line)).length;
    for (const item of requirementLines(text)) {
      numbered += 1;
      if (substantial(item)) distinct.add(item.toLowerCase());
      else short += 1;
    }
  }
  const value = distinct.size, repeated = numbered - short - value;
  return row("shall", "SHALL requirement lines in .kiro/specs/*/requirements.md (distinct, numbered, substantial)", `>= ${TARGETS.shall}`, {
    value, pass: value >= TARGETS.shall,
    reason: `${files.length} files; compatibility raw counts: ${raw} physical lines contain SHALL, ${numbered} numbered items carry SHALL, ${short} too short, ${repeated} repeated`,
    details: {files: files.length, raw, numbered, short, repeated},
  });
}

// ---------------------------------------------------------------- Night Shift pull requests
// Counted: GitHub reports the PR merged with a merge commit, it carries the night-shift label, and its body
// cites the full bundleSha256 of a sealed Night Shift review bundle (scripts/night-review.mjs) checked in
// here. Each seal backs one PR, so an opened or repeated PR without its own sealed review never counts.
// Attribution is reported as recorded: the PR author from GitHub, and the commit authors and Co-Authored-By
// trailers of the merged commits from local git (null when the merge commit is not in this clone).
export function originRepo(root = ROOT) {
  const url = git(root, ["remote", "get-url", "origin"])?.trim() ?? "";
  return /github\.com[/:]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url)?.[1] ?? null;
}

export function sealedBundles(root = ROOT) {
  const base = join(root, "docs/evidence"), seals = new Map();
  if (!existsSync(base)) return seals;
  for (const entry of readdirSync(base, {recursive: true})) {
    if (!/(^|[\\/])bundle\.json$/.test(String(entry))) continue;
    const bundle = readJson(join(base, String(entry)));
    if (bundle?.schema === "night-review/bundle@1" && /^[0-9a-f]{64}$/.test(bundle.bundleSha256 ?? "") && bundleSealIntact(bundle)) {
      seals.set(bundle.bundleSha256, `docs/evidence/${posix(String(entry))}`);
    }
  }
  return seals;
}

// Authors and Co-Authored-By names of the commits a merge brought in (oid^1..oid; a squash is the one commit).
// Without the first parent (root commit or shallow clone) only the merge commit itself is read.
export function localAttribution(root, oid) {
  if (!SHA.test(oid ?? "")) return null;
  const format = "--format=%an%x1f%(trailers:key=Co-Authored-By,valueonly,separator=%x1e)%x1d";
  const out = git(root, ["log", format, `${oid}^1..${oid}`]) ?? git(root, ["log", "-1", format, oid]);
  if (out === null) return null;
  const records = out.split("\x1d").map((r) => r.trim()).filter(Boolean).map((r) => r.split("\x1f"));
  return {authors: [...new Set(records.map(([name]) => name).filter(Boolean))],
    coAuthors: [...new Set(records.flatMap(([, trailers = ""]) => trailers.split("\x1e").map((v) => v.replace(/<[^>]*>/, "").trim()).filter(Boolean)))]};
}

export function auditNightShiftPrs(prs, seals, attributionOf = () => null) {
  const used = new Set(), counted = [], rejected = [];
  for (const pr of [...prs].sort((a, b) => a.number - b.number)) {
    if (!pr.mergedAt || !pr.mergeCommit?.oid) { rejected.push({number: pr.number, reason: "not merged"}); continue; }
    const seal = (String(pr.body ?? "").match(/\b[0-9a-f]{64}\b/g) ?? []).find((sha) => seals.has(sha) && !used.has(sha));
    if (!seal) { rejected.push({number: pr.number, reason: "cites no unused sealed Night Shift bundle in this checkout"}); continue; }
    used.add(seal);
    const who = attributionOf(pr.mergeCommit.oid);
    counted.push({number: pr.number, bundle: seals.get(seal), author: pr.author?.login ?? null, mergeCommit: pr.mergeCommit.oid,
      commitAuthors: who?.authors ?? null, coAuthors: who?.coAuthors ?? null});
  }
  return {counted, rejected};
}

async function measurePrs(root, offline) {
  const id = "night-shift-prs", name = "Merged night-shift PRs whose Night Shift review is sealed in the repo", target = `>= ${TARGETS.prs}`;
  const repo = originRepo(root);
  if (!repo) return unavailable(id, name, target, "origin is not a GitHub remote");
  if (offline) return unavailable(id, name, target, "offline: GitHub not queried");
  let prs;
  try {
    const {stdout} = await execFileAsync("gh", ["pr", "list", "--repo", repo, "--state", "merged", "--label", "night-shift", "--limit", "1000",
      "--json", "number,body,mergedAt,mergeCommit,author"], {timeout: NET_MS, maxBuffer: 256 << 20, env: {...process.env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1"}});
    prs = JSON.parse(stdout);
    if (!Array.isArray(prs)) throw new Error("gh returned no list");
  } catch (error) {
    return unavailable(id, name, target, `gh pr list failed: ${reasonOf(error)}`);
  }
  const {counted, rejected} = auditNightShiftPrs(prs, sealedBundles(root), (oid) => localAttribution(root, oid));
  const attributed = counted.filter((pr) => pr.commitAuthors !== null).length;
  return row(id, name, target, {
    value: counted.length, pass: counted.length >= TARGETS.prs,
    reason: `${prs.length}${prs.length >= 1000 ? " (list capped)" : ""} merged with the night-shift label on ${repo}; ${counted.length} cite their own sealed review bundle; ${attributed} with commit authorship readable in local git`,
    details: {repo, labeledMerged: prs.length, counted, rejected: rejected.slice(0, 100)},
  });
}

// ---------------------------------------------------------------- written reviews
// A review is .kiro/specs/<spec>/<name>-review.md with a "Status:" line naming a review outcome and at least one
// finding of five or more words. A finding is a list item under a Findings heading, or an identified finding
// heading ("## E1. Draws shrink the measured first-seat skew") as the expert panel writes them. A review that
// claims an approving outcome while one of its identified findings still says "**Status:** open" is rejected,
// so open findings are never counted as approved. Reviews with the same findings count once.
const OUTCOME = /^(approved|accepted|answered|changes[ -]requested|rejected|blocked|open|resolved|fixed|pass(ed)?|fail(ed)?)$/i;
const APPROVING = /^(approved|accepted|resolved|fixed|pass(ed)?)$/i;
const FINDING_HEADING = /^#{2,6}\s+([A-Z]{1,3}\d+)[.:]\s+(.+?)\s*#*$/;
const enough = (item) => item.split(/\s+/).length >= 5 && !/^(none|n\/a|tbd|todo|no findings)\b/i.test(item);
function findingsOf(text) {
  const lines = text.split(/\r?\n/), start = lines.findIndex((line) => /^#{1,6}\s+findings\b/i.test(line));
  const out = [];
  if (start >= 0) for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const item = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line)?.[1].trim();
    if (item && enough(item)) out.push(item);
  }
  return out;
}
// Identified finding headings with the outcome each section records ("- **Status:** open. ..."), or null.
function headedFindings(text) {
  const out = [];
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const heading = FINDING_HEADING.exec(line);
    if (heading) { out.push({id: heading[1], text: `${heading[1]}. ${heading[2]}`, status: null}); continue; }
    if (/^#{1,6}\s/.test(line)) { out.push(null); continue; }
    const last = out.at(-1), status = /^\s*[-*+]?\s*\*\*status:\*\*\s*([a-z]+)/i.exec(line)?.[1];
    if (last && status && last.status === null) last.status = status.toLowerCase();
  }
  return out.filter((f) => f && enough(f.text.slice(f.id.length + 2)));
}

export function measureReviews(root = ROOT) {
  const specs = join(root, ".kiro/specs");
  const files = existsSync(specs) ? readdirSync(specs, {withFileTypes: true}).filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(specs, d.name)).filter((f) => f.endsWith("-review.md")).map((f) => `.kiro/specs/${d.name}/${f}`)).sort() : [];
  const seen = new Set(), rejected = [], counted = [];
  for (const file of files) {
    const text = readText(join(root, file));
    const status = /^[\s>*-]*\**status\**\s*:\s*\**\s*([a-z][a-z -]*?)\s*\**\s*$/im.exec(text)?.[1];
    const headed = headedFindings(text), findings = [...findingsOf(text), ...headed.map((f) => f.text)];
    const open = headed.filter((f) => f.status === "open").map((f) => f.id);
    const problem = !status ? "no Status: line" : !OUTCOME.test(status) ? `status "${status}" is not a review outcome`
      : !findings.length ? "no finding of five or more words under a Findings heading or an identified finding heading"
      : APPROVING.test(status) && open.length ? `status "${status}" claims approval while findings ${open.join(", ")} are open` : null;
    if (problem) { rejected.push({file, reason: problem}); continue; }
    const digest = createHash("sha256").update(findings.join("\n").toLowerCase()).digest("hex");
    if (seen.has(digest)) { rejected.push({file, reason: "same findings as an earlier review"}); continue; }
    seen.add(digest);
    counted.push({file, status: status.toLowerCase(), findings: findings.length, open});
  }
  return row("reviews", "Written spec reviews (.kiro/specs/*/*-review.md) with a status and findings", `>= ${TARGETS.reviews}`, {
    value: seen.size, pass: seen.size >= TARGETS.reviews,
    reason: `${files.length} review files found; ${rejected.length} rejected`, details: {files: files.length, counted, rejected},
  });
}

// ---------------------------------------------------------------- balance reports: duels and card band
// reports/balance/*.json, schema cvw-balance-report/1 (every field required unless optional):
//   {schema, ruleset: "showdown", commit: <40-hex commit the games ran on>, bot, decks,
//    seeds: {from, to, gamesPerDeal}, games: (to - from + 1) * gamesPerDeal,
//    results: {cowboy, wizard, draw} summing to games, generatedAt: <ISO time>,
//    cards (optional): {<catalog type>: {games, wins}}}
// The checked-in night-watch-receipt/1 (candidate and baseline samples) is read for compatibility.
// Shippable: the commit is in the history behind HEAD and holds src/game/showdown and the card specs. A duel's
// identity is that engine (tree + card-spec blob), bot, decks, games per deal and seed, so duplicated,
// cumulative or overlapping reports, and a baseline identical to its candidate, are counted once.
// shortcut: totals are cross-checked, not recomputed from per-game outcomes; require an outcome file in the
// contract once a balance lane writes one.
export const BALANCE_DIR = "reports/balance";
export const COMPAT_RECEIPTS = ["docs/evidence/night-shift/receipt.json"];

export function balanceFiles(root = ROOT) {
  const dir = join(root, BALANCE_DIR);
  const reports = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => join(dir, f)) : [];
  return [...reports, ...COMPAT_RECEIPTS.map((f) => join(root, f)).filter((f) => existsSync(f))];
}

function samplesOf(report) {
  if (report?.schema === "cvw-balance-report/1") {
    const s = report.seeds ?? {};
    return [{side: null, ruleset: report.ruleset, commit: report.commit, bot: report.bot, decks: report.decks, from: s.from, to: s.to,
      gamesPerDeal: s.gamesPerDeal, games: report.games, results: report.results, cards: report.cards, at: report.generatedAt}];
  }
  if (report?.schema === "night-watch-receipt/1") {
    return ["candidate", "baseline"].map((side) => {
      const sample = report.samples?.[side] ?? {};
      return {side, ruleset: report.mode, commit: report[side]?.commit, bot: report.bot, decks: report.decks ?? "night-watch", from: report.seeds?.from,
        to: report.seeds?.to, gamesPerDeal: report.seeds?.gamesPerDeal, games: sample.games,
        results: {cowboy: sample.cowboy, wizard: sample.wizard, draw: sample.draw}, cards: undefined, at: report.generatedAt};
    });
  }
  return null;
}

function sampleProblem(s) {
  if (s.ruleset !== "showdown") return "ruleset is not showdown";
  if (!SHA.test(s.commit ?? "")) return "commit is not a full 40-hex sha";
  if (typeof s.bot !== "string" || !s.bot || typeof s.decks !== "string" || !s.decks) return "bot or decks missing";
  if (!int(s.from) || !int(s.to) || s.to < s.from || !int(s.gamesPerDeal, 1)) return "seeds need integers from <= to and gamesPerDeal >= 1";
  if (!int(s.games, 1) || s.games !== (s.to - s.from + 1) * s.gamesPerDeal) return "games differs from seeds x gamesPerDeal";
  const r = s.results ?? {};
  if (![r.cowboy, r.wizard, r.draw].every((v) => int(v)) || r.cowboy + r.wizard + r.draw !== s.games) return "results do not sum to games";
  if (Number.isNaN(Date.parse(s.at))) return "generatedAt is not a time";
  return null;
}

// Engine identity and shipped state for each commit, from one cat-file call and the history behind HEAD.
function engines(root, commits) {
  const list = [...new Set(commits)], out = new Map();
  if (!list.length) return out;
  const input = `${list.flatMap((c) => [`${c}:src/game/showdown`, `${c}:src/game/card-specs.generated.js`]).join("\n")}\n`;
  const lines = git(root, ["cat-file", "--batch-check"], input)?.split("\n") ?? [];
  const history = new Set(git(root, ["rev-list", "HEAD"])?.split("\n").filter(Boolean) ?? []);
  list.forEach((commit, i) => {
    const [tree, blob] = [lines[2 * i], lines[2 * i + 1]].map((line) => /^([0-9a-f]{40}) (?:tree|blob) /.exec(line ?? "")?.[1] ?? null);
    out.set(commit, {engine: tree && blob ? `${tree}+${blob}` : null, shipped: history.has(commit)});
  });
  return out;
}

// Number of seeds in the union of inclusive [from, to] ranges.
export function seedUnion(ranges) {
  let total = 0, end = -1;
  for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (to <= end) continue;
    total += to - Math.max(from, end + 1) + 1;
    end = to;
  }
  return total;
}

export function measureBalance(root = ROOT, files = balanceFiles(root)) {
  const rejected = [], samples = [];
  for (const file of files) {
    const report = readJson(file), list = samplesOf(report), source = rel(root, file);
    if (!list) { rejected.push({file: source, reason: report === undefined ? "not JSON" : "unknown schema"}); continue; }
    if (report.schema === "cvw-balance-report/1" && Object.hasOwn(report, "cardStudy")) {
      const problems = reportProblems(report);
      if (problems.length) {
        rejected.push({file: source, reason: problems.join("; ")});
        continue;
      }
    }
    for (const s of list) {
      const problem = sampleProblem(s);
      if (problem) rejected.push({file: source, side: s.side, reason: problem});
      else samples.push({...s, file: source});
    }
  }
  const info = engines(root, samples.map((s) => s.commit));
  const groups = new Map(), accepted = [];
  let claimed = 0;
  for (const s of samples) {
    const {engine, shipped} = info.get(s.commit);
    if (!engine || !shipped) {
      rejected.push({file: s.file, side: s.side, reason: `commit ${s.commit.slice(0, 12)} ${engine ? "is not in the history behind HEAD" : "or its Showdown engine files are not in this repository"}`});
      continue;
    }
    claimed += s.games;
    const key = [engine, s.bot, s.decks, s.gamesPerDeal].join("|");
    if (!groups.has(key)) groups.set(key, {gamesPerDeal: s.gamesPerDeal, ranges: []});
    groups.get(key).ranges.push([s.from, s.to]);
    accepted.push(s);
  }
  const duels = [...groups.values()].reduce((sum, g) => sum + seedUnion(g.ranges) * g.gamesPerDeal, 0);
  // The newest shippable measurement of each catalog card.
  const catalog = new Set(SHOWDOWN_SPECS.map((spec) => spec.type)), cards = new Map(), cardProblems = [];
  for (const s of accepted) for (const [type, m] of Object.entries(s.cards ?? {})) {
    if (!catalog.has(type)) { cardProblems.push({file: s.file, type, reason: "not in the card catalog"}); continue; }
    if (!int(m?.games, 1) || !int(m?.wins) || m.wins > m.games || m.games > s.games) { cardProblems.push({file: s.file, type, reason: "bad games/wins"}); continue; }
    const prev = cards.get(type);
    if (!prev || Date.parse(s.at) > Date.parse(prev.at)) cards.set(type, {games: m.games, wins: m.wins, at: s.at, file: s.file});
  }
  return {files: files.map((f) => rel(root, f)), duels, claimed, accepted: accepted.length, groups: groups.size, rejected, cards, cardProblems};
}

export function duelRow(b) {
  return row("duels", `Deduplicated shippable Showdown duels (${BALANCE_DIR} + checked-in Night Watch receipt)`, `>= ${TARGETS.duels}`, {
    value: b.duels, pass: b.duels >= TARGETS.duels,
    reason: `${b.files.length} files, ${b.accepted} shippable samples in ${b.groups} engine/bot/deck groups; ${b.claimed} games claimed, ${b.claimed - b.duels} duplicate or overlapping; ${b.rejected.length} samples rejected`,
    details: {files: b.files, claimed: b.claimed, rejected: b.rejected},
  });
}

export function bandRow(b) {
  const [lo, hi] = TARGETS.band;
  const cards = SHOWDOWN_SPECS.map(({type}) => {
    const m = b.cards.get(type);
    return m ? {type, rate: Math.round(10000 * m.wins / m.games) / 100, inBand: inBand(100 * m.wins / m.games, TARGETS.band), games: m.games, at: m.at, file: m.file} : {type, rate: null, inBand: false};
  });
  const inside = cards.filter((c) => c.inBand).length, unknown = cards.filter((c) => c.rate === null).length;
  return row("card-band", `Catalog cards whose latest measured win rate is ${lo}-${hi}% (unmeasured = unknown)`, `${cards.length}/${cards.length}`, {
    value: `${inside}/${cards.length}`, pass: cards.length > 0 && inside === cards.length,
    reason: `${unknown} unknown, ${cards.length - inside - unknown} outside the band; per-card wins/games from the newest shippable report, not faction shares`,
    details: {cards, problems: b.cardProblems},
  });
}

// ---------------------------------------------------------------- fast-check properties
// reports/properties/latest.json, schema cvw-property-receipt/1:
//   {schema, commit: <40-hex commit tested, in this repository>, generatedAt,
//    properties: [{id, file: <test file here that imports fast-check>, status: "passed", numRuns: >= 1, seed}]}
// A property counts once per id when it passed after at least one run. Property names in test files, and
// skipped, failed, interrupted or zero-run entries never count. For compatibility a fresh passing release-gate
// stamp (scripts/contest-release-gate.mjs status) counts the properties its fast-check line names.
export const PROPERTY_RECEIPT = "reports/properties/latest.json";

export function auditPropertyReceipt(receipt, root = ROOT) {
  const passed = new Map(), rejected = [];
  if (receipt?.schema !== "cvw-property-receipt/1") return {passed, rejected: [{reason: "schema is not cvw-property-receipt/1"}]};
  if (!SHA.test(receipt.commit ?? "") || git(root, ["cat-file", "-t", receipt.commit])?.trim() !== "commit") {
    return {passed, rejected: [{reason: "commit is not a commit in this repository"}]};
  }
  const fastCheck = new Map();
  const isFastCheck = (file) => {
    if (!fastCheck.has(file)) fastCheck.set(file, /^[\w./-]+\.(?:m?js|cjs|ts)$/.test(file) && !file.split("/").includes("..")
      && /["']fast-check["']/.test(readText(join(root, file))));
    return fastCheck.get(file);
  };
  for (const p of Array.isArray(receipt.properties) ? receipt.properties : []) {
    const id = typeof p?.id === "string" ? p.id.trim() : "", file = typeof p?.file === "string" ? p.file : "";
    const problem = !id ? "no id" : p.status !== "passed" ? `status ${JSON.stringify(p.status ?? null)}` : !int(p.numRuns, 1) ? "no executed runs"
      : !isFastCheck(file) ? `${file || "no file"} is not a fast-check test in this checkout` : passed.has(id) ? "duplicate id" : null;
    if (problem) rejected.push({id: id || null, reason: problem});
    else passed.set(id, {file, numRuns: p.numRuns});
  }
  return {passed, rejected};
}

async function gateStamp(root) {
  try {
    const {stdout} = await execFileAsync(process.execPath, ["scripts/contest-release-gate.mjs", "status"], {cwd: root, timeout: NET_MS, maxBuffer: 8 << 20});
    const {fresh, stamp} = JSON.parse(stdout);
    if (!stamp) return {ids: [], note: "no release-gate stamp"};
    if (!fresh || stamp.ok !== true) return {ids: [], note: `release-gate stamp ${stamp.ok ? "is stale for this tree" : "recorded a failure"}, not counted`};
    const m = /^fast-check ([\w-]+(?:,[\w-]+)*) seed -?\d+ x(\d+)$/.exec(stamp.checks?.[0] ?? "");
    return m ? {ids: m[1].split(","), note: `fresh passing release-gate stamp ran ${m[1]} x${m[2]}`} : {ids: [], note: "stamp names no fast-check run"};
  } catch (error) {
    return {ids: [], note: `release-gate status unavailable: ${reasonOf(error)}`};
  }
}

export function propertiesRow(root, stamp, file = join(root, PROPERTY_RECEIPT)) {
  const present = existsSync(file);
  const {passed, rejected} = present ? auditPropertyReceipt(readJson(file), root) : {passed: new Map(), rejected: []};
  const ids = new Set([...passed.keys(), ...stamp.ids]);
  return row("properties", "Distinct passing fast-check properties from executed receipts", `>= ${TARGETS.properties}`, {
    value: ids.size, pass: ids.size >= TARGETS.properties,
    reason: `${present ? `${PROPERTY_RECEIPT}: ${passed.size} passed, ${rejected.length} rejected` : `no ${PROPERTY_RECEIPT}`}; ${stamp.note}`,
    details: {receipt: present ? PROPERTY_RECEIPT : null, counted: [...ids], rejected: rejected.slice(0, 100)},
  });
}

// ---------------------------------------------------------------- native hooks
// .kiro/hooks/*.json in the v1 format the Kiro CLI reads ({version: "v1", hooks: [{trigger, action}]}) and IDE
// *.kiro.hook files ({when: {type}, then}). A trigger counts when an enabled hook names it, it is one of the
// automatic triggers scripts/saloon-activity.mjs knows (canonicalPhase; IDE names map onto them, Manual is not
// automatic) and its action exists (a command's script must be in the repo). The Saloon is enabled when
// night-shift-activity.json runs scripts/saloon-activity.mjs.
// shortcut: the user's list of nine triggers is not in the repo or the Step 0 text; these are the nine automatic
// Kiro IDE triggers in canonical names. Replace the list if the user's nine differ.
export const LISTED_TRIGGERS = Object.freeze([
  ["UserPromptSubmit", "Prompt Submit"], ["Stop", "Agent Stop"], ["PreToolUse", "Pre Tool Use"], ["PostToolUse", "Post Tool Use"],
  ["PostFileCreate", "File Create"], ["PostFileSave", "File Save"], ["PostFileDelete", "File Delete"],
  ["PreTaskExecution", "Pre Task Execution"], ["PostTaskExecution", "Post Task Execution"],
]);

// Kiro CLI 3.5.0 /hooks listed the short v1 spellings and not these long ones. IDE names and historical event
// payloads still resolve through canonicalPhase; only a v1 config using the long form is flagged, never counted.
// Registration only: no task lifecycle hook has been observed firing.
const UNREGISTERED_V1_TASK = /^(?:Pre|Post)TaskExecution$/i;

function scriptMissing(root, command) {
  const script = /^\s*(?:node|sh|bash)\s+(?:-\S+\s+)*([\w./-]+\.(?:mjs|cjs|js|sh))(?:\s|$)/.exec(command ?? "")?.[1];
  return script && !existsSync(join(root, script)) ? script : null;
}

export function measureHooks(root = ROOT) {
  const dir = join(root, ".kiro/hooks");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".kiro.hook")).sort() : [];
  const used = new Map(), problems = [];
  let saloon = false;
  for (const file of files) {
    const data = readJson(join(dir, file)), ide = file.endsWith(".kiro.hook");
    const hooks = ide ? (data?.when ? [{trigger: data.when.type, enabled: data.enabled, action: data.then?.command ?? data.then?.prompt}] : null)
      : data?.version === "v1" && Array.isArray(data.hooks) ? data.hooks.map((h) => ({trigger: h?.trigger, enabled: h?.enabled, action: h?.action?.command})) : null;
    if (!hooks) { problems.push(`${file}: neither a v1 hook file nor an IDE .kiro.hook`); continue; }
    for (const hook of hooks) {
      if (hook.enabled === false) continue;
      const phase = canonicalPhase(hook.trigger), missing = scriptMissing(root, hook.action);
      if (!ide && UNREGISTERED_V1_TASK.test(String(hook.trigger))) { problems.push(`${file}: ${hook.trigger} is not a registered v1 trigger (native /hooks lists PreTaskExec/PostTaskExec)`); continue; }
      if (!phase) { problems.push(`${file}: unsupported trigger ${JSON.stringify(hook.trigger ?? null)}`); continue; }
      if (typeof hook.action !== "string" || !hook.action.trim() || missing) { problems.push(`${file}: ${hook.trigger} has no runnable action${missing ? ` (${missing} missing)` : ""}`); continue; }
      if (!used.has(phase)) used.set(phase, []);
      used.get(phase).push({file, surface: ide ? "IDE" : "CLI"});
      if (file === "night-shift-activity.json" && /scripts\/saloon-activity\.mjs/.test(hook.action)) saloon = true;
    }
  }
  const listed = LISTED_TRIGGERS.map(([trigger, ideName]) => {
    const where = used.get(trigger) ?? [];
    return {trigger, ide: ideName, cliFiles: [...new Set(where.filter((w) => w.surface === "CLI").map((w) => w.file))], ideFiles: [...new Set(where.filter((w) => w.surface === "IDE").map((w) => w.file))]};
  });
  const ideCount = files.filter((f) => f.endsWith(".kiro.hook")).length;
  return row("hooks", "Distinct supported hook triggers in .kiro/hooks, with the Saloon enabled", `>= ${TARGETS.hooks} + Saloon`, {
    value: used.size, pass: used.size >= TARGETS.hooks && saloon,
    reason: `${files.length - ideCount} CLI v1 files, ${ideCount} IDE .kiro.hook files; Saloon ${saloon ? "enabled" : "NOT enabled"}; ${listed.filter((t) => t.cliFiles.length || t.ideFiles.length).length}/9 listed triggers configured (configuration only, not proof of execution); ${problems.length} problems`,
    details: {triggers: Object.fromEntries([...used].map(([phase, where]) => [phase, where.map((w) => `${w.surface} ${w.file}`)])), listed, problems},
  });
}

// ---------------------------------------------------------------- agents restricted to their own write paths
// Counted: an agent with a file-write tool whose fs_write allow list holds only paths rooted in a fixed file or
// directory, whose shell (when it has one) is denied or allowed only named commands with a fixed argument
// before any wildcard, whose allowed paths no other counted agent shares, and that a tracked workflow or
// script invokes by name. Read-only roles (no write tool, or fs_write denied everywhere) are listed, not counted,
// even when they run allowlisted shell commands.
const ALL_TOOLS = new Set(["*", "@builtin"]);
const hasTool = (tools, ...names) => tools.some((t) => ALL_TOOLS.has(t) || names.includes(t));
const patterns = (rules, capability, effect) => rules.filter((r) => r?.capability === capability && r?.effect === effect).flatMap((r) => Array.isArray(r.match) ? r.match : []);
const catchAll = (p) => /^\*{1,2}$/.test(String(p).trim());
const narrowPath = (p) => typeof p === "string" && /^[\w.-]/.test(p.replace(/^(\.\/)+/, "")) && !p.startsWith("..") && !p.split("/").includes("..");
const narrowCommand = (c) => typeof c === "string" && c.trim() !== "" && (!c.includes("*") || c.slice(0, c.indexOf("*")).trim().split(/\s+/).filter(Boolean).length >= 2);

export function classifyAgent(config, invoked) {
  const tools = Array.isArray(config?.tools) ? config.tools : [];
  const rules = Array.isArray(config?.permissions?.rules) ? config.permissions.rules : [];
  const shell = hasTool(tools, "shell", "execute_bash");
  if (!hasTool(tools, "write", "fs_write") || patterns(rules, "fs_write", "deny").some(catchAll)) {
    return {class: "read-only", reason: shell ? "no file writes; allowlisted shell only" : "no write or shell tool"};
  }
  const paths = patterns(rules, "fs_write", "allow"), commands = patterns(rules, "shell", "allow");
  const shellFenced = !shell || patterns(rules, "shell", "deny").some(catchAll) || (commands.length > 0 && commands.every(narrowCommand));
  const problem = !paths.length ? "writes without an fs_write allow list" : !paths.every(narrowPath) ? `broad write path ${paths.find((p) => !narrowPath(p))}`
    : !shellFenced ? "shell is not fenced to named commands" : null;
  if (problem) return {class: "unprotected-writer", reason: problem, paths};
  return invoked ? {class: "protected", paths} : {class: "protected-inactive", reason: "no tracked workflow or script invokes it", paths};
}

const CODE = /\.(json|mjs|cjs|js|sh|py)$/;
const SKIP = /(^|\/)(node_modules|results|fixtures|\.artifacts|dist)(\/|$)/;
function invocationText(root) {
  const parts = [];
  for (const dir of [".kiro/workflows", "scripts", "experiments", "apps"]) {
    const base = join(root, dir);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, {recursive: true})) {
      const path = `${dir}/${posix(String(entry))}`;
      if (!CODE.test(path) || SKIP.test(path)) continue;
      const stat = statSync(join(root, path));
      if (stat.isFile() && stat.size <= 512 * 1024) parts.push(readFileSync(join(root, path), "utf8"));
    }
  }
  return parts.join("\n");
}

export function measureAgents(root = ROOT) {
  const dir = join(root, ".kiro/agents");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const text = invocationText(root);
  const agents = files.map((file) => {
    const config = readJson(join(dir, file));
    const name = typeof config?.name === "string" ? config.name : file.replace(/\.json$/, "");
    if (!config) return {name, class: "invalid", reason: "not JSON"};
    const invoked = new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`).test(text);
    return {name, ...classifyAgent(config, invoked)};
  });
  const owners = new Map();
  for (const a of agents) if (a.class === "protected") for (const p of a.paths) owners.set(p, [...(owners.get(p) ?? []), a.name]);
  for (const a of agents) {
    const shared = a.class === "protected" && a.paths.find((p) => owners.get(p).length > 1);
    if (shared) Object.assign(a, {class: "unprotected-writer", reason: `shares write path ${shared} with ${owners.get(shared).filter((n) => n !== a.name).join(", ")}`});
  }
  const count = (c) => agents.filter((a) => a.class === c).length;
  return row("agents", "Active agents restricted to their own write paths (shell included)", `>= ${TARGETS.agents}`, {
    value: count("protected"), pass: count("protected") >= TARGETS.agents,
    reason: `${files.length} agents: ${count("protected")} protected and invoked, ${count("protected-inactive")} protected but never invoked, ${count("unprotected-writer")} unprotected writers, ${count("read-only")} read-only (not counted)`,
    details: {agents},
  });
}

// ---------------------------------------------------------------- second game on packages/frontier-kit
// The second game is Boot Hill Poker, which scripts/stage-pages.mjs copies to /poker/. It passes when
// packages/frontier-kit exists, the game's modules import it, neither game imports the other (nor the kit
// either game), and the deployed /poker/ page or its app.js references frontier-kit.
// shortcut: the game's folder and route are fixed to the current stage-pages.mjs copy; update them if another
// app becomes the second game.
export const SECOND_GAME = "experiments/boot-hill-poker";
const KIT = "packages/frontier-kit";
const SHOWDOWN_DIRS = ["src", "prototypes/showdown"];
const SPECIFIER = /\b(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const inside = (path, dir) => path === dir || path.startsWith(`${dir}/`);

function moduleFiles(root, dir) {
  const base = join(root, dir);
  if (!existsSync(base)) return [];
  return readdirSync(base, {recursive: true}).map((e) => `${dir}/${posix(String(e))}`).filter((p) => /\.m?js$/.test(p) && !SKIP.test(p));
}
function importTargets(root, file) {
  return [...readText(join(root, file)).matchAll(SPECIFIER)].map((m) => m[1] ?? m[2])
    .map((spec) => spec.startsWith(".") ? posix(relative(root, resolve(root, dirname(file), spec))) : /(^|\/)frontier-kit(\/|$)/.test(spec) ? KIT : spec);
}

export function frontierKitLocal(root = ROOT) {
  const kit = existsSync(join(root, KIT, "package.json")) || existsSync(join(root, KIT, "index.js"));
  const staged = readText(join(root, "scripts/stage-pages.mjs")).includes(`${SECOND_GAME}/`);
  const importers = new Set(), cross = [];
  // The portable deal generator lives in src/game so archived duels include it.
  const sharedRng = "src/game/frontier-kit/seeded-rng.js";
  const crossing = (files, forbidden) => {
    for (const file of files) for (const target of importTargets(root, file)) {
      if (target !== sharedRng && forbidden.some((d) => inside(target, d))) cross.push(`${file} -> ${target}`);
    }
  };
  for (const file of moduleFiles(root, SECOND_GAME)) if (importTargets(root, file).some((t) => inside(t, KIT))) importers.add(file);
  crossing(moduleFiles(root, SECOND_GAME), SHOWDOWN_DIRS);
  crossing(SHOWDOWN_DIRS.flatMap((d) => moduleFiles(root, d)), [SECOND_GAME]);
  crossing([...moduleFiles(root, KIT), sharedRng], [...SHOWDOWN_DIRS, SECOND_GAME]);
  return {kit, staged, importers: [...importers], cross};
}

export function kitRow(local, site, live) {
  const id = "frontier-kit", name = "Live second game imports packages/frontier-kit; no cross-game imports", target = "yes";
  const localProblem = !local.kit ? `${KIT} missing` : !local.staged ? `${SECOND_GAME} is not staged by scripts/stage-pages.mjs`
    : !local.importers.length ? `${SECOND_GAME} does not import ${KIT}` : local.cross.length ? `${local.cross.length} cross-game imports` : null;
  if (localProblem) return row(id, name, target, {value: "no", reason: localProblem, details: local});
  if (!site) return row(id, name, target, {value: "no", reason: "no GitHub Pages URL tracked in README.md", details: local});
  if (live.error) return unavailable(id, name, target, `live /poker/ check: ${live.error}`, local);
  const deployed = live.value.some((text) => /frontier-kit/.test(text));
  return row(id, name, target, {value: deployed ? "yes" : "no", pass: deployed, reason: deployed ? `${site}poker/ references frontier-kit` : `${site}poker/ does not reference frontier-kit yet`, details: local});
}

// ---------------------------------------------------------------- submission basics
// Licence and .kiro/ come from scripts/contest-submission-check.mjs. The site and video URLs must be tracked
// (README.md, then the Devpost packet for the video); the site must answer, and the YouTube watch page must
// report a length under three minutes. The category must be named in docs/submission/devpost-packet.md.
const CATEGORIES = ["Resurrection", "Frankenstein", "Skeleton Crew", "Costume Contest"];
const PACKET = "docs/submission/devpost-packet.md";

export const siteUrl = (root = ROOT) => /https:\/\/[\w-]+\.github\.io\/[\w.-]+\//.exec(readText(join(root, "README.md")))?.[0] ?? null;
export function videoUrl(root = ROOT) {
  for (const file of ["README.md", PACKET]) {
    for (const url of readText(join(root, file)).match(/https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s)>\]"']+/g) ?? []) {
      if (!linkProblem("demo", url)) return {url, file, id: /(?:youtu\.be\/|[?&]v=|\/(?:shorts|embed|live)\/)([A-Za-z0-9_-]{11})/.exec(url)[1]};
    }
  }
  return null;
}
export const categoryOf = (root = ROOT) => /\*\*Category:\s*([^*]+?)\.?\*\*/i.exec(readText(join(root, PACKET)))?.[1].trim() ?? null;

function submissionRows(root, {site, siteFetch, video, videoFetch}) {
  const items = Object.fromEntries(runChecks(root).map((item) => [item.id, item]));
  const licence = items.license, kiro = ["kiro-tracked", "kiro-not-ignored", "kiro-json"].map((id) => items[id]);
  const rows = [
    row("submission-licence", "Submission: OSI licence tracked at the root", "yes", {value: licence?.status === "pass" ? "yes" : "no", pass: licence?.status === "pass", reason: licence?.detail ?? "not checked"}),
    row("submission-kiro", "Submission: .kiro/ tracked, not ignored, valid JSON", "yes", {value: kiro.every((i) => i?.status === "pass") ? "yes" : "no",
      pass: kiro.every((i) => i?.status === "pass"), reason: kiro.map((i) => i?.detail ?? "not checked").join("; ")}),
  ];
  const siteName = "Submission: tracked GitHub Pages URL answers";
  if (!site) rows.push(row("submission-site", siteName, "HTTP 200", {value: "none", reason: "no github.io URL in README.md"}));
  else if (siteFetch.error) rows.push(unavailable("submission-site", siteName, "HTTP 200", `${site}: ${siteFetch.error}`));
  else rows.push(row("submission-site", siteName, "HTTP 200", {value: "HTTP 200", pass: true, reason: site}));
  const videoName = "Submission: tracked public YouTube demo under three minutes";
  const length = videoFetch?.value && /"lengthSeconds":"(\d+)"/.exec(videoFetch.value)?.[1];
  if (!video) rows.push(row("submission-video", videoName, "< 180 s", {value: "none", reason: `no YouTube URL in README.md or ${PACKET}`}));
  else if (videoFetch.error || !length) rows.push(unavailable("submission-video", videoName, "< 180 s", `${video.url}: ${videoFetch.error ?? "the watch page shows no length"}`));
  else rows.push(row("submission-video", videoName, "< 180 s", {value: `${length} s`, pass: Number(length) < 180, reason: `${video.url} (from ${video.file})`}));
  const category = categoryOf(root);
  rows.push(row("submission-category", `Submission: category chosen in ${PACKET}`, CATEGORIES.join(" | "), {value: category ?? "none", pass: CATEGORIES.includes(category),
    reason: CATEGORIES.includes(category) ? "" : `"Category:" line says ${category ? `"${category}"` : "nothing"}`}));
  return rows;
}

// ---------------------------------------------------------------- the scorecard
export async function scorecard({root = ROOT, offline = false} = {}) {
  const started = Date.now();
  const site = siteUrl(root), video = videoUrl(root), kit = frontierKitLocal(root);
  const kitReady = kit.kit && kit.staged && kit.importers.length > 0 && kit.cross.length === 0;
  const request = (task) => offline ? Promise.resolve({error: "offline: not requested"}) : task().then((value) => ({value}), (error) => ({error: reasonOf(error)}));
  const pending = Promise.all([
    measurePrs(root, offline),
    gateStamp(root),
    site ? request(() => fetchText(site)) : null,
    video ? request(() => fetchText(`https://www.youtube.com/watch?v=${video.id}`)) : null,
    kitReady && site ? request(() => Promise.all([fetchText(`${site}poker/`), fetchText(`${site}poker/app.js`)])) : null,
  ]);
  const local = [measureShall(root), measureReviews(root), measureBalance(root), measureHooks(root), measureAgents(root)];
  const [prs, stamp, siteFetch, videoFetch, kitFetch] = await pending;
  const [shall, reviews, balance, hooks, agents] = local;
  const rows = [shall, prs, reviews, duelRow(balance), bandRow(balance), propertiesRow(root, stamp), hooks, agents, kitRow(kit, site, kitFetch),
    ...submissionRows(root, {site, siteFetch, video, videoFetch})];
  return {schema: "cvw-scorecard/1", generatedAt: new Date(started).toISOString(), head: git(root, ["rev-parse", "HEAD"])?.trim() ?? "unknown",
    offline, elapsedMs: Date.now() - started, ok: rows.every((r) => r.pass), rows};
}

export function format(card) {
  const lines = [`Dec 4 Step 0 scorecard: HEAD ${card.head.slice(0, 7)}, ${card.generatedAt}, ${(card.elapsedMs / 1000).toFixed(1)} s${card.offline ? ", offline" : ""}`];
  for (const r of card.rows) {
    lines.push(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(19)} value ${String(r.value).padEnd(11)} target ${String(r.target).padEnd(12)} ${r.name}${r.reason ? `: ${r.reason}` : ""}`);
    if (r.id === "hooks") for (const t of r.details.listed) lines.push(`        listed ${t.trigger} (IDE "${t.ide}"): CLI ${t.cliFiles.join(", ") || "none"}; IDE ${t.ideFiles.join(", ") || "none"}`);
  }
  lines.push(`${card.rows.filter((r) => r.pass).length} of ${card.rows.length} targets pass; exit ${card.ok ? 0 : 1}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- Stop-hook log
export const LOG = "docs/SCORECARD.md";
export function logLine(card, trigger) {
  const failing = card.rows.filter((r) => !r.pass).map((r) => `${r.id} ${r.value}`).join(", ");
  return `- ${card.generatedAt} \`${card.head.slice(0, 7)}\` ${trigger}: ${card.rows.filter((r) => r.pass).length}/${card.rows.length} pass; failing: ${failing || "none"} (${(card.elapsedMs / 1000).toFixed(1)} s)`;
}

function stdinEvent() {
  if (process.stdin.isTTY) return null;
  try { return JSON.parse(readFileSync(0, "utf8") || "null"); } catch { return null; }
}

// Never re-enters: a run inside another scorecard run (SCORECARD_ACTIVE) or a re-fired Stop (stop_hook_active)
// writes nothing. Always exits 0 so the agent's Stop is never blocked or looped.
export async function logMode({root = ROOT, offline = false, file = join(root, LOG)} = {}) {
  if (process.env.SCORECARD_ACTIVE) return 0;
  process.env.SCORECARD_ACTIVE = "1";
  const event = stdinEvent();
  if (event?.stop_hook_active) return 0;
  try {
    const card = await scorecard({root, offline});
    appendFileSync(file, `${logLine(card, event ? "Stop hook event" : "no hook event")}\n`);
    console.log(`scorecard: ${card.rows.filter((r) => r.pass).length}/${card.rows.length} pass; logged to ${rel(root, file)}`);
  } catch (error) {
    console.log(`scorecard: not logged (${reasonOf(error)})`);
  }
  return 0;
}

async function main(argv) {
  const flags = new Set(argv), known = ["--json", "--offline", "--log"];
  const unknown = argv.find((a) => !known.includes(a));
  if (unknown) { console.error(`scorecard: unknown argument ${unknown}; use ${known.join(" ")}`); return 2; }
  const offline = flags.has("--offline");
  if (flags.has("--log")) return logMode({offline});
  const card = await scorecard({offline});
  console.log(flags.has("--json") ? JSON.stringify(card, null, 2) : format(card));
  return card.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const code = await main(process.argv.slice(2));
  // Idle keep-alive sockets from fetch must not hold the run past its budget.
  process.stdout.write("", () => process.exit(code));
}
