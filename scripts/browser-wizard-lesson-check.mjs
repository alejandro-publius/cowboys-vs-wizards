// Wizard lesson browser check: the learner path of src/ui/wizard-lesson.js in installed Chrome, on the staged Pages
// files at the paths the site serves them. QA instrumentation only: it changes no src/ file, trains nothing, calls no
// model and rewrites no build or build manifest. It writes only under --out (default .artifacts/wizard-lesson-browser/).
//
//   node scripts/stage-pages.mjs            # or reuse a dist/web/ staged after the last lesson source change
//   npx -y -p playwright-core@1.64.1 node scripts/browser-wizard-lesson-check.mjs [--dist dist/web] [--out DIR]
//       [--routes graybox,root,3d] [--only native,fixture,after-duel] [--chrome PATH] [--allow-stale]
//
// Routes (each served on loopback from the staged file of that path, so the label is the route actually tested):
//   graybox  /graybox/  dist/web/graybox/index.html  lightweight graybox (src/app.js, __CVW_DIORAMA__ false)
//   root     /          dist/web/index.html          illustrated Showdown (src/app.js + src/ui/showdown-3d)
//   3d       /3d/       dist/web/3d/index.html       compatibility copy of /
// Lesson entry on every route: the Camp control #camp-wizard-lesson ("Open saved Wizard lesson"), and ?lesson=saved.
// On /graybox/ that control sits in the Camp's Experiment section after Play; on / and /3d/ the Camp outpost moves the
// Experiment section into the Practice room, under the collapsed "Challenge replays".
//
// Checks, each in a fresh Chrome context with reduced motion and a fixed Math.random:
//   native      the native Kiro inputs as they are: .artifacts/wizard-lesson/native-bait-episode.json and
//               native-training-receipt.json (status "pending"). Open the episode file, pick and mark the move, export
//               it (download compared with the input), import the pending receipt: the page must show it Rejected,
//               keep the opt-in disabled and the rematch Wizard original. Rematch the deal, replay the episode's
//               Cowboy moves by clicking, see the original Wizard's Hellfire, finish, Back to the lesson, reload at
//               ?lesson=saved, then opt out with Forget this lesson. Escape steps back to the Camp.
//   fixture     SIMULATED: a receipt from scripts/wizard-lesson/fixture.mjs for the same episode, written to --out with
//               its fixture: "simulated" marker and simulated-* run ids intact. The page must label it as a simulated
//               fixture. Opt-in off: original Wizard; opt-in on: the lesson Wizard; opt-in is not stored. A non-receipt
//               file leaves the lesson unchanged. This is not evidence that any native Kiro lesson exists.
//   after-duel  a synthetic Trail-complete Cowboy save (nobody's data), Open range (level-2 Wizard) at ?seed=7, lost
//               by ending every turn: the result offers "Review a Wizard move", which opens the lesson with that duel.
// Scripted Chrome: no human played. It says nothing about clarity, difficulty felt or fun.
// Exit 0 when every check passes, 1 on a failed check, 2 on bad arguments or a stale or missing staged page,
// 3 when Playwright or Chrome is unavailable.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, statSync} from "node:fs";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {newSave} from "../src/game/showdown/progress.js";
import {TRAIL} from "../src/game/showdown/trail.js";
import {episodeKey, validateEpisode} from "../src/game/showdown/wizard-lesson-policy.js";
import {PLAYTEST_KEY} from "../src/match/showdown-playtest.js";
import {STORE_KEY} from "../src/ui/wizard-lesson.js";
import {simulatedLesson, simulatedReceipt} from "./wizard-lesson/fixture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const NATIVE_EPISODE = ".artifacts/wizard-lesson/native-bait-episode.json";
const NATIVE_RECEIPT = ".artifacts/wizard-lesson/native-training-receipt.json";
// The sources whose change makes a staged page stale for this check.
const LESSON_SOURCES = ["src/app.js", "src/ui/wizard-lesson.js", "src/ui/showdown-screen.js", "src/game/showdown/wizard-lesson-policy.js",
  "src/ui/showdown-3d/camp-outpost.js", "src/ui/graybox.html"];
const ROUTES = {
  graybox: {path: "/graybox/", file: "graybox/index.html", build: "graybox (src/app.js, no diorama)", illustrated: false},
  root: {path: "/", file: "index.html", build: "illustrated Showdown (src/app.js + src/ui/showdown-3d)", illustrated: true},
  "3d": {path: "/3d/", file: "3d/index.html", build: "illustrated Showdown, /3d/ compatibility copy", illustrated: true},
};
const CHECKS = ["native", "fixture", "after-duel"];
const MAX_TURNS = 80;
const USAGE = `usage: node scripts/browser-wizard-lesson-check.mjs [--dist dist/web] [--out DIR] [--routes ${Object.keys(ROUTES).join(",")}]
  [--only ${CHECKS.join(",")}] [--chrome PATH] [--allow-stale]
Run with playwright-core available, e.g. npx -y -p playwright-core@1.64.1 node scripts/browser-wizard-lesson-check.mjs`;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (...args) => { try { return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch { return null; } };
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v));
const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
// The lesson page shows one line per action (its events' presenter texts joined by a space); the duel log shows one
// line per event. True when some run of consecutive log lines reads exactly as that action's line.
const logHas = (log, text) => Boolean(text) && log.some((_, i) => {
  for (let j = i, joined = ""; j < log.length && joined.length < text.length; j++) {
    joined = joined ? `${joined} ${log[j]}` : log[j];
    if (joined === text) return true;
  }
  return false;
});

