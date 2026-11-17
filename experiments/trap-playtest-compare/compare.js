// Issue #124: offline comparator for one paired T1 / BASE trap lab report
// (the JSON that experiments/trap-placeholder/playtest-report.js exports).
// Pure and browser-safe: no import, DOM, clock, random source, storage,
// network or filesystem. The Node CLI (run.mjs) and the local page (app.js)
// pass in already-parsed JSON.
//
// The comparison is rebuilt field by field from an allowlist. No input object
// is spread, copied whole or mutated. Raw public events are never read or
// copied: only the report's own metric counts are compared. A report with an
// unexpected field, a wrong type or inconsistent counts is refused with an
// error that names the field and never echoes the untrusted value.
//
// Counts are tallies of public Cowboy-view events from a synthetic developer
// lab. They are not human playtest evidence, balance or a win rate.

export const REPORT_SCHEMA = "cowboys-vs-wizards/trap-placeholder-playtest-report";
export const REPORT_SCHEMA_VERSION = 1;
export const REPORT_SOURCE = "synthetic-developer-lab";
export const COMPARISON_SCHEMA = "cowboys-vs-wizards/trap-playtest-comparison";
export const COMPARISON_SCHEMA_VERSION = 1;
export const SCENARIO_ORDER = Object.freeze(["T1", "BASE"]);
export const CPU_LEVELS = Object.freeze(["easy", "normal", "hard"]);
export const NOTE_FIELDS = Object.freeze(["spellVersusTrap", "armingClarity", "pacing", "freeform"]);
export const NOTE_MAX = 1000; // code points, as in playtest-report.js
export const MAX_EVENTS = 500; // the exporter's event cap
export const MAX_ROUNDS = 9; // src/game/state.js
export const MAX_SEED = 4294967295;
export const SIDE_METRICS = Object.freeze(["trapSet", "trapTrigger", "spell", "phaseEnd"]);
export const COMPARISON_DISCLAIMER =
  "Offline comparison of two synthetic developer lab reports (one T1, one BASE, same seed and Wizard CPU). " +
  "Counts are tallies of public Cowboy-view events taken from each report's metrics. " +
  "This is not human playtest evidence, balance, a win rate or a judgement of clarity or fun.";

const TOP_KEYS = ["schema", "schemaVersion", "source", "disclaimer", "scenario", "wizardCpu", "seed", "match", "metrics", "eventsTruncated", "eventsDropped", "publicEventsIncluded", "publicEvents", "humanNotes"];
const MATCH_KEYS = ["status", "round", "activeSide", "result"];
const RESULT_KEYS = ["outcome", "winner", "loser", "reason", "round"];
const METRIC_KEYS = ["publicEvents", ...SIDE_METRICS, "roundStart"];
const SIDE_KEYS = ["cowboy", "wizard"];
const STATUSES = ["idle", "accepting_input", "submitting", "playing", "cpu_turn", "terminal", "error"];
const OUTCOME_WINNER = { win: "cowboy", loss: "wizard", draw: null };
const MAX_DISCLAIMER = 2000;
const MAX_RAW_NOTE = NOTE_MAX * 4; // UTF-16 code units, the exporter's pre-trim bound

export class CompareError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompareError";
  }
}

const fail = (where, message) => {
  throw new CompareError(`${where}: ${message}`);
};

// A plain data object (as JSON.parse or structuredClone gives).
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));

// The own data value of a field. Accessors are refused so reading a report
// never runs code; inherited fields are never read.
function own(obj, key, where) {
  const d = Object.getOwnPropertyDescriptor(obj, key);
  if (!d) fail(where, `missing field "${key}"`);
  if (!("value" in d)) fail(where, `field "${key}" must be plain data`);
  return d.value;
}

// Exactly the listed own keys, in any order. Names of unexpected keys are not
// echoed, because they come from the untrusted file.
function exactKeys(obj, keys, where) {
  if (!plain(obj)) fail(where, "must be a plain JSON object");
  const extra = Reflect.ownKeys(obj).filter((k) => typeof k !== "string" || !keys.includes(k)).length;
  if (extra > 0) fail(where, `${extra} unexpected field(s); export the report again from the lab without editing it`);
  for (const k of keys) own(obj, k, where);
}

