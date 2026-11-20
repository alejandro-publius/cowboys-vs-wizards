// K-089 / K-090: Chrome timing of the first player inputs on the Showdown graybox, before any art.
// QA instrumentation only: no src/ change. DevTools protocol over Node's WebSocket; loopback HTTP server.
//
//   node scripts/build-graybox.mjs --hosted          (the Pages copy: dist/web/index.html)
//   node scripts/browser-showdown-first-input.mjs [--samples 20] [--dir dist/web] [--out FILE.json]
//   node scripts/browser-showdown-first-input.mjs --controls     (disposable negative controls; must all be caught)
//
// Routes (frozen before the first timed run; docs/evidence/showdown-first-input.md):
//   boot-hill  /?seed=0   menu -> Play -> Camp -> Boot Hill -> click the first enabled hand card (K-089)
//   outrider   /          menu -> Play -> Camp -> "Try an Outrider turn" -> click the Outrider troop (K-090)
// Every input is a real CDP mouse press/release at the centre of the control, and only after the harness
// has checked that the control is visible, enabled and the topmost element there. The harness never calls
// page functions and never plays for the player.
//
// Endpoints. Each is a predicate the in-page probe tests on every DOM mutation and every animation frame;
// the time is the first performance.now() at which it holds, and "frame" is the start of the next
// requestAnimationFrame after that (headless Chrome has no display: not a photon or paint time).
//   menu      #menu-play shown, enabled, hit-testable (time since navigation start)
//   camp      Camp shown, title hidden, and the route's Camp control (Boot Hill tile or the Outrider button)
//             enabled and hit-testable once scrolled into view (the scroll is not timed)
//   duel      boot-hill: #showdown shown, Camp hidden, status "Boot Hill · turn 1 · your turn", and an
//             enabled, hit-testable hand card.  outrider: #showdown shown, status names the Outrider
//             experiment and "your turn", and the Outrider troop slot enabled and hit-testable
//   action    boot-hill: the clicked card has left the hand, the event log grew by one line, a Cowboy troop
//             is on the board and the feedback line reads "Last: ... arrived."  outrider: the Wizard Base and
//             a Wizard troop are both offered as enabled targets (the ride-or-fight decision is playable)
// Input latency = endpoint time - event.timeStamp of the pointerdown that the page received for that click.
//
// Cache conditions, per sample (one Chrome process and one new empty temporary profile each):
//   cold  first navigation of that process: empty HTTP cache, no V8 code cache, empty storage
//   warm  second navigation in the same process, right after the cold pass of the same route, with
//         localStorage and sessionStorage cleared (HTTP and code caches kept). The server sends
//         "cache-control: max-age=600" (what GitHub Pages sends), so warm may be served from cache;
//         the receipt records whether it was.
// Neither condition is a fresh OS boot: the Chrome binary and the HTML are in the OS file cache after the
// first sample. Routes alternate order per sample. p95 is nearest-rank: sorted ascending, the value at
// index ceil(0.95 * n) - 1 (with n = 20, the 19th of 20).
import {spawn, execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const ROUTES = {"boot-hill": "/?seed=0", outrider: "/"};
export const STEPS = ["menu", "camp", "duel", "action"];

export function parseArgs(argv) {
  const opt = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
  const samples = Number(opt("--samples", 20));
  if (!Number.isInteger(samples) || samples < 1 || samples > 100) throw new Error("--samples must be an integer 1..100");
  const routes = String(opt("--routes", Object.keys(ROUTES).join(","))).split(",").filter(Boolean);
  for (const r of routes) if (!ROUTES[r]) throw new Error(`unknown route ${r}`);
  return {samples, routes, dir: path.resolve(root, opt("--dir", "dist/web")), out: opt("--out", null), controls: argv.includes("--controls")};
}

// Nearest-rank percentile on finite values.
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function summarize(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const r = (x) => (x === null ? null : Math.round(x * 10) / 10);
  if (!v.length) return {n: 0, median: null, p95: null, min: null, max: null, values: []};
  const mid = v.length >> 1;
  return {n: v.length, median: r(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2), p95: r(percentile(v, 0.95)),
    min: r(v[0]), max: r(v.at(-1)), values: v.map(r)};
}

// Sample order of routes: alternate, so neither route is always first in a fresh process.
export const routeOrder = (routes, sample) => (sample % 2 ? [...routes].reverse() : [...routes]);

// ---- loopback server: the hosted build, cached like GitHub Pages ------------------------------------
async function serve(dir) {
  const log = [];
  const server = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(dir, rel);
      log.push(rel);
      if (req.method !== "GET" || !file.startsWith(dir + path.sep) || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, {"content-type": rel.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream", "cache-control": "max-age=600"});
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {origin: `http://127.0.0.1:${server.address().port}`, log, close: () => new Promise((ok) => server.close(ok))};
}

async function launch() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "showdown-first-input-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--disable-sync", "--disable-extensions", "--disable-background-networking",
    "--disable-component-update", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--mute-audio", "--hide-scrollbars",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "--window-size=1440,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no DevTools URL in 30 s")), 30000);
    child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
  });
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
  const waiting = new Map(), errors = [], remote = [], docs = [];
  let next = 0;
  ws.addEventListener("message", ({data}) => {
    const m = JSON.parse(data);
    if (m.id === undefined) {
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
      if (m.method === "Network.requestWillBeSent" && !/^(http:\/\/127\.0\.0\.1[:/]|data:|blob:|about:)/.test(m.params.request.url)) remote.push(m.params.request.url);
      if (m.method === "Network.responseReceived" && m.params.type === "Document") {
        const r = m.params.response;
        docs.push({status: r.status, fromDiskCache: Boolean(r.fromDiskCache), fromMemoryCache: Boolean(r.fromMemoryCache), encodedBytes: r.encodedDataLength});
      }
      return;
    }
    const e = waiting.get(m.id); waiting.delete(m.id);
    if (m.error) e?.reject(new Error(m.error.message)); else e?.resolve(m.result);
  });
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++next; waiting.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const {product} = await raw("Browser.getVersion");
  const {targetInfos} = await raw("Target.getTargets");
  const {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
  const send = (method, params) => raw(method, params, sessionId);
  for (const d of ["Page", "Runtime", "Network"]) await send(`${d}.enable`);
  await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  return {send, errors, remote, docs, product, async close() {
    ws.close(); child.kill("SIGTERM"); await sleep(300); child.kill("SIGKILL");
    await rm(profile, {recursive: true, force: true, maxRetries: 5});
  }};
}

// Injected before page scripts. Observes only: it records input timestamps and the first time each
// endpoint predicate holds. window.__fi.arm(route, extra) sets the route-specific predicates.
const PROBE = `(() => {
  const F = window.__fi = {inputs: [], marks: {}, route: null, outriderSlot: null, base: null};
  for (const type of ["pointerdown", "click"]) window.addEventListener(type, (e) => {
    F.inputs.push({type, t: e.timeStamp, id: e.target?.id || e.target?.closest?.("[id],[data-card],[data-slot],[data-duel]")?.outerHTML.slice(0, 60) || ""});
  }, {capture: true});
  const $ = (s) => document.querySelector(s);
  const shown = (id) => { const n = document.getElementById(id); return Boolean(n && !n.hidden); };
  const hittable = (n) => { if (!n || n.disabled) return false; const r = n.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    const h = document.elementFromPoint(x, y); return Boolean(h && n.contains(h)); };
  const campControl = () => F.route === "outrider" ? $("#camp-outrider-turn") : $("#camp-trail [data-duel=trail]");
  const status = () => $("#sd-status")?.textContent.trim() ?? "";
  F.preds = {
    menu: () => shown("title-screen") && hittable($("#menu-play")),
    // The Camp control may be below the fold; "present and enabled" here, hit-tested by the harness after scroll.
    camp: () => shown("showdown-camp") && !shown("title-screen") && Boolean(campControl() && !campControl().disabled && campControl().getClientRects().length),
    duel: () => shown("showdown") && !shown("showdown-camp") && (F.route === "outrider"
      ? status().includes("Experiment: an Outrider turn") && / · your turn$/.test(status()) && hittable($('[data-slot="cowboy-' + F.outriderSlot + '"]'))
      : status() === "Boot Hill · turn 1 · your turn" && [...document.querySelectorAll("#sd-hand [data-card]:not(:disabled)")].some(hittable)),
    action: () => {
      if (!F.base) return false;
      if (F.route === "outrider") {
        const base = $('[data-base="wizard"][data-enemy="base"]'), troop = $('[data-slot^="wizard-"][data-enemy]');
        return Boolean(base && !base.disabled && troop && !troop.disabled);
      }
      return !$('#sd-hand [data-card="' + F.base.card + '"]') && document.querySelectorAll("#sd-log li").length === F.base.log + 1
        && document.querySelectorAll('#sd-board [data-side=cowboy] .sd-slot[data-frame=troop]').length === F.base.troops + 1
        && /^Last: .* arrived\\.$/.test($("#sd-feedback")?.textContent.trim() ?? "");
    },
  };
  F.want = ["menu"];
  const check = () => {
    for (const name of F.want) if (!F.marks[name]) { let ok = false; try { ok = F.preds[name](); } catch {} if (ok) {
      const m = F.marks[name] = {t: performance.now(), frame: null}; requestAnimationFrame(() => { m.frame = performance.now(); }); } }
  };
  F.check = check;
  const loop = () => { check(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const start = () => new MutationObserver(check).observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
  if (document.documentElement) start(); else document.addEventListener("readystatechange", start, {once: true});
})()`;

// Disposable negative controls, injected after the probe. They change nothing on disk.
export const CONTROLS = {
  // A 300 ms busy wait in front of the page's own handling of the first-action press.
  delay: `window.addEventListener("pointerdown", (e) => { if (e.target.closest?.("#sd-hand [data-card]")) { const s = performance.now(); while (performance.now() - s < 300); } }, {capture: true});`,
  // The first-action click never reaches the page's handler: the endpoint must not be met.
  swallow: `window.addEventListener("click", (e) => { if (e.target.closest?.("#sd-hand [data-card]")) e.stopImmediatePropagation(); }, {capture: true});`,
  // A transparent sheet over the Boot Hill tile: the harness must refuse to click it.
  cover: `document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => { const t = document.querySelector("#camp-trail [data-duel=trail]"); if (t && !document.getElementById("fi-cover") && !document.getElementById("showdown-camp").hidden) {
    const d = document.createElement("div"); d.id = "fi-cover"; d.style.cssText = "position:fixed;inset:0;z-index:99999"; document.body.append(d); } }).observe(document.documentElement, {subtree: true, childList: true, attributes: true}));`,
};

async function runRoute(c, {origin, route, outriderSlot, condition, control, stepTimeout = 20000}) {
  const evaluate = async (expression) => {
    const {result, exceptionDetails} = await c.send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  // Arm an endpoint before the input that should cause it, so the probe tests it from the first mutation on.
  const arm = async (name) => {
    const already = await evaluate(`(() => { const F = window.__fi; F.want.push(${JSON.stringify(name)}); return F.preds[${JSON.stringify(name)}](); })()`);
    if (already) throw new Error(`endpoint "${name}" already holds before its input (${route}, ${condition})`);
  };
  const mark = async (name, timeout = stepTimeout) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const m = await evaluate(`window.__fi?.marks[${JSON.stringify(name)}] ?? null`).catch(() => null);
      if (m?.frame !== null && m?.frame !== undefined) return m;
      await sleep(25);
    }
    throw new Error(`timeout: endpoint "${name}" not met within ${timeout} ms (${route}, ${condition})`);
  };
  // Scroll into view (untimed), then require visible, enabled and topmost at the centre.
  const click = async (selector) => {
    const box = await evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return {error: "missing"};
      if (n.disabled) return {error: "disabled"}; n.scrollIntoView({block: "nearest"});
      const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
      return h && n.contains(h) ? {x, y} : {error: "covered by " + (h ? h.tagName + "#" + h.id : "nothing")}; })()`);
    if (box.error) throw new Error(`refused to click ${selector}: ${box.error}`);
    const from = await evaluate("window.__fi.inputs.length");
    await c.send("Input.dispatchMouseEvent", {type: "mouseMoved", x: box.x, y: box.y});
    await c.send("Input.dispatchMouseEvent", {type: "mousePressed", x: box.x, y: box.y, button: "left", buttons: 1, clickCount: 1});
    await c.send("Input.dispatchMouseEvent", {type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1});
    const down = (await evaluate(`window.__fi.inputs.slice(${from})`)).find((e) => e.type === "pointerdown");
    if (!down) throw new Error(`no pointerdown reached the page for ${selector}`);
    return down.t;
  };
  const docsBefore = c.docs.length;
  await c.send("Page.navigate", {url: origin + ROUTES[route]});
  const menu = await mark("menu", 60000);
  const out = {route, condition, url: ROUTES[route], steps: {menu: {fromNavigation: menu.t, frame: menu.frame}}};
  await evaluate(`window.__fi.route = ${JSON.stringify(route)}; window.__fi.outriderSlot = ${JSON.stringify(outriderSlot)}; 0`);
  await sleep(150);
  await arm("camp");
  let t = await click("#menu-play");
  let m = await mark("camp");
  out.steps.camp = {input: m.t - t, frame: m.frame - t};
  await sleep(150);
  await arm("duel");
  t = await click(route === "outrider" ? "#camp-outrider-turn" : "#camp-trail [data-duel=trail]");
  m = await mark("duel");
  out.steps.duel = {input: m.t - t, frame: m.frame - t};
  await sleep(150);
  if (route === "outrider") {
    await evaluate(`window.__fi.base = {}; 0`);
    await arm("action");
    t = await click(`[data-slot="cowboy-${outriderSlot}"]`);
  } else {
    const card = await evaluate(`[...document.querySelectorAll("#sd-hand [data-card]:not(:disabled)")][0].dataset.card`);
    await evaluate(`window.__fi.base = {card: ${JSON.stringify(card)}, log: document.querySelectorAll("#sd-log li").length,
      troops: document.querySelectorAll('#sd-board [data-side=cowboy] .sd-slot[data-frame=troop]').length}; 0`);
    out.card = card;
    await arm("action");
    t = await click(`#sd-hand [data-card="${card}"]`);
  }
  m = await mark("action", control === "swallow" ? 3000 : stepTimeout);
  out.steps.action = {input: m.t - t, frame: m.frame - t};
  out.document = c.docs.slice(docsBefore).at(-1) ?? null;
  out.localStorageKeys = await evaluate("Object.keys(localStorage)");
  return out;
}

