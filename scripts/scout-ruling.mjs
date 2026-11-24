// Night Shift scout ruling: packages the stopped native scout as one withheld example for src/ui/scout-ruling.js.
// Reads only committed evidence (docs/evidence/night-shift-repair/{scout,brief}.json) and the frozen protocol's scout
// ranges. It checks the scout record's canonical seal, its brief, cohorts, planned ±1 edits and every count; ranks
// the measured edits by their stored distance outside NSB-1/NSB-2; and refuses unless no measured edit meets both
// checks on both scout cohorts. Then it rebuilds the base and the nearest edit from the frozen base's Git objects,
// replays only that edit's two scout cohorts (never a confirm seed), requires every stored win, seat and
// changed-result count to reproduce exactly, and records the first scout game whose winner changes with the first
// applied event where the two versions differ, in words. Nothing is nominated or applied; no card is written.
//   node scripts/scout-ruling.mjs           write docs/evidence/night-shift-repair/scout-ruling.json
//   node scripts/scout-ruling.mjs --verify  recompute and compare with the committed scout-ruling.json
// Exit: 0 written or verified, 1 refused (tampered or inconsistent input, mismatch, no comparable event), 2 usage.
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {PROTOCOL_PATH, protocolProblems} from "./field-trial-confirm.mjs";
import {FACTIONS, FIELDS, INPUT_PATHS, openTrialEngine, playTrial} from "./field-trial-engine.mjs";
import {describeStep} from "./field-trial-witness.mjs";
import {canonical, sha256, summarize} from "./night-review.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "docs/evidence/night-shift-repair/scout-ruling.json";
const SCOUT = "docs/evidence/night-shift-repair/scout.json";
const BRIEF = "docs/evidence/night-shift-repair/brief.json";
// Native Kiro workflow recorded under balance-sweep in docs/evidence/night-shift-repair/native-runs.json.
const NATIVE_WORKFLOW_ID = "wf_80aa97dac058694f";
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const COMPILER_REJECTION = /^candidate card (?:compile|check) failed: /;
// The per-cohort arm values the scout's stats() stores; a replay must reproduce each exactly.
const ARM_KEYS = ["games", "cowboyWins", "wizardWins", "draws", "firstWins", "cowboyShare", "wizardShare", "drawShare",
  "firstShare", "seatSkew", "meanEndTurn"];

export class Problem extends Error {}
const check = (ok, message) => { if (!ok) throw new Problem(message); };
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => canonical(a) === canonical(b);
const near = (a, b) => typeof a === "number" && Math.abs(a - b) < 1e-9;
const whole = (n) => Number.isSafeInteger(n) && n >= 0;
const names = (cohorts) => cohorts.map((c) => c.name).sort();
const winnerOf = (w) => (FACTIONS.includes(w) ? w : "draw");

// ---- pure: the scout record ----

// Every ±1 attack/health/stars neighbor of every brief card, split by the brief bounds, in the scout's plan order.
function neighborPlan(cards, bounds) {
  const candidates = [], excluded = [];
  for (const c of cards) for (const field of FIELDS) for (const delta of [-1, 1]) {
    const [low, high] = bounds[field], from = c[field], to = from + delta;
    const edit = {id: `${c.card}.${field}${delta < 0 ? "-1" : "+1"}`, card: c.card, field, from, to};
    if (to < low || to > high) excluded.push({...edit, reason: `outside ${low}..${high}`});
    else candidates.push(edit);
  }
  return {candidates, excluded};
}

// One stored arm: whole counts that add up to the cohort's games, and shares that match them.
function checkArm(row, games, what) {
  check(plain(row) && row.games === games && [row.cowboyWins, row.wizardWins, row.draws, row.firstWins].every(whole)
    && row.cowboyWins + row.wizardWins + row.draws === games && row.firstWins <= games - row.draws, `${what}: wins and draws do not add up to ${games} games`);
  check(near(row.cowboyShare, (100 * row.cowboyWins) / games) && near(row.wizardShare, (100 * row.wizardWins) / games)
    && near(row.drawShare, (100 * row.draws) / games) && near(row.firstShare, (100 * row.firstWins) / games), `${what}: shares do not match its counts`);
}

