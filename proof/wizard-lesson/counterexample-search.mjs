// Offline diagnostic for the pending native Wizard coach receipt. It asks one question: does an explicit, bounded seed
// range hold a grounded counterexample to the receipt's proposal? It reads the receipt and its bait, runs the rival's
// own engine search (scripts/wizard-lesson/challenge.mjs findCounterexamples) and replays every hit on the engine.
//
// No model call, no Kiro process, no network and no file writes. It never makes or edits a receipt: the receipt's
// status stays whatever train.mjs recorded. A counterexample found here is evidence against the proposal; it is not a
// lesson and makes no policy acceptable. Output is JSON on stdout.
//
// Policies:
//   original  the proposal recorded in the receipt by the native coach run. The verdict and exit code use only this.
//   control   (--control) DEFAULT_LESSON_POLICY from src/game/showdown/wizard-lesson-policy.js. A labeled comparison
//             that shows the search can find hits; it is not the coach's proposal and nothing accepts it.
//
// Branch search (--branch, opt-in). The seed scan follows one trajectory per seed: the level-2 bot plays the Cowboy and
// the policy plays the Wizard. The branch search also tries other legal Cowboy actions before a Wizard turn, in the
// manner of a limited-discrepancy search:
//   - Every Wizard turn on every prefix is the policy's own play (wizardTurn), so each prefix is reachable as
//     checkCounterexample requires. The Cowboy plays the original chooser (cowboyBotTurn) except at a deviation, where it
//     plays another action from legalActions. After a deviation the same chooser plans the rest of that turn and the
//     turns that follow.
//   - At each Wizard turn where Hellfire is legal and the policy holds, the unchanged production Wizard
//     (wizardTurn without a policy) and the receipt policy are played from the same state, and the Cowboy bot answers
//     each. A hold the policy loses and the production Wizard survives becomes an episode, which is accepted only if
//     replayEpisode and checkCounterexample confirm it from the seed. Only accepted episodes are printed in full.
//   Bounds: --depth deviations per prefix (0 = seed-scan trajectory only), --horizon Wizard turns checked after the last
//   deviation, --nodes branches per seed, --budget-ms wall-clock budget for the whole branch search. A Cowboy decision
//   state is skipped if it was already reached with at least as much depth and horizon left. All counts are reported.
//   Without --budget-ms cutting the run, the output is deterministic.
//
// Run:  node proof/wizard-lesson/counterexample-search.mjs [--from N] [--to N] [--max N] [--control]
//         [--receipt path] [--bait path] [--branch [--depth N] [--horizon N] [--nodes N] [--budget-ms N]]
// Seeds default to the receipt's limits.rivalSeeds. Exit 0: found for original (seed scan or branch search).
// Exit 2: none in range. Exit 1: error.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  CPU_SIDE, DEFAULT_LESSON_POLICY, PLAYER_SIDE, checkCounterexample, compareAtMarkedTurn, cowboyBotTurn, createEpisodeState,
  episodeKey, hellfireAction, recordEpisode, replayEpisode, validatePolicy, wizardTurn,
} from "../../src/game/showdown/wizard-lesson-policy.js";
import {applyAction, legalActions} from "../../src/game/showdown/rules.js";
import {RECEIPT_SCHEMA, loadBait} from "../../scripts/wizard-lesson/coach.mjs";
import {MAX_CANDIDATES, findCounterexamples, rivalSetup} from "../../scripts/wizard-lesson/challenge.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DEFAULT_RECEIPT = ".artifacts/wizard-lesson/native-training-receipt.json";
const DEFAULT_BAIT = ".artifacts/wizard-lesson/native-bait-episode.json";
const MAX_SPAN = 20000; // seeds per run; keeps the search bounded
const UINT32 = 2 ** 32 - 1;
// Branch-search bounds: [min, max, default].
const BRANCH_LIMITS = {depth: [0, 3, 1], horizon: [1, 6, 2], nodes: [1, 100000, 5000], budgetMs: [100, 600000, 120000]};
const BRANCH_FLAGS = {"--depth": "depth", "--horizon": "horizon", "--nodes": "nodes", "--budget-ms": "budgetMs"};
const MAX_PREFIX_ACTIONS = 400; // recordEpisode's default cap, so depth 0 follows the seed scan's trajectory

