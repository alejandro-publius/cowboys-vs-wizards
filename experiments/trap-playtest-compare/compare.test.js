// Issue #124: paired T1 / BASE report comparator. Reports here are built by
// the real exporter (createPlaytestReport) from real lab matches: createLab()
// on a fake synchronous scheduler, the Cowboy played by chooseAction through
// the controller, events from the lab's Cowboy projection. Hostile cases edit
// copies of those real reports. Not part of npm test.
// Run: node --test experiments/trap-playtest-compare/compare.test.js
// No human feedback is collected or simulated: every note string below is a
// fixed test string, and these synthetic matches are not playtests.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseAction } from "../../src/game/cpu.js";
import { MAX_ROUNDS } from "../../src/game/state.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { FIXTURE_TRAPS, createLab } from "../trap-placeholder/lab.js";
import { DECK_TRAP_IDS } from "../trap-placeholder/scenarios.js";
import * as exporter from "../trap-placeholder/playtest-report.js";
import {
  COMPARISON_SCHEMA,
  CompareError,
  MAX_EVENTS,
  NOTE_FIELDS,
  NOTE_MAX,
  REPORT_SCHEMA,
  REPORT_SCHEMA_VERSION,
  REPORT_SOURCE,
  compareReports,
  escapeMarkdown,
  formatMarkdown,
} from "./compare.js";

const HERE = fileURLToPath(new URL("./", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = path.join(HERE, "run.mjs");
const STEP = 50;
const MAX_TICKS = 20000;
const WIZARD_TRAP_IDS = [FIXTURE_TRAPS.wizard, ...DECK_TRAP_IDS.filter((id) => id.includes("-wizard-"))];
const OUT_KEYS = ["schema", "schemaVersion", "source", "disclaimer", "seed", "wizardCpu", "completeness", "interpretation", "reports", "comparison", "warnings"];
const TEST_NOTE = "Fixed test string, not human feedback.";

// ---- real lab matches (as in tests/experiments/trap-placeholder-report.test.js) ----

function actCowboy(lab) {
  const c = lab.controller;
  const a = chooseAction(c.view(), { cards: lab.cards });
  if (a.type === "set-trap") {
    c.input({ type: "card", cardId: a.cardId });
    assert.deepEqual(c.input({ type: "confirm" }), { ok: true });
  } else if (a.type === "end-phase") assert.deepEqual(c.endPhase(), { ok: true });
  else assert.deepEqual(c.submit(a), { ok: true });
}
function play(scheduler, lab, stop = () => false) {
  for (let ticks = 0; ; ) {
    const status = lab.controller.status();
    assert.notEqual(status, "error", lab.controller.message());
    if (status === "terminal" || stop()) return;
    if (status === "accepting_input") {
      actCowboy(lab);
      continue;
    }
    assert.ok(++ticks <= MAX_TICKS, "no result");
    scheduler.tick(scheduler.now() + STEP);
  }
}
function exportOf(lab, { notes, includeEvents = true } = {}) {
  const c = lab.controller;
  return exporter.createPlaytestReport({ ...lab.settings, seed: c.seed(), seedPinned: c.seedPinned(), status: c.status(), view: c.view(), events: lab.events(), cards: lab.cards, notes, includeEvents });
}
// One real lab match exported as the lab's download would be (JSON round trip).
function labReport(scenario, seed, cpuLevel = "normal", { stop, notes, includeEvents = true } = {}) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const lab = createLab({ scheduler, scenario, cpuLevel });
  assert.equal(lab.controller.start(String(seed)), true);
  play(scheduler, lab, stop && (() => stop(lab)));
  return { lab, report: JSON.parse(JSON.stringify(exportOf(lab, { notes, includeEvents }))) };
}
const pair = (seed, cpu = "normal", opts = {}) => [labReport("T1", seed, cpu, opts).report, labReport("BASE", seed, cpu, opts).report];
const clone = (v) => JSON.parse(JSON.stringify(v));
const deepFreeze = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
};
const refuses = (fn, pattern) => assert.throws(fn, (e) => e instanceof CompareError && pattern.test(e.message), `expected CompareError ${pattern}`);
const roundsPlayed = (n) => (lab) => lab.events().filter((e) => e.type === "round-start").length >= n;

test("constants match the exporter", () => {
  assert.equal(REPORT_SCHEMA, exporter.REPORT_SCHEMA);
  assert.equal(REPORT_SCHEMA_VERSION, exporter.REPORT_SCHEMA_VERSION);
  assert.equal(REPORT_SOURCE, exporter.REPORT_SOURCE);
  assert.deepEqual([...NOTE_FIELDS], [...exporter.NOTE_FIELDS]);
  assert.equal(NOTE_MAX, exporter.NOTE_MAX);
  assert.equal(MAX_EVENTS, exporter.MAX_EVENTS);
  assert.equal(MAX_ROUNDS, 9);
});

