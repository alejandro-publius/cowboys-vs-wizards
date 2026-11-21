// Wizard preview (Fable 5.2, November 20): independent Chrome check of the shipped preview on the graybox page.
// QA instrumentation only: it changes no src/ file. It uses the same loopback server, playwright-core and
// installed Chrome as scripts/browser-showdown-practice.mjs. The routes and selectors it relies on are the
// agreed ones: Fable's ruling (the four duels, Open range, Wizard seat, key cvw-showdown-wizard-preview-v1 =
// {v:1, wins, losses}, no playtest line, Cowboy keys untouched) and the entry selectors (#camp-wizard,
// #wizard-duel-<id>, #wizard-reset, #wizard-to-camp, ?wizard=1 last after ?turn, ?outrider, ?practice).
//
//   node scripts/build-graybox.mjs --hosted
//   npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-wizard-check.mjs --page dist/web/index.html [--out R.json]
//   npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-wizard-check.mjs --url https://HOST/PATH/ [--out R.json]
//
// --page serves the file on loopback at / and /graybox/. --url points to a running copy instead (after merge, the
// live site or a branch preview); then only that origin may be requested. Every context gets reduced motion and a
// fixed Math.random sequence (an init script, test-only), so a fresh deal or a Rematch is the same on every run.
// Checks, each in a fresh Chrome context:
//   new-cowboy    empty storage: the Camp has no preview. Play Boot Hill to a real win, then the collapsed section
//                 appears. Open it and start Dry Gulch by keyboard only, win, and compare the Cowboy keys.
//   direct        planted Cowboy career (pending offer, 2 packs, one playtest row): ?wizard=1 writes nothing. A Dry
//                 Gulch win writes only the preview key and survives a reload. Cowboy keys, save code, offer, packs
//                 and the log stay byte-identical. "Cowboy Camp" is the explicit way back.
//   camp          the same career from an entered Camp: Restart, Escape cancelling a pick, a loss with grit and
//                 Rematch, focus on return, Start preview over (dismissed, then accepted), and Cowboy Start over
//                 leaving the preview alone.
//   track         all four wins through the visible tiles, the rewards each names, completion, then one Open range,
//                 Wizard seat duel that saves nothing.
//   routes        ?wizard=1 precedence against ?turn, ?outrider and ?practice (valid or not), malformed ?wizard values,
//                 /graybox/, and a first-time direct visit that writes no key.
// Throughout a Wizard duel: the viewer row and every hand card are Wizard. No Cowboy card instance id (a hidden hand,
// trap or deck card) appears in the page. Cowboy hand cards show as backs matching the count, and Cowboy traps
// show only as a count. Cowboy cards in public zones (board, graveyard, log) are named, which is allowed. The bot's
// Cowboys reply after End turn, and the result names the winner from the Wizard's side.
// Scripted Chrome: no human played. It says nothing about clarity, difficulty felt or fun.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {migrate, newSave, settle} from "../src/game/showdown/progress.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {encodeSave} from "../src/game/showdown/savecode.js";
import {TYPES, typeOf} from "../src/game/showdown/cards.js";
import {PLAYTEST_KEY} from "../src/match/showdown-playtest.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIZARD_KEY = "cvw-showdown-wizard-preview-v1";
const TRACK = [
  {id: "dry-gulch", name: "Dry Gulch", pays: ["wizard-raven-familiar"]},
  {id: "wagon-ring", name: "Wagon Ring", pays: ["wizard-bone-wall"]},
  {id: "trapline-pass", name: "Trapline Pass", pays: ["wizard-imp", "wizard-hex"]},
  {id: "high-noon", name: "High Noon", pays: ["wizard-dragon"]},
];
const OPEN_RANGE = "Open range, Wizard seat";
const MAX_TURNS = 60, MAX_TRIES = 15;
const USAGE = `usage:
  node scripts/browser-showdown-wizard-check.mjs --page FILE.html [--out REPORT.json] [--only new-cowboy,direct,camp,track,routes]
  node scripts/browser-showdown-wizard-check.mjs --url https://HOST/PATH/ [--out REPORT.json] [--only ...]
Exit 0 when every check passes, 1 on a failed check, 2 on bad arguments.`;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (...args) => { try { return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch { return null; } };
const nameOf = (type) => TYPES[type].name;
// Card instance ids of the Cowboy side ("cowboy-sheriff-7"): what the screen may never write for the other seat.
const COWBOY_ID = new RegExp(`\\b(${Object.keys(TYPES).filter((t) => TYPES[t].side === "cowboy").join("|")})-\\d+\\b`);

// Synthetic Cowboy career (nobody's data): Boot Hill won with its offer still pending, 2 packs, one playtest row.
function career() {
  const save = {...settle(newSave(), "trail", true).save, packs: 2};
  if (!save.offer) throw new Error("fixture: Boot Hill win left no pending offer");
  return {[SAVE_KEY]: JSON.stringify(save),
    [PLAYTEST_KEY]: JSON.stringify([{name: "Boot Hill", won: true, turns: 9, seconds: 71, rules: false}])};
}
// The keys whose stored strings differ, with both values shortened, for a failure message.
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k])
  .map((k) => `${k}: ${String(a[k]).slice(0, 90)} -> ${String(b[k]).slice(0, 90)}`).join("; ");
