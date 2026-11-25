// K-006 + K-034 + K-036: the deck a player builds after Raven Roost is the Cowboy deck The Bone Fence is dealt from.
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-deck-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
//
// Developer check only; it changes no runtime file and gives the page no test hook. Native headless Chrome,
// a fresh temporary profile, empty storage, the built page over a loopback HTTP server (the harness of
// browser-showdown-modes-check.mjs). No save is written by the test: the career is played from the menu.
//   1. Play -> Camp; Boot Hill and Raven Roost won by mouse presses on visible, topmost buttons (?seed=N tried
//      in turn as the modes check does); the offered card taken is the one named in PICKS.
//   2. Keyboard only (CDP key events: Tab, Shift+Tab, Enter, Space): Build deck, a legal change, Cancel. The
//      stored save is byte-identical before and after, the Camp lists the old deck and focus is back on Build deck.
//   3. Keyboard only: a legal change (Sheriff -1, Outrider +1, the third Outrider just earned), Save deck, reload,
//      the Camp lists it.
//   4. Keyboard only: Play, then The Bone Fence from the Camp, under a Bone Fence seed chosen below.
//   5. Boundary: (a) a CDP Debugger logpoint at the entry of the built page's createShowdown records the
//      Cowboy deck it is called with; (b) the Cowboy opening hand on screen is compared with Node
//      createShowdown(seed, duelFor(expected save, "trail").options). Both must equal the independently computed
//      edited deck and must not equal the same-seed default deck or an off-by-one variant (negative controls).
//      DECK_CHECK_EXPECT=default (or offByOne) makes the check expect that wrong deck; the run must then fail.
// Storage is only read, for comparison. The debugger capture is test-side; only the Cowboy deck is recorded.
// Scripted flow and storage check. Not a human playtest; says nothing about clarity or fun.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {TYPES} from "../src/game/showdown/cards.js";
import {choose, duelFor, newSave, settle} from "../src/game/showdown/progress.js";
import {createShowdown} from "../src/game/showdown/rules.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const SEEDS = Array.from({length: 20}, (_, i) => i); // tried in turn until a Trail duel is won
const PICKS = ["cowboy-covered-wagon", "cowboy-outrider"]; // the card taken from each win's offer
const CANCEL_EDIT = [["cowboy-sheriff", -1], ["cowboy-covered-wagon", 1]]; // legal, then cancelled
const SAVE_EDIT = [["cowboy-sheriff", -1], ["cowboy-outrider", 1]]; // legal, saved
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nameOf = (type) => TYPES[type].name;
const typeOf = (id) => id.replace(/-\d+$/, "");
const edit = (deck, changes) => { const next = {...deck}; for (const [type, by] of changes) next[type] = (next[type] ?? 0) + by; return next; };
const listed = (deck) => Object.entries(deck).filter(([, n]) => n > 0).map(([type, n]) => `${nameOf(type)} ×${n}`).join(", ");

if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const html = await readFile(path.resolve(process.argv[2]));
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-deck-to-combat");
await mkdir(out, {recursive: true});

