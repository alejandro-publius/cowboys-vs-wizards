// Keyboard focus across Showdown redraws, in real headless Chrome (fresh profile, real app route:
// Play, then the Camp's Trail duel when the build has a Camp).
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-keyboard-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
// Every render replaces the board and hand buttons. This plays Boot Hill (?seed=0) with Tab,
// Shift+Tab, Enter and Escape only (CDP Input.dispatchKeyEvent) and checks after every key press
// that focus is still on a usable button in the duel, that starting a pick moves focus to its first
// legal choice, and that cancelling returns focus to the card or troop that opened it. A second
// pass plays by mouse and checks that the screen never moves focus or scrolls for a click.
// The duel's rules, wording and cue timing are untouched; only where focus lands is checked.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-keyboard");
await mkdir(out, {recursive: true});

async function launchChrome() {
  const profile = await mkdtemp("/tmp/kiro-showdown-keys-");
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
const report = {page, chrome: CHROME, viewport: [WIDTH, HEIGHT], checks: [], errors: [], keys: 0, clicks: 0, activations: []};
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
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
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
  const navigate = async (query) => {
    await send("Page.navigate", {url: page + query});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
  };
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()??null`);
  const ended = () => evaluate(`Boolean(document.querySelector('.sd-result'))`);

  const KEYS = {Tab: 9, Enter: 13, Escape: 27};
  const key = async (name, modifiers = 0) => {
    const code = KEYS[name];
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code: name, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(name === "Enter" ? {text: "\r"} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code: name, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
    report.keys += 1;
  };
  // Where keyboard focus is: whether it is a usable button inside the duel, and which one.
  const focus = () => evaluate(`(()=>{const a=document.activeElement,sd=document.getElementById('showdown');
    const usable=a&&a!==document.body&&a.isConnected&&sd.contains(a)&&a.tagName==='BUTTON'&&!a.disabled&&!a.hidden&&a.offsetParent!==null;
    const d=a?.dataset??{};const id=a===document.body?'body':a.id?'#'+a.id:d.card?'card '+d.card:d.enemy?'enemy '+d.enemy:d.own!==undefined?'own '+d.own:d.slot?'slot '+d.slot:a.tagName;
    return{usable,id,enemy:d.enemy??null,own:d.own??null,card:d.card??null,slot:d.slot??null};})()`);
  // Tab (or Shift+Tab) until the focused element matches; fails if it is never reached.
  const tabTo = async (selector, max = 80) => {
    for (const shift of [false, true]) {
      for (let i = 0; i <= max; i += 1) {
        if (await evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})??false`)) return i;
        await key("Tab", shift ? 8 : 0);
      }
    }
    throw Error(`Tab and Shift+Tab never reached ${selector}`);
  };
  // Presses Enter (or Escape) and requires focus to land on a usable duel button afterwards.
  const press = async (name, label) => {
    const from = await focus();
    await key(name);
    await sleep(30);
    const to = await focus();
    report.activations.push({key: name, label, from: from.id, to: to.id});
    assert.ok(to.usable, `${name} on ${from.id} (${label}) left focus on ${to.id}`);
    return to;
  };

  // 1. The real route: Tab to Play on the title, Enter, then Tab into the hand.
  await navigate("?seed=0");
  assert.equal(await evaluate(`localStorage.length`), 0, "fresh Chrome profile has no saved data");
  // Builds with a Camp (issue 143 slice 2) open it from Play; its Trail duel button opens the duel.
  const CAMP = `document.getElementById('showdown-camp')&&!document.getElementById('showdown-camp').hidden`;
  const intoDuel = async (activate) => {
    await activate("#menu-play");
    await wait(`!document.getElementById('showdown').hidden||(${CAMP})`);
    if (await evaluate(CAMP)) await activate("#camp-trail [data-duel=trail]");
    await wait(`!document.getElementById('showdown').hidden`);
  };
  await intoDuel(async (selector) => { await tabTo(selector); await key("Enter"); });
  const intoHand = await tabTo("#sd-hand [data-card]:not(:disabled)");
  check("Tab from Play reaches a playable hand card", {tabs: intoHand});

  // 2. Summon by keyboard on turn 1: focus stays in the duel on a usable button.
  const card = (await focus()).card;
  const turnOne = await press("Enter", `summon ${card}`);
  assert.equal(await evaluate(`Boolean(document.querySelector('#sd-hand [data-card="${card}"]'))`), false, "the card left the hand");
  assert.match(await text("#sd-feedback"), /arrived\.$/);
  check("Enter on a free troop summons it and focus stays on a usable duel button", turnOne);
  await tabTo("#sd-end");
  await press("Enter", "end turn 1");
  await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)`);

  // 3. Attack pick by keyboard: focus moves to the first legal target; Escape returns it; the attack lands.
  let attackPicks = 0, cancels = 0, cardPicks = 0, turns = 1;
  const pickTroop = async (slot) => {
    const to = await press("Enter", `pick troop ${slot}`);
    const legal = await evaluate(`[...document.querySelectorAll('#sd-board [data-enemy]')].map(n=>n.dataset.enemy)`);
    if (legal.length) assert.equal(to.enemy, legal[0], `picking troop ${slot} focuses the first legal target, not ${to.id}`);
    else assert.equal(to.id, "#sd-cover", "a troop with no target focuses Take cover");
    attackPicks += 1;
    return legal;
  };
  const ready = () => evaluate(`[...document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]')].find(n=>/Can attack/.test(n.textContent))?.dataset.own??null`);
  const first = await ready();
  assert.ok(first !== null, "turn 2 has a ready troop");
  await tabTo(`#sd-board [data-own="${first}"]`);
  await pickTroop(first);
  await key("Escape");
  await sleep(30);
  const back = await focus();
  assert.equal(await evaluate(`document.getElementById('sd-cancel').hidden`), true, "Escape cancelled the pick");
  assert.equal(back.own, first, `Escape returns focus to the troop, not ${back.id}`);
  cancels += 1;
  check("Escape cancels an attack pick and returns focus to the troop", back);

  // 4. Play Boot Hill to the end by keyboard, checking focus after every Enter.
  const playTurn = async () => {
    for (let played = 0; played < 4; played += 1) {
      const next = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
      if (!next) break;
      await tabTo(`#sd-hand [data-card="${next}"]`);
      await press("Enter", `play ${next}`);
      const picking = !(await evaluate(`document.getElementById('sd-cancel').hidden`));
      if (picking) {
        cardPicks += 1;
        const choice = await evaluate(`document.querySelector('#sd-board button:not(:disabled)')?.dataset.slot??document.querySelector('#sd-board button:not(:disabled)')?.dataset.base??null`);
        const at = await focus();
        if (choice) assert.equal(at.slot ?? at.id, choice, `the pick for ${next} focuses its first legal choice`);
      }
      for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
        const prompt = await text("#sd-prompt");
        if (/as payment|to carry|Choose an enemy troop/.test(prompt)) {
          // Focus is already on a legal choice; Enter takes it (a tribute toggle keeps focus on that troop).
          const at = await focus();
          assert.ok(at.own !== null || at.enemy !== null, `pick focus is on a board choice, not ${at.id}`);
          const after = await press("Enter", `choose ${at.id}`);
          if (!(await evaluate(`document.getElementById('sd-cancel').hidden`)) && at.own !== null) {
            // An unfinished payment keeps focus on that troop, so Tab moves to the next one.
            assert.equal(after.own, at.own, "an unfinished payment keeps focus on the chosen troop");
            await tabTo("#sd-board [data-side=cowboy] .sd-can[data-own]");
          }
        } else {
          await tabTo("#sd-cancel");
          await press("Enter", "cancel");
          cancels += 1;
        }
      }
    }
    for (let i = 0; i < 3; i += 1) {
      const slot = await ready();
      if (slot === null) break;
      await tabTo(`#sd-board [data-own="${slot}"]`);
      const legal = await pickTroop(slot);
      const before = await text("#sd-feedback");
      if (legal.includes("base")) await tabTo("#sd-board [data-enemy=base]");
      await press("Enter", `attack from ${slot}`);
      await wait(`document.getElementById('sd-feedback').textContent!==${JSON.stringify(before)}`);
      if (await ended()) return;
    }
    await tabTo("#sd-end");
    await press("Enter", `end turn ${turns}`);
    await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)||document.querySelector('.sd-result')`);
    turns += 1;
  };
  while (!(await ended()) && turns < 40) await playTurn();
  const finish = {status: await text("#sd-status"), focus: await focus()};
  assert.equal(finish.status, "You win: the Wizard Base fell.");
  assert.ok(finish.focus.usable && /sd-result|#sd-again|#sd-menu|#sd-camp/.test(finish.focus.id) || await evaluate(`document.getElementById('sd-result').contains(document.activeElement)`),
    `after the result focus is on a result button, not ${finish.focus.id}`);
  check("Boot Hill (?seed=0) won with Tab, Shift+Tab, Enter and Escape only; focus usable after every Enter",
    {...finish, turns, attackPicks, cardPicks, cancels, keys: report.keys, activations: report.activations.length});

  // 4b. Back to camp by keyboard while the win's card offer is still open (bugfix spec
  // .kiro/specs/showdown-camp-return-focus): the Trail tile that started the duel is disabled, so focus
  // goes to the first offered card, not the Camp's Main menu, and the next Enter cannot leave the Camp.
  if (await evaluate(`Boolean(document.querySelector('#sd-result [data-choose]'))`)) {
    await tabTo("#sd-home");
    await key("Enter");
    await wait(CAMP);
    await sleep(30);
    const back = await evaluate(`(()=>{const a=document.activeElement;return{id:a===document.body?'body':a.id?'#'+a.id:a.outerHTML.slice(0,60),
      choose:a.dataset?.choose??null,first:document.querySelector('#camp-claim [data-choose]')?.dataset.choose??null};})()`);
    assert.ok(back.first, "the Camp shows the card offer");
    assert.equal(back.choose, back.first, `Back to camp with an offer open focuses the first offered card, not ${back.id}`);
    check("Back to camp by Enter with the card offer open focuses the first offered card", back);
  }

  // 5. Mouse play: the screen never moves focus or scrolls for a click. Cleared storage, so a
  // Camp build opens Boot Hill again rather than the next Trail duel.
  await evaluate(`localStorage.clear()`);
  await navigate("?seed=0");
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    const scroll = await evaluate(`scrollY`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
    report.clicks += 1;
    await sleep(30);
    const after = await evaluate(`({scroll:scrollY,active:document.activeElement===document.body?'body':document.activeElement.outerHTML.slice(0,60)})`);
    assert.equal(after.scroll, scroll, `a click on ${selector} scrolled the page`);
    return after;
  };
  await intoDuel(click);
  const mouseCard = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)').dataset.card`);
  const afterCard = await click(`#sd-hand [data-card="${mouseCard}"]`);
  assert.equal(afterCard.active, "body", "a mouse summon does not move focus onto another button");
  await click("#sd-end");
  await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)`);
  const mouseTroop = await ready();
  const afterPick = await click(`#sd-board [data-own="${mouseTroop}"]`);
  assert.equal(afterPick.active, "body", "a mouse attack pick does not move focus onto a target");
  await click("#sd-cancel");
  const afterCancel = await evaluate(`document.activeElement===document.body`);
  assert.ok(afterCancel, "a mouse Cancel does not move focus back to the troop");
  await click(`#sd-board [data-own="${mouseTroop}"]`);
  await key("Escape");
  await sleep(30);
  assert.equal(await evaluate(`document.getElementById('sd-cancel').hidden&&document.activeElement===document.body`), true, "Escape after a mouse pick cancels it without moving focus");
  check("Mouse play: no focus moved and no scroll for summon, attack pick, Cancel and Escape", {afterCard, afterPick, clicks: report.clicks});

  assert.deepEqual(report.errors, [], "no page errors");
  check("No page exceptions or console errors");
} catch (error) {
  failed = error;
  report.failure = error.stack;
} finally {
  cdp.close();
  await chrome.close();
  await writeFile(path.join(out, "browser-showdown-keyboard.json"), `${JSON.stringify(report, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-keyboard.json"))}`);
