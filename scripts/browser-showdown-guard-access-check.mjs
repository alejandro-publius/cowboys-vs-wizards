// Guard target accessibility on a real Bone Wall turn in the graybox (X-043 / X-047 audit).
//   npm run build
//   npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-guard-access-check.mjs \
//     dist/cowboys-vs-wizards-board-duel.html [--browser chrome|webkit] [--seed N] [--out DIR]
//
// Normal entry only: the built page over loopback HTTP, fresh profile, Play opens the Camp. A click
// bot (scripted, not a human) wins Boot Hill and Raven Roost, takes the first offered card each time,
// opens The Bone Fence from its Camp tile and plays until a Cowboy turn has a ready troop while a
// Bone Wall (Guard) stands on the Wizard side. From there every input is a keyboard press:
//   1. Tab to the ready troop, Enter. Focus must land on a Guard troop; every Tab stop among the enemy
//      buttons must be a Guard troop; the focused target's accessible description must give the
//      reason (the screen's own prompt, "A Guard stands in the way: attack it first.").
//   2. The enemy troops and Base that cannot be chosen are disabled, and their description gives the
//      same reason.
//   3. Enter on the Guard, again on later turns if needed, until no Guard is left. The polite live
//      region must announce the result. On the next pick, focus lands on a non-Guard target and the
//      description no longer names a Guard.
// chrome: Google Chrome headless; names and descriptions come from Chrome's own accessibility tree
//   (CDP Accessibility.getPartialAXTree).
// webkit: Playwright's WebKit build (the engine behind Safari, not Safari itself). Keyboard focus is
//   WebKit's own; names and descriptions are read from the DOM's aria-describedby references, because
//   this build exposes no native accessibility tree. That half is a DOM check, not an AX-API check.
// Neither run is a screen-reader or human test. Exit 1 on any failed assertion.
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {pathToFileURL} from "node:url";

const RUN = "npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-guard-access-check.mjs <built html>";
const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
if (!bin) { console.error(`playwright-core is not on PATH. Run:\n  ${RUN}`); process.exit(2); }
const {chromium, webkit} = createRequire(pathToFileURL(path.join(bin, "..", "x.js")))("playwright-core");

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!file) { console.error(`usage: ${RUN} [--browser chrome|webkit] [--seed N] [--out DIR]`); process.exit(2); }
const engine = opt("browser", "chrome");
const seed = Number(opt("seed", "0"));
const out = path.resolve(opt("out", `.artifacts/showdown-guard-access/${engine}`));
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const GUARD_REASON = /Guard/;
await mkdir(out, {recursive: true});

