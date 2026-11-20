// K-011 Outrider turns in Playwright's WebKit (the engine behind Safari, not Safari, not an iPhone, not a human).
//   npm run build
//   node scripts/browser-showdown-outrider-webkit.mjs dist/cowboys-vs-wizards-board-duel.html [--out DIR]
// (or under `npx -y -p playwright-core@1.64.1 node ...`; the script takes playwright-core from PATH first,
// then the repo's untracked node_modules/playwright. It installs nothing.)
//
// Normal entry: the built page is served over loopback HTTP at "/", fresh context, Play opens the Camp.
// Expected board states come from the same engine in Node (outriderDuel + createShowdownSession + the case's arm).
//   touch   375x667, isMobile + hasTouch, every input a touchscreen tap at the button's centre after a hit test
//           (the centre must be in the viewport and elementFromPoint must be the button). Camp control -> case-e,
//           pick the Outrider, check the offered targets, their description and preview, tap the troop (fight),
//           compare the public board with the engine, play out, Retry, Back to camp, Ledger opened unrevealed.
//   keyboard 1440x900, every input a Tab / Enter press. Ledger link -> case-a, Enter on the Outrider, focus must
//           land on the Wizard Base, Enter (ride), board compared, play out, Retry, Back to camp, focus restored.
// Both: no measured result in the DOM before a reveal, no Wizard hand face, orb counts within bounds, page
// errors none, the saved career written first is byte-identical at the end.
// Controls: the same flows run on in-memory copies of the page with one injected defect each (target covered,
// target offscreen, tap/Enter on one target delivered to the other). Each must fail with the matching check;
// a defect that passes makes the run fail.
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {loadDecision, verifiedForBuild} from "./outrider-gate.mjs";
import {outriderDuel} from "../src/match/showdown-outrider.js";
import {createShowdownSession} from "../src/match/showdown-session.js";
import {cardOf} from "../src/game/showdown/cards.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {newSave} from "../src/game/showdown/progress.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
const req = createRequire(bin ? pathToFileURL(path.join(bin, "..", "x.js")) : import.meta.url);
let webkit, driver;
try { ({webkit} = req(bin ? "playwright-core" : "playwright")); driver = `${bin ? "playwright-core" : "playwright"} ${req(`${bin ? "playwright-core" : "playwright"}/package.json`).version}`; }
catch { console.error("No Playwright found: run under npx -y -p playwright-core@1.64.1 node ..."); process.exit(2); }

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!file) { console.error("usage: node scripts/browser-showdown-outrider-webkit.mjs <built html> [--out DIR]"); process.exit(2); }
const out = path.resolve(opt("out", ".artifacts/showdown-outrider-webkit"));
await mkdir(out, {recursive: true});

// --- expectations from the engine -------------------------------------------------------------------------
const verified = await verifiedForBuild();
const decision = await loadDecision();
const CASES = {touch: {id: "case-e", arm: "fight"}, keyboard: {id: "case-a", arm: "ride"}};
for (const {id} of Object.values(CASES)) assert.ok(verified.cases.some((c) => c.id === id), `${id} is not verified for this build (${verified.note})`);
assert.equal(verified.camp, "case-e", "the Camp control is expected to open case-e");
const publicBoard = (view) => Object.fromEntries(["wizard", "cowboy"].map((side) => { const s = view.sides[side];
  return [side, {base: `${s.base} of ${Math.max(s.base, s.baseMax)} orbs`, slots: s.board.map((t) => t ? `${cardOf(t.cardId).name} ${t.health} of ${Math.max(t.health, cardOf(t.cardId).health)} orbs` : "empty")}]; }));
