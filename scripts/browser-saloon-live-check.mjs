// Night Shift saloon live witness: does a real Kiro hook record reach the opted-in live Saloon on a fresh loopback page?
//   node scripts/build-graybox.mjs --diorama
//   node scripts/browser-saloon-live-check.mjs [outDir] [--samples 3] [--wait 180] [--target 2000]
// Serves dist/cowboys-vs-wizards-showdown-3d.html with the existing loopback server (scripts/night-shift-saloon.mjs)
// on this checkout's journal, and drives a fresh headless Chrome profile over the DevTools protocol.
//   1. Public view: the loopback page without ?saloon=live, saloon open for 7 s: no /night-shift/events request.
//      The same build as a file: page with ?saloon=live ("recorded-only"): no request either.
//   2. Native live: http://127.0.0.1:<port>/?saloon=live, Camp, Night Shift saloon. When the room says "watching",
//      this prints READY and waits for PostFileCreate records newer than READY. This script writes none: they come
//      from the Kiro hooks (.kiro/hooks/night-shift-activity.json) when the agent's own write tool creates a new
//      file. For each: the first poll that carried it, the first change on that actor's portrait after that poll
//      (stir class or ambient line), and the next animation frame. Latency = that frame's wall time - the record's `at`.
//   3. Privacy: every activity record in every poll body has only id, at, kind, actor, phase; the saloon's text and
//      the poll bodies contain no scratch file name or content (.artifacts/saloon-live-witness/scratch/*) and no tool name.
//   4. Cadence: with document.visibilityState emulated as hidden, then with the room closed.
//   5. Fixture (synthetic, labelled): a temporary root with a copy of the build; this script writes one
//      hunter/PreTaskExecution record there through recordActivity. Never written to the real journal.
// Writes receipt.json and saloon-live.png to outDir (default .artifacts/saloon-live-witness).
// Scripted Chrome supports claims about requests, DOM text and timing, not about appearance or clarity.
import {execFileSync, spawn} from "node:child_process";
import {copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {startSaloon} from "./night-shift-saloon.mjs";
import {readActivity, recordActivity} from "./saloon-journal.mjs";
import {activityLabel} from "../src/ui/night-shift-presence.js";
import {LIVE_LABEL, LIVE_POLL_MS, POLL_MS, RECORDED_LABEL, pollDelay} from "../src/ui/showdown-3d/night-shift-saloon.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BUILD = path.join(ROOT, "dist", "cowboys-vs-wizards-showdown-3d.html");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
const flagValues = new Set(["--samples", "--wait", "--target"].flatMap((n) => { const i = args.indexOf(n); return i >= 0 ? [i, i + 1] : []; }));
const OUT = path.resolve(args.find((a, i) => !a.startsWith("--") && !flagValues.has(i)) ?? ".artifacts/saloon-live-witness");
const SAMPLES = flag("--samples", 3), WAIT_S = flag("--wait", 180), TARGET_MS = flag("--target", 2000);
const SCRATCH = path.join(ROOT, ".artifacts", "saloon-live-witness", "scratch");
const git = (...a) => { try { return execFileSync("git", ["-C", ROOT, ...a], {encoding: "utf8"}).trim(); } catch { return null; } };
mkdirSync(OUT, {recursive: true});
mkdirSync(SCRATCH, {recursive: true});

const report = {schema: "saloon-live-witness/1", revision: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain", "--", "src", "scripts"),
  pollMsConstant: POLL_MS, livePollMsConstant: LIVE_POLL_MS, targetMs: TARGET_MS, samplesWanted: SAMPLES, phases: {}, checks: [], exceptions: []};
const check = (name, ok, detail) => {
  report.checks.push({name, pass: Boolean(ok), ...(detail === undefined ? {} : {detail})});
  console.log(`${ok ? "ok  " : "FAIL"} - ${name}`);
  return ok;
};

// ---- Chrome (same launcher and protocol client as scripts/browser-showdown-singularity.mjs) ---------------
async function launchChrome() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "kiro-saloon-live-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    `--window-size=${WIDTH},${HEIGHT}`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL from Chrome in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}:\n${stderr}`)); });
  });
  return {url, async close() {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await Promise.race([exited, sleep(5000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await rm(profile, {recursive: true, force: true, maxRetries: 5});
  }};
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const waiting = new Map(), listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({data}) => {
      const message = JSON.parse(data);
      if (message.id === undefined) { for (const listener of listeners) listener(message); return; }
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) entry?.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry?.resolve(message.result);
    });
    ws.addEventListener("error", () => reject(new Error(`WebSocket error on ${url}`)));
    ws.addEventListener("open", () => resolve({
      send(method, params = {}, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
        return new Promise((ok, fail) => waiting.set(id, {resolve: ok, reject: fail, method}));
      },
      on: (listener) => listeners.add(listener),
      close: () => ws.close(),
    }));
  });
}

