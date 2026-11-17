// Issue #118: local playtest report of the trap placeholder lab
// (experiments/trap-placeholder/playtest-report.js and its export button).
// Node checks of the pure builder on real lab matches and on hostile input,
// then one Chrome loopback smoke of the real export button (skipped when
// Chrome is not at the default macOS path). Not part of npm test.
// Run: node --test tests/experiments/trap-placeholder-report.test.js
// No human feedback is collected or simulated here: every note in these tests
// is a fixed test string, and the default notes are checked to be empty.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { FIXTURE_TRAPS, createLab, createLabSession } from "../../experiments/trap-placeholder/lab.js";
import { DECK_TRAP_IDS } from "../../experiments/trap-placeholder/scenarios.js";
import {
  MAX_EVENTS,
  NOTE_FIELDS,
  NOTE_MAX,
  REPORT_SCHEMA,
  REPORT_SCHEMA_VERSION,
  REPORT_SOURCE,
  cleanNote,
  createPlaytestReport,
  reportFileName,
} from "../../experiments/trap-placeholder/playtest-report.js";

const STEP = 50;
const MAX_TICKS = 20000;
const WIZARD_TRAP_IDS = [FIXTURE_TRAPS.wizard, ...DECK_TRAP_IDS.filter((id) => id.includes("-wizard-"))];
const TOP_KEYS = ["schema", "schemaVersion", "source", "disclaimer", "scenario", "wizardCpu", "seed", "match", "metrics", "eventsTruncated", "eventsDropped", "publicEventsIncluded", "publicEvents", "humanNotes"];
const EMPTY_NOTES = Object.fromEntries(NOTE_FIELDS.map((f) => [f, ""]));

// What app.js passes, read from one lab (or the session's active lab).
function reportOf(lab, { notes, includeEvents = true } = {}) {
  const c = lab.controller;
  return createPlaytestReport({ ...lab.settings, seed: c.seed(), seedPinned: c.seedPinned(), status: c.status(), view: c.view(), events: lab.events(), cards: lab.cards, notes, includeEvents });
}

// The Cowboy plays chooseAction on its own view through the page's paths.
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
function newLab(settings) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  return { scheduler, lab: createLab({ scheduler, ...settings }) };
}
function countByHand(events) {
  const n = (type, side, key = "side") => events.filter((e) => e.type === type && e[key] === side).length;
  const two = (type, key) => ({ cowboy: n(type, "cowboy", key), wizard: n(type, "wizard", key) });
  return { publicEvents: events.length, trapSet: two("trap-set"), trapTrigger: two("trap-trigger"), spell: two("spell", "caster"), phaseEnd: two("phase-end"), roundStart: events.filter((e) => e.type === "round-start").length };
}
const wizardSetOpen = (events) => events.some((e) => e.type === "trap-set" && e.side === "wizard") && !events.some((e) => e.type === "trap-trigger" && e.side === "wizard");

test("schema: exact top-level keys, synthetic disclaimer, empty human notes by default", () => {
  const { lab } = newLab({ scenario: "T1", cpuLevel: "easy" });
  assert.equal(lab.controller.start("0"), true);
  const report = reportOf(lab);
  assert.deepEqual(Object.keys(report), TOP_KEYS);
  assert.equal(report.schema, REPORT_SCHEMA);
  assert.equal(report.schemaVersion, REPORT_SCHEMA_VERSION);
  assert.equal(report.source, "synthetic-developer-lab");
  assert.equal(REPORT_SOURCE, "synthetic-developer-lab");
  assert.match(report.disclaimer, /do not show that any choice was clear or meaningful/);
  assert.equal(report.scenario, "T1");
  assert.equal(report.wizardCpu, "easy");
  assert.equal(report.seed, 0);
  assert.deepEqual(Object.keys(report.match), ["status", "round", "activeSide", "result"]);
  assert.equal(report.match.round, 1);
  assert.deepEqual(report.humanNotes, EMPTY_NOTES);
  assert.deepEqual(createPlaytestReport().humanNotes, EMPTY_NOTES);
  assert.equal(reportFileName(report), "trap-playtest-T1-easy-seed-0.json");
  // No clock: two reports of the same state are byte-identical.
  assert.equal(JSON.stringify(reportOf(lab)), JSON.stringify(report));
});

