// Issue #110: keyboard and focus check of the local-only trap placeholder lab
// (experiments/trap-placeholder) in the installed Google Chrome. Keys are sent
// through CDP Input.dispatchKeyEvent (Tab, Shift+Tab, Enter, Space); one mouse
// click goes through Input.dispatchMouseEvent. No element.click(), no focus()
// call and no controller call from the test. The page is served from the repo
// root on a 127.0.0.1 HTTP server started here. Skips when Chrome is missing.
// Not part of npm test. Run: node --test tests/experiments/trap-placeholder-keyboard.test.js
// Set TRAP_KEYBOARD_REPORT=<file> to write the focus history as JSON.
// This is automation only: it says nothing about screen readers, visual
// quality or human accessibility.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_TRAPS } from "../../experiments/trap-placeholder/lab.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GET-only static server for the repo root, loopback only.
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
  const profile = await mkdtemp(path.join(tmpdir(), "kiro-trap-keyboard-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
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

const KEYS = { Tab: 9, Enter: 13, " ": 32 };
const CODES = { Tab: "Tab", Enter: "Enter", " ": "Space" };

// One page session with keyboard, mouse and focus helpers.
async function openLab(cdp, url, history, errors) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({ method, params, sessionId: id }) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const lab = {
    send,
    evaluate,
    status: () => evaluate(`document.getElementById("status").textContent`),
    active: () => evaluate(`(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return { tag: "BODY" };
      return { tag: a.tagName, id: a.id || undefined, key: a.dataset.key, text: (a.textContent || a.value || "").trim().slice(0, 60),
        disabled: Boolean(a.disabled), connected: a.isConnected, hidden: a.getClientRects().length === 0, pressed: a.getAttribute("aria-pressed") ?? undefined };
    })()`),
    async wait(expression, ms = 30000) {
      const stop = Date.now() + ms;
      while (Date.now() < stop) {
        if (await evaluate(expression)) return;
        await sleep(40);
      }
      throw new Error(`timed out: ${expression}`);
    },
    waitStatus: (word) => lab.wait(`document.getElementById("status").textContent.startsWith("Status: ${word}.")`),
    async key(name, shift = false) {
      const base = { key: name, code: CODES[name], windowsVirtualKeyCode: KEYS[name], nativeVirtualKeyCode: KEYS[name], modifiers: shift ? 8 : 0 };
      const text = name === "Enter" ? "\r" : name === " " ? " " : undefined;
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(text ? { text } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    },
    async step(action) {
      const entry = { action, status: (await lab.status()).split(".")[0], active: await lab.active() };
      history.push(entry);
      return entry;
    },
    // Tabs (x0 if already there) until the active element matches; records the stops.
    async tabTo(selector, shift = false, max = 60) {
      const stops = [];
      for (let i = 0; i <= max; i++) {
        if (await evaluate(`document.activeElement?.matches(${JSON.stringify(selector)}) ?? false`)) {
          const entry = await lab.step(`${shift ? "Shift+Tab" : "Tab"} x${i} to ${selector}`);
          entry.stops = stops;
          return entry;
        }
        await lab.key("Tab", shift);
        const at = await lab.active();
        stops.push(at.id ?? at.key ?? at.tag);
      }
      throw new Error(`never reached ${selector}: ${stops.join(" > ")}`);
    },
    async press(name, label) {
      await lab.key(name);
      return lab.step(`${name === " " ? "Space" : name} on ${label}`);
    },
    async mouseClick(selector) {
      const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: type === "mouseMoved" ? "none" : "left", clickCount: type === "mouseMoved" ? 0 : 1 });
      }
      return lab.step(`mouse click on ${selector}`);
    },
    // The Wizard fixture ID must not be in the DOM (text or attributes) while its trap is still unsprung.
    wizardIdShown: () => evaluate(`document.documentElement.outerHTML.includes(${JSON.stringify(FIXTURE_TRAPS.wizard)})`),
  };
  await send("Page.navigate", { url });
  await lab.wait(`document.getElementById("status")?.textContent.startsWith("Status: ") ?? false`);
  return lab;
}

const TRAP = `#hand button[data-key^="${FIXTURE_TRAPS.cowboy}-"]`;
const usable = (active) => active.tag !== "BODY" && !active.disabled && active.connected && !active.hidden;