function parseArgs(argv) {
  const opts = {dist: "dist/web", out: ".artifacts/wizard-lesson-browser", routes: Object.keys(ROUTES), only: CHECKS, chrome: process.env.CHROME_PATH ?? DEFAULT_CHROME, allowStale: false};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--allow-stale") { opts.allowStale = true; continue; }
    if (!["--dist", "--out", "--routes", "--only", "--chrome"].includes(flag) || i + 1 >= argv.length) throw new Error(`bad flag ${flag}`);
    const value = argv[++i];
    if (flag === "--routes" || flag === "--only") {
      const list = value.split(",").filter(Boolean), allowed = flag === "--routes" ? Object.keys(ROUTES) : CHECKS;
      const bad = list.filter((x) => !allowed.includes(x));
      if (bad.length || !list.length) throw new Error(`${flag} takes ${allowed.join(",")}`);
      opts[flag.slice(2)] = list;
    } else opts[flag.slice(2)] = value;
  }
  const out = path.resolve(root, opts.out);
  if (!out.startsWith(path.join(root, ".artifacts") + path.sep)) throw new Error("--out must be under .artifacts/");
  return {...opts, out};
}

async function loadChromium() {
  for (const name of ["playwright", "playwright-core"]) {
    try { return (await import(name)).chromium; } catch { /* next */ }
  }
  const tryFrom = (base) => { try { return createRequire(base)("playwright-core").chromium; } catch { return null; } };
  const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
  return (bin && tryFrom(pathToFileURL(path.join(bin, "..", "x.js")))) || null;
}

// ---- Inputs: native files as they are, and the SIMULATED fixture --------------------------------------------------
async function inputs(out) {
  const [episodeText, receiptText] = await Promise.all([readFile(path.join(root, NATIVE_EPISODE)), readFile(path.join(root, NATIVE_RECEIPT))]);
  const episode = validateEpisode(JSON.parse(episodeText));
  const receipt = JSON.parse(receiptText);
  const key = episodeKey(episode);
  const fixture = simulatedLesson(episode);
  const simulated = fixture.none ? null : simulatedReceipt(fixture, key);
  const fixturePath = path.join(out, "simulated-fixture-receipt.json");
  if (simulated) {
    if (simulated.fixture !== "simulated" || !simulated.runs.every((run) => run.runId.startsWith("simulated-"))) throw new Error("fixture.mjs receipt lost its simulated markers");
    await writeFile(fixturePath, `${JSON.stringify(simulated, null, 2)}\n`);
  }
  return {
    episode, key, episodePath: path.join(root, NATIVE_EPISODE), receiptPath: path.join(root, NATIVE_RECEIPT), receipt,
    fixturePath: simulated ? fixturePath : null,
    summary: {
      nativeEpisode: {path: NATIVE_EPISODE, sha256: sha256(episodeText), episodeKey: key, markedIndex: episode.markedIndex, actions: episode.actions.length},
      nativeReceipt: {path: NATIVE_RECEIPT, sha256: sha256(receiptText), schema: receipt.schema, status: receipt.status, episodeKey: receipt.episodeKey,
        keyMatchesEpisode: receipt.episodeKey === key, reasons: receipt.reasons ?? [], runs: (receipt.runs ?? []).map((r) => ({role: r.role, runId: r.runId, exit: r.exit, error: r.error}))},
      fixture: simulated ? {status: "SIMULATED (scripts/wizard-lesson/fixture.mjs; no Kiro run, no model)", path: path.relative(root, fixturePath),
        marker: simulated.fixture, runIds: simulated.runs.map((r) => r.runId), sha256: sha256(`${JSON.stringify(simulated, null, 2)}\n`)}
        : {status: "none: fixture.mjs found no simulated lesson for this episode in seeds 0-200"},
    },
  };
}

// ---- Staged pages ------------------------------------------------------------------------------------------------
function stagedPages(dist, routes) {
  const newestSource = Math.max(...LESSON_SOURCES.map((f) => statSync(path.join(root, f)).mtimeMs));
  return routes.map((id) => {
    const {file, ...route} = ROUTES[id];
    const abs = path.resolve(root, dist, file);
    if (!existsSync(abs)) return {id, ...route, file: path.relative(root, abs), missing: true};
    const stat = statSync(abs);
    return {id, ...route, file: path.relative(root, abs), abs, mtime: stat.mtime.toISOString(), stale: stat.mtimeMs < newestSource};
  });
}

