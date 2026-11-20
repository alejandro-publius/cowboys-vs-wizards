// Headless Chrome play-through of the Orb Duel card match in the built page
// (dist/cowboys-vs-wizards-board-duel.html). It speaks the DevTools protocol
// over Node's built-in WebSocket, so it needs no extra dependency.
//
//   npm run build:art && node scripts/browser-match-check.mjs [--seed N] [--url URL] [--swiftshader] [--summary] [--out-dir PATH] [--showcase] [--escape]
//
// --escape checks only the Escape key against the selection (no full match)
// and writes to .artifacts/fable-escape-cancel/browser/ unless --out-dir is given.
// --showcase plays the seed 60 Mounted Billy route instead of the eight steps
// and writes to .artifacts/kiro/showcase/ unless --out-dir is given.
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
import {chooseAction} from "../src/game/cpu.js";
import {legalActions} from "../src/game/legal.js";
import {createMatch} from "../src/game/state.js";
import {publicState} from "../src/game/view.js";
import {createBoardScene} from "../src/render/scene.js";
import {SHERIFF_LANDING} from "../src/render/sheriff.js";
import {localModels} from "./load-local.mjs";
import {playMatch} from "./play-match.mjs";

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
const servedUrl = option("--url");
if (args.includes("--url") && !servedUrl) throw new Error("--url needs a page URL");
const baseUrl = servedUrl ? new URL(servedUrl) : pathToFileURL(pagePath);
const outputPath = option("--out-dir");
if (args.includes("--out-dir") && (!outputPath || outputPath.startsWith("--"))) {
  throw new Error("--out-dir needs a directory");
}
// --showcase replays the seed 60 Mounted Billy route (docs/morning-handoff.md)
// through real clicks, for recording. Its default output is ignored by git.
const showcase = args.includes("--showcase");
// --startup-measure is opt-in: it adds report.startup (browser navigation/paint/resource
// timings and whether the canvas and accepting_input were observed). It does not change play.
const startupMeasure = args.includes("--startup-measure");
if (showcase && option("--seed") !== undefined && Number(option("--seed")) !== 60) throw new Error("--showcase always uses seed 60");
// --pace default|fast is opt-in: "fast" adds ?pace=fast to the page URL, "default" adds nothing,
// so unflagged runs load the same URL as before. --pace-measure records the monotonic
// milliseconds from each delivered end-phase click to the first observed Cowboy
// accepting_input state (showcase rounds and step 5). It does not change play.
const pace = option("--pace");
if (args.includes("--pace") && !["default", "fast"].includes(pace)) throw new Error("--pace needs default or fast");
const paceMeasure = args.includes("--pace-measure");
const escapeOnly = args.includes("--escape");
if (escapeOnly && showcase) throw new Error("--escape and --showcase are separate runs");
const outDir = outputPath ? path.resolve(outputPath)
  : path.join(root, escapeOnly ? ".artifacts/fable-escape-cancel/browser" : showcase ? ".artifacts/kiro/showcase" : "docs/evidence/kiro-match-ui");
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
    hand: $$(".match-hand .card-front", match).map((b) => ({cardId: b.dataset.cardId, name: $(".front-face", b)?.dataset.unit ?? null,
      hasArt: Boolean($(".front-face", b) && getComputedStyle($(".front-face", b)).backgroundImage.startsWith("url(")),
      pressed: b.getAttribute("aria-pressed") === "true", disabled: b.disabled,
      playable: b.hasAttribute("data-playable"),
      outlined: getComputedStyle($(".front-face", b)).outlineStyle === "solid"})),
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
  if (pace || paceMeasure) {
    report.pace = {requested: pace ?? null, measure: paceMeasure, urlParam: pace === "fast" ? "pace=fast" : null,
      note: "Elapsed values are single observations per round, not a benchmark; the page may ignore pace=fast."};
    report.paceObservations = [];
  }
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
    // Pace timing: performance.now() is monotonic. The clock starts when the real
    // CDP click has been delivered and stops when the poll first sees the state,
    // so each value includes up to one 60 ms poll plus one snapshot evaluation.
    const endPhaseClick = async () => {
      await click(action("end-phase"));
      return performance.now();
    };
    const notePace = (label, started, state) => {
      if (!paceMeasure) return;
      report.paceObservations.push({label, elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        observedStatus: state.status, observedDetails: state.details, reachedCowboyAcceptingInput: state.status === "accepting_input"});
    };

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
    const url = new URL(baseUrl);
    url.searchParams.set("seed", seed);
    url.searchParams.set("mode", "match");
    url.searchParams.set("deck", "starter");
    if (pace === "fast") url.searchParams.set("pace", "fast");
    report.url = url.href;
    const loadStarted = Date.now();
    await send("Page.navigate", {url: url.href});
    let s = await waitFor("the page to boot", (x) => x.bootHidden, 180000);
    if (!s.fallbackHidden) {
      report.webglFailed = true;
      step(1, "Match mode loads with no fallback video; seed shown", false, {fallbackShown: true, chromeStderr: chrome.stderr().slice(-2000)});
      return report;
    }
    s = await waitFor("match mode to accept input", (x) => !x.matchHidden && x.status === "accepting_input", 30000);
    report.loadMs = Date.now() - loadStarted;
    if (startupMeasure) {
      const browser = await evaluate(`(() => {
        const r = (n) => typeof n === "number" ? Math.round(n * 10) / 10 : null;
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return {
          navigation: nav ? {...Object.fromEntries(["startTime", "domInteractive", "domContentLoadedEventEnd", "loadEventStart", "loadEventEnd", "responseEnd", "duration"].map((k) => [k, r(nav[k])])),
            transferSize: nav.transferSize, encodedBodySize: nav.encodedBodySize, decodedBodySize: nav.decodedBodySize} : null,
          paint: performance.getEntriesByType("paint").map((e) => ({name: e.name, startTime: r(e.startTime)})),
          resourceCount: resources.length,
          resourceTransferBytes: resources.length ? resources.reduce((a, e) => a + (e.transferSize || 0), 0) : null,
          canvasObserved: Boolean(document.querySelector("#stage canvas"))
        };
      })()`);
      report.startup = {...browser, loadMs: report.loadMs, acceptingInputObserved: s.status === "accepting_input",
        note: "Baseline only. loadMs is Date.now() from Page.navigate to the first observed accepting_input. Not evidence that scenery is a bottleneck."};
    }
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

    if (escapeOnly) {
      // After every listener ran: did this Escape keydown get preventDefault()?
      await evaluate(`window.__escape = []; window.addEventListener("keydown", (e) => { if (e.key === "Escape") __escape.push(e.defaultPrevented); })`);
      const escape = async () => {
        await key("Escape", "Escape", 27);
        return {...await snapshot(), prevented: await evaluate("__escape.splice(0)"), dialog: await evaluate(`Boolean(document.querySelector("dialog[open]"))`)};
      };
      // The match as the page shows it; a cancel must leave all of it alone.
      const match = (x) => JSON.stringify([x.details, x.seed, x.hand.map((card) => card.cardId), x.lanes.map((each) => each.text),
        x.cowboyDeck, x.wizardDeck, x.wizardHand, x.cowboyBase, x.wizardBase]);
      const chosen = (x) => x.hand.filter((card) => card.pressed).length;
      const before = match(s), sheriff = cardSelector(s.hand.find((card) => card.name === "Sheriff").cardId);
      const cancelled = (x) => x.prevented.join() === "true" && chosen(x) === 0 && !x.buttons.cancel && x.status === "accepting_input" && match(x) === before;
      const untouched = (x) => x.prevented.join() === "false" && chosen(x) === 1 && x.buttons.cancel && !x.dialog && match(x) === before;
      const checks = {};

      await click(sheriff);
      checks.cardSelected = chosen(await snapshot()) === 1;
      checks.cardStepCancelled = cancelled(await escape());
      const idle = await escape(); // nothing left to cancel
      checks.idleEscapeIgnored = idle.prevented.join() === "false" && match(idle) === before;

      await click(sheriff);
      await click(laneSelector("cowboy", (await snapshot()).lanes.find((each) => each.side === "cowboy" && !each.disabled).slot));
      checks.destinationChosen = (await snapshot()).buttons.confirm;
      checks.destinationStepCancelled = cancelled(await escape()); // not summoned: the hand and lanes are as before

      await click(sheriff);
      await click("#match .arena-menu");
      checks.menuOpened = await evaluate(`document.querySelector("#match .match-details").open`);
      checks.menuEscapeKeepsSelection = untouched(await escape());
      await click("#match .view-art");
      checks.cardArtOpened = await evaluate(`document.querySelector("#match .card-viewer").open`);
      checks.cardArtEscapeKeepsSelection = untouched(await escape());

      await evaluate(`document.body.append(Object.assign(document.createElement("input"), {id: "escape-probe"})); document.getElementById("escape-probe").focus()`);
      const typing = await escape();
      await evaluate(`document.getElementById("escape-probe").remove()`);
      checks.editableEscapeKeepsSelection = untouched(typing);

      await click(action("cancel"));
      checks.cancelButtonStillWorks = chosen(await snapshot()) === 0;

      await click(action("end-phase"));
      const playback = await escape();
      checks.playbackEscapeIgnored = playback.status !== "accepting_input" && playback.prevented.join() === "false";
      const round = Number(s.details.match(/\d+/)[0]);
      s = await waitFor("the next Cowboy turn", (x) => x.status === "accepting_input" && x.details?.startsWith(`Round ${round + 1} `), 60000);
      step(2, "Escape cancels a selection once and leaves dialogs, text entry and playback alone",
        Object.values(checks).every(Boolean), {...checks, playbackStatus: playback.status, nextTurn: s.details});
      return report;
    }
    if (showcase) {
      // The legal Cowboy route for seed 60 comes from the engine's CPU bots;
      // every action is then made with real clicks on the page.
      const route = playMatch(60, {cowboy: chooseAction, wizard: chooseAction}).log
        .filter(({round, side}) => side === "cowboy" && round <= 5);
      const seen = {};
      report.showcase = seen;
      const must = (ok, message, state) => {
        if (!ok) throw new Error(`${message}: ${laneTexts(state)}`);
      };
      for (const {round, action: each} of route) {
        if (round === 5 && each.type === "end-phase") {
          s = await snapshot();
          const billy = lane(s, "cowboy", 1), dragon = lane(s, "wizard", 1);
          must(billy.text.startsWith("Mounted Billy ") && dragon.text === "Dragon 5/5", "Mounted Billy and the Dragon do not face off in the center lane", s);
          seen.faceoff = laneTexts(s);
          await screenshot("seed-60-faceoff.png");
        }
        if (each.type === "end-phase") {
          const endedAt = await endPhaseClick();
          s = await waitFor(`round ${round + 1}`, (x) => x.status === "accepting_input" && x.details?.startsWith(`Round ${round + 1} `), 25000);
          notePace(`showcase round ${round} end phase to round ${round + 1} Cowboy turn`, endedAt, s);
          if (round === 4) {
            must(lane(s, "cowboy", 1).text.startsWith("Mounted Billy ") && lane(s, "cowboy", 2).text === "Empty",
              "Singularity did not move Mounted Billy from lane 3 to lane 2", s);
            seen.singularity = laneTexts(s);
          }
        } else {
          const mountedSummon = round === 4 && each.type === "summon";
          if (mountedSummon) {
            must(each.tributes?.length === 2 && each.tributes.includes(1) && each.tributes.includes(2)
              && lane(s, "cowboy", 1).text.startsWith("Sheriff ") && lane(s, "cowboy", 2).text.startsWith("Billy "),
            "the two tribute troops are missing", s);
          }
          await click(cardSelector(each.cardId));
          for (const tribute of each.tributes ?? []) await click(laneSelector("cowboy", tribute));
          await click(laneSelector(each.type === "spell" ? "wizard" : "cowboy", each.target ?? each.slot));
          await click(action("confirm"));
          s = await settle("a selected card resolves");
          if (mountedSummon) {
            must(lane(s, "cowboy", 2).text === "Mounted Billy 5/5" && lane(s, "cowboy", 1).text === "Empty",
              "the tribute did not leave Mounted Billy in lane 3 with five orbs", s);
            seen.summon = {tributes: each.tributes, lanes: laneTexts(s)};
            await sleep(300);
            await screenshot("seed-60-mounted-billy.png");
          }
        }
      }
      seen.afterClash = laneTexts(s);
      must(lane(s, "wizard", 1).text === "Dragon 2/5" && !s.lanes.some((each) => each.text?.includes("Mounted Billy")),
        "the Dragon is not at two orbs, or the rider remains", s);
      await sleep(400);
      await screenshot("seed-60-result.png");
      step(2, "Mounted Billy enters lane 3 with five orbs after two tributes", Boolean(seen.summon), seen.summon);
      step(3, "Singularity moves him to lane 2, facing the five-orb Dragon", Boolean(seen.singularity && seen.faceoff), {singularity: seen.singularity, faceoff: seen.faceoff});
      step(4, "After the clash the Dragon has two orbs and the rider is gone", true, {afterClash: seen.afterClash});
      return report;
    }

    // Step 2: four cards, deck count, card back.
    const opening = publicState(createMatch(seed), "cowboy");
    const openingMoves = legalActions(opening, "cowboy");
    const openingMarksMatch = s.hand.every((card) => {
      const playable = openingMoves.some((action) => action.cardId === card.cardId);
      return card.playable === playable && card.outlined === playable;
    });
    const background = await evaluate(`getComputedStyle(document.querySelector("#match .match-own .card-back")).backgroundImage`);
    const backUrl = background.match(/url\("([^"]+)"\)/)?.[1];
    const backHash = backUrl ? sha256(await resourceBytes(backUrl)) : null;
    const fileHash = sha256(await readFile(path.join(root, "assets/cards/card-back.png")));
    await screenshot("illustrated-hand.png");
    await click('#match [data-action="view-art"]');
    const catalog = await evaluate(
      '[...document.querySelectorAll(".card-viewer [data-art]")].map(button => button.dataset.art)'
    );
    const catalogArt = [];
    for (const id of catalog) {
      await click('.card-viewer [data-art="' + id + '"]');
      const preview = await evaluate('(async () => {' +
        'const face = document.querySelector(".card-preview .front-face");' +
        'const css = getComputedStyle(face).backgroundImage;' +
        'const art = css.startsWith("url(") ? css.split(String.fromCharCode(34))[1] : null;' +
        'if (!art) return {name:face.dataset.unit, decoded:false};' +
        'const image = new Image(); image.src = art; await image.decode();' +
        'return {name:face.dataset.unit, decoded:image.naturalWidth > 0};' +
        '})()');
      catalogArt.push({ ...preview, expected: CARDS[id]?.name });
    }
    const allCatalogArt = catalogArt.length === 8 && new Set(catalogArt.map((card) => card.name)).size === 8
      && catalogArt.every((card) => card.decoded && card.name === card.expected);
    await click('.card-viewer [data-action="flip-art"]');
    const flipped = await evaluate('document.querySelector(".card-preview").classList.contains("is-flipped")');
    await click('.card-viewer [data-action="close-art"]');
    step(2, "The hand and all eight catalog cards show illustrated faces and flip to the deck back",
      s.hand.length === 4 && s.hand.every((card, i) => card.cardId === opening.sides.cowboy.hand[i])
        && s.hand.every((card) => card.hasArt) && allCatalogArt && flipped && openingMarksMatch
        && s.cowboyDeck === String(opening.sides.cowboy.deckCount) && s.cardBacks > 0 && backHash === fileHash,
      {hand: s.hand.map((card) => card.name), engineHand: opening.sides.cowboy.hand.map((id) => CARDS[id].name),
        frontArtPresent: s.hand.map((card) => card.hasArt),
        glowingCards: s.hand.filter((card) => card.outlined).map((card) => card.name), catalogArt, flipped,
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
      const effect = animation.effect;
      const cueArrivalMs = effect.getTiming().duration * effect.getKeyframes()[2].computedOffset;
      animation.currentTime = cueArrivalMs;
      const face = node.querySelector(".front-face");
      const layerDepth = (layer) => {
        const transform = layer && getComputedStyle(layer).transform;
        return transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m43 : 0;
      };
      const faceDepth = layerDepth(face);
      const paperDepth = layerDepth(node.querySelector(".card-slice:last-child"));
      const illustratedFace = face?.dataset.unit === "Sheriff"
        && getComputedStyle(face).backgroundImage.startsWith("url(")
        && faceDepth > paperDepth;
      const box = node.getBoundingClientRect();
      animation.currentTime = elapsed;
      animation.play();
      return {x: box.left + box.width / 2, y: box.top + box.height / 2, illustratedFace, faceDepth, paperDepth, cueArrivalMs};
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
      ready.buttons.confirm && placed?.text === "Sheriff 3/3" && s.hand.length === 3 && summonSeen.has("playing") && s.status === "accepting_input" && landingError !== null && landingError < 4
        && flightLanding.illustratedFace && Math.abs(flightLanding.cueArrivalMs - SHERIFF_LANDING.impact) < 0.1,
      {flightLanding, expectedLanding, landingError, lanePickedBy: pickedBy, canvasTilePoints: tilePoints, uncoveredTiles: free.map((point) => point.slot), slot,
        promptBeforeConfirm: ready.prompt, laneSummary: placed?.text, laneLabel: placed?.label, handAfter: s.hand.map((card) => card.name),
        statusesSeen: [...summonSeen]});

    // Step 5: end phase; the CPU acts and the clash plays.
    const before = s;
    const endedAt = await endPhaseClick();
    const clashSeen = new Set();
    s = await settle("the CPU turn and the clash", clashSeen);
    notePace("step 5 end phase to next Cowboy turn", endedAt, s);
    await screenshot("round-two.png");
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

const seed = showcase ? 60 : chooseSeed();
const expectedSteps = escapeOnly ? 2 : showcase ? 4 : 8;
const tilePoints = showcase || escapeOnly ? [] : await cowboyTilePoints();
const attempts = [];
let run = await runOnce(seed, args.includes("--swiftshader") ? SWIFTSHADER : [], tilePoints);
if (run.webglFailed && !args.includes("--swiftshader")) {
  attempts.push({flags: run.flags, webglFailed: true, consoleErrors: run.consoleErrors});
  run = await runOnce(seed, SWIFTSHADER, tilePoints);
}
async function resourceBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} while loading ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
const pageBytes = servedUrl ? await resourceBytes(baseUrl) : await readFile(pagePath);
const result = {
  date: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles", timeZoneName: "short"}),
  commit: shell("git", ["rev-parse", "--short", "HEAD"]),
  uncommittedChanges: Boolean(shell("git", ["status", "--porcelain"])),
  machine: {model: shell("sysctl", ["-n", "hw.model"]), cpu: os.cpus()[0]?.model, memoryGB: Math.round(os.totalmem() / 2 ** 30),
    macOS: shell("sw_vers", ["-productVersion"]), arch: os.arch(), node: process.version},
  page: {file: servedUrl ? baseUrl.href : "dist/cowboys-vs-wizards-board-duel.html", bytes: pageBytes.length, sha256: sha256(pageBytes)},
  viewport: [WIDTH, HEIGHT],
  seed,
  openingHand: publicState(createMatch(seed), "cowboy").sides.cowboy.hand.map((id) => CARDS[id].name),
  earlierAttempts: attempts,
  ...run,
  warnings: {count: run.warnings.length, first: [...new Set(run.warnings)].slice(0, 8)},
};
await mkdir(outDir, {recursive: true});
await writeFile(path.join(outDir, "browser-run.json"), JSON.stringify(result, null, 2) + "\n");
if (args.includes("--summary")) {
  console.log(`Chrome ${result.chrome} · revision ${result.commit ?? "unavailable"} · seed ${result.seed}`);
  console.log(`Build SHA-256 ${result.page.sha256}`);
  console.log(`Browser receipt ${path.relative(root, path.join(outDir, "browser-run.json"))}`);
  for (const each of result.paceObservations ?? []) console.log(`pace ${result.pace.requested ?? "unflagged"} · ${each.label}: ${each.elapsedMs} ms (${each.observedStatus})`);
} else console.log(JSON.stringify(result, null, 2));
const pending = result.steps.filter((each) => each.state !== "observed").map((each) => each.id);
console.log(`\nobserved ${result.steps.length - pending.length} of ${expectedSteps} steps; pending: ${pending.join(", ") || "none"}; console errors: ${result.consoleErrors.length}`);
process.exitCode = result.error || pending.length || result.steps.length !== expectedSteps || result.consoleErrors.length ? 1 : 0;
