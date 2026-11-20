// Headless Chrome check of a first Showdown session: clean Camp → Boot Hill's opening turn → a first attack choice,
// then a progressed save, by keyboard (1280 px) and by touch (390 px).
//
//   node prototypes/showdown/build.mjs && node prototypes/showdown/onboarding-browser-check.mjs [--seed 7] [--shots DIR]
//
// Same approach as access-browser-check.mjs: fresh isolated profile, file:// page, DevTools protocol, no dependency.
// Clean Camp: only the open Boot Hill tile says "Start here", and one Tab reaches it. Opening turn: the prompt names
// the hand and End turn and says nobody attacks; the first playable card and End turn are on screen without
// scrolling, also at 390 px where the turn's buttons stay at the bottom. Turn 3: a picked troop's prompt explains
// cover next to the attack preview, Take cover is on screen, and taking cover is logged. Focus survives leaving the
// tab and coming back, and "Back to camp" returns it to Boot Hill. A save with two Trail wins shows no "Start here".
// Saved progress is unchanged by all of it. Exits 1 on any failure; 90 s cap.
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const SEED = Number(option("--seed", 7));
const SHOTS = option("--shots", null);
const SAVE = "cvw-showdown-save-v2";
const OLD_SAVE = "cvw-showdown-trail-v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = setTimeout(() => { console.error("FAIL: timed out after 90 s"); process.exit(1); }, 90000);

const profile = await mkdtemp("/tmp/showdown-onboarding-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--disable-background-networking", "--mute-audio",
  "--window-size=1280,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let stderr = "";
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("no DevTools URL in 20 s")), 20000);
  child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
const waiting = new Map(); let nextId = 0; const pageErrors = [];
ws.addEventListener("message", ({data}) => {
  const m = JSON.parse(data);
  if (m.id === undefined) {
    if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Network.requestWillBeSent" && !/^(file|data|about|blob):/.test(m.params.request.url)) pageErrors.push(`network request: ${m.params.request.url}`);
    return;
  }
  const e = waiting.get(m.id); waiting.delete(m.id);
  if (m.error) e?.reject(new Error(m.error.message)); else e?.resolve(m.result);
});
const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId; waiting.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
});
const {targetInfos} = await raw("Target.getTargets");
const {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
const send = (method, params) => raw(method, params, sessionId);
for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);
await send("Emulation.setFocusEmulationEnabled", {enabled: true});
const evaluate = async (expression) => {
  const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true});
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

// Page-side measurements: which screen shows, where focus is, sideways overflow, and controls cut off at an edge.
const VIEW = `(() => {
  const shown = (n) => {
    if (!n) return false;
    for (let e = n; e && e !== document.documentElement; e = e.parentElement) {
      if (e.hidden) return false;
      const c = getComputedStyle(e);
      if (c.display === "none" || c.visibility === "hidden") return false;
    }
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const screens = ["camp", "builder", "duel", "curtain"].filter((id) => shown(document.getElementById(id)));
  const a = document.activeElement;
  const where = a && a !== document.body ? (a.closest("#camp, #builder, #duel, #curtain")?.id ?? "page") : "body";
  const label = !a || a === document.body ? "body" : a.id ? "#" + a.id : Object.entries(a.dataset).map(([k, v]) => k + "=" + v).join(",") || a.textContent.trim().slice(0, 30);
  const style = a && a !== document.body ? getComputedStyle(a) : null;
  const ring = style ? (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) : false;
  const width = innerWidth;
  const controls = [...document.querySelectorAll("button, summary, textarea")].filter(shown);
  const clipped = controls.filter((c) => { const r = c.getBoundingClientRect(); return r.left < -0.5 || r.right > width + 0.5; })
    .map((c) => (c.id ? "#" + c.id : (c.dataset.card || c.dataset.duel || c.className || c.tagName).toString().slice(0, 24)) + "@" + Math.round(c.getBoundingClientRect().right));
  const enabled = controls.filter((c) => !c.disabled);
  const smallest = enabled.reduce((m, c) => { const r = c.getBoundingClientRect(); return Math.min(m, Math.round(Math.min(r.width, r.height))); }, Infinity);
  return {screens, focus: label, focusIn: where, focusShown: a === document.body ? false : shown(a), ring,
    overflow: document.documentElement.scrollWidth - width, clipped, controls: controls.length, smallest};
})()`;
const view = () => evaluate(VIEW);
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); console.log(`${ok ? "ok  " : "FAIL"} ${message}`); };
const saved = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE)})`);
async function shot(name) {
  if (!SHOTS) return;
  const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: false});
  await mkdir(SHOTS, {recursive: true});
  await writeFile(path.join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}

async function key(name, code, keyCode, text, modifiers = 0) {
  await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? {text} : {})});
  await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code, windowsVirtualKeyCode: keyCode, modifiers});
  await sleep(120);
}
const enter = () => key("Enter", "Enter", 13, "\r");
// Tabs (at most 120 presses) until the focused element matches, and returns the number of presses.
async function tabUntil(selector) {
  for (let i = 0; i < 120; i += 1) {
    if (await evaluate(`Boolean(document.activeElement?.matches(${JSON.stringify(selector)}))`)) return i;
    await key("Tab", "Tab", 9);
  }
  throw new Error(`Tab never reached ${selector}`);
}
async function tap(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: "center"})`);
  await sleep(100);
  const at = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  await send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: at.x, y: at.y}]});
  await send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await sleep(250);
}
const page = pathToFileURL(path.join(root, "dist/showdown.html")).href;
async function fresh() {
  await send("Page.navigate", {url: `${page}?seed=${SEED}`});
  await sleep(600);
  await evaluate(`localStorage.clear()`);
  await send("Page.reload", {ignoreCache: true});
  await sleep(800);
}
const fmt = (v) => `focus ${v.focus} in ${v.focusIn}${v.focusShown ? "" : " (not visible)"}, ring ${v.ring ? "yes" : "no"}`;

