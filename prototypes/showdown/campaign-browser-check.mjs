// Real-Chrome check of a Showdown campaign route through the actual Camp (dist/showdown.html).
// Developer tool; no product code is changed. Drives only visible, enabled buttons with CDP mouse
// presses and types the save code with CDP keyboard input. Reads the DOM and localStorage; the page
// gets no test hook.
//
//   node prototypes/showdown/build.mjs
//   node prototypes/showdown/campaign-browser-check.mjs [--seed 0] [--rival-seed 1] [--hunt-seed 2]
//        [--out .artifacts/kiro/judge-proof/campaign-browser-receipt.json] [--shots DIR] [--frames DIR] [--pace-ms N]
//
// --shots DIR also saves six viewport PNGs of the fresh-profile route (phases A to C, no fixture) and lists them
// in the receipt with their SHA-256, size, the screen and status on show, and whether each named element was fully
// in the 1280x900 viewport. Capturing only scrolls the page; it presses nothing and changes no check.
// --frames DIR records Chrome's own screencast (Page.startScreencast, JPEG) from the fresh Camp through phase C and
// stops before the phase D fixture loads. Each frame is listed in the receipt with Chrome's timestamp and SHA-256.
// --pace-ms N waits a fixed N ms after each clicked action and each phase A-C still, so the frames read at viewing
// speed. The wait is the same for every move; the bot still picks every move. Both default off.
// --full-trail (opt-in, off by default) adds phase T between C and D: the same fresh profile plays Trail duels 2 to 6
// in the Camp on the winning seeds of campaign-trail.test.js (read from its SEEDS line; Boot Hill then also uses
// SEEDS[0]), takes each reward and first offer with the page's buttons, reloads before every duel and checks the
// Camp and save, and ends with the Stargazer open, the Imp locked and the Trail's pack waiting, all with no
// imported progress. The Stargazer then deals the mirror's hand and is left unplayed. Phases D to F follow as usual.
// Default receipt: .artifacts/kiro/judge-proof/campaign-full-trail-receipt.json; time limit FULL_TRAIL_SECONDS.
//
// One headless Chrome, its own temporary profile, a loopback server on an OS-assigned port:
//   A. Fresh Camp, ?seed=N: no save, Boot Hill is the only open duel. Click it.
//   B. Play Boot Hill to a win. After every action the board, hand, Bases, traps and graveyards on
//      screen must equal a Node mirror (rules.js + progress.js via campaign-driver.mjs).
//   C. Reward: Covered Wagon ×2 in the collection, the two offered cards equal progress.js settle().
//      Choose the first offer, press Continue, check the Camp and the saved progress. Reload: the Camp
//      and save are unchanged, Raven Roost opens with the mirror's deal for ?seed=N, Back to camp.
//   D. NAMED MIGRATED FIXTURE "v1-trail-done": the first-version save {"wins":6,"losses":0} as a save
//      code, typed into the Camp's Save code box, previewed with its Load button and confirmed with Replace my progress. progress.js migrate()
//      gives the expected v2 save. Rivals and bounties open.
//   E. Start the Stargazer (first rival) on ?seed=R, win it, take the offer, back to Camp, open the
//      earned pack with the Camp's own button and compare the three cards with progress.js openPack().
//      The Imp unlocks. Reload: unchanged.
//   F. Start the Lantern Wraith bounty on ?seed=H: hunt 1 of 5, the mirror's deal with the Wraith on
//      the board. Back to camp leaves the save byte-for-byte unchanged.
// Moves come from rules.js planTurn on a public projection of the Cowboy's view (campaign-driver.mjs).
// This is a bot driving the browser. It is not a human playtest.
import {spawn, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {cardOf, TYPES} from "./cards.js";
import {BOUNTIES, HUNTS, RIVALS, choose, duelFor, duelList, migrate, newSave, openPack, settle, trailDone} from "./progress.js";
import {TRAIL, deckAfter} from "./trail.js";
import {mirrorDuel, pickMove} from "./campaign-driver.mjs";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../../", import.meta.url));
const SAVE = "cvw-showdown-save-v2"; // the key main.js writes; a change there must fail this check
const FIXTURE = {name: "v1-trail-done", raw: {wins: 6, losses: 0}};
const RUN_SECONDS = 180;
const FULL_TRAIL_SECONDS = 900;
const MAX_ACTIONS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pays = (cards) => cards.map(([type, copies]) => `${TYPES[type].name}${copies > 1 ? ` ×${copies}` : ""}`).join(", ");

// The full-Trail seeds are the ones campaign-trail.test.js proves in Node, read from its source so the two cannot drift.
async function trailSeeds() {
  const text = await readFile(new URL("./campaign-trail.test.js", import.meta.url), "utf8");
  const m = text.match(/^const SEEDS = (\[[\d,\s]*\]);/m);
  const seeds = m && JSON.parse(m[1]);
  if (!seeds || seeds.length !== TRAIL.length) throw new Error("campaign-trail.test.js: no SEEDS line with one seed per Trail duel");
  return seeds;
}

function parseArgs(argv) {
  const known = new Set(["--html", "--seed", "--rival-seed", "--hunt-seed", "--out", "--shots", "--frames", "--pace-ms"]);
  const flags = new Set(["--full-trail"]);
  for (let i = 0; i < argv.length; i++) {
    if (flags.has(argv[i])) continue;
    if (!known.has(argv[i]) || argv[i + 1] === undefined) throw new Error(`bad argument ${argv[i]}`);
    i++;
  }
  const opt = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
  const int = (name, fallback) => { const v = opt(name, String(fallback)); if (!/^\d+$/.test(v)) throw new Error(`${name}: not a seed: ${v}`); return Number(v); };
  const fullTrail = argv.includes("--full-trail");
  return {
    html: path.resolve(root, opt("--html", "dist/showdown.html")), fullTrail, seedGiven: argv.includes("--seed"),
    seed: int("--seed", 0), rivalSeed: int("--rival-seed", 1), huntSeed: int("--hunt-seed", 2),
    out: path.resolve(root, opt("--out", `.artifacts/kiro/judge-proof/${fullTrail ? "campaign-full-trail-receipt" : "campaign-browser-receipt"}.json`)),
    shots: opt("--shots", null) && path.resolve(root, opt("--shots", null)),
    frames: opt("--frames", null) && path.resolve(root, opt("--frames", null)),
    paceMs: int("--pace-ms", 0),
  };
}

// ---- What the page must show, from progress.js and rules.js -----------------------------------

// The duel screen for a mirror state, as main.js renderDuel() writes it in a solo duel.
function expectedView(state, duel) {
  const side = (name) => {
    const s = state.sides[name];
    return {
      base: `${s.base} of ${Math.max(s.base, s.baseMax)} orbs`,
      counts: `Hand ${s.hand.length} · Deck ${s.deck.length} · Graveyard ${s.discard.length}`,
      traps: name === "cowboy"
        ? `▲ ${s.traps.length ? `Set: ${s.traps.map((id) => cardOf(id).name).join(", ")}` : "No trap set"}`
        : `▲ ${s.traps.length ? `${plural(s.traps.length, "card")} face down` : "Nothing face down"}`,
      slots: s.board.map((t) => (t ? {name: cardOf(t.cardId).name, orbs: `${t.health} of ${Math.max(t.health, cardOf(t.cardId).health)} orbs`} : null)),
      graveyard: s.discard.map((id) => cardOf(id).name).join(", ") || "empty",
    };
  };
  const r = state.result;
  return {
    status: r ? (r.winner === "cowboy" ? "You win: the Wizard Base fell." : r.winner === "wizard" ? "You lose: your Base fell." : "Draw.")
      : `${duel.name} · turn ${state.turn} · your turn`,
    hand: state.sides.cowboy.hand.map((id) => cardOf(id).name),
    wizard: side("wizard"), cowboy: side("cowboy"),
  };
}

// The Camp tiles main.js renderCamp() writes for a save: {list: [{cls, off, title, note}]} per ladder.
function expectedCamp(save) {
  const list = duelList(save);
  const tile = (duel, note, off = duel.state !== "open") => ({cls: `tile ${duel.state}`, off, title: `${duel.state === "won" ? "✓ " : ""}${duel.name}`, note});
  return {
    trail: list.filter((d) => d.kind === "trail").map((d) => {
      const reward = pays(TRAIL[d.index].reward.map(([type, , copies]) => [type, copies]));
      return tile(d, d.state === "won" ? `Earned ${reward}` : `Win to earn ${reward}`);
    }),
    rivals: list.filter((d) => d.kind === "rival").map((d, i) => {
      const rival = RIVALS[i];
      const reward = [pays(rival.reward.map((type) => [type, 1])), plural(rival.packs, "pack")].filter(Boolean).join(" and ");
      return tile(d, d.state === "won" ? "Beaten. Rematch for a card." : d.state === "locked" ? (trailDone(save) ? "Beat the rival before" : "After the Trail") : `Win to earn ${reward}`, d.state === "locked");
    }),
    bounties: list.filter((d) => d.kind === "hunt").map((d) => {
      const bounty = BOUNTIES.find((each) => `hunt:${each.id}` === d.id);
      return tile(d, d.state === "won" ? `Captured: ${TYPES[bounty.reward].name}` : d.state === "locked" ? "After the Trail"
        : `${d.cleared} of ${HUNTS} hunts won. Five capture ${TYPES[bounty.reward].name}.`);
    }),
    openRange: trailDone(save),
  };
}

// ---- Loopback server and Chrome over CDP ------------------------------------------------------

async function serve(htmlBytes) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method !== "GET") return res.writeHead(405).end();
    if (url.pathname === "/showdown.html") return res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}).end(htmlBytes);
    if (url.pathname === "/blank.html") return res.writeHead(200, {"content-type": "text/html"}).end("<!doctype html><title>blank</title>");
    res.writeHead(404).end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok))};
}

