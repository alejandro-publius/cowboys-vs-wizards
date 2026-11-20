// Seat-private Showdown play for an agent over MCP. The engine and the bot are the canonical
// src/game/showdown functions, reached through the graybox session (src/match/showdown-session.js).
// The agent sees only what the Cowboy seat may see: viewFor, its legal intents and contract events.
// The deal seed stays inside the server. Start returns a salted commitment to it; the seed, the
// salt and the applied actions are revealed only after the duel ends, so anyone can replay it.
import {createHash, randomBytes, randomInt, randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname, join, relative} from "node:path";
import {pathToFileURL} from "node:url";

const SEAT = "cowboy";
const SESSION_LIMIT = 8;

// The modules loadEngine imports. Their static relative-import closure is the engine fingerprint.
export const ENGINE_ENTRIES = ["src/match/showdown-session.js", "src/game/showdown/contract.js", "src/game/showdown/progress.js", "src/game/showdown/trail.js"];
const IMPORT = /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*["'](\.{1,2}\/[^"']+)["']|(?:^|\n)\s*import\s*["'](\.{1,2}\/[^"']+)["']/g;

// SHA-256 of every source file the Showdown replay executes: the static relative-import closure of
// ENGINE_ENTRIES, each file hashed by bytes, then the sorted "path sha256" lines hashed together.
// Binds a gameplay proof to Showdown rules code, not to a built page.
export function engineFingerprint(root, entries = ENGINE_ENTRIES) {
  const files = {};
  const queue = [...entries];
  while (queue.length) {
    const rel = queue.shift();
    if (rel in files) continue;
    const bytes = readFileSync(join(root, rel));
    files[rel] = createHash("sha256").update(bytes).digest("hex");
    for (const match of bytes.toString("utf8").matchAll(IMPORT)) {
      const next = relative(root, join(root, dirname(rel), match[1] ?? match[2])).split("\\").join("/");
      if (!(next in files)) queue.push(next);
    }
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
  const sha256 = createHash("sha256").update(Object.entries(sorted).map(([path, hash]) => `${path} ${hash}\n`).join("")).digest("hex");
  return {sha256, fileCount: Object.keys(sorted).length, files: sorted};
}

export async function loadEngine(root) {
  const at = (rel) => import(pathToFileURL(root + rel).href);
  const [session, contract, progress, trail] = await Promise.all([
    at("src/match/showdown-session.js"), at("src/game/showdown/contract.js"),
    at("src/game/showdown/progress.js"), at("src/game/showdown/trail.js"),
  ]);
  return {createShowdownSession: session.createShowdownSession, EVENTS: contract.EVENTS,
    duelFor: progress.duelFor, newSave: progress.newSave, TRAIL: trail.TRAIL, deckAfter: trail.deckAfter};
}

// Trail duel `id` as the camp offers it to a player who has won every earlier Trail duel:
// the earned deck from trail.js deckAfter, no grit. Boot Hill is newSave() unchanged.
export function trailDuel(engine, id) {
  const index = engine.TRAIL.findIndex((duel) => duel.id === id);
  if (index < 0) return null;
  const save = index === 0 ? engine.newSave() : {...engine.newSave(), wins: index, deck: engine.deckAfter(index)};
  return engine.duelFor(save, "trail");
}

// Only the fields the contract lists for each event type reach the agent.
export function publicEvents(EVENTS, events) {
  return events.map((event) => {
    const fields = EVENTS[event.type]?.fields ?? [];
    return Object.fromEntries([["type", event.type], ...fields.filter((key) => key in event).map((key) => [key, event[key]])]);
  });
}

// What the agent observes: the seat's view and its legal intents, numbered. Nothing else.
export function observation(view, legal) {
  return {view, intents: legal.map((action, intent) => ({intent, action}))};
}

export function seedCommitment(salt, seed) {
  return createHash("sha256").update(`${salt}:${seed}`).digest("hex");
}

export function createTable(engine, {seedSource = () => randomInt(2 ** 32), fingerprint = null} = {}) {
  const sessions = new Map();
  const token = () => randomBytes(8).toString("hex");

  function snapshot(id, entry, events) {
    const {session} = entry;
    const view = session.view();
    const out = {session: id, revision: entry.revision, duel: entry.duel, seat: SEAT,
      ...observation(view, session.legal()), events: publicEvents(engine.EVENTS, events), result: view.result};
    if (fingerprint) out.engine = {sha256: fingerprint.sha256, fileCount: fingerprint.fileCount};
    if (view.result) out.proof = {seed: entry.seed, salt: entry.salt, commitment: entry.commitment, duel: entry.duel.id, actions: entry.actions,
      ...(fingerprint && {engine: fingerprint})};
    return out;
  }

  return {
    start(duelId = "boot-hill") {
      const duel = trailDuel(engine, duelId);
      if (!duel) return {error: `unknown Trail duel: ${duelId}`};
      for (const [id, entry] of sessions) if (entry.session.view().result) sessions.delete(id);
      if (sessions.size >= SESSION_LIMIT) return {error: `at most ${SESSION_LIMIT} unfinished duels`};
      const seed = seedSource();
      const salt = token();
      const session = engine.createShowdownSession({seed, duel, seat: SEAT});
      const entry = {session, seed, salt, commitment: seedCommitment(salt, seed), revision: token(), actions: [],
        duel: {id: duelId, name: duel.name, lesson: duel.lesson}};
      const id = randomUUID();
      sessions.set(id, entry);
      return {...snapshot(id, entry, session.opening), commitment: entry.commitment};
    },
    observe(id) {
      const entry = sessions.get(id);
      return entry ? snapshot(id, entry, []) : {error: "unknown session"};
    },
    act(id, revision, intent) {
      const entry = sessions.get(id);
      if (!entry) return {error: "unknown session"};
      if (revision !== entry.revision) return {error: "stale revision: observe again"};
      const legal = entry.session.legal();
      if (!Number.isInteger(intent) || intent < 0 || intent >= legal.length) return {error: "intent is not one of the listed intents"};
      const events = entry.session.act(legal[intent]);
      entry.actions.push(legal[intent]);
      entry.revision = token();
      return snapshot(id, entry, events);
    },
  };
}

// Plays a revealed proof again from its seed and actions; returns the result it reaches.
export function replayProof(engine, proof) {
  if (seedCommitment(proof.salt, proof.seed) !== proof.commitment) throw new Error("seed does not match commitment");
  const session = engine.createShowdownSession({seed: proof.seed, duel: trailDuel(engine, proof.duel), seat: SEAT});
  for (const action of proof.actions) session.act(action);
  return session.view().result;
}

const HEX = (length) => new RegExp(`^[0-9a-f]{${length}}$`);
const KIND = "showdown-gameplay-proof";
const SCOPE = "Replays a finished Showdown seat proof on the bound project's Showdown engine. Not a Chrome or page replay; says nothing about appearance, clarity or fun.";

// Verdict on a recorded Showdown proof against the current engine in this project.
// pass: engine fingerprint matches, seed matches its commitment, every action was listed as legal
// when applied, and the replay reaches the recorded result. stale: the engine changed since the
// proof was recorded. unbound: an older proof without an engine fingerprint (replay still checked).
// rejected: commitment, legality or result check failed. malformed: required fields are missing.
export function inspectShowdownReceipt(engine, current, receipt) {
  const out = {kind: KIND, scope: SCOPE, currentEngine: {sha256: current.sha256, fileCount: current.fileCount}};
  const proof = receipt && typeof receipt === "object" ? receipt.proof : null;
  const missing = [];
  if (!proof || typeof proof !== "object") missing.push("proof");
  else {
    if (!Number.isInteger(proof.seed) || proof.seed < 0) missing.push("proof.seed");
    if (typeof proof.salt !== "string" || !HEX(16).test(proof.salt)) missing.push("proof.salt");
    if (typeof proof.commitment !== "string" || !HEX(64).test(proof.commitment)) missing.push("proof.commitment");
    if (typeof proof.duel !== "string" || !engine.TRAIL.some((duel) => duel.id === proof.duel)) missing.push("proof.duel");
    if (!Array.isArray(proof.actions) || !proof.actions.every((a) => a && typeof a === "object" && typeof a.type === "string")) missing.push("proof.actions");
  }
  const result = receipt && receipt.result;
  if (!result || typeof result !== "object" || typeof result.winner !== "string") missing.push("result");
  if (missing.length) return {...out, verdict: "malformed", reasons: [`receipt lacks a valid ${missing.join(", ")}`]};

  const recorded = proof.engine && typeof proof.engine.sha256 === "string" ? proof.engine : null;
  const reasons = [];
  const changedFiles = [];
  if (recorded && recorded.files && typeof recorded.files === "object") {
    for (const path of new Set([...Object.keys(recorded.files), ...Object.keys(current.files)])) {
      if (recorded.files[path] !== current.files[path]) changedFiles.push(path);
    }
  }
  const engineMatches = Boolean(recorded) && recorded.sha256 === current.sha256;
  if (!recorded) reasons.push("proof has no engine fingerprint: it cannot show which Showdown engine it was played on (unbound)");
  else if (!engineMatches) reasons.push("proof engine fingerprint differs from the current Showdown engine (stale proof)");

  const commitmentOk = seedCommitment(proof.salt, proof.seed) === proof.commitment;
  if (!commitmentOk) reasons.push("seed and salt do not match the commitment");
  let replay = null;
  if (commitmentOk) {
    try {
      const session = engine.createShowdownSession({seed: proof.seed, duel: trailDuel(engine, proof.duel), seat: SEAT});
      let illegalAt = -1;
      for (const [index, action] of proof.actions.entries()) {
        const listed = session.legal().map((each) => JSON.stringify(each));
        if (!listed.includes(JSON.stringify(action))) { illegalAt = index; break; }
        session.act(action);
      }
      const reached = illegalAt < 0 ? session.view().result : null;
      replay = {actions: proof.actions.length, illegalActionAt: illegalAt < 0 ? null : illegalAt, result: reached,
        matchesRecordedResult: Boolean(reached) && reached.winner === result.winner && reached.reason === result.reason};
      if (illegalAt >= 0) reasons.push(`action ${illegalAt} was not a listed legal intent on replay`);
      else if (!reached) reasons.push("replay does not finish the duel");
      else if (!replay.matchesRecordedResult) reasons.push(`replay reaches ${JSON.stringify(reached)}, receipt records ${JSON.stringify(result)}`);
    } catch (error) {
      replay = {error: error.message};
      reasons.push(`replay threw: ${error.message}`);
    }
  }
  const replayOk = Boolean(replay && replay.matchesRecordedResult);
  let verdict;
  if (recorded && !engineMatches) verdict = "stale";
  else if (!commitmentOk || !replayOk) verdict = "rejected";
  else verdict = recorded ? "pass" : "unbound";
  return {
    ...out, verdict, reasons,
    receipt: {
      what: typeof receipt.what === "string" ? receipt.what : null,
      date: receipt.date ?? null, app: receipt.app ?? null, debugSeed: receipt.debugSeed ?? null,
      duel: proof.duel, seed: proof.seed, actions: proof.actions.length, result,
      engine: recorded ? {sha256: recorded.sha256, fileCount: recorded.fileCount ?? null} : null,
      coversCurrentEngine: engineMatches, changedFiles,
    },
    replay,
  };
}
