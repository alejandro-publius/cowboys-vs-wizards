// Headless Chrome check of the Showdown's two players, one screen handoff (no extra dependency; DevTools protocol).
//
//   node prototypes/showdown/build.mjs && node prototypes/showdown/hotseat-browser-check.mjs [--seed 7] [--turns 4]
//
// Fresh isolated profile, file:// page, no network. From a fresh Camp it clicks "Two players, one screen" with a real
// mouse event, then for each turn: the curtain must be the only visible screen and name the side to move, the board
// and hands must be hidden; "I'm ready" (pressed from the keyboard) reveals a hand holding only that side's cards;
// "End turn" (keyboard) throws the curtain again for the other side. Keyboard focus must land on "I'm ready" while the
// curtain is up and must not be left on a hidden control after it. "Back to camp" must leave the saved Camp progress
// byte-for-byte as before. After each handoff the Keywords glossary must explain every keyword marked on a visible card
// and stay the same list on every turn: it is drawn from both whole decklists, so a draw or a play never changes it
// and it cannot hint at the other hand or either deck order. Reads only what is on screen, the DOM and localStorage. Exits 1 on any failure; 60 s cap.
// --shots DIR also saves viewport PNGs of the first curtain, the Cowboy hand behind it and the Wizard curtain, and
// writes DIR/hotseat-shots.json (SHA-256, size, screens on show). Capturing presses nothing and changes no check.
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const SEED = Number(option("--seed", 7));
const TURNS = Number(option("--turns", 4));
const SHOTS = option("--shots", null) && path.resolve(root, option("--shots", null));
const shots = [];
const startedAt = Date.now();
const SAVE = "cvw-showdown-save-v2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = setTimeout(() => { console.error("FAIL: timed out after 60 s"); process.exit(1); }, 60000);

const profile = await mkdtemp("/tmp/hotseat-chrome-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--disable-background-networking", "--mute-audio",
  "--window-size=1280,900", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let stderr = "";
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("no DevTools URL in 20 s")), 20000);
  child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
const waiting = new Map(); let nextId = 0; const pageErrors = [];
ws.addEventListener("message", ({data}) => {
  const m = JSON.parse(data);
  if (m.id === undefined) {
    if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Network.requestWillBeSent" && !/^(file|data|about|blob):/.test(m.params.request.url)) pageErrors.push(`network request: ${m.params.request.url}`);
    return;
  }
  const e = waiting.get(m.id); waiting.delete(m.id);
  if (m.error) e?.reject(new Error(m.error.message)); else e?.resolve(m.result);
});
const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId; waiting.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
});
const {targetInfos} = await raw("Target.getTargets");
const {sessionId} = await raw("Target.attachToTarget", {targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true});
const send = (method, params) => raw(method, params, sessionId);
for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);
await send("Emulation.setFocusEmulationEnabled", {enabled: true});
const evaluate = async (expression) => {
  const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true});
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

// Page-side reading of what a player can see.
const VIEW = `(() => {
  const shown = (n) => {
    if (!n) return false;
    for (let e = n; e && e !== document.documentElement; e = e.parentElement) {
      if (e.hidden) return false;
      const c = getComputedStyle(e);
      if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
    }
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const screens = ["camp", "builder", "duel", "curtain"].filter((id) => shown(document.getElementById(id)));
  const hand = [...document.querySelectorAll("#hand .card")].filter(shown).map((c) => (c.classList.contains("cowboy") ? "cowboy" : c.classList.contains("wizard") ? "wizard" : "?"));
  const a = document.activeElement;
  return {screens, curtainText: shown(document.getElementById("curtain-text")) ? document.getElementById("curtain-text").textContent : null,
    status: shown(document.getElementById("status")) ? document.getElementById("status").textContent : null,
    boardShown: shown(document.getElementById("board")), hand, handText: document.getElementById("hand").textContent.replace(/\\s+/g, " ").trim(),
    glossary: [...document.querySelectorAll("#keywords li strong")].filter(shown).map((n) => n.textContent.replace(/\\.$/, "")),
    marked: [...document.querySelectorAll("#board .key, #hand .key")].filter(shown).map((n) => n.textContent),
    named: [...document.querySelectorAll("#board strong, #hand strong")].filter(shown).map((n) => n.textContent)
      .concat([...document.querySelectorAll("#board .note, #cowboy-graveyard, #wizard-graveyard, #location")].filter(shown)
        .flatMap((n) => n.textContent.replace(/^[^:]*: */, "").replace(/ \\(.*$/, "").split(/, /))),
    focus: a && a !== document.body ? (a.id || a.textContent.trim().slice(0, 40)) : "body", focusShown: a === document.body || shown(a)};
})()`;
const view = () => evaluate(VIEW);
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); console.log(`${ok ? "ok  " : "FAIL"} ${message}`); };

async function click(selector) {
  const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  if (!box) throw new Error(`nothing to click: ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: "center"})`);
  const at = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, x: at.x, y: at.y, button: "left", clickCount: 1});
  await sleep(150);
}
async function key(name, code, keyCode, text) {
  await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code, windowsVirtualKeyCode: keyCode, ...(text ? {text} : {})});
  await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code, windowsVirtualKeyCode: keyCode});
  await sleep(120);
}
// Tabs (at most 80 presses) until the focused control is the one wanted, then presses Enter on it.
async function tabTo(id) {
  for (let i = 0; i < 80; i += 1) {
    if (await evaluate(`document.activeElement?.id`) === id) { await key("Enter", "Enter", 13, "\r"); return i; }
    await key("Tab", "Tab", 9);
  }
  throw new Error(`Tab never reached #${id}`);
}