const server = createServer((req, res) => {
  if (new URL(req.url, "http://x").pathname === "/game.html") { res.writeHead(200, {"content-type": "text/html; charset=utf-8"}); res.end(html); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const page = `http://127.0.0.1:${server.address().port}/game.html`;

async function launchChrome() {
  const profile = await mkdtemp("/tmp/kiro-deck-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars",
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

const LIB = `const vis=(n)=>Boolean(n&&n.getClientRects().length&&n.checkVisibility({checkVisibilityCSS:true}));
  const camp=()=>{const c=document.getElementById('showdown-camp');return vis(c)?c:null;};
  const buttons=(root=document)=>[...root.querySelectorAll('button')].filter(vis);
  const txt=(n)=>(n?.innerText??'').replace(/[ \\t]+/g,' ').trim();`;

const report = {page: "graybox build over loopback HTTP", chrome: CHROME, viewport: [WIDTH, HEIGHT], checks: [], keys: [], clicks: 0, games: [], errors: []};
const check = (name, detail) => { report.checks.push({name, passed: true, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };

const chrome = await launchChrome();
const cdp = await connect(chrome.url);
let failed = null;
try {
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  const scripts = [], captures = [];
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "debug" && params.args[0]?.value === "KIRO-DECK-CAPTURE") captures.push(JSON.parse(params.args[1].value));
    else if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
    if (method === "Debugger.scriptParsed") scripts.push(params);
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression: `(()=>{${LIB}return(${expression});})()`, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, what = expression, ms = 15000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(80); }
    throw Error(`Timed out waiting for ${what}`);
  };
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()??null`);
  const rawSave = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`); // read-only
  const shot = async (name) => {
    const {data} = await send("Page.captureScreenshot", {format: "png"});
    await writeFile(path.join(out, `${name}.png`), Buffer.from(data, "base64"));
  };
  const load = async (query = "") => {
    await send("Page.navigate", {url: page + query});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`, "the title screen");
  };

  // ---- Mouse, for the two Trail wins (as browser-showdown-modes-check.mjs) ----
  const press = async (finder, what) => {
    const p = await evaluate(`(()=>{const n=(${finder});if(!n)throw Error('Missing: '+${JSON.stringify(what)});if(n.disabled)throw Error('Disabled: '+${JSON.stringify(what)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(what)});return{x,y};})()`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
    report.clicks += 1;
  };
  const click = (selector) => press(`document.querySelector(${JSON.stringify(selector)})`, selector);
  const resultShown = () => evaluate(`Boolean(document.querySelector('#showdown .sd-result'))`);
  const playGame = async () => {
    let turns = 0;
    while (!(await resultShown()) && turns < 120) {
      for (let played = 0; played < 4; played += 1) {
        const card = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
        if (!card) break;
        await click(`#sd-hand [data-card="${card}"]`);
        for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
          const prompt = await text("#sd-prompt");
          if (/as payment|to carry/.test(prompt)) await click(`#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]`);
          else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
          else await click("#sd-cancel");
        }
        if (await resultShown()) break;
      }
      for (let i = 0; i < 3 && !(await resultShown()); i += 1) {
        const ready = await evaluate(`[...document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]')].find(n=>/Can attack/.test(n.textContent))?.dataset.slot??null`);
        if (!ready) break;
        await click(`#sd-board [data-side=cowboy] [data-slot="${ready}"]`);
        const aim = await evaluate(`({base:Boolean(document.querySelector('[data-enemy=base]')),troops:document.querySelectorAll('.sd-slot[data-enemy]').length})`);
        if (!aim.base && !aim.troops) { if (!(await evaluate(`document.getElementById('sd-cancel').hidden`))) await click("#sd-cancel"); break; }
        const before = await text("#sd-feedback");
        await click(aim.base ? "[data-enemy=base]" : ".sd-slot[data-enemy]");
        await wait(`document.getElementById('sd-feedback').textContent!==${JSON.stringify(before)}`, "the attack's feedback line");
      }
      if (await resultShown()) break;
      await click("#sd-end");
      await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)||document.querySelector('#showdown .sd-result')`, "the next turn", 30000);
      turns += 1;
    }
    assert.ok(await resultShown(), `no result after ${turns} turns`);
    return (await text("#sd-status")).startsWith("You win");
  };
  const winTrail = async (name, pick, claimInCamp = false) => {
    const results = [];
    for (const seed of SEEDS) {
      await load(`?seed=${seed}`);
      await click("#menu-play");
      await wait(`Boolean(camp())`, "the Camp");
      await click("#camp-trail [data-duel=trail]");
      await wait(`/ · turn \\d+ · /.test(document.getElementById('sd-status').textContent)`, `${name} to open`);
      assert.match(await text("#sd-status"), new RegExp(name));
      const won = await playGame();
      results.push(won);
      report.games.push({duel: name, seed, won});
      if (!won) continue;
      if (claimInCamp) {
        await click("#sd-camp");
        await wait(`Boolean(camp())`, "the unclaimed reward in Camp");
      }
      const offer = await evaluate(`buttons(document).filter(n=>n.dataset.choose).map(n=>n.dataset.choose)`);
      assert.ok(offer.includes(pick), `${pick} offered after ${name}: ${offer}`);
      await press(`buttons(document).find(n=>n.dataset.choose===${JSON.stringify(pick)})`, pick);
      await wait(`!buttons(document).some(n=>n.dataset.choose)`, "the offer to close");
      const savedReward = await rawSave();
      const route = claimInCamp ? "#camp-claim" : "#sd-result";
      const shortcut = `${route} [data-build-reward]`;
      assert.equal(await text(shortcut), `Build with ${nameOf(pick)}`);
      await activate(shortcut);
      await wait(builderOpen, "the reward's deck row");
      assert.ok(await evaluate(`document.activeElement.matches(${JSON.stringify(step(pick, 1))})`), "the earned card's add-to-deck control has focus");
      assert.equal(await rawSave(), savedReward, "opening the builder leaves the saved deck intact");
      await activate("#builder-cancel");
      await wait(`Boolean(camp())`, "the Camp");
      assert.equal(await rawSave(), savedReward, "cancelling keeps the claimed card and the original deck");
      return {seed, results, offer, pick};
    }
    throw Error(`${name} not won with seeds ${SEEDS.join(",")}`);
  };

  // ---- Keyboard (as browser-showdown-keyboard-check.mjs, plus Space) ----
  const KEYS = {Tab: [9, "Tab"], Enter: [13, "Enter", "\r"], " ": [32, "Space", " "]};
  const key = async (name, modifiers = 0) => {
    const [code, physical, chars] = KEYS[name];
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code: physical, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(chars ? {text: chars} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code: physical, modifiers, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
  };
  const focused = () => evaluate(`(()=>{const a=document.activeElement;return a===document.body?'body':a.id?'#'+a.id:a.getAttribute('aria-label')??a.dataset.duel??a.outerHTML.slice(0,60);})()`);
  // Tab, then Shift+Tab, until the focused element matches; records the count. Fails if never reached.
  const tabTo = async (selector, max = 200) => {
    for (const shift of [false, true]) {
      for (let i = 0; i <= max; i += 1) {
        if (await evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})??false`)) {
          if (i) report.keys.push({key: shift ? "Shift+Tab" : "Tab", times: i, to: selector});
          return;
        }
        await key("Tab", shift ? 8 : 0);
      }
    }
    throw Error(`Tab and Shift+Tab never reached ${selector}`);
  };
  const activate = async (selector, name = "Enter") => {
    await tabTo(selector);
    await key(name);
    report.keys.push({key: name === " " ? "Space" : name, on: selector});
    await sleep(40);
  };
  const step = (type, by) => `#builder-rows [data-zone="deck"][data-type="${type}"][data-by="${by}"]`;
  const builderOpen = `vis(document.getElementById('showdown-builder'))`;
  // Opens Build deck from the Camp and makes `changes` with keys (Enter for "−", Space for "+").
  const keyboardEdit = async (changes) => {
    await activate("#camp-build");
    await wait(builderOpen, "the deck builder");
    assert.ok(await evaluate(`document.getElementById('showdown-builder').contains(document.activeElement)`), "focus moves into the builder");
    for (const [type, by] of changes) {
      const before = Number(await evaluate(`document.querySelector('#builder-rows [data-row="${type}"] [data-count=deck]').textContent`));
      await activate(step(type, by), by < 0 ? "Enter" : " ");
      const after = Number(await evaluate(`document.querySelector('#builder-rows [data-row="${type}"] [data-count=deck]').textContent`));
      assert.equal(after, before + by, `${nameOf(type)} deck count after the key press`);
    }
    const state = await evaluate(`({save:document.getElementById('builder-save').disabled,problems:document.getElementById('builder-problems').textContent})`);
    assert.deepEqual(state, {save: false, problems: "Deck 16 of 16 · side deck 0 of 4."}, "the edited deck is legal");
    return state;
  };
  const campDeck = async () => (await text("#camp-collection")).match(/Deck: (.*?)\.(?: Side deck|Collection)/)?.[1] ?? null;

  // ---- 1. A new career from the menu: Boot Hill and Raven Roost ----
  await load("?seed=0");
  assert.equal(await evaluate(`localStorage.length`), 0, "fresh profile, empty storage");
  const boot = await winTrail("Boot Hill", PICKS[0]);
  const raven = await winTrail("Raven Roost", PICKS[1], true);
  let expected = newSave();
  for (const duel of [boot, raven]) {
    for (const won of duel.results) expected = settle(expected, "trail", won).save;
    expected = choose(expected, duel.pick);
  }
  const DEFAULT = expected.deck;
  assert.deepEqual(JSON.parse(await rawSave()), expected, "stored save equals progress.js for the observed results and picks");
  assert.equal(await campDeck(), listed(DEFAULT));
  check("New career from Play: Boot Hill and Raven Roost won by mouse, offers taken; save equals progress.js", {boot, raven, deck: DEFAULT, collection: expected.collection});

  // ---- 2. Keyboard: a legal change, then Cancel ----
  const before = await rawSave();
  const cancelDraft = await keyboardEdit(CANCEL_EDIT);
  await activate("#builder-cancel");
  await wait(`Boolean(camp())`, "the Camp after Cancel");
  const afterCancel = {raw: await rawSave(), deck: await campDeck(), focus: await focused()};
  assert.equal(afterCancel.raw, before, "the stored save is byte-identical after Cancel");
  assert.equal(afterCancel.deck, listed(DEFAULT), "the Camp lists the old deck");
  assert.equal(afterCancel.focus, "#camp-build", "focus returns to Build deck");
  check("Keyboard: Build deck, a legal change (Sheriff −1, Covered Wagon +1), Cancel: save byte-identical, old deck listed, focus on Build deck",
    {draft: cancelDraft, bytes: before.length, ...afterCancel, raw: undefined});

  // ---- 3. Keyboard: a legal change, Save, reload ----
  const EDITED = edit(DEFAULT, SAVE_EDIT);
  await keyboardEdit(SAVE_EDIT);
  await activate("#builder-save");
  await wait(`Boolean(camp())`, "the Camp after Save");
  const saved = JSON.parse(await rawSave());
  assert.deepEqual(Object.entries(saved.deck), Object.entries(EDITED), "stored deck equals the edit, in the same card order");
  assert.deepEqual(saved, {...expected, deck: EDITED}, "nothing but the deck changed");
  assert.equal(await focused(), "#camp-build", "focus returns to Build deck after Save");
  expected = saved;

  // The Bone Fence seed: the first one whose Cowboy opening hand (as Node deals it) holds the third Outrider,
  // which only the edited deck has, and whose hand differs from the default deck's and the off-by-one variant's.
  const VARIANT = edit(EDITED, [["cowboy-outrider", -1], ["cowboy-billy", 1]]);
  const bone = duelFor(expected, "trail");
  assert.equal(bone.name, "The Bone Fence");
  const handFor = (seed, deck) => createShowdown(seed, {...bone.options, decks: {...bone.options.decks, cowboy: deck}}).sides.cowboy.hand;
  const SEED = Array.from({length: 1000}, (_, i) => i).find((seed) => handFor(seed, EDITED).includes("cowboy-outrider-3")
    && [DEFAULT, VARIANT].every((deck) => handFor(seed, deck).map(typeOf).join() !== handFor(seed, EDITED).map(typeOf).join()));
  assert.notEqual(SEED, undefined, "a discriminating Bone Fence seed exists");

  await load(`?seed=${SEED}`);
  await activate("#menu-play");
  await wait(`Boolean(camp())`, "the Camp after the reload");
  assert.equal(await campDeck(), listed(EDITED), "the Camp lists the saved deck after a reload");
  assert.equal(await rawSave(), JSON.stringify(expected), "the reload kept the save byte for byte");
  await shot("camp-after-reload");
  check("Keyboard: Sheriff −1, Outrider +1, Save deck; stored and listed after a reload; focus on Build deck after Save", {deck: EDITED, listed: listed(EDITED)});

  // ---- 4 and 5. Debugger logpoint at createShowdown's entry, then The Bone Fence by keyboard ----
  await send("Debugger.enable"); // reports every script already parsed in this page
  await sleep(200);
  let at = null;
  for (const script of scripts.filter((s) => !s.url || s.url.startsWith(page))) {
    const {scriptSource} = await send("Debugger.getScriptSource", {scriptId: script.scriptId});
    const head = scriptSource.indexOf("secondPlayerCards:"); // createShowdown's parameter pattern survives minification
    if (head < 0) continue;
    assert.equal(scriptSource.indexOf("secondPlayerCards:", head + 1), -1, "one createShowdown in the bundle");
    const body = scriptSource.indexOf("={}){", head) + 5;
    const lines = scriptSource.slice(0, body).split("\n");
    at = {scriptId: script.scriptId, lineNumber: script.startLine + lines.length - 1, columnNumber: (lines.length === 1 ? script.startColumn : 0) + lines.at(-1).length};
  }
  assert.ok(at, "found createShowdown in the built page");
  const condition = `(console.debug("KIRO-DECK-CAPTURE", JSON.stringify({seed: arguments[0], cowboy: Object.entries(arguments[1].decks.cowboy)})), false)`;
  const {actualLocation} = await send("Debugger.setBreakpoint", {location: at, condition});
  captures.length = 0;
  await activate("#camp-trail [data-duel=trail]");
  await wait(`!document.getElementById('showdown').hidden&&/ · turn 1 · /.test(document.getElementById('sd-status').textContent)`, "The Bone Fence to open");
  await send("Debugger.disable");
  const status = await text("#sd-status");
  assert.match(status, /The Bone Fence/);
  // Player-visible: the Cowboy hand buttons (the player's own seat) and their card names.
  const shown = await evaluate(`[...document.querySelectorAll('#sd-hand [data-card]')].map(n=>({id:n.dataset.card,text:txt(n)}))`);
  for (const card of shown) assert.ok(card.text.includes(nameOf(typeOf(card.id))), `${card.id} shows its name`);
  const hand = shown.map((card) => card.id);
  await shot("bone-fence-opening-hand");
  check("Keyboard: Play, then The Bone Fence from the Camp", {seed: SEED, status, hand});

  // (a) Duel creation: one createShowdown call, with the URL seed and the edited deck in its card order.
  assert.equal(captures.length, 1, `createShowdown calls while opening The Bone Fence: ${captures.length}`);
  const [capture] = captures;
  const capturedIs = (deck) => capture.seed === SEED && JSON.stringify(capture.cowboy) === JSON.stringify(Object.entries(deck));
  // (b) Public trace: the opening hand on screen equals Node's deal from the same seed and options.
  const handIs = (deck) => JSON.stringify(hand) === JSON.stringify(handFor(SEED, deck));
  assert.deepEqual(handFor(SEED, EDITED), createShowdown(SEED, duelFor(expected, "trail").options).sides.cowboy.hand, "the saved deck is what duelFor passes");
  const controls = {default: {deck: DEFAULT, hand: handFor(SEED, DEFAULT)}, offByOne: {deck: VARIANT, hand: handFor(SEED, VARIANT)}};
  // DECK_CHECK_EXPECT=default or offByOne expects the wrong deck instead: the run must then fail here.
  const want = controls[process.env.DECK_CHECK_EXPECT]?.deck ?? EDITED;
  assert.equal(capturedIs(want), true, `captured ${JSON.stringify(capture)}, expected ${JSON.stringify(Object.entries(want))}`);
  assert.equal(handIs(want), true, `hand on screen ${hand}, Node deals ${handFor(SEED, want)}`);
  for (const [label, {deck}] of Object.entries(controls)) {
    assert.equal(capturedIs(deck), false, `negative control: the capture must not match the ${label} deck`);
    assert.equal(handIs(deck), false, `negative control: the hand must not match the ${label} deck`);
  }
  check("Boundary: createShowdown received the edited deck; the opening hand equals Node's deal and differs from the default and off-by-one decks",
    {breakpoint: actualLocation, capture: {seed: capture.seed, cowboy: Object.fromEntries(capture.cowboy)}, hand, controls});

  assert.deepEqual(report.errors, [], "no page errors");
  check("No page exceptions or console errors");
  Object.assign(report, {seed: SEED, defaultDeck: DEFAULT, editedDeck: EDITED});
} catch (error) {
  failed = error;
  report.failure = error.stack;
} finally {
  cdp.close();
  await chrome.close();
  server.close();
  report.note = "Scripted browser check of flow, storage and the deck at duel creation. Not a human playtest.";
  await writeFile(path.join(out, "browser-showdown-deck.json"), `${JSON.stringify(report, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-deck.json"))}`);