function count(v, where) {
  if (!Number.isSafeInteger(v) || v < 0) fail(where, "must be a nonnegative finite integer");
  return v;
}

function readMetrics(m, where) {
  exactKeys(m, METRIC_KEYS, where);
  const out = { publicEvents: count(own(m, "publicEvents", where), `${where}.publicEvents`) };
  for (const key of SIDE_METRICS) {
    const pair = own(m, key, where);
    const at = `${where}.${key}`;
    exactKeys(pair, SIDE_KEYS, at);
    out[key] = { cowboy: count(own(pair, "cowboy", at), `${at}.cowboy`), wizard: count(own(pair, "wizard", at), `${at}.wizard`) };
  }
  out.roundStart = count(own(m, "roundStart", where), `${where}.roundStart`);
  const counted = out.roundStart + SIDE_METRICS.reduce((n, k) => n + out[k].cowboy + out[k].wizard, 0);
  if (counted > out.publicEvents) fail(where, "counted events exceed publicEvents");
  if (out.roundStart > MAX_ROUNDS) fail(`${where}.roundStart`, `exceeds ${MAX_ROUNDS} rounds`);
  return out;
}

function readResult(r, where) {
  if (r === null) return null;
  exactKeys(r, RESULT_KEYS, where);
  const outcome = own(r, "outcome", where);
  if (typeof outcome !== "string" || !Object.hasOwn(OUTCOME_WINNER, outcome)) fail(`${where}.outcome`, "must be win, loss or draw");
  const expectWinner = OUTCOME_WINNER[outcome];
  const expectLoser = expectWinner === null ? null : expectWinner === "cowboy" ? "wizard" : "cowboy";
  if (own(r, "winner", where) !== expectWinner || own(r, "loser", where) !== expectLoser) fail(where, `winner and loser do not match outcome "${outcome}"`);
  const reason = own(r, "reason", where);
  if (typeof reason !== "string" || !/^[a-z][a-z-]{0,31}$/.test(reason)) fail(`${where}.reason`, "must be a short lowercase reason code");
  const round = own(r, "round", where);
  if (!Number.isInteger(round) || round < 1 || round > MAX_ROUNDS) fail(`${where}.round`, `must be an integer 1 to ${MAX_ROUNDS}`);
  return { outcome, reason, round };
}

function readMatch(m, where) {
  if (m === null) return { status: "none", round: null, result: null };
  exactKeys(m, MATCH_KEYS, where);
  const status = own(m, "status", where);
  if (!STATUSES.includes(status)) fail(`${where}.status`, "is not a known controller status");
  const round = own(m, "round", where);
  if (round !== null && !(Number.isInteger(round) && round >= 1 && round <= MAX_ROUNDS)) fail(`${where}.round`, `must be null or an integer 1 to ${MAX_ROUNDS}`);
  const activeSide = own(m, "activeSide", where);
  if (activeSide !== null && !SIDE_KEYS.includes(activeSide)) fail(`${where}.activeSide`, "must be null, cowboy or wizard");
  return { status, round, result: readResult(own(m, "result", where), `${where}.result`) };
}

function cleanNote(value) {
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
  return Array.from(text).slice(0, NOTE_MAX).join("");
}

function readNotes(n, where) {
  exactKeys(n, NOTE_FIELDS, where);
  const out = {};
  for (const field of NOTE_FIELDS) {
    const v = own(n, field, where);
    if (typeof v !== "string" || v.length > MAX_RAW_NOTE) fail(`${where}.${field}`, `must be a string of at most ${NOTE_MAX} characters`);
    out[field] = cleanNote(v);
  }
  return out;
}

