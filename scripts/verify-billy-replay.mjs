// Replay the recorded proposal without modifying a checkout. --full also verifies every paired outcome.
import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {BILLY_REPLAY as record} from "../src/ui/billy-replay.data.js";
import {changeField, sha256} from "./night-review.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rules = "prototypes/showdown/rules.js";
const compiler = "scripts/sync-card-specs.mjs";
const cards = ".kiro/specs/duel-card-pipeline/cards";
const pinned = {
  "src/game": "dcc005548330b0c349ed0e60de58793b737a3285",
  [cards]: "d1b0144247a2a06a0fa37d9c7ca5c8389525062d",
  [compiler]: "84dce359f70ad64e634b2d3d2a0445bd476f7c3b",
  [rules]: "66538aca2b7660c8bd7717a03dee364f8489c184",
};
const gitOptions = {cwd: root, env: {...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0"}};

function snapshot(dir) {
  const commit = record.source.commit;
  const hasCommit = spawnSync("git", ["cat-file", "-e", commit + "^{commit}"], gitOptions).status === 0;
  const ref = hasCommit ? commit : "HEAD";
  try {
    for (const [path, expected] of Object.entries(pinned)) {
      const id = execFileSync("git", ["rev-parse", "--verify", ref + ":" + path], {...gitOptions, encoding: "utf8"});
      assert.equal(id.trim(), expected, "Different game input at " + path);
    }
    const archive = execFileSync("git", ["archive", "--format=tar", ref, "--", ...Object.keys(pinned)], {...gitOptions, maxBuffer: 8 * 1024 * 1024});
    mkdirSync(dir);
    execFileSync("tar", ["-xf", "-", "-C", dir], {input: archive});
  } catch (error) {
    throw new Error(`Cannot read pinned game inputs. In a Git clone, run git fetch --depth=1 origin ${commit} and retry.\n${error.message}`);
  }
  writeFileSync(join(dir, "package.json"), '{"type":"module"}\n');
}

async function engines(scratch) {
  const baseline = join(scratch, "baseline"), candidate = join(scratch, "candidate");
  snapshot(baseline);
  cpSync(baseline, candidate, {recursive: true});
  const path = join(candidate, cards, "cowboy-billy.json");
  const before = readFileSync(path, "utf8");
  const after = changeField(before, "attack", record.baseline.attack, record.candidate.attack);
  assert.deepEqual([sha256(before), sha256(after)], record.source.cardHashes, "Billy proposal source hashes");
  writeFileSync(path, after);
  execFileSync(process.execPath, [compiler, "--check"], {cwd: baseline});
  execFileSync(process.execPath, [compiler], {cwd: candidate});
  return Promise.all([baseline, candidate].map(dir => import(pathToFileURL(join(dir, rules)).href)));
}

function play(engine, seed, first, observe) {
  let state = engine.createShowdown(seed, {first});
  while (!state.result) state = engine.playTurn(state, 2, observe).state;
  return {winner: state.result.winner ?? "draw", endTurn: state.turn};
}

function trace(engine) {
  const events = [];
  const result = play(engine, record.seed, record.first, (before, applied) => {
    for (const event of applied.events) {
      const row = {turn: before.turn, event};
      if (event.type === "attack" && event.target !== "base") {
        const attacker = before.sides[event.side].board.find(troop => troop?.cardId === event.cardId);
        const defender = before.sides[engine.opponent(event.side)].board.find(troop => troop?.cardId === event.target);
        row.attack = engine.attackOf(before, attacker);
        row.targetOrbsBefore = defender.health;
      }
      events.push(row);
    }
  });
  return {events, result};
}

function verifyTurn(pair) {
  const traces = pair.map(trace);
  const [before, after] = traces.map(t => t.events);
  const firstChange = before.findIndex((row, i) => !after[i] || row.turn !== after[i].turn || JSON.stringify(row.event) !== JSON.stringify(after[i].event));
  assert.equal(firstChange, record.matchedEvents, "First changed event");
  for (const [i, expected] of [record.baseline, record.candidate].entries()) {
    const {turn, event, attack, targetOrbsBefore} = traces[i].events[firstChange];
    assert.deepEqual([turn, event.type, event.cardId, event.target, targetOrbsBefore, attack, event.targetLeft],
      [record.turn, "attack", record.attackerId, record.targetId, record.targetOrbsBefore, expected.attack, expected.targetOrbsAfter], "First changed attack");
    assert.deepEqual(traces[i].result, {winner: expected.winner, endTurn: expected.endTurn}, "Recorded finish");
  }
  console.log(`Verified seed ${record.seed}, ${record.matchedEvents} matching events, turn ${record.turn} and both endings.`);
}

function verifyCohort(pair) {
  const k = record.cohort;
  const totals = {gamesPerArm: 0, baselineCowboyWins: 0, candidateCowboyWins: 0, baselineFirstWins: 0, candidateFirstWins: 0, switchedCowboyToWizard: 0, switchedWizardToCowboy: 0};
  const hash = createHash("sha256").update("seed,first,baseline_winner,candidate_winner,baseline_turn,candidate_turn\n");
  for (let seed = k.firstSeed; seed < k.firstSeed + k.deals; seed++) {
    for (const first of ["cowboy", "wizard"]) {
      const [b, c] = pair.map(engine => play(engine, seed, first));
      totals.gamesPerArm++;
      totals.baselineCowboyWins += Number(b.winner === "cowboy");
      totals.candidateCowboyWins += Number(c.winner === "cowboy");
      totals.baselineFirstWins += Number(b.winner === first);
      totals.candidateFirstWins += Number(c.winner === first);
      totals.switchedCowboyToWizard += Number(b.winner === "cowboy" && c.winner === "wizard");
      totals.switchedWizardToCowboy += Number(b.winner === "wizard" && c.winner === "cowboy");
      hash.update([seed, first, b.winner, c.winner, b.endTurn, c.endTurn].join(",") + "\n");
    }
  }
  for (const [key, value] of Object.entries(totals)) assert.equal(value, k[key], key);
  assert.equal(hash.digest("hex"), k.csvSha256, "SHA-256 of every paired outcome");
  console.log(`Verified ${2 * totals.gamesPerArm} games. Cowboy wins ${totals.baselineCowboyWins} -> ${totals.candidateCowboyWins} of ${totals.gamesPerArm}; CSV SHA-256 ${k.csvSha256}.`);
}

const args = process.argv.slice(2);
if (args.length && !(args.length === 1 && args[0] === "--full")) {
  console.error("Usage: node scripts/verify-billy-replay.mjs [--full]");
  process.exitCode = 2;
} else {
  const scratch = mkdtempSync(join(tmpdir(), "showdown-billy-"));
  try {
    const pair = await engines(scratch);
    verifyTurn(pair);
    if (args.length) verifyCohort(pair);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}
