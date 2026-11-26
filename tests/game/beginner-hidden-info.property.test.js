// BSP-1..BSP-4 (issue #223): fast-check catches and shrinks the unflagged level-0 hidden-deck dependency in
// playTurn(state, 0), and proves hidden-information invariance across levels 0, 1, 1.5, and 2 under {seatPrivate: true}.
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {viewFor} from "../../src/game/showdown/contract.js";
import {applyAction, createShowdown, legalActions, opponent, playTurn} from "../../src/game/showdown/rules.js";

function inferAction(before, applied) {
  return legalActions(before).find((action) => {
    const candidate = applyAction(before, action);
    return JSON.stringify(candidate) === JSON.stringify(applied);
  }) ?? {events: applied.events};
}

function collectFirstStep(state, level, options) {
  let chosen = null;
  playTurn(state, level, (before, applied) => {
    if (chosen === null) chosen = inferAction(before, applied);
  }, options);
  return chosen;
}

// Every action chosen by the bot BEFORE a hidden trap springs or an unseen card is drawn/burned.
function collectPreRevealActions(state, level, options) {
  const side = state.active;
  const actions = [];
  let revealed = false;
  playTurn(state, level, (before, applied) => {
    if (revealed) return;
    actions.push(inferAction(before, applied));
    if (applied.events.some((e) => e.type === "trap" || ((e.type === "draw" || e.type === "burn") && e.side === side))) {
      revealed = true;
    }
  }, options);
  return actions;
}

function permuteByKey(items, keys) {
  return items
    .map((item, idx) => ({item, key: keys[idx] ?? idx, idx}))
    .sort((a, b) => (a.key - b.key) || (a.idx - b.idx))
    .map((entry) => entry.item);
}

const CORPUS = (() => {
  const out = [];
  for (let seed = 0; seed < 32; seed++) {
    for (const first of ["cowboy", "wizard"]) {
      let state = createShowdown(seed, {first});
      for (let step = 0; step < 8 && !state.result; step++) {
        out.push(state);
        state = playTurn(state, step % 2 === 0 ? 0 : 2, undefined, {seatPrivate: true}).state;
      }
    }
  }
  return out;
})();

test("BSP-2 & BSP-3: seed 6 reproduces the snapshot leak without flag and is invariant with {seatPrivate: true} (issue #223)", () => {
  const first = createShowdown(6, {first: "wizard"});
  const second = structuredClone(first);
  const pile = second.sides.cowboy.deck;
  [pile[0], pile[1]] = [pile[1], pile[0]];
  assert.deepEqual(viewFor(first, "wizard"), viewFor(second, "wizard"));

  // Snapshot default preserves November 20 behavior (where seed 6 diverges on unseen Cowboy draw order):
  let snapA, snapB;
  playTurn(first, 0, (_before, applied) => { snapA ??= applied.events[0]; });
  playTurn(second, 0, (_before, applied) => { snapB ??= applied.events[0]; });
  assert.equal(snapA.cardId, "wizard-jack-o-lantern-1");
  assert.equal(snapB.cardId, "wizard-skeleton-1");

  // Candidate {seatPrivate: true} selects the exact same opening summon and turn prefix on both:
  let privA, privB;
  playTurn(first, 0, (_before, applied) => { privA ??= applied.events[0]; }, {seatPrivate: true});
  playTurn(second, 0, (_before, applied) => { privB ??= applied.events[0]; }, {seatPrivate: true});
  assert.deepEqual(privA, privB);
  assert.deepEqual(
    collectPreRevealActions(first, 0, {seatPrivate: true}),
    collectPreRevealActions(second, 0, {seatPrivate: true}),
  );
});

