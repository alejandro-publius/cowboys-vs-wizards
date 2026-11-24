// Issue 143 slice 3: real-browser acceptance of the graybox Camp's other modes.
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-modes-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
//
// Developer check only; it changes no runtime file and gives the page no test hook. Native headless
// Chrome, a fresh temporary profile per run, the built page over a loopback HTTP server, and every game
// input a real mouse press over the DevTools protocol on a visible, enabled, topmost element (the same
// harness as browser-showdown-trail-check.mjs). Each run starts from its own fixture, written on a blank
// page of the same origin before the game first loads. Fixtures are built with progress.js itself.
//
//   gated       new profile: rivals, Wanted, the even match and best of three are locked "after the Trail";
//               both two-player entries are open; Build deck opens and Cancel keeps the deck.
//   packs       post-Trail save with its pack: Open a pack shows the cards progress.js openPack() rolls,
//               the stored save equals openPack().save, and a reload keeps them.
//   builder     post-Trail save: a deck one card short is refused (Save disabled, the reason shown); a legal
//               deck plus side deck is saved, listed in the Camp and kept after a reload.
//   rival       post-Trail save: the Stargazer is open and the Imp waits for her; won by clicks; it pays
//               RIVALS[0]'s card and pack; the Imp opens; the Stargazer stays open as a rematch.
//   bounty      post-Trail save: the Lantern Wraith hunt is won, then repeated from the result screen as
//               hunt 2 of 5 and won again; stored hunts count each win once; a reload keeps the count.
//               A second fixture at 4 of 5 wins the fifth hunt: Captured is shown, the Legendary owned,
//               the tile reads Captured and no repeat is offered.
//   bo3         post-Trail save with a side deck: best of three on the even match; nothing is saved between
//               games; the loser of a game opens the next; the side-deck swap screen accepts only a full deck
//               from this match's cards; the match settles once (openWins), one playtest line per game.
//   hotseat     two players, best of three: the curtain hides the table with no hand in the page; each turn
//               shows only the active seat's hand (all its own ids) and no id of the other seat's hand or
//               traps; the match runs to two wins; Showdown progress and the playtest log are unchanged; Play again
//               deals the starter decks.
//   earned      Earned decks (showdown-earned.js): absent with no teaser until the first Wizard preview win; with an
//               empty Cowboy save, the starter deck; then the Camp deck, chosen with Tab and Enter only; the curtain
//               first; the Wizards open; each seat's first hand equals the engine's deal of that seed; one game to a
//               result with the board open and no hand; the rematch keeps the decks, the label and the opener; Back to
//               camp returns focus; the Cowboy save, the preview save and the playtest log are byte-identical.
//   saves       post-Trail save plus a lane veteran's keepsake: a pasted code previews, Cancel changes
//               nothing, Replace loads it; Start over (confirm accepted) resets Showdown progress only:
//               cvw-player-v1 and the keepsake record are byte-identical and the keepsake still shown.
//
// Bot-driven flow and storage checks. Not a human playtest; says nothing about clarity or fun.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {TYPES} from "../src/game/showdown/cards.js";
import {BOUNTIES, DECK_SIZE, HUNTS, RIVALS, choose, newSave, openPack, settle, trailDone} from "../src/game/showdown/progress.js";
import {encodeSave} from "../src/game/showdown/savecode.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {INHERITED_KEY} from "../src/game/showdown/inherited.js";
import {PLAYTEST_KEY} from "../src/match/showdown-playtest.js";
import {BOSSES} from "../src/game/bounty-hunt.js";
import {createProfileStore} from "../src/profile/player-profile.js";
import {DECKS} from "../src/game/showdown/cards.js";
import {applyAction, createShowdown} from "../src/game/showdown/rules.js";
import {earnedDuel} from "../src/match/showdown-earned.js";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const LANE_KEY = "cvw-player-v1";
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; // tried in turn until a solo duel is won
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nameOf = (type) => TYPES[type].name;
const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const html = await readFile(path.resolve(process.argv[2]));
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-modes-143");
await mkdir(out, {recursive: true});

// ---- Fixtures, from progress.js ----------------------------------------------------------------
const postTrail = (() => {
  let save = newSave();
  while (!trailDone(save)) { save = settle(save, "trail", true).save; save = choose(save, save.offer[0]); }
  return save;
})();
const PLAIN = "cowboy-sheriff";
const withSide = {...postTrail, deck: {...postTrail.deck, [PLAIN]: postTrail.deck[PLAIN] - 1, "cowboy-billy": (postTrail.deck["cowboy-billy"] ?? 0) + 1}, side: {[PLAIN]: 2}};
const laneVeteran = (() => {
  const memory = new Map();
  const store = createProfileStore({getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v))});
  const dragon = BOSSES.find((boss) => boss.id === "graveyard-dragon");
  for (const hunt of dragon.hunts) store.recordBounty(hunt);
  return {raw: memory.get(LANE_KEY), captured: dragon.reward};
})();

// ---- Loopback server and Chrome ----------------------------------------------------------------
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
  const profile = await mkdtemp("/tmp/kiro-modes-chrome-");
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

// Page-side helpers, prepended to each expression. They only read the DOM.
const LIB = `const vis=(n)=>Boolean(n&&n.getClientRects().length&&n.checkVisibility({checkVisibilityCSS:true}));
  const camp=()=>{const c=document.getElementById('showdown-camp');return vis(c)?c:null;};
  const buttons=(root=document)=>[...root.querySelectorAll('button')].filter(vis);
  const txt=(n)=>(n?.innerText??'').replace(/[ \\t]+/g,' ').trim();`;

const report = {page: "graybox build over loopback HTTP", chrome: CHROME, viewport: [WIDTH, HEIGHT], runs: {}, errors: []};

