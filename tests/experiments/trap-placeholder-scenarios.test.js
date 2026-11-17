// Issue #116: developer-only scenario and Wizard CPU selectors of the local
// trap placeholder lab (experiments/trap-placeholder). Node checks of the pure
// half against the shipped rules and the #114 simulation's openings, then one
// Chrome loopback smoke of the page (skipped when Chrome is not at the
// default macOS path). Not part of npm test.
// Run: node --test tests/experiments/trap-placeholder-scenarios.test.js
// The synthetic traps are developer-only; nothing here says anything about balance.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { CPU_LEVELS, chooseAction, cpuFor } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createController } from "../../src/match/controller.js";
import { holdings, openingFor as simOpeningFor } from "../../experiments/trap-deck-sim/sim.js";
import {
  FIXTURE_TRAPS,
  LAB_CARDS,
  SCENARIO_CARDS,
  commandList,
  createLab,
  createLabEngine,
  createLabSession,
  createPlaceholderRenderer,
  eventLine,
  trapText,
} from "../../experiments/trap-placeholder/lab.js";
import { DECK_TRAP_IDS, SCENARIOS, SPELL_IDS, openingFor } from "../../experiments/trap-placeholder/scenarios.js";

const SEEDS = [0, 60];
const RANGE = Array.from({ length: 200 }, (_, i) => i);
const STEP = 50;
const MAX_TICKS = 20000;
const isTrap = (cards, id) => cards[id]?.kind === "trap";
const isSpell = (id) => CARDS[id]?.kind === "spell";
const key = (action) => JSON.stringify(action);
const WIZARD_TRAPS = DECK_TRAP_IDS.filter((id) => id.includes("-wizard-"));

// The Cowboy plays cpuFor("normal") on its own view through the page's paths:
// set-trap by selection clicks, end-phase by endPhase(), the rest by command list.
function actCowboy(controller, cards) {
  const view = controller.view();
  const wanted = chooseAction(view, { cards });
  if (wanted.type === "set-trap") {
    controller.input({ type: "card", cardId: wanted.cardId });
    assert.deepEqual(controller.input({ type: "confirm" }), { ok: true });
  } else if (wanted.type === "end-phase") {
    assert.deepEqual(controller.endPhase(), { ok: true });
  } else {
    const entry = commandList(view, cards).find(({ action }) => key(action) === key(wanted));
    assert.ok(entry, `no command for ${key(wanted)}`);
    assert.deepEqual(controller.submit(entry.action), { ok: true });
  }
}

function play(scheduler, controller, cards, stop = () => false) {
  for (let ticks = 0; ; ) {
    const status = controller.status();
    assert.notEqual(status, "error", controller.message());
    if (status === "terminal" || stop()) return;
    if (status === "accepting_input") {
      actCowboy(controller, cards);
      continue;
    }
    assert.ok(++ticks <= MAX_TICKS, "no result");
    scheduler.tick(scheduler.now() + STEP);
  }
}

function harness(settings) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const h = { scheduler, snapshots: [] };
  Object.assign(
    h,
    createLab({
      scheduler,
      ...settings,
      onChange() {
        const c = h.controller;
        h.snapshots.push(JSON.stringify({ status: c.status(), view: c.view(), displayed: c.displayed(), message: c.message(), options: c.options() }));
      },
    }),
  );
  return h;
}

function playSeed(seed, settings) {
  const h = harness(settings);
  assert.equal(h.controller.start(seed), true);
  play(h.scheduler, h.controller, h.cards);
  return h;
}

test("FIXTURE stays the default: createLab() with no settings is the #108 lab", () => {
  const lab = createLab({ scheduler: createScheduler() });
  assert.deepEqual(lab.settings, { scenario: "FIXTURE", cpuLevel: "normal" });
  assert.equal(lab.cards, LAB_CARDS);
  assert.equal(cpuFor("normal"), chooseAction, "normal is the unchanged chooser");
  for (const seed of SEEDS) {
    const expected = createMatch(seed, { traps: true });
    for (const side of SIDES) expected.sides[side].hand.push(FIXTURE_TRAPS[side]);
    assert.deepEqual(createLabEngine().engine.createMatch(seed), expected);
  }
  // Same #108 receipt as tests/experiments/trap-placeholder.test.js.
  const results = Object.fromEntries(SEEDS.map((seed) => [seed, { ...playSeed(seed).controller.view().result, events: playSeed(seed).events().length }]));
  assert.deepEqual(results, {
    0: { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 5, outcome: "loss", events: 72 },
    60: { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 7, outcome: "loss", events: 106 },
  });
});

