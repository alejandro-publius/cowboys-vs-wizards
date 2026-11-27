// Check staged landing states with Chrome’s accessibility tree and DOM.
// Usage:
//   node scripts/stage-pages.mjs --commit "$(git rev-parse HEAD)"
//   node scripts/browser-accessibility-audit.mjs [--dir dist/web] [--out .artifacts/accessibility-audit.json]
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";

const BASE_PATH = "/cowboys-vs-wizards/";
const CHROME = process.env.CHROME_PATH ?? process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
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

// Select generated, route-specific content so static shells and loading screens cannot pass.
const ROUTES = [
  {id: "title-3d", rel: "", marker: "#title-screen #menu-challenge", buttonName: "Play Showdown"},
  {id: "title-play", rel: "", enter: "#title-screen #menu-challenge", marker: "#showdown[data-contest-challenge] [data-own]", polite: true},
  {id: "saloon-review", rel: "?saloon=review", enter: '#room-for-night-shift-saloon[open] [data-saloon-show="table"]',
    marker: '[data-saloon-page="table"] [data-shot=baseline]', modal: true, polite: true, feedback: ".saloon-shot-result"},
  {id: "outrider-challenge", rel: "?outrider=case-e", marker: "#showdown[data-contest-challenge] [data-own]", polite: true},
  {id: "replay-room", rel: "?room=replay", marker: "#replay-room [data-branch]", feedback: ".rr-step-status"},
  {id: "even-fight", rel: "?even-fight=1&seed=3", marker: "#showdown #sd-status", text: "Even Fight preview", polite: true},
  {id: "graybox-title", rel: "graybox/", marker: "#title-screen #menu-play", mounted: "#camp-replay-room"},
  {id: "reference-showdown", rel: "showdown/", marker: "#trail [data-duel]", polite: true},
  {id: "boot-hill-poker", rel: "poker/", marker: "#screen span", polite: true},
];
const controlRoles = new Set(["button", "link", "checkbox", "radio", "switch", "combobox", "listbox", "searchbox",
  "textbox", "slider", "spinbutton", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "DisclosureTriangle"]);

function landingReady(url, route) {
  const expected = new URL(url);
  const page = new URL(location.href);
  const marker = document.querySelector(route.marker);
  return page.origin === expected.origin && page.pathname === expected.pathname && [...expected.searchParams].every(([key, value]) => page.searchParams.get(key) === value)
    && document.readyState === "complete" && marker?.checkVisibility({visibilityProperty: true})
    && (!route.text || marker.textContent.includes(route.text)) && (!route.mounted || document.querySelector(route.mounted));
}

