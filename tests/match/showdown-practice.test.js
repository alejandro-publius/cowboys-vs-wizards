// K-096: Boot Hill practice opens only for ?practice=0 or ?practice=60, is the fresh-save Boot Hill duel, and
// settles nothing: the screen's no-settle path (kind "turn") is taken, so no campaign or playtest write happens.
import assert from "node:assert/strict";
import test from "node:test";
import {duelFor, newSave, settle} from "../../src/game/showdown/progress.js";
import {createShowdownSession, bootHill} from "../../src/match/showdown-session.js";
import {PRACTICE_SEEDS, practiceDuel, practiceFromQuery, practiceSeed} from "../../src/match/showdown-practice.js";

test("only the exact strings 0 and 60 open practice", () => {
  assert.deepEqual(PRACTICE_SEEDS, [0, 60]);
  assert.equal(practiceSeed("0"), 0);
  assert.equal(practiceSeed("60"), 60);
  for (const raw of [null, undefined, 0, 60, "", "1", "00", "060", "60.0", " 0", "0 ", "-0", "+0", "0x0", "1e1", "abc", "__proto__", "61", "59"]) {
    assert.equal(practiceSeed(raw), null, String(raw));
  }
  assert.equal(practiceFromQuery("?practice=0"), 0);
  assert.equal(practiceFromQuery("?seed=5&practice=60"), 60);
  for (const q of ["", "?practice", "?practice=", "?practice=0&practice=0", "?practice=0&practice=60", "?practice=%200", "?seed=0", "?practice=1"]) {
    assert.equal(practiceFromQuery(q), null, q);
  }
  for (const seed of [1, -1, "0", NaN, null]) assert.equal(practiceDuel(seed), null, String(seed));
});

test("practice is the reference Boot Hill duel with the starter deck, whatever the career holds", () => {
  const reference = bootHill();
  for (const seed of PRACTICE_SEEDS) {
    const {duel, seed: dealt} = practiceDuel(seed);
    assert.equal(dealt, seed);
    assert.equal(duel.kind, "turn", "takes the screen's no-settle path");
    assert.equal(duel.id, `practice:${seed}`);
    assert.equal(duel.prefix, undefined);
    assert.deepEqual(duel.options, reference.options);
    assert.equal(duel.level, reference.level);
    assert.ok(duel.lesson.endsWith(reference.lesson), "Boot Hill's guide text is unchanged");
    assert.match(duel.lesson, /nothing here is saved/);
  }
  // An advanced career's Trail duel differs; practice does not read it.
  let save = newSave();
  for (let i = 0; i < 3; i++) save = settle(save, "trail", true).save;
  assert.notDeepEqual(duelFor({...save, offer: null}, "trail").options, practiceDuel(0).duel.options);
});

test("the same seed deals the same opening every time; 0 and 60 differ", () => {
  const view = (seed) => { const p = practiceDuel(seed); return createShowdownSession({seed: p.seed, duel: p.duel}).view(); };
  assert.deepEqual(view(0), view(0));
  assert.deepEqual(view(60), view(60));
  assert.notDeepEqual(view(0).sides.cowboy.hand, view(60).sides.cowboy.hand);
  // Same deal as Camp's Boot Hill on that seed: only the duel's name and id differ.
  const camp = createShowdownSession({seed: 0, duel: bootHill()}).view();
  assert.deepEqual(view(0), camp);
});