// Where a selector sits against the viewport, and whether the sticky turn bar covers it.
const place = (selector) => evaluate(`(() => {
  const n = document.querySelector(${JSON.stringify(selector)});
  if (!n) return null;
  const r = n.getBoundingClientRect(), bar = document.getElementById("actions").getBoundingClientRect();
  // At least 48 px of it (a card's name and type line) must show above the bottom edge and the turn bar.
  const sticky = getComputedStyle(document.getElementById("actions")).position === "sticky";
  const floor = n.closest("#actions") || !sticky ? innerHeight : Math.min(innerHeight, bar.top);
  const covered = floor < innerHeight && r.top + 48 > floor;
  return {top: Math.round(r.top), bottom: Math.round(r.bottom), onScreen: r.top >= 0 && r.top + Math.min(48, r.height) <= floor, covered};
})()`);
const text = (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
const trailNotes = () => evaluate(`[...document.querySelectorAll("#trail .tile")].map((t) => t.innerText.replace(/\\s+/g, " ").trim())`);

// Plays the opening turn (a free troop, then End turn) and picks the first troop that can attack.
async function openingThenPick(press) {
  const prompt = await text("prompt");
  check(/opening turn/.test(prompt) && /hand/.test(prompt) && /end the turn/.test(prompt), `opening prompt names the hand and End turn: "${prompt}"`);
  const card = await place("#hand button.can"), end = await place("#end");
  check(card?.onScreen && end?.onScreen, `first playable card (top ${card?.top}px${card?.covered ? ", under the turn bar" : ""}) and End turn (top ${end?.top}px) on screen without scrolling`);
  await shot(`${press.name}-opening`);
  await press("#hand button.can");
  const after = await text("prompt");
  check(/take cover/.test(after) && !/No troop can attack/.test(after), `after the free troop, the prompt offers cover or End turn: "${after}"`);
  check(await evaluate(`[...document.querySelectorAll("#board button[data-own]")].some((b) => /Opening turn · can take cover/.test(b.textContent))`), "the new troop says why it cannot attack: Opening turn · can take cover");
  await press("#end");
  check(await evaluate(`/turn 3/.test(document.getElementById("status").textContent)`), `back to the Cowboys after the Wizards' reply (${await text("status")})`);
  await press("#board button[data-own]");
  const pick = await text("prompt");
  check(/Choose what to attack/.test(pick) && /take cover: it will not hit back/.test(pick), `picked troop: the prompt explains cover beside the attack: "${pick}"`);
  check(await evaluate(`[...document.querySelectorAll("#board button[data-enemy]")].some((b) => /hits back|Defeated|Hit the Base/.test(b.textContent))`), "picked troop: each target still previews the attack");
  const cover = await place("#cover");
  check(cover?.onScreen, `Take cover on screen while a troop is picked (top ${cover?.top}px)`);
  await shot(`${press.name}-pick`);
  await press("#cover");
  check(/took cover/.test(await text("log")), "Take cover is applied and logged");
}

let code = 0;
try {
  // ---- Desktop keyboard, 1280 × 800: clean Camp, first entry ---------------------------------
  await send("Emulation.setDeviceMetricsOverride", {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false});
  await fresh();
  const before = await saved();
  let notes = await trailNotes();
  check(/^Boot Hill Win to earn .* Start here/.test(notes[0]) && notes.filter((n) => /Start here/.test(n)).length === 1, `clean Camp: only Boot Hill says "Start here" ("${notes[0]}")`);
  const presses = await tabUntil('button[data-duel="trail"]');
  check(presses <= 1 && (await view()).ring, `clean Camp: Boot Hill reached in ${presses} Tab press with a focus outline`);
  await enter();
  let v = await view();
  check(v.screens.join() === "duel" && v.focus === "#end" && v.ring, `Enter opens Boot Hill (${fmt(v)})`);
  // Keyboard: the hand now comes right after the prompt, so it is one Shift+Tab back from End turn.
  const keys = async (selector) => {
    if (selector === "#end") await tabUntil("#end");
    else if (selector === "#cover") await tabUntil("#cover");
    else {
      for (let i = 0; i < 12 && !(await evaluate(`Boolean(document.activeElement?.matches(${JSON.stringify(selector)}))`)); i += 1) await key("Tab", "Tab", 9, undefined, 8);
      if (!(await evaluate(`Boolean(document.activeElement?.matches(${JSON.stringify(selector)}))`))) throw new Error(`Shift+Tab never reached ${selector}`);
    }
    await enter();
    const after = await view();
    if (!after.focusShown || after.focusIn !== "duel") failures.push(`focus lost after ${selector}: ${fmt(after)}`);
  };
  Object.defineProperty(keys, "name", {value: "desktop"});
  await openingThenPick(keys);
  v = await view();
  check(v.focusShown && v.focusIn === "duel" && v.ring, `desktop: focus after cover (${fmt(v)})`);
  // Away and back: another tab takes the foreground, then this one returns with focus where it was.
  const focusBefore = v.focus;
  const {targetId: other} = await raw("Target.createTarget", {url: "about:blank"});
  await sleep(300);
  await raw("Target.closeTarget", {targetId: other});
  await raw("Target.activateTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId});
  await sleep(300);
  v = await view();
  check(v.focus === focusBefore && v.focusShown && v.ring, `away and back: focus still on ${focusBefore} (${fmt(v)})`);
  await tabUntil("#leave");
  await enter();
  v = await view();
  check(v.screens.join() === "camp" && v.focus === "duel=trail" && v.ring, `"Back to camp" puts focus back on Boot Hill (${fmt(v)})`);
  check(await saved() === before, "desktop: saved progress unchanged by the unfinished duel");

  // ---- Progressed save: two Trail wins (the supported first-version save) -----------------
  await evaluate(`localStorage.clear(); localStorage.setItem(${JSON.stringify(OLD_SAVE)}, JSON.stringify({wins: 2, losses: 0}))`);
  await send("Page.reload", {ignoreCache: true});
  await sleep(800);
  notes = await trailNotes();
  check(notes.every((n) => !/Start here/.test(n)) && /^✓ Boot Hill Earned/.test(notes[0]) && /^The Bone Fence Win to earn/.test(notes[2]), `progressed Camp: no "Start here"; tiles read "${notes[0]}", "${notes[2]}"`);
  const next = await tabUntil('button[data-duel="trail"]');
  check(await evaluate(`/Bone Fence/.test(document.activeElement.textContent)`), `progressed Camp: Tab reaches The Bone Fence in ${next} press(es)`);
  await enter();
  check(/Bone Fence/.test(await text("status")) && !/opening turn/.test(await text("lesson")), `progressed: The Bone Fence opens with its own lesson ("${await text("lesson")}")`);

  // ---- Phone touch, 390 × 844 ---------------------------------------------------------------
  await send("Emulation.setDeviceMetricsOverride", {width: 390, height: 844, deviceScaleFactor: 2, mobile: true});
  await send("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
  await fresh();
  const phoneBefore = await saved();
  await tap('button[data-duel="trail"]');
  await evaluate(`window.scrollTo(0, 0)`);
  await sleep(150);
  const touch = async (selector) => {
    const at = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 12)}; })()`);
    await send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: at.x, y: at.y}]});
    await send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    await sleep(250);
  };
  // Taps where the element is now, scrolling only when it is off screen, as a thumb would.
  const phone = async (selector) => { if (!(await place(selector))?.onScreen) await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: "center"})`); await touch(selector); };
  Object.defineProperty(phone, "name", {value: "phone"});
  await openingThenPick(phone);
  v = await view();
  check(v.overflow <= 0 && v.clipped.length === 0, `phone: sideways overflow ${v.overflow}px, cut-off controls [${v.clipped.join(" ")}], smallest ${v.smallest}px`);
  await phone("#leave");
  check((await view()).screens.join() === "camp" && await saved() === phoneBefore, "phone: back in Camp with saved progress unchanged");
  check(pageErrors.length === 0, `no page errors or network requests (${pageErrors.join(" | ") || "none"})`);
} catch (error) {
  failures.push(error.message); console.log(`FAIL ${error.message}`);
} finally {
  code = failures.length ? 1 : 0;
  if (failures.length) console.log(failures.map((f) => `  - ${f}`).join("\n"));
  console.log(code ? `${failures.length} check(s) failed (seed ${SEED})` : `first-session onboarding path passed (seed ${SEED})`);
  ws.close(); child.kill("SIGTERM"); await sleep(300); child.kill("SIGKILL");
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
  clearTimeout(deadline);
  process.exit(code);
}
