// Focused headless Chrome QA for the standalone graybox build (`npm run build` ->
// dist/cowboys-vs-wizards-board-duel.html). Speaks CDP over Node's built-in
// WebSocket against a fresh temporary Chrome profile with real mouse/key input.
//
//   npm run build && node scripts/browser-graybox-check.mjs [--url URL] [--out-dir PATH] [--summary]
import {execFileSync, spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {applyAction} from "../src/game/actions.js";
import {CARDS} from "../src/game/cards.js";
import {chooseAction} from "../src/game/cpu.js";
import {createMatch} from "../src/game/state.js";
import {publicState} from "../src/game/view.js";
import {playMatch} from "./play-match.mjs";

const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DESKTOP = {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false};
const NARROW = {width: 390, height: 844, deviceScaleFactor: 1, mobile: true};
const root = fileURLToPath(new URL("../", import.meta.url));
const pagePath = path.join(root, "dist/cowboys-vs-wizards-board-duel.html");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const servedUrl = option("--url");
if (args.includes("--url") && (!servedUrl || servedUrl.startsWith("--"))) {
  throw new Error("--url needs a page URL");
}
const outputArg = option("--out-dir");
if (args.includes("--out-dir") && (!outputArg || outputArg.startsWith("--"))) {
  throw new Error("--out-dir needs a directory");
}
const outDir = outputArg ? path.resolve(outputArg) : path.join(root, ".artifacts/card-rd/graybox-replay");
const baseUrl = servedUrl ? new URL(servedUrl) : pathToFileURL(pagePath);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const shell = (command, list) => {
  try {
    return execFileSync(command, list, {cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim();
  } catch {
    return null;
  }
};

async function launchChrome() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "ag-graybox-chrome-"));
  const child = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--mute-audio",
    "--hide-scrollbars",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    `--window-size=${DESKTOP.width},${DESKTOP.height}`,
    "about:blank",
  ], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const wsUrl = await new Promise((resolve, reject) => {
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
    wsUrl,
    profileDir: path.basename(profile),
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000).unref())]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      child.stderr.destroy();
      await rm(profile, {recursive: true, force: true, maxRetries: 5});
    },
  };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const waiting = new Map();
    const listeners = new Set();
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

const SNAPSHOT = `(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (n) => (n ? n.textContent.trim() : null);
  const title = $("#title-screen");
  const arena = $("#arena");
  const match = $("#match");
  if (!title || !arena || !match) return {loading: true};
  const baseInfo = (node) => {
    if (!node) return null;
    const rows = $$(".plain-orbs", node);
    const spans = $$(".plain-orbs > span", node);
    const filled = $$(".plain-orbs > span.filled", node);
    const clone = node.cloneNode(true);
    for (const child of $$(".plain-orbs", clone)) child.remove();
    return {
      text: clone.textContent.trim(),
      orbRows: rows.length,
      orbsTotal: spans.length,
      orbsFilled: filled.length,
    };
  };
  const dialog = $("dialog.match-details", match);
  const clash = $(".match-clash-log", match);
  const panel = $(".selection-panel", match);
  const actions = $(".selection-actions", match);
  const prompt = $(".match-prompt", match);
  const message = $(".match-message", match);
  return {
    titleHidden: title.hidden,
    titleReady: title.dataset.ready === "true",
    arenaHidden: arena.hidden,
    status: match.dataset.status ?? null,
    summary: text($(".plain-match-summary", match)),
    details: text($("p", dialog)),
    seed: text($("code", dialog)),
    seedKind: text($(".match-line .match-muted", dialog)),
    dialogOpen: Boolean(dialog?.open),
    panelHidden: Boolean(panel?.hidden),
    actionsHidden: Boolean(actions?.hidden),
    prompt: text(prompt),
    message: !message || message.hidden ? "" : text(message),
    forecastsInDom: $$(".plain-forecast", match).map((n) => ({
      side: n.closest(".match-slot")?.dataset.side ?? null,
      slot: Number(n.closest(".match-slot")?.dataset.slot ?? -1),
      text: text(n),
    })),
    lanes: $$(".match-slot", match).map((b) => {
      const r = b.getBoundingClientRect();
      return {
        side: b.dataset.side,
        slot: Number(b.dataset.slot),
        heading: text($("small:not(.plain-forecast)", b)),
        name: text($("strong", b)),
        orbRows: $$(".plain-orbs", b).length,
        orbsTotal: $$(".plain-orbs > span", b).length,
        orbsFilled: $$(".plain-orbs > span.filled", b).length,
        forecast: text($(".plain-forecast", b)),
        label: b.getAttribute("aria-label"),
        disabled: b.disabled,
        pressed: b.getAttribute("aria-pressed") === "true",
        rect: {left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10,
          right: Math.round(r.right * 10) / 10, bottom: Math.round(r.bottom * 10) / 10,
          width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10},
      };
    }),
    handCountLabel: text($(".hand-count", match)),
    hand: $$(".match-hand .card-front", match).map((b) => {
      const r = b.getBoundingClientRect();
      return {
        cardId: b.dataset.cardId,
        name: text($(".plain-card-name", b)),
        stats: text($(".plain-card-stats", b)),
        cost: text($(".plain-card-cost", b)),
        playable: b.dataset.playable === "true",
        pressed: b.getAttribute("aria-pressed") === "true",
        disabled: b.disabled,
        clipped: b.scrollWidth > b.clientWidth + 1,
        rect: {left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10,
          right: Math.round(r.right * 10) / 10, bottom: Math.round(r.bottom * 10) / 10,
          width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10},
      };
    }),
    cowboyDeck: text($(".match-own .match-count", match)),
    wizardDeck: text($(".match-opponent .match-count", match)),
    wizardHand: text($(".match-opponent .match-backs", match)),
    cowboyBase: baseInfo($(".match-own .match-base", match)),
    wizardBase: baseInfo($(".match-opponent .match-base", match)),
    buttons: Object.fromEntries($$(".match-buttons button, dialog.match-details [data-action=restart]", match)
      .map((b) => [b.dataset.action, {enabled: !b.disabled, hidden: Boolean(b.closest("[hidden]"))}])),
    clashLog: clash ? {title: text($("strong", clash)), lines: $$("li", clash).map((li) => text(li))} : null,
    viewport: {width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight},
    savedProfileRaw: localStorage.getItem("cvw-player-v1"),
  };
})()`;