const html = await readFile(path.resolve(file));
const server = createServer((req, res) => {
  if (new URL(req.url, "http://x").pathname === "/game.html") { res.writeHead(200, {"content-type": "text/html; charset=utf-8"}); res.end(html); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/game.html?seed=${seed}`;

const report = {engine, seed, page: "graybox build over loopback HTTP", driver: "Playwright 1.64.1 (scripted bot + keyboard presses)",
  accessibility: engine === "chrome" ? "Chrome accessibility tree via CDP" : "DOM aria-describedby references (no native AX tree in this WebKit build)",
  human: false, checks: [], errors: []};
const check = (name, detail) => { report.checks.push({name, passed: true, detail}); console.log(`ok - ${name}`); };

const browser = engine === "chrome" ? await chromium.launch({executablePath: CHROME, headless: true})
  : engine === "webkit" ? await webkit.launch() : null;
if (!browser) throw Error(`unknown --browser ${engine}`);
report.version = browser.version();
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") report.errors.push(m.text()); });
const cdp = engine === "chrome" ? await page.context().newCDPSession(page) : null;

const text = (sel) => page.locator(sel).first().textContent().then((t) => (t ?? "").trim());
const resultShown = () => page.locator("#showdown .sd-result").count().then(Boolean);
const click = (sel) => page.locator(sel).first().click();
const yourTurn = () => page.waitForFunction(() => /your turn$/.test(document.getElementById("sd-status").textContent) || document.querySelector("#showdown .sd-result"), null, {timeout: 30000});

// Name and description of an element as an assistive tool gets them.
async function ax(handleOrSelector) {
  const handle = typeof handleOrSelector === "string" ? await page.$(handleOrSelector) : handleOrSelector;
  if (cdp) {
    const {nodes} = await cdp.send("Accessibility.getPartialAXTree", {...(await remote(handle)), fetchRelatives: false});
    const n = nodes.find((x) => !x.ignored) ?? nodes[0];
    const prop = (k) => n.properties?.find((p) => p.name === k)?.value?.value;
    return {role: n.role?.value, name: n.name?.value ?? "", description: n.description?.value ?? "", disabled: Boolean(prop("disabled")), focusable: Boolean(prop("focusable"))};
  }
  return handle.evaluate((el) => {
    const ref = (attr) => (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent.trim() ?? "").join(" ");
    return {role: "button", name: el.getAttribute("aria-label") ?? el.textContent.replace(/\s+/g, " ").trim(), description: ref("aria-describedby"), disabled: el.disabled, focusable: !el.disabled};
  });
}
async function remote(handle) {
  // Playwright handles do not expose CDP ids: mark the node and find it through CDP's own DOM.
  const mark = `ga-${Math.random().toString(36).slice(2)}`;
  await handle.evaluate((el, m) => el.setAttribute("data-ga-probe", m), mark);
  const {root} = await cdp.send("DOM.getDocument", {depth: 0});
  const {nodeId} = await cdp.send("DOM.querySelector", {nodeId: root.nodeId, selector: `[data-ga-probe="${mark}"]`});
  await handle.evaluate((el) => el.removeAttribute("data-ga-probe"));
  return {nodeId};
}

// Same click loop as browser-showdown-trail-check.mjs: play what the screen enables, attack with every ready troop.
async function playCards() {
  for (let played = 0; played < 4; played += 1) {
    const card = await page.$("#sd-hand [data-card]:not(:disabled)");
    if (!card) return;
    await card.click();
    for (let i = 0; i < 3 && !(await page.locator("#sd-cancel").isHidden()); i += 1) {
      const prompt = await text("#sd-prompt");
      if (/as payment|to carry/.test(prompt)) await click("#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]");
      else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
      else await click("#sd-cancel");
    }
    if (await resultShown()) return;
  }
}
async function attackAll() {
  for (let i = 0; i < 3 && !(await resultShown()); i += 1) {
    const ready = await readyTroop();
    if (!ready) return;
    await click(`#sd-board [data-side=cowboy] [data-slot="${ready}"]`);
    const target = await page.$("[data-enemy=base]") ?? await page.$(".sd-slot[data-enemy]");
    if (!target) { if (!(await page.locator("#sd-cancel").isHidden())) await click("#sd-cancel"); return; }
    await target.click();
  }
}
const readyTroop = () => page.evaluate(() => [...document.querySelectorAll("#sd-board [data-side=cowboy] [data-own]")].find((n) => /Can attack/.test(n.textContent))?.dataset.slot ?? null);
const guardUp = () => page.evaluate(() => [...document.querySelectorAll('#sd-board [data-side=wizard] .sd-slot')].some((n) => /Bone Wall/.test(n.textContent) && [...n.querySelectorAll(".sd-key")].some((k) => k.textContent === "Guard")));
async function endTurn() { await click("#sd-end"); await yourTurn(); }
async function playDuel(stopWhen) {
  for (let turns = 0; turns < 60 && !(await resultShown()); turns += 1) {
    await playCards();
    if (stopWhen && !(await resultShown()) && await stopWhen()) return "stopped";
    await attackAll();
    if (await resultShown()) break;
    await endTurn();
  }
  return (await text("#sd-status")).startsWith("You win") ? "won" : "lost";
}
async function openTrail(name) {
  await page.locator("#showdown-camp button", {hasText: name}).first().click();
  await page.waitForFunction(() => / · turn 1 · your turn$/.test(document.getElementById("sd-status").textContent));
}
async function winTrail(name) {
  await openTrail(name);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (await playDuel() === "won") return attempt;
    await page.locator("#showdown button", {hasText: /^Rematch$/}).first().click();
    await page.waitForFunction(() => / · turn 1 · your turn$/.test(document.getElementById("sd-status").textContent));
  }
  throw Error(`${name} not won in 3 attempts`);
}