const same = (a, b) => diff(a, b) === "";
const codeOf = (raw) => encodeSave(migrate(JSON.parse(raw)));

// ---- Browser plumbing (as in browser-showdown-practice.mjs) ------------------------------------------
function loadPlaywright() {
  const tryFrom = (base) => { try { return createRequire(base)("playwright-core"); } catch { return null; } };
  const local = tryFrom(path.join(root, "package.json"));
  if (local) return local;
  const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
  const found = bin && tryFrom(pathToFileURL(path.join(bin, "..", "x.js")));
  if (found) return found;
  throw new Error("playwright-core not found. Run as: npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-wizard-check.mjs ...");
}

async function serve(html) {
  const server = createServer((req, res) => {
    const {pathname} = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && ["/", "/index.html", "/graybox/", "/graybox/index.html"].includes(pathname)) {
      res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}); res.end(html); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {base: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((ok) => server.close(ok))};
}

// One fresh context. planted: localStorage written once, before the page's first script, on the first load only.
async function open(browser, base, {planted = {}, random = 1} = {}) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: "reduce"});
  await ctx.addInitScript(({planted, random}) => {
    let s = random >>> 0; // mulberry32: the same fresh deals and Rematches on every run
    Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    if (!sessionStorage.getItem("qa-planted")) {
      localStorage.clear();
      for (const [k, v] of Object.entries(planted)) localStorage.setItem(k, v);
      sessionStorage.setItem("qa-planted", "1");
    }
  }, {planted, random});
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [], remote = [];
  const origin = new URL(base).origin;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await ctx.route("**/*", (r) => {
    const url = r.request().url();
    if (url.startsWith(origin + "/") || /^(data:|blob:|about:)/.test(url)) return r.continue();
    remote.push(url); return r.abort();
  });
  const go = (rel) => page.goto(new URL(rel, base).href);
  const storage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  const cowboy = async () => { const all = await storage(); delete all["cvw-showdown-wizard-preview-v1"]; return all; };
  const wizard = async () => { const raw = (await storage())[WIZARD_KEY]; return raw === undefined ? null : JSON.parse(raw); };
  return {ctx, page, errors, remote, go, storage, cowboy, wizard};
}

// ---- Page reads (DOM only) -----------------------------------------------------------------------------
// The duel screen draws the opponent's row first and the viewer's row last (showdown-screen.js render()).
const READ = (cowboyId) => {
  const rows = [...document.querySelectorAll("#sd-board .sd-side")];
  const side = (row) => {
    const name = row?.dataset.side, base = row?.querySelector(`[data-base="${name}"]`);
    const counts = base?.textContent.match(/Hand (\d+) · Deck (\d+) · Graveyard (\d+)/);
    return {side: name ?? null, label: base?.querySelector("strong")?.textContent.trim() ?? null,
      orbs: base?.querySelector(".sd-orbs")?.getAttribute("aria-label") ?? null, hand: counts ? Number(counts[1]) : null,
      backs: base?.querySelectorAll(".sd-backs .card-back").length ?? 0, traps: base?.textContent.match(/▲ ([^\n]*)/)?.[1].trim() ?? null};
  };
  const html = document.querySelector("#showdown")?.outerHTML ?? "";
  return {status: document.querySelector("#sd-status")?.textContent.trim() ?? "", own: side(rows.at(-1)), foe: side(rows[0]),
    hand: [...document.querySelectorAll("#sd-hand [data-card]")].map((n) => ({id: n.dataset.card, cls: n.className})),
    leak: html.match(new RegExp(cowboyId))?.[0] ?? null, result: document.querySelector("#sd-result")?.textContent.replace(/\s+/g, " ").trim() ?? "",
    log: [...document.querySelectorAll("#sd-log li")].map((n) => n.textContent.trim())};
};
const read = (page) => page.evaluate(READ, COWBOY_ID.source);

