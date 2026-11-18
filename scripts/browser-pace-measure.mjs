// Measures default vs ?pace=fast in real headless Chrome (issue #125). No
// dependency: DevTools protocol over Node's built-in WebSocket, and a
// loopback-only static server for the built web page. No src/ change.
//
//   npm run build -- --web && node scripts/browser-pace-measure.mjs [--seeds 0,60] [--samples 3] [--turns 2]
//     [--modes default,fast] [--route passive|clash] [--dir dist/web] [--out FILE.json] [--swiftshader]
//
// For each sample, seed and mode it opens a fresh Chrome with a temporary
// profile on ?mode=match&deck=starter&seed=N[&pace=fast] and, on each of the
// first --turns Cowboy turns, sends real CDP input:
//   1. a mouse click on the first playable hand card (ack: card shows aria-pressed=true)
//   2. the Escape key                                 (ack: selection cleared)
//   3. a mouse click on End phase                     (ack: status leaves accepting_input;
//      then the first cpu_turn, if any, and the next accepting_input or terminal)
// A capture-phase probe injected before the page loads stores each input's
// event.timeStamp and every overlay change seen by a MutationObserver, with
// the start time of the next animation frame. All times are the page's own
// performance clock, so CDP and polling delays are not included. "Frame" is
// the next requestAnimationFrame after the DOM change, not a photon or paint
// time: headless Chrome has no display.
//
// --route clash (issue #128) replaces steps 1-2 with a legal Cowboy summon made
// through the page's own input path: a mouse click on the first hand card the
// page labels "free summon, playable now", a click on the first enabled (lit)
// Cowboy lane, then a click on the enabled Summon (confirm) button. It is
// accepted only when that lane's label stops reading "empty" and the page is
// back at accepting_input with no selection. The route never picks tributes,
// spells or traps; if no free summon or lit lane is offered, the turn records
// the reason and only ends the phase. The End phase playback that follows now
// has a Cowboy troop on the board, so it can contain clash impacts. The default
// route is "passive" and behaves exactly as in issue #125.
//
// Impact order: the overlay re-renders from the Presenter's displayed state
// (slot health labels, Base orbs, hand counts, result). The ordered list of
// distinct overlay board states during each End phase playback is compared
// across modes and samples. A MutationObserver merges renders made in one
// task, so a shorter wait can merge two steps; a sequence that is an ordered
// subset of the other is reported as "subsequence", not "identical".
// 3D cue timing is not observable here; it is not read or claimed.
//
// Modes alternate order per sample (default first on even samples). Any
// request to a non-loopback URL is recorded and fails the run.
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../", import.meta.url));
const MODES = new Set(["default", "fast"]);
const ROUTES = new Set(["passive", "clash"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv) {
  const opt = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
  const list = (text) => String(text).split(",").map((s) => s.trim()).filter(Boolean);
  const seeds = list(opt("--seeds", "0,60")).map((s) => {
    if (!/^\d+$/.test(s)) throw new Error(`--seeds needs non-negative integers, got ${s}`);
    return Number(s);
  });
  const modes = list(opt("--modes", "default,fast"));
  for (const m of modes) if (!MODES.has(m)) throw new Error(`--modes accepts default and fast, got ${m}`);
  const int = (name, fallback, max) => {
    const v = Number(opt(name, fallback));
    if (!Number.isInteger(v) || v < 1 || v > max) throw new Error(`${name} must be an integer 1..${max}`);
    return v;
  };
  const route = opt("--route", "passive");
  if (!ROUTES.has(route)) throw new Error(`--route accepts passive and clash, got ${route}`);
  return {seeds, modes, route, samples: int("--samples", 3, 20), turns: int("--turns", 2, 10),
    dir: path.resolve(root, opt("--dir", "dist/web")), out: opt("--out", null), swiftshader: argv.includes("--swiftshader")};
}

// The page query for one run. Default mode adds no pace parameter at all.
export function queryFor(mode, seed) {
  if (!MODES.has(mode)) throw new Error(`unknown mode ${mode}`);
  return `?mode=match&deck=starter&seed=${seed}${mode === "fast" ? "&pace=fast" : ""}`;
}

// Order of modes for a sample index: alternate to spread warm-up and cache effects.
export function modeOrder(modes, sample) {
  return sample % 2 === 0 ? [...modes] : [...modes].reverse();
}

export function summarize(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return {n: 0, median: null, min: null, max: null};
  const mid = v.length >> 1;
  const median = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  const r = (x) => Math.round(x * 10) / 10;
  return {n: v.length, median: r(median), min: r(v[0]), max: r(v[v.length - 1])};
}

// "identical", "subsequence" (one list is an ordered subset of the other) or "different".
export function compareOrder(a, b) {
  if (a.length === b.length && a.every((x, i) => x === b[i])) return "identical";
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  for (const x of long) if (i < short.length && x === short[i]) i++;
  return i === short.length ? "subsequence" : "different";
}

// ---- loopback static server -------------------------------------------------
const TYPES = {".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".glb": "model/gltf-binary",
  ".png": "image/png", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm"};
async function serve(dir) {
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
      const rel = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(dir, rel);
      if (!file.startsWith(dir + path.sep) || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, {"content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store"});
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok))};
}