async function launch() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "showdown-campaign-check-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--disable-sync", "--disable-extensions", "--disable-background-networking",
    "--disable-component-update", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--mute-audio",
    "--window-size=1280,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}`)); });
  });
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
  const waiting = new Map(); const listeners = new Set(); let next = 0; const errors = [], remote = [], dialogs = [];
  let send;
  ws.addEventListener("message", ({data}) => {
    const m = JSON.parse(data);
    if (m.id === undefined) {
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
      if (m.method === "Network.requestWillBeSent" && !/^(http:\/\/127\.0\.0\.1[:/]|data:|about:)/.test(m.params.request.url)) remote.push(m.params.request.url);
      // Any confirm/alert is recorded and dismissed, so an unexpected prompt fails the run instead of hanging it.
      if (m.method === "Page.javascriptDialogOpening") { dialogs.push({type: m.params.type, message: m.params.message}); send("Page.handleJavaScriptDialog", {accept: false}); }
      listeners.forEach((l) => l(m));
      return;
    }
    const e = waiting.get(m.id); waiting.delete(m.id);
    if (m.error) e?.reject(new Error(`${e.method}: ${m.error.message}`)); else e?.resolve(m.result);
  });
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++next; waiting.set(id, {resolve, reject, method}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const {product} = await raw("Browser.getVersion");
  const {targetInfos} = await raw("Target.getTargets");
  const {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
  send = (method, params) => raw(method, params, sessionId);
  const once = (method) => new Promise((resolve) => { const l = (m) => { if (m.method === method && m.sessionId === sessionId) { listeners.delete(l); resolve(m.params); } }; listeners.add(l); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  const on = (fn) => { const l = (m) => { if (m.sessionId === sessionId) fn(m); }; listeners.add(l); return () => listeners.delete(l); };
  return {send, once, on, errors, remote, dialogs, product, async close() {
    ws.close(); child.kill("SIGTERM"); await sleep(400); if (child.exitCode === null) child.kill("SIGKILL");
    await rm(profile, {recursive: true, force: true, maxRetries: 5});
  }};
}

// Read-only DOM read: only what the page shows (text, aria labels, classes, disabled state) and the saved value.
const READ = `JSON.stringify((() => {
  const el = (id) => document.getElementById(id);
  const side = (div) => {
    if (!div) return null;
    const base = div.querySelector("button.base");
    return {
      base: base.querySelector(".orbs").getAttribute("aria-label"),
      counts: base.querySelectorAll(".note")[0].textContent,
      traps: base.querySelectorAll(".note")[1].textContent,
      slots: [...div.querySelectorAll("button.slot")].map((b) => b.querySelector("strong")
        ? {name: b.querySelector("strong").textContent, orbs: b.querySelector(".orbs").getAttribute("aria-label")} : null),
    };
  };
  const tiles = (id) => [...el(id).children].map((li) => { const b = li.querySelector("button");
    return {cls: b.className, off: b.disabled, title: b.querySelector("strong").textContent, note: b.querySelector(".note").textContent}; });
  const sides = [...el("board").querySelectorAll(".side")];
  const visible = ["camp", "builder", "duel", "curtain"].filter((id) => !el(id).hidden);
  return {
    visible, status: el("status").textContent, lesson: el("lesson").textContent, again: el("again").textContent,
    reward: el("reward").innerText.replace(/\\s+/g, " ").trim(),
    offer: [...el("reward").querySelectorAll("button[data-choose]")].map((b) => b.dataset.choose),
    hand: [...el("hand").querySelectorAll("button.card")].map((b) => b.querySelector("strong").textContent),
    wizard: sides.length ? {...side(sides[0]), graveyard: el("wizard-graveyard").textContent} : null,
    cowboy: sides.length ? {...side(sides[1]), graveyard: el("cowboy-graveyard").textContent} : null,
    camp: {trail: tiles("trail"), rivals: tiles("rivals"), bounties: tiles("bounties"),
      openRange: !el("open").querySelector('button[data-duel="open"]').disabled},
    claim: el("claim").innerText.replace(/\\s+/g, " ").trim(),
    packCards: [...el("claim").querySelectorAll(".card")].map((c) => c.querySelector("strong").textContent),
    collection: el("collection").textContent.replace(/\\s+/g, " ").trim(),
    code: el("code").value, codeNote: el("code-note").textContent,
    preview: !el("code-preview").hidden, previewText: el("code-preview-text").textContent,
    saved: (() => { try { return localStorage.getItem(${JSON.stringify(SAVE)}); } catch { return "storage blocked"; } })(),
  };
})())`;

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const seeds = cfg.fullTrail ? await trailSeeds() : null;
  if (seeds) {
    if (cfg.seedGiven && cfg.seed !== seeds[0]) throw new Error(`--full-trail plays Boot Hill on campaign-trail.test.js SEEDS[0] = ${seeds[0]}; drop --seed ${cfg.seed}`);
    cfg.seed = seeds[0];
  }
  const limit = cfg.fullTrail ? FULL_TRAIL_SECONDS : RUN_SECONDS;
  const started = new Date();
  const htmlBytes = await readFile(cfg.html);
  const htmlSha256 = createHash("sha256").update(htmlBytes).digest("hex");
  const git = (...a) => spawnSync("git", a, {cwd: root, encoding: "utf8"}).stdout.trim();
  const server = await serve(htmlBytes);
  const chrome = await launch();
  const {send} = chrome;
  const deadline = Date.now() + limit * 1000;
  const checks = [];
  const actions = [];
  const check = (phase, name, pass, detail) => { checks.push({phase, name, pass: Boolean(pass), ...(pass ? {} : {detail})}); return pass; };
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const read = async () => JSON.parse(await evaluate(READ));
  const load = async (url) => { const loaded = chrome.once("Page.loadEventFired"); await send("Page.navigate", {url}); await loaded; };
  const reload = async () => { const loaded = chrome.once("Page.loadEventFired"); await send("Page.reload", {ignoreCache: true}); await loaded; };
  const pageUrl = (seed) => `${server.origin}/showdown.html?seed=${seed}`;
  // A real mouse press at the centre of a visible, enabled element that is the top element there.
  const click = async (selector) => {
    const box = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)});
      if (!b || b.disabled || b.closest("[hidden]")) return null; b.scrollIntoView({block: "center"}); const r = b.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const x = r.left + r.width / 2, y = r.top + r.height / 2; return b.contains(document.elementFromPoint(x, y)) ? {x, y} : null; })()`);
    if (!box) throw new Error(`${selector} is missing, disabled, hidden or covered`);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {type, x: box.x, y: box.y, ...(type === "mouseMoved" ? {} : {button: "left", clickCount: 1})});
    }
  };
  // Optional demo stills: scroll the anchor to the top of the viewport, read the page, capture the viewport.
  const shots = [];
  const shot = async (name, phase, anchor, mustSee) => {
    if (!cfg.shots) return;
    const boxes = await evaluate(`(() => { const a = document.querySelector(${JSON.stringify(anchor)});
      if (a) a.scrollIntoView({block: "start"});
      return Object.fromEntries(${JSON.stringify(mustSee)}.map((s) => { const e = document.querySelector(s);
        if (!e || e.closest("[hidden]")) return [s, false]; const r = e.getBoundingClientRect();
        return [s, r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth]; })); })()`);
    const dom = await read();
    const {data} = await send("Page.captureScreenshot", {format: "png"});
    const png = Buffer.from(data, "base64");
    const file = `${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
    await mkdir(cfg.shots, {recursive: true});
    await writeFile(path.join(cfg.shots, file), png);
    shots.push({file, name, phase, fixture: "none: fresh profile, newSave()", anchor, inView: boxes,
      width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length,
      sha256: createHash("sha256").update(png).digest("hex"), atSeconds: Math.round((Date.now() - started) / 100) / 10,
      visible: dom.visible, status: dom.visible.includes("duel") ? dom.status : null, again: dom.visible.includes("duel") ? dom.again : null,
      openTrail: dom.camp.trail.filter((t) => !t.off).map((t) => t.title)});
  };
  const pace = () => (cfg.paceMs ? sleep(cfg.paceMs) : null);
  // Optional screencast of phases A to C: Chrome's own frames with Chrome's timestamps, acknowledged one by one.
  const frames = [];
  let stopFrames = null;
  const startFrames = async () => {
    if (!cfg.frames) return;
    await mkdir(cfg.frames, {recursive: true});
    const writes = [];
    const off = chrome.on((m) => {
      if (m.method !== "Page.screencastFrame") return;
      const {data, metadata, sessionId: frameSession} = m.params;
      send("Page.screencastFrameAck", {sessionId: frameSession}).catch(() => {});
      const jpg = Buffer.from(data, "base64");
      const file = `frame-${String(frames.length + 1).padStart(5, "0")}.jpg`;
      frames.push({file, timestamp: metadata.timestamp, bytes: jpg.length, sha256: createHash("sha256").update(jpg).digest("hex")});
      writes.push(writeFile(path.join(cfg.frames, file), jpg));
    });
    await send("Page.startScreencast", {format: "jpeg", quality: 90, maxWidth: 1280, maxHeight: 900, everyNthFrame: 1});
    stopFrames = async () => {
      await send("Page.stopScreencast"); off(); await Promise.all(writes);
      stopFrames = null; return Date.now() / 1000;
    };
  };
  let framesEnd = null;
  const viewOf = (dom) => ({status: dom.status, hand: dom.hand, wizard: dom.wizard, cowboy: dom.cowboy});
  const until = async (test, ms = 5000) => {
    let dom;
    for (const stop = Date.now() + ms; Date.now() < stop; await sleep(20)) { dom = await read(); if (test(dom)) return dom; }
    return dom;
  };
  const settleView = (want) => until((dom) => same(viewOf(dom), want));
  // The Save code box is rewritten only when the Camp renders, so it is compared on the Camp screen only.
  const savedIs = (phase, dom, save, what) => {
    const camp = dom.visible.join() === "camp";
    return check(phase, `${what}: localStorage${camp ? " and the Save code box hold" : " holds"} the expected progress.js save`,
      dom.saved === JSON.stringify(save) && (!camp || dom.code === Buffer.from(JSON.stringify(save), "latin1").toString("base64")), {saved: dom.saved, want: JSON.stringify(save), code: dom.code});
  };
  const campIs = (phase, dom, save, what) => check(phase, `${what}: Camp tiles and Open range match duelList()`,
    dom.visible.join() === "camp" && same(dom.camp, expectedCamp(save)), {visible: dom.visible, page: dom.camp, want: expectedCamp(save)});

  // Clicks that perform one rules.js action the way a player would, on the page's own buttons.
  const perform = async (action) => {
    if (action.type === "end") return click("#end");
    if (action.type === "attack") { await click(`#board button[data-own="${action.slot}"]`); return click(`#board button[data-enemy="${action.target}"]`); }
    if (action.type === "cover") { await click(`#board button[data-own="${action.slot}"]`); return click("#cover"); }
    await click(`#hand button[data-card="${action.cardId}"]`);
    if (action.type === "summon") for (const slot of action.tributes) await click(`#board button[data-own="${slot}"]`);
    if (action.type === "gear") await click(`#board button[data-own="${action.slot}"]`);
    if (action.type === "spell" && action.target !== undefined) await click(`#board button[data-enemy="${action.target}"]`);
  };
  // Plays the open duel to its end; every step compared with the mirror.
  const playOut = async (phase, mirror) => {
    let dom = await settleView(expectedView(mirror.state, mirror.duel));
    check(phase, `${mirror.duel.name}: deal on screen equals the mirror deal`, same(viewOf(dom), expectedView(mirror.state, mirror.duel)), {page: viewOf(dom), mirror: expectedView(mirror.state, mirror.duel)});
    let mismatches = 0, steps = 0;
    while (!mirror.state.result) {
      if (++steps > MAX_ACTIONS || Date.now() > deadline) throw new Error(`${phase}: no result after ${steps} actions or over ${limit} s`);
      const action = pickMove(mirror.state);
      await perform(action);
      mirror.act(action);
      if (phase <= "C") await pace();
      actions.push({phase, turn: mirror.state.turn, ...action});
      const want = expectedView(mirror.state, mirror.duel);
      dom = await settleView(want);
      if (!same(viewOf(dom), want)) { mismatches++; check(phase, `after action ${steps} (${JSON.stringify(action)})`, false, {page: viewOf(dom), mirror: want}); }
    }
    check(phase, `${mirror.duel.name}: page matched the mirror after all ${steps} actions`, mismatches === 0, {mismatches});
    return {dom, steps, turns: mirror.state.turn, winner: mirror.state.result.winner};
  };

  const runs = {};
  let failure = null;
  try {
    // No test hook: the page adds no window globals beyond a blank page on the same origin.
    await load(`${server.origin}/blank.html`);
    const baseline = await evaluate("Object.getOwnPropertyNames(window)");
    check("A", "fresh profile has no saved Showdown progress", (await evaluate(`localStorage.getItem(${JSON.stringify(SAVE)}) === null && localStorage.length === 0`)) === true);

    // A. Fresh Camp.
    await load(pageUrl(cfg.seed));
    await startFrames();
    const globals = (await evaluate("Object.getOwnPropertyNames(window)")).filter((n) => !baseline.includes(n));
    check("A", "page adds no window globals (no hidden-state test hook)", globals.length === 0, {globals});
    let save = newSave();
    let dom = await read();
    campIs("A", dom, save, "fresh Camp");
    check("A", "fresh Camp: Boot Hill is the only enabled ladder tile", [...dom.camp.trail, ...dom.camp.rivals, ...dom.camp.bounties].filter((t) => !t.off).map((t) => t.title).join() === "Boot Hill");
    check("A", "fresh Camp: nothing to claim", dom.claim === "", {claim: dom.claim});
    await shot("fresh-camp", "A", "h1", ["#trail", "#rivals"]);
    await pace();
    await click('#trail button[data-duel="trail"]');

    // B. Boot Hill to a win.
    let mirror = mirrorDuel(save, "trail", cfg.seed);
    dom = await settleView(expectedView(mirror.state, mirror.duel));
    check("B", "Boot Hill opens on turn 1 with the authored lesson", dom.visible.join() === "duel" && dom.status === "Boot Hill · turn 1 · your turn" && dom.lesson === TRAIL[0].lesson, {status: dom.status, lesson: dom.lesson});
    await shot("boot-hill-deal", "B", "#status", ["#status", "#board"]);
    await pace();
    const boot = await playOut("B", mirror);
    runs.bootHill = {seed: cfg.seed, save: "fresh newSave()", actions: boot.steps, turns: boot.turns, winner: boot.winner};
    if (!check("B", "Boot Hill won by the Cowboys", boot.winner === "cowboy", {winner: boot.winner})) throw new Error("Boot Hill was not won; try another --seed");

    // C. Reward, offer, Continue, reload, next step.
    const bootSettled = settle(save, "trail", true);
    save = bootSettled.save;
    dom = boot.dom;
    check("C", "settle() pays Covered Wagon ×2 and no pack", same(bootSettled.earned, {cards: [["cowboy-covered-wagon", 2]], packs: 0, captured: null}), bootSettled.earned);
    check("C", "reward panel shows Covered Wagon ×2 under New in your collection", /^New in your collection Covered Wagon .* ×2 Choose a card /.test(dom.reward), {reward: dom.reward});
    check("C", "the two offered cards equal settle()'s offer", same(dom.offer, save.offer), {page: dom.offer, want: save.offer});
    savedIs("C", dom, save, "after the win, before the choice");
    await shot("boot-hill-win-reward", "C", "#status", ["#status", "#reward"]);
    await pace();
    const bootPick = save.offer[0];
    await click(`#reward button[data-choose="${bootPick}"]`);
    save = choose(save, bootPick);
    dom = await until((d) => d.offer.length === 0);
    check("C", `choosing ${TYPES[bootPick].name} clears the offer`, dom.offer.length === 0 && !dom.reward.includes("Choose a card"), {reward: dom.reward});
    savedIs("C", dom, save, `after choosing ${TYPES[bootPick].name}`);
    check("C", "next-step button reads Continue", dom.again === "Continue", {again: dom.again});
    await shot("reward-claimed", "C", "#status", ["#status", "#reward", "#again"]);
    await pace();
    await click("#again");
    dom = await until((d) => d.visible.join() === "camp");
    campIs("C", dom, save, "Camp after Continue");
    check("C", "Camp after Continue: Raven Roost is the open Trail duel", dom.camp.trail[1].cls === "tile open" && !dom.camp.trail[1].off && dom.camp.trail[0].title === "✓ Boot Hill");
    await shot("camp-raven-roost-open", "C", "h1", ["#trail", "#collection"]);
    await pace();
    await reload();
    dom = await read();
    campIs("C", dom, save, "Camp after reload");
    savedIs("C", dom, save, "after reload");
    await click('#trail button[data-duel="trail"]');
    mirror = mirrorDuel(save, "trail", cfg.seed);
    dom = await settleView(expectedView(mirror.state, mirror.duel));
    check("C", "after reload Raven Roost starts with the mirror deal for ?seed and the earned deck", same(viewOf(dom), expectedView(mirror.state, mirror.duel)) && dom.lesson === TRAIL[1].lesson, {page: viewOf(dom), mirror: expectedView(mirror.state, mirror.duel)});
    await shot("raven-roost-deal", "C", "#status", ["#status", "#board"]);
    await pace();
    check("C", "Raven Roost deck holds the two Covered Wagons", save.deck["cowboy-covered-wagon"] === 2 && dom.cowboy.counts === `Hand ${mirror.state.sides.cowboy.hand.length} · Deck 12 · Graveyard 0`, {counts: dom.cowboy.counts});
    await click("#leave");
    dom = await until((d) => d.visible.join() === "camp");
    savedIs("C", dom, save, "Back to camp without playing");
    runs.ravenRoostStart = {seed: cfg.seed, hand: expectedView(mirror.state, mirror.duel).hand};
    if (stopFrames) framesEnd = await stopFrames();

    // T. Opt-in: Trail duels 2 to 6 from the same fresh-profile save, then the first rival unlocked. No fixture.
    if (cfg.fullTrail) {
      runs.fullTrail = {seeds, source: "campaign-trail.test.js SEEDS", duels: [{duel: TRAIL[0].name, ...runs.bootHill, took: bootPick}]};
      check("T", "Boot Hill was played on campaign-trail.test.js SEEDS[0]", cfg.seed === seeds[0], {seed: cfg.seed, seeds});
      for (let i = 1; i < TRAIL.length; i++) {
        const step = TRAIL[i], seed = seeds[i], where = `Trail ${i + 1}. ${step.name}`, last = i === TRAIL.length - 1;
        // A fresh load per duel: ?seed fixes only the first deal, and the reload proves the save persisted.
        await load(pageUrl(seed));
        dom = await read();
        campIs("T", dom, save, `${where}: Camp after reload`);
        savedIs("T", dom, save, `${where}: after reload`);
        check("T", `${where}: the only open Trail tile`, dom.camp.trail.map((t) => t.cls).join() === TRAIL.map((_, j) => `tile ${j < i ? "won" : j === i ? "open" : "locked"}`).join()
          && dom.camp.rivals.every((t) => t.off), {trail: dom.camp.trail});
        await click('#trail button[data-duel="trail"]');
        mirror = mirrorDuel(save, "trail", seed);
        check("T", `${where}: duelFor() deals ${step.name} with the deck the Trail has built`, mirror.duel.name === step.name && same(mirror.duel.options.decks.cowboy, deckAfter(i)), {duel: mirror.duel.name});
        dom = await settleView(expectedView(mirror.state, mirror.duel));
        check("T", `${where}: opens on turn 1 with the authored lesson`, dom.visible.join() === "duel" && dom.status === `${step.name} · turn 1 · your turn` && dom.lesson === step.lesson, {status: dom.status, lesson: dom.lesson});
        const result = await playOut("T", mirror);
        const run = {duel: step.name, seed, actions: result.steps, turns: result.turns, winner: result.winner};
        runs.fullTrail.duels.push(run);
        if (!check("T", `${where}: won by the Cowboys`, result.winner === "cowboy", {winner: result.winner})) throw new Error(`${where} was not won on seed ${seed}`);
        const settled = settle(save, "trail", true);
        save = settled.save;
        dom = result.dom;
        check("T", `${where}: settle() pays ${pays(step.reward.map(([type, , copies]) => [type, copies]))}${last ? " and 1 pack" : ""}`,
          same(settled.earned.cards, step.reward.map(([type, , copies]) => [type, copies])) && settled.earned.packs === (last ? 1 : 0), settled.earned);
        check("T", `${where}: reward panel names every earned card${last ? " and the pack" : ""}`,
          step.reward.every(([type]) => dom.reward.includes(TYPES[type].name)) && (!last || dom.reward.includes("You earned 1 pack. Open it in camp.")), {reward: dom.reward});
        check("T", `${where}: the two offered cards equal settle()'s offer`, dom.offer.length === 2 && same(dom.offer, save.offer), {page: dom.offer, want: save.offer});
        savedIs("T", dom, save, `${where}: after the win, before the choice`);
        const pick = save.offer[0];
        await click(`#reward button[data-choose="${pick}"]`);
        save = choose(save, pick);
        dom = await until((d) => d.offer.length === 0);
        savedIs("T", dom, save, `${where}: after choosing ${TYPES[pick].name}`);
        check("T", `${where}: next-step button reads Continue`, dom.again === "Continue", {again: dom.again});
        await click("#again");
        dom = await until((d) => d.visible.join() === "camp");
        campIs("T", dom, save, `${where}: Camp after Continue`);
        run.took = pick;
      }
      // The first rival, opened by play alone.
      await load(pageUrl(cfg.rivalSeed));
      dom = await read();
      check("T", "the played save finishes the Trail with 1 pack and no imported progress", trailDone(save) && save.packs === 1 && save.wins === TRAIL.length && duelFor(save, "trail") === null, save);
      campIs("T", dom, save, "Camp after the Trail, after reload");
      savedIs("T", dom, save, "after the Trail, after reload");
      check("T", "after reload: every Trail tile won, the Stargazer open, the Imp locked, both bounties and Open range open",
        dom.camp.trail.every((t) => t.cls === "tile won") && dom.camp.rivals[0].cls === "tile open" && !dom.camp.rivals[0].off
        && dom.camp.rivals.slice(1).every((t) => t.off) && dom.camp.bounties.every((t) => t.cls === "tile open") && dom.camp.openRange, {camp: dom.camp});
      check("T", "after reload: Camp offers the Trail's 1 pack to open", dom.claim.startsWith("1 pack to open"), {claim: dom.claim});
      const savedTrail = dom.saved;
      await click('#rivals button[data-duel="rival:stargazer"]');
      mirror = mirrorDuel(save, "rival:stargazer", cfg.rivalSeed);
      dom = await settleView(expectedView(mirror.state, mirror.duel));
      check("T", "the Stargazer starts from the played save with the mirror deal for ?seed",
        same(viewOf(dom), expectedView(mirror.state, mirror.duel)) && dom.status === "The Stargazer · turn 1 · your turn", {page: viewOf(dom), mirror: expectedView(mirror.state, mirror.duel)});
      await click("#leave");
      dom = await until((d) => d.visible.join() === "camp");
      check("T", "Back to camp from the Stargazer leaves the save byte-for-byte unchanged", dom.saved === savedTrail && dom.saved === JSON.stringify(save));
      runs.fullTrail.stargazerStart = {seed: cfg.rivalSeed, hand: expectedView(mirror.state, mirror.duel).hand};
      runs.fullTrail.finalSave = save;
    }

    // D. Named migrated fixture through the Save code box.
    await load(pageUrl(cfg.rivalSeed));
    const code = Buffer.from(JSON.stringify(FIXTURE.raw), "latin1").toString("base64");
    save = migrate(FIXTURE.raw);
    check("D", `fixture ${FIXTURE.name} migrates to a finished Trail with no packs or offer`, trailDone(save) && save.packs === 0 && save.offer === null && save.rivals.length === 0, save);
    await click("#camp details > summary");
    await click("#code");
    await send("Input.dispatchKeyEvent", {type: "keyDown", key: "a", code: "KeyA", modifiers: process.platform === "darwin" ? 4 : 2, commands: ["selectAll"]});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: "a", code: "KeyA", modifiers: process.platform === "darwin" ? 4 : 2});
    await send("Input.insertText", {text: code});
    check("D", "the Save code box holds the typed fixture code", (await read()).code === code);
    const dialogsBefore = chrome.dialogs.length;
    const savedBeforeLoad = (await read()).saved;
    await click("#load");
    dom = await until((d) => d.preview);
    check("D", "Load opens the visible preview and leaves the save unchanged", dom.preview && dom.previewText.includes("Replace your progress") && dom.saved === savedBeforeLoad && dom.codeNote === "", {preview: dom.previewText, note: dom.codeNote});
    await click("#code-replace");
    dom = await until((d) => d.codeNote !== "");
    check("D", "Replace my progress reports Loaded. with no browser dialog and closes the preview", dom.codeNote === "Loaded." && !dom.preview && chrome.dialogs.length === dialogsBefore, {note: dom.codeNote, dialogs: chrome.dialogs});
    savedIs("D", dom, save, `after loading ${FIXTURE.name}`);
    campIs("D", dom, save, `Camp after loading ${FIXTURE.name}`);
    check("D", "the Stargazer and both bounties are open, the Imp locked, Open range enabled",
      dom.camp.rivals[0].cls === "tile open" && dom.camp.rivals[1].off && dom.camp.bounties.every((t) => t.cls === "tile open") && dom.camp.openRange);

    // E. First rival: start, win, offer, pack.
    await click('#rivals button[data-duel="rival:stargazer"]');
    mirror = mirrorDuel(save, "rival:stargazer", cfg.rivalSeed);
    const rival = await playOut("E", mirror);
    runs.stargazer = {seed: cfg.rivalSeed, save: `migrate(${JSON.stringify(FIXTURE.raw)}) loaded through the Save code box`, actions: rival.steps, turns: rival.turns, winner: rival.winner};
    if (!check("E", "the Stargazer won by the Cowboys", rival.winner === "cowboy", {winner: rival.winner})) throw new Error("the Stargazer was not won; try another --rival-seed");
    const rivalSettled = settle(save, "rival:stargazer", true);
    save = rivalSettled.save;
    dom = rival.dom;
    check("E", "settle() pays the Six-Shooter and 1 pack", same(rivalSettled.earned, {cards: [["cowboy-six-shooter", 1]], packs: 1, captured: null}), rivalSettled.earned);
    check("E", "reward panel shows the Six-Shooter and the earned pack", dom.reward.includes(TYPES["cowboy-six-shooter"].name) && dom.reward.includes("You earned 1 pack. Open it in camp."), {reward: dom.reward});
    check("E", "the two offered cards equal settle()'s offer", same(dom.offer, save.offer), {page: dom.offer, want: save.offer});
    check("E", "a beaten rival offers Play it again", dom.again === "Play it again", {again: dom.again});
    const rivalPick = save.offer[0];
    await click(`#reward button[data-choose="${rivalPick}"]`);
    save = choose(save, rivalPick);
    dom = await until((d) => d.offer.length === 0);
    savedIs("E", dom, save, `after choosing ${TYPES[rivalPick].name}`);
    await click("#leave");
    dom = await until((d) => d.visible.join() === "camp");
    campIs("E", dom, save, "Camp after the Stargazer");
    check("E", "Camp offers 1 pack to open", dom.claim.startsWith("1 pack to open"), {claim: dom.claim});
    await click("#pack");
    const pack = openPack(save);
    save = pack.save;
    dom = await until((d) => d.claim.startsWith("In the pack"));
    check("E", "the pack's three cards equal progress.js openPack()", same(dom.packCards, pack.cards.map((t) => TYPES[t].name)) && pack.cards.length === 3, {page: dom.packCards, want: pack.cards});
    savedIs("E", dom, save, "after opening the pack");
    await click("#pack-done");
    dom = await until((d) => d.claim === "");
    check("E", "Add them to my collection clears the claim", dom.claim === "", {claim: dom.claim});
    check("E", "collection line lists the Six-Shooter and every pack card", [TYPES["cowboy-six-shooter"].name, ...pack.cards.map((t) => TYPES[t].name)].every((n) => dom.collection.includes(n)), {collection: dom.collection});
    campIs("E", dom, save, "Camp after the pack");
    check("E", "the Imp is now the open rival", dom.camp.rivals[0].title === "✓ The Stargazer" && dom.camp.rivals[1].cls === "tile open" && !dom.camp.rivals[1].off);
    await reload();
    dom = await read();
    campIs("E", dom, save, "Camp after reload");
    savedIs("E", dom, save, "after reload");
    runs.pack = {cards: pack.cards, offerPicks: [bootPick, rivalPick]};

    // F. Bounty start from the same save.
    await load(pageUrl(cfg.huntSeed));
    const before = (await read()).saved;
    await click('#bounties button[data-duel="hunt:lantern-wraith"]');
    mirror = mirrorDuel(save, "hunt:lantern-wraith", cfg.huntSeed);
    dom = await settleView(expectedView(mirror.state, mirror.duel));
    check("F", "Lantern Wraith hunt 1 of 5 opens with the mirror deal for ?seed", same(viewOf(dom), expectedView(mirror.state, mirror.duel)) && dom.status === `The Lantern Wraith, hunt 1 of ${HUNTS} · turn 1 · your turn`, {page: viewOf(dom), mirror: expectedView(mirror.state, mirror.duel)});
    check("F", "the Wraith stands in the first Wizard slot with 4 orbs", dom.wizard.slots[0]?.name === cardOf("wizard-lantern-wraith-0").name && dom.wizard.slots[0]?.orbs.startsWith("4 of "), {slot: dom.wizard.slots[0]});
    await click("#leave");
    dom = await until((d) => d.visible.join() === "camp");
    check("F", "Back to camp leaves the save byte-for-byte unchanged", dom.saved === before && dom.saved === JSON.stringify(save));
    campIs("F", dom, save, "Camp after leaving the hunt");
    runs.wraithStart = {seed: cfg.huntSeed, hand: expectedView(mirror.state, mirror.duel).hand};
  } catch (error) {
    failure = error.message;
  } finally {
    if (stopFrames) framesEnd = await stopFrames().catch(() => null);
    await chrome.close();
    await server.close();
  }

  check("Z", "no confirmation or alert dialog opened", chrome.dialogs.length === 0, {dialogs: chrome.dialogs});
  const failed = checks.filter((c) => !c.pass);
  const pass = !failure && !failed.length && !chrome.errors.length && !chrome.remote.length;
  const receipt = {
    tool: "prototypes/showdown/campaign-browser-check.mjs", pass, failure, fullTrail: cfg.fullTrail,
    command: `node prototypes/showdown/campaign-browser-check.mjs ${process.argv.slice(2).join(" ")}`.trim(),
    html: path.relative(root, cfg.html), htmlSha256, htmlBytes: htmlBytes.length,
    head: git("rev-parse", "HEAD"), dirtyTracked: git("status", "--porcelain", "--untracked-files=no") !== "",
    chrome: chrome.product, node: process.version, platform: `${process.platform} ${os.release()} ${process.arch}`,
    startedAt: started.toISOString(), seconds: Math.round((Date.now() - started) / 100) / 10,
    fixture: {name: FIXTURE.name, kind: "migrated v1 save, typed into the Camp's Save code box", raw: FIXTURE.raw},
    driver: "rules.js planTurn on campaign-driver.mjs publicView (Wizard traps removed, Wizard hand+deck pooled and sorted, deck order hidden); each move performed as CDP mouse presses on visible buttons. Not a human playtest.",
    runs, ...(cfg.frames ? {frames: {dir: path.relative(root, cfg.frames), source: "Chrome Page.startScreencast JPEG q90, phases A to C only (fresh profile, no fixture)",
      paceMs: cfg.paceMs, count: frames.length, endTimestamp: framesEnd, files: frames}} : {}),
    ...(cfg.shots ? {shots: {dir: path.relative(root, cfg.shots), viewport: "1280x900 CSS px, deviceScaleFactor 1", files: shots}} : {}),
    checks: {total: checks.length, passed: checks.length - failed.length, failed},
    actions: actions.length, consoleErrors: chrome.errors, remoteRequests: chrome.remote, dialogs: chrome.dialogs,
    allChecks: checks.map((c) => `${c.pass ? "ok " : "FAIL"} ${c.phase} ${c.name}`),
  };
  await mkdir(path.dirname(cfg.out), {recursive: true});
  await writeFile(cfg.out, JSON.stringify(receipt, null, 2) + "\n");
  for (const line of receipt.allChecks) console.log(line);
  for (const c of failed) console.log(`  ${c.phase} ${c.name}: ${JSON.stringify(c.detail).slice(0, 600)}`);
  console.log(`checks ${receipt.checks.passed}/${receipt.checks.total} passed; actions ${actions.length}; console errors ${chrome.errors.length}; remote requests ${chrome.remote.length}; dialogs ${chrome.dialogs.length}`);
  console.log(`html ${receipt.html} sha256 ${htmlSha256}; ${chrome.product}; ${receipt.seconds} s; receipt ${path.relative(root, cfg.out)}`);
  console.log(`pass ${pass}${failure ? `; failure: ${failure}` : ""}`);
  process.exit(pass ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