async function shot(name, turn) {
  if (!SHOTS) return;
  await evaluate("window.scrollTo(0, 0)");
  const v = await view();
  const {data} = await send("Page.captureScreenshot", {format: "png"});
  const png = Buffer.from(data, "base64");
  const file = `${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
  await mkdir(SHOTS, {recursive: true});
  await writeFile(path.join(SHOTS, file), png);
  shots.push({file, name, turn, fixture: "none: fresh profile, no save", screens: v.screens, curtainText: v.curtainText, status: v.status,
    handSides: [...new Set(v.hand)], width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length,
    sha256: createHash("sha256").update(png).digest("hex"), atSeconds: Math.round((Date.now() - startedAt) / 100) / 10});
}

let code = 0;
try {
  const page = pathToFileURL(path.join(root, "dist/showdown.html")).href;
  await send("Page.navigate", {url: `${page}?seed=${SEED}`});
  await sleep(800);
  check(await evaluate(`localStorage.getItem(${JSON.stringify(SAVE)})`) === null, "fresh profile: no saved Camp progress before play");
  const camp = await view();
  check(camp.screens.join() === "camp", `fresh Camp is the only screen (${camp.screens.join()})`);
  const before = await evaluate(`[localStorage.getItem(${JSON.stringify(SAVE)}), document.getElementById("code").value, document.getElementById("collection").textContent]`);

  await click('button[data-two="1"]');
  let expected = null;
  for (let turn = 1; turn <= TURNS; turn += 1) {
    const c = await view();
    const side = /Cowboy/.test(c.curtainText ?? "") ? "cowboy" : /Wizard/.test(c.curtainText ?? "") ? "wizard" : null;
    const label = turn === 1 ? "at the start" : `after End turn ${turn - 1}`;
    check(c.screens.join() === "curtain", `${label}: curtain is the only visible screen (${c.screens.join()})`);
    check(!c.boardShown && c.hand.length === 0, `${label}: board and hand are hidden behind the curtain`);
    check(side !== null && (expected === null || side === expected), `${label}: curtain names the ${side} player${expected ? ` (expected ${expected})` : ""}`);
    check(c.focus === "ready", `${label}: keyboard focus is on "I'm ready" (${c.focus})`);
    if (turn <= 2) await shot(`hotseat-curtain-${side}`, turn);
    const presses = await tabTo("ready");
    const d = await view();
    check(d.screens.join() === "duel", `turn ${turn}: "I'm ready" by keyboard reveals the duel (${d.screens.join()}, ${presses} Tab presses)`);
    check(d.hand.length > 0 && d.hand.every((s) => s === side), `turn ${turn}: hand shows only ${side} cards (${d.hand.join(",")})`);
    check(new RegExp(`the ${side === "cowboy" ? "Cowboy" : "Wizard"}s' turn`).test(d.status ?? ""), `turn ${turn}: status names the ${side}s (${d.status})`);
    check(d.focusShown && d.focus === "end", `turn ${turn}: focus left the curtain for the visible End turn button (${d.focus})`);
    const missing = [...new Set(d.marked)].filter((w) => !d.glossary.includes(w));
    check(missing.length === 0, `turn ${turn}: Keywords explains every keyword on a visible card (${d.glossary.join(", ") || "none"}${missing.length ? `; missing ${missing.join(", ")}` : ""})`);
    if (turn === 1) var firstGlossary = d.glossary.join(", ");
    else check(d.glossary.join(", ") === firstGlossary, `turn ${turn}: Keywords is the same list as on turn 1, so it shows nothing hidden (${d.glossary.join(", ")}${d.glossary.join(", ") === firstGlossary ? "" : `; turn 1 had ${firstGlossary}`})`);
    if (turn === 1) await shot(`hotseat-${side}-hand`, turn);
    if (turn > 1) check(d.handText !== previousHand, `turn ${turn}: hand content changed with the handoff`);
    var previousHand = d.handText;
    await tabTo("end");
    expected = side === "cowboy" ? "wizard" : "cowboy";
  }
  await tabTo("ready");
  await click("#leave");
  const back = await view();
  check(back.screens.join() === "camp", `"Back to camp" returns to Camp (${back.screens.join()})`);
  const after = await evaluate(`[localStorage.getItem(${JSON.stringify(SAVE)}), document.getElementById("code").value, document.getElementById("collection").textContent]`);
  check(JSON.stringify(after) === JSON.stringify(before), "Camp progress (saved v2 entry, save code, collection) is unchanged by the two-player game");
  check(pageErrors.length === 0, `no page errors or network requests (${pageErrors.join(" | ") || "none"})`);
} catch (error) {
  failures.push(error.message); console.log(`FAIL ${error.message}`);
} finally {
  code = failures.length ? 1 : 0;
  if (SHOTS) await writeFile(path.join(SHOTS, "hotseat-shots.json"), JSON.stringify({tool: "prototypes/showdown/hotseat-browser-check.mjs", seed: SEED, turns: TURNS,
    pass: code === 0, failures, seconds: Math.round((Date.now() - startedAt) / 100) / 10, capSeconds: 60, files: shots}, null, 2) + "\n");
  console.log(code ? `${failures.length} check(s) failed (seed ${SEED})` : `hotseat handoff passed (seed ${SEED}, ${TURNS} turns)`);
  ws.close(); child.kill("SIGTERM"); await sleep(300); child.kill("SIGKILL");
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
  clearTimeout(deadline);
  process.exit(code);
}
