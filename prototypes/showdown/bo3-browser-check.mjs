// Headless Chrome check of Showdown best of three, played through the real screen (no extra dependency; DevTools protocol).
//
//   node prototypes/showdown/build.mjs && node prototypes/showdown/bo3-browser-check.mjs [--solo-seeds 4,1] [--two-seeds 12,1271]
//
// What is real and what is a fixture:
// - FIXTURE: the saved Camp progress. The Open range best of three needs a finished Trail, so the test builds a save in
//   Node with progress.js (six real Trail settles, the first card of each offer, a legal 16-card deck and a 4-card side
//   deck checked by withDeck) and loads it through the Camp's own "Save code" box and Load button.
// - REAL: every game action. Game 1 of each match is played to its end with mouse clicks on visible, enabled buttons.
//   The test keeps its own copy of the game, made from the public rules (rules.js) with the seed it put in the address and
//   the deck it wrote into the fixture. rules.js planTurn picks each Cowboy action (and, with two players, each Wizard
//   action); the test turns it into clicks. The Wizard turns in the solo match are played by the page. Before every move
//   the visible hand (its data-card buttons), both Base orb counts and the turn on screen must equal the test's copy.
// - SYNTHETIC SEED FIXTURE: main.js takes the first deal's seed from ?seed= and every later deal's seed from
//   Math.floor(Math.random() * 100000) (its only Math.random call). Before each route the test registers, with Chrome's
//   test-only Page.addScriptToEvaluateOnNewDocument, a queue of Math.random return values that floor to the later seeds
//   it chose ahead (seed + 0.5) / 100000; once the queue is empty Math.random is the browser's own again. No product code,
//   hook or game state is touched; the page deals, plays and scores as always, and the test models every game from the
//   same seeds and compares the screen before every move.
// - Seeds chosen ahead with rules.js so each series ends 2-0 within its cap of 3 games: solo 4 then 1 (Cowboys win both,
//   so the Open range settles as a win), two players 12 then 1271 (the Wizards win both).
//
// Solo: load the fixture, start "Best of three, with your side deck", finish game 1, open the side-deck swap, move one card
// each way (17 of 16 must block "Play the next game"; 16 of 16 must allow it), deal game 2 with the swapped deck and the
// loser of game 1 opening, play it to the end by clicks. Saved progress must stay byte-for-byte the loaded fixture until
// one side has 2 wins, then equal exactly one progress.js settle("open") of the fixture; "Back to camp" shows the saved deck.
// Two players: "Two players, best of three" from Camp, every game played through the curtain handoffs, each next game
// dealt to the loser of the last, until 2 wins; saved progress unchanged throughout (no Camp progression).
// Reads only what is on screen, the DOM and localStorage. Writes a receipt bound to SHA-256 digests. Exits 1 on any
// failure; 90 s cap, at most 3 games a series.
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {DECKS, TYPES, typeOf} from "./cards.js";
import {applyAction, createShowdown, opponent, planTurn, playTurn} from "./rules.js";
import {DECK_SIZE, SIDE_SIZE, choose, duelFor, migrate, newSave, settle, withDeck} from "./progress.js";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const seeds = (name, fallback) => option(name, fallback).split(",").map(Number);
const SOLO_SEEDS = seeds("--solo-seeds", "4,1");
const TWO_SEEDS = seeds("--two-seeds", "12,1271");
const SOLO_SEED = SOLO_SEEDS[0];
const TWO_SEED = TWO_SEEDS[0];
const MAX_GAMES = 3;
const RECEIPT = path.join(root, option("--receipt", ".artifacts/kiro/judge-proof/showdown-bo3/receipt.json"));
const MAX_STEPS = 400; // actions per game, far above any game the probe saw
const SAVE = "cvw-showdown-save-v2";
const PAGE = path.join(root, "dist/showdown.html");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const deadline = setTimeout(() => { console.error("FAIL: timed out after 90 s"); process.exit(1); }, 90000);

