// Guided first match (src/match/guide.js), issue #35. Every case uses the real
// seed 0 starter match through applyAction, publicState and the selection
// module. Test names carry the requirement IDs of
// .kiro/specs/guided-first-match/requirements.md. GF-8 (player notes) and
// GF-9 (verify-duel) are not unit tests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { emptySelection, selectionOptions, selectionStep } from "../../src/match/selection.js";
import { guideLine, guideProgress, trackGuide } from "../../src/match/guide.js";
import { cardModel } from "../../src/ui/card-model.js";

const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const idOf = (view, name) => view.sides.cowboy.hand.find((id) => CARDS[id].name === name);

// One walk of seed 0: the Cowboy plays by selection clicks, the Wizard by
// chooseAction. `plan(view)` returns the click list for the Cowboy phase.
// Returns every {step, prompt, line, view, options} the Cowboy saw, in order.
function walk(plan, { rounds = 3, seed = 0 } = {}) {
  let state = createMatch(seed);
  let progress = guideProgress();
  let n = 0;
  const seen = [];
  const apply = (action) => {
    const r = applyAction(state, { ...action, actionId: `t${++n}` });
    assert.ok(r.ok, `rejected: ${r.reason}`);
    state = r.state;
    progress = trackGuide(progress, r.events);
  };
  const look = (selection) => {
    const view = publicState(state, "cowboy");
    const options = selectionOptions(selection, view);
    seen.push({ step: options.step, prompt: options.prompt, line: guideLine({ view, options, progress }), view, options, progress });
  };
  while (!state.result && state.round <= rounds) {
    if (state.activeSide === "wizard") {
      apply(chooseAction(publicState(state, "wizard")));
      continue;
    }
    let selection = emptySelection;
    look(selection);
    for (const input of plan(publicState(state, "cowboy"))) {
      const view = publicState(state, "cowboy");
      const step = selectionStep(selection, input, view, { accepting: true, newActionId: () => `t${++n}` });
      if (step.action) {
        const r = applyAction(state, step.action);
        assert.ok(r.ok);
        state = r.state;
        progress = trackGuide(progress, r.events);
        selection = emptySelection;
      } else selection = step.selection;
      if (state.activeSide === "cowboy" && !state.result) look(selection);
    }
    if (state.activeSide === "cowboy" && !state.result) apply(legalActions(publicState(state, "cowboy"), "cowboy").find((a) => a.type === "end-phase"));
  }
  return seen;
}

// Round 1: Sheriff to lane 1. Round 2: Billy with the Sheriff as tribute into lane 1.
const route = (view) => {
  const sheriff = idOf(view, "Sheriff");
  const billy = idOf(view, "Billy");
  if (view.round === 1) return [{ type: "card", cardId: sheriff }, { type: "slot", side: "cowboy", slot: 0 }, { type: "confirm" }];
  if (view.round === 2) {
    return [{ type: "card", cardId: billy }, { type: "slot", side: "cowboy", slot: 0 }, { type: "slot", side: "cowboy", slot: 0 }, { type: "confirm" }];
  }
  return [];
};

const lines = (seen) => seen.map((s) => s.line);

test("GF-1: lines cover choose card, lane, confirm, end phase, first clash result and tribute summon in order", () => {
  const seen = walk(route);
  assert.deepEqual(lines(seen).slice(0, 8), [
    "Choose a glowing card in your hand to summon a troop or cast a spell, or end your phase.",
    "Pick one of your open lanes (lane 1, lane 2, lane 3) for Sheriff.",
    "Confirm to summon Sheriff, or cancel to choose again.",
    "You have no playable card, so end your phase to start the clash.",
    "The round 1 clash: Your Sheriff in lane 1 hit the Skeleton: 3 → 2 orbs (and 1 more event).",
    "Choose 1 of your troops to sacrifice for Billy, then pick a lane.",
    "Pick one of your open lanes (lane 1, lane 2, lane 3) for Billy.",
    "Confirm to summon Billy, or cancel to choose again.",
  ]);
  assert.equal(lines(seen)[8], "You have already summoned this round, so cast a spell or end your phase.");
});

test("GF-1: the tribute line is offered at the idle step when a tribute card is playable and none was summoned", () => {
  const seen = walk((view) => (view.round === 1 ? route(view) : []));
  const round2 = seen.filter((s) => s.view.round === 2);
  // Unused allowances show the clash result; the tribute line follows once chosen, so check the function directly.
  const { view, options, progress } = round2[0];
  const spent = structuredClone(view);
  spent.allowances.cowboy.castUsed = true;
  assert.match(guideLine({ view: spent, options, progress }), /^Billy is playable and costs 1 friendly troop to sacrifice, so choose it for your first tribute summon\.$/);
});

test("GF-2: each line is one sentence in game vocabulary and true for the board", () => {
  const vocabulary = text("src/ui/title-menu.js") + text("src/match/selection.js") + text("src/match/clash-log.js");
  const seen = walk(route).filter((s) => s.view.round <= 2);
  for (const { line, view, options } of seen) {
    assert.ok(line, "a line at every step of rounds 1 and 2");
    assert.equal((line.match(/[.!?]/g) ?? []).length, 1, line);
    assert.ok(line.endsWith("."), line);
    for (const term of ["glowing card", "sacrifice", "lane", "Confirm", "end your phase", "clash", "cancel"]) {
      if (line.includes(term)) assert.ok(vocabulary.includes(term) || vocabulary.toLowerCase().includes(term.toLowerCase()), term);
    }
    if (options.step === "slot") assert.ok(line.includes(options.ownSlots.map((s) => `lane ${s + 1}`).join(", ")));
    if (options.cardId) assert.ok(view.sides.cowboy.hand.includes(options.cardId) && line.includes(CARDS[options.cardId].name));
  }
  const clash = seen.find((s) => s.view.round === 2 && s.step === "idle").line;
  assert.ok(clash.includes("Sheriff") && clash.includes("Skeleton"));
});