// NSB-1/NSB-2 as the scout derives them from this arm and its cohort baseline; each pass flag must agree with its
// distance outside the limit. Returns whether the arm meets both checks.
function checkRequirements(row, base, contract, what) {
  const [low, high] = contract.band, limit = base.seatSkew + contract.seatTolerancePp;
  const n1 = row.requirements?.["NSB-1"], n2 = row.requirements?.["NSB-2"];
  const out1 = Math.max(0, ...[row.cowboyShare, row.wizardShare].map((v) => Math.max(low - v, v - high)));
  check(plain(n1) && n1.cowboyShare === row.cowboyShare && n1.wizardShare === row.wizardShare && same(n1.band, contract.band)
    && n1.outsidePp === out1 && n1.pass === (out1 === 0), `${what}: NSB-1 does not follow from its shares`);
  const out2 = Math.max(0, row.seatSkew - limit);
  check(plain(n2) && n2.seatSkew === row.seatSkew && n2.baselineSeatSkew === base.seatSkew && n2.seatTolerancePp === contract.seatTolerancePp
    && n2.maxSeatSkew === limit && n2.outsidePp === out2 && n2.pass === (out2 === 0), `${what}: NSB-2 does not follow from its seat skew`);
  return n1.pass && n2.pass;
}

// The scout only proposes edits inside the brief. Compiler rejections are proposals but play no games.
export function countsOf(result) {
  const measured = result.candidates.filter((c) => c.status === "measured");
  const games = (rows) => Object.values(rows).reduce((n, row) => n + row.games, 0);
  return {proposed: result.candidates.length, measured: measured.length,
    compilerRejected: result.candidates.filter((c) => c.status === "engine-rejected").length,
    eligible: measured.filter((m) => m.passesNsb1AndNsb2BothCohorts).length,
    simulatedGames: games(result.baseline) + measured.reduce((n, m) => n + games(m.cohorts), 0)};
}

// Pure: one block per scout cohort for an edit: Cowboy wins against the band's Cowboy ceiling in whole wins (as the
// ruling view counts them), and the cohort's stored NSB-1 and NSB-2 result.
export function blocksOf(record, baseline, cohorts, ceilingPct) {
  return cohorts.map(({name}) => {
    const row = record.cohorts[name], limit = Math.floor((ceilingPct * row.games) / 100 + 1e-9);
    return {id: name, games: row.games, cowboyWins: row.cowboyWins, candidatePct: row.cowboyShare, baselinePct: baseline[name].cowboyShare,
      ceilingPct, overByWins: Math.max(0, row.cowboyWins - limit), pass: row.requirements["NSB-1"].pass && row.requirements["NSB-2"].pass};
  });
}

