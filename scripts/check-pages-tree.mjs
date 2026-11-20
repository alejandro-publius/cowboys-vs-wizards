// Serves a staged Pages tree (node scripts/stage-pages.mjs --commit <sha>) over local HTTP under the
// project path, /cowboys-vs-wizards/, and checks it the way the deployed site is used.
//   node scripts/check-pages-tree.mjs [--dir dist/web] [--commit <40 hex>] [--browser] [--out-dir PATH]
// Without --browser (Node only, no Chrome):
//   - build.json, /index.html and the /graybox/ alias pass scripts/verify-build-identity.mjs, which
//     hashes the served bytes; with --commit the manifest must name that commit
//   - every assets/ URL in /3d/index.html is relative, is served from /cowboys-vs-wizards/3d/assets/
//     with the bytes on disk, and every model in the page's model list is a glTF binary
//   - /showdown/ is served, and the /3d/ page carries the earlier-build label
// --browser, native headless Chrome with a fresh profile (SwiftShader WebGL), mouse events only:
//   - / and /graybox/: Play on a clean profile opens the Camp
//   - /showdown/: the reference page loads without errors
//   - /3d/?mode=demo: the board boots without the fallback video, and every model file is fetched
//     from /3d/assets/ with HTTP 200
//   No page error, failed request or HTTP error is allowed anywhere.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
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
  // 1. Release identity of the root, and the /graybox/ alias is the same bytes.
  const rootHtml = await get("");
  assert.equal(rootHtml.status, 200, "root index.html");
  const digest = createHash("sha256").update(rootHtml.bytes).digest("hex");
  const manifest = JSON.parse((await get("build.json")).bytes);
  if (commit) assert.equal(manifest.commit, commit, "build.json commit");
  await verifyLive({url: site, commit: manifest.commit, htmlSha256: digest, aliases: ["graybox/"], attempts: 1, log() {}});
  check("build.json names the served root index.html; /graybox/ serves the same bytes", {commit: manifest.commit, indexHtmlSha256: digest});
  assert.match(rootHtml.bytes.toString("utf8"), /id="menu-play"/, "root is the graybox page with Play");
  assert.equal((await get("graybox", "manual")).location, `${BASE_PATH}graybox/`, "/graybox redirects to /graybox/");

  // 2. The /3d/ page and every asset it names.
  const page3d = await get("3d/");
  assert.equal(page3d.status, 200, "/3d/ index.html");
  const html3d = page3d.bytes.toString("utf8");
  assert.match(html3d, /<title>Cowboys vs\. Wizards \| Earlier illustrated build<\/title>/);
  assert.match(html3d, /id="earlier-build"[^>]*>Earlier illustrated build[^<]*<a href="\.\.\/"/);
  assert.doesNotMatch(html3d, /["'(]\/(?:cowboys-vs-wizards\/)?(?:3d\/)?assets\//, "no absolute asset URL");
  const models = Object.entries(JSON.parse(html3d.match(/<script id="models" type="application\/json">(.*?)<\/script>/s)[1]));
  assert.ok(models.length > 0 && models.every(([, entry]) => typeof entry.url === "string"), "model list has URLs");
  const urls = [...new Set(html3d.match(/(?<![\w/.-])(?:\.\/)?assets\/[\w.-]+\.(?:glb|webp|png|jpg|mp4)/g))];
  for (const url of urls) {
    const served = await get("3d/" + url.replace(/^\.\//, ""));
    assert.equal(served.status, 200, url);
    assert.ok(served.bytes.equals(await readFile(path.join(dir, "3d", url))), `${url} bytes`);
  }
  for (const [name, {url}] of models) {
    assert.ok(urls.includes(url), `${name} listed`);
    assert.equal((await get("3d/" + url)).bytes.subarray(0, 4).toString("latin1"), "glTF", `${name} is a glTF binary`);
  }
  check("/3d/ is labelled as the earlier build; every relative asset resolves under /3d/assets/", {assets: urls.length, models: models.length});
  const showdown = await get("showdown/");
  assert.equal(showdown.status, 200);
  check("/showdown/ is served", {bytes: showdown.bytes.length});

  if (browser) await browserChecks(models.map(([, {url}]) => new URL("3d/" + url, site).pathname));
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

async function browserChecks(modelPaths) {
  const profile = await mkdtemp("/tmp/kiro-pages-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--window-size=1440,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
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
      if (method === "Network.responseReceived") responses.push({url: params.response.url, status: params.response.status});
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

    for (const rel of ["", "graybox/"]) {
      await send("Storage.clearDataForOrigin", {origin: new URL(site).origin, storageTypes: "all"});
      await open(rel);
      await click("#menu-play");
      await wait(`${shown("showdown-camp")}&&document.getElementById('title-screen').hidden`);
      const tile = await evaluate(`document.querySelector('#camp-trail button strong')?.textContent??null`);
      assert.equal(tile, "Boot Hill");
      clean();
      check(`${BASE_PATH}${rel}: Play on a clean profile opens the Camp (first Trail duel Boot Hill)`);
    }
    await open("showdown/");
    await wait(`document.body&&document.body.innerText.trim().length>0`);
    await sleep(500);
    clean();
    check(`${BASE_PATH}showdown/: the Showdown reference page loads without errors`);

    responses.length = 0;
    await open("3d/?mode=demo");
    await wait(`document.getElementById('boot')?.hidden===true`, 180000);
    const state = await evaluate(`({fallback:!document.getElementById('fallback').hidden,label:document.getElementById('earlier-build')?.textContent??null,
      home:new URL(document.querySelector('#earlier-build a').getAttribute('href'),location.href).href,title:document.title})`);
    assert.equal(state.fallback, false, "WebGL board, not the fallback video");
    assert.equal(state.home, site);
    const fetched = responses.filter((r) => new URL(r.url).pathname.endsWith(".glb"));
    for (const model of modelPaths) assert.ok(fetched.some((r) => new URL(r.url).pathname === model && r.status === 200), `fetched ${model}`);
    assert.ok(fetched.every((r) => new URL(r.url).pathname.startsWith(`${BASE_PATH}3d/assets/`)));
    clean();
    check(`${BASE_PATH}3d/?mode=demo: the earlier 3D board boots with WebGL and loads every model from /3d/assets/`,
      {...state, modelsFetched: fetched.length});
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
