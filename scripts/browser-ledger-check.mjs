// Sheriff's Ledger (The Night Shift) in the graybox Camp: geometry and keyboard check in headless Chrome.
//   npm run build
//   node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
// At 390x844 and 1440x900 on a fresh profile: Play opens the Camp with the ledger collapsed after the Trail;
// Boot Hill is reachable before it by Tab; Enter on the summary opens and closes it; nothing is wider than the
// viewport when open; and the first turn of Boot Hill shows no part of the ledger.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? ".artifacts/sheriffs-ledger");
await mkdir(out, {recursive: true});

const profile = await mkdtemp("/tmp/kiro-ledger-chrome-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
const wsUrl = await new Promise((resolve, reject) => {
  let err = "";
  const timer = setTimeout(() => reject(new Error(`no DevTools URL:\n${err}`)), 30000);
  child.stderr.on("data", (c) => { err += c; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
const waiting = new Map(), errors = [];
let next = 0, sessionId;
ws.addEventListener("message", ({data}) => {
  const m = JSON.parse(data);
  if (m.id === undefined) {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    return;
  }
  const w = waiting.get(m.id); waiting.delete(m.id);
  m.error ? w.reject(new Error(`${w.method}: ${m.error.message}`)) : w.resolve(m.result);
});
const send = (method, params = {}) => { const id = ++next; ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  return new Promise((resolve, reject) => waiting.set(id, {resolve, reject, method})); };
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const wait = async (expr, ms = 15000) => { const stop = Date.now() + ms; while (Date.now() < stop) { if (await evaluate(expr)) return; await sleep(100); } throw Error(`Timed out: ${expr}`); };
const key = async (k, code, keyCode, shift = false) => {
  const text = k === "Enter" ? {text: "\r", unmodifiedText: "\r"} : {};
  for (const type of [k === "Enter" ? "keyDown" : "rawKeyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {type, key: k, code, windowsVirtualKeyCode: keyCode, modifiers: shift ? 8 : 0, ...(type === "keyUp" ? {} : text)});
  }
  if (k === "Enter") await sleep(50);
};
const report = {page, checks: [], errors};
const check = (name, detail) => { report.checks.push({name, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };
let failed = null;
try {
  ({sessionId} = await send("Target.attachToTarget", {targetId: (await send("Target.createTarget", {url: "about:blank"})).targetId, flatten: true}));
  await send("Page.enable"); await send("Runtime.enable");
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await send("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile: width < 600});
    await send("Page.navigate", {url: page});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
    await evaluate(`localStorage.clear()`);
    await send("Page.navigate", {url: page});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
    await evaluate(`document.getElementById('menu-play').click()`);
    await wait(`!document.getElementById('showdown-camp').hidden&&document.querySelector('#camp-ledger summary')`);
    const camp = await evaluate(`(()=>{const l=document.getElementById('camp-ledger'),t=document.querySelector('#camp-trail [data-duel=trail]');
      const lb=l.getBoundingClientRect(),tb=t.getBoundingClientRect();
      return {open:l.open,after:!!(t.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_FOLLOWING),trailTop:tb.top,trailBottom:tb.bottom,ledgerTop:lb.top,
        trailVisible:tb.bottom<=innerHeight&&document.elementFromPoint(tb.x+tb.width/2,tb.y+tb.height/2)?.closest('button')===t,
        scrollW:document.documentElement.scrollWidth,summary:l.querySelector('summary').textContent.replace(/\\s+/g,' ').trim()}})()`);
    assert.equal(camp.open, false); assert.ok(camp.after); assert.ok(camp.trailVisible, "Boot Hill tile visible and uncovered in the first viewport");
    assert.ok(camp.ledgerTop >= camp.trailBottom); assert.ok(camp.scrollW <= width, `page ${camp.scrollW}px wide at ${width}px`);
    check(`${width}px: ledger collapsed after the Trail; Boot Hill uncovered in the first view; no horizontal overflow`, camp);
    // Keyboard: Tab from the start of the page reaches Boot Hill, then later the ledger summary.
    await evaluate(`document.activeElement?.blur()`);
    const order = [];
    for (let i = 0; i < 40; i += 1) {
      await key("Tab", "Tab", 9);
      const at = await evaluate(`(()=>{const a=document.activeElement;return a.dataset.duel?'trail':a.closest('#camp-ledger')?(a.tagName==='SUMMARY'?'summary':a.getAttribute('role')||a.tagName):a.id||a.tagName})()`);
      order.push(at);
      if (at === "summary") break;
    }
    assert.ok(order.includes("trail") && order.indexOf("trail") < order.indexOf("summary"), `focus order ${order}`);
    const ring = await evaluate(`getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth`);
    check(`${width}px: Tab reaches Boot Hill before the ledger summary`, {order, focusOutline: ring});
    await key("Enter", "Enter", 13);
    await wait(`document.getElementById('camp-ledger').open`);
    const opened = await evaluate(`(()=>{const l=document.getElementById('camp-ledger');const rows=[...l.querySelectorAll('tbody tr')];
      const right=Math.max(...[...l.querySelectorAll('*')].map(n=>n.closest('.sd-ledger-wrap')&&n!==n.closest('.sd-ledger-wrap')?0:n.getBoundingClientRect().right));
      const wrap=l.querySelector('.sd-ledger-wrap');
      return {rows:rows.length,notObserved:rows.filter(r=>r.cells[1+0]&&r.lastElementChild.textContent==='Not observed').length,
        scrollW:document.documentElement.scrollWidth,right,wrapScroll:wrap.scrollWidth-wrap.clientWidth,run:document.getElementById('ledger-run').textContent}})()`);
    assert.equal(opened.rows, 29); assert.equal(opened.notObserved, 29);
    assert.ok(opened.scrollW <= width && opened.right <= width, `open ledger fits ${width}px`);
    assert.match(opened.run, /commit 3dd47f1 against a9aa828, seeds 0–999/);
    check(`${width}px: Enter opens the ledger; 29 rows, all Not observed; fits the viewport`, opened);
    await key("Tab", "Tab", 9);
    const region = await evaluate(`document.activeElement.getAttribute('role')`);
    assert.equal(region, "region");
    await key("Tab", "Tab", 9, true);
    await key("Enter", "Enter", 13);
    await wait(`!document.getElementById('camp-ledger').open`);
    check(`${width}px: the card table region takes focus; Shift+Tab and Enter close the ledger`);
    await evaluate(`document.querySelector('#camp-trail [data-duel=trail]').click()`);
    await wait(`!document.getElementById('showdown').hidden&&document.getElementById('showdown-camp').hidden`);
    const turn = await evaluate(`({inDuel:!!document.querySelector('#showdown .sd-ledger,#showdown #camp-ledger'),
      visible:[...document.querySelectorAll('.sd-ledger')].some(n=>n.getClientRects().length>0),scrollW:document.documentElement.scrollWidth})`);
    assert.deepEqual([turn.inDuel, turn.visible], [false, false]);
    check(`${width}px: Boot Hill's first turn shows no part of the ledger`, turn);
    if (width === 390) {
      await evaluate(`document.getElementById('sd-camp')?.click()`);
    }
  }
  assert.deepEqual(errors, [], "no page errors");
} catch (error) { failed = error; report.failure = error.stack; }
await writeFile(path.join(out, "browser-ledger.json"), `${JSON.stringify(report, null, 2)}\n`);
ws.close(); child.kill("SIGTERM"); await sleep(500); await rm(profile, {recursive: true, force: true, maxRetries: 5});
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-ledger.json"))}`);
