// Board zones QA baseline (Kiro CLI test worker "board-replay"): golden normal routes in real headless Chrome
// that exercise the public graveyard, hand, deck and face-down trap zones of the current graybox, for Fable's
// pending table UI. QA only: it changes no src/ file, patches no game state and plays only legal actions through
// the page's own buttons. Same loopback server, playwright-core and installed Chrome as
// scripts/browser-showdown-wizard-check.mjs.
//
//   node scripts/build-graybox.mjs --hosted
//   npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-board-zones.mjs --page dist/web/index.html [--out R.json] [--only raise,raise-narrow,trap]
//
// Each route runs in a fresh context with reduced motion, a planted synthetic save for both seats (Cowboy career
// plus the Wizard preview key) and a fixed Math.random sequence (test-only init script). The deal comes from the
// page's own freshSeed(); the script scans Math.random start values in order and takes the first deal that holds
// the cards a route needs, so the chosen value is reproducible and printed in the receipt.
//   raise         ?wizard=1, Dry Gulch, 1280x900: summon a Skeleton, End turn, then pay for a Wizard with that
//                 Skeleton. The Skeleton must be back on the board with 1 orb, the Wizards' graveyard must not list
//                 it, and the log must show the tribute and the Raise. Restart, then both saves byte-identical.
//   raise-narrow  the same route at 360x740: no horizontal page overflow and every control the route presses is
//                 the topmost element at its centre (a real pointer click).
//   trap          Two players, one screen: the Cowboy seat sets its Bear Trap and sees it named as its own; on the
//                 Wizard seat it is only "1 card face down" and neither its name nor its instance id is in the page;
//                 a Wizard attack springs it; then it is named in the public Cowboy graveyard. Every curtain holds
//                 no hand, board or card instance id of either seat. Restart, then both saves byte-identical.
// The receipt also lists HOOKS: zone selectors Fable's table UI may add. They are reported as present or absent
// and never fail a run until they are agreed (see docs/evidence/devpost-lift-board-replay.md).
// Scripted Chrome: no human played. It says nothing about clarity or fun.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {newSave, settle} from "../src/game/showdown/progress.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {TYPES} from "../src/game/showdown/cards.js";
import {PLAYTEST_KEY} from "../src/match/showdown-playtest.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIZARD_KEY = "cvw-showdown-wizard-preview-v1";
const SCAN = 400, MAX_TURNS = 40;
const USAGE = `usage: node scripts/browser-showdown-board-zones.mjs --page FILE.html [--out REPORT.json] [--only raise,raise-narrow,trap]
Exit 0 when every route passes, 1 on a failed route, 2 on bad arguments.`;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (...args) => { try { return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch { return null; } };
const idsOf = (side) => Object.keys(TYPES).filter((t) => TYPES[t].side === side).join("|");
// Card instance ids ("cowboy-bear-trap-1"): hidden data that must never be written for the other seat or a curtain.
const ID = {cowboy: `\\b(?:${idsOf("cowboy")})-\\d+\\b`, wizard: `\\b(?:${idsOf("wizard")})-\\d+\\b`};

// Synthetic saves (nobody's data): a Cowboy career with Boot Hill won, 2 packs and one playtest row, plus a Wizard
// preview record. Both must survive every route byte for byte.
function planted() {
  const save = {...settle(newSave(), "trail", true).save, packs: 2};
  return {[SAVE_KEY]: JSON.stringify(save), [WIZARD_KEY]: JSON.stringify({v: 1, wins: 0, losses: 0}),
    [PLAYTEST_KEY]: JSON.stringify([{name: "Boot Hill", won: true, turns: 9, seconds: 71, rules: false}])};
}
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).join(", ");

function loadPlaywright() {
  const tryFrom = (base) => { try { return createRequire(base)("playwright-core"); } catch { return null; } };
  const local = tryFrom(path.join(root, "package.json"));
  if (local) return local;
  const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
  const found = bin && tryFrom(pathToFileURL(path.join(bin, "..", "x.js")));
  if (found) return found;
  throw new Error("playwright-core not found. Run as: npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-board-zones.mjs ...");
}