// ---- The fixture: a save after the Trail, built only with progress.js -----------------------------------------------
let fixture = newSave();
for (let i = 0; i < 6; i++) { fixture = settle(fixture, "trail", true).save; fixture = choose(fixture, fixture.offer[0]); }
const FIXTURE_SIDE = {"cowboy-outrider": 1, "cowboy-dynamiter": 1, "cowboy-bear-trap": 1, "cowboy-deadeye": 1};
fixture = migrate(withDeck({...fixture, packs: 0}, fixture.deck, FIXTURE_SIDE));
const fixtureJson = JSON.stringify(fixture);
const SWAP_IN = "cowboy-dynamiter"; // side deck -> deck
const SWAP_OUT = "cowboy-sheriff"; // deck -> side deck
const canonical = (value) => JSON.stringify(value, (key, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
const settledOnce = settle(fixture, "open", true).save; // what one Open range win does to the fixture
// SYNTHETIC SEED FIXTURE (test only): Math.random returns that floor to the later deal seeds, then the browser's own.
const seedFixture = (later) => `(() => { const queue = ${JSON.stringify(later.map((seed) => (seed + 0.5) / 100000))};
  const original = Math.random; Math.random = function random() { return queue.length ? queue.shift() : original.call(Math); }; })();`;
let seedScript = null;
async function queueSeeds(later) {
  if (seedScript) await send("Page.removeScriptToEvaluateOnNewDocument", {identifier: seedScript});
  seedScript = (await send("Page.addScriptToEvaluateOnNewDocument", {source: seedFixture(later)})).identifier;
}
const swappedDeck = {...fixture.deck, [SWAP_IN]: (fixture.deck[SWAP_IN] ?? 0) + 1, [SWAP_OUT]: fixture.deck[SWAP_OUT] - 1};

// ---- Chrome over the DevTools protocol ------------------------------------------------------------------------------
const profile = await mkdtemp("/tmp/bo3-chrome-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--disable-background-networking", "--mute-audio",
  "--window-size=1280,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let stderr = "";
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("no DevTools URL in 20 s")), 20000);
  child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
const waiting = new Map(); let nextId = 0; const pageErrors = [];
ws.addEventListener("message", ({data}) => {
  const m = JSON.parse(data);
  if (m.id === undefined) {
    if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Network.requestWillBeSent" && !/^(file|data|about|blob):/.test(m.params.request.url)) pageErrors.push(`network request: ${m.params.request.url}`);
    return;
  }
  const e = waiting.get(m.id); waiting.delete(m.id);
  if (m.error) e?.reject(new Error(m.error.message)); else e?.resolve(m.result);
});
const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId; waiting.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
});
const {targetInfos} = await raw("Target.getTargets");
const {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
const send = (method, params) => raw(method, params, sessionId);
for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);
const evaluate = async (expression) => {
  const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true});
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

// ---- Reading the screen ---------------------------------------------------------------------------------------------
const SHOWN = `const shown = (n) => {
  if (!n) return false;
  for (let e = n; e && e !== document.documentElement; e = e.parentElement) {
    if (e.hidden) return false;
    const c = getComputedStyle(e);
    if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
  }
  const r = n.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};`;
const VIEW = `(() => { ${SHOWN}
  const text = (id) => shown(document.getElementById(id)) ? document.getElementById(id).textContent.replace(/\\s+/g, " ").trim() : null;
  const base = (side) => { const b = document.querySelector("#board .base." + side); const o = b?.querySelector(".orbs"); const n = b?.querySelector(".note");
    return b && shown(b) ? {orbs: o.getAttribute("aria-label"), counts: n.textContent} : null; };
  return {screens: ["camp", "builder", "duel", "curtain"].filter((id) => shown(document.getElementById(id))),
    status: text("status"), curtain: text("curtain-text"), again: text("again"), problems: text("builder-problems"),
    firstLog: document.querySelector("#log li")?.textContent ?? null,
    hand: [...document.querySelectorAll("#hand [data-card]")].filter(shown).map((c) => c.dataset.card),
    cowboy: base("cowboy"), wizard: base("wizard")};
})()`;
const view = () => evaluate(VIEW);
const stored = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE)})`);

const results = [];
const failures = [];
let current = "setup";
const check = (ok, message) => { results.push({route: current, ok: Boolean(ok), message}); if (!ok) failures.push(`${current}: ${message}`); console.log(`${ok ? "ok  " : "FAIL"} [${current}] ${message}`); };
const clicks = {total: 0};

// A real mouse click in the middle of a visible, enabled element. Refuses anything hidden or disabled.
async function click(selector) {
  const at = await evaluate(`(() => { ${SHOWN} const n = document.querySelector(${JSON.stringify(selector)});
    if (!n) return "missing"; if (!shown(n)) return "hidden"; if (n.disabled) return "disabled";
    n.scrollIntoView({block: "center"}); const r = n.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  if (typeof at === "string") throw new Error(`cannot click ${selector}: ${at}`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, x: at.x, y: at.y, button: "left", clickCount: 1});
  clicks.total += 1;
  await sleep(15);
}

