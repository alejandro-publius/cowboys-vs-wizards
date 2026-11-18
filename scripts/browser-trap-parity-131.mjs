// Issue #131: developer-only real-Chrome parity check of the trap placeholder
// lab (experiments/trap-placeholder, scenario T1, Wizard CPU normal). For
// each seed it compares, at every stable point of the match:
//
//   1. the page's own public view: controller().view() and displayed(), read
//      read-only from inside the page through a CDP Debugger breakpoint on the
//      last line of app.js render(), together with the DOM that render() has
//      just written (one atomic read in the same paused frame);
//   2. the visible DOM fields parsed from that DOM: status line (status, seed,
//      round, phase, result), both sides' base orbs, deck, hand and discard
//      counts, every lane (name, health, maximum, orb glyphs, attack), both
//      trap zone lines, the Cowboy allowances and hand, and the event log;
//   3. an independent Node mirror of the same lab (createLabEngine("T1") on
//      the shipped controller and scheduler) driven by the same recorded
//      inputs, whose full engine state also gives the Wizard's hidden trap.
//
// Redaction: whenever the Node full state holds a set Wizard trap, the page
// view must show only { faceDown: true, setRound }, the DOM must read "Enemy
// trap: set (face-down)", and no hidden Wizard ID (hand, deck or trap) may
// appear in the page HTML or the page view.
//
// Inputs are real CDP mouse presses (Input.dispatchMouseEvent, after an
// elementFromPoint hit check) on the page's own buttons: a zero-tribute summon
// from the developer command list, a synthetic trap hand card, Confirm and End
// phase. Only the Scenario select and seed field are set by script (as the
// existing #116 smoke does); Start is a real click.
//
//   node scripts/browser-trap-parity-131.mjs [--seeds 0,60 | --seed-kit t1] [--out FILE.json]
//
// Issue #135: --seed-kit t1 runs the six #120 playtest-kit seeds
// (55,9,2,23,7,43, categories A-F) through the same checks. Each seed then
// passes or fails on its own, and each run reports its Cowboy trap
// opportunity: the round the kit schedules the trap draw (layoutOf) against
// what this policy actually saw in Chrome (drawn, set, or never reached).
//
// Serves the repository root on 127.0.0.1 only. A host resolver rule maps
// every other host to NOTFOUND and any non-loopback request fails the run.
// No dependency, no src/ change, no build needed (the lab imports src/ directly).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SIDES } from "../src/game/cards.js";
import { publicState } from "../src/game/view.js";
import { cpuFor } from "../src/game/cpu.js";
import { MAX_ROUNDS, SLOT_COUNT } from "../src/game/state.js";
import { createScheduler } from "../src/match/scheduler.js";
import { createController } from "../src/match/controller.js";
import { commandList, createLabEngine, createPlaceholderRenderer, eventLine } from "../experiments/trap-placeholder/lab.js";
import { DECK_TRAP_IDS } from "../experiments/trap-placeholder/scenarios.js";
import { layoutOf, roundForPosition } from "../experiments/trap-playtest-kit/seeds.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("../", import.meta.url));
const LAB = "experiments/trap-placeholder";
export const SCENARIO = "T1";
export const CPU_LEVEL = "normal";
const STABLE = new Set(["accepting_input", "terminal"]);
const MAX_INPUTS = 150;
// Wall-clock bound per seed in Chrome (issue #135); a slower seed fails alone.
const SEED_SECONDS = 180;
// Issue #135: the six T1 seeds of the #120 kit, categories A to F in order
// (experiments/trap-playtest-kit/seed-plan.md). A test pins this list to
// pickSeeds(); the preset only names it, the --seeds path runs it.
export const SEED_KITS = Object.freeze({ t1: Object.freeze([55, 9, 2, 23, 7, 43]) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const canon = (value) => JSON.parse(JSON.stringify(value ?? null));
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export function parseArgs(argv) {
  const opt = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
  const known = new Set(["--seeds", "--seed-kit", "--out"]);
  for (let i = 0; i < argv.length; i += 2) if (!known.has(argv[i])) throw new Error(`unknown argument ${argv[i]}`);
  const kit = opt("--seed-kit", null);
  if (kit !== null) {
    if (argv.includes("--seeds")) throw new Error("--seed-kit and --seeds are exclusive");
    if (!Object.hasOwn(SEED_KITS, kit)) throw new Error(`--seed-kit: unknown kit ${kit} (known: ${Object.keys(SEED_KITS).join(", ")})`);
  }
  const seeds = String(kit !== null ? SEED_KITS[kit].join(",") : opt("--seeds", "0,60")).split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    if (!/^\d+$/.test(s) || Number(s) > 4294967295) throw new Error(`--seeds: bad seed ${s}`);
    return Number(s);
  });
  if (!seeds.length) throw new Error("--seeds: need at least one seed");
  return { seeds, out: opt("--out", null), ...(kit !== null ? { seedKit: kit } : {}) };
}