// Pure: checks the committed scout record against its brief and the frozen protocol and rules on it. Returns the
// ruling fields that follow from the record alone, plus the nearest measured edit (lowest stored worstOutsidePp,
// then evenDistancePp, then plan order) for the replay. Throws Problem on any inconsistency, and when any measured
// edit meets NSB-1 and NSB-2 on both scout cohorts (then this is not a declined case).
export function ruleScout(scout, brief, briefSha256, protocol) {
  check(plain(scout) && scout.schema === "field-trial-scout/scout@1" && plain(scout.result) && scout.result.schema === "field-trial-scout/result@1",
    `${SCOUT} is not a field-trial scout record`);
  const r = scout.result;
  check(scout.resultSha256 === sha256(canonical(r)), `${SCOUT}: result does not match its canonical resultSha256`);
  check(plain(brief) && brief.schema === "contest-balance/brief@1" && scout.brief?.sha256 === briefSha256, `${BRIEF} is not the brief this scout read`);
  check(scout.attempt === brief.attempt && OBJECT_ID.test(r.base ?? "") && r.base === brief.base, `${SCOUT} names another attempt or base than ${BRIEF}`);
  check(plain(r.gameInputs) && same(Object.keys(r.gameInputs).sort(), [...INPUT_PATHS].sort()) && INPUT_PATHS.every((p) => OBJECT_ID.test(r.gameInputs[p] ?? "")),
    `${SCOUT}: gameInputs must pin exactly ${INPUT_PATHS.join(", ")}`);
  const contract = r.contract;
  check(plain(contract) && Array.isArray(contract.band) && contract.band.length === 2 && contract.band.every(Number.isFinite)
    && same(contract.band, brief.policy?.band) && contract.seatTolerancePp === brief.policy?.seatTolerancePp, `${SCOUT}: contract band or seat tolerance differs from the brief`);

  const problems = protocolProblems(protocol);
  check(!problems.length, `${PROTOCOL_PATH}: ${problems.join("; ")}`);
  const cohorts = protocol.scout.map((c, i) => ({name: `scout-${i + 1}`, first: c.first, deals: c.deals, games: FACTIONS.length * c.deals}));
  check(cohorts.length === 2 && same(r.scoutCohorts, cohorts), `${SCOUT}: scout cohorts differ from the frozen ${PROTOCOL_PATH} scout ranges`);
  for (const s of cohorts) for (const c of protocol.confirm) check(s.first + s.deals <= c.first || c.first + c.deals <= s.first, `${s.name} overlaps a confirm range`);
  check(plain(r.baseline) && same(Object.keys(r.baseline).sort(), names(cohorts)), `${SCOUT}: baseline must cover exactly the scout cohorts`);
  for (const c of cohorts) {
    const b = r.baseline[c.name];
    check(b?.first === c.first && b.deals === c.deals, `${SCOUT}: baseline ${c.name} is not the frozen range`);
    checkArm(b, c.games, `baseline ${c.name}`);
    checkRequirements(b, b, contract, `baseline ${c.name}`);
  }

  check(Array.isArray(brief.cards) && Array.isArray(brief.fields) && same([...brief.fields].sort(), [...FIELDS].sort())
    && FIELDS.every((f) => Array.isArray(brief.bounds?.[f]) && brief.bounds[f].length === 2 && brief.bounds[f].every(Number.isSafeInteger)), `${BRIEF}: cards, fields or bounds are malformed`);
  check(Array.isArray(r.cards) && same(r.cards.map((c) => c?.card), brief.cards) && r.cards.every((c) => FIELDS.every((f) => Number.isSafeInteger(c[f]))),
    `${SCOUT}: base cards differ from the brief`);
  const plan = neighborPlan(r.cards, brief.bounds);
  check(same(r.excluded, plan.excluded), `${SCOUT}: out-of-bounds edits differ from the brief bounds`);
  const planned = new Map(plan.candidates.map((e, index) => [e.id, {...e, index}]));
  check(Array.isArray(r.candidates) && same(r.candidates.map((c) => String(c?.id)).sort(), [...planned.keys()].sort()), `${SCOUT}: edits are not exactly the brief's in-bounds neighbors`);
  for (const c of r.candidates) {
    const e = planned.get(c.id);
    check(c.card === e.card && c.field === e.field && c.from === e.from && c.to === e.to, `${SCOUT}: ${c.id} is not its planned edit`);
  }
  const measured = r.candidates.filter((c) => c.status === "measured"), rejected = r.candidates.filter((c) => c.status === "engine-rejected");
  check(measured.length + rejected.length === r.candidates.length, `${SCOUT}: an edit is neither measured nor engine-rejected`);
  check(rejected.every((c) => COMPILER_REJECTION.test(c.error ?? "")), `${SCOUT}: an engine rejection is not a card-compiler rejection`);
  for (const m of measured) {
    check(plain(m.cohorts) && same(Object.keys(m.cohorts).sort(), names(cohorts)), `${m.id}: cohorts must be exactly the scout cohorts`);
    const rows = cohorts.map((c) => m.cohorts[c.name]);
    const meets = cohorts.map((c, i) => {
      checkArm(rows[i], c.games, `${m.id} ${c.name}`);
      check(whole(rows[i].changedGames) && rows[i].changedGames <= c.games, `${m.id} ${c.name}: changedGames is not a game count`);
      return checkRequirements(rows[i], r.baseline[c.name], contract, `${m.id} ${c.name}`);
    });
    check(m.passesNsb1AndNsb2BothCohorts === meets.every(Boolean), `${m.id}: passesNsb1AndNsb2BothCohorts disagrees with its cohorts`);
    check(m.worstOutsidePp === Math.max(...rows.flatMap((x) => [x.requirements["NSB-1"].outsidePp, x.requirements["NSB-2"].outsidePp]))
      && m.evenDistancePp === Math.max(...rows.map((x) => Math.abs(x.cowboyShare - x.wizardShare) / 2)), `${m.id}: stored distances do not follow from its cohorts`);
  }

  const index = (c) => planned.get(c.id).index;
  const ranked = [...measured].sort((a, b) => a.worstOutsidePp - b.worstOutsidePp || a.evenDistancePp - b.evenDistancePp || index(a) - index(b));
  check(same(r.candidates.map((c) => c.id), [...ranked, ...[...rejected].sort((a, b) => index(a) - index(b))].map((c) => c.id)),
    `${SCOUT}: edits are not in the scout's ranking by stored distance`);
  const eligible = measured.filter((m) => m.passesNsb1AndNsb2BothCohorts);
  check(same(r.counts, {candidates: plan.candidates.length, measured: measured.length, rejected: rejected.length, excluded: plan.excluded.length,
    passingNsb1AndNsb2BothCohorts: eligible.length}), `${SCOUT}: counts do not add up`);
  check(eligible.length === 0, `${eligible.map((m) => m.id).join(", ")} meet NSB-1 and NSB-2 on both scout cohorts; this is not a declined case`);
  check(ranked.length > 0, `${SCOUT}: no measured edit to rule on`);

  const nearest = ranked[0];
  const blocks = blocksOf(nearest, r.baseline, cohorts, contract.band[1]);
  check(blocks.every((b) => b.pass || b.overByWins > 0), `${nearest.id}: a failing block is not over the Cowboy ceiling, so the ruling view cannot explain the hold`);
  return {result: r, cohorts, nearest, ruling: {schema: 1, verdict: "withheld", nativeWorkflowId: NATIVE_WORKFLOW_ID, sourceSha256: scout.resultSha256,
    base: r.base, inputs: r.gameInputs, counts: countsOf(r), change: {card: nearest.card, field: nearest.field, from: nearest.from, to: nearest.to}, blocks}};
}

