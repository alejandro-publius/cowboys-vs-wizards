// The public illustrated title by keyboard, in real headless Chrome (fresh profile, file:// build):
//   node scripts/build-graybox.mjs --diorama --contest
//   node scripts/browser-showdown-first-match-check.mjs dist/cowboys-vs-wizards-showdown-3d.html [outDir]
// Tab and Enter only (CDP Input.dispatchKeyEvent): Play on the title, the Outrider and a target,
// Continue to Boot Hill, then the whole first Boot Hill match (?seed=0, the deal the graybox keyboard check wins).
// Enter on Play hides the title control, so focus must land on the decision the instruction names (the
// Outrider), not on the page; a pointer on the same control leaves focus alone. Chrome's accessibility tree is read at
// each step: the focused control's name and description, the polite play feedback and the turn status. After every
// play, attack and End turn focus must be on a usable duel control. Rules, wording, timers and art are untouched.
// Every node added to the two live regions (#sd-feedback polite, #sd-status role=status) is recorded with Continue to
// Boot Hill's state and the focus at that moment: the offer must be added once per challenge deal, when Continue appears
// after the attack has played, after the kept attack line, without moving focus; never before, never on Boot Hill. A
// pointer run then takes the Fight, Restart this duel, the Ride, leaves mid-attack and plays the challenge again.
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
    return node ? {ignored: Boolean(node.ignored), role: node.role?.value ?? "", name: node.name?.value ?? "", live: prop("live") ?? null} : null;
  };
  const checkRestart = async (name) => {
    const button = await axOf("#sd-restart");
    assert.deepEqual([button?.role, button?.name], ["button", name], "Chrome names the current restart or replay action");
    const layout = await evaluate(`(() => {
      const control = document.getElementById('sd-restart'), box = control.getBoundingClientRect();
      const label = document.createRange();
      label.selectNodeContents(control);
      const text = label.getBoundingClientRect();
      const fits = text.width > 0 && text.height > 0 && text.left >= box.left && text.right <= box.right
        && text.top >= box.top && text.bottom <= box.bottom;
      return {width: box.width, height: box.height, caption: fits ? label.toString().trim() : ''};
    })()`);
    assert.ok(layout.width >= 44 && layout.height >= 44, `${name} has a touch target of at least 44 × 44: ${JSON.stringify(layout)}`);
    assert.equal(layout.caption, name === "Restart this duel" ? "" : name, "ordinary restart hides the caption and each alternative attack shows its full name");
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
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
      if(!n.contains(document.elementFromPoint(x,y)))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, button: "left", clickCount: 1, ...p});
  };
  // What a screen reader is given: each node added to the duel's live regions, as it was added.
  const listen = () => evaluate(`(()=>{window.__live=[];const go=document.getElementById('sd-boot-hill');
    const observer=new MutationObserver((records)=>{for(const r of records){const added=[...r.addedNodes].map((n)=>n.textContent).join('').trim();
      const a=document.activeElement,d=a?.dataset??{};
      const focus=a===document.body?'body':a.id?'#'+a.id:d.card?'card '+d.card:d.enemy?'enemy '+d.enemy:d.own!==undefined?'own '+d.own:d.slot?'slot '+d.slot:a.tagName;
      if(added)window.__live.push({region:r.target.closest('#sd-feedback,#sd-status').id,added,continueShown:!go.hidden,focus});}});
    for(const id of ['sd-feedback','sd-status'])observer.observe(document.getElementById(id),{childList:true,subtree:true});return true;})()`);
  const offers = () => evaluate(`window.__live.filter((l)=>l.added.includes('Continue to Boot Hill'))`);
  const continueShown = `!!document.getElementById('sd-boot-hill')&&!document.getElementById('sd-boot-hill').hidden`;
  // Chrome's live-region semantics for #sd-feedback and for the static text that carries the offer.
  const axLive = async () => {
    const {nodes} = await send("Accessibility.getFullAXTree");
    const prop = (node, name) => node?.properties?.find((p) => p.name === name)?.value?.value ?? null;
    const {root} = await send("DOM.getDocument", {depth: 0});
    const {nodeId} = await send("DOM.querySelector", {nodeId: root.nodeId, selector: "#sd-feedback"});
    const {node: {backendNodeId}} = await send("DOM.describeNode", {nodeId});
    const region = nodes.find((n) => n.backendDOMNodeId === backendNodeId);
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const inRegion = (n) => { for (let up = n; up; up = byId.get(up.parentId)) if (up === region) return true; return false; };
    const note = nodes.find((n) => !n.ignored && n.role?.value === "StaticText" && /Continue to Boot Hill/.test(n.name?.value ?? "") && inRegion(n));
    const shape = (n) => n ? {ignored: Boolean(n.ignored), role: n.role?.value ?? "", name: n.name?.value ?? "", live: prop(n, "live"), atomic: prop(n, "atomic"), relevant: prop(n, "relevant")} : null;
    return {region: shape(region), note: shape(note)};
  };

  // 1. The public title on a fresh profile. ?seed=0 fixes the Boot Hill deal that Continue opens; the challenge is recorded.
  await send("Page.navigate", {url: `${page}?seed=0`});
  const playVisible = `document.readyState==='complete'&&document.getElementById('menu-challenge')?.checkVisibility()`;
  await wait(playVisible);
  assert.match(await evaluate(`document.getElementById('menu-challenge').innerText.trim()`), /^Play$/i, "the title shows Play");
  assert.equal(await evaluate(`localStorage.length`), 0, "fresh Chrome profile has no saved data");
  const toTitle = await tabTo("#menu-challenge");
  assert.equal((await axFocused())?.name, "Play Showdown", "Chrome names the focused Play button");
  await key("Enter");
  await wait(`!document.getElementById('showdown').hidden&&document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width>0`);
  await sleep(100);
  await listen();
  const opened = await step("Enter on Play");
  // The title control is hidden now. Its keyboard focus moves to the decision the instruction names, not to the page.
  const rider = await evaluate(`[...document.querySelectorAll('#sd-board [data-own]')].find((b)=>b.textContent.includes('Outrider'))?.dataset.slot??null`);
  assert.ok(rider, "the Outrider is a usable choice on the board");
  assert.equal(opened.focus.slot, rider, `Enter on Play should focus the Outrider, got ${opened.focus.id}`);
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
  const attackedAt = Date.now();
  assert.match(struck.feedback, /Outrider struck the Wizards' Base for 1/, "the polite feedback reports the Ride");
  assert.ok(struck.focus.usable, `after the attack focus is on a usable duel control, not ${struck.focus.id}`);
  assert.ok(!struck.continueShown && (await offers()).length === 0, "nothing offers Continue to Boot Hill while the attack plays");
  const liveBefore = await axLive();
  await wait(continueShown, 15000);
  const playback = Date.now() - attackedAt;
  await sleep(60);
  const offered = await step("Continue to Boot Hill shown");
  const liveAfter = await axLive();
  const said = await offers();
  report.live = {before: liveBefore, after: liveAfter, additions: await evaluate(`window.__live`), playbackMs: playback};
  assert.equal(said.length, 1, `Continue to Boot Hill is added to a live region once when it appears: ${JSON.stringify(report.live.additions)}`);
  assert.deepEqual({region: said[0].region, continueShown: said[0].continueShown, focus: said[0].focus},
    {region: "sd-feedback", continueShown: true, focus: struck.focus.id}, "the offer goes to the polite feedback as Continue appears, with focus left alone");
  assert.match(offered.feedback, /^Last: The Cowboys' Outrider struck the Wizards' Base for 1\. Continue to Boot Hill\b/, "the attack line stays and the offer follows it");
  assert.equal(offered.focus.id, struck.focus.id, "the offer leaves focus where the attack put it");
  assert.equal(liveAfter.region?.live, "polite", `#sd-feedback stays a polite live region: ${JSON.stringify(liveAfter.region)}`);
  assert.deepEqual([liveAfter.region.atomic, liveAfter.region.relevant], [liveBefore.region.atomic, liveBefore.region.relevant], "the live region keeps its semantics");
  // Chrome reports live-region properties on the region root only; the offer is text in that root's subtree.
  assert.ok(liveAfter.note && !liveAfter.note.ignored && liveBefore.note === null, `Chrome exposes the offer as text inside the polite region, only once Continue appears: ${JSON.stringify(liveAfter.note)}`);
  const toContinue = await tabTo("#sd-boot-hill");
  assert.equal((await offers()).length, 1, "moving focus to Continue repeats nothing");
  check("The Ride is reported in the polite feedback; once it has played, Continue to Boot Hill is announced there once, with focus left alone, and reached by Tab",
    {afterAttack: struck.focus.id, whenShown: offered.focus.id, feedback: offered.feedback, playbackMs: playback, note: liveAfter.note, tabs: toContinue});
  await key("Enter");
  await wait(`document.getElementById('sd-status').textContent.startsWith('Boot Hill')&&document.querySelector('#sd-field[data-battlefield="boot-hill"] canvas.sd-world')?.width>0`);
  await sleep(60);
  const boot = await step("Enter on Continue to Boot Hill");
  assert.ok(boot.focus.card, `Continue to Boot Hill focuses a playable hand card, not ${boot.focus.id}`);
  await checkRestart("Restart this duel");
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
  const onBoot = report.steps.slice(report.steps.findIndex((s) => s.label === "Enter on Continue to Boot Hill"));
  assert.ok(onBoot.every((s) => !s.continueShown && !s.feedback.includes("Continue to Boot Hill")) && (await offers()).length === 1, "Boot Hill neither shows nor repeats the offer");
  check("Boot Hill (?seed=0) from the title is won by Tab and Enter; feedback and status are live regions; focus usable after every play, attack and End turn",
    {turns, plays, attacks, status: finish.status, focus: finish.focus.id, ax: finish.ax, keys: report.keys});

  // 5. A pointer opens the same challenge without moving focus: only a keyboard opening carries focus into the duel.
  await evaluate(`localStorage.clear()`);
  await send("Page.navigate", {url: `${page}?seed=0`});
  await wait(playVisible);
  const challenge = `!document.getElementById('showdown').hidden&&document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width>0`;
  await click("#menu-challenge");
  await wait(challenge);
  await sleep(100);
  const pointed = await focus();
  assert.ok(!pointed.usable, `a pointer on Play should leave focus alone, got ${pointed.id}`);
  check("A pointer on Play opens Ride or Fight? without moving focus into the duel", {focus: pointed.id});

  // 6. Pointer: the Fight, Restart this duel, the Ride, Back to camp mid-attack, then the challenge again from the title.
  // Each deal offers Continue to Boot Hill once, only after its own attack has played; a cut-short attack offers nothing.
  await listen();
  const attack = async (target) => {
    await click(`#sd-board [data-slot="${await evaluate(`[...document.querySelectorAll('#sd-board [data-own]')].find((b)=>b.textContent.includes('Outrider'))?.dataset.slot`)}"]`);
    await wait(`!!document.querySelector('#sd-board [data-enemy="base"]')&&!!document.querySelector('#sd-board [data-slot^="wizard-"][data-enemy]')`);
    await click(target === "base" ? '#sd-board [data-enemy="base"]' : '#sd-board [data-slot^="wizard-"][data-enemy]');
  };
  const offeredOnce = async (count, line, label) => {
    await sleep(60);
    const before = await step(`pointer: ${label}`);
    assert.ok(!before.continueShown && (await offers()).length === count - 1, `${label}: nothing is offered while the attack plays`);
    await wait(continueShown, 15000);
    await sleep(60);
    const after = await step(`pointer: ${label}, Continue shown`);
    const said = await offers();
    assert.equal(said.length, count, `${label}: the offer is added once: ${JSON.stringify(said)}`);
    assert.deepEqual({region: said.at(-1).region, continueShown: said.at(-1).continueShown, focus: said.at(-1).focus, kept: after.focus.id},
      {region: "sd-feedback", continueShown: true, focus: before.focus.id, kept: before.focus.id}, `${label}: offered as Continue appears, focus left alone`);
    assert.match(after.feedback, line, `${label}: the attack line stays before the offer`);
    return after;
  };
  await attack("troop");
  const fight = await offeredOnce(1, /^Last: The Cowboys' Outrider attacked .+\. Continue to Boot Hill\b/, "the Fight");
  await checkRestart("Try riding instead");
  await click("#sd-restart");
  await sleep(300);
  const restarted = await step("pointer: Restart this duel");
  assert.ok(!restarted.continueShown && !restarted.feedback.includes("Continue to Boot Hill") && (await offers()).length === 1, "Restart this duel hides Continue and repeats nothing");
  await attack("base");
  const ride = await offeredOnce(2, /^Last: The Cowboys' Outrider struck the Wizards' Base for 1\. Continue to Boot Hill\b/, "the Ride after Restart");
  await checkRestart("Try fighting instead");
  await click("#sd-restart");
  await attack("base");
  await click("#sd-home");
  const leftEarly = await evaluate(`!document.getElementById('showdown-camp').hidden&&document.getElementById('sd-boot-hill').hidden`);
  assert.ok(leftEarly, "Back to camp was pressed while the attack was still playing");
  await sleep(Math.max(3000, 2 * playback));
  assert.equal((await offers()).length, 2, "an attack cut short by Back to camp offers nothing later");
  // Back to camp returns to the Camp room that holds the Outrider control; Back to map, then Main menu, reach the title.
  if (await evaluate(`!!document.querySelector('#showdown-camp dialog[open]')`)) await click("#showdown-camp dialog[open] header button");
  await click("#camp-home");
  await wait(`document.getElementById('menu-challenge')?.checkVisibility()`);
  await click("#menu-challenge");
  await wait(challenge);
  await sleep(100);
  const again = await step("pointer: Ride or Fight? again");
  assert.ok(!again.continueShown && !again.feedback.includes("Continue to Boot Hill") && (await offers()).length === 2, "the challenge from the title again starts with no offer");
  await attack("base");
  await offeredOnce(3, /^Last: The Cowboys' Outrider struck the Wizards' Base for 1\. Continue to Boot Hill\b/, "the challenge again");
  await click("#sd-boot-hill");
  await wait(`document.getElementById('sd-status').textContent.startsWith('Boot Hill')`);
  await sleep(300);
  const pointedBoot = await step("pointer: Continue to Boot Hill");
  assert.ok(!pointedBoot.continueShown && !pointedBoot.feedback.includes("Continue to Boot Hill") && (await offers()).length === 3, "Boot Hill repeats no offer");
  check("Pointer: the Fight, the Ride after Restart and the challenge again from the title each announce Continue to Boot Hill once after the attack, focus left alone; Restart, leaving mid-attack and Boot Hill add nothing",
    {fight: fight.feedback, ride: ride.feedback, offers: (await offers()).length, liveAdditions: (await evaluate(`window.__live`)).length});

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
