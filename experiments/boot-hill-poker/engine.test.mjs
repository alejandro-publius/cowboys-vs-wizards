// Run: node --test experiments/boot-hill-poker/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyKey, startSession } from './controls.js';
import {
  chooseDiscards,
  compareHands,
  decideShowdown,
  evaluateHand,
  makeDeck,
  newDeal,
  nextDeal,
  normalizeSeed,
  playPokerDuel,
  replayDeal,
  shuffleDeck,
  submitDraw,
  toggleDiscard,
  viewState,
} from './engine.js';
import { renderScreen, toText } from './render.js';

const CARD = /^[2-9TJQKA][SHDC]$/;
function cardStrings(value, out = []) {
  if (typeof value === 'string') {
    if (CARD.test(value)) out.push(value);
  } else if (Array.isArray(value)) value.forEach((v) => cardStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => cardStrings(v, out));
  return out;
}

test('deck has 52 unique cards and shuffles deterministically by seed', () => {
  const full = new Set(makeDeck());
  assert.equal(full.size, 52);
  const deck = shuffleDeck(17);
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
  assert.ok(deck.every((card) => full.has(card)));
  assert.deepEqual(shuffleDeck(17), deck);
  assert.deepEqual(shuffleDeck('17'), deck);
  assert.notDeepEqual(shuffleDeck(18), deck);
});

test('deal alternates from the first seat and every card stays unique through the draw', () => {
  const deck = shuffleDeck(normalizeSeed(5));
  const dealt = newDeal({ seed: 5, first: 'cowboy' });
  assert.deepEqual(dealt.hands.cowboy, [0, 2, 4, 6, 8].map((i) => deck[i]));
  assert.deepEqual(dealt.hands.wizard, [1, 3, 5, 7, 9].map((i) => deck[i]));
  assert.deepEqual(dealt.deck, deck.slice(10));

  const wizardFirst = newDeal({ seed: 5, first: 'wizard', human: null });
  assert.equal(wizardFirst.order[0], 'wizard');

  const after = submitDraw(dealt, [0, 1, 2, 3, 4]);
  const all = [...after.hands.cowboy, ...after.hands.wizard, ...after.deck, ...after.muck];
  assert.equal(all.length, 52);
  assert.equal(new Set(all).size, 52);
});

test('playPokerDuel is deterministic and reports a winner and end turn', () => {
  const winners = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    for (const first of ['cowboy', 'wizard']) {
      const a = playPokerDuel(seed, first);
      assert.deepEqual(playPokerDuel(seed, first), a);
      assert.deepEqual(playPokerDuel(seed, first, 'standard'), a);
      assert.deepEqual(playPokerDuel(seed, first, { cowboy: 'standard', wizard: 'standard' }), a);
      assert.ok(['cowboy', 'wizard', 'draw'].includes(a.winner));
      assert.equal(a.endTurn, 2);
      const state = newDeal({ seed, first, human: null });
      assert.equal(state.result.winner, a.winner);
      assert.equal(state.strategies.cowboy, state.strategies.wizard);
      winners.add(a.winner);
    }
  }
  assert.ok(winners.has('cowboy') && winners.has('wizard'));
  assert.throws(() => playPokerDuel(1, 'sheriff'), RangeError);
  assert.throws(() => playPokerDuel(1, 'cowboy', 'bluff'), RangeError);
});

test('hand categories rank in poker order', () => {
  const ladder = [
    ['AS', 'QD', '9C', '5H', '3S'],
    ['2S', '2D', '7C', '8H', '9S'],
    ['3S', '3D', '4C', '4H', '9S'],
    ['5S', '5D', '5C', '8H', '9S'],
    ['AS', '2D', '3C', '4H', '5S'],
    ['2S', '3D', '4C', '5H', '6S'],
    ['TS', 'JD', 'QC', 'KH', 'AS'],
    ['2H', '5H', '7H', '9H', 'JH'],
    ['3S', '3D', '3C', '2H', '2S'],
    ['4S', '4D', '4C', '4H', '2S'],
    ['AC', '2C', '3C', '4C', '5C'],
    ['TD', 'JD', 'QD', 'KD', 'AD'],
  ];
  const categories = ladder.map((hand) => evaluateHand(hand).category);
  assert.deepEqual(categories, [0, 1, 2, 3, 4, 4, 4, 5, 6, 7, 8, 8]);
  for (let i = 0; i < ladder.length; i++) {
    for (let j = i + 1; j < ladder.length; j++) {
      assert.equal(compareHands(ladder[j], ladder[i]), 1, `${ladder[j]} should beat ${ladder[i]}`);
      assert.equal(compareHands(ladder[i], ladder[j]), -1);
    }
  }
  assert.equal(evaluateHand(ladder[11]).label, 'Royal Flush');
  assert.throws(() => evaluateHand(['AS', 'AS', '2D', '3C', '4H']), TypeError);
});

test('the wheel is a five-high straight and straights do not wrap around', () => {
  const wheel = evaluateHand(['5S', 'AD', '3C', '2H', '4S']);
  assert.equal(wheel.category, 4);
  assert.equal(wheel.wheel, true);
  assert.deepEqual(wheel.ranks, [5]);
  assert.match(wheel.label, /Five high/);
  assert.equal(evaluateHand(['QS', 'KD', 'AC', '2H', '3S']).category, 0);
  const result = decideShowdown({ cowboy: ['AS', '2D', '3C', '4H', '5S'], wizard: ['6D', '2S', '3D', '4C', '5H'] });
  assert.equal(result.winner, 'wizard');
});