// Keyboard: Tab until the focused element matches, bounded. WebKit on macOS moves Tab between text
// fields only unless the user turns on "Press Tab to highlight each item"; Option+Tab reaches every
// control. The WebKit run probes plain Tab first, records what it reached, then uses Option+Tab.
let TAB = "Tab";
async function tabTo(selector, limit = 60) {
  for (let i = 0; i < limit; i += 1) {
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return i;
    await page.keyboard.press(TAB);
  }
  throw Error(`${TAB} never reached ${selector}`);
}
// Every enemy board button reachable with Tab while a pick is open, read from the focus order.
async function enemyTabStops() {
  const stops = [];
  const start = await page.evaluate(() => document.activeElement?.dataset.slot ?? document.activeElement?.id);
  for (let i = 0; i < 40; i += 1) {
    const at = await page.evaluate(() => { const a = document.activeElement; return {slot: a?.dataset.slot ?? null, id: a?.id ?? null, enemy: a?.dataset.enemy ?? null, text: a?.textContent.replace(/\s+/g, " ").trim().slice(0, 60)}; });
    if (at.enemy !== null && !stops.some((s) => s.slot === at.slot && s.enemy === at.enemy)) stops.push(at);
    await page.keyboard.press(TAB);
    const now = await page.evaluate(() => document.activeElement?.dataset.slot ?? document.activeElement?.id);
    if (now === start) break;
  }
  return stops;
}

