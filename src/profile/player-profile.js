import {dragonRewardEarned, HUNTS_BY_ID} from '../game/bounty-hunt.js';

const STORAGE_KEY = 'cvw-player-v1';
const DEFAULT_SETTINGS = Object.freeze({
  sound: false,
  reducedMotion: false,
  performance: 'auto',
});
const STAT_KEYS = ['matches', 'wins', 'summons', 'spells'];
const EVENT_TYPES = new Set(['summon', 'spell', 'match-complete', 'deck-saved']);

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first-summon', name: 'First Summon', description: 'Summon your first unit.' },
  { id: 'first-spell', name: 'First Spell', description: 'Cast your first spell.' },
  { id: 'first-match', name: 'First Match', description: 'Finish your first match.' },
  { id: 'first-win', name: 'First Victory', description: 'Win your first match.' },
  { id: 'deck-builder', name: 'Deck Builder', description: 'Save a custom deck.' },
  { id: 'bounty-hunter', name: 'Bounty Hunter', description: 'Clear all five Graveyard Dragon hunts.' },
  { id: 'clean-capture', name: 'Clean Capture', description: 'Win a bounty without losing a Base orb.' },
].map(Object.freeze));

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function settingsPatch(value) {
  const patch = {};
  if (!isRecord(value)) return patch;
  for (const key of ['sound', 'reducedMotion']) {
    if (Object.hasOwn(value, key) && typeof value[key] === 'boolean') patch[key] = value[key];
  }
  if (Object.hasOwn(value, 'performance') && ['auto', 'low'].includes(value.performance)) {
    patch.performance = value.performance;
  }
  return patch;
}

// Card identities and deck composition rules belong to the game, not this store.
function validatedDeck(value) {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.some(([key, count]) => (
    key.trim().length === 0 || ['__proto__', 'prototype', 'constructor'].includes(key)
    || !Number.isInteger(count) || count < 0 || count > 12
  ))) return null;
  return Object.fromEntries(entries);
}

function emptyProfile() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    deck: null,
    achievements: {},
    clearedHunts: [],
    stats: { matches: 0, wins: 0, summons: 0, spells: 0 },
  };
}

function validatedProfile(value) {
  const profile = emptyProfile();
  if (!isRecord(value)) return profile;
  Object.assign(profile.settings, settingsPatch(value.settings));
  profile.deck = validatedDeck(value.deck);
  if (Array.isArray(value.clearedHunts)) {
    profile.clearedHunts = [...new Set(value.clearedHunts.filter((id) => HUNTS_BY_ID.has(id)))];
  }
  if (isRecord(value.stats)) {
    for (const key of STAT_KEYS) {
      const count = Object.hasOwn(value.stats, key) ? value.stats[key] : undefined;
      if (Number.isSafeInteger(count) && count >= 0) profile.stats[key] = count;
    }
    profile.stats.wins = Math.min(profile.stats.wins, profile.stats.matches);
  }
  if (isRecord(value.achievements)) {
    for (const { id } of ACHIEVEMENTS) {
      const stamp = Object.hasOwn(value.achievements, id) ? value.achievements[id] : undefined;
      if (typeof stamp !== 'string') continue;
      const date = new Date(stamp);
      if (Number.isFinite(date.getTime()) && date.toISOString() === stamp) {
        profile.achievements[id] = stamp;
      }
    }
  }
  return profile;
}

function frozenSnapshot(profile) {
  return Object.freeze({
    settings: Object.freeze({ ...profile.settings }),
    deck: profile.deck === null ? null : Object.freeze({ ...profile.deck }),
    achievements: Object.freeze({ ...profile.achievements }),
    clearedHunts: Object.freeze([...profile.clearedHunts]),
    stats: Object.freeze({ ...profile.stats }),
  });
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function eventIdentifier(value) {
  if (typeof value === 'string' && value.length > 0) return `string:${value}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `number:${value}`;
  return null;
}

/** Local, optional persistence. Event deduplication lasts only for this store instance. */
export function createProfileStore(storage = defaultStorage()) {
  let profile = emptyProfile();
  let persistent = false;
  let saved;
  try {
    persistent = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
    saved = storage?.getItem(STORAGE_KEY);
  } catch {
    persistent = false;
  }
  if (typeof saved === 'string') {
    try {
      profile = validatedProfile(JSON.parse(saved));
    } catch {
      // A corrupt save does not mean the next valid save cannot persist.
    }
  }

  const seenEvents = new Set();
  const seenMatches = new Set();
  const get = () => frozenSnapshot(profile);
  const persist = () => {
    try {
      if (typeof storage?.setItem !== 'function') {
        persistent = false;
      } else {
        storage.setItem(STORAGE_KEY, JSON.stringify(profile));
        persistent = true;
      }
    } catch {
      // Keep changes in memory when storage is full or access is denied.
      persistent = false;
    }
    return get();
  };
  const unlock = (id) => {
    if (!Object.hasOwn(profile.achievements, id)) profile.achievements[id] = new Date().toISOString();
  };
  const increment = (key) => {
    profile.stats[key] = Math.min(Number.MAX_SAFE_INTEGER, profile.stats[key] + 1);
  };

  return Object.freeze({
    get,
    isPersistent: () => persistent,
    updateSettings(patch) {
      const accepted = settingsPatch(patch);
      if (Object.keys(accepted).length === 0) return get();
      Object.assign(profile.settings, accepted);
      return persist();
    },
    saveDeck(counts) {
      if (counts === null) {
        profile.deck = null;
        return persist();
      }
      const deck = validatedDeck(counts);
      if (deck === null) return get();
      profile.deck = deck;
      unlock('deck-builder');
      return persist();
    },
    recordBounty(huntId, {clean = false} = {}) {
      if (!HUNTS_BY_ID.has(huntId)) return get();
      const cleared = profile.clearedHunts.includes(huntId);
      if (cleared && (!clean || profile.achievements['clean-capture'])) return get();
      if (!cleared) profile.clearedHunts.push(huntId);
      if (clean === true) unlock('clean-capture');
      if (dragonRewardEarned(profile)) unlock('bounty-hunter');
      return persist();
    },
    record(event, detail = {}) {
      if (!EVENT_TYPES.has(event)) return get();
      if (!isRecord(detail)) detail = {};
      const id = eventIdentifier(detail.id);
      const eventKey = id === null ? null : `${event}:${id}`;
      const matchKey = event === 'match-complete' ? eventIdentifier(detail.matchId) : null;
      if ((eventKey !== null && seenEvents.has(eventKey))
        || (matchKey !== null && seenMatches.has(matchKey))) return get();
      if (eventKey !== null) seenEvents.add(eventKey);
      if (matchKey !== null) seenMatches.add(matchKey);

      if (event === 'summon') {
        increment('summons');
        unlock('first-summon');
      } else if (event === 'spell') {
        increment('spells');
        unlock('first-spell');
      } else if (event === 'match-complete') {
        increment('matches');
        unlock('first-match');
        if (detail.won === true) {
          increment('wins');
          unlock('first-win');
        }
      } else {
        unlock('deck-builder');
      }
      return persist();
    },
  });
}