function expect(id, arm) {
  const entry = decision.cases.find((c) => c.id === id);
  const {seed, duel} = outriderDuel(entry);
  const session = createShowdownSession({seed, duel});
  const action = entry.arms[arm];
  const targets = session.legal().filter((a) => a.type === "attack" && a.slot === action.slot).map((a) => String(a.target)).sort();
  const landing = publicBoard(session.view());
  session.act(action);
  return {id, arm, at: entry.at, action, targets, landing, after: publicBoard(session.view())};
}
const EXPECT = {touch: expect(CASES.touch.id, CASES.touch.arm), keyboard: expect(CASES.keyboard.id, CASES.keyboard.arm)};
const other = (t) => t === "base" ? EXPECT.touch.targets.find((x) => x !== "base") : "base";
assert.notDeepEqual(EXPECT.touch.after, expect("case-e", "ride").after, "case-e arms must leave different boards");
assert.notDeepEqual(EXPECT.keyboard.after, expect("case-a", "fight").after, "case-a arms must leave different boards");

// --- page server: "/" is the built page; /defect-<name>/ is an in-memory copy with one injected defect -----
const html = await readFile(path.resolve(file), "utf8");
const DEFECTS = {
  covered: `<script>(()=>{const d=document.createElement("div");d.id="defect-cover";d.style.cssText="position:absolute;z-index:99999;background:transparent";
    const f=()=>{const t=document.querySelector('#sd-board [data-slot="wizard-0"][data-enemy]');if(t){const r=t.getBoundingClientRect();Object.assign(d.style,{left:r.x+scrollX+"px",top:r.y+scrollY+"px",width:r.width+"px",height:r.height+"px",display:"block"});if(!d.isConnected)document.body.append(d);}else d.style.display="none";requestAnimationFrame(f);};f();})();</script>`,
  offscreen: `<style>#sd-board [data-slot="wizard-0"][data-enemy]{position:fixed!important;left:-5000px!important;top:0!important}</style>`,
  "wrong-target": `<script>document.addEventListener("click",(e)=>{const b=e.target.closest&&e.target.closest("[data-enemy]");if(b)b.dataset.enemy=b.dataset.enemy==="base"?"0":"base";},true);</script>`,
};
const server = createServer((request, res) => {
  const p = new URL(request.url, "http://x").pathname;
  const m = p.match(/^\/defect-([a-z-]+)\/$/);
  if (p !== "/" && !(m && DEFECTS[m[1]])) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"});
  res.end(m ? html.replace(/<\/body>/i, `${DEFECTS[m[1]]}</body>`) : html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- shared page checks ----------------------------------------------------------------------------------
const RESULT_WORDS = /won on turn|fresh reversals|always riding|unsupported/;
async function noReveal(page, where) {
  const leaked = await page.evaluate((src) => new RegExp(src).test([...document.body.querySelectorAll("*")].filter((n) => !n.closest("script"))
    .map((n) => [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.data).join("") + [...n.attributes].map((a) => a.value).join(" ")).join(" ")), RESULT_WORDS.source);
  assert.ok(!leaked, `measured results in the DOM ${where}`);
}
async function invariants(page, where) {
  const seen = await page.evaluate(() => ({
    orbs: [...document.querySelectorAll("#sd-board .sd-orbs")].map((n) => n.getAttribute("aria-label")),
    wizardFaces: [...document.querySelectorAll("#sd-hand [data-card]")].filter((n) => n.dataset.card.startsWith("wizard-")).length,
    backs: [...document.querySelectorAll('#sd-board .sd-side[data-side="wizard"] .sd-backs .card-back')].length,
    handNote: document.querySelector('#sd-board [data-base="wizard"]')?.textContent.match(/Hand (\d+)/)?.[1] ?? null,
  }));
  for (const label of seen.orbs) { const [, now, max] = label.match(/^(\d+) of (\d+) orbs$/) ?? []; assert.ok(now !== undefined && +now >= 0 && +now <= +max, `${where}: orb label "${label}"`); }
  assert.equal(seen.wizardFaces, 0, `${where}: a Wizard card face is in the hand row`);
  assert.equal(String(seen.backs), seen.handNote, `${where}: Wizard card backs differ from the hand count`);
  return seen.orbs.length;
}
const boardOf = (page) => page.evaluate(() => Object.fromEntries(["wizard", "cowboy"].map((side) => {
  const row = document.querySelector(`#sd-board .sd-side[data-side="${side}"]`);
  return [side, {base: row.querySelector(".sd-base .sd-orbs").getAttribute("aria-label"),
    slots: [...row.querySelectorAll(".sd-slot")].map((b) => b.querySelector("strong") ? `${b.querySelector("strong").textContent} ${b.querySelector(".sd-orbs").getAttribute("aria-label")}` : "empty")}];
})));
async function landing(page, exp, where) {
  await page.waitForFunction(() => !document.getElementById("showdown").hidden && document.getElementById("sd-status").textContent.includes("Experiment: an Outrider turn"), null, {timeout: 15000});
  assert.match(await page.textContent("#sd-status"), new RegExp(`turn ${exp.at} · your turn`), `${where}: status`);
  assert.match(await page.textContent("#sd-lesson"), /^Experiment for review, not advice or a bounty: nothing here is saved/, `${where}: lesson`);
  assert.deepEqual(await boardOf(page), exp.landing, `${where}: landing board differs from the engine`);
  assert.ok(await page.evaluate(() => document.getElementById("showdown-camp").hidden), `${where}: Camp visible during the duel`);
  await noReveal(page, where);
  await invariants(page, where);
}
// After the Outrider is picked: exactly the engine's targets are offered, each described by the prompt.
async function affordance(page, exp, where) {
  const seen = await page.evaluate((slot) => {
    const picked = document.querySelector(`[data-slot="cowboy-${slot}"]`);
    const enemies = [...document.querySelectorAll('#sd-board .sd-side[data-side="wizard"] button')];
    return {picked: picked.classList.contains("sd-pick"), pickedNote: picked.querySelector(".sd-note:last-of-type")?.textContent ?? "",
      prompt: document.getElementById("sd-prompt").textContent,
      offered: enemies.filter((b) => b.dataset.enemy !== undefined && !b.disabled).map((b) => ({target: b.dataset.enemy, describedby: b.getAttribute("aria-describedby"),
        preview: b.querySelector(".sd-good, .sd-warn, .sd-note:last-child")?.textContent ?? "", name: b.querySelector("strong")?.textContent})),
      blocked: enemies.filter((b) => b.dataset.enemy === undefined).every((b) => b.disabled)};
  }, exp.action.slot);
  assert.ok(seen.picked, `${where}: the Outrider is not marked as picked`);
  assert.deepEqual(seen.offered.map((o) => o.target).sort(), exp.targets, `${where}: offered targets`);
  assert.ok(seen.offered.every((o) => o.describedby === "sd-prompt"), `${where}: a target lacks aria-describedby=sd-prompt`);
  assert.match(seen.prompt, /^Choose what to attack\./, `${where}: prompt`);
  const base = seen.offered.find((o) => o.target === "base");
  assert.match(base.preview, /^Ride past: Hit the Base for \d+$/, `${where}: Base preview`);
  for (const o of seen.offered.filter((t) => t.target !== "base")) assert.match(o.preview, /^(Survives on|Defeated)/, `${where}: troop ${o.target} preview`);
  assert.ok(seen.blocked, `${where}: an enemy button without a target is enabled`);
  return seen;
}

// --- touch flow --------------------------------------------------------------------------------------------
async function tap(page, selector, log) {
  const loc = page.locator(selector).first();
  await loc.waitFor({state: "attached", timeout: 10000});
  const r = await loc.evaluate((n) => { n.scrollIntoView({block: "center"}); const b = n.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {x, y, w: Math.round(b.width), h: Math.round(b.height), disabled: n.disabled, inView: b.width > 0 && b.height > 0 && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
      hitSelf: Boolean(hit) && (hit === n || n.contains(hit)), hit: hit ? (hit.id || hit.tagName) : null}; });
  assert.ok(!r.disabled, `tap ${selector}: disabled`);
  assert.ok(r.inView, `tap ${selector}: offscreen (centre ${Math.round(r.x)},${Math.round(r.y)})`);
  assert.ok(r.hitSelf, `tap ${selector}: covered by ${r.hit}`);
  await page.touchscreen.tap(r.x, r.y);
  log?.push({selector, w: r.w, h: r.h});
  await page.waitForTimeout(40);
}
async function seedCareer(page, base) {
  await page.goto(base, {waitUntil: "load"});
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify({...newSave(), wins: 2})]);
  await page.goto(base, {waitUntil: "load"});
}
const storage = (page) => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]))));