async function runSeed(lab, seed, checks) {
  const check = (name, passed, detail) => {
    checks.push({ seed, name, passed: Boolean(passed), detail });
    assert.ok(passed, `seed ${seed}: ${name} ${detail === undefined ? "" : JSON.stringify(detail)}`);
  };

  // Seed field by keyboard: Tab from the page start lands on it with its text
  // selected; typed text replaces it and Enter submits the form (Start).
  await lab.evaluate(`document.activeElement?.blur()`);
  await lab.tabTo("#seed");
  await lab.send("Input.insertText", { text: String(seed) });
  await lab.press("Enter", "seed field");
  await lab.wait(`document.getElementById("status").textContent.includes("Seed ${seed}.")`);
  await lab.waitStatus("accepting_input");
  check("Wizard fixture ID absent from the page at start", !(await lab.wizardIdShown()));

  // Trap: select, Cancel, reselect, Confirm.
  const trapAt = await lab.tabTo(TRAP);
  check("Tab reaches the fixture trap hand button", trapAt.active.key?.startsWith(FIXTURE_TRAPS.cowboy), trapAt.stops);
  const selected = await lab.press("Enter", "trap hand button");
  check("Enter selects the trap and the redraw keeps focus on it", selected.active.key === trapAt.active.key && selected.active.pressed === "true", selected.active);
  await lab.tabTo("#cancel");
  const cancelled = await lab.press(" ", "Cancel");
  check("Space on Cancel clears the selection", await lab.evaluate(`document.querySelector(${JSON.stringify(TRAP)}).getAttribute("aria-pressed") === "false"`), cancelled.active);
  await lab.tabTo(TRAP, true);
  await lab.press("Enter", "trap hand button");
  await lab.tabTo("#confirm");
  await lab.press("Enter", "Confirm");
  check("Confirm applies set-trap", await lab.evaluate(`document.getElementById("cowboy-trap").textContent.startsWith("Placeholder trap")`));
  const during = await lab.step("during playback after keyed Confirm");
  await lab.waitStatus("accepting_input");
  const afterConfirm = await lab.step("next accepting_input after keyed Confirm");
  check("focus returns to an enabled control after keyed Confirm", usable(afterConfirm.active), { during: during.active, after: afterConfirm.active });
  check("Confirm is disabled now, so focus goes to a playable hand item or End phase",
    afterConfirm.active.key !== undefined ? afterConfirm.active.key.length > 0 : afterConfirm.active.id === "end-phase", afterConfirm.active);

  // End phase by keyboard; the CPU plays; focus comes back to End phase.
  await lab.tabTo("#end-phase");
  await lab.press("Enter", "End phase");
  const busy = await lab.step("during CPU turn after keyed End phase");
  await lab.waitStatus("accepting_input");
  const afterEnd = await lab.step("next accepting_input after keyed End phase");
  check("focus returns to End phase after keyed End phase", afterEnd.active.id === "end-phase" && usable(afterEnd.active), { during: busy.active, after: afterEnd.active });

  // Mouse-initiated End phase: the lab places no focus on the next accepting_input.
  await lab.mouseClick("#end-phase");
  await lab.waitStatus("accepting_input");
  const mouse = await lab.step("next accepting_input after mouse End phase");
  check("no focus restore after a mouse-initiated action", mouse.active.tag === "BODY" || mouse.active.disabled, mouse.active);

  // Redaction: before the Wizard trap springs, its fixture ID is in no DOM text or attribute.
  const sprung = await lab.evaluate(`[...document.querySelectorAll("#log li")].some((li) => li.textContent.startsWith("Wizard trap springs"))`);
  if (!sprung) check("Wizard fixture ID absent before it springs", !(await lab.wizardIdShown()));
  check("enemy trap zone shows only the face-down marker or none",
    /^Enemy trap: (set \(face-down\)|none)$/.test(await lab.evaluate(`document.getElementById("wizard-trap").textContent`)));

  // Restart by keyboard: round 1, fresh log, focus on Restart.
  const logBefore = await lab.evaluate(`document.querySelectorAll("#log li").length`);
  await lab.tabTo("#restart", true);
  const restarted = await lab.press("Enter", "Restart");
  await lab.wait(`/Round 1 of/.test(document.getElementById("status").textContent)`);
  const logAfter = await lab.evaluate(`document.querySelectorAll("#log li").length`);
  check("Restart starts the same seed at round 1 with a shorter log", logAfter < logBefore && (await lab.status()).includes(`Seed ${seed}.`), { logBefore, logAfter });
  check("focus stays on Restart", restarted.active.id === "restart", restarted.active);

  // A deliberate move during playback is kept: keyed End phase, then Tab while busy.
  await lab.waitStatus("accepting_input");
  await lab.tabTo("#end-phase");
  await lab.press("Enter", "End phase");
  await lab.key("Tab");
  const moved = await lab.step("Tab while busy");
  await lab.waitStatus("accepting_input");
  const keep = await lab.step("next accepting_input after a deliberate Tab");
  check("a control the user moved to while busy keeps focus", moved.active.tag !== "BODY" && keep.active.id === moved.active.id && keep.active.key === moved.active.key, { moved: moved.active, after: keep.active });

  // Leave by keyboard: idle, and nothing happens after it (no stale CPU or playback callback).
  await lab.tabTo("#leave");
  const left = await lab.press("Enter", "Leave");
  await lab.waitStatus("idle");
  const snapshot = `JSON.stringify([document.getElementById("status").textContent, document.querySelectorAll("#log li").length, document.getElementById("wizard-info").textContent])`;
  const frozen = await lab.evaluate(snapshot);
  await sleep(2000);
  check("no change in 2 s after Leave", (await lab.evaluate(snapshot)) === frozen, frozen);
  check("focus stays on Leave", left.active.id === "leave", left.active);
}

test("keyboard-only trap select, cancel, confirm, end phase, restart and leave keep focus on usable controls (seeds 0 and 60)", { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}` }, async () => {
  const server = await serve();
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const report = { chrome: (await cdp.send("Browser.getVersion")).product, history: [], checks: [], errors: [] };
  try {
    const url = `http://127.0.0.1:${server.address().port}/experiments/trap-placeholder/index.html`;
    const lab = await openLab(cdp, url, report.history, report.errors);
    for (const seed of [0, 60]) await runSeed(lab, seed, report.checks);
    assert.deepEqual(report.errors, [], "no runtime exception or console error");
  } finally {
    if (process.env.TRAP_KEYBOARD_REPORT) await writeFile(process.env.TRAP_KEYBOARD_REPORT, JSON.stringify(report, null, 2));
    cdp.close();
    await chrome.close();
    server.close();
  }
});