// ---- pure: the example deal ----

// Index of the first row where two applied-event logs differ (turn and event), or -1 when one log is a prefix of
// the other and so has no event to compare.
export function firstDifference(x, y) {
  const k = x.findIndex((row, i) => i >= y.length || !same([row.turn, row.event], [y[i].turn, y[i].event]));
  return k < 0 || k >= y.length ? -1 : k;
}

// One side's recorded move at the first difference. When both sentences read the same, the differing event fields
// are named so the two lines stay distinct.
function moveOf(row, other) {
  const fields = Object.keys({...row.event, ...other.event}).sort().filter((k) => !same(row.event[k] ?? null, other.event[k] ?? null));
  let label = row.label;
  if (row.label === other.label) {
    if (fields.length === 1 && fields[0] === "attackerLeft") {
      const left = row.event.attackerLeft;
      label += `. The attacker has ${left} ${left === 1 ? "orb" : "orbs"} left.`;
    } else {
      label += ` (${fields.map((k) => `${k} ${JSON.stringify(row.event[k] ?? null)}`).join(", ")})`;
    }
  }
  const move = {label, turn: row.turn};
  if (typeof row.event.cardId === "string") move.card = row.event.cardId;
  if (typeof row.event.target === "string") move.target = row.event.target;
  return move;
}