// Instrumentation installed before the page's own scripts: a fetch wrapper that copies each feed response
// (the app reads the original), and, once the saloon room exists, a MutationObserver on its actor portraits.
const INSTRUMENT = `(() => {
  const w = window.__witness = {polls: [], marks: []};
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    const started = Date.now();
    const response = await original(input, init);
    if (url.includes("/night-shift/events")) {
      const entry = {started, received: Date.now(), status: response.status, activity: [], body: ""};
      w.polls.push(entry);
      response.clone().text().then((text) => {
        entry.body = text;
        try { entry.activity = (JSON.parse(text).activity || []).map((a) => a.id); } catch {}
      });
    }
    return response;
  };
  w.observe = () => {
    const list = document.querySelector("#room-for-night-shift-saloon .saloon-actors");
    if (!list || w.observer) return Boolean(list);
    w.observer = new MutationObserver((records) => {
      const t = Date.now();
      const changed = new Map();
      for (const r of records) {
        const item = (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest(".saloon-actor");
        if (!item) continue;
        const actor = item.dataset.actor;
        const stir = r.type === "attributes" && r.target === item && item.classList.contains("is-stirring") && !String(r.oldValue || "").includes("is-stirring");
        const text = r.type !== "attributes";
        if (!stir && !text) continue;
        const entry = changed.get(actor) || {actor, stir: false, text: false};
        entry.stir ||= stir; entry.text ||= text;
        changed.set(actor, entry);
      }
      for (const entry of changed.values()) {
        const note = list.querySelector('.saloon-actor-' + entry.actor + ' .saloon-actor-ambient');
        const box = note.getBoundingClientRect();
        const mark = {...entry, t, ambient: note.textContent, title: note.title,
          visible: box.width > 0 && box.height > 0 && getComputedStyle(note).visibility !== "hidden" && Boolean(note.offsetParent)};
        w.marks.push(mark);
        requestAnimationFrame(() => { mark.frame = Date.now(); });
      }
    });
    w.observer.observe(list, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true});
    return true;
  };
})()`;

async function openPage(cdp, url, requests) {
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Network.requestWillBeSent" && params.request.url.includes("/night-shift/events")) requests.push(Date.now());
    if (method === "Runtime.exceptionThrown") report.exceptions.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
  });
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
  await send("Page.addScriptToEvaluateOnNewDocument", {source: INSTRUMENT});
  await send("Page.navigate", {url});
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 20000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(100); }
    throw new Error(`Timed out: ${expression}`);
  };
  // Play, then the Camp's Night Shift saloon button, as a visitor would.
  const enterSaloon = async () => {
    await wait(`document.readyState === "complete" && document.querySelector("#menu-play")`);
    await evaluate(`document.querySelector("#menu-play").click()`);
    await wait(`!document.getElementById("showdown-camp").hidden && document.querySelector('[data-camp-destination="night-shift-saloon"]')`);
    await evaluate(`document.querySelector('[data-camp-destination="night-shift-saloon"]').click()`);
    await wait(`document.querySelector("#room-for-night-shift-saloon")?.open && window.__witness.observe()`);
  };
  const roomState = () => evaluate(`(() => { const r = document.querySelector("#room-for-night-shift-saloon");
    return {label: r.querySelector(".saloon-mode-label").textContent, progress: r.querySelector(".saloon-progress").textContent,
      now: r.querySelector(".saloon-now").textContent, view: r.querySelector(".saloon-room").dataset.view}; })()`);
  return {send, evaluate, wait, enterSaloon, roomState, close: () => cdp.send("Target.closeTarget", {targetId})};
}