// ---- Node mirror: the same lab engine, controller and CPU -------------------

// Same wiring as lab.js createLab, plus a read of each accepted full state.
export function createMirror(seed) {
  const { engine, options, events } = createLabEngine(SCENARIO);
  let full = null;
  const tracked = Object.freeze({
    ...engine,
    createMatch(s) { full = engine.createMatch(s); return full; },
    applyAction(state, action) { const r = engine.applyAction(state, action); if (r.ok) full = r.state; return r; },
  });
  const scheduler = createScheduler();
  scheduler.tick(0);
  const choose = cpuFor(CPU_LEVEL);
  const controller = createController({
    engine: tracked, chooseCpuAction: (view) => choose(view, options), scheduler,
    renderer: createPlaceholderRenderer(), cards: options.cards, cpuDelay: 600,
  });
  const settle = () => {
    for (let i = 0; !STABLE.has(controller.status()); i++) {
      if (i > 200000 || controller.status() === "error") throw new Error(`mirror did not settle (${controller.status()}: ${controller.message()})`);
      scheduler.tick(scheduler.now() + 50);
    }
  };
  if (!controller.start(seed)) throw new Error(`mirror refused seed ${seed}`);
  settle();
  return {
    controller, cards: options.cards, events, full: () => full,
    // One recorded input; returns the controller's answer and settles.
    apply(input) {
      let answer;
      if (input.type === "command") {
        const entry = commandList(controller.view(), options.cards)[input.index];
        if (!entry || entry.label !== input.label) throw new Error(`mirror command ${input.index} is ${entry?.label}, page had ${input.label}`);
        answer = controller.submit(entry.action);
      } else if (input.type === "card") {
        // A card press only changes the selection; input() returns nothing then.
        controller.input({ type: "card", cardId: input.cardId });
        answer = controller.selection().cardId === input.cardId ? { ok: true } : { ok: false, reason: controller.message() ?? "not selected" };
      }
      else if (input.type === "confirm") answer = controller.input({ type: "confirm" });
      else if (input.type === "end") answer = controller.endPhase();
      else throw new Error(`unknown input ${input.type}`);
      settle();
      return answer;
    },
    snapshot: () => ({
      status: controller.status(), seed: controller.seed(), view: controller.view(), displayed: controller.displayed(),
      events: events(), options: controller.options(),
    }),
  };
}

// Deterministic Cowboy policy from what the page shows: a free (zero-tribute)
// summon first, then the synthetic trap (card, then Confirm), then End phase.
export function decideInput({ view, options, commands }) {
  if (options?.cardId) return options.canConfirm ? { type: "confirm" } : { type: "end" };
  const own = view.allowances.cowboy;
  if (!own.summonUsed && !own.castUsed) {
    const index = commands.findIndex((label) => label.startsWith("Summon ") && !label.includes("sacrificing"));
    if (index >= 0) return { type: "command", index, label: commands[index] };
  }
  if (!own.castUsed) {
    const cardId = view.sides.cowboy.hand.find((id) => DECK_TRAP_IDS.includes(id) && options?.playableCardIds.includes(id));
    if (cardId) return { type: "card", cardId };
  }
  return { type: "end" };
}

