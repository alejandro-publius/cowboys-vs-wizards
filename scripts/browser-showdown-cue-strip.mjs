// Cue strip: the ten Showdown placeholder cues (src/ui/showdown-cues.js) rendered by real headless Chrome
// at 0, 100 and 700 ms after the marks are applied, with normal and reduced motion, checked on the
// rendered pixels, plus a review sheet. Nothing in src/ changes; the run only reads it.
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-cue-strip.mjs dist/cowboys-vs-wizards-board-duel.html [outDir, default ../cue-media]
// Same Chrome launch and DevTools driving as browser-showdown-cues-check.mjs, and the same kind of harness
// page (graybox template and styles, the real mountShowdown screen, every card type in the decks).
//   A. Fixtures (synthetic, deterministic). The harness board is first reached by clicks on a fixed seed.
//      Then one hand-written engine event per cue kind, naming troops that are really on that board, goes
//      through the real cuesFor and the screen's own cue player. The player gets a manual clock via
//      cueOptions.timers and the CSS flash is paused and seeked with the Web Animations API, so each
//      sample is the state exactly t ms after the marks went on. The 700 ms step timer really fires
//      under normal motion, so the 700 ms frame shows the expiry as implemented. Reduced motion is the
//      emulated media feature and the player's own matchMedia check. The log line the fixture lights is
//      added by the run (tagged data-fixture), because the screen's log only holds real events.
//   B. Negative control: the same harness page with one extra rule that removes the cue outline. The
//      pixel check must fail on it while the class, data-cue, banner label and lit log line still match.
//   C. Normal entry smoke (no fixture, no manual clock): the built page, Play, Camp, Boot Hill (?seed=1)
//      by clicks with take cover, real 700 ms timers. The first cue it paints is captured as it appears
//      and after it expires, and checked on its pixels the same way.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {inflateSync} from "node:zlib";
import {build} from "esbuild";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440;
let height = 900;
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const builtPage = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? path.join(ROOT, "../cue-media"));
const raw = path.join(out, "raw");
await mkdir(raw, {recursive: true});

const KINDS = ["cover", "trap", "gear", "location", "raise", "sweep", "laststand", "set", "burn", "fatigue"];
const TIMES = [0, 100, 700];
const MOTIONS = ["normal", "reduced"];
const STEP = 700;
const OUTLINED = 0.9, CLEAR = 0.25;
const GOLD = [242, 210, 122], WHITE = [255, 255, 255];

