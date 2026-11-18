// Issue #131: Node checks of scripts/browser-trap-parity-131.mjs. No browser
// is launched here; the real-Chrome comparison runs only from the script.
// This file checks the Node mirror (T1 lab engine, normal Wizard CPU) on
// seeds 0 and 60, and that the DOM comparator and redaction check catch
// wrong fields. `fakeDom` below is a test-only copy of the strings that
// experiments/trap-placeholder/app.js render() writes; if app.js changes its
// wording, the real-Chrome run of the script is the authority.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SIDES } from "../../src/game/cards.js";
import { MAX_ROUNDS } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { commandList, eventLine } from "../../experiments/trap-placeholder/lab.js";
import {
  CPU_LEVEL, SCENARIO, breakLineOf, checkRedaction, compareDomToView, compareSnapshot,
  SEED_KITS, createMirror, decideInput, hiddenWizardIds, parseArgs, readDom, trapOpportunity,
} from "../../scripts/browser-trap-parity-131.mjs";
import { layoutOf, pickSeeds, roundForPosition } from "../../experiments/trap-playtest-kit/seeds.js";

const glyphs = (n, max) => "\u25cf".repeat(Math.max(0, n)) + "\u25cb".repeat(Math.max(0, max - n));

// Issue #132: the lab's phase wording, "none" once activeSide is null.
const phaseLabel = (side) => (side === "cowboy" ? "Cowboy" : side === "wizard" ? "Wizard" : "none");

// Test-only rendering of a view in the lab's wording (see the header note).
function fakeDom(view, status, seed, cards, events) {
  const result = view.result ? ` Result: ${view.result.outcome} (${view.result.reason}).` : "";
  const info = (side) => {
    const s = view.sides[side];
    const text = `Base life orbs ${s.baseOrbs} of 5 ${glyphs(s.baseOrbs, 5)}. Deck ${s.deckCount}, hand ${s.handCount}, discard ${s.discard.length}.`;
    if (side !== "cowboy") return text;
    const a = view.allowances.cowboy;
    return `${text} Summon used: ${a.summonUsed ? "yes" : "no"}. Spell or trap used: ${a.castUsed ? `yes (${a.tactical ?? "spell"})` : "no"}.`;
  };
  const lane = (side, slot) => {
    const owner = side === "cowboy" ? "Your" : "Enemy";
    const troop = view.sides[side].board[slot];
    if (!troop) return `${owner} lane ${slot + 1}: empty`;
    const card = cards[troop.cardId];
    return `${owner} lane ${slot + 1}: ${card.name}\nHealth ${troop.health} of ${card.health} ${glyphs(troop.health, card.health)}\nAttack ${card.attack}`;
  };
  const trap = (side) => {
    const t = view.sides[side].trap;
    if (side === "wizard") return t ? "Enemy trap: set (face-down)" : "Enemy trap: none";
    if (!t) return "Trap zone: empty";
    return `${cards[t.cardId].name}. ${t.setRound < view.round ? "Trap armed. It springs at the next clash if the enemy has a troop." : "Trap set. It springs from next round."}`;
  };
  const hand = view.sides.cowboy.hand.map((id, i) => {
    const c = cards[id];
    const stats = c.kind === "troop" ? ` (${c.stars} stars, attack ${c.attack}, health ${c.health})` : ` (${c.kind})`;
    return { text: `${c.name}${stats}`, key: `${id}-${i}`, disabled: false, pressed: "false" };
  });
  return {
    status: `Status: ${status}. Seed ${seed}. Round ${view.round} of ${MAX_ROUNDS}. Phase: ${phaseLabel(view.activeSide)}.${result} Scenario T1 (x). Wizard CPU: normal. `,
    info: Object.fromEntries(SIDES.map((s) => [s, info(s)])),
    trap: Object.fromEntries(SIDES.map((s) => [s, trap(s)])),
    lanes: Object.fromEntries(SIDES.map((s) => [s, [0, 1, 2].map((slot) => ({ text: lane(s, slot), disabled: true }))])),
    hand,
    commands: [],
    log: events.map(eventLine),
    html: `<html><body>${hand.map((h) => `<button data-key="${h.key}">${h.text}</button>`).join("")}</body></html>`,
  };
}