const laneOf = (s, side, slot) => s.lanes.find((each) => each.side === side && each.slot === slot);
const compactBoard = (s) => s.lanes
  .map((each) => `${each.side[0].toUpperCase()}${each.slot + 1}:${each.name}${each.orbsTotal ? `(${each.orbsFilled}/${each.orbsTotal})` : ""}`)
  .join(" | ");
const boxesOverlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const anyOverlap = (rects) => {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (boxesOverlap(rects[i], rects[j])) return [i, j];
    }
  }
  return null;
};

const pageHtml = servedUrl ? null : await readFile(pagePath, "utf8");
const pageBytes = servedUrl ? Buffer.from(await (await fetch(baseUrl)).arrayBuffer()) : Buffer.from(pageHtml, "utf8");
const externalRefs = pageHtml
  ? [...pageHtml.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((ref) => !ref.startsWith("data:") && !ref.startsWith("#"))
  : [];

const chrome = await launchChrome();
let cdp = null;
await mkdir(outDir, {recursive: true});

const report = {
  date: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles", timeZoneName: "short"}),
  commit: shell("git", ["rev-parse", "--short", "HEAD"]),
  branch: shell("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
  uncommittedChanges: Boolean(shell("git", ["status", "--porcelain"])),
  machine: {
    model: shell("sysctl", ["-n", "hw.model"]),
    cpu: os.cpus()[0]?.model ?? null,
    memoryGB: Math.round(os.totalmem() / 2 ** 30),
    macOS: shell("sw_vers", ["-productVersion"]),
    arch: os.arch(),
    node: process.version,
  },
  page: {
    file: servedUrl ? baseUrl.href : path.relative(root, pagePath),
    bytes: pageBytes.length,
    sha256: sha256(pageBytes),
    externalMarkupRefs: externalRefs,
  },
  browser: null,
  freshProfileDir: chrome.profileDir,
  externalRequests: [],
  consoleErrors: [],
  warnings: [],
  screenshots: [],
  steps: [],
};

try {
  cdp = await connect(chrome.wsUrl);
  const version = await cdp.send("Browser.getVersion");
  report.browser = {
    product: version.product,
    revision: version.revision,
    jsVersion: version.jsVersion,
    userAgent: version.userAgent,
  };
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
    } else if (method === "Network.requestWillBeSent") {
      const reqUrl = params.request?.url ?? "";
      if (!reqUrl.startsWith("file:") && !reqUrl.startsWith("data:") && !reqUrl.startsWith("about:")) {
        report.externalRequests.push(reqUrl);
      }
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", DESKTOP);
  await send("Emulation.setFocusEmulationEnabled", {enabled: true});
  await send("Page.bringToFront");

  async function evaluate(expression) {
    const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (exceptionDetails) throw new Error(`page: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  }
  const snapshot = () => evaluate(SNAPSHOT);
  async function waitFor(label, predicate, timeout = 15000) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeout) {
      try {
        last = await snapshot();
      } catch {
        last = {loading: true};
      }
      if (!last.loading && predicate(last)) return last;
      await sleep(50);
    }
    throw new Error(`timed out waiting for ${label} (status=${last?.status}, summary=${last?.summary})`);
  }
  async function mouseClick(x, y) {
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", x, y});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1});
  }
  async function click(selector) {
    const box = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return {error: "missing"};
      if (node.disabled) return {error: "disabled"};
      node.scrollIntoView({block: "nearest", inline: "nearest"});
      const r = node.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return {error: "zero-size"};
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !node.contains(hit)) {
        return {error: "covered by " + (hit ? hit.tagName + (hit.className ? "." + hit.className : "") : "nothing")};
      }
      return {x, y};
    })()`);
    if (box.error) throw new Error(`cannot click ${selector}: ${box.error}`);
    await mouseClick(box.x, box.y);
  }
  async function keyPress(key, code, keyCode, text = undefined) {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      ...(text ? {text} : {}),
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    });
  }
  async function typeSeed(text) {
    const selector = 'dialog.match-details input[aria-label="Seed to replay"]';
    await click(selector);
    await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (document.activeElement !== input) throw new Error("seed input did not focus");
      input.select();
    })()`);
    await keyPress("Backspace", "Backspace", 8);
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0);
      await keyPress(ch, `Digit${ch}`, code, ch);
    }
    const typed = await evaluate(`document.querySelector(${JSON.stringify(selector)}).value`);
    if (typed !== String(text)) throw new Error(`expected seed input "${text}", got "${typed}"`);
  }
  async function screenshot(name) {
    const {data} = await send("Page.captureScreenshot", {format: "png"});
    const file = path.join(outDir, name);
    await writeFile(file, Buffer.from(data, "base64"));
    report.screenshots.push(outputArg ? file : path.relative(root, file));
  }
  const recordStep = (id, title, ok, detail) => {
    report.steps.push({id, title, state: ok ? "observed" : "pending", detail});
  };
  const cardSelector = (cardId) => `#match .match-hand [data-card-id="${cardId}"]`;
  const laneSelector = (side, slot) => `#match .match-slot[data-side="${side}"][data-slot="${slot}"]`;
  const actionSelector = (name) => `#match .match-buttons [data-action="${name}"]`;
  const noForecastsShown = (s) => s.forecastsInDom.length === 0
    && s.lanes.every((each) => each.forecast === null && !each.label?.includes("Clash preview"))
    && !s.prompt?.includes("Clash preview");
  const validFiveMarkerBases = (s) => [s.cowboyBase, s.wizardBase].every((base) =>
    base && base.orbRows === 1 && base.orbsTotal === 5 && base.text === `Base ${base.orbsFilled}/5`);

  // Step 1: standalone build loads into a fresh profile; title menu and 12-card deck workbench work.
  await send("Page.navigate", {url: baseUrl.href});
  const boot = await waitFor("title screen ready", (x) => x.titleReady && !x.titleHidden && x.arenaHidden);
  const freshStorageEmpty = boot.savedProfileRaw === null;
  await click('[data-menu-page="deck"]');
  const deckCheck = await evaluate(`(() => {
    const page = document.querySelector("#title-screen .menu-page");
    const rows = [...document.querySelectorAll(".deck-row")].map((r) => ({
      name: r.querySelector(".deck-row-name")?.textContent.trim(),
      count: Number(r.querySelector(".deck-count")?.textContent.trim()),
    }));
    return {
      open: !page.hidden,
      heading: document.getElementById("menu-page-title")?.textContent.trim(),
      rows,
      total: rows.reduce((sum, each) => sum + each.count, 0),
    };
  })()`);
  await click("#menu-back");
  await waitFor("return to main menu", (x) => !x.titleHidden && x.arenaHidden);
  const afterDeckBack = await snapshot();
  recordStep(1, "Standalone build boots on a fresh profile with no external requests and a 12-card deck workbench",
    freshStorageEmpty && afterDeckBack.savedProfileRaw === null && externalRefs.length === 0
      && report.externalRequests.length === 0 && deckCheck.open && deckCheck.heading === "Build Deck"
      && deckCheck.total === 12 && deckCheck.rows.length === 4,
    {freshStorageEmpty, deckWorkbench: deckCheck, externalMarkupRefs: externalRefs.length, externalRequests: report.externalRequests.length});

  // Step 2: guided seed 0, candidate previews, cancel (button + Escape) leaving hand/lane unchanged and clearing previews.
  await evaluate(`window.__escapePrevented = []; window.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__escapePrevented.push(e.defaultPrevented); })`);
  await click('[data-menu-page="how"]');
  await click("#menu-guide");
  const seed0Open = await waitFor("guided seed 0 opening", (x) => !x.arenaHidden && x.status === "accepting_input" && x.seed === "0");
  const engineSeed0 = publicState(createMatch(0), "cowboy");
  const stateSignature = (s) => JSON.stringify({
    summary: s.summary,
    hand: s.hand.map((c) => c.cardId),
    lanes: s.lanes.map((l) => [l.side, l.slot, l.name, l.orbsFilled, l.orbsTotal]),
    bases: [s.cowboyBase, s.wizardBase],
    decks: [s.cowboyDeck, s.wizardDeck, s.wizardHand],
  });
  const seed0BeforeSig = stateSignature(seed0Open);
  const seed0Sheriff = seed0Open.hand.find((c) => c.name === "Sheriff");

  await click(cardSelector(seed0Sheriff.cardId));
  const seed0SlotStep = await waitFor("seed 0 Sheriff slot step", (x) => x.hand.some((c) => c.cardId === seed0Sheriff.cardId && c.pressed));
  await screenshot("01-guided-seed-0-previews.png");
  const allThreePreviews = [0, 1, 2].every((slot) => laneOf(seed0SlotStep, "cowboy", slot)?.forecast === "Enemy base 5 → 4")
    && seed0SlotStep.forecastsInDom.length === 3
    && seed0SlotStep.prompt.includes("Clash preview assumes the rest of the board stays as shown.");

  await click(laneSelector("cowboy", 1));
  const seed0ConfirmStep = await waitFor("seed 0 center-lane confirm step", (x) => x.buttons.confirm?.enabled);
  const centerPreviewOnly = laneOf(seed0ConfirmStep, "cowboy", 1)?.forecast === "Enemy base 5 → 4"
    && seed0ConfirmStep.forecastsInDom.length === 1;

  await click(actionSelector("cancel"));
  const seed0AfterCancelBtn = await waitFor("seed 0 cancel button applied", (x) => !x.hand.some((c) => c.pressed));
  await screenshot("02-guided-seed-0-cancelled.png");
  const cancelBtnClean = stateSignature(seed0AfterCancelBtn) === seed0BeforeSig
    && noForecastsShown(seed0AfterCancelBtn)
    && seed0AfterCancelBtn.actionsHidden;

  await click(cardSelector(seed0Sheriff.cardId));
  await click(laneSelector("cowboy", 1));
  await waitFor("seed 0 reselected confirm step", (x) => x.buttons.confirm?.enabled && x.forecastsInDom.length === 1);
  await click('#match [data-action="menu"]');
  await waitFor("seed 0 duel menu open with active selection", (x) => x.dialogOpen);
  await keyPress("Escape", "Escape", 27);
  const seed0AfterDialogEscape = await waitFor("seed 0 duel menu closed by Escape", (x) => !x.dialogOpen);
  const dialogEscapePreservedSelection = seed0AfterDialogEscape.buttons.confirm?.enabled
    && seed0AfterDialogEscape.forecastsInDom.length === 1;
  await evaluate("window.__escapePrevented.splice(0)");
  await keyPress("Escape", "Escape", 27);
  const seed0AfterEscape = await waitFor("seed 0 Escape cancel applied", (x) => !x.hand.some((c) => c.pressed));
  const escapePrevented = await evaluate("window.__escapePrevented.splice(0)");
  const escapeClean = dialogEscapePreservedSelection
    && escapePrevented.join(",") === "true"
    && stateSignature(seed0AfterEscape) === seed0BeforeSig
    && noForecastsShown(seed0AfterEscape);

  await click(cardSelector(seed0Sheriff.cardId));
  await click(laneSelector("cowboy", 1));
  await click(actionSelector("confirm"));
  const seed0AfterSummon = await waitFor("seed 0 Sheriff summoned", (x) => x.hand.length === 3 && x.status === "accepting_input");
  const centerSheriff = laneOf(seed0AfterSummon, "cowboy", 1);
  const seed0SummonOk = centerSheriff?.name === "Sheriff" && centerSheriff.orbsFilled === 3 && centerSheriff.orbsTotal === 3
    && noForecastsShown(seed0AfterSummon);

  await click(actionSelector("end-phase"));
  const seed0Round2 = await waitFor("seed 0 round 2", (x) => x.status === "accepting_input" && x.summary?.startsWith("Round 2 ·"));
  const expectedSeed0Round2 = (() => {
    let st = createMatch(0);
    st = applyAction(st, {type: "summon", side: "cowboy", revision: st.revision, cardId: seed0Sheriff.cardId, slot: 1, tributes: [], actionId: "a1"}).state;
    st = applyAction(st, {type: "end-phase", side: "cowboy", revision: st.revision, actionId: "a2"}).state;
    let step = 2;
    while (st.activeSide === "wizard" && !st.result) {
      const cpuAct = chooseAction(publicState(st, "wizard"));
      st = applyAction(st, {...cpuAct, actionId: `a${++step}`}).state;
    }
    return publicState(st, "cowboy");
  })();
  const round2CenterCowboy = laneOf(seed0Round2, "cowboy", 1);
  const round2CenterWizard = laneOf(seed0Round2, "wizard", 1);
  const round2MatchesEngine = JSON.stringify(seed0Round2.hand.map((c) => c.cardId)) === JSON.stringify(expectedSeed0Round2.sides.cowboy.hand)
    && seed0Round2.cowboyBase?.orbsFilled === expectedSeed0Round2.sides.cowboy.baseOrbs
    && seed0Round2.wizardBase?.orbsFilled === expectedSeed0Round2.sides.wizard.baseOrbs
    && [0, 1, 2].every((slot) => {
      const cTroop = expectedSeed0Round2.sides.cowboy.board[slot];
      const wTroop = expectedSeed0Round2.sides.wizard.board[slot];
      return laneOf(seed0Round2, "cowboy", slot)?.orbsFilled === (cTroop?.health ?? 0)
        && laneOf(seed0Round2, "wizard", slot)?.orbsFilled === (wTroop?.health ?? 0);
    });
  recordStep(2, "Guided seed 0 shows hints and clash previews, clears previews on Cancel and Escape with hand/lane unchanged, and reaches Round 2",
    seed0Open.seed === "0" && seed0Open.seedKind === "(pinned)" && !seed0Open.panelHidden && seed0Open.actionsHidden
      && seed0Open.prompt.includes("Glowing cards in your hand")
      && JSON.stringify(seed0Open.hand.map((c) => c.cardId)) === JSON.stringify(engineSeed0.sides.cowboy.hand)
      && noForecastsShown(seed0Open) && validFiveMarkerBases(seed0Open)
      && allThreePreviews && centerPreviewOnly && cancelBtnClean && escapeClean && seed0SummonOk
      && round2MatchesEngine && validFiveMarkerBases(seed0Round2)
      && seed0Round2.clashLog?.title === "Round 1 clash"
      && seed0Round2.clashLog?.lines.includes("Your Sheriff in lane 2 hit the Skeleton: 3 → 2 orbs")
      && seed0Round2.clashLog?.lines.includes("Skeleton in lane 2 hit your Sheriff: 3 → 2 orbs"),
    {
      openingPrompt: seed0Open.prompt,
      slotPreviews: seed0SlotStep.forecastsInDom,
      confirmPreview: seed0ConfirmStep.forecastsInDom,
      afterCancelForecasts: seed0AfterCancelBtn.forecastsInDom.length,
      afterEscapeForecasts: seed0AfterEscape.forecastsInDom.length,
      escapePrevented,
      handBefore: seed0Open.hand.map((c) => c.name),
      handAfterCancel: seed0AfterCancelBtn.hand.map((c) => c.name),
      centerLaneAfterCancel: laneOf(seed0AfterCancelBtn, "cowboy", 1)?.name,
      centerLaneAfterSummon: `${centerSheriff?.name} ${centerSheriff?.orbsFilled}/${centerSheriff?.orbsTotal}`,
      round2Summary: seed0Round2.summary,
      round2Center: `${round2CenterCowboy?.name} ${round2CenterCowboy?.orbsFilled}/${round2CenterCowboy?.orbsTotal} vs ${round2CenterWizard?.name} ${round2CenterWizard?.orbsFilled}/${round2CenterWizard?.orbsTotal}`,
      round1ClashLog: seed0Round2.clashLog,
    });

  // Helper to play the deterministic Seed 60 Cowboy route through Round 5 -> Round 6.
  const seed60Route = playMatch(60, {cowboy: chooseAction, wizard: chooseAction}).log
    .filter(({round, side}) => side === "cowboy" && round <= 5);

  async function playSeed60Route(captureMilestones) {
    const observed = {};
    for (const {round, action} of seed60Route) {
      if (action.type === "end-phase") {
        if (round === 5) {
          const beforeShowdown = await snapshot();
          observed.round5Faceoff = {
            cowboyCenter: laneOf(beforeShowdown, "cowboy", 1),
            wizardCenter: laneOf(beforeShowdown, "wizard", 1),
            board: compactBoard(beforeShowdown),
          };
          if (captureMilestones) await screenshot("04-seed-60-round-5-faceoff.png");
        }
        await click(actionSelector("end-phase"));
        const next = await waitFor(`seed 60 round ${round + 1}`, (x) =>
          x.status === "accepting_input" && x.summary?.startsWith(`Round ${round + 1} ·`));
        if (round === 2) observed.afterRound2ClashLog = next.clashLog;
        if (round === 4) {
          observed.afterRound4Singularity = {
            clashLog: next.clashLog,
            cowboyCenter: laneOf(next, "cowboy", 1),
            cowboyRight: laneOf(next, "cowboy", 2),
            wizardCenter: laneOf(next, "wizard", 1),
            board: compactBoard(next),
          };
        }
      } else if (action.type === "summon") {
        if (captureMilestones && round === 4) {
          const beforeTributeCancel = stateSignature(await snapshot());
          await click(cardSelector(action.cardId));
          await waitFor("round 4 tribute card selected", (x) => x.hand.some((c) => c.cardId === action.cardId && c.pressed));
          for (const tribute of action.tributes) await click(laneSelector("cowboy", tribute));
          const withTributePreviews = await waitFor("round 4 tribute previews shown", (x) => x.forecastsInDom.length === 3);
          await click(actionSelector("cancel"));
          const afterTributeCancel = await waitFor("round 4 tribute cancel applied", (x) => !x.hand.some((c) => c.pressed));
          observed.twoTributeCancel = {
            previewsBeforeCancel: withTributePreviews.forecastsInDom.length,
            tributesPressedAfterCancel: afterTributeCancel.lanes.filter((l) => l.pressed).length,
            unchanged: stateSignature(afterTributeCancel) === beforeTributeCancel && noForecastsShown(afterTributeCancel),
          };
        }
        await click(cardSelector(action.cardId));
        let stepState = await waitFor("summon card selected", (x) => x.hand.some((c) => c.cardId === action.cardId && c.pressed));
        const forecastsBeforeTributes = stepState.forecastsInDom.length;
        for (const tribute of action.tributes) {
          await click(laneSelector("cowboy", tribute));
          stepState = await snapshot();
        }
        const forecastsAtSlotStep = stepState.forecastsInDom;
        await click(laneSelector("cowboy", action.slot));
        stepState = await waitFor("summon confirm enabled", (x) => x.buttons.confirm?.enabled);
        const forecastsAtConfirm = stepState.forecastsInDom;
        await click(actionSelector("confirm"));
        const settled = await waitFor("summon settled", (x) => x.status === "accepting_input" && !x.hand.some((c) => c.pressed));
        if (round === 1) {
          observed.normalSummon = {
            lane1: laneOf(settled, "cowboy", 0),
            forecastsAtSlotStep,
            forecastsAfterConfirm: settled.forecastsInDom.length,
          };
        } else if (round === 3) {
          observed.oneTributeSummon = {
            tributes: action.tributes,
            forecastsBeforeTributes,
            forecastsAtSlotStep,
            forecastsAtConfirm,
            vacatedLane1: laneOf(settled, "cowboy", 0)?.name,
            placedLane3: laneOf(settled, "cowboy", 2),
          };
        } else if (round === 4) {
          observed.twoTributeSummon = {
            tributes: action.tributes,
            forecastsBeforeTributes,
            forecastsAtSlotStep,
            forecastsAtConfirm,
            vacatedLane2: laneOf(settled, "cowboy", 1)?.name,
            placedLane3: laneOf(settled, "cowboy", 2),
            board: compactBoard(settled),
          };
          if (captureMilestones) await screenshot("03-seed-60-mounted-billy.png");
        }
      } else if (action.type === "spell") {
        const beforeSpell = await snapshot();
        const skeletonBefore = laneOf(beforeSpell, "wizard", action.target);
        await click(cardSelector(action.cardId));
        const targetStep = await waitFor("spell target step", (x) => x.hand.some((c) => c.cardId === action.cardId && c.pressed));
        await click(laneSelector("wizard", action.target));
        const confirmSpell = await waitFor("spell confirm step", (x) => x.buttons.confirm?.enabled);
        await click(actionSelector("confirm"));
        const afterSpell = await waitFor("spell settled", (x) => x.status === "accepting_input" && !x.hand.some((c) => c.pressed));
        observed.deadeye = {
          forecastsDuringSpell: targetStep.forecastsInDom.length + confirmSpell.forecastsInDom.length,
          targetBefore: `${skeletonBefore?.name} ${skeletonBefore?.orbsFilled}/${skeletonBefore?.orbsTotal}`,
          targetAfter: `${laneOf(afterSpell, "wizard", action.target)?.name} ${laneOf(afterSpell, "wizard", action.target)?.orbsFilled}/${laneOf(afterSpell, "wizard", action.target)?.orbsTotal}`,
        };
      }
    }
    const round6 = await snapshot();
    if (captureMilestones) await screenshot("05-seed-60-round-6-result.png");
    observed.round6 = {
      summary: round6.summary,
      board: compactBoard(round6),
      dragonCenter: laneOf(round6, "wizard", 1),
      cowboyCenter: laneOf(round6, "cowboy", 1),
      cowboyBase: round6.cowboyBase,
      wizardBase: round6.wizardBase,
      clashLog: round6.clashLog,
      hand: round6.hand.map((c) => c.cardId),
    };
    return {observed, round6};
  }

  // Step 3: enter Seed 60 via Duel menu Replay control, verify preview cancel on Seed 60, then play full Seed 60 route.
  await click('#match [data-action="menu"]');
  await waitFor("duel menu open", (x) => x.dialogOpen);
  await typeSeed(60);
  await click('dialog.match-details .match-seed button[type="submit"]');
  const seed60Open = await waitFor("seed 60 opening", (x) => !x.dialogOpen && x.status === "accepting_input" && x.seed === "60" && x.summary?.startsWith("Round 1 ·"));
  const seed60BeforeSig = stateSignature(seed60Open);
  const firstSheriff60 = seed60Open.hand.find((c) => c.name === "Sheriff");
  await click(cardSelector(firstSheriff60.cardId));
  const seed60PreviewStep = await waitFor("seed 60 preview step", (x) => x.forecastsInDom.length === 3);
  const blockedPreviewText = laneOf(seed60PreviewStep, "cowboy", 0)?.forecast;
  await click(laneSelector("cowboy", 0));
  await waitFor("seed 60 confirm step", (x) => x.buttons.confirm?.enabled && x.forecastsInDom.length === 1);
  await click(actionSelector("cancel"));
  const seed60AfterCancel = await waitFor("seed 60 cancel applied", (x) => !x.hand.some((c) => c.pressed));
  const seed60CancelClean = stateSignature(seed60AfterCancel) === seed60BeforeSig && noForecastsShown(seed60AfterCancel);

  const firstReplay = await playSeed60Route(true);
  const obs = firstReplay.observed;
  const r6 = obs.round6;
  const clash5Lines = r6.clashLog?.lines ?? [];
  const bothShowdownHitsObserved = clash5Lines.includes("Your Mounted Billy in lane 2 hit the Dragon: 5 → 2 orbs")
    && clash5Lines.includes("Dragon in lane 2 hit your Mounted Billy: 3 → 0 orbs")
    && clash5Lines.includes("Your Mounted Billy in lane 2 was defeated");
  const singularityObserved = (obs.afterRound4Singularity?.clashLog?.lines ?? [])
    .includes("Singularity hit your Mounted Billy in lane 3: 5 → 4 orbs, then moved it to lane 2")
    && obs.afterRound4Singularity?.cowboyCenter?.name === "Mounted Billy"
    && obs.afterRound4Singularity?.cowboyRight?.name === "Empty";

  recordStep(3, "Seed 60 replay via Duel menu covers normal summon, 1 and 2 tributes, Deadeye, Singularity, and Round 5 showdown to Dragon 2/5 with empty Cowboy center and single 5-marker Base rows",
    seed60Open.seed === "60" && seed60Open.seedKind === "(pinned)"
      && blockedPreviewText === "Skeleton 3 → 2 · Sheriff 3 → 2"
      && seed60CancelClean
      && obs.normalSummon?.lane1?.name === "Sheriff" && obs.normalSummon?.lane1?.orbsFilled === 3
      && obs.normalSummon?.forecastsAfterConfirm === 0
      && obs.deadeye?.forecastsDuringSpell === 0
      && obs.deadeye?.targetBefore === "Skeleton 2/3" && obs.deadeye?.targetAfter === "Skeleton 1/3"
      && obs.oneTributeSummon?.forecastsBeforeTributes === 0 && obs.oneTributeSummon?.forecastsAtSlotStep.length === 2
      && obs.oneTributeSummon?.vacatedLane1 === "Empty" && obs.oneTributeSummon?.placedLane3?.name === "Billy"
      && obs.twoTributeCancel?.unchanged
      && obs.twoTributeSummon?.forecastsBeforeTributes === 0 && obs.twoTributeSummon?.forecastsAtSlotStep.length === 3
      && obs.twoTributeSummon?.vacatedLane2 === "Empty"
      && obs.twoTributeSummon?.placedLane3?.name === "Mounted Billy" && obs.twoTributeSummon?.placedLane3?.orbsFilled === 5
      && singularityObserved
      && obs.round5Faceoff?.cowboyCenter?.name === "Mounted Billy" && obs.round5Faceoff?.cowboyCenter?.orbsFilled === 3
      && obs.round5Faceoff?.wizardCenter?.name === "Dragon" && obs.round5Faceoff?.wizardCenter?.orbsFilled === 5
      && bothShowdownHitsObserved
      && r6.dragonCenter?.name === "Dragon" && r6.dragonCenter?.orbRows === 1
      && r6.dragonCenter?.orbsFilled === 2 && r6.dragonCenter?.orbsTotal === 5
      && r6.cowboyCenter?.name === "Empty" && r6.cowboyCenter?.orbRows === 0
      && validFiveMarkerBases(firstReplay.round6),
    {
      blockedLanePreviewBeforeCancel: blockedPreviewText,
      seed60CancelClean,
      normalSummon: `${obs.normalSummon?.lane1?.name} ${obs.normalSummon?.lane1?.orbsFilled}/${obs.normalSummon?.lane1?.orbsTotal}`,
      deadeye: obs.deadeye,
      oneTribute: {
        forecastsBeforeTributes: obs.oneTributeSummon?.forecastsBeforeTributes,
        forecastsAfterTribute: obs.oneTributeSummon?.forecastsAtSlotStep,
        vacatedLane1: obs.oneTributeSummon?.vacatedLane1,
        placedLane3: `${obs.oneTributeSummon?.placedLane3?.name} ${obs.oneTributeSummon?.placedLane3?.orbsFilled}/${obs.oneTributeSummon?.placedLane3?.orbsTotal}`,
      },
      twoTributes: {
        cancelCheck: obs.twoTributeCancel,
        forecastsBeforeTributes: obs.twoTributeSummon?.forecastsBeforeTributes,
        forecastsAfterTributes: obs.twoTributeSummon?.forecastsAtSlotStep,
        boardAfterSummon: obs.twoTributeSummon?.board,
      },
      singularity: {
        clashLog: obs.afterRound4Singularity?.clashLog,
        boardAtRound5: obs.afterRound4Singularity?.board,
      },
      round5Faceoff: obs.round5Faceoff?.board,
      round5ClashLog: r6.clashLog,
      round6Board: r6.board,
      dragonCenter: `${r6.dragonCenter?.name} ${r6.dragonCenter?.orbsFilled}/${r6.dragonCenter?.orbsTotal} (orbRows=${r6.dragonCenter?.orbRows})`,
      cowboyCenter: `${r6.cowboyCenter?.name} (orbRows=${r6.cowboyCenter?.orbRows})`,
      bases: {cowboy: r6.cowboyBase, wizard: r6.wizardBase},
    });

  // Step 4: repeat the exact Seed 60 replay via Restart without mid-selection cancel and confirm identical outcome.
  await click('#match [data-action="menu"]');
  await waitFor("duel menu open for restart", (x) => x.dialogOpen);
  await click('dialog.match-details [data-action="restart"]');
  const restarted60 = await waitFor("restarted seed 60", (x) => !x.dialogOpen && x.status === "accepting_input" && x.summary?.startsWith("Round 1 ·"));
  const secondReplay = await playSeed60Route(false);
  const replayMatches = stateSignature(restarted60) === seed60BeforeSig
    && JSON.stringify(secondReplay.observed.round6) === JSON.stringify(firstReplay.observed.round6);
  recordStep(4, "Repeating Seed 60 after Restart matches the cancelled-first replay byte-for-byte",
    replayMatches && validFiveMarkerBases(secondReplay.round6),
    {restartedClean: stateSignature(restarted60) === seed60BeforeSig, round6Board: secondReplay.observed.round6.board});

  // Step 5: narrow viewport (390x844) check for all six lanes and the complete hand (populated Round 6 + full 4-card opening with previews).
  await send("Emulation.setDeviceMetricsOverride", NARROW);
  await sleep(150);
  const narrowRound6 = await snapshot();
  await click('#match [data-action="menu"]');
  await waitFor("narrow duel menu open", (x) => x.dialogOpen);
  await click('dialog.match-details [data-action="restart"]');
  const narrowOpening = await waitFor("narrow seed 60 opening", (x) => !x.dialogOpen && x.status === "accepting_input" && x.hand.length === 4);
  await click(cardSelector(narrowOpening.hand.find((c) => c.name === "Sheriff").cardId));
  const narrowWithPreviews = await waitFor("narrow previews shown", (x) => x.forecastsInDom.length === 3);
  await screenshot("06-narrow-viewport-390x844.png");
  await click(actionSelector("cancel"));
  const narrowAfterCancel = await waitFor("narrow cancel applied", (x) => !x.hand.some((c) => c.pressed));

  const inspectLayout = (s, expectedHand) => {
    const w = s.viewport.width;
    const h = s.viewport.height;
    const noHorizontalOverflow = s.viewport.scrollWidth <= w;
    const lanesFitWidth = s.lanes.length === 6 && s.lanes.every((l) =>
      l.rect.width > 0 && l.rect.height > 0 && l.rect.left >= 0 && l.rect.right <= w);
    const lanesFitViewport = s.lanes.every((l) => l.rect.top >= 0 && l.rect.bottom <= h);
    const laneOverlap = anyOverlap(s.lanes.map((l) => l.rect));
    const handFitsWidth = s.hand.length === expectedHand && s.hand.every((c) =>
      c.rect.width > 0 && c.rect.height > 0 && c.rect.left >= 0 && c.rect.right <= w && !c.clipped);
    const handFitsViewport = s.hand.every((c) => c.rect.top >= 0 && c.rect.bottom <= h);
    const handOverlap = anyOverlap(s.hand.map((c) => c.rect));
    return {
      viewport: s.viewport,
      noHorizontalOverflow,
      laneCount: s.lanes.length,
      lanesFitWidth,
      lanesFitViewport,
      laneOverlap,
      minLaneSize: [Math.min(...s.lanes.map((l) => l.rect.width)), Math.min(...s.lanes.map((l) => l.rect.height))],
      handCount: s.hand.length,
      handFitsWidth,
      handFitsViewport,
      handOverlap,
      minCardSize: [Math.min(...s.hand.map((c) => c.rect.width)), Math.min(...s.hand.map((c) => c.rect.height))],
      basesValid: validFiveMarkerBases(s),
    };
  };
  const layoutRound6 = inspectLayout(narrowRound6, obs.round6.hand.length);
  const layoutOpening = inspectLayout(narrowOpening, 4);
  const layoutPreviews = inspectLayout(narrowWithPreviews, 4);
  const narrowOk = [layoutRound6, layoutOpening, layoutPreviews].every((l) =>
    l.noHorizontalOverflow && l.lanesFitWidth && l.lanesFitViewport && l.laneOverlap === null
      && l.handFitsWidth && l.handFitsViewport && l.handOverlap === null && l.basesValid)
    && noForecastsShown(narrowAfterCancel);

  recordStep(5, "Narrow viewport (390x844) renders all six lanes and the complete hand without horizontal overflow or overlap",
    narrowOk,
    {round6: layoutRound6, opening4CardHand: layoutOpening, withPreviews: layoutPreviews});
} catch (error) {
  report.error = error.stack ?? String(error);
} finally {
  cdp?.close();
  await chrome.close();
}

