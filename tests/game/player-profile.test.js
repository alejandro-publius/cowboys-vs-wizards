import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, createProfileStore } from '../../src/profile/player-profile.js';

const KEY = 'cvw-player-v1';
function memoryStorage(initial) {
  const data = new Map(initial === undefined ? [] : [[KEY, initial]]);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('a new profile has defaults and no unearned achievements', () => {
  const store = createProfileStore(null);
  assert.deepEqual(store.get(), {
    settings: { sound: false, reducedMotion: false, performance: 'auto' },
    deck: null,
    achievements: {},
    stats: { matches: 0, wins: 0, summons: 0, spells: 0 },
  });
  store.updateSettings({ sound: true });
  store.saveDeck(null);
  store.record('preview');
  assert.deepEqual(store.get().achievements, {});
  assert.equal(new Set(ACHIEVEMENTS.map(({ id }) => id)).size, 5);
});

test('settings, deck, actual progress and unlocks survive a persistence roundtrip', () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  store.updateSettings({ sound: true, reducedMotion: true, performance: 'low' });
  store.saveDeck({ billy: 3, sheriff: 2, mounted: 0, dragon: 0 });
  store.record('summon');
  store.record('spell');
  store.record('match-complete', { won: true });
  assert.deepEqual(createProfileStore(storage).get(), store.get());
  assert.deepEqual(store.get().stats, { matches: 1, wins: 1, summons: 1, spells: 1 });
  assert.deepEqual(Object.keys(store.get().achievements).sort(), ACHIEVEMENTS.map(({ id }) => id).sort());
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(KEY))).sort(), ['achievements', 'deck', 'settings', 'stats']);
});

test('corrupt and wrongly typed saved data fall back safely', () => {
  const defaults = createProfileStore(null).get();
  for (const saved of ['broken json', 'null', '[]', '17']) {
    assert.deepEqual(createProfileStore(memoryStorage(saved)).get(), defaults);
  }
  const store = createProfileStore(memoryStorage(JSON.stringify({
    settings: { sound: 'true', reducedMotion: true, performance: 'ultra', extra: true },
    deck: { billy: -1 },
    achievements: { 'first-win': 'invalid date', invented: '2026-01-01T00:00:00.000Z' },
    stats: { matches: 2, wins: 8, summons: -1, spells: 1.5 },
  })));
  assert.deepEqual(store.get().settings, { sound: false, reducedMotion: true, performance: 'auto' });
  assert.equal(store.get().deck, null);
  assert.deepEqual(store.get().stats, { matches: 2, wins: 2, summons: 0, spells: 0 });
  assert.deepEqual(store.get().achievements, {});
});

test('denied storage reads and writes still permit in-memory progress', () => {
  const store = createProfileStore({
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('full'); },
  });
  assert.equal(store.isPersistent(), false);
  assert.doesNotThrow(() => {
    store.updateSettings({ sound: true });
    store.saveDeck({ skeleton: 4 });
    store.record('summon');
  });
  assert.equal(store.get().settings.sound, true);
  assert.equal(store.get().stats.summons, 1);
  assert.deepEqual(store.get().deck, { skeleton: 4 });
  assert.equal(store.isPersistent(), false);
});

test('persistence status follows successful and denied saves without a write probe', () => {
  let denied = false;
  let writes = 0;
  const storage = memoryStorage();
  const store = createProfileStore({
    getItem: storage.getItem,
    setItem(key, value) {
      writes++;
      if (denied) throw new Error('quota exceeded');
      storage.setItem(key, value);
    },
  });
  assert.equal(store.isPersistent(), true);
  assert.equal(writes, 0);
  denied = true;
  store.updateSettings({ sound: true });
  assert.equal(store.isPersistent(), false);
  assert.equal(store.get().settings.sound, true);
  denied = false;
  store.record('summon');
  assert.equal(store.isPersistent(), true);
  assert.deepEqual(createProfileStore(storage).get(), store.get());
});

test('missing storage is session-only; corrupt JSON does not imply unavailable storage', () => {
  const store = createProfileStore(null);
  assert.equal(store.isPersistent(), false);
  store.record('spell');
  assert.equal(store.isPersistent(), false);
  const recovered = createProfileStore(memoryStorage('broken json'));
  assert.equal(recovered.isPersistent(), true);
  assert.deepEqual(recovered.get().achievements, {});
  recovered.saveDeck({ billy: 3 });
  assert.equal(recovered.isPersistent(), true);
});