// Node-only play of one seed with the script's policy; one record per stable point.
function playMirror(seed) {
  const mirror = createMirror(seed);
  const points = [];
  const inputs = [];
  const record = () => {
    const s = mirror.snapshot();
    points.push({ snapshot: structuredClone(s), full: structuredClone(mirror.full()) });
    return s;
  };
  let s = record();
  while (s.status !== "terminal") {
    assert.ok(inputs.length < 150, `seed ${seed}: no result`);
    const input = decideInput({ view: s.view, options: s.options, commands: commandList(s.view, mirror.cards).map((e) => e.label) });
    assert.equal(mirror.apply(input)?.ok, true, `seed ${seed}: ${JSON.stringify(input)} accepted`);
    inputs.push(input);
    s = record();
  }
  return { mirror, points, inputs };
}

// A page read built from a mirror point (what the browser read returns).
const pageOf = ({ snapshot, full }, cards) => ({
  status: snapshot.status, seed: snapshot.seed, settings: { scenario: SCENARIO, cpuLevel: CPU_LEVEL },
  view: snapshot.view, displayed: snapshot.displayed, options: snapshot.options, events: snapshot.events,
  dom: fakeDom(snapshot.displayed ?? snapshot.view, snapshot.status, snapshot.seed, cards, snapshot.events),
  full,
});

test("arguments: seeds 0 and 60 by default; bad seeds and unknown flags are refused", () => {
  assert.deepEqual(parseArgs([]), { seeds: [0, 60], out: null });
  assert.deepEqual(parseArgs(["--seeds", "7", "--out", "r.json"]), { seeds: [7], out: "r.json" });
  assert.throws(() => parseArgs(["--seeds", "-1"]), /--seeds/);
  assert.throws(() => parseArgs(["--seeds", "4294967296"]), /--seeds/);
  assert.throws(() => parseArgs(["--fast"]), /unknown argument/);
});

test("--seed-kit t1 is the #120 kit's six seeds in category order; it excludes --seeds (issue #135)", () => {
  assert.deepEqual(SEED_KITS.t1, pickSeeds().picks.map((p) => p.seed));
  assert.deepEqual(parseArgs(["--seed-kit", "t1"]), { seeds: [55, 9, 2, 23, 7, 43], out: null, seedKit: "t1" });
  assert.deepEqual(parseArgs(["--seed-kit", "t1", "--out", "r.json"]).out, "r.json");
  assert.throws(() => parseArgs(["--seed-kit", "t2"]), /unknown kit/);
  assert.throws(() => parseArgs(["--seed-kit", "t1", "--seeds", "0"]), /exclusive/);
  assert.throws(() => parseArgs(["--seeds", "0", "--seed-kit", "t1"]), /exclusive/);
});

test("trapOpportunity separates set, drawn, not reached and not drawn (issue #135)", () => {
  assert.equal(trapOpportunity({ scheduledRound: 1, firstSeenRound: 1, cowboyTrapSet: true, rounds: 5 }).outcome, "set");
  assert.equal(trapOpportunity({ scheduledRound: 4, firstSeenRound: 4, cowboyTrapSet: false, rounds: 5 }).outcome, "drawn-not-set");
  const late = trapOpportunity({ scheduledRound: 8, firstSeenRound: null, cowboyTrapSet: false, rounds: 6 });
  assert.equal(late.outcome, "not-reached");
  assert.match(late.text, /^conditional: .*round 8.*round 6/);
  assert.equal(trapOpportunity({ scheduledRound: 4, firstSeenRound: null, cowboyTrapSet: false, rounds: 5 }).outcome, "not-drawn");
});

test("the page read pauses on the last line of render() in the lab app.js", () => {
  const source = readFileSync(new URL("../../experiments/trap-placeholder/app.js", import.meta.url), "utf8");
  const line = breakLineOf(source);
  const lines = source.split("\n");
  const start = lines.indexOf("function render() {");
  assert.ok(start >= 0 && start < line, "render() starts before the break line");
  assert.equal(lines[line + 1], "}", "the break line is the last statement of render()");
  assert.throws(() => breakLineOf("function render() {\n}\n"), /found 0/);
});