async function touchFlow(page, base, rec, full) {
  const exp = EXPECT.touch, taps = [];
  await page.addInitScript(() => { window.__touch = {pointer: [], touchstart: 0};
    addEventListener("pointerdown", (e) => window.__touch.pointer.push(e.pointerType), true);
    addEventListener("touchstart", () => { window.__touch.touchstart += 1; }, true); });
  await seedCareer(page, base);
  await tap(page, "#menu-play", taps);
  await page.waitForFunction(() => !document.getElementById("showdown-camp").hidden);
  const before = await storage(page);
  assert.equal((await page.$$eval("#camp-experiment [data-outrider]", (b) => b.map((n) => [n.dataset.outrider, n.textContent]))).join("|"), "case-e,Try an Outrider turn");
  await noReveal(page, "on the Camp");
  if (full) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "the Camp scrolls sideways");
    await tap(page, "#camp-ledger > summary", taps);
    await page.waitForFunction(() => document.getElementById("camp-ledger").open);
    const links = await page.$$eval("#ledger-outrider [data-outrider]", (b) => b.map((n) => n.dataset.outrider).sort());
    assert.deepEqual(links, ["case-a", "case-e"], "Ledger links");
    assert.equal(await page.$eval("#ledger-outrider-results", (n) => n.hidden && n.innerHTML === ""), true, "Ledger results present before reveal");
    await noReveal(page, "with the Ledger open, before the reveal");
    await page.screenshot({path: path.join(out, "touch-01-ledger-unrevealed.png")});
    await tap(page, "#camp-ledger > summary", taps);
    rec.push("touch: Camp shows one control; Ledger opened by tap lists case-a and case-e, results hidden and absent from the DOM");
  }
  await tap(page, "#camp-outrider-turn", taps);
  await landing(page, exp, "touch landing");
  await page.screenshot({path: path.join(out, "touch-02-landing.png")});
  await tap(page, `[data-slot="cowboy-${exp.action.slot}"]`, taps);
  const aff = await affordance(page, exp, "touch aiming");
  rec.push(`touch: Outrider picked; offered ${aff.offered.map((o) => `${o.target}="${o.name}: ${o.preview}"`).join(", ")}; prompt "${aff.prompt}"`);
  await page.screenshot({path: path.join(out, "touch-03-aiming.png")});
  await tap(page, `#sd-board [data-slot="wizard-${exp.action.target}"][data-enemy]`, taps);
  await page.waitForFunction(() => !document.querySelector(".sd-pick"));
  assert.deepEqual(await boardOf(page), exp.after, "touch: board after the fight differs from the engine");
  await invariants(page, "touch after the fight");
  await noReveal(page, "after the fight");
  rec.push(`touch: tapped Wizard troop ${exp.action.target}; public board equals the engine (${exp.after.wizard.slots[0]}, Wizard Base ${exp.after.wizard.base}; Outrider ${exp.after.cowboy.slots[exp.action.slot]})`);
  if (!full) return;
  await page.screenshot({path: path.join(out, "touch-04-after-fight.png")});
  for (let i = 0; i < 80 && !(await page.$("#sd-result .sd-row")); i++) {
    if (await page.$eval("#sd-end", (b) => !b.disabled && !b.hidden)) await tap(page, "#sd-end"); else await page.waitForTimeout(50);
    await invariants(page, `touch play-out step ${i}`);
  }
  await page.waitForSelector("#sd-result .sd-row", {timeout: 15000});
  assert.equal(await page.textContent("#sd-again"), "Retry");
  assert.ok(!/collection|earned|Grit/.test(await page.textContent("#sd-result")), "the result pays or charges something");
  await tap(page, "#sd-again", taps);
  await landing(page, exp, "touch after Retry");
  await tap(page, "#sd-home", taps);
  await page.waitForFunction(() => !document.getElementById("showdown-camp").hidden);
  const restored = await page.evaluate(() => { const a = document.activeElement, r = a?.getBoundingClientRect();
    return {focus: a?.dataset?.outrider ?? a?.id ?? a?.tagName, inView: Boolean(r) && r.top >= 0 && r.bottom <= innerHeight}; });
  assert.equal(restored.focus, "case-e", "touch: focus not restored to the Camp control");
  assert.equal(await storage(page), before, "touch: saved career changed");
  const touch = await page.evaluate(() => window.__touch);
  assert.ok(touch.touchstart >= taps.length && touch.pointer.length > 0 && touch.pointer.every((t) => t === "touch"), `touch events: ${JSON.stringify(touch)}`);
  rec.push(`touch: played out by tapping End turn, Retry re-opened the landing, Back to camp restored focus to the Camp control (in view: ${restored.inView}); career byte-identical`);
  rec.push(`touch: ${taps.length} taps, ${touch.touchstart} touchstart events, pointerType ${[...new Set(touch.pointer)].join(",")}; smallest tapped box ${Math.min(...taps.map((t) => t.w))}x${Math.min(...taps.map((t) => t.h))} px`);
  return {taps, restored};
}