async function serve(pages) {
  const bodies = new Map();
  for (const p of pages) {
    const html = await readFile(p.abs);
    p.sha256 = sha256(html);
    const text = html.toString("utf8");
    // lessonCss: whether src/ui/showdown-3d/wizard-lesson.css (or any .wl- rule) was bundled into the page's <style>.
    const style = text.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "";
    p.markers = {lessonStoreKey: text.includes(STORE_KEY), campLessonControl: text.includes("camp-wizard-lesson"), webgl: /WebGLRenderer/.test(text),
      lessonCss: /\.wizard-lesson\b|\.wl-[a-z]/.test(style)};
    bodies.set(p.path, html);
    bodies.set(`${p.path}index.html`, html);
  }
  const server = createServer((req, res) => {
    const {pathname} = new URL(req.url, "http://127.0.0.1");
    const body = req.method === "GET" && bodies.get(pathname);
    if (body) { res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}); res.end(body); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok))};
}

// One fresh context. planted: localStorage written before the page's first script, on the first load only.
async function open(browser, base, route, {planted = {}, downloads} = {}) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: "reduce", acceptDownloads: Boolean(downloads)});
  await ctx.addInitScript(({planted}) => {
    let s = 1; // mulberry32: the same fresh deals on every run
    Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    if (!sessionStorage.getItem("qa-planted")) {
      localStorage.clear();
      for (const [k, v] of Object.entries(planted)) localStorage.setItem(k, v);
      sessionStorage.setItem("qa-planted", "1");
    }
  }, {planted});
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await ctx.route("**/*", (r) => {
    const url = r.request().url();
    if (url.startsWith(base + "/") || /^(data:|blob:|about:)/.test(url)) return r.continue();
    remote.push(url); return r.abort();
  });
  const go = async (query = "") => {
    await page.goto(`${base}${route.path}${query}`);
    await page.waitForFunction(() => document.readyState === "complete" && document.getElementById("menu-play") && document.getElementById("wizard-lesson"));
  };
  const store = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  const saved = async () => { const raw = (await store())[STORE_KEY]; return raw === undefined ? null : JSON.parse(raw); };
  return {ctx, page, errors, remote, go, store, saved};
}

// ---- Page reads (DOM only) ---------------------------------------------------------------------------------------
const lessonView = (page) => page.evaluate(() => {
  const r = document.getElementById("wizard-lesson"), q = (s) => r?.querySelector(s);
  const status = q(".wl-status");
  const optin = q("#wl-optin");
  return {visible: Boolean(r && !r.hidden && r.getClientRects().length), duelVisible: !document.getElementById("showdown").hidden,
    message: q("#wl-message")?.textContent.trim() ?? null,
    moves: [...(r?.querySelectorAll(".wl-move") ?? [])].map((b) => ({pick: Number(b.dataset.pick), pressed: b.getAttribute("aria-pressed") === "true", text: b.textContent.trim()})),
    baitButton: q("#wl-bait") ? {disabled: q("#wl-bait").disabled} : null,
    bait: q("#wl-bait-report")?.dataset.bait ?? null, baitText: q("#wl-bait-report")?.textContent.replace(/\s+/g, " ").trim() ?? null,
    state: status?.dataset.lessonState ?? null, source: status?.dataset.lessonSource ?? null, label: q("#wl-label")?.textContent.trim() ?? null,
    reasons: [...(r?.querySelectorAll(".wl-reasons li") ?? [])].map((n) => n.textContent.trim()),
    runs: [...(r?.querySelectorAll(".wl-runs li") ?? [])].map((n) => n.textContent.trim()),
    original: [...(r?.querySelectorAll("#wl-original li") ?? [])].map((n) => n.textContent.trim()),
    revised: q("#wl-revised") ? [...q("#wl-revised").querySelectorAll("li")].map((n) => n.textContent.trim()) : null,
    optin: optin ? {disabled: optin.disabled, checked: optin.checked} : null,
    exportDisabled: q("#wl-export")?.disabled ?? null, forget: Boolean(q("#wl-forget")), rematch: Boolean(q("#wl-rematch")),
    hash: q(".wl-hash")?.textContent.trim() ?? null, focus: document.activeElement?.id || document.activeElement?.className || null};
});
const duelView = (page) => page.evaluate(() => ({
  visible: !document.getElementById("showdown").hidden, status: document.querySelector("#sd-status")?.textContent.replace(/\s+/g, " ").trim() ?? "",
  feedback: document.querySelector("#sd-feedback")?.textContent.trim() ?? "",
  hand: [...document.querySelectorAll("#sd-hand [data-card]")].map((n) => n.dataset.card),
  log: [...document.querySelectorAll("#sd-log li")].map((n) => n.textContent.trim()),
  result: [...document.querySelectorAll("#sd-result button")].map((b) => ({id: b.id, text: b.textContent.trim()})),
}));

