// Headless Chrome check of the ?guide=1 preview in built pages (no extra dependency; DevTools protocol over Node's WebSocket).
//
//   node scripts/build.mjs && node scripts/browser-guide-check.mjs --base PATH/TO/pre-change/dist/cowboys-vs-wizards-board-duel.html [--out-dir DIR]
//
// Plays seed 0 with real mouse clicks through the same route in four runs: the current build with ?guide=1, the
// current build without it, the current build with ?guide=0, and --base (a build of the commit before the change).
// For each step it records the prompt text, whether the prompt is really visible (no hidden ancestor, no display:none,
// visibility, opacity 0 or empty box, and inside the viewport) and which selection buttons are visible. It fails (exit 1) unless:
//   - guide-off states equal the base build's states, step for step (prompt, panel and button visibility);
//   - with the guide on, the opening, end-phase and first-clash tips are visible, each prompt starts with the guide-off prompt,
//     and the Confirm/Cancel/Skip buttons are visible only at steps where a card is selected;
//   - the guide stops in round 3 (after the first tribute summon) and at the match result, and restart brings the opening tip back.
// Both pages must be illustrated builds (the offline file is shared with the graybox build, which is refused).
// Screenshots (desktop 1440x900) and a mobile-size (390x844) legibility check go to docs/evidence/guided-first-match/ by default.
// Target: the earlier illustrated build (lane duel, 3D board), built by `npm run build:art -- --web`
// and published at /3d/. The graybox build (`npm run build`) is Showdown only since #143 slice 3
// and has none of the lane screens this script drives.
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const page = path.join(root, "dist/cowboys-vs-wizards-board-duel.html");
const basePage = option("--base");
if (!basePage) throw new Error("--base needs the pre-change build's HTML path");
for (const file of [page, basePage]) if (!(await readFile(file, "utf8")).includes('class="title-art"')) throw new Error(`${file} is not the illustrated build; run node scripts/build.mjs`);
const outDir = path.resolve(option("--out-dir") ?? path.join(root, "docs/evidence/guided-first-match"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUERY = "?mode=match&deck=starter&seed=0";

async function launch(width, height) {
  const profile = await mkdtemp("/tmp/guide-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--mute-audio", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding", `--window-size=${width},${height}`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no DevTools URL in 30 s")), 30000);
    child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
  });
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
  const waiting = new Map(); let next = 0; const errors = [];
  ws.addEventListener("message", ({data}) => {
    const m = JSON.parse(data);
    if (m.id === undefined) {
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
      return;
    }
    const e = waiting.get(m.id); waiting.delete(m.id);
    if (m.error) e?.reject(new Error(m.error.message)); else e?.resolve(m.result);
  });
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++next; waiting.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const {targetInfos} = await raw("Target.getTargets");
  const {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
  const send = (method, params) => raw(method, params, sessionId);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile: width < 600});
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  return {send, errors, async close() { ws.close(); child.kill("SIGTERM"); await sleep(500); child.kill("SIGKILL"); await rm(profile, {recursive: true, force: true, maxRetries: 5}); }};
}

// Page-side: state of the prompt, selection panel and buttons, with real visibility.
const SNAPSHOT = `(() => {
  const m = document.querySelector("#match");
  if (!m || m.hidden) return {loading: true};
  const shown = (n) => {
    if (!n) return false;
    for (let e = n; e && e !== document.documentElement; e = e.parentElement) {
      if (e.hidden) return false;
      const c = getComputedStyle(e);
      if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
    }
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const t = (s) => (document.querySelector(s)?.textContent.trim() ?? null);
  const p = m.querySelector(".match-prompt");
  const r = p.getBoundingClientRect();
  const btn = (a) => { const b = m.querySelector('.selection-actions [data-action="' + a + '"]'); return {visible: shown(b), enabled: Boolean(b) && !b.disabled}; };
  return {status: m.dataset.status, details: t("#match .match-details p"), prompt: p.textContent.trim(), promptVisible: shown(p),
    panelHidden: m.querySelector(".selection-panel").hidden, live: p.getAttribute("role"),
    fontPx: parseFloat(getComputedStyle(p).fontSize), clipped: p.scrollWidth > p.clientWidth + 1,
    promptRect: {l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)}, viewport: [innerWidth, innerHeight],
    buttons: {confirm: btn("confirm"), cancel: btn("cancel"), skip: btn("skip")},
    selected: Boolean(m.querySelector(".match-hand [aria-pressed=true]")),
    endPhaseEnabled: !m.querySelector('[data-action="end-phase"]').disabled,
    result: (() => { const x = m.querySelector(".match-result"); return x && !x.hidden ? x.textContent.trim().slice(0, 60) : null; })(),
    hand: [...m.querySelectorAll(".match-hand .card-front")].map((b) => ({id: b.dataset.cardId, name: b.querySelector(".front-face")?.dataset.unit, disabled: b.disabled}))};
})()`;