function parseArgs(argv) {
  const opts = {control: false, branch: false};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--control") { opts.control = true; continue; }
    if (arg === "--branch") { opts.branch = true; continue; }
    const key = {"--from": "from", "--to": "to", "--max": "max", "--receipt": "receipt", "--bait": "bait", ...BRANCH_FLAGS}[arg];
    if (!key || i + 1 >= argv.length) throw new Error(`unknown or incomplete argument ${JSON.stringify(arg)}`);
    opts[key] = argv[++i];
  }
  for (const key of ["from", "to", "max", ...Object.values(BRANCH_FLAGS)]) {
    if (opts[key] === undefined) continue;
    if (!/^\d+$/.test(opts[key])) throw new Error(`--${key} must be a whole number`);
    opts[key] = Number(opts[key]);
  }
  for (const [flag, key] of Object.entries(BRANCH_FLAGS)) {
    if (opts[key] !== undefined && !opts.branch) throw new Error(`${flag} needs --branch`);
  }
  return opts;
}

function branchLimits(opts) {
  const limits = {};
  for (const [flag, key] of Object.entries(BRANCH_FLAGS)) {
    const [min, max, fallback] = BRANCH_LIMITS[key];
    limits[key] = opts[key] ?? fallback;
    if (limits[key] < min || limits[key] > max) throw new Error(`${flag} must be ${min}-${max}`);
  }
  return limits;
}

const readJson = (rel) => {
  const bytes = readFileSync(resolve(ROOT, rel));
  return {path: rel, sha256: createHash("sha256").update(bytes).digest("hex"), data: JSON.parse(bytes.toString("utf8"))};
};

// Re-runs one candidate from its seed on the engine: replayEpisode checks every Wizard action is what the policy plays,
// and checkCounterexample re-judges the marked turn. Both are the functions verifyLessonBundle uses.
function replayCandidate(candidate, policy) {
  const base = {id: candidate.id, seed: candidate.seed, episodeKey: candidate.episodeKey,
    actions: candidate.episode.actions.length, markedIndex: candidate.episode.markedIndex, first: candidate.episode.setup.first};
  try {
    const {turnStart} = replayEpisode(candidate.episode, {policy});
    const check = checkCounterexample(candidate.episode, policy);
    return {...base, replayed: true, keyMatches: episodeKey(candidate.episode) === candidate.episodeKey,
      turn: turnStart.turn, wizardBase: turnStart.sides.wizard.base,
      cowboyTroops: turnStart.sides.cowboy.board.filter(Boolean).length, check, episode: candidate.episode};
  } catch (error) {
    return {...base, replayed: false, keyMatches: false, error: error.message, check: null, episode: candidate.episode};
  }
}

const sameAction = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stateKey = (state) => createHash("sha256").update(JSON.stringify(state)).digest("hex");
// The Cowboy bot's next turn after a Wizard turn, judged as checkCounterexample judges it.
const cowboyWinsAfter = (turn) => (turn.state.result ? turn.state.result.winner === PLAYER_SIDE
  : cowboyBotTurn(turn.state).state.result?.winner === PLAYER_SIDE);

