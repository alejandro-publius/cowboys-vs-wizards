// Headless Chrome play-through of the Orb Duel card match in the built page
// (dist/cowboys-vs-wizards-board-duel.html). It speaks the DevTools protocol
// over Node's built-in WebSocket, so it needs no extra dependency.
//
//   npm run build && node scripts/browser-match-check.mjs [--seed N] [--swiftshader] [--out-dir PATH]
//
// Without --seed it uses the first seed in which the Cowboys start and can
// summon a Sheriff from the opening hand, checked with Fable's Engine here in
// Node. If WebGL fails with Chrome's default GPU path it retries once with
// SwiftShader. Screenshots and browser-run.json go to
// docs/evidence/kiro-match-ui/ by default. Use --out-dir for a separate run. The JSON is also printed. A step is
// "observed" only when the page showed it; anything else stays "pending".
import {execFileSync, spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import * as T from "three";
import {matchCamera, resizeMatchCamera} from "../src/render/match-camera.js";
import {CARDS} from "../src/game/cards.js";
import {legalActions} from "../src/game/legal.js";
import {createMatch} from "../src/game/state.js";
import {publicState} from "../src/game/view.js";
import {createBoardScene} from "../src/render/scene.js";
import {localModels} from "./load-local.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SWIFTSHADER = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const WIDTH = 1440, HEIGHT = 900;
const root = fileURLToPath(new URL("../", import.meta.url));
const pagePath = path.join(root, "dist/cowboys-vs-wizards-board-duel.html");
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const outputPath = option("--out-dir");
if (args.includes("--out-dir") && (!outputPath || outputPath.startsWith("--"))) {
  throw new Error("--out-dir needs a directory");
}
const outDir = outputPath ? path.resolve(outputPath) : path.join(root, "docs/evidence/kiro-match-ui");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const shell = (command, list) => {
  try {
    return execFileSync(command, list, {cwd: root, encoding: "utf8"}).trim();
  } catch {
    return null;
  }
};

// The opening Cowboy view for `seed` when the Cowboys start and a Sheriff
// summon is legal, otherwise null.
function sheriffOpening(seed) {
  const view = publicState(createMatch(seed), "cowboy");
  if (view.activeSide !== "cowboy") return null;
  const sheriff = view.sides.cowboy.hand.find((id) => CARDS[id].name === "Sheriff");
  const legal = sheriff && legalActions(view, "cowboy").some((action) => action.type === "summon" && action.cardId === sheriff);
  return legal ? view : null;
}

function chooseSeed() {
  const given = option("--seed");
  if (given !== undefined) {
    const seed = Number(given);
    if (!Number.isSafeInteger(seed) || !sheriffOpening(seed)) throw new Error(`seed ${given} does not open with a summonable Sheriff`);
    return seed;
  }
  for (let seed = 0; seed < 1000; seed++) if (sheriffOpening(seed)) return seed;
  throw new Error("no seed in 0-999 opens with a summonable Sheriff");
}

// Screen points (CSS px) of the Cowboy tile centres, projected with the
// match board's camera rules at the page size, for the canvas pick.
async function cowboyTilePoints() {
  const {stage} = await createBoardScene(await localModels());
  const camera=matchCamera();
  const stageHeight=HEIGHT-Math.min(248,Math.max(208,HEIGHT*.26));
  resizeMatchCamera(camera,WIDTH,stageHeight);
  camera.updateMatrixWorld(true);
  return [0, 1, 2].map((slot) => {
    const tile = stage.tiles[slot];
    const p = new T.Vector3(tile.x, tile.top, tile.z).project(camera);
    return {slot, x: Math.round((p.x + 1) / 2 * WIDTH), y: Math.round((1 - p.y) / 2 * stageHeight)};
  });
}

async function launchChrome(extra) {
  const profile = await mkdtemp("/tmp/kiro-chrome-");
  // A first run (a second tab, none of the backgrounding flags) saw
  // document.visibilityState "hidden" partway through, with
  // requestAnimationFrame stopped and the match scheduler's clock with it.
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    `--window-size=${WIDTH},${HEIGHT}`, ...extra, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL from Chrome in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited with ${code}:\n${stderr}`));
    });
  });
  return {
    url,
    stderr: () => stderr,
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await Promise.race([exited, sleep(5000)]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      // Chrome helpers can still be writing into the profile as they exit.
      await rm(profile, {recursive: true, force: true, maxRetries: 5});
    },
  };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const waiting = new Map(), listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({data}) => {
      const message = JSON.parse(data);
      if (message.id === undefined) {
        for (const listener of listeners) listener(message);
        return;
      }
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

// Everything the steps check, read from the page DOM in one evaluation.
const SNAPSHOT = `(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (n) => (n ? n.textContent.trim() : null);
  if (!$("#match") || !$("#boot")) return {loading: true};
  const match = $("#match"), result = $(".match-result", match), message = $(".match-message", match);
  return {
    status: match.dataset.status ?? null, visibility: document.visibilityState,
    bootHidden: $("#boot").hidden, fallbackHidden: $("#fallback").hidden, matchHidden: match.hidden,
    controlsHidden: $("#controls").hidden, toolsHidden: $("#tools").hidden, modeText: text($("#mode")),
    canvas: Boolean($("#stage canvas")),
    details: text($(".match-details p", match)), seed: text($(".match-details code", match)),
    seedKind: text($(".match-details .match-muted", match)),
    prompt: text($(".match-prompt", match)), message: !message || message.hidden ? "" : text(message),
    hand: $$(".match-hand .card-front", match).map((b) => ({cardId: b.dataset.cardId, name: text($(".card-name", b)),
      pressed: b.getAttribute("aria-pressed") === "true", disabled: b.disabled})),
    lanes: $$(".match-slot", match).map((b) => ({side: b.dataset.side, slot: Number(b.dataset.slot), text: text(b),
      label: b.getAttribute("aria-label"), disabled: b.disabled, pressed: b.getAttribute("aria-pressed") === "true"})),
    cowboyDeck: text($(".match-own .match-count", match)), cowboyBase: text($(".match-own .match-base", match)),
    wizardDeck: text($(".match-opponent .match-count", match)), wizardHand: $$(".match-backs .card-back", match).length,
    wizardBase: text($(".match-opponent .match-base", match)), cardBacks: $$(".card-back", match).length,
    buttons: Object.fromEntries($$(".match-buttons button, .match-details [data-action=restart]", match)
      .map((b) => [b.dataset.action, !b.disabled])),
    result: result && !result.hidden ? {title: text($("h2", result)), detail: text($("p", result)), outcome: result.dataset.outcome} : null,
    demo: {status: text($("#status")), billyHp: text($("#billy-hp")), wizardHp: text($("#wizard-hp")),
      buttons: ["fire", "cast", "watch"].map((id) => ({id, text: text($("#" + id)), disabled: $("#" + id).disabled}))},
  };
})()`;

const SETTLED = new Set(["accepting_input", "terminal", "error"]);
const lane = (s, side, slot) => s.lanes.find((each) => each.side === side && each.slot === slot);
const laneTexts = (s) => s.lanes.map((each) => `${each.side}${each.slot}:${each.text}`).join(" | ");

async function runOnce(seed, flags, tilePoints) {
  const chrome = await launchChrome(flags);
  const cdp = await connect(chrome.url);
  const report = {flags, steps: [], consoleErrors: [], warnings: [], screenshots: []};
  try {
    report.chrome = (await cdp.send("Browser.getVersion")).product;
    // The tab Chrome opened, so no second tab competes for visibility.
    const {targetInfos} = await cdp.send("Target.getTargets");
    const opened = targetInfos.find((info) => info.type === "page");
    const targetId = opened?.targetId ?? (await cdp.send("Target.createTarget", {url: "about:blank"})).targetId;
    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
    const send = (method, params) => cdp.send(method, params, sessionId);
    cdp.on((message) => {
      if (message.sessionId !== sessionId) return;
      const {method, params} = message;
      if (method === "Runtime.consoleAPICalled") {
        const text = params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
        if (params.type === "error" || params.type === "assert") report.consoleErrors.push({source: `console.${params.type}`, text});
        else if (params.type === "warning") report.warnings.push(text);
      } else if (method === "Runtime.exceptionThrown") {
        const details = params.exceptionDetails;
        report.consoleErrors.push({source: "exception", text: details.exception?.description ?? details.text});
      } else if (method === "Log.entryAdded") {
        if (params.entry.level === "error") report.consoleErrors.push({source: `log.${params.entry.source}`, text: params.entry.text});
        else if (params.entry.level === "warning") report.warnings.push(params.entry.text);
      }
    });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
    await send("Emulation.setFocusEmulationEnabled", {enabled: true});
    await send("Page.bringToFront");

    async function evaluate(expression) {
      const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
      if (exceptionDetails) throw new Error(`page: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
      return result.value;
    }
    const snapshot = () => evaluate(SNAPSHOT);
    async function waitFor(label, predicate, timeout = 20000, seen = null) {
      const started = Date.now();
      let last = null;
      while (Date.now() - started < timeout) {
        try {
          last = await snapshot();
        } catch {
          last = {loading: true}; // the document is being replaced during navigation
        }
        if (!last.loading) {
          seen?.add(last.status);
          if (predicate(last)) return last;
        }
        await sleep(60);
      }
      throw new Error(`timed out after ${timeout} ms waiting for ${label} (status ${last?.status}, prompt "${last?.prompt}", page ${last?.visibility})`);
    }
    const settle = (label, seen, timeout = 60000) => waitFor(label, (s) => SETTLED.has(s.status), timeout, seen);
    async function mouse(x, y) {
      await send("Input.dispatchMouseEvent", {type: "mouseMoved", x, y});
      await send("Input.dispatchMouseEvent", {type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1});
      await send("Input.dispatchMouseEvent", {type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1});
    }
    // A real mouse click at the centre of the element, which must be the
    // element hit there (not covered by anything else).
    async function click(selector) {
      const box = await evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return {error: "missing"};
        node.scrollIntoView({block: "nearest", inline: "nearest"});
        const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !node.contains(hit)) return {error: "covered by " + (hit ? hit.tagName + "." + hit.className : "nothing")};
        return {x, y};
      })()`);
      if (box.error) throw new Error(`cannot click ${selector}: ${box.error}`);
      await mouse(box.x, box.y);
    }
    async function key(name, code, keyCode) {
      for (const type of ["keyDown", "keyUp"]) {
        await send("Input.dispatchKeyEvent", {type, key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode});
      }
    }
    async function screenshot(name) {
      const {data} = await send("Page.captureScreenshot", {format: "png"});
      await mkdir(outDir, {recursive: true});
      const screenshotPath = path.join(outDir, name);
      await writeFile(screenshotPath, Buffer.from(data, "base64"));
      report.screenshots.push(outputPath ? screenshotPath : path.relative(root, screenshotPath));
    }
    const step = (id, title, observed, detail) => report.steps.push({id, title, state: observed ? "observed" : "pending", detail});
    const cardSelector = (cardId) => `#match .match-hand [data-card-id="${cardId}"]`;
    const laneSelector = (side, slot) => `#match .match-slot[data-side="${side}"][data-slot="${slot}"]`;
    const action = (name) => `#match .match-buttons [data-action="${name}"]`;

    // Plays the first playable hand card through its steps, or ends the phase.
    async function playFirstPlayable() {
      const start = await snapshot();
      for (const card of start.hand) {
        if (card.disabled) continue;
        await click(cardSelector(card.cardId));
        let s = await snapshot();
        if (!s.hand.find((each) => each.cardId === card.cardId)?.pressed) continue; // blocked, with its message
        for (let guard = 0; guard < 6; guard++) {
          if (s.buttons.confirm) {
            await click(action("confirm"));
            return `${card.name}`;
          }
          if (s.buttons.skip) await click(action("skip"));
          else {
            const sacrifice = /sacrifice/.test(s.prompt);
            const choice = s.lanes.find((each) => !each.disabled && !(sacrifice && each.pressed));
            if (!choice) break;
            await click(laneSelector(choice.side, choice.slot));
          }
          s = await snapshot();
        }
        await click(action("cancel"));
      }
      await click(action("end-phase"));
      return "end phase";
    }

    // Step 1: match mode loads, no fallback video, seed shown.
    const url = `${pathToFileURL(pagePath).href}?seed=${seed}`;
    report.url = url;
    const loadStarted = Date.now();
    await send("Page.navigate", {url});
    let s = await waitFor("the page to boot", (x) => x.bootHidden, 180000);
    if (!s.fallbackHidden) {
      report.webglFailed = true;
      step(1, "Match mode loads with no fallback video; seed shown", false, {fallbackShown: true, chromeStderr: chrome.stderr().slice(-2000)});
      return report;
    }
    s = await waitFor("match mode to accept input", (x) => !x.matchHidden && x.status === "accepting_input", 30000);
    report.loadMs = Date.now() - loadStarted;
    report.webgl = await evaluate(`(() => {
      const canvas = document.querySelector("#stage canvas"), gl = canvas && canvas.getContext("webgl2");
      if (!gl) return {error: "no WebGL 2 context on the stage canvas"};
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return {version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(info ? info.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
        renderer: gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER), canvas: [canvas.width, canvas.height]};
    })()`);
    report.framesPerSecond = await evaluate(`new Promise((resolve) => {
      let frames = 0; const start = performance.now();
      const tick = (now) => { frames++; if (now - start < 2000) requestAnimationFrame(tick); else resolve(Math.round(frames / ((now - start) / 1000) * 10) / 10); };
      requestAnimationFrame(tick);
    })`);
    step(1, "Match mode loads with no fallback video; seed shown",
      s.fallbackHidden && !s.matchHidden && s.controlsHidden && s.toolsHidden && s.canvas && s.seed === String(seed) && s.seedKind === "(pinned)",
      {status: s.status, fallbackHidden: s.fallbackHidden, demoControlsHidden: s.controlsHidden, demoToolsHidden: s.toolsHidden,
        modeButton: s.modeText, seedShown: `${s.seed} ${s.seedKind}`, details: s.details, prompt: s.prompt});

    // Step 2: four cards, deck count, card back.
    const opening = publicState(createMatch(seed), "cowboy");
    const background = await evaluate(`getComputedStyle(document.querySelector("#match .match-own .card-back")).backgroundImage`);
    const embedded = background.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
    const backHash = embedded ? sha256(Buffer.from(embedded, "base64")) : null;
    const fileHash = sha256(await readFile(path.join(root, "assets/cards/card-back.png")));
    step(2, "Hand shows 4 cards; deck count and card back present",
      s.hand.length === 4 && s.hand.every((card, i) => card.cardId === opening.sides.cowboy.hand[i])
        && s.cowboyDeck === String(opening.sides.cowboy.deckCount) && s.cardBacks > 0 && backHash === fileHash,
      {hand: s.hand.map((card) => card.name), engineHand: opening.sides.cowboy.hand.map((id) => CARDS[id].name),
        cowboyDeck: s.cowboyDeck, engineDeckCount: opening.sides.cowboy.deckCount, wizardDeck: s.wizardDeck,
        wizardHandBacks: s.wizardHand, cardBackElements: s.cardBacks, bases: [s.cowboyBase, s.wizardBase],
        deckPileImageSha256: backHash, cardBackFileSha256: fileHash});

    // Step 3: select a card, cancel with the button, then again with Escape.
    const sheriff = s.hand.find((card) => card.name === "Sheriff");
    await click(cardSelector(sheriff.cardId));
    const selected = await snapshot();
    await click(action("cancel"));
    const cancelled = await snapshot();
    await click(cardSelector(sheriff.cardId));
    const reselected = await snapshot();
    await key("Escape", "Escape", 27);
    const escaped = await snapshot();
    const pressed = (x) => x.hand.filter((card) => card.pressed).map((card) => card.name);
    step(3, "Select a card, then cancel (Cancel button, then Escape)",
      pressed(selected).length === 1 && selected.buttons.cancel && pressed(cancelled).length === 0 && !cancelled.buttons.cancel
        && pressed(reselected).length === 1 && pressed(escaped).length === 0 && escaped.status === "accepting_input",
      {selectedPrompt: selected.prompt, selected: pressed(selected), afterCancelButton: {pressed: pressed(cancelled), prompt: cancelled.prompt},
        afterEscape: {pressed: pressed(escaped), prompt: escaped.prompt}, status: escaped.status});

    // Step 4: Sheriff, a lane (picked on the canvas when the tile is not under the overlay), confirm.
    await click(cardSelector(sheriff.cardId));
    const free = [];
    for (const point of tilePoints) {
      const onCanvas = await evaluate(`document.elementFromPoint(${point.x}, ${point.y})?.tagName === "CANVAS"`);
      if (onCanvas) free.push(point);
    }
    let pickedBy = "lane button", slot = 0;
    if (free.length > 0) {
      await mouse(free[0].x, free[0].y);
      const picked = await snapshot();
      if (picked.buttons.confirm) {
        pickedBy = `canvas pick at (${free[0].x}, ${free[0].y})`;
        slot = free[0].slot;
      }
    }
    if (pickedBy === "lane button") await click(laneSelector("cowboy", slot));
    const ready = await snapshot();
    await click(action("confirm"));
    const flightLanding = await evaluate(`(() => {
      const node = document.querySelector("#match .card-flight");
      const animation = node?.getAnimations()[0];
      if (!animation) return null;
      const elapsed = animation.currentTime;
      animation.pause();
      animation.currentTime = Number(animation.effect.getTiming().duration) - 1;
      const box = node.getBoundingClientRect();
      animation.currentTime = elapsed;
      animation.play();
      return {x: box.left + box.width / 2, y: box.top + box.height / 2};
    })()`);
    const expectedLanding = tilePoints.find((point) => point.slot === slot);
    const landingError = flightLanding
      ? Math.hypot(flightLanding.x - expectedLanding.x, flightLanding.y - expectedLanding.y)
      : null;
    const summonSeen = new Set();
    s = await settle("the summon playback", summonSeen);
    await sleep(300);
    await screenshot("summon-sheriff.png");
    const placed = lane(s, "cowboy", slot);
    step(4, "Select Sheriff, pick a lane, confirm; the troop and its orbs appear",
      ready.buttons.confirm && placed?.text === "Sheriff 3/3" && s.hand.length === 3 && summonSeen.has("playing") && s.status === "accepting_input" && landingError !== null && landingError < 4,
      {flightLanding, expectedLanding, landingError, lanePickedBy: pickedBy, canvasTilePoints: tilePoints, uncoveredTiles: free.map((point) => point.slot), slot,
        promptBeforeConfirm: ready.prompt, laneSummary: placed?.text, laneLabel: placed?.label, handAfter: s.hand.map((card) => card.name),
        statusesSeen: [...summonSeen]});

    // Step 5: end phase; the CPU acts and the clash plays.
    const before = s;
    await click(action("end-phase"));
    const clashSeen = new Set();
    s = await settle("the CPU turn and the clash", clashSeen);
    const changed = before.cowboyBase !== s.cowboyBase || before.wizardBase !== s.wizardBase || laneTexts(before) !== laneTexts(s);
    step(5, "End phase; the CPU acts and the clash changes orb or Base counts",
      clashSeen.has("cpu_turn") && changed && before.details !== s.details,
      {statusesSeen: [...clashSeen], before: {details: before.details, bases: [before.cowboyBase, before.wizardBase], lanes: laneTexts(before)},
        after: {details: s.details, bases: [s.cowboyBase, s.wizardBase], lanes: laneTexts(s), status: s.status}});

    // Step 6: first playable card, or end phase, until a result.
    const moves = [];
    const playStarted = Date.now();
    while (s.status === "accepting_input" && moves.length < 300 && Date.now() - playStarted < 8 * 60000) {
      const round = s.details;
      moves.push(`${round}: ${await playFirstPlayable()}`);
      s = await settle("playback after a move");
    }
    if (s.result) await sleep(400);
    if (s.result) await screenshot("result.png");
    step(6, "Play until a result (first playable card, else end phase)", s.status === "terminal" && Boolean(s.result),
      {result: s.result, status: s.status, message: s.message, finalDetails: s.details, bases: [s.cowboyBase, s.wizardBase],
        lanes: laneTexts(s), humanMoves: moves.length, playMs: Date.now() - playStarted, moves});

    // Step 7: restart from the result, play into the first clash, restart during its playback.
    if (s.result) {
      await click("#match .match-result [data-action=restart]");
      const fresh = await waitFor("the restarted match", (x) => x.status === "accepting_input" && !x.result, 20000);
      await click(cardSelector(fresh.hand.find((card) => card.name === "Sheriff").cardId));
      await click(laneSelector("cowboy", 0));
      await click(action("confirm"));
      await settle("the summon playback");
      await click(action("end-phase"));
      const cut = await evaluate(`new Promise((resolve) => {
        const match = document.getElementById("match"), start = performance.now();
        const read = () => ({status: match.dataset.status, details: match.querySelector(".match-details p").textContent,
          bases: [...match.querySelectorAll(".match-base")].map((n) => n.textContent),
          lanes: [...match.querySelectorAll(".match-slot")].map((n) => n.dataset.side + n.dataset.slot + ":" + n.textContent)});
        let sawCpu = false;
        (function poll() {
          const now = read();
          if (now.status === "cpu_turn") sawCpu = true;
          // Only the clash can hurt a Base or a Wizard troop here (the Cowboy cast nothing).
          const hurt = now.bases.some((text) => !text.startsWith("Base 5/")) || now.lanes.some((text) => {
            const health = text.startsWith("wizard") && text.match(/(\\d)\\/(\\d)$/);
            return Boolean(health) && health[1] !== health[2];
          });
          if (sawCpu && now.status === "playing" && hurt) {
            match.querySelector(".match-details [data-action=restart]").click();
            return resolve({clicked: true, atRestart: now, statusRightAfter: match.dataset.status});
          }
          if (performance.now() - start > 30000) return resolve({clicked: false, last: now, sawCpu});
          setTimeout(poll, 5);
        })();
      })`);
      const restarted = await waitFor("the match after the mid-clash restart", (x) => x.status === "accepting_input", 20000);
      await sleep(3000);
      const later = await snapshot();
      const clean = (x) => x.details === "Round 1 · Cowboy phase (you)" && x.cowboyBase === "Base 5/5" && x.wizardBase === "Base 5/5"
        && x.lanes.every((each) => each.text === "Empty") && x.hand.length === 4 && !x.result
        && x.hand.every((card, i) => card.cardId === opening.sides.cowboy.hand[i]);
      step(7, "Restart during clash playback; the pinned seed restarts clean and stays clean",
        cut.clicked && clean(restarted) && clean(later) && laneTexts(restarted) === laneTexts(later) && later.status === "accepting_input"
          && restarted.seed === String(seed) && restarted.seedKind === "(pinned)",
        {fromResultPanel: {status: fresh.status, details: fresh.details, seed: `${fresh.seed} ${fresh.seedKind}`},
          cut, afterRestart: {details: restarted.details, bases: [restarted.cowboyBase, restarted.wizardBase], lanes: laneTexts(restarted),
            hand: restarted.hand.map((card) => card.name), seed: `${restarted.seed} ${restarted.seedKind}`},
          threeSecondsLater: {status: later.status, details: later.details, bases: [later.cowboyBase, later.wizardBase], lanes: laneTexts(later)}});
    } else step(7, "Restart during clash playback; the pinned seed restarts clean and stays clean", false, {skipped: "no result was reached in step 6"});

    // Step 8: switch to the demo, fire once, and switch back.
    await click("#mode");
    const demo = await waitFor("demo mode", (x) => x.matchHidden && !x.controlsHidden, 10000);
    await click("#fire");
    const fired = await waitFor("the demo shot to finish", (x) => x.demo.status === "Attack complete.", 20000);
    await click("#mode");
    const back = await waitFor("match mode again", (x) => !x.matchHidden && x.status === "accepting_input", 20000);
    step(8, "Switch to the demo and back",
      demo.matchHidden && !demo.controlsHidden && !demo.toolsHidden && demo.demo.buttons.every((b) => !b.disabled) && demo.modeText === "Card match"
        && fired.demo.wizardHp === "76" && back.controlsHidden && back.toolsHidden && back.modeText === "Attack demo"
        && back.details === "Round 1 · Cowboy phase (you)" && back.hand.length === 4 && back.seed === String(seed),
      {demo: {modeButton: demo.modeText, matchHidden: demo.matchHidden, controlsHidden: demo.controlsHidden, toolsHidden: demo.toolsHidden,
        buttons: demo.demo.buttons, status: demo.demo.status, health: [demo.demo.billyHp, demo.demo.wizardHp]},
      afterFire: {status: fired.demo.status, health: [fired.demo.billyHp, fired.demo.wizardHp]},
      backInMatch: {modeButton: back.modeText, status: back.status, details: back.details, seed: `${back.seed} ${back.seedKind}`,
        hand: back.hand.map((card) => card.name), demoControlsHidden: back.controlsHidden}});
  } catch (error) {
    report.error = error.stack ?? String(error);

  } finally {
    cdp.close();
    await chrome.close();
  }
  return report;
}