test("terminal real pairs (seeds 0, 9, 55 x easy, normal, hard): counts are the reports' metrics, either order, deterministic, no hidden data", () => {
  for (const seed of [0, 9, 55]) {
    for (const cpu of ["easy", "normal", "hard"]) {
      const t1 = labReport("T1", seed, cpu);
      const base = labReport("BASE", seed, cpu);
      assert.equal(t1.report.match.status, "terminal");
      assert.equal(base.report.match.status, "terminal");
      const c = compareReports(t1.report, base.report);
      assert.deepEqual(Object.keys(c), OUT_KEYS);
      assert.equal(c.schema, COMPARISON_SCHEMA);
      assert.equal(c.source, "synthetic-developer-lab");
      assert.equal(c.seed, seed);
      assert.equal(c.wizardCpu, cpu);
      assert.equal(c.completeness, "complete");
      assert.equal(c.interpretation, "objective-counts");
      assert.deepEqual(Object.keys(c.reports), ["T1", "BASE"]);
      assert.deepEqual(c.reports.T1.metrics, t1.report.metrics);
      assert.deepEqual(c.reports.BASE.metrics, base.report.metrics);
      assert.deepEqual(c.reports.T1.match.result, { outcome: t1.report.match.result.outcome, reason: t1.report.match.result.reason, round: t1.report.match.result.round });
      const d = c.comparison.metricDelta;
      assert.equal(d.publicEvents, t1.report.metrics.publicEvents - base.report.metrics.publicEvents);
      assert.equal(d.trapSet.wizard, t1.report.metrics.trapSet.wizard);
      assert.equal(d.spell.cowboy, t1.report.metrics.spell.cowboy - base.report.metrics.spell.cowboy);
      assert.equal(c.comparison.endingRoundDelta, t1.report.match.result.round - base.report.match.result.round);
      assert.equal(c.comparison.sameOutcome, t1.report.match.result.outcome === base.report.match.result.outcome);
      // Either input order, byte-identical output; a replayed pair is identical too.
      assert.equal(JSON.stringify(compareReports(base.report, t1.report)), JSON.stringify(c));
      assert.equal(JSON.stringify(compareReports(...pair(seed, cpu))), JSON.stringify(c));
      const json = JSON.stringify(c) + formatMarkdown(c);
      for (const id of [...WIZARD_TRAP_IDS, ...DECK_TRAP_IDS, "humanNotes", "publicEvents\":[", "trap-trigger", "disclaimer\":\"Synthetic developer lab"]) {
        assert.equal(json.includes(id), false, `${seed} ${cpu}: ${id} in output`);
      }
      assert.equal("notes" in c, false);
    }
  }
});