async function serve(html) {
  const server = createServer((req, res) => {
    const {pathname} = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && ["/", "/index.html"].includes(pathname)) {
      res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}); res.end(html); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {base: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((ok) => server.close(ok))};
}

async function open(browser, base, {random, viewport = {width: 1280, height: 900}}) {
  const ctx = await browser.newContext({viewport, reducedMotion: "reduce"});
  const seed = planted();
  await ctx.addInitScript(({seed, random}) => {
    let s = random >>> 0; // mulberry32, as in browser-showdown-wizard-check.mjs
    Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    if (!sessionStorage.getItem("qa-planted")) {
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      sessionStorage.setItem("qa-planted", "1");
    }
  }, {seed, random});
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [], remote = [], origin = new URL(base).origin;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await ctx.route("**/*", (r) => {
    const url = r.request().url();
    if (url.startsWith(origin + "/") || /^(data:|blob:|about:)/.test(url)) return r.continue();
    remote.push(url); return r.abort();
  });
  const storage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  return {ctx, page, errors, remote, planted: seed, storage, go: (rel) => page.goto(new URL(rel, base).href)};
}

// ---- DOM reads -----------------------------------------------------------------------------------------
// One read of the duel: both rows (opponent first, viewer last), the hand, both graveyard lines and the log.
const READ = (ID) => {
  const rows = [...document.querySelectorAll("#sd-board .sd-side")];
  const side = (row) => {
    const name = row?.dataset.side, base = row?.querySelector(`[data-base="${name}"]`);
    const counts = base?.textContent.match(/Hand (\d+) · Deck (\d+) · Graveyard (\d+)/);
    return {side: name ?? null, hand: counts ? Number(counts[1]) : null, deck: counts ? Number(counts[2]) : null, grave: counts ? Number(counts[3]) : null,
      backs: base?.querySelectorAll(".sd-backs .card-back").length ?? 0, traps: base?.textContent.match(/▲ ([^\n]*)/)?.[1].trim() ?? null,
      slots: [...(row?.querySelectorAll("[data-slot]") ?? [])].map((n) => ({slot: n.dataset.slot, name: n.querySelector("strong")?.textContent.trim() ?? null,
        orbs: n.querySelector(".sd-orbs")?.getAttribute("aria-label") ?? null, text: n.textContent.replace(/\s+/g, " ").trim()}))};
  };
  const html = document.querySelector("#showdown")?.outerHTML ?? "";
  return {status: document.querySelector("#sd-status")?.textContent.trim() ?? "", own: side(rows.at(-1)), foe: side(rows[0]),
    hand: [...document.querySelectorAll("#sd-hand [data-card]")].map((n) => n.dataset.card),
    graveyard: {cowboy: document.querySelector("#sd-cowboy-graveyard")?.textContent ?? null, wizard: document.querySelector("#sd-wizard-graveyard")?.textContent ?? null},
    log: [...document.querySelectorAll("#sd-log li")].map((n) => n.textContent.trim()),
    text: document.querySelector("#showdown")?.innerText ?? "",
    ids: {cowboy: html.match(new RegExp(ID.cowboy, "g")) ?? [], wizard: html.match(new RegExp(ID.wizard, "g")) ?? []},
    curtain: Boolean(document.querySelector("#sd-curtain") && !document.querySelector("#sd-curtain").hidden)};
};
const read = (page) => page.evaluate(READ, ID);

// Zone selectors the table UI may add. Reported only; not agreed yet, so absence never fails.
const HOOKS = [
  "[data-zone=\"graveyard\"][data-side=\"cowboy\"]", "[data-zone=\"graveyard\"][data-side=\"wizard\"]",
  "[data-zone=\"deck\"][data-side]", "[data-zone=\"hand\"][data-side]", "[data-zone=\"traps\"][data-side]",
];
const hooks = (page) => page.evaluate((list) => Object.fromEntries(list.map((s) => [s, document.querySelectorAll(s).length])), HOOKS);

// A real pointer click that first proves the control is the topmost element at its centre (narrow layouts).
async function press(page, selector, problems) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  const hit = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return {ok: Boolean(top && (top === el || el.contains(top))), w: Math.round(r.width), h: Math.round(r.height)};
  });
  if (!hit.ok) problems.push(`${selector} is covered at its centre`);
  if (hit.w < 24 || hit.h < 24) problems.push(`${selector} is ${hit.w}x${hit.h} px`);
  await loc.click();
}