test('suits never break ties and kickers do', () => {
  assert.equal(compareHands(['AS', 'KS', '9D', '5C', '3H'], ['AH', 'KH', '9C', '5D', '3S']), 0);
  const tie = decideShowdown({ cowboy: ['AS', '2D', '3C', '4H', '5S'], wizard: ['AH', '2C', '3D', '4S', '5H'] });
  assert.equal(tie.winner, 'draw');
  assert.match(tie.reason, /Suits never break a tie/);
  const flushTie = decideShowdown({ cowboy: ['2H', '5H', '7H', '9H', 'JH'], wizard: ['2S', '5S', '7S', '9S', 'JS'] });
  assert.equal(flushTie.winner, 'draw');

  const kicker = decideShowdown({ cowboy: ['KS', 'KD', 'AH', '7C', '3S'], wizard: ['KH', 'KC', 'QD', '7S', '3D'] });
  assert.equal(kicker.winner, 'cowboy');
  assert.match(kicker.reason, /Ace kicker beats the Queen/);
});

test('opponent hand stays hidden until showdown', () => {
  const state = newDeal({ seed: 17, first: 'wizard' });
  assert.equal(state.drew.wizard !== null, true);
  const view = viewState(state, 'cowboy');
  assert.equal(view.canAct, true);
  assert.deepEqual(view.opponentHand, [null, null, null, null, null]);
  assert.equal(view.opponentLabel, null);
  assert.equal(view.result, null);
  assert.equal('deck' in view || 'muck' in view, false);
  const leaked = cardStrings(view).filter((card) => state.hands.wizard.includes(card));
  assert.deepEqual(leaked, []);
  const screen = toText(renderScreen(view));
  assert.equal(screen.split('│▒▒▒▒▒│').length - 1, 10);

  const done = submitDraw(state);
  const shown = viewState(done, 'cowboy');
  assert.deepEqual(shown.opponentHand, done.hands.wizard);
  assert.equal(toText(renderScreen(shown)).includes('│▒▒▒▒▒│'), false);
});

test('interactive state: mark, draw, replay and new deal', () => {
  const start = newDeal({ seed: 17 });
  assert.equal(start.phase, 'draw');
  assert.equal(start.toAct, 'cowboy');
  const marked = toggleDiscard(toggleDiscard(toggleDiscard(start, 0), 3), 3);
  assert.deepEqual(marked.marked.cowboy, [0]);
  assert.deepEqual(start.marked.cowboy, []);

  const done = submitDraw(marked);
  assert.equal(done.phase, 'showdown');
  assert.equal(done.result.endTurn, 2);
  assert.deepEqual(done.hands.cowboy.slice(1), start.hands.cowboy.slice(1));
  assert.notEqual(done.hands.cowboy[0], start.hands.cowboy[0]);
  assert.match(done.result.reason, /wins|draw/);
  assert.throws(() => toggleDiscard(done, 1));
  assert.throws(() => submitDraw(done));
  assert.throws(() => submitDraw(newDeal({ seed: 3, human: null })));

  assert.deepEqual(replayDeal(done), start);
  const next = nextDeal(done);
  assert.equal(next.dealNumber, 2);
  assert.notEqual(next.seed, start.seed);
  assert.equal(next.first, 'wizard');
});

test('bot draw choices are deterministic and sensible', () => {
  assert.deepEqual(chooseDiscards(['KS', 'KD', '7C', '4H', '2S']), [2, 3, 4]);
  assert.deepEqual(chooseDiscards(['2H', '7H', '9H', 'KH', '3S']), [4]);
  assert.deepEqual(chooseDiscards(['4S', '5D', '6C', '7H', 'KS']), [4]);
  assert.deepEqual(chooseDiscards(['5S', '6D', '7C', '8H', '9S']), []);
  assert.deepEqual(chooseDiscards(['AS', 'JD', '8C', '4H', '2S']), [1, 2, 3, 4]);
  assert.deepEqual(chooseDiscards(['AS', 'JD', '8C', '4H', '2S'], 'pat'), []);
});

test('shared keyboard controls play a full hand', () => {
  let session = startSession({ seed: 17 });
  session = applyKey(session, '2');
  assert.deepEqual(session.state.marked.cowboy, [1]);
  assert.match(session.notice, /TOSS/);
  session = applyKey(session, 'Enter');
  assert.equal(session.state.phase, 'showdown');
  assert.match(session.notice, /toss 1/);
  session = applyKey(session, '3');
  assert.equal(session.state.phase, 'showdown');
  session = applyKey(session, 'r');
  assert.equal(session.state.phase, 'draw');
  session = applyKey(session, 'q');
  assert.equal(session.hungUp, true);
});

test('terminal plays a piped hand and hangs up on q', () => {
  const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [cli, '--seed', '17', '--no-color'], { input: '13\nq\n', encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /B O O T {3}H I L L/);
  assert.match(run.stdout, /TAKES THE HAND|THE HAND IS A DRAW/);
  assert.match(run.stdout, /NO CARRIER/);
});
