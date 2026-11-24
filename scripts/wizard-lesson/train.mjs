// Wizard lesson trainer: runs the native Kiro coach, rival and reviser on one Hellfire bait episode.
//   node scripts/wizard-lesson/train.mjs --episode PATH --out PATH
// --episode takes a proof/wizard-lesson/find-bait.mjs output or an episode exported by the app (same schema).
// Exit: 0 validated lesson written; 3 receipt written as blocked or pending (no success claimed); 2 bad usage or episode.
//
// Pipeline (every step on the engine schema of src/game/showdown/wizard-lesson-policy.js):
//   1. loadBait: the episode replays with the original Wizard and its marked action is an authentic Hellfire bait.
//   2. coach   (native, agent wizard-lesson-coach): one proposal; it must hold Hellfire at the bait.
//   3. rival   (challenge.mjs): engine search for refuting episodes; if any, one native call to agent
//              wizard-lesson-challenger picks one, re-checked on the engine. None found: pending, no native call.
//   4. reviser (native, agent wizard-lesson-coach): at most MAX_REVISIONS tries, each engine rejection fed back.
//   5. verifyLessonBundle: the same check the app runs on import. Only a passing bundle is "validated".
// Limits: at most 1 + 1 + MAX_REVISIONS = 4 model calls. Any failed native process (exit, timeout, spawn error, quota)
// ends the run at once with no retry. Only an engine-rejected or unparsable revision may use the second revise try.
//
// Native launch: `kiro-cli chat --no-interactive --agent <agent> --model <model> <prompt>`, spawned without a shell.
// Env: KIRO_CLI (default "kiro-cli"; its file name must be kiro-cli), WIZARD_LESSON_MODEL (default claude-opus-5.5),
// WIZARD_LESSON_TIMEOUT_MS (default 180000, at most 600000). The child gets PATH, HOME, USER, LANG, TMPDIR and
// KIRO_HOME only, so it uses the existing native Kiro sign-in and never an API key from the parent environment.
// None of these values is recorded. The prompt and output text are not stored, only their SHA-256.
//
// Receipt (schema wizard-lesson-receipt/2), written to --out:
//   {schema, status: "validated"|"blocked"|"pending", reasons, episodeKey, startedAt, finishedAt, limits,
//    runs: [{role, agent, runId, sessionId, model, cli, cliVersion, startedAt, finishedAt, durationMs, exit, error,
//            promptSha256, outputSha256, outputBytes}],
//    proposal: {policy, rationale} | null, counterexample: {id, episodeKey, claim, search} | null,
//    revised: {policy, rationale, attempt} | null, verification: report | null, lesson: bundle | null}
//   runId is minted here (wl-<random hex>); sessionId stays null unless the CLI prints one in a recognized form.
//   lesson is a verifyLessonBundle bundle (source "fresh"); the app imports the receipt and re-runs that check.
import {spawn} from "node:child_process";
import {createHash, randomBytes} from "node:crypto";
import {lstatSync, readFileSync, writeFileSync} from "node:fs";
import {basename} from "node:path";
import {fileURLToPath} from "node:url";
import {compareAtMarkedTurn, verifyLessonBundle} from "../../src/game/showdown/wizard-lesson-policy.js";
import {LIMITS, LessonError, RECEIPT_SCHEMA, baitObservation, buildCoachPrompt, buildRevisePrompt, bundleFailures,
  counterObservation, loadBait, parseAdvice, provenance} from "./coach.mjs";
import {challenge as defaultChallenge, DEFAULT_SEEDS} from "./challenge.mjs";

export const COACH_AGENT = "wizard-lesson-coach";
export const DEFAULT_MODEL = "claude-opus-5.5";
export const MAX_REVISIONS = 2;
export const MAX_NATIVE_RUNS = 2 + MAX_REVISIONS;
export const DEFAULT_TIMEOUT_MS = 180000;
const MAX_TIMEOUT_MS = 600000;
const ENV_KEEP = ["PATH", "HOME", "USER", "LANG", "TMPDIR", "KIRO_HOME"];
const CLI_NAME = /^kiro-cli$/;
const MODEL = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const VERSION = /\b\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.]{1,32})?\b/;
const SESSION_LINE = /\bsession(?:[ _-]?id)?\s*[:=]\s*([A-Za-z0-9_-]{8,128})\b/i;
const QUOTA = /\b(quota|rate.?limit|throttl\w*|too many requests|insufficient credits?|out of credits?|usage limit)\b/i;

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const now = () => new Date().toISOString();