test("seeds 0 and 60 (FIXTURE, BASE, T1, T2): counts equal the Cowboy-projected events, nothing dropped, result from the public view, replay-identical", () => {
  for (const scenario of ["FIXTURE", "BASE", "T1", "T2"]) {
    for (const seed of [0, 60]) {
      const runs = [0, 1].map(() => {
        const { scheduler, lab } = newLab({ scenario, cpuLevel: "normal" });
        assert.equal(lab.controller.start(String(seed)), true);
        play(scheduler, lab);
        return { lab, report: reportOf(lab) };
      });
      const { lab, report } = runs[0];
      const events = lab.events();
      assert.equal(JSON.stringify(runs[1].report), JSON.stringify(report), `${scenario} ${seed}: deterministic`);
      assert.deepEqual(report.metrics, countByHand(events), `${scenario} ${seed}`);
      assert.equal(report.eventsDropped, 0);
      assert.equal(report.eventsTruncated, false);
      assert.equal(report.publicEvents.length, events.length);
      assert.equal(report.seed, seed);
      const { result } = lab.controller.view();
      assert.deepEqual(report.match, { status: "terminal", round: lab.controller.view().round, activeSide: null, result: { outcome: result.outcome, winner: result.winner, loser: result.loser, reason: result.reason, round: result.round } });
      if (scenario === "BASE") assert.equal(report.metrics.trapSet.cowboy + report.metrics.trapSet.wizard, 0);
      // Without the event list only the counts remain.
      const bare = reportOf(lab, { includeEvents: false });
      assert.deepEqual(bare.publicEvents, []);
      assert.equal(bare.publicEventsIncluded, false);
      assert.deepEqual(bare.metrics, report.metrics);
    }
  }
});

test("real fixtures: a set Wizard trap's ID is absent before it springs and present only from its public trap-trigger", () => {
  for (const [scenario, seed] of [["FIXTURE", 0], ["FIXTURE", 60], ["T1", 0], ["T2", 60]]) {
    const { scheduler, lab } = newLab({ scenario, cpuLevel: "normal" });
    assert.equal(lab.controller.start(String(seed)), true);
    play(scheduler, lab, () => wizardSetOpen(lab.events()));
    assert.ok(wizardSetOpen(lab.events()), `${scenario} ${seed}: reached a set, unsprung Wizard trap`);
    const before = JSON.stringify(reportOf(lab));
    for (const id of WIZARD_TRAP_IDS) assert.equal(before.includes(id), false, `${scenario} ${seed}: ${id} leaked before trigger`);
    const set = reportOf(lab).publicEvents.filter((e) => e.type === "trap-set" && e.side === "wizard");
    assert.deepEqual(set.map(Object.keys), set.map(() => ["type", "side"]));

    play(scheduler, lab, () => lab.events().some((e) => e.type === "trap-trigger" && e.side === "wizard"));
    const after = reportOf(lab);
    const trigger = after.publicEvents.find((e) => e.type === "trap-trigger" && e.side === "wizard");
    assert.ok(trigger && WIZARD_TRAP_IDS.includes(trigger.cardId), `${scenario} ${seed}: trigger reveals the trap`);
    assert.deepEqual(Object.keys(trigger), ["type", "side", "cardId", "target", "cancelled"]);
    // The revealed ID appears only in trigger events, never in a trap-set.
    const json = JSON.stringify(after.publicEvents.filter((e) => e.type !== "trap-trigger"));
    for (const id of WIZARD_TRAP_IDS) assert.equal(json.includes(id), false);
  }
});