// ---- Navigation through visible controls -------------------------------------------------------------------------
async function toCamp(c) {
  await c.page.locator("#menu-play").click();
  await c.page.locator("#showdown-camp").waitFor({state: "visible"});
}
// The Camp's "Open saved Wizard lesson", where each build puts it. Returns the path of controls used.
async function openLessonFromCamp(c, route) {
  await toCamp(c);
  const steps = ["#menu-play"];
  if (route.illustrated) {
    await c.page.locator('[data-camp-destination="camp-practice"]').click();
    steps.push('[data-camp-destination="camp-practice"] (Practice room)');
    const replays = c.page.locator("dialog.camp-outpost[open] details:has(#camp-experiment) > summary");
    await replays.click();
    steps.push(`"${squash(await replays.textContent())}" summary`);
  }
  await c.page.locator("#camp-wizard-lesson").click();
  steps.push("#camp-wizard-lesson");
  await c.page.locator("#wizard-lesson").waitFor({state: "visible"});
  return steps;
}
async function upload(c, selector, file) {
  await c.page.locator(selector).setInputFiles(file);
}
const waitLesson = (c, fn, arg) => c.page.waitForFunction(fn, arg);
const cowboyTurns = (page) => page.evaluate(() => [...document.querySelectorAll("#sd-log li")].filter((n) => /: the Cowboys\.$/.test(n.textContent.trim())).length);
// End turn, then wait until the Wizard has replied (a new Cowboy turn line) or the duel is over.
async function endTurn(c) {
  const before = await cowboyTurns(c.page);
  await c.page.locator("#sd-end").click();
  await c.page.waitForFunction((n) => document.querySelector("#sd-result button")
    || [...document.querySelectorAll("#sd-log li")].filter((li) => /: the Cowboys\.$/.test(li.textContent.trim())).length > n, before);
}
// Ends every Cowboy turn until the result shows.
async function finish(c) {
  for (let turns = 0; turns < MAX_TURNS; turns++) {
    if (await c.page.locator("#sd-result button").count()) return true;
    await endTurn(c);
  }
  return (await c.page.locator("#sd-result button").count()) > 0;
}
// The Cowboy's moves of the episode's first Cowboy turn, by clicking the hand card and its target.
async function replayFirstCowboyTurn(c, episode) {
  const first = episode.actions.findIndex((a) => a.side === "cowboy");
  const done = [];
  for (let i = first; i < episode.actions.length && episode.actions[i].side === "cowboy"; i++) {
    const {action} = episode.actions[i];
    if (action.type === "end") { await endTurn(c); done.push("end"); break; }
    if (!["summon", "spell"].includes(action.type) || action.tributes?.length) throw new Error(`episode action ${i} (${action.type}) is not one this check clicks`);
    await c.page.locator(`#sd-hand [data-card="${action.cardId}"]`).click();
    if (action.target !== undefined) await c.page.locator(`#sd-board [data-enemy="${action.target}"]`).click();
    done.push(`${action.type} ${action.cardId}${action.target !== undefined ? ` -> enemy ${action.target}` : ""}`);
  }
  return done;
}

// ---- Checks ------------------------------------------------------------------------------------------------------
function checker() {
  const failures = [];
  const expect = (ok, what, seen) => { if (!ok) failures.push(seen === undefined ? what : `${what} (saw ${JSON.stringify(seen).slice(0, 300)})`); return ok; };
  return {failures, expect};
}