export function settings(env = process.env) {
  const model = env.WIZARD_LESSON_MODEL ?? DEFAULT_MODEL;
  if (!MODEL.test(model)) throw new LessonError("WIZARD_LESSON_MODEL is not a model id");
  const timeout = Number(env.WIZARD_LESSON_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > MAX_TIMEOUT_MS) throw new LessonError(`WIZARD_LESSON_TIMEOUT_MS must be 1000-${MAX_TIMEOUT_MS}`);
  const cli = env.KIRO_CLI ?? "kiro-cli";
  if (typeof cli !== "string" || !cli || /[\0\n]/.test(cli) || !CLI_NAME.test(basename(cli))) throw new LessonError("KIRO_CLI must name the kiro-cli program");
  return {model, timeoutMs: timeout, cli};
}

// Spawns one program with fixed argument strings, no shell, bounded time and output. Never throws.
// stderr is read only to classify a quota failure; it is not returned.
export function spawnBounded(command, args, {timeoutMs, env, maxBytes = LIMITS.outputChars}) {
  return new Promise((done) => {
    let out = "", err = "", over = false, settled = false, timer;
    const finish = (result) => { if (!settled) { settled = true; clearTimeout(timer); done({...result, quota: QUOTA.test(`${out}\n${err}`)}); } };
    let child;
    try { child = spawn(command, args, {shell: false, env, stdio: ["ignore", "pipe", "pipe"]}); } catch (error) {
      return finish({exit: null, stdout: "", error: error.code ?? "spawn-failed", timedOut: false, overflow: false});
    }
    const take = (chunk) => { if (over) return; out += chunk; if (out.length > maxBytes) { over = true; child.kill("SIGKILL"); } };
    child.stdout.setEncoding("utf8").on("data", take);
    child.stderr.setEncoding("utf8").on("data", (chunk) => { if (err.length < 8192) err += chunk; });
    timer = setTimeout(() => { child.kill("SIGKILL"); finish({exit: null, stdout: out, error: "timeout", timedOut: true, overflow: over}); }, timeoutMs);
    child.on("error", (error) => finish({exit: null, stdout: out, error: error.code ?? "spawn-failed", timedOut: false, overflow: over}));
    child.on("close", (code) => finish({exit: code, stdout: out, error: over ? "output-too-long" : code === 0 ? null : "nonzero-exit", timedOut: false, overflow: over}));
  });
}

const childEnv = (env) => Object.fromEntries(ENV_KEEP.filter((k) => typeof env[k] === "string" && env[k]).map((k) => [k, env[k]]));

// The native runner. Returns {ok, text, run}; run is sanitized provenance only.
export function nativeRunner({cli, model, timeoutMs, spawnFn = spawnBounded, env = process.env}) {
  let cliVersion;
  const version = async () => {
    if (cliVersion !== undefined) return cliVersion;
    const r = await spawnFn(cli, ["--version"], {timeoutMs: Math.min(timeoutMs, 20000), env: childEnv(env), maxBytes: 4096});
    cliVersion = r.exit === 0 ? (VERSION.exec(r.stdout)?.[0] ?? null) : null;
    return cliVersion;
  };
  return async ({role, agent, prompt, nonce}) => {
    const runId = `wl-${nonce}`;
    const ver = await version();
    const startedAt = now(), t0 = Date.now();
    const r = await spawnFn(cli, ["chat", "--no-interactive", "--agent", agent, "--model", model, prompt], {timeoutMs, env: childEnv(env)});
    const error = r.exit === 0 && !r.error ? null : r.quota ? "quota" : r.error ?? "no output";
    const run = {role, agent, runId, sessionId: SESSION_LINE.exec(r.stdout ?? "")?.[1] ?? null, model, cli: basename(cli), cliVersion: ver,
      startedAt, finishedAt: now(), durationMs: Date.now() - t0, exit: r.exit ?? null, error,
      promptSha256: sha256(prompt), outputSha256: sha256(r.stdout ?? ""), outputBytes: (r.stdout ?? "").length};
    return {ok: error === null, text: r.stdout ?? "", run};
  };
}

const nonceOf = () => randomBytes(8).toString("hex");