test("hostile input: sentinel hidden fields, Wizard trap IDs in trap-set, unknown cards and types never reach the report", () => {
  const { lab } = newLab({ scenario: "T1", cpuLevel: "normal" });
  const S = "SENTINEL_118";
  const real = { side: "cowboy", slot: 0, cardId: Object.keys(lab.cards).find((id) => lab.cards[id].kind === "troop" && lab.cards[id].side === "cowboy") };
  const hidden = { secret: S, rng: S, deck: [S], hand: [S], state: { sides: S }, timestamp: S, path: `/Users/${S}`, __proto__: { polluted: S } };
  const events = [
    { type: "trap-set", side: "wizard", cardId: "test-fixture-deck-trap-wizard-2", ...hidden },
    { type: "trap-set", side: "cowboy", cardId: S },
    { type: "trap-set", side: "cowboy", cardId: "test-fixture-deck-trap-cowboy-2", revision: 3, actionId: S },
    { type: "summon", ...real, tributes: [], extra: S },
    { type: "summon", ...real, tributes: [S] },
    { type: "spell", caster: "wizard", cardId: S, target: real, before: 3, after: 1 },
    { type: "damage", lane: 0, attacker: { ...real, hand: [S] }, target: { kind: "base", side: "wizard", note: S }, amount: 2, before: 5, after: 3 },
    { type: "damage", lane: 0, attacker: real, target: { kind: "troop", side: "wizard", slot: 0, cardId: S }, amount: 2, before: 5, after: 3 },
    { type: "round-start", round: 2, startingSide: "wizard", seed: 12345, rng: [S] },
    { type: "phase-end", side: S, round: 1 },
    { type: "result", result: { winner: "wizard", loser: "cowboy", reason: S, round: 2 } },
    { type: S, side: "cowboy" },
    { type: "draw", side: "wizard", cardId: S },
    S,
    null,
    [S],
    Object.assign(Object.create({ type: "draw", side: "cowboy" }), { inherited: S }),
  ];
  const view = { round: 2, activeSide: "cowboy", result: null, sides: { wizard: { hand: [S], deck: [S], trap: { cardId: S } } }, seed: S, rng: S, traps: S };
  const report = createPlaytestReport({
    scenario: "T1",
    cpuLevel: "normal",
    seed: 0,
    seedPinned: true,
    status: "accepting_input",
    view,
    events,
    cards: lab.cards,
    notes: { spellVersusTrap: "typed", unknownField: S, __proto__: { pacing: S } },
    includeEvents: true,
    extra: S,
  });
  const json = JSON.stringify(report);
  assert.equal(json.includes(S), false, json);
  assert.equal(json.includes("test-fixture-deck-trap-wizard"), false);
  assert.equal(json.includes("12345"), false);
  assert.equal(json.includes("/Users"), false);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(report.publicEvents, [
    { type: "trap-set", side: "wizard" },
    { type: "trap-set", side: "cowboy" },
    { type: "trap-set", side: "cowboy", cardId: "test-fixture-deck-trap-cowboy-2" },
    { type: "summon", ...real, tributes: [] },
    { type: "damage", lane: 0, attacker: real, target: { kind: "base", side: "wizard" }, amount: 2, before: 5, after: 3 },
    { type: "round-start", round: 2, startingSide: "wizard" },
    { type: "draw", side: "wizard" },
  ]);
  assert.equal(report.eventsDropped, events.length - report.publicEvents.length);
  assert.deepEqual(report.match, { status: "accepting_input", round: 2, activeSide: "cowboy", result: null });
  assert.deepEqual(report.humanNotes, { ...EMPTY_NOTES, spellVersusTrap: "typed" });
  // Bad settings, seed and status come out as null, never echoed.
  const bad = createPlaytestReport({ scenario: S, cpuLevel: S, seed: S, seedPinned: true, status: S, events, view, cards: lab.cards });
  assert.equal(JSON.stringify(bad).includes(S), false);
  assert.deepEqual([bad.scenario, bad.wizardCpu, bad.seed, bad.match, bad.metrics.publicEvents], [null, null, null, null, 0]);
  assert.equal(createPlaytestReport({ scenario: "T1", cpuLevel: "normal", seed: 2 ** 40, seedPinned: true, status: "playing", cards: lab.cards }).seed, null);
  assert.equal(createPlaytestReport({ scenario: "T1", cpuLevel: "normal", seed: 7, seedPinned: false, status: "playing", cards: lab.cards }).seed, null);
});