async function nativeCheck(browser, base, route, input, dir) {
  const {failures, expect} = checker();
  const obs = {};
  const c = await open(browser, base, route, {downloads: true});
  try {
    await c.go();
    obs.entry = await openLessonFromCamp(c, route);
    let v = await lessonView(c.page);
    obs.empty = {message: v.message};
    expect(/^No Wizard lesson is saved/.test(v.message ?? ""), "empty lesson page says nothing is saved", v.message);

    await upload(c, "#wl-episode-file", input.episodePath);
    await waitLesson(c, () => document.querySelector("#wizard-lesson .wl-move"));
    v = await lessonView(c.page);
    obs.opened = {message: v.message, moves: v.moves};
    const lines = Object.fromEntries(v.moves.map((m) => [m.pick, m.text]));
    expect(v.moves.find((m) => m.pressed)?.pick === input.episode.markedIndex, "the episode's marked move is preselected", v.moves);
    const other = v.moves.find((m) => m.pick !== input.episode.markedIndex);
    if (other) {
      await c.page.locator(`[data-pick="${other.pick}"]`).click();
      expect((await lessonView(c.page)).moves.find((m) => m.pressed)?.pick === other.pick, "clicking another Wizard move selects it");
      await c.page.locator(`[data-pick="${input.episode.markedIndex}"]`).click();
    }
    await c.page.locator("#wl-bait").click();
    await waitLesson(c, () => document.querySelector("#wizard-lesson .wl-status"));
    v = await lessonView(c.page);
    obs.marked = {message: v.message, bait: v.bait, baitText: v.baitText, label: v.label, state: v.state, original: v.original, optin: v.optin, hash: v.hash};
    expect(v.bait === "true", "the marked move is reported as a Hellfire bait", v.baitText);
    expect(v.state === "pending" && v.label === "Pending: no lesson for this exact episode yet.", "a freshly marked episode is pending", v.label);
    expect(v.hash === input.key, "the page names the episode key computed from the file", v.hash);
    expect(v.optin?.disabled && !v.optin.checked, "opt-in is disabled while pending", v.optin);
    expect(v.original.some((l) => l === lines[input.episode.markedIndex]), "the original Wizard advice includes the marked move", v.original);
    const afterMark = await c.saved();
    expect(afterMark?.version === 2 && canonical(afterMark.episode) === canonical(input.episode) && afterMark.receipt === null, "marking stores the episode and no receipt", afterMark);

    const [download] = await Promise.all([c.page.waitForEvent("download"), c.page.locator("#wl-export").click()]);
    const exportedPath = path.join(dir, "exported-episode.json");
    await download.saveAs(exportedPath);
    const exported = JSON.parse(await readFile(exportedPath, "utf8"));
    obs.export = {suggestedFilename: download.suggestedFilename(), savedAs: path.relative(root, exportedPath), sha256: sha256(await readFile(exportedPath))};
    expect(download.suggestedFilename() === `wizard-lesson-episode-${input.key}.json`, "the export is named for the episode key", download.suggestedFilename());
    expect(canonical(exported) === canonical(input.episode), "the exported episode equals the native episode file");
    expect(input.receipt.episodeKey === input.key, "the native receipt names this episode (so a rejection is not a key mismatch)", input.receipt.episodeKey);

    await upload(c, "#wl-receipt", input.receiptPath);
    await waitLesson(c, () => document.querySelector("#wizard-lesson .wl-status")?.dataset.lessonState !== "pending");
    v = await lessonView(c.page);
    obs.pendingReceipt = {message: v.message, state: v.state, source: v.source, label: v.label, reasons: v.reasons, runs: v.runs, optin: v.optin, revised: v.revised};
    expect(v.state === "rejected" && v.source === "imported", "the pending native receipt is rejected as an imported receipt", {state: v.state, source: v.source});
    expect(/^Rejected lesson from an imported train\.mjs receipt for this exact episode\. The receipt records native Kiro CLI runs; this page cannot confirm they happened\.$/.test(v.label ?? ""),
      "the label says Rejected and does not claim the runs happened", v.label);
    expect(v.reasons.includes(input.receipt.reasons.at(-1)), "the trainer's own pending reason is shown", v.reasons);
    for (const run of input.receipt.runs) expect(v.runs.some((t) => t.startsWith(`${run.role}: run ${run.runId}`)), `the receipt's ${run.role} run is listed as recorded`, v.runs);
    expect(v.optin?.disabled && !v.optin.checked && v.revised === null, "a rejected lesson leaves opt-in disabled and shows no lesson Wizard", {optin: v.optin, revised: v.revised});
    await c.page.locator("#wl-optin").click({force: true}).catch(() => {});
    expect(!(await lessonView(c.page)).optin.checked, "clicking the disabled opt-in does not check it");
    const stored = await c.saved();
    expect(canonical(stored?.receipt) === canonical(input.receipt), "the rejected receipt is stored with the episode", stored?.receipt?.status);

    const before = await c.store();
    await c.page.locator("#wl-rematch").click();
    await c.page.locator("#showdown").waitFor({state: "visible"});
    let d = await duelView(c.page);
    obs.rematch = {status: d.status, hand: d.hand, logStart: d.log.slice(0, 4)};
    expect(d.status.startsWith("Lesson rematch, original Wizard"), "the rematch after a rejected receipt is against the original Wizard", d.status);
    expect(logHas(d.log, lines[0]), "the rematch opens with the episode's first Wizard move (same deal)", {want: lines[0], log: d.log});
    obs.rematch.cowboyMoves = await replayFirstCowboyTurn(c, input.episode);
    d = await duelView(c.page);
    obs.rematch.markedTurnReplied = logHas(d.log, lines[input.episode.markedIndex]);
    expect(obs.rematch.markedTurnReplied, "after the episode's Cowboy moves, the original Wizard plays the marked move again", d.log.slice(-8));
    expect(await finish(c), "the rematch reaches a result by ending turns");
    d = await duelView(c.page);
    obs.rematch.result = d.result; obs.rematch.final = d.status;
    const ids = d.result.map((b) => b.id);
    expect(ids.includes("sd-lesson-back") && !ids.includes("sd-review"), "a lesson rematch offers Back to the lesson, not another review", d.result);
    expect(d.result.find((b) => b.id === "sd-again")?.text === "Same deal again", "a lesson rematch offers the same deal again", d.result);
    const after = await c.store();
    expect(after[PLAYTEST_KEY] === before[PLAYTEST_KEY] && after[SAVE_KEY] === before[SAVE_KEY], "the rematch settles nothing and logs no playtest line",
      {playtest: [before[PLAYTEST_KEY], after[PLAYTEST_KEY]]});

    await c.page.locator("#sd-lesson-back").click();
    await c.page.locator("#wizard-lesson").waitFor({state: "visible"});
    v = await lessonView(c.page);
    expect(v.state === "rejected" && v.optin?.disabled, "Back to the lesson returns to the same rejected lesson", {state: v.state, optin: v.optin});

    await c.go("?lesson=saved");
    await c.page.locator("#wizard-lesson").waitFor({state: "visible"});
    v = await lessonView(c.page);
    obs.reload = {message: v.message, state: v.state, source: v.source, label: v.label};
    expect(v.state === "rejected" && v.source === "imported", "?lesson=saved reopens the saved episode with its receipt re-checked as rejected", obs.reload);

    await c.page.locator("#wl-forget").click();
    v = await lessonView(c.page);
    obs.optOut = {message: v.message, state: v.state, label: v.label, forget: v.forget, optin: v.optin, stored: (await c.saved())?.receipt ?? null};
    expect(v.state === "pending" && v.message === "Lesson forgotten. The rematch Wizard is the original one.", "Forget this lesson returns to pending", obs.optOut);
    expect(!v.forget && obs.optOut.stored === null, "after forgetting, no receipt is stored or offered to forget", obs.optOut);
    await c.page.locator("#wl-rematch").click();
    await c.page.locator("#showdown").waitFor({state: "visible"});
    d = await duelView(c.page);
    expect(d.status.startsWith("Lesson rematch, original Wizard"), "after opting out the rematch Wizard is the original one", d.status);
    await c.page.locator("#sd-home").click();
    await c.page.locator("#showdown-camp").waitFor({state: "visible"});

    await c.go("?lesson=saved");
    await c.page.locator("#wl-rematch").waitFor({state: "visible"});
    const escapes = [];
    for (let i = 0; i < 3; i++) {
      await c.page.keyboard.press("Escape");
      escapes.push(await c.page.evaluate(() => ({lesson: !document.getElementById("wizard-lesson").hidden, camp: !document.getElementById("showdown-camp").hidden,
        marked: Boolean(document.querySelector("#wl-rematch")), selected: document.querySelector('.wl-move[aria-pressed="true"]')?.dataset.pick ?? null})));
    }
    obs.escape = escapes;
    expect(escapes[0].lesson && !escapes[0].marked && escapes[0].selected !== null, "Escape leaves the marked view and keeps the selection", escapes[0]);
    expect(escapes[1].lesson && escapes[1].selected === null, "a second Escape clears the selection", escapes[1]);
    expect(!escapes[2].lesson && escapes[2].camp, "a third Escape closes the lesson to the Camp", escapes[2]);
  } catch (error) {
    failures.push(`aborted: ${error.message.split("\n")[0]}`);
  }
  obs.errors = c.errors; obs.remote = c.remote;
  expect(!c.errors.length, "no page errors", c.errors);
  expect(!c.remote.length, "no request leaves the loopback origin", c.remote);
  await c.ctx.close();
  return {failures, observed: obs};
}

