// Shared, side-effect-free engine setup for the Billy replay verifier and the seat audit.
// Extracts the pinned original game inputs, builds the baseline and the one-field candidate, and plays bot duels.
import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {cpSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {BILLY_REPLAY as record} from "../src/ui/billy-replay.data.js";
import {changeField, sha256} from "./night-review.mjs";

export {record};
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const rules = "prototypes/showdown/rules.js";
export const compiler = "scripts/sync-card-specs.mjs";
export const cards = ".kiro/specs/duel-card-pipeline/cards";
export const CARD = "cowboy-billy";
export const FIELD = "attack";
export const BOT_LEVEL = 2;
export const pinned = Object.freeze({
  "src/game": "dcc005548330b0c349ed0e60de58793b737a3285",
  [cards]: "d1b0144247a2a06a0fa37d9c7ca5c8389525062d",
  [compiler]: "84dce359f70ad64e634b2d3d2a0445bd476f7c3b",
  [rules]: "66538aca2b7660c8bd7717a03dee364f8489c184",
});
const gitOptions = {cwd: root, env: {...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0"}};

export function snapshot(dir) {
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

// Builds both snapshots under scratch and returns the rules module URLs [baseline, candidate].
export function prepareEngines(scratch) {
  const baseline = join(scratch, "baseline"), candidate = join(scratch, "candidate");
  snapshot(baseline);
  cpSync(baseline, candidate, {recursive: true});
  const path = join(candidate, cards, CARD + ".json");
  const before = readFileSync(path, "utf8");
  const after = changeField(before, FIELD, record.baseline.attack, record.candidate.attack);
  assert.deepEqual([sha256(before), sha256(after)], record.source.cardHashes, "Billy proposal source hashes");
  writeFileSync(path, after);
  execFileSync(process.execPath, [compiler, "--check"], {cwd: baseline});
  execFileSync(process.execPath, [compiler], {cwd: candidate});
  return [baseline, candidate].map(dir => pathToFileURL(join(dir, rules)).href);
}

export const loadEngines = urls => Promise.all(urls.map(url => import(url)));

export async function engines(scratch) {
  return loadEngines(prepareEngines(scratch));
}

export function play(engine, seed, first, observe) {
  let state = engine.createShowdown(seed, {first});
  while (!state.result) state = engine.playTurn(state, BOT_LEVEL, observe).state;
  return {winner: state.result.winner ?? "draw", endTurn: state.turn};
}