test("BASE is the exact default createMatch and plays in lockstep with the default controller (flag off)", () => {
  assert.equal(SCENARIO_CARDS.BASE, CARDS);
  for (const seed of SEEDS) {
    const state = createLabEngine("BASE").engine.createMatch(seed);
    assert.deepEqual(state, createMatch(seed));
    assert.equal(Object.hasOwn(state, "traps"), false);
    const view = publicState(state, "cowboy");
    assert.equal(trapText(view, "cowboy"), "Trap zone: traps not enabled in this scenario");
    assert.equal(trapText(view, "wizard"), "Enemy trap: traps not enabled in this scenario");

    const views = { lab: [], shipped: [] };
    const scheduler = createScheduler();
    scheduler.tick(0);
    const shipped = createController({ scheduler, renderer: createPlaceholderRenderer(), onChange: () => views.shipped.push(key(shipped.view())) });
    shipped.start(seed);
    play(scheduler, shipped, CARDS);
    const h = harness({ scenario: "BASE" });
    h.controller.start(seed);
    play(h.scheduler, h.controller, h.cards);
    views.lab = h.snapshots.map((snap) => key(JSON.parse(snap).view));
    assert.deepEqual(views.lab, views.shipped, `seed ${seed}`);
    assert.ok(h.events().every((event) => !event.type.startsWith("trap")));
  }
});

test("T1 and T2 openings equal sim.js openingFor (#114) on seeds 0..199, 12 cards each, no extra card", () => {
  for (const scenario of ["BASE", "T1", "T2"]) {
    for (const seed of RANGE) {
      const ours = createLabEngine(scenario).engine.createMatch(seed);
      assert.deepEqual(ours, simOpeningFor(seed, scenario), `${scenario} seed ${seed}`);
      assert.deepEqual(openingFor(seed, scenario), ours);
      if (scenario === "BASE") continue;
      const base = createMatch(seed);
      assert.equal(ours.startingSide, base.startingSide);
      assert.equal(ours.rng, base.rng);
      for (const side of SIDES) {
        const held = holdings(ours, side);
        assert.equal(held.length, 12);
        assert.equal(held.filter(isSpell).length, scenario === "T1" ? 1 : 0);
        assert.equal(held.filter((id) => isTrap(SCENARIO_CARDS[scenario], id)).length, scenario === "T1" ? 1 : 2);
        // Every other position is the BASE ID; a changed one was a spell copy.
        const pairs = [...base.sides[side].hand.map((id, i) => [id, ours.sides[side].hand[i]]), ...base.sides[side].deck.map((id, i) => [id, ours.sides[side].deck[i]])];
        for (const [was, now] of pairs) if (was !== now) assert.ok(SPELL_IDS[side].includes(was) && DECK_TRAP_IDS.includes(now));
      }
    }
  }
});

test("no shipped catalog change: CARDS and DECKS are frozen and unchanged after every scenario", () => {
  const before = JSON.stringify({ CARDS, DECKS });
  for (const scenario of SCENARIOS) for (const seed of SEEDS) playSeed(seed, { scenario });
  assert.equal(JSON.stringify({ CARDS, DECKS }), before);
  assert.ok(Object.isFrozen(CARDS) && Object.isFrozen(DECKS) && SIDES.every((side) => Object.isFrozen(DECKS[side])));
  for (const id of DECK_TRAP_IDS) {
    assert.equal(Object.hasOwn(CARDS, id), false);
    for (const side of SIDES) assert.equal(DECKS[side].includes(id), false);
  }
  for (const scenario of SCENARIOS) for (const id of Object.keys(CARDS)) assert.equal(SCENARIO_CARDS[scenario][id], CARDS[id]);
});

