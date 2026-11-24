// Saloon showcases: audits one finished native Card Forge or Agent Arena run and packages it as the
// showcase.json the Saloon drawer reads. Local CLI, plain Node, no network. It never runs a workflow,
// never edits the run folder and writes nothing but <outputDirectory>/showcase.json.
//
//   node scripts/saloon-showcases.mjs forge <absolute-artifacts-directory> <nativeWorkflowId> <outputDirectory>
//   node scripts/saloon-showcases.mjs arena <absolute-artifacts-directory> <nativeWorkflowId> <outputDirectory>
//   node scripts/saloon-showcases.mjs check-archive <directory-holding-showcase.json>
//
// The artifacts directory may be the run folder itself (.artifacts/card-forge, .artifacts/agent-arena),
// the .artifacts folder above it, or the project root. A run is refused when any file is missing,
// extra, a symbolic link, mistyped, failed, or disagrees with another file or with a recomputation.
// Forge: verdict.json must PASS, and every stored hash, draft, slot, seed record and summary must match.
// Arena: status.json must be a passing verify, file hashes and policy digests must match, and the
// series and the recorded replay are replayed with the real arena engine and must come out identical.
// check-archive re-audits a written showcase; for an arena showcase it replays the series and the
// replay from the stored playbooks with the pure arena engine.
// Exit status: 0 done, 1 refused or check failed, 2 usage.
import {createHash} from "node:crypto";
import {lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {dirname, isAbsolute, join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {DEALS, SEED_FROM, checkDraftText, checkRequest, decideVerdict, pairedFlips, summarizeGames} from "./card-forge.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SHOWCASE_FILE = "showcase.json";
export const FORGE_KIND = "saloon-showcase/forge@1";
export const ARENA_KIND = "saloon-showcase/arena@1";
export const FORGE_FILES = Object.freeze(["request.txt", "brief.json", "prepare.json", "draft.json", "verdict.json"]);
export const ARENA_PERSONAS = Object.freeze(["cautious-sheriff", "reckless-wizard"]);
export const ARENA_FILES = Object.freeze(["brief.json", "status.json", "results.json", "replay.json", ...ARENA_PERSONAS.map((p) => `playbooks/${p}.json`)]);
// The Forge shelf's bounds (src/ui/forge-shelf.js); checks stay within 12 grouped lines.
export const VIEW = Object.freeze({textMax: 2000, nameMax: 80, lineMax: 300, statMax: 99, checksMax: 12});
const SEATS = Object.freeze(["cowboy", "wizard"]);
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const WORKFLOW_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const USAGE = "usage: saloon-showcases.mjs forge|arena <absolute-artifacts-directory> <nativeWorkflowId> <outputDirectory> | check-archive <directory>";

export class Refusal extends Error {}
const need = (ok, message) => { if (!ok) throw new Refusal(message); };
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const count = (n) => Number.isInteger(n) && n >= 0;
// Sorted-key JSON, the same rule as experiments/agent-arena/playbook.js.
const canonical = (value) => JSON.stringify(value, (key, each) => (plain(each)
  ? Object.fromEntries(Object.keys(each).sort().map((name) => [name, each[name]])) : each));
const same = (a, b) => canonical(a) === canonical(b);
const utf8 = (bytes, label) => {
  try { return new TextDecoder("utf-8", {fatal: true}).decode(bytes); } catch { throw new Refusal(`${label} is not valid UTF-8`); }
};
const json = (bytes, label) => {
  try { return JSON.parse(utf8(bytes, label)); } catch (error) {
    if (error instanceof Refusal) throw error;
    throw new Refusal(`${label} is not valid JSON`);
  }
};
const date = (value, label) => {
  need(typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)), `${label} is not a recorded ISO date`);
  return value;
};
const inOrder = (...dates) => dates.every((d, i) => i === 0 || Date.parse(dates[i - 1]) <= Date.parse(d));
const gamesWord = (n) => `${n} game${n === 1 ? "" : "s"}`;

export function checkWorkflowId(id) {
  need(typeof id === "string" && WORKFLOW_ID.test(id), "nativeWorkflowId must be 1-128 letters, digits, '.', '_', ':' or '-', starting with a letter or digit");
  return id;
}