// Runs the whole lesson. Every failure ends as blocked or pending; nothing substitutes a success.
export async function train(raw, {runNative, challenge = defaultChallenge, seeds = DEFAULT_SEEDS, maxRevisions = MAX_REVISIONS, clock = now, nonce = nonceOf} = {}) {
  const {episode, key} = loadBait(raw);
  const receipt = {schema: RECEIPT_SCHEMA, status: "blocked", reasons: [], episodeKey: key, startedAt: clock(), finishedAt: null,
    limits: {maxNativeRuns: 2 + maxRevisions, maxRevisions, outputChars: LIMITS.outputChars, rivalSeeds: seeds},
    runs: [], proposal: null, counterexample: null, revised: null, verification: null, lesson: null};
  const close = (status, reason) => {
    receipt.status = status;
    if (reason) receipt.reasons.push(reason);
    receipt.finishedAt = clock();
    return receipt;
  };
  // Every native call goes through here, so the bound and the no-retry rule hold for all roles.
  let stopped = null;
  const native = async (request) => {
    if (stopped) return {ok: false, text: "", run: {error: stopped}};
    if (receipt.runs.length >= receipt.limits.maxNativeRuns) { stopped = "native run limit reached"; return {ok: false, text: "", run: {error: stopped}}; }
    const result = await runNative(request);
    receipt.runs.push(result.run);
    if (!result.ok) stopped = result.run.error ?? "native run failed";
    return result;
  };
  const ask = async (role, prompt, id) => {
    const result = await native({role, agent: COACH_AGENT, prompt, nonce: id});
    if (!result.ok) return {error: `native ${role} run failed (${result.run.error ?? "no output"})`, fatal: true};
    try { return {...parseAdvice(result.text, id), run: result.run}; } catch (error) { return {error: `native ${role} reply rejected: ${error.message}`, run: result.run}; }
  };

  const observation = baitObservation(episode);
  const coachNonce = nonce();
  const coach = await ask("coach", buildCoachPrompt({nonce: coachNonce, observation}), coachNonce);
  if (coach.error) return close("blocked", coach.error);
  receipt.proposal = {policy: coach.policy, rationale: coach.rationale};
  if (compareAtMarkedTurn(episode, coach.policy).lesson.usedHellfire) return close("blocked", "the coach's proposal casts Hellfire at the bait, so it teaches no lesson");

  let rival;
  try { rival = await challenge({bait: episode, proposal: coach.policy, runNative: native, nonce: nonce(), seeds}); } catch (error) {
    return close("blocked", `rival failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  if (rival.status === "none") return close("pending", `rival: ${rival.reason}`);
  if (rival.status !== "found") return close("blocked", `rival: ${rival.reason}`);
  const rivalRun = receipt.runs.findLast((r) => r.role === "rival" && !r.error);
  if (!rivalRun) return close("blocked", "rival returned no native run");
  const {episode: counterEpisode, ...counterInfo} = rival.counterexample;
  receipt.counterexample = {id: counterInfo.id, episodeKey: counterInfo.episodeKey, claim: counterInfo.claim, search: rival.search};
  const counter = counterObservation(counterEpisode, coach.policy);

  let feedback = [];
  for (let attempt = 1; attempt <= maxRevisions; attempt++) {
    const id = nonce();
    const revision = await ask("reviser", buildRevisePrompt({nonce: id, observation, proposal: coach.policy, counter, feedback}), id);
    if (revision.fatal) return close("blocked", revision.error);
    if (revision.error) { feedback = [revision.error]; receipt.reasons.push(`attempt ${attempt}: ${revision.error}`); continue; }
    receipt.revised = {policy: revision.policy, rationale: revision.rationale, attempt};
    const bundle = {version: 1, episodeKey: key, source: "fresh",
      proposal: {policy: coach.policy, provenance: provenance(coach.run, "coach")},
      counterexample: {episode: counterEpisode, provenance: provenance(rivalRun, "rival")},
      revised: {policy: revision.policy, provenance: provenance(revision.run, "reviser")}};
    let verdict;
    try { verdict = verifyLessonBundle(bundle, episode); } catch (error) { return close("blocked", `bundle rejected: ${error.message}`); }
    receipt.verification = verdict.report;
    if (verdict.ok) { receipt.lesson = bundle; return close("validated"); }
    feedback = bundleFailures(verdict.report);
    receipt.reasons.push(`attempt ${attempt}: ${feedback.join("; ")}`);
  }
  return close("pending", `no revision passed verifyLessonBundle in ${maxRevisions} attempts`);
}

function readEpisode(path) {
  const info = lstatSync(path);
  if (!info.isFile()) throw new LessonError("--episode must be a regular file");
  if (info.size > LIMITS.episodeBytes) throw new LessonError(`--episode is larger than ${LIMITS.episodeBytes} bytes`);
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { throw new LessonError("--episode is not valid JSON"); }
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!["--episode", "--out"].includes(flag) || typeof value !== "string" || value.startsWith("--")) throw new LessonError("usage: train.mjs --episode PATH --out PATH");
    out[flag.slice(2)] = value;
  }
  if (!out.episode || !out.out) throw new LessonError("usage: train.mjs --episode PATH --out PATH");
  if (!out.out.endsWith(".json")) throw new LessonError("--out must name a .json file");
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let args, raw, conf, key;
  try { args = parseArgs(process.argv.slice(2)); raw = readEpisode(args.episode); conf = settings(); ({key} = loadBait(raw)); } catch (error) {
    console.error(error instanceof LessonError ? error.message : `cannot read episode: ${error.code ?? error.message}`);
    process.exit(2);
  }
  const receipt = await train(raw, {runNative: nativeRunner(conf)});
  writeFileSync(args.out, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`wizard lesson ${receipt.status}${receipt.reasons.length ? `: ${receipt.reasons.at(-1)}` : ""} (episode ${key}, ${receipt.runs.length} native run(s))`);
  process.exit(receipt.status === "validated" ? 0 : 3);
}
