// Issue 143 slice 2 ("The first hour"): real-browser acceptance of the graybox Camp and Trail.
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-trail-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
//
// Developer check only; it changes no runtime file and gives the page no test hook. Native headless
// Chrome, a fresh temporary profile per run, the built page served from a loopback HTTP server, and
// every game input a real mouse press over the DevTools protocol on a visible, enabled, topmost element.
//
// Run A, new player (no stored data at all):
//   1. Normal entry: Play opens the Camp. Boot Hill is the only open Trail duel.
//   2. Win Boot Hill (?seed=0 fixes the first deal) by clicks alone. The win pays Covered Wagon ×2 and
//      offers the two cards progress.js settle() offers; take the first.
//   3. Back in Camp, Raven Roost is open. Win it (a loss is played again as a rematch; the reference
//      settle() makes the final save the same either way, and losses are reported). It pays Outrider ×2.
//   4. Reload with the offer still unclaimed: the same two cards are offered in Camp. Take the second.
//   5. Reload: Camp shows both Trail duels won and The Bone Fence open, the collection and deck on screen
//      and the stored progress equal the reference prototype's newSave → settle → choose → settle → choose.
//      Opening The Bone Fence and leaving it changes no stored progress.
// Run B, lane veteran: a real lane-era profile (written by src/profile/player-profile.js recordBounty for
//   all five Graveyard Dragon hunts) is placed in localStorage on a blank page of the same origin before the
//   game is ever loaded. No Showdown progress is seeded. Normal load: the lane key is byte-identical, the
//   Captured Dragon is shown as owned, the Trail has not advanced and the deck is the plain starter. Win Boot
//   Hill, take the offer, reload: Covered Wagon is paid, the Captured Dragon is still owned, the lane profile
//   still lists the five cleared hunts.
//
// Expected rewards, offers and saves come from the reference prototype (prototypes/showdown/progress.js).
// The Cowboy moves come from a simple click loop, so this is a bot driving the browser. It is not a human
// playtest and says nothing about clarity or fun.
//
// DOM contract this check relies on (one place to adjust if Camp chooses other hooks):
//   - #menu-play on the title; the Camp is a visible element matching CAMP below.
//   - Trail duels are buttons inside the Camp whose text contains the duel name; a won one starts with "✓"
//     or has class "won"; the open one is the only enabled one.
//   - Offered cards are visible buttons with data-choose="<card type>" (as in the reference screen).
//   - The Camp lists "Deck: Name ×N, ..." and "Collection: ... Name ×N" (reference wording), in an element
//     matching COLLECTION, else anywhere in the Camp. A lane-captured card only has to be named after "Collection:".
//   - The duel is the slice 1 screen (#showdown, #sd-status, #sd-hand, #sd-board, #sd-end ...).
//   - The way back from a duel is a button reading "Back to camp", else [data-again] naming the camp,
//     else Main menu (#sd-home) and then Play.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {TYPES} from "../prototypes/showdown/cards.js";
import {choose, newSave, settle} from "../prototypes/showdown/progress.js";
import {STARTER, TRAIL} from "../prototypes/showdown/trail.js";
import {BOSSES} from "../src/game/bounty-hunt.js";
import {createProfileStore} from "../src/profile/player-profile.js";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const CAMP = `#showdown-camp, [data-screen="camp"], [aria-label="Camp"]`;
const COLLECTION = `#camp-collection, [data-collection]`;
const LANE_KEY = "cvw-player-v1"; // src/profile/player-profile.js STORAGE_KEY
const MAX_ATTEMPTS = 3; // per Trail duel; a loss is replayed as the Camp's rematch
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nameOf = (type) => TYPES[type].name;
const FIELDS = ["v", "wins", "losses", "collection", "deck", "side", "rivals", "hunts", "openWins", "packs", "rolls", "offer"];
const pick = (save, omit = []) => Object.fromEntries(FIELDS.map((f) => [f, f === "collection"
  ? Object.fromEntries(Object.entries(save.collection ?? {}).filter(([t]) => !omit.includes(t))) : save[f]]));

