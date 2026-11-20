// Headless Chrome check of the Showdown's Camp → Boot Hill → Camp path by keyboard (1280 px) and by touch (390 px).
//
//   node prototypes/showdown/build.mjs && node prototypes/showdown/access-browser-check.mjs [--seed 7] [--shots DIR]
//
// Same approach as hotseat-browser-check.mjs: fresh isolated profile, file:// page, DevTools protocol, no dependency.
// Desktop: Tab reaches Boot Hill and Enter opens it; focus must then sit on a visible control in the duel, stay on a
// visible control after a card is played and after End turn, show a focus outline, and land on a visible Camp control
// after "Back to camp". Then the deck builder: focus enters it, stays on a +/− pressed repeatedly, moves to the pile's
// other button at a bound, and returns to "Build deck" after Cancel and Save. Reward (fresh profile, --reward-seed): wins
// Boot Hill by Enter presses on the page's own buttons (moves from campaign-driver.mjs), then choosing the offered card
// by Tab and Enter, once in the duel and once in Camp after a reload, must keep focus on a visible control and put the
// sentence "You took <card>." in a live region. This is desktop Chrome evidence only, not a VoiceOver run. Phone (390 × 844, touch): taps the same path; no page-wide sideways scroll and no visible
// control cut off at either edge on Camp or the duel. Both: saved Camp progress is unchanged by leaving mid-duel.
// Prints the measurements it judged by. Exits 1 on any failure; 180 s cap.
// --page FILE checks another build of the page instead of dist/showdown.html.
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {mirrorDuel, pickMove} from "./campaign-driver.mjs";
import {TYPES} from "./cards.js";
import {newSave} from "./progress.js";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const SEED = Number(option("--seed", 7));
const SHOTS = option("--shots", null);
const REWARD_SEED = Number(option("--reward-seed", 0));
const SAVE = "cvw-showdown-save-v2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = setTimeout(() => { console.error("FAIL: timed out after 180 s"); process.exit(1); }, 180000);

const profile = await mkdtemp("/tmp/showdown-access-");
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

// Page-side measurements: which screen shows, where focus is, sideways overflow, and controls cut off at an edge.
const VIEW = `(() => {
  const shown = (n) => {
    if (!n) return false;
    for (let e = n; e && e !== document.documentElement; e = e.parentElement) {
      if (e.hidden) return false;
      const c = getComputedStyle(e);
      if (c.display === "none" || c.visibility === "hidden") return false;
    }
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const screens = ["camp", "builder", "duel", "curtain"].filter((id) => shown(document.getElementById(id)));
  const a = document.activeElement;
  const where = a && a !== document.body ? (a.closest("#camp, #builder, #duel, #curtain")?.id ?? "page") : "body";
  const label = !a || a === document.body ? "body" : a.id ? "#" + a.id : Object.entries(a.dataset).map(([k, v]) => k + "=" + v).join(",") || a.textContent.trim().slice(0, 30);
  const style = a && a !== document.body ? getComputedStyle(a) : null;
  const ring = style ? (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) : false;
  const width = innerWidth;
  const controls = [...document.querySelectorAll("button, summary, textarea")].filter(shown);
  const clipped = controls.filter((c) => { const r = c.getBoundingClientRect(); return r.left < -0.5 || r.right > width + 0.5; })
    .map((c) => (c.id ? "#" + c.id : (c.dataset.card || c.dataset.duel || c.className || c.tagName).toString().slice(0, 24)) + "@" + Math.round(c.getBoundingClientRect().right));
  const enabled = controls.filter((c) => !c.disabled);
  const smallest = enabled.reduce((m, c) => { const r = c.getBoundingClientRect(); return Math.min(m, Math.round(Math.min(r.width, r.height))); }, Infinity);
  return {screens, focus: label, focusIn: where, focusShown: a === document.body ? false : shown(a), ring,
    overflow: document.documentElement.scrollWidth - width, clipped, controls: controls.length, smallest};
})()`;
const view = () => evaluate(VIEW);
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); console.log(`${ok ? "ok  " : "FAIL"} ${message}`); };
const saved = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE)})`);
async function shot(name) {
  if (!SHOTS) return;
  const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: false});
  await mkdir(SHOTS, {recursive: true});
  await writeFile(path.join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}

async function key(name, code, keyCode, text, modifiers = 0) {
  await send("Input.dispatchKeyEvent", {type: "keyDown", key: name, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? {text} : {})});
  await send("Input.dispatchKeyEvent", {type: "keyUp", key: name, code, windowsVirtualKeyCode: keyCode, modifiers});
  await sleep(120);
}
const enter = () => key("Enter", "Enter", 13, "\r");
// Tabs (at most 120 presses) until the focused element matches, and returns the number of presses.
async function tabUntil(selector) {
  for (let i = 0; i < 120; i += 1) {
    if (await evaluate(`Boolean(document.activeElement?.matches(${JSON.stringify(selector)}))`)) return i;
    await key("Tab", "Tab", 9);
  }
  throw new Error(`Tab never reached ${selector}`);
}
async function tap(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: "center"})`);
  await sleep(100);
  const at = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  await send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: at.x, y: at.y}]});
  await send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await sleep(250);
}
const page = pathToFileURL(path.resolve(option("--page", path.join(root, "dist/showdown.html")))).href;
async function fresh(seed = SEED) {
  await send("Page.navigate", {url: `${page}?seed=${seed}`});
  await sleep(600);
  await evaluate(`localStorage.clear()`);
  await send("Page.reload", {ignoreCache: true});
  await sleep(800);
}
const fmt = (v) => `focus ${v.focus} in ${v.focusIn}${v.focusShown ? "" : " (not visible)"}, ring ${v.ring ? "yes" : "no"}`;