// --- keyboard flow -----------------------------------------------------------------------------------------
// WebKit on macOS moves plain Tab between text fields only unless "Press Tab to highlight each item" is on;
// Option+Tab reaches every control. The run probes plain Tab once and records which key it used.
let TAB = null;
async function tabKey(page, rec) {
  if (TAB) return;
  const reached = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); reached.push(await page.evaluate(() => document.activeElement?.tagName ?? null)); }
  TAB = reached.includes("BUTTON") ? "Tab" : "Alt+Tab";
  rec.push(`keyboard: plain Tab ${TAB === "Tab" ? "reaches" : "does not reach"} buttons in this WebKit (focused: ${[...new Set(reached)].join(",")}); the run uses ${TAB}`);
  await page.evaluate(() => document.activeElement?.blur());
}
async function tabTo(page, selector, max = 120) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) {
      const r = await page.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; });
      assert.ok(r, `focused ${selector} is offscreen`);
      return i;
    }
    await page.keyboard.press(TAB);
  }
  throw new Error(`Tab never reached ${selector}`);
}
async function keyboardFlow(page, base, rec, full) {
  const exp = EXPECT.keyboard;
  let tabs = 0;
  const press = async (selector) => { tabs += await tabTo(page, selector); await page.keyboard.press("Enter"); await page.waitForTimeout(40); };
  await seedCareer(page, base);
  await tabKey(page, rec);
  await press("#menu-play");
  await page.waitForFunction(() => !document.getElementById("showdown-camp").hidden);
  const before = await storage(page);
  await press("#camp-ledger > summary");
  await page.waitForFunction(() => document.getElementById("camp-ledger").open);
  await noReveal(page, "keyboard: Ledger open before the reveal");
  await press(`#ledger-outrider [data-outrider="${exp.id}"]`);
  await landing(page, exp, "keyboard landing");
  await press(`[data-slot="cowboy-${exp.action.slot}"]`);
  const aff = await affordance(page, exp, "keyboard aiming");
  const focused = await page.evaluate(() => ({base: document.activeElement?.dataset.base, enemy: document.activeElement?.dataset.enemy,
    description: document.getElementById(document.activeElement?.getAttribute("aria-describedby") ?? "")?.textContent ?? null}));
  assert.equal(focused.enemy, "base", `keyboard: focus after picking the Outrider is on ${JSON.stringify(focused)}, not the Wizard Base`);
  assert.equal(focused.description, aff.prompt);
  rec.push(`keyboard: Enter on the Outrider moved focus to the Wizard Base, described by "${focused.description}"; offered ${aff.offered.map((o) => `${o.target}="${o.name}: ${o.preview}"`).join(", ")}`);
  await page.screenshot({path: path.join(out, "keyboard-01-aiming.png")});
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".sd-pick"));
  assert.deepEqual(await boardOf(page), exp.after, "keyboard: board after the ride differs from the engine");
  await invariants(page, "keyboard after the ride");
  await noReveal(page, "after the ride");
  rec.push(`keyboard: Enter on the Base; public board equals the engine (Wizard Base ${exp.after.wizard.base}, Wizard troops ${exp.after.wizard.slots.join(", ")})`);
  if (!full) return;
  await page.screenshot({path: path.join(out, "keyboard-02-after-ride.png")});
  for (let i = 0; i < 80 && !(await page.$("#sd-result .sd-row")); i++) {
    if (await page.$eval("#sd-end", (b) => !b.disabled && !b.hidden)) await press("#sd-end"); else await page.waitForTimeout(50);
    await invariants(page, `keyboard play-out step ${i}`);
  }
  await page.waitForSelector("#sd-result .sd-row", {timeout: 15000});
  await press("#sd-again");
  await landing(page, exp, "keyboard after Retry");
  await press("#sd-home");
  await page.waitForFunction(() => !document.getElementById("showdown-camp").hidden);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.outrider), exp.id, "keyboard: focus not restored to the Ledger link");
  assert.equal(await storage(page), before, "keyboard: saved career changed");
  rec.push(`keyboard: played out with Tab/Enter on End turn, Retry, Back to camp restored focus to the "${exp.id}" Ledger link; career byte-identical; ${tabs} ${TAB} presses in total`);
}