if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const html = await readFile(path.resolve(process.argv[2]));
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-trail-143");
await mkdir(out, {recursive: true});

// ---- Expected results, from the reference prototype ------------------------------------------
const reference = (() => {
  const s1 = settle(newSave(), "trail", true);
  const c1 = choose(s1.save, s1.save.offer[0]);
  const s2 = settle(c1, "trail", true);
  const c2 = choose(s2.save, s2.save.offer[1]);
  return {afterWin1: s1, afterChoice1: c1, afterWin2: s2, final: c2, choices: [s1.save.offer[0], s2.save.offer[1]]};
})();
// The lane-era fixture, written by the real lane store into an in-memory Storage.
const laneFixture = (() => {
  const memory = new Map();
  const storage = {getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v))};
  const store = createProfileStore(storage);
  const dragon = BOSSES.find((boss) => boss.id === "graveyard-dragon");
  for (const hunt of dragon.hunts) store.recordBounty(hunt);
  assert.equal(store.get().clearedHunts.length, 5);
  return {raw: memory.get(LANE_KEY), captured: dragon.reward, hunts: [...dragon.hunts]};
})();

// ---- Loopback server and Chrome --------------------------------------------------------------
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/game.html") { res.writeHead(200, {"content-type": "text/html; charset=utf-8"}); res.end(html); return; }
  if (url.pathname === "/blank.html") { res.writeHead(200, {"content-type": "text/html"}); res.end("<!doctype html><title>blank</title>"); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const page = `${origin}/game.html`;

async function launchChrome() {
  const profile = await mkdtemp("/tmp/kiro-trail-chrome-");
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

// Page-side helpers, prepended to each expression that looks something up. They only read the DOM.
const LIB = `const vis=(n)=>Boolean(n&&n.getClientRects().length&&n.checkVisibility({checkVisibilityCSS:true}));
  const camp=()=>[...document.querySelectorAll(${JSON.stringify(CAMP)})].find(vis)??null;
  const buttons=(root=document)=>[...root.querySelectorAll('button')].filter(vis);
  const txt=(n)=>(n?.innerText??'').replace(/[ \\t]+/g,' ').trim();`;

const report = {page: "graybox build over loopback HTTP", chrome: CHROME, viewport: [WIDTH, HEIGHT], reference: {
  choices: reference.choices, final: reference.final}, runs: {}, errors: [], screenshots: []};
let failed = null;

async function session(label) {
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const run = report.runs[label] = {checks: [], clicks: 0, duels: []};
  const check = (name, detail) => { run.checks.push({name, passed: true, ...(detail === undefined ? {} : {detail})}); console.log(`ok - [${label}] ${name}`); };
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.errors.push(`[${label}] ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(`[${label}] ${params.args.map((a) => a.value ?? a.description).join(" ")}`);
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
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(100); }
    throw Error(`Timed out waiting for ${what}`);
  };
  // finder: an expression returning the element to press. Real mouse press and release at its centre;
  // it must be visible, enabled and the topmost element there.
  const press = async (finder, what) => {
    const p = await evaluate(`(()=>{const n=(${finder});if(!n)throw Error('Missing: '+${JSON.stringify(what)});if(n.disabled)throw Error('Disabled: '+${JSON.stringify(what)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(what)});return{x,y};})()`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
    run.clicks += 1;
  };
  const click = (selector) => press(`document.querySelector(${JSON.stringify(selector)})`, selector);
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()??null`);
  const shot = async (name) => {
    const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: true});
    await writeFile(path.join(out, `${label}-${name}.png`), Buffer.from(data, "base64"));
    report.screenshots.push(`${label}-${name}.png`);
  };
  const storage = () => evaluate(`Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))`);
  // The stored Showdown progress: the one stored object (top level of a key, or one level inside it)
  // with the progress.js v2 shape. Its key is not fixed here; campaign-store.js owns it.
  const stored = async () => {
    const all = await storage();
    const found = [];
    for (const [key, raw] of Object.entries(all)) {
      let value; try { value = JSON.parse(raw); } catch { continue; }
      const shaped = (v) => v && typeof v === "object" && v.v === 2 && Number.isInteger(v.wins) && v.collection && v.deck;
      if (shaped(value)) found.push({key, at: null, save: value});
      else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) if (shaped(v)) found.push({key, at: k, save: v});
    }
    assert.ok(found.length <= 1, `more than one stored Showdown progress: ${JSON.stringify(found.map(({key, at}) => [key, at]))}`);
    return {all, progress: found[0] ?? null};
  };
  const load = async (query = "") => {
    await send("Page.navigate", {url: page + query});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`, "the title screen");
  };
  const openCamp = async () => {
    await click("#menu-play");
    await wait(`Boolean(camp())`, "the Camp after Play");
  };
  // Camp, read from the page: the Trail tiles in order, the offer, the collection and deck text.
  const readCamp = () => evaluate(`(()=>{const c=camp();if(!c)return null;const names=${JSON.stringify(TRAIL.map((d) => d.name))};
    const trail=names.map(name=>{const b=buttons(c).find(n=>txt(n).includes(name));if(!b)return{name,state:'missing'};
      const t=txt(b);return{name,state:b.disabled?(/^✓/.test(t)||b.classList.contains('won')?'won':'locked'):'open',text:t};});
    const offer=buttons(document).filter(n=>n.dataset.choose).map(n=>n.dataset.choose);
    const box=[...c.querySelectorAll(${JSON.stringify(COLLECTION)})].find(vis);
    return{trail,offer,collection:txt(box??c),camp:txt(c)};})()`);
  const assertTrail = (camp, won) => {
    const states = camp.trail.map((t) => t.state);
    const want = TRAIL.map((_, i) => (i < won ? "won" : i === won ? "open" : "locked"));
    assert.deepEqual(states, want, `Trail tiles ${JSON.stringify(camp.trail)}`);
  };
  // Deck and collection on screen in the reference wording "Name ×N".
  const assertHoldings = (camp, save) => {
    const all = camp.collection;
    const at = all.indexOf("Collection:");
    const deckText = at >= 0 ? all.slice(0, at) : all, collText = at >= 0 ? all.slice(at) : all;
    for (const [type, n] of Object.entries(save.deck)) assert.ok(deckText.includes(`${nameOf(type)} ×${n}`), `deck shows ${nameOf(type)} ×${n}: ${deckText}`);
    for (const [type, n] of Object.entries(save.collection)) assert.ok(collText.includes(`${nameOf(type)} ×${n}`), `collection shows ${nameOf(type)} ×${n}: ${collText}`);
  };

  // Seat privacy during a duel, as in browser-showdown-check.mjs.
  const assertPrivate = async () => {
    const p = await evaluate(`(()=>{const body=document.getElementById("showdown").outerHTML+(camp()?.outerHTML??'');const ids=body.match(/wizard-[a-z-]+-\\d+/g)||[];
      const base=document.querySelector('#sd-board [data-side=wizard] [data-base=wizard]');const backs=base.querySelectorAll('.sd-backs .card-back').length;
      const count=Number(base.textContent.match(/Hand (\\d+)/)[1]);
      const hand=[...document.querySelectorAll('#sd-hand [data-card]')].map(n=>n.dataset.card);
      return{ids,backs,count,handSides:[...new Set(hand.map(id=>id.split('-')[0]))]};})()`);
    assert.deepEqual(p.ids, [], `Wizard card ids in the page: ${p.ids}`);
    assert.equal(p.backs, p.count, "one card back per Wizard hand card");
    assert.ok(p.handSides.every((side) => side === "cowboy"), `hand shows ${p.handSides}`);
  };
  const resultShown = () => evaluate(`Boolean(document.querySelector('#showdown .sd-result'))`);

  // Plays the open duel to its result with clicks alone. Same loop as browser-showdown-check.mjs:
  // play what the screen enables (finishing each prompt), attack with every ready troop, end the turn.
  const playDuel = async () => {
    let turns = 0, attacks = 0;
    const endTurn = async () => {
      await click("#sd-end");
      await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)||document.querySelector('#showdown .sd-result')`, "the next Cowboy turn", 30000);
      turns += 1;
    };
    while (!(await resultShown()) && turns < 60) {
      await assertPrivate();
      for (let played = 0; played < 4; played += 1) {
        const card = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
        if (!card) break;
        await click(`#sd-hand [data-card="${card}"]`);
        for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
          const prompt = await text("#sd-prompt");
          if (/as payment|to carry/.test(prompt)) await click("#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]");
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
        attacks += 1;
      }
      if (await resultShown()) break;
      await endTurn();
    }
    const status = await text("#sd-status");
    assert.ok(await resultShown(), `no result after ${turns} turns`);
    return {won: status.startsWith("You win"), status, turns, attacks};
  };
  // From a finished duel back to the Camp, with the button the screen gives for it.
  const backToCamp = async () => {
    const how = await evaluate(`(()=>{const b=buttons(document);return b.find(n=>/^Back to camp$/i.test(txt(n))&&!n.disabled)?'back':
      b.find(n=>n.dataset.again!==undefined&&/camp/i.test(txt(n))&&!n.disabled)?'again':'home';})()`);
    if (how === "back") await press(`buttons(document).find(n=>/^Back to camp$/i.test(txt(n))&&!n.disabled)`, "Back to camp");
    else if (how === "again") await press(`buttons(document).find(n=>n.dataset.again!==undefined&&/camp/i.test(txt(n))&&!n.disabled)`, "[data-again] to camp");
    else { await click("#sd-home"); await wait(`!document.getElementById('title-screen').hidden`, "the title"); await click("#menu-play"); }
    await wait(`Boolean(camp())`, "the Camp");
    return how;
  };
  // Starts Trail duel i from the Camp tile and checks the duel it opened.
  const startTrail = async (i) => {
    const duel = TRAIL[i];
    await press(`buttons(camp()).find(n=>txt(n).includes(${JSON.stringify(duel.name)}))`, `${duel.name} tile`);
    await wait(`!document.getElementById('showdown').hidden&&/ · turn 1 · your turn$/.test(document.getElementById('sd-status').textContent)`, `${duel.name} to open`);
    const opened = {status: await text("#sd-status"), lesson: await text("#sd-lesson"),
      wizardBase: await evaluate(`document.querySelector('[data-base=wizard] .sd-orbs')?.getAttribute('aria-label')`)};
    assert.equal(opened.status, `${duel.name} · turn 1 · your turn`);
    assert.equal(opened.lesson, duel.lesson);
    assert.equal(opened.wizardBase, `${duel.base} of ${duel.base} orbs`);
    return opened;
  };
  // Wins Trail duel i, replaying a loss as a rematch from the result screen or the Camp.
  const winTrail = async (i, attemptsLog) => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        const rematch = await evaluate(`Boolean(buttons(document).find(n=>/^Rematch$/i.test(txt(n))&&!n.disabled))`);
        if (rematch) {
          await press(`buttons(document).find(n=>/^Rematch$/i.test(txt(n))&&!n.disabled)`, "Rematch");
          await wait(`/ · turn 1 · your turn$/.test(document.getElementById('sd-status').textContent)`, "the rematch");
        } else { await backToCamp(); await startTrail(i); }
      }
      const result = await playDuel();
      attemptsLog.push({duel: TRAIL[i].name, attempt, ...result});
      if (result.won) return result;
    }
    throw Error(`${TRAIL[i].name} not won in ${MAX_ATTEMPTS} attempts`);
  };
  // The win's payment, shown with the result: each earned card by name with its count.
  const assertPaid = async (i) => {
    const shown = await evaluate(`txt(document.getElementById('showdown'))`);
    for (const [type, , copies] of TRAIL[i].reward) {
      assert.match(shown, new RegExp(`${nameOf(type)}[\\s\\S]{0,200}×${copies}`), `the result names ${nameOf(type)} ×${copies}`);
    }
    return TRAIL[i].reward.map(([type, , copies]) => `${nameOf(type)} ×${copies}`);
  };
  // Takes the offered card `type` with its button, after checking the pair offered is `offer`.
  const takeOffer = async (offer, type) => {
    const shown = await evaluate(`buttons(document).filter(n=>n.dataset.choose).map(n=>n.dataset.choose)`);
    assert.deepEqual(shown, offer, "the offered pair equals progress.js settle()");
    await press(`buttons(document).find(n=>n.dataset.choose===${JSON.stringify(type)})`, `offer ${type}`);
    await wait(`!buttons(document).some(n=>n.dataset.choose)`, "the offer to close");
  };

  return {send, evaluate, wait, press, click, text, shot, storage, stored, load, openCamp, readCamp, assertTrail, assertHoldings,
    startTrail, winTrail, assertPaid, takeOffer, backToCamp, check, run, close: async () => { cdp.close(); await chrome.close(); }};
}

