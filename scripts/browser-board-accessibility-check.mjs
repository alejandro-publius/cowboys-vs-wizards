// Real-browser keyboard pass over the match board: Tab/Shift+Tab/Enter/Escape sent
// through CDP Input.dispatchKeyEvent, with document.activeElement read after each
// step. No synthetic clicks and no engine state changes. The only direct focus()
// is the stated starting point on the title screen's Play control.
// Usage: node scripts/browser-board-accessibility-check.mjs <url> [outputdirectory]
// Chrome launch and CDP plumbing follow scripts/browser-menu-check.mjs.
import {spawn} from "node:child_process";
import {mkdtemp, rm, mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 810;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = process.argv[2];
if (!url) throw new Error("Pass the built page URL");
const out = path.resolve(process.argv[3] ?? ".artifacts/board-accessibility/browser");
await mkdir(out, {recursive: true});

async function launchChrome() {
  const profile = await mkdtemp("/tmp/fable-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    `--window-size=${WIDTH},${HEIGHT}`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const ws = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL from Chrome in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}:\n${stderr}`)); });
  });
  return {
    url: ws,
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await Promise.race([exited, sleep(5000)]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      await rm(profile, {recursive: true, force: true, maxRetries: 5});
    },
  };
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
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
    ws.addEventListener("error", () => reject(new Error(`WebSocket error on ${wsUrl}`)));
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

const chrome = await launchChrome(), cdp = await connect(chrome.url);
const report = {url, viewport: [WIDTH, HEIGHT], steps: [], checks: [], errors: [], screenshots: []};
try {
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  await send("Page.bringToFront");
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 30000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(120); }
    throw Error("Timed out: " + expression);
  };
  const key = async (name, keyCode, modifiers = 0) => {
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code: name, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, ...(name === "Enter" ? {text: "\r"} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code: name, modifiers, windowsVirtualKeyCode: keyCode});
  };
  const shot = async (name) => {
    const {data} = await send("Page.captureScreenshot", {format: "png"});
    await writeFile(path.join(out, name + ".png"), Buffer.from(data, "base64"));
    report.screenshots.push(name + ".png");
  };
  // What a keyboard user is on: tag, accessible-name source, state, and whether it can take a key press.
  const active = () => evaluate(`(()=>{const a=document.activeElement;if(!a||a===document.body)return{tag:'BODY',usable:false};
    const visible=a.getClientRects().length>0,inMatch=!!a.closest('#match');
    return{tag:a.tagName,id:a.id||undefined,name:(a.getAttribute('aria-label')??a.textContent.trim()).slice(0,90),
      cardId:a.dataset.cardId,side:a.dataset.side,slot:a.dataset.slot,action:a.dataset.action,
      pressed:a.getAttribute('aria-pressed')??undefined,disabled:!!a.disabled,visible,inMatch,usable:visible&&inMatch&&!a.disabled};})()`);
  const status = () => evaluate(`document.getElementById('match').dataset.status`);
  const step = async (action) => { const entry = {action, status: await status(), active: await active()}; report.steps.push(entry); return entry; };
  const check = (name, passed, detail) => { report.checks.push({name, passed: Boolean(passed), detail}); if (!passed) process.exitCode = 1; };
  const tabTo = async (selector, shift = false, max = 60) => {
    const stops = [];
    // x0 when focus is already there, so no press is spent tabbing away from it.
    for (let i = 0; i <= max; i++) {
      if (await evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})??false`)) {
        const entry = await step(`${shift ? "Shift+Tab" : "Tab"} x${i} to ${selector}`);
        entry.stops = stops;
        return entry;
      }
      await key("Tab", 9, shift ? 8 : 0);
      const at = await active();
      stops.push(at.name ?? at.tag);
    }
    throw Error(`${max} ${shift ? "Shift+Tab" : "Tab"} presses never reached ${selector}: ${stops.join(" > ")}`);
  };
  const enter = async (label, ms = 300) => { await key("Enter", 13); await sleep(ms); return step(`Enter on ${label}`); };
  const CARD = '.match-hand [data-card-id][data-playable]:enabled', LANE = '.match-slot[data-side="cowboy"]:enabled';

  // Title screen: the one stated focus setup, then a real Enter on the normal Play control.
  await send("Page.navigate", {url});
  await wait(`document.querySelector('#title-screen')?.dataset.ready==='true'&&document.getElementById('menu-play')`);
  await evaluate(`document.getElementById('menu-play').focus()`);
  await key("Enter", 13);
  await wait(`!document.getElementById('arena').hidden&&document.getElementById('match').dataset.status==='accepting_input'`, 180000);
  await step("match ready after Enter on #menu-play (initial focus set by script)");

  // 1. Reach a playable card and select it.
  const toCard = await tabTo(CARD);
  check("Tab reaches a playable hand card with a spoken name", toCard.active.name.length > 0, toCard.active);
  const cardId = toCard.active.cardId;
  const picked = await enter("playable card");
  check("Selecting a card keeps focus on it after the hand is rebuilt", picked.active.cardId === cardId && picked.active.pressed === "true", picked.active);

  // 2. Reach a legal lane (lanes precede the hand in tab order) and choose it.
  const toLane = await tabTo(LANE, true);
  check("Shift+Tab reaches a legal lane with a spoken name", /lane \d/.test(toLane.active.name), toLane.active);
  const laned = await enter("legal lane");
  check("After choosing a lane, focus is on a usable board control", laned.active.usable, laned.active);
  await shot("lane-chosen");

  // 3. Cancel with the keyboard.
  await tabTo('[data-action="cancel"]:enabled');
  const cancelled = await enter("Cancel");
  check("After Cancel, focus is on a usable board control", cancelled.active.usable, cancelled.active);
  await shot("after-cancel");

  // 4. Same path again, then Confirm.
  await tabTo(CARD); await enter("playable card");
  await tabTo(LANE, true); await enter("legal lane");
  await tabTo('[data-action="confirm"]:enabled');
  await enter("Confirm");
  await wait(`document.getElementById('match').dataset.status==='accepting_input'`, 60000);
  await sleep(300);
  const confirmed = await step("input accepted again after Confirm");
  check("After Confirm, once input returns, focus is on a usable board control", confirmed.active.usable, confirmed.active);
  await shot("after-confirm");

  // 5. Duel menu dialog: open with Enter, close with Escape, focus returns to its opener.
  await tabTo('[data-action="menu"]', true);
  const opened = await enter("Open duel menu");
  const inDialog = await evaluate(`(()=>{const d=document.querySelector('dialog.match-details');return d.open&&d.contains(document.activeElement);})()`);
  check("Enter opens the duel menu and moves focus inside it", inDialog, opened.active);
  await key("Escape", 27); await sleep(300);
  const closed = await step("Escape in duel menu");
  check("Escape closes the duel menu and returns focus to its opener", closed.active.action === "menu" && !(await evaluate(`document.querySelector('dialog.match-details').open`)), closed.active);

  check("No page errors", report.errors.length === 0, report.errors);
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(out, "board-accessibility-run.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({checks: report.checks.map((c) => `${c.passed ? "PASS" : "FAIL"} ${c.name}`), errors: report.errors, error: report.error ?? null, out}, null, 2));
  cdp.close();
  await chrome.close();
}