test("Markdown: deterministic per-side count table, completeness and synthetic warning", () => {
  const [t1, base] = pair(0);
  const md = formatMarkdown(compareReports(t1, base));
  assert.equal(md, formatMarkdown(compareReports(base, t1)));
  assert.match(md, /^# Trap lab paired report comparison \(synthetic\)\n/);
  assert.match(md, /- Completeness: \*\*complete\*\*/);
  assert.match(md, /\| Count \| Side \| T1 \| BASE \| T1 - BASE \|/);
  for (const side of ["Cowboy", "Wizard"]) for (const label of ["Trap set", "Trap trigger", "Spell cast", "Phase end"]) assert.match(md, new RegExp(`\\| ${label} \\| ${side} \\| \\d+ \\| \\d+ \\| [+-]?\\d+ \\|`));
  assert.match(md, new RegExp(`\\| Public events \\| both \\| ${t1.metrics.publicEvents} \\| ${base.metrics.publicEvents} \\|`));
  assert.match(md, /not human playtest evidence, balance or a win rate/);
  assert.match(md, /- Ending round, T1 minus BASE: [+-]?\d+/);
  assert.doesNotMatch(md, /win rate:|winRate|%/);
});

test("partial and idle: incomplete, interpretation blocked, no outcome or ending-round difference, counts kept", () => {
  const t1 = labReport("T1", 0, "normal", { stop: roundsPlayed(2) }).report;
  const base = labReport("BASE", 0, "normal").report;
  assert.ok(["accepting_input", "playing", "cpu_turn"].includes(t1.match.status), t1.match.status);
  for (const [a, b] of [[t1, base], [base, t1]]) {
    const c = compareReports(a, b);
    assert.equal(c.completeness, "incomplete");
    assert.equal(c.interpretation, "blocked");
    assert.equal(c.comparison, null);
    assert.deepEqual(c.reports.T1.metrics, t1.metrics);
    assert.equal(c.reports.T1.match.result, null);
    assert.ok(c.warnings.some((w) => w === `T1: match is not finished (status ${t1.match.status}).`));
    assert.ok(c.warnings.some((w) => w.startsWith("Interpretation blocked")));
    const md = formatMarkdown(c);
    assert.match(md, /- Completeness: \*\*incomplete\*\*/);
    assert.match(md, /Not computed: interpretation blocked/);
    assert.doesNotMatch(md, /Same outcome|Ending round, T1 minus BASE|T1 - BASE/);
  }
  // Both partial.
  assert.equal(compareReports(t1, labReport("BASE", 0, "normal", { stop: roundsPlayed(3) }).report).comparison, null);
  // An exported Leave/idle report has seed null: refused with a fix.
  const idle = exporter.createPlaytestReport({ scenario: "T1", cpuLevel: "normal", status: "idle", seed: 0, seedPinned: true });
  refuses(() => compareReports(clone(idle), base), /first report\.seed: is null.*press Start/);
  // Hand-made idle shapes with a seed are accepted as incomplete, never compared.
  const noMatch = { ...clone(idle), seed: 0 };
  const c1 = compareReports(noMatch, base);
  assert.equal(c1.completeness, "incomplete");
  assert.equal(c1.reports.T1.match.status, "none");
  assert.ok(c1.warnings.includes("T1: no current match in the report (idle)."));
  const idleStatus = clone(t1);
  idleStatus.match = { status: "idle", round: null, activeSide: null, result: null };
  assert.equal(compareReports(idleStatus, base).comparison, null);
  // Terminal status without a result, or a result without terminal status: incomplete.
  const noResult = clone(base);
  noResult.match.result = null;
  assert.equal(compareReports(labReport("T1", 0).report, noResult).completeness, "incomplete");
  const errored = clone(base);
  errored.match.status = "error";
  assert.equal(compareReports(labReport("T1", 0).report, errored).interpretation, "blocked");
});

test("metric limits: truncated and dropped events are reported, never read as absence", () => {
  const [t1, base] = pair(0);
  // The real exporter's cap: 525 events, terminal view.
  const view = { round: t1.match.round, activeSide: null, result: { ...t1.match.result } };
  const many = Array.from({ length: MAX_EVENTS + 25 }, () => ({ type: "draw", side: "cowboy" }));
  const capped = clone(exporter.createPlaytestReport({ scenario: "T1", cpuLevel: "normal", seed: 0, seedPinned: true, status: "terminal", view, events: many, cards: {}, includeEvents: false }));
  assert.equal(capped.eventsTruncated, true);
  const c = compareReports(capped, base);
  assert.equal(c.completeness, "complete");
  assert.equal(c.interpretation, "objective-counts-with-limits");
  assert.equal(c.reports.T1.limits.eventsTruncated, true);
  assert.ok(c.warnings.includes(`T1: the event list hit the ${MAX_EVENTS}-event cap; counts cover only the first ${MAX_EVENTS} events.`));
  assert.ok(c.warnings.includes("T1: a zero or low count here does not show that the event did not happen."));
  assert.match(formatMarkdown(c), /\| T1 \| yes \| 0 \| no \|/);
  // Dropped (unsanitizable) events from the real exporter.
  const dropped = clone(exporter.createPlaytestReport({ scenario: "BASE", cpuLevel: "normal", seed: 0, seedPinned: true, status: "playing", view: { round: 1, activeSide: "cowboy", result: null }, events: [{ type: "draw", side: "cowboy" }, { type: "bogus" }, null], cards: {} }));
  assert.equal(dropped.eventsDropped, 2);
  const cd = compareReports(t1, dropped);
  assert.ok(cd.warnings.includes("BASE: 2 event(s) could not be sanitized by the exporter and are not counted."));
  assert.equal(cd.reports.BASE.limits.eventsDropped, 2);
  // Reports without the event list compare on metrics alone.
  const bare = compareReports(...pair(0, "normal", { includeEvents: false }));
  const full = compareReports(t1, base);
  for (const s of ["T1", "BASE"]) {
    assert.deepEqual(bare.reports[s].metrics, full.reports[s].metrics);
    assert.equal(bare.reports[s].limits.publicEventsIncluded, false);
    assert.equal(full.reports[s].limits.publicEventsIncluded, true);
  }
  assert.deepEqual(bare.comparison, full.comparison);
});

test("invalid pairs and schema: actionable errors", () => {
  const [t1, base] = pair(0);
  const t1Easy = labReport("T1", 0, "easy").report;
  const base9 = labReport("BASE", 9).report;
  refuses(() => compareReports(t1, clone(t1)), /^pair: both reports are T1; supply one T1 report and one BASE report$/);
  refuses(() => compareReports(base, clone(base)), /both reports are BASE/);
  refuses(() => compareReports(t1, base9), /^pair: seeds differ/);
  refuses(() => compareReports(t1Easy, base), /^pair: Wizard CPU levels differ/);
  const edit = (r, f) => {
    const x = clone(r);
    f(x);
    return x;
  };
  const cases = [
    [edit(t1, (x) => (x.schema = "other")), /first report\.schema: must be/],
    [edit(t1, (x) => (x.schemaVersion = 2)), /schemaVersion: must be 1/],
    [edit(t1, (x) => (x.source = "human-playtest")), /source: must be "synthetic-developer-lab"/],
    [edit(t1, (x) => (x.scenario = "T2")), /scenario: must be T1 or BASE/],
    [edit(t1, (x) => (x.scenario = "FIXTURE")), /scenario: must be T1 or BASE/],
    [edit(t1, (x) => (x.wizardCpu = "brutal")), /wizardCpu: must be easy, normal or hard/],
    [edit(t1, (x) => (x.seed = -1)), /seed: must be an integer 0 to 4294967295/],
    [edit(t1, (x) => (x.seed = 4294967296)), /seed: must be an integer/],
    [edit(t1, (x) => (x.seed = 0.5)), /seed: must be an integer/],
    [edit(t1, (x) => (x.seed = "0")), /seed: must be an integer/],
    [edit(t1, (x) => (x.match.status = "won")), /match\.status: is not a known controller status/],
    [edit(t1, (x) => (x.match.result.outcome = "victory")), /outcome: must be win, loss or draw/],
    [edit(t1, (x) => (x.match.result.outcome = "toString")), /outcome: must be win, loss or draw/],
    [edit(t1, (x) => (x.match.result.winner = x.match.result.winner === "cowboy" ? "wizard" : "cowboy")), /winner and loser do not match outcome/],
    [edit(t1, (x) => (x.match.result.reason = "Base Destroyed!")), /reason: must be a short lowercase reason code/],
    [edit(t1, (x) => (x.match.result.round = 10)), /result\.round: must be an integer 1 to 9/],
    [edit(t1, (x) => (x.match.round = 0)), /match\.round: must be null or an integer/],
    [edit(t1, (x) => (x.match.activeSide = "dragon")), /activeSide/],
    [edit(t1, (x) => (x.eventsTruncated = "no")), /eventsTruncated: must be true or false/],
    [edit(t1, (x) => (x.eventsTruncated = true)), /eventsTruncated is true but 500 events were not read/],
    [edit(t1, (x) => (x.publicEventsIncluded = 1)), /publicEventsIncluded: must be true or false/],
    [edit(t1, (x) => (x.publicEvents = {})), /publicEvents: must be an array/],
    [edit(t1, (x) => x.publicEvents.pop()), /publicEvents: length does not match/],
    [edit(t1, (x) => (x.publicEventsIncluded = false)), /publicEvents: length does not match/],
    [edit(t1, (x) => (x.eventsDropped = MAX_EVENTS)), /exceed the exporter cap of 500/],
    [edit(t1, (x) => (x.humanNotes.pacing = 5)), /humanNotes\.pacing: must be a string/],
    [edit(t1, (x) => (x.humanNotes.pacing = "x".repeat(NOTE_MAX * 4 + 1))), /humanNotes\.pacing: must be a string of at most 1000/],
    [edit(t1, (x) => delete x.humanNotes.freeform), /humanNotes: missing field "freeform"/],
    [edit(t1, (x) => delete x.metrics), /first report: missing field "metrics"/],
    [edit(t1, (x) => (x.disclaimer = 7)), /disclaimer: must be a short string/],
    [edit(t1, (x) => (x.match = [])), /match: must be a plain JSON object/],
  ];
  for (const [bad, pattern] of cases) {
    refuses(() => compareReports(bad, base), pattern);
    refuses(() => compareReports(base, bad), new RegExp(pattern.source.replace(/first report/g, "second report")));
  }
  for (const v of [null, undefined, 42, "report", [], new Date(0), new (class Report {})()]) refuses(() => compareReports(v, base), /first report: must be a plain JSON object/);
  // BASE has traps off: trap counts in a BASE report are refused.
  const trappyBase = edit(base, (x) => {
    x.metrics.trapSet.wizard = 1;
  });
  refuses(() => compareReports(t1, trappyBase), /BASE has traps off/);
});

test("counts: strict nonnegative finite integers, exact keys, consistent totals", () => {
  const [t1, base] = pair(0);
  for (const v of [-1, 1.5, NaN, Infinity, -Infinity, "3", null, true, 2 ** 53, [1], {}]) {
    for (const set of [(x) => (x.metrics.publicEvents = v), (x) => (x.metrics.spell.wizard = v), (x) => (x.metrics.roundStart = v), (x) => (x.eventsDropped = v)]) {
      const bad = clone(t1);
      set(bad);
      refuses(() => compareReports(bad, base), /must be a nonnegative finite integer/);
    }
  }
  const over = clone(t1);
  over.metrics.phaseEnd.cowboy += over.metrics.publicEvents;
  refuses(() => compareReports(over, base), /counted events exceed publicEvents/);
  const rounds = clone(t1);
  rounds.metrics.roundStart = 10;
  rounds.metrics.publicEvents += 10;
  rounds.publicEventsIncluded = false;
  rounds.publicEvents = [];
  refuses(() => compareReports(rounds, base), /roundStart: exceeds 9 rounds/);
  const extraMetric = clone(t1);
  extraMetric.metrics.damage = { cowboy: 1, wizard: 1 };
  refuses(() => compareReports(extraMetric, base), /first report\.metrics: 1 unexpected field/);
  const extraSide = clone(t1);
  extraSide.metrics.trapSet.dragon = 0;
  refuses(() => compareReports(extraSide, base), /metrics\.trapSet: 1 unexpected field/);
});

test("hostile extras: sentinel fields, __proto__ keys, accessors and symbols are refused without echo or pollution", () => {
  const [t1, base] = pair(0);
  const S = "SENTINEL_124";
  const withTop = (k, v) => ({ ...clone(t1), [k]: v });
  const hostile = [
    withTop("wizardHand", [S]),
    withTop("rng", S),
    withTop("timestamp", S),
    withTop("path", `/Users/${S}`),
    withTop(S, S),
    JSON.parse(JSON.stringify(t1).replace(/^\{/, `{"__proto__":{"polluted":"${S}"},`)),
    JSON.parse(JSON.stringify(t1).replace(`"match":{`, `"match":{"__proto__":{"status":"terminal"},`)),
    JSON.parse(JSON.stringify(t1).replace(`"humanNotes":{`, `"humanNotes":{"${S}":"${S}",`)),
    JSON.parse(JSON.stringify(t1).replace(`"result":{`, `"result":{"hiddenTrap":"${WIZARD_TRAP_IDS[1]}",`)),
    Object.assign(clone(t1), { [Symbol("x")]: S }),
  ];
  for (const bad of hostile) {
    assert.throws(() => compareReports(bad, base), (e) => e instanceof CompareError && /unexpected field/.test(e.message) && !e.message.includes(S) && !e.message.includes("test-fixture"));
  }
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal({}.status, undefined);
  // Accessors are refused before their getter could run.
  let ran = false;
  const getter = clone(t1);
  Object.defineProperty(getter, "seed", { enumerable: true, get: () => ((ran = true), 0) });
  refuses(() => compareReports(getter, base), /field "seed" must be plain data/);
  assert.equal(ran, false);
  // An inherited field does not count as present.
  const inherits = Object.create(clone(t1));
  refuses(() => compareReports(inherits, base), /must be a plain JSON object/);
  const nullProto = Object.assign(Object.create(null), clone(t1));
  assert.equal(compareReports(nullProto, base).completeness, "complete");
  // Hidden-looking text inside the event list is never copied (events are not read).
  const loud = clone(t1);
  loud.publicEvents = loud.publicEvents.map((e) => ({ ...e, secret: S, cardId: WIZARD_TRAP_IDS[1] }));
  const out = JSON.stringify(compareReports(loud, base)) + formatMarkdown(compareReports(loud, base, { includeNotes: true }));
  assert.equal(out.includes(S), false);
  assert.equal(out.includes(WIZARD_TRAP_IDS[1]), false);
});

test("no mutation and no shared references", () => {
  const [t1, base] = pair(0, "normal", { notes: { freeform: TEST_NOTE } });
  const before = [JSON.stringify(t1), JSON.stringify(base)];
  deepFreeze(t1);
  deepFreeze(base);
  const c = compareReports(t1, base, { includeNotes: true });
  assert.deepEqual([JSON.stringify(t1), JSON.stringify(base)], before);
  assert.notEqual(c.reports.T1.metrics, t1.metrics);
  assert.notEqual(c.reports.T1.metrics.spell, t1.metrics.spell);
  assert.notEqual(c.reports.T1.match.result, t1.match.result);
  assert.notEqual(c.notes.T1, t1.humanNotes);
  c.reports.T1.metrics.spell.cowboy = 999;
  c.notes.T1.freeform = "changed";
  assert.deepEqual([JSON.stringify(t1), JSON.stringify(base)], before);
});

test("notes: excluded by default, included only with includeNotes true, bounded and Markdown-escaped", () => {
  const notes = { spellVersusTrap: TEST_NOTE, armingClarity: "", pacing: "Test line one\nTest line two", freeform: "[link](http://example.invalid) <img src=x onerror=alert(1)> | # *bold* `code`" };
  const [t1, base] = pair(0, "normal", { notes });
  assert.equal(t1.humanNotes.spellVersusTrap, TEST_NOTE);
  for (const opts of [undefined, {}, { includeNotes: false }, { includeNotes: "true" }, { includeNotes: 1 }]) {
    const c = compareReports(t1, base, opts);
    assert.equal("notes" in c, false);
    const text = JSON.stringify(c) + formatMarkdown(c);
    for (const s of [TEST_NOTE, "Test line", "example.invalid", "onerror"]) assert.equal(text.includes(s), false);
    assert.doesNotMatch(text, /Notes are shown/);
  }
  const c = compareReports(base, t1, { includeNotes: true });
  assert.deepEqual(Object.keys(c.notes), ["T1", "BASE"]);
  assert.deepEqual(c.notes.T1, notes);
  assert.deepEqual(c.notes.BASE, notes);
  assert.ok(c.warnings.includes("Notes are shown exactly as stored in the reports. The comparator does not interpret them."));
  const md = formatMarkdown(c);
  assert.match(md, /## Notes as stored \(not interpreted\)/);
  assert.match(md, /- Arming clarity: \(empty\)/);
  assert.ok(md.includes("  > Test line one\n  > Test line two"));
  assert.ok(md.includes("  > \\[link\\]\\(http://example\\.invalid\\) &lt;img src=x onerror=alert\\(1\\)&gt; \\| \\# \\*bold\\* \\`code\\`"));
  assert.equal(md.includes("<img"), false);
  assert.equal(md.includes("](http"), false);
  assert.equal(escapeMarkdown("a\\b_c"), "a\\\\b\\_c");
  // Control and bidi characters are removed; length is bounded by code points.
  const raw = clone(t1);
  raw.humanNotes.freeform = "a\u202Eb\u0000c\r\nd";
  raw.humanNotes.pacing = "\u{1F920}".repeat(NOTE_MAX + 5);
  const cleaned = compareReports(raw, base, { includeNotes: true }).notes.T1;
  assert.equal(cleaned.freeform, "abc\nd");
  assert.equal(Array.from(cleaned.pacing).length, NOTE_MAX);
});

test("compare.js is pure and browser-safe; run.mjs imports only node:fs/promises and compare.js", async () => {
  const strip = (src) => src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const compare = strip(await readFile(path.join(HERE, "compare.js"), "utf8"));
  assert.doesNotMatch(compare, /\bimport\b|\brequire\(|\bfetch\b|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.|window\.|Date\b|Math\.random|performance\.|process\./);
  const cli = strip(await readFile(CLI, "utf8"));
  assert.deepEqual([...cli.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]), ["node:fs/promises", "./compare.js"]);
  assert.doesNotMatch(cli, /writeFile|appendFile|mkdir|createWriteStream|\bfetch\b|node:http|node:net|node:https|node:dgram|child_process/);
  const app = strip(await readFile(path.join(HERE, "app.js"), "utf8"));
  assert.deepEqual([...app.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]), ["./compare.js"]);
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|cookie/);
  const html = await readFile(path.join(HERE, "index.html"), "utf8");
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'self'; connect-src 'none'/);
  assert.doesNotMatch(html, /https?:\/\//);
});

// ---- CLI ----

test("CLI: read-only, deterministic Markdown, no file names or paths in output, actionable errors", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kiro-compare-cli-"));
  try {
    const notes = { spellVersusTrap: TEST_NOTE, armingClarity: "", pacing: "", freeform: "" };
    const [t1, base] = pair(55, "hard", { notes });
    const t1File = path.join(dir, "secret-name-T1.json");
    const baseFile = path.join(dir, "secret-name-BASE.json");
    await writeFile(t1File, JSON.stringify(t1));
    await writeFile(baseFile, JSON.stringify(base));
    const sameFile = path.join(dir, "secret-name-T1-copy.json");
    await writeFile(sameFile, JSON.stringify(t1));
    const before = await Promise.all([t1File, baseFile].map(async (f) => [await readFile(f, "utf8"), (await stat(f)).mtimeMs]));
    const listing = (await readdir(dir)).sort();
    // The Node permission model grants reads only: any write would throw.
    const run = (...args) => spawnSync(process.execPath, ["--permission", `--allow-fs-read=${ROOT}`, `--allow-fs-read=${dir}`, CLI, ...args], { encoding: "utf8", cwd: dir, env: { PATH: process.env.PATH } });

    const a = run(t1File, baseFile);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(a.stderr, "");
    assert.equal(a.stdout, formatMarkdown(compareReports(t1, base)));
    assert.equal(run(baseFile, t1File).stdout, a.stdout, "either order");
    for (const s of [dir, "secret-name", ".json", TEST_NOTE, ROOT]) assert.equal(a.stdout.includes(s), false, s);
    assert.match(a.stdout, /- Seed: 55\n- Wizard CPU: hard\n- Completeness: \*\*complete\*\*/);

    const n = run(t1File, "--notes", baseFile);
    assert.equal(n.status, 0, n.stderr);
    assert.equal(n.stdout, formatMarkdown(compareReports(t1, base, { includeNotes: true })));
    assert.ok(n.stdout.includes(`> ${escapeMarkdown(TEST_NOTE)}`));
    assert.equal(n.stdout.includes(dir), false);

    for (const args of [[], [t1File], [t1File, baseFile, baseFile], [t1File, baseFile, "--notes", "--notes"], [t1File, "--out", baseFile]]) {
      const r = run(...args);
      assert.equal(r.status, 2, JSON.stringify(args));
      assert.match(r.stderr, /^usage: /);
      assert.equal(r.stdout, "");
    }
    for (const [args, pattern] of [
      [[t1File, sameFile], /^Cannot compare: pair: both reports are T1/],
      [[t1File, path.join(dir, "missing-secret-name.json")], /^Cannot compare: second file: cannot be read\n$/],
      [[dir, baseFile], /^Cannot compare: first file: is not a regular file\n$/],
    ]) {
      const r = run(...args);
      assert.equal(r.status, 1);
      assert.match(r.stderr, pattern);
      assert.equal(r.stderr.includes("secret-name"), false);
      assert.equal(r.stdout, "");
    }
    const badJson = path.join(dir, "bad.json");
    await writeFile(badJson, "{not json");
    const bj = run(badJson, baseFile);
    assert.equal(bj.status, 1);
    assert.equal(bj.stderr, "Cannot compare: first file: is not valid JSON\n");
    listing.push("bad.json");
    assert.deepEqual((await readdir(dir)).sort(), listing.sort(), "CLI created no file");
    const after = await Promise.all([t1File, baseFile].map(async (f) => [await readFile(f, "utf8"), (await stat(f)).mtimeMs]));
    assert.deepEqual(after, before, "inputs unchanged");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---- Chrome loopback smoke of the optional page (DevTools protocol, no dependency) ----

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function serve() {
  const server = createServer(async (req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname));
    if (req.method !== "GET" || !file.startsWith(ROOT)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launchChrome() {
  const profile = await mkdtemp(path.join(tmpdir(), "kiro-compare-chrome-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--mute-audio", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited with ${code}:\n${stderr}`));
    });
  });
  return {
    url,
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await Promise.race([exited, sleep(5000)]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      await rm(profile, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const waiting = new Map();
    const listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id === undefined) return listeners.forEach((listener) => listener(message));
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) entry?.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry?.resolve(message.result);
    });
    ws.addEventListener("error", () => reject(new Error(`WebSocket error on ${wsUrl}`)));
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}, sessionId) {
          const id = ++next;
          ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
          return new Promise((ok, fail) => waiting.set(id, { resolve: ok, reject: fail, method }));
        },
        on: (listener) => listeners.add(listener),
        close: () => ws.close(),
      }),
    );
  });
}

test("Chrome smoke: choose two real lab reports, click Compare, read the rendered tables; textContent only, no remote request or storage", { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}` }, async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "kiro-compare-files-"));
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const errors = [];
  const requests = [];
  try {
    const hostileNote = "<img src=x id=injected onerror=alert(1)> fixed test string";
    const [t1, base] = pair(0, "normal", { notes: { spellVersusTrap: "", armingClarity: "", pacing: "", freeform: hostileNote } });
    const partial = labReport("T1", 0, "normal", { stop: roundsPlayed(2) }).report;
    const files = { t1: path.join(dir, "t1.json"), base: path.join(dir, "base.json"), partial: path.join(dir, "partial.json") };
    await writeFile(files.t1, JSON.stringify(t1));
    await writeFile(files.base, JSON.stringify(base));
    await writeFile(files.partial, JSON.stringify(partial));

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    cdp.on(({ method, params, sessionId: id }) => {
      if (id !== sessionId) return;
      if (method === "Network.requestWillBeSent") requests.push(params.request.url);
      if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
      if (method === "Runtime.consoleAPICalled" && params.type === "error") errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
      if (method === "Page.javascriptDialogOpening") errors.push(`dialog: ${params.message}`);
    });
    for (const domain of ["Network", "Page", "Runtime", "DOM"]) await send(`${domain}.enable`);
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async (expression, ms = 20000) => {
      for (const stop = Date.now() + ms; Date.now() < stop; await sleep(40)) if (await evaluate(expression)) return;
      throw new Error(`timed out: ${expression}`);
    };
    const choose = async (selector, file) => {
      const { root } = await send("DOM.getDocument", { depth: 0 });
      const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector });
      await send("DOM.setFileInputFiles", { nodeId, files: [file] });
    };
    const clickCompare = async () => {
      const [x, y] = await evaluate(`(() => { const b = document.getElementById("compare"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    };
    const statusText = () => evaluate(`document.getElementById("status").textContent`);
    const cells = (id) => evaluate(`[...document.querySelectorAll("#${id} tr")].map((tr) => [...tr.cells].map((c) => c.textContent))`);

    await send("Page.navigate", { url: `${origin}/experiments/trap-playtest-compare/index.html` });
    await wait(`document.readyState === "complete" && !!document.getElementById("compare")`);
    assert.equal(await evaluate(`document.getElementById("result").hidden`), true);
    assert.equal(await evaluate(`document.getElementById("include-notes").checked`), false, "notes off by default");
    // Labels name every native control.
    assert.deepEqual(await evaluate(`["first-file", "second-file", "include-notes"].map((id) => document.querySelector('label[for="' + id + '"]')?.textContent.length > 0)`), [true, true, true]);

    // Choosing files does nothing until Compare is pressed.
    await choose("#first-file", files.base);
    await choose("#second-file", files.t1);
    await sleep(200);
    assert.equal(await evaluate(`document.getElementById("result").hidden`), true);
    await clickCompare();
    await wait(`document.getElementById("status").textContent.startsWith("Compared")`);
    assert.equal(await statusText(), "Compared T1 and BASE for seed 0, Wizard CPU normal: complete.");
    const expected = compareReports(t1, base);
    const counts = await cells("count-table");
    assert.deepEqual(counts[0], ["Count", "Side", "T1", "BASE", "T1 - BASE"]);
    assert.equal(counts.length, 1 + 10);
    assert.deepEqual(counts[1].slice(2, 4), [String(t1.metrics.publicEvents), String(base.metrics.publicEvents)]);
    assert.deepEqual(counts.find((r) => r[0] === "Trap set" && r[1] === "Wizard").slice(2, 4), [String(t1.metrics.trapSet.wizard), "0"]);
    const match = await cells("match-table");
    assert.deepEqual(match[1], ["T1", "terminal", String(t1.match.round), t1.match.result.outcome, t1.match.result.reason, String(t1.match.result.round)]);
    assert.equal(await evaluate(`document.getElementById("warnings").children.length`), expected.warnings.length);
    assert.equal(await evaluate(`document.getElementById("notes").hidden`), true);
    assert.equal((await evaluate(`document.body.textContent`)).includes("fixed test string"), false, "notes not shown by default");

    // Opt in to notes: the hostile test string is shown as text, never parsed as HTML.
    await evaluate(`document.getElementById("include-notes").click()`);
    await clickCompare();
    await wait(`!document.getElementById("notes").hidden`);
    assert.equal(await evaluate(`[...document.querySelectorAll("#notes-body dd")].filter((d) => d.textContent === ${JSON.stringify(hostileNote)}).length`), 2);
    assert.deepEqual(await evaluate(`[document.querySelectorAll("img").length, !!document.getElementById("injected")]`), [0, false]);

    // Partial T1: incomplete, no delta column; then an invalid pair shows an alert.
    await choose("#second-file", files.partial);
    await clickCompare();
    await wait(`document.getElementById("status").textContent.endsWith("incomplete.")`);
    assert.deepEqual((await cells("count-table"))[0], ["Count", "Side", "T1", "BASE"]);
    assert.ok((await evaluate(`document.getElementById("summary").textContent`)).includes("not computed (interpretation blocked)"));
    await choose("#first-file", files.t1);
    await clickCompare();
    await wait(`!document.getElementById("error").hidden`);
    assert.equal(await evaluate(`document.getElementById("error").textContent`), "Cannot compare: pair: both reports are T1; supply one T1 report and one BASE report");
    assert.equal(await evaluate(`document.getElementById("result").hidden`), true);
    assert.equal(await statusText(), "Comparison failed.");

    const remote = requests.filter((u) => !u.startsWith(`${origin}/`));
    assert.deepEqual(remote, [], "no request outside the loopback server");
    assert.deepEqual(requests.map((u) => new URL(u).pathname).sort(), ["/experiments/trap-playtest-compare/app.js", "/experiments/trap-playtest-compare/compare.js", "/experiments/trap-playtest-compare/index.html"]);
    assert.deepEqual(await evaluate(`[document.cookie, localStorage.length, sessionStorage.length]`), ["", 0, 0]);
    assert.deepEqual(errors, [], "no runtime exception, console error or dialog");
    t.diagnostic(`${(await cdp.send("Browser.getVersion")).product}; requests ${requests.length} (all ${origin}); seed 0 normal: T1 ${t1.match.result.outcome} (${t1.match.result.reason}) round ${t1.match.result.round}, BASE ${base.match.result.outcome} (${base.match.result.reason}) round ${base.match.result.round}`);
  } finally {
    cdp.close();
    await chrome.close();
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
