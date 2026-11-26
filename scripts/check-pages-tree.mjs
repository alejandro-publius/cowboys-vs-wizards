// Serves a staged Pages tree (node scripts/stage-pages.mjs --commit <sha>) over local HTTP under the
// project path, /cowboys-vs-wizards/, and checks it the way the deployed site is used.
//   node scripts/check-pages-tree.mjs [--dir dist/web] [--commit <40 hex>] [--browser] [--out-dir PATH]
// Without --browser (Node only, no Chrome):
//   - build.json, /index.html and the /3d/ alias pass scripts/verify-build-identity.mjs, which
//     hashes the served bytes; with --commit the manifest must name that commit
//   - the tree holds exactly index.html, build.json, graybox/index.html, showdown/index.html,
//     3d/index.html and the five Boot Hill Poker browser files under poker/ (index.html with inline
//     CSS, app.js, controls.js, render.js, engine.js): no other script file, model, image, video or
//     wasm, nothing from the retired 3D lane build, and no poker CLI or tests
//   - the root and /3d/ carry illustrated Showdown; /graybox/ remains lightweight
//   - no page carries the retired lane game
//   - /showdown/ is served
//   - /poker/ (the experimental second game) is served under the project path, byte for byte from
//     experiments/boot-hill-poker/, with no root-absolute links; every script, stylesheet and module
//     import reachable from poker/index.html resolves inside poker/ and is served, and that import
//     graph is exactly the five staged files; the root carries the saloon link
// --browser, native headless Chrome with a fresh profile, mouse events only:
//   - the title challenge and its deep link open the same playable Bone Fence board, with its
//     "Choose the Outrider" instruction drawn on the first screen (not only screen-reader text)
//   - at 375 x 740 a pointer reaches Ride, Continue to Boot Hill and Boot Hill on the first screen,
//     and Boot Hill's own lesson goes back to screen-reader text
//   - at 740 x 375 (short landscape) Continue to Boot Hill is pressed where the screen shows it: by pointer after
//     the Ride at scroll 0, by Tab and Enter after the Fight; Boot Hill keeps its control row and takes a card
//   - Camp on / opens the Trail; Play on /graybox/ opens the Camp
//   - two players on /: the trap, Raise and cover choices are drawn on the table before the click and described at
//     keyboard focus; seed 5 covers both seats, a cover-only troop at 375 px and an attack on a covered troop
//   - single duels (two players, and Boot Hill at 375 px) draw no best-of-three tally; the tally itself is checked by
//     MODES=bo3,hotseat scripts/browser-showdown-modes-check.mjs on the illustrated build
//   - /showdown/: the reference page loads without errors
//   - the Camp saloon on / and /3d/ links to the one poker/ page; following it loads all five poker
//     files, paints the BBS screen and raises no errors
//   - /?saloon=review opens the recorded Night Shift saloon at the validated Billy proposal card with no
//     /night-shift/events request; Replay from start hides the decision and Back to map returns to the Camp
//   - Chrome exposes the named challenge, Outrider controls, Saloon dialog and balance evidence in its accessibility tree
//   No page error, failed request or HTTP error is allowed anywhere.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {verifyLive} from "./verify-build-identity.mjs";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {newSave, settle} from "../src/game/showdown/progress.js";