// --- run -----------------------------------------------------------------------------------------------------
const git = (...a) => { try { return execFileSync("git", a, {cwd: ROOT, encoding: "utf8"}).trim(); } catch { return null; } };
const browser = await webkit.launch();
const report = {check: "Playwright WebKit on macOS; not Safari, not an iPhone, not a human test", date: new Date().toISOString(), commit: git("rev-parse", "HEAD"),
  dirty: Boolean(git("status", "--porcelain", "--", "src")), page: "built graybox over loopback HTTP at /", driver, webkit: browser.version(), os: `${os.type()} ${os.release()} ${os.arch()}`,
  gate: verified.note, expected: EXPECT, runs: {}, controls: {}};
const CONTEXTS = {touch: {viewport: {width: 375, height: 667}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}, keyboard: {viewport: {width: 1440, height: 900}}};
async function run(kind, base, full) {
  const context = await browser.newContext(CONTEXTS[kind]);
  const page = await context.newPage();
  const errors = [], rec = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  try {
    await (kind === "touch" ? touchFlow : keyboardFlow)(page, base, rec, full);
    assert.deepEqual(errors, [], "page errors");
    return {passed: true, checks: rec, ua: await page.evaluate(() => navigator.userAgent), viewport: CONTEXTS[kind]};
  } catch (error) {
    return {passed: false, checks: rec, failure: error.message.split("\n")[0], errors};
  } finally { await context.close(); }
}
let ok = true;
for (const kind of ["touch", "keyboard"]) {
  const r = report.runs[kind] = await run(kind, `${origin}/`, true);
  for (const c of r.checks) console.log(`ok - ${c}`);
  if (!r.passed) { ok = false; console.log(`FAIL - ${kind}: ${r.failure}`); }
}
const CONTROLS = [["touch", "covered", /^tap .*wizard-0.*: covered by defect-cover/], ["touch", "offscreen", /^tap .*wizard-0.*: offscreen/],
  ["touch", "wrong-target", /^touch: board after the fight differs/], ["keyboard", "wrong-target", /^keyboard: board after the ride differs/]];
for (const [kind, defect, want] of CONTROLS) {
  const r = await run(kind, `${origin}/defect-${defect}/`, false);
  const caught = !r.passed && want.test(r.failure);
  report.controls[`${kind}/${defect}`] = {caught, failure: r.failure ?? "passed (defect not detected)"};
  console.log(`${caught ? "ok - control" : "FAIL - control"} ${kind}/${defect}: ${r.failure ?? "not detected"}`);
  ok &&= caught;
}
await browser.close();
server.close();
report.passed = ok;
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`WebKit ${report.webkit} (${driver}): ${ok ? "passed" : "FAILED"}; report ${path.relative(process.cwd(), path.join(out, "report.json"))}`);
process.exit(ok ? 0 : 1);