// One report, validated. Returns only allowlisted values.
function readReport(report, label) {
  exactKeys(report, TOP_KEYS, label);
  if (own(report, "schema", label) !== REPORT_SCHEMA) fail(`${label}.schema`, `must be "${REPORT_SCHEMA}"`);
  if (own(report, "schemaVersion", label) !== REPORT_SCHEMA_VERSION) fail(`${label}.schemaVersion`, `must be ${REPORT_SCHEMA_VERSION}`);
  if (own(report, "source", label) !== REPORT_SOURCE) fail(`${label}.source`, `must be "${REPORT_SOURCE}"`);
  const disclaimer = own(report, "disclaimer", label);
  if (typeof disclaimer !== "string" || disclaimer.length > MAX_DISCLAIMER) fail(`${label}.disclaimer`, "must be a short string");
  const scenario = own(report, "scenario", label);
  if (!SCENARIO_ORDER.includes(scenario)) fail(`${label}.scenario`, "must be T1 or BASE (FIXTURE, T2 and none are not compared)");
  const wizardCpu = own(report, "wizardCpu", label);
  if (!CPU_LEVELS.includes(wizardCpu)) fail(`${label}.wizardCpu`, "must be easy, normal or hard");
  const seed = own(report, "seed", label);
  if (seed === null) fail(`${label}.seed`, "is null: the report has no current match or no pinned seed; type the seed, press Start, then export");
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) fail(`${label}.seed`, `must be an integer 0 to ${MAX_SEED}`);
  const match = readMatch(own(report, "match", label), `${label}.match`);
  const metrics = readMetrics(own(report, "metrics", label), `${label}.metrics`);
  const eventsTruncated = own(report, "eventsTruncated", label);
  if (typeof eventsTruncated !== "boolean") fail(`${label}.eventsTruncated`, "must be true or false");
  const eventsDropped = count(own(report, "eventsDropped", label), `${label}.eventsDropped`);
  const publicEventsIncluded = own(report, "publicEventsIncluded", label);
  if (typeof publicEventsIncluded !== "boolean") fail(`${label}.publicEventsIncluded`, "must be true or false");
  const events = own(report, "publicEvents", label);
  if (!Array.isArray(events)) fail(`${label}.publicEvents`, "must be an array");
  // Only the list length is read; event contents are never read or copied.
  const listed = events.length;
  if (metrics.publicEvents + eventsDropped > MAX_EVENTS) fail(label, `publicEvents plus eventsDropped exceed the exporter cap of ${MAX_EVENTS}`);
  if (eventsTruncated && metrics.publicEvents + eventsDropped !== MAX_EVENTS) fail(label, `eventsTruncated is true but ${MAX_EVENTS} events were not read`);
  if (listed !== (publicEventsIncluded ? metrics.publicEvents : 0)) fail(`${label}.publicEvents`, "length does not match publicEventsIncluded and metrics.publicEvents");
  if (match.status === "none" && (metrics.publicEvents + eventsDropped > 0 || eventsTruncated)) fail(label, "has events but no match");
  if (scenario === "BASE" && metrics.trapSet.cowboy + metrics.trapSet.wizard + metrics.trapTrigger.cowboy + metrics.trapTrigger.wizard > 0) {
    fail(`${label}.metrics`, "BASE has traps off but the report counts trap events");
  }
  const notes = readNotes(own(report, "humanNotes", label), `${label}.humanNotes`);
  return { scenario, wizardCpu, seed, match, metrics, limits: { eventsTruncated, eventsDropped, publicEventsIncluded }, notes };
}

const terminal = (m) => m.status === "terminal" && m.result !== null;

function warningsFor(r) {
  const w = [];
  const s = r.scenario;
  if (r.match.status === "none" || r.match.status === "idle") w.push(`${s}: no current match in the report (idle).`);
  else if (r.match.status !== "terminal") w.push(`${s}: match is not finished (status ${r.match.status}).`);
  else if (r.match.result === null) w.push(`${s}: status is terminal but no valid result is recorded.`);
  if (r.limits.eventsTruncated) w.push(`${s}: the event list hit the ${MAX_EVENTS}-event cap; counts cover only the first ${MAX_EVENTS} events.`);
  if (r.limits.eventsDropped > 0) w.push(`${s}: ${r.limits.eventsDropped} event(s) could not be sanitized by the exporter and are not counted.`);
  if (r.limits.eventsTruncated || r.limits.eventsDropped > 0) w.push(`${s}: a zero or low count here does not show that the event did not happen.`);
  return w;
}