// ---- DOM parsing and comparison (pure) --------------------------------------

const ORB = "\u25cf";
const EMPTY = "\u25cb";
const glyphs = (n, max) => ORB.repeat(Math.max(0, n)) + EMPTY.repeat(Math.max(0, max - n));

// Structured fields from the strings render() wrote. null where a line does not parse.
export function readDom(dom) {
  const st = dom.status.match(/^Status: (\w+)\. Seed (\d+)\. Round (\d+) of (\d+)\. Phase: (Cowboy|Wizard|none)\.(?: Result: (\w+) \(([^)]*)\)\.)? Scenario (\w+) .*Wizard CPU: (\w+)\./);
  const status = st && {
    status: st[1], seed: Number(st[2]), round: Number(st[3]), maxRounds: Number(st[4]), phase: st[5] === "none" ? null : st[5].toLowerCase(),
    result: st[6] ? { outcome: st[6], reason: st[7] } : null, scenario: st[8], cpuLevel: st[9],
  };
  const sides = {};
  for (const side of SIDES) {
    const m = dom.info[side].match(/^Base life orbs (-?\d+) of 5 ([\u25cf\u25cb]*)\. Deck (\d+), hand (\d+), discard (\d+)\.(?: Summon used: (yes|no)\. Spell or trap used: (no|yes \((trap|spell)\))\.)?$/);
    sides[side] = m && {
      baseOrbs: Number(m[1]), baseGlyphs: m[2], deckCount: Number(m[3]), handCount: Number(m[4]), discardCount: Number(m[5]),
      allowances: m[6] ? { summonUsed: m[6] === "yes", castUsed: m[7] !== "no", tactical: m[8] ?? null } : null,
    };
  }
  const lanes = {};
  for (const side of SIDES) {
    lanes[side] = dom.lanes[side].map(({ text }) => {
      const m = text.match(/^(Your|Enemy) lane (\d): (?:(empty)|(.+)\nHealth (-?\d+) of (\d+) ([\u25cf\u25cb]*)\nAttack (\d+))$/);
      if (!m) return { unparsed: text };
      return m[3] ? { owner: m[1], lane: Number(m[2]), troop: null }
        : { owner: m[1], lane: Number(m[2]), troop: { name: m[4], health: Number(m[5]), max: Number(m[6]), glyphs: m[7], attack: Number(m[8]) } };
    });
  }
  const hand = dom.hand.map(({ text, key, disabled, pressed }) => {
    const m = text.match(/^(.*) \((?:(\d+) stars, attack (\d+), health (\d+)|(trap|spell))\)$/);
    return { name: m?.[1] ?? null, kind: m ? (m[5] ?? "troop") : null, key, disabled, pressed };
  });
  return { status, sides, lanes, trap: dom.trap, hand, log: dom.log };
}