// Privacy for the seat on screen: the other seat's hand is backs only and none of its instance ids is in the page.
function seatProblems(r, viewer, at) {
  const other = viewer === "cowboy" ? "wizard" : "cowboy", out = [];
  if (r.own.side !== viewer) out.push(`${at}: viewer row is ${r.own.side}, not ${viewer}`);
  if (r.ids[other].length) out.push(`${at}: hidden ${other} id ${r.ids[other][0]} in the page`);
  if (r.foe.backs !== r.foe.hand) out.push(`${at}: ${other} hand shows ${r.foe.backs} backs for ${r.foe.hand} cards`);
  if (r.foe.traps && !/^(\d+ cards? face down|Nothing face down)$/.test(r.foe.traps)) out.push(`${at}: ${other} traps read "${r.foe.traps}"`);
  for (const s of ["cowboy", "wizard"]) if (/-\d+\b/.test(r.graveyard[s] ?? "")) out.push(`${at}: ${s} graveyard line carries an id: "${r.graveyard[s]}"`);
  return out;
}

// ---- Routes ---------------------------------------------------------------------------------------------
// Scans Math.random start values from 1 and returns the first opened context whose deal passes want(read).
async function scan(browser, base, opts, enter, want) {
  for (let random = 1; random <= SCAN; random++) {
    const c = await open(browser, base, {...opts, random});
    try {
      await enter(c);
      const r = await read(c.page);
      if (want(r)) return {c, random, tried: random};
    } catch (e) { await c.ctx.close(); throw e; }
    await c.ctx.close();
  }
  return {c: null, random: null, tried: SCAN};
}