async function session(label) {
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const run = report.runs[label] = {checks: [], clicks: 0, games: []};
  const check = (name, detail) => { run.checks.push({name, passed: true, ...(detail === undefined ? {} : {detail})}); console.log(`ok - [${label}] ${name}`); };
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  let dialogs = [];
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.errors.push(`[${label}] ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(`[${label}] ${params.args.map((a) => a.value ?? a.description).join(" ")}`);
    // Start over asks with window.confirm: record the question and accept it, as a player pressing OK.
    if (method === "Page.javascriptDialogOpening") { dialogs.push(params.message); send("Page.handleJavaScriptDialog", {accept: true}); }
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
  const byText = (re, root = "document") => `buttons(${root}).find(n=>${re}.test(txt(n))&&!n.disabled)`;
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()??null`);
  const shot = async (name) => {
    const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: true});
    await writeFile(path.join(out, `${label}-${name}.png`), Buffer.from(data, "base64"));
  };
  const storage = () => evaluate(`Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))`);
  const progress = async () => JSON.parse((await storage())[SAVE_KEY] ?? "null");
  // Writes the fixture on a blank page of the same origin, so the game never runs before it.
  const seedStorage = async (entries) => {
    await send("Page.navigate", {url: `${origin}/blank.html`});
    await wait(`document.readyState==='complete'`, "the blank page");
    await evaluate(`(localStorage.clear(),${JSON.stringify(entries)}.forEach(([k,v])=>localStorage.setItem(k,v)),true)`);
  };
  const load = async (query = "") => {
    await send("Page.navigate", {url: page + query});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`, "the title screen");
  };
  const openCamp = async () => { await click("#menu-play"); await wait(`Boolean(camp())`, "the Camp after Play"); };
  const tile = (name) => `buttons(camp()).find(n=>txt(n).includes(${JSON.stringify(name)}))`;
  const tileState = (name) => evaluate(`(()=>{const b=[...camp().querySelectorAll('button')].find(n=>txt(n).includes(${JSON.stringify(name)}));return b?{disabled:b.disabled,text:txt(b)}:null;})()`);
  const resultShown = () => evaluate(`Boolean(document.querySelector('#showdown .sd-result'))`);
  const curtainUp = () => evaluate(`vis(document.getElementById('sd-curtain'))`);
  // Where DOM focus is: its id, and whether it is a visible, enabled control.
  const focusAt = () => evaluate(`(()=>{const n=document.activeElement;return{id:n?.id||(n?.dataset?.card?'card '+n.dataset.card:n?.dataset?.slot?'slot '+n.dataset.slot:n?.tagName)||null,usable:Boolean(n&&n!==document.body&&vis(n)&&!n.disabled)};})()`);
  const focusLog = [];
  // The curtain is up: focus is on "I'm ready" itself, so a keyboard player passes it with one Enter.
  const assertReadyFocused = async (when) => {
    const f = await focusAt();
    focusLog.push({when, ...f});
    assert.deepEqual(f, {id: "sd-ready", usable: true}, `focus on I'm ready ${when}`);
  };
  // The curtain has cleared: focus is on a visible, usable control of the table, not the hidden curtain or the body.
  const assertTableFocused = async (when) => {
    const f = {...(await focusAt()), inTable: await evaluate(`document.getElementById('sd-table').contains(document.activeElement)`)};
    focusLog.push({when, ...f});
    assert.ok(f.usable && f.inTable, `focus after the curtain ${when}: ${JSON.stringify(f)}`);
  };

  // Seat privacy for the seat on screen: every hand card is that seat's, the other seat's hand is
  // card backs and a count, and no card id of the other seat outside its public board and graveyard.
  const assertPrivate = async (seat) => {
    const p = await evaluate(`(()=>{const seat=${JSON.stringify(seat)},foe=seat==='cowboy'?'wizard':'cowboy';const body=document.getElementById('showdown').outerHTML;
      const ids=[...new Set(body.match(new RegExp(foe+'-[a-z-]+-\\\\d+','g'))||[])];
      const base=document.querySelector('#sd-board [data-side='+foe+'] [data-base='+foe+']');
      return{ids,backs:base.querySelectorAll('.sd-backs .card-back').length,count:Number(base.textContent.match(/Hand (\\d+)/)[1]),
        hand:[...document.querySelectorAll('#sd-hand [data-card]')].map(n=>n.dataset.card)};})()`);
    // The screen writes card ids only on the seat's own hand buttons, so no id of the other seat may appear at all.
    assert.deepEqual(p.ids, [], `${seat} on screen, ids of the other seat in the page: ${p.ids}`);
    assert.equal(p.backs, p.count, "one card back per hidden hand card");
    assert.ok(p.hand.every((id) => id.startsWith(`${seat}-`)), `hand shows ${p.hand}`);
    return p.hand.length;
  };
  // The curtain: the table is hidden and no hand, board or trap of either seat is in the page.
  const assertCurtain = async () => {
    const c = await evaluate(`({table:vis(document.getElementById('sd-table')),text:document.getElementById('sd-curtain-text').textContent,
      ids:document.getElementById('showdown').outerHTML.match(/(cowboy|wizard)-[a-z-]+-\\d+/g)||[],
      hand:document.querySelectorAll('#sd-hand *').length,board:document.querySelectorAll('#sd-board *').length})`);
    assert.equal(c.table, false, "the table is hidden behind the curtain");
    assert.deepEqual([c.hand, c.board], [0, 0], "no hand or board in the page behind the curtain");
    assert.deepEqual(c.ids, [], `card ids behind the curtain: ${c.ids}`);
    return c.text;
  };

  // Plays the game on screen to its result with clicks: what the screen enables (finishing each prompt),
  // every troop that can attack, then End turn. With two players each seat is played the same way,
  // passing the curtain with "I'm ready"; privacy is checked for the seat on screen every turn.
  const playGame = async ({two = false} = {}) => {
    let turns = 0, curtains = 0, handsSeen = {cowboy: 0, wizard: 0};
    const activeSeat = async () => (two ? ((await text("#sd-status")).match(/the (Cowboys|Wizards)' turn$/)?.[1] === "Cowboys" ? "cowboy" : "wizard") : "cowboy");
    while (!(await resultShown()) && turns < 120) {
      if (two && (await curtainUp())) {
        const said = await assertCurtain();
        curtains += 1;
        await assertReadyFocused(`(curtain ${curtains}, turn ${turns + 1})`);
        await click("#sd-ready");
        await wait(`vis(document.getElementById('sd-table'))`, "the table after I'm ready");
        await assertTableFocused(`(mouse I'm ready, curtain ${curtains})`);
        const seat = await activeSeat();
        assert.equal(said, `Pass the screen to the ${seat === "cowboy" ? "Cowboy" : "Wizard"} player.`);
      }
      const seat = await activeSeat();
      handsSeen[seat] = Math.max(handsSeen[seat], await assertPrivate(seat));
      for (let played = 0; played < 4; played += 1) {
        const card = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
        if (!card) break;
        await click(`#sd-hand [data-card="${card}"]`);
        for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
          const prompt = await text("#sd-prompt");
          if (/as payment|to carry/.test(prompt)) await click(`#sd-board [data-side=${seat}] .sd-slot.sd-can[data-own]`);
          else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
          else await click("#sd-cancel");
        }
        if (await resultShown()) break;
      }
      for (let i = 0; i < 3 && !(await resultShown()); i += 1) {
        const ready = await evaluate(`[...document.querySelectorAll('#sd-board [data-side=${seat}] [data-own]')].find(n=>/Can attack/.test(n.textContent))?.dataset.slot??null`);
        if (!ready) break;
        await click(`#sd-board [data-side=${seat}] [data-slot="${ready}"]`);
        const aim = await evaluate(`({base:Boolean(document.querySelector('[data-enemy=base]')),troops:document.querySelectorAll('.sd-slot[data-enemy]').length})`);
        if (!aim.base && !aim.troops) { if (!(await evaluate(`document.getElementById('sd-cancel').hidden`))) await click("#sd-cancel"); break; }
        const before = await text("#sd-feedback");
        await click(aim.base ? "[data-enemy=base]" : ".sd-slot[data-enemy]");
        await wait(`document.getElementById('sd-feedback').textContent!==${JSON.stringify(before)}`, "the attack's feedback line");
      }
      if (await resultShown()) break;
      await click("#sd-end");
      await wait(two ? `vis(document.getElementById('sd-curtain'))||document.querySelector('#showdown .sd-result')`
        : `/your turn$/.test(document.getElementById('sd-status').textContent)||document.querySelector('#showdown .sd-result')`, "the next turn", 30000);
      turns += 1;
    }
    assert.ok(await resultShown(), `no result after ${turns} turns`);
    const status = await text("#sd-status");
    const firstLine = await evaluate(`document.querySelector('#sd-log li')?.textContent`);
    const game = {status, turns, curtains, handsSeen, opened: /Cowboys/.test(firstLine) ? "cowboy" : "wizard",
      won: two ? (/^The Cowboys win/.test(status) ? "cowboy" : /^The Wizards win/.test(status) ? "wizard" : null) : status.startsWith("You win")};
    run.games.push(game);
    return game;
  };
  // Starts a Camp duel by its button and waits for its first turn (or the curtain).
  const startFrom = async (finder, what) => {
    await press(finder, what);
    await wait(`!document.getElementById('showdown').hidden&&(/ · turn \\d+ · /.test(document.getElementById('sd-status').textContent)||vis(document.getElementById('sd-curtain')))`, `${what} to open`);
  };
  // Wins a solo Camp duel, trying seeds in turn (each from a fresh page load and the Camp button);
  // every loss is recorded by the game as it would be for a player. Returns the results in order.
  const winSolo = async (finder, what) => {
    const results = [];
    for (const seed of SEEDS) {
      await load(`?seed=${seed}`);
      await openCamp();
      await startFrom(finder, what);
      const game = await playGame();
      results.push(game.won);
      if (game.won) return {seed, results};
    }
    throw Error(`${what} not won with seeds ${SEEDS.join(",")}`);
  };
  const takeOffer = async () => {
    const offer = await evaluate(`buttons(document).filter(n=>n.dataset.choose).map(n=>n.dataset.choose)`);
    if (!offer.length) return null;
    await press(`buttons(document).find(n=>n.dataset.choose===${JSON.stringify(offer[0])})`, "the first offered card");
    await wait(`!buttons(document).some(n=>n.dataset.choose)`, "the offer to close");
    return offer[0];
  };
  const toCamp = async () => { await press(byText("/^Back to camp$/"), "Back to camp"); await wait(`Boolean(camp())`, "the Camp"); };

  // A real key press over the DevTools protocol, to whatever has focus.
  const key = async (name) => {
    const code = {Tab: 9, Enter: 13}[name];
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code: name, windowsVirtualKeyCode: code, ...(name === "Enter" ? {text: "\r"} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code: name, windowsVirtualKeyCode: code});
  };
  return {focusAt, focusLog, assertReadyFocused, assertTableFocused, key, send, evaluate, wait, press, click, byText, text, shot, storage, progress, seedStorage, load, openCamp, tile, tileState, startFrom,
    winSolo, playGame, takeOffer, toCamp, assertCurtain, curtainUp, check, run, dialogs: () => dialogs,
    close: async () => { cdp.close(); await chrome.close(); }};
}