// Real key presses through Chrome's input pipeline (no synthetic DOM events). Enter carries "\r" so it activates buttons.
const keys = {tab: 0, shiftTab: 0, enter: 0};
const KEY = {Tab: {key: "Tab", code: "Tab", windowsVirtualKeyCode: 9}, Enter: {key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r"}};
async function press(name, shift = false) {
  for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", {type, modifiers: shift ? 8 : 0, ...KEY[name]});
  keys[name === "Enter" ? "enter" : shift ? "shiftTab" : "tab"] += 1;
  await sleep(15);
}
// What has keyboard focus: its data-zone/type/by or id, whether it shows a keyboard focus ring and lies on the shown builder.
const focused = () => evaluate(`(() => { ${SHOWN} const a = document.activeElement;
  if (!a || a === document.body) return null;
  return {zone: a.dataset.zone ?? null, type: a.dataset.type ?? null, by: a.dataset.by ?? null, id: a.id || null,
    ring: a.matches(":focus-visible"), inBuilder: Boolean(a.closest("#builder")) && shown(a), disabled: Boolean(a.disabled)}; })()`);
const isFocus = (f, zone, type, by) => Boolean(f) && f.zone === zone && f.type === type && f.by === String(by) && f.ring && f.inBuilder && !f.disabled;
const stepButton = (zone, type, by) => `#builder-rows [data-zone="${zone}"][data-type="${type}"][data-by="${by}"]`;
// Tab (or Shift+Tab when the target is earlier in the page) until the target has focus. Every stop must be a shown,
// enabled control on the builder with a focus ring; returns the number of key presses.
async function tabTo(selector) {
  for (let i = 0; i <= 120; i++) {
    const where = await evaluate(`(() => { const t = document.querySelector(${JSON.stringify(selector)}); const a = document.activeElement;
      if (!t) return "missing"; if (t.disabled) return "disabled"; if (a === t) return "here";
      return a && a !== document.body && (a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING) ? "back" : "forward"; })()`);
    if (where === "here") return i;
    if (where === "missing" || where === "disabled") throw new Error(`cannot Tab to ${selector}: ${where}`);
    await press("Tab", where === "back");
    const f = await focused();
    if (!f || !f.inBuilder || !f.ring || f.disabled) throw new Error(`Tab toward ${selector} stopped off the builder or without a focus ring: ${JSON.stringify(f)}`);
  }
  throw new Error(`Tab did not reach ${selector} in 120 presses`);
}

// The clicks that make one engine action, following the screen's own controls.
async function perform(action) {
  if (action.type === "end") return click("#end");
  if (action.type === "attack" || action.type === "cover") {
    await click(`#board [data-own="${action.slot}"]`);
    return click(action.type === "cover" ? "#cover" : `#board [data-enemy="${action.target}"]`);
  }
  await click(`#hand [data-card="${action.cardId}"]`);
  if (action.type === "summon") for (const slot of action.tributes) await click(`#board [data-own="${slot}"]`);
  if (action.type === "spell" && action.target !== undefined) await click(`#board [data-enemy="${action.target}"]`);
  if (action.type === "gear") await click(`#board [data-own="${action.slot}"]`);
}

const orbLabel = (side) => `${side.base} of ${Math.max(side.base, side.baseMax)} orbs`;
// The screen must show what the test's copy of the game holds for the side at the controls.
async function matchesModel(state, own, label) {
  const v = await view();
  const ok = v.screens.join() === "duel" && JSON.stringify(v.hand) === JSON.stringify(state.sides[own].hand)
    && v.cowboy?.orbs === orbLabel(state.sides.cowboy) && v.wizard?.orbs === orbLabel(state.sides.wizard)
    && (state.result || new RegExp(`turn ${state.turn} `).test(v.status ?? ""));
  if (!ok) check(false, `${label}: screen differs from the rules copy (screen ${JSON.stringify(v)}; model hand ${state.sides[own].hand.join(",")}, Bases ${orbLabel(state.sides.cowboy)} / ${orbLabel(state.sides.wizard)}, turn ${state.turn})`);
  return ok;
}

// Plays one game to its end through the screen. two: both sides are clicked, with the curtain between turns.
async function playGame(state, {two}) {
  let steps = 0, compared = 0;
  const actions = {cowboy: 0, wizard: 0};
  while (!state.result) {
    if (!two && state.active === "wizard") { state = playTurn(state, 2).state; continue; }
    if (steps++ > MAX_STEPS) throw new Error(`game did not end in ${MAX_STEPS} actions`);
    if (two) {
      const v = await view();
      if (v.screens.join() === "curtain") {
        if (!new RegExp(`${state.active === "cowboy" ? "Cowboy" : "Wizard"} player`).test(v.curtain ?? "")) {
          check(false, `turn ${state.turn}: curtain names the ${state.active} player (${v.curtain})`); return {state, steps, compared, actions};
        }
        await click("#ready");
      }
    }
    if (!(await matchesModel(state, two ? state.active : "cowboy", `turn ${state.turn}, step ${steps}`))) return {state, steps, compared, actions};
    compared += 1;
    const action = planTurn(state)[0];
    actions[state.active] += 1;
    await perform(action);
    state = applyAction(state, action).state;
  }
  if (await matchesModel(state, two ? state.active : "cowboy", "final position")) compared += 1;
  return {state, steps, compared, actions};
}

const summary = {};
let code = 0;
try {
  const pageUrl = pathToFileURL(PAGE).href;

  // ---- Solo best of three with the side deck -------------------------------------------------------------------------
  current = "solo";
  await queueSeeds(SOLO_SEEDS.slice(1));
  await send("Page.navigate", {url: `${pageUrl}?seed=${SOLO_SEED}`});
  await sleep(700);
  check(await stored() === null, "fresh profile: no saved Camp progress before the fixture is loaded");
  check(await evaluate(`document.querySelector('button[data-match="open"]').disabled`) === true, "before the fixture, the best of three is locked behind the Trail");
  await click("#camp summary");
  await click("#code");
  await evaluate(`document.getElementById("code").select()`);
  await send("Input.insertText", {text: btoa(fixtureJson)});
  await click("#load");
  check(await stored() === null && await evaluate(`(() => { ${SHOWN} return shown(document.getElementById("code-preview")); })()`) === true,
    "Load opens the save preview and changes nothing until Replace");
  await click("#code-replace");
  check(await evaluate(`document.getElementById("code-note").textContent`) === "Loaded.", "FIXTURE loaded through the Save code box and Replace: the Camp says Loaded.");
  const loaded = await stored();
  check(loaded === fixtureJson, "saved progress after Load is exactly the fixture (v2, Trail done, 16-card deck, 4-card side deck)");

  await click('button[data-match="open"]');
  // The test's copy of game 1: the same seed and options the Camp uses for the Open range with the fixture deck.
  const solo = await playGame(createShowdown(SOLO_SEED, duelFor(fixture, "open", fixture.deck).options), {two: false});
  const winner1 = solo.state.result?.winner ?? null;
  const end1 = await view();
  const score1 = `you ${winner1 === "cowboy" ? 1 : 0}, Wizards ${winner1 === "wizard" ? 1 : 0}`;
  check(Boolean(solo.state.result), `REAL game 1 finished by clicks: ${winner1 ?? "draw"} after turn ${solo.state.turn} (${solo.actions.cowboy} Cowboy actions clicked, ${solo.compared} screen/model comparisons)`);
  check((end1.status ?? "").includes(`game 1 of 3 · ${score1}`) && /^You (win|lose)|^Draw/.test(end1.status ?? ""), `game 1 result and score on screen (${end1.status})`);
  check(end1.again === "Game 2", `the next control is "Game 2" (${end1.again})`);
  check(await stored() === loaded, "saved progress unchanged after game 1 (a match is settled only when it ends)");

  await click("#again");
  const b = await view();
  const counts = () => evaluate(`Object.fromEntries([...document.querySelectorAll("#builder-rows .build-row")].map((row) => {
    const pile = (zone) => Number(row.querySelector('[data-zone="' + zone + '"]').parentElement.querySelector("strong").textContent);
    return [row.querySelector("[data-type]").dataset.type, [pile("deck"), pile("side")]]; }))`);
  const shownCounts = await counts();
  const expected = Object.fromEntries([...new Set([...Object.keys(fixture.deck), ...Object.keys(fixture.side)])].map((type) => [type, [fixture.deck[type] ?? 0, fixture.side[type] ?? 0]]));
  check(b.screens.join() === "builder" && /swap with your side deck/.test(await evaluate(`document.getElementById("builder-title").textContent`)), `"Game 2" opens the between-games side-deck swap (${b.screens.join()})`);
  check(JSON.stringify(Object.entries(shownCounts).sort()) === JSON.stringify(Object.entries(expected).sort()), `swap screen lists exactly the fixture deck and side deck counts (${JSON.stringify(shownCounts)})`);
  check(await evaluate(`document.getElementById("builder-cancel").hidden`) === true, "no Cancel between games: the swap is part of the match");

  // KEYBOARD ONLY from here to the deal of game 2: Tab / Shift+Tab to each control, Enter to press it.
  const swapKeys = {...keys};
  const swapClicks = clicks.total;
  const entry = await focused();
  const firstStep = await evaluate(`(() => { const n = document.querySelector("#builder-rows button:not(:disabled)"); return n && {zone: n.dataset.zone, type: n.dataset.type, by: n.dataset.by}; })()`);
  check(Boolean(entry && firstStep) && entry.zone === firstStep.zone && entry.type === firstStep.type && entry.by === firstStep.by && entry.inBuilder,
    `the swap screen opens with focus on its first enabled step button (${JSON.stringify(entry)})`);
  const fullLegal = new RegExp(`Deck ${DECK_SIZE} of ${DECK_SIZE} · side deck ${SIDE_SIZE} of ${SIDE_SIZE}\\.$`);
  const saveDisabled = () => evaluate(`document.getElementById("builder-save").disabled`);

  // 1. Side deck -> deck by keyboard, then undo it with Enter on the button focus lands on.
  await tabTo(stepButton("deck", SWAP_IN, 1));
  await press("Enter");
  const tried = await view();
  const triedCounts = await counts();
  const triedFocus = await focused();
  check(/Deck 17 of 16 · side deck 3 of 4/.test(tried.problems ?? "") && await saveDisabled() === true && triedCounts[SWAP_IN].join() === `${expected[SWAP_IN][0] + 1},0`,
    `Enter on "One more in the deck: ${TYPES[SWAP_IN].name}" moves it in; 17 of 16 blocks the next game (${tried.problems})`);
  check(isFocus(triedFocus, "deck", SWAP_IN, -1), `side deck now empty of ${TYPES[SWAP_IN].name}: focus moves to its "One fewer in the deck" button with a focus ring (${JSON.stringify(triedFocus)})`);
  await press("Enter");
  const undone = await view();
  const undoneCounts = await counts();
  check(JSON.stringify(Object.entries(undoneCounts).sort()) === JSON.stringify(Object.entries(expected).sort()) && fullLegal.test(undone.problems ?? "") && await saveDisabled() === false,
    `Enter again reverses it: counts back to the fixture exactly, ${undone.problems}`);
  check((await focused())?.type === SWAP_IN && (await focused())?.inBuilder, `focus stays on a ${TYPES[SWAP_IN].name} step button after the undo (${JSON.stringify(await focused())})`);
  check(await stored() === loaded, "saved progress unchanged by the try-and-undo");

  // 2. The real swap: one card in, then one card out, both by keyboard.
  await tabTo(stepButton("deck", SWAP_IN, 1));
  await press("Enter");
  const mid = await view();
  check(/Deck 17 of 16 · side deck 3 of 4/.test(mid.problems ?? "") && await saveDisabled() === true,
    `one card in without one out: 17 of 16 blocks the next game (${mid.problems})`);
  await tabTo(stepButton("side", SWAP_OUT, 1));
  await press("Enter");
  const swapped = await view();
  const afterCounts = await counts();
  const outFocus = await focused();
  check(afterCounts[SWAP_IN].join() === `${swappedDeck[SWAP_IN]},0` && afterCounts[SWAP_OUT].join() === `${swappedDeck[SWAP_OUT]},1`
    && Object.keys(expected).filter((t) => t !== SWAP_IN && t !== SWAP_OUT).every((t) => afterCounts[t].join() === expected[t].join()),
    `${TYPES[SWAP_IN].name} moved side deck to deck, ${TYPES[SWAP_OUT].name} deck to side deck, every other row as loaded (${JSON.stringify(afterCounts)})`);
  check(isFocus(outFocus, "side", SWAP_OUT, swappedDeck[SWAP_OUT] > 0 ? 1 : -1), `focus stays on the ${TYPES[SWAP_OUT].name} side deck button just pressed (${JSON.stringify(outFocus)})`);
  check(fullLegal.test(swapped.problems ?? "") && await saveDisabled() === false, `legal swap: ${swapped.problems}; "Play the next game" enabled`);
  const during = JSON.parse(await stored());
  check(await stored() === loaded && canonical(during.deck) === canonical(fixture.deck) && canonical(during.side) === canonical(fixture.side),
    "saved progress unchanged by the swap: the Camp deck and side deck are still the fixture's (it lasts for this match only)");

  await tabTo("#builder-save");
  const saveFocus = await focused();
  check(saveFocus?.id === "builder-save" && saveFocus.ring && !saveFocus.disabled, `Tab reaches "Play the next game" with a focus ring (${JSON.stringify(saveFocus)})`);
  await press("Enter");
  const usedKeys = {tab: keys.tab - swapKeys.tab, shiftTab: keys.shiftTab - swapKeys.shiftTab, enter: keys.enter - swapKeys.enter};
  check(clicks.total === swapClicks && usedKeys.enter === 5, `the whole swap and the deal of game 2 used no mouse clicks: ${usedKeys.tab} Tab, ${usedKeys.shiftTab} Shift+Tab, ${usedKeys.enter} Enter`);
  const g2 = await view();
  const opener2 = winner1 ? (winner1 === "cowboy" ? "wizard" : "cowboy") : null;
  check(g2.screens.join() === "duel" && (g2.status ?? "").includes(`game 2 of 3 · ${score1}`), `game 2 dealt with the score carried over (${g2.status})`);
  if (opener2) check(g2.firstLog === `Turn 1: ${opener2 === "cowboy" ? "you" : "the Wizards"}`, `the loser of game 1 opens game 2 (${g2.firstLog})`);
  const [, inHand, inDeck] = (g2.cowboy?.counts ?? "").match(/Hand (\d+) · Deck (\d+)/) ?? [];
  const handTypes = g2.hand.reduce((all, id) => ({...all, [typeOf(id)]: (all[typeOf(id)] ?? 0) + 1}), {});
  check(Number(inHand) + Number(inDeck) === DECK_SIZE && Object.entries(handTypes).every(([type, n]) => n <= (swappedDeck[type] ?? 0)),
    `game 2 Cowboy cards: hand ${inHand} + deck ${inDeck} = ${DECK_SIZE}, every hand card fits the swapped deck (${g2.hand.join(",")})`);
  // Game 2 onward: the test's copy uses the next queued seed, the swapped deck and the loser of the last game opening.
  const wins = {cowboy: 0, wizard: 0};
  if (winner1) wins[winner1] += 1;
  const soloGames = [{seed: SOLO_SEED, winner: winner1, first: solo.state.first, turns: solo.state.turn, cowboyActionsClicked: solo.actions.cowboy, comparisons: solo.compared}];
  let last = solo.state;
  for (let n = 2; ; n++) {
    if (n > MAX_GAMES || n > SOLO_SEEDS.length) throw new Error(`series not over after ${n - 1} games (score you ${wins.cowboy}, Wizards ${wins.wizard}); steps: load fixture, Best of three, games on seeds ${SOLO_SEEDS.slice(0, n - 1).join(",")}; give --solo-seeds with ${MAX_GAMES} or fewer games that end it`);
    if (n > 2) {
      await click("#again");
      check((await view()).screens.join() === "builder", `"Game ${n}" opens the side-deck swap again`);
      await click("#builder-save");
    }
    const first = last.result.winner ? opponent(last.result.winner) : last.first;
    check(await stored() === loaded, `saved progress unchanged with game ${n} under way (active save is not touched mid-match)`);
    const g = await playGame(createShowdown(SOLO_SEEDS[n - 1], {...duelFor(fixture, "open", swappedDeck).options, first}), {two: false});
    last = g.state;
    const w = g.state.result?.winner ?? null;
    if (w) wins[w] += 1;
    const end = await view();
    soloGames.push({seed: SOLO_SEEDS[n - 1], winner: w, first: g.state.first, turns: g.state.turn, cowboyActionsClicked: g.actions.cowboy, comparisons: g.compared});
    check(Boolean(g.state.result) && g.state.first === first, `REAL game ${n} (SYNTHETIC seed ${SOLO_SEEDS[n - 1]}, ${first} first) finished by clicks: ${w ?? "draw"} after turn ${g.state.turn} (${g.actions.cowboy} Cowboy actions clicked, ${g.compared} screen/model comparisons)`);
    check((end.status ?? "").includes(`game ${n} of 3 · you ${wins.cowboy}, Wizards ${wins.wizard}`), `game ${n} result and score on screen (${end.status})`);
    if (Math.max(wins.cowboy, wins.wizard) < 2) {
      check(end.again === `Game ${n + 1}` && await stored() === loaded, `no winner yet: next control "Game ${n + 1}" and no settlement (${end.again})`);
      continue;
    }
    const after = await stored();
    if (wins.cowboy < 2) throw new Error(`the Wizards won the series ${wins.wizard}-${wins.cowboy}: an Open range loss leaves the save unchanged, so one settlement is not observable; choose --solo-seeds where the Cowboys win`);
    check(canonical(JSON.parse(after)) === canonical(settledOnce) && JSON.parse(after).openWins === fixture.openWins + 1 && JSON.parse(after).rolls === fixture.rolls + 1,
      `series won ${wins.cowboy}-${wins.wizard}: saved progress is exactly one Open range settlement of the fixture (openWins ${fixture.openWins}→${JSON.parse(after).openWins}, rolls ${fixture.rolls}→${JSON.parse(after).rolls}, offer ${JSON.parse(after).offer})`);
    const reward = await evaluate(`document.getElementById("reward").textContent`);
    check(/^You win/.test(end.status ?? "") && end.again === "Play it again" && (!settledOnce.offer || reward.includes("Choose a card")), `series result on screen: ${end.status}; "${end.again}"; card offer shown`);
    break;
  }
  await click("#leave");
  const camp = await view();
  const collection = await evaluate(`document.getElementById("collection").textContent`);
  check(camp.screens.join() === "camp" && collection.includes(`${TYPES[SWAP_OUT].name} ×${fixture.deck[SWAP_OUT]}`) && canonical(JSON.parse(await stored())) === canonical(settledOnce),
    "Back to camp after the series: Camp shows the saved deck, not the match swap, and still exactly one settlement");
  const campSave = JSON.parse(await stored());
  check(canonical(campSave.deck) === canonical(fixture.deck) && canonical(campSave.side) === canonical(fixture.side),
    `no Camp deck mutation: saved deck and side deck after the series are the fixture's (${TYPES[SWAP_OUT].name} ×${campSave.deck[SWAP_OUT]}, ${TYPES[SWAP_IN].name} deck ×${campSave.deck[SWAP_IN] ?? 0} side ×${campSave.side[SWAP_IN] ?? 0})`);
  const settledJson = await stored();
  summary.solo = {seeds: SOLO_SEEDS, score: wins, games: soloGames, swap: {in: SWAP_IN, out: SWAP_OUT, input: "keyboard", keys: usedKeys, undoChecked: true}, settled: {openWins: settledOnce.openWins, rolls: settledOnce.rolls, offer: settledOnce.offer},
    game2Opening: {status: g2.status, firstLog: g2.firstLog, hand: g2.hand}, seedFixture: "SYNTHETIC: later deal seeds via Page.addScriptToEvaluateOnNewDocument Math.random queue"};

  // ---- Two players, best of three ------------------------------------------------------------------------------------
  current = "two-player";
  await queueSeeds(TWO_SEEDS.slice(1));
  await send("Page.navigate", {url: `${pageUrl}?seed=${TWO_SEED}`});
  await sleep(700);
  check(await stored() === settledJson, "reload: saved progress is still the solo-settled save");
  await click('button[data-two="3"]');
  const two = await playGame(createShowdown(TWO_SEED, {decks: DECKS}), {two: true});
  const winner2 = two.state.result?.winner ?? null;
  const end2 = await view();
  const score2 = `Cowboys ${winner2 === "cowboy" ? 1 : 0}, Wizards ${winner2 === "wizard" ? 1 : 0}`;
  check(Boolean(two.state.result), `REAL two-player game 1 finished by clicks: ${winner2 ?? "draw"} after turn ${two.state.turn} (${two.actions.cowboy} Cowboy + ${two.actions.wizard} Wizard actions clicked, ${two.compared} screen/model comparisons)`);
  check((end2.status ?? "").includes(`game 1 of 3 · ${score2}`), `game 1 result and score on screen (${end2.status})`);
  check(end2.again === "Game 2", `the next control is "Game 2" (${end2.again})`);
  await click("#again");
  const c2 = await view();
  const opener = winner2 ? (winner2 === "cowboy" ? "Wizard" : "Cowboy") : null;
  check(c2.screens.join() === "curtain" && (!opener || (c2.curtain ?? "").includes(`${opener} player`)), `game 2 starts behind the curtain${opener ? `, for the ${opener} player who lost game 1` : ""} (${c2.curtain})`);
  await click("#ready");
  const d2 = await view();
  check((d2.status ?? "").includes(`game 2 of 3 · ${score2} · turn 1`), `game 2 dealt with the score carried over (${d2.status})`);
  check(d2.hand.length > 0 && d2.hand.every((id) => TYPES[typeOf(id)].side === (opener ?? "Cowboy").toLowerCase()), `game 2 hand belongs to the side to move (${d2.hand.join(",")})`);
  const twoWins = {cowboy: 0, wizard: 0};
  if (winner2) twoWins[winner2] += 1;
  const twoGames = [{seed: TWO_SEED, winner: winner2, first: two.state.first, turns: two.state.turn, actionsClicked: two.actions, comparisons: two.compared}];
  let lastTwo = two.state;
  for (let n = 2; ; n++) {
    if (n > MAX_GAMES || n > TWO_SEEDS.length) throw new Error(`two-player series not over after ${n - 1} games (Cowboys ${twoWins.cowboy}, Wizards ${twoWins.wizard}); steps: Two players best of three, games on seeds ${TWO_SEEDS.slice(0, n - 1).join(",")}; give --two-seeds that end it in ${MAX_GAMES} or fewer`);
    if (n > 2) await click("#again"); // playGame clicks through the curtain
    const first = lastTwo.result.winner ? opponent(lastTwo.result.winner) : lastTwo.first;
    const g = await playGame(createShowdown(TWO_SEEDS[n - 1], {decks: DECKS, first}), {two: true});
    lastTwo = g.state;
    const w = g.state.result?.winner ?? null;
    if (w) twoWins[w] += 1;
    const end = await view();
    twoGames.push({seed: TWO_SEEDS[n - 1], winner: w, first: g.state.first, turns: g.state.turn, actionsClicked: g.actions, comparisons: g.compared});
    check(Boolean(g.state.result) && g.state.first === first, `REAL two-player game ${n} (SYNTHETIC seed ${TWO_SEEDS[n - 1]}, ${first} first) finished by clicks: ${w ?? "draw"} after turn ${g.state.turn} (${g.actions.cowboy} Cowboy + ${g.actions.wizard} Wizard actions clicked, ${g.compared} screen/model comparisons)`);
    check((end.status ?? "").includes(`game ${n} of 3 · Cowboys ${twoWins.cowboy}, Wizards ${twoWins.wizard}`), `game ${n} result and score on screen (${end.status})`);
    if (Math.max(twoWins.cowboy, twoWins.wizard) < 2) { check(end.again === `Game ${n + 1}`, `no winner yet: next control "Game ${n + 1}" (${end.again})`); continue; }
    check(end.again === "Play again", `series over ${twoWins.cowboy}-${twoWins.wizard}: the next control is "Play again" (${end.again})`);
    break;
  }
  check(await stored() === settledJson, "saved progress unchanged by the whole two-player series (no Camp progression)");
  summary.two = {seeds: TWO_SEEDS, score: twoWins, games: twoGames, game2Opening: {status: d2.status, curtain: c2.curtain}};

  current = "page";
  check(pageErrors.length === 0, `no page errors or network requests (${pageErrors.join(" | ") || "none"})`);
} catch (error) {
  failures.push(`${current}: ${error.message}`); results.push({route: current, ok: false, message: error.message}); console.log(`FAIL [${current}] ${error.message}`);
} finally {
  code = failures.length ? 1 : 0;
  const sha = async (file) => createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
  const files = ["dist/showdown.html", "prototypes/showdown/bo3-browser-check.mjs", "prototypes/showdown/main.js", "prototypes/showdown/rules.js", "prototypes/showdown/progress.js", "prototypes/showdown/cards.js"];
  const head = await new Promise((resolve) => { const g = spawn("git", ["rev-parse", "HEAD"], {cwd: root}); let out = ""; g.stdout.on("data", (c) => { out += c; }); g.on("close", () => resolve(out.trim())); });
  const receipt = {check: "showdown best-of-three Chrome check", result: code ? "fail" : "pass", passed: results.filter((r) => r.ok).length, failed: failures.length,
    command: `node prototypes/showdown/bo3-browser-check.mjs --solo-seeds ${SOLO_SEEDS.join(",")} --two-seeds ${TWO_SEEDS.join(",")}`, head, finishedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 100) / 10,
    chrome: (await send("Browser.getVersion").catch(() => ({}))).product ?? null, clicks: clicks.total,
    seedFixture: {kind: "SYNTHETIC test-only Math.random queue via Chrome Page.addScriptToEvaluateOnNewDocument; feeds only main.js freshSeed after the ?seed= deal", solo: SOLO_SEEDS, two: TWO_SEEDS},
    fixture: {kind: "test-only saved Camp progress built with progress.js and loaded through the Save code box", sha256: createHash("sha256").update(fixtureJson).digest("hex"), deck: fixture.deck, side: fixture.side},
    summary, sha256: Object.fromEntries(await Promise.all(files.map(async (f) => [f, await sha(f).catch(() => null)]))), results};
  await mkdir(path.dirname(RECEIPT), {recursive: true});
  await writeFile(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(code ? `${failures.length} check(s) failed` : `best of three passed: ${receipt.passed} checks, ${clicks.total} clicks, ${receipt.seconds} s (solo series ${SOLO_SEEDS.join(",")} ${summary.solo?.score.cowboy}-${summary.solo?.score.wizard}, two-player series ${TWO_SEEDS.join(",")} ${summary.two?.score.cowboy}-${summary.two?.score.wizard})`);
  console.log(`receipt ${path.relative(root, RECEIPT)}`);
  ws.close(); child.kill("SIGTERM"); await sleep(300); child.kill("SIGKILL");
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
  clearTimeout(deadline);
  process.exit(code);
}