// Pure: the example for one replayed seed and start from both traces ({rows: [{turn, event, label}], result}).
export function exampleOf(seed, first, baseline, candidate) {
  const k = firstDifference(baseline.rows, candidate.rows);
  check(k >= 0, `seed ${seed} ${first}: one event log is a prefix of the other, so no first differing event can be captured`);
  const [x, y] = [baseline.rows[k], candidate.rows[k]];
  check(x.turn === y.turn && Number.isSafeInteger(x.turn) && x.turn >= 1, `seed ${seed} ${first}: the first differing events fall on turns ${x.turn} and ${y.turn}`);
  const winners = [baseline, candidate].map((t) => winnerOf(t.result?.winner));
  check(winners[0] !== winners[1], `seed ${seed} ${first}: the traced winners do not differ`);
  return {seed, first, turn: x.turn, baseline: {winner: winners[0], move: moveOf(x, y)}, candidate: {winner: winners[1], move: moveOf(y, x)}};
}

// ---- replay ----

// One scout game as the scout's playCohort records it (winner null for a draw), plus the raw result.
async function game(rules, seed, first) {
  const out = await playTrial(rules, seed, first);
  const winner = out?.winner === "draw" || out?.winner == null ? null : out.winner;
  check(plain(out) && (winner === null || FACTIONS.includes(winner)) && whole(out.endTurn), `seed ${seed} ${first}: playTrial returned no usable result`);
  return {row: {seed, first, winner, endTurn: out.endTurn}, out};
}

// The scout's stats(): summarize() plus the shares and mean end turn it stores per arm.
function arm(games) {
  const s = summarize(games), pct = (k) => (100 * k) / s.games;
  return {games: s.games, cowboyWins: s.cowboy, wizardWins: s.wizard, draws: s.draw, firstWins: s.first, cowboyShare: s.cowboyShare,
    wizardShare: pct(s.wizard), drawShare: pct(s.draw), firstShare: s.firstShare, seatSkew: s.seatSkew,
    meanEndTurn: games.reduce((sum, g) => sum + g.endTurn, 0) / s.games};
}

// One duel through field-trial-engine's playTrial observer: a row per real applied event, in the witness's words.
async function traceGame(rules, seed, first) {
  const rows = [];
  const result = await playTrial(rules, seed, first, (before, applied) => {
    check(plain(before) && Array.isArray(applied?.events) && applied.events.every(plain), `seed ${seed} ${first}: engine step without a before state and applied.events`);
    const labels = describeStep(before, applied);
    applied.events.forEach((event, i) => rows.push({turn: before.turn, event: JSON.parse(JSON.stringify(event)), label: labels[i]}));
  });
  return {rows, result};
}