const copyMetrics = (m) => {
  const out = { publicEvents: m.publicEvents };
  for (const k of SIDE_METRICS) out[k] = { cowboy: m[k].cowboy, wizard: m[k].wizard };
  out.roundStart = m.roundStart;
  return out;
};
const deltaMetrics = (a, b) => {
  const out = { publicEvents: a.publicEvents - b.publicEvents };
  for (const k of SIDE_METRICS) out[k] = { cowboy: a[k].cowboy - b[k].cowboy, wizard: a[k].wizard - b[k].wizard };
  out.roundStart = a.roundStart - b.roundStart;
  return out;
};
const sideOut = (r) => ({
  scenario: r.scenario,
  match: {
    status: r.match.status,
    round: r.match.round,
    result: r.match.result && { outcome: r.match.result.outcome, reason: r.match.result.reason, round: r.match.result.round },
  },
  metrics: copyMetrics(r.metrics),
  limits: { eventsTruncated: r.limits.eventsTruncated, eventsDropped: r.limits.eventsDropped, publicEventsIncluded: r.limits.publicEventsIncluded },
});
const notesOut = (n) => ({ spellVersusTrap: n.spellVersusTrap, armingClarity: n.armingClarity, pacing: n.pacing, freeform: n.freeform });

// Compare one T1 and one BASE report in either order. Throws CompareError
// with an actionable message when the pair is invalid. Notes are read into the
// output only when includeNotes is exactly true.
export function compareReports(first, second, { includeNotes = false } = {}) {
  const a = readReport(first, "first report");
  const b = readReport(second, "second report");
  if (a.scenario === b.scenario) fail("pair", `both reports are ${a.scenario}; supply one T1 report and one BASE report`);
  const [t1, base] = a.scenario === "T1" ? [a, b] : [b, a];
  if (t1.seed !== base.seed) fail("pair", "seeds differ; export T1 and BASE with the same seed");
  if (t1.wizardCpu !== base.wizardCpu) fail("pair", "Wizard CPU levels differ; export T1 and BASE with the same Wizard CPU");

  const complete = terminal(t1.match) && terminal(base.match);
  const limited = [t1, base].some((r) => r.limits.eventsTruncated || r.limits.eventsDropped > 0);
  const warnings = [...warningsFor(t1), ...warningsFor(base)];
  if (!complete) warnings.push("Interpretation blocked: both matches must be terminal with a result before outcomes, ending rounds or count differences are compared.");
  warnings.push("One synthetic match per scenario. Counts are public Cowboy-view event tallies, not human playtest evidence, balance or a win rate.");
  if (includeNotes === true) warnings.push("Notes are shown exactly as stored in the reports. The comparator does not interpret them.");

  const out = {
    schema: COMPARISON_SCHEMA,
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    source: REPORT_SOURCE,
    disclaimer: COMPARISON_DISCLAIMER,
    seed: t1.seed,
    wizardCpu: t1.wizardCpu,
    completeness: complete ? "complete" : "incomplete",
    interpretation: complete ? (limited ? "objective-counts-with-limits" : "objective-counts") : "blocked",
    reports: { T1: sideOut(t1), BASE: sideOut(base) },
    comparison: complete
      ? {
          sameOutcome: t1.match.result.outcome === base.match.result.outcome,
          sameReason: t1.match.result.reason === base.match.result.reason,
          endingRoundDelta: t1.match.result.round - base.match.result.round,
          metricDelta: deltaMetrics(t1.metrics, base.metrics),
        }
      : null,
    warnings,
  };
  if (includeNotes === true) out.notes = { T1: notesOut(t1.notes), BASE: notesOut(base.notes) };
  return out;
}

// Markdown-safe plain text: backslash-escape Markdown punctuation and encode
// HTML-significant characters so a note cannot form links, HTML or tables.
export function escapeMarkdown(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}[\]()#+\-.!|~]/g, (c) => `\\${c}`);
}

