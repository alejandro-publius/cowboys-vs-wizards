// Public board zones: the zone rails, pile sheet, Raise marker and move ticker read only public views.
import assert from "node:assert/strict";
import test from "node:test";
import {cardOf} from "../../src/game/showdown/cards.js";
import {opponent} from "../../src/game/showdown/rules.js";
import {bootHill, createShowdownSession, twoPlayers} from "../../src/match/showdown-session.js";
import {movesOf, newestFirst, railHtml, raiseTarget, sheetHtml} from "../../src/ui/showdown-zones.js";

// Plays a duel: the first card play, else the first attack, else the first legal action (never cover before those), calling visit(before, events, after) per action.
function play(session, visit, steps = 300) {
  for (let step = 0; step < steps && !session.view().result; step += 1) {
    const options = session.legal();
    const action = options.find((a) => a.cardId) ?? options.find((a) => a.type === "attack") ?? options[0];
    const before = session.view();
    const events = session.act(action);
    visit(before, events, session.view());
  }
}
const ids = (html) => html.match(/[a-z]+-[a-z]+-\d+/g) ?? [];

test("the sheet lists a pile in the view's discard order, newest first, with names only", () => {
  let checked = 0;
  for (let seed = 0; seed < 10; seed += 1) {
    play(createShowdownSession({seed, duel: twoPlayers(), players: 2}), (before, events, after) => {
      for (const side of ["cowboy", "wizard"]) {
        const discard = after.sides[side].discard;
        if (!discard.length) continue;
        const html = sheetHtml(side, discard, raiseTarget(discard, twoPlayers().options.decks[side]), null, () => "");
        const rows = [...html.matchAll(/data-graveyard-card="(\d+)"[^>]*>([^<]+)/g)].map((m) => m[2].trim());
        assert.deepEqual(rows, newestFirst(discard).map((id) => cardOf(id).name));
        assert.deepEqual(ids(html), [], "no card instance id in the sheet");
        checked += 1;
      }
    });
  }
  assert.ok(checked > 50, `checked ${checked} piles`);
});

test("the Raise marker is the card the engine's Raise returns", () => {
  let raised = 0;
  for (let seed = 0; seed < 60; seed += 1) {
    play(createShowdownSession({seed, duel: twoPlayers(), players: 2}), (before, events) => {
      const raise = events.find((e) => e.type === "raise");
      if (!raise) return;
      // Tribute lands before Raise inside the same summon, so the pile it reads is the old pile plus the tributes.
      const pile = [...before.sides[raise.side].discard, ...events.filter((e) => e.type === "tribute").map((e) => e.cardId)];
      assert.equal(pile[raiseTarget(pile, twoPlayers().options.decks[raise.side])], raise.cardId);
      raised += 1;
    });
  }
  assert.ok(raised > 0, "a Raise happened");
  assert.equal(raiseTarget(["wizard-skeleton-1"], {"wizard-wizard": 0}), -1, "a card with zero copies cannot Raise");
  assert.equal(raiseTarget(["wizard-skeleton-1"], {"cowboy-sheriff": 3}), -1, "no marker for a deck without Raise");
});

test("a rival rail and a curtained or shared own rail show no hand or trap identity", () => {
  let traps = 0;
  for (let seed = 0; seed < 20; seed += 1) {
    play(createShowdownSession({seed, duel: twoPlayers(), players: 2}), (before, events, after) => {
      // after is the next active seat's view; its rival side is the one that just acted.
      const rival = opponent(after.viewer);
      const s = after.sides[rival];
      assert.equal(s.hand, undefined);
      assert.equal(s.traps, undefined);
      const html = railHtml(rival, s, {own: false, named: false, raise: -1, sprung: movesOf(events, before, after).sprung[rival]});
      assert.deepEqual(ids(html), []);
      const own = after.sides[after.viewer];
      const hidden = railHtml(after.viewer, own, {own: true, named: false, raise: -1});
      assert.doesNotMatch(hidden, /Set:|No trap set/);
      const shown = hidden.replace(/(Cowboy|Wizard) (zones|deck|traps|hand|Boot Hill)/g, "");
      for (const id of own.traps) assert.ok(!shown.includes(cardOf(id).name) || own.discard.some((d) => cardOf(d).name === cardOf(id).name), `unnamed rail leaks ${id}`);
      traps += s.trapCount;
    });
  }
  assert.ok(traps > 0, "some traps were face down");
});

test("the empty pile is plain text, and the ticker names tribute, Raise, spent traps and fallen troops", () => {
  const empty = {deckCount: 3, handCount: 2, trapCount: 0, traps: [], discard: []};
  const html = railHtml("wizard", empty, {own: true, named: true, raise: -1});
  assert.match(html, /Boot Hill · empty/);
  assert.doesNotMatch(html, /data-graveyard="/);
  const seen = new Set();
  for (let seed = 0; seed < 40; seed += 1) {
    play(createShowdownSession({seed, duel: twoPlayers(), players: 2}), (before, events, after) => {
      for (const line of movesOf(events, before, after).lines) {
        assert.deepEqual(ids(line), []);
        for (const tag of ["tribute", "Raise", "trap spent", "fell"]) if (line.includes(`(${tag})`)) seen.add(tag);
      }
    });
  }
  assert.deepEqual([...seen].sort(), ["Raise", "fell", "trap spent", "tribute"]);
});