for (const seed of [0, 60]) {
  test(`seed ${seed}: the T1 mirror is deterministic, every action is accepted, and every stable point compares clean`, () => {
    const a = playMirror(seed);
    const b = playMirror(seed);
    assert.deepEqual(b.inputs, a.inputs);
    assert.deepEqual(b.mirror.events(), a.mirror.events());
    assert.deepEqual(b.points.map((p) => p.snapshot.view), a.points.map((p) => p.snapshot.view));
    const events = a.mirror.events();
    assert.ok(a.inputs.some((i) => i.type === "command" || i.type === "confirm"), "at least one legal Cowboy action beyond End phase");
    for (const point of a.points) {
      const page = pageOf(point, a.mirror.cards);
      const findings = [];
      assert.deepEqual(compareSnapshot(page, point.snapshot, point.full, a.mirror.cards, findings), [], `seed ${seed} revision ${point.snapshot.view.revision}`);
      assert.deepEqual(point.snapshot.view, publicState(point.full, "cowboy"));
      assert.deepEqual(findings, [], "no known display gap remains (issue #132)");
    }
    if (seed === 0) {
      assert.equal(events.filter((e) => e.type === "trap-set" && e.side === "wizard").length, 1, "Wizard sets its trap on seed 0");
      assert.ok(a.points.some((p) => p.full.sides.wizard.trap), "a stable point holds a hidden Wizard trap");
      assert.ok(events.some((e) => e.type === "trap-trigger" && e.side === "wizard"));
    } else {
      assert.ok(a.inputs.some((i) => i.type === "card") && a.inputs.some((i) => i.type === "confirm"), "Cowboy sets its trap by card and Confirm");
      assert.ok(events.some((e) => e.type === "trap-set" && e.side === "cowboy" && e.cardId === "test-fixture-deck-trap-cowboy-2"));
    }
  });
}

test("the comparator catches a wrong visible lane, base, count, round, phase or hand field", () => {
  const { mirror, points } = playMirror(60);
  const point = points.find((p) => p.snapshot.status === "accepting_input" && SIDES.every((s) => p.snapshot.view.sides[s].board.some(Boolean)));
  assert.ok(point, "a point with troops on both sides");
  const page = pageOf(point, mirror.cards);
  const opts = { status: page.status, seed: page.seed };
  assert.deepEqual(compareDomToView(page.dom, page.view, mirror.cards, opts), []);
  const slot = page.view.sides.wizard.board.findIndex(Boolean);
  const mutate = (fn) => { const dom = structuredClone(page.dom); fn(dom); return compareDomToView(dom, page.view, mirror.cards, opts); };
  const cases = {
    health: (d) => (d.lanes.wizard[slot].text = d.lanes.wizard[slot].text.replace(/Health (\d+)/, (_, h) => `Health ${Number(h) + 1}`)),
    attack: (d) => (d.lanes.wizard[slot].text = d.lanes.wizard[slot].text.replace(/Attack (\d+)/, (_, x) => `Attack ${Number(x) + 1}`)),
    glyphs: (d) => (d.lanes.wizard[slot].text = d.lanes.wizard[slot].text.replace("\u25cf", "\u25cb")),
    name: (d) => (d.lanes.wizard[slot].text = d.lanes.wizard[slot].text.replace(/: [^\n]+\n/, ": Somebody\n")),
    emptied: (d) => (d.lanes.wizard[slot].text = `Enemy lane ${slot + 1}: empty`),
    base: (d) => (d.info.cowboy = d.info.cowboy.replace(/Base life orbs (\d)/, (_, b) => `Base life orbs ${Number(b) - 1}`)),
    deck: (d) => (d.info.wizard = d.info.wizard.replace(/Deck (\d+)/, (_, n) => `Deck ${Number(n) + 1}`)),
    round: (d) => (d.status = d.status.replace(/Round (\d+)/, (_, r) => `Round ${Number(r) + 1}`)),
    phase: (d) => (d.status = d.status.replace("Phase: Cowboy", "Phase: Wizard")),
    hand: (d) => d.hand.pop(),
    unparsed: (d) => (d.status = "Status: ?"),
  };
  for (const [name, fn] of Object.entries(cases)) assert.ok(mutate(fn).length > 0, `${name} mismatch caught`);
});