// ---- Chrome over CDP ---------------------------------------------------------
async function launch({swiftshader}) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "pace-measure-chrome-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--disable-sync", "--disable-extensions", "--disable-background-networking",
    "--disable-component-update", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    "--mute-audio", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding", "--window-size=1440,900", ...(swiftshader ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []),
    "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no DevTools URL in 30 s")), 30000);
    child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
  });
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
  const waiting = new Map(); let next = 0; const errors = [], remote = [];
  ws.addEventListener("message", ({data}) => {
    const m = JSON.parse(data);
    if (m.id === undefined) {
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
      if (m.method === "Network.requestWillBeSent") {
        const u = m.params.request.url;
        if (!/^(http:\/\/127\.0\.0\.1[:/]|data:|blob:|about:)/.test(u)) remote.push(u);
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
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  return {send, errors, remote, product, async close() {
    ws.close(); child.kill("SIGTERM"); await sleep(400); child.kill("SIGKILL");
    await rm(profile, {recursive: true, force: true, maxRetries: 5});
  }};
}

// Injected before page scripts. Read-only: it listens and observes, never dispatches or edits the page.
const PROBE = `(() => {
  const P = window.__paceProbe = {inputs: [], obs: [], last: null};
  for (const type of ["pointerdown", "click", "keydown"]) window.addEventListener(type, (e) => {
    P.inputs.push({type, key: e.key ?? null, t: e.timeStamp});
  }, {capture: true});
  const read = () => {
    const m = document.querySelector("#match");
    if (!m || m.hidden) return null;
    const txt = (n) => n?.textContent.trim() ?? "";
    const slots = [...m.querySelectorAll(".match-slot")].map((s) => s.getAttribute("aria-label")).join(";");
    const bases = [...m.querySelectorAll("*")].filter((n) => n.childElementCount === 0 && /^Base [^ ]+\\/5$/.test(txt(n))).map(txt).join(",");
    const wiz = m.querySelector('[aria-label^="Wizard hand"]')?.getAttribute("aria-label") ?? "";
    const own = m.querySelectorAll(".match-hand [data-card-id]").length;
    const result = m.querySelector(".match-result");
    const board = [bases, slots, wiz, "hand " + own, result && !result.hidden ? txt(result).slice(0, 80) : ""].join("|");
    return {where: txt(m.querySelector(".match-details p")), status: m.dataset.status, selected: Boolean(m.querySelector(".match-hand [aria-pressed=true]")), board};
  };
  const look = () => {
    const s = read();
    if (!s) return;
    const key = s.status + "#" + s.selected + "#" + s.board;
    if (key === P.last) return;
    P.last = key;
    const entry = {t: performance.now(), frame: null, ...s};
    P.obs.push(entry);
    requestAnimationFrame(() => { entry.frame = performance.now(); });
  };
  const start = () => new MutationObserver(look).observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
  if (document.documentElement) start(); else document.addEventListener("readystatechange", start, {once: true});
})()`;

async function runOne({origin, mode, seed, turns, swiftshader, route = "passive"}) {
  const c = await launch({swiftshader});
  try {
    const evaluate = async (expression) => {
      const {result, exceptionDetails} = await c.send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    await c.send("Page.addScriptToEvaluateOnNewDocument", {source: PROBE});
    const probe = (from) => evaluate(`(() => { const P = window.__paceProbe; return P ? {obs: P.obs.slice(${from})} : null; })()`);
    // First overlay change at or after index `from` that satisfies ok, once its next frame has started.
    const waitObs = async (label, from, ok, timeout = 60000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const p = await probe(from).catch(() => null);
        const hit = p?.obs.findIndex(ok) ?? -1;
        if (hit >= 0 && p.obs[hit].frame !== null) return {...p.obs[hit], index: from + hit};
        await sleep(40);
      }
      throw new Error(`timeout waiting for ${label} (${mode}, seed ${seed})`);
    };
    const counts = () => evaluate("({i: window.__paceProbe.inputs.length, o: window.__paceProbe.obs.length})");
    const point = async (selector) => {
      const box = await evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return {error: "missing"};
        const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
        return h && n.contains(h) ? {x, y} : {error: "covered by " + (h ? h.tagName + "." + h.className : "nothing")}; })()`);
      if (box.error) throw new Error(`cannot click ${selector}: ${box.error}`);
      return box;
    };
    const click = async (selector) => {
      const {x, y} = await point(selector);
      await c.send("Input.dispatchMouseEvent", {type: "mouseMoved", x, y});
      await c.send("Input.dispatchMouseEvent", {type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1});
      await c.send("Input.dispatchMouseEvent", {type: "mouseReleased", x, y, button: "left", clickCount: 1});
    };
    const escape = async () => {
      for (const type of ["rawKeyDown", "keyUp"]) await c.send("Input.dispatchKeyEvent", {type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27});
    };
    // The page's event.timeStamp for the first `type` event recorded after input index `from`.
    const startOf = async (from, type) => {
      const e = (await evaluate(`window.__paceProbe.inputs.slice(${from})`)).find((x) => x.type === type);
      if (!e) throw new Error(`no ${type} event reached the page`);
      return e.t;
    };

    const navStart = Date.now();
    await c.send("Page.navigate", {url: origin + "/" + queryFor(mode, seed)});
    await waitObs("first accepting_input", 0, (o) => o.status === "accepting_input" && !o.selected, 90000);
    const loadMs = Date.now() - navStart;
    const gpu = await evaluate(`(() => { try { const g = document.createElement("canvas").getContext("webgl2"); const d = g.getExtension("WEBGL_debug_renderer_info"); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { return "unavailable"; } })()`);
    const out = {mode, seed, route, loadMs, gpu, turns: []};
    // Legal free summon through real input (clash route). Returns the record or {skipped: reason}.
    const summon = async () => {
      const cardId = await evaluate(`document.querySelector('#match .match-hand [data-card-id][aria-label*="free summon"][aria-label$="playable now"]:enabled')?.dataset.cardId ?? null`);
      if (!cardId) return {skipped: "no free summon playable"};
      let {i, o} = await counts();
      await click(`#match .match-hand [data-card-id="${cardId}"]`);
      const t = await startOf(i, "click");
      const a = await waitObs("summon card selected", o, (x) => x.selected && x.t >= t);
      const lane = await evaluate(`document.querySelector('#match .match-slot[data-side="cowboy"]:enabled')?.dataset.slot ?? null`);
      if (lane === null) {
        await escape();
        await waitObs("selection cleared", a.index, (x) => !x.selected && x.status === "accepting_input");
        return {cardId, skipped: "no lit Cowboy lane"};
      }
      const laneSel = `#match .match-slot[data-side="cowboy"][data-slot="${lane}"]`;
      await click(laneSel);
      const t0 = Date.now();
      while (!(await evaluate(`Boolean(document.querySelector('#match [data-action="confirm"]:enabled'))`))) {
        if (Date.now() - t0 > 10000) throw new Error(`Summon button never enabled (${mode}, seed ${seed})`);
        await sleep(40);
      }
      ({i, o} = await counts());
      await click('#match [data-action="confirm"]');
      const ct = await startOf(i, "click");
      const laneLabel = `Your lane ${Number(lane) + 1}:`;
      const filled = (x) => x.board.split("|")[1].split(";").some((l) => l.startsWith(laneLabel) && !/: empty$/.test(l));
      const placed = await waitObs("summoned troop on lane", o, (x) => x.t >= ct && filled(x));
      const settled = await waitObs("input after summon", placed.index, (x) => x.status === "accepting_input" && !x.selected && filled(x));
      const label = await evaluate(`document.querySelector(${JSON.stringify(laneSel)})?.getAttribute("aria-label") ?? ""`);
      return {cardId, slot: Number(lane), label, board: settled.board,
        ack: {dom: placed.t - ct, frame: placed.frame - ct}, toInput: settled.t - ct};
    };

    for (let turn = 1; turn <= turns; turn++) {
      await sleep(300);
      const rec = {turn, cardAck: null, escapeAck: null};
      if (route === "clash") rec.summon = await summon();
      const enabled = route === "clash" ? null : await evaluate(`document.querySelector('#match .match-hand [data-card-id][aria-label$="playable now"]:enabled')?.dataset.cardId ?? null`);
      if (enabled) {
        let {i, o} = await counts();
        await click(`#match .match-hand [data-card-id="${enabled}"]`);
        const t = await startOf(i, "click");
        const a = await waitObs("card selected", o, (x) => x.selected && x.t >= t);
        rec.cardAck = {dom: a.t - t, frame: a.frame - t};
        ({i, o} = await counts());
        await escape();
        const k = await startOf(i, "keydown");
        const b = await waitObs("selection cleared", o, (x) => !x.selected && x.status === "accepting_input" && x.t >= k);
        rec.escapeAck = {dom: b.t - k, frame: b.frame - k};
        await sleep(200);
      }
      const {i, o} = await counts();
      const startWhere = await evaluate(`document.querySelector("#match .match-details p")?.textContent.trim() ?? ""`);
      await click('#match [data-action="end-phase"]');
      const t = await startOf(i, "click");
      const ack = await waitObs("end-phase ack", o, (x) => x.t >= t && x.status !== "accepting_input");
      // The next Cowboy input may follow a Wizard turn or, between Cowboy phases, come with no cpu_turn at all.
      const done = await waitObs("next input or result", ack.index, (x) => x.status === "accepting_input" || x.status === "terminal", 90000);
      const {obs} = await probe(o);
      const cpu = obs.slice(ack.index - o, done.index - o + 1).find((x) => x.status === "cpu_turn") ?? null;
      const seq = [];
      for (const x of obs.slice(0, done.index - o + 1)) if (seq.at(-1) !== x.board) seq.push(x.board);
      Object.assign(rec, {endAck: {dom: ack.t - t, frame: ack.frame - t}, toCpuTurn: cpu ? cpu.t - t : null, toComplete: done.t - t,
        from: startWhere, to: done.where,
        boardSteps: seq.length, boardOrder: seq, endStatus: done.status, ...(route === "clash" ? {endBoard: done.board} : {})});
      out.turns.push(rec);
      if (done.status === "terminal") break;
    }
    out.consoleErrors = c.errors;
    out.remoteRequests = c.remote;
    out.chrome = c.product;
    return out;
  } finally { await c.close(); }
}

export function receipt(cfg, runs, html) {
  const metrics = [["cardAck.dom", "Card click → selected (DOM)"], ["cardAck.frame", "Card click → next frame"],
    ["escapeAck.dom", "Escape key → cleared (DOM)"], ["escapeAck.frame", "Escape key → next frame"],
    ["endAck.frame", "End phase click → leaves input (next frame)"], ["toCpuTurn", "End phase click → cpu_turn (if any)"],
    ["toComplete", "End phase click → next input/terminal"]];
  if (cfg.route === "clash") metrics.unshift(["summon.ack.dom", "Summon click → troop on lane (DOM)"],
    ["summon.ack.frame", "Summon click → troop on lane (next frame)"], ["summon.toInput", "Summon click → input again"]);
  const get = (rec, key) => key.split(".").reduce((v, k) => v?.[k], rec);
  const table = [];
  for (const seed of cfg.seeds) for (let turn = 1; turn <= cfg.turns; turn++) for (const [key, label] of metrics) {
    const row = {seed, turn, metric: label};
    for (const mode of cfg.modes) {
      const recs = runs.filter((r) => r.mode === mode && r.seed === seed).map((r) => r.turns.find((x) => x.turn === turn)).filter(Boolean);
      row[mode] = summarize(recs.map((r) => get(r, key)));
    }
    if (cfg.modes.some((m) => row[m].n)) table.push(row);
  }
  const order = [];
  for (const seed of cfg.seeds) for (let turn = 1; turn <= cfg.turns; turn++) {
    const seqs = runs.filter((r) => r.seed === seed).map((r) => ({mode: r.mode, seq: r.turns.find((x) => x.turn === turn)?.boardOrder})).filter((x) => x.seq);
    if (!seqs.length) continue;
    const verdicts = seqs.map((x) => compareOrder(seqs[0].seq, x.seq));
    const row = {seed, turn, runs: seqs.length, steps: seqs.map((x) => `${x.mode}:${x.seq.length}`).join(" "),
      order: verdicts.includes("different") ? "different" : verdicts.includes("subsequence") ? "subsequence" : "identical",
      sameEndState: new Set(seqs.map((x) => x.seq.at(-1))).size === 1};
    if (cfg.route === "clash") {
      const recs = runs.filter((r) => r.seed === seed).map((r) => r.turns.find((x) => x.turn === turn)).filter(Boolean);
      const keys = recs.map((x) => x.summon?.skipped ? "skip:" + x.summon.skipped : `${x.summon?.cardId}@${x.summon?.slot}`);
      row.summon = [...new Set(keys)].join(", ");
      row.sameSummon = new Set(keys).size === 1;
    }
    order.push(row);
  }
  const remote = runs.flatMap((r) => r.remoteRequests ?? []);
  const errors = runs.flatMap((r) => r.consoleErrors ?? []);
  // Clash route: every run must land its turn-1 summon, or there is no clash to time.
  const summonMissing = cfg.route === "clash" ? runs.filter((r) => !r.turns[0]?.summon?.cardId || r.turns[0].summon.skipped)
    .map((r) => `${r.mode} seed ${r.seed} sample ${r.sample}: ${r.turns[0]?.summon?.skipped ?? "no turn"}`) : [];
  return {issue: cfg.route === "clash" ? 128 : 125, route: cfg.route ?? "passive", measured: "real headless Chrome, CDP mouse/keyboard input, page performance clock",
    date: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles", timeZoneName: "short"}),
    chrome: runs[0]?.chrome ?? null, gpu: [...new Set(runs.map((r) => r.gpu))], node: process.version, platform: `${os.platform()} ${os.arch()} ${os.release()}`,
    html: {path: path.relative(root, path.join(cfg.dir, "index.html")), sha256: html}, config: {...cfg, dir: path.relative(root, cfg.dir)},
    pass: remote.length === 0 && errors.length === 0 && summonMissing.length === 0
      && order.every((o) => o.order !== "different" && o.sameEndState && o.sameSummon !== false),
    ...(cfg.route === "clash" ? {summonMissing} : {}), remoteRequests: remote, consoleErrors: errors, loadMs: summarize(runs.map((r) => r.loadMs)), table, order,
    runs: runs.map((r) => ({...r, turns: r.turns.map(({boardOrder, ...t}) => t)}))};
}

export function markdown(rec) {
  const f = (s) => (s.n ? `${s.median} (${s.min}–${s.max}, n=${s.n})` : "—");
  const lines = [`| Seed | Turn | Metric, ms: median (min–max) | ${rec.config.modes.join(" | ")} |`, `| --- | --- | --- | ${rec.config.modes.map(() => "---").join(" | ")} |`];
  for (const r of rec.table) lines.push(`| ${r.seed} | ${r.turn} | ${r.metric} | ${rec.config.modes.map((m) => f(r[m])).join(" | ")} |`);
  const clash = rec.config.route === "clash";
  lines.push("", `| Seed | Turn | Runs | Overlay states per run | Order | Same end state |${clash ? " Summon | Same summon |" : ""}`,
    `| --- | --- | --- | --- | --- | --- |${clash ? " --- | --- |" : ""}`);
  for (const o of rec.order) lines.push(`| ${o.seed} | ${o.turn} | ${o.runs} | ${o.steps} | ${o.order} | ${o.sameEndState} |${clash ? ` ${o.summon} | ${o.sameSummon} |` : ""}`);
  return lines.join("\n");
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const html = createHash("sha256").update(await readFile(path.join(cfg.dir, "index.html"))).digest("hex");
  const server = await serve(cfg.dir);
  const runs = [];
  try {
    for (let sample = 0; sample < cfg.samples; sample++) for (const seed of cfg.seeds) for (const mode of modeOrder(cfg.modes, sample)) {
      const r = await runOne({origin: server.origin, mode, seed, turns: cfg.turns, swiftshader: cfg.swiftshader, route: cfg.route});
      r.sample = sample;
      runs.push(r);
      process.stderr.write(`sample ${sample} seed ${seed} ${mode} ${cfg.route}: end phase → next input ${r.turns.map((t) => Math.round(t.toComplete)).join(", ")} ms\n`);
    }
  } finally { await server.close(); }
  const rec = receipt(cfg, runs, html);
  if (cfg.out) await writeFile(path.resolve(cfg.out), JSON.stringify(rec, null, 2) + "\n");
  console.log(JSON.stringify({pass: rec.pass, chrome: rec.chrome, gpu: rec.gpu, html: rec.html, loadMs: rec.loadMs,
    remoteRequests: rec.remoteRequests.length, consoleErrors: rec.consoleErrors.length}, null, 2));
  console.log(markdown(rec));
  process.exit(rec.pass ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
