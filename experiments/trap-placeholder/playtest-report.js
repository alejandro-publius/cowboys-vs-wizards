// Issue #118: pure builder for the trap placeholder lab's local playtest
// report. No DOM, clock, random source, storage or network. app.js calls
// createPlaytestReport() only when the user presses "Export current playtest
// report" and downloads the JSON locally; nothing is sent anywhere.
//
// Everything in the report is rebuilt field by field from an allowlist. No
// input object is spread or copied whole, so an unexpected field (engine
// state, a hand, a deck order, the rng, a timestamp) cannot reach the output.
// Events must be the Cowboy's projection (publicEvents(..., "cowboy")), as
// lab.js events() returns them. As a second guard, a Wizard trap-set never
// keeps a cardId here. A trap-trigger keeps its cardId: the engine reveals a
// trap publicly when it springs (src/game/view.js), so a sprung Wizard trap's
// ID may appear in the report from that event on.
//
// Counts are tallies of public events only. They do not show that a choice
// was clear or meaningful; only the hand-typed humanNotes can speak to that,
// and they stay empty unless someone types them.
import { CPU_LEVELS } from "../../src/game/cpu.js";
import { MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { SCENARIOS } from "./scenarios.js";

export const REPORT_SCHEMA = "cowboys-vs-wizards/trap-placeholder-playtest-report";
export const REPORT_SCHEMA_VERSION = 1;
export const REPORT_SOURCE = "synthetic-developer-lab";
export const REPORT_DISCLAIMER =
  "Synthetic developer lab (local only). Traps here are anonymous placeholders, not real cards, decks or balance. " +
  "Metric counts are tallies of public Cowboy-view events and do not show that any choice was clear or meaningful. " +
  "humanNotes are exactly what was typed in this browser, and are empty when nothing was typed.";
export const NOTE_FIELDS = Object.freeze(["spellVersusTrap", "armingClarity", "pacing", "freeform"]);
export const NOTE_MAX = 1000; // code points per note
export const MAX_EVENTS = 500; // a full lab match logs about 70 to 110
const VIEWER = "cowboy";
const SIDES = new Set(["cowboy", "wizard"]);
const STATUSES = new Set(["idle", "accepting_input", "submitting", "playing", "cpu_turn", "terminal", "error"]);
const OUTCOMES = new Set(["win", "loss", "draw"]);
const MAX_SEED = 4294967295;

const side = (v) => (SIDES.has(v) ? v : undefined);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const slot = (v) => int(v, 0, SLOT_COUNT - 1);
const round = (v) => int(v, 1, MAX_ROUNDS);
const amount = (v) => int(v, 0, 99);
const reason = (v) => (typeof v === "string" && /^[a-z][a-z-]{0,31}$/.test(v) ? v : undefined);
// A plain data object (as structuredClone gives): prototype Object or null,
// so no inherited field is ever read as if it were the object's own.
const plain = (v) => v !== null && typeof v === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(v));
// undefined if any listed value is undefined, otherwise the object as given.
const all = (out) => (Object.values(out).includes(undefined) ? undefined : out);

// One note as a bounded plain string: line endings normalised, control,
// line-separator and bidi-override characters removed, trimmed, at most
// NOTE_MAX code points. Anything that is not a string becomes "".
export function cleanNote(value) {
  if (typeof value !== "string") return "";
  const text = value
    .slice(0, NOTE_MAX * 4)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
  return Array.from(text).slice(0, NOTE_MAX).join("");
}

function sanitizeEvent(event, cards) {
  if (!plain(event)) return undefined;
  const card = (v) => (typeof v === "string" && v.length <= 64 && Object.hasOwn(cards, v) ? v : undefined);
  const troopRef = (t) => (plain(t) ? all({ side: side(t.side), slot: slot(t.slot), cardId: card(t.cardId) }) : undefined);
  switch (event.type) {
    case "round-start":
      return all({ type: event.type, round: round(event.round), startingSide: side(event.startingSide) });
    case "phase-start":
    case "phase-end":
      return all({ type: event.type, side: side(event.side), round: round(event.round) });
    case "draw":
      return all({ type: event.type, side: side(event.side) });
    case "clash":
      return all({ type: event.type, round: round(event.round) });
    case "summon": {
      const tributes = Array.isArray(event.tributes) && event.tributes.length <= SLOT_COUNT ? event.tributes.map(slot) : [undefined];
      if (tributes.includes(undefined)) return undefined;
      return all({ type: event.type, side: side(event.side), cardId: card(event.cardId), slot: slot(event.slot), tributes });
    }
    case "spell": {
      const out = all({
        type: event.type,
        caster: side(event.caster),
        cardId: card(event.cardId),
        target: troopRef(event.target),
        before: amount(event.before),
        after: amount(event.after),
      });
      if (out && event.destination !== undefined) {
        const destination = slot(event.destination);
        if (destination === undefined) return undefined;
        out.destination = destination;
      }
      return out;
    }
    case "trap-set": {
      const out = all({ type: event.type, side: side(event.side) });
      // Only the Cowboy's own set trap is identified; a Wizard set never is.
      if (out?.side === VIEWER && card(event.cardId)) out.cardId = event.cardId;
      return out;
    }
    case "trap-trigger":
      return all({ type: event.type, side: side(event.side), cardId: card(event.cardId), target: troopRef(event.target), cancelled: amount(event.cancelled) });
    case "damage": {
      const t = plain(event.target) ? event.target : {};
      const ref = t.kind === "troop" ? troopRef(t) : undefined;
      const target = t.kind === "base" ? all({ kind: "base", side: side(t.side) }) : ref ? { kind: "troop", ...ref } : undefined;
      return all({ type: event.type, lane: slot(event.lane), attacker: troopRef(event.attacker), target, amount: amount(event.amount), before: amount(event.before), after: amount(event.after) });
    }
    case "defeat":
      return all({ type: event.type, side: side(event.side), slot: slot(event.slot), cardId: card(event.cardId) });
    case "result":
      return all({ type: event.type, result: resultOf(event.result) });
    default:
      return undefined;
  }
}