async function raise(browser, base, {viewport = {width: 1280, height: 900}, name = "raise"} = {}) {
  const fail = [], notes = {viewport};
  const f = (m) => fail.push(m);
  const enter = async (c) => {
    await c.go("./?wizard=1");
    await c.page.locator("#wizard-duel-dry-gulch").click();
    await c.page.locator("#sd-hand [data-card]").first().waitFor({state: "visible"});
  };
  // The route needs a Skeleton and a Wizard in the opening hand of the Wizard seat (the Wizards open Dry Gulch).
  const {c, random, tried} = await scan(browser, base, {viewport}, enter,
    (r) => r.hand.some((id) => id.startsWith("wizard-skeleton-")) && r.hand.some((id) => id.startsWith("wizard-wizard-")) && /turn 1 · your turn$/.test(r.status));
  notes.random = random; notes.scanned = tried;
  if (!c) return {route: name, pass: false, failures: [`no deal in ${tried} values holds a Skeleton and a Wizard`], notes};
  try {
    const {page} = c;
    let r = await read(page);
    notes.opening = {status: r.status, hand: r.hand, foe: {hand: r.foe.hand, deck: r.foe.deck}};
    fail.push(...seatProblems(r, "wizard", "opening"));
    if (viewport.width < 600) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      notes.overflowPx = overflow;
      if (overflow > 1) f(`page is ${overflow} px wider than the ${viewport.width} px viewport`);
    }
    const skeleton = r.hand.find((id) => id.startsWith("wizard-skeleton-")), wizard = r.hand.find((id) => id.startsWith("wizard-wizard-"));
    notes.cards = {skeleton, wizard};
    await press(page, `#sd-hand [data-card="${skeleton}"]`, fail);
    r = await read(page);
    const slot = r.own.slots.find((s) => s.name === TYPES["wizard-skeleton"].name)?.slot;
    if (!slot) throw new Error(`the Skeleton did not arrive: ${JSON.stringify(r.own.slots)}`);
    notes.afterSummon = {slot, hand: r.own.hand, grave: r.own.grave, graveyard: r.graveyard.wizard};
    await press(page, "#sd-end", fail);
    await page.waitForFunction(() => /turn 3 · your turn$/.test(document.querySelector("#sd-status")?.textContent.trim() ?? "") || document.querySelector("#sd-result #sd-camp"));
    r = await read(page);
    fail.push(...seatProblems(r, "wizard", "turn 3"));
    if (!r.own.slots.some((s) => s.slot === slot && s.name === TYPES["wizard-skeleton"].name)) throw new Error(`the Skeleton did not survive the Cowboy turn: ${JSON.stringify(r.own.slots)}`);
    if (!r.hand.includes(wizard)) throw new Error(`${wizard} left the hand`);
    const before = {grave: r.own.grave, log: r.log.length, deck: r.own.deck};
    // Pay for the Wizard with the Skeleton: the hand card, then the Skeleton's slot as the tribute.
    await press(page, `#sd-hand [data-card="${wizard}"]`, fail);
    const tributeSlot = await page.locator(`#sd-board [data-slot="${slot}"]`).getAttribute("data-own");
    if (tributeSlot === null) throw new Error("the Skeleton is not offered as the tribute");
    await press(page, `#sd-board [data-slot="${slot}"]`, fail);
    if (await page.locator("#sd-cancel").isVisible()) throw new Error("the tribute pick is still open after choosing the Skeleton");
    r = await read(page);
    const added = r.log.slice(before.log);
    const names = r.own.slots.map((s) => s.name);
    const skel = r.own.slots.find((s) => s.name === TYPES["wizard-skeleton"].name);
    notes.afterRaise = {slots: r.own.slots, grave: r.own.grave, graveyard: r.graveyard.wizard, added};
    if (!names.includes(TYPES["wizard-wizard"].name)) f(`no Wizard on the board: ${names}`);
    if (!skel) f("the Skeleton is not back on the board");
    else if (!/^1 of \d+ orbs$/.test(skel.orbs ?? "")) f(`the raised Skeleton reads "${skel.orbs}", not 1 orb`);
    if (r.own.grave !== before.grave) f(`Wizards graveyard count went ${before.grave} -> ${r.own.grave}; the tribute lingered`);
    if (/Skeleton/.test(r.graveyard.wizard ?? "")) f(`the Wizards graveyard still lists the Skeleton: "${r.graveyard.wizard}"`);
    if (!added.some((l) => /Skeleton was paid as tribute\./.test(l))) f(`no tribute line: ${JSON.stringify(added)}`);
    if (!added.some((l) => /^Raise: .*Skeleton returned from the graveyard with 1 orb\.$/.test(l))) f(`no Raise line: ${JSON.stringify(added)}`);
    if (r.hand.includes(wizard)) f("the Wizard is still in the hand");
    if (r.own.deck !== before.deck) f(`the Wizard deck count changed ${before.deck} -> ${r.own.deck}`);
    fail.push(...seatProblems(r, "wizard", "after Raise"));
    notes.hooks = await hooks(page);
    // Restart deals the same opening; nothing is written for either seat.
    await press(page, "#sd-restart", fail);
    r = await read(page);
    notes.restart = {status: r.status, hand: r.hand};
    if (!/turn 1 · your turn$/.test(r.status) || JSON.stringify(r.hand) !== JSON.stringify(notes.opening.hand)) f(`Restart opened "${r.status}" with ${r.hand}`);
    const stored = await c.storage();
    if (diff(stored, c.planted)) f(`saves changed: ${diff(stored, c.planted)}`);
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  return finish(name, c, fail, notes);
}

