// The public illustrated title by keyboard, in real headless Chrome (fresh profile, file:// build):
//   node scripts/build-graybox.mjs --diorama --contest
//   node scripts/browser-showdown-first-match-check.mjs dist/cowboys-vs-wizards-showdown-3d.html [outDir]
// Tab and Enter only (CDP Input.dispatchKeyEvent): Ride or Fight? on the title, the Outrider and a target,
// Continue to Boot Hill, then the whole first Boot Hill match (?seed=0, the deal the graybox keyboard check wins).
// Enter on Ride or Fight? hides the title control, so focus must land on the decision the instruction names (the
// Outrider), not on the page; a pointer on the same control leaves focus alone. Chrome's accessibility tree is read at
// each step: the focused control's name and description, the polite play feedback and the turn status. After every
// play, attack and End turn focus must be on a usable duel control. Rules, wording, timers and art are untouched.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built illustrated HTML file (npm run build -- --diorama --contest)");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-first-match");
await mkdir(out, {recursive: true});

async function launchChrome() {
  const profile = await mkdtemp("/tmp/showdown-first-match-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    `--window-size=${WIDTH},${HEIGHT}`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
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

const chrome = await launchChrome();
const cdp = await connect(chrome.url);
const report = {page, chrome: CHROME, viewport: [WIDTH, HEIGHT], checks: [], errors: [], keys: 0, steps: []};
const check = (name, detail) => { report.checks.push({name, passed: true, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };
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
  await send("DOM.enable");
  await send("Accessibility.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 20000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(80); }
    throw Error(`Timed out: ${expression}`);
  };
  const KEYS = {Tab: 9, Enter: 13};
  const key = async (name, modifiers = 0) => {
    const code = KEYS[name];
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code: name, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(name === "Enter" ? {text: "\r"} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code: name, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
    report.keys += 1;
  };
  // The focused element, as the page and as Chrome's accessibility tree see it.
  const focus = () => evaluate(`(()=>{const a=document.activeElement,sd=document.getElementById('showdown');const d=a?.dataset??{};
    const usable=!!a&&a!==document.body&&sd.contains(a)&&a.tagName==='BUTTON'&&!a.disabled&&!a.hidden&&!a.closest('[inert]')&&a.getClientRects().length>0;
    const id=a===document.body?'body':a.id?'#'+a.id:d.card?'card '+d.card:d.enemy?'enemy '+d.enemy:d.own!==undefined?'own '+d.own:d.slot?'slot '+d.slot:a.tagName;
    return{usable,id,card:d.card??null,own:d.own??null,enemy:d.enemy??null,slot:d.slot??null};})()`);
  const axFocused = async () => {
    const {nodes} = await send("Accessibility.getFullAXTree");
    // The document itself also reports focused; the control is the focused node below it.
    const node = nodes.findLast((n) => !n.ignored && n.role?.value !== "RootWebArea" && n.properties?.some((p) => p.name === "focused" && p.value.value === true));
    return node ? {role: node.role?.value ?? "", name: node.name?.value ?? "", description: node.description?.value ?? ""} : null;
  };
  const axOf = async (selector) => {
    const {root} = await send("DOM.getDocument", {depth: 0});
    const {nodeId} = await send("DOM.querySelector", {nodeId: root.nodeId, selector});
    if (!nodeId) return null;
    const {nodes} = await send("Accessibility.getPartialAXTree", {nodeId, fetchRelatives: false});
    const node = nodes[0];
    const prop = (name) => node?.properties?.find((p) => p.name === name)?.value?.value;
    return node ? {ignored: Boolean(node.ignored), role: node.role?.value ?? "", live: prop("live") ?? null, text: await evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent.trim()`)} : null;
  };
  const step = async (label) => {
    const entry = {label, focus: await focus(), ax: await axFocused(),
      status: await evaluate(`document.getElementById('sd-status')?.textContent.trim()??''`),
      feedback: await evaluate(`document.getElementById('sd-feedback')?.textContent.trim()??''`),
      continueShown: await evaluate(`!!document.getElementById('sd-boot-hill')&&!document.getElementById('sd-boot-hill').hidden`)};
    report.steps.push(entry);
    return entry;
  };
  const tabTo = async (selector, max = 80) => {
    for (const shift of [0, 8]) {
      for (let i = 0; i <= max; i += 1) {
        if (await evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})??false`)) return i;
        await key("Tab", shift);
      }
    }
    throw Error(`Tab and Shift+Tab never reached ${selector}`);
  };
  const ended = () => evaluate(`Boolean(document.querySelector('.sd-result'))`);

  // 1. The public title on a fresh profile. ?seed=0 fixes the Boot Hill deal that Continue opens; the challenge is recorded.
  await send("Page.navigate", {url: `${page}?seed=0`});
  await wait(`document.readyState==='complete'&&document.getElementById('menu-challenge')?.textContent==='Ride or Fight?'`);
  assert.equal(await evaluate(`localStorage.length`), 0, "fresh Chrome profile has no saved data");
  const toTitle = await tabTo("#menu-challenge");
  assert.equal((await axFocused())?.name, "Ride or Fight?", "Chrome names the focused title challenge");
  await key("Enter");
  await wait(`!document.getElementById('showdown').hidden&&document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width>0`);
  await sleep(100);
  const opened = await step("Enter on Ride or Fight?");
  // The title control is hidden now. Its keyboard focus moves to the decision the instruction names, not to the page.
  const rider = await evaluate(`[...document.querySelectorAll('#sd-board [data-own]')].find((b)=>b.textContent.includes('Outrider'))?.dataset.slot??null`);
  assert.ok(rider, "the Outrider is a usable choice on the board");
  assert.equal(opened.focus.slot, rider, `Enter on Ride or Fight? focuses the Outrider, not ${opened.focus.id}`);
  const riderAx = opened.ax;
  assert.equal(riderAx?.role, "button", `Chrome reports a focused control after Ride or Fight?, not ${JSON.stringify(riderAx)}`);
  assert.match(riderAx.name, /\bOutrider\b.*Can attack/, "Chrome names the focused Outrider and says it can attack");
  check("Tab and Enter on the title open Ride or Fight? with focus on the Outrider", {tabs: toTitle, focus: opened.focus.id, ax: riderAx});

  // 2. The challenge's legal choice: Enter on the Outrider focuses its first target; the Base describes the Ride.
  await key("Enter");
  await sleep(60);
  const aimed = await step("Enter on the Outrider");
  const legal = await evaluate(`[...document.querySelectorAll('#sd-board [data-enemy]')].map((b)=>b.dataset.enemy)`);
  assert.equal(aimed.focus.enemy, legal[0], `picking the Outrider focuses its first legal target, not ${aimed.focus.id}`);
  await tabTo('#sd-board [data-enemy="base"]');
  const baseAx = await axFocused();
  assert.match(baseAx?.description ?? "", /Ride past: Hit the Base for 1/, "the Base target describes the Ride past outcome");
  check("Enter on the Outrider focuses its first legal target and the Base describes the Ride", {first: aimed.focus.id, base: baseAx});

  // 3. The attack, then Continue to Boot Hill once its playback has finished.
  await key("Enter");
  await sleep(60);
  const struck = await step("Enter on the Wizard Base");
  assert.match(struck.feedback, /Outrider struck the Wizards' Base for 1/, "the polite feedback reports the Ride");
  assert.ok(struck.focus.usable, `after the attack focus is on a usable duel control, not ${struck.focus.id}`);
  await wait(`!!document.getElementById('sd-boot-hill')&&!document.getElementById('sd-boot-hill').hidden`, 15000);
  await sleep(60);
  const offered = await step("Continue to Boot Hill shown");
  const toContinue = await tabTo("#sd-boot-hill");
  check("The Ride is reported in the polite feedback and Continue to Boot Hill is reached by Tab", {afterAttack: struck.focus.id, whenShown: offered.focus.id, tabs: toContinue});
  await key("Enter");
  await wait(`document.getElementById('sd-status').textContent.startsWith('Boot Hill')&&document.querySelector('#sd-field[data-battlefield="boot-hill"] canvas.sd-world')?.width>0`);
  await sleep(60);
  const boot = await step("Enter on Continue to Boot Hill");
  assert.ok(boot.focus.card, `Continue to Boot Hill focuses a playable hand card, not ${boot.focus.id}`);
  check("Enter on Continue to Boot Hill opens Boot Hill with focus on a playable hand card", {focus: boot.focus.id, ax: boot.ax});

  // 4. Boot Hill to the end: free plays, attacks and End turn, by Tab and Enter only.
  const feedback = await axOf("#sd-feedback"), status = await axOf("#sd-status");
  assert.ok(feedback && !feedback.ignored && feedback.live === "polite", `play feedback is a polite live region in the tree: ${JSON.stringify(feedback)}`);
  assert.ok(status && !status.ignored && status.role === "status", `turn status is a status region in the tree: ${JSON.stringify(status)}`);
  let turns = 0, plays = 0, attacks = 0;
  const ready = () => evaluate(`[...document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]')].find((b)=>/Can attack/.test(b.textContent))?.dataset.own??null`);
  while (!(await ended()) && turns < 40) {
    for (let played = 0; played < 4; played += 1) {
      const next = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
      if (!next) break;
      await tabTo(`#sd-hand [data-card="${next}"]`);
      const before = await evaluate(`document.getElementById('sd-feedback').textContent`);
      await key("Enter");
      await sleep(40);
      for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
        const at = await focus();
        if (at.own !== null || at.enemy !== null) { await key("Enter"); await sleep(40); }
        if (!(await evaluate(`document.getElementById('sd-cancel').hidden`))) {
          if (at.own !== null) await tabTo("#sd-board [data-side=cowboy] .sd-can[data-own]");
          else { await tabTo("#sd-cancel"); await key("Enter"); await sleep(40); }
        }
      }
      const after = await step(`turn ${turns + 1}: play ${next}`);
      assert.ok(after.focus.usable, `playing ${next} left focus on ${after.focus.id}`);
      if (after.feedback !== before.trim()) plays += 1;
    }
    for (let i = 0; i < 3; i += 1) {
      const slot = await ready();
      if (slot === null) break;
      await tabTo(`#sd-board [data-own="${slot}"]`);
      await key("Enter");
      await sleep(40);
      if (await evaluate(`!!document.querySelector('#sd-board [data-enemy=base]')`)) await tabTo("#sd-board [data-enemy=base]");
      const target = await axFocused();
      await key("Enter");
      await sleep(40);
      const hit = await step(`turn ${turns + 1}: attack from ${slot}`);
      assert.ok(hit.focus.usable || (await ended()), `the attack from ${slot} left focus on ${hit.focus.id}`);
      assert.ok(target?.description, `the attack target ${target?.name} had a description`);
      attacks += 1;
      if (await ended()) break;
    }
    if (await ended()) break;
    await tabTo("#sd-end");
    await key("Enter");
    await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)||!!document.querySelector('.sd-result')`);
    await sleep(40);
    const next = await step(`turn ${turns + 1}: End turn`);
    assert.ok(next.focus.usable || (await ended()), `End turn left focus on ${next.focus.id}`);
    assert.match(next.feedback, /the Wizards\./, "the polite feedback reports the Wizards' turn");
    turns += 1;
  }
  await sleep(200);
  const finish = await step("result");
  assert.equal(finish.status, "You win: the Wizard Base fell.");
  assert.ok(finish.focus.usable && (await evaluate(`document.getElementById('sd-result').contains(document.activeElement)`)), `after the result focus is on a result control, not ${finish.focus.id}`);
  check("Boot Hill (?seed=0) from the title is won by Tab and Enter; feedback and status are live regions; focus usable after every play, attack and End turn",
    {turns, plays, attacks, status: finish.status, focus: finish.focus.id, ax: finish.ax, keys: report.keys});

  // 5. A pointer opens the same challenge without moving focus: only a keyboard opening carries focus into the duel.
  await evaluate(`localStorage.clear()`);
  await send("Page.navigate", {url: `${page}?seed=0`});
  await wait(`document.readyState==='complete'&&document.getElementById('menu-challenge')?.textContent==='Ride or Fight?'`);
  const point = await evaluate(`(()=>{const b=document.getElementById('menu-challenge').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};})()`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, button: "left", clickCount: 1, ...point});
  await wait(`!document.getElementById('showdown').hidden&&document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width>0`);
  await sleep(100);
  const pointed = await focus();
  assert.ok(!pointed.usable, `a pointer on Ride or Fight? leaves focus alone, not on ${pointed.id}`);
  check("A pointer on Ride or Fight? opens the challenge without moving focus into the duel", {focus: pointed.id});

  assert.deepEqual(report.errors, [], "no page errors");
  check("No page exceptions or console errors");
} catch (error) {
  failed = error;
  report.failure = error.stack;
} finally {
  cdp.close();
  await chrome.close();
  await writeFile(path.join(out, "browser-showdown-first-match.json"), `${JSON.stringify(report, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-first-match.json"))}`);