// Every visible field of `dom` against the page's displayed public view.
// Returns a list of mismatch strings (empty when equal). `findings` stays in
// the receipt shape for known display gaps; issue #132 removed the only one.
export function compareDomToView(dom, view, cards, { status, seed, findings = [] } = {}) {
  const out = [];
  const check = (label, got, want) => { if (!same(got, want)) out.push(`${label}: DOM ${JSON.stringify(got)} vs view ${JSON.stringify(want)}`); };
  const read = readDom(dom);
  if (!read.status) out.push(`status line did not parse: ${JSON.stringify(dom.status)}`);
  else {
    check("status", read.status.status, status);
    check("seed", read.status.seed, seed);
    check("round", read.status.round, view.round);
    check("maxRounds", read.status.maxRounds, MAX_ROUNDS);
    // Issue #132: strict. "Phase: none" parses to null and must equal a null
    // activeSide; a terminal "Phase: Wizard" is a mismatch, not a finding.
    check("phase", read.status.phase, view.activeSide);
    check("result", read.status.result, view.result ? { outcome: view.result.outcome, reason: view.result.reason } : null);
    check("scenario", [read.status.scenario, read.status.cpuLevel], [SCENARIO, CPU_LEVEL]);
  }
  for (const side of SIDES) {
    const s = view.sides[side];
    const got = read.sides[side];
    if (!got) { out.push(`${side} info did not parse: ${JSON.stringify(dom.info[side])}`); continue; }
    check(`${side} base orbs`, [got.baseOrbs, got.baseGlyphs], [s.baseOrbs, glyphs(s.baseOrbs, 5)]);
    check(`${side} counts`, [got.deckCount, got.handCount, got.discardCount], [s.deckCount, s.handCount, s.discard.length]);
    if (side === "cowboy") {
      const a = view.allowances.cowboy;
      check("cowboy allowances", got.allowances, { summonUsed: a.summonUsed, castUsed: a.castUsed, tactical: a.castUsed ? (a.tactical ?? "spell") : null });
    } else check("wizard allowances shown", got.allowances, null);
    const owner = side === "cowboy" ? "Your" : "Enemy";
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const troop = s.board[slot];
      const card = troop && cards[troop.cardId];
      check(`${side} lane ${slot + 1}`, read.lanes[side][slot], {
        owner, lane: slot + 1,
        troop: troop ? { name: card.name, health: troop.health, max: card.health, glyphs: glyphs(troop.health, card.health), attack: card.attack } : null,
      });
    }
    const trap = s.trap;
    let want;
    if (side === "wizard") want = trap ? "Enemy trap: set (face-down)" : "Enemy trap: none";
    else if (!trap) want = "Trap zone: empty";
    else want = `${cards[trap.cardId].name}. ${trap.setRound < view.round ? "Trap armed. It springs at the next clash if the enemy has a troop." : "Trap set. It springs from next round."}`;
    check(`${side} trap zone`, dom.trap[side], want);
  }
  const hand = view.sides.cowboy.hand;
  check("cowboy hand", read.hand.map((h) => [h.name, h.kind, h.key]), hand.map((id, i) => [cards[id].name, cards[id].kind, `${id}-${i}`]));
  return out;
}

// The hidden Wizard IDs of a full engine state: hand, deck and a set trap.
export function hiddenWizardIds(full) {
  const w = full.sides.wizard;
  return [...w.hand, ...w.deck, ...(w.trap ? [w.trap.cardId] : [])];
}

// Redaction of the Wizard's hidden cards in the page view, DOM and log.
export function checkRedaction(page, full) {
  const out = [];
  const trap = full.sides.wizard.trap;
  const pageTrap = page.view.sides.wizard.trap;
  if (trap) {
    if (!same(pageTrap, { faceDown: true, setRound: trap.setRound })) out.push(`wizard trap in page view ${JSON.stringify(pageTrap)}`);
    if (page.dom.trap.wizard !== "Enemy trap: set (face-down)") out.push(`wizard trap DOM ${JSON.stringify(page.dom.trap.wizard)}`);
  } else if (pageTrap !== null) out.push(`page shows a Wizard trap the engine does not hold: ${JSON.stringify(pageTrap)}`);
  const viewText = JSON.stringify(page.view);
  for (const id of hiddenWizardIds(full)) {
    if (page.dom.html.includes(id)) out.push(`hidden Wizard ID ${id} in page HTML`);
    if (viewText.includes(`"${id}"`)) out.push(`hidden Wizard ID ${id} in page view`);
  }
  if (Object.hasOwn(page.view.sides.wizard, "hand")) out.push("page view exposes the Wizard hand");
  for (const e of page.events) if (e.type === "trap-set" && e.side === "wizard" && Object.hasOwn(e, "cardId")) out.push("Wizard trap-set event carries cardId");
  return out;
}