const seed = chooseSeed();
const tilePoints = await cowboyTilePoints();
const attempts = [];
let run = await runOnce(seed, args.includes("--swiftshader") ? SWIFTSHADER : [], tilePoints);
if (run.webglFailed && !args.includes("--swiftshader")) {
  attempts.push({flags: run.flags, webglFailed: true, consoleErrors: run.consoleErrors});
  run = await runOnce(seed, SWIFTSHADER, tilePoints);
}
const pageBytes = await readFile(pagePath);
const result = {
  date: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles", timeZoneName: "short"}),
  commit: shell("git", ["rev-parse", "--short", "HEAD"]),
  uncommittedChanges: Boolean(shell("git", ["status", "--porcelain"])),
  machine: {model: shell("sysctl", ["-n", "hw.model"]), cpu: os.cpus()[0]?.model, memoryGB: Math.round(os.totalmem() / 2 ** 30),
    macOS: shell("sw_vers", ["-productVersion"]), arch: os.arch(), node: process.version},
  page: {file: "dist/cowboys-vs-wizards-board-duel.html", bytes: pageBytes.length, sha256: sha256(pageBytes)},
  viewport: [WIDTH, HEIGHT],
  seed,
  openingHand: publicState(createMatch(seed), "cowboy").sides.cowboy.hand.map((id) => CARDS[id].name),
  earlierAttempts: attempts,
  ...run,
  warnings: {count: run.warnings.length, first: [...new Set(run.warnings)].slice(0, 8)},
};
await mkdir(outDir, {recursive: true});
await writeFile(path.join(outDir, "browser-run.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
const pending = result.steps.filter((each) => each.state !== "observed").map((each) => each.id);
console.log(`\nobserved ${result.steps.length - pending.length} of 8 steps; pending: ${pending.join(", ") || "none"}; console errors: ${result.consoleErrors.length}`);
process.exitCode = result.error || pending.length || result.steps.length < 8 ? 1 : 0;