function inspectDocument() {
  const seen = new Set(), duplicateIds = [], brokenAriaRefs = [];
  for (const {id} of document.querySelectorAll("[id]")) {
    if (!id) continue;
    if (seen.has(id)) duplicateIds.push(id);
    seen.add(id);
  }
  const scope = document.querySelector("dialog:modal") ?? document;
  for (const attr of ["aria-labelledby", "aria-describedby"]) {
    for (const el of scope.querySelectorAll("[" + attr + "]")) {
      if (el.closest('[aria-hidden="true"], [inert]') || !el.checkVisibility({visibilityProperty: true})) continue;
      const ids = el.getAttribute(attr).trim().split(/\s+/).filter(Boolean);
      if (!ids.length) brokenAriaRefs.push(attr + " is empty");
      for (const id of ids) if (!seen.has(id)) brokenAriaRefs.push(attr + " -> " + id);
    }
  }
  return {lang: document.documentElement.lang.trim(), title: document.title.trim(), duplicateIds, brokenAriaRefs};
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
    ws.addEventListener("close", () => {
      for (const entry of waiting.values()) entry.reject(new Error("Chrome disconnected during " + entry.method));
      waiting.clear();
    });
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
const profile = await mkdtemp(path.join(tmpdir(), "cvw-a11y-chrome-"));
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

const auditReport = {schema: "cvw-accessibility-audit/2", routes: [], violations: []};

try {
  let stderr = "";
  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Chrome timeout:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => { clearTimeout(timer); reject(new Error(`Chrome exited ${signal ?? code}: ${stderr}`)); });
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
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

  async function press(key, code) {
    const event = {key, code: key, windowsVirtualKeyCode: code};
    await send("Input.dispatchKeyEvent", {type: "keyDown", ...event, ...(key === "Enter" ? {text: "\r"} : {})});
    await send("Input.dispatchKeyEvent", {type: "keyUp", ...event});
  }

  async function activateByKey(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    assert.ok(await evaluate(`document.activeElement.matches(${JSON.stringify(selector)})`), `cannot focus ${selector}`);
    await press("Enter", 13);
  }

  async function exposedNodes(selector) {
    const {result} = await send("Runtime.evaluate", {expression: `document.querySelector(${JSON.stringify(selector)})`});
    const {nodes} = await send("Accessibility.getPartialAXTree", {objectId: result.objectId, fetchRelatives: false});
    return nodes.filter((node) => !node.ignored);
  }

  async function checkDuelNavigation() {
    for (const [selector, name] of [[".sd-open-gallery", "Card gallery"], [".book-launch", "Character book"]]) {
      const launcher = "#showdown > header " + selector;
      const [button] = await exposedNodes(launcher);
      assert.equal(button?.role.value, "button", launcher);
      assert.equal(button.name.value, name, launcher);
      await activateByKey(launcher);
      const [dialog] = await exposedNodes("dialog:modal");
      assert.equal(dialog?.role.value, "dialog", name);
      assert.equal(dialog.name.value, name, launcher);
      assert.ok(await evaluate("!!document.activeElement.closest('dialog:modal')"), `keyboard focus entered ${name}`);
      await press("Escape", 27);
      await wait(`!document.querySelector("dialog:modal") && document.activeElement.matches(${JSON.stringify(launcher)})`);
    }
  }

  async function checkEvenFight() {
    const hand = ".table-hand-rules > summary";
    const rules = [
      ["cowboy-covered-wagon", "Covered Wagon", "Guard", "Enemies must attack this troop before any other troop or the Base."],
      ["cowboy-bear-trap", "Bear Trap", "△ −2 ●", "Trap. When an enemy troop attacks, it loses 2 orbs first. If that defeats it, the attack never lands."],
      ["cowboy-deadeye", "Deadeye", "✦ −1 ●", "Cannot target Ghostly troops or troops in cover."],
    ];
    const [summary] = await exposedNodes(hand);
    assert.equal(summary?.role.value, "DisclosureTriangle", "Hand rules is a disclosure");
    assert.equal(summary.name.value, "Hand rules");
    for (const [id, name, cue, rule] of rules) {
      const selector = `#sd-hand [data-card^="${id}-"]`;
      const badge = JSON.stringify(selector + " .table-card-rule");
      assert.equal(await evaluate(`document.querySelector(${badge})?.checkVisibility({visibilityProperty: true, opacityProperty: true}) && document.querySelector(${badge}).innerText`), cue, name);
      const [card] = await exposedNodes(selector);
      assert.equal(card?.role.value, "button", name);
      assert.equal(card.name.value, "Play " + name);
      assert.ok(card.description?.value.includes(rule), `hand button for ${name} describes its rule: ${card.description?.value}`);
    }
    await activateByKey(hand);
    const list = ".table-hand-rules[open] > .table-hand-rule-list";
    await wait(`document.querySelector(${JSON.stringify(list)})?.checkVisibility({visibilityProperty: true})`);
    const entries = await evaluate(`[...document.querySelectorAll(${JSON.stringify(list + " p")})].filter(p => p.checkVisibility({visibilityProperty: true, opacityProperty: true})).map(p => p.innerText.replace(/\\s+/g, ' '))`);
    for (const [, name, , rule] of rules) {
      assert.ok(entries.some(entry => entry.startsWith(name) && entry.includes(rule)), `hand inspection shows the full rule for ${name}: ${rule}`);
    }
    await activateByKey("[data-close-hand-rules]");
    await wait(`!document.querySelector('.table-hand-rules').open && document.activeElement.matches(${JSON.stringify(hand)})`);
    await activateByKey('#sd-hand [data-card^="cowboy-covered-wagon-"]');
    await activateByKey("#sd-end");
    await wait(`document.querySelector("#sd-status").textContent.includes("turn 3 · your turn")`);
    await activateByKey('#sd-board [data-own="0"]');
    const [guard] = await exposedNodes('#sd-board [data-enemy="0"]');
    assert.equal(guard?.role.value, "button");
    assert.match(guard.name.value, /Bone Wall/);
    assert.ok(guard.properties.some((p) => p.name === "focused" && p.value.value), "the sole legal attack target has keyboard focus");
    assert.equal(guard.description?.value, "Survives on 3. It has no attack, so yours is unharmed. A Guard stands in the way: attack it first. Or take cover: until your next turn it keeps extra damage off your Base, but it will not hit back. Spells cannot hit a troop in cover.");
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('#sd-board [data-enemy]')].map(b => b.dataset.enemy)`), ["0"], "Guard blocks the Base");
    await press("Enter", 13);
    await wait(`document.querySelector("#sd-feedback").textContent.includes("Covered Wagon attacked Bone Wall and left it on 3")`);
  }

  // Exercise one keyboard action in each recorded review. Check the updated text and its exposed live property.
  async function checkFeedback(route) {
    const status = `document.querySelector(${JSON.stringify(route.feedback)})`;
    const visibleText = `(${status}?.checkVisibility({visibilityProperty: true}) ? ${status}.textContent.trim() : "")`;
    const before = await evaluate(visibleText);
    await activateByKey(route.marker);
    await wait(`${visibleText}.length > 0 && ${visibleText} !== ${JSON.stringify(before)}`);
    return (await exposedNodes(route.feedback)).some(isPolite);
  }

  const isPolite = (node) => node.properties?.some((p) => p.name === "live" && p.value.value === "polite");
  async function inspectRoute(route) {
    pageErrors.length = 0;
    badResponses.length = 0;
    const url = site + route.rel;
    const navigation = await send("Page.navigate", {url});
    if (navigation.errorText) throw new Error(navigation.errorText);
    if (route.enter) {
      await wait(`(${landingReady})(${JSON.stringify(url)}, ${JSON.stringify({marker: route.enter})})`);
      await activateByKey(route.enter);
    }
    await wait(`(${landingReady})(${JSON.stringify(url)}, ${JSON.stringify(route)})`);

    const domAudit = await evaluate(`(${inspectDocument})()`);
    const axNodes = (await send("Accessibility.getFullAXTree")).nodes.filter((n) => !n.ignored);
    const controls = axNodes.filter((node) => controlRoles.has(node.role.value));
    const unnamed = controls.filter((node) => !node.name?.value.trim());
    const mains = axNodes.filter((node) => node.role.value === "main").length;
    const dialogs = axNodes.filter((node) => node.role.value === "dialog" && node.name?.value.trim()).length;
    const polite = axNodes.filter(isPolite).length;
    const routeIssues = [];
    if (!domAudit.lang) routeIssues.push("missing html[lang]");
    if (!domAudit.title) routeIssues.push("empty <title>");
    if (domAudit.duplicateIds.length) routeIssues.push(`duplicate ids: ${domAudit.duplicateIds.join(", ")}`);
    if (domAudit.brokenAriaRefs.length) routeIssues.push(`broken ARIA refs: ${domAudit.brokenAriaRefs.join(", ")}`);
    if (!controls.length) routeIssues.push("no exposed controls");
    if (route.buttonName && !(await exposedNodes(route.marker)).some((node) => node.role.value === "button" && node.name?.value === route.buttonName)) {
      routeIssues.push(`${route.marker} must expose a button named "${route.buttonName}"`);
    }
    if (unnamed.length) routeIssues.push(`unnamed controls: ${unnamed.map((n) => n.role.value + "#" + n.backendDOMNodeId).join(", ")}`);
    if (route.modal ? dialogs !== 1 || mains !== 0 : mains !== 1) {
      routeIssues.push(`expected ${route.modal ? "one named modal with the background excluded" : "one main landmark"}; found ${mains} main, ${dialogs} named dialog(s)`);
    }
    if (route.polite && !polite) routeIssues.push("no exposed polite live region");
    const feedback = route.feedback ? await checkFeedback(route) : undefined;
    if (feedback === false) routeIssues.push("keyboard action produced no exposed polite feedback");
    if (route.id === "title-play") await checkDuelNavigation();
    if (route.id === "even-fight") await checkEvenFight();
    if (pageErrors.length) routeIssues.push(`console/page errors: ${pageErrors.join("; ")}`);
    if (badResponses.length) routeIssues.push(`HTTP >=400: ${JSON.stringify(badResponses)}`);

    return {lang: domAudit.lang, title: domAudit.title, axNodeCount: axNodes.length, controls: controls.length,
      mainLandmarks: mains, namedDialogs: dialogs, politeLiveRegions: polite, keyboardFeedback: feedback, issues: routeIssues};
  }

  for (const route of ROUTES) {
    let result;
    try {
      result = await inspectRoute(route);
    } catch (error) {
      result = {issues: [error.message]};
    }
    const entry = {route: BASE_PATH + route.rel, id: route.id, ...result};
    auditReport.routes.push(entry);
    for (const issue of entry.issues) auditReport.violations.push(`${route.id}: ${issue}`);
    console.log(`${entry.issues.length ? "FAIL" : "PASS"} ${route.id}: ${entry.issues.length} issue(s)`);
  }

  cdp.close();
} finally {
  server.close();
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await sleep(300);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
}

await mkdir(path.dirname(outFile), {recursive: true});
await writeFile(outFile, JSON.stringify(auditReport, null, 2) + "\n");
assert.deepEqual(auditReport.violations, [], `Accessibility violations found:\n${auditReport.violations.join("\n")}`);
console.log(`All ${auditReport.routes.length} landing states passed the automated checks -> ${path.relative(root, outFile)}`);
