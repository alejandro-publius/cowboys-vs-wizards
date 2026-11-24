// Sheriff's Ledger (The Night Shift) in the graybox Camp: geometry and keyboard check in headless Chrome.
//   npm run build
//   node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
// At 390x844 and 1440x900 on a fresh profile: Play opens the Camp with the ledger collapsed after the Trail;
// entered by Enter on Play, the walk from the Camp's entry focus reaches Boot Hill before the summary by Tab; Enter on the summary opens and closes it; nothing is wider than the
// viewport when open; and the first turn of Boot Hill shows no part of the ledger.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {LEDGER} from "../src/ui/sheriffs-ledger.data.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const positional = process.argv.slice(3).filter((a) => !a.startsWith("--"));
const out = path.resolve(positional[0] ?? ".artifacts/sheriffs-ledger");
// --frames: also save three JPEG key frames at 1440x900 (Camp, Ledger opened, run and review) under <out>/frames,
// with their SHA-256 and visible text in frames.json. For the presentation proof; not part of the checks.
const FRAMES = process.argv.includes("--frames");
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
// The focused control: 'trail' for the Boot Hill tile, 'summary' for the ledger summary.
const focusName = `(()=>{const a=document.activeElement;if(!a||a===document.body)return 'BODY';return a.dataset.duel?'trail':a.closest('#camp-ledger')?(a.tagName==='SUMMARY'?'summary':a.getAttribute('role')||a.tagName):a.id||a.tagName})()`;
const report = {page, checks: [], errors};
const frames = [];
const frame = async (name, selector) => {
  if (!FRAMES) return;
  const text = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:"start"});return n.innerText.slice(0,600)})()`);
  await sleep(150);
  const {data} = await send("Page.captureScreenshot", {format: "jpeg", quality: 70});
  const bytes = Buffer.from(data, "base64");
  await mkdir(path.join(out, "frames"), {recursive: true});
  await writeFile(path.join(out, "frames", `${name}.jpg`), bytes);
  frames.push({file: `frames/${name}.jpg`, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, selector, text});
};
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
    // Controlled keyboard entry: focus Play on the title screen and press Enter.
    await evaluate(`document.getElementById('menu-play').focus()`);
    assert.equal(await evaluate(`document.activeElement?.id`), "menu-play");
    await key("Enter", "Enter", 13);
    await wait(`!document.getElementById('showdown-camp').hidden&&document.querySelector('#camp-ledger summary')`);
    // The control the Camp focuses on entry is the first stop of the keyboard walk below.
    const initial = await evaluate(focusName);
    if (width === 1440) await frame("1-camp", "#showdown-camp");
    const camp = await evaluate(`(()=>{const l=document.getElementById('camp-ledger'),t=document.querySelector('#camp-trail [data-duel=trail]');
      const lb=l.getBoundingClientRect(),tb=t.getBoundingClientRect();
      return {open:l.open,after:!!(t.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_FOLLOWING),trailTop:tb.top,trailBottom:tb.bottom,ledgerTop:lb.top,
        trailVisible:tb.bottom<=innerHeight&&document.elementFromPoint(tb.x+tb.width/2,tb.y+tb.height/2)?.closest('button')===t,
        scrollW:document.documentElement.scrollWidth,summary:l.querySelector('summary').textContent.replace(/\\s+/g,' ').trim()}})()`);
    assert.equal(camp.open, false); assert.ok(camp.after); assert.ok(camp.trailVisible, "Boot Hill tile visible and uncovered in the first viewport");
    assert.ok(camp.ledgerTop >= camp.trailBottom); assert.ok(camp.scrollW <= width, `page ${camp.scrollW}px wide at ${width}px`);
    check(`${width}px: ledger collapsed after the Trail; Boot Hill uncovered in the first view; no horizontal overflow`, camp);
    // Keyboard: from the Camp's entry focus (recorded as the first stop), Tab reaches Boot Hill and then
    // the ledger summary without leaving the page; Shift+Tab from the summary retraces the walk to Boot Hill.
    // The walk does not blur first:
    // Chrome keeps a blurred control as the Tab starting point, so a blurred entry focus would be skipped.
    const order = [initial];
    for (let i = 0; i < 40 && order.at(-1) !== "summary"; i += 1) {
      await key("Tab", "Tab", 9);
      order.push(await evaluate(focusName));
    }
    const trailAt = order.indexOf("trail"), summaryAt = order.indexOf("summary");
    assert.ok(trailAt >= 0 && summaryAt > trailAt && !order.includes("BODY"), `focus order ${order}`);
    const ring = await evaluate(`getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth`);
    const back = [];
    for (let i = 0; i < 40 && back.at(-1) !== "trail"; i += 1) {
      await key("Tab", "Tab", 9, true);
      back.push(await evaluate(focusName));
    }
    assert.deepEqual(back, order.slice(0, -1).reverse(), `Shift+Tab from the summary does not retrace the walk to Boot Hill: ${back}`);
    for (let i = 0; i < back.length; i += 1) await key("Tab", "Tab", 9);
    assert.equal(await evaluate(focusName), "summary", "Tab back to the ledger summary");
    check(`${width}px: keyboard entry focuses ${initial}; Tab reaches Boot Hill before the ledger summary; Shift+Tab walks back to Boot Hill`,
      {initial, order, back, focusOutline: ring});
    await key("Enter", "Enter", 13);
    await wait(`document.getElementById('camp-ledger').open`);
    // The card table is the region labelled by the "Cards" heading. The open ledger also holds other tables
    // (the Billy replay's 3-row seat table), so rows are counted inside that region only.
    const opened = await evaluate(`(()=>{const l=document.getElementById('camp-ledger');const wrap=l.querySelector('.sd-ledger-wrap[aria-labelledby=ledger-cards]');
      const rows=[...wrap.querySelectorAll('tbody tr')];
      const right=Math.max(...[...l.querySelectorAll('*')].map(n=>n.closest('.sd-ledger-wrap')&&n!==n.closest('.sd-ledger-wrap')?0:n.getBoundingClientRect().right));
      return {rows:rows.length,visibleRows:rows.filter(r=>r.getClientRects().length>0).length,allTableRows:l.querySelectorAll('tbody tr').length,
        names:rows.map(r=>r.querySelector('th strong')?.textContent),
        notObserved:rows.filter(r=>r.cells[1+0]&&r.lastElementChild.textContent==='Not observed').length,
        summary:l.querySelector('summary').textContent.replace(/\\s+/g,' ').trim(),
        scrollW:document.documentElement.scrollWidth,right,wrapScroll:wrap.scrollWidth-wrap.clientWidth,run:document.getElementById('ledger-run').textContent}})()`);
    const cards = LEDGER.catalog.count;
    assert.equal(LEDGER.cards.length, cards, "ledger payload card list matches its catalog count");
    assert.equal(opened.rows, cards); assert.equal(opened.visibleRows, cards); assert.equal(opened.notObserved, cards);
    assert.deepEqual(opened.names, LEDGER.cards.map((c) => c.name), "card table rows follow the ledger payload");
    assert.ok(opened.summary.includes(`${cards} cards`), opened.summary);
    assert.ok(opened.scrollW <= width && opened.right <= width, `open ledger fits ${width}px`);
    assert.ok(opened.run.includes(`commit ${LEDGER.run.revision.slice(0, 7)} against ${LEDGER.run.baseline.slice(0, 7)}, seeds 0–999`), opened.run);
    check(`${width}px: Enter opens the ledger; card table has ${cards} visible rows, all Not observed; fits the viewport`, opened);
    const review = await evaluate(`document.getElementById('ledger-review').textContent`);
    for (const v of LEDGER.reviews) assert.ok(review.includes(`${v.card} ${v.field} ${v.from} → ${v.to}: ${v.verdict}.`), review);
    check(`${width}px: the Night Shift review state of this run is shown (${LEDGER.reviews.map((v) => v.verdict).join(", ") || "none"})`, {review});
    if (width === 1440) { await frame("2-ledger-open", "#camp-ledger"); await frame("3-review", "#ledger-review"); }
    // The Billy replay (src/ui/billy-replay.js) sits between the summary and the card table, so Tab passes its
    // visible controls before the Cards region. Every intervening stop must be a visible control inside the replay
    // section; the Cards region (role=region, aria-labelledby=ledger-cards) must follow within a few Tabs; and
    // Shift+Tab must retrace the same stops back to the summary.
    const stop = `(()=>{const a=document.activeElement;if(!a||a===document.body)return {id:'BODY'};
      const t=(a.getAttribute('aria-label')||a.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60);
      const id=a.matches('#camp-ledger > summary')?'summary':a.matches('[role=region][aria-labelledby=ledger-cards]')?'cards-region':
        a.tagName.toLowerCase()+(a.dataset.billyLine?'[data-billy-line='+a.dataset.billyLine+']':a.dataset.billyStep?'[data-billy-step='+a.dataset.billyStep+']':'')+(a.getAttribute('role')?'[role='+a.getAttribute('role')+']':'')+' "'+t+'"';
      return {id,inBilly:!!a.closest('#ledger-billy'),inLedger:!!a.closest('#camp-ledger'),visible:a.getClientRects().length>0&&getComputedStyle(a).visibility!=='hidden'}})()`;
    assert.equal((await evaluate(stop)).id, "summary", "focus on the ledger summary after Enter");
    const MAX_TABS = 8;
    const fwd = [];
    for (let i = 0; i < MAX_TABS && fwd.at(-1)?.id !== "cards-region"; i += 1) { await key("Tab", "Tab", 9); fwd.push(await evaluate(stop)); }
    const fwdIds = fwd.map((s) => s.id);
    assert.equal(fwdIds.at(-1), "cards-region", `Cards region not reached within ${MAX_TABS} Tabs: ${fwdIds}`);
    const between = fwd.slice(0, -1);
    assert.ok(between.length > 0 && between.every((s) => s.inBilly && s.visible), `intervening stops must be visible Billy replay controls: ${JSON.stringify(between)}`);
    assert.ok(fwd.every((s) => s.inLedger), `focus left the ledger: ${fwdIds}`);
    const rev = [];
    for (let i = 0; i < fwd.length; i += 1) { await key("Tab", "Tab", 9, true); rev.push((await evaluate(stop)).id); }
    assert.deepEqual(rev, [...between.map((s) => s.id).reverse(), "summary"], `Shift+Tab does not retrace to the summary: ${rev}`);
    await key("Enter", "Enter", 13);
    await wait(`!document.getElementById('camp-ledger').open`);
    check(`${width}px: Tab passes ${between.length} visible Billy replay controls to the Cards region; Shift+Tab retraces to the summary; Enter closes the ledger`,
      {forward: fwdIds, reverse: rev});
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
if (FRAMES && !failed) await writeFile(path.join(out, "frames.json"), `${JSON.stringify({page, ledgerRun: LEDGER.run.source, revision: LEDGER.run.revision, frames}, null, 2)}\n`);
ws.close(); child.kill("SIGTERM"); await sleep(500); await rm(profile, {recursive: true, force: true, maxRetries: 5});
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-ledger.json"))}`);