// Pairs each wanted record with the first poll that carried it and the first change on its actor after that poll.
function witness(records, polls, marks) {
  return records.map((record) => {
    const index = polls.findIndex((p) => p.activity.includes(record.id));
    const poll = polls[index];
    const nextPoll = polls[index + 1];
    const mark = poll && marks.find((m) => m.actor === record.actor && m.t >= poll.received);
    const attributed = Boolean(mark && (!nextPoll || mark.t < nextPoll.received));
    const atMs = Date.parse(record.at);
    // What the room should show for this poll: the actor's latest record in that response, through the shared label.
    const shownRecord = poll ? latestFor(record.actor, poll) : null;
    return {
      id: record.id, at: record.at, actor: record.actor, phase: record.phase, label: activityLabel(record),
      pollStarted: poll?.started ?? null, pollReceived: poll?.received ?? null, pollsBefore: index,
      markAt: mark?.t ?? null, frameAt: mark?.frame ?? null, stir: mark?.stir ?? null, ambient: mark?.ambient ?? null,
      visible: mark?.visible ?? null, attributed,
      shownPhase: shownRecord?.phase ?? null, shownMatches: Boolean(mark && shownRecord && mark.ambient === activityLabel(shownRecord)),
      journalToPollMs: poll ? poll.received - atMs : null,
      journalToVisibleMs: mark?.frame ? mark.frame - atMs : null,
    };
  });
}
function latestFor(actor, poll) {
  try {
    const list = JSON.parse(poll.body).activity.filter((a) => a.actor === actor);
    return list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1)).at(-1) ?? null;
  } catch { return null; }
}

function scratchCanaries() {
  const canaries = ["fs_write", "str_replace", "tool_input", "toolInput", "scratch", ".artifacts", os.homedir()];
  for (const name of readdirSync(SCRATCH)) {
    canaries.push(name, path.parse(name).name);
    for (const line of readFileSync(path.join(SCRATCH, name), "utf8").split("\n")) if (line.trim().length >= 8) canaries.push(line.trim());
  }
  return [...new Set(canaries)];
}

const intervals = (times) => times.slice(1).map((t, i) => t - times[i]);
const stats = (values) => {
  const sorted = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {n: sorted.length, min: sorted[0], median: sorted[Math.floor((sorted.length - 1) / 2)], max: sorted.at(-1)};
};