// ---- files ----

// The run folder: the first of <dir>/.artifacts/<name>, <dir>/<name> and <dir> that holds `marker`.
export function findRun(dir, name, marker) {
  need(typeof dir === "string" && isAbsolute(dir), "the artifacts directory must be an absolute path");
  for (const candidate of [join(dir, ".artifacts", name), join(dir, name), dir]) {
    const stat = lstatSync(candidate, {throwIfNoEntry: false});
    if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
    if (lstatSync(join(candidate, marker), {throwIfNoEntry: false})) return candidate;
  }
  throw new Refusal(`no ${name} run with ${marker} found at or under the artifacts directory`);
}

// Exactly the expected regular files (one folder level allowed), no links and nothing else.
export function readRun(dir, expected) {
  const files = {};
  const folders = new Set(expected.filter((rel) => rel.includes("/")).map((rel) => rel.split("/")[0]));
  const walk = (rel) => {
    for (const name of readdirSync(rel ? join(dir, rel) : dir).sort()) {
      const child = rel ? `${rel}/${name}` : name;
      const stat = lstatSync(join(dir, child));
      need(!stat.isSymbolicLink(), `${child} is a symbolic link`);
      if (stat.isDirectory()) {
        need(!rel && folders.has(name), `unexpected folder ${child}`);
        walk(child);
        continue;
      }
      need(stat.isFile() && expected.includes(child), `unexpected entry ${child}`);
      need(stat.size <= MAX_FILE_BYTES, `${child} is ${stat.size} bytes, far more than the producer writes`);
      files[child] = readFileSync(join(dir, child));
    }
  };
  walk("");
  for (const rel of expected) need(Buffer.isBuffer(files[rel]), `${rel} is missing`);
  return files;
}

