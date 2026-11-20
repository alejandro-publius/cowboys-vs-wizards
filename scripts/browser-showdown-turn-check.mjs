// K-095: the experiment turn (src/match/showdown-turn.js) in real headless Chrome, fresh profile.
//   npm run build
//   node scripts/browser-showdown-turn-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
// Opens the Dragon turn from Play -> Camp -> #camp-turn-dragon (mouse) and from ?turn=dragon-c5, plays
// both Ranger choices (mouse and keyboard), retries during and after the duel, returns to Camp, uses
// reload and the browser's Back, and repeats the landing on a 375 px screen. A saved career written
// before the run must be byte-identical after it. Screenshots and report.json go to outDir.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {newSave} from "../src/game/showdown/progress.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-turn");
await mkdir(out, {recursive: true});

const profile = await mkdtemp("/tmp/kiro-showdown-turn-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let stderr = "";
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
  child.stderr.on("data", (chunk) => { stderr += chunk; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
const waiting = new Map(), errors = [];
let next = 0, sessionId;
ws.addEventListener("message", ({data}) => {
  const m = JSON.parse(data);
  if (m.id === undefined) {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    return;
  }
  const entry = waiting.get(m.id);
  waiting.delete(m.id);
  if (m.error) entry.reject(new Error(`${entry.method}: ${m.error.message}`)); else entry.resolve(m.result);
});
const send = (method, params = {}) => { const id = ++next; ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  return new Promise((resolve, reject) => waiting.set(id, {resolve, reject, method})); };

const report = {page, chrome: CHROME, checks: [], shots: [], errors};
const ok = (name) => { report.checks.push(name); console.log(`ok - ${name}`); };
let failed = null;
try {
  ({sessionId} = await send("Target.attachToTarget", {targetId: (await send("Target.createTarget", {url: "about:blank"})).targetId, flatten: true}));
  await send("Page.enable");
  await send("Runtime.enable");
  const screen = (width, height, mobile = false) => send("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile});
  await screen(1440, 900);
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 15000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(50); }
    throw Error(`Timed out: ${expression}`);
  };
  const q = (selector) => JSON.stringify(selector);
  const shown = (id) => evaluate(`!document.getElementById(${q(id)}).hidden`);
  const navigate = async (query) => { await send("Page.navigate", {url: page + query}); await wait(`document.readyState==='complete'&&document.getElementById('camp-turn-dragon')`); };
  const storage = () => evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k)=>[k,localStorage.getItem(k)])))`);
  const shot = async (name) => {
    const {data} = await send("Page.captureScreenshot", {format: "png"});
    await writeFile(path.join(out, `${name}.png`), Buffer.from(data, "base64"));
    report.shots.push(`${name}.png`);
  };
  // A real mouse press and release at the centre of the element.
  const click = async (selector) => {
    const box = await evaluate(`(()=>{const n=document.querySelector(${q(selector)});if(!n||n.disabled)return null;n.scrollIntoView({block:"center"});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    assert.ok(box, `no enabled ${selector}`);
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, x: box.x, y: box.y, button: "left", clickCount: 1});
    await sleep(30);
  };
  const KEYS = {Tab: 9, Enter: 13};
  const key = async (name, modifiers = 0) => {
    const code = KEYS[name];
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code: name, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(name === "Enter" ? {text: "\r"} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code: name, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
    await sleep(30);
  };
  const tabTo = async (selector) => {
    for (let i = 0; i < 120; i += 1) { if (await evaluate(`document.activeElement?.matches(${q(selector)})??false`)) return; await key("Tab"); }
    throw Error(`Tab never reached ${selector}`);
  };
  const slot = (id) => evaluate(`document.querySelector('[data-slot="${id}"]')?.textContent.replace(/\\s+/g," ").trim()??""`);
  const orbsOf = (id) => evaluate(`document.querySelector('[data-slot="${id}"] .sd-orbs')?.getAttribute("aria-label")??null`);
  // The decision state: the referee's s3-C5-dragon-resting after the shared Dynamiter.
  const landing = async (label) => {
    await wait(`!document.getElementById('showdown').hidden&&document.getElementById('sd-status').textContent.includes('Experiment')`);
    assert.match(await evaluate(`document.getElementById('sd-status').textContent`), /turn 5 · your turn/);
    assert.match(await slot("wizard-0"), /^Dragon/);
    assert.equal(await orbsOf("wizard-0"), "4 of 5 orbs");
    assert.match(await slot("wizard-1"), /^Jack-o'-Lantern.*In cover/);
    assert.match(await slot("cowboy-0"), /^Ranger/);
    assert.match(await slot("cowboy-1"), /^Dynamiter/);
    assert.match(await evaluate(`document.getElementById('sd-lesson').textContent`), /^Experiment for review, not a bounty: nothing here is saved/);
    // No Wizard hand, deck or trap card and no seed in the page.
    const html = await evaluate(`document.getElementById('showdown').innerHTML`);
    assert.ok(!/data-card="wizard-/.test(html), "a Wizard card is in the hand row");
    assert.ok(!/seed/i.test(await evaluate(`document.getElementById('showdown').textContent`)), "the page names a seed");
    ok(`${label}: lands on Cowboy turn 5, Dragon 4 resting, Jack in cover, Ranger and Dynamiter, no hidden card or seed`);
  };
  const choose = async (target) => { await click('[data-slot="cowboy-0"]'); await click(`[data-slot="wizard-${target}"]`); };
  const finish = async () => {
    for (let i = 0; i < 80 && !(await evaluate(`Boolean(document.querySelector('#sd-result .sd-row'))`)); i += 1) {
      if (await evaluate(`!document.getElementById('sd-end').disabled`)) await click("#sd-end"); else await sleep(50);
    }
    await wait(`Boolean(document.querySelector('#sd-result .sd-row'))`);
  };

  // A saved career exists before the experiment, and must not change.
  await navigate("");
  await evaluate(`localStorage.setItem(${q(SAVE_KEY)}, ${q(JSON.stringify({...newSave(), wins: 2}))})`);
  await navigate("");
  await click("#menu-play");
  await wait(`!document.getElementById('showdown-camp').hidden`);
  const before = await storage();
  assert.ok(before.includes(SAVE_KEY));
  ok("a saved career is in storage before the experiment");

  // Normal entry: Play -> Camp -> the one optional control, by mouse.
  assert.equal(await evaluate(`document.querySelectorAll('[data-turn]').length`), 1);
  await shot("01-camp-control");
  await click("#camp-turn-dragon");
  await landing("Camp control");
  await shot("02-decision");
  await choose(0);
  assert.equal(await orbsOf("wizard-0"), "2 of 5 orbs");
  assert.equal(await orbsOf("cowboy-0"), "1 of 4 orbs");
  ok("choice A by mouse: Ranger hits the resting Dragon, Dragon 4 -> 2, Ranger 4 -> 1");
  await shot("03-choice-a");
  await click("#sd-restart");
  await landing("Restart this duel (retry during the turn)");

  // Choice B by keyboard only.
  await evaluate(`document.activeElement?.blur()`);
  await tabTo('[data-slot="cowboy-0"]');
  await key("Enter");
  await tabTo('[data-slot="wizard-1"]');
  await key("Enter");
  assert.match(await slot("wizard-1"), /empty/);
  assert.equal(await orbsOf("wizard-0"), "4 of 5 orbs");
  ok("choice B by keyboard: Ranger defeats the Jack, the Dragon keeps 4");
  await shot("04-choice-b");
  await finish();
  assert.equal(await evaluate(`document.getElementById('sd-again')?.textContent`), "Retry");
  assert.ok(!(await evaluate(`/collection|earned|Grit/.test(document.getElementById('sd-result').textContent)`)), "the result pays or charges something");
  ok(`played out: "${await evaluate(`document.querySelector('#sd-status .sd-result').textContent`)}"; result offers Retry and Back to camp, no reward or grit`);
  await shot("05-result");
  await click("#sd-again");
  await landing("Retry after the result");
  await click("#sd-home");
  await wait(`!document.getElementById('showdown-camp').hidden`);
  assert.equal(await evaluate(`document.activeElement?.id`), "camp-turn-dragon");
  assert.equal(await storage(), before);
  ok("Back to camp returns focus to the Camp control; saved career byte-identical");

  // Direct URL, reload, Back, and an id that is not allowlisted.
  await navigate("?turn=dragon-c5");
  await landing("Direct URL ?turn=dragon-c5");
  await choose(0);
  await finish();
  ok(`direct URL, choice A played out: "${await evaluate(`document.querySelector('#sd-status .sd-result').textContent`)}"`);
  await click("#sd-camp");
  await wait(`!document.getElementById('showdown-camp').hidden`);
  await send("Page.reload");
  await wait(`document.readyState==='complete'&&document.getElementById('sd-status')`);
  await landing("Reload of the direct URL");
  const {currentIndex, entries} = await send("Page.getNavigationHistory");
  await send("Page.navigateToHistoryEntry", {entryId: entries[currentIndex - 1].id});
  await wait(`document.readyState==='complete'&&!document.getElementById('title-screen').hidden&&document.getElementById('showdown').hidden`);
  ok("browser Back from the direct URL returns to the main menu");
  for (const bad of ["?turn=nope", "?turn=__proto__", `?turn=${encodeURIComponent('[{"type":"end"}]')}`]) {
    await navigate(bad);
    await sleep(100);
    assert.ok(await shown("title-screen") && !(await shown("showdown")), bad);
  }
  ok("a ?turn value outside the allowlist opens the normal main menu");
  assert.equal(await storage(), before);
  ok("saved career still byte-identical after the direct-URL runs");

  // Small screen.
  await screen(375, 740, true);
  await navigate("?turn=dragon-c5");
  await landing("375 x 740 screen");
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`), "the page scrolls sideways at 375 px");
  await shot("06-small-decision");
  await choose(1);
  assert.match(await slot("wizard-1"), /empty/);
  ok("375 px: no sideways scroll, choice B by tap position");
  await click("#sd-home");
  await wait(`!document.getElementById('showdown-camp').hidden`);
  assert.ok(await evaluate(`(()=>{const r=document.getElementById('camp-turn-dragon').getBoundingClientRect();return r.width>0&&r.right<=innerWidth+1;})()`));
  await shot("07-small-camp");
  assert.equal(await storage(), before);
  ok("375 px: Camp control fits; saved career byte-identical");
  assert.deepEqual(errors, []);
  ok("no page errors");
} catch (error) {
  failed = error;
} finally {
  report.passed = !failed;
  report.failure = failed ? String(failed.stack ?? failed) : null;
  await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  ws.close();
  child.kill("SIGTERM");
  await sleep(300);
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report ${path.join(out, "report.json")}`);
