// Seat-private Showdown play for an agent over MCP. The engine and the bot are the canonical
// src/game/showdown functions, reached through the graybox session (src/match/showdown-session.js).
// The agent sees only what the Cowboy seat may see: viewFor, its legal intents and contract events.
// The deal seed stays inside the server. Start returns a salted commitment to it; the seed, the
// salt and the applied actions are revealed only after the duel ends, so anyone can replay it.
import {createHash, randomBytes, randomInt, randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";

const SEAT = "cowboy";
const SESSION_LIMIT = 8;

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

export function createTable(engine, {seedSource = () => randomInt(2 ** 32)} = {}) {
  const sessions = new Map();
  const token = () => randomBytes(8).toString("hex");

  function snapshot(id, entry, events) {
    const {session} = entry;
    const view = session.view();
    const out = {session: id, revision: entry.revision, duel: entry.duel, seat: SEAT,
      ...observation(view, session.legal()), events: publicEvents(engine.EVENTS, events), result: view.result};
    if (view.result) out.proof = {seed: entry.seed, salt: entry.salt, commitment: entry.commitment, duel: entry.duel.id, actions: entry.actions};
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