export function writeShowcase(outDir, showcase, runDir) {
  need(typeof outDir === "string" && outDir.length > 0, "the output directory is missing");
  const out = resolve(outDir);
  const rel = relative(runDir, out);
  need(rel.startsWith("..") || isAbsolute(rel), "the output directory must lie outside the artifacts run folder");
  mkdirSync(out, {recursive: true});
  const file = join(out, SHOWCASE_FILE);
  const temporary = join(out, `.${SHOWCASE_FILE}.${process.pid}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify(showcase, null, 2) + "\n", {flag: "wx"});
    renameSync(temporary, file);
  } finally { rmSync(temporary, {force: true}); }
  return file;
}

// ---- Card Forge ----

// The verifier's check ids, grouped into the lines the shelf shows. Every id must be present and pass.
export const FORGE_CHECK_GROUPS = Object.freeze([
  {ids: ["request-unchanged", "brief-unchanged", "run-folder"], label: () => "Request and brief unchanged since prepare"},
  {ids: ["draft-schema"], label: () => "Draft fits the five-field schema and bounds"},
  {ids: ["slot-exists", "name-free"], label: () => "Base troop slot exists and the name is free"},
  {ids: ["baseline-compiles", "baseline-games"], label: () => "Unmodified snapshot compiled and its games ended legally"},
  {ids: ["snapshot-compiles"], label: () => "Variant compiled in a disposable snapshot"},
  {ids: ["engine-card", "slot-copies"], label: () => "Engine reads the variant's name, numbers and deck copies"},
  {ids: ["variant-games"], label: () => "Every variant game ended legally from both seats"},
  {ids: ["deterministic-replay"], label: () => "Seeded replays matched on both builds"},
  {ids: ["variant-played"], label: (s) => `Variant was summoned in ${s.gamesWithSlotSummoned} of ${gamesWord(s.games)}`},
  {ids: ["live-cards-unchanged"], label: () => "Live cards and engine files unchanged"},
]);
const FORGE_CHECK_IDS = FORGE_CHECK_GROUPS.flatMap((group) => group.ids);
export const forgeCheckIds = () => [...FORGE_CHECK_IDS];
export const forgeCheckLabels = (candidate) => FORGE_CHECK_GROUPS.map((group) => group.label(candidate));

// One build's game records: seeds from..to, each dealt once from each seat, all finished legally.
function checkForgeRecords(records, seeds, label) {
  need(plain(seeds) && seeds.from === SEED_FROM && seeds.deals === DEALS && seeds.to === SEED_FROM + DEALS - 1, `${label} seeds are not the verifier's ${SEED_FROM}..${SEED_FROM + DEALS - 1}`);
  need(Array.isArray(records) && records.length === DEALS * SEATS.length, `${label} has not exactly ${DEALS * SEATS.length} game records`);
  const seen = new Set();
  for (const game of records) {
    need(plain(game) && Number.isInteger(game.seed) && game.seed >= seeds.from && game.seed <= seeds.to && SEATS.includes(game.first), `${label} has a game outside the seeds or seats`);
    const key = `${game.seed}:${game.first}`;
    need(!seen.has(key), `${label} repeats seed ${game.seed} with ${game.first} first`);
    seen.add(key);
    need((game.winner === null || SEATS.includes(game.winner)) && ["base", "turn-cap"].includes(game.reason), `${label} seed ${game.seed}: winner or ending is not one the verifier accepts`);
    need(count(game.turns) && count(game.actions) && game.actions > 0 && count(game.slotSummons) && HEX64.test(game.digest ?? ""), `${label} seed ${game.seed}: turns, actions, summons or digest are malformed`);
  }
}

function checkSlot(slot, draft) {
  need(plain(slot) && slot.baseCard === draft.baseCard && SEATS.includes(slot.side) && count(slot.copies) && slot.copies > 0, "the verdict's slot is not the draft's base troop");
  need(plain(slot.before) && slot.before.kind === "troop" && slot.before.side === slot.side, "the verdict's base troop is not a troop on its side");
  need(same(slot.after, {...slot.before, name: draft.name, attack: draft.attack, health: draft.health, stars: draft.stars}), "the engine's variant card differs from the draft");
}

// files: {"request.txt": Buffer, ...} from a finished card-forge run. Returns the showcase or throws Refusal.
export function buildForgeShowcase(files, nativeWorkflowId) {
  const id = checkWorkflowId(nativeWorkflowId);
  for (const name of FORGE_FILES) need(Buffer.isBuffer(files?.[name]), `${name} is missing`);
  const prep = json(files["prepare.json"], "prepare.json");
  const brief = json(files["brief.json"], "brief.json");
  const verdict = json(files["verdict.json"], "verdict.json");
  need(plain(prep) && prep.schema === "card-forge/prepare@1" && COMMIT.test(prep.base ?? ""), "prepare.json is not a card-forge prepare record with a base commit");
  const requestSha256 = sha256(files["request.txt"]);
  need(requestSha256 === prep.requestSha256 && files["request.txt"].length === prep.requestBytes, "request.txt does not match the bytes prepare staged");
  const request = checkRequest(files["request.txt"]);
  need(!request.errors.length, `request.txt: ${request.errors.join("; ")}`);
  const briefSha256 = sha256(files["brief.json"]);
  need(briefSha256 === prep.briefSha256, "brief.json does not match what prepare wrote");
  need(plain(brief) && brief.schema === "card-forge/brief@1" && brief.base === prep.base && Array.isArray(brief.baseCards), "brief.json does not belong to this prepare record");
  const drafted = checkDraftText(utf8(files["draft.json"], "draft.json"), {allowed: brief.baseCards.map((card) => card?.baseCard)});
  need(!drafted.errors.length, `draft.json: ${drafted.errors.join("; ")}`);
  const draft = drafted.draft;

  need(plain(verdict) && verdict.schema === "card-forge/verdict@1", "verdict.json is not a card-forge verdict");
  need(Array.isArray(verdict.checks) && verdict.checks.every((c) => plain(c) && typeof c.id === "string" && typeof c.pass === "boolean"), "verdict.json checks are malformed");
  const decision = decideVerdict(verdict.checks);
  need(verdict.pass === true && verdict.verdict === "PASS" && decision.pass && Array.isArray(verdict.failed) && verdict.failed.length === 0,
    `the verifier did not pass this draft${decision.failed.length ? ` (failed: ${decision.failed.join(", ")})` : ""}`);
  need(verdict.applied === false, "verdict.json does not record a sandbox-only run");
  const ids = verdict.checks.map((c) => c.id);
  need(new Set(ids).size === ids.length && same([...ids].sort(), [...FORGE_CHECK_IDS].sort()), "verdict.json checks are not exactly the verifier's check set");
  need(same(verdict.draft, draft), "verdict.json was written for a different draft");
  need(plain(verdict.request) && verdict.request.sha256 === requestSha256, "verdict.json was written for a different request");
  need(verdict.base?.commit === prep.base, "verdict.json was written at a different base commit");
  const preparedAt = date(prep.createdAt, "prepare.json createdAt");
  const verifiedAt = date(verdict.createdAt, "verdict.json createdAt");
  need(inOrder(preparedAt, verifiedAt), "verdict.json is dated before prepare.json");
  checkSlot(verdict.slot, draft);
  const listed = brief.baseCards.find((card) => card?.baseCard === draft.baseCard);
  const {baseCard: _id, copies: listedCopies, ...listedCard} = listed;
  need(listedCopies === verdict.slot.copies && same(listedCard, verdict.slot.before), "the verdict's base troop differs from the one the brief listed");

  const games = verdict.games;
  need(plain(games) && plain(games.records), "verdict.json has no game records");
  const {baseline, variant} = games.records;
  checkForgeRecords(baseline, games.seeds, "baseline");
  checkForgeRecords(variant, games.seeds, "variant");
  need(same(summarizeGames(baseline, verdict.slot.side), games.baseline), "the baseline summary does not match its game records");
  need(same(summarizeGames(variant, verdict.slot.side), games.variant), "the variant summary does not match its game records");
  need(same(pairedFlips(baseline, variant), games.paired) && games.paired.unpaired === 0, "the paired results do not match the game records");

  const {before, after} = verdict.slot;
  const tool = plain(verdict.tool) ? verdict.tool : {};
  const showcase = {
    nativeWorkflowId: id,
    request: request.text,
    draft: {name: draft.name, baseCard: draft.baseCard, attack: draft.attack, health: draft.health, stars: draft.stars},
    verified: true,
    games: variant.length,
    source: `Card Forge native workflow ${id}; verifier passed ${verifiedAt} at base ${prep.base.slice(0, 12)}`,
    checks: forgeCheckLabels(games.variant),
    kind: FORGE_KIND,
    preparedAt, verifiedAt, baseCommit: prep.base,
    requestSha256, briefSha256, draftSha256: sha256(files["draft.json"]), verdictSha256: sha256(files["verdict.json"]),
    ...(HEX64.test(tool.script ?? "") ? {verifierScriptSha256: tool.script} : {}),
    ...(typeof tool.node === "string" && /^v[0-9][\w.-]{0,40}$/.test(tool.node) ? {node: tool.node} : {}),
    slot: {baseCard: verdict.slot.baseCard, side: verdict.slot.side, copies: verdict.slot.copies, before, after},
    seeds: {from: games.seeds.from, to: games.seeds.to, deals: games.seeds.deals}, seats: [...SEATS],
    baselineGames: games.baseline, candidateGames: games.variant, paired: games.paired,
    gameRecords: {baseline, candidate: variant},
  };
  auditForgeShowcase(showcase);
  return showcase;
}

// Re-checks a written forge showcase against the shelf's bounds and its own records.
export function auditForgeShowcase(sc) {
  need(plain(sc) && sc.kind === FORGE_KIND, "not a forge showcase");
  const id = checkWorkflowId(sc.nativeWorkflowId);
  need(isText(sc.request, VIEW.textMax) && !checkRequest(Buffer.from(sc.request, "utf8")).errors.length && sha256(Buffer.from(sc.request, "utf8")) === sc.requestSha256, "request is out of bounds or does not match requestSha256");
  need(plain(sc.draft) && !checkDraftText(JSON.stringify(sc.draft)).errors.length, "draft fails the draft schema");
  need(isText(sc.draft.name, VIEW.nameMax) && isText(sc.draft.baseCard, VIEW.nameMax) && ["attack", "health", "stars"].every((k) => count(sc.draft[k]) && sc.draft[k] <= VIEW.statMax), "draft is outside the shelf's bounds");
  need(sc.verified === true, "verified is not true");
  need(isText(sc.source, VIEW.lineMax) && sc.source.includes(id), "source is out of bounds or does not name the workflow");
  for (const key of ["requestSha256", "briefSha256", "draftSha256", "verdictSha256"]) need(HEX64.test(sc[key] ?? ""), `${key} is not a sha256`);
  need(COMMIT.test(sc.baseCommit ?? ""), "baseCommit is not a full commit hash");
  need(inOrder(date(sc.preparedAt, "preparedAt"), date(sc.verifiedAt, "verifiedAt")), "verifiedAt is before preparedAt");
  checkSlot(sc.slot, sc.draft);
  need(plain(sc.gameRecords), "gameRecords are missing");
  const {baseline, candidate} = sc.gameRecords;
  checkForgeRecords(baseline, sc.seeds, "baseline");
  checkForgeRecords(candidate, sc.seeds, "candidate");
  need(same(summarizeGames(baseline, sc.slot.side), sc.baselineGames), "baselineGames does not match its records");
  need(same(summarizeGames(candidate, sc.slot.side), sc.candidateGames), "candidateGames does not match its records");
  need(same(pairedFlips(baseline, candidate), sc.paired), "paired does not match the records");
  need(sc.games === candidate.length && sc.games === sc.candidateGames.games, "games is not the number of candidate games");
  need(sc.candidateGames.gamesWithSlotSummoned > 0, "the variant was never summoned");
  need(Array.isArray(sc.checks) && sc.checks.length <= VIEW.checksMax && sc.checks.every((c) => isText(c, VIEW.lineMax)) && same(sc.checks, forgeCheckLabels(sc.candidateGames)), "checks are not the verifier's grouped checks");
}

export function packageForge(artifactsDir, nativeWorkflowId, outDir) {
  checkWorkflowId(nativeWorkflowId);
  const dir = findRun(artifactsDir, "card-forge", "verdict.json");
  const showcase = buildForgeShowcase(readRun(dir, FORGE_FILES), nativeWorkflowId);
  return {file: writeShowcase(outDir, showcase, dir), showcase};
}

// ---- Agent Arena ----

// The referee and playbook modules from this checkout. Both load through the same URLs arena.mjs uses,
// so decide() accepts playbooks validated here.
export async function loadArenaEngine(root = ROOT) {
  const arena = await import(pathToFileURL(join(root, "experiments/agent-arena/arena.mjs")).href);
  const book = await import(pathToFileURL(join(root, "experiments/agent-arena/playbook.js")).href);
  return {
    playSeries: arena.playSeries, recordReplay: arena.recordReplay, summarize: arena.summarize, SEATS: arena.SEATS, MAX_REPLAY_STEPS: arena.MAX_REPLAY_STEPS,
    PERSONAS: book.PERSONAS, parsePlaybook: book.parsePlaybook, validatePlaybook: book.validatePlaybook, policyDigest: book.policyDigest,
  };
}

const personaOf = (engine, side) => Object.keys(engine.PERSONAS).find((p) => engine.PERSONAS[p].side === side);

function checkEngine(engine) {
  need(engine && same(Object.keys(engine.PERSONAS).sort(), [...ARENA_PERSONAS].sort()) && same(engine.SEATS, SEATS), "the arena engine's personas or seats are not the Saloon's");
}

function checkSeries(series) {
  need(plain(series) && Number.isInteger(series.from) && series.from >= 0 && Number.isInteger(series.deals) && series.deals > 0, "the series is malformed");
  return {from: series.from, deals: series.deals};
}

// Every game: in the series, one per (seed, first seat), winner and persona agree, action counts add up.
function checkArenaGames(engine, games, series) {
  need(Array.isArray(games) && games.length === series.deals * SEATS.length, `results.json does not hold exactly ${series.deals * SEATS.length} games`);
  const seen = new Set();
  for (const game of games) {
    need(plain(game) && Number.isInteger(game.seed) && game.seed >= series.from && game.seed < series.from + series.deals && SEATS.includes(game.first), "a game lies outside the series seeds or seats");
    const key = `${game.seed}:${game.first}`;
    need(!seen.has(key), `seed ${game.seed} with ${game.first} first is played twice`);
    seen.add(key);
    const tag = `seed ${game.seed}, ${game.first} first`;
    need([...SEATS, "draw"].includes(game.winner) && game.winnerPersona === (game.winner === "draw" ? null : personaOf(engine, game.winner)), `${tag}: winner and winning persona disagree`);
    need(typeof game.reason === "string" && count(game.turns) && game.turns > 0 && count(game.decisions) && game.decisions > 0, `${tag}: ending, turns or decisions are malformed`);
    need(plain(game.actions) && SEATS.every((side) => plain(game.actions[side]) && Object.values(game.actions[side]).every((n) => count(n) && n > 0)), `${tag}: action counts are malformed`);
    const total = SEATS.reduce((sum, side) => sum + Object.values(game.actions[side]).reduce((a, b) => a + b, 0), 0);
    need(total === game.decisions, `${tag}: action counts do not add up to its decisions`);
    need(plain(game.decisionsWithRuledOutActions) && SEATS.every((side) => count(game.decisionsWithRuledOutActions[side])), `${tag}: ruled-out counts are malformed`);
  }
}

// The replay's own decision fields: numbered in order, chosen index points at the recorded action.
function checkReplayShape(engine, replay, digests) {
  need(plain(replay) && replay.kind === "agent-arena-replay/1", "the replay is not an agent-arena replay");
  need(same(replay.personas, Object.fromEntries(SEATS.map((side) => [side, personaOf(engine, side)]))), "the replay's seats and personas do not match");
  need(same(replay.playbookDigests, digests), "the replay was played with other playbooks");
  need(Array.isArray(replay.steps) && replay.decisions === replay.steps.length && replay.steps.length > 0 && replay.steps.length <= engine.MAX_REPLAY_STEPS, "the replay's decision count does not match its steps");
  replay.steps.forEach((step, i) => {
    need(plain(step) && step.n === i + 1 && SEATS.includes(step.side) && step.persona === personaOf(engine, step.side)
      && Array.isArray(step.legal) && Number.isInteger(step.chosen) && step.chosen >= 0 && step.chosen < step.legal.length
      && same(step.legal[step.chosen], step.action) && step.type === step.action?.type && count(step.ruledOut) && Array.isArray(step.events),
    `replay step ${i + 1} has inconsistent decision fields`);
  });
  need(plain(replay.result) && plain(replay.finalBases) && count(replay.turns), "the replay has no recorded ending");
}

// Plays the series and records the replay again with the engine; both must be identical.
function recompute(engine, series, books, digests, {games = null, summary, replay}) {
  const again = engine.playSeries(series, books);
  if (games) need(same(again.games, games), "replaying the series gives different games");
  need(same(again.summary, summary), "replaying the series gives a different summary");
  need(same(engine.recordReplay(series, books, digests), replay), "recording the replay again gives a different replay");
}

// files: {"brief.json": Buffer, ..., "playbooks/<persona>.json": Buffer}. Returns the showcase or throws Refusal.
export function buildArenaShowcase(files, nativeWorkflowId, engine) {
  const id = checkWorkflowId(nativeWorkflowId);
  checkEngine(engine);
  for (const name of ARENA_FILES) need(Buffer.isBuffer(files?.[name]), `${name} is missing`);
  const brief = json(files["brief.json"], "brief.json");
  const status = json(files["status.json"], "status.json");
  const results = json(files["results.json"], "results.json");
  const replay = json(files["replay.json"], "replay.json");
  need(plain(status) && status.stage === "verified" && status.pass === true, "status.json does not record a passing verify");
  need(plain(brief) && brief.kind === "agent-arena-brief/1", "brief.json is not an agent-arena brief");
  need(plain(results) && results.kind === "agent-arena-results/1", "results.json is not agent-arena results");
  const preparedAt = date(brief.preparedAt, "brief.json preparedAt");
  const playedAt = date(results.playedAt, "results.json playedAt");
  const verifiedAt = date(status.at, "status.json at");
  need(inOrder(preparedAt, playedAt, verifiedAt), "the run's dates are out of order (prepared, played, verified)");
  need(plain(brief.engine) && plain(results.engine) && HEX64.test(results.engine.sha256 ?? "") && brief.engine.sha256 === results.engine.sha256 && brief.engine.fileCount === results.engine.fileCount, "the engine fingerprint at play differs from the one prepared");

  const series = checkSeries(results.series);
  need(plain(brief.series) && brief.series.from === series.from && brief.series.deals === series.deals && brief.series.games === series.deals * SEATS.length && same(brief.series.startingSeats, SEATS), "results.json series differs from the brief's");

  need(plain(results.playbooks) && same(Object.keys(results.playbooks).sort(), [...ARENA_PERSONAS].sort()), "results.json does not record exactly the two personas");
  const books = {}, policies = {}, digests = {}, fileSha256 = {};
  for (const persona of ARENA_PERSONAS) {
    const name = `playbooks/${persona}.json`;
    const text = utf8(files[name], name);
    const parsed = engine.parsePlaybook(text, persona);
    need(parsed.ok, `${name}: ${(parsed.errors ?? []).join("; ")}`);
    const recorded = results.playbooks[persona];
    fileSha256[persona] = sha256(text);
    digests[persona] = engine.policyDigest(parsed.playbook);
    need(plain(recorded) && recorded.fileSha256 === fileSha256[persona], `${name} changed after play`);
    need(recorded.policyDigest === digests[persona] && same(recorded.policy, parsed.playbook), `${persona} policy differs from the one played`);
    need(recorded.side === engine.PERSONAS[persona].side, `${persona} played the wrong seat`);
    books[recorded.side] = parsed.playbook;
    policies[persona] = parsed.playbook;
  }

  checkArenaGames(engine, results.games, series);
  need(same(engine.summarize(results.games), results.summary), "results.json summary does not match its games");
  need(status.games === results.games.length, "status.json game count differs from results.json");

  const replaySha256 = sha256(files["replay.json"]);
  need(plain(results.replay) && results.replay.sha256 === replaySha256, "replay.json differs from the digest results.json recorded");
  need(results.replay.seed === replay?.seed && results.replay.first === replay?.first, "replay.json is not the game results.json names");
  checkReplayShape(engine, replay, digests);
  need(status.replayDecisions === replay.decisions, "status.json replay decisions differ from replay.json");
  const game = results.games.find((g) => g.seed === replay.seed && g.first === replay.first);
  need(game && game.decisions === replay.decisions && game.turns === replay.turns && same(game.bases, replay.finalBases)
    && game.winner === (replay.result.winner ?? "draw") && game.reason === replay.result.reason, "the replay's ending differs from the series game it records");

  recompute(engine, series, books, digests, {games: results.games, summary: results.summary, replay});

  const showcase = {
    nativeWorkflowId: id,
    verified: true,
    summary: results.summary,
    replay,
    policies,
    kind: ARENA_KIND,
    source: `Agent Arena native workflow ${id}; verified ${verifiedAt}`,
    series, games: results.games.length,
    preparedAt, playedAt, verifiedAt,
    engine: {sha256: results.engine.sha256, fileCount: results.engine.fileCount},
    policyDigests: digests, playbookFileSha256: fileSha256,
    replaySha256, replayCanonicalSha256: sha256(canonical(replay)), resultsSha256: sha256(files["results.json"]),
  };
  auditArenaShowcase(showcase, engine, {recompute: false});
  return showcase;
}

// Re-checks a written arena showcase; with recompute, replays the series and the replay from its playbooks.
export function auditArenaShowcase(sc, engine, {recompute: replayAgain = true} = {}) {
  checkEngine(engine);
  need(plain(sc) && sc.kind === ARENA_KIND, "not an arena showcase");
  const id = checkWorkflowId(sc.nativeWorkflowId);
  need(sc.verified === true, "verified is not true");
  need(isText(sc.source, VIEW.lineMax) && sc.source.includes(id), "source is out of bounds or does not name the workflow");
  need(inOrder(date(sc.preparedAt, "preparedAt"), date(sc.playedAt, "playedAt"), date(sc.verifiedAt, "verifiedAt")), "the dates are out of order");
  need(plain(sc.engine) && HEX64.test(sc.engine.sha256 ?? "") && HEX64.test(sc.replaySha256 ?? "") && HEX64.test(sc.resultsSha256 ?? ""), "engine or file digests are malformed");
  need(plain(sc.policies) && same(Object.keys(sc.policies).sort(), [...ARENA_PERSONAS].sort()) && plain(sc.policyDigests) && same(Object.keys(sc.policyDigests).sort(), [...ARENA_PERSONAS].sort()), "policies are not exactly the two personas");
  const books = {};
  for (const persona of ARENA_PERSONAS) {
    const checked = engine.validatePlaybook(sc.policies[persona], persona);
    need(checked.ok && same(checked.playbook, sc.policies[persona]), `${persona} policy is not a validated plain playbook`);
    need(engine.policyDigest(checked.playbook) === sc.policyDigests[persona], `${persona} policy does not match its digest`);
    need(HEX64.test(sc.playbookFileSha256?.[persona] ?? ""), `${persona} playbook file digest is malformed`);
    books[engine.PERSONAS[persona].side] = checked.playbook;
  }
  const series = checkSeries(sc.series);
  checkReplayShape(engine, sc.replay, sc.policyDigests);
  need(sha256(canonical(sc.replay)) === sc.replayCanonicalSha256, "the replay does not match its recorded canonical digest");
  need(plain(sc.summary) && sc.summary.games === series.deals * SEATS.length && sc.games === sc.summary.games, "summary does not cover the series");
  if (replayAgain) recompute(engine, series, books, sc.policyDigests, {summary: sc.summary, replay: sc.replay});
}

export async function packageArena(artifactsDir, nativeWorkflowId, outDir, engine = null) {
  checkWorkflowId(nativeWorkflowId);
  const dir = findRun(artifactsDir, "agent-arena", "results.json");
  const files = readRun(dir, ARENA_FILES);
  const showcase = buildArenaShowcase(files, nativeWorkflowId, engine ?? await loadArenaEngine());
  return {file: writeShowcase(outDir, showcase, dir), showcase};
}

// ---- check-archive ----

export async function checkArchive(directory, engine = null) {
  need(typeof directory === "string" && directory.length > 0, "the directory is missing");
  const file = join(resolve(directory), SHOWCASE_FILE);
  const stat = lstatSync(file, {throwIfNoEntry: false});
  need(stat?.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_FILE_BYTES, `${SHOWCASE_FILE} is missing or not a regular file`);
  const showcase = json(readFileSync(file), SHOWCASE_FILE);
  if (showcase?.kind === FORGE_KIND) {
    auditForgeShowcase(showcase);
    return {kind: "forge", detail: `${gamesWord(showcase.games)} and summaries recomputed from the stored records; replays are not rerun (needs the verifier's snapshot)`};
  }
  if (showcase?.kind === ARENA_KIND) {
    auditArenaShowcase(showcase, engine ?? await loadArenaEngine());
    return {kind: "arena", detail: `${gamesWord(showcase.games)} and the ${showcase.replay.decisions}-decision replay recomputed with the arena engine`};
  }
  throw new Refusal(`${SHOWCASE_FILE} is not a forge or arena showcase`);
}

async function main(argv) {
  const [command, ...rest] = argv;
  if ((command === "forge" || command === "arena") && rest.length === 3) {
    const [dir, id, out] = rest;
    const {file, showcase} = command === "forge" ? packageForge(dir, id, out) : await packageArena(dir, id, out);
    console.log(`saloon-showcases: wrote ${file} for ${command} workflow ${id} (${gamesWord(showcase.games)})`);
    return 0;
  }
  if (command === "check-archive" && rest.length === 1) {
    const result = await checkArchive(rest[0]);
    console.log(`saloon-showcases: ${result.kind} showcase checks out: ${result.detail}`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (error) {
    console.error(`saloon-showcases: refused: ${error instanceof Refusal ? error.message : error.stack}`);
    process.exitCode = 1;
  }
}