test("every CPU level on both sides chooses an accepted legal action in every scenario (seeds 0..39)", () => {
  for (const scenario of SCENARIOS) {
    const { engine, options } = createLabEngine(scenario);
    for (const level of CPU_LEVELS) {
      for (let seed = 0; seed < 40; seed++) {
        let state = engine.createMatch(seed);
        for (let steps = 0; !state.result; steps++) {
          assert.ok(steps < 60, `${scenario} ${level} seed ${seed}: no result`);
          const side = state.activeSide;
          const action = cpuFor(level)(publicState(state, side), options);
          assert.ok(legalActions(state, side, options).some((legal) => key(legal) === key(action)), `${scenario} ${level} seed ${seed}`);
          const applied = applyAction(state, action, options);
          assert.equal(applied.ok, true, applied.reason);
          state = applied.state;
        }
      }
    }
  }
});

test("each scenario and Wizard level plays seeds 0 and 60 through the controller; replays are identical; no hidden Wizard trap ID leaks", () => {
  const traps = {};
  for (const scenario of SCENARIOS) {
    for (const cpuLevel of CPU_LEVELS) {
      for (const seed of SEEDS) {
        const label = `${scenario} ${cpuLevel} seed ${seed}`;
        const a = playSeed(seed, { scenario, cpuLevel });
        const b = playSeed(seed, { scenario, cpuLevel });
        assert.equal(a.controller.status(), "terminal", label);
        assert.deepEqual(b.events(), a.events(), label);
        assert.deepEqual(b.snapshots, a.snapshots, label);
        const events = a.events();
        for (const event of events) assert.notEqual(eventLine(event), event.type, label);
        if (scenario === "BASE") assert.ok(events.every((event) => !event.type.startsWith("trap")), label);
        traps[scenario] = (traps[scenario] ?? 0) + events.filter((event) => event.type === "trap-trigger").length;
        // A Wizard trap ID is public only from its own trigger on.
        for (const id of [...WIZARD_TRAPS, FIXTURE_TRAPS.wizard]) {
          const sprung = events.findIndex((event) => event.type === "trap-trigger" && event.cardId === id);
          const before = sprung === -1 ? events : events.slice(0, sprung);
          assert.equal(JSON.stringify(before).includes(`"${id}"`), false, `${label} ${id} in log`);
          for (const snap of a.snapshots) {
            const { view, displayed, options, message } = JSON.parse(snap);
            assert.equal(JSON.stringify({ options, message }).includes(id), false, label);
            for (const shown of [view, displayed]) {
              if (!shown) continue;
              assert.equal(Object.hasOwn(shown.sides.wizard, "hand"), false);
              assert.equal(Object.hasOwn(shown.sides.wizard, "deck"), false);
              if (JSON.stringify(shown).includes(`"${id}"`)) assert.ok(shown.sides.wizard.discard.includes(id), `${label} ${id} shown before it sprang`);
            }
          }
        }
      }
    }
  }
  assert.equal(traps.BASE, 0);
  for (const scenario of ["FIXTURE", "T1", "T2"]) assert.ok(traps[scenario] > 0, `${scenario} had a trap trigger`);
});