// ---- Run A: a new player ---------------------------------------------------------------------
async function newPlayer() {
  const s = await session("new-player");
  try {
    await s.load("?seed=0");
    assert.deepEqual(await s.storage(), {}, "a fresh Chrome profile has no saved data");
    await s.openCamp();
    let camp = await s.readCamp();
    s.assertTrail(camp, 0);
    assert.deepEqual(camp.offer, []);
    s.assertHoldings(camp, newSave());
    await s.shot("camp-fresh");
    // FH-R2.2 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Normal entry on a clean profile: Play opens the Camp, Boot Hill is the only open Trail duel, starter deck shown", camp.trail);

    // FH-R2.3 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Boot Hill opens from its Camp tile with its lesson and a 3-orb Wizard Base", await s.startTrail(0));
    const win1 = await s.winTrail(0, s.run.duels);
    // FH-R6.1 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Boot Hill won by clicks alone (?seed=0 deal)", win1);
    // FH-R6.1 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("The Boot Hill win names its payment with the result", await s.assertPaid(0));
    await s.shot("boot-hill-won");
    // The choice may be offered with the result or in the Camp; take it wherever it is first shown.
    if (!(await s.evaluate(`buttons(document).some(n=>n.dataset.choose)`))) await s.backToCamp();
    await s.takeOffer(reference.afterWin1.save.offer, reference.choices[0]);
    if (!(await s.evaluate(`Boolean(camp())`))) s.run.backToCamp1 = await s.backToCamp();
    camp = await s.readCamp();
    s.assertTrail(camp, 1);
    s.assertHoldings(camp, reference.afterChoice1);
    let {progress} = await s.stored();
    assert.ok(progress, "progress is stored after the first win");
    assert.deepEqual(pick(progress.save), pick(reference.afterChoice1));
    // FH-R6.1, FH-R6.2 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("After Boot Hill: Covered Wagon ×2 paid into the deck, the chosen card owned, Raven Roost open, stored progress equals the reference",
      {key: progress.key, at: progress.at, offered: reference.afterWin1.save.offer, chose: reference.choices[0]});

    // FH-R2.3 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Raven Roost opens from its Camp tile with its lesson and a 4-orb Wizard Base", await s.startTrail(1));
    const win2 = await s.winTrail(1, s.run.duels);
    // FH-R6.3 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Raven Roost won by clicks alone", {...win2, attempts: s.run.duels.filter((d) => d.duel === "Raven Roost").length});
    // FH-R6.3 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("The Raven Roost win names its payment with the result", await s.assertPaid(1));
    await s.shot("raven-roost-won");
    ({progress} = await s.stored());
    assert.deepEqual(pick(progress.save), pick(reference.afterWin2.save), "stored right after the second win, offer unclaimed");

    // Reload with the choice unclaimed: the same pair is offered, once.
    await s.load();
    await s.openCamp();
    camp = await s.readCamp();
    assert.deepEqual(camp.offer, reference.afterWin2.save.offer, "the unclaimed offer survives a reload unchanged");
    assert.ok(camp.trail.slice(2).every((t) => t.state !== "open"), "nothing else can start while a card is on offer");
    // FH-R3.6, FH-R6.4 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Reload with the second offer unclaimed: the Camp offers the same two cards and nothing else starts", camp.offer);
    await s.takeOffer(reference.afterWin2.save.offer, reference.choices[1]);
    await s.wait(`Boolean(camp())`, "the Camp after choosing");

    // Final reload: both rewards and both choices are kept, exactly once.
    const before = await s.storage();
    await s.load();
    await s.openCamp();
    camp = await s.readCamp();
    s.assertTrail(camp, 2);
    assert.deepEqual(camp.offer, []);
    s.assertHoldings(camp, reference.final);
    ({progress} = await s.stored());
    assert.deepEqual(pick(progress.save), pick(reference.final));
    await s.shot("camp-after-reload");
    // FH-R6.5 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Reload: Boot Hill and Raven Roost won, The Bone Fence open, deck and collection on screen and stored progress equal the reference",
      {stored: pick(progress.save), storageUnchangedByLoad: JSON.stringify(before) === JSON.stringify(await s.storage())});

    // Opening the next duel and leaving it records nothing.
    const kept = JSON.stringify(pick(progress.save));
    // FH-R2.3 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("The Bone Fence opens from its Camp tile", await s.startTrail(2));
    s.run.leftBy = await s.backToCamp();
    ({progress} = await s.stored());
    assert.equal(JSON.stringify(pick(progress.save)), kept, "leaving an unfinished duel changes no stored progress");
    // FH-R2.4 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Leaving The Bone Fence unfinished changes no stored progress", {leftBy: s.run.leftBy});
  } finally { await s.close(); }
}