test("terminal status line: activeSide null reads Phase: none, never Wizard, and the comparator is strict (issue #132)", () => {
  const source = readFileSync(new URL("../../experiments/trap-placeholder/app.js", import.meta.url), "utf8");
  assert.equal(source.includes('view.activeSide === VIEWER ? "Cowboy" : "Wizard"'), false, "app.js no longer infers the Wizard from a non-Cowboy side");
  assert.match(source, /Phase: \$\{phaseLabel\(view\.activeSide\)\}\./);
  assert.match(source, /return "none";/);
  for (const seed of [0, 60]) {
    const { mirror, points } = playMirror(seed);
    const end = points.at(-1);
    assert.equal(end.snapshot.status, "terminal");
    const view = end.snapshot.displayed ?? end.snapshot.view;
    assert.equal(view.activeSide, null, `seed ${seed}: engine view has no active side at the result`);
    assert.ok(view.result, `seed ${seed}: terminal view has a result`);
    const page = pageOf(end, mirror.cards);
    assert.match(page.dom.status, /Phase: none\. Result: /);
    assert.equal(page.dom.status.includes("Phase: Wizard"), false);
    assert.equal(readDom(page.dom).status.phase, null);
    const opts = { status: page.status, seed: page.seed };
    const findings = [];
    assert.deepEqual(compareDomToView(page.dom, view, mirror.cards, { ...opts, findings }), []);
    assert.deepEqual(findings, []);
    // The old wording is now a strict mismatch, not a known finding.
    const old = structuredClone(page.dom);
    old.status = old.status.replace("Phase: none.", "Phase: Wizard.");
    const oldFindings = [];
    const diffs = compareDomToView(old, view, mirror.cards, { ...opts, findings: oldFindings });
    assert.deepEqual(diffs, ['phase: DOM "wizard" vs view null']);
    assert.deepEqual(oldFindings, []);
    const cowboy = structuredClone(page.dom);
    cowboy.status = cowboy.status.replace("Phase: none.", "Phase: Cowboy.");
    assert.deepEqual(compareDomToView(cowboy, view, mirror.cards, opts), ['phase: DOM "cowboy" vs view null']);
  }
  // Live phases keep their labels.
  const { mirror, points } = playMirror(60);
  const live = points.find((p) => p.snapshot.status === "accepting_input");
  assert.equal(live.snapshot.view.activeSide, "cowboy");
  assert.match(pageOf(live, mirror.cards).dom.status, /Phase: Cowboy\./);
  const wizardView = { ...live.snapshot.view, activeSide: "wizard" };
  assert.equal(readDom(fakeDom(wizardView, "cpu_turn", 60, mirror.cards, [])).status.phase, "wizard");
});

test("redaction: a revealed Wizard trap, ID or trap-set cardId is caught; the engine's hidden trap is never in the view", () => {
  const { mirror, points } = playMirror(0);
  const point = points.find((p) => p.full.sides.wizard.trap);
  const page = pageOf(point, mirror.cards);
  const trapId = point.full.sides.wizard.trap.cardId;
  assert.equal(trapId, "test-fixture-deck-trap-wizard-2");
  assert.ok(hiddenWizardIds(point.full).includes(trapId));
  assert.deepEqual(page.view.sides.wizard.trap, { faceDown: true, setRound: point.full.sides.wizard.trap.setRound });
  assert.equal(JSON.stringify(page.view).includes(trapId), false);
  assert.deepEqual(checkRedaction(page, point.full), []);

  const leaked = (fn) => { const copy = structuredClone(page); fn(copy); return checkRedaction(copy, point.full); };
  assert.ok(leaked((p) => (p.view.sides.wizard.trap = { cardId: trapId, setRound: 1 })).length > 0, "card ID in the view");
  assert.ok(leaked((p) => (p.dom.trap.wizard = "Placeholder deck trap (synthetic). Trap set.")).length > 0, "named in the DOM");
  assert.ok(leaked((p) => (p.dom.html += `<i>${trapId}</i>`)).length > 0, "ID in the HTML");
  assert.ok(leaked((p) => (p.dom.html += `<i>${point.full.sides.wizard.deck[0]}</i>`)).length > 0, "Wizard deck ID in the HTML");
  assert.ok(leaked((p) => (p.view.sides.wizard.hand = point.full.sides.wizard.hand)).length > 0, "Wizard hand in the view");
  assert.ok(leaked((p) => p.events.push({ type: "trap-set", side: "wizard", revision: 1, cardId: trapId })).length > 0, "trap-set cardId");
  assert.ok(leaked((p) => (p.view.sides.wizard.trap = null)).length > 0, "hidden trap dropped from the view");
});

