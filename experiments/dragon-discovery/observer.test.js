import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {runInNewContext} from "node:vm";
import {cardOf} from "../../src/game/showdown/cards.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {turnDuel} from "../../src/match/showdown-turn.js";

const observer = readFileSync(new URL("./observer.js", import.meta.url), "utf8");
const lessons = JSON.parse(readFileSync(new URL("../../apps/replay-room/src/lessons.json", import.meta.url)));

// Replay Room displays recorded branches. Check both named choices against the actual decision state.
test("both Replay Room tables present legal Ranger attacks on both named troops", () => {
  assert.deepEqual(lessons.map(lesson => lesson.id), ["dragon-c5", "dragon-c5-70"]);
  for (const lesson of lessons) {
    const session = createShowdownSession(turnDuel(lesson.id));
    const {cowboy, wizard} = session.view().sides;
    assert.equal(session.view().turn, 5);
    assert.equal(cardOf(cowboy.board[0].cardId).name, "Ranger");
    for (const [slot, target, name] of [[0, "dragon", "Dragon"], [1, "jack", "Jack-o'-Lantern"]]) {
      assert.ok(lesson.branches[target]);
      assert.equal(cardOf(wizard.board[slot].cardId).name, name);
      assert.ok(session.legal().some(action => action.type === "attack" && action.slot === 0 && action.target === slot));
    }
  }
});

// Synthetic clock and isolated message channel. The DOM doubles stand for the post-click room state.
function frame() {
  const messages = [];
  let now = 100, focused = true, timer, mounted, ready = false;
  const listeners = new Map();
  const listen = (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]);
  const fire = (name, event = {}) => (listeners.get(name) ?? []).forEach(fn => fn(event));
  const parent = {postMessage: value => messages.push(structuredClone(value))};
  const room = {
    back: "Back to Wanted", table: "0", contains: button => button.inRoom,
    querySelector(selector) {
      return selector === "#replay-room-back" ? {textContent: this.back} : {dataset: {deal: this.table}};
    },
  };
  const document = {
    hidden: false, hasFocus: () => focused, addEventListener: listen,
    querySelector: selector => selector.startsWith("#title-screen") ? ready && {querySelector: () => true} : room,
  };
  runInNewContext(observer, {
    window: {addEventListener: listen}, document, parent, performance: {now: () => now},
    setTimeout: (fn, delay) => { timer = {fn, at: now + delay}; return 1; },
    clearTimeout: () => { timer = null; },
    MutationObserver: class {
      constructor(fn) { mounted = fn; }
      observe() {}
      disconnect() {}
    },
  });
  return {
    messages, room,
    ready() { ready = true; mounted(); },
    command(g10, source = parent) { fire("message", {source, data: {g10}}); },
    move(ms) { now += ms; },
    hide(value) { document.hidden = value; fire("visibilitychange"); },
    focus(value) { focused = value; fire(value ? "focus" : "blur"); },
    tick() { if (timer && now >= timer.at) timer.fn(); },
    click(branch, {accepted = true, isTrusted = true, inRoom = true} = {}) {
      const button = {inRoom, dataset: {branch}, closest: selector => accepted && selector.includes(".rr-choices") ? button : null};
      fire("click", {target: button, isTrusted, timeStamp: now});
    },
  };
}

test("only an accepted, trusted choice on the Wanted route ends a running session", () => {
  for (const [table, deal, target] of [["0", "dragon-c5", "dragon"], ["1", "dragon-c5-70", "jack"]]) {
    const f = frame();
    f.command("start"); f.ready(); f.click(target);
    f.command("start", {}); f.click(target);
    f.command("start"); f.room.table = table;
    f.move(25); f.command("start");
    f.click(target, {isTrusted: false}); f.click(target, {accepted: false}); f.click(target, {inRoom: false});
    f.click("other"); f.room.back = "Back to Camp"; f.click(target);
    assert.deepEqual(f.messages, [{g10: "ready"}]);
    f.room.back = "Back to Wanted";
    f.move(0.25); f.click(target); f.command("stop"); f.click(target);
    assert.deepEqual(f.messages.slice(1), [{g10: "choice", elapsedMs: 26, choice: {deal, target}}]);
  }
});

test("exactly 60 active seconds count, overlapping hidden and unfocused time is excluded", () => {
  const f = frame();
  f.ready(); f.command("start"); f.move(10_000);
  f.focus(false); f.move(11_000); f.hide(true); f.move(30_000);
  f.focus(true); f.tick(); f.click("jack"); f.move(120_000);
  f.hide(false); f.move(50_000); f.tick(); f.click("jack");
  assert.deepEqual(f.messages.slice(1), [{g10: "choice", elapsedMs: 60_000, choice: {deal: "dragon-c5", target: "jack"}}]);
});

test("a delayed timer or late input closes at the cap, and early stop records the measured miss", () => {
  for (const action of [f => f.tick(), f => f.click("dragon"), f => f.command("stop")]) {
    const f = frame();
    f.ready(); f.command("start"); f.move(60_001); action(f); f.command("start"); f.command("stop");
    assert.deepEqual(f.messages.slice(1), [{g10: "timeout", elapsedMs: 60_000}]);
  }
  const f = frame();
  f.ready(); f.command("start"); f.move(321.1); f.hide(true); f.move(47_000); f.command("stop");
  assert.deepEqual(f.messages.slice(1), [{g10: "miss", elapsedMs: 322}]);
});
