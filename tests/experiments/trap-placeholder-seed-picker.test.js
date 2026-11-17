// Issue #122: guided trial seed picker of the local-only trap placeholder lab.
// Node checks of the picker data against the committed #120 seed plan and of
// the page source, then one Chrome loopback smoke with real CDP key presses
// and mouse clicks (skipped when Chrome is not at the default macOS path).
// Not part of npm test. Run: node --test tests/experiments/trap-placeholder-seed-picker.test.js
// Automation only: no human played, and nothing here is accessibility evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMatch } from "../../src/game/state.js";
import { CATEGORIES, pickSeeds, renderPlan } from "../../experiments/trap-playtest-kit/seeds.js";
import { DECK_TRAP_IDS, openingFor } from "../../experiments/trap-placeholder/scenarios.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");
const WIZARD_TRAP_IDS = DECK_TRAP_IDS.filter((id) => id.includes("-wizard-"));
const plan = pickSeeds();

test("picker data: six categories A-F with seeds, three Cowboy-first and three Wizard-first, equal to the committed plan", () => {
  assert.deepEqual(plan.picks.map((p) => p.category), ["A", "B", "C", "D", "E", "F"]);
  assert.deepEqual(CATEGORIES.map((c) => c.id), ["A", "B", "C", "D", "E", "F"]);
  assert.ok(plan.picks.every((p) => Number.isInteger(p.seed)), "every category has a seed");
  assert.equal(new Set(plan.picks.map((p) => p.seed)).size, 6, "six distinct seeds");
  assert.equal(plan.picks.filter((p) => p.startingSide === "cowboy").length, 3);
  assert.equal(plan.picks.filter((p) => p.startingSide === "wizard").length, 3);
  for (const p of plan.picks) assert.equal(p.startingSide, p.starter, p.category);
  assert.equal(renderPlan(plan), read("experiments/trap-playtest-kit/seed-plan.md"), "the picker reads the same plan as seed-plan.md");
  assert.equal(plan.picks[0].seed, 55, "A is seed 55 (the smoke below relies on it)");
  assert.ok(plan.t2 && plan.t2.traps.every((p) => p < 4), "optional T2 example has both Cowboy traps in the opening hand");
  // Each picked seed: 12 cards per side, same starting side as BASE.
  for (const p of [...plan.picks, plan.t2]) {
    const opening = openingFor(p.seed, p.traps ? "T2" : "T1");
    assert.equal(opening.startingSide, createMatch(p.seed).startingSide);
    for (const side of ["cowboy", "wizard"]) assert.equal(opening.sides[side].hand.length + opening.sides[side].deck.length, 12);
  }
});