export const NOTE_LABELS = Object.freeze({ spellVersusTrap: "Spell versus trap", armingClarity: "Arming clarity", pacing: "Pacing", freeform: "Freeform" });
export const METRIC_LABELS = Object.freeze({ publicEvents: "Public events", roundStart: "Round start", trapSet: "Trap set", trapTrigger: "Trap trigger", spell: "Spell cast", phaseEnd: "Phase end" });
const signed = (n) => (n > 0 ? `+${n}` : String(n));

// The count rows shared by the Markdown and the page: [label, side, T1, BASE, delta or null].
export function countRows(c) {
  const { T1, BASE } = c.reports;
  const d = c.comparison?.metricDelta;
  const rows = [
    [METRIC_LABELS.publicEvents, "both", T1.metrics.publicEvents, BASE.metrics.publicEvents, d ? d.publicEvents : null],
    [METRIC_LABELS.roundStart, "both", T1.metrics.roundStart, BASE.metrics.roundStart, d ? d.roundStart : null],
  ];
  for (const k of SIDE_METRICS) {
    for (const s of SIDE_KEYS) rows.push([METRIC_LABELS[k], s === "cowboy" ? "Cowboy" : "Wizard", T1.metrics[k][s], BASE.metrics[k][s], d ? d[k][s] : null]);
  }
  return rows;
}

// Deterministic Markdown for a comparison from compareReports().
export function formatMarkdown(c) {
  const { T1, BASE } = c.reports;
  const lines = [
    "# Trap lab paired report comparison (synthetic)",
    "",
    `> ${c.disclaimer}`,
    "",
    `- Seed: ${c.seed}`,
    `- Wizard CPU: ${c.wizardCpu}`,
    `- Completeness: **${c.completeness}**`,
    `- Interpretation: ${c.interpretation}`,
    "",
    "## Match status",
    "",
    "| Scenario | Status | Round | Outcome (Cowboy view) | Reason | Ending round |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of [T1, BASE]) {
    const res = r.match.result;
    lines.push(`| ${r.scenario} | ${r.match.status} | ${r.match.round ?? "-"} | ${res?.outcome ?? "-"} | ${res?.reason ?? "-"} | ${res?.round ?? "-"} |`);
  }
  const withDelta = c.comparison !== null;
  lines.push("", "## Public event counts", "", `| Count | Side | T1 | BASE |${withDelta ? " T1 - BASE |" : ""}`, `| --- | --- | --- | --- |${withDelta ? " --- |" : ""}`);
  for (const [label, side, a, b, d] of countRows(c)) lines.push(`| ${label} | ${side} | ${a} | ${b} |${withDelta ? ` ${signed(d)} |` : ""}`);
  lines.push("", "## Metric limits", "", "| Scenario | Events truncated | Events dropped | Event list in report |", "| --- | --- | --- | --- |");
  for (const r of [T1, BASE]) lines.push(`| ${r.scenario} | ${r.limits.eventsTruncated ? "yes" : "no"} | ${r.limits.eventsDropped} | ${r.limits.publicEventsIncluded ? "yes (not copied)" : "no"} |`);
  lines.push("", "## Comparison", "");
  if (withDelta) {
    lines.push(`- Same outcome: ${c.comparison.sameOutcome ? "yes" : "no"}`);
    lines.push(`- Same ending reason: ${c.comparison.sameReason ? "yes" : "no"}`);
    lines.push(`- Ending round, T1 minus BASE: ${signed(c.comparison.endingRoundDelta)}`);
  } else {
    lines.push("Not computed: interpretation blocked until both matches are terminal with a result.");
  }
  lines.push("", "## Warnings", "");
  for (const w of c.warnings) lines.push(`- ${w}`);
  if (c.notes) {
    lines.push("", "## Notes as stored (not interpreted)");
    for (const s of SCENARIO_ORDER) {
      lines.push("", `### ${s}`, "");
      for (const f of NOTE_FIELDS) {
        const text = c.notes[s][f];
        lines.push(`- ${NOTE_LABELS[f]}:${text ? "" : " (empty)"}`);
        if (text) for (const part of text.split("\n")) lines.push(`  > ${escapeMarkdown(part)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}
