// Singularity gallery replay: real-browser receipt for the bundled 3D diorama's Card gallery.
//   node scripts/build-graybox.mjs --diorama
//   node scripts/browser-showdown-singularity.mjs dist/cowboys-vs-wizards-showdown-3d.html .artifacts/kiro/singularity
// QA instrumentation only: no src/ change, no package. Native headless Chrome over the DevTools protocol (the
// same dependency-free launcher as scripts/browser-showdown-check.mjs; CHROME_PATH overrides the binary).
// It opens the page's own "Card gallery" button, selects Singularity, and clicks both preview buttons with real
// mouse events. Every animation frame (requestAnimationFrame, in the page) it reads the replay's world labels:
// the per-troop orb labels, the graveyard counts and the troop name labels, plus the canvas motion phase.
//   Sheriffs: three Sheriff orb labels read 3/3/3 before contact, then 2/2/2, with no mixed sample between.
//   Skeleton and Dragon: the opposing (Wizard) graveyard reaches 1, Skeleton leaves the board, Dragon shows 4.
// Then it repeats both with prefers-reduced-motion: reduce and checks the final outcome appears with no
// area-vortex phase. Final browser values are compared with the gallery's own engine example
// (src/ui/showdown-3d/attack-preview.js, DOM-free). Writes singularity.json and PNGs to the out directory.
// Scripted Chrome: supports claims about displayed values and sequence, not about clarity, appearance or fun.
import {execFileSync, spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {TYPES} from "../src/game/showdown/cards.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const SCHEMA = "showdown-singularity-receipt/1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (...args) => { try { return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch { return null; } };

const [htmlArg, outArg, scope] = process.argv.slice(2);
if (!htmlArg || !outArg) {
  console.error("usage: node scripts/browser-showdown-singularity.mjs <built diorama HTML> <out directory>");
  process.exit(2);
}
const htmlFile = path.resolve(htmlArg);
const out = path.resolve(outArg);
const html = await readFile(htmlFile);
await mkdir(out, {recursive: true});

// ---- Engine expectation: the gallery's own example, computed in Node --------------------------------------
async function engineExpectation() {
  const {attackExample} = await import("../src/ui/showdown-3d/attack-preview.js");
  const health = (view, side) => view.sides[side].board.map((t) => (t ? t.health : null));
  const names = (view, side) => view.sides[side].board.map((t) => (t ? TYPES[t.cardId.replace(/-\d+$/, "")]?.name ?? t.cardId : null));
  const s = attackExample("wizard-singularity", "sheriffs");
  const g = attackExample("wizard-singularity", "graveyard");
  return {
    sheriffs: {before: health(s.before, "cowboy"), after: health(s.end, "cowboy"), summary: s.summary},
    graveyard: {before: {health: health(g.before, "wizard"), names: names(g.before, "wizard"), graveyard: g.before.sides.wizard.discard.length},
      after: {health: health(g.end, "wizard"), names: names(g.end, "wizard"), graveyard: g.end.sides.wizard.discard.length}, summary: g.summary},
  };
}

// ---- Chrome (same launch and protocol client as browser-showdown-check.mjs) -------------------------------
async function launchChrome() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "kiro-singularity-chrome-"));
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

// ---- In-page reader and per-frame sampler ----------------------------------------------------------------
// One coherent read of the replay's labels. Orb labels count "●"; Wizard-side name labels carry data-rune-label.
const READ = `(() => {
  const host = document.querySelector(".sd-gallery-attack");
  const canvas = host?.querySelector("canvas.sd-attack-world");
  const spans = host ? [...host.querySelectorAll(".sd-world-labels span")] : [];
  const shown = (s) => !s.hidden && s.textContent.length > 0;
  const orbs = (side) => spans.filter((s) => s.dataset.vortexOrbs === side && shown(s)).map((s) => [...s.textContent].filter((c) => c === "●").length);
  const grave = (side) => {
    const node = spans.find((s) => s.dataset.graveLabel === side);
    if (!node) return null;
    if (node.dataset.zoneCount !== undefined) return Number(node.dataset.zoneCount);
    const m = node.textContent.match(/(\\d+)/);
    return m ? Number(m[1]) : null;
  };
  const names = (wizard) => spans.filter((s) => s.dataset.pieceLabel === "1" && (s.dataset.runeLabel === "1") === wizard && shown(s)).map((s) => s.textContent);
  return {motion: canvas?.dataset.motion ?? null, mode: canvas?.dataset.previewMode ?? null, darkness: Number(host?.style.getPropertyValue("--spell-darkness") || 0),
    cowboyOrbs: orbs("cowboy"), wizardOrbs: orbs("wizard"), cowboyGrave: grave("cowboy"), wizardGrave: grave("wizard"),
    cowboyNames: names(false), wizardNames: names(true), result: document.querySelector(".sd-attack-result")?.textContent ?? null};
})()`;