report.warnings = {count: report.warnings.length, first: [...new Set(report.warnings)].slice(0, 8)};
const receiptPath = path.join(outDir, "browser-run.json");
await writeFile(receiptPath, JSON.stringify(report, null, 2) + "\n");

const expectedSteps = 5;
const pending = report.steps.filter((each) => each.state !== "observed").map((each) => each.id);
if (args.includes("--summary")) {
  console.log(`${report.browser?.product ?? "Chrome"} · commit ${report.commit ?? "unknown"} · branch ${report.branch ?? "unknown"}`);
  console.log(`Build ${report.page.file} (${report.page.bytes} bytes, sha256 ${report.page.sha256})`);
  console.log(`Receipt ${path.relative(root, receiptPath)}`);
  for (const step of report.steps) {
    console.log(`[${step.state === "observed" ? "PASS" : "FAIL"}] Step ${step.id}: ${step.title}`);
  }
  if (report.error) console.error(report.error);
} else {
  console.log(JSON.stringify(report, null, 2));
}
console.log(`observed ${report.steps.length - pending.length} of ${expectedSteps} steps; pending: ${pending.join(", ") || "none"}; console errors: ${report.consoleErrors.length}; external requests: ${report.externalRequests.length}`);
process.exit(report.error || pending.length || report.steps.length !== expectedSteps || report.consoleErrors.length || report.externalRequests.length ? 1 : 0);