// The sampled privacy and seat check on the main duel DOM.
function seatProblems(r) {
  const out = [];
  if (r.own.side !== "wizard" || r.foe.side !== "cowboy") out.push(`rows are ${r.foe.side} / ${r.own.side}, not cowboy / wizard`);
  if (r.own.label !== "Your Base" || r.foe.label !== "Cowboy Base") out.push(`Base labels read "${r.own.label}" / "${r.foe.label}"`);
  for (const c of r.hand) if (TYPES[typeOf(c.id)]?.side !== "wizard" || !/\bwizard\b/.test(c.cls)) out.push(`hand card ${c.id} is not marked as a Wizard card`);
  if (r.leak) out.push(`hidden Cowboy card id ${r.leak} is in the page`);
  if (r.foe.backs !== r.foe.hand) out.push(`Cowboy hand shows ${r.foe.backs} backs for ${r.foe.hand} cards`);
  if (r.foe.traps && !/^(\d+ cards? face down|Nothing face down)$/.test(r.foe.traps)) out.push(`Cowboy traps read "${r.foe.traps}"`);
  if (!r.result && !/ · (your turn|the Cowboys' turn)$/.test(r.status)) out.push(`status "${r.status}"`);
  return out;
}

// ---- Playing through visible controls -------------------------------------------------------------------
const finished = async (page) => (await page.locator("#sd-result #sd-camp").count()) > 0;
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);

// Hand cards first: each enabled card, paying tributes with the first offered troop and aiming spells at the first
// offered target. Then each troop that can act: the Base when it is offered, else a target it defeats, else one it
// survives, else cover. keys: Enter on the first hand card and on End turn instead of clicks.
async function playTurn(page, {keys = false} = {}) {
  let keyed = false;
  const tried = new Set();
  for (;;) {
    const card = page.locator("#sd-hand [data-card]:enabled").first();
    if (!(await card.count())) break;
    const id = await card.getAttribute("data-card");
    if (tried.has(id)) break;
    tried.add(id);
    if (keys && !keyed) { await card.focus(); await page.keyboard.press("Enter"); keyed = true; } else await card.click();
    for (let t = 0; t < 4 && (await page.locator("#sd-cancel").isVisible()); t++) {
      const own = page.locator("#sd-board [data-own]:enabled"), foe = page.locator("#sd-board [data-enemy]:enabled");
      if (await own.count()) await own.first().click(); else if (await foe.count()) await foe.first().click(); else break;
    }
    if (await page.locator("#sd-cancel").isVisible()) await page.locator("#sd-cancel").click();
  }
  const acted = new Set();
  while (!(await finished(page))) {
    const slots = await page.locator("#sd-board [data-own]:enabled").evaluateAll((ns) => ns.map((n) => n.dataset.own));
    const slot = slots.find((s) => !acted.has(s));
    if (slot === undefined) break;
    acted.add(slot);
    await page.locator(`#sd-board [data-own="${slot}"]`).click();
    const targets = await page.locator("#sd-board [data-enemy]:enabled").evaluateAll((ns) => ns.map((n) => ({to: n.dataset.enemy, note: n.textContent})));
    const pick = targets.find((t) => t.to === "base") ?? targets.find((t) => /Defeated/.test(t.note))
      ?? targets.find((t) => /Survives on \d+(\.| and hits back: yours drops)/.test(t.note));
    if (pick) await page.locator(`#sd-board [data-enemy="${pick.to}"]`).click();
    else if (await page.locator("#sd-cover").isVisible()) await page.locator("#sd-cover").click();
    else if (await page.locator("#sd-cancel").isVisible()) await page.locator("#sd-cancel").click();
  }
  if (await finished(page)) return keyed;
  if (keys) { await page.locator("#sd-end").focus(); await page.keyboard.press("Enter"); return true; }
  await page.locator("#sd-end").click();
  return keyed;
}

// One Wizard duel from its opening to the result. pass: end every turn without playing (a deliberate loss).
// Returns the result status, turns played, seat problems seen at every sampled turn, and the first CPU reply.
async function playDuel(page, {pass = false, keys = false, name} = {}) {
  await page.locator("#sd-hand [data-card], #sd-result #sd-camp").first().waitFor({state: "visible"});
  const problems = new Set();
  const sample = async (at) => { const r = await read(page); for (const p of seatProblems(r)) problems.add(`${at}: ${p}`); return r; };
  let r = await sample("opening");
  if (name && !r.status.startsWith(`${name} · turn 1 · your turn`)) problems.add(`opening status "${r.status}" is not "${name} · turn 1 · your turn"`);
  let reply = null, turns = 0;
  for (; turns < MAX_TURNS && !(await finished(page)); turns++) {
    const before = r.log.length;
    if (pass) { if (keys && turns === 0) { await page.locator("#sd-end").focus(); await page.keyboard.press("Enter"); } else await page.locator("#sd-end").click(); }
    else await playTurn(page, {keys: keys && turns === 0});
    r = await sample(`turn ${turns + 1}`);
    if (reply === null) {
      const added = r.log.slice(before), c = added.findIndex((l) => /^Turn \d+: the Cowboys\.$/.test(l));
      const w = added.findIndex((l, i) => i > c && /^Turn \d+: the Wizards\.$/.test(l));
      reply = {cowboyTurn: c >= 0, events: c >= 0 && w > c ? w - c - 1 : 0, ended: Boolean(r.result)};
    }
  }
  return {status: r.status, result: r.result, turns, problems: [...problems], reply};
}

// ---- Shared steps ----------------------------------------------------------------------------------------
const toCamp = async (c) => { await c.go("./"); await c.page.locator("#menu-play").click(); await c.page.locator("#showdown-camp").waitFor({state: "visible"}); };
const campCode = (page) => page.evaluate(() => document.querySelector("#camp-code")?.value ?? null);
const campReport = (page) => page.evaluate(() => document.querySelector("#camp-report-text")?.value ?? null);
const section = (page) => page.evaluate(() => {
  const d = document.querySelector("#camp-wizard");
  return d ? {present: true, shown: !d.hidden && d.getClientRects().length > 0, open: d.open, mode: d.dataset.mode ?? null,
    summary: d.querySelector(":scope > summary")?.textContent.trim() ?? null,
    tiles: Object.fromEntries([...d.querySelectorAll("[data-wizard-duel]")].map((b) => [b.id, {state: ["won", "open", "locked"].find((s) => b.classList.contains(s)) ?? null, disabled: b.disabled, text: b.textContent.replace(/\s+/g, " ").trim()}])),
    next: document.querySelector("#wizard-next")?.textContent.replace(/\s+/g, " ").trim() ?? null} : {present: false, shown: false};
});
const focused = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || null);

