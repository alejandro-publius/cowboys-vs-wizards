// Shared field-trial engine for scripts/field-trial-{scout,confirm,witness}.mjs.
// openTrialEngine extracts the four game inputs from this checkout's Git objects into a caller-owned
// directory, checks the base build, optionally applies one stat change to a scratch copy and compiles
// it, then loads the rules module. It never clones or fetches. playTrial plays one bot duel with the
// existing exported play() from billy-replay-engine.mjs (fixed decks, given first faction, level-2 bot
// both sides). Nothing is written outside the caller's directory; this checkout is only read.
import {spawnSync} from "node:child_process";
import {cpSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, isAbsolute, join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {BOT_LEVEL, play} from "./billy-replay-engine.mjs";
import {changeField} from "./night-review.mjs";

export {BOT_LEVEL};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RULES = "prototypes/showdown/rules.js";
export const COMPILER = "scripts/sync-card-specs.mjs";
export const CARDS = ".kiro/specs/duel-card-pipeline/cards";
const GENERATED = "src/game/card-specs.generated.js";
const CARD_TYPES = "src/game/showdown/cards.js";
export const INPUT_PATHS = Object.freeze(["src/game", CARDS, COMPILER, RULES]);
export const FIELDS = Object.freeze(["attack", "health", "stars"]);
// The bounds scripts/contest-balance.mjs applies. They are not enforced here: the card compiler
// decides whether a changed value is legal, so every value it accepts can be trialled.
export const BOUNDS = Object.freeze({attack: Object.freeze([0, 9]), health: Object.freeze([1, 12]), stars: Object.freeze([1, 8])});
export const FACTIONS = Object.freeze(["cowboy", "wizard"]);

const MAX_BUFFER = 256 * 1024 * 1024;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
// The compiler requires the same form for every card type and its file name.
const CARD_ID = /^[a-z]+(?:-[a-z]+)*$/;
const GIT_ENV = {...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0"};
const NODE_ENV = {...process.env};
delete NODE_ENV.NODE_COMPILE_CACHE;

function git(args, raw = false) {
  const r = spawnSync("git", args, {cwd: ROOT, env: GIT_ENV, maxBuffer: MAX_BUFFER, encoding: raw ? "buffer" : "utf8"});
  if (r.error) throw new Error(`git ${args[0]}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(r.stderr).trim()}`);
  return raw ? r.stdout : r.stdout.trim();
}

function runNode(cwd, args, label) {
  const r = spawnSync(process.execPath, args, {cwd, env: NODE_ENV, encoding: "utf8", maxBuffer: MAX_BUFFER});
  if (r.error || r.status !== 0) throw new Error(`${label} failed: ${(r.error?.message ?? r.stderr + r.stdout).trim()}`);
}

// Accepts a path that does not exist yet (created private) or a fresh empty directory such as mkdtempSync returns.
function prepareDir(dir) {
  if (typeof dir !== "string" || !isAbsolute(dir)) throw new Error("dir must be an absolute path");
  const stat = lstatSync(dir, {throwIfNoEntry: false});
  if (!stat) return mkdirSync(dir, {mode: 0o700});
  if (!stat.isDirectory() || readdirSync(dir).length) throw new Error(`${dir} must be a new, empty directory`);
}

function checkRef(ref) {
  if (ref === "HEAD" || (typeof ref === "string" && OBJECT_ID.test(ref))) return ref;
  throw new Error("ref must be HEAD or a full lowercase commit ID");
}

function checkExpected(expected) {
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) throw new Error("expectedInputs must be an object");
  const keys = Object.keys(expected).sort();
  if (keys.join("\n") !== [...INPUT_PATHS].sort().join("\n")) throw new Error(`expectedInputs must name exactly ${INPUT_PATHS.join(", ")}`);
  for (const path of INPUT_PATHS) if (!OBJECT_ID.test(expected[path] ?? "")) throw new Error(`expectedInputs[${path}] is not a full object ID`);
  return expected;
}

// Shape only. Whether the new value is legal for the card is decided by the compiler in buildCandidate.
function checkChange(change) {
  if (!change || typeof change !== "object" || Array.isArray(change)) throw new Error("change must be an object");
  if (Object.keys(change).sort().join() !== "card,field,from,to") throw new Error("change must have exactly card, field, from and to");
  const {card, field, from, to} = change;
  if (typeof card !== "string" || !CARD_ID.test(card)) throw new Error("change.card must be a card type such as cowboy-billy");
  if (!FIELDS.includes(field)) throw new Error(`change.field must be one of ${FIELDS.join(", ")}`);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) throw new Error("change.from and change.to must be whole numbers");
  if (to === from) throw new Error("change.to must differ from change.from");
  return change;
}

// The resolved local commit, or null when this checkout does not have it.
function localCommit(ref) {
  const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {cwd: ROOT, env: GIT_ENV, encoding: "utf8"});
  if (r.error || r.status !== 0) return null;
  const id = r.stdout.trim();
  if (!OBJECT_ID.test(id) || (ref !== "HEAD" && id !== ref)) throw new Error(`${ref} does not resolve to that exact commit`);
  return id;
}

const readInputs = (commit) => Object.fromEntries(INPUT_PATHS.map((path) => [path, git(["rev-parse", "--verify", `${commit}:${path}`])]));
const mismatches = (inputs, expected) => INPUT_PATHS.filter((path) => inputs[path] !== expected[path])
  .map((path) => `${path} is ${inputs[path]}, expected ${expected[path]}`);