async function fixtureCheck(browser, base, route, input) {
  const {failures, expect} = checker();
  const obs = {fixture: "SIMULATED"};
  if (!input.fixturePath) return {failures: ["fixture.mjs produced no simulated receipt for this episode"], observed: obs};
  const c = await open(browser, base, route);
  try {
    await c.go("?lesson=saved");
    await c.page.locator("#wizard-lesson").waitFor({state: "visible"});
    let v = await lessonView(c.page);
    obs.direct = v.message;
    expect(/^No Wizard lesson is saved/.test(v.message ?? ""), "?lesson=saved with nothing saved opens the empty lesson page", v.message);
    await upload(c, "#wl-episode-file", input.episodePath);
    await c.page.locator("#wl-bait:not(:disabled)").waitFor();
    // The marked move as the page lists it: the line the original Wizard repeats in a faithful rematch.
    const hellfire = (await lessonView(c.page)).moves.find((m) => m.pick === input.episode.markedIndex)?.text ?? null;
    obs.markedLine = hellfire;
    await c.page.locator("#wl-bait").click();
    await upload(c, "#wl-receipt", input.fixturePath);
    await waitLesson(c, () => document.querySelector("#wizard-lesson .wl-status")?.dataset.lessonState === "accepted");
    v = await lessonView(c.page);
    const marked = v.original;
    obs.accepted = {state: v.state, source: v.source, label: v.label, runs: v.runs, optin: v.optin, original: v.original, revised: v.revised, message: v.message};
    expect(v.source === "simulated" && v.label === "Accepted simulated fixture: checked here on the engine, but no Kiro run produced it.",
      "the fixture is labelled as a simulated fixture, not a Kiro lesson", v.label);
    expect(v.runs.length === 3 && v.runs.every((t) => /: run simulated-/.test(t)), "its runs show their simulated- ids", v.runs);
    expect(v.optin && !v.optin.disabled && !v.optin.checked, "opt-in is offered and off by default", v.optin);
    expect(Array.isArray(v.revised) && canonical(v.revised) !== canonical(marked), "the lesson Wizard advice differs from the original", {original: marked, revised: v.revised});
    const storedReceipt = (await c.saved())?.receipt;
    expect(storedReceipt?.fixture === "simulated", "the stored receipt keeps the simulated marker", storedReceipt?.fixture);

    const play = async (want) => {
      await c.page.locator("#wl-rematch").click();
      await c.page.locator("#showdown").waitFor({state: "visible"});
      const status = (await duelView(c.page)).status;
      await replayFirstCowboyTurn(c, input.episode);
      const log = (await duelView(c.page)).log;
      const finished = await finish(c);
      const d = await duelView(c.page);
      await c.page.locator("#sd-lesson-back").click();
      await c.page.locator("#wizard-lesson").waitFor({state: "visible"});
      return {want, status, hellfire: hellfire ? logHas(log, hellfire) : null, finished, result: d.result.map((b) => b.text)};
    };
    obs.optOff = await play("original");
    expect(obs.optOff.status.startsWith("Lesson rematch, original Wizard"), "opt-in off: the rematch Wizard is the original one", obs.optOff.status);
    expect(obs.optOff.hellfire === true, "opt-in off: the original Wizard repeats the marked Hellfire", obs.optOff);
    expect((await lessonView(c.page)).optin?.checked === false, "back from the rematch, opt-in is still off");
    await c.page.locator("#wl-optin").check();
    obs.optOn = await play("lesson");
    expect(obs.optOn.status.startsWith("Lesson rematch, lesson Wizard"), "opt-in on: the rematch Wizard uses the lesson", obs.optOn.status);
    expect(obs.optOn.hellfire === false, "opt-in on: the lesson Wizard does not repeat the marked Hellfire", obs.optOn);
    expect((await lessonView(c.page)).optin?.checked === true, "Back to the lesson keeps the opt-in for this visit");

    await upload(c, "#wl-receipt", input.episodePath);
    await waitLesson(c, () => /The lesson is unchanged\./.test(document.querySelector("#wl-message")?.textContent ?? ""));
    v = await lessonView(c.page);
    obs.notAReceipt = {message: v.message, state: v.state};
    expect(v.state === "accepted", "a file that is not a receipt leaves the lesson unchanged", obs.notAReceipt);

    await c.go("?lesson=saved");
    await c.page.locator("#wizard-lesson .wl-status").waitFor({state: "visible"});
    v = await lessonView(c.page);
    obs.reload = {state: v.state, source: v.source, optin: v.optin};
    expect(v.state === "accepted" && v.source === "simulated" && v.optin && !v.optin.checked, "after a reload the fixture is re-checked and opt-in is off again (not stored)", obs.reload);
    expect(!("optIn" in ((await c.saved()) ?? {})), "the opt-in is not written to storage");

    await c.page.locator("#wl-forget").click();
    v = await lessonView(c.page);
    obs.optOut = {state: v.state, optin: v.optin, message: v.message};
    expect(v.state === "pending" && v.optin?.disabled && !v.optin.checked, "Forget this lesson drops the fixture and disables opt-in", obs.optOut);
  } catch (error) {
    failures.push(`aborted: ${error.message.split("\n")[0]}`);
  }
  obs.errors = c.errors; obs.remote = c.remote;
  expect(!c.errors.length, "no page errors", c.errors);
  expect(!c.remote.length, "no request leaves the loopback origin", c.remote);
  await c.ctx.close();
  return {failures, observed: obs};
}

