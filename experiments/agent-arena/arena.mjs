// Kiro Agent Arena: two Kiro personas each write one data-only playbook (playbook.js), then this
// referee plays a seeded Showdown series with the real engine (src/game/showdown/rules.js). Every
// action is one the engine lists as legal; the playbook only ranks and filters that list from the
// deciding seat's view. Card, turn and orb rules are the engine's, unchanged.
//
//   node experiments/agent-arena/arena.mjs prepare   archive any earlier run; write brief.json, status.json
//   node experiments/agent-arena/arena.mjs play      validate both playbooks, play the series, write results and one replay
//   node experiments/agent-arena/arena.mjs verify    re-check digests, replay every decision, replay the series
// Exit status: 0 done, 1 verification failed, 2 unusable input (missing brief, missing or invalid playbook).
import {existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {engineFingerprint} from "../../.kiro/powers/orb-duel-review/showdown.mjs";
import {applyAction, createShowdown, legalActions} from "../../src/game/showdown/rules.js";
import {GUIDE, PERSONAS, canonical, decide, parsePlaybook, policyDigest, seatView, sha256} from "./playbook.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const RUN = ".artifacts/agent-arena";
const FILES = {brief: `${RUN}/brief.json`, status: `${RUN}/status.json`, results: `${RUN}/results.json`, replay: `${RUN}/replay.json`};
export const playbookPath = (persona) => `${RUN}/playbooks/${persona}.json`;
// The series: each deal is played twice, once with each side moving first.
export const SERIES = Object.freeze({from: 0, deals: 8});
export const SEATS = Object.freeze(["cowboy", "wizard"]);
// A guard against a runaway loop; the engine's turn cap ends every game long before this.
export const MAX_DECISIONS = 5000;
export const MAX_REPLAY_STEPS = 1500;
const ENGINE_ENTRIES = ["src/game/showdown/rules.js", "experiments/agent-arena/arena.mjs"];
const SURFACE = "local CLI referee; playbooks authored by the Kiro persona workflow steps";

class InputError extends Error {}
const personaOf = (side) => Object.keys(PERSONAS).find((persona) => PERSONAS[persona].side === side);
const at = (rel) => join(ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(at(rel), "utf8"));
const writeJson = (rel, value) => {
  mkdirSync(dirname(at(rel)), {recursive: true});
  writeFileSync(at(rel), JSON.stringify(value, null, 2) + "\n");
};
const status = (stage, pass, details = {}) => writeJson(FILES.status, {stage, pass, at: new Date().toISOString(), ...details});

// One game. books is {cowboy, wizard} validated playbooks. With record, also the step-by-step replay.
export function playGame(seed, first, books, {record = false} = {}) {
  let state = createShowdown(seed, {first});
  const actions = {cowboy: {}, wizard: {}};
  const ruledOut = {cowboy: 0, wizard: 0};
  const steps = [];
  let decisions = 0;
  while (!state.result) {
    if (++decisions > MAX_DECISIONS) throw new Error(`seed ${seed}: no result after ${MAX_DECISIONS} decisions`);
    const side = state.active;
    const legal = legalActions(state);
    const choice = decide(seatView(state), legal, books[side]);
    const applied = applyAction(state, choice.action);
    actions[side][choice.type] = (actions[side][choice.type] ?? 0) + 1;
    if (choice.ruledOut) ruledOut[side] += 1;
    if (record) steps.push({n: decisions, turn: state.turn, side, persona: personaOf(side), legal, chosen: choice.index,
      action: choice.action, type: choice.type, ruledOut: choice.ruledOut, events: applied.events});
    state = applied.state;
  }
  const winner = state.result.winner;
  const game = {seed, first, winner: winner ?? "draw", winnerPersona: winner ? personaOf(winner) : null, reason: state.result.reason,
    turns: state.turn, decisions, bases: {cowboy: state.sides.cowboy.base, wizard: state.sides.wizard.base},
    actions, decisionsWithRuledOutActions: ruledOut};
  return record ? {game, steps, result: state.result} : {game};
}

export function summarize(games) {
  const personas = Object.keys(PERSONAS);
  const wins = Object.fromEntries([...personas, "draw"].map((name) => [name, 0]));
  const byStartingSeat = Object.fromEntries(SEATS.map((side) => [side, {games: 0, ...wins}]));
  const endings = {};
  const actions = Object.fromEntries(personas.map((name) => [name, {}]));
  const ruledOut = Object.fromEntries(personas.map((name) => [name, 0]));
  for (const game of games) {
    const key = game.winnerPersona ?? "draw";
    wins[key] += 1;
    byStartingSeat[game.first].games += 1;
    byStartingSeat[game.first][key] += 1;
    endings[game.reason] = (endings[game.reason] ?? 0) + 1;
    for (const side of SEATS) {
      const name = personaOf(side);
      for (const [type, count] of Object.entries(game.actions[side])) actions[name][type] = (actions[name][type] ?? 0) + count;
      ruledOut[name] += game.decisionsWithRuledOutActions[side];
    }
  }
  const turns = games.map((game) => game.turns);
  return {games: games.length, wins, byStartingSeat, endings,
    turns: {min: Math.min(...turns), mean: Number((turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(2)), max: Math.max(...turns)},
    actions, decisionsWithRuledOutActions: ruledOut};
}

export function playSeries(series, books) {
  const games = [];
  for (let seed = series.from; seed < series.from + series.deals; seed++) {
    for (const first of SEATS) games.push(playGame(seed, first, books).game);
  }
  return {games, summary: summarize(games)};
}

// The first game of the series whose whole match fits the replay bound, recorded decision by decision.
export function recordReplay(series, books, digests) {
  for (let seed = series.from; seed < series.from + series.deals; seed++) {
    for (const first of SEATS) {
      const {game, steps, result} = playGame(seed, first, books, {record: true});
      if (steps.length > MAX_REPLAY_STEPS) continue;
      return {kind: "agent-arena-replay/1", seed, first, personas: {cowboy: personaOf("cowboy"), wizard: personaOf("wizard")},
        playbookDigests: digests, decisions: steps.length, steps, result, finalBases: game.bases, turns: game.turns};
    }
  }
  throw new Error(`no game in the series fits ${MAX_REPLAY_STEPS} replay steps`);
}

// Both playbooks from their files, strictly validated. Throws InputError naming every problem.
function loadBooks({fresherThan = null} = {}) {
  const books = {};
  const playbooks = {};
  const problems = [];
  for (const [persona, {side}] of Object.entries(PERSONAS)) {
    const rel = playbookPath(persona);
    if (!existsSync(at(rel))) { problems.push(`${rel} is missing`); continue; }
    if (fresherThan !== null && statSync(at(rel)).mtimeMs < fresherThan) problems.push(`${rel} is older than this run's brief`);
    const text = readFileSync(at(rel), "utf8");
    const parsed = parsePlaybook(text, persona);
    if (!parsed.ok) { problems.push(...parsed.errors.map((error) => `${rel}: ${error}`)); continue; }
    books[side] = parsed.playbook;
    playbooks[persona] = {file: rel, side, fileSha256: sha256(text), policyDigest: policyDigest(parsed.playbook), policy: parsed.playbook};
  }
  if (problems.length) throw new InputError(problems.join("\n"));
  return {books, playbooks};
}

const digestsOf = (playbooks) => Object.fromEntries(Object.entries(playbooks).map(([name, each]) => [name, each.policyDigest]));
const fingerprint = () => {
  const {sha256: digest, fileCount, files} = engineFingerprint(ROOT, ENGINE_ENTRIES);
  return {sha256: digest, fileCount, files};
};

function summaryLines(summary, replay) {
  const [sheriff, wizard] = Object.keys(PERSONAS);
  return [
    `games ${summary.games}: ${sheriff} ${summary.wins[sheriff]}, ${wizard} ${summary.wins[wizard]}, draws ${summary.wins.draw}`,
    ...SEATS.map((side) => {
      const each = summary.byStartingSeat[side];
      return `${side} moves first (${each.games}): ${sheriff} ${each[sheriff]}, ${wizard} ${each[wizard]}, draws ${each.draw}`;
    }),
    `endings ${JSON.stringify(summary.endings)}; turns min ${summary.turns.min}, mean ${summary.turns.mean}, max ${summary.turns.max}`,
    ...Object.keys(PERSONAS).map((name) => `${name} actions ${JSON.stringify(summary.actions[name])}; decisions where its playbook ruled out a legal action: ${summary.decisionsWithRuledOutActions[name]}`),
    `replay: seed ${replay.seed}, ${replay.first} first, ${replay.decisions} decisions, ${replay.turns} turns, result ${JSON.stringify(replay.result)}`,
  ];
}

function prepare() {
  if (existsSync(at(RUN))) {
    const to = `.artifacts/agent-arena-archive/${new Date().toISOString().replace(/[:.]/g, "-")}`;
    mkdirSync(dirname(at(to)), {recursive: true});
    renameSync(at(RUN), at(to));
    console.log(`archived the earlier run to ${to}`);
  }
  mkdirSync(at(`${RUN}/playbooks`), {recursive: true});
  const engine = fingerprint();
  writeJson(FILES.brief, {
    kind: "agent-arena-brief/1", preparedAt: new Date().toISOString(),
    series: {...SERIES, startingSeats: SEATS, games: SERIES.deals * SEATS.length},
    personas: Object.fromEntries(Object.entries(PERSONAS).map(([persona, each]) => [persona, {...each, playbook: playbookPath(persona)}])),
    information: "Each decision sees only the deciding seat: its own hand and traps, both boards, both Bases, both graveyards, the location, and counts of the other hand, deck and face-down traps.",
    playbook: GUIDE,
    engine: {sha256: engine.sha256, fileCount: engine.fileCount},
  });
  status("prepared", false);
  console.log(`agent arena prepared: ${FILES.brief}; playbooks go to ${Object.keys(PERSONAS).map(playbookPath).join(" and ")}`);
}

function play() {
  if (!existsSync(at(FILES.brief))) throw new InputError(`${FILES.brief} is missing: run prepare first`);
  const brief = readJson(FILES.brief);
  const series = {from: brief.series.from, deals: brief.series.deals};
  let loaded;
  try { loaded = loadBooks({fresherThan: statSync(at(FILES.brief)).mtimeMs}); } catch (error) {
    if (error instanceof InputError) status("rejected", false, {errors: error.message.split("\n")});
    throw error;
  }
  const {books, playbooks} = loaded;
  const {games, summary} = playSeries(series, books);
  const replay = recordReplay(series, books, digestsOf(playbooks));
  writeJson(FILES.replay, replay);
  writeJson(FILES.results, {
    kind: "agent-arena-results/1", surface: SURFACE, playedAt: new Date().toISOString(), engine: fingerprint(),
    series, playbooks, games, summary, replay: {file: FILES.replay, sha256: sha256(readFileSync(at(FILES.replay))), seed: replay.seed, first: replay.first},
  });
  status("played", false);
  console.log(summaryLines(summary, replay).join("\n"));
  console.log(`agent arena played: ${FILES.results}, ${FILES.replay}`);
}

// Checks a recorded replay decision by decision: same legal list, same playbook choice, same events, same end.
export function replayProblems(replay, books) {
  const problems = [];
  let state = createShowdown(replay.seed, {first: replay.first});
  for (const step of replay.steps) {
    if (state.result) { problems.push(`step ${step.n}: the game had already ended`); break; }
    const legal = legalActions(state);
    if (canonical(legal) !== canonical(step.legal)) { problems.push(`step ${step.n}: recorded legal actions differ from the engine's`); break; }
    const choice = decide(seatView(state), legal, books[state.active]);
    if (choice.index !== step.chosen || canonical(choice.action) !== canonical(step.action)) { problems.push(`step ${step.n}: the playbook chooses a different action`); break; }
    const applied = applyAction(state, choice.action);
    if (canonical(applied.events) !== canonical(step.events)) { problems.push(`step ${step.n}: events differ`); break; }
    state = applied.state;
  }
  if (!problems.length && canonical(state.result) !== canonical(replay.result)) problems.push(`replay ends at ${JSON.stringify(state.result)}, recorded ${JSON.stringify(replay.result)}`);
  return problems;
}

function verify() {
  for (const rel of [FILES.brief, FILES.results, FILES.replay]) if (!existsSync(at(rel))) throw new InputError(`${rel} is missing`);
  const results = readJson(FILES.results);
  const {books, playbooks} = loadBooks();
  const problems = [];
  for (const [name, each] of Object.entries(playbooks)) {
    const recorded = results.playbooks?.[name];
    if (!recorded || recorded.fileSha256 !== each.fileSha256) problems.push(`${each.file} changed after play`);
    if (!recorded || recorded.policyDigest !== each.policyDigest) problems.push(`${name} policy digest differs from the one played`);
  }
  if (fingerprint().sha256 !== results.engine?.sha256) problems.push("engine fingerprint differs from the one played (stale run)");
  const replayBytes = readFileSync(at(FILES.replay));
  if (sha256(replayBytes) !== results.replay?.sha256) problems.push(`${FILES.replay} differs from the recorded digest`);
  const replay = JSON.parse(replayBytes.toString("utf8"));
  if (canonical(replay.playbookDigests) !== canonical(digestsOf(playbooks))) problems.push("replay was played with other playbooks");
  if (!problems.length) problems.push(...replayProblems(replay, books));
  if (!problems.length) {
    const again = playSeries(results.series, books);
    if (canonical(again.games) !== canonical(results.games)) problems.push("replaying the series gives different games");
    if (canonical(again.summary) !== canonical(results.summary)) problems.push("replaying the series gives a different summary");
  }
  status("verified", problems.length === 0, problems.length ? {problems} : {games: results.games.length, replayDecisions: replay.decisions});
  if (problems.length) {
    console.log(`agent arena verify FAILED:\n${problems.join("\n")}`);
    return 1;
  }
  console.log(summaryLines(results.summary, replay).join("\n"));
  console.log(`agent arena verified: playbook digests ${Object.values(digestsOf(playbooks)).map((d) => d.slice(0, 12)).join(", ")}; ${replay.decisions} replay decisions and ${results.games.length} games replayed identically`);
  return 0;
}

if (import.meta.main) {
  const command = process.argv[2];
  try {
    if (process.argv.length !== 3 || !["prepare", "play", "verify"].includes(command)) throw new InputError("usage: node experiments/agent-arena/arena.mjs prepare|play|verify");
    process.exitCode = command === "prepare" ? (prepare(), 0) : command === "play" ? (play(), 0) : verify();
  } catch (error) {
    console.error(error instanceof InputError ? error.message : error.stack);
    process.exitCode = 2;
  }
}