// All checks for one stable point. `page` is the in-page read, `mirror` the Node snapshot.
export function compareSnapshot(page, mirror, full, cards, findings = []) {
  const out = [];
  if (page.status !== mirror.status) out.push(`status page ${page.status} vs mirror ${mirror.status}`);
  if (!same(page.settings, { scenario: SCENARIO, cpuLevel: CPU_LEVEL })) out.push(`page settings ${JSON.stringify(page.settings)}`);
  if (!same(page.view, mirror.view)) out.push("page view differs from the Node mirror view");
  if (!same(page.view, publicState(full, "cowboy"))) out.push("page view differs from publicState(mirror full state, cowboy)");
  if (!same(page.displayed, page.view)) out.push("page displayed() differs from view() at a stable point");
  if (!same(page.events, mirror.events)) out.push("page event log data differs from the Node mirror");
  if (!same(page.dom.log, page.events.map(eventLine))) out.push("DOM log lines differ from eventLine(page events)");
  out.push(...compareDomToView(page.dom, page.displayed ?? page.view, cards, { status: page.status, seed: page.seed, findings }));
  out.push(...checkRedaction(page, full));
  return out;
}

// ---- receipt -----------------------------------------------------------------

// Issue #135: the Cowboy trap opportunity of one finished run. `scheduledRound`
// is the round the T1 deal puts the trap in hand if the match lasts;
// `firstSeenRound` is the first stable point whose Cowboy hand held it.
export function trapOpportunity({ scheduledRound, firstSeenRound, cowboyTrapSet, rounds }) {
  let outcome;
  if (cowboyTrapSet) outcome = "set";
  else if (firstSeenRound !== null) outcome = "drawn-not-set";
  else if (rounds < scheduledRound) outcome = "not-reached";
  else outcome = "not-drawn";
  const text = {
    set: `trap scheduled for round ${scheduledRound}, in hand from round ${firstSeenRound}, set by the Cowboy`,
    "drawn-not-set": `trap in hand from round ${firstSeenRound}, never set by this policy`,
    "not-reached": `conditional: trap scheduled for round ${scheduledRound}, match ended in round ${rounds}; no trap opportunity occurred`,
    "not-drawn": `trap scheduled for round ${scheduledRound} but not seen in hand by round ${rounds}`,
  }[outcome];
  return { scheduledRound, firstSeenRound, outcome, text };
}

export function digestOf(runs) {
  const stable = runs.map(({ seed, inputs, snapshots }) => ({ seed, inputs, snapshots }));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

// ---- loopback server and Chrome ---------------------------------------------

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
async function serve() {
  const base = path.resolve(root);
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
      const rel = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname).replace(/^\/+/, "");
      const file = path.resolve(base, rel);
      if (!file.startsWith(base + path.sep) || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok)) };
}