async function sample(origin, {routes, outriderSlot, index, control}) {
  const results = [];
  for (const route of routeOrder(routes, index)) {
    const c = await launch();
    try {
      await c.send("Page.addScriptToEvaluateOnNewDocument", {source: PROBE});
      if (control) await c.send("Page.addScriptToEvaluateOnNewDocument", {source: CONTROLS[control]});
      const cold = await runRoute(c, {origin, route, outriderSlot, condition: "cold", control});
      await c.send("Page.navigate", {url: "about:blank"});
      await sleep(200);
      await c.send("Storage.clearDataForOrigin", {origin, storageTypes: "local_storage,session_storage"});
      const warm = await runRoute(c, {origin, route, outriderSlot, condition: "warm", control});
      for (const r of [cold, warm]) results.push({...r, sample: index, chrome: c.product});
      if (c.errors.length || c.remote.length) throw new Error(`page errors ${JSON.stringify(c.errors)} remote ${JSON.stringify(c.remote)}`);
    } finally { await c.close(); }
  }
  return results;
}

function machine() {
  const sh = (cmd, args) => { try { return execFileSync(cmd, args, {encoding: "utf8"}).trim(); } catch { return null; } };
  return {platform: `${os.platform()} ${os.arch()} ${os.release()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length, node: process.version,
    loadavg: os.loadavg().map((x) => Math.round(x * 100) / 100), chromeProcesses: Number(sh("sh", ["-c", "pgrep -f 'Google Chrome' | wc -l"]) ?? NaN),
    at: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles", timeZoneName: "short"})};
}

async function pageInfo(dir) {
  const html = await readFile(path.join(dir, "index.html"));
  const text = html.toString("utf8");
  if (!text.includes('id="menu-play"') || text.includes('class="title-art"')) throw new Error(`${dir}/index.html is not the graybox page; run node scripts/build-graybox.mjs --hosted`);
  return {path: path.relative(root, path.join(dir, "index.html")), bytes: html.length, sha256: createHash("sha256").update(html).digest("hex"),
    build: text.match(/"([0-9a-f]{12}(?:\+local)?)"/)?.[1] ?? null};
}

async function outriderSlotFor() {
  const {verifiedForBuild, loadDecision, DEFAULT_DIR} = await import("./outrider-gate.mjs");
  const v = await verifiedForBuild({});
  if (!v.camp) return null;
  return (await loadDecision(DEFAULT_DIR)).cases.find((c) => c.id === v.camp).arms.ride.slot;
}

async function runControls(origin, outriderSlot) {
  const caught = {};
  const one = async (name, test) => {
    try { const rs = await sample(origin, {routes: ["boot-hill"], outriderSlot, index: 0, control: name}); caught[name] = test(rs, null); }
    catch (e) { caught[name] = test(null, e); }
    console.error(`control ${name}: ${caught[name].caught ? "caught" : "NOT CAUGHT"} (${caught[name].why})`);
  };
  await one("delay", (rs, e) => {
    if (e) return {caught: false, why: `run failed: ${e.message}`};
    const v = rs.map((r) => r.steps.action.input);
    return {caught: v.every((x) => x >= 300), why: `first-action input latency ${v.map((x) => x.toFixed(1)).join(", ")} ms, injected 300 ms`};
  });
  await one("swallow", (rs, e) => ({caught: Boolean(e && /endpoint "action" not met/.test(e.message)), why: e ? e.message : "measured a time for an action the page never applied"}));
  await one("cover", (rs, e) => ({caught: Boolean(e && /refused to click #camp-trail .*covered by DIV#fi-cover/.test(e.message)), why: e ? e.message : "clicked a covered control"}));
  return caught;
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const page = await pageInfo(cfg.dir);
  const outriderSlot = await outriderSlotFor();
  if (cfg.routes.includes("outrider") && outriderSlot === null) throw new Error("this build shows no Outrider Camp control (gate not fresh)");
  const git = (() => { try { return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {encoding: "utf8"}).trim(); } catch { return null; } })();
  const server = await serve(cfg.dir);
  const before = machine();
  try {
    if (cfg.controls) {
      const caught = await runControls(server.origin, outriderSlot);
      const pass = Object.values(caught).every((x) => x.caught);
      const rec = {kind: "negative-controls", git, page, before, after: machine(), caught, pass};
      if (cfg.out) await writeFile(path.resolve(cfg.out), JSON.stringify(rec, null, 2) + "\n");
      console.log(JSON.stringify(rec, null, 2));
      process.exit(pass ? 0 : 1);
    }
    const runs = [];
    for (let i = 0; i < cfg.samples; i++) {
      const rs = await sample(server.origin, {routes: cfg.routes, outriderSlot, index: i});
      runs.push(...rs);
      process.stderr.write(`sample ${i}: ${rs.map((r) => `${r.route}/${r.condition} action ${r.steps.action.input.toFixed(1)}`).join("; ")} ms\n`);
    }
    const table = [];
    for (const route of cfg.routes) for (const condition of ["cold", "warm"]) {
      const rs = runs.filter((r) => r.route === route && r.condition === condition);
      table.push({route, condition, menuFromNavigation: summarize(rs.map((r) => r.steps.menu.fromNavigation)),
        ...Object.fromEntries(STEPS.slice(1).flatMap((s) => [[`${s}Input`, summarize(rs.map((r) => r.steps[s].input))], [`${s}Frame`, summarize(rs.map((r) => r.steps[s].frame))]])),
        documentFromCache: rs.filter((r) => r.document?.fromDiskCache || r.document?.fromMemoryCache).length,
        documentEncodedBytes: [...new Set(rs.map((r) => r.document?.encodedBytes))], cards: [...new Set(rs.map((r) => r.card).filter(Boolean))]});
    }
    const rec = {kind: "timing", git, page, outriderSlot, chrome: [...new Set(runs.map((r) => r.chrome))], config: {...cfg, dir: path.relative(root, cfg.dir)},
      before, after: machine(), serverRequests: server.log.length, table, runs};
    if (cfg.out) await writeFile(path.resolve(cfg.out), JSON.stringify(rec, null, 2) + "\n");
    const f = (s) => `${s.median} / ${s.p95} (${s.min}–${s.max})`;
    console.log(`page ${page.sha256.slice(0, 12)} build ${page.build} · ${rec.chrome.join(", ")} · load before ${before.loadavg} after ${rec.after.loadavg}`);
    console.log("| Route | Cache | Nav → menu | Play → Camp | Camp → duel | First action | Doc from cache |\n| --- | --- | --- | --- | --- | --- | --- |");
    for (const r of table) console.log(`| ${r.route} | ${r.condition} | ${f(r.menuFromNavigation)} | ${f(r.campInput)} | ${f(r.duelInput)} | ${f(r.actionInput)} | ${r.documentFromCache}/${r.menuFromNavigation.n} |`);
  } finally { await server.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