let failed = null;
try {
  await page.goto(url);
  await page.locator("#menu-play").click();
  await page.waitForSelector("#showdown-camp:not([hidden])");
  check("Normal entry: Play opens the Camp", {url: url.replace(/^http:\/\/[^/]+/, "")});
  for (const name of ["Boot Hill", "Raven Roost"]) {
    const attempts = await winTrail(name);
    await page.locator("[data-choose]").first().click();
    await page.locator("#showdown button", {hasText: /^Back to camp$/}).first().click();
    await page.waitForSelector("#showdown-camp:not([hidden])");
    check(`Bot won ${name} by clicks and took the first offered card`, {attempts});
  }
  await openTrail("The Bone Fence");
  check("The Bone Fence opens from its Camp tile", {lesson: await text("#sd-lesson")});
  const reached = await playDuel(async () => Boolean(await readyTroop()) && await guardUp());
  assert.equal(reached, "stopped", "no Cowboy turn with a ready troop and a Bone Wall on the Wizard side");
  const turn = await text("#sd-status");
  check("Legal Guard turn reached: a ready Cowboy troop and a Bone Wall on the Wizard side", {status: turn});

  if (engine === "webkit") {
    const reached = [];
    for (let i = 0; i < 12; i += 1) { await page.keyboard.press("Tab"); reached.push(await page.evaluate(() => document.activeElement?.tagName ?? null)); }
    report.plainTab = {reachedButton: reached.includes("BUTTON"), focused: [...new Set(reached)]};
    if (!report.plainTab.reachedButton) TAB = "Alt+Tab";
    check(`WebKit plain Tab ${report.plainTab.reachedButton ? "reaches" : "does not reach"} buttons; the run uses ${TAB}`, report.plainTab);
  }
  // 1. Before choosing.
  const ready = await readyTroop();
  const tabs = await tabTo(`#sd-board [data-side=cowboy] [data-slot="${ready}"]`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.getElementById("sd-cancel").hidden);
  await page.screenshot({path: path.join(out, "guard-pick.png")});
  const focused = await ax(await page.evaluateHandle(() => document.activeElement));
  const prompt = await text("#sd-prompt");
  report.before = {tabsToTroop: tabs, prompt, focused};
  assert.match(focused.name, /Bone Wall/, `focus after Enter is on ${focused.name}`);
  assert.match(focused.name, /Guard/, "the focused target's name includes its Guard keyword");
  check("Enter on the ready troop moves focus to the Bone Wall, named with Guard", {name: focused.name});
  assert.match(focused.description, GUARD_REASON, `focused target description "${focused.description}" gives no Guard reason`);
  check("The focused Guard target's description gives the reason", {description: focused.description});
  const stops = await enemyTabStops();
  report.before.enemyTabStops = stops;
  assert.ok(stops.length > 0 && stops.every((s) => /Bone Wall/.test(s.text)), `enemy Tab stops: ${JSON.stringify(stops)}`);
  check("Every enemy Tab stop during the pick is a Guard troop", {stops: stops.map((s) => s.slot)});
  // 2. Blocked targets.
  const blocked = [];
  for (const h of await page.$$("#sd-board [data-side=wizard] button")) {
    const info = await h.evaluate((el) => ({slot: el.dataset.slot ?? el.dataset.base, filled: !/^empty$/.test(el.textContent.trim()), guard: /Bone Wall/.test(el.textContent), disabled: el.disabled}));
    if (!info.filled || info.guard) continue;
    blocked.push({...info, ax: await ax(h)});
  }
  report.before.blocked = blocked;
  assert.ok(blocked.length > 0, "nothing blocked behind the Guard");
  for (const b of blocked) {
    assert.ok(b.disabled && b.ax.disabled, `${b.slot} is not exposed as disabled`);
    assert.match(b.ax.description, GUARD_REASON, `${b.slot} (${b.ax.name.slice(0, 40)}) has no Guard reason: "${b.ax.description}"`);
  }
  check("Blocked enemy troops and the Base are disabled and their description gives the Guard reason", {blocked: blocked.map((b) => b.slot)});

  // 3. Attack the Guard by keyboard until none is left.
  const announced = [];
  for (let round = 0; round < 8 && await guardUp() && !(await resultShown()); round += 1) {
    const guardFocused = await page.evaluate(() => /Bone Wall/.test(document.activeElement?.textContent ?? "") && document.activeElement.dataset.enemy !== undefined);
    if (!guardFocused) {
      const next = await readyTroop();
      if (!next) { await tabTo("#sd-end"); await page.keyboard.press("Enter"); await yourTurn(); await playCards(); continue; }
      await tabTo(`#sd-board [data-side=cowboy] [data-slot="${next}"]`);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.getElementById("sd-cancel").hidden);
      if (!(await page.evaluate(() => /Bone Wall/.test(document.activeElement?.textContent ?? "")))) throw Error("focus did not land on the Guard on a later pick");
    }
    const before = await text("#sd-feedback");
    await page.keyboard.press("Enter");
    await page.waitForFunction((b) => document.getElementById("sd-feedback").textContent !== b, before);
    announced.push(await text("#sd-feedback"));
  }
  const live = await page.evaluate(() => document.getElementById("sd-feedback").getAttribute("aria-live"));
  assert.ok(!(await guardUp()), "the Guard is still standing after the keyboard attacks");
  assert.equal(live, "polite");
  assert.ok(announced.some((a) => /Bone Wall and defeated it/.test(a)), `no defeat announced: ${announced}`);
  check("Keyboard attacks defeat the Guard and the polite live region announces it", {announced});

  // After the Guard falls: the next pick offers other targets and drops the Guard reason.
  let after = null;
  for (let turns = 0; turns < 6 && !after && !(await resultShown()); turns += 1) {
    const next = await readyTroop();
    if (next && !(await guardUp())) {
      await tabTo(`#sd-board [data-side=cowboy] [data-slot="${next}"]`);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.getElementById("sd-cancel").hidden);
      await page.screenshot({path: path.join(out, "after-guard.png")});
      after = {prompt: await text("#sd-prompt"), focused: await ax(await page.evaluateHandle(() => document.activeElement)), stops: await enemyTabStops()};
      break;
    }
    if (await guardUp()) { report.note = "a second Bone Wall arrived before a post-Guard pick"; break; }
    await tabTo("#sd-end"); await page.keyboard.press("Enter"); await yourTurn(); await playCards();
  }
  report.after = after;
  if (after) {
    assert.doesNotMatch(after.prompt, /Guard/);
    assert.doesNotMatch(after.focused.name, /Bone Wall/);
    assert.doesNotMatch(after.focused.description, /Guard/);
    assert.ok(after.focused.description.length > 0, "the post-Guard target has no description");
    check("After the Guard falls the next pick focuses another target and its description drops the Guard reason", {prompt: after.prompt, focused: after.focused.name.slice(0, 50), description: after.focused.description, stops: after.stops.map((s) => s.slot ?? s.enemy)});
  } else {
    report.checks.push({name: "Post-Guard pick", passed: null, detail: report.note ?? "no ready troop with no Guard before the duel ended"});
    console.log("pending - post-Guard pick not reached");
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  failed = error;
  report.failure = error.message;
  console.error(`not ok - ${error.message}`);
  await page.screenshot({path: path.join(out, "failure.png")}).catch(() => {});
} finally {
  await writeFile(path.join(out, "result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  server.close();
}
console.log(`${failed ? "FAIL" : "PASS"} ${engine} ${report.version}: ${report.checks.filter((c) => c.passed).length} checks; ${path.relative(process.cwd(), out)}/result.json`);
process.exit(failed ? 1 : 0);