async function afterDuelCheck(browser, base, route) {
  const {failures, expect} = checker();
  const obs = {save: "synthetic Trail-complete Cowboy save (no player data)", seed: 7};
  const save = {...newSave(), wins: TRAIL.length};
  const c = await open(browser, base, route, {planted: {[SAVE_KEY]: JSON.stringify(save)}});
  try {
    await c.go("?seed=7");
    await toCamp(c);
    if (route.illustrated) await c.page.locator('[data-camp-destination="camp-open-title"]').click();
    await c.page.locator('#camp-open [data-duel="open"]').click();
    await c.page.locator("#showdown").waitFor({state: "visible"});
    obs.status = (await duelView(c.page)).status;
    expect(/^Open range/.test(obs.status), "Open range starts", obs.status);
    expect(await finish(c), "Open range reaches a result by ending every turn");
    const d = await duelView(c.page);
    obs.result = {status: d.status, buttons: d.result};
    expect(d.result.some((b) => b.id === "sd-review" && b.text === "Review a Wizard move"), "a finished level-2 solo Cowboy duel offers Review a Wizard move", d.result);
    await c.page.locator("#sd-review").click();
    await c.page.locator("#wizard-lesson").waitFor({state: "visible"});
    const v = await lessonView(c.page);
    obs.review = {message: v.message, moves: v.moves.length, bait: v.baitButton};
    expect(v.moves.length > 0 && v.baitButton?.disabled === true, "the review lists the duel's Wizard moves with nothing selected yet", obs.review);
    if (v.moves.length) {
      await c.page.locator(".wl-move").first().click();
      await c.page.locator("#wl-bait").click();
      await c.page.locator("#wizard-lesson .wl-status").waitFor({state: "visible"});
      const m = await lessonView(c.page);
      obs.marked = {bait: m.bait, baitText: m.baitText, state: m.state, exportDisabled: m.exportDisabled, message: m.message};
      expect(m.state === "pending", "a move marked from a played duel starts pending", m.state);
      expect(m.exportDisabled === (m.bait !== "true"), "export is offered only for a Hellfire bait", obs.marked);
    }
    await c.page.locator("#wl-close").click();
    await c.page.locator("#showdown-camp").waitFor({state: "visible"});
  } catch (error) {
    failures.push(`aborted: ${error.message.split("\n")[0]}`);
  }
  obs.errors = c.errors; obs.remote = c.remote;
  expect(!c.errors.length, "no page errors", c.errors);
  expect(!c.remote.length, "no request leaves the loopback origin", c.remote);
  await c.ctx.close();
  return {failures, observed: obs};
}