const BASE_PATH = "/cowboys-vs-wizards/";
const POKER_FILES = ["app.js", "controls.js", "engine.js", "index.html", "render.js"];
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const dir = path.resolve(root, option("--dir", "dist/web"));
const commit = option("--commit");
const browser = args.includes("--browser");
const outDir = path.resolve(root, option("--out-dir", ".artifacts/pages-tree"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const types = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".css": "text/css"};
const report = {dir: path.relative(root, dir), basePath: BASE_PATH, checks: [], errors: []};
const check = (name, detail) => { report.checks.push({name, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };

// A static server like GitHub Pages: only BASE_PATH, directory URLs serve index.html, a directory
// without the trailing slash redirects, nothing outside the tree is readable.
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  let rel = decodeURIComponent(url.pathname);
  if (!rel.startsWith(BASE_PATH)) { response.statusCode = 404; return response.end("outside the site"); }
  rel = rel.slice(BASE_PATH.length);
  const file = path.resolve(dir, rel.endsWith("/") || rel === "" ? rel + "index.html" : rel);
  if (!file.startsWith(dir + path.sep)) { response.statusCode = 403; return response.end(); }
  try {
    const body = await readFile(file);
    response.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
    response.end(body);
  } catch (error) {
    if (error.code === "EISDIR") { response.statusCode = 301; response.setHeader("location", url.pathname + "/"); return response.end(); }
    response.statusCode = 404; response.end("not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const site = `http://127.0.0.1:${server.address().port}${BASE_PATH}`;
report.site = site;
const get = async (rel, redirect = "follow") => { const r = await fetch(site + rel, {redirect}); return {status: r.status, location: r.headers.get("location"), bytes: Buffer.from(await r.arrayBuffer())}; };
let failed = null;

try {
  // Release identity of the illustrated root and its alias.
  const rootHtml = await get("");
  assert.equal(rootHtml.status, 200, "root index.html");
  const digest = createHash("sha256").update(rootHtml.bytes).digest("hex");
  const manifest = JSON.parse((await get("build.json")).bytes);
  if (commit) assert.equal(manifest.commit, commit, "build.json commit");
  await verifyLive({url: site, commit: manifest.commit, htmlSha256: digest, aliases: ["3d/"], attempts: 1, log() {}});
  check("build.json names the illustrated root; /3d/ serves the same bytes", {commit: manifest.commit, indexHtmlSha256: digest});
  assert.equal((await get("graybox", "manual")).location, `${BASE_PATH}graybox/`, "/graybox redirects to /graybox/");
  const rootText = rootHtml.bytes.toString("utf8");
  assert.match(rootText, /WebGLRenderer/, "root embeds Showdown's diorama");
  assert.match(rootText, /menu-challenge/, "root offers the contest challenge");
  const graybox = await get("graybox/");
  assert.equal(graybox.status, 200);
  const grayboxText = graybox.bytes.toString("utf8");
  assert.match(grayboxText, /id="menu-play"/);
  assert.doesNotMatch(grayboxText, /WebGLRenderer/);
  check("/ and /3d/ use the diorama; /graybox/ gives a lightweight Camp entry");

  const entries = await readdir(dir, {recursive: true, withFileTypes: true});
  const files = entries.filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join("/")).sort();
  assert.deepEqual(files, ["3d/index.html", "build.json", "graybox/index.html", "index.html",
    ...POKER_FILES.map((name) => `poker/${name}`), "showdown/index.html"], "staged files");
  assert.equal((await get("3d", "manual")).location, `${BASE_PATH}3d/`, "/3d redirects to /3d/");
  const showdown = await get("showdown/");
  assert.equal(showdown.status, 200);
  for (const [route, html] of [["/", rootText], ["/graybox/", grayboxText], ["/showdown/", showdown.bytes.toString("utf8")]])
    assert.doesNotMatch(html, /chunks\/lanes-|id="arena"|id="menu-lanes"|id="earlier-build"|<script id="models"|rapier_wasm|rapier3d/, `${route} has no retired lane engine`);
  check("the four single-file pages include no retired lane game or separate assets", {files});

  // Boot Hill Poker, the experimental second game, staged as its own five files.
  assert.equal((await get("poker", "manual")).location, `${BASE_PATH}poker/`, "/poker redirects to /poker/");
  for (const name of POKER_FILES) {
    const served = await get(`poker/${name}`);
    assert.equal(served.status, 200, `poker/${name} is served under ${BASE_PATH}`);
    assert.ok(served.bytes.equals(await readFile(path.join(root, "experiments/boot-hill-poker", name))), `poker/${name} matches its experiment source`);
  }
  const pokerText = (await get("poker/")).bytes.toString("utf8");
  assert.doesNotMatch(pokerText, /\b(?:src|href)\s*=\s*["']\/(?!\/)/, "poker/ uses no root-absolute links, so it works under the project path");
  assert.doesNotMatch(pokerText, /<link\b[^>]*\bstylesheet\b/i, "poker/ keeps its CSS inline");
  const graph = await pokerImportGraph(pokerText);
  assert.deepEqual(graph, POKER_FILES, "the poker/ runtime import graph is exactly the staged files");
  assert.match(rootText, /outpost-poker-link/, "the illustrated root carries the saloon's poker link");
  check("/poker/ serves the experimental Boot Hill Poker files under the project path; every runtime import resolves", {graph});

  if (browser) await browserChecks();
} catch (error) {
  failed = error;
  report.failure = error.stack ?? String(error);
} finally {
  server.close();
}
await mkdir(outDir, {recursive: true});
await writeFile(path.join(outDir, "pages-tree.json"), JSON.stringify(report, null, 2) + "\n");
if (failed) { console.error(failed); process.exit(1); }
console.log(`Pages tree checks passed (${report.checks.length}); report ${path.relative(root, path.join(outDir, "pages-tree.json"))}`);

// Follows poker/index.html's <script src> and <link href> and every static or dynamic module
// specifier in the served JavaScript, resolved the way the browser resolves them under BASE_PATH.
// Each must be relative, stay inside poker/ and return 200. Returns the reached files, sorted.
async function pokerImportGraph(html) {
  const pokerBase = `${site}poker/`;
  const reached = new Set(["index.html"]);
  const queue = [];
  const follow = (spec, from) => {
    assert.match(spec, /^\.{1,2}\//, `${from} references ${spec} relatively, so it works in a nested project`);
    const url = new URL(spec, pokerBase + from);
    assert.ok(url.href.startsWith(pokerBase) && !url.search && !url.hash, `${from} -> ${spec} stays inside poker/`);
    const rel = url.href.slice(pokerBase.length);
    if (!reached.has(rel)) { reached.add(rel); queue.push(rel); }
  };
  for (const [, spec] of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) follow(spec, "index.html");
  while (queue.length) {
    const rel = queue.shift();
    const served = await get(`poker/${rel}`);
    assert.equal(served.status, 200, `poker/${rel} is served under ${BASE_PATH}`);
    if (!rel.endsWith(".js")) continue;
    const source = served.bytes.toString("utf8");
    for (const [, spec] of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) follow(spec, rel);
  }
  return [...reached].sort();
}

async function browserChecks() {
  const profile = await mkdtemp("/tmp/kiro-pages-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--window-size=1440,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  try {
    const ws = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no DevTools URL from Chrome in 30 s:\n${stderr}`)), 30000);
      child.stderr.on("data", (chunk) => { stderr += chunk; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
      child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}`)); });
    });
    const cdp = await connect(ws);
    const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
    const send = (method, params) => cdp.send(method, params, sessionId);
    const responses = [], requests = [];
    cdp.on(({method, params, sessionId: id}) => {
      if (id !== sessionId) return;
      if (method === "Network.requestWillBeSent") requests.push(params.request.url);
      if (method === "Runtime.exceptionThrown") report.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
      if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
      if (method === "Network.responseReceived") responses.push({url: params.response.url, status: params.response.status, type: params.type});
      if (method === "Network.loadingFailed" && !params.canceled) report.errors.push(`request failed: ${params.errorText} (${params.requestId})`);
    });
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
      if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async (expression, ms = 20000) => {
      const stop = Date.now() + ms;
      while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(100); }
      throw Error(`Timed out: ${expression}`);
    };
    const click = async (selector) => {
      const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
        n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
        if(!n.contains(document.elementFromPoint(x,y)))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, button: "left", clickCount: 1, ...p});
    };
    const open = async (rel) => {
      await send("Page.navigate", {url: site + rel});
      await wait(`document.readyState==='complete'&&location.href===${JSON.stringify(site + rel)}`);
    };
    const press = async (key, keyCode) => {
      for (const type of ["keyDown", "keyUp"]) {
        const text = key === "Enter" && type === "keyDown" ? {text: "\r"} : {};
        await send("Input.dispatchKeyEvent", {type, key, code: key, windowsVirtualKeyCode: keyCode,
          nativeVirtualKeyCode: keyCode, ...text});
      }
    };
    const tabTo = async (selector) => {
      for (let tabs = 0; tabs < 45; tabs++) {
        if (await evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})`)) return;
        await press("Tab", 9);
      }
      const focus = await evaluate(`document.activeElement?.id || document.activeElement?.tagName`);
      assert.fail(`Tab could not reach ${selector} (last focus: ${focus})`);
    };
    const activateByKey = async (selector) => {
      await tabTo(selector);
      await press("Enter", 13);
    };
    const shown = (id) => `!!document.getElementById('${id}')&&!document.getElementById('${id}').hidden`;
    await send("Accessibility.enable");
    await send("Emulation.setFocusEmulationEnabled", {enabled: true});
    const axTree = async () => (await send("Accessibility.getFullAXTree")).nodes.filter((node) => !node.ignored);
    const axProperty = (node, key) => node.properties?.find((p) => p.name === key)?.value?.value;
    const axNamed = (nodes, role, name, predicate = () => true) => nodes.some((node) =>
      node.role?.value === role && name.test(node.name?.value ?? "") && predicate(node));
    const enabled = (node) => axProperty(node, "disabled") !== true;
    const focused = (node) => enabled(node) && axProperty(node, "focused") === true;
    // Chromium's default favicon probe: a page without <link rel="icon"> (the experimental poker/ page) makes
    // Chrome request the origin-root /favicon.ico. On GitHub Pages that path belongs to the owner's root site,
    // outside BASE_PATH, so it is not a project asset. Only that exact URL with CDP type "Other" is exempt and
    // each exempt probe is kept in the report; every in-project error still fails.
    const faviconProbe = new URL("/favicon.ico", site).href;
    const isFaviconProbe = (r) => r.url === faviconProbe && r.type === "Other";
    const clean = () => {
      report.allowedFaviconProbes = responses.filter((r) => r.status >= 400 && isFaviconProbe(r));
      const bad = responses.filter((r) => r.status >= 400 && !isFaviconProbe(r));
      assert.deepEqual(bad, [], "no HTTP errors");
      assert.deepEqual(report.errors, [], "no page errors or failed requests");
    };

    const playOpensCamp = async () => {
      await click("#menu-play");
      await wait(`${shown("showdown-camp")}&&document.getElementById('title-screen').hidden`);
      const tile = await evaluate(`document.querySelector('#camp-trail button strong')?.textContent??null`);
      assert.equal(tile, "Boot Hill");
    };

    const mainLandmarks = async () => (await axTree())
      .filter((node) => node.role?.value === "main")
      .map((node) => node.name?.value);
    for (const rel of ["", "graybox/"]) {
      await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
      await open(rel);
      if (rel === "graybox/") assert.equal(await evaluate(`Boolean(document.getElementById('menu-challenge'))`), false);
      assert.deepEqual(await mainLandmarks(), ["Main menu"], `${BASE_PATH}${rel} exposes only the title's main landmark`);
      await playOpensCamp();
      assert.deepEqual(await mainLandmarks(), ["Camp"], `${BASE_PATH}${rel} exposes only the Camp's main landmark after Play`);
      clean();
      check(`${BASE_PATH}${rel}: Play on a clean profile opens the Camp (first Trail duel Boot Hill)`);
      check(`${BASE_PATH}${rel}: Chrome exposes one named main landmark for the title and then the Camp`);
    }
    // A returning player opens the illustrated Camp with a real, unclaimed first Trail reward.
    const rewardSave = settle(newSave(), "trail", true).save;
    const reward = rewardSave.offer[0];
    const storedCareer = `localStorage.getItem(${JSON.stringify(SAVE_KEY)})`;
    await evaluate(`localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(rewardSave))})`);
    await open("");
    await click("#menu-play");
    await click(`#camp-claim [data-choose="${reward}"]`);
    await wait(`!!document.querySelector('#camp-claim [data-build-reward]')`);
    const claimedCareer = await evaluate(storedCareer);
    await click("#camp-claim [data-build-reward]");
    assert.equal(await evaluate(`document.activeElement?.dataset.type`), reward, "the illustrated builder opens on the claimed card");
    assert.equal(await evaluate(`document.activeElement?.dataset.by`), "1", "the card's add control is ready");
    await activateByKey("#builder-cancel");
    await wait(shown("showdown-camp"));
    assert.equal(await evaluate(storedCareer), claimedCareer, "cancelling keeps the claimed card and the equipped deck");
    clean();
    check("A returning player can claim a Trail reward in the illustrated Camp and open its deck row directly");

    // Seed 18 deals the Cowboys a Bear Trap and the Wizards a Quickdraw Imp.
    // Both players act through the real table. Before committing, the second seat can know only the public risk.
    await open("?seed=18");
    await click("#menu-play");
    await click('[data-camp-destination="camp-open-title"]');
    await click('[data-two="1"]');
    await click("#sd-ready");
    assert.equal(await evaluate(`document.querySelector('#sd-field .table-series').checkVisibility()`), false, "a single two-player duel draws no series tally");
    await click('[data-card^="cowboy-bear-trap-"]');
    await click("#sd-end");
    await wait(shown("sd-curtain"));
    await click("#sd-ready");
    await click('[data-card^="wizard-imp-"]');
    await activateByKey('[data-slot="wizard-0"]');
    const trapRisk = "A face-down trap springs before damage.";
    const coverRule = "cover: until your next turn it keeps extra damage off your Base, but it will not hit back.";
    const baseOrbs = () => evaluate(`document.querySelector('[data-base="cowboy"] .sd-orbs').getAttribute('aria-label')`);
    const beforeAttack = await baseOrbs();
    const threat = await evaluate(`(() => {
      const painted = document.querySelector('#sd-field .table-selection');
      return {prompt: document.getElementById('sd-prompt').textContent, visible: painted.checkVisibility() ? painted.innerText : '',
        preview: document.getElementById('sd-preview-base').textContent};
    })()`);
    assert.ok(threat.prompt.includes(trapRisk) && threat.visible.includes(trapRisk), "the aiming prompt and illustrated board explain the public trap risk");
    assert.equal(threat.visible, `No enemy troops: strike the Base. ${trapRisk} Or take ${coverRule}`, "the trap risk stays with the attack, and the cover choice is drawn too");
    assert.equal(threat.preview, "Without trap effects: Hit the Base for 3", "the Imp's printed damage is conditional while a trap is set");
    assert.doesNotMatch(Object.values(threat).join(" "), /Bear Trap|Hex/, "the forecast keeps the trap's identity private");
    assert.ok(axNamed(await axTree(), "button", /Cowboy Base/, (node) => enabled(node) && node.description?.value?.includes(trapRisk)), "the legal target carries the trap warning");
    await activateByKey('[data-base="cowboy"]');
    await wait(`document.getElementById('sd-feedback').textContent.includes('defeated before it struck')`);
    assert.equal(await baseOrbs(), beforeAttack, "the trap stopped the Imp before it damaged the Base");
    assert.equal(await evaluate(`document.getElementById('sd-prompt').textContent.includes(${JSON.stringify(trapRisk)})`), false, "the spent trap no longer warns");
    clean();
    check("The illustrated table warns before a hidden trap, keeps its identity private, and reports the Imp falling before it strikes");

    // Seed 5: the Wizards' Skeleton can strike the empty Base or take cover. Both are drawn before the click, and Take
    // cover carries the rule at keyboard focus. The Cowboys see it in cover, their new Sheriff can only take cover, and
    // the Sheriff's attack on the covered Skeleton lands as forecast.
    {
      const painted = () => evaluate(`(() => { const p = document.querySelector('#sd-field .table-selection'); return p.checkVisibility() ? p.innerText : ''; })()`);
      const orbsOf = (selector) => evaluate(`document.querySelector('${selector} .sd-orbs').getAttribute('aria-label')`);
      const feedback = (text) => wait(`document.getElementById('sd-feedback').textContent.includes(${JSON.stringify(text)})`);
      const pass = async () => { await click("#sd-end"); await wait(shown("sd-curtain")); await click("#sd-ready"); };
      const fight = `Choose what to attack. Or take ${coverRule}`;
      await open("?seed=5");
      await click("#menu-play");
      await click('[data-camp-destination="camp-open-title"]');
      await click('[data-two="1"]');
      await click("#sd-ready");
      await click('[data-card^="wizard-skeleton-"]');
      await pass();
      await pass();
      await click('[data-slot="wizard-0"]');
      const strike = `No enemy troops: strike the Base. Or take ${coverRule}`;
      assert.equal(await painted(), strike, "the illustrated table draws both choices before the click");
      await click("#sd-cancel");
      assert.equal(await painted(), "", "Cancel clears the drawn choice");
      await activateByKey('[data-slot="wizard-0"]');
      assert.ok(axNamed(await axTree(), "button", /Cowboy Base/, (node) => focused(node) && node.description?.value === `Hit the Base for 1 ${strike}`),
        "keyboard focus lands on the Base with its forecast and the cover choice");
      await tabTo("#sd-cover");
      assert.ok(axNamed(await axTree(), "button", /^Take cover$/, (node) => focused(node) && node.description?.value === strike), "Take cover describes the rule at keyboard focus");
      const untouched = await orbsOf('[data-base="cowboy"]');
      await press("Enter", 13);
      await feedback("The Wizards' Skeleton took cover.");
      assert.equal(await orbsOf('[data-base="cowboy"]'), untouched, "taking cover leaves the Cowboy Base untouched");
      assert.equal(await painted(), "", "the choice clears once the troop has acted");

      await pass();
      assert.ok(axNamed(await axTree(), "button", /Skeleton[\s\S]*In cover/), "the Cowboys see the Skeleton in cover");
      await click('[data-card^="cowboy-sheriff-"]');
      await feedback("Sheriff arrived");
      await send("Emulation.setDeviceMetricsOverride", {width: 375, height: 740, deviceScaleFactor: 1, mobile: true});
      await activateByKey('[data-slot="cowboy-0"]');
      const only = `This troop cannot attack now. Take ${coverRule}`;
      assert.ok(axNamed(await axTree(), "button", /^Take cover$/, (node) => focused(node) && node.description?.value === only), "375 px: a troop that cannot attack focuses Take cover, which says why and what it does");
      assert.equal(await painted(), only, "375 px: the cover-only choice is drawn");
      const layout = await evaluate(`(() => {
        const box = (n) => { const r = n.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right}; };
        const text = box(document.querySelector('#sd-field .table-selection'));
        const crossed = [...document.querySelectorAll('#sd-actions button, #sd-hand button')].filter((n) => n.checkVisibility())
          .map((n) => ({id: n.id || n.dataset.card, ...box(n)})).filter((c) => c.left < text.right && c.right > text.left && c.top < text.bottom && c.bottom > text.top);
        const cover = document.getElementById('sd-cover'), r = cover.getBoundingClientRect();
        return {text, crossed, fits: text.left >= 0 && text.right <= innerWidth,
          coverOnTop: r.left >= 0 && r.right <= innerWidth && cover.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))};
      })()`);
      assert.ok(layout.fits && layout.crossed.length === 0 && layout.coverOnTop, `375 px: the drawn choice fits and crosses no control; Take cover is on top: ${JSON.stringify(layout)}`);
      await press("Escape", 27);
      assert.equal(await painted(), "", "Escape clears the drawn choice");
      await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});

      await pass();
      await click('[data-slot="wizard-0"]');
      assert.equal(await painted(), fight, "out of cover again, the Skeleton has both choices against the Sheriff");
      assert.ok(axNamed(await axTree(), "button", /Sheriff/, (node) => enabled(node) && node.description?.value?.startsWith("Survives on 2 and hits back: yours drops to 2")),
        "the attack forecast names the hit back");
      await click("#sd-cover");
      await feedback("The Wizards' Skeleton took cover.");

      await pass();
      await click('[data-slot="cowboy-0"]');
      assert.equal(await painted(), fight, "the Cowboy seat sees the same two choices");
      assert.ok(axNamed(await axTree(), "button", /Skeleton/, (node) => enabled(node) && node.description?.value?.startsWith("Survives on 2. It is in cover and does not hit back.")),
        "the Cowboys' forecast reads the public cover");
      const sheriff = await orbsOf('[data-slot="cowboy-0"]');
      await click('[data-slot="wizard-0"]');
      await feedback("left it on 2; it was in cover and did not hit back");
      assert.equal(await orbsOf('[data-slot="cowboy-0"]'), sheriff, "the covered Skeleton did not hit back, as forecast");
      assert.equal(await orbsOf('[data-slot="wizard-0"]'), "2 of 3 orbs", "the Skeleton dropped to 2, as forecast");
    }
    clean();
    check("Seed 5: both seats see attack and cover drawn before the click; Take cover carries the rule at keyboard focus, including a troop that can only take cover at 375 px; the covered Skeleton's forecast matches the Sheriff's attack");

    // Same opening deal, two legal payments. Watch the actual summon and the opposite seat's pile.
    for (const [slot, tribute] of [[0, "Skeleton"], [1, "Imp"]]) {
      await open("?seed=5");
      await click("#menu-play");
      await click('[data-camp-destination="camp-open-title"]');
      await click('[data-two="1"]');
      await click("#sd-ready");
      for (const type of ["skeleton", "imp"]) {
        await click(`[data-card^="wizard-${type}-"]`);
        for (let pass = 0; pass < 2; pass++) {
          await click("#sd-end");
          await click("#sd-ready");
        }
      }
      await click('[data-card^="wizard-wizard-"]');
      const forecast = "Pay Skeleton: Skeleton returns with 1 orb. Pay Imp: no Undead to return.";
      assert.ok(await evaluate(`document.querySelector('.table-selection').checkVisibility() &&
        document.querySelector('.table-selection').innerText.includes(${JSON.stringify(forecast)})`),
        "the illustrated table distinguishes both payments before commitment");
      assert.ok(axNamed(await axTree(), "button", new RegExp(tribute),
        (node) => enabled(node) && node.description?.value?.includes(forecast)), "the tribute button describes the choice");
      await activateByKey(`[data-slot="wizard-${slot}"]`);
      await wait(`document.getElementById('sd-feedback').textContent.includes('Wizard arrived')`);
      const result = await evaluate("document.getElementById('sd-feedback').textContent");
      assert.equal(result.includes("Skeleton returned from the graveyard with 1 orb"), slot === 0);
      await click("#sd-end");
      await wait(shown("sd-curtain"));
      assert.equal(await evaluate("document.querySelector('.table-selection').textContent"), "", "the pass clears the forecast");
      await click("#sd-ready");
      assert.equal(await evaluate("document.getElementById('sd-wizard-graveyard').textContent"), slot === 0 ? "empty" : "Imp");
    }
    clean();
    check("Both tribute forecasts match the resolved summon and the other seat's public graveyard");

    await open("showdown/");
    await wait(`document.body&&document.body.innerText.trim().length>0`);
    await sleep(500);
    clean();
    check(`${BASE_PATH}showdown/: the Showdown reference page loads without errors`);

    for (const rel of ["", "3d/"]) {
      await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
      await open(rel);
      await playOpensCamp();
      await click('[data-camp-destination="night-shift-saloon"]');
      await wait(`document.getElementById('room-for-night-shift-saloon')?.open`);
      const link = "#room-for-night-shift-saloon .outpost-poker-link";
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(link)}).href`), `${site}poker/`, `${rel || "/"} links the one poker/ page`);
      const mark = responses.length;
      await click(link);
      await wait(`document.readyState==='complete'&&location.href.startsWith(${JSON.stringify(`${site}poker/`)})`);
      await wait(`!!document.getElementById('screen')&&!document.getElementById('screen').textContent.startsWith('Dialing Boot Hill')`);
      await sleep(500);
      clean();
      const loaded = POKER_FILES.filter((name) => responses.slice(mark).some((r) => r.status === 200 && new URL(r.url).pathname === `${BASE_PATH}poker/${name === "index.html" ? "" : name}`));
      assert.deepEqual(loaded, POKER_FILES, `${rel || "/"} -> poker/ loads all five browser files`);
      check(`${BASE_PATH}${rel}: the Camp saloon opens Boot Hill Poker at ${BASE_PATH}poker/, loads its five files and paints the screen without errors`);
    }

    // ?saloon=review: the staged illustrated root opens the recorded room at the validated Billy decision.
    {
      const room = "#room-for-night-shift-saloon";
      const decision = `document.querySelector('${room} .saloon-decision')`;
      const feedRequests = () => requests.filter((url) => url.includes("/night-shift/events"));
      await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
      const mark = requests.length;
      await open("?saloon=review");
      await wait(`document.querySelector('${room}')?.open&&${decision}&&!${decision}.hidden`);
      assert.ok(await evaluate(shown("showdown-camp")), "?saloon=review opens over the Camp");
      assert.equal(await evaluate(`document.querySelector('${room} .saloon-mode-label').textContent`), "Recorded Kiro shift");
      assert.match(await evaluate(`${decision}.querySelector('h5').textContent`), /^Review of Kiro's proposal: Billy\b.* attack 2 → 1$/);
      assert.match(await evaluate(`${decision}.textContent`), /Passed the written balance rule/);
      assert.match(await evaluate(`document.querySelector('${room} .saloon-target-stat').textContent`), /^Billy\b.*: attack 2 → 1/);
      const at = await evaluate(`document.querySelector('${room} .saloon-progress').textContent`);
      assert.match(at, /^· step [1-9]\d* of \d+$/, "the room opens at the review step");
      const saloonAx = await axTree();
      assert.ok(axNamed(saloonAx, "dialog", /^Night Shift saloon$/), "the recorded room has a dialog name");
      for (const label of [/^Play$/, /^Step$/, /^Replay from start$/]) {
        assert.ok(axNamed(saloonAx, "button", label, enabled), `${label} is an enabled playback control`);
      }
      assert.ok(axNamed(saloonAx, "heading", /^Review of Kiro's proposal: Billy attack 2 → 1$/), "the balance review has a heading");
      const noticeText = saloonAx.filter((node) => node.role?.value === "StaticText").map((node) => node.name?.value).join(" ");
      for (const detail of ["59.792%", "51.920%", "100,000", "awaits design approval"]) {
        assert.ok(noticeText.includes(detail), `the review exposes ${detail}`);
      }
      await sleep(3500); // longer than the slowest live poll interval
      // Keyboard: a real Enter on the focused control; keyboard focus must land on Play, not <body>.
      const total = Number(at.match(/ of (\d+)$/)[1]);
      const focusOn = async (name) => {
        await evaluate(`document.querySelector('${room} .saloon-${name}').focus()`);
        assert.ok(await evaluate(`document.activeElement===document.querySelector('${room} .saloon-${name}')`), `${name} holds focus before Enter`);
      };
      const onPlay = `document.activeElement===document.querySelector('${room} .saloon-play')&&!document.activeElement.disabled`;
      await focusOn("replay");
      await press("Enter", 13);
      await wait(`${decision}.hidden&&/^· step 0 of /.test(document.querySelector('${room} .saloon-progress').textContent)`);
      assert.ok(await evaluate(onPlay), "Replay from start by Enter moves focus to the enabled Play button");
      assert.ok(axNamed(await axTree(), "button", /^Play$/, focused), "Chrome exposes Play as focused after restart");
      for (let n = 0; n < total - 1; n++) await click(`${room} .saloon-step`);
      await wait(`document.querySelector('${room} .saloon-progress').textContent==='· step ${total - 1} of ${total}'`);
      await focusOn("step");
      await press("Enter", 13);
      await wait(`document.querySelector('${room} .saloon-progress').textContent==='· step ${total} of ${total}'`);
      assert.equal(await evaluate(`document.querySelector('${room} .saloon-step').disabled`), true, "Step is disabled at the last event");
      assert.ok(await evaluate(onPlay), "Step by Enter at the last event moves focus to the enabled Replay button");
      assert.equal(await evaluate(`document.activeElement.textContent`), "Replay");
      assert.ok(axNamed(await axTree(), "button", /^Replay$/, focused), "Chrome exposes Replay as focused after the last event");
      await click(`${room} header button`);
      await wait(`!document.querySelector('${room}').open&&${shown("showdown-camp")}`);
      assert.deepEqual(feedRequests(), [], "?saloon=review makes no /night-shift/events request");
      assert.ok(requests.length > mark, "the review page made its own requests");
      clean();
      check(`${BASE_PATH}?saloon=review: the recorded saloon opens at the validated Billy proposal (${at.slice(2)}), makes 0 /night-shift/events requests; Enter on Replay from start hides the decision and Enter on Step at the last event keeps focus on Play/Replay; Back to map returns to the Camp`);
    }

    // The challenge's one-line instruction is drawn, not just clipped to a 1 px screen-reader box, and it sits
    // on the first screen without covering the header or pushing End turn below the fold.
    const instructionShown = async () => {
      const at = await evaluate(`(() => {
        const box = (n) => { const r = n.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height}; };
        const lesson = document.getElementById('sd-lesson'), style = getComputedStyle(lesson);
        return {text: lesson.textContent.trim(), clip: style.clipPath, visibility: style.visibility, opacity: Number(style.opacity), lesson: box(lesson),
          above: [...document.querySelectorAll('#showdown > header button, #sd-field > .table-turn')].filter((n) => n.getClientRects().length).map(box),
          end: box(document.getElementById('sd-end')), width: innerWidth, height: innerHeight, scrollY};
      })()`);
      const label = `${at.width} px: the challenge instruction`;
      assert.equal(at.text, "Choose the Outrider. Attack a troop, or ride past it to the Wizard Base.", label);
      assert.ok(at.clip === "none" && at.visibility === "visible" && at.opacity === 1 && at.lesson.width >= 200 && at.lesson.height >= 18,
        `${label} is drawn, not screen-reader-only: ${JSON.stringify(at)}`);
      assert.ok(at.scrollY === 0 && at.lesson.top >= 0 && at.lesson.bottom <= at.height && at.lesson.left >= 0 && at.lesson.right <= at.width,
        `${label} is on the first screen: ${JSON.stringify(at.lesson)}`);
      for (const other of at.above) assert.ok(other.bottom <= at.lesson.top || other.top >= at.lesson.bottom || other.right <= at.lesson.left || other.left >= at.lesson.right,
        `${label} does not cover the header or turn line: ${JSON.stringify({lesson: at.lesson, other})}`);
      assert.ok(at.end.bottom <= at.height, `${label} leaves End turn on the first screen: ${JSON.stringify(at.end)}`);
    };
    const challengeOpens = async (activate) => {
      await wait(`${shown("showdown")} && document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width > 0`);
      assert.match(await evaluate(`document.getElementById('sd-status').textContent`), /^Ride or Fight\?/);
      await instructionShown();
      const slots = '[data-slot^="cowboy-"]';
      const rider = await evaluate(`[...document.querySelectorAll(${JSON.stringify(slots)})].find(x => x.textContent.includes('Outrider'))?.dataset.slot`);
      assert.ok(rider, "the Outrider is on the board");
      assert.ok(axNamed(await axTree(), "button", /\bOutrider\b/, enabled), "Outrider is an enabled named choice");
      await activate(`[data-slot="${rider}"]`);
      await wait(`document.querySelector('[data-base="wizard"]')?.dataset.enemy === 'base' && !!document.querySelector('[data-slot^="wizard-"][data-enemy]')`);
      clean();
    };
    await open("");
    await wait(`document.getElementById('menu-challenge')?.textContent === 'Ride or Fight?'`);
    assert.ok(axNamed(await axTree(), "button", /^Ride or Fight\?$/, enabled), "the title challenge has a name");
    await activateByKey("#menu-challenge");
    await challengeOpens(activateByKey);
    const openingPosition = () => evaluate(`({
      board: [...document.querySelectorAll('#sd-board button')].map((button) => button.textContent),
      hand: [...document.querySelectorAll('#sd-hand [data-card]')].map((button) => button.dataset.card),
      log: document.getElementById('sd-log').textContent,
      status: document.getElementById('sd-status').textContent
    })`);
    const firstPosition = await openingPosition();
    const aim = await evaluate(`({
      prompt: document.getElementById('sd-prompt')?.textContent.trim() ?? '',
      base: document.querySelector('[data-base="wizard"] [id^="sd-preview-"]')?.textContent.trim() ?? '',
      skeleton: [...document.querySelectorAll('[data-slot^="wizard-"][data-enemy]')].find((b) => b.textContent.includes('Skeleton'))?.querySelector('[id^="sd-preview-"]')?.textContent.trim() ?? ''
    })`);
    assert.equal(aim.base, "Ride past: Hit the Base for 1", "Base shows its Ride past preview");
    assert.ok(aim.skeleton && aim.skeleton !== aim.base, "Skeleton shows its own distinct preview");
    assert.ok(aim.prompt, "aiming prompt is non-empty");
    const targets = await axTree();
    const describes = (preview, other) => (node) => {
      const description = node.description?.value ?? "";
      return enabled(node) && !(node.name?.value ?? "").includes(preview)
        && description.includes(preview) && description.includes(aim.prompt) && !description.includes(other);
    };
    assert.ok(axNamed(targets, "button", /\bBase\b/, describes(aim.base, aim.skeleton)), "the Base description carries its own preview and the aiming prompt");
    assert.ok(axNamed(targets, "button", /\bSkeleton\b/, describes(aim.skeleton, aim.base)), "the Skeleton description carries its own preview and the aiming prompt");
    check("Chrome exposes distinct Base and Skeleton attack previews as accessible descriptions");
    await activateByKey('[data-base="wizard"]');
    const shotShown = async (eventText, replayLabel) => {
      await wait(`document.getElementById('sd-restart').textContent === ${JSON.stringify(replayLabel)}`);
      const shot = await evaluate(`({report: document.getElementById('sd-lesson').innerText,
        event: [...document.querySelectorAll('#sd-log li')].findLast((line) => line.textContent.includes(${JSON.stringify(eventText)}))?.textContent})`);
      assert.ok(shot.event, eventText);
      assert.equal(shot.report, shot.event, "the illustrated board reports the move that actually landed");
    };
    await shotShown("Outrider struck the Wizards' Base for 1", "Try fighting instead");
    await activateByKey("#sd-restart");
    assert.ok(await evaluate(`document.activeElement?.matches('[data-own]') && document.activeElement.textContent.includes('Outrider')`), "replay returns keyboard focus to the Outrider");
    await press("Enter", 13);
    assert.deepEqual(await openingPosition(), firstPosition, "replay restores the same hand, board, history and targets");
    await activateByKey('[data-slot^="wizard-"][data-enemy]');
    await shotShown("Outrider attacked Skeleton", "Try riding instead");
    check("Ride and Fight from the same opening deal show their own combat result and offer the other move");
    await activateByKey("#sd-home");
    await wait(shown("showdown-camp"));
    check("Tab and Enter open Ride or Fight?, play the Outrider's Base attack and return to Camp");
    check("Chrome exposes the challenge and targets, recorded Saloon dialog and results, and replay keyboard focus in its accessibility tree");

    await open("");
    await wait(`document.getElementById('menu-challenge')?.textContent === 'Ride or Fight?'`);
    await activateByKey("#menu-challenge");
    await challengeOpens(activateByKey);
    assert.equal(await evaluate(`document.getElementById('sd-boot-hill')?.hidden`), true, "Continue to Boot Hill starts hidden");
    await activateByKey('[data-base="wizard"]');
    await wait(`/Outrider struck the Wizards' Base for 1/.test(document.getElementById('sd-log').textContent) && document.getElementById('sd-boot-hill') && !document.getElementById('sd-boot-hill').hidden`);
    assert.ok(axNamed(await axTree(), "button", /Continue to Boot Hill/, enabled), "Continue to Boot Hill is an enabled named button");
    await activateByKey("#sd-boot-hill");
    await wait(`document.querySelector('#sd-field[data-battlefield="boot-hill"] canvas.sd-world')?.width > 0 && /Boot Hill/.test(document.getElementById('sd-status').textContent) && document.getElementById('sd-boot-hill')?.hidden !== false`);
    assert.equal(await evaluate(`!!document.getElementById('showdown')?.hasAttribute('data-contest-challenge')`), false, "challenge marker no longer applies");
    assert.equal(await evaluate(`!!document.activeElement?.closest('#showdown button:not(:disabled), #showdown [tabindex="0"]:not([aria-disabled="true"])')`), true, "focus is on a usable duel control");
    const bhStatus = await evaluate(`document.getElementById('sd-status').textContent`);
    await activateByKey("#sd-end");
    await wait(`document.getElementById('sd-status').textContent !== ${JSON.stringify(bhStatus)}`);
    clean();
    check("Continue to Boot Hill opens from the finished challenge via keyboard, moves focus to a usable duel control, clears the challenge marker and advances status on End turn");

    await open("3d/?outrider=case-a");
    await challengeOpens(click);
    const enemy = await evaluate(`document.querySelector('[data-slot^="wizard-"][data-enemy]').dataset.slot`);
    await click(`[data-slot="${enemy}"]`);
    await wait(`document.getElementById('sd-log').textContent.includes('Outrider attacked')`);
    check("the /3d/ deep link opens the second case and accepts an attack on a troop");

    // A phone-width first visit by pointer: title challenge, Ride, then Boot Hill, each control on the first screen.
    await send("Emulation.setDeviceMetricsOverride", {width: 375, height: 740, deviceScaleFactor: 1, mobile: true});
    await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
    await open("");
    await wait(`document.getElementById('menu-challenge')?.textContent === 'Ride or Fight?'`);
    await click("#menu-challenge");
    await challengeOpens(click);
    await click('[data-base="wizard"]');
    await wait(`/Outrider struck the Wizards' Base for 1/.test(document.getElementById('sd-log').textContent) && !document.getElementById('sd-boot-hill').hidden`);
    const firstScreen = (selector) => evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}), r = n.getBoundingClientRect();
      return scrollY === 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })()`);
    for (const control of ["#sd-boot-hill", "#sd-end"]) assert.ok(await firstScreen(control), `375 px: ${control} is on the first screen and on top after the Ride`);
    await click("#sd-boot-hill");
    await wait(`document.querySelector('#sd-field[data-battlefield="boot-hill"] canvas.sd-world')?.width > 0 && document.getElementById('sd-status').textContent === 'Boot Hill · turn 1 · your turn'`);
    assert.equal(await evaluate(`document.getElementById('showdown').hasAttribute('data-contest-challenge')`), false, "375 px: the challenge marker is cleared on Boot Hill");
    assert.equal(await evaluate(`getComputedStyle(document.getElementById('sd-lesson')).clipPath`), "inset(50%)", "375 px: Boot Hill keeps its lesson as screen-reader text");
    assert.ok(await firstScreen("#sd-hand [data-card]:not(:disabled)"), "375 px: a playable Boot Hill hand card is on the first screen");
    assert.equal(await evaluate(`document.querySelector('#sd-field .table-series').checkVisibility()`), false, "375 px: a single solo duel draws no series tally");
    clean();
    await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
    check("375 px pointer: the challenge instruction is drawn, Ride shows Continue to Boot Hill on the first screen, and Boot Hill opens with a playable card in view");

    // A short landscape phone, 740 x 375: the board fills the screen and the action row under it starts below the
    // fold. Every control here is pressed where the viewport already shows it; nothing scrolls it into view first.
    await send("Emulation.setDeviceMetricsOverride", {width: 740, height: 375, deviceScaleFactor: 1, mobile: true});
    const seen = (selector) => evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)});
      if (!n || n.hidden || !n.getClientRects().length) return null;
      const r = n.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), x, y, scrollY: Math.round(scrollY),
        onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && n.contains(document.elementFromPoint(x, y))}; })()`);
    const pressSeen = async (selector) => {
      const at = await seen(selector);
      assert.ok(at?.onScreen, `740 x 375: ${selector} is on screen and on top where it is pressed: ${JSON.stringify(at)}`);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, button: "left", clickCount: 1, x: at.x, y: at.y});
    };
    const shortChallenge = async (activate) => {
      await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
      await open("?seed=0");
      await wait(`document.getElementById('menu-challenge')?.textContent === 'Ride or Fight?'`);
      await activate("#menu-challenge");
      await wait(`${shown("showdown")} && document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width > 0`);
      const rider = await evaluate(`[...document.querySelectorAll('[data-slot^="cowboy-"]')].find(x => x.textContent.includes('Outrider'))?.dataset.slot`);
      const end = await evaluate(`document.getElementById('sd-end').getBoundingClientRect().top + scrollY`);
      await activate(`[data-slot="${rider}"]`);
      await wait(`document.querySelector('[data-base="wizard"]')?.dataset.enemy === 'base' && !!document.querySelector('[data-slot^="wizard-"][data-enemy]')`);
      return end;
    };
    // After the attack has played: Continue to Boot Hill sits under the instruction, clear of the header, turn
    // line, targets, action row and hand as they are on screen now, and stays on screen at the current scroll.
    const handoff = async (attack) => {
      await wait(`document.getElementById('sd-log').textContent.includes(${JSON.stringify(attack)}) && ${shown("sd-boot-hill")}`);
      const at = await evaluate(`(() => {
        const box = (n) => { const r = n.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right}; };
        const visible = (n) => n.getClientRects().length && !n.hidden && n.getBoundingClientRect().bottom > 0 && n.getBoundingClientRect().top < innerHeight;
        return {go: box(document.getElementById('sd-boot-hill')), lesson: box(document.getElementById('sd-lesson')),
          others: [...document.querySelectorAll('#showdown > header button, #sd-field > .table-turn, #sd-board button:not(:disabled), #sd-actions button:not(#sd-boot-hill), #sd-hand [data-card]')].filter(visible).map(box)};
      })()`);
      assert.ok(at.go.top >= at.lesson.bottom, `740 x 375: Continue to Boot Hill is below the instruction: ${JSON.stringify(at)}`);
      for (const other of at.others) assert.ok(other.bottom <= at.go.top || other.top >= at.go.bottom || other.right <= at.go.left || other.left >= at.go.right,
        `740 x 375: Continue to Boot Hill covers no control: ${JSON.stringify({go: at.go, other})}`);
    };
    // Boot Hill keeps its own layout: no challenge marker, Continue gone and no longer pinned, the lesson back to
    // screen-reader text, End turn back in its row where the challenge had it. Then one card from the hand is played.
    const bootHill = async (end) => {
      await wait(`document.querySelector('#sd-field[data-battlefield="boot-hill"] canvas.sd-world')?.width > 0 && document.getElementById('sd-status').textContent === 'Boot Hill · turn 1 · your turn'`);
      const layout = await evaluate(`({challenge: document.getElementById('showdown').hasAttribute('data-contest-challenge'), hidden: document.getElementById('sd-boot-hill').hidden,
        position: getComputedStyle(document.getElementById('sd-boot-hill')).position, lesson: getComputedStyle(document.getElementById('sd-lesson')).clipPath,
        end: document.getElementById('sd-end').getBoundingClientRect().top + scrollY})`);
      assert.deepEqual(layout, {challenge: false, hidden: true, position: "static", lesson: "inset(50%)", end}, "740 x 375: Boot Hill returns to its normal control layout");
      assert.equal(await evaluate(`document.getElementById('sd-restart').textContent`), "Restart this duel", "Boot Hill restores its ordinary restart control");
    };
    const played = (hand) => wait(`document.querySelectorAll('#sd-hand [data-card]').length === ${hand - 1} && document.getElementById('sd-status').textContent === 'Boot Hill · turn 1 · your turn'`);
    const handCount = () => evaluate(`document.querySelectorAll('#sd-hand [data-card]').length`);

    // Pointer: Ride from the first screen, then Continue where it is drawn, at scroll 0.
    let end = await shortChallenge(pressSeen);
    await pressSeen('[data-base="wizard"]');
    await handoff("Outrider struck the Wizards' Base for 1");
    const pointer = await seen("#sd-boot-hill");
    assert.ok(pointer.scrollY === 0 && pointer.onScreen, `740 x 375 pointer: after the Ride, Continue to Boot Hill is on the first screen: ${JSON.stringify(pointer)}`);
    await pressSeen("#sd-boot-hill");
    await bootHill(end);
    // A real wheel over the header scrolls the page as usual; then a playable card is pressed where it shows.
    let hand = await handCount();
    await send("Input.dispatchMouseEvent", {type: "mouseWheel", x: 60, y: 32, deltaX: 0, deltaY: 400});
    await wait(`(() => { const n = document.querySelector('#sd-hand [data-card]:not(:disabled)'), r = n?.getBoundingClientRect();
      return scrollY > 0 && r && r.top >= 0 && r.bottom <= innerHeight; })()`);
    await pressSeen("#sd-hand [data-card]:not(:disabled)");
    await played(hand);
    clean();
    check(`740 x 375 pointer: after the Ride, Continue to Boot Hill is on the first screen (y ${pointer.top}-${pointer.bottom}, scroll 0), under the instruction and clear of every control; Boot Hill keeps its control row and takes a card after a normal scroll`);

    // Keyboard: Fight, then Tab to Continue, which is on screen while focused; Enter on the focused card plays it.
    end = await shortChallenge(activateByKey);
    await activateByKey(`[data-slot="${await evaluate(`document.querySelector('[data-slot^="wizard-"][data-enemy]').dataset.slot`)}"]`);
    await handoff("Outrider attacked");
    await tabTo("#sd-boot-hill");
    const keyed = await seen("#sd-boot-hill");
    assert.ok(keyed?.onScreen, `740 x 375 keyboard: focused Continue to Boot Hill is on screen: ${JSON.stringify(keyed)}`);
    await press("Enter", 13);
    await bootHill(end);
    assert.ok(await evaluate(`document.activeElement?.matches('#sd-hand [data-card]:not(:disabled)')`), "740 x 375 keyboard: Boot Hill focuses a playable card");
    hand = await handCount();
    await press("Enter", 13);
    await played(hand);
    clean();
    await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
    check(`740 x 375 keyboard: after the Fight, Tab reaches Continue to Boot Hill on screen (y ${keyed.top}-${keyed.bottom}, scroll ${keyed.scrollY}); Boot Hill keeps its control row and Enter plays the focused card`);
    cdp.close();
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await Promise.race([exited, sleep(5000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await rm(profile, {recursive: true, force: true, maxRetries: 5});
  }
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