// Rebuilds the base and the nearest edit at the frozen base, replays both scout cohorts in the scout's order, requires
// the stored arms and changed-result counts exactly, then traces the first scout game whose winner changes
// (cohort order, ascending seed, Cowboy then Wizard start).
async function replay({result, cohorts, nearest}, change) {
  const scratch = mkdtempSync(join(tmpdir(), "scout-ruling-"));
  try {
    const engines = [await openTrialEngine(join(scratch, "baseline"), result.base, null, result.gameInputs),
      await openTrialEngine(join(scratch, "candidate"), result.base, {...change}, result.gameInputs)];
    for (const e of engines) check(same(e.inputs, result.gameInputs), "engine game inputs differ from the scout's frozen inputs");
    const [base, cand] = engines.map((e) => e.rules);
    let flip = null;
    for (const c of cohorts) {
      const a = [], b = [];
      for (let seed = c.first; seed < c.first + c.deals; seed++) for (const first of FACTIONS) {
        const x = await game(base, seed, first), y = await game(cand, seed, first);
        a.push(x.row);
        b.push(y.row);
        if (!flip && x.row.winner !== y.row.winner) flip = {seed, first, results: [x.out, y.out]};
      }
      for (const [which, got, stored] of [["baseline", arm(a), result.baseline[c.name]], [nearest.id, arm(b), nearest.cohorts[c.name]]]) {
        const off = ARM_KEYS.filter((k) => got[k] !== stored[k]);
        check(!off.length, `${c.name} ${which}: replay differs from ${SCOUT} in ${off.map((k) => `${k} ${got[k]} vs ${stored[k]}`).join(", ")}`);
      }
      const changed = a.filter((g, i) => g.winner !== b[i].winner).length;
      check(changed === nearest.cohorts[c.name].changedGames, `${c.name}: replay changed ${changed} winners, ${SCOUT} stores ${nearest.cohorts[c.name].changedGames}`);
    }
    check(flip, `${nearest.id}: no scout game changed its winner on replay`);
    const traces = [await traceGame(base, flip.seed, flip.first), await traceGame(cand, flip.seed, flip.first)];
    check(same(traces.map((t) => t.result), flip.results), `seed ${flip.seed} ${flip.first}: traced play differs from untraced play`);
    return exampleOf(flip.seed, flip.first, ...traces);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}

// ---- CLI ----

function readText(rel) {
  check(existsSync(join(ROOT, rel)), `${rel} is missing`);
  return readFileSync(join(ROOT, rel), "utf8");
}
function parse(text, rel) {
  try { return JSON.parse(text); } catch { throw new Problem(`${rel} is not valid JSON`); }
}

async function compute() {
  const briefText = readText(BRIEF);
  const ruled = ruleScout(parse(readText(SCOUT), SCOUT), parse(briefText, BRIEF), sha256(briefText), parse(readText(PROTOCOL_PATH), PROTOCOL_PATH));
  const example = await replay(ruled, ruled.ruling.change);
  return {...ruled.ruling, example, freshRun: false, applied: false};
}

// The approved ruling view must accept the record exactly as written: its inputs and types win.
async function displayable(ruling) {
  const {checkRuling} = await import("../src/ui/scout-ruling.js");
  const shown = checkRuling(ruling);
  check(shown.ok, `src/ui/scout-ruling.js does not show this ruling (${shown.reason}): ${shown.text}`);
}

const summary = (r) => [
  `scout ruling ${r.verdict}: ${r.change.card} ${r.change.field} ${r.change.from} → ${r.change.to}, the nearest of ${r.counts.measured} measured edits `
    + `(${r.counts.eligible} meet NSB-1 and NSB-2 on both scout cohorts; ${r.counts.compilerRejected} compiler-rejected; ${r.counts.proposed} proposed; ${r.counts.simulatedGames} simulated scout games)`,
  ...r.blocks.map((b) => `  ${b.id}: Cowboys ${b.cowboyWins}/${b.games} (${b.candidatePct}%, current card ${b.baselinePct}%), ceiling ${b.ceilingPct}%`
    + (b.pass ? ", within the limit" : `, held: over the limit by ${b.overByWins}`)),
  `  seed ${r.example.seed}, ${r.example.first} first, first difference on turn ${r.example.turn}:`,
  `    current:  ${r.example.baseline.move.label} (winner ${r.example.baseline.winner})`,
  `    proposed: ${r.example.candidate.move.label} (winner ${r.example.candidate.winner})`,
].join("\n");

async function generate() {
  const ruling = await compute();
  const path = join(ROOT, OUT), previous = existsSync(path) ? readFileSync(path, "utf8") : null;
  writeFileSync(path, JSON.stringify(ruling, null, 2) + "\n");
  try {
    await displayable(ruling);
  } catch (error) {
    if (previous === null) rmSync(path); else writeFileSync(path, previous);
    throw error;
  }
  console.log(`${summary(ruling)}\n  wrote ${OUT}`);
}

async function verify() {
  const committed = parse(readText(OUT), OUT);
  const ruling = await compute();
  const off = Object.keys(ruling).filter((k) => !same(committed?.[k] ?? null, ruling[k]));
  check(plain(committed) && !off.length && same(Object.keys(committed).sort(), Object.keys(ruling).sort()),
    `${OUT} differs from the recomputed ruling${off.length ? ` in: ${off.join(", ")}` : " in its keys"}`);
  await displayable(committed);
  console.log(`verified ${OUT}\n${summary(ruling)}`);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--verify")) {
    console.error("Usage: node scripts/scout-ruling.mjs [--verify]");
    process.exitCode = 2;
  } else {
    try {
      await (args.length ? verify() : generate());
    } catch (error) {
      console.error(`scout-ruling: ${error instanceof Problem ? error.message : error.stack ?? String(error)}`);
      process.exitCode = 1;
    }
  }
}
