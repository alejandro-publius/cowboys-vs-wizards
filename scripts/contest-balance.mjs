// Contest balance loop: up to six attempts, each one troop card and one number, reviewed on a
// paired tune range and a disjoint holdout range. Local CLI only. Reuses scripts/night-review.mjs
// (single-field edit check, paired outcome analysis, sealing) at an immutable base commit.
//
// The balancer agent only edits one card JSON file inside a scratch snapshot made here (its
// PreToolUse fence, scripts/contest-balance-fence.mjs, blocks everything else). This script, run by
// a separate reviewer step, owns every simulation, receipt and status file. It never changes this
// checkout's cards, generated specs or shipped stats; candidates exist only in temporary snapshots.
//
//   node scripts/contest-balance.mjs reset                     archive any earlier run; status pass=false
//   node scripts/contest-balance.mjs prepare                   next attempt (1..6): scratch snapshot + brief
//   node scripts/contest-balance.mjs review [--tune 0:200] [--holdout 100000:200]
//   node scripts/contest-balance.mjs verify [--attempt <n>]    seal, card hashes, recomputed decision
// Exit status: 0 PASS (or verified), 1 FAIL (or verification failed), 2 unusable input.
// The default policy's band and seat tolerance are read from the written requirements NSB-1 and NSB-2
// (scripts/showdown-balance-contract.mjs). A malformed requirements file stops prepare and review with
// exit 2; verify always recomputes with the policy recorded in the receipt.
import {spawnSync} from "node:child_process";
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {MARKER, MAX_ATTEMPTS} from "./contest-balance-fence.mjs";
import {bundleSealIntact, canonical, changeField, paired, sealBundle, sha256, summarize} from "./night-review.mjs";
import {CONTRACT_PATH, contractProblems, evaluateBalanceRequirements, inBand, loadBalanceContract} from "./showdown-balance-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RUN = ".artifacts/contest-balance";
export const STATUS = `${RUN}/status.json`;
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
const SNAPSHOT_PATHS = ["src", "scripts", "tests", "prototypes/showdown", ".kiro/specs/duel-card-pipeline"];
const RECEIPT = "tests/helpers/boundary-properties/showdown/minimal-cases.json";
const RECEIPT_TOOL = "tests/helpers/boundary-properties/showdown/replay.mjs";
const PROPERTY_TESTS = ["tests/game/showdown-properties.test.js", "tests/game/showdown-fair-bot.test.js"];
export const FIELDS = Object.freeze(["attack", "health", "stars"]);
const BOUNDS = Object.freeze({attack: [0, 9], health: [1, 12], stars: [1, 8]});
const MAX_DEALS = 2000;
// Decision thresholds, recorded in every receipt. The band (NSB-1) and first-seat tolerance (NSB-2) come from
// the written requirements in CONTRACT_PATH. The band is on measured match win shares over all games of a
// range (both seats per deal, level-2 bot on both sides); it says nothing about any one card.
export const balancePolicy = (contract) => Object.freeze({
  band: Object.freeze([...contract.band]),
  bandApplies: "Cowboy share and Wizard share of all games (draws count for neither), each in the band, on tune and on holdout",
  seatTolerancePp: contract.seatTolerancePp,
  sets: ["tune", "holdout"],
  sparseGames: 50,
  defaults: {tune: "0:200", holdout: "100000:200"},
  requirements: {path: CONTRACT_PATH, ids: ["NSB-1", "NSB-2"]},
});
// A malformed contract leaves a policy that cannot pass and blocks prepare and review (exit 2).
const loadPolicy = () => {
  try { return balancePolicy(loadBalanceContract()); } catch (error) {
    return Object.freeze({...balancePolicy({band: [null, null], seatTolerancePp: null}), contractError: error.message});
  }
};
export const POLICY = loadPolicy();
const requireContract = () => { if (POLICY.contractError) throw new InputError(POLICY.contractError); };
const contractSha256 = () => sha256(readFileSync(join(ROOT, CONTRACT_PATH)));
export const SURFACE = Object.freeze({kind: "local-cli", note: "Produced by the local CLI reviewer command, not by the balancer agent and not Kiro Web."});

// ---- pure checks ----