// ---- Run B: a lane veteran -------------------------------------------------------------------
async function laneVeteran() {
  const s = await session("lane-veteran");
  try {
    // The fixture goes in on a blank page of the same origin, so the game never runs before it.
    await s.send("Page.navigate", {url: `${origin}/blank.html`});
    await s.wait(`document.readyState==='complete'`, "the blank page");
    assert.deepEqual(await s.storage(), {}, "a fresh Chrome profile has no saved data");
    await s.evaluate(`(localStorage.setItem(${JSON.stringify(LANE_KEY)},${JSON.stringify(laneFixture.raw)}),true)`);
    // FH-R5.7 (fixture) (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Lane-era profile written by the real lane store (five Graveyard Dragon hunts cleared) is the only stored data", JSON.parse(laneFixture.raw).clearedHunts);

    await s.load("?seed=0");
    assert.equal((await s.storage())[LANE_KEY], laneFixture.raw, "loading the game leaves the lane profile byte-identical");
    await s.openCamp();
    let camp = await s.readCamp();
    s.assertTrail(camp, 0);
    // Owned, in whatever words Camp uses for it: named after "Collection:" in the Camp's card list.
    const ownsCaptured = (c) => c.collection.slice(Math.max(0, c.collection.indexOf("Collection:"))).includes(nameOf(laneFixture.captured));
    assert.ok(ownsCaptured(camp), `collection names ${nameOf(laneFixture.captured)}: ${camp.collection}`);
    s.assertHoldings(camp, {deck: STARTER, collection: newSave().collection});
    const deckText = camp.collection.slice(0, Math.max(0, camp.collection.indexOf("Collection:")));
    assert.ok(!deckText.includes(nameOf(laneFixture.captured)), "the captured card is owned, not put into the deck");
    assert.equal((await s.storage())[LANE_KEY], laneFixture.raw, "opening the Camp leaves the lane profile byte-identical");
    await s.shot("camp-veteran");
    // FH-R5.1, FH-R5.7, FH-R3.8 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Normal load: the Captured Dragon is shown as owned, the Trail has not advanced, the deck is the plain starter, the lane profile is byte-identical", camp.trail);

    await s.startTrail(0);
    // FH-R5.7 (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Boot Hill won by clicks alone with the lane profile present", await s.winTrail(0, s.run.duels));
    await s.assertPaid(0);
    if (!(await s.evaluate(`buttons(document).some(n=>n.dataset.choose)`))) await s.backToCamp();
    await s.takeOffer(reference.afterWin1.save.offer, reference.choices[0]);

    await s.load();
    await s.openCamp();
    camp = await s.readCamp();
    s.assertTrail(camp, 1);
    s.assertHoldings(camp, reference.afterChoice1);
    assert.ok(ownsCaptured(camp), `collection still names ${nameOf(laneFixture.captured)} after the win and reload: ${camp.collection}`);
    const {all, progress} = await s.stored();
    assert.ok(progress, "progress is stored after the win");
    assert.deepEqual(pick(progress.save, [laneFixture.captured]), pick(reference.afterChoice1, [laneFixture.captured]),
      "apart from the captured card, the stored progress equals the new player's");
    assert.ok(!progress.save.deck[laneFixture.captured], "the captured card is not in the stored deck");
    // Integration: the capture is persisted in Showdown's own grow-only record (src/game/showdown/inherited.js),
    // so ownership does not rest on a live read of the unchanged lane key alone.
    assert.deepEqual(JSON.parse(all["cvw-showdown-inherited-v1"] ?? "null")?.cards, [laneFixture.captured],
      "the stored Showdown inherited-ownership record lists the captured card");
    const lane = JSON.parse(all[LANE_KEY]);
    assert.ok(laneFixture.hunts.every((id) => lane.clearedHunts.includes(id)), "the lane profile still lists the five cleared hunts");
    // FH-R5.3, FH-R5.7, FH-R7.1 (own key) (.kiro/specs/showdown-first-hour/requirements.md)
    s.check("Reload after the win: Covered Wagon paid, the Captured Dragon still owned, the lane profile still holds its five cleared hunts", {
      key: progress.key, at: progress.at, capturedInStoredCollection: progress.save.collection[laneFixture.captured] ?? 0,
      laneByteIdentical: all[LANE_KEY] === laneFixture.raw, inheritedRecord: all["cvw-showdown-inherited-v1"], campCollection: camp.collection});
  } finally { await s.close(); }
}

// Each run reports its own first failure; the second still runs when the first fails.
try {
  for (const [label, run] of [["new-player", newPlayer], ["lane-veteran", laneVeteran]]) {
    try { await run(); } catch (error) {
      failed ??= error;
      report.runs[label].failure = error.stack;
      console.error(`not ok - [${label}] ${error.message}`);
    }
  }
  if (!failed) {
    assert.deepEqual(report.errors, [], "no page errors");
    console.log("ok - No page exceptions or console errors");
  }
} catch (error) {
  failed = error;
  report.failure = error.stack;
} finally {
  server.close();
  report.note = "Bot-driven browser acceptance. Human playtests are pending and are not simulated here.";
  await writeFile(path.join(out, "browser-showdown-trail.json"), `${JSON.stringify(report, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
const passed = Object.values(report.runs).reduce((n, r) => n + r.checks.length, 0);
console.log(`${passed} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-trail.json"))}`);
