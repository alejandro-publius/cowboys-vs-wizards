// Field-trial scout: measures every legal ±1 attack/health/stars neighbor of every whitelisted troop of the
// active contest-balance attempt, at the attempt's frozen base, on both scout cohorts of the Night Shift
// repair protocol, each deal from both opening seats with the shared engine's level-2 bot.
//
//   node scripts/contest-balance.mjs prepare      (ordinary prepare first)
//   node scripts/field-trial-scout.mjs            writes .artifacts/contest-balance/attempt-<N>/scout.json
//
// The output lists the baseline and every candidate edit with Cowboy/Wizard/first-seat shares per cohort and
// the NSB-1/NSB-2 measurements against their limits, ordered by worst distance outside policy, then by
// distance to even faction shares. It picks no winner and writes no card. It reads only the active brief,
// its prepare record, the protocol's scout cohorts, the balance contract and git objects at the base; it
// never reads earlier receipts or game results, and never reports confirmation cohorts.
// A run-level cache (.artifacts/contest-balance/scout-cache.json) is reused only when its sealed key matches
// the recomputed base, game-input object IDs, contract, scout protocol, plan and code hashes exactly.
// Exit status: 0 written, 2 malformed or missing input, 1 engine or other failure.
import {spawnSync} from "node:child_process";
import {existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {FIELDS, RUN} from "./contest-balance.mjs";
import {openTrialEngine, playTrial} from "./field-trial-engine.mjs";
import {canonical, sha256, summarize} from "./night-review.mjs";
import {CONTRACT_PATH, evaluateBalanceRequirements, loadBalanceContract} from "./showdown-balance-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROTOCOL_PATH = ".kiro/specs/night-shift-repair/protocol.json";
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
const GAME_INPUTS = Object.freeze(["src/game", CARD_DIR, "scripts/sync-card-specs.mjs", "prototypes/showdown/rules.js"]);
const CODE_FILES = Object.freeze(["scripts/field-trial-scout.mjs", "scripts/field-trial-engine.mjs", "scripts/night-review.mjs",
  "scripts/showdown-balance-contract.mjs", "scripts/contest-balance.mjs"]);
const CACHE_PATH = `${RUN}/scout-cache.json`;
const RESULT_SCHEMA = "field-trial-scout/result@1";
const CACHE_SCHEMA = "field-trial-scout/cache@1";
const OUTPUT_SCHEMA = "field-trial-scout/scout@1";
const BRIEF_SCHEMA = "contest-balance/brief@1";
const MAX_DEALS = 2000;
const SEATS = Object.freeze(["cowboy", "wizard"]);
const CARD_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

class InputError extends Error {}
const fail = (message) => { throw new InputError(message); };
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (value, keys, what) => {
  if (!isObject(value)) fail(`${what} must be a JSON object`);
  const extra = Object.keys(value).filter((k) => !keys.includes(k)), missing = keys.filter((k) => !(k in value));
  if (extra.length || missing.length) fail(`${what} has ${[missing.length && `missing ${missing.join(", ")}`, extra.length && `unexpected ${extra.join(", ")}`].filter(Boolean).join("; ")}`);
};
const firstLine = (error) => String(error?.message ?? error).split("\n")[0].slice(0, 300);

function readText(rel, what = rel) {
  const stat = lstatSync(join(ROOT, rel), {throwIfNoEntry: false});
  if (!stat) fail(`${what} is missing (${rel})`);
  if (!stat.isFile()) fail(`${what} is not a regular file (${rel})`);
  return readFileSync(join(ROOT, rel), "utf8");
}
function parseJson(text, what) {
  try { return JSON.parse(text); } catch (error) { return fail(`${what} is not valid JSON: ${firstLine(error)}`); }
}
function writeAtomic(rel, value) {
  const file = join(ROOT, rel), tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, file);
}
function git(args, what) {
  const r = spawnSync("git", args, {cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    env: {...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0"}});
  if (r.status !== 0) fail(`${what}: git ${args.join(" ")}: ${(r.stderr || "").trim().split("\n")[0]}`);
  return r.stdout;
}

// ---- inputs ----

function activeAttempt() {
  const runDir = join(ROOT, RUN);
  if (!existsSync(runDir)) fail(`no ${RUN}; run contest-balance.mjs reset and prepare first`);
  const numbers = readdirSync(runDir).map((d) => /^attempt-([1-9]\d*)$/.exec(d)?.[1]).filter(Boolean).map(Number);
  if (!numbers.length) fail(`no prepared attempt in ${RUN}; run contest-balance.mjs prepare first`);
  const n = Math.max(...numbers), dir = `${RUN}/attempt-${n}`;
  if (existsSync(join(ROOT, dir, "receipt.json"))) fail(`attempt ${n} is already reviewed; prepare the next attempt first`);
  const briefText = readText(`${dir}/brief.json`, `attempt ${n} brief`);
  const brief = parseJson(briefText, `attempt ${n} brief`);
  const prep = parseJson(readText(`${dir}/prepare.json`, `attempt ${n} prepare record`), `attempt ${n} prepare record`);
  if (!isObject(brief) || brief.schema !== BRIEF_SCHEMA) fail(`attempt ${n} brief schema must be ${BRIEF_SCHEMA}`);
  if (!isObject(prep)) fail(`attempt ${n} prepare record must be a JSON object`);
  if (brief.attempt !== n || prep.attempt !== n) fail(`attempt ${n} brief or prepare record names a different attempt`);
  if (typeof brief.base !== "string" || !OBJECT_ID.test(brief.base)) fail(`attempt ${n} brief base must be a full commit ID`);
  if (prep.base !== brief.base) fail(`attempt ${n} brief base differs from its prepare record`);
  if (typeof prep.contractSha256 !== "string" || !/^[0-9a-f]{64}$/.test(prep.contractSha256)) fail(`attempt ${n} prepare record has no contract hash`);
  const cards = brief.cards;
  if (!Array.isArray(cards) || !cards.length) fail(`attempt ${n} brief lists no troop cards`);
  for (const card of cards) if (typeof card !== "string" || !CARD_NAME.test(card)) fail(`attempt ${n} brief has a malformed card name ${JSON.stringify(card)}`);
  if (new Set(cards).size !== cards.length) fail(`attempt ${n} brief lists a card twice`);
  if (canonical(prep.cards) !== canonical(cards)) fail(`attempt ${n} brief cards differ from its prepare record`);
  const fields = brief.fields;
  if (!Array.isArray(fields) || fields.length !== FIELDS.length || new Set(fields).size !== FIELDS.length || !fields.every((f) => FIELDS.includes(f))) {
    fail(`attempt ${n} brief fields must be exactly ${FIELDS.join(", ")}`);
  }
  if (!isObject(brief.bounds)) fail(`attempt ${n} brief has no bounds`);
  const bounds = {};
  for (const field of FIELDS) {
    const b = brief.bounds[field];
    if (!Array.isArray(b) || b.length !== 2 || !b.every(Number.isSafeInteger) || b[0] > b[1]) fail(`attempt ${n} brief bounds for ${field} must be [low, high] whole numbers`);
    bounds[field] = [b[0], b[1]];
  }
  return {n, dir, base: brief.base, cards: [...cards], bounds, briefSha256: sha256(briefText), contractSha256: prep.contractSha256};
}

// Only the scout cohorts leave this function; confirmation cohorts are validated for overlap and dropped.
function loadScoutProtocol() {
  const what = PROTOCOL_PATH;
  const p = parseJson(readText(PROTOCOL_PATH, "protocol"), what);
  exactKeys(p, ["schema", "scout", "confirm"], what);
  if (p.schema !== 1) fail(`${what} schema must be 1`);
  const ranges = {};
  for (const name of ["scout", "confirm"]) {
    if (!Array.isArray(p[name]) || p[name].length !== 2) fail(`${what} ${name} must list exactly two cohorts`);
    ranges[name] = p[name].map((c, i) => {
      exactKeys(c, ["first", "deals"], `${what} ${name}[${i}]`);
      if (!Number.isSafeInteger(c.first) || c.first < 0) fail(`${what} ${name}[${i}].first must be a whole number from 0`);
      if (!Number.isSafeInteger(c.deals) || c.deals < 1 || c.deals > MAX_DEALS) fail(`${what} ${name}[${i}].deals must be 1 to ${MAX_DEALS}`);
      if (!Number.isSafeInteger(c.first + c.deals)) fail(`${what} ${name}[${i}] seed range is too large`);
      return {label: `${name}[${i}]`, first: c.first, deals: c.deals};
    });
  }
  const all = [...ranges.scout, ...ranges.confirm];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (!(a.first + a.deals <= b.first || b.first + b.deals <= a.first)) fail(`${what} cohorts ${a.label} and ${b.label} overlap`);
  }
  return ranges.scout.map((c, i) => ({name: `scout-${i + 1}`, first: c.first, deals: c.deals}));
}

function loadContract(expectedSha256) {
  const text = readText(CONTRACT_PATH, "balance requirements");
  let contract;
  try { contract = loadBalanceContract(join(ROOT, CONTRACT_PATH)); } catch (error) { fail(error.message); }
  const hash = sha256(text);
  if (hash !== expectedSha256) fail(`${CONTRACT_PATH} changed after this attempt was prepared`);
  return {band: [...contract.band], seatTolerancePp: contract.seatTolerancePp, sha256: hash};
}

function gameInputs(base) {
  const commit = git(["rev-parse", "--verify", `${base}^{commit}`], "frozen base").trim();
  if (commit !== base) fail(`frozen base ${base} does not resolve to itself`);
  return Object.fromEntries(GAME_INPUTS.map((path) => {
    const id = git(["rev-parse", "--verify", `${base}:${path}`], `game input ${path} at the base`).trim();
    if (!OBJECT_ID.test(id)) fail(`game input ${path} has a malformed object ID`);
    return [path, id];
  }));
}

// Frozen base values of every whitelisted troop, straight from the base commit's card JSON.
function baseCards(base, cards) {
  return cards.map((card) => {
    const path = `${CARD_DIR}/${card}.json`;
    const text = git(["cat-file", "blob", `${base}:${path}`], `card ${card} at the base`);
    const json = parseJson(text, `${path} at the base`);
    if (!isObject(json)) fail(`${path} at the base is not a JSON object`);
    if (json.kind !== "troop") fail(`${card} is not a troop at the base`);
    if (json.type !== card) fail(`${path} at the base has type ${JSON.stringify(json.type)}`);
    const values = {};
    for (const field of FIELDS) {
      if (!Number.isSafeInteger(json[field])) fail(`${card} ${field} at the base is not a whole number`);
      values[field] = json[field];
    }
    return {card, values, sha256: sha256(text)};
  });
}

function neighborPlan(cards, bounds) {
  const candidates = [], excluded = [];
  for (const {card, values} of cards) for (const field of FIELDS) for (const delta of [-1, 1]) {
    const from = values[field], to = from + delta;
    const edit = {id: `${card}.${field}${delta < 0 ? "-1" : "+1"}`, card, field, from, to};
    if (to < bounds[field][0] || to > bounds[field][1]) excluded.push({...edit, reason: `outside ${bounds[field].join("..")}`});
    else candidates.push(edit);
  }
  return {candidates, excluded};
}

// ---- measurement ----

async function playCohort(rules, {first: from, deals}) {
  const games = [];
  for (let seed = from; seed < from + deals; seed++) for (const first of SEATS) {
    const out = await playTrial(rules, seed, first);
    if (!isObject(out)) throw new Error(`playTrial returned no result for seed ${seed}`);
    const winner = out.winner === "draw" || out.winner === null || out.winner === undefined ? null : out.winner;
    if (winner !== null && !SEATS.includes(winner)) throw new Error(`playTrial returned winner ${JSON.stringify(out.winner)}`);
    if (!Number.isSafeInteger(out.endTurn) || out.endTurn < 0) throw new Error(`playTrial returned endTurn ${JSON.stringify(out.endTurn)}`);
    games.push({seed, first, winner, endTurn: out.endTurn});
  }
  return games;
}

function stats(games) {
  const s = summarize(games);
  const pct = (k) => (100 * k) / s.games;
  return {games: s.games, cowboyWins: s.cowboy, wizardWins: s.wizard, draws: s.draw, firstWins: s.first,
    cowboyShare: s.cowboyShare, wizardShare: pct(s.wizard), drawShare: pct(s.draw), firstShare: s.firstShare, seatSkew: s.seatSkew,
    meanEndTurn: games.reduce((sum, g) => sum + g.endTurn, 0) / s.games};
}

// NSB-1 and NSB-2 for one cohort, with the distance in percentage points outside each limit (0 when inside).
function requirements(contract, cand, base) {
  const [nsb1, nsb2] = evaluateBalanceRequirements(contract, {cowboyShare: cand.cowboyShare, wizardShare: cand.wizardShare,
    seatSkew: cand.seatSkew, baselineSeatSkew: base.seatSkew});
  const [low, high] = contract.band, limit = base.seatSkew + contract.seatTolerancePp;
  return {
    "NSB-1": {pass: nsb1.pass, cowboyShare: cand.cowboyShare, wizardShare: cand.wizardShare, band: [low, high],
      outsidePp: Math.max(0, ...[cand.cowboyShare, cand.wizardShare].map((v) => Math.max(low - v, v - high)))},
    "NSB-2": {pass: nsb2.pass, seatSkew: cand.seatSkew, baselineSeatSkew: base.seatSkew, seatTolerancePp: contract.seatTolerancePp,
      maxSeatSkew: limit, outsidePp: Math.max(0, cand.seatSkew - limit)},
  };
}

function changedGames(baseGames, candGames) {
  if (baseGames.length !== candGames.length) throw new Error("baseline and candidate played different game counts");
  let changed = 0;
  baseGames.forEach((b, i) => {
    const c = candGames[i];
    if (b.seed !== c.seed || b.first !== c.first) throw new Error("baseline and candidate games are not paired");
    if (b.winner !== c.winner) changed += 1;
  });
  return changed;
}

async function withEngine(parent, index, base, change, inputs, use) {
  const dir = join(parent, `engine-${index}`);
  try {
    const engine = await openTrialEngine(dir, base, change, inputs);
    if (!isObject(engine) || !engine.rules) throw new Error("openTrialEngine returned no rules");
    if (canonical(engine.inputs) !== canonical(inputs)) throw new Error("engine game inputs differ from the frozen base");
    return await use(engine.rules);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

const order = (a, b) => a.worstOutsidePp - b.worstOutsidePp || a.evenDistancePp - b.evenDistancePp || a.stable - b.stable;

async function compute({base, inputs, contract, cohorts, cards, plan}) {
  const parent = mkdtempSync(join(tmpdir(), "field-trial-scout-"));
  try {
    const baseGames = {}, baseline = {};
    await withEngine(parent, 0, base, null, inputs, async (rules) => {
      for (const c of cohorts) {
        baseGames[c.name] = await playCohort(rules, c);
        const s = stats(baseGames[c.name]);
        baseline[c.name] = {first: c.first, deals: c.deals, ...s, requirements: requirements(contract, s, s)};
      }
    });
    const measured = [], rejected = [];
    for (const [i, edit] of plan.candidates.entries()) {
      const change = {card: edit.card, field: edit.field, from: edit.from, to: edit.to};
      try {
        const perCohort = await withEngine(parent, i + 1, base, change, inputs, async (rules) => {
          const out = {};
          for (const c of cohorts) {
            const games = await playCohort(rules, c), s = stats(games), b = baseline[c.name];
            out[c.name] = {...s,
              deltaPp: {cowboyShare: s.cowboyShare - b.cowboyShare, wizardShare: s.wizardShare - b.wizardShare, firstShare: s.firstShare - b.firstShare},
              changedGames: changedGames(baseGames[c.name], games), requirements: requirements(contract, s, b)};
          }
          return out;
        });
        const rows = Object.values(perCohort);
        measured.push({...edit, status: "measured", stable: i,
          passesNsb1AndNsb2BothCohorts: rows.every((r) => r.requirements["NSB-1"].pass && r.requirements["NSB-2"].pass),
          worstOutsidePp: Math.max(...rows.flatMap((r) => [r.requirements["NSB-1"].outsidePp, r.requirements["NSB-2"].outsidePp])),
          evenDistancePp: Math.max(...rows.map((r) => Math.abs(r.cowboyShare - r.wizardShare) / 2)),
          cohorts: perCohort});
      } catch (error) {
        if (error instanceof InputError) throw error;
        const reason = firstLine(error);
        if (!reason.startsWith(`candidate card compile failed: ${edit.card}.json: `)) throw error;
        rejected.push({...edit, status: "engine-rejected", error: reason});
      }
      if ((i + 1) % 10 === 0 || i + 1 === plan.candidates.length) process.stderr.write(`scout: ${i + 1}/${plan.candidates.length} edits\n`);
    }
    measured.sort(order);
    return {
      schema: RESULT_SCHEMA, base, gameInputs: inputs,
      contract: {path: CONTRACT_PATH, ...contract},
      scoutCohorts: cohorts.map(({name, first, deals}) => ({name, first, deals, games: deals * SEATS.length})),
      play: {seats: [...SEATS], bot: "level-2 bot on both sides via playTrial (scripts/field-trial-engine.mjs)", draws: "count for neither faction"},
      cards: cards.map(({card, values, sha256: hash}) => ({card, ...values, baseCardSha256: hash})),
      baseline,
      ordering: "Measured edits by worstOutsidePp (largest NSB-1/NSB-2 distance outside its limit over both cohorts), then evenDistancePp (largest |Cowboy - Wizard| / 2 over both cohorts), then card/field order. Order is not a recommendation; no edit is picked or applied.",
      counts: {candidates: plan.candidates.length, measured: measured.length, rejected: rejected.length, excluded: plan.excluded.length,
        passingNsb1AndNsb2BothCohorts: measured.filter((m) => m.passesNsb1AndNsb2BothCohorts).length},
      candidates: [...measured.map(({stable, ...m}) => m), ...rejected],
      excluded: plan.excluded,
    };
  } finally {
    rmSync(parent, {recursive: true, force: true});
  }
}

// ---- cache ----

function readCache(key, plan) {
  const file = join(ROOT, CACHE_PATH);
  const stat = lstatSync(file, {throwIfNoEntry: false});
  if (!stat) return {result: null, state: "none"};
  if (!stat.isFile()) return {result: null, state: "invalid"};
  try {
    const c = JSON.parse(readFileSync(file, "utf8"));
    const ids = (list) => canonical(list.map((x) => x.id).sort());
    const ok = isObject(c) && c.schema === CACHE_SCHEMA && typeof c.key === "string" && c.key === key
      && sha256(canonical(c.keyMaterial)) === key && isObject(c.result) && c.result.schema === RESULT_SCHEMA && c.result.cacheKey === key
      && typeof c.resultSha256 === "string" && sha256(canonical(c.result)) === c.resultSha256
      && Array.isArray(c.result.candidates) && c.result.candidates.every((x) => isObject(x) && x.status === "measured")
      && ids(c.result.candidates) === ids(plan.candidates);
    return ok ? {result: c.result, state: "hit"} : {result: null, state: c?.key === key ? "invalid" : "stale"};
  } catch { return {result: null, state: "invalid"}; }
}

function codeHashes() {
  return Object.fromEntries(CODE_FILES.map((f) => [f, sha256(readFileSync(join(ROOT, f)))]));
}

// ---- CLI ----

const pct = (v) => `${v.toFixed(2)}%`;

async function main(argv) {
  if (argv.length) fail("usage: node scripts/field-trial-scout.mjs (no arguments; run after contest-balance.mjs prepare)");
  const attempt = activeAttempt();
  const contract = loadContract(attempt.contractSha256);
  const cohorts = loadScoutProtocol();
  const inputs = gameInputs(attempt.base);
  const cards = baseCards(attempt.base, attempt.cards);
  const plan = neighborPlan(cards, attempt.bounds);
  if (!plan.candidates.length) fail("no legal ±1 neighbor edit exists for the whitelisted troops");
  const keyMaterial = {schema: CACHE_SCHEMA, base: attempt.base, gameInputs: inputs, contract, scout: cohorts,
    cards: cards.map(({card, values, sha256: hash}) => ({card, values, hash})), fields: [...FIELDS], bounds: attempt.bounds,
    plan: plan.candidates.map((c) => c.id), code: codeHashes(), node: process.version};
  const key = sha256(canonical(keyMaterial));
  const cached = readCache(key, plan);
  let result = cached.result;
  if (!result) {
    result = {...(await compute({base: attempt.base, inputs, contract, cohorts, cards, plan})), cacheKey: key};
    if (result.counts.rejected === 0) writeAtomic(CACHE_PATH, {schema: CACHE_SCHEMA, key, keyMaterial, result, resultSha256: sha256(canonical(result))});
  }
  const outPath = `${attempt.dir}/scout.json`;
  writeAtomic(outPath, {schema: OUTPUT_SCHEMA, attempt: attempt.n, createdAt: new Date().toISOString(),
    brief: {path: `${attempt.dir}/brief.json`, sha256: attempt.briefSha256},
    cache: {path: CACHE_PATH, key, state: cached.state === "hit" ? "hit" : `computed (${cached.state} cache)`},
    note: "Scout measurements only. No edit is chosen or applied, and no confirmation cohort is played or reported.",
    result, resultSha256: sha256(canonical(result))});

  const lines = [`field-trial scout: attempt ${attempt.n} at ${attempt.base.slice(0, 12)} (${cached.state === "hit" ? "cache hit" : "computed"})`];
  for (const c of result.scoutCohorts) {
    const b = result.baseline[c.name];
    lines.push(`  baseline ${c.name} ${c.first}+${c.deals}: Cowboy ${pct(b.cowboyShare)}, Wizard ${pct(b.wizardShare)}, first seat ${pct(b.firstShare)}`);
  }
  const k = result.counts;
  lines.push(`  ${k.measured}/${k.candidates} edits measured (${k.rejected} rejected by the engine, ${k.excluded} outside bounds); ${k.passingNsb1AndNsb2BothCohorts} meet NSB-1 and NSB-2 on both cohorts`);
  lines.push(`  wrote ${outPath}`);
  console.log(lines.join("\n"));
  if (k.passingNsb1AndNsb2BothCohorts === 0) {
    console.log("  No nomination. The held-out deals stayed sealed.");
    return 3;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    console.error(`field-trial-scout: ${error instanceof InputError ? error.message : firstLine(error)}`);
    process.exit(error instanceof InputError ? 2 : 1);
  });
}