async function drive(url, {width = 1440, height = 900, shots = null, shotPrefix = ""} = {}) {
  const c = await launch(width, height);
  const states = {};
  try {
    const evaluate = async (expression) => {
      const {result, exceptionDetails} = await c.send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    const snap = async () => { try { return await evaluate(SNAPSHOT); } catch { return {loading: true}; } };
    const waitFor = async (label, ok, timeout = 60000) => {
      const t0 = Date.now(); let last;
      while (Date.now() - t0 < timeout) { last = await snap(); if (!last.loading && ok(last)) return last; await sleep(80); }
      throw new Error(`timeout waiting for ${label}: ${JSON.stringify(last)?.slice(0, 300)}`);
    };
    const click = async (selector) => {
      const box = await evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return {error: "missing"};
        const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
        return h && n.contains(h) ? {x, y} : {error: "covered by " + (h ? h.tagName + "." + h.className : "nothing")}; })()`);
      if (box.error) throw new Error(`cannot click ${selector}: ${box.error}`);
      for (const [type, extra] of [["mouseMoved", {}], ["mousePressed", {button: "left", buttons: 1, clickCount: 1}], ["mouseReleased", {button: "left", clickCount: 1}]]) {
        await c.send("Input.dispatchMouseEvent", {type, x: box.x, y: box.y, ...extra});
      }
    };
    const card = (s, name) => `#match .match-hand [data-card-id="${s.hand.find((h) => h.name === name).id}"]`;
    const lane = (slot) => `#match .match-slot[data-side="cowboy"][data-slot="${slot}"]`;
    const idle = (s) => s.status === "accepting_input" && !s.selected;
    const record = async (label, s) => {
      states[label] = s;
      if (shots?.[label]) { await mkdir(outDir, {recursive: true});
        await writeFile(path.join(outDir, shotPrefix + shots[label]), Buffer.from((await c.send("Page.captureScreenshot", {format: "png"})).data, "base64")); }
    };
    await c.send("Page.navigate", {url});
    let s = await waitFor("opening", (x) => idle(x) && /Round 1/.test(x.details));
    await sleep(600); s = await snap(); await record("1-opening-idle", s);
    await click(card(s, "Sheriff")); s = await waitFor("lane step", (x) => x.selected); await record("2-lane-step", s);
    await click(lane(0)); s = await waitFor("confirm step", (x) => x.buttons.confirm.enabled); await record("3-confirm-step", s);
    await click('#match .selection-actions [data-action="confirm"]'); s = await waitFor("after summon", (x) => idle(x) && !x.hand.some((h) => h.name === "Sheriff"));
    await sleep(500); s = await snap(); await record("4-end-phase-idle", s);
    await click('#match [data-action="end-phase"]'); s = await waitFor("round 2", (x) => idle(x) && /Round 2/.test(x.details)); await sleep(800); s = await snap();
    await record("5-first-clash-idle", s);
    if (width < 600) return {states, errors: c.errors};
    await click(card(s, "Billy")); s = await waitFor("tribute step", (x) => x.selected); await record("6-tribute-step", s);
    await click(lane(0)); s = await waitFor("slot step", (x) => x.selected && x.prompt !== states["6-tribute-step"].prompt); await record("7-tribute-chosen", s);
    await click(lane(0)); s = await waitFor("confirm step", (x) => x.buttons.confirm.enabled); await record("8-confirm-step", s);
    await click('#match .selection-actions [data-action="confirm"]'); s = await waitFor("after tribute", (x) => idle(x) && !x.hand.some((h) => h.name === "Billy")); await sleep(500); s = await snap();
    await record("9-after-tribute-idle", s);
    await click('#match [data-action="end-phase"]'); s = await waitFor("round 3", (x) => idle(x) && /Round 3/.test(x.details)); await sleep(800); s = await snap();
    await record("10-round3-idle", s);
    for (let i = 0; i < 40 && !s.result; i++) {
      await click('#match [data-action="end-phase"]');
      s = await waitFor("next idle or result", (x) => x.result || (idle(x) && x.details !== states[`last`]?.details) || x.status === "terminal", 90000);
      states.last = s; await sleep(400); s = await snap();
    }
    delete states.last;
    await record("11-terminal", s);
    await click('#match .match-result [data-action="restart"]'); s = await waitFor("restart", (x) => idle(x) && /Round 1/.test(x.details) && !x.result); await sleep(600); s = await snap();
    await record("12-after-restart", s);
    return {states, errors: c.errors};
  } finally { await c.close(); }
}

const viewKey = (s) => ({prompt: s.prompt, promptVisible: s.promptVisible, panelHidden: s.panelHidden, buttons: s.buttons});
const failures = [];
const check = (ok, text) => { if (!ok) failures.push(text); };

