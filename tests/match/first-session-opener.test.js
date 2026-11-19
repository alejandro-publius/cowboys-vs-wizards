// First-session opening duel (Fable 5.2 brief,
// .artifacts/coordination/first-ten-minutes-kiro-brief.md, acceptance cases 1
// and 2): How to Play → Start guided duel deals seed 690 with the starter deck
// against the Normal Wizard (chooseAction), and the fixed block and race click
// scripts end as the brief lists. The Cowboy plays through selection clicks;
// lanes in the brief are 1-based, slots here are 0-based.
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
import { guideLine, guideProgress, OPENER_TIP } from "../../src/match/guide.js";

const SEED = 690;
const graybox = readFileSync(new URL("../../src/graybox.js", import.meta.url), "utf8");

// The guided duel's engine options in src/graybox.js: starter deck, no Ride Out.
const deal = () => createMatch(SEED, { rideOut: false });

function wizardActs(state) {
  let n = 0;
  while (!state.result && state.activeSide === "wizard") {
    const r = applyAction(state, { ...chooseAction(publicState(state, "wizard")), actionId: `w${state.revision}-${++n}` });
    assert.ok(r.ok, `wizard rejected: ${r.reason}`);
    state = r.state;
  }
  return state;
}

const own = (slot) => ({ type: "slot", side: "cowboy", slot });
const foe = (slot) => ({ type: "slot", side: "wizard", slot });
const card = (view, name) => {
  const cardId = view.sides.cowboy.hand.find((id) => CARDS[id].name === name);
  assert.ok(cardId, `${name} not in hand: ${view.sides.cowboy.hand.map((id) => CARDS[id].name)}`);
  return { type: "card", cardId };
};
// One play: card click, then lane clicks, then Confirm.
const summon = (name, lane, tribute) => (view) => [card(view, name), ...(tribute ? [own(tribute - 1)] : []), own(lane - 1)];
const spell = (name, lane) => (view) => [card(view, name), foe(lane - 1)];

// Plays `script[round - 1]` (a list of plays) each Cowboy phase, then ends the phase.
function play(script) {
  let state = wizardActs(deal());
  let n = 0;
  while (!state.result) {
    const plays = script[state.round - 1];
    assert.ok(plays, `script has no round ${state.round}`);
    for (const build of plays) {
      let selection = emptySelection;
      const clicks = [...build(publicState(state, "cowboy")), { type: "confirm" }];
      for (const input of clicks) {
        const view = publicState(state, "cowboy");
        const step = selectionStep(selection, input, view, { accepting: true, newActionId: () => `c${++n}` });
        assert.ok(!step.error, `round ${state.round}: ${step.error}`);
        if (step.action) {
          const r = applyAction(state, step.action);
          assert.ok(r.ok, `round ${state.round}: ${r.reason}`);
          state = r.state;
          selection = emptySelection;
        } else selection = step.selection;
      }
      assert.equal(selection, emptySelection, `round ${state.round}: play did not apply`);
      if (state.result) break;
    }
    if (!state.result && state.activeSide === "cowboy") {
      const end = legalActions(publicState(state, "cowboy"), "cowboy").find((a) => a.type === "end-phase");
      const r = applyAction(state, { ...end, actionId: `e${++n}` });
      assert.ok(r.ok);
      state = r.state;
    }
    state = wizardActs(state);
  }
  return state;
}

test("AC1: Start guided duel deals seed 690; seed links and ?seed= stay ordinary", () => {
  assert.match(graybox, /const GUIDED_SEED = "690";/);
  assert.match(graybox, /controller\.start\(guided \? GUIDED_SEED : params\.get\("seed"\) \?\? undefined\)/);
  // The guided deal keeps the starter deck, Normal Wizard and no Ride Out.
  assert.match(graybox, /const counts = guided \|\| requestedDeck === "starter" \? null/);
  assert.match(graybox, /rideOut: !guided &&/);
  assert.match(graybox, /\(guided(?: \|\| deal\?\.posse)? \? chooseAction : chosenCpu\)\(view\)/);
});

test("AC1: seed 690 first input: round 1, Wizard acted, Skeleton (3 orbs) in lane 1, hand Sheriff, Sheriff, Deadeye, Billy, opener tip", () => {
  const start = deal();
  assert.equal(start.activeSide, "wizard");
  const state = wizardActs(start);
  const view = publicState(state, "cowboy");
  assert.equal(view.round, 1);
  assert.equal(view.startingSide, "wizard");
  assert.equal(view.activeSide, "cowboy");
  assert.equal(view.sides.wizard.baseOrbs, 5);
  assert.equal(view.sides.cowboy.baseOrbs, 5);
  assert.deepEqual(view.sides.wizard.board.map((t) => t && [CARDS[t.cardId].name, t.health]), [["Skeleton", 3], null, null]);
  assert.deepEqual(view.sides.cowboy.board, [null, null, null]);
  assert.deepEqual(view.sides.cowboy.hand.map((id) => CARDS[id].name), ["Sheriff", "Sheriff", "Deadeye", "Billy"]);
  const options = selectionOptions(emptySelection, view);
  assert.equal(guideLine({ view, options, progress: guideProgress(), opener: true }), OPENER_TIP);
  assert.equal(OPENER_TIP, "Put Sheriff across from the Skeleton to protect your Base, or choose an open lane to trade Base damage.");
});

test("AC2: block script wins in round 5, Cowboy Base 4, Wizard Base 0", () => {
  const end = play([
    [summon("Sheriff", 1)],
    [summon("Sheriff", 2), spell("Deadeye", 1)],
    [summon("Sheriff", 1)],
    [summon("Billy", 3, 1)],
    [summon("Billy", 1, 2)],
  ]);
  assert.equal(end.result.winner, "cowboy");
  assert.equal(end.round, 5);
  assert.equal(end.sides.cowboy.baseOrbs, 4);
  assert.equal(end.sides.wizard.baseOrbs, 0);
});

test("AC2: race script wins in round 3, Cowboy Base 2, Wizard Base 0", () => {
  const end = play([[summon("Sheriff", 2)], [summon("Sheriff", 3)], [summon("Sheriff", 1)]]);
  assert.equal(end.result.winner, "cowboy");
  assert.equal(end.round, 3);
  assert.equal(end.sides.cowboy.baseOrbs, 2);
  assert.equal(end.sides.wizard.baseOrbs, 0);
});