test("session: settings apply on Start only; the old controller is left, its callbacks dropped; restart keeps settings and seed", () => {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const calls = [];
  const session = createLabSession({ scheduler, onChange: () => calls.push(session.lab()) });
  const first = session.lab();
  assert.deepEqual(session.settings(), { scenario: "FIXTURE", cpuLevel: "normal" });

  // Unchanged settings: the same controller is started, as in #108.
  assert.equal(session.start("0", { scenario: "FIXTURE", cpuLevel: "normal" }), true);
  assert.equal(session.lab(), first);
  const c1 = first.controller;
  play(scheduler, c1, first.cards, () => c1.status() === "accepting_input");
  assert.deepEqual(c1.endPhase(), { ok: true });
  play(scheduler, c1, first.cards, () => c1.status() === "cpu_turn");
  assert.equal(c1.status(), "cpu_turn", "a Wizard CPU step is queued");

  // An invalid seed with changed settings keeps the current match.
  const kept = c1.view();
  assert.equal(session.start("x", { scenario: "T2", cpuLevel: "hard" }), false);
  assert.equal(session.lab(), first);
  assert.deepEqual(c1.view(), kept);
  assert.match(c1.message(), /Seed must be/);

  // Changed settings on Start: leave, then a fresh lab with an empty log.
  const oldEvents = first.events().length;
  const generation = session.generation();
  assert.equal(session.start("0", { scenario: "T1", cpuLevel: "hard" }), true);
  const second = session.lab();
  assert.notEqual(second, first);
  assert.equal(session.generation(), generation + 1);
  assert.equal(c1.status(), "idle", "old controller left");
  assert.deepEqual(second.settings, { scenario: "T1", cpuLevel: "hard" });
  const switchedAt = calls.length;
  play(scheduler, second.controller, second.cards, () => second.controller.status() === "accepting_input");
  assert.equal(first.events().length, oldEvents, "old lab applied nothing after the switch");
  assert.ok(calls.slice(switchedAt).every((lab) => lab === second), "no callback from the old lab");
  const fresh = harness({ scenario: "T1", cpuLevel: "hard" });
  fresh.controller.start(0);
  play(fresh.scheduler, fresh.controller, fresh.cards, () => fresh.controller.status() === "accepting_input");
  assert.deepEqual(second.events(), fresh.events(), "fresh log, same as a new T1/hard lab");

  // The old controller's own notifications are dropped by the generation guard.
  const count = calls.length;
  c1.input({ type: "cancel" });
  assert.equal(calls.length, count);

  // Restart: same scenario, level, pinned seed; queued CPU step dropped.
  assert.deepEqual(second.controller.endPhase(), { ok: true });
  play(scheduler, second.controller, second.cards, () => second.controller.status() === "cpu_turn");
  assert.equal(session.restart(), true);
  assert.equal(session.lab(), second);
  assert.deepEqual(session.settings(), { scenario: "T1", cpuLevel: "hard" });
  assert.equal(second.controller.seed(), 0);
  assert.equal(second.controller.seedPinned(), true);
  play(scheduler, second.controller, second.cards, () => second.controller.status() === "accepting_input");
  assert.deepEqual(second.events(), fresh.events());

  // Leave: nothing runs afterwards.
  assert.deepEqual(second.controller.endPhase(), { ok: true });
  play(scheduler, second.controller, second.cards, () => second.controller.status() === "cpu_turn");
  const queued = second.events().length;
  session.leave();
  assert.equal(second.controller.status(), "idle");
  for (let i = 0; i < 100; i++) scheduler.tick(scheduler.now() + STEP);
  assert.equal(second.events().length, queued);
  assert.equal(scheduler.pending(), 0);

  assert.throws(() => session.start("0", { scenario: "T3", cpuLevel: "normal" }), RangeError);
  assert.throws(() => session.start("0", { scenario: "T1", cpuLevel: "expert" }), RangeError);
});

// ---- Chrome loopback smoke (DevTools protocol, no dependency) ----

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const profile = await mkdtemp(path.join(tmpdir(), "kiro-trap-scenarios-"));
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