// ---- Main ----------------------------------------------------------------------------------------------------------
async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (error) { console.error(`${error.message}\n${USAGE}`); return 2; }
  await mkdir(opts.out, {recursive: true});
  const input = await inputs(opts.out);
  const pages = stagedPages(opts.dist, opts.routes);
  const report = {tool: "scripts/browser-wizard-lesson-check.mjs", generatedAt: new Date().toISOString(),
    commit: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain", "--", ...LESSON_SOURCES)),
    note: "Scripted Chrome on loopback copies of the staged pages; no human played. The native receipt is used as it is; no native success is claimed. The fixture check is SIMULATED.",
    inputs: input.summary, pages: [], checks: {}, failures: []};
  const missing = pages.filter((p) => p.missing), stale = pages.filter((p) => p.stale);
  if (missing.length || (stale.length && !opts.allowStale)) {
    report.pages = pages.map(({abs, ...p}) => p);
    report.failures.push(...missing.map((p) => `${p.path}: ${p.file} is missing; run node scripts/stage-pages.mjs`),
      ...(opts.allowStale ? [] : stale.map((p) => `${p.path}: ${p.file} is older than a lesson source; restage or pass --allow-stale`)));
    await writeFile(path.join(opts.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.error(report.failures.join("\n"));
    return 2;
  }
  if (input.receipt.status === "validated") report.failures.push("the native receipt is no longer pending: this check's native expectations cover only an unvalidated receipt");

  const chromium = await loadChromium();
  if (!chromium) { console.error("playwright-core not found. Run as: npx -y -p playwright-core@1.64.1 node scripts/browser-wizard-lesson-check.mjs"); return 3; }
  let browser;
  try { browser = await chromium.launch({executablePath: opts.chrome, headless: true}); } catch (error) { console.error(`cannot launch Chrome at ${opts.chrome}: ${error.message.split("\n")[0]}`); return 3; }
  const server = await serve(pages);
  try {
    for (const p of pages) {
      const route = ROUTES[p.id];
      report.pages.push((({abs, ...rest}) => rest)(p));
      const label = `${p.path} (${p.file})`;
      if (!p.markers.lessonStoreKey || !p.markers.campLessonControl) report.failures.push(`${label}: the staged page carries no Wizard lesson`);
      for (const check of opts.only) {
        const dir = path.join(opts.out, p.id, check);
        await mkdir(dir, {recursive: true});
        const started = Date.now();
        const run = check === "native" ? await nativeCheck(browser, server.base, route, input, dir)
          : check === "fixture" ? await fixtureCheck(browser, server.base, route, input) : await afterDuelCheck(browser, server.base, route);
        report.checks[`${p.path} ${check}`] = {route: p.path, file: p.file, check, simulated: check === "fixture", ok: !run.failures.length, ms: Date.now() - started, ...run};
        report.failures.push(...run.failures.map((f) => `${label} ${check}: ${f}`));
        console.log(`${run.failures.length ? "FAIL" : "ok  "} ${label} ${check}${check === "fixture" ? " [SIMULATED fixture]" : ""}${run.failures.length ? `\n     - ${run.failures.join("\n     - ")}` : ""}`);
      }
    }
    const shas = new Set(report.pages.filter((p) => p.illustrated).map((p) => p.sha256));
    if (shas.size > 1) report.failures.push("/ and /3d/ are not byte-identical");
  } finally {
    await browser.close();
    await server.close();
  }
  await writeFile(path.join(opts.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.failures.length ? `${report.failures.length} failure(s)` : "all checks passed"}; report ${path.relative(root, path.join(opts.out, "report.json"))}`);
  return report.failures.length ? 1 : 0;
}

process.exitCode = await main();