// Compares one card's base text with the balancer's text. Returns {ok, reasons, field, from, to}.
export function cardChange(baseText, candText, {card} = {}) {
  const reasons = [];
  let before, after;
  try { before = JSON.parse(baseText); } catch { return {ok: false, reasons: ["base card is not valid JSON"]}; }
  try { after = JSON.parse(candText); } catch { return {ok: false, reasons: ["edited card is not valid JSON"]}; }
  if (!after || typeof after !== "object" || Array.isArray(after)) return {ok: false, reasons: ["edited card is not a JSON object"]};
  const changed = Object.keys({...before, ...after}).filter((key) => canonical(before[key]) !== canonical(after[key]));
  if (changed.length !== 1) return {ok: false, reasons: [`expected exactly one changed field, found ${changed.length}${changed.length ? ` (${changed.join(", ")})` : ""}`]};
  const field = changed[0];
  if (!FIELDS.includes(field)) reasons.push(`field ${field} is not whitelisted (${FIELDS.join(", ")})`);
  if (before.kind !== "troop") reasons.push(`${card ?? before.type} is not a troop`);
  if (card && before.type !== card) reasons.push(`file type ${before.type} does not match its file name ${card}`);
  const from = before[field], to = after[field];
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) reasons.push(`${field} must stay a whole number`);
  else if (BOUNDS[field] && (to < BOUNDS[field][0] || to > BOUNDS[field][1])) reasons.push(`${field} ${to} is outside ${BOUNDS[field].join("..")}`);
  if (!reasons.length) {
    try {
      if (changeField(baseText, field, from, to) !== candText) reasons.push("the file differs from a one-number edit of the base text (formatting or other bytes changed)");
    } catch (error) { reasons.push(error.message); }
  }
  return {ok: reasons.length === 0, reasons, field, from, to};
}

export const parseRange = (text) => {
  const m = /^(\d{1,9}):(\d{1,4})$/.exec(String(text));
  if (!m) throw new InputError(`range must be <from>:<deals>, got ${text}`);
  const from = Number(m[1]), deals = Number(m[2]);
  if (deals < 1 || deals > MAX_DEALS) throw new InputError(`range deals must be 1 to ${MAX_DEALS}`);
  return {from, deals};
};
export const disjoint = (a, b) => a.from + a.deals <= b.from || b.from + b.deals <= a.from;

const share = (n, games) => (games ? (100 * n) / games : 0);
export const shares = (games) => {
  const s = summarize(games);
  return {...s, wizardShare: share(s.wizard, s.games), drawShare: share(s.draw, s.games)};
};
const fixed = (v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "missing");

// Per-card cohort estimate from one set of game records, without changing any mechanic.
// Cohort: games of this range (each deal from both seats, level-2 bot both sides, even-match decks)
// in which the card's own side summoned at least one copy from hand. Observational: a card that is
// drawn and played more in long games will show that game length, not the card's strength.
export function perCardCohorts(games, troopsBySide, sparse = POLICY.sparseGames) {
  const out = {};
  for (const [side, cards] of Object.entries(troopsBySide)) for (const card of cards) {
    const withCard = games.filter((g) => g.summoned?.[side]?.includes(card));
    const without = games.filter((g) => !g.summoned?.[side]?.includes(card));
    const wins = (list) => list.filter((g) => g.winner === side).length;
    const status = withCard.length === 0 ? "unmeasured" : withCard.length < sparse || without.length < sparse ? "sparse" : "measured";
    out[card] = {side, gamesWithCard: withCard.length, sideWinShareWithCard: withCard.length ? share(wins(withCard), withCard.length) : null,
      gamesWithoutCard: without.length, sideWinShareWithoutCard: without.length ? share(wins(without), without.length) : null, status};
  }
  return out;
}

