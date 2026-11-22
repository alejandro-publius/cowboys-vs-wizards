import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BILLY_REPLAY as R} from "../../src/ui/billy-replay.data.js";
import {GATE_RECORD, LINES, billyReplayHtml, replayView, wireBillyReplay} from "../../src/ui/billy-replay.js";
import {ledgerHtml} from "../../src/ui/sheriffs-ledger.js";

test("the open Ledger leads with the recorded duel, links its source, and retains the existing reviews", () => {
  const html = ledgerHtml();
  assert.ok(html.indexOf('id="ledger-billy"') > html.indexOf("</summary>"));
  assert.ok(html.indexOf('id="ledger-billy"') < html.indexOf('id="ledger-ruleset"'));
  assert.match(html, /id="ledger-review"/);
  const replay = billyReplayHtml();
  assert.match(replay, /726421019/);
  assert.match(replay, /data-ledger-portrait="cowboy-billy"/);
  assert.match(replay, /data-ledger-portrait="wizard-bone-wall"/);
  assert.match(replay, /61\.04%/);
  assert.match(replay, /52\.92%/);
  assert.match(replay, /5,000 games per version, fixed decks and two level-2 bots/);
  assert.match(replay, /verify-billy-replay\.mjs --full/);
  assert.ok(readFileSync(GATE_RECORD, "utf8").includes(R.source.proposalSeal));
});

test("both recorded branches reach their own orb count and winner", () => {
  for (const [line, orbs, side, end] of [["baseline", 0, "Cowboys", 13], ["candidate", 1, "Wizards", 20]]) {
    assert.match(replayView(line, 0).stage, /aria-label="2 orbs"/);
    assert.match(replayView(line, 2).stage, new RegExp('aria-label="' + orbs + ' orb' + (orbs === 1 ? '' : 's') + '"'));
    assert.match(replayView(line, 3).caption, new RegExp(side + " win on turn " + end));
    assert.equal(replayView(line, 20).step, 3);
  }
});

// A minimal stand-in for the replay's elements: enough to press its buttons the way a click would.
function fakeReplay() {
  const el = (dataset = {}) => {
    const attrs = {};
    return {dataset, hidden: false, innerHTML: "", textContent: "", closest() { return this; },
      setAttribute(name, value) { attrs[name] = String(value); }, getAttribute: (name) => attrs[name] ?? null};
  };
  const lines = LINES.map((billyLine) => el({billyLine}));
  const [back, next, again] = ["back", "next", "replay"].map((billyStep) => el({billyStep}));
  const parts = {"#ledger-billy-stage": el(), "#ledger-billy-now": el(), "#ledger-billy-steps": Object.assign(el(), {hidden: true}),
    '[data-billy-step="back"]': back, '[data-billy-step="next"]': next, '[data-billy-step="replay"]': again};
  let click = null;
  const box = {querySelector: (s) => parts[s], querySelectorAll: (s) => (s === "[data-billy-line]" ? lines : []), addEventListener: (type, fn) => { click = type === "click" ? fn : click; }};
  wireBillyReplay({querySelector: (s) => (s === "#ledger-billy" ? box : null)});
  return {lines, back, next, again, parts, press: (b) => click({target: b}), caption: () => parts["#ledger-billy-now"].textContent};
}

test("the same controls can step, restart and switch lines without changing the live duel", () => {
  const ui = fakeReplay();
  const [current, proposed] = ui.lines;
  ui.press(ui.next);
  assert.equal(ui.caption(), "");
  ui.press(current);
  assert.equal(current.getAttribute("aria-pressed"), "true");
  assert.equal(ui.back.getAttribute("aria-disabled"), "true");
  for (let step = 0; step < 3; step++) ui.press(ui.next);
  assert.match(ui.caption(), /Cowboys win on turn 13/);
  assert.equal(ui.next.getAttribute("aria-disabled"), "true");
  ui.press(ui.next);
  assert.match(ui.caption(), /Step 4 of 4/);
  ui.press(ui.back);
  assert.match(ui.caption(), /is defeated/);
  ui.press(ui.again);
  assert.match(ui.caption(), /Step 1 of 4/);
  ui.press(proposed);
  assert.equal(current.getAttribute("aria-pressed"), "false");
  assert.equal(proposed.getAttribute("aria-pressed"), "true");
  ui.press(ui.next);
  ui.press(ui.next);
  assert.match(ui.caption(), /survives with 1 orb/);
  ui.press(ui.next);
  assert.match(ui.caption(), /Wizards win on turn 20/);
});