// Starts a requestAnimationFrame sampler, then resolves once the clicked replay has settled. A capturing click
// listener on the preview button marks the click frame, so samples from before the click are flagged.
const SAMPLER = (mode, settleFrames, timeoutMs) => `(() => {
  const read = () => ${READ};
  const button = document.querySelector('.sd-gallery-moves [data-attack-mode="${mode}"]');
  if (!button) throw Error("no preview button ${mode}");
  let clickedAt = null;
  button.addEventListener("click", () => { clickedAt = performance.now(); }, {capture: true, once: true});
  window.__sgDone = new Promise((resolve) => {
    const t0 = performance.now(), samples = [];
    let sawMotion = false, still = 0;
    const tick = (now) => {
      const s = read();
      s.t = Math.round(now - t0);
      s.afterClick = clickedAt !== null;
      samples.push(s);
      if (s.afterClick) {
        if (s.motion) { sawMotion = true; still = 0; } else still++;
      }
      const timedOut = performance.now() - t0 > ${timeoutMs};
      if ((s.afterClick && still >= ${settleFrames}) || timedOut) return resolve({samples, sawMotion, timedOut});
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return true;
})()`;

// ---- Run --------------------------------------------------------------------------------------------------
const report = {schema: SCHEMA, revision: git("rev-parse", "HEAD"),
  page: {file: path.relative(root, htmlFile) || htmlFile, bytes: html.length, sha256: sha256(html)},
  chrome: CHROME, viewport: [WIDTH, HEIGHT], engine: null, runs: {}, screenshots: [], exceptions: [], consoleErrors: [],
  checks: [], limitations: [], pass: false};
report.page.buildLabelInHtml = report.revision ? html.toString("utf8").includes(report.revision.slice(0, 12)) : false;
const check = (name, ok, detail) => { report.checks.push({name, pass: Boolean(ok), ...(detail === undefined ? {} : {detail})}); console.log(`${ok ? "ok  " : "FAIL"} - ${name}`); return ok; };

try { report.engine = await engineExpectation(); }
catch (e) { report.engine = {error: e.message}; }