// The decision from recorded evidence. Pure, so `verify` can recompute it.
export function decideAttempt({violations, properties, sets, policy = POLICY}) {
  const reasons = [...violations];
  if (!violations.length) {
    if (!properties?.baseline?.passed) reasons.push("baseline property tests failed, so the gate is not meaningful");
    if (!properties?.candidate?.passed) reasons.push("candidate failed a property test or card-spec validation");
    for (const name of policy.sets) {
      const s = sets?.[name];
      if (!s) { reasons.push(`no ${name} results`); continue; }
      if (s.flips.same === s.baseline.games) reasons.push(`${name}: the change altered no game result`);
      const [band, seat] = evaluateBalanceRequirements(policy, {cowboyShare: s.candidate?.cowboyShare, wizardShare: s.candidate?.wizardShare,
        seatSkew: s.candidate?.seatSkew, baselineSeatSkew: s.baseline?.seatSkew});
      if (!band.pass) for (const [label, key] of [["Cowboy", "cowboyShare"], ["Wizard", "wizardShare"]]) {
        if (!inBand(s.candidate?.[key], policy.band)) reasons.push(`${name}: ${label} share ${fixed(s.candidate?.[key])}% is outside ${policy.band?.[0]}-${policy.band?.[1]}%`);
      }
      if (!seat.pass) {
        reasons.push(`${name}: first-seat skew grew ${fixed(s.baseline?.seatSkew)} -> ${fixed(s.candidate?.seatSkew)} pp (tolerance ${policy.seatTolerancePp})`);
      }
    }
  }
  return {verdict: reasons.length ? "FAIL" : "PASS", pass: reasons.length === 0, reasons,
    meaning: reasons.length ? "Do not forward this candidate." : "Measured match shares are in the band on tune and holdout. Ready for Fable/Alex review only; not applied to any card or release."};
}

// For the next brief: requirement rows a sealed receipt's candidate failed, judged by that receipt's own
// policy, per set. Passed rows, unmeasured values, unsealed receipts and unusable policies yield nothing.
export function failedRequirements(receipt) {
  if (!receipt || !bundleSealIntact(receipt) || contractProblems(receipt.policy).length) return {};
  const out = {};
  for (const name of ["tune", "holdout"]) {
    const s = receipt.sets?.[name];
    if (!s?.baseline || !s?.candidate) continue;
    out[name] = evaluateBalanceRequirements(receipt.policy, {cowboyShare: s.candidate.cowboyShare, wizardShare: s.candidate.wizardShare,
      seatSkew: s.candidate.seatSkew, baselineSeatSkew: s.baseline.seatSkew}).filter((row) => row.measured && !row.pass).map(({measured, pass, ...row}) => row);
  }
  return out;
}

// ---- side effects: git snapshots, child processes, files ----