// Replays the observed results of one duel id on a save with progress.js (offers taken first, as the check does).
const replay = (save, id, results, {take = true} = {}) => {
  for (const won of results) {
    save = settle(save, id, won).save;
    if (take && save.offer) save = choose(save, save.offer[0]);
  }
  return save;
};

// ---- Runs ----------------------------------------------------------------------------------------
const RUNS = {
  async gated(s) {
    await s.load("?seed=0");
    await s.openCamp();
    const states = {};
    for (const name of [...RIVALS.map((r) => r.name), ...BOUNTIES.map((b) => b.name), "The even match", "Best of three, with your side deck"]) {
      const t = await s.tileState(name);
      assert.ok(t, `${name} is listed`);
      assert.equal(t.disabled, true, `${name} is locked before the Trail`);
      states[name] = t.text;
    }
    assert.ok(Object.entries(states).every(([name, t]) => name.startsWith("Best of three") || /After the Trail|after the Trail/.test(t)), JSON.stringify(states));
    for (const name of ["Two players, one screen", "Two players, best of three"]) assert.equal((await s.tileState(name)).disabled, false, `${name} is open`);
    await s.shot("camp-new");
    s.check("New profile: rivals, Wanted, the even match and best of three are locked 'after the Trail'; two players is open", states);
    await s.click("#camp-build");
    await s.wait(`vis(document.getElementById('showdown-builder'))`, "the deck builder");
    const rows = await s.evaluate(`[...document.querySelectorAll('#builder-rows [data-row]')].map(n=>n.dataset.row)`);
    assert.deepEqual(rows.sort(), Object.keys(newSave().deck).sort(), "a new profile builds from its starter cards only");
    await s.click("#builder-cancel");
    await s.wait(`Boolean(camp())`, "the Camp after Cancel");
    assert.equal(await s.progress(), null, "Cancel saves nothing");
    s.check("Build deck lists only owned cards; Cancel returns to Camp and saves nothing", rows);
  },

  async packs(s) {
    await s.seedStorage([[SAVE_KEY, JSON.stringify(postTrail)]]);
    await s.load("?seed=0");
    await s.openCamp();
    assert.equal(postTrail.packs, 1);
    await s.click("#camp-pack");
    await s.wait(`document.querySelectorAll('#camp-claim [data-opened]').length>0`, "the opened pack");
    const shown = await s.evaluate(`[...document.querySelectorAll('#camp-claim [data-opened]')].map(n=>n.dataset.opened)`);
    const expected = openPack(postTrail);
    assert.deepEqual(shown, expected.cards, "the pack holds what progress.js openPack() rolls");
    assert.deepEqual(await s.progress(), expected.save, "stored right after opening");
    await s.shot("pack-opened");
    await s.press(s.byText("/^Add them to my collection$/"), "Add them to my collection");
    await s.load();
    await s.openCamp();
    assert.deepEqual(await s.progress(), expected.save);
    const collection = await s.text("#camp-collection");
    for (const type of new Set(expected.cards)) assert.ok(collection.includes(`${nameOf(type)} ×${expected.save.collection[type]}`), `${nameOf(type)} listed: ${collection}`);
    assert.equal(await s.evaluate(`Boolean(document.getElementById('camp-pack'))`), false, "no pack left to open");
    s.check("Post-Trail pack: opened from the Camp, cards equal progress.js openPack(), kept after a reload", shown.map(nameOf));
  },

  async builder(s) {
    await s.seedStorage([[SAVE_KEY, JSON.stringify(postTrail)]]);
    await s.load();
    await s.openCamp();
    await s.click("#camp-build");
    await s.wait(`vis(document.getElementById('showdown-builder'))`, "the deck builder");
    const step = (zone, type, by) => s.click(`#builder-rows [data-zone="${zone}"][data-type="${type}"][data-by="${by}"]`);
    // One Sheriff from the deck to the side deck: 15 cards, refused.
    await step("deck", PLAIN, -1);
    await step("side", PLAIN, 1);
    let state = await s.evaluate(`({save:document.getElementById('builder-save').disabled,problems:document.getElementById('builder-problems').textContent})`);
    assert.equal(state.save, true, "a 15-card deck cannot be saved");
    assert.match(state.problems, new RegExp(`A deck is exactly ${DECK_SIZE} cards; this one has ${DECK_SIZE - 1}`));
    // A limited card: + stops at its limit.
    const limited = Object.keys(postTrail.collection).find((type) => TYPES[type].rarity !== "basic");
    const max = await s.evaluate(`document.querySelector('#builder-rows [data-row="${limited}"]').textContent.match(/Limit: (\\d+)/)?.[1]`);
    s.check("A deck one card short is refused with its reason; Save is disabled", state.problems);
    // Billy in for the missing card: 16 + 1 side, saved.
    await step("deck", "cowboy-billy", 1);
    state = await s.evaluate(`({save:document.getElementById('builder-save').disabled,problems:document.getElementById('builder-problems').textContent})`);
    assert.equal(state.save, false, state.problems);
    await s.click("#builder-save");
    await s.wait(`Boolean(camp())`, "the Camp after Save");
    const want = {...postTrail.deck, [PLAIN]: postTrail.deck[PLAIN] - 1, "cowboy-billy": (postTrail.deck["cowboy-billy"] ?? 0) + 1};
    let stored = await s.progress();
    assert.deepEqual([stored.deck, stored.side], [want, {[PLAIN]: 1}]);
    await s.load();
    await s.openCamp();
    stored = await s.progress();
    assert.deepEqual(stored.side, {[PLAIN]: 1});
    const listed = await s.text("#camp-collection");
    assert.match(listed, /Side deck: Sheriff ×1\./);
    await s.shot("deck-saved");
    s.check("A legal deck and side deck are saved, listed in the Camp ('Side deck: Sheriff ×1') and kept after a reload", {deck: stored.deck, side: stored.side, limitOf: [limited, max]});
  },

  async rival(s) {
    await s.seedStorage([[SAVE_KEY, JSON.stringify(postTrail)]]);
    await s.load();
    await s.openCamp();
    const [first, second] = RIVALS;
    assert.equal((await s.tileState(first.name)).disabled, false);
    const waiting = await s.tileState(second.name);
    assert.deepEqual([waiting.disabled, /Beat the rival before/.test(waiting.text)], [true, true], waiting.text);
    s.check(`After the Trail: ${first.name} is open and ${second.name} waits for her`, waiting.text);
    const {seed, results} = await s.winSolo(s.tile(first.name), first.name);
    const shown = await s.evaluate(`txt(document.getElementById('sd-result'))`);
    for (const type of first.reward) assert.ok(shown.includes(nameOf(type)), `the result names ${nameOf(type)}`);
    assert.match(shown, /You earned 1 pack\. Open it in camp\./);
    const took = await s.takeOffer();
    // The beaten rival is a repeat for the card choice.
    assert.ok(await s.evaluate(`Boolean(${s.byText("/^Play it again$/")})`), "Play it again is offered");
    await s.toCamp();
    const expected = replay(postTrail, `rival:${first.id}`, results);
    assert.deepEqual(await s.progress(), expected, "stored progress equals progress.js for the same results");
    assert.match((await s.tileState(first.name)).text, /Beaten\. Rematch for a card\./);
    assert.equal((await s.tileState(second.name)).disabled, false, `${second.name} opens`);
    await s.shot("rival-beaten");
    s.check(`${first.name} won by clicks (seed ${seed}, ${results.length} game(s)); pays ${first.reward.map(nameOf)} and a pack; ${second.name} opens; rematch offered`,
      {seed, results, took});
  },

  async bounty(s) {
    const bounty = BOUNTIES[0];
    await s.seedStorage([[SAVE_KEY, JSON.stringify(postTrail)]]);
    const first = await s.winSolo(s.tile(bounty.name), bounty.name);
    await s.takeOffer();
    let expected = replay(postTrail, `hunt:${bounty.id}`, first.results);
    assert.deepEqual(await s.progress(), expected);
    assert.equal(expected.hunts[bounty.id], 1);
    // Repeat from the result screen: the next hunt, harder, with the same seed function.
    await s.press(s.byText("/^Play it again$/"), "Play it again");
    await s.wait(`/hunt 2 of ${HUNTS}/.test(document.getElementById('sd-status').textContent)`, "hunt 2");
    let game = await s.playGame();
    const second = [game.won];
    while (!game.won && second.length < 6) {
      await s.press(s.byText("/^Rematch$/"), "Rematch");
      await s.wait(`/hunt 2 of ${HUNTS} · turn 1/.test(document.getElementById('sd-status').textContent)`, "the rematch");
      game = await s.playGame();
      second.push(game.won);
    }
    assert.ok(game.won, `hunt 2 not won in ${second.length} games`);
    await s.takeOffer();
    expected = replay(expected, `hunt:${bounty.id}`, second);
    assert.deepEqual(await s.progress(), expected, "each hunt won is counted once");
    await s.load();
    await s.openCamp();
    assert.match((await s.tileState(bounty.name)).text, new RegExp(`2 of ${HUNTS} hunts won`));
    s.check(`Wanted: ${bounty.name} hunt 1 won (seed ${first.seed}), repeated from the result as hunt 2 and won; stored hunts 2 after a reload`, {first: first.results, second});

    // The fifth hunt, from a 4-of-5 fixture.
    const four = {...postTrail, hunts: {[bounty.id]: HUNTS - 1}};
    await s.seedStorage([[SAVE_KEY, JSON.stringify(four)]]);
    const fifth = await s.winSolo(s.tile(bounty.name), bounty.name);
    const shown = await s.evaluate(`txt(document.getElementById('sd-result'))`);
    assert.match(shown, new RegExp(`Captured[\\s\\S]*${nameOf(bounty.reward)}`));
    await s.takeOffer();
    assert.equal(await s.evaluate(`Boolean(${s.byText("/^(Play it again|Rematch)$/")})`), false, "a captured bounty offers no repeat");
    await s.toCamp();
    const stored = await s.progress();
    assert.deepEqual(stored, replay(four, `hunt:${bounty.id}`, fifth.results));
    assert.equal(stored.collection[bounty.reward], 1);
    const t = await s.tileState(bounty.name);
    assert.deepEqual([t.disabled, t.text.includes(`Captured: ${nameOf(bounty.reward)}`)], [true, true], t.text);
    await s.shot("bounty-captured");
    s.check(`The fifth ${bounty.name} hunt (seed ${fifth.seed}) captures ${nameOf(bounty.reward)}; the tile reads Captured; no repeat`, fifth.results);
  },

  async bo3(s) {
    await s.seedStorage([[SAVE_KEY, JSON.stringify(withSide)]]);
    await s.load("?seed=4");
    await s.openCamp();
    await s.startFrom(`document.querySelector('[data-match="open"]')`, "Best of three");
    assert.match(await s.text("#sd-status"), /^Open range · game 1 of 3 · you 0, Wizards 0 · turn 1/);
    const games = [];
    let swaps = 0, firstOk = true;
    for (let n = 1; n <= 3; n += 1) {
      const game = await s.playGame();
      games.push(game);
      if (n > 1) firstOk &&= game.opened === (games[n - 2].won ? "wizard" : "cowboy");
      const label = await s.evaluate(`document.getElementById('sd-again')?.textContent??null`);
      const wins = games.filter((g) => g.won).length, losses = games.length - wins; // the click bot never drew here; a draw would fail below
      if (wins >= 2 || losses >= 2) break;
      assert.equal(label, `Game ${n + 1}`);
      assert.deepEqual(await s.progress(), withSide, "nothing is saved between games");
      await s.click("#sd-again");
      // The side-deck swap: a full deck from this match's cards only.
      await s.wait(`vis(document.getElementById('showdown-builder'))`, "the between-games swap");
      assert.equal(await s.text("#builder-title"), "Between games: swap with your side deck");
      assert.equal(await s.evaluate(`document.getElementById('builder-cancel').hidden`), true, "no cancel between games");
      const rows = await s.evaluate(`[...document.querySelectorAll('#builder-rows [data-row]')].map(n=>n.dataset.row).sort()`);
      assert.deepEqual(rows, Object.keys({...withSide.deck, ...withSide.side}).sort(), "only this match's cards");
      // Sheriff + takes one from the side deck: 17 in the deck, refused; Billy − brings it back to 16.
      await s.click(`#builder-rows [data-zone="deck"][data-type="${PLAIN}"][data-by="1"]`);
      assert.equal(await s.evaluate(`document.getElementById('builder-save').disabled`), true, "17 cards refused");
      await s.click(`#builder-rows [data-zone="deck"][data-type="cowboy-billy"][data-by="-1"]`);
      assert.equal(await s.evaluate(`document.getElementById('builder-save').disabled`), false);
      await s.click("#builder-save");
      swaps += 1;
      await s.wait(`!document.getElementById('showdown').hidden&&new RegExp('game ${n + 1} of 3').test(document.getElementById('sd-status').textContent)`, `game ${n + 1}`);
    }
    const won = games.filter((g) => g.won).length >= 2;
    assert.ok(games.filter((g) => g.won).length >= 2 || games.filter((g) => !g.won).length >= 2, JSON.stringify(games));
    assert.ok(firstOk, `the loser opens the next game: ${JSON.stringify(games.map((g) => [g.won, g.opened]))}`);
    const stored = await s.progress();
    const expected = settle(withSide, "open", won).save;
    assert.deepEqual(stored, expected, "the match settles once, on its result");
    assert.deepEqual([stored.deck, stored.side], [withSide.deck, withSide.side], "the swap lasts for the match only");
    const log = JSON.parse((await s.storage())[PLAYTEST_KEY]);
    assert.equal(log.length, games.length, "one playtest line per game");
    await s.shot("bo3-done");
    s.check(`Best of three with a side deck (?seed=4): ${games.map((g) => (g.won ? "W" : "L")).join("")}; ${swaps} swap(s); loser opens; nothing saved between games; settled once`,
      {games: games.map((g) => ({won: g.won, opened: g.opened, turns: g.turns})), openWins: stored.openWins});
  },

  async hotseat(s) {
    await s.seedStorage([[SAVE_KEY, JSON.stringify(postTrail)]]);
    await s.load("?seed=3");
    await s.openCamp();
    const before = await s.storage();
    await s.startFrom(`document.querySelector('[data-two="3"]')`, "Two players, best of three");
    assert.equal(await s.curtainUp(), true, "the first game opens behind the curtain");
    const games = [];
    const wins = {cowboy: 0, wizard: 0};
    while (Math.max(wins.cowboy, wins.wizard) < 2 && games.length < 5) {
      const game = await s.playGame({two: true});
      games.push(game);
      if (game.won) wins[game.won] += 1;
      if (games.length > 1 && games.at(-2).won) assert.equal(game.opened, games.at(-2).won === "cowboy" ? "wizard" : "cowboy", "the loser opens");
      // After a result both look at the board: no hand and no set trap is shown.
      assert.equal(await s.evaluate(`document.querySelectorAll('#sd-hand [data-card]').length`), 0, "no hand after the result");
      if (Math.max(wins.cowboy, wins.wizard) >= 2) break;
      assert.equal(await s.text("#sd-again"), `Game ${games.length + 1}`);
      await s.click("#sd-again");
      await s.wait(`vis(document.getElementById('sd-curtain'))`, "the curtain before the next game");
    }
    assert.ok(games.every((g) => g.curtains > 0 && g.handsSeen.cowboy > 0 && g.handsSeen.wizard > 0), JSON.stringify(games));
    assert.match(await s.text("#sd-status"), /^The (Cowboys|Wizards) win: .* · game \d of 3 · Cowboys \d, Wizards \d$/);
    assert.equal(await s.text("#sd-again"), "Play again");
    // Play again is a new best of three with the starter decks: its first hand is the engine's starter deal of ?seed=3.
    const fresh = createShowdown(3, {decks: DECKS});
    await s.click("#sd-again");
    await s.wait(`vis(document.getElementById('sd-curtain'))`, "the curtain for the new match");
    await s.assertReadyFocused("(Play again, new match)");
    await s.click("#sd-ready");
    await s.wait(`vis(document.getElementById('sd-table'))`, "the table");
    assert.deepEqual(await s.evaluate(`[...document.querySelectorAll('#sd-hand [data-card]')].map(n=>n.dataset.card).sort()`), [...fresh.sides[fresh.first].hand].sort());
    const after = await s.storage();
    assert.deepEqual(after, before, "two players changes no stored data: no progress and no playtest line");
    await s.shot("hotseat-done");
    s.check(`Two players best of three (?seed=3): curtain every hand-over with nothing private in the page; each seat saw only its own hand; ${wins.cowboy}-${wins.wizard}; storage unchanged`,
      games.map((g) => ({won: g.won, opened: g.opened, turns: g.turns, curtains: g.curtains})));
  },

  async earned(s) {
    // Fable's earned-decks ruling: shown only after the first Wizard preview win, one game, the Wizards open.
    // Fixtures: a Cowboy who has won Boot Hill with the card offer still open and two packs, a playtest line, and a
    // Wizard preview save (the career module's own shape; the read-back below fails if it differs).
    const {WIZARD_PREVIEW_KEY, createWizardPreview} = await import("../src/match/showdown-wizard-campaign.js");
    const cowboy = {...settle(newSave(), "trail", true).save, packs: 2};
    const previewRaw = (wins) => JSON.stringify({v: 1, wins, losses: 0});
    const readBack = (wins) => createWizardPreview({getItem: (k) => (k === WIZARD_PREVIEW_KEY ? previewRaw(wins) : null),
      setItem: () => { throw Error("the preview wrote on read"); }, removeItem: () => {}}).progress();
    assert.equal(readBack(1).wins, 1, "the fixture is a one-win preview");
    const SEED = 7;
    // The engine's deal for this seed: the Wizards' opening hand, then the Cowboys' hand when their first turn starts.
    const dealt = (cowboySave, wins) => {
      const duel = earnedDuel(cowboySave, readBack(wins));
      const engine = createShowdown(SEED, duel.options);
      assert.equal(engine.first, "wizard", "the Wizards open");
      return {decks: duel.options.decks, wizard: engine.sides.wizard.hand, cowboy: applyAction(engine, {type: "end"}).state.sides.cowboy.hand};
    };
    const handOnScreen = () => s.evaluate(`[...document.querySelectorAll('#sd-hand [data-card]')].map(n=>n.dataset.card).sort()`);
    const sorted = (ids) => [...ids].sort();
    // Each hand-over: the curtain with both hands out of the page and focus already on "I'm ready" (no Tab), then one
    // Enter clears it and focus lands on a usable control of the table.
    const passTo = async (seat, when) => {
      await s.wait(`vis(document.getElementById('sd-curtain'))`, `the curtain for the ${seat} player`);
      assert.equal(await s.assertCurtain(), `Pass the screen to the ${seat === "cowboy" ? "Cowboy" : "Wizard"} player.`);
      await s.assertReadyFocused(when);
      await s.key("Enter");
      await s.wait(`vis(document.getElementById('sd-table'))`, "the table");
      await s.assertTableFocused(`(Enter on I'm ready, ${when})`);
    };
    const visibleText = () => s.evaluate(`txt(document.getElementById('showdown'))`);

    // No teaser: absent on a new profile, and after a Boot Hill win while the preview has no win.
    for (const entries of [[], [[SAVE_KEY, JSON.stringify(cowboy)]], [[SAVE_KEY, JSON.stringify(cowboy)], [WIZARD_PREVIEW_KEY, previewRaw(0)]]]) {
      await s.seedStorage(entries);
      await s.load();
      await s.openCamp();
      assert.equal(await s.evaluate(`document.getElementById('camp-earned')`), null, `no Earned decks with ${JSON.stringify(entries.map(([k]) => k))}`);
      assert.equal(await s.evaluate(`/earned decks/i.test(txt(camp()))`), false, "no teaser text");
    }
    s.check("Earned decks: absent, with no teaser, on a new profile, after Boot Hill alone, and with a preview at 0 wins");

    // An empty Cowboy save after a direct preview win: the starter deck against the preview deck.
    const starter = dealt(newSave(), 1);
    await s.seedStorage([[WIZARD_PREVIEW_KEY, previewRaw(1)]]);
    await s.load(`?seed=${SEED}`);
    await s.openCamp();
    await s.click("#camp-earned");
    await passTo("wizard", "(mouse start, empty save)");
    assert.deepEqual(await handOnScreen(), sorted(starter.wizard), "Wizard hand, empty Cowboy save");
    await s.click("#sd-end");
    await passTo("cowboy", "(mouse End turn)");
    assert.deepEqual(await handOnScreen(), sorted(starter.cowboy), "Cowboy starter hand");
    s.check(`Earned decks with an empty Cowboy save: starter deck; both first hands equal the engine's ?seed=${SEED} deal, Wizards first`, starter);

    // The full game: the earned Camp deck, chosen with the keyboard, played to a result.
    const earned = dealt(cowboy, 1);
    assert.notDeepEqual(earned.cowboy, starter.cowboy, "the seed tells the Camp deck from the starter deck");
    const playtestRaw = JSON.stringify([{name: "Boot Hill", won: true, turns: 6, seconds: 90, rules: false}]);
    await s.seedStorage([[SAVE_KEY, JSON.stringify(cowboy)], [WIZARD_PREVIEW_KEY, previewRaw(1)], [PLAYTEST_KEY, playtestRaw]]);
    await s.load(`?seed=${SEED}`);
    await s.openCamp();
    const before = await s.storage();
    assert.equal(before[SAVE_KEY], JSON.stringify(cowboy), "the Cowboy career as seeded");
    assert.equal(before[WIZARD_PREVIEW_KEY], previewRaw(1), "the Wizard career as seeded");
    let tabs = 0;
    while (!(await s.evaluate(`document.activeElement?.id==='camp-earned'`)) && tabs < 300) { await s.key("Tab"); tabs += 1; }
    assert.ok(tabs < 300, "Earned decks is reached with Tab");
    await s.key("Enter");
    await passTo("wizard", "(keyboard start)");
    assert.match(await s.text("#sd-status"), /^Earned decks \(not an even match\) · turn 1 · the Wizards' turn$/);
    assert.match(await s.text("#sd-lesson"), /Not an even match\. Nothing is saved\./);
    assert.deepEqual(await handOnScreen(), sorted(earned.wizard), "Wizard hand is the engine's deal");
    // Keyboard End turn: End turn focused, then Enter.
    assert.equal(await s.evaluate(`(document.getElementById('sd-end').focus(),document.activeElement.id)`), "sd-end");
    await s.key("Enter");
    await passTo("cowboy", "(keyboard End turn)");
    assert.deepEqual(await handOnScreen(), sorted(earned.cowboy), "Cowboy hand (Camp deck) is the engine's deal");
    s.check(`Earned decks chosen with ${tabs} Tab presses and Enter; curtain first, I'm ready focused; Wizards open; both first hands equal the engine's ?seed=${SEED} deal`, earned);

    const game = await s.playGame({two: true});
    assert.ok(game.won, "a winner is named");
    assert.doesNotMatch(game.status, /game \d of 3/, "a single game, not a best of three");
    assert.equal(await s.evaluate(`['cowboy','wizard'].every(side=>vis(document.querySelector('#sd-board [data-side='+side+']')))`), true, "both boards open");
    assert.equal(await s.evaluate(`vis(document.getElementById('sd-curtain'))`), false, "no curtain after the result");
    assert.deepEqual(await s.storage(), before, "nothing stored after the game");
    await s.shot("earned-result");
    assert.equal(await s.text("#sd-again"), "Rematch: earned decks, not an even match");
    await s.click("#sd-again");
    await passTo("wizard", "(mouse Rematch)");
    assert.match(await s.text("#sd-status"), /^Earned decks \(not an even match\) · turn 1 · the Wizards' turn$/, "the rematch: Wizards open again");
    assert.deepEqual(await handOnScreen(), sorted(earned.wizard), "the rematch deals the earned decks again");
    assert.match(await visibleText(), /Not an even match/);
    await s.toCamp();
    assert.equal(await s.evaluate(`document.activeElement?.id`), "camp-earned", "focus returns to Earned decks");
    const after = await s.storage();
    assert.deepEqual(Object.keys(after), Object.keys(before));
    for (const k of Object.keys(before)) assert.equal(after[k], before[k], `${k} byte-identical`);
    s.check(`Earned decks game to its result (${game.status}); open board; the rematch keeps the decks, the label and the Wizard opener; both careers and the log byte-identical`,
      {turns: game.turns, curtains: game.curtains, keys: Object.keys(after)});
    s.check(`Focus: I'm ready focused at all ${s.focusLog.filter((f) => f.id === "sd-ready").length} curtains; a usable table control after every clear`, s.focusLog);
  },

  async saves(s) {
    await s.seedStorage([[SAVE_KEY, JSON.stringify(postTrail)], [LANE_KEY, laneVeteran.raw], [PLAYTEST_KEY, JSON.stringify([{name: "Boot Hill", won: true, turns: 6, seconds: 90, rules: false}])]]);
    await s.load();
    await s.openCamp();
    const kept = await s.storage();
    assert.ok(kept[INHERITED_KEY], "the keepsake record is written on load");
    assert.match(await s.text("#camp-collection"), new RegExp(`${nameOf(laneVeteran.captured)} ×1 \\(from the lane game\\)`));
    assert.equal(await s.evaluate(`document.getElementById('camp-code').value`), encodeSave(postTrail), "the code is the progress only");
    await s.evaluate(`document.getElementById('camp-save').open=true`);
    // Paste another save (a new player's at Trail 2), preview, Cancel.
    const other = (() => { let v = newSave(); for (let i = 0; i < 2; i += 1) { v = settle(v, "trail", true).save; v = choose(v, v.offer[0]); } return v; })();
    const paste = async (code) => {
      await s.click("#camp-code");
      await s.evaluate(`(document.getElementById('camp-code').select(),true)`);
      await s.send("Input.insertText", {text: code});
    };
    await paste(encodeSave(other));
    await s.click("#camp-load");
    await s.wait(`vis(document.getElementById('camp-code-preview'))`, "the preview");
    assert.match(await s.text("#camp-code-preview-text"), /Trail 2 of 6 won/);
    await s.click("#camp-code-cancel");
    assert.equal(await s.text("#camp-code-note"), "Cancelled. Nothing was changed.");
    assert.deepEqual(await s.progress(), postTrail);
    await s.click("#camp-load");
    await s.wait(`vis(document.getElementById('camp-code-preview'))`, "the preview");
    await s.click("#camp-code-replace");
    await s.wait(`!vis(document.getElementById('camp-code-preview'))`, "the save decision");
    assert.equal(await s.text("#camp-code-note"), "Loaded.");
    assert.deepEqual(await s.progress(), other);
    // A damaged code changes nothing.
    await paste("not a code");
    await s.click("#camp-load");
    assert.match(await s.text("#camp-code-note"), /Nothing was changed\.$/);
    assert.deepEqual(await s.progress(), other);
    s.check("Save code: preview, Cancel and a damaged code change nothing; Replace loads the pasted progress", {loaded: other.wins});
    // The preview was prepared before another writer advanced this career.
    await paste(encodeSave(postTrail));
    await s.click("#camp-load");
    await s.wait(`vis(document.getElementById('camp-code-preview'))`, "the pending replacement");
    const newer = settle(other, "trail", true).save;
    await s.evaluate(`localStorage.setItem(${JSON.stringify(SAVE_KEY)},${JSON.stringify(JSON.stringify(newer))})`);
    await s.click("#camp-code-replace");
    await s.wait(`vis(document.getElementById('camp-changed'))`, "the changed Camp notice");
    assert.deepEqual(await s.progress(), newer);
    assert.match(await s.text("#camp-changed"), /another tab/);
    assert.equal((await s.focusAt()).id, "camp-changed");
    s.check("A pending import keeps the newer Trail win and its unclaimed offer, and focuses the conflict notice");
    // Start over.
    await s.load();
    await s.openCamp();
    await s.evaluate(`document.getElementById('camp-save').open=true`);
    const beforeReset = await s.storage();
    await s.click("#camp-reset");
    await s.wait(`document.getElementById('camp-code-note').textContent==='Started over.'`, "Started over");
    assert.deepEqual(s.dialogs(), ["Start over? Your cards, progress and playtest report in this browser are erased."]);
    const after = await s.storage();
    assert.deepEqual(JSON.parse(after[SAVE_KEY]), newSave());
    assert.deepEqual(JSON.parse(after[PLAYTEST_KEY]), []);
    assert.equal(after[LANE_KEY], laneVeteran.raw, "cvw-player-v1 byte-identical");
    assert.equal(after[INHERITED_KEY], beforeReset[INHERITED_KEY], "keepsake record byte-identical");
    await s.load();
    await s.openCamp();
    assert.match(await s.text("#camp-collection"), new RegExp(`${nameOf(laneVeteran.captured)} ×1 \\(from the lane game\\)`), "the keepsake is still shown");
    assert.equal((await s.tileState("Boot Hill")).disabled, false, "the Trail starts again");
    await s.shot("started-over");
    s.check("Start over (confirm accepted) resets Showdown progress and the report only; cvw-player-v1 and the keepsake record unchanged; keepsake still shown",
      {keys: Object.keys(after)});
  },
};

let failed = null;
const only = process.env.MODES ? process.env.MODES.split(",") : Object.keys(RUNS);
try {
  for (const label of only) {
    const s = await session(label);
    try { await RUNS[label](s); } catch (error) {
      failed ??= error;
      report.runs[label].failure = error.stack;
      console.error(`not ok - [${label}] ${error.message}`);
      await s.shot("failure").catch(() => {});
    } finally { await s.close(); }
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
  report.note = "Bot-driven browser acceptance of flow, privacy and storage. Human playtests are pending and are not simulated here.";
  await writeFile(path.join(out, "browser-showdown-modes.json"), `${JSON.stringify(report, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
const passed = Object.values(report.runs).reduce((n, r) => n + r.checks.length, 0);
console.log(`${passed} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown-modes.json"))}`);