test("bounded inputs: notes are plain bounded strings; the event list is capped", () => {
  assert.equal(cleanNote(undefined), "");
  assert.equal(cleanNote(42), "");
  assert.equal(cleanNote({ toString: () => "x" }), "");
  assert.equal(cleanNote("  "), "");
  assert.equal(cleanNote("a\r\nb\u0000c\u202Ed\u2028e\tf"), "a\nbcde\tf");
  assert.equal(Array.from(cleanNote("\u{1F920}".repeat(NOTE_MAX + 50))).length, NOTE_MAX);
  assert.equal(cleanNote("x".repeat(10 * NOTE_MAX)).length, NOTE_MAX);
  const r = createPlaytestReport({ notes: { freeform: "y".repeat(5000), pacing: ["array"] } });
  assert.equal(r.humanNotes.freeform.length, NOTE_MAX);
  assert.equal(r.humanNotes.pacing, "");
  const many = Array.from({ length: MAX_EVENTS + 25 }, () => ({ type: "draw", side: "cowboy" }));
  const capped = createPlaytestReport({ scenario: "BASE", cpuLevel: "normal", seed: 0, seedPinned: true, status: "playing", events: many, cards: {}, includeEvents: true });
  assert.equal(capped.publicEvents.length, MAX_EVENTS);
  assert.equal(capped.metrics.publicEvents, MAX_EVENTS);
  assert.equal(capped.eventsTruncated, true);
});

test("session isolation: Start with new settings, Restart, refused Start and Leave each report only the current session", () => {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const session = createLabSession({ scheduler, settings: { scenario: "T1", cpuLevel: "normal" } });
  const now = (notes) => reportOf(session.lab(), { notes });
  assert.equal(session.start("0", { scenario: "T1", cpuLevel: "normal" }), true);
  play(scheduler, session.lab(), () => session.lab().events().filter((e) => e.type === "round-start").length >= 2);
  const first = now();
  assert.ok(first.metrics.roundStart >= 2);
  assert.equal(first.seed, 0);

  // A refused seed with changed settings keeps the match: same report.
  assert.equal(session.start("not-a-seed", { scenario: "FIXTURE", cpuLevel: "hard" }), false);
  const refused = now();
  assert.deepEqual({ ...refused, match: { ...refused.match, status: first.match.status } }, first);

  // Changed settings: a fresh session, equal to a fresh lab's report.
  assert.equal(session.start("60", { scenario: "FIXTURE", cpuLevel: "hard" }), true);
  const fresh = newLab({ scenario: "FIXTURE", cpuLevel: "hard" });
  fresh.lab.controller.start("60");
  assert.deepEqual(now(), reportOf(fresh.lab));
  assert.equal(now().scenario, "FIXTURE");
  assert.equal(now().wizardCpu, "hard");
  assert.equal(now().seed, 60);
  assert.ok(now().metrics.roundStart < first.metrics.roundStart);
  play(scheduler, session.lab(), () => session.lab().events().length > 30);
  const played = now();

  // Restart: same settings and seed, events from the start again.
  session.restart();
  const restarted = now();
  assert.deepEqual(restarted, reportOf(fresh.lab));
  assert.ok(restarted.metrics.publicEvents < played.metrics.publicEvents);

  // Leave: no current match. Settings and typed notes remain; nothing else.
  session.leave();
  const left = now({ freeform: "kept note" });
  assert.equal(left.match, null);
  assert.equal(left.seed, null);
  assert.deepEqual(left.publicEvents, []);
  assert.deepEqual(Object.values(left.metrics).flatMap((v) => (typeof v === "number" ? [v] : Object.values(v))), new Array(10).fill(0));
  assert.equal(left.humanNotes.freeform, "kept note");
  assert.equal(left.scenario, "FIXTURE");
});