test("page source: native select and both buttons, options from pickSeeds at runtime, no hardcoded seed, no start call, no remote URL", () => {
  const html = read("experiments/trap-placeholder/index.html");
  const app = read("experiments/trap-placeholder/app.js");
  assert.match(html, /<label for="trial-pick">Guided T1 trial<\/label>/);
  assert.match(html, /<select id="trial-pick"/);
  assert.match(html, /<button type="button" id="prepare-trial">Prepare trial — does not start<\/button>/);
  assert.match(html, /<button type="button" id="prepare-base">Prepare paired BASE at current seed — does not start<\/button>/);
  assert.match(html, /<p id="trial-status" aria-live="polite">/);
  assert.match(html, /<option value="FIXTURE" selected>/, "FIXTURE stays the default scenario");
  // Only the placeholder option is in the HTML; the rest are built from pickSeeds().
  const at = html.indexOf('<select id="trial-pick"');
  assert.equal((html.slice(at, html.indexOf("</select>", at)).match(/<option/g) ?? []).length, 1);
  assert.match(app, /import \{ CATEGORIES, pickSeeds \} from "\.\.\/trap-playtest-kit\/seeds\.js";/);
  assert.equal(/trap-deck-sim|run\.mjs|node:/.test(app), false, "no Node-only import");
  // The picker block never starts, restarts or leaves a match, moves focus or touches notes or export.
  const block = app.slice(app.indexOf("// Issue #122: guided trial seeds."), app.indexOf("function loop(now)")).replace(/^\s*\/\/.*$/gm, "");
  assert.ok(block.length > 0);
  assert.equal(/session\.|\.start\(|restart|leave|\.focus\(|export-report|clear-notes|NOTE_INPUTS|\.click\(/.test(block), false);
  for (const seed of [...plan.picks.map((p) => p.seed), plan.t2.seed]) {
    assert.equal(new RegExp(`\\b${seed}\\b`).test(block), false, `seed ${seed} hardcoded in the picker`);
  }
  for (const text of [html, app]) {
    assert.equal(/https?:\/\/|fetch\(|sendBeacon|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/.test(text), false);
    assert.equal(text.includes("test-fixture-deck-trap"), false, "no synthetic trap ID in the page source");
  }
});

// ---- Chrome loopback smoke (DevTools protocol, no dependency) ----

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KEYS = { Tab: 9, Enter: 13, a: 65, t: 84 };
const CODES = { Tab: "Tab", Enter: "Enter", a: "KeyA", t: "KeyT" };

function serve() {
  const server = createServer(async (req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname));
    if (req.method !== "GET" || !file.startsWith(ROOT)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launchChrome() {
  const profile = await mkdtemp(path.join(tmpdir(), "kiro-trap-picker-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--mute-audio", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}:\n${stderr}`)); });
  });
  return {
    url,
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await Promise.race([exited, sleep(5000)]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      await rm(profile, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const waiting = new Map();
    const listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id === undefined) return listeners.forEach((listener) => listener(message));
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) entry?.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry?.resolve(message.result);
    });
    ws.addEventListener("error", () => reject(new Error(`WebSocket error on ${wsUrl}`)));
    ws.addEventListener("open", () => resolve({
      send(method, params = {}, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        return new Promise((ok, fail) => waiting.set(id, { resolve: ok, reject: fail, method }));
      },
      on: (listener) => listeners.add(listener),
      close: () => ws.close(),
    }));
  });
}

test("Chrome smoke: keyboard-select A, Prepare leaves the match alone, Start runs T1 55 Normal; paired BASE at 55 pending until Start; exports follow the active match", { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}` }, async (t) => {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const downloads = await mkdtemp(path.join(tmpdir(), "kiro-trap-picker-dl-"));
  const errors = [];
  const requests = [];
  const finished = new Map();
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    cdp.on(({ method, params, sessionId: id }) => {
      if (method === "Browser.downloadWillBegin") finished.set(params.guid, { name: params.suggestedFilename, url: params.url, done: false });
      if (method === "Browser.downloadProgress" && params.state === "completed" && finished.has(params.guid)) finished.get(params.guid).done = true;
      if (id !== sessionId) return;
      if (method === "Network.requestWillBeSent") requests.push(params.request.url);
      if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
      if (method === "Runtime.consoleAPICalled" && params.type === "error") errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
    });
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });
    await send("Network.enable");
    await send("Page.enable");
    await send("Runtime.enable");
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async (expression, ms = 30000) => {
      for (const stop = Date.now() + ms; Date.now() < stop; await sleep(40)) if (await evaluate(expression)) return;
      throw new Error(`timed out: ${expression}`);
    };
    // Real key events: keyDown (with text for Enter and letters) and keyUp.
    const key = async (name) => {
      const base = { key: name, code: CODES[name], windowsVirtualKeyCode: KEYS[name], nativeVirtualKeyCode: KEYS[name] };
      const text = name === "Enter" ? "\r" : name.length === 1 ? name : undefined;
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(text ? { text } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    };
    const activeId = () => evaluate(`document.activeElement?.id ?? ""`);
    const tabTo = async (id, max = 40) => {
      for (let i = 0; i <= max; i++) {
        if ((await activeId()) === id) return;
        await key("Tab");
      }
      throw new Error(`never reached #${id}`);
    };
    // A real mouse click at the centre of the element.
    const click = async (selector) => {
      const [x, y] = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    };
    const START = `#seed-form button[type="submit"]`;
    const text = (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
    const form = () => evaluate(`["seed", "scenario", "cpu-level"].map((id) => document.getElementById(id).value)`);
    // Active match fingerprint: status minus the pending notes, log length, hand keys.
    const snapshot = () => evaluate(`[document.getElementById("status").textContent.replace(/ Settings changed.*$| Seed field .*$/, "").trim(), document.querySelectorAll("#log li").length, [...document.querySelectorAll("#hand button")].map((b) => b.dataset.key).join()]`);
    const hand = () => evaluate(`[...document.querySelectorAll("#hand button")].map((b) => b.dataset.key.replace(/-\\d+$/, ""))`);
    const hiddenLeak = () => evaluate(`${JSON.stringify(WIZARD_TRAP_IDS)}.filter((id) => document.documentElement.outerHTML.includes(id))`);
    const exportReport = async () => {
      const before = finished.size;
      await click("#export-report");
      for (const stop = Date.now() + 20000; Date.now() < stop && !([...finished.values()][before]?.done); ) await sleep(40);
      const entry = [...finished.values()][before];
      assert.ok(entry?.done, "download completed");
      return { name: entry.name, report: JSON.parse(await readFile(path.join(downloads, entry.name), "utf8")) };
    };

    await send("Page.navigate", { url: `${origin}/experiments/trap-placeholder/index.html` });
    await wait(`/^Status: (accepting_input|cpu_turn)\\./.test(document.getElementById("status")?.textContent)`);
    // Load: FIXTURE default, nothing chosen or prepared.
    assert.deepEqual(await form(), ["0", "FIXTURE", "normal"]);
    assert.match(await text("status"), /Seed 0\. .*Scenario FIXTURE /);
    assert.equal(await evaluate(`document.getElementById("trial-pick").value`), "");
    assert.equal(await text("trial-status"), "");
    const labels = await evaluate(`[...document.getElementById("trial-pick").options].map((o) => [o.value, o.textContent, o.disabled])`);
    assert.deepEqual(labels.map(([v]) => v), ["", "A", "B", "C", "D", "E", "F", "T2"]);
    for (const p of plan.picks) assert.ok(labels.find(([v]) => v === p.category)[1].startsWith(`${p.category}: seed ${p.seed}, `), p.category);
    assert.equal(labels.some(([, , disabled]) => disabled), false);

    // A typed note that must survive every Prepare and Start.
    const NOTE = "Automated smoke test text, not human feedback.";
    await evaluate(`document.getElementById("note-freeform").focus()`);
    await send("Input.insertText", { text: NOTE });
    await evaluate(`document.activeElement.blur()`);
    await wait(`document.getElementById("status").textContent.startsWith("Status: accepting_input.")`);

    // Keyboard: Tab to the select, type "a" (typeahead) to choose A, Tab, Enter on Prepare.
    const before = await snapshot();
    await tabTo("trial-pick");
    await key("a");
    await wait(`document.getElementById("trial-pick").value === "A"`, 5000);
    assert.match(await text("trial-detail"), /^Category A .*Seed 55, Cowboy first\. Your synthetic trap: position 0 \(opening hand\)\. Your spell: position 2 \(opening hand\)\./);
    assert.deepEqual(await form(), ["0", "FIXTURE", "normal"], "choosing an option changes no field");
    assert.deepEqual(await snapshot(), before, "choosing an option changes no match");
    await key("Tab");
    assert.equal(await activeId(), "prepare-trial");
    await key("Enter");
    await wait(`document.getElementById("trial-status").textContent.startsWith("Prepared A")`, 5000);
    assert.equal(await activeId(), "prepare-trial", "focus stays on the pressed button");
    assert.deepEqual(await form(), ["55", "T1", "normal"]);
    assert.equal(await text("trial-status"), "Prepared A: seed 55, scenario T1, Wizard CPU normal. Nothing started: the current match is unchanged. Press Start.");
    assert.match(await text("status"), /Seed 0\. .*Scenario FIXTURE .*Settings changed: they apply on Start\. Seed field 55 applies on Start\./);
    await sleep(800);
    assert.deepEqual(await snapshot(), before, "Prepare leaves the same match (status, log, hand)");

    // Start with a real click: T1 seed 55, Normal, 12-card opening equal to the seed kit.
    await click(START);
    await wait(`document.getElementById("status").textContent.includes("Seed 55.") && document.getElementById("status").textContent.includes("Scenario T1 ")`);
    await wait(`document.getElementById("status").textContent.startsWith("Status: accepting_input.")`);
    const t1Status = await text("status");
    assert.match(t1Status, /Wizard CPU: normal\./);
    assert.equal(/Settings changed|Seed field/.test(t1Status), false);
    assert.deepEqual(await hand(), openingFor(55, "T1").sides.cowboy.hand);
    const counts = await evaluate(`["cowboy-info", "wizard-info"].map((id) => document.getElementById(id).textContent.match(/Deck (\\d+), hand (\\d+)/).slice(1).map(Number))`);
    assert.deepEqual(counts.map(([d, h]) => d + h), [12, 12]);
    assert.deepEqual(await hiddenLeak(), []);
    const firstExport = await exportReport();
    assert.equal(firstExport.name, "trap-playtest-T1-normal-seed-55.json");
    assert.deepEqual([firstExport.report.scenario, firstExport.report.seed, firstExport.report.wizardCpu], ["T1", 55, "normal"]);
    assert.equal(firstExport.report.humanNotes.freeform, NOTE);

    // Paired BASE at the current seed, by real mouse click: pending only.
    const t1Snap = await snapshot();
    await click("#prepare-base");
    await wait(`document.getElementById("trial-status").textContent.startsWith("Prepared paired BASE")`, 5000);
    assert.deepEqual(await form(), ["55", "BASE", "normal"]);
    assert.match(await text("trial-status"), /seed 55 \(from the seed field\).*export that report first, then press Clear notes.*neither happens for you\. Nothing started: the current match is unchanged\. Press Start\./);
    assert.match(await text("status"), /Seed 55\. .*Scenario T1 .*Settings changed: they apply on Start\./);
    await sleep(800);
    assert.deepEqual(await snapshot(), t1Snap, "BASE prepare leaves the T1 match");
    assert.equal(await evaluate(`document.getElementById("note-freeform").value`), NOTE, "notes not cleared");
    const pendingExport = await exportReport();
    assert.deepEqual([pendingExport.report.scenario, pendingExport.report.seed], ["T1", 55], "export follows the active match, not the pending form");

    await click(START);
    await wait(`document.getElementById("status").textContent.includes("Scenario BASE ")`);
    await wait(`document.getElementById("status").textContent.startsWith("Status: accepting_input.")`);
    assert.match(await text("status"), /Seed 55\. .*Wizard CPU: normal\./);
    assert.deepEqual(await hand(), createMatch(55).sides.cowboy.hand);
    assert.equal(await text("cowboy-trap"), "Trap zone: traps not enabled in this scenario");
    assert.equal(await text("wizard-trap"), "Enemy trap: traps not enabled in this scenario");
    const baseExport = await exportReport();
    assert.equal(baseExport.name, "trap-playtest-BASE-normal-seed-55.json");
    assert.deepEqual([baseExport.report.scenario, baseExport.report.seed, baseExport.report.wizardCpu], ["BASE", 55, "normal"]);
    assert.equal(baseExport.report.humanNotes.freeform, NOTE);

    // Invalid seed: BASE prepare refuses and changes nothing.
    await evaluate(`document.getElementById("seed").value = "12x"`);
    await click("#prepare-base");
    assert.equal(await text("trial-status"), "The seed field must hold a whole number from 0 to 4294967295. Nothing prepared.");
    assert.deepEqual(await form(), ["12x", "BASE", "normal"]);
    await evaluate(`document.getElementById("seed").value = "55"`);

    // Optional T2: keyboard typeahead "t", Prepare and Start by click.
    await evaluate(`document.activeElement?.blur()`);
    await tabTo("trial-pick");
    await key("t");
    await wait(`document.getElementById("trial-pick").value === "T2"`, 5000);
    await click("#prepare-trial");
    assert.deepEqual(await form(), [String(plan.t2.seed), "T2", "normal"]);
    await click(START);
    await wait(`document.getElementById("status").textContent.includes("Seed ${plan.t2.seed}.") && document.getElementById("status").textContent.includes("Scenario T2 ")`);
    assert.deepEqual(await hand(), openingFor(plan.t2.seed, "T2").sides.cowboy.hand);
    await wait(`/^Status: (accepting_input|terminal)\\./.test(document.getElementById("status").textContent)`);
    assert.deepEqual(await hiddenLeak(), []);
    const t2Export = await exportReport();
    assert.deepEqual([t2Export.report.scenario, t2Export.report.seed], ["T2", plan.t2.seed]);

    const exports = [firstExport, pendingExport, baseExport, t2Export];
    for (const { report } of exports) {
      const json = JSON.stringify(report);
      for (const id of WIZARD_TRAP_IDS) assert.equal(json.includes(id), false, `${id} in an export`);
    }
    const remote = requests.filter((u) => !u.startsWith(`${origin}/`) && !u.startsWith("blob:") && !u.startsWith("data:"));
    assert.deepEqual(remote, [], "no request outside the loopback server");
    assert.deepEqual(await evaluate(`[document.cookie, localStorage.length, sessionStorage.length]`), ["", 0, 0]);
    assert.deepEqual(errors, [], "no runtime exception or console error");
    t.diagnostic(`${(await cdp.send("Browser.getVersion")).product}; requests ${requests.length} (all loopback or blob:); exports ${exports.map((e) => e.name).join(", ")}; runtime errors ${errors.length}`);
  } finally {
    cdp.close();
    await chrome.close();
    server.close();
    await rm(downloads, { recursive: true, force: true });
  }
});
