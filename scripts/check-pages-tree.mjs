// Serves a staged Pages tree (node scripts/stage-pages.mjs --commit <sha>) over local HTTP under the
// project path, /cowboys-vs-wizards/, and checks it the way the deployed site is used.
//   node scripts/check-pages-tree.mjs [--dir dist/web] [--commit <40 hex>] [--browser] [--out-dir PATH]
// Without --browser (Node only, no Chrome):
//   - build.json, /index.html and the /3d/ alias pass scripts/verify-build-identity.mjs, which
//     hashes the served bytes; with --commit the manifest must name that commit
//   - the tree holds exactly index.html, build.json, graybox/index.html, showdown/index.html and
//     3d/index.html: no script file, model, image, video or wasm from the retired 3D lane build
//   - the root and /3d/ carry illustrated Showdown; /graybox/ remains lightweight
//   - no page carries the retired lane game
//   - /showdown/ is served
// --browser, native headless Chrome with a fresh profile, mouse events only:
//   - the title challenge and its deep link open the same playable Bone Fence board
//   - Camp on / opens the Trail; Play on /graybox/ opens the Camp
//   - /showdown/: the reference page loads without errors
//   No page error, failed request or HTTP error is allowed anywhere.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {verifyLive} from "./verify-build-identity.mjs";

const BASE_PATH = "/cowboys-vs-wizards/";
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
  assert.deepEqual(files, ["3d/index.html", "build.json", "graybox/index.html", "index.html", "showdown/index.html"], "staged files");
  assert.equal((await get("3d", "manual")).location, `${BASE_PATH}3d/`, "/3d redirects to /3d/");
  const showdown = await get("showdown/");
  assert.equal(showdown.status, 200);
  for (const [route, html] of [["/", rootText], ["/graybox/", grayboxText], ["/showdown/", showdown.bytes.toString("utf8")]])
    assert.doesNotMatch(html, /chunks\/lanes-|id="arena"|id="menu-lanes"|id="earlier-build"|<script id="models"|rapier_wasm|rapier3d/, `${route} has no retired lane engine`);
  check("the four single-file pages include no retired lane game or separate assets", {files});

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
    const responses = [];
    cdp.on(({method, params, sessionId: id}) => {
      if (id !== sessionId) return;
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
    const shown = (id) => `!!document.getElementById('${id}')&&!document.getElementById('${id}').hidden`;
    const clean = () => {
      const bad = responses.filter((r) => r.status >= 400);
      assert.deepEqual(bad, [], "no HTTP errors");
      assert.deepEqual(report.errors, [], "no page errors or failed requests");
    };

    const playOpensCamp = async () => {
      await click("#menu-play");
      await wait(`${shown("showdown-camp")}&&document.getElementById('title-screen').hidden`);
      const tile = await evaluate(`document.querySelector('#camp-trail button strong')?.textContent??null`);
      assert.equal(tile, "Boot Hill");
    };

    for (const rel of ["", "graybox/"]) {
      await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
      await open(rel);
      if (rel === "graybox/") assert.equal(await evaluate(`Boolean(document.getElementById('menu-challenge'))`), false);
      await playOpensCamp();
      clean();
      check(`${BASE_PATH}${rel}: Play on a clean profile opens the Camp (first Trail duel Boot Hill)`);
    }
    await open("showdown/");
    await wait(`document.body&&document.body.innerText.trim().length>0`);
    await sleep(500);
    clean();
    check(`${BASE_PATH}showdown/: the Showdown reference page loads without errors`);

    const challengeOpens = async () => {
      await wait(`${shown("showdown")} && document.querySelector('#sd-field[data-battlefield="bone-fence"] canvas.sd-world')?.width > 0`);
      assert.match(await evaluate(`document.getElementById('sd-status').textContent`), /^Ride or Fight\?/);
      const slots = '[data-slot^="cowboy-"]';
      const rider = await evaluate(`[...document.querySelectorAll(${JSON.stringify(slots)})].find(x => x.textContent.includes('Outrider'))?.dataset.slot`);
      assert.ok(rider, "the Outrider is on the board");
      await click(`[data-slot="${rider}"]`);
      await wait(`document.querySelector('[data-base="wizard"]')?.dataset.enemy === 'base' && !!document.querySelector('[data-slot^="wizard-"][data-enemy]')`);
      clean();
    };
    await open("");
    await wait(`document.getElementById('menu-challenge')?.textContent === 'Ride or Fight?'`);
    await click("#menu-challenge");
    await challengeOpens();
    await click('[data-base="wizard"]');
    await wait(`/Outrider struck the Wizards' Base for 1/.test(document.getElementById('sd-log').textContent)`);
    await click("#sd-home");
    await wait(shown("showdown-camp"));
    check("the illustrated title opens the playable Ride or Fight? challenge and Camp is reachable");

    await open("3d/?outrider=case-a");
    await challengeOpens();
    const enemy = await evaluate(`document.querySelector('[data-slot^="wizard-"][data-enemy]').dataset.slot`);
    await click(`[data-slot="${enemy}"]`);
    await wait(`document.getElementById('sd-log').textContent.includes('Outrider attacked')`);
    check("the /3d/ deep link opens the second case and accepts an attack on a troop");
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