async function launch() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "trap-parity-131-"));
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--disable-sync", "--disable-extensions", "--disable-background-networking",
    "--disable-component-update", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--mute-audio",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "--window-size=1280,900", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (c) => { stderr += c; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}`)); });
  });
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok); ws.addEventListener("error", () => fail(new Error("ws"))); });
  const waiting = new Map(); const listeners = new Set(); let next = 0; const errors = [], remote = [];
  ws.addEventListener("message", ({ data }) => {
    const m = JSON.parse(data);
    if (m.id === undefined) {
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
      if (m.method === "Network.requestWillBeSent" && !/^(http:\/\/127\.0\.0\.1[:/]|data:|blob:|about:)/.test(m.params.request.url)) remote.push(m.params.request.url);
      listeners.forEach((l) => l(m));
      return;
    }
    const e = waiting.get(m.id); waiting.delete(m.id);
    if (m.error) e?.reject(new Error(`${e.method}: ${m.error.message}`)); else e?.resolve(m.result);
  });
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++next; waiting.set(id, { resolve, reject, method }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { product } = await raw("Browser.getVersion");
  const { targetInfos } = await raw("Target.getTargets");
  const { sessionId } = await raw("Target.attachToTarget", { targetId: targetInfos.find((t) => t.type === "page").targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);
  const once = (method) => new Promise((resolve) => { const l = (m) => { if (m.method === method && m.sessionId === sessionId) { listeners.delete(l); resolve(m.params); } }; listeners.add(l); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Debugger.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  return { send, once, errors, remote, product, async close() {
    ws.close(); child.kill("SIGTERM"); await sleep(400); if (child.exitCode === null) child.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  } };
}

// Evaluated inside the paused render() frame: the page's own public view and
// the DOM render() has just written. Nothing on the page is changed.
const PAGE_READ = `JSON.stringify({
  status: status,
  seed: controller().seed(),
  settings: session.settings(),
  view: controller().view(),
  displayed: controller().displayed(),
  options: controller().options(),
  events: events(),
  dom: (() => {
    const el = (id) => document.getElementById(id);
    return {
      status: el("status").textContent,
      info: { cowboy: el("cowboy-info").textContent, wizard: el("wizard-info").textContent },
      trap: { cowboy: el("cowboy-trap").textContent, wizard: el("wizard-trap").textContent },
      lanes: Object.fromEntries(["cowboy", "wizard"].map((s) => [s, [...el(s + "-lanes").children].map((b) => ({ text: b.textContent, disabled: b.disabled }))])),
      hand: [...el("hand").querySelectorAll("button")].map((b) => ({ text: b.textContent, key: b.dataset.key, disabled: b.disabled, pressed: b.getAttribute("aria-pressed") })),
      commands: [...el("commands").querySelectorAll("button")].map((b) => b.textContent),
      log: [...el("log").children].map((li) => li.textContent),
      html: document.documentElement.outerHTML,
    };
  })(),
})`;

async function runSeed(chrome, origin, seed, breakLine) {
  const { send, once } = chrome;
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, what, ms = 60000) => {
    for (const stop = Date.now() + ms; Date.now() < stop; await sleep(30)) if (await evaluate(expression)) return;
    throw new Error(`seed ${seed}: timed out waiting for ${what}`);
  };
  const click = async (selector) => {
    const box = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)});
      if (!b || b.disabled) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2; return document.elementFromPoint(x, y) === b ? { x, y } : null; })()`);
    if (!box) throw new Error(`seed ${seed}: ${selector} is missing, disabled or covered`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  };
  // Atomic in-page read at the end of one render() call.
  const readPage = async () => {
    const { breakpointId } = await send("Debugger.setBreakpointByUrl", { url: `${origin}/${LAB}/app.js`, lineNumber: breakLine });
    const paused = once("Debugger.paused");
    const trigger = evaluate(`document.getElementById("cpu-level").dispatchEvent(new Event("change", { bubbles: true })), true`);
    const { callFrames } = await paused;
    const r = await send("Debugger.evaluateOnCallFrame", { callFrameId: callFrames[0].callFrameId, expression: PAGE_READ, returnByValue: true });
    await send("Debugger.removeBreakpoint", { breakpointId });
    await send("Debugger.resume");
    await trigger;
    if (r.exceptionDetails) throw new Error(`in-page read: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return JSON.parse(r.result.value);
  };
  const stableWith = (count) => `(() => /^Status: (accepting_input|terminal)\\./.test(document.getElementById("status").textContent)
    && document.querySelectorAll("#log li").length === ${count})()`;

  const mirror = createMirror(seed);
  const inputs = [], snapshots = [], mismatches = [], findings = [];
  const deadline = Date.now() + SEED_SECONDS * 1000;
  let firstSeenRound = null;
  let hiddenTrapPoints = 0, wizardTrapSetRound = null, wizardTrapSprung = false, cowboyTrapSet = false, summons = 0;
  const compare = async (label) => {
    const page = await readPage();
    const m = mirror.snapshot();
    const full = mirror.full();
    const found = [];
    const diffs = compareSnapshot(page, m, full, mirror.cards, found);
    for (const d of diffs) mismatches.push(`${label}: ${d}`);
    for (const f of found) findings.push(`${label}: ${f}`);
    if (full.sides.wizard.trap) { hiddenTrapPoints++; wizardTrapSetRound ??= full.sides.wizard.trap.setRound; }
    if (page.events.some((e) => e.type === "trap-trigger" && e.side === "wizard")) wizardTrapSprung = true;
    if (firstSeenRound === null && page.view.sides.cowboy.hand.some((id) => DECK_TRAP_IDS.includes(id))) firstSeenRound = page.view.round;
    const parsed = readDom(page.dom);
    snapshots.push({ label, status: page.status, round: page.view.round, activeSide: page.view.activeSide, revision: page.view.revision,
      result: page.view.result?.outcome ?? null, dom: { status: parsed.status, sides: parsed.sides, lanes: parsed.lanes, trap: parsed.trap }, mismatches: diffs.length });
    return page;
  };

  await send("Page.navigate", { url: `${origin}/${LAB}/index.html` });
  await wait(`/^Status: (accepting_input|cpu_turn|terminal)\\./.test(document.getElementById("status")?.textContent ?? "")`, "page load");
  await evaluate(`(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); };
    set("scenario", ${JSON.stringify(SCENARIO)}); set("cpu-level", ${JSON.stringify(CPU_LEVEL)}); set("seed", "${seed}"); return true; })()`);
  await click(`#seed-form button[type="submit"]`);
  await wait(`document.getElementById("status").textContent.includes("Seed ${seed}.") && document.getElementById("status").textContent.includes("Scenario ${SCENARIO} ")
    && ${stableWith(mirror.events().length)}`, "T1 start");
  let page = await compare("start");

  while (page.status !== "terminal") {
    if (inputs.length >= MAX_INPUTS) throw new Error(`seed ${seed}: no result after ${MAX_INPUTS} inputs`);
    if (Date.now() > deadline) throw new Error(`seed ${seed}: over ${SEED_SECONDS} s`);
    const input = decideInput({ view: page.view, options: page.options, commands: page.dom.commands });
    const answer = mirror.apply(input);
    if (!answer?.ok) throw new Error(`seed ${seed}: mirror rejected ${JSON.stringify(input)}: ${answer?.reason ?? answer?.message}`);
    inputs.push(input);
    if (input.type === "command") {
      summons++;
      await click(`#commands li:nth-child(${input.index + 1}) button`);
    } else if (input.type === "card") {
      await click(`#hand button[data-key^=${JSON.stringify(input.cardId + "-")}]`);
    } else if (input.type === "confirm") {
      await click("#confirm");
      if (mirror.events().some((e) => e.type === "trap-set" && e.side === "cowboy")) cowboyTrapSet = true;
    } else await click("#end-phase");
    const pressed = input.type === "card" ? ` && document.querySelector('#hand button[aria-pressed="true"]')?.dataset.key.startsWith(${JSON.stringify(input.cardId + "-")})` : "";
    await wait(`${stableWith(mirror.events().length)}${pressed}`, `${input.type} sync`);
    page = await compare(`input ${inputs.length} ${input.type}`);
  }
  const counts = (type, side) => mirror.events().filter((e) => e.type === type && (side === undefined || e.side === side)).length;
  return {
    seed, inputs, snapshots, mismatches, findings,
    result: page.view.result, rounds: page.view.round,
    trapOpportunity: trapOpportunity({ scheduledRound: roundForPosition(layoutOf(seed).trap), firstSeenRound, cowboyTrapSet, rounds: page.view.round }),
    coverage: {
      stablePoints: snapshots.length, summonsByCommandClick: summons, cowboyTrapSet,
      wizardTrapSet: counts("trap-set", "wizard"), wizardTrapSetRound, hiddenWizardTrapPoints: hiddenTrapPoints, wizardTrapSprung,
      cowboyTrapTriggers: counts("trap-trigger", "cowboy"), wizardTrapTriggers: counts("trap-trigger", "wizard"),
      events: mirror.events().length,
    },
  };
}