// ---- Chrome loopback smoke (DevTools protocol, no dependency) ----

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
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
  const profile = await mkdtemp(path.join(tmpdir(), "kiro-trap-report-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--mute-audio", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}:\n${stderr}`)); });
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
    ws.addEventListener("open", () => resolve({
      send(method, params = {}, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        return new Promise((ok, fail) => waiting.set(id, { resolve: ok, reject: fail, method }));
      },
      on: (listener) => listeners.add(listener),
      close: () => ws.close(),
    }));
  });
}

test("Chrome smoke: T1 seed 0, type a note, click export, read the real download; seed, scenario, redaction, no remote request", { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}` }, async (t) => {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const downloads = await mkdtemp(path.join(tmpdir(), "kiro-trap-report-dl-"));
  const errors = [];
  const requests = [];
  const finished = new Map();
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    cdp.on(({ method, params, sessionId: id }) => {
      if (method === "Browser.downloadWillBegin") finished.set(params.guid, { name: params.suggestedFilename, url: params.url, done: false });
      if (method === "Browser.downloadProgress" && params.state === "completed" && finished.has(params.guid)) finished.get(params.guid).done = true;
      if (id !== sessionId) return;
      if (method === "Network.requestWillBeSent") requests.push(params.request.url);
      if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
      if (method === "Runtime.consoleAPICalled" && params.type === "error") errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
    });
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });
    await send("Network.enable");
    await send("Page.enable");
    await send("Runtime.enable");
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async (expression, ms = 60000) => {
      for (const stop = Date.now() + ms; Date.now() < stop; await sleep(40)) if (await evaluate(expression)) return;
      throw new Error(`timed out: ${expression}`);
    };
    const status = () => evaluate(`document.getElementById("status").textContent`);
    const logText = () => evaluate(`[...document.querySelectorAll("#log li")].map((li) => li.textContent)`);
    // A real mouse click at the centre of the export button.
    const exportReport = async () => {
      const before = finished.size;
      const [x, y] = await evaluate(`(() => { const b = document.getElementById("export-report"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      for (const stop = Date.now() + 20000; Date.now() < stop && !([...finished.values()][before]?.done); ) await sleep(40);
      const entry = [...finished.values()][before];
      assert.ok(entry?.done, "download completed");
      assert.match(entry.url, /^blob:http:\/\/127\.0\.0\.1:/, "a local Blob URL");
      return { name: entry.name, report: JSON.parse(await readFile(path.join(downloads, entry.name), "utf8")) };
    };

    await send("Page.navigate", { url: `${origin}/experiments/trap-placeholder/index.html` });
    await wait(`/^Status: (accepting_input|cpu_turn)\\./.test(document.getElementById("status")?.textContent)`);
    const ids = ["note-spell-trap", "note-arming", "note-pacing", "note-freeform"];
    assert.deepEqual(await evaluate(`${JSON.stringify(ids)}.map((id) => document.getElementById(id).value)`), ["", "", "", ""], "notes start empty");

    // Choose T1 (script plus change event, as in the #116 smoke) and start seed 0 with the real form submit.
    await evaluate(`(() => { const el = document.getElementById("scenario"); el.value = "T1"; el.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await evaluate(`document.getElementById("seed").value = "0"; document.getElementById("seed-form").requestSubmit()`);
    await wait(`document.getElementById("status").textContent.includes("Seed 0.") && document.getElementById("status").textContent.includes("Scenario T1 ")`);

    // Type a fixed test note with real text input while the match runs.
    await evaluate(`document.getElementById("note-spell-trap").focus()`);
    const NOTE = "Automated smoke test text, not human feedback.";
    await send("Input.insertText", { text: NOTE });
    // End phases until the Wizard has set a trap that has not sprung.
    const open = (lines) => lines.some((l) => l === "Wizard sets a face-down trap.") && !lines.some((l) => l.startsWith("Wizard trap springs"));
    for (let moves = 0; !open(await logText()); moves++) {
      assert.ok(moves < 30, "Wizard never set a trap");
      await wait(`/^Status: (accepting_input|terminal)\\./.test(document.getElementById("status").textContent)`);
      if ((await status()).startsWith("Status: terminal.")) break;
      if (open(await logText())) break;
      await evaluate(`document.getElementById("end-phase").click()`);
      await sleep(60);
    }
    assert.ok(open(await logText()), "a set, unsprung Wizard trap");
    await wait(`/^Status: (accepting_input|terminal)\\./.test(document.getElementById("status").textContent)`);
    assert.equal(await evaluate(`document.activeElement.id`), "note-spell-trap", "focus stayed in the note");

    const first = await exportReport();
    assert.equal(first.name, "trap-playtest-T1-normal-seed-0.json");
    assert.equal(first.report.source, "synthetic-developer-lab");
    assert.equal(first.report.scenario, "T1");
    assert.equal(first.report.wizardCpu, "normal");
    assert.equal(first.report.seed, 0);
    assert.deepEqual(first.report.humanNotes, { ...EMPTY_NOTES, spellVersusTrap: NOTE });
    assert.equal(first.report.metrics.trapSet.wizard, 1);
    assert.equal(first.report.metrics.trapTrigger.wizard, 0);
    assert.equal(first.report.metrics.publicEvents, (await logText()).length, "one exported event per log line");
    const text = JSON.stringify(first.report);
    for (const id of WIZARD_TRAP_IDS) assert.equal(text.includes(id), false, `${id} in the export before it sprang`);
    assert.equal(text.includes(origin), false, "no URL or path in the report");

    // Play on to the end and export again: the result and any public trigger.
    for (let moves = 0; !(await status()).startsWith("Status: terminal."); moves++) {
      assert.ok(moves < 80, "no result");
      await wait(`/^Status: (accepting_input|terminal)\\./.test(document.getElementById("status").textContent)`);
      if ((await status()).startsWith("Status: terminal.")) break;
      await evaluate(`document.getElementById("end-phase").click()`);
      await sleep(60);
    }
    const second = await exportReport();
    assert.equal(second.report.match.status, "terminal");
    assert.match(await status(), new RegExp(`Result: ${second.report.match.result.outcome} \\(${second.report.match.result.reason}\\)`));
    const triggers = second.report.publicEvents.filter((e) => e.type === "trap-trigger" && e.side === "wizard");
    assert.equal(triggers.length, second.report.metrics.trapTrigger.wizard);
    assert.ok(triggers.every((e) => WIZARD_TRAP_IDS.includes(e.cardId)));

    // Leave: notes kept, no match exported. Clear notes empties them.
    await evaluate(`document.getElementById("leave").click()`);
    const third = await exportReport();
    assert.equal(third.report.match, null);
    assert.equal(third.report.seed, null);
    assert.equal(third.report.humanNotes.spellVersusTrap, NOTE);
    await evaluate(`document.getElementById("clear-notes").click()`);
    assert.deepEqual(await evaluate(`${JSON.stringify(ids)}.map((id) => document.getElementById(id).value)`), ["", "", "", ""]);

    const remote = requests.filter((u) => !u.startsWith(`${origin}/`) && !u.startsWith("blob:") && !u.startsWith("data:"));
    assert.deepEqual(remote, [], "no request outside the loopback server");
    assert.deepEqual(await evaluate(`[document.cookie, localStorage.length, sessionStorage.length]`), ["", 0, 0]);
    assert.deepEqual(errors, [], "no runtime exception or console error");
    t.diagnostic(`${(await cdp.send("Browser.getVersion")).product}; downloads ${(await readdir(downloads)).length}; requests ${requests.length} (all ${origin} or blob:); first export: events ${first.report.metrics.publicEvents}, Wizard sets ${first.report.metrics.trapSet.wizard}, Wizard triggers ${first.report.metrics.trapTrigger.wizard}; final: ${second.report.match.result.outcome} (${second.report.match.result.reason}) round ${second.report.match.result.round}, Wizard triggers ${second.report.metrics.trapTrigger.wizard}`);
  } finally {
    cdp.close();
    await chrome.close();
    server.close();
    await rm(downloads, { recursive: true, force: true });
  }
});