class InputError extends Error {}
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const git = (...args) => {
  const r = spawnSync("git", args, {cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
};
function archive(commit, dir) {
  mkdirSync(dir, {recursive: true});
  const tar = spawnSync("git", ["archive", "--format=tar", commit, ...SNAPSHOT_PATHS], {cwd: ROOT, maxBuffer: 512 * 1024 * 1024});
  if (tar.status !== 0) throw new Error(`git archive ${commit}: ${tar.stderr}`);
  const x = spawnSync("tar", ["-x", "-C", dir], {input: tar.stdout});
  if (x.status !== 0) throw new Error(`tar: ${x.stderr}`);
  return dir;
}
const temp = () => mkdtempSync(join(tmpdir(), "contest-balance-"));
const node = (cwd, args) => spawnSync(process.execPath, args, {cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
const tail = (text) => text.trim().split("\n").slice(-12).join("\n");

// Sorted relative file list; symbolic links are listed with a marker so they count as a difference.
function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(join(dir, prefix), {withFileTypes: true})) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) out.push(`${rel} (symlink)`);
    else if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}
export function compareTrees(baseDir, otherDir, ignore = []) {
  const a = new Set(listFiles(baseDir)), b = new Set(listFiles(otherDir).filter((f) => !ignore.includes(f)));
  const changed = [...a].filter((f) => b.has(f) && !readFileSync(join(baseDir, f)).equals(readFileSync(join(otherDir, f))));
  return {added: [...b].filter((f) => !a.has(f)), removed: [...a].filter((f) => !b.has(f)), changed};
}
const hashDir = (dir) => Object.fromEntries(listFiles(dir).map((f) => [f, f.endsWith("(symlink)") ? "symlink" : sha256(readFileSync(join(dir, f)))]));

const attemptDir = (n) => join(ROOT, RUN, `attempt-${n}`);
const attempts = () => existsSync(join(ROOT, RUN))
  ? readdirSync(join(ROOT, RUN)).map((d) => /^attempt-(\d+)$/.exec(d)?.[1]).filter(Boolean).map(Number).sort((x, y) => x - y) : [];

async function troopCards(dir) {
  const {DECKS, TYPES} = await import(pathToFileURL(join(dir, "src/game/showdown/cards.js")).href + `?${Date.now()}`);
  const bySide = {};
  for (const [side, deck] of Object.entries(DECKS)) bySide[side] = Object.keys(deck).filter((t) => TYPES[t]?.kind === "troop" && existsSync(join(dir, CARD_DIR, `${t}.json`)));
  return bySide;
}

function reset() {
  const run = join(ROOT, RUN);
  if (existsSync(run)) {
    const to = join(ROOT, ".artifacts/contest-balance-archive", new Date().toISOString().replace(/[:.]/g, "-"));
    mkdirSync(dirname(to), {recursive: true});
    renameSync(run, to);
    console.log(`archived the earlier run to ${relative(ROOT, to)}`);
  }
  mkdirSync(run, {recursive: true});
  writeJson(join(ROOT, STATUS), {schema: "contest-balance/status@1", pass: false, attempt: 0, note: "reset; no attempt reviewed yet"});
  console.log(`reset ${RUN}; status pass=false`);
}

async function prepare() {
  const done = attempts();
  const n = (done.at(-1) ?? 0) + 1;
  if (n > MAX_ATTEMPTS) throw new InputError(`all ${MAX_ATTEMPTS} attempts are used; run reset to start a new run`);
  if (!existsSync(join(ROOT, STATUS))) throw new InputError("no status file; run reset first");
  if (readJson(join(ROOT, STATUS)).pass === true) throw new InputError("an earlier attempt already passed; the loop should have stopped");
  requireContract();
  const base = n === 1 ? git("rev-parse", "HEAD") : readJson(join(attemptDir(1), "prepare.json")).base;
  const dir = attemptDir(n);
  const scratch = archive(base, join(dir, "scratch"));
  const cards = await troopCards(scratch);
  const whitelist = [...cards.cowboy, ...cards.wizard];
  const marker = {schema: "contest-balance/scratch@1", attempt: n, base, cards: whitelist, fields: FIELDS};
  const markerText = JSON.stringify(marker, null, 2) + "\n";
  writeFileSync(join(scratch, MARKER), markerText);
  const history = done.map((k) => {
    const file = join(attemptDir(k), "receipt.json");
    if (!existsSync(file)) return {attempt: k, verdict: "unreviewed"};
    try {
      const r = readJson(file);
      return {attempt: k, change: r.change, verdict: r.decision.verdict, reasons: r.decision.reasons,
        sets: Object.fromEntries(Object.entries(r.sets ?? {}).map(([name, s]) => [name, {seeds: s.seeds,
          baseline: {cowboyShare: s.baseline.cowboyShare, wizardShare: s.baseline.wizardShare, firstShare: s.baseline.firstShare},
          candidate: {cowboyShare: s.candidate.cowboyShare, wizardShare: s.candidate.wizardShare, firstShare: s.candidate.firstShare}}])),
        failedRequirements: failedRequirements(r)};
    } catch { return {attempt: k, verdict: "unusable receipt"}; }
  });
  const brief = {schema: "contest-balance/brief@1", attempt: n, maxAttempts: MAX_ATTEMPTS, base,
    editablePathPattern: `${RUN}/attempt-${n}/scratch/${CARD_DIR}/<card>.json`, cards: whitelist, fields: FIELDS, bounds: BOUNDS,
    policy: POLICY, history,
    requirements: `${CONTRACT_PATH} is read-only. history[].failedRequirements lists, per earlier sealed receipt and separately for tune and holdout, only the requirement IDs its candidate failed with the measured values, judged by that receipt's own policy. Passed requirements and missing or unusable results are left out.`,
    rule: "Change exactly one whitelisted number on exactly one whitelisted troop card in this scratch snapshot. Do not repeat an earlier attempt's change."};
  writeJson(join(dir, "brief.json"), brief);
  writeJson(join(dir, "prepare.json"), {schema: "contest-balance/prepare@1", attempt: n, base, tree: git("rev-parse", `${base}^{tree}`),
    markerSha256: sha256(markerText), contractSha256: contractSha256(), cards: whitelist, cardHashes: Object.fromEntries(whitelist.map((c) => [c, sha256(readFileSync(join(scratch, CARD_DIR, `${c}.json`)))]))});
  console.log(`attempt ${n}/${MAX_ATTEMPTS} prepared at ${base.slice(0, 12)}\n  brief ${relative(ROOT, join(dir, "brief.json"))}\n  editable ${brief.editablePathPattern}`);
}

function prepareCandidate(dir, card, text) {
  writeFileSync(join(dir, CARD_DIR, `${card}.json`), text);
  const sync = node(dir, ["scripts/sync-card-specs.mjs"]);
  if (sync.status !== 0) return {ok: false, output: tail(sync.stdout + sync.stderr)};
  const receipt = node(dir, [RECEIPT_TOOL, "--write-minimal"]);
  if (receipt.status !== 0) return {ok: false, output: tail(receipt.stdout + receipt.stderr)};
  return {ok: true};
}
function testRun(dir, files) {
  const r = node(dir, ["--test", ...files]);
  const count = (label) => Number((r.stdout.match(new RegExp(`^(?:#|ℹ) ${label} (\\d+)`, "m")) ?? [])[1] ?? 0);
  const missing = files.filter((f) => !existsSync(join(dir, f)));
  return {passed: r.status === 0 && !missing.length && count("tests") > 0 && count("fail") === 0, files, missing, tests: count("tests"), pass: count("pass"), fail: count("fail")};
}

// Each deal from both seats with the snapshot's own level-2 bot; records which troop types each side summoned from hand.
const PLAY = `
const [snapshot, from, deals] = process.argv.slice(1);
const {createShowdown, playTurn} = await import(new URL("prototypes/showdown/rules.js", "file://" + snapshot + "/").href);
const games = [];
for (let seed = Number(from); seed < Number(from) + Number(deals); seed++) for (const first of ["cowboy", "wizard"]) {
  let state = createShowdown(seed, {first});
  const summoned = {cowboy: new Set(), wizard: new Set()};
  while (!state.result) {
    const turn = playTurn(state);
    for (const e of turn.events) if (e.type === "summon") summoned[e.side].add(e.cardId.replace(/-\\d+$/, ""));
    state = turn.state;
  }
  games.push({seed, first, winner: state.result.winner, reason: state.result.reason, turns: state.turn,
    summoned: {cowboy: [...summoned.cowboy].sort(), wizard: [...summoned.wizard].sort()}});
}
process.stdout.write(JSON.stringify(games));`;
function play(dir, {from, deals}) {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", PLAY, dir, String(from), String(deals)], {encoding: "utf8", maxBuffer: 256 * 1024 * 1024});
  if (r.status !== 0) throw new Error(`simulation failed: ${tail(r.stderr)}`);
  return JSON.parse(r.stdout);
}
const realCardHashes = () => hashDir(join(ROOT, CARD_DIR));

async function review(opts) {
  const n = attempts().at(-1);
  if (!n) throw new InputError("no prepared attempt");
  const dir = attemptDir(n);
  if (existsSync(join(dir, "receipt.json"))) throw new InputError(`attempt ${n} is already reviewed`);
  const prep = readJson(join(dir, "prepare.json"));
  requireContract();
  const tune = parseRange(opts.tune ?? POLICY.defaults.tune);
  const holdout = parseRange(opts.holdout ?? POLICY.defaults.holdout);
  if (!disjoint(tune, holdout)) throw new InputError("holdout seeds overlap the tune seeds");
  const realBefore = realCardHashes();
  const scratch = join(dir, "scratch");
  const violations = [];
  const markerStat = lstatSync(join(scratch, MARKER), {throwIfNoEntry: false});
  if (!markerStat?.isFile() || sha256(readFileSync(join(scratch, MARKER))) !== prep.markerSha256) violations.push("scratch marker missing or changed");
  if (prep.contractSha256 !== contractSha256()) violations.push(`${CONTRACT_PATH} changed after prepare or was not recorded`);
  const baseDir = archive(prep.base, temp());
  let candDir = null;
  try {
    const diff = compareTrees(baseDir, scratch, [MARKER]);
    const cardRe = new RegExp(`^${CARD_DIR.replace(/[.]/g, "\\.")}/([a-z][a-z0-9-]{0,31})\\.json$`);
    const cardFiles = diff.changed.filter((f) => cardRe.test(f));
    const other = [...diff.added.map((f) => `added ${f}`), ...diff.removed.map((f) => `removed ${f}`), ...diff.changed.filter((f) => !cardRe.test(f)).map((f) => `changed ${f}`)];
    if (other.length) violations.push(`scratch changed outside one card file: ${other.slice(0, 10).join("; ")}`);
    if (cardFiles.length !== 1) violations.push(cardFiles.length ? `more than one card file changed: ${cardFiles.join(", ")}` : "no card file changed");
    let change = null;
    if (cardFiles.length === 1) {
      const card = cardRe.exec(cardFiles[0])[1];
      const baseText = readFileSync(join(baseDir, cardFiles[0]), "utf8");
      const candText = readFileSync(join(scratch, cardFiles[0]), "utf8");
      if (!prep.cards.includes(card)) violations.push(`${card} is not a whitelisted troop card`);
      const checked = cardChange(baseText, candText, {card});
      violations.push(...checked.reasons);
      change = {card, cardPath: cardFiles[0], field: checked.field, from: checked.from, to: checked.to,
        cardSha256: {before: sha256(baseText), after: sha256(candText)}, text: candText};
      for (const k of attempts().filter((k) => k < n)) {
        const file = join(attemptDir(k), "receipt.json");
        const prev = existsSync(file) ? readJson(file).change : null;
        if (prev && prev.card === change.card && prev.field === change.field && prev.to === change.to) violations.push(`repeats attempt ${k}'s change`);
      }
    }
    console.log(`review attempt ${n}: ${change ? `${change.card} ${change.field} ${change.from} -> ${change.to}` : "no usable change"}`);
    let properties = null;
    const sets = {}, results = {}, cohorts = {};
    if (!violations.length) {
      candDir = archive(prep.base, temp());
      const prepared = prepareCandidate(candDir, change.card, change.text);
      properties = {baseline: testRun(baseDir, PROPERTY_TESTS),
        candidate: prepared.ok ? testRun(candDir, PROPERTY_TESTS) : {passed: false, files: PROPERTY_TESTS, output: prepared.output, specSync: "failed"}};
      console.log(`  properties: baseline ${properties.baseline.pass}/${properties.baseline.tests}, candidate ${properties.candidate.pass ?? 0}/${properties.candidate.tests ?? 0}`);
      if (prepared.ok) {
        const troops = await troopCards(baseDir);
        for (const [name, range] of Object.entries({tune, holdout})) {
          const b = play(baseDir, range), c = play(candDir, range);
          results[name] = {baseline: b, candidate: c};
          sets[name] = {seeds: {from: range.from, to: range.from + range.deals - 1, deals: range.deals}, baseline: shares(b), candidate: shares(c), flips: paired(b, c)};
          cohorts[name] = {baseline: perCardCohorts(b, troops), candidate: perCardCohorts(c, troops)};
          const s = sets[name];
          console.log(`  ${name} ${s.seeds.from}-${s.seeds.to}: Cowboy ${s.baseline.cowboyShare.toFixed(2)}% -> ${s.candidate.cowboyShare.toFixed(2)}%, Wizard ${s.baseline.wizardShare.toFixed(2)}% -> ${s.candidate.wizardShare.toFixed(2)}%, first seat ${s.baseline.firstShare.toFixed(2)}% -> ${s.candidate.firstShare.toFixed(2)}%`);
        }
      }
    }
    const decision = decideAttempt({violations, properties, sets});
    const resultHashes = {};
    for (const [name, pair] of Object.entries(results)) for (const [which, games] of Object.entries(pair)) {
      const file = `games-${name}-${which}.json`;
      const text = JSON.stringify(games) + "\n";
      writeFileSync(join(dir, file), text);
      resultHashes[file] = sha256(text);
    }
    const realAfter = realCardHashes();
    const receipt = sealBundle({
      schema: "contest-balance/receipt@1", attempt: n, maxAttempts: MAX_ATTEMPTS, createdAt: new Date().toISOString(), surface: SURFACE,
      tool: {commit: git("rev-parse", "HEAD"), script: sha256(readFileSync(fileURLToPath(import.meta.url))),
        nightReview: sha256(readFileSync(join(ROOT, "scripts/night-review.mjs"))), fence: sha256(readFileSync(join(ROOT, "scripts/contest-balance-fence.mjs"))),
        balanceContract: {script: sha256(readFileSync(join(ROOT, "scripts/showdown-balance-contract.mjs"))), requirements: prep.contractSha256 ?? null}, node: process.version},
      base: {commit: prep.base, tree: prep.tree},
      change: change && {card: change.card, cardPath: change.cardPath, field: change.field, from: change.from, to: change.to, cardSha256: change.cardSha256},
      violations, properties, sets, results: resultHashes, policy: POLICY, decision,
      perCard: {cohort: "games of each range (both seats per deal, level-2 bot both sides, even-match decks) where the card's side summoned at least one copy from hand",
        caution: "Observational association only; not a balance claim for any card. 'sparse' and 'unmeasured' cards have too few or no games.", sets: cohorts},
      realCards: {unchanged: canonical(realBefore) === canonical(realAfter), sha256: sha256(canonical(realAfter))},
      applied: false, release: "not applied; no shipped stat changed",
    });
    writeJson(join(dir, "receipt.json"), receipt);
    writeJson(join(ROOT, STATUS), {schema: "contest-balance/status@1", pass: decision.pass && receipt.realCards.unchanged, attempt: n,
      receipt: relative(ROOT, join(dir, "receipt.json")), receiptSha256: receipt.bundleSha256});
    console.log(`  verdict: ${decision.verdict}${decision.reasons.length ? `\n    - ${decision.reasons.join("\n    - ")}` : ""}\n  ${decision.meaning}`);
    if (!receipt.realCards.unchanged) console.log("  real card files changed during review; status forced to pass=false");
    return decision.pass && receipt.realCards.unchanged;
  } finally {
    rmSync(baseDir, {recursive: true, force: true});
    if (candDir) rmSync(candDir, {recursive: true, force: true});
  }
}

function verify(opts) {
  const n = opts.attempt ? Number(opts.attempt) : attempts().at(-1);
  if (!Number.isSafeInteger(n) || n < 1) throw new InputError("no attempt to verify");
  const dir = attemptDir(n);
  const receipt = readJson(join(dir, "receipt.json"));
  const problems = [];
  if (!bundleSealIntact(receipt)) problems.push("receipt seal does not match its contents");
  for (const [file, hash] of Object.entries(receipt.results)) if (!existsSync(join(dir, file)) || sha256(readFileSync(join(dir, file))) !== hash) problems.push(`${file} missing or changed`);
  const sets = {};
  for (const name of Object.keys(receipt.sets ?? {})) {
    const b = readJson(join(dir, `games-${name}-baseline.json`)), c = readJson(join(dir, `games-${name}-candidate.json`));
    sets[name] = {...receipt.sets[name], baseline: shares(b), candidate: shares(c), flips: paired(b, c)};
    if (canonical(sets[name]) !== canonical(receipt.sets[name])) problems.push(`${name} summary does not match its game records`);
  }
  if (canonical(decideAttempt({violations: receipt.violations, properties: receipt.properties, sets, policy: receipt.policy})) !== canonical(receipt.decision)) problems.push("recorded decision does not follow from the evidence");
  if (receipt.change && existsSync(join(dir, "scratch", receipt.change.cardPath)) && sha256(readFileSync(join(dir, "scratch", receipt.change.cardPath))) !== receipt.change.cardSha256.after) problems.push("scratch card changed after review");
  const status = readJson(join(ROOT, STATUS));
  if (status.attempt === n && status.pass !== (receipt.decision.pass && receipt.realCards.unchanged)) problems.push("status.json disagrees with the receipt");
  console.log(`verify attempt ${n}: ${problems.length ? "FAILED" : "ok"}; recorded verdict ${receipt.decision.verdict}`);
  for (const p of problems) console.log(`  - ${p}`);
  return problems.length === 0;
}

function parse(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const m = /^--(tune|holdout|attempt)$/.exec(rest[i]);
    if (!m || rest[i + 1] === undefined) throw new InputError(`unexpected argument ${rest[i]}`);
    opts[m[1]] = rest[i + 1];
  }
  return {command, opts};
}

async function main(argv) {
  const {command, opts} = parse(argv);
  if (command === "reset") return (reset(), 0);
  if (command === "prepare") return (await prepare(), 0);
  if (command === "review") return (await review(opts)) ? 0 : 1;
  if (command === "verify") return verify(opts) ? 0 : 1;
  throw new InputError("usage: contest-balance.mjs reset|prepare|review|verify (see the header)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    console.error(`contest-balance: ${error.message}`);
    process.exit(error instanceof InputError ? 2 : 1);
  });
}