test('only known settings with valid values can change', () => {
  const store = createProfileStore(null);
  store.updateSettings({ sound: true, reducedMotion: true, performance: 'low' });
  store.updateSettings({ sound: 0, reducedMotion: 'false', performance: 'high', volume: 100 });
  store.updateSettings(null);
  store.updateSettings([]);
  assert.deepEqual(store.get().settings, { sound: true, reducedMotion: true, performance: 'low' });
  store.updateSettings({ sound: false, reducedMotion: false, performance: 'auto' });
  assert.deepEqual(store.get().settings, { sound: false, reducedMotion: false, performance: 'auto' });
});

test('event IDs and match IDs dedupe within the session, not persisted saves', () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  store.record('summon', { id: 'action-1' });
  store.record('summon', { id: 'action-1' });
  store.record('spell', { id: 'action-1' });
  store.record('match-complete', { id: 'end-1', matchId: 'match-1', won: true });
  store.record('match-complete', { id: 'end-2', matchId: 'match-1', won: true });
  store.record('match-complete', { id: 'end-1', won: true });
  store.record('match-complete', { matchId: 'match-2', won: false });
  assert.deepEqual(store.get().stats, { matches: 2, wins: 1, summons: 1, spells: 1 });
  const restored = createProfileStore(storage);
  restored.record('summon', { id: 'action-1' });
  assert.equal(restored.get().stats.summons, 2);
  assert.equal(storage.getItem(KEY).includes('action-1'), false);
  assert.equal(storage.getItem(KEY).includes('match-1'), false);
});

test('matches only award wins for a boolean true; achievements stay unlocked', () => {
  const store = createProfileStore(null);
  store.record('match-complete', { won: 'true' });
  assert.deepEqual(Object.keys(store.get().achievements), ['first-match']);
  assert.equal(store.get().stats.wins, 0);
  store.record('match-complete', { won: true });
  const firstUnlock = store.get().achievements['first-win'];
  store.record('match-complete', { won: true });
  assert.equal(store.get().achievements['first-win'], firstUnlock);
  assert.equal(store.get().stats.wins, 2);
});

test('malformed decks cannot replace a saved deck or earn an achievement', () => {
  const store = createProfileStore(null);
  for (const deck of [{}, [], { billy: -1 }, { billy: 13 }, { billy: 1.5 },
    { billy: '2' }, { '': 1 }, JSON.parse('{"__proto__":1}')]) {
    store.saveDeck(deck);
  }
  assert.equal(store.get().deck, null);
  assert.deepEqual(store.get().achievements, {});
  store.saveDeck({ billy: 12 });
  store.saveDeck({ billy: 13 });
  assert.deepEqual(store.get().deck, { billy: 12 });
  assert.deepEqual(Object.keys(store.get().achievements), ['deck-builder']);
  store.saveDeck(null);
  assert.equal(store.get().deck, null);
  assert.deepEqual(Object.keys(store.get().achievements), ['deck-builder']);
});

test('snapshots and caller-owned decks cannot mutate the store', () => {
  const store = createProfileStore(null);
  const deck = { billy: 3 };
  store.saveDeck(deck);
  deck.billy = 12;
  const snapshot = store.get();
  assert.notEqual(snapshot, store.get());
  assert.notEqual(snapshot.settings, store.get().settings);
  for (const part of [snapshot, snapshot.settings, snapshot.deck, snapshot.achievements, snapshot.stats]) {
    assert.equal(Object.isFrozen(part), true);
  }
  assert.throws(() => { snapshot.deck.billy = 10; }, TypeError);
  store.record('summon');
  assert.equal(snapshot.stats.summons, 0);
  assert.equal(store.get().deck.billy, 3);
});

test('explicit deck-saved events unlock only Deck Builder without fictional stats', () => {
  const store = createProfileStore(null);
  store.record('deck-saved', { id: 'save-1' });
  store.record('deck-saved', { id: 'save-1' });
  assert.deepEqual(Object.keys(store.get().achievements), ['deck-builder']);
  assert.deepEqual(store.get().stats, { matches: 0, wins: 0, summons: 0, spells: 0 });
});