test("GF-3: stops after round two and the first tribute summon, and at the result", () => {
  const withTribute = walk(route, { rounds: 4 });
  const late = withTribute.filter((s) => s.view.round >= 3);
  assert.ok(late.length > 0);
  assert.ok(late.every((s) => s.line === null));
  assert.ok(withTribute.filter((s) => s.view.round === 2).every((s) => s.line !== null));
  // No tribute summon in round 2: the guide goes on after round two.
  const without = walk((view) => (view.round === 1 ? route(view) : []), { rounds: 3 });
  assert.ok(without.filter((s) => s.view.round === 3).every((s) => s.line !== null && !s.progress.tributeSummoned));
  // Terminal state.
  const view = publicState(createMatch(0), "cowboy");
  const options = selectionOptions(emptySelection, view);
  assert.equal(guideLine({ view: { ...view, result: { outcome: "win" } }, options, progress: guideProgress() }), null);
  assert.equal(guideLine({ view: { ...view, activeSide: "wizard" }, options, progress: guideProgress() }), null);
});

test("GF-3: a fresh progress record (restart) gives the opening line again", () => {
  const view = publicState(createMatch(0), "cowboy");
  const options = selectionOptions(emptySelection, view);
  const used = trackGuide(guideProgress(), [{ type: "summon", side: "cowboy", cardId: "x", slot: 0, tributes: [0] }]);
  assert.equal(used.tributeSummoned, true);
  assert.equal(guideProgress().tributeSummoned, false);
  assert.ok(guideLine({ view, options, progress: guideProgress() }).startsWith("Choose a glowing card"));
});

test("GF-4: the line does not change with the Wizard hand or deck and names no hidden card", () => {
  const state = createMatch(0);
  const other = structuredClone(state);
  other.sides.wizard.hand = [...state.sides.wizard.deck.slice(0, state.sides.wizard.hand.length)];
  other.sides.wizard.deck = [...state.sides.wizard.deck.slice(state.sides.wizard.hand.length), ...state.sides.wizard.hand];
  const names = state.sides.wizard.hand.map((id) => CARDS[id].name);
  assert.notDeepEqual(state.sides.wizard.hand, other.sides.wizard.hand);
  for (const s of [state, other]) {
    const view = publicState(s, "cowboy");
    const options = selectionOptions(emptySelection, view);
    const line = guideLine({ view, options, progress: guideProgress() });
    assert.equal(line, "Choose a glowing card in your hand to summon a troop or cast a spell, or end your phase.");
    for (const name of names) assert.ok(!line.includes(name), `${name} in "${line}"`);
  }
  for (const { line } of walk(route).filter((s) => s.view.round <= 2)) for (const name of ["Wizard", "Dragon", "Singularity"]) assert.ok(!line.includes(name), line);
});

test("GF-5: the guide changes no view, option or legal action and makes no move", () => {
  for (const { view, options, progress } of walk(route)) {
    const before = structuredClone({ view, options, progress });
    const legal = legalActions(view, "cowboy");
    const line = guideLine({ view, options, progress });
    assert.ok(line === null || typeof line === "string");
    assert.deepEqual({ view, options, progress }, before);
    assert.deepEqual(legalActions(view, "cowboy"), legal);
    assert.deepEqual(selectionOptions(emptySelection, view).playableCardIds, selectionOptions(emptySelection, structuredClone(view)).playableCardIds);
  }
});

test("GF-6: the line is in the model prompt, which cards.js renders in the role=status element", () => {
  const { view, options, line } = walk(route)[0];
  const model = cardModel({ displayed: view, options, status: "accepting_input", seed: 0, seedPinned: true, guide: line });
  assert.equal(model.prompt, `${options.prompt} ${line}`);
  assert.match(text("src/ui/cards.js"), /class: "match-prompt", role: "status"/);
  assert.match(text("src/ui/cards.js"), /setText\(prompt, model\.prompt\)/);
  // Not announced while input is not accepted.
  assert.equal(cardModel({ displayed: view, options, status: "cpu_turn", guide: line }).prompt, "The Wizard is choosing a move…");
});

test("GF-7: without guide the prompt is byte-identical at every seed 0 selection step", () => {
  for (const { view, options } of walk(route, { rounds: 4 })) {
    const base = { displayed: view, options, status: "accepting_input", seed: 0, seedPinned: true };
    const off = cardModel(base).prompt;
    assert.equal(off, options.prompt);
    assert.equal(cardModel({ ...base, guide: null }).prompt, off);
    assert.equal(cardModel({ ...base, guide: "" }).prompt, off);
    assert.equal(JSON.stringify(cardModel({ ...base, guide: null })), JSON.stringify(cardModel(base)));
  }
  assert.ok(!/guide/.test(text("src/match/selection.js")));
  assert.match(text("src/main.js"), /get\("guide"\)==="1"/);
});
