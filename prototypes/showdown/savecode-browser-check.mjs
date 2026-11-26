// Headless Chrome check of the Camp save-code import (no extra dependency; DevTools protocol).
//
//   node prototypes/showdown/build.mjs && node prototypes/showdown/savecode-browser-check.mjs
//
// Fresh isolated profile, file:// page, no network. Seeds a saved Camp with two Trail wins, then with real mouse clicks:
// a bad code and a newer-version code are refused with no preview and no storage change; a different save code shows
// the preview, and Cancel leaves storage byte-for-byte unchanged; a legacy v1 code previews too; typing a new code over
// an open preview withdraws it (Replace cannot load the stale preview) until Load previews afresh; Replace writes the
// pasted save, and a reload shows it. Then, in a fresh browser context where writes to the save key throw: a status
// notice appears, memory holds the import, storage keeps the last save, the code round-trips, and a reload restores it. Exits 1 on any failure; 60 s cap.
import {spawn} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../../", import.meta.url));
import {REFUSED_KEY, SAVE_KEY as SAVE} from "../../src/game/showdown/campaign-store.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = setTimeout(() => { console.error("FAIL: timed out after 60 s"); process.exit(1); }, 60000);

const profile = await mkdtemp("/tmp/savecode-chrome-");
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
let {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
const send = (method, params) => raw(method, params, sessionId);
for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);
await send("Emulation.setFocusEmulationEnabled", {enabled: true});
const evaluate = async (expression) => {
  const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true});
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};
import {newSave, settle} from "./progress.js";
import {decodeSaveCode, encodeSave, sameSave} from "./savecode.js";

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); console.log(`${ok ? "ok  " : "FAIL"} ${message}`); };
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: "center"})`);
  const at = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return r.width ? {x: r.x + r.width / 2, y: r.y + r.height / 2} : null; })()`);
  if (!at) throw new Error(`nothing visible to click: ${selector}`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, x: at.x, y: at.y, button: "left", clickCount: 1});
  await sleep(150);
}
const stored = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE)})`);
const state = () => evaluate(`({note: document.getElementById("code-note").textContent, preview: !document.querySelector('[data-testid="save-import-preview"]').hidden,
  previewText: document.getElementById("code-preview-text").textContent, code: document.getElementById("code").value, collection: document.getElementById("collection").textContent})`);
async function paste(text) {
  await click("#code");
  await evaluate(`(() => { const c = document.getElementById("code"); c.value = ${JSON.stringify(text)}; c.dispatchEvent(new Event("input", {bubbles: true})); })()`);
  await click("#load");
}
const openCodes = async () => { if (!await evaluate(`document.querySelector("#camp details").open`)) await click("#camp details summary"); };

let code = 0;
try {
  let mine = newSave();
  for (let i = 0; i < 2; i++) mine = {...settle(mine, "trail", true).save, offer: null};
  const page = pathToFileURL(path.join(root, "dist/showdown.html")).href;
  await send("Page.navigate", {url: page});
  await sleep(600);
  await evaluate(`localStorage.setItem(${JSON.stringify(SAVE)}, ${JSON.stringify(JSON.stringify(mine))})`);
  await send("Page.reload");
  await sleep(800);
  const before = await stored();
  check((await state()).code === encodeSave(mine), "startup reads the saved Camp unchanged");
  await openCodes();

  for (const [label, text] of [["a bad code", "definitely not a save"], ["a damaged code", btoa('{"v":2,"wins":-4}')],
    ["a newer-version code", btoa(JSON.stringify({...mine, v: 3}))]]) {
    await paste(text);
    const s = await state();
    check(!s.preview && /Nothing was changed/.test(s.note) && await stored() === before, `${label}: refused (${s.note}), no preview, storage unchanged`);
  }
  await paste(encodeSave(mine));
  check(/already have/.test((await state()).note) && await stored() === before, "the same save's code: no preview, storage unchanged");

  const other = newSave();
  await paste(encodeSave(other));
  let s = await state();
  check(s.preview && /Trail 0 of/.test(s.previewText) && /You have: Trail 2 of/.test(s.previewText), `a different save shows the preview (${s.previewText})`);
  check(await stored() === before, "storage is unchanged while the preview is open");
  await click('[data-testid="save-import-cancel"]');
  s = await state();
  check(!s.preview && /Cancelled/.test(s.note) && await stored() === before, "Cancel closes the preview and writes nothing");

  await paste(btoa(JSON.stringify({wins: 1, losses: 2})));
  s = await state();
  check(s.preview && /older version/.test(s.previewText) && /Trail 1 of/.test(s.previewText) && await stored() === before, "a legacy v1 code previews as Trail 1 and writes nothing yet");
  await click('[data-testid="save-import-cancel"]');

  // Stale confirmation: preview one foreign save, then type a different valid code over it before pressing Replace.
  // The edit must withdraw the preview, so Replace cannot load the older preview; only a fresh Load previews again.
  const third = {...settle(newSave(), "trail", true).save, offer: null};
  await paste(encodeSave(other));
  check((await state()).preview, "stale: the first foreign save is previewed");
  await click("#code");
  await evaluate(`document.getElementById("code").select()`);
  await send("Input.insertText", {text: encodeSave(third)});
  await sleep(150);
  s = await state();
  const replaceVisible = await evaluate(`!!document.querySelector('[data-testid="save-import-replace"]').getClientRects().length`);
  if (replaceVisible) await click('[data-testid="save-import-replace"]');
  s = await state();
  check(!replaceVisible && !s.preview, `stale: typing a new code closes the preview, so Replace is not offered (${s.note})`);
  check(/Load/.test(s.note) && /Nothing was changed/.test(s.note), `stale: the note asks for a fresh preview (${s.note})`);
  check(await stored() === before && s.code === encodeSave(third), "stale: storage keeps the old save and the typed code stays in the box");
  await click("#load");
  s = await state();
  check(s.preview && /Trail 1 of/.test(s.previewText) && await stored() === before, `stale: Load previews the edited code afresh (${s.previewText})`);
  await click('[data-testid="save-import-cancel"]');
  check(!(await state()).preview && await stored() === before, "stale: Cancel on the fresh preview still writes nothing");

  await paste(encodeSave(other));
  await click('[data-testid="save-import-replace"]');
  s = await state();
  check(!s.preview && s.note === "Loaded." && await stored() === JSON.stringify(other), "Replace writes the pasted save");
  await send("Page.reload");
  await sleep(800);
  s = await state();
  check(s.code === encodeSave(other) && await stored() === JSON.stringify(other), "after reload the Camp shows the replaced save");

  // Another tab changes the career after this one previews a code. Replace must keep the newer deck.
  await openCodes();
  await paste(encodeSave(mine));
  const changed = JSON.stringify(third);
  await evaluate(`localStorage.setItem(${JSON.stringify(SAVE)}, ${JSON.stringify(changed)})`);
  await click('[data-testid="save-import-replace"]');
  s = await state();
  check(await stored() === changed && s.code === encodeSave(third) && !s.preview, "a stale Replace loads the other tab's progress");
  check(await evaluate(`document.getElementById("storage-notice")?.textContent.includes("changed in another tab")`), "Camp explains the skipped write");

  // An older reference page must keep the only copy of a career written by a newer game.
  const future = JSON.stringify({...mine, v: 3});
  await evaluate(`localStorage.setItem(${JSON.stringify(SAVE)}, ${JSON.stringify(future)})`);
  await send("Page.reload");
  await sleep(800);
  await openCodes();
  await paste(encodeSave(mine));
  await click('[data-testid="save-import-replace"]');
  check(await stored() === JSON.stringify(mine) && await evaluate(`localStorage.getItem(${JSON.stringify(REFUSED_KEY)})`) === future,
    "a confirmed replacement preserves the original bytes of a newer-version career");

  // Storage blocked: a fresh isolated browser context where only Showdown's own save key refuses to be written.
  const {browserContextId} = await raw("Target.createBrowserContext");
  const {targetId: blockedTarget} = await raw("Target.createTarget", {url: "about:blank", browserContextId});
  ({sessionId} = await raw("Target.attachToTarget", {targetId: blockedTarget, flatten: true}));
  for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);
  await send("Page.navigate", {url: page});
  await sleep(600);
  await evaluate(`localStorage.setItem(${JSON.stringify(SAVE)}, ${JSON.stringify(JSON.stringify(mine))}); localStorage.setItem("other-key", "1")`);
  await send("Page.addScriptToEvaluateOnNewDocument", {source: `{ const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === ${JSON.stringify(SAVE)}) throw new DOMException("blocked for test", "QuotaExceededError"); return set.call(this, key, value); }; }`});
  await send("Page.reload");
  await sleep(800);
  const lastStored = await stored();
  const notice = () => evaluate(`(() => { const n = document.getElementById("storage-notice"); return n && !n.hidden ? {text: n.textContent, role: n.getAttribute("role")} : null; })()`);
  check(await notice() === null, "storage blocked: no notice before any write is attempted");
  check(await evaluate(`(localStorage.setItem("other-key", "2"), localStorage.getItem("other-key"))`) === "2", "only the Showdown save key is blocked");
  await openCodes();
  await paste(encodeSave(other));
  await click('[data-testid="save-import-replace"]');
  s = await state();
  const shown = await notice();
  check(shown?.role === "status" && /did not save/.test(shown.text) && /copy the code/.test(shown.text), `failed write shows a status notice (${shown?.text})`);
  check(/visit only/.test(s.note), `the import note says it was not saved (${s.note})`);
  check(s.code === encodeSave(other), "in-memory progress is the imported save");
  check(await stored() === lastStored && lastStored === JSON.stringify(mine), "the last stored save is untouched");
  await click("#build");
  check((await notice()) !== null && await evaluate(`!document.getElementById("builder").hidden`), "the notice stays visible in the deck builder");
  await click("#builder-cancel");
  const copied = (await state()).code;
  const round = decodeSaveCode(copied);
  check(round.ok && sameSave(round.save, other), "the Camp save code round-trips the unsaved progress");
  await send("Page.reload");
  await sleep(800);
  check((await state()).code === encodeSave(mine) && await notice() === null, "after reload the last stored save loads, with no notice");
  await raw("Target.disposeBrowserContext", {browserContextId});
  check(pageErrors.length === 0, `no page errors or network requests (${pageErrors.join(" | ") || "none"})`);
} catch (error) {
  failures.push(error.message); console.error(`FAIL ${error.message}`);
} finally {
  console.log(failures.length ? `FAILED ${failures.length} check(s)` : "PASS save-code import");
  code = failures.length ? 1 : 0;
  ws.close(); child.kill(); await sleep(300); await rm(profile, {recursive: true, force: true}); clearTimeout(deadline);
  process.exit(code);
}
