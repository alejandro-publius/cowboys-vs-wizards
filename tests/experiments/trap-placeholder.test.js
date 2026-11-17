// Issue #108: the local-only trap placeholder lab (experiments/trap-placeholder).
// Bounded checks of the lab's pure half against the shipped controller,
// scheduler and rules. Not part of npm test (verify-duel.mjs runs tests/game,
// tests/match and tests/assets). Run: node --test tests/experiments/trap-placeholder.test.js
// The fixture traps are synthetic; results here say nothing about balance.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createController } from "../../src/match/controller.js";
import { emptySelection } from "../../src/match/selection.js";
import {
  FIXTURE_TRAPS,
  LAB_CARDS,
  LAB_OPTIONS,
  commandList,
  createLab,
  createPlaceholderRenderer,
  eventLine,
  trapText,
} from "../../experiments/trap-placeholder/lab.js";

const SEEDS = [0, 60];
const STEP = 50;
const MAX_TICKS = 20000;
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function harness(cpuDelay) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const h = { scheduler, snapshots: [], viaInput: 0, viaCommand: 0, viaEnd: 0 };
  Object.assign(
    h,
    createLab({
      scheduler,
      cpuDelay,
      onChange() {
        const c = h.controller;
        h.snapshots.push(JSON.stringify({ status: c.status(), view: c.view(), displayed: c.displayed(), message: c.message(), options: c.options() }));
      },
    }),
  );
  return h;
}

// The Cowboy plays the CPU rule through the same paths the page uses: a
// trap set through selection clicks, summons and spells through the
// developer command list, end-phase through endPhase().
function actCowboy(h) {
  const c = h.controller;
  const view = c.view();
  const wanted = chooseAction(view, LAB_OPTIONS);
  if (wanted.type === "set-trap") {
    c.input({ type: "card", cardId: wanted.cardId });
    assert.equal(c.options().canConfirm, true);
    assert.deepEqual(c.input({ type: "confirm" }), { ok: true });
    h.viaInput += 1;
  } else if (wanted.type === "end-phase") {
    assert.deepEqual(c.endPhase(), { ok: true });
    h.viaEnd += 1;
  } else {
    const entry = commandList(view).find(({ action }) => JSON.stringify(action) === JSON.stringify(wanted));
    assert.ok(entry, `no command for ${JSON.stringify(wanted)}`);
    assert.deepEqual(c.submit(entry.action), { ok: true });
    h.viaCommand += 1;
  }
}

function play(h, stop = () => false) {
  for (let ticks = 0; ; ) {
    const status = h.controller.status();
    assert.notEqual(status, "error", h.controller.message());
    if (status === "terminal" || stop(h)) return;
    if (status === "accepting_input") {
      actCowboy(h);
      continue;
    }
    assert.ok(++ticks <= MAX_TICKS, "no result");
    h.scheduler.tick(h.scheduler.now() + STEP);
  }
}

function playSeed(seed) {
  const h = harness();
  assert.equal(h.controller.start(seed), true);
  play(h);
  return h;
}

test("seeds 0 and 60 play to a result through input, command list and endPhase; replays are identical", () => {
  const results = {};
  for (const seed of SEEDS) {
    const a = playSeed(seed);
    const b = playSeed(seed);
    assert.equal(a.controller.status(), "terminal");
    assert.deepEqual(b.events(), a.events(), `seed ${seed}`);
    assert.deepEqual(b.snapshots, a.snapshots, `seed ${seed}`);
    assert.equal(a.viaInput, 1, "the Cowboy set its fixture trap through selection clicks");
    assert.ok(a.viaCommand > 0 && a.viaEnd > 0);
    const types = a.events().map((event) => event.type);
    assert.ok(types.includes("trap-trigger"));
    // Every log line is readable text for the page.
    for (const event of a.events()) assert.notEqual(eventLine(event), event.type, event.type);
    results[seed] = { ...a.controller.view().result, events: types.length };
  }
  // Fixture-match receipt for these seeds under rules orb-duel-draft-1+traps.
  assert.deepEqual(results, {
    0: { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 5, outcome: "loss", events: 72 },
    60: { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 7, outcome: "loss", events: 106 },
  });
});

test("redaction: no Wizard hand, deck order, seed or rng in any view; the Wizard trap ID appears only after it springs", () => {
  for (const seed of SEEDS) {
    const h = playSeed(seed);
    const events = h.events();
    const sprung = events.findIndex((event) => event.type === "trap-trigger" && event.side === "wizard");
    assert.ok(sprung >= 0, `seed ${seed}: the Wizard trap sprang`);
    const set = events.find((event) => event.type === "trap-set" && event.side === "wizard");
    assert.equal(Object.hasOwn(set, "cardId"), false);
    assert.equal(JSON.stringify(events.slice(0, sprung)).includes(FIXTURE_TRAPS.wizard), false);
    for (const snap of h.snapshots) {
      const { view, displayed, message, options } = JSON.parse(snap);
      assert.equal(JSON.stringify({ message, options }).includes(FIXTURE_TRAPS.wizard), false);
      for (const shown of [view, displayed]) {
        if (!shown) continue;
        assert.equal(Object.hasOwn(shown.sides.wizard, "hand"), false);
        for (const key of ["deck", "seed", "rng"]) {
          assert.equal(Object.hasOwn(shown, key) || Object.hasOwn(shown.sides.wizard, key), false, key);
        }
        // Checked per object: displayed() may lag view() during playback.
        if (JSON.stringify(shown).includes(FIXTURE_TRAPS.wizard)) assert.equal(shown.sides.wizard.trap, null);
      }
      if (view?.sides.wizard.trap) assert.equal(trapText(view, "wizard"), "Enemy trap: set (face-down)");
    }
    assert.ok(h.snapshots.some((snap) => JSON.parse(snap).view?.sides.wizard.trap?.faceDown === true), "face-down marker shown");
  }
});