const chrome = await launchChrome();
const cdp = await connect(chrome.url);
let fatal = null;
try {
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.exceptions.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") report.consoleErrors.push(params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
  report.chromeVersion = (await cdp.send("Browser.getVersion")).product;
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 20000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(50); }
    throw Error(`Timed out: ${expression}`);
  };
  // A real mouse press and release at the element's centre; the element must be the topmost hit there.
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length);if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
  };
  const shot = async (name) => {
    const clip = await evaluate(`(()=>{const b=document.querySelector(".sd-gallery-attack").getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,scale:1};})()`);
    const before = await evaluate(READ);
    const {data} = await send("Page.captureScreenshot", {format: "png", clip});
    const after = await evaluate(READ);
    await writeFile(path.join(out, `${name}.png`), Buffer.from(data, "base64"));
    const entry = {file: `${name}.png`, readBefore: before, readAfter: after};
    report.screenshots.push(entry);
    return entry;
  };
  const replay = async (mode, {settleFrames = 30, timeoutMs = 20000} = {}) => {
    await evaluate(SAMPLER(mode, settleFrames, timeoutMs));
    await click(`.sd-gallery-moves [data-attack-mode="${mode}"]`);
    return evaluate("window.__sgDone");
  };
  // Poll until the page reads a state, for screenshots only (the pass/fail evidence is the rAF samples).
  const until = async (predicate, ms = 15000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { const r = await evaluate(READ); if (predicate(r)) return r; await sleep(15); }
    return null;
  };

  await send("Page.navigate", {url: pathToFileURL(htmlFile).href});
  await wait(`document.readyState==='complete'&&[...document.querySelectorAll('.sd-open-gallery')].some(e=>e.getClientRects().length)`);
  await click(".sd-open-gallery");
  await wait(`document.querySelector('dialog.sd-gallery')?.open`);
  await click('.sd-gallery-menu [data-art="wizard-singularity"]');
  await wait(`document.querySelector('.sd-gallery-info h3')?.textContent===${JSON.stringify(TYPES["wizard-singularity"].name)}&&document.querySelectorAll('.sd-gallery-moves [data-attack-mode]').length===2`);
  const buttons = await evaluate(`[...document.querySelectorAll('.sd-gallery-moves [data-attack-mode]')].map(b=>[b.dataset.attackMode,b.textContent])`);
  check("gallery opened from its Card gallery button and Singularity offers both previews", JSON.stringify(buttons.map((b) => b[0])) === '["sheriffs","graveyard"]', buttons);

  const all = (list, n, count) => list.length === count && list.every((x) => x === n);
  const reducedNow = () => evaluate(`matchMedia("(prefers-reduced-motion: reduce)").matches`);
  report.reducedMotionAtStart = await reducedNow();

  // 1. Sheriffs, ordinary motion.
  const s = await replay("sheriffs");
  const sClicked = s.samples.filter((x) => x.afterClick);
  const firstAfter = sClicked.findIndex((x) => all(x.cowboyOrbs, 2, 3));
  const partial = sClicked.filter((x) => !all(x.cowboyOrbs, 3, 3) && !all(x.cowboyOrbs, 2, 3));
  const preContact = firstAfter < 0 ? sClicked : sClicked.slice(0, firstAfter);
  const vortexPre = preContact.filter((x) => x.motion === "area-vortex" && all(x.cowboyOrbs, 3, 3));
  const afterRegress = firstAfter < 0 ? [] : sClicked.slice(firstAfter).filter((x) => !all(x.cowboyOrbs, 2, 3));
  report.runs.sheriffsMotion = {frames: s.samples.length, framesAfterClick: sClicked.length, sawMotion: s.sawMotion, timedOut: s.timedOut,
    motionPhases: [...new Set(sClicked.map((x) => x.motion).filter(Boolean))],
    framesAt333: sClicked.filter((x) => all(x.cowboyOrbs, 3, 3)).length, framesAt333InAreaVortex: vortexPre.length,
    framesAt222: sClicked.filter((x) => all(x.cowboyOrbs, 2, 3)).length, partialFrames: partial.length, partialSamples: partial.slice(0, 5),
    transition: firstAfter > 0 ? {last333: sClicked[firstAfter - 1], first222: sClicked[firstAfter]} : null,
    final: sClicked.at(-1), result: sClicked.at(-1)?.result};
  check("Sheriffs (motion): area-vortex phase ran", s.sawMotion && report.runs.sheriffsMotion.motionPhases.includes("area-vortex"), report.runs.sheriffsMotion.motionPhases);
  check("Sheriffs (motion): orbs read 3/3/3 during the area vortex before contact", vortexPre.length > 0, vortexPre.length);
  check("Sheriffs (motion): 3/3/3 then 2/2/2 in one sample, no partial sample",
    firstAfter > 0 && all(sClicked[firstAfter - 1].cowboyOrbs, 3, 3) && partial.length === 0 && afterRegress.length === 0,
    {firstAfterIndex: firstAfter, partialFrames: partial.length, regressions: afterRegress.length});
  check("Sheriffs (motion): change lands inside the area-vortex phase", sClicked[firstAfter]?.motion === "area-vortex", sClicked[firstAfter]?.motion);
  check("Sheriffs (motion): final 2/2/2 equals the engine example",
    JSON.stringify(sClicked.at(-1)?.cowboyOrbs) === JSON.stringify(report.engine.sheriffs?.after) && JSON.stringify(report.engine.sheriffs?.before) === "[3,3,3]",
    {browser: sClicked.at(-1)?.cowboyOrbs, engine: report.engine.sheriffs});

  // 1b. Sheriffs again, for pre-impact and post-impact PNGs (polled; each records its reads either side).
  {
    await evaluate(SAMPLER("sheriffs", 30, 20000));
    await click('.sd-gallery-moves [data-attack-mode="sheriffs"]');
    const pre = await until((r) => r.motion === "area-vortex" && r.darkness > 0.6 && all(r.cowboyOrbs, 3, 3));
    const preShot = pre ? await shot("singularity-sheriffs-pre-impact") : null;
    const post = await until((r) => r.motion === "area-vortex" && all(r.cowboyOrbs, 2, 3));
    const postShot = post ? await shot("singularity-sheriffs-post-impact") : null;
    await evaluate("window.__sgDone");
    report.runs.sheriffsShots = {
      preImpact: preShot ? {file: preShot.file, consistent: all(preShot.readBefore.cowboyOrbs, 3, 3) && all(preShot.readAfter.cowboyOrbs, 3, 3)} : null,
      postImpact: postShot ? {file: postShot.file, consistent: all(postShot.readBefore.cowboyOrbs, 2, 3) && all(postShot.readAfter.cowboyOrbs, 2, 3)} : null};
    if (!report.runs.sheriffsShots.preImpact?.consistent || !report.runs.sheriffsShots.postImpact?.consistent)
      report.limitations.push("A Sheriffs screenshot was missed or its surrounding reads disagree; see runs.sheriffsShots.");
  }

  // 2. Skeleton and Dragon, ordinary motion.
  const g = await replay("graveyard");
  const gClicked = g.samples.filter((x) => x.afterClick);
  const skeleton = TYPES["wizard-skeleton"].name, dragon = TYPES["wizard-dragon"].name;
  const gFirst = gClicked[0], gFinal = gClicked.at(-1);
  const graveIdx = gClicked.findIndex((x) => x.wizardGrave === 1);
  const graveSeq = [...new Set(gClicked.map((x) => x.wizardGrave))];
  report.runs.graveyardMotion = {frames: g.samples.length, framesAfterClick: gClicked.length, sawMotion: g.sawMotion, timedOut: g.timedOut,
    motionPhases: [...new Set(gClicked.map((x) => x.motion).filter(Boolean))], wizardGraveyardValues: graveSeq,
    firstGraveyard1: graveIdx >= 0 ? gClicked[graveIdx] : null, first: gFirst, final: gFinal, result: gFinal?.result};
  check("Skeleton vs Dragon (motion): replay starts with Skeleton on the Wizard board and graveyard 0",
    gFirst?.wizardNames.includes(skeleton) && gFirst?.wizardGrave === 0, {names: gFirst?.wizardNames, graveyard: gFirst?.wizardGrave});
  check("Skeleton vs Dragon (motion): opposing graveyard reaches 1 and stays", graveIdx >= 0 && gClicked.slice(graveIdx).every((x) => x.wizardGrave === 1)
    && gFinal?.wizardGrave === 1, graveSeq);
  check("Skeleton vs Dragon (motion): Skeleton absent, Dragon present with 4 orbs at the end",
    !gFinal?.wizardNames.includes(skeleton) && gFinal?.wizardNames.includes(dragon) && JSON.stringify(gFinal?.wizardOrbs) === "[4]",
    {names: gFinal?.wizardNames, orbs: gFinal?.wizardOrbs});
  check("Skeleton vs Dragon (motion): final equals the engine example",
    report.engine.graveyard?.after.graveyard === gFinal?.wizardGrave && report.engine.graveyard?.after.health.filter((h) => h !== null).join() === gFinal?.wizardOrbs.join(),
    {engine: report.engine.graveyard?.after, browser: {graveyard: gFinal?.wizardGrave, orbs: gFinal?.wizardOrbs}});
  const burial = await shot("singularity-graveyard-post-burial");
  report.runs.graveyardShot = {file: burial.file, consistent: burial.readAfter.wizardGrave === 1 && !burial.readAfter.wizardNames.includes(skeleton)};

  // 3. Reduced motion: the same two buttons, final outcomes without an area-vortex phase.
  await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: "reduce"}]});
  report.reducedMotionEmulated = await reducedNow();
  check("reduced motion is emulated in the page", report.reducedMotionEmulated === true);
  const rs = await replay("sheriffs", {settleFrames: 45});
  const rsClicked = rs.samples.filter((x) => x.afterClick);
  const rg = await replay("graveyard", {settleFrames: 45});
  const rgClicked = rg.samples.filter((x) => x.afterClick);
  report.runs.reduced = {
    sheriffs: {framesAfterClick: rsClicked.length, motionPhases: [...new Set(rsClicked.map((x) => x.motion).filter(Boolean))],
      maxDarkness: Math.max(0, ...rsClicked.map((x) => x.darkness)), final: rsClicked.at(-1)},
    graveyard: {framesAfterClick: rgClicked.length, motionPhases: [...new Set(rgClicked.map((x) => x.motion).filter(Boolean))],
      maxDarkness: Math.max(0, ...rgClicked.map((x) => x.darkness)), final: rgClicked.at(-1)}};
  await shot("singularity-graveyard-reduced-motion");
  check("reduced motion: no area-vortex (or any motion) phase on either preview",
    !rsClicked.some((x) => x.motion) && !rgClicked.some((x) => x.motion), {sheriffs: report.runs.reduced.sheriffs.motionPhases, graveyard: report.runs.reduced.graveyard.motionPhases});
  check("reduced motion: Sheriffs show 2/2/2 in every sample after the click",
    rsClicked.length > 0 && rsClicked.every((x) => all(x.cowboyOrbs, 2, 3)), rsClicked.at(-1)?.cowboyOrbs);
  check("reduced motion: graveyard 1, Skeleton absent, Dragon 4",
    rgClicked.at(-1)?.wizardGrave === 1 && !rgClicked.at(-1)?.wizardNames.includes(skeleton) && JSON.stringify(rgClicked.at(-1)?.wizardOrbs) === "[4]",
    rgClicked.at(-1));
  if (scope === "--check-reel-stop" || scope === "--check-maintenance") {
    await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: "no-preference"}]});
    await wait('!matchMedia("(prefers-reduced-motion: reduce)").matches');
    await click(".sd-gallery-reel");
    await wait('document.querySelector(".sd-attack-world").dataset.motion && document.querySelector(".sd-gallery-reel").textContent === "Stop reel"');
    await click(".sd-gallery-reel");
    const stopped = await evaluate(`(() => {
      const host = document.querySelector(".sd-gallery-attack");
      return {attackVisible: !host.hidden, phase: host.querySelector("canvas").dataset.motion ?? null,
        modelVisible: !document.querySelector(".sd-gallery-model").hidden,
        label: document.querySelector(".sd-gallery-reel").textContent};
    })()`);
    check("stopping the troop reel clears the active replay", !stopped.attackVisible &&
      !stopped.phase && stopped.modelVisible && stopped.label === "Watch all troops", stopped);
    if (!stopped.phase) {
      await click('.sd-gallery-menu [data-art="wizard-singularity"]');
      await wait('document.querySelectorAll(".sd-gallery-moves [data-attack-mode]").length === 2');
      check("the gallery stays usable after stopping the reel", true);
    }
  }
  if (scope === "--check-maintenance") {
    await click(".sd-gallery-close");
    await wait('!document.querySelector("dialog.sd-gallery").open');
    await click("#menu-play");
    await click('[data-camp-destination="camp-open-title"]');
    await click('#camp-open [data-two="1"]');
    await wait('!document.querySelector("#showdown").hidden');
    await click("#sd-home");
    const returned = await evaluate(`({
      room: document.querySelector(".outpost-range").open,
      focused: document.activeElement?.dataset.two
    })`);
    check("returning from a local match restores its Camp room and focused control",
      returned.room && returned.focused === "1", returned);
    if (returned.room) await click(".outpost-range > header button");
    await click("#camp-home");
    await click("#menu-play");
    const entered = await evaluate(`({
      openRoom: document.querySelector("dialog.camp-outpost[open]")?.id ?? null,
      focused: document.activeElement?.id ?? "",
      camp: !document.querySelector("#showdown-camp").hidden
    })`);
    check("opening Camp from the title clears the previous duel room",
      entered.camp && entered.openRoom === null && entered.focused === "camp-start-trail", entered);
  }
} catch (e) {
  fatal = e.message.split("\n")[0];
} finally {
  cdp.close();
  await chrome.close();
}

check("no page exceptions", report.exceptions.length === 0, report.exceptions);
check("no console errors", report.consoleErrors.length === 0, report.consoleErrors);
if (fatal) check(`run completed without a thrown error`, false, fatal);
report.limitations.push("Headless Chrome on this machine, real requestAnimationFrame timing (no virtual clock); frame counts vary between runs.",
  "Screenshots are polled captures with a label read immediately before and after each; the pass verdict rests on the per-frame samples, not on the PNGs.",
  "A scripted run supports displayed values and sequence only; appearance needs rendered review and clarity needs a human playtest.");
report.pass = report.checks.every((c) => c.pass);
await writeFile(path.join(out, "singularity.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`${report.pass ? "PASS" : "FAIL"} · revision ${report.revision} · html sha256 ${report.page.sha256} · ${path.join(path.relative(root, out), "singularity.json")}`);
process.exitCode = report.pass ? 0 : 1;