test("Chrome smoke: select BASE, T1 and T2 with a Wizard level, Start, play to a result, Restart keeps settings; no errors, no hidden Wizard trap ID", { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}` }, async (t) => {
  const server = await serve();
  const chrome = await launchChrome();
  const cdp = await connect(chrome.url);
  const errors = [];
  try {
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
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async (expression, ms = 60000) => {
      for (const stop = Date.now() + ms; Date.now() < stop; await sleep(40)) if (await evaluate(expression)) return;
      throw new Error(`timed out: ${expression}`);
    };
    const status = () => evaluate(`document.getElementById("status").textContent`);
    const hiddenShown = () => evaluate(`(() => {
      const html = document.documentElement.outerHTML;
      const sprung = [...document.querySelectorAll("#log li")].some((li) => li.textContent.startsWith("Wizard trap springs"));
      return sprung ? [] : ${JSON.stringify(WIZARD_TRAPS)}.filter((id) => html.includes(id));
    })()`);
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/experiments/trap-placeholder/index.html` });
    await wait(`document.getElementById("status")?.textContent.startsWith("Status: accepting_input.") || document.getElementById("status")?.textContent.startsWith("Status: cpu_turn.")`);
    assert.match(await status(), /Scenario FIXTURE .*Wizard CPU: normal\./);

    for (const [scenario, level, seed] of [["BASE", "normal", 0], ["T1", "easy", 60], ["T2", "hard", 0]]) {
      // The select value is set by script with a change event (headless macOS
      // select popups are not driven here); Start is the real form submit.
      await evaluate(`(() => { for (const [id, v] of [["scenario", ${JSON.stringify(scenario)}], ["cpu-level", ${JSON.stringify(level)}]]) {
        const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); } })()`);
      assert.match(await status(), /Settings changed: they apply on Start\./, `${scenario}: pending note`);
      const logBefore = await evaluate(`document.querySelectorAll("#log li").length`);
      await evaluate(`document.getElementById("seed").value = "${seed}"; document.getElementById("seed-form").requestSubmit()`);
      await wait(`document.getElementById("status").textContent.includes("Seed ${seed}.") && document.getElementById("status").textContent.includes("Scenario ${scenario} ")`);
      const text = await status();
      assert.match(text, new RegExp(`Wizard CPU: ${level}\\.`));
      assert.equal(text.includes("Settings changed"), false);
      const logAfter = await evaluate(`document.querySelectorAll("#log li").length`);
      assert.ok(logBefore === 0 || logAfter < logBefore, `${scenario}: log cleared on the switch (${logBefore} -> ${logAfter})`);
      const counts = await evaluate(`["cowboy-info", "wizard-info"].map((id) => document.getElementById(id).textContent.match(/Deck (\\d+), hand (\\d+), discard (\\d+)/).slice(1).map(Number))`);
      for (const [deck, hand] of counts) assert.ok(deck + hand <= 12, `${scenario}: ${deck} + ${hand}`);
      const trapZone = await evaluate(`[document.getElementById("cowboy-trap").textContent, document.getElementById("wizard-trap").textContent]`);
      if (scenario === "BASE") assert.deepEqual(trapZone, ["Trap zone: traps not enabled in this scenario", "Enemy trap: traps not enabled in this scenario"]);
      else assert.ok(!trapZone[0].includes("not enabled") && /^Enemy trap: (none|set \(face-down\))$/.test(trapZone[1]), trapZone.join(" | "));

      // Play: set a synthetic trap when its hand button is enabled, otherwise end the phase.
      let restarted = false;
      let sets = 0;
      for (let moves = 0; !(await status()).startsWith("Status: terminal."); moves++) {
        assert.ok(moves < 80, `${scenario}: no result`);
        await wait(`/^Status: (accepting_input|terminal)\\./.test(document.getElementById("status").textContent)`);
        assert.deepEqual(await hiddenShown(), [], `${scenario}: hidden Wizard trap ID in the page`);
        if ((await status()).startsWith("Status: terminal.")) break;
        const setTrap = await evaluate(`(() => {
          const b = [...document.querySelectorAll("#hand button")].find((x) => x.textContent.startsWith("Placeholder deck trap") && !x.disabled);
          if (!b) return false;
          b.click();
          if (document.getElementById("confirm").disabled) return false;
          document.getElementById("confirm").click();
          return true;
        })()`);
        if (setTrap) sets++;
        if (!setTrap) {
          await evaluate(`document.getElementById("cancel").disabled || document.getElementById("cancel").click()`);
          await evaluate(`document.getElementById("end-phase").click()`);
        }
        await sleep(60);
        if (!restarted && moves === 2) {
          restarted = true;
          await evaluate(`document.getElementById("restart").click()`);
          await wait(`/Round 1 of/.test(document.getElementById("status").textContent)`);
          const again = await status();
          assert.ok(again.includes(`Seed ${seed}.`) && again.includes(`Scenario ${scenario} `) && again.includes(`Wizard CPU: ${level}.`), again);
        }
      }
      const final = await status();
      assert.match(final, /Result: (win|loss|draw)/);
      const logLines = await evaluate(`[...document.querySelectorAll("#log li")].map((li) => li.textContent)`);
      const springs = logLines.filter((line) => line.includes("trap springs")).length;
      if (scenario === "BASE") assert.equal(sets + springs, 0);
      t.diagnostic(`${scenario} ${level} seed ${seed}: ${final.match(/Result: [^.]*\./)[0]} Cowboy trap sets by click ${sets}, trap springs in log ${springs}, log lines ${logLines.length}`);
    }
    assert.deepEqual(errors, [], "no runtime exception or console error");
    t.diagnostic(`${(await cdp.send("Browser.getVersion")).product}; runtime errors ${errors.length}`);
  } finally {
    cdp.close();
    await chrome.close();
    server.close();
  }
});