// Plays a track duel from its tile until a win, using Rematch after each loss. Returns attempts and the win's text.
async function winTrackDuel(c, duel, {keys = false} = {}) {
  const tries = [];
  await c.page.locator(`#wizard-duel-${duel.id}`).click();
  for (let i = 0; i < MAX_TRIES; i++) {
    const r = await playDuel(c.page, {keys: keys && i === 0, name: duel.name});
    tries.push({status: r.status, turns: r.turns, problems: r.problems, reply: r.reply});
    if (r.status.startsWith("You win")) return {tries, won: r, after: await c.wizard()};
    if (!(await visible(c.page, "#sd-again"))) break;
    await c.page.locator("#sd-again").click();
  }
  return {tries, won: null, after: await c.wizard()};
}

function duelFailures(fail, label, result, duel) {
  for (const [i, t] of result.tries.entries()) {
    for (const p of t.problems) fail(`${label} try ${i + 1}: ${p}`);
    if (i === 0 && !(t.reply?.ended || (t.reply?.cowboyTurn && t.reply.events > 0))) fail(`${label}: no CPU Cowboy turn with events after the first End turn`);
    if (/^You win/.test(t.status) && t.status !== "You win: the Cowboy Base fell.") fail(`${label}: win reads "${t.status}"`);
    if (/^You lose/.test(t.status) && t.status !== "You lose: your Base fell.") fail(`${label}: loss reads "${t.status}"`);
  }
  if (!result.won) return fail(`${label}: no win in ${result.tries.length} tries`);
  for (const type of duel.pays) if (!result.won.result.includes(nameOf(type))) fail(`${label}: the win does not name ${nameOf(type)} ("${result.won.result.slice(0, 160)}")`);
}