// 0-based line of the last statement of render(); the page read pauses there.
export function breakLineOf(appSource) {
  const lines = appSource.split("\n");
  const hits = lines.flatMap((line, i) => (line === "  restoreFocus(status);" ? [i] : []));
  if (hits.length !== 1) throw new Error(`expected one "restoreFocus(status);" line in app.js, found ${hits.length}`);
  return hits[0];
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const started = new Date();
  const files = {};
  for (const f of ["app.js", "lab.js", "scenarios.js", "index.html"]) files[`${LAB}/${f}`] = createHash("sha256").update(await readFile(path.join(root, LAB, f))).digest("hex");
  const breakLine = breakLineOf(await readFile(path.join(root, LAB, "app.js"), "utf8"));
  const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout.trim();
  const server = await serve();
  const chrome = await launch();
  const runs = [], failures = [];
  try {
    // Issue #135: one seed's failure is recorded and the next seed still runs.
    for (const seed of cfg.seeds) {
      try { runs.push(await runSeed(chrome, server.origin, seed, breakLine)); }
      catch (error) { failures.push({ seed, failure: error.message }); await chrome.send("Debugger.resume").catch(() => {}); }
    }
  } finally {
    await chrome.close();
    await server.close();
  }
  const mismatches = runs.reduce((n, r) => n + r.mismatches.length, 0);
  const failure = failures[0]?.failure ?? null;
  const pass = !failures.length && mismatches === 0 && chrome.errors.length === 0 && chrome.remote.length === 0 && runs.length === cfg.seeds.length;
  const receipt = {
    tool: "scripts/browser-trap-parity-131.mjs", issue: 131, pass, failure, seeds: cfg.seeds, seedKit: cfg.seedKit ?? null,
    // Per seed: did this Chrome run finish clean ("pass") or not ("fail").
    chromeResults: cfg.seeds.map((seed) => {
      const f = failures.find((x) => x.seed === seed);
      const r = runs.find((x) => x.seed === seed);
      return f ? { seed, chrome: "fail", failure: f.failure } : { seed, chrome: r.mismatches.length ? "fail" : "pass", mismatches: r.mismatches.length };
    }),
    head: git("rev-parse", "HEAD"), dirtyTracked: git("status", "--porcelain", "--untracked-files=no") !== "",
    chrome: chrome.product, node: process.version, platform: `${process.platform} ${os.release()} ${process.arch}`,
    scenario: SCENARIO, cpuLevel: CPU_LEVEL, files, breakpoint: `${LAB}/app.js line ${breakLine + 1}`,
    startedAt: started.toISOString(), seconds: Math.round((Date.now() - started) / 100) / 10,
    consoleErrors: chrome.errors, remoteRequests: chrome.remote, mismatches, knownFindings: runs.reduce((n, r) => n + r.findings.length, 0),
    digest: digestOf(runs),
    runs: runs.map(({ seed, inputs, snapshots, mismatches: m, findings, result, rounds, coverage, trapOpportunity: opp }) => ({
      seed, result: result && { winner: result.winner, outcome: result.outcome, reason: result.reason }, rounds, trapOpportunity: opp, coverage,
      inputs, mismatches: m, findings, finalDom: snapshots.at(-1)?.dom,
    })),
  };
  const text = JSON.stringify(receipt, null, 2) + "\n";
  if (cfg.out) await writeFile(cfg.out, text);
  console.log(cfg.out ? `receipt written to ${cfg.out}` : text);
  for (const r of receipt.runs) console.log(`seed ${r.seed}: ${r.coverage.stablePoints} stable points, ${r.inputs.length} inputs, mismatches ${r.mismatches.length}, known findings ${r.findings.length}, result ${r.result?.outcome} (${r.result?.reason}), round ${r.rounds}; Cowboy trap ${r.trapOpportunity.outcome}: ${r.trapOpportunity.text}; coverage ${JSON.stringify(r.coverage)}`);
  for (const f of failures) console.log(`seed ${f.seed}: Chrome run FAILED: ${f.failure}`);
  console.log(`pass ${pass}; digest ${receipt.digest}; ${chrome.product}; console errors ${chrome.errors.length}; remote ${chrome.remote.length}${failure ? `; failure: ${failure}` : ""}`);
  process.exit(pass ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
