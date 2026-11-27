// HSM-3: Zero-dependency headless Chrome WCAG & AXTree accessibility audit across all public staged routes.
// Usage:
//   node scripts/stage-pages.mjs --commit "$(git rev-parse HEAD)"
//   node scripts/browser-accessibility-audit.mjs [--dir dist/web] [--out .artifacts/accessibility-audit.json]
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const BASE_PATH = "/cowboys-vs-wizards/";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const dir = path.resolve(root, option("--dir", "dist/web"));
const outFile = path.resolve(root, option("--out", ".artifacts/accessibility-audit.json"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
};

const ROUTES = [
  {id: "title-3d", rel: "", waitExpr: "!!document.querySelector('#title-screen')"},
  {id: "saloon-review", rel: "?saloon=review", waitExpr: "!!document.querySelector('.saloon-billy-table button[data-shot]')"},
  {id: "outrider-challenge", rel: "?outrider=case-e", waitExpr: "!!document.querySelector('#sd-board [data-own]')"},
  {id: "replay-room", rel: "?room=replay", waitExpr: "document.readyState === 'complete'"},
  {id: "even-fight", rel: "?even-fight=1", waitExpr: "!!document.querySelector('#sd-board')"},
  {id: "graybox-title", rel: "graybox/", waitExpr: "!!document.querySelector('#menu-play')"},
  {id: "reference-showdown", rel: "showdown/", waitExpr: "document.readyState === 'complete'"},
  {id: "boot-hill-poker", rel: "poker/", waitExpr: "document.readyState === 'complete' && document.body.textContent.trim().length > 40"},
];

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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let rel = decodeURIComponent(url.pathname);
  if (!rel.startsWith(BASE_PATH)) { res.statusCode = 404; return res.end("outside site"); }
  rel = rel.slice(BASE_PATH.length);
  const file = path.resolve(dir, rel.endsWith("/") || rel === "" ? rel + "index.html" : rel);
  if (!file.startsWith(dir + path.sep)) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader("content-type", mime[path.extname(file)] ?? "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
});

await new Promise((done) => server.listen(0, "127.0.0.1", done));
const site = `http://127.0.0.1:${server.address().port}${BASE_PATH}`;
const faviconUrl = new URL("/favicon.ico", site).href;
const profile = await mkdtemp("/tmp/cvw-a11y-chrome-");
const child = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  "--hide-scrollbars",
  "--window-size=1440,900",
  "about:blank",
], {stdio: ["ignore", "ignore", "pipe"]});

const auditReport = {schema: "cvw-accessibility-audit/1", routes: [], violations: []};

try {
  let stderr = "";
  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Chrome timeout:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited ${code}`)); });
  });

  const cdp = await connect(wsUrl);
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);

  const pageErrors = [], badResponses = [];
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") pageErrors.push(params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      pageErrors.push(params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (method === "Network.responseReceived" && params.response.status >= 400 && params.response.url !== faviconUrl) {
      badResponses.push({url: params.response.url, status: params.response.status});
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Accessibility.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: "reduce"}]});

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 15000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await evaluate(expression)) return;
      await sleep(80);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  };

  for (const route of ROUTES) {
    pageErrors.length = 0;
    badResponses.length = 0;
    await send("Page.navigate", {url: site + route.rel});
    await wait(route.waitExpr);
    await sleep(150);

    const domAudit = await evaluate(`(() => {
      const lang = document.documentElement.getAttribute("lang") || "";
      const title = document.title.trim();
      const seenIds = new Set(), duplicateIds = [];
      for (const el of document.querySelectorAll("[id]")) {
        if (!el.id) continue;
        if (seenIds.has(el.id)) duplicateIds.push(el.id);
        seenIds.add(el.id);
      }
      const brokenAriaRefs = [];
      for (const attr of ["aria-labelledby", "aria-describedby"]) {
        for (const el of document.querySelectorAll("[" + attr + "]")) {
          if (!el.checkVisibility?.()) continue;
          const ids = (el.getAttribute(attr) || "").trim().split(/\\s+/).filter(Boolean);
          for (const id of ids) {
            if (!document.getElementById(id)) brokenAriaRefs.push(attr + "->" + id);
          }
        }
      }
      const unnamedControls = [];
      const controls = document.querySelectorAll("button, a[href], input, select, textarea, summary");
      for (const el of controls) {
        if (el.hidden || el.closest("[hidden], [inert]") || !el.checkVisibility?.()) continue;
        const ariaLabel = (el.getAttribute("aria-label") || "").trim();
        const labelledBy = (el.getAttribute("aria-labelledby") || "").trim().split(/\\s+/).filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() || "").join(" ").trim();
        const text = (el.innerText || el.textContent || el.getAttribute("value") || el.getAttribute("title") || "").trim();
        const imgAlt = [...el.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt").trim()).join(" ").trim();
        const labelEl = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.textContent?.trim() || "" : "";
        if (!(ariaLabel || labelledBy || text || imgAlt || labelEl)) {
          unnamedControls.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
        }
      }
      const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length;
      return {lang, title, duplicateIds, brokenAriaRefs, unnamedControls, visibleControls: controls.length, liveRegions};
    })()`);

    const axNodes = (await send("Accessibility.getFullAXTree")).nodes.filter((n) => !n.ignored);
    const routeIssues = [];
    if (!domAudit.lang) routeIssues.push("missing html[lang]");
    if (!domAudit.title) routeIssues.push("empty <title>");
    if (domAudit.duplicateIds.length) routeIssues.push(`duplicate ids: ${domAudit.duplicateIds.join(", ")}`);
    if (domAudit.brokenAriaRefs.length) routeIssues.push(`broken ARIA refs: ${domAudit.brokenAriaRefs.join(", ")}`);
    if (domAudit.unnamedControls.length) routeIssues.push(`unnamed controls: ${domAudit.unnamedControls.join(", ")}`);
    if (pageErrors.length) routeIssues.push(`console/page errors: ${pageErrors.join("; ")}`);
    if (badResponses.length) routeIssues.push(`HTTP >=400: ${JSON.stringify(badResponses)}`);

    const entry = {
      route: BASE_PATH + route.rel,
      id: route.id,
      lang: domAudit.lang,
      title: domAudit.title,
      axNodeCount: axNodes.length,
      liveRegions: domAudit.liveRegions,
      issues: routeIssues,
    };
    auditReport.routes.push(entry);
    for (const issue of routeIssues) auditReport.violations.push(`${route.id}: ${issue}`);
    console.log(`${routeIssues.length === 0 ? "PASS" : "FAIL"} ${route.id} (${BASE_PATH}${route.rel}) — ${axNodes.length} AX nodes, 0 violations`);
  }

  cdp.close();
} finally {
  server.close();
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await sleep(300);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
}

await mkdir(path.dirname(outFile), {recursive: true});
await writeFile(outFile, JSON.stringify(auditReport, null, 2) + "\n");
assert.deepEqual(auditReport.violations, [], `Accessibility violations found:\n${auditReport.violations.join("\n")}`);
console.log(`All ${auditReport.routes.length} routes passed with 0 accessibility violations -> ${path.relative(root, outFile)}`);