let code = 0;
try {
  // ---- Desktop keyboard, 1280 × 900 -----------------------------------------------------------
  await send("Emulation.setDeviceMetricsOverride", {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await fresh();
  const before = await saved();
  let v = await view();
  console.log(`desktop camp: screens ${v.screens.join()}, ${fmt(v)}`);
  const presses = await tabUntil('button[data-duel="trail"]');
  v = await view();
  check(v.ring, `desktop: Boot Hill tile reached in ${presses} Tab presses and shows a focus outline`);
  await enter();
  v = await view();
  check(v.screens.join() === "duel" && v.focusShown && v.focusIn === "duel", `desktop: Enter opens Boot Hill with focus on a visible duel control (${fmt(v)})`);
  check(await evaluate(`/Boot Hill/.test(document.getElementById("status").textContent)`), "desktop: status names Boot Hill");
  // Play the first playable card from the keyboard; finish any pick it opens with the first offered target.
  await tabUntil("#hand button.can");
  const card = await evaluate(`document.activeElement.dataset.card`);
  await enter();
  v = await view();
  check(v.focusShown && v.focusIn === "duel", `desktop: after Enter on ${card}, ${fmt(v)}`);
  for (let i = 0; i < 3 && await evaluate(`!document.getElementById("cancel").hidden`); i += 1) {
    await tabUntil("#board button.can");
    await enter();
  }
  v = await view();
  check(v.focusShown && v.focusIn === "duel", `desktop: after the card resolved, ${fmt(v)}`);
  await tabUntil("#end");
  await enter();
  v = await view();
  check(v.focusShown && v.focusIn === "duel" && v.ring, `desktop: after End turn and the Wizards' reply, ${fmt(v)}`);
  check(await evaluate(`document.querySelectorAll("#hand .card.wizard").length === 0`), "desktop: solo hand holds no Wizard cards");
  // A card that opens a pick (a tribute troop, a targeted spell or gear) must send focus to the first thing to choose.
  const picker = await evaluate(`[...document.querySelectorAll("#hand button.can")].find((b) => /tribute/.test(b.textContent))?.dataset.card ?? null`);
  if (picker) {
    await tabUntil(`#hand button[data-card="${picker}"]`);
    await enter();
    v = await view();
    const onTarget = await evaluate(`Boolean(document.activeElement?.matches("#board button.can"))`);
    check(onTarget && v.ring, `desktop: Enter on ${picker} moves focus to the first board choice (${fmt(v)})`);
    await tabUntil("#cancel");
    await enter();
    v = await view();
    check(v.focusShown && v.focusIn === "duel", `desktop: Cancel keeps focus on a visible duel control (${fmt(v)})`);
  } else console.log("note desktop: no tribute card in hand on this seed; pick-focus step not exercised");
  const backPresses = await tabUntil("#leave");
  await enter();
  v = await view();
  check(v.screens.join() === "camp" && v.focusShown && v.focusIn === "camp", `desktop: "Back to camp" (${backPresses} Tab presses) returns to Camp with ${fmt(v)}`);
  check(await saved() === before, "desktop: saved Camp progress unchanged by leaving mid-duel");

  // Deck builder by keyboard: each +/− redraws the rows, so focus must come back to the same button (or, at a bound,
  // its pile's other button); Cancel and Save must return focus to "Build deck".
  const step = (zone, type, by) => `#builder-rows [data-zone="${zone}"][data-type="${type}"][data-by="${by}"]`;
  const on = (selector) => evaluate(`Boolean(document.activeElement?.matches(${JSON.stringify(selector)}))`);
  await tabUntil("#build");
  await enter();
  v = await view();
  check(v.screens.join() === "builder" && v.focusIn === "builder" && v.focusShown && v.ring, `desktop: Enter on "Build deck" opens the builder with ${fmt(v)}`);
  await tabUntil(step("deck", "cowboy-deadeye", -1));
  await enter();
  await enter();
  check(await on(step("deck", "cowboy-deadeye", -1)) && /^Deck 14 of 16/.test(await evaluate(`document.getElementById("builder-problems").textContent`)),
    `desktop: Enter twice on "One fewer Deadeye" keeps focus on it (${fmt(await view())})`);
  await tabUntil(step("deck", "cowboy-deadeye", 1));
  await enter();
  await enter();
  v = await view();
  check(await on(step("deck", "cowboy-deadeye", -1)) && v.ring, `desktop: at the Deadeye limit focus moves to its "One fewer" button (${fmt(v)})`);
  await tabUntil("#builder-cancel");
  await enter();
  v = await view();
  check(v.screens.join() === "camp" && await on("#build") && v.ring && await saved() === before, `desktop: Cancel returns to Camp on "Build deck", save unchanged (${fmt(v)})`);
  await enter();
  await tabUntil(step("side", "cowboy-sheriff", 1));
  await enter();
  check(await on(step("side", "cowboy-sheriff", 1)), `desktop: Enter on "One more Sheriff in the side deck" keeps focus on it (${fmt(await view())})`);
  await tabUntil("#builder-save");
  await enter();
  v = await view();
  check(v.screens.join() === "camp" && await on("#build") && JSON.parse(await saved() ?? "{}").side?.["cowboy-sheriff"] === 1,
    `desktop: Save deck returns to Camp on "Build deck" with the side deck saved (${fmt(v)})`);

  // ---- Reward by keyboard, 1280 × 900 --------------------------------------------------------
  // Boot Hill is won with Enter on the page's own buttons; the moves come from the Node mirror of the same deal.
  await fresh(REWARD_SEED);
  const press = async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`); await enter(); };
  await tabUntil('button[data-duel="trail"]');
  await enter();
  const mirror = mirrorDuel(newSave(), "trail", REWARD_SEED);
  for (let steps = 0; !mirror.state.result; steps += 1) {
    if (steps > 200) throw new Error("Boot Hill: no result after 200 actions");
    const action = pickMove(mirror.state);
    if (action.type === "end") await press("#end");
    else if (action.type === "attack") { await press(`#board button[data-own="${action.slot}"]`); await press(`#board button[data-enemy="${action.target}"]`); }
    else if (action.type === "cover") { await press(`#board button[data-own="${action.slot}"]`); await press("#cover"); }
    else {
      await press(`#hand button[data-card="${action.cardId}"]`);
      if (action.type === "summon") for (const slot of action.tributes) await press(`#board button[data-own="${slot}"]`);
      if (action.type === "gear") await press(`#board button[data-own="${action.slot}"]`);
      if (action.type === "spell" && action.target !== undefined) await press(`#board button[data-enemy="${action.target}"]`);
    }
    mirror.act(action);
  }
  const live = () => evaluate(`[...document.querySelectorAll("[aria-live], [role=status]")].filter((n) => n.closest("[hidden]") === null)
    .map((n) => "#" + n.id + ": " + n.textContent.replace(/\\s+/g, " ").trim()).filter((t) => !/: $/.test(t))`);
  v = await view();
  const offer = await evaluate(`[...document.querySelectorAll("#reward button[data-choose]")].map((b) => b.dataset.choose)`);
  check(mirror.state.result.winner === "cowboy" && /You win/.test(await evaluate(`document.getElementById("status").textContent`)) && offer.length === 2,
    `reward: Boot Hill won by keyboard (seed ${REWARD_SEED}); offer ${offer.map((t) => TYPES[t]?.name).join(" or ")}; ${fmt(v)}`);
  check(v.focusShown && v.focusIn === "duel", `reward: after the winning move focus stays on a visible duel control (${fmt(v)})`);
  const won = await saved();
  console.log(`reward: live regions after the win: ${(await live()).join(" | ")}`);
  const choiceIn = async (where, type) => {
    const tabs = await tabUntil(`#${where} button[data-choose="${type}"]`);
    // Counts what the choice rewrites inside each live region: re-written words can be read out again.
    await evaluate(`window.__a005 = []; window.__a005o = new MutationObserver((list) => { for (const m of list) {
      const region = (m.target.nodeType === 1 ? m.target : m.target.parentElement).closest("[aria-live], [role=status]");
      if (region) window.__a005.push("#" + region.id + (region.id === "reward" ? "/" + [...region.children].indexOf(m.target.closest("#reward > *")) : "")); } });
      for (const n of document.querySelectorAll("[aria-live], [role=status]")) window.__a005o.observe(n, {childList: true, subtree: true, characterData: true})`);
    await enter();
    const rewritten = [...new Set(await evaluate(`(window.__a005o.disconnect(), window.__a005)`))];
    if (where === "reward") check(!rewritten.includes("#status") && !rewritten.includes("#reward/-1") && rewritten.filter((r) => r.startsWith("#reward")).length === 1,
      `reward in duel: choosing rewrites one reward part and leaves the status alone (changed: ${rewritten.join(" ") || "nothing"})`);
    const after = await view();
    const said = await live();
    const took = JSON.parse(await saved() ?? "{}");
    check(took.offer === null && took.collection?.[type] >= 1, `reward in ${where === "reward" ? "the duel" : "Camp"}: ${tabs} Tab presses reach ${TYPES[type].name}; Enter takes it into the saved collection`);
    check(after.focusShown && after.ring && after.focusIn !== "body", `reward in ${where === "reward" ? "the duel" : "Camp"}: after choosing, ${fmt(after)}`);
    check(said.some((t) => t.includes(`You took ${TYPES[type].name}.`)), `reward in ${where === "reward" ? "the duel" : "Camp"}: a live region says which card was taken (${said.join(" | ") || "none"})`);
    return after;
  };
  await choiceIn("reward", offer[0]);
  const contPresses = await tabUntil("#again");
  const cont = await evaluate(`document.activeElement.textContent.trim()`);
  await enter();
  v = await view();
  check(v.screens.join() === "camp" && v.focusShown && v.focusIn === "camp" && v.ring, `reward: "${cont}" (${contPresses} Tab presses) returns to Camp with ${fmt(v)}`);
  // The same win, choice still open, after a reload: the offer now waits at the top of Camp.
  await evaluate(`localStorage.setItem(${JSON.stringify(SAVE)}, ${JSON.stringify(won)})`);
  await send("Page.reload", {ignoreCache: true});
  await sleep(800);
  check(await evaluate(`document.querySelectorAll("#claim button[data-choose]").length === 2`), "reward: after a reload Camp offers the same two cards");
  await choiceIn("claim", offer[1]);

  // ---- Phone touch, 390 × 844 -----------------------------------------------------------------
  await send("Emulation.setDeviceMetricsOverride", {width: 390, height: 844, deviceScaleFactor: 3, mobile: true});
  await send("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
  await fresh();
  const phoneBefore = await saved();
  v = await view();
  check(v.overflow <= 0 && v.clipped.length === 0, `phone camp: sideways overflow ${v.overflow}px, cut-off controls [${v.clipped.join(" ")}] of ${v.controls}, smallest ${v.smallest}px`);
  await shot("phone-camp");
  await tap('button[data-duel="trail"]');
  v = await view();
  check(v.screens.join() === "duel", `phone: tap on Boot Hill opens the duel (${v.screens.join()})`);
  await evaluate(`window.scrollTo(0, 0)`);
  await shot("phone-duel-top");
  check(v.overflow <= 0 && v.clipped.length === 0, `phone duel: sideways overflow ${v.overflow}px, cut-off controls [${v.clipped.join(" ")}] of ${v.controls}, smallest ${v.smallest}px`);
  await tap("#hand button.can");
  for (let i = 0; i < 3 && await evaluate(`!document.getElementById("cancel").hidden`); i += 1) await tap("#board button.can");
  v = await view();
  check(v.overflow <= 0 && v.clipped.length === 0, `phone duel after a played card: overflow ${v.overflow}px, cut-off [${v.clipped.join(" ")}]`);
  await evaluate(`document.getElementById("actions").scrollIntoView({block: "center"})`);
  await shot("phone-duel-actions");
  await tap("#end");
  v = await view();
  check(v.screens.join() === "duel" && v.overflow <= 0 && v.clipped.length === 0, `phone duel after End turn: overflow ${v.overflow}px, cut-off [${v.clipped.join(" ")}]`);
  await tap("#leave");
  v = await view();
  check(v.screens.join() === "camp" && v.overflow <= 0, `phone: "Back to camp" returns to Camp (${v.screens.join()}, overflow ${v.overflow}px)`);
  check(await saved() === phoneBefore, "phone: saved Camp progress unchanged by leaving mid-duel");
  check(pageErrors.length === 0, `no page errors or network requests (${pageErrors.join(" | ") || "none"})`);
} catch (error) {
  failures.push(error.message); console.log(`FAIL ${error.message}`);
} finally {
  code = failures.length ? 1 : 0;
  console.log(code ? `${failures.length} check(s) failed (seed ${SEED})` : `keyboard and phone path passed (seed ${SEED})`);
  ws.close(); child.kill("SIGTERM"); await sleep(300); child.kill("SIGKILL");
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
  clearTimeout(deadline);
  process.exit(code);
}