test("BSP-1 & BSP-3: fast-check hidden-information invariance holds across levels 0, 1, 1.5 and 2 under {seatPrivate: true}", () => {
  const arbCase = fc.record({
    posIndex: fc.integer({min: 0, max: CORPUS.length - 1}),
    level: fc.constantFrom(0, 1, 1.5, 2),
    enemyKeys: fc.array(fc.integer({min: 0, max: 999}), {minLength: 20, maxLength: 20}),
    ownDeckKeys: fc.array(fc.integer({min: 0, max: 999}), {minLength: 20, maxLength: 20}),
    trapVariant: fc.boolean(),
  });

  fc.assert(
    fc.property(arbCase, ({posIndex, level, enemyKeys, ownDeckKeys, trapVariant}) => {
      const base = CORPUS[posIndex];
      const side = base.active;
      const enemySide = opponent(side);
      const perturbed = structuredClone(base);

      const enemy = perturbed.sides[enemySide];
      const unseenEnemy = permuteByKey([...enemy.hand, ...enemy.deck], enemyKeys);
      enemy.hand = unseenEnemy.slice(0, enemy.hand.length);
      enemy.deck = unseenEnemy.slice(enemy.hand.length);

      if (trapVariant && enemy.traps.length > 0) {
        const replacement = enemySide === "cowboy" ? "cowboy-bear-trap-9" : "wizard-hex-9";
        enemy.traps = enemy.traps.map(() => replacement);
      }

      const own = perturbed.sides[side];
      own.deck = permuteByKey(own.deck, ownDeckKeys);

      assert.deepEqual(viewFor(perturbed, side), viewFor(base, side));
      assert.deepEqual(
        collectFirstStep(perturbed, level, {seatPrivate: true}),
        collectFirstStep(base, level, {seatPrivate: true}),
      );
      assert.deepEqual(
        collectPreRevealActions(perturbed, level, {seatPrivate: true}),
        collectPreRevealActions(base, level, {seatPrivate: true}),
      );
    }),
    {numRuns: 200, seed: 20261126},
  );
});

test("BSP-4: fast-check catches and shrinks the live unflagged level-0 hidden-deck dependency to an adjacent top-of-deck swap", (t) => {
  const arbSwap = fc.record({
    seed: fc.integer({min: 0, max: 50}),
    first: fc.constantFrom("cowboy", "wizard"),
    i: fc.integer({min: 0, max: 10}),
    j: fc.integer({min: 0, max: 10}),
  });

  const check = fc.check(
    fc.property(arbSwap, ({seed, first, i, j}) => {
      const base = createShowdown(seed, {first});
      const enemySide = opponent(base.active);
      const deck = base.sides[enemySide].deck;
      if (i >= deck.length || j >= deck.length || i === j) return true;
      const swapped = structuredClone(base);
      [swapped.sides[enemySide].deck[i], swapped.sides[enemySide].deck[j]] = [
        swapped.sides[enemySide].deck[j],
        swapped.sides[enemySide].deck[i],
      ];
      return JSON.stringify(collectFirstStep(base, 0)) === JSON.stringify(collectFirstStep(swapped, 0));
    }),
    {numRuns: 150, seed: 20261126},
  );

  assert.equal(check.failed, true, "expected fast-check to catch the unflagged level-0 blind.sides leak");
  assert.ok(check.numShrinks >= 1, `expected fast-check shrinking, got numShrinks=${check.numShrinks}`);
  const [counterexample] = check.counterexample;
  t.diagnostic(`shrunk counterexample (${check.numShrinks} shrinks): ${JSON.stringify(counterexample)}`);

  const base = createShowdown(counterexample.seed, {first: counterexample.first});
  const swapped = structuredClone(base);
  const enemyDeck = swapped.sides[opponent(base.active)].deck;
  [enemyDeck[counterexample.i], enemyDeck[counterexample.j]] = [enemyDeck[counterexample.j], enemyDeck[counterexample.i]];
  assert.deepEqual(
    collectFirstStep(base, 0, {seatPrivate: true}),
    collectFirstStep(swapped, 0, {seatPrivate: true}),
  );
});