test("cancel applies nothing; restart and leave drop a queued CPU step", () => {
  const h = harness();
  h.controller.start(0);
  play(h, () => h.controller.status() === "accepting_input");
  const c = h.controller;
  const before = h.events().length;
  c.input({ type: "card", cardId: FIXTURE_TRAPS.cowboy });
  assert.equal(c.selection().step, "confirm");
  c.input({ type: "cancel" });
  assert.equal(c.selection(), emptySelection);
  assert.equal(h.events().length, before);

  // End the phase so the Wizard's CPU step is queued, then restart before it runs.
  assert.deepEqual(c.endPhase(), { ok: true });
  play(h, () => h.controller.status() === "cpu_turn");
  assert.equal(c.status(), "cpu_turn");
  c.restart();
  assert.equal(c.seed(), 0);
  const fresh = harness();
  fresh.controller.start(0);
  for (const each of [h, fresh]) play(each, () => each.controller.status() === "accepting_input");
  assert.deepEqual(h.events(), fresh.events());
  assert.deepEqual(c.view(), fresh.controller.view());

  assert.deepEqual(c.endPhase(), { ok: true });
  play(h, () => h.controller.status() === "cpu_turn");
  const queued = h.events().length;
  c.leave();
  assert.equal(c.status(), "idle");
  for (let i = 0; i < 100; i++) h.scheduler.tick(h.scheduler.now() + STEP);
  assert.equal(h.events().length, queued, "no action after leave");
  assert.equal(h.scheduler.pending(), 0);
});

test("the command list is exactly the legal summons and spells, labelled from the catalog, and each dispatches", () => {
  for (const seed of SEEDS) {
    const h = harness();
    h.controller.start(seed);
    play(h, () => h.controller.status() === "accepting_input" && commandList(h.controller.view()).some(({ action }) => action.type === "spell"));
    const view = h.controller.view();
    const commands = commandList(view);
    const legal = legalActions(view, "cowboy", LAB_OPTIONS).filter((action) => action.type === "summon" || action.type === "spell");
    assert.deepEqual(commands.map(({ action }) => action), legal);
    const names = new Set(Object.values(CARDS).map((card) => card.name));
    for (const { label, action } of commands) {
      assert.ok(names.has(CARDS[action.cardId].name) && label.includes(CARDS[action.cardId].name), label);
    }
    const spell = commands.find(({ action }) => action.type === "spell");
    assert.deepEqual(h.controller.submit(spell.action), { ok: true }, `seed ${seed}`);
    assert.equal(h.events().find((event) => event.type === "spell" && event.caster === "cowboy")?.cardId, spell.action.cardId);
    assert.deepEqual(commandList(h.controller.view()), [], "nothing offered while playing");
  }
});

test("placeholder renderer covers the Presenter interface with finite times", () => {
  const renderer = createPlaceholderRenderer();
  for (const name of ["reset", "clear", "setTroopOrbs", "setBaseOrbs", "clashReady"]) assert.equal(typeof renderer[name], "function");
  for (const name of ["summon", "attack", "spell"]) {
    const cue = renderer[name]({});
    assert.ok(Number.isFinite(cue.impact) && Number.isFinite(cue.end) && cue.impact <= cue.end, name);
  }
  for (const name of ["remove", "move"]) assert.ok(Number.isFinite(renderer[name]({}).end), name);
});

test("no production change: CARDS, DECKS and the flag-off default match are untouched", () => {
  assert.equal(Object.values(CARDS).some((card) => card.kind === "trap"), false);
  for (const id of Object.values(FIXTURE_TRAPS)) {
    assert.equal(Object.hasOwn(CARDS, id), false);
    for (const side of SIDES) assert.equal(DECKS[side].includes(id), false);
  }
  for (const id of Object.keys(CARDS)) assert.equal(LAB_CARDS[id], CARDS[id]);
  assert.equal(Object.keys(LAB_CARDS).length, Object.keys(CARDS).length + 2);
  for (const side of SIDES) assert.equal(DECKS[side].length, 12);

  for (const seed of SEEDS) {
    const state = createMatch(seed);
    assert.equal(Object.hasOwn(state, "traps"), false);
    assert.equal(Object.hasOwn(publicState(state, "cowboy"), "traps"), false);
    // The default controller still starts on the shipped rules.
    const scheduler = createScheduler();
    const c = createController({ scheduler, renderer: createPlaceholderRenderer() });
    c.start(seed);
    assert.deepEqual(c.view(), publicState(state, "cowboy"));
  }
});

test("the page is local and plain: native controls, no remote URL, no URL flag, no main-game link", () => {
  const html = read("experiments/trap-placeholder/index.html");
  const app = read("experiments/trap-placeholder/app.js");
  for (const text of [html, app]) assert.equal(/https?:\/\//.test(text), false);
  assert.match(html, /<script type="module" src="app.js">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Experimental, synthetic, local only/);
  assert.equal(/location\.|URLSearchParams/.test(app), false, "no URL flag");
  assert.equal(/\binnerHTML\b/.test(app), false);
  for (const shipped of ["src/main.js", "index.html"]) {
    let text = "";
    try {
      text = read(shipped);
    } catch {}
    assert.equal(text.includes("trap-placeholder"), false, shipped);
  }
});