// ---- PNG decode (8-bit RGB/RGBA, non-interlaced, as Chrome writes them) ----
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), tag = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (tag === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; assert.equal(data[8], 8); assert.equal(data[12], 0); }
    if (tag === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : assert.fail(`PNG colour type ${type}`);
  const src = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y += 1) {
    const f = src[y * (stride + 1)], line = src.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return {w, h, at: (x, y) => [px[(y * w + x) * bpp], px[(y * w + x) * bpp + 1], px[(y * w + x) * bpp + 2]]};
}
// The outline is 3px wide at a 2px offset, so its middle pixel line is 3.5px outside each edge of the box.
// Yields [x, y, edge] along that line, corners left out.
function* ring(r) {
  const top = Math.floor(r.y - 3.5), bottom = Math.floor(r.y + r.height + 3.5), left = Math.floor(r.x - 3.5), right = Math.floor(r.x + r.width + 3.5);
  for (let x = left + 3; x <= right - 3; x += 1) { yield [x, top, "top"]; yield [x, bottom, "bottom"]; }
  for (let y = top + 3; y <= bottom - 3; y += 1) { yield [left, y, "left"]; yield [right, y, "right"]; }
}
// Distance from p to the colours an outline can composite to over background b at element opacity o:
// the segment from b*(1-o)+white*o (flash start) to b*(1-o)+gold*o (rest). Disabled buttons (graybox.css,
// button:disabled { opacity: .6 }) draw their outline at o = 0.6, so the background must be known.
function outlineDistance(p, b, o) {
  const A = b.map((v, i) => v * (1 - o) + WHITE[i] * o), B = b.map((v, i) => v * (1 - o) + GOLD[i] * o);
  const d = A.map((v, i) => B[i] - v), q = p.map((v, i) => v - A[i]);
  const k = Math.max(0, Math.min(1, (q[0] * d[0] + q[1] * d[1] + q[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
  return Math.hypot(...p.map((v, i) => v - (A[i] + k * d[i])));
}
// Per edge of a place's ring: the share of pixels drawn as the cue outline (against the control frame as
// background) and the share that differ from the control at all. Pixels inside a zone (another target's
// box grown by 7px) are skipped, so a neighbour's outline is not counted.
function ringShare(img, bg, r, o, zones = []) {
  const e = {};
  for (const [x, y, edge] of ring(r)) {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    if (zones.some((z) => x >= z.x - 7 && x < z.x + z.width + 7 && y >= z.y - 7 && y < z.y + z.height + 7)) continue;
    const t = (e[edge] ??= {all: 0, hit: 0, changed: 0});
    const p = img.at(x, y), q = bg.at(x, y);
    t.all += 1;
    if (outlineDistance(p, q, o) < 40) t.hit += 1;
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 30) t.changed += 1;
  }
  const all = Object.values(e).reduce((n, t) => n + t.all, 0), hit = Object.values(e).reduce((n, t) => n + t.hit, 0);
  const edges = Object.fromEntries(Object.entries(e).map(([k, t]) => [k, {outline: Number((t.hit / t.all).toFixed(3)), changed: Number((t.changed / t.all).toFixed(3))}]));
  return {share: all ? Number((hit / all).toFixed(3)) : 0, edges};
}
// Share of ring pixels that changed between two frames (used for the smoke's expiry).
function ringChanged(a, b, r) {
  let hit = 0, all = 0;
  for (const [x, y] of ring(r)) { if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue; all += 1; const p = a.at(x, y), q = b.at(x, y); if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 30) hit += 1; }
  return all ? hit / all : 0;
}

// ---- harness page ----
// Two wrappers, used only in this bundle, hand the run the screen's session (to read the public board
// the fixtures name) and the screen's own cue player. The screen module itself is bundled unchanged.
async function buildHarness(file, extraCss = "") {
  const read = (name) => readFile(path.join(ROOT, name), "utf8");
  const abs = (p) => JSON.stringify(path.join(ROOT, p));
  const wrap = {
    name: "cue-strip-wrap",
    setup(b) {
      b.onResolve({filter: /\/showdown-(session|cues)\.js$/}, (args) => (args.namespace === "wrap" || !args.importer.endsWith("showdown-screen.js") ? undefined
        : {path: args.path.includes("session") ? "session" : "cues", namespace: "wrap"}));
      b.onLoad({filter: /.*/, namespace: "wrap"}, (args) => ({resolveDir: ROOT, contents: args.path === "session"
        ? `import {createShowdownSession as real} from ${abs("src/match/showdown-session.js")};
           export * from ${abs("src/match/showdown-session.js")};
           export function createShowdownSession(o) { return (window.__session = real(o)); }`
        : `import {createCuePlayer as real} from ${abs("src/ui/showdown-cues.js")};
           export * from ${abs("src/ui/showdown-cues.js")};
           export function createCuePlayer(root, o) { return (window.__player = real(root, o)); }`}));
    },
  };
  const entry = `import {mountShowdown} from "./src/ui/showdown-screen.js";
    import {cuesFor} from "./src/ui/showdown-cues.js";
    import {DECKS, cardOf, deckIds} from "./src/game/showdown/cards.js";
    // A manual clock for the cue player. In auto mode it is the real timer (used while the board is set up by clicks).
    const clock = {auto: true, now: 0, queue: [], next: 1,
      setTimeout(fn, ms) { if (this.auto) return setTimeout(fn, ms); const id = this.next++; this.queue.push({id, at: this.now + ms, fn}); return id; },
      clearTimeout(id) { clearTimeout(id); this.queue = this.queue.filter((t) => t.id !== id); },
      advance(ms) { const end = this.now + ms; for (;;) { this.queue.sort((a, b) => a.at - b.at); const t = this.queue[0];
        if (!t || t.at > end) break; this.queue.shift(); this.now = t.at; t.fn(); } this.now = end; },
      reset() { this.queue = []; this.now = 0; }};
    window.__strip = {clock, cuesFor, cardOf, deckIds};
    const decks = {cowboy: {...DECKS.cowboy, "cowboy-six-shooter": 2, "cowboy-sheriffs-office": 2, "cowboy-captured-dragon": 1},
      wizard: {...DECKS.wizard, "wizard-bone-armor": 2, "wizard-boneyard": 2}};
    document.getElementById("title-screen").hidden = true;
    const root = document.getElementById("showdown");
    root.hidden = false;
    const seed = Number(new URLSearchParams(location.search).get("seed") ?? 0);
    const campaign = {settle: (duel, won) => ({won, earned: {cards: [], packs: 0, captured: null}, intoDeck: [], grit: 0}),
      progress: () => ({offer: null}), trailDuel: () => null, duel: () => null, owned: () => 0, choose() {}};
    mountShowdown(root, {onHome() {}, campaign, cueOptions: {step: ${STEP}, timers: clock}}).start({name: "Cue strip", lesson: "Every card type in play.", level: 1, options: {decks}}, seed);`;
  const [template, style, showdownStyle, bundle] = await Promise.all([read("src/ui/graybox.html"), read("src/ui/graybox.css"), read("src/ui/showdown.css"),
    build({stdin: {contents: entry, resolveDir: ROOT, sourcefile: "cue-strip-harness.js"}, bundle: true, write: false, platform: "browser", target: "es2022", format: "iife", plugins: [wrap]})]);
  await writeFile(file, template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}${extraCss ? `\n/* negative control only */\n${extraCss}` : ""}`)
    .replace("@@SCRIPT@@", () => bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")));
  return pathToFileURL(file).href;
}

// ---- Chrome over DevTools (as in browser-showdown-cues-check.mjs) ----
async function launchChrome() {
  const profile = await mkdtemp("/tmp/kiro-showdown-cue-strip-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "--force-color-profile=srgb", `--window-size=${WIDTH},900`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
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

// What the page shows for the cue right now: banner labels, marked nodes with their rects, lit log lines.
const STATE = `(() => {
  const where = (n) => n.dataset.slot ? "slot " + n.dataset.slot : n.dataset.base ? n.dataset.base + " Base" : n.classList.contains("sd-side") ? n.dataset.side + " row" : n.id === "sd-location" ? "location line" : n.id;
  const rect = (n) => { const b = n.getBoundingClientRect(); return {x: b.x, y: b.y + scrollY, width: b.width, height: b.height}; };
  const marks = [...document.querySelectorAll("#sd-board .sd-cue, #sd-location.sd-cue")].map((n) => ({where: where(n), cue: n.dataset.cue ?? null,
    still: n.classList.contains("sd-cue-still"), animation: getComputedStyle(n).animationName, outline: getComputedStyle(n).outlineStyle + " " + getComputedStyle(n).outlineWidth, rect: rect(n)}));
  const opacity = (n) => { let o = 1; for (; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const places = [...document.querySelectorAll("#sd-board [data-slot], #sd-board [data-base], #sd-board .sd-side, #sd-location")].map((n) => ({where: where(n), rect: rect(n), opacity: opacity(n)}));
  return {labels: [...document.querySelectorAll("#sd-cue .sd-cue-label")].map((l) => l.dataset.cue), marks, places,
    lines: [...document.querySelectorAll("#sd-log li.sd-cue")].map((l) => ({text: l.textContent, fixture: l.hasAttribute("data-fixture")})),
    wizardIds: (document.getElementById("showdown").outerHTML.match(/wizard-[a-z-]+-\\d+/g) ?? [])};
})()`;

const chrome = await launchChrome();
const cdp = await connect(chrome.url);
const report = {page: path.basename(builtPage), chrome: CHROME, width: WIDTH, step: STEP, fixtures: [], negative: null, smoke: null, errors: []};
let failed = null;
try {
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  const metrics = (h) => send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: h, deviceScaleFactor: 1, mobile: false});
  await metrics(height);
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 20000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(25); }
    throw Error(`Timed out: ${expression}`);
  };
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
  };
  const exists = (selector) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const logLength = () => evaluate(`document.querySelectorAll('#sd-log li').length`);
  const over = () => exists(".sd-result");
  const actBy = async (selector) => { const before = await logLength(); await click(selector); await wait(`document.querySelectorAll('#sd-log li').length>${before}`); };
  // One turn by clicks, as in browser-showdown-cues-check.mjs: cards first, then each ready troop attacks or takes cover, then End turn.
  async function playTurn({cover = false, attack = true} = {}) {
    const skipped = new Set();
    for (let tries = 0; tries < 8 && !(await over()); tries += 1) {
      const card = await evaluate(`[...document.querySelectorAll('#sd-hand [data-card]:not(:disabled)')].map(n=>n.dataset.card).find(id=>!${JSON.stringify([...skipped])}.includes(id))??null`);
      if (!card) break;
      const before = await logLength();
      await click(`#sd-hand [data-card="${card}"]`);
      for (let i = 0; i < 3 && (await logLength()) === before && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
        const prompt = await evaluate(`document.getElementById('sd-prompt').textContent`);
        if (/as payment|to carry/.test(prompt)) await click("#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]");
        else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
        else break;
      }
      if ((await logLength()) === before) { skipped.add(card); if (!(await evaluate(`document.getElementById('sd-cancel').hidden`))) await click("#sd-cancel"); }
    }
    for (let tries = 0; tries < 3 && !(await over()); tries += 1) {
      const slot = await evaluate(`document.querySelector('#sd-board [data-side=cowboy] [data-own]')?.dataset.slot??null`);
      if (!slot) break;
      await click(`#sd-board [data-slot="${slot}"]`);
      if ((cover || !attack) && !(await evaluate(`document.getElementById('sd-cover').hidden`))) await actBy("#sd-cover");
      else if (attack && await exists(".sd-slot[data-enemy]")) await actBy(".sd-slot[data-enemy]");
      else if (attack && await exists("[data-enemy=base]")) await actBy("[data-enemy=base]");
      else { await click("#sd-cancel"); break; }
    }
    if (!(await over())) await actBy("#sd-end");
  }
  const shot = async (file, clip) => {
    const {data} = await send("Page.captureScreenshot", {format: "png", ...(clip ? {clip: {...clip, scale: 1}, captureBeyondViewport: true} : {})});
    const buf = Buffer.from(data, "base64");
    await writeFile(path.join(raw, file), buf);
    return buf;
  };
  const fitHeight = async () => {
    const h = await evaluate(`Math.ceil(document.documentElement.scrollHeight)`);
    if (h !== height) { height = h; await metrics(height); }
    await evaluate(`scrollTo(0,0)`);
  };
  const cropOf = (rects) => {
    const pad = 24, x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad), y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
    const x1 = Math.min(WIDTH, Math.max(...rects.map((r) => r.x + r.width)) + pad), y1 = Math.min(height, Math.max(...rects.map((r) => r.y + r.height)) + pad);
    return {x: Math.floor(x0), y: Math.floor(y0), width: Math.ceil(x1 - x0), height: Math.ceil(y1 - y0)};
  };
  // Ring share for every board place in one frame: targets must be outlined, every other place not.
  // Places nested in a marked row are skipped as non-targets: their ring lies inside the row's outline box.
  // Non-targets skip pixels within 7px of a target box (a neighbour's or a parent row's ring touches it there).
  function measure(img, bg, state, targets) {
    const rows = targets.filter((t) => t.endsWith(" row")).map((t) => t.split(" ")[0]);
    const zones = state.places.filter((p) => targets.includes(p.where)).map((p) => p.rect);
    return state.places.map((p) => ({where: p.where, target: targets.includes(p.where), opacity: Number(p.opacity.toFixed(2)),
      inMarkedRow: !targets.includes(p.where) && rows.some((side) => p.where.startsWith(`slot ${side}-`) || p.where === `${side} Base`),
      ...ringShare(img, bg, p.rect, p.opacity, targets.includes(p.where) ? [] : zones)}));
  }

  // An outlined target: every edge drawn in the cue colour on >= 90% of its pixels ("full"), or three edges full
  // and the fourth changed from the control on >= 90% but dimmed ("dimmed edge", reported as a finding: the
  // next element paints over it). Not outlined: every edge <= 25%. Non-targets: <= 25% overall.
  const edgeVerdict = (r) => {
    const v = Object.values(r.edges);
    const full = v.filter((t) => t.outline >= OUTLINED).length;
    return full === v.length ? "full" : full === v.length - 1 && v.every((t) => t.outline >= OUTLINED || t.changed >= OUTLINED) ? "dimmed edge" : "missing";
  };
  const judge = (rings, outlined) => rings.every((r) => (r.target ? (outlined ? edgeVerdict(r) !== "missing" : Object.values(r.edges).every((t) => t.outline <= CLEAR)) : r.inMarkedRow || r.share <= CLEAR));
  const dimmed = (rings) => rings.filter((r) => r.target && edgeVerdict(r) === "dimmed edge")
    .map((r) => `${r.where}: ${Object.entries(r.edges).filter(([, t]) => t.outline < OUTLINED).map(([k, t]) => `${k} edge ${t.outline} in cue colour, ${t.changed} changed`).join("")}`);

  // ---- A. fixtures ----
  const harnessFile = path.join(out, "cue-strip-harness.html");
  const harness = await buildHarness(harnessFile);
  // A fixed seed whose board, by these clicks, ends with Cowboy slots 0 and 1 and two Wizard troops filled,
  // a location in play, on the Cowboys' turn. The search is deterministic; the chosen seed is reported.
  let board = null, setupSeed = null, setupTurns = 0;
  for (let seed = 0; seed < 40 && !board; seed += 1) {
    await send("Page.navigate", {url: `${harness}?seed=${seed}`});
    await wait(`document.readyState==='complete'&&document.querySelector('#sd-board [data-side=cowboy]')&&window.__session`);
    for (let turn = 0; turn < 10 && !(await over()); turn += 1) {
      const v = await evaluate(`(()=>{const v=__session.view();return{active:v.active,location:v.location?.cardId??null,result:v.result??null,
        cowboy:v.sides.cowboy.board.map(t=>t?.cardId??null),wizard:v.sides.wizard.board.map(t=>t?.cardId??null)}})()`);
      if (!v.result && v.active === "cowboy" && v.cowboy[0] && v.cowboy[1] && v.wizard.filter(Boolean).length >= 2 && v.location) { board = v; setupSeed = seed; setupTurns = turn; break; }
      await playTurn({attack: turn >= 3, cover: false});
    }
  }
  assert.ok(board, "no seed reached the fixture board");
  // Let the screen's own cues from the setup clicks finish on real time, then switch to the manual clock.
  await wait(`!document.querySelector('#sd-cue .sd-cue-label')`, 10000);
  await evaluate(`__strip.clock.auto=false;__strip.clock.reset();__player.clear()`);
  await fitHeight();
  const cw = board.cowboy, wz = board.wizard.map((id, slot) => ({id, slot})).filter((t) => t.id);
  const wizTrap = await evaluate(`__strip.deckIds("wizard").find(id=>__strip.cardOf(id).kind==="trap")`);
  // One synthetic EVENTS entry per kind, naming troops on this board. Payload fields follow contract.js.
  const FIXTURE = {
    cover: {type: "cover", side: "cowboy", cardId: cw[0]},
    trap: {type: "trap", side: "wizard", cardId: wizTrap, target: cw[1], left: 1, stopped: true},
    gear: {type: "gear", side: "cowboy", cardId: "cowboy-six-shooter-1", target: cw[1]},
    location: {type: "location", side: "cowboy", cardId: "cowboy-sheriffs-office-1"},
    raise: {type: "raise", side: "cowboy", cardId: cw[0]},
    sweep: {type: "sweep", side: "cowboy", cardId: cw[0], count: wz.length - 1},
    laststand: {type: "laststand", side: "wizard", cardId: wz[0].id, target: cw[1], left: 1},
    set: {type: "set", side: "cowboy"},
    burn: {type: "burn", side: "cowboy", cardId: "cowboy-sheriff-4"},
    fatigue: {type: "fatigue", side: "wizard"},
  };
  const TARGETS = {
    cover: ["slot cowboy-0"], trap: ["wizard Base", "slot cowboy-1"], gear: ["slot cowboy-1"], location: ["location line"], raise: ["slot cowboy-0"],
    sweep: ["slot cowboy-0", "wizard row"], laststand: [`slot wizard-${wz[0].slot}`, "slot cowboy-1"], set: ["cowboy Base"], burn: ["cowboy Base"], fatigue: ["wizard Base"],
  };
  report.setup = {seed: setupSeed, cowboyTurnsPlayed: setupTurns, cowboySlotsFilled: cw.map(Boolean), wizardSlotsFilled: board.wizard.map(Boolean), locationInPlay: true};
  const fixtureCue = (kind) => evaluate(`(()=>{const e=${JSON.stringify(FIXTURE[kind])};const v=__session.view();let before=v;
    if(e.type==="raise"){before=structuredClone(v);const s=before.sides[e.side].board.findIndex(t=>t?.cardId===e.cardId);before.sides[e.side].board[s]=null;}
    const [cue]=__strip.cuesFor([e],before,v);return {...cue,line:90000};})()`);
  // Applies one cue at t=0 on the manual clock, then moves both the clock and the paused flash to t.
  async function sample(cue, t) {
    await evaluate(`(()=>{__player.clear();__strip.clock.reset();document.querySelectorAll('#sd-log [data-fixture]').forEach(n=>n.remove());
      const li=document.createElement('li');li.dataset.line="90000";li.dataset.cueKind=${JSON.stringify(cue.kind)};li.dataset.fixture="";li.textContent=${JSON.stringify(cue.text)};
      document.getElementById('sd-log').append(li);
      __player.play([${JSON.stringify(cue)}]);
      for(const a of document.getAnimations()){a.pause();a.currentTime=0;}
      __strip.clock.advance(${t});
      for(const a of document.getAnimations()){a.pause();a.currentTime=${t};}})()`);
    await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    return evaluate(STATE);
  }
  const unmark = () => evaluate(`__player.clear();document.querySelectorAll('#sd-log [data-fixture]').forEach(n=>n.remove());`);

  async function runFixtures({negative = false} = {}) {
    const results = [], controls = {};
    for (const motion of MOTIONS) {
      await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: motion === "reduced" ? "reduce" : "no-preference"}]});
      for (const kind of KINDS) {
        const cue = await fixtureCue(kind);
        const targets = TARGETS[kind];
        assert.deepEqual(cue.marks.length, targets.length, `${kind}: cuesFor marks ${JSON.stringify(cue.marks)}`);
        const tag = negative ? "negative" : "fixture";
        let control = controls[kind];
        if (!control) {
          await unmark();
          const state = await evaluate(STATE);
          const img = decodePng(await shot(`${tag}-${kind}-before.png`));
          const crop = cropOf(state.places.filter((p) => targets.includes(p.where)).map((p) => p.rect));
          await shot(`${tag}-${kind}-before-crop.png`, crop);
          const rings = measure(img, img, state, targets);
          control = {img, file: `${tag}-${kind}-before.png`, crop: `${tag}-${kind}-before-crop.png`, clip: crop, rings, clear: judge(rings, false)};
        }
        const frames = [];
        for (const t of TIMES) {
          const state = await sample(cue, t);
          const name = `${tag}-${kind}-${motion}-${t}ms`;
          const img = decodePng(await shot(`${name}.png`));
          await shot(`${name}-crop.png`, control.clip);
          // As implemented: normal motion shows one cue for one 700 ms step, then the player clears it;
          // reduced motion shows the batch, still, until the next batch or a clear.
          const expectMarked = motion === "reduced" || t < STEP;
          const functional = expectMarked
            ? state.labels.join() === kind && state.marks.length === targets.length && state.marks.every((m) => m.cue === kind && targets.includes(m.where))
              && state.marks.every((m) => (motion === "reduced" ? m.still && m.animation === "none" : !m.still && m.animation === "sd-cue-flash"))
              && state.lines.length === 1 && state.lines[0].fixture
            : !state.labels.length && !state.marks.length && !state.lines.length;
          const rings = measure(img, control.img, state, targets);
          const pixels = judge(rings, expectMarked);
          assert.deepEqual(state.wizardIds, [], "Wizard card id in the page");
          frames.push({t, motion, file: `${name}.png`, crop: `${name}-crop.png`, expectMarked, functional, pixels, dimmed: expectMarked ? dimmed(rings) : [],
            labels: state.labels, marks: state.marks.map(({rect, ...m}) => m), litLine: state.lines[0]?.text ?? null, rings});
        }
        await unmark();
        results.push({kind, motion, event: FIXTURE[kind], text: cue.text, targets, control: {...control, img: undefined}, frames});
        controls[kind] = control;
        console.log(`${negative ? "negative" : "fixture"} ${kind} ${motion}: ${frames.map((f) => `${f.t}ms functional=${f.functional} pixels=${f.pixels}`).join(", ")}`);
      }
    }
    await send("Emulation.setEmulatedMedia", {features: []});
    return results;
  }
  report.fixtures = await runFixtures();
  const fixturesOk = report.fixtures.every((r) => r.control.clear && r.frames.every((f) => f.functional && f.pixels));
  assert.ok(fixturesOk, "a fixture frame failed its functional or pixel check (see report.json)");
  console.log("ok - 10 cues x normal/reduced x 0/100/700 ms: functional state and rendered outline match on every frame");

  // ---- B. negative control: same harness, same seed and clicks, outline removed by one extra rule ----
  const negFile = path.join(out, "cue-strip-negative.html");
  const negCss = "#showdown .sd-cue { outline: none !important; }";
  const negative = await buildHarness(negFile, negCss);
  await send("Page.navigate", {url: `${negative}?seed=${setupSeed}`});
  await wait(`document.readyState==='complete'&&document.querySelector('#sd-board [data-side=cowboy]')&&window.__session`);
  for (let turn = 0; turn < setupTurns; turn += 1) await playTurn({attack: turn >= 3, cover: false});
  const negBoard = await evaluate(`(()=>{const v=__session.view();return{cowboy:v.sides.cowboy.board.map(t=>t?.cardId??null),wizard:v.sides.wizard.board.map(t=>t?.cardId??null)}})()`);
  assert.deepEqual(negBoard, {cowboy: board.cowboy, wizard: board.wizard}, "negative page reached a different board");
  await wait(`!document.querySelector('#sd-cue .sd-cue-label')`, 10000);
  await evaluate(`__strip.clock.auto=false;__strip.clock.reset();__player.clear()`);
  await fitHeight();
  const neg = await runFixtures({negative: true});
  const marked = neg.flatMap((r) => r.frames.filter((f) => f.expectMarked));
  report.negative = {css: negCss, markedFrames: marked.length, functionalStillTrue: marked.filter((f) => f.functional).length,
    pixelFailures: marked.filter((f) => !f.pixels).length, results: neg};
  assert.equal(report.negative.functionalStillTrue, marked.length, "negative control: functional state should be unchanged");
  assert.equal(report.negative.pixelFailures, marked.length, "negative control: every marked frame must fail the pixel check");
  console.log(`ok - negative control: outline removed, ${marked.length}/${marked.length} marked frames keep class/label/log line and all fail the pixel check`);

  // ---- C. normal entry smoke: built page, real clicks, real timers, no fixture ----
  height = 900; await metrics(height);
  await send("Page.navigate", {url: `${builtPage}?seed=1`});
  await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
  await click("#menu-play");
  await wait(`document.querySelector('#showdown-camp [data-duel=trail]')`);
  await click("#showdown-camp [data-duel=trail]");
  await wait(`document.querySelector('#sd-board [data-side=cowboy]')`);
  await wait(`!document.querySelector('#sd-cue .sd-cue-label')`, 10000);
  let smoke = null;
  for (let turn = 0; turn < 30 && !smoke && !(await over()); turn += 1) {
    const slot = await evaluate(`document.querySelector('#sd-board [data-side=cowboy] [data-own]')?.dataset.slot??null`);
    if (slot) {
      await click(`#sd-board [data-slot="${slot}"]`);
      if (!(await evaluate(`document.getElementById('sd-cover').hidden`))) {
        await fitHeight();
        await evaluate(`window.__seen=null;new MutationObserver((m,o)=>{if(document.querySelector('#sd-cue .sd-cue-label')){window.__seen=performance.now();o.disconnect();}}).observe(document.getElementById('sd-cue'),{childList:true,subtree:true})`);
        const target = `slot ${slot}`;
        await click("#sd-cover");
        await wait(`window.__seen!==null`, 5000);
        const first = await evaluate(STATE);
        const age = await evaluate(`performance.now()-window.__seen`);
        const img = decodePng(await shot("smoke-cover-shown.png"));
        const clip = cropOf(first.places.filter((p) => p.where === target).map((p) => p.rect));
        await shot("smoke-cover-shown-crop.png", clip);
        await wait(`!document.querySelector('#sd-cue .sd-cue-label')`, 5000);
        const gone = await evaluate(`performance.now()-window.__seen`);
        const after = await evaluate(STATE);
        const img2 = decodePng(await shot("smoke-cover-expired.png"));
        await shot("smoke-cover-expired-crop.png", clip);
        // Background for the shown frame is the expired frame: same board, cue gone.
        const shownRings = measure(img, img2, first, [target]);
        const goneRings = [{where: target, target: true, changedFromShown: Number(ringChanged(img, img2, first.places.find((p) => p.where === target).rect).toFixed(3))}];
        smoke = {seed: 1, turn, target, labels: first.labels, marks: first.marks.map(({rect, ...m}) => m), litLine: first.lines[0]?.text ?? null,
          shownAtMs: Math.round(age), clearedAtMs: Math.round(gone), shownPixels: judge(shownRings, true), expiredPixels: !after.marks.length && !after.labels.length && goneRings[0].changedFromShown >= OUTLINED,
          shownRings: shownRings.filter((r) => r.target), expiredRings: goneRings.filter((r) => r.target),
          files: ["smoke-cover-shown.png", "smoke-cover-shown-crop.png", "smoke-cover-expired.png", "smoke-cover-expired-crop.png"]};
        break;
      }
      await click("#sd-cancel");
    }
    await playTurn({cover: false});
  }
  assert.ok(smoke, "Boot Hill never offered take cover");
  report.smoke = smoke;
  assert.deepEqual(smoke.labels, ["cover"]);
  assert.ok(smoke.marks.length === 1 && smoke.marks[0].where === smoke.target && smoke.marks[0].animation === "sd-cue-flash", JSON.stringify(smoke.marks));
  assert.ok(smoke.litLine && /took cover/.test(smoke.litLine));
  assert.ok(smoke.shownPixels && smoke.expiredPixels, "smoke pixel check");
  assert.ok(smoke.clearedAtMs >= STEP - 50, `cleared too early: ${smoke.clearedAtMs} ms`);
  console.log(`ok - normal entry smoke: Boot Hill take cover on ${smoke.target}, outlined in pixels ${smoke.shownAtMs} ms after it painted, cleared ${smoke.clearedAtMs} ms after`);

  // ---- review sheet: HTML rendered by the same Chrome to PDF, plus a PNG of its overview ----
  const sheet = sheetHtml(report);
  await writeFile(path.join(out, "cue-proof-sheet.html"), sheet);
  height = 900; await metrics(height);
  await send("Page.navigate", {url: pathToFileURL(path.join(out, "cue-proof-sheet.html")).href});
  await wait(`document.readyState==='complete'&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);
  const pdf = await send("Page.printToPDF", {printBackground: true, preferCSSPageSize: true});
  await writeFile(path.join(out, "cue-proof-sheet.pdf"), Buffer.from(pdf.data, "base64"));
  const ov = await evaluate(`(()=>{const b=document.getElementById('overview').getBoundingClientRect();return{x:0,y:b.y,width:${WIDTH},height:Math.ceil(b.height)}})()`);
  const {data} = await send("Page.captureScreenshot", {format: "png", clip: {...ov, scale: 1}, captureBeyondViewport: true});
  await writeFile(path.join(out, "cue-proof-overview.png"), Buffer.from(data, "base64"));
} catch (error) {
  failed = error;
  report.failure = String(error.stack ?? error);
} finally {
  cdp.close();
  await chrome.close();
}
if (!failed && report.errors.length) failed = new Error(`page errors: ${report.errors.join(" | ")}`);
report.passed = !failed;
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`report: ${path.join(out, "report.json")}`);
if (failed) { console.error(failed); process.exit(1); }

function sheetHtml(r) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
  const img = (f) => `<img src="raw/${f}" alt="${esc(f)}">`;
  const mark = (ok) => (ok ? '<b class="ok">PASS</b>' : '<b class="no">FAIL</b>');
  const share = (f) => f.rings.filter((x) => x.target).map((x) => `${esc(x.where)} ${x.share}`).join("; ");
  const byKind = (kind) => r.fixtures.filter((x) => x.kind === kind);
  const NOTE = {sweep: "Sweep marks the attacker and the whole enemy row. The event counts the troops hit, not which ones, so no single enemy slot is marked.",
    trap: "Variant shown: cancelled (stopped). The trap owner's Base and the attacking troop are marked.", laststand: "Variant shown: wounded (left 1).",
    location: "The location line above the board is the mark. The fixture names Sheriff's Office, but a fixture changes no state, so the line still shows the board's real location; only the outline is under test.",
    gear: "A fixture changes no state: the troop does not show the gear; only the outline is under test.", raise: "The fixture's 'before' view has this troop out of slot 0, so the cue follows it onto slot 0."};
  const rows = KINDS.map((kind) => {
    const [n, d] = byKind(kind);
    const cell = (x) => x.frames.map((f) => `<td>${mark(f.functional && f.pixels)}<br><small>${f.expectMarked ? "outlined" : "expired"}${f.dimmed.length ? "; one edge dimmed" : ""}</small></td>`).join("");
    return `<tr><th>${kind}</th><td>${esc(n.targets.join(" + "))}</td><td>${mark(n.control.clear)}</td>${cell(n)}${cell(d)}<td class="init"></td></tr>`;
  }).join("");
  const pages = KINDS.map((kind) => {
    const [n, d] = byKind(kind);
    const strip = (x) => x.frames.map((f) => `<figure>${img(f.crop)}<figcaption><b>${f.motion} · ${f.t} ms</b> ${mark(f.functional && f.pixels)} · ${f.expectMarked ? "expected outlined" : "expected expired"}<br>
      ring share: ${esc(share(f))}${f.dimmed.length ? `<br><b>dimmed edge:</b> ${esc(f.dimmed.join("; "))}` : ""}<br>marks: ${esc(f.marks.map((m) => `${m.where}${m.still ? " (still)" : ""} anim=${m.animation}`).join(", ") || "none")}</figcaption></figure>`).join("");
    return `<section class="cue"><h2>${kind} <small>“${esc(n.text)}”</small></h2>
      <p>Synthetic fixture event (not real play): <code>${esc(JSON.stringify(n.event))}</code><br>Expected targets: <b>${esc(n.targets.join(" + "))}</b>. ${esc(NOTE[kind] ?? "")}</p>
      <div class="strip"><figure>${img(n.control.crop)}<figcaption><b>before / control</b> (no cue) ${mark(n.control.clear)}<br>ring share: ${esc(share({rings: n.control.rings}))}</figcaption></figure></div>
      <div class="strip">${strip(n)}</div><div class="strip">${strip(d)}</div>
      <p class="sign">Alex — looks right? Initials: ________ Date: ________ Notes: ____________________________________________</p></section>`;
  }).join("");
  const s = r.smoke, ng = r.negative;
  const ngFrames = ng.results.filter((x) => ["cover", "sweep"].includes(x.kind)).flatMap((x) => x.frames.filter((f) => f.t === 0));
  return `<!doctype html><meta charset="utf-8"><title>Showdown cue strip — review sheet</title><style>
    @page { size: 16in 24in; margin: .4in; }
    body { font: 13px/1.35 -apple-system, Helvetica, Arial, sans-serif; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 .3em; } h2 { font-size: 18px; margin: 0 0 .3em; } h2 small { font-weight: normal; color: #444; }
    table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 3px 6px; text-align: center; vertical-align: middle; }
    .ok { color: #0a6b1f; } .no { color: #b00020; } td.init { width: 7em; }
    section { break-before: page; } .strip { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0; align-items: flex-start; }
    figure { margin: 0; } figure img { display: block; border: 1px solid #333; max-width: none; } figcaption { font-size: 12px; max-width: 460px; }
    .sign { font-size: 15px; margin-top: 10px; } code { font-size: 11px; } .thumb img { width: 720px; border: 1px solid #333; }
  </style><body><div id="overview">
  <h1>Showdown placeholder cues — rendered proof sheet</h1>
  <p>Build: ${esc(r.page)}, Chrome headless (${esc(r.chrome.split("/").at(-2) ?? "Chrome")}), viewport ${r.width} px wide at device scale 1, cue step ${r.step} ms.
  Crops on the cue pages are at actual board scale (1 CSS px = 1 image px; view the PDF at 100%). The overview thumbnail below is scaled down.</p>
  <p><b>Which evidence is which.</b> (A) <b>Fixtures</b>: synthetic, deterministic. A harness board reached by clicks on seed ${r.setup.seed}
  (${r.setup.cowboyTurnsPlayed} Cowboy turns) then one hand-written engine event per cue kind sent through the real <code>cuesFor</code> and the screen's own cue player,
  with a manual clock and the CSS flash paused and seeked to t. The lit log line on fixture frames is added by the run (data-fixture). (B) <b>Negative control</b>: the same harness with
  <code>${esc(ng.css)}</code> added. (C) <b>Normal entry smoke</b>: the built page, Play → Camp → Boot Hill (?seed=1) by clicks, real 700 ms timers, no fixture.</p>
  <p>Pixel rule, per target and per edge, on the outline's middle pixel line 3.5 px outside the box: a pixel counts when it matches the cue colour (white → #f2d27a)
  composited over the control frame's pixel at the element's opacity (disabled buttons are at 0.6 in graybox.css). A target passes when all four edges are ≥ ${OUTLINED * 100}%,
  or three are and the fourth differs from the control on ≥ ${OUTLINED * 100}% of its pixels but is dimmed (“one edge dimmed”: a later element paints over that edge);
  every place that is not a target must be ≤ ${CLEAR * 100}% away from a target (places inside a marked row are not judged). An expired frame needs every target edge ≤ ${CLEAR * 100}%.</p>
  <table><tr><th rowspan="2">cue</th><th rowspan="2">targets</th><th rowspan="2">before</th><th colspan="3">normal motion</th><th colspan="3">reduced motion</th><th rowspan="2">Alex initials</th></tr>
  <tr><th>0 ms</th><th>100 ms</th><th>700 ms</th><th>0 ms</th><th>100 ms</th><th>700 ms</th></tr>${rows}</table>
  <p>Normal motion, as implemented: one cue per 700 ms step, then the player clears it, so 700 ms shows no outline. Reduced motion: the batch stays, still, until the next batch, so 700 ms is still outlined.</p>
  <p><b>(B) negative control</b>: ${ng.markedFrames} frames that should be outlined; class, data-cue, banner label and lit log line still correct on ${ng.functionalStillTrue}; pixel check failed on ${ng.pixelFailures}.</p>
  <div class="strip">${ngFrames.map((f) => `<figure>${img(f.crop)}<figcaption><b>negative · ${esc(f.file.split("-")[1])} · ${f.motion} · 0 ms</b> functional ${f.functional ? "true" : "false"}, pixels ${mark(f.pixels)}<br>ring share: ${esc(share(f))}</figcaption></figure>`).join("")}</div>
  <p><b>(C) normal entry smoke</b>: Boot Hill turn ${s.turn + 1}, take cover on ${esc(s.target)}. Captured ${s.shownAtMs} ms after the label painted (wall clock, not seeked): ${mark(s.shownPixels)};
  cleared ${s.clearedAtMs} ms after: ${mark(s.expiredPixels)}. Log line: “${esc(s.litLine)}”.</p>
  <div class="strip"><figure>${img(s.files[1])}<figcaption>smoke: shown · ring share ${esc(s.shownRings.map((x) => x.share).join())}</figcaption></figure>
  <figure>${img(s.files[3])}<figcaption>smoke: expired · ring pixels changed from shown ${esc(s.expiredRings.map((x) => x.changedFromShown).join())}</figcaption></figure></div>
  <div class="thumb"><figure>${img(byKind("sweep")[0].frames[0].file)}<figcaption>Full board, sweep fixture, normal 0 ms (scaled to 50%).</figcaption></figure></div>
  </div>${pages}</body>`;
}