// ---- Checks ------------------------------------------------------------------------------------------------
async function newCowboy(browser, base) {
  const c = await open(browser, base, {random: 11});
  const fail = [], notes = {};
  const f = (m) => fail.push(m);
  try {
    await toCamp(c);
    const fresh = await section(c.page);
    notes.freshCamp = fresh;
    if (fresh.shown) f("a new Cowboy career shows the Wizard preview in the Camp");
    // A real Boot Hill win from the Camp's first tile (the Cowboy seat), with Rematch after a loss.
    await c.page.locator("#camp-trail [data-duel]:enabled").first().click();
    let bootHill = null;
    for (let i = 0; i < MAX_TRIES && !bootHill; i++) {
      for (let t = 0; t < MAX_TURNS && !(await finished(c.page)); t++) await playTurn(c.page);
      const status = (await read(c.page)).status;
      if (status.startsWith("You win")) bootHill = {tries: i + 1, status};
      else if (await visible(c.page, "#sd-again")) await c.page.locator("#sd-again").click(); else break;
    }
    notes.bootHill = bootHill;
    if (!bootHill) throw new Error("Boot Hill was not won");
    await c.page.locator("#sd-camp").click();
    await c.page.locator("#showdown-camp").waitFor({state: "visible"});
    const unlocked = await section(c.page);
    notes.afterBootHill = unlocked;
    if (!unlocked.shown || unlocked.open || unlocked.summary !== "Wizard preview" || unlocked.mode !== "camp")
      f(`after the Boot Hill win the section is ${JSON.stringify({shown: unlocked.shown, open: unlocked.open, summary: unlocked.summary, mode: unlocked.mode})}, not a collapsed "Wizard preview" in camp mode`);
    const last = await c.page.evaluate(() => document.querySelector("#showdown-camp")?.lastElementChild?.id);
    if (last !== "camp-wizard") f(`the Camp ends with #${last}, not #camp-wizard`);
    const before = {cowboy: await c.cowboy(), code: await campCode(c.page), report: await campReport(c.page)};
    // Keyboard only: Enter on the summary opens it, Tab reaches Dry Gulch, Enter starts it.
    await c.page.locator("#camp-wizard > summary").focus();
    await c.page.keyboard.press("Enter");
    if (!(await section(c.page)).open) f("Enter on the summary did not open the section");
    let tabs = 0;
    while ((await focused(c.page)) !== "wizard-duel-dry-gulch" && tabs < 25) { await c.page.keyboard.press("Tab"); tabs++; }
    notes.tabsToDryGulch = tabs;
    if ((await focused(c.page)) !== "wizard-duel-dry-gulch") throw new Error("Tab never reached #wizard-duel-dry-gulch");
    await c.page.keyboard.press("Enter");
    const r = await playDuel(c.page, {keys: true, name: "Dry Gulch"});
    const result = {tries: [r], won: r.status.startsWith("You win") ? r : null};
    notes.dryGulch = {status: r.status, turns: r.turns, reply: r.reply};
    duelFailures(f, "Dry Gulch (keyboard)", result, TRACK[0]);
    await c.page.locator("#sd-camp").focus();
    await c.page.keyboard.press("Enter");
    const back = await section(c.page);
    notes.focusAfter = await focused(c.page);
    if (!back.open || back.mode !== "camp") f("Back to camp did not return to the open Wizard section");
    const wantFocus = result.won ? "wizard-duel-wagon-ring" : "wizard-duel-dry-gulch";
    if (notes.focusAfter !== wantFocus) f(`focus after return is ${notes.focusAfter}, not ${wantFocus}`);
    const wiz = await c.wizard();
    notes.wizard = wiz;
    if (result.won && JSON.stringify(wiz) !== JSON.stringify({v: 1, wins: 1, losses: 0})) f(`preview key after the win is ${JSON.stringify(wiz)}`);
    const after = {cowboy: await c.cowboy(), code: await campCode(c.page), report: await campReport(c.page)};
    for (const k of ["cowboy", "code", "report"]) if (k === "cowboy" ? !same(after[k], before[k]) : after[k] !== before[k]) f(`Cowboy ${k} changed across the Wizard duel`);
    await c.page.reload();
    await toCamp(c);
    if (JSON.stringify(await c.wizard()) !== JSON.stringify(wiz)) f("preview key changed across a reload");
    const tiles = (await section(c.page)).tiles;
    notes.tilesAfterReload = tiles;
    if (result.won && (tiles["wizard-duel-dry-gulch"]?.state !== "won" || tiles["wizard-duel-wagon-ring"]?.state !== "open")) f("after a reload Dry Gulch is not won or Wagon Ring is not open");
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  return finish("new-cowboy", c, fail, notes);
}

async function direct(browser, base) {
  const planted = career();
  const c = await open(browser, base, {planted, random: 22});
  const fail = [], notes = {};
  const f = (m) => fail.push(m);
  try {
    await c.go("./?wizard=1");
    await c.page.locator("#camp-wizard").waitFor({state: "visible"});
    const landing = await section(c.page);
    notes.landing = {...landing, header: await visible(c.page, "#wizard-direct"), cowboyParts: await visible(c.page, "#camp-trail")};
    if (landing.mode !== "direct" || !notes.landing.header) f("?wizard=1 did not land on the direct preview");
    if (notes.landing.cowboyParts) f("the direct preview shows the Cowboy Trail");
    if (!same(await c.storage(), planted)) f(`a direct ?wizard=1 visit changed storage before any duel: ${diff(planted, await c.storage())}`);
    const won = await winTrackDuel(c, TRACK[0]);
    notes.dryGulch = won.tries.map((t) => ({status: t.status, turns: t.turns}));
    duelFailures(f, "Dry Gulch (direct)", won, TRACK[0]);
    await c.page.locator("#sd-camp").click();
    const back = await section(c.page);
    if (back.mode !== "direct" || !(await visible(c.page, "#wizard-direct"))) f("Back to camp did not return to the direct preview");
    if (await visible(c.page, "#camp-trail")) f("Back to camp opened the Cowboy Camp without the player asking");
    const stored = await c.storage();
    notes.keys = Object.keys(stored);
    if (!same(await c.cowboy(), planted)) f(`Cowboy keys are not byte-identical after the direct win: ${diff(planted, await c.cowboy())}`);
    await c.page.reload();
    await c.page.locator("#camp-wizard").waitFor({state: "visible"});
    if (JSON.stringify(await c.wizard()) !== JSON.stringify(won.after)) f("preview key changed across a reload");
    if ((await section(c.page)).tiles["wizard-duel-dry-gulch"]?.state !== (won.won ? "won" : "open")) f("after a reload the Dry Gulch tile does not show the stored result");
    // The explicit way to the Cowboy Camp, then the Cowboy view of the same career.
    await c.page.locator("#wizard-to-camp").click();
    await c.page.locator("#camp-trail").waitFor({state: "visible"});
    const save = JSON.parse((await c.storage())[SAVE_KEY]);
    notes.cowboyCamp = {offer: save.offer, packs: save.packs};
    if (!same(await c.cowboy(), planted)) f("Cowboy keys changed on entering the Cowboy Camp");
    if (await campCode(c.page) !== codeOf(planted[SAVE_KEY])) f("the Camp save code differs from the planted save's code");
    if (!(await campReport(c.page))?.includes("Boot Hill")) f("the Camp playtest report lost the planted row");
    if (!(await visible(c.page, "#camp-claim button"))) f("the pending offer is not shown in the Camp");
    const inCamp = await section(c.page);
    notes.inCowboyCamp = {mode: inCamp.mode, open: inCamp.open, tiles: inCamp.tiles["wizard-duel-dry-gulch"]};
    if (!inCamp.shown || inCamp.mode !== "camp") f(`in the Cowboy Camp the section is ${JSON.stringify({shown: inCamp.shown, mode: inCamp.mode})}`);
    if (won.won && inCamp.tiles["wizard-duel-dry-gulch"]?.state !== "won") f("the Cowboy Camp's Wizard section does not show the direct win");
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  return finish("direct", c, fail, notes);
}

async function camp(browser, base) {
  const planted = career();
  const c = await open(browser, base, {planted, random: 33});
  const fail = [], notes = {};
  const f = (m) => fail.push(m);
  try {
    await toCamp(c);
    const before = {cowboy: await c.cowboy(), code: await campCode(c.page), report: await campReport(c.page)};
    if (before.code !== codeOf(planted[SAVE_KEY])) f("the Camp save code differs from the planted save's code");
    const s = await section(c.page);
    if (!s.shown || s.open) f("an already-won career does not show a collapsed Wizard preview");
    await c.page.locator("#camp-wizard > summary").click();
    await c.page.locator("#wizard-duel-dry-gulch").click();
    await c.page.locator("#sd-hand [data-card]").first().waitFor({state: "visible"});
    // Turn 1 by the policy (a free troop arrives), then on the next Wizard turn Enter on that troop starts a pick
    // and Escape cancels it: focus must return to the troop that opened it.
    await playTurn(c.page);
    const slot = await c.page.locator("#sd-board [data-own]:enabled").first().getAttribute("data-slot").catch(() => null);
    if (slot) {
      await c.page.locator(`#sd-board [data-slot="${slot}"]`).focus();
      await c.page.keyboard.press("Enter");
      const picked = await c.page.locator("#sd-cancel").isVisible();
      await c.page.keyboard.press("Escape");
      notes.escape = {slot, picked, cancelled: !(await c.page.locator("#sd-cancel").isVisible()),
        focus: await c.page.evaluate(() => document.activeElement?.dataset?.slot ?? document.activeElement?.id ?? null)};
      if (!picked || !notes.escape.cancelled || notes.escape.focus !== slot) f(`Enter then Escape on ${slot}: ${JSON.stringify(notes.escape)}`);
    } else f("no Wizard troop could act on turn 3 to test Escape");
    // Restart: the same deal from turn 1, still the Wizard seat.
    await c.page.locator("#sd-restart").click();
    const restarted = await read(c.page);
    notes.restart = restarted.status;
    if (!restarted.status.startsWith("Dry Gulch · turn 1 · your turn")) f(`after Restart the status is "${restarted.status}"`);
    for (const p of seatProblems(restarted)) f(`after Restart: ${p}`);
    // A deliberate loss: End turn every turn, the first by keyboard.
    const lost = await playDuel(c.page, {pass: true, keys: true, name: "Dry Gulch"});
    notes.loss = {status: lost.status, turns: lost.turns, reply: lost.reply};
    for (const p of lost.problems) f(`loss: ${p}`);
    if (lost.status !== "You lose: your Base fell.") f(`the loss reads "${lost.status}"`);
    if (JSON.stringify(await c.wizard()) !== JSON.stringify({v: 1, wins: 0, losses: 1})) f(`preview key after the loss is ${JSON.stringify(await c.wizard())}`);
    if (!/Grit: your Base starts the rematch with 6 orbs\./.test(lost.result)) f("the loss does not show 6-orb grit");
    if ((await c.page.locator("#sd-again").textContent())?.trim() !== "Rematch") f("the loss offers no Rematch");
    await c.page.locator("#sd-again").click();
    await c.page.locator("#sd-hand [data-card]").first().waitFor({state: "visible"});
    const rematch = await read(c.page);
    notes.rematch = {status: rematch.status, orbs: rematch.own.orbs};
    if (rematch.own.orbs !== "6 of 6 orbs") f(`the Rematch Wizard Base reads "${rematch.own.orbs}"`);
    await c.page.locator("#sd-home").click();
    notes.focusAfter = await focused(c.page);
    if (!(await section(c.page)).open || notes.focusAfter !== "wizard-duel-dry-gulch") f(`Back to camp: section open ${(await section(c.page)).open}, focus ${notes.focusAfter}`);
    // Start preview over: dismissed changes nothing; accepted clears only the preview.
    const asked = [];
    c.page.once("dialog", (d) => { asked.push(d.message()); d.dismiss(); });
    await c.page.locator("#wizard-reset").click();
    if (JSON.stringify(await c.wizard()) !== JSON.stringify({v: 1, wins: 0, losses: 1})) f("a dismissed Start preview over changed the preview key");
    c.page.once("dialog", (d) => { asked.push(d.message()); d.accept(); });
    await c.page.locator("#wizard-reset").click();
    notes.reset = {asked, note: await c.page.locator("#wizard-reset-note").textContent(), key: await c.wizard()};
    if (asked.length !== 2) f(`Start preview over asked ${asked.length} times for 2 presses`);
    if (JSON.stringify(notes.reset.key) !== JSON.stringify({v: 1, wins: 0, losses: 0})) f(`after Start preview over the key is ${JSON.stringify(notes.reset.key)}`);
    const after = {cowboy: await c.cowboy(), code: await campCode(c.page), report: await campReport(c.page)};
    for (const k of ["cowboy", "code", "report"]) if (k === "cowboy" ? !same(after[k], before[k]) : after[k] !== before[k]) f(`Cowboy ${k} changed across Wizard play and reset`);
    // Cowboy Start over (accepted) leaves the preview alone.
    await c.page.locator("#camp-save > summary").click();
    c.page.once("dialog", (d) => d.accept());
    await c.page.locator("#camp-reset").click();
    if (JSON.stringify(await c.wizard()) !== JSON.stringify({v: 1, wins: 0, losses: 0})) f("Cowboy Start over changed the preview key");
    notes.afterCowboyReset = {cowboySaveChanged: (await c.storage())[SAVE_KEY] !== planted[SAVE_KEY], section: (await section(c.page)).shown};
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  return finish("camp", c, fail, notes);
}

async function track(browser, base) {
  const planted = career();
  const c = await open(browser, base, {planted, random: 44});
  const fail = [], notes = {duels: []};
  const f = (m) => fail.push(m);
  try {
    await toCamp(c);
    const before = {cowboy: await c.cowboy(), code: await campCode(c.page), report: await campReport(c.page)};
    await c.page.locator("#camp-wizard > summary").click();
    for (const [i, duel] of TRACK.entries()) {
      const tiles = (await section(c.page)).tiles;
      if (tiles[`wizard-duel-${duel.id}`]?.state !== "open" || tiles[`wizard-duel-${duel.id}`]?.disabled) f(`${duel.name} is not the open tile before win ${i + 1}`);
      if (!tiles[`wizard-duel-${duel.id}`]?.text.includes(duel.name)) f(`the ${duel.id} tile does not read ${duel.name}`);
      if (!tiles["wizard-duel-open"]?.disabled) f(`${OPEN_RANGE} is startable before the track is won`);
      const won = await winTrackDuel(c, duel);
      notes.duels.push({name: duel.name, tries: won.tries.length, results: won.tries.map((t) => `${t.status} (${t.turns} turns)`), key: won.after});
      duelFailures(f, duel.name, won, duel);
      if (!won.won) break;
      if (JSON.stringify(won.after) !== JSON.stringify({v: 1, wins: i + 1, losses: 0})) f(`after ${duel.name} the key is ${JSON.stringify(won.after)}`);
      if (await visible(c.page, "#sd-again")) f(`a won ${duel.name} offers a repeat`);
      await c.page.locator("#sd-camp").click();
      const want = i < 3 ? `wizard-duel-${TRACK[i + 1].id}` : "wizard-duel-open";
      const at = await focused(c.page);
      if (at !== want) f(`after ${duel.name} focus is ${at}, not ${want}`);
    }
    const end = await section(c.page);
    notes.completion = {next: end.next, tiles: end.tiles};
    if (notes.duels.length === 4 && notes.duels.every((d, i) => d.key?.wins === i + 1)) {
      for (const d of TRACK) if (end.tiles[`wizard-duel-${d.id}`]?.state !== "won" || !end.tiles[`wizard-duel-${d.id}`]?.disabled) f(`${d.name} is not shown won and closed after the track`);
      const openTile = end.tiles["wizard-duel-open"];
      if (!openTile || openTile.disabled || !openTile.text.includes(OPEN_RANGE)) f(`${OPEN_RANGE} did not open after High Noon (${JSON.stringify(openTile)})`);
      const keyBefore = await c.wizard();
      await c.page.locator("#wizard-duel-open").click();
      const r = await playDuel(c.page, {name: OPEN_RANGE});
      notes.openRange = {status: r.status, turns: r.turns};
      for (const p of r.problems.filter((p) => !/opening status/.test(p))) f(`${OPEN_RANGE}: ${p}`);
      if (!/^You (win: the Cowboy Base fell|lose: your Base fell)\.$|^Draw\.$/.test(r.status)) f(`${OPEN_RANGE} ended "${r.status}"`);
      if (JSON.stringify(await c.wizard()) !== JSON.stringify(keyBefore)) f(`${OPEN_RANGE} changed the preview key`);
      await c.page.locator("#sd-camp").click();
    }
    const after = {cowboy: await c.cowboy(), code: await campCode(c.page), report: await campReport(c.page)};
    for (const k of ["cowboy", "code", "report"]) if (k === "cowboy" ? !same(after[k], before[k]) : after[k] !== before[k]) f(`Cowboy ${k} changed across the whole track`);
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  return finish("track", c, fail, notes);
}

async function routes(browser, base, {graybox}) {
  const planted = career();
  const c = await open(browser, base, {planted, random: 55});
  const fail = [], notes = {rows: []};
  const f = (m) => fail.push(m);
  // Each query and what must open: "wizard" (the direct preview), a status prefix, or "title".
  const table = [
    ["./?wizard=1", "wizard"],
    ...(graybox ? [["/graybox/?wizard=1", "wizard"]] : []),
    ["./?practice=0&wizard=1", "Practice: Boot Hill"], ["./?wizard=1&practice=0", "Practice: Boot Hill"],
    ["./?turn=dragon-c5&wizard=1", "Experiment: one Dragon turn"],
    ["./?outrider=case-e&wizard=1", "not-wizard"],
    ["./?turn=nope&wizard=1", "not-wizard"], ["./?outrider=nope&wizard=1", "not-wizard"], ["./?practice=7&wizard=1", "not-wizard"],
    ["./?wizard=2", "title"], ["./?wizard=1&wizard=1", "title"], ["./?wizard", "title"], ["./?wizard=true", "title"],
  ];
  try {
    for (const [q, want] of table) {
      await c.go(q);
      await c.page.waitForTimeout(150);
      const s = await section(c.page);
      const shown = {title: await visible(c.page, "#title-screen"), duel: await visible(c.page, "#showdown"), direct: await visible(c.page, "#wizard-direct")};
      const status = shown.duel ? (await read(c.page)).status : "";
      const wizardOpen = shown.direct || (s.shown && s.mode === "direct") || (shown.duel && (await read(c.page)).own.side === "wizard");
      const ok = want === "wizard" ? shown.direct && s.mode === "direct" : want === "title" ? shown.title && !wizardOpen
        : want === "not-wizard" ? !wizardOpen : !wizardOpen && status.startsWith(want);
      notes.rows.push({query: q, want, opened: wizardOpen ? "wizard" : shown.duel ? status : shown.title ? "title" : "other", ok});
      if (!ok) f(`${q}: wanted ${want}, got ${notes.rows.at(-1).opened}`);
    }
    if (!same(await c.storage(), planted)) f(`route probes changed storage: ${diff(planted, await c.storage())}`);
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  // A first-time direct visit: nothing is written at all.
  const first = await open(browser, base, {random: 56});
  try {
    await first.go("./?wizard=1");
    await first.page.waitForTimeout(200);
    notes.firstVisit = {keys: Object.keys(await first.storage()), section: await section(first.page)};
    if (notes.firstVisit.keys.length) f(`a first-time ?wizard=1 visit wrote ${notes.firstVisit.keys.join(", ")}`);
  } catch (e) { f(`first visit threw: ${e.message.split("\n")[0]}`); }
  finally { await first.ctx.close(); }
  c.errors.push(...first.errors); c.remote.push(...first.remote);
  return finish("routes", c, fail, notes);
}

function finish(name, c, fail, notes) {
  if (c.errors.length) fail.push(`page errors: ${c.errors[0]}`);
  if (c.remote.length) fail.push(`request left the page's origin: ${c.remote[0]}`);
  return {check: name, pass: fail.length === 0, failures: fail, notes};
}

// ---- CLI -------------------------------------------------------------------------------------------------
const CHECKS = {"new-cowboy": newCowboy, direct, camp, track, routes};

async function main(argv) {
  if (argv.includes("--help") || !argv.length) { console.log(USAGE); return 0; }
  const opt = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
  const file = opt("--page"), url = opt("--url"), out = opt("--out");
  const only = opt("--only")?.split(",") ?? Object.keys(CHECKS);
  const bad = (msg) => { console.error(`${msg}\n${USAGE}`); return 2; };
  if (Boolean(file) === Boolean(url)) return bad("pass exactly one of --page or --url");
  if (only.some((n) => !CHECKS[n])) return bad(`--only takes ${Object.keys(CHECKS).join(",")}`);
  let target, server = null;
  if (file) {
    const html = await readFile(file);
    if (!html.toString("utf8").includes('id="menu-play"')) return bad(`${file} is not the graybox page (no #menu-play); run node scripts/build-graybox.mjs --hosted`);
    server = await serve(html);
    target = {base: server.base, page: {file: path.relative(root, path.resolve(file)), bytes: html.length, sha256: sha256(html)}, graybox: true};
  } else {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return bad("--url must be http or https");
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    u.search = ""; u.hash = "";
    target = {base: u.href, page: {url: u.href}, graybox: false};
  }
  const {chromium} = loadPlaywright();
  const browser = await chromium.launch({executablePath: CHROME, headless: true});
  const results = [];
  try {
    for (const name of only) {
      const started = Date.now();
      const r = await CHECKS[name](browser, target.base, {graybox: target.graybox});
      r.seconds = Math.round((Date.now() - started) / 1000);
      results.push(r);
      console.log(`${r.pass ? "PASS" : "FAIL"} ${name} (${r.seconds} s)`);
      for (const m of r.failures) console.log(`  - ${m}`);
    }
  } finally { await browser.close(); await server?.close(); }
  const report = {schema: "showdown-wizard-check/2", revision: git("rev-parse", "HEAD"), chrome: browser.version(), target: target.page,
    checks: results, pass: results.every((r) => r.pass),
    note: "Scripted headless Chrome with a fixed Math.random and reduced motion. No human played; nothing here is about clarity or fun."};
  if (out) { await mkdir(path.dirname(path.resolve(out)), {recursive: true}); await writeFile(path.resolve(out), JSON.stringify(report, null, 2) + "\n"); }
  console.log(`wizard preview check: ${report.pass ? "PASS" : "FAIL"} · revision ${String(report.revision).slice(0, 12)} · ${target.page.sha256 ? `html sha256 ${target.page.sha256.slice(0, 16)}` : target.page.url}`);
  return report.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