// Issue #135: the expected Node-mirror outcome of each T1 kit seed under the
// script's policy and normal Wizard CPU. The Chrome run must reproduce these;
// they are fixed-policy regression values, not balance or playtest results.
const KIT_EXPECTED = {
  55: { result: "win", rounds: 5, trap: "set", cowboySet: 1, wizardSet: 1, cowboyTriggers: 1, wizardTriggers: 1 },
  9: { result: "loss", rounds: 6, trap: "set", cowboySet: 1, wizardSet: 1, cowboyTriggers: 1, wizardTriggers: 1 },
  2: { result: "loss", rounds: 5, trap: "set", cowboySet: 1, wizardSet: 1, cowboyTriggers: 1, wizardTriggers: 1 },
  23: { result: "loss", rounds: 5, trap: "set", cowboySet: 1, wizardSet: 1, cowboyTriggers: 1, wizardTriggers: 1 },
  7: { result: "loss", rounds: 6, trap: "not-reached", cowboySet: 0, wizardSet: 1, cowboyTriggers: 0, wizardTriggers: 0 },
  43: { result: "loss", rounds: 5, trap: "not-reached", cowboySet: 0, wizardSet: 0, cowboyTriggers: 0, wizardTriggers: 0 },
};

test("T1 seed kit: each seed's mirror is deterministic, compares clean at every stable point and matches its pinned outcome (issue #135)", () => {
  assert.deepEqual(Object.keys(KIT_EXPECTED).map(Number).sort((x, y) => x - y), [...SEED_KITS.t1].sort((x, y) => x - y));
  for (const seed of SEED_KITS.t1) {
    const a = playMirror(seed);
    const b = playMirror(seed);
    assert.deepEqual(b.inputs, a.inputs, `seed ${seed} inputs`);
    assert.deepEqual(b.mirror.events(), a.mirror.events(), `seed ${seed} events`);
    for (const point of a.points) {
      assert.deepEqual(compareSnapshot(pageOf(point, a.mirror.cards), point.snapshot, point.full, a.mirror.cards), [], `seed ${seed} revision ${point.snapshot.view.revision}`);
    }
    const events = a.mirror.events();
    const count = (type, side) => events.filter((e) => e.type === type && e.side === side).length;
    const last = a.points.at(-1).snapshot.view;
    const seen = a.points.find((p) => p.snapshot.view.sides.cowboy.hand.some((id) => id.includes("deck-trap-cowboy")));
    const opp = trapOpportunity({
      scheduledRound: roundForPosition(layoutOf(seed).trap), firstSeenRound: seen ? seen.snapshot.view.round : null,
      cowboyTrapSet: count("trap-set", "cowboy") > 0, rounds: last.round,
    });
    const want = KIT_EXPECTED[seed];
    assert.deepEqual(
      { result: last.result.outcome, rounds: last.round, trap: opp.outcome, cowboySet: count("trap-set", "cowboy"), wizardSet: count("trap-set", "wizard"),
        cowboyTriggers: count("trap-trigger", "cowboy"), wizardTriggers: count("trap-trigger", "wizard") },
      want, `seed ${seed}`);
    if (want.wizardSet) assert.ok(a.points.some((p) => p.full.sides.wizard.trap), `seed ${seed}: a stable point holds a hidden Wizard trap`);
  }
});