function resultOf(r) {
  if (!plain(r)) return undefined;
  const winner = r.winner === null ? null : side(r.winner);
  const loser = r.loser === null ? null : side(r.loser);
  return all({ winner, loser, reason: reason(r.reason), round: round(r.round) });
}

const bySide = () => ({ cowboy: 0, wizard: 0 });
function countEvents(events) {
  const metrics = { publicEvents: events.length, trapSet: bySide(), trapTrigger: bySide(), spell: bySide(), phaseEnd: bySide(), roundStart: 0 };
  for (const e of events) {
    if (e.type === "trap-set") metrics.trapSet[e.side]++;
    else if (e.type === "trap-trigger") metrics.trapTrigger[e.side]++;
    else if (e.type === "spell") metrics.spell[e.caster]++;
    else if (e.type === "phase-end") metrics.phaseEnd[e.side]++;
    else if (e.type === "round-start") metrics.roundStart++;
  }
  return metrics;
}

// The public match summary from the Cowboy's Player_View: status, round,
// active side and the result. Nothing else in the view is read.
function matchOf(status, view) {
  if (!plain(view)) return { status, round: null, activeSide: null, result: null };
  let result = null;
  if (plain(view.result)) {
    const base = resultOf(view.result);
    const outcome = OUTCOMES.has(view.result.outcome) ? view.result.outcome : undefined;
    result = base && outcome ? { outcome, ...base } : null;
  }
  return { status, round: round(view.round) ?? null, activeSide: side(view.activeSide) ?? null, result };
}

// The report object. Arguments are what app.js reads from the lab session:
//   scenario, cpuLevel   the active settings (session.settings())
//   seed, seedPinned     controller.seed(), controller.seedPinned()
//   status, view         controller.status(), controller.view() (Cowboy view)
//   events               session.lab().events() (Cowboy projection)
//   cards                session.lab().cards (to accept only known card IDs)
//   notes                { spellVersusTrap, armingClarity, pacing, freeform }
//   includeEvents        also list the sanitized public events
// With status "idle" (before Start or after Leave) there is no current match:
// seed, match and events are empty and every count is 0.
export function createPlaytestReport({ scenario, cpuLevel, seed, seedPinned, status, view, events, cards, notes, includeEvents = false } = {}) {
  const catalog = plain(cards) ? cards : {};
  const live = STATUSES.has(status) && status !== "idle";
  const list = live && Array.isArray(events) ? events.slice(0, MAX_EVENTS) : [];
  const clean = [];
  let dropped = 0;
  for (const event of list) {
    const safe = sanitizeEvent(event, catalog);
    if (safe) clean.push(safe);
    else dropped++;
  }
  const humanNotes = {};
  const typed = notes !== null && typeof notes === "object" ? notes : {};
  for (const field of NOTE_FIELDS) humanNotes[field] = cleanNote(Object.hasOwn(typed, field) ? typed[field] : undefined);
  return {
    schema: REPORT_SCHEMA,
    schemaVersion: REPORT_SCHEMA_VERSION,
    source: REPORT_SOURCE,
    disclaimer: REPORT_DISCLAIMER,
    scenario: SCENARIOS.includes(scenario) ? scenario : null,
    wizardCpu: CPU_LEVELS.includes(cpuLevel) ? cpuLevel : null,
    seed: live && seedPinned === true ? (int(seed, 0, MAX_SEED) ?? null) : null,
    match: live ? matchOf(status, view) : null,
    metrics: countEvents(clean),
    eventsTruncated: live && Array.isArray(events) && events.length > MAX_EVENTS,
    eventsDropped: dropped,
    publicEventsIncluded: includeEvents === true,
    publicEvents: includeEvents === true ? clean : [],
    humanNotes,
  };
}

// Download name with no date, time or path: the active settings and seed only.
export function reportFileName(report) {
  return `trap-playtest-${report.scenario ?? "none"}-${report.wizardCpu ?? "none"}-seed-${report.seed ?? "none"}.json`;
}