// Picks the local commit to read. A missing frozen commit falls back to HEAD only when all four
// HEAD input object IDs equal the expected ones; otherwise it fails and names the fetch to run.
function resolveSource(ref, expected) {
  const fetchHint = `In a Git clone, run git fetch --depth=1 origin ${ref} and retry.`;
  const commit = localCommit(ref);
  if (commit) {
    const inputs = readInputs(commit);
    const wrong = expected ? mismatches(inputs, expected) : [];
    if (wrong.length) throw new Error(`game inputs at ${commit} differ: ${wrong.join("; ")}`);
    return {commit, inputs};
  }
  if (!expected) throw new Error(`commit ${ref} is not in this checkout and no expected input object IDs were given. ${fetchHint}`);
  const head = localCommit("HEAD");
  if (!head) throw new Error(`commit ${ref} is not in this checkout and HEAD cannot be read. ${fetchHint}`);
  const inputs = readInputs(head);
  const wrong = mismatches(inputs, expected);
  if (wrong.length) throw new Error(`commit ${ref} is not in this checkout and HEAD ${head} has different game inputs: ${wrong.join("; ")}. ${fetchHint}`);
  return {commit: head, inputs};
}

function extract(commit, target) {
  mkdirSync(target);
  const archive = git(["archive", "--format=tar", commit, "--", ...INPUT_PATHS], true);
  const r = spawnSync("tar", ["-x", "-f", "-", "-C", target], {input: archive, maxBuffer: MAX_BUFFER});
  if (r.error || r.status !== 0) throw new Error(`tar failed: ${(r.error?.message ?? String(r.stderr)).trim()}`);
  writeFileSync(join(target, "package.json"), '{"type":"module"}\n');
}

const regularFile = (path) => lstatSync(path, {throwIfNoEntry: false})?.isFile() === true;

async function buildCandidate(dir, base, change) {
  const {DECKS, TYPES} = await import(pathToFileURL(join(base, CARD_TYPES)).href);
  const legal = Object.values(DECKS).flatMap((deck) => Object.keys(deck))
    .filter((type) => TYPES[type]?.kind === "troop" && regularFile(join(base, CARDS, `${type}.json`)));
  if (!legal.includes(change.card)) throw new Error(`${change.card} is not a troop spec in a fixed Showdown deck`);
  const path = join(CARDS, `${change.card}.json`);
  const text = readFileSync(join(base, path), "utf8");
  const spec = JSON.parse(text);
  if (spec.kind !== "troop" || spec.type !== change.card) throw new Error(`${path} is not the troop spec for ${change.card}`);
  if (spec[change.field] !== change.from) throw new Error(`${change.card} ${change.field} is ${spec[change.field]}, not ${change.from}`);
  const after = changeField(text, change.field, change.from, change.to);
  const candidate = join(dir, "candidate");
  cpSync(base, candidate, {recursive: true});
  writeFileSync(join(candidate, path), after);
  // The compiler validates the changed card against the spec rules and rejects an illegal value.
  runNode(candidate, [COMPILER], "candidate card compile");
  runNode(candidate, [COMPILER, "--check"], "candidate card check");
  if (readFileSync(join(candidate, GENERATED)).equals(readFileSync(join(base, GENERATED)))) throw new Error("the compiled card specs did not change");
  return candidate;
}

// dir: absent path or fresh empty directory owned by the caller. ref: HEAD or a full commit ID.
// change: null for the control engine, or {card, field, from, to}. expectedInputs: null or
// {path: object ID} for all four INPUT_PATHS; required when ref may be missing from this checkout.
// Returns {rules, inputs, commit}: the loaded rules module (candidate when change is given), the
// actual path -> Git object ID read, and the local commit they were read from.
export async function openTrialEngine(dir, ref, change = null, expectedInputs = null) {
  const expected = expectedInputs === null ? null : checkExpected(expectedInputs);
  const wanted = change === null ? null : checkChange(change);
  checkRef(ref);
  const {commit, inputs} = resolveSource(ref, expected);
  prepareDir(dir);
  const base = join(dir, "base");
  extract(commit, base);
  runNode(base, [COMPILER, "--check"], "base card check");
  const engineDir = wanted ? await buildCandidate(dir, base, wanted) : base;
  const rules = await import(pathToFileURL(join(engineDir, RULES)).href);
  if (typeof rules.createShowdown !== "function" || typeof rules.playTurn !== "function") throw new Error(`${RULES} does not export createShowdown and playTurn`);
  return {rules, inputs, commit};
}

// One duel through the existing exported play(). onStep(before, applied, action) runs for each bot
// action: before is the state the action was applied to and applied is the engine's {state, events}.
// The current engine reports no action, so action is undefined unless an engine supplies one.
export function playTrial(rules, seed, first, onStep) {
  if (typeof rules?.createShowdown !== "function" || typeof rules?.playTurn !== "function") throw new TypeError("rules must come from openTrialEngine");
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error("seed must be a non-negative whole number");
  if (!FACTIONS.includes(first)) throw new Error(`first must be one of ${FACTIONS.join(", ")}`);
  if (onStep != null && typeof onStep !== "function") throw new TypeError("onStep must be a function");
  const observe = onStep == null ? undefined : (before, applied, action) => onStep(before, applied, action);
  return play(rules, seed, first, observe);
}
