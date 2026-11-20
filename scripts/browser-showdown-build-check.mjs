// K-087: real-browser check that the Camp's playtest report names the build each duel was finished under,
// across an older standalone build that records no build and the current one.
//   node scripts/build-graybox.mjs            (the current build, from this checkout)
//   node scripts/browser-showdown-build-check.mjs <older.html> <current.html> [outDir]
// <older.html> is a graybox standalone built from an earlier commit (before K-087); both files are opened
// as file:// pages in one fresh headless Chrome profile, so they share one browser's storage, as two
// downloaded copies of the game do. Every step is a mouse click on the normal entry (Play, the Camp,
// Boot Hill, Raven Roost, Playtest report, Copy report) with ?seed=0 fixing the deals. Bot-driven:
// it says nothing about clarity or fun, and no human played.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {grayboxBuildLabel} from "./graybox-build-label.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[3]) throw new Error("Pass the older and the current graybox HTML files");
const older = pathToFileURL(path.resolve(process.argv[2])).href;
const current = pathToFileURL(path.resolve(process.argv[3])).href;
const out = path.resolve(process.argv[4] ?? ".artifacts/showdown-build-k087");
const BUILD = grayboxBuildLabel(fileURLToPath(new URL("../", import.meta.url)));
assert.ok(BUILD, "run from a git checkout so the current build has a label");
await mkdir(out, {recursive: true});

const profile = await mkdtemp("/tmp/kiro-showdown-build-chrome-");
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++next;
  waiting.set(id, {resolve, reject, method});
  ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
});

const result = {older: process.argv[2], current: process.argv[3], currentBuild: BUILD, chrome: CHROME, checks: [], errors,
  note: "Scripted headless Chrome over the DevTools protocol; not a human playtest."};
const check = (name, detail) => { result.checks.push({name, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };
let failed = null;
try {
  const {targetId} = await send("Target.createTarget", {url: "about:blank"});
  ({sessionId} = await send("Target.attachToTarget", {targetId, flatten: true}));
  await send("Page.enable");
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
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
  const open = async (page) => {
    await send("Page.navigate", {url: `${page}?seed=0`});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
    await click("#menu-play");
    await wait(shown("showdown-camp"));
  };
  const savedLog = () => evaluate(`JSON.parse(localStorage.getItem('cvw-showdown-playtest-v1'))`);
  const campReport = async () => {
    if (!(await evaluate(`document.getElementById('camp-report').open`))) await click("#camp-report summary");
    return evaluate(`document.getElementById('camp-report-text').value`);
  };
  // The same click loop as browser-showdown-check.mjs: play what is enabled, attack with what is ready, end the turn.
  const over = () => evaluate(`Boolean(document.querySelector('.sd-result'))`);
  async function winNextTrail() {
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
    assert.equal(await evaluate(`document.getElementById('sd-status').textContent`), "You win: the Wizard Base fell.");
    await click("#sd-result [data-choose]");
    await wait(`!document.querySelector('#sd-result [data-choose]')`);
    await click("#sd-camp");
    await wait(shown("showdown-camp"));
  }

  // 1. The older standalone build: a fresh profile, Boot Hill won. Its line has no build, as before K-087.
  await open(older);
  assert.equal(await evaluate(`localStorage.getItem('cvw-showdown-playtest-v1')`), null, "fresh profile");
  await winNextTrail();
  const log1 = await savedLog();
  assert.equal(log1.length, 1);
  assert.equal(log1[0].name, "Boot Hill");
  assert.equal("build" in log1[0], false);
  const olderReport = await campReport();
  assert.doesNotMatch(olderReport, /build/i, "the older build's report has no build lines");
  check("Older standalone build: Boot Hill win logged without a build, report unchanged in form", {line: log1[0], report: olderReport});

  // 2. The current build, same browser storage: it resumes the career and reports the old duel as unrecorded.
  await open(current);
  const resumed = await campReport();
  assert.ok(resumed.startsWith(olderReport.split("\n\nDuel by duel:")[0].split("\nCards in the deck now:")[0]), "the old report's lines lead the new one");
  assert.ok(resumed.includes(`\nThis report is from game build ${BUILD}.\nDuels by build: 1 build not recorded.\n`), resumed);
  assert.deepEqual(await savedLog(), log1, "opening the report on the current build relabels nothing and writes nothing");
  check("Current build resumes the older career: the Boot Hill duel is not attributed to the current build", {report: resumed});

  // 3. Raven Roost on the current build: the new line carries the current build; the old one still none.
  await winNextTrail();
  const log2 = await savedLog();
  assert.equal(log2.length, 2);
  assert.deepEqual(log2[0], log1[0]);
  assert.deepEqual([log2[1].name, log2[1].build], ["Raven Roost", BUILD]);
  assert.deepEqual(Object.keys(log2[1]).sort(), ["build", "duel", "name", "rules", "run", "seconds", "seed", "turns", "won"], "no other field is stored");
  const mixed = await campReport();
  assert.match(mixed, /^Showdown playtest report\nFinished 2 duels in \d+ (s|min) of play: won 2, lost 0\.\n/);
  assert.match(mixed, new RegExp(`\\n1\\. Boot Hill: won in ${log1[0].turns} turns, [^\\n]*\\n2\\. Raven Roost: won in ${log2[1].turns} turns, [^\\n]*$`));
  assert.ok(mixed.includes(`\nDuels by build: 1 build not recorded; 2 on ${BUILD}.\n`), mixed);
  assert.match(mixed, /\nReached and the deck are the saved career, which can include duels finished on other builds or before this log began\.\n/);
  await click("#camp-report-copy");
  await wait(`/^(Copied\\.|Selected: press Ctrl\\+C or Cmd\\+C to copy\\.)$/.test(document.getElementById('camp-report-copied').textContent)`);
  const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: true});
  await writeFile(path.join(out, "camp-report-two-builds.png"), Buffer.from(data, "base64"));
  check("Raven Roost on the current build is attributed to it; the report separates the two builds; Copy report answers",
    {report: mixed, copied: await evaluate(`document.getElementById('camp-report-copied').textContent`)});

  // 4. Back on the older build: it still reads the shared log (it ignores the build field when showing it).
  await open(older);
  const back = await campReport();
  assert.match(back, /\n1\. Boot Hill: won [^\n]*\n2\. Raven Roost: won /);
  assert.deepEqual(await savedLog(), log2, "showing the report on the older build writes nothing");
  check("The older build still reads the shared log and shows both duels", {report: back});
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
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
  await writeFile(path.join(out, "browser-showdown-build.json"), `${JSON.stringify(result, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${result.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-build.json"))}`);
