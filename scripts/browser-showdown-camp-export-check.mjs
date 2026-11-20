// K-094 export privacy: can a tester paste the normal Camp playtest report from a mixed career without
// leaking stored text that is not part of the report?
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-camp-export-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
//
// Expectation (written before the run, docs/evidence/showdown-camp-export-privacy.md): the copied text is
// exactly the Camp's report box; it names each logged duel's name, outcome, turns, time and "read the rules",
// the build lines and the saved career totals; it contains none of the canary strings planted in fields the
// report does not print (extra fields on log rows, run and duel ids, a non-label build value, two-player hand
// fields, extra save fields, the lane profile, unrelated keys, sessionStorage, a cookie).
//
// How a fake pass could arise: the planted data never reaches the page (wrong origin, the page resets the
// save, the clipboard read returns nothing or stale text), so "no canary in the copy" holds trivially.
// Controls against that: every canary is read back from the page's own storage right before Copy; the
// planted rows' public fields (their names, turns, times, outcomes and build) must appear in the copy; the
// planted save's Trail win must be counted; the detector must find every canary in a dump of that storage;
// and the clipboard is read through navigator.clipboard after a real mouse press on Copy report and must
// equal the box and contain the duel this run just played.
//
// Disposable headless Chrome profile, built page over loopback HTTP, every game input a real mouse press on
// the normal entry (Play, the Camp, the next Trail duel, Playtest report, Copy report). Scripted; no human
// played, and it says nothing about clarity or fun.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {choose, newSave, settle} from "../src/game/showdown/progress.js";
import {OLD_SAVE_KEY, REFUSED_KEY, SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {INHERITED_KEY} from "../src/game/showdown/inherited.js";
import {PLAYTEST_KEY} from "../src/match/showdown-playtest.js";
import {grayboxBuildLabel} from "./graybox-build-label.mjs";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const html = await readFile(path.resolve(process.argv[2]));
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-camp-export");
const BUILD = grayboxBuildLabel(fileURLToPath(new URL("../", import.meta.url)));
assert.ok(BUILD, "run from a git checkout so the current build has a label");
await mkdir(out, {recursive: true});

// ---- Planted fixture: harmless canaries, each unique, none of them a real person's data ----------------
const C = (what) => `ZZCANARY-${what}-7f3q`;
const CANARIES = [];
const plant = (what) => { const value = C(what); CANARIES.push(value); return value; };
const OTHER_BUILD = "0123456789ab";
const rows = [
  // An older build's row (no build field), with private notes a hand-edited or foreign writer left on it.
  {name: "Boot Hill", won: true, turns: 9, seconds: 71, rules: true, run: plant("run-id"), duel: plant("duel-id"), seed: 3,
    note: plant("private-note"), player: plant("player-name"), email: plant("email"), when: plant("clock-time")},
  // Another build's row, lost, with device detail.
  {name: "Raven Roost", won: false, turns: 12, seconds: 140, rules: false, run: "r2", duel: "trail", seed: 4, build: OTHER_BUILD,
    device: plant("device"), location: plant("location")},
  // The reference prototype's offline shape: no run, duel, seed or build.
  {name: "Raven Roost", won: false, turns: 6, seconds: 30, rules: false},
  // A build value that is not a public label: kept as "not recorded", never printed.
  {name: "Boot Hill", won: true, turns: 8, seconds: 45, rules: false, build: plant("build-value")},
  // Two-player shaped row: hidden hand and the other seat's private fields.
  {name: "Raven Roost", won: true, turns: 7, seconds: 60, rules: false, mode: "two-player", seat: "wizard",
    hand: [plant("own-hand")], otherHand: [plant("other-seat-hand")], traps: [plant("other-seat-trap")]},
  // Malformed rows, dropped whole.
  {name: plant("malformed-name"), won: "yes", turns: 1, seconds: 1},
  {mode: "hotseat", hand: [plant("malformed-hand")]},
  null, 7,
];
const save = (() => { const s = settle(newSave(), "trail", true).save; return choose(s, s.offer[0]); })();
const FIXTURE = {
  [PLAYTEST_KEY]: JSON.stringify(rows),
  [SAVE_KEY]: JSON.stringify({...save, note: plant("save-note"), player: plant("save-player")}),
  [OLD_SAVE_KEY]: JSON.stringify({wins: 0, note: plant("v1-save-note")}),
  [REFUSED_KEY]: JSON.stringify({v: 2, note: plant("refused-save")}),
  [INHERITED_KEY]: JSON.stringify({note: plant("keepsake")}),
  "cvw-player-v1": JSON.stringify({note: plant("lane-profile")}),
  "tester-notes": plant("unrelated-key"),
};
const SESSION = plant("session-storage");
const COOKIE = plant("cookie");

// ---- Loopback server and Chrome -------------------------------------------------------------------
const server = createServer((req, res) => {
  const {pathname} = new URL(req.url, "http://x");
  if (pathname === "/game.html") { res.writeHead(200, {"content-type": "text/html; charset=utf-8"}); res.end(html); return; }
  if (pathname === "/blank.html") { res.writeHead(200, {"content-type": "text/html"}); res.end("<!doctype html><title>blank</title>"); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const profile = await mkdtemp("/tmp/kiro-camp-export-chrome-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding", "--window-size=1440,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let stderr = "";
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
  child.stderr.on("data", (chunk) => { stderr += chunk; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
const waiting = new Map();
let next = 0, sessionId;
const errors = [];
ws.addEventListener("message", ({data}) => {
  const message = JSON.parse(data);
  if (message.id === undefined) {
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((a) => a.value ?? a.description).join(" "));
    return;
  }
  const entry = waiting.get(message.id);
  waiting.delete(message.id);
  if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`)); else entry.resolve(message.result);
});
const send = (method, params = {}, session = sessionId) => new Promise((resolve, reject) => {
  const id = ++next;
  waiting.set(id, {resolve, reject, method});
  ws.send(JSON.stringify({id, method, params, ...(session ? {sessionId: session} : {})}));
});

const result = {page: process.argv[2], build: BUILD, chrome: CHROME, canaries: CANARIES.length, checks: [], errors,
  note: "Scripted headless Chrome over the DevTools protocol with planted canary data; not a human playtest."};
const check = (name, detail) => { result.checks.push({name, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };
const leaks = (text) => CANARIES.filter((canary) => text.includes(canary));
let failed = null;
try {
  await send("Browser.grantPermissions", {origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"]}, null);
  const {targetId} = await send("Target.createTarget", {url: "about:blank"}, null);
  ({sessionId} = await send("Target.attachToTarget", {targetId, flatten: true}, null));
  await send("Page.enable");
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true, userGesture: false});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 15000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(100); }
    throw Error(`Timed out: ${expression}`);
  };
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      if(!n.contains(document.elementFromPoint(x,y)))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, button: "left", clickCount: 1, ...p});
  };
  const shown = (id) => `!document.getElementById('${id}').hidden`;
  const dumpStorage = () => evaluate(`JSON.stringify({local:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])),session:Object.fromEntries(Object.keys(sessionStorage).map(k=>[k,sessionStorage.getItem(k)])),cookie:document.cookie})`);

  // 1. Plant the fixture on a blank page of the same origin, before the game first loads.
  await send("Page.navigate", {url: `${origin}/blank.html`});
  await wait(`document.readyState==='complete'`);
  await evaluate(`(()=>{localStorage.clear();const f=${JSON.stringify(FIXTURE)};for(const k in f)localStorage.setItem(k,f[k]);
    sessionStorage.setItem('tester-session',${JSON.stringify(SESSION)});document.cookie='tester='+${JSON.stringify(COOKIE)}+'; path=/';})()`);
  const planted = await dumpStorage();
  assert.deepEqual(leaks(planted).length, CANARIES.length, "detector control: every planted canary is found in the planted storage");
  check("Fixture planted on the game's origin; the detector finds all planted canaries in it", {canaries: CANARIES.length});

  // 2. Normal entry: Play opens the Camp. The planted save (one Trail win) must be resumed, not reset.
  await send("Page.navigate", {url: `${origin}/game.html?seed=0`});
  await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
  await click("#menu-play");
  await wait(shown("showdown-camp"));
  const loaded = await dumpStorage();
  assert.equal(leaks(loaded).length, CANARIES.length, "control: the Camp opened on the planted storage without rewriting it");
  assert.match(await evaluate(`document.getElementById('showdown-camp').textContent`), /Raven Roost/, "the planted save's Trail win is resumed");
  check("Camp opened by Play on the planted storage; all canaries still stored before any duel");

  // 3. Play the next Trail duel (Raven Roost) to a win by mouse clicks, the same loop as browser-showdown-build-check.mjs.
  const over = () => evaluate(`Boolean(document.querySelector('.sd-result'))`);
  await click("#camp-trail [data-duel=trail]");
  await wait(`${shown("showdown")}&&/ · turn 1 · your turn$/.test(document.getElementById('sd-status').textContent)`);
  for (let turns = 0; !(await over()) && turns < 40; turns += 1) {
    for (let played = 0; played < 4; played += 1) {
      const card = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
      if (!card) break;
      await click(`#sd-hand [data-card="${card}"]`);
      for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
        const prompt = await evaluate(`document.getElementById('sd-prompt').textContent`);
        if (/as payment|to carry/.test(prompt)) await click("#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]");
        else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
        else await click("#sd-cancel");
      }
    }
    for (let i = 0; i < 3 && !(await over()); i += 1) {
      const ready = await evaluate(`[...document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]')].find(n=>/Can attack/.test(n.textContent))?.dataset.slot??null`);
      if (!ready) break;
      await click(`#sd-board [data-slot="${ready}"]`);
      const before = await evaluate(`document.getElementById('sd-feedback').textContent`);
      await click((await evaluate(`Boolean(document.querySelector('[data-enemy=base]'))`)) ? "[data-enemy=base]" : ".sd-slot[data-enemy]");
      await wait(`document.getElementById('sd-feedback').textContent!==${JSON.stringify(before)}`);
    }
    if (await over()) break;
    await click("#sd-end");
    await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)||document.querySelector('.sd-result')`);
  }
  const status = await evaluate(`document.getElementById('sd-status').textContent`);
  assert.equal(status, "You win: the Wizard Base fell.");
  await click("#sd-result [data-choose]");
  await wait(`!document.querySelector('#sd-result [data-choose]')`);
  await click("#sd-camp");
  await wait(shown("showdown-camp"));
  const log = JSON.parse(await evaluate(`localStorage.getItem(${JSON.stringify(PLAYTEST_KEY)})`));
  const played = log.at(-1);
  assert.deepEqual([log.length, played.name, played.won, played.build], [6, "Raven Roost", true, BUILD], "five planted rows kept, one new line");
  check("Raven Roost won by mouse clicks on the normal entry; one new line under this build", {status, line: {...played, run: "(random id)"}});

  // 4. Open the report and press Copy report. Read the clipboard back through the browser.
  await click("#camp-report summary");
  const box = await evaluate(`document.getElementById('camp-report-text').value`);
  // Recorded, not asserted: finishing the duel rewrote the log and the save with known fields only.
  const stillStored = leaks(await dumpStorage());
  await evaluate(`navigator.clipboard.writeText('stale clipboard')`).catch(() => {});
  await click("#camp-report-copy");
  await wait(`document.getElementById('camp-report-copied').textContent==='Copied.'`);
  const copied = await evaluate(`navigator.clipboard.readText()`);
  assert.equal(copied, box, "the clipboard holds exactly the report box");
  check("Copy report answers Copied. and the clipboard holds exactly the Camp report box", {copied});

  // 5. What the copy must show: each kept duel's public outcome, the build lines, the career totals.
  const lines = copied.split("\n");
  const expect = [
    "Showdown playtest report",
    "Finished 6 duels in ",
    "Reached: Trail 2 of 6 won, rivals 0 of 4,",
    "First loss: duel 2, Raven Roost.",
    "Lost most often: Raven Roost, 2 times.",
    'Opened "All the rules" during 1 of 6 duels.',
    `This report is from game build ${BUILD}.`,
    `Duels by build: 1 build not recorded; 2 on ${OTHER_BUILD}; 3-5 build not recorded; 6 on ${BUILD}.`,
    "1. Boot Hill: won in 9 turns, 71 s, read the rules",
    "2. Raven Roost: lost in 12 turns, 2 min",
    "3. Raven Roost: lost in 6 turns, 30 s",
    "4. Boot Hill: won in 8 turns, 45 s",
    "5. Raven Roost: won in 7 turns, 60 s",
    `6. Raven Roost: won in ${played.turns} turns, `,
  ];
  for (const start of expect) assert.ok(lines.some((line) => line.startsWith(start)), `missing: ${start}\n${copied}`);
  check("The copy shows every kept duel's name, outcome, turns, time and rules use, the build labels and the career totals", {expect});

  // 6. What it must not show.
  assert.deepEqual(leaks(copied), [], "no planted canary in the copied report");
  assert.doesNotMatch(copied, /two-player|wizard|hand|trap|note|email|device|location|seed|run/i, "no field name of an unprinted field");
  const after = JSON.parse(await evaluate(`localStorage.getItem(${JSON.stringify(PLAYTEST_KEY)})`));
  assert.deepEqual(leaks(JSON.stringify(after)).filter((c) => !c.includes("run-id") && !c.includes("duel-id")), [],
    "the rewritten log keeps only known fields (run and duel ids of an old row are kept, never printed)");
  check("No planted canary or unprinted field name in the copy; the rewritten log dropped the extra fields",
    {keptUnprinted: leaks(JSON.stringify(after)), stillStoredAtCopy: stillStored});
  const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: true});
  await writeFile(path.join(out, "camp-report-export.png"), Buffer.from(data, "base64"));
  assert.deepEqual(errors, [], "no page errors");
  check("No page exceptions or console errors");
} catch (error) {
  failed = error;
  result.failure = error.stack;
} finally {
  ws.close();
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, sleep(5000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  server.close();
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
  await writeFile(path.join(out, "browser-showdown-camp-export.json"), `${JSON.stringify(result, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${result.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-camp-export.json"))}`);