async function trap(browser, base) {
  const fail = [], notes = {curtains: 0, turns: []};
  const f = (m) => fail.push(m);
  const TRAP = "cowboy-bear-trap-1", NAME = TYPES["cowboy-bear-trap"].name;
  const enter = async (c) => {
    await c.go("./");
    await c.page.locator("#menu-play").click();
    await c.page.locator("#showdown-camp [data-two=\"1\"]").click();
    await c.page.locator("#sd-ready").waitFor({state: "visible"});
  };
  // Curtain first; the deal is usable when the Cowboy seat holds the Bear Trap in its opening hand. The hand is
  // read after passing the first curtain, so scan reads the first seat's screen.
  const pass = async (page) => { await page.locator("#sd-ready").click(); await page.locator("#sd-table").waitFor({state: "visible"}); };
  const {c, random, tried} = await scan(browser, base, {}, async (c) => { await enter(c); await pass(c.page); },
    (r) => r.own.side === "cowboy" && r.hand.includes(TRAP));
  notes.random = random; notes.scanned = tried;
  if (!c) return {route: "trap", pass: false, failures: [`no deal in ${tried} values opens on the Cowboys with ${TRAP} in hand`], notes};
  try {
    const {page} = c;
    const curtain = async (at) => {
      const r = await read(page);
      notes.curtains++;
      const shown = await page.evaluate(() => ({table: !document.querySelector("#sd-table").hidden, hand: document.querySelectorAll("#sd-hand [data-card]").length,
        board: document.querySelectorAll("#sd-board [data-slot]").length}));
      if (shown.table || shown.hand || shown.board) f(`${at}: curtain leaves ${JSON.stringify(shown)}`);
      if (r.ids.cowboy.length || r.ids.wizard.length) f(`${at}: card ids behind the curtain: ${[...r.ids.cowboy, ...r.ids.wizard].slice(0, 3)}`);
    };
    let r = await read(page), set = false, sprung = null;
    for (let t = 0; t < MAX_TURNS && !sprung; t++) {
      if (r.curtain) { await curtain(`curtain ${notes.curtains + 1}`); await pass(page); r = await read(page); }
      const seat = r.own.side;
      fail.push(...seatProblems(r, seat, `turn ${t + 1} (${seat})`));
      if (seat === "cowboy") {
        if (!set && r.hand.includes(TRAP)) {
          await page.locator(`#sd-hand [data-card="${TRAP}"]`).click();
          r = await read(page);
          set = true;
          notes.set = {traps: r.own.traps, log: r.log.at(-1), hand: r.hand.includes(TRAP)};
          if (r.own.traps !== `Set: ${NAME}`) f(`own trap line reads "${r.own.traps}", not "Set: ${NAME}"`);
          if (r.hand.includes(TRAP)) f("the Bear Trap is still in the hand after setting it");
          if (r.log.at(-1) !== "The Cowboys set a card face down.") f(`set line "${r.log.at(-1)}"`);
        }
      } else {
        if (set) {
          // The opponent seat: count only, never the name or id, anywhere on the duel screen.
          if (r.foe.traps !== "1 card face down") f(`Wizard seat sees Cowboy traps as "${r.foe.traps}"`);
          if (r.text.includes(NAME)) f(`Wizard seat page text names the ${NAME} while it is face down`);
          // Attack with the first troop that can: the Base when offered, else the first target.
          const ready = await page.locator("#sd-board [data-own]:enabled").evaluateAll((ns) => ns.map((n) => n.dataset.own));
          for (const slot of ready) {
            await page.locator(`#sd-board [data-own="${slot}"]`).click();
            const targets = await page.locator("#sd-board [data-enemy]:enabled").evaluateAll((ns) => ns.map((n) => n.dataset.enemy));
            if (!targets.length) { if (await page.locator("#sd-cancel").isVisible()) await page.locator("#sd-cancel").click(); continue; }
            const before = (await read(page)).log.length;
            await page.locator(`#sd-board [data-enemy="${targets.includes("base") ? "base" : targets[0]}"]`).click();
            r = await read(page);
            const line = r.log.slice(before).find((l) => /^Trap! /.test(l));
            if (line) { sprung = {turn: t + 1, line, attacker: slot}; break; }
          }
        }
        // Free troops so a Wizard can attack on a later turn (it rests the turn it arrives).
        for (const id of (await read(page)).hand) {
          if (sprung) break;
          const card = page.locator(`#sd-hand [data-card="${id}"]:enabled`);
          if (!(await card.count()) || !/^wizard-skeleton-/.test(id)) continue;
          await card.click();
          if (await page.locator("#sd-cancel").isVisible()) await page.locator("#sd-cancel").click();
        }
      }
      notes.turns.push({seat, status: r.status});
      if (sprung) break;
      await page.locator("#sd-end").click();
      await page.waitForFunction(() => !document.querySelector("#sd-curtain").hidden || document.querySelector("#sd-result #sd-camp"));
      if (await page.locator("#sd-result #sd-camp").count()) throw new Error("the match ended before the trap sprang");
      r = await read(page);
    }
    if (!set) throw new Error("the Cowboy seat never set the Bear Trap");
    if (!sprung) throw new Error(`the Bear Trap did not spring in ${MAX_TURNS} turns`);
    r = await read(page);
    notes.sprung = {...sprung, graveyard: r.graveyard.cowboy, foeTraps: r.foe.traps, foeGrave: r.foe.grave};
    if (!sprung.line.startsWith(`Trap! The Cowboys' ${NAME} caught`) && !sprung.line.includes(NAME)) f(`trap line does not name the ${NAME}: "${sprung.line}"`);
    if (!(r.graveyard.cowboy ?? "").split(", ").includes(NAME)) f(`the Cowboys graveyard does not list the ${NAME}: "${r.graveyard.cowboy}"`);
    if (r.foe.traps !== "Nothing face down") f(`after springing, Cowboy traps read "${r.foe.traps}"`);
    // Public now, still not usable hidden data: no Cowboy instance id, Cowboy hand still backs only.
    fail.push(...seatProblems(r, "wizard", "after the trap"));
    notes.hooks = await hooks(page);
    await page.locator("#sd-restart").click();
    r = await read(page);
    notes.restart = {curtain: r.curtain, status: r.status};
    if (r.curtain) await curtain("curtain after Restart");
    const stored = await c.storage();
    if (diff(stored, c.planted)) f(`saves changed: ${diff(stored, c.planted)}`);
  } catch (e) { f(`threw: ${e.message.split("\n")[0]}`); }
  finally { await c.ctx.close(); }
  return finish("trap", c, fail, notes);
}