const currentUrl = (extra) => pathToFileURL(page).href + QUERY + extra;
const shots = {"1-opening-idle": "idle-1-opening-tip.png", "4-end-phase-idle": "idle-2-end-phase-tip.png", "5-first-clash-idle": "idle-3-first-clash-tip.png"};
const on = await drive(currentUrl("&guide=1"), {shots});
const off = await drive(currentUrl(""));
const zero = await drive(currentUrl("&guide=0"));
const base = await drive(pathToFileURL(path.resolve(basePage)).href + QUERY);
const mobile = await drive(currentUrl("&guide=1"), {width: 390, height: 844, shots: {"1-opening-idle": "mobile-1-opening-tip.png", "4-end-phase-idle": "mobile-2-end-phase-tip.png", "5-first-clash-idle": "mobile-3-first-clash-tip.png"}});

const labels = Object.keys(on.states);
for (const label of labels) {
  const a = on.states[label], o = off.states[label], z = zero.states[label], b = base.states[label];
  check(o && z && b, `${label}: missing in a run`);
  if (!(o && z && b)) continue;
  check(JSON.stringify(viewKey(o)) === JSON.stringify(viewKey(b)), `${label}: guide-off differs from base build`);
  check(JSON.stringify(viewKey(z)) === JSON.stringify(viewKey(b)), `${label}: guide=0 differs from base build`);
  check(a.prompt.startsWith(o.prompt), `${label}: guide-on prompt does not start with the guide-off prompt`);
  const selectionStep = o.selected && !o.panelHidden;
  check(a.buttons.confirm.visible === o.buttons.confirm.visible && a.buttons.cancel.visible === o.buttons.cancel.visible && a.buttons.skip.visible === o.buttons.skip.visible,
    `${label}: selection button visibility changed by the guide`);
  if (!a.selected) check(!a.buttons.confirm.visible && !a.buttons.cancel.visible && !a.buttons.skip.visible, `${label}: selection buttons visible without a selection`);
  if (o.promptVisible === false && !/^(10|11|12)-/.test(label)) check(a.promptVisible, `${label}: guide tip not visible`);
}
for (const label of ["1-opening-idle", "4-end-phase-idle", "5-first-clash-idle"]) {
  check(on.states[label]?.promptVisible && on.states[label].prompt.length > off.states[label].prompt.length, `${label}: tip is not visible with extra text`);
  check(off.states[label]?.promptVisible === false, `${label}: guide-off idle prompt expected hidden (unchanged behavior)`);
}
for (const label of ["2-lane-step", "3-confirm-step", "6-tribute-step", "7-tribute-chosen", "8-confirm-step"]) {
  check(on.states[label]?.promptVisible && on.states[label].prompt.length > off.states[label].prompt.length, `${label}: tip missing at selection step`);
}
for (const label of ["10-round3-idle", "11-terminal"]) check(on.states[label]?.prompt === off.states[label]?.prompt, `${label}: guide did not stop`);
check(Boolean(on.states["11-terminal"]?.result), "match did not reach a result");
check(on.states["12-after-restart"]?.prompt === on.states["1-opening-idle"]?.prompt && on.states["12-after-restart"]?.promptVisible, "restart did not bring the opening tip back");
check(on.states["1-opening-idle"]?.live === "status", "prompt lost role=status");
for (const [name, run] of Object.entries({on, off, zero, base, mobile})) check(run.errors.length === 0, `${name}: console errors ${JSON.stringify(run.errors)}`);
for (const label of ["1-opening-idle", "4-end-phase-idle", "5-first-clash-idle"]) {
  const m = mobile.states[label];
  check(m.promptVisible && !m.clipped && m.fontPx >= 12 && m.promptRect.l >= 0 && m.promptRect.l + m.promptRect.w <= m.viewport[0], `mobile ${label}: prompt not legible in the viewport`);
}

const report = {date: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles", timeZoneName: "short"}), page: path.relative(root, page), base: basePage,
  note: "Headless Chrome, real mouse clicks, file URLs, seed 0 starter deck. No human and no screen reader involved.",
  pass: failures.length === 0, failures,
  guideOn: Object.fromEntries(labels.map((l) => [l, {prompt: on.states[l].prompt, visible: on.states[l].promptVisible, panelHidden: on.states[l].panelHidden, buttons: on.states[l].buttons}])),
  guideOffBase: Object.fromEntries(labels.map((l) => [l, {prompt: base.states[l].prompt, visible: base.states[l].promptVisible, panelHidden: base.states[l].panelHidden, buttons: base.states[l].buttons}])),
  mobile: Object.fromEntries(Object.entries(mobile.states).map(([l, s]) => [l, {visible: s.promptVisible, fontPx: s.fontPx, clipped: s.clipped, rect: s.promptRect, viewport: s.viewport}]))};
await mkdir(outDir, {recursive: true});
await writeFile(path.join(outDir, "browser-guide-check.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({pass: report.pass, failures}, null, 2));
process.exit(report.pass ? 0 : 1);