// ---- Run -------------------------------------------------------------------------------------------------
{
  const cases = [["live", "visible", LIVE_POLL_MS], ["live", "hidden", POLL_MS], ["live", undefined, POLL_MS],
    ["recorded", "visible", POLL_MS], ["recorded-only", "visible", POLL_MS]];
  const got = cases.map(([mode, visibilityState]) => pollDelay(mode, visibilityState === undefined ? undefined : {visibilityState}));
  check(`pollDelay: ${LIVE_POLL_MS} ms only for live + visible; ${POLL_MS} ms for hidden, unknown and non-live`,
    got.every((ms, i) => ms === cases[i][2]), cases.map(([m, v], i) => `${m}/${v}: ${got[i]}`));
}
const saloon = await startSaloon({root: ROOT, port: 0});
const origin = `http://127.0.0.1:${saloon.port}`;
const chrome = await launchChrome();
const cdp = await connect(chrome.url);
let failure = null;
let fixtureRoot = null, fixtureSaloon = null;
try {
  // 1. Public views.
  {
    const requests = [];
    const page = await openPage(cdp, `${origin}/`, requests);
    await page.enterSaloon();
    await sleep(7000);
    const state = await page.roomState();
    report.phases.public = {url: `${origin}/`, state, feedRequests: requests.length};
    check("public loopback page (no ?saloon=live): 0 feed requests in 7 s with the saloon open, recorded label",
      requests.length === 0 && state.label === RECORDED_LABEL, report.phases.public);
    await page.close();
  }
  {
    const requests = [];
    const url = `${pathToFileURL(BUILD).href}?saloon=live`;
    const page = await openPage(cdp, url, requests);
    await page.enterSaloon();
    await sleep(7000);
    const state = await page.roomState();
    report.phases.recordedOnly = {url: "file:…/dist/cowboys-vs-wizards-showdown-3d.html?saloon=live", state, feedRequests: requests.length};
    check("file: page with ?saloon=live: 0 feed requests in 7 s, recorded label (recorded-only mode)",
      requests.length === 0 && state.label === RECORDED_LABEL, report.phases.recordedOnly);
    await page.close();
  }

  // 2. Native live.
  const requests = [];
  const live = await openPage(cdp, `${origin}/?saloon=live`, requests);
  await live.enterSaloon();
  await live.wait(`document.querySelector("#room-for-night-shift-saloon .saloon-progress").textContent.includes("watching")`);
  const readyAt = new Date().toISOString();
  writeFileSync(path.join(OUT, "ready.json"), `${JSON.stringify({readyAt, url: `${origin}/?saloon=live`}, null, 2)}\n`);
  console.log(`READY ${readyAt} ${origin}/?saloon=live (waiting up to ${WAIT_S} s for ${SAMPLES} PostFileCreate records)`);
  const fresh = () => readActivity(ROOT, 192).filter((r) => r.at > readyAt);
  const stopAt = Date.now() + WAIT_S * 1000;
  while (Date.now() < stopAt) {
    const creates = fresh().filter((r) => r.phase === "PostFileCreate");
    if (creates.length >= SAMPLES && Date.now() - Date.parse(creates.at(-1).at) > Math.max(POLL_MS, 3000) + 2000) break;
    await sleep(250);
  }
  const endedAt = new Date().toISOString();
  const page = await live.evaluate(`({polls: window.__witness.polls, marks: window.__witness.marks})`);
  const state = await live.roomState();
  const shot = await live.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(path.join(OUT, "saloon-live.png"), Buffer.from(shot.data, "base64"));
  const all = fresh().filter((r) => r.at <= endedAt);
  const creates = all.filter((r) => r.phase === "PostFileCreate");
  const samples = witness(creates, page.polls, page.marks);
  const everyRecord = witness(all, page.polls, page.marks);
  const windowPolls = page.polls.filter((p) => p.started >= Date.parse(readyAt));
  report.phases.live = {url: `${origin}/?saloon=live`, readyAt, endedAt, state,
    journalRecordsInWindow: all.length, phasesInWindow: Object.fromEntries([...new Set(all.map((r) => r.phase))].map((p) => [p, all.filter((r) => r.phase === p).length])),
    postFileCreate: creates.length, polls: windowPolls.length,
    pollIntervalsMs: stats(intervals(windowPolls.map((p) => p.started))), pollRoundTripMs: stats(windowPolls.map((p) => p.received - p.started)),
    samples, everyRecordLatencyMs: stats(everyRecord.map((r) => r.journalToVisibleMs)),
    recordsWithNoChangeAfterPoll: everyRecord.filter((r) => r.pollReceived && !r.markAt).length, screenshot: "saloon-live.png"};
  check(`live room on ${origin}/?saloon=live shows "${LIVE_LABEL}" and is watching`, state.label === LIVE_LABEL && state.progress.includes("watching"), state);
  check(`native: ${creates.length} PostFileCreate records from the agent's write tool after READY (wanted ${SAMPLES})`, creates.length >= SAMPLES,
    {count: creates.length});
  const seen = samples.filter((s) => s.attributed && s.visible && s.shownMatches && s.frameAt);
  check(`native: ${seen.length} of ${samples.length} rendered on the actor's visible portrait with that poll's actor and phase line`,
    samples.length > 0 && seen.length === samples.length, samples.map((s) => ({id: s.id, ambient: s.ambient, shownPhase: s.shownPhase, ms: s.journalToVisibleMs})));
  check(`native: journal at -> first visible change <= ${TARGET_MS} ms for every sample`,
    seen.length > 0 && seen.length === samples.length && seen.every((s) => s.journalToVisibleMs <= TARGET_MS), stats(samples.map((s) => s.journalToVisibleMs)));
  const visibleGaps = intervals(windowPolls.map((p) => p.started));
  check(`visible live room: ${visibleGaps.length} poll gaps, none shorter than LIVE_POLL_MS ${LIVE_POLL_MS} ms`,
    visibleGaps.length > 0 && visibleGaps.every((g) => g >= LIVE_POLL_MS - 50), stats(visibleGaps));

  // 3. Privacy: poll bodies hold only the allowlisted fields; no scratch name, content or tool name anywhere shown.
  const canaries = scratchCanaries();
  const roomText = await live.evaluate(`(() => { const r = document.querySelector("#room-for-night-shift-saloon");
    return [r.textContent, ...[...r.querySelectorAll("[title]")].map((e) => e.title), ...[...r.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"))].join("\\n"); })()`);
  const bodies = page.polls.map((p) => p.body);
  const extraKeys = new Set();
  for (const body of bodies) {
    try { for (const a of JSON.parse(body).activity) for (const k of Object.keys(a)) if (!["id", "at", "kind", "actor", "phase"].includes(k)) extraKeys.add(k); } catch { extraKeys.add("<unparsed body>"); }
  }
  const leaks = canaries.filter((c) => roomText.includes(c) || bodies.some((b) => b.includes(c)));
  report.phases.privacy = {canaryCount: canaries.length, scratchFiles: readdirSync(SCRATCH).length, bodiesChecked: bodies.length, extraKeys: [...extraKeys], leaks};
  check(`privacy: ${bodies.length} poll bodies carry only id/at/kind/actor/phase activity fields`, extraKeys.size === 0, [...extraKeys]);
  check(`privacy: none of ${canaries.length} canaries (scratch names, contents, tool names, paths) in the room or the feed`, leaks.length === 0, leaks);

  // 4. Cadence while the page reports hidden (emulated by overriding visibilityState), then with the room closed.
  const hiddenFrom = Date.now();
  await live.evaluate(`(() => { Object.defineProperty(document, "visibilityState", {get: () => "hidden", configurable: true});
    Object.defineProperty(document, "hidden", {get: () => true, configurable: true}); document.dispatchEvent(new Event("visibilitychange")); return true; })()`);
  await sleep(Math.max(POLL_MS, 3000) * 3 + 1500);
  const hiddenTimes = requests.filter((t) => t >= hiddenFrom);
  const hiddenGaps = intervals(hiddenTimes);
  await live.evaluate(`(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); return true; })()`);
  report.phases.hidden = {emulated: true, requests: hiddenTimes.length, intervalsMs: hiddenGaps};
  check(`hidden page (emulated): poll gaps never shorter than POLL_MS ${POLL_MS} ms`, hiddenGaps.length > 0 && hiddenGaps.every((g) => g >= POLL_MS - 50), hiddenGaps);
  await live.evaluate(`document.querySelector("#room-for-night-shift-saloon > header button").click()`);
  const closedFrom = Date.now();
  await sleep(7000);
  const closedCount = requests.filter((t) => t > closedFrom + 100).length;
  report.phases.closed = {requests: closedCount, windowMs: 7000};
  check("room closed: 0 feed requests in 7 s", closedCount === 0, report.phases.closed);
  await live.close();

  // 5. Fixture (synthetic, temporary root; the real journal is untouched).
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "kiro-saloon-fixture-"));
  mkdirSync(path.join(fixtureRoot, "dist"));
  copyFileSync(BUILD, path.join(fixtureRoot, "dist", path.basename(BUILD)));
  fixtureSaloon = await startSaloon({root: fixtureRoot, port: 0});
  const fixtureRequests = [];
  const fixture = await openPage(cdp, `http://127.0.0.1:${fixtureSaloon.port}/?saloon=live`, fixtureRequests);
  await fixture.enterSaloon();
  await fixture.wait(`document.querySelector("#room-for-night-shift-saloon .saloon-progress").textContent.includes("watching")`);
  await sleep(500);
  const written = recordActivity(fixtureRoot, {kind: "activity", actor: "hunter", phase: "PreTaskExecution"});
  await fixture.wait(`window.__witness.marks.some((m) => m.actor === "hunter" && m.frame)`, Math.max(POLL_MS, 3000) + 5000);
  const fixturePage = await fixture.evaluate(`({polls: window.__witness.polls, marks: window.__witness.marks})`);
  const [fixtureSample] = witness([written], fixturePage.polls, fixturePage.marks);
  report.phases.fixture = {synthetic: true, root: "<temporary directory, removed>", record: written, sample: fixtureSample};
  check("fixture (synthetic): hunter/PreTaskExecution shows \"Hunter sees a task start\"",
    fixtureSample.attributed && fixtureSample.ambient === "Hunter sees a task start", fixtureSample);
  await fixture.close();
} catch (error) {
  failure = error;
  report.error = error.stack ?? String(error);
  console.error(error);
} finally {
  cdp.close();
  await chrome.close();
  saloon.server.close();
  fixtureSaloon?.server.close();
  if (fixtureRoot) await rm(fixtureRoot, {recursive: true, force: true});
}
report.pass = !failure && report.checks.every((c) => c.pass);
writeFileSync(path.join(OUT, "receipt.json"), `${JSON.stringify(report, null, 2)}\n`);
const passed = report.checks.filter((c) => c.pass).length;
console.log(`${passed} of ${report.checks.length} checks passed${failure ? " (stopped by an error)" : ""}; receipt ${path.relative(process.cwd(), path.join(OUT, "receipt.json"))}`);
process.exitCode = report.pass ? 0 : 1;