// Depth-first branch search over Cowboy deviations. Returns grounded counterexamples and every count.
function branchSearch(policy, setup, seeds, limits, max) {
  const started = Date.now();
  const stats = {
    seedsTried: 0, seedsExhausted: 0, seedsCutByNodes: 0, seedsCutByTime: 0,
    cowboyDecisions: 0, alternatives: 0, branches: 0,
    leaves: {gameOver: 0, horizon: 0, actionCap: 0},
    wizardTurns: 0, hellfireLegal: 0,
    holds: {total: 0, baseline: 0, branched: 0},
    outcomes: {bothSurvive: 0, bothLose: 0, policyOnlyLoses: 0, originalOnlyLoses: 0},
    pruned: {duplicateState: 0, depthLimitDecisions: 0, nodeBudgetBranches: 0, timeBudget: 0},
  };
  const counterexamples = [];
  const rejected = [];
  let stoppedBy = "range";
  const outOfTime = () => Date.now() - started >= limits.budgetMs;

  // A qualifying hold: the production Wizard and the receipt policy from the same turn-start state.
  function atWizardTurn(ctx, state, prefix, path) {
    stats.wizardTurns += 1;
    const lesson = wizardTurn(state, {policy});
    if (!hellfireAction(state)) return lesson;
    stats.hellfireLegal += 1;
    if (!lesson.decisions.some((d) => d.decision === "hold")) return lesson;
    stats.holds.total += 1;
    stats.holds[path.devs ? "branched" : "baseline"] += 1;
    const original = wizardTurn(state);
    const policyLoses = cowboyWinsAfter(lesson);
    const originalLoses = cowboyWinsAfter(original);
    stats.outcomes[policyLoses ? (originalLoses ? "bothLose" : "policyOnlyLoses") : (originalLoses ? "originalOnlyLoses" : "bothSurvive")] += 1;
    if (!policyLoses || originalLoses) return lesson;
    const episode = {version: 1, seed: ctx.seed, setup: ctx.setup, actions: [...prefix, {side: CPU_SIDE, action: lesson.actions[0]}],
      markedIndex: prefix.length, tag: "bait"};
    let key = null;
    try { key = episodeKey(episode); } catch { /* replayCandidate reports the shape error */ }
    const id = `b${counterexamples.length + rejected.length + 1}-s${ctx.seed}-t${episode.actions.length}`;
    const replay = replayCandidate({id, seed: ctx.seed, episodeKey: key, episode}, policy);
    if (replay.replayed && replay.keyMatches && replay.check.refutes) {
      counterexamples.push({...replay, deviations: path.deviations, comparison: {
        production: {actions: original.actions, cowboyWinsNext: originalLoses},
        policy: {actions: lesson.actions, decisions: lesson.decisions, cowboyWinsNext: policyLoses},
      }});
      if (counterexamples.length >= max) ctx.abort = "max";
    } else {
      const {episode: _e, ...rest} = replay;
      rejected.push({...rest, deviations: path.deviations.length});
    }
    return lesson;
  }

  function explore(ctx, path) {
    let {state, since} = path;
    const prefix = [...path.actions];
    while (!ctx.abort) {
      if (state.result) return void (stats.leaves.gameOver += 1);
      if (prefix.length >= MAX_PREFIX_ACTIONS) return void (stats.leaves.actionCap += 1);
      if (state.active === CPU_SIDE) {
        const lesson = atWizardTurn(ctx, state, prefix, path);
        if (ctx.abort) return;
        for (const action of lesson.actions) prefix.push({side: CPU_SIDE, action});
        state = lesson.state;
        since += 1;
        if (path.devs > 0 && since >= limits.horizon && !state.result) return void (stats.leaves.horizon += 1);
        continue;
      }
      // Cowboy turn: the original chooser's actions, with deviations tried before each one while depth allows.
      const steps = [];
      const turn = cowboyBotTurn(state, (before, _applied, action) => steps.push({before, action}));
      const canDeviate = path.devs < limits.depth;
      if (!canDeviate) stats.pruned.depthLimitDecisions += steps.length;
      for (const {before, action} of steps) {
        if (canDeviate) {
          if (outOfTime()) {
            ctx.abort = "time";
            stats.pruned.timeBudget += 1;
            return;
          }
          stats.cowboyDecisions += 1;
          const left = [limits.depth - path.devs, path.devs ? limits.horizon - since : Infinity];
          const key = stateKey(before);
          const seen = ctx.visited.get(key);
          if (seen && seen[0] >= left[0] && seen[1] >= left[1]) return void (stats.pruned.duplicateState += 1);
          ctx.visited.set(key, left);
          const alternatives = legalActions(before).filter((legal) => !sameAction(legal, action));
          stats.alternatives += alternatives.length;
          for (const alt of alternatives) {
            if (ctx.abort) return;
            if (ctx.nodes >= limits.nodes) {
              ctx.cut = true;
              stats.pruned.nodeBudgetBranches += 1;
              continue;
            }
            ctx.nodes += 1;
            stats.branches += 1;
            explore(ctx, {
              state: applyAction(before, alt).state, since: 0, devs: path.devs + 1,
              actions: [...prefix, {side: PLAYER_SIDE, action: alt}],
              deviations: [...path.deviations, {index: prefix.length, turn: before.turn, bot: action, chosen: alt}],
            });
          }
          if (ctx.abort) return;
        }
        prefix.push({side: PLAYER_SIDE, action});
      }
      state = turn.state;
    }
  }

  for (let seed = seeds.from; seed <= seeds.to; seed++) {
    if (counterexamples.length >= max) { stoppedBy = "max"; break; }
    if (outOfTime()) { stoppedBy = "time"; break; }
    stats.seedsTried += 1;
    // recordEpisode resolves who opens exactly as the seed scan does; its setup is the one every prefix replays from.
    const {setup: resolved} = recordEpisode(seed, setup, {policy, stopAt: () => true});
    const ctx = {seed, setup: resolved, visited: new Map(), nodes: 0, cut: false, abort: false};
    explore(ctx, {state: createEpisodeState(seed, resolved), since: 0, devs: 0, actions: [], deviations: []});
    if (ctx.abort === "time") { stats.seedsCutByTime += 1; stoppedBy = "time"; break; }
    if (ctx.abort === "max") { stoppedBy = "max"; break; }
    if (ctx.cut) stats.seedsCutByNodes += 1;
    else stats.seedsExhausted += 1;
  }

  let reason = null;
  if (!counterexamples.length) {
    reason = stats.holds.total === 0 ? "the policy never held Hellfire on a searched Wizard turn"
      : `the policy held on ${stats.holds.total} searched Wizard turns (${stats.holds.branched} after a Cowboy deviation) `
        + "and no hold lost the next Cowboy turn where the production Wizard survived";
  }
  return {
    limits, stoppedBy, deterministic: stoppedBy !== "time", ms: Date.now() - started, ...stats,
    verdict: counterexamples.length ? "found" : "none", reason, counterexamples, rejected,
  };
}