function finish(name, c, fail, notes) {
  if (c?.errors.length) fail.push(`page errors: ${c.errors[0]}`);
  if (c?.remote.length) fail.push(`request left the page's origin: ${c.remote[0]}`);
  return {route: name, pass: fail.length === 0, failures: fail, notes};
}

// ---- CLI -------------------------------------------------------------------------------------------------
const ROUTES = {raise: (b, u) => raise(b, u), "raise-narrow": (b, u) => raise(b, u, {viewport: {width: 360, height: 740}, name: "raise-narrow"}), trap};

async function main(argv) {
  if (argv.includes("--help") || !argv.length) { console.log(USAGE); return 0; }
  const opt = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
  const file = opt("--page"), out = opt("--out");
  const only = opt("--only")?.split(",") ?? Object.keys(ROUTES);
  const bad = (msg) => { console.error(`${msg}\n${USAGE}`); return 2; };
  if (!file) return bad("pass --page");
  if (only.some((n) => !ROUTES[n])) return bad(`--only takes ${Object.keys(ROUTES).join(",")}`);
  const html = await readFile(file);
  if (!html.toString("utf8").includes('id="menu-play"')) return bad(`${file} is not the graybox page; run node scripts/build-graybox.mjs --hosted`);
  const server = await serve(html);
  const {chromium} = loadPlaywright();
  const browser = await chromium.launch({executablePath: CHROME, headless: true});
  const results = [];
  try {
    for (const name of only) {
      const started = Date.now();
      const r = await ROUTES[name](browser, server.base);
      r.seconds = Math.round((Date.now() - started) / 1000);
      results.push(r);
      console.log(`${r.pass ? "PASS" : "FAIL"} ${name} (random ${r.notes.random ?? "-"}, ${r.seconds} s)`);
      for (const m of r.failures) console.log(`  - ${m}`);
    }
  } finally { await browser.close(); await server.close(); }
  const report = {schema: "showdown-board-zones/1", revision: git("rev-parse", "HEAD"), chrome: browser.version(),
    page: {file: path.relative(root, path.resolve(file)), bytes: html.length, sha256: sha256(html)}, hooks: HOOKS, routes: results,
    pass: results.every((r) => r.pass), note: "Scripted headless Chrome, fixed Math.random, reduced motion. No human played."};
  if (out) { await mkdir(path.dirname(path.resolve(out)), {recursive: true}); await writeFile(path.resolve(out), JSON.stringify(report, null, 2) + "\n"); }
  console.log(`board zones: ${report.pass ? "PASS" : "FAIL"} · revision ${String(report.revision).slice(0, 12)} · html sha256 ${report.page.sha256.slice(0, 16)}`);
  return report.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