function searchPolicy(label, source, policy, bait, seeds, max, branch) {
  const onBait = compareAtMarkedTurn(bait, policy);
  const {candidates, search} = findCounterexamples(policy, {setup: rivalSetup(bait), seeds, maxCandidates: max});
  const replays = candidates.map((c) => replayCandidate(c, policy));
  const grounded = replays.filter((r) => r.replayed && r.keyMatches && r.check.refutes);
  let why = null;
  if (!grounded.length) {
    why = search.held === 0 ? "the policy never held Hellfire on a Wizard turn in this range"
      : `the policy held on ${search.held} Wizard turns and the Cowboy bot never won the next turn where the original Wizard would not lose`;
  }
  return {
    label, source, policy,
    holdsOnBait: !onBait.lesson.usedHellfire, baitDecisions: onBait.lesson.decisions,
    search, verdict: grounded.length ? "found" : "none", reason: why,
    counterexamples: grounded,
    rejected: replays.filter((r) => !grounded.includes(r)).map(({episode: _e, ...rest}) => rest),
    ...(branch ? {branch: branchSearch(policy, rivalSetup(bait), seeds, branch, max)} : {}),
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const receipt = readJson(opts.receipt ?? DEFAULT_RECEIPT);
  const r = receipt.data;
  if (r.schema !== RECEIPT_SCHEMA) throw new Error(`receipt schema is ${JSON.stringify(r.schema)}, not ${RECEIPT_SCHEMA}`);
  if (r.fixture !== undefined) throw new Error("receipt is marked as a fixture; this diagnostic reads native receipts only");
  if (!r.proposal?.policy) throw new Error("receipt has no coach proposal");
  const coachRun = (r.runs ?? []).find((run) => run.role === "coach");
  if (!coachRun || coachRun.cli !== "kiro-cli" || coachRun.exit !== 0) throw new Error("receipt has no successful kiro-cli coach run");

  const baitFile = readJson(opts.bait ?? DEFAULT_BAIT);
  const {episode: bait, key, report: baitCheck} = loadBait(baitFile.data);
  if (key !== r.episodeKey) throw new Error(`bait key ${key} does not match receipt episodeKey ${r.episodeKey}`);

  const recorded = r.limits?.rivalSeeds ?? {};
  const seeds = {from: opts.from ?? recorded.from, to: opts.to ?? recorded.to};
  if (!Number.isInteger(seeds.from) || !Number.isInteger(seeds.to)) throw new Error("no seed range: pass --from and --to");
  if (seeds.from > seeds.to || seeds.to > UINT32) throw new Error("seed range must satisfy 0 <= from <= to <= 2^32-1");
  if (seeds.to - seeds.from + 1 > MAX_SPAN) throw new Error(`seed range is limited to ${MAX_SPAN} seeds per run`);
  const max = opts.max ?? MAX_CANDIDATES;
  if (max < 1 || max > 50) throw new Error("--max must be 1-50");
  const branch = opts.branch ? branchLimits(opts) : null;

  const started = Date.now();
  const original = searchPolicy("original", `receipt proposal from native coach run ${coachRun.runId}`, validatePolicy(r.proposal.policy), bait, seeds, max, branch);
  const control = opts.control
    ? searchPolicy("control", "CANDIDATE CONTROL: module DEFAULT_LESSON_POLICY, not the coach proposal, not accepted", DEFAULT_LESSON_POLICY, bait, seeds, max, branch)
    : null;
  const found = original.verdict === "found" || original.branch?.verdict === "found";

  const out = {
    diagnostic: "wizard-lesson-counterexample-search/1",
    offline: true, nativeCalls: 0, filesWritten: 0,
    receipt: {path: receipt.path, sha256: receipt.sha256, status: r.status, reasons: r.reasons, episodeKey: r.episodeKey,
      coachRun: {runId: coachRun.runId, model: coachRun.model, cliVersion: coachRun.cliVersion, finishedAt: coachRun.finishedAt},
      recordedRivalSeeds: recorded},
    bait: {path: baitFile.path, sha256: baitFile.sha256, episodeKey: key, report: baitCheck},
    seeds, maxCandidates: max, node: process.version,
    verdict: found ? "found" : "none",
    // Compares the seed scan only: that is the search the receipt's rival ran.
    agreesWithReceipt: r.status === "pending" && seeds.from === recorded.from && seeds.to === recorded.to
      ? original.verdict === "none" : null,
    ...(branch ? {
      branch: {...branch, verdictFrom: {seedScan: original.verdict, branchSearch: original.branch.verdict},
        note: "Diagnostic evidence only. The receipt is not modified, its status is unchanged, and no policy here is a lesson."},
    } : {}),
    original,
    ...(control ? {control} : {}),
    ms: Date.now() - started,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exitCode = found ? 0 : 2;
}

try {
  main();
} catch (error) {
  process.stderr.write(`counterexample-search: ${error.message}\n`);
  process.exitCode = 1;
}
