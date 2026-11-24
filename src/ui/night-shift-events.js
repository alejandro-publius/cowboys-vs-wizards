// Browser-safe validator for Night Shift saloon records. No DOM, Node or
// network dependencies: the journal, the loopback server and the illustrated
// client all share these checks. Every function returns a NEW allowlisted
// object or null; unknown payload fields are dropped, never copied.
//
// Three independent boards: headline `events` (job, bell, block, wanted,
// cast), published `patches`, and the ambient `activity` feed. A record valid
// on one board is never accepted on another.

import { cleanActivityFields } from './night-shift-presence.js';

export const STAT_MIN = 0;
export const STAT_MAX = 12;

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 48;
const COMMIT = /^[0-9a-f]{40}$/;
const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;
const RULES = new Set(['balancer', 'completion', 'tasks']);
const FIELDS = new Set(['attack', 'health', 'stars']);

function own(input, key) {
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
}

export function isSafeId(value) {
  return typeof value === 'string' && ID.test(value);
}

export function isSafeSlug(value) {
  return typeof value === 'string' && value.length <= SLUG_MAX && SLUG.test(value);
}

// Strict ISO 8601 UTC with a real calendar date (rejects 2026-02-30 etc.).
export function isUtcTimestamp(value) {
  if (typeof value !== 'string') return false;
  const m = ISO_UTC.exec(value);
  if (!m) return false;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const date = new Date(t);
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d && date.getUTCHours() === h &&
    date.getUTCMinutes() === mi && date.getUTCSeconds() === s;
}

function isStat(value) {
  return Number.isInteger(value) && value >= STAT_MIN && value <= STAT_MAX;
}

function cleanChange(input) {
  const card = own(input, 'card');
  const field = own(input, 'field');
  const before = own(input, 'before');
  const after = own(input, 'after');
  if (!isSafeSlug(card) || !FIELDS.has(field)) return null;
  if (!isStat(before) || !isStat(after) || before === after) return null;
  return { card, field, before, after };
}

export function cleanEvent(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const id = own(input, 'id');
    const at = own(input, 'at');
    const kind = own(input, 'kind');
    if (!isSafeId(id) || !isUtcTimestamp(at)) return null;
    if (kind === 'job' || kind === 'bell') return { id, at, kind };
    if (kind === 'block') {
      const rule = own(input, 'rule');
      return RULES.has(rule) ? { id, at, kind, rule } : null;
    }
    if (kind === 'wanted') {
      const boss = own(input, 'boss');
      return isSafeSlug(boss) ? { id, at, kind, boss } : null;
    }
    if (kind === 'cast') {
      const change = cleanChange(input);
      return change ? { id, at, kind, ...change } : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Published main patch record. Whether `commit` is on main's first-parent
// history is checked by scripts/saloon-patches.mjs; this only checks shape.
export function cleanPatch(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const id = own(input, 'id');
    const at = own(input, 'at');
    const commit = own(input, 'commit');
    if (own(input, 'kind') !== 'patch') return null;
    if (!isSafeId(id) || !isUtcTimestamp(at) || typeof commit !== 'string' || !COMMIT.test(commit)) return null;
    const change = cleanChange(input);
    return change ? { id, at, kind: 'patch', ...change, commit } : null;
  } catch {
    return null;
  }
}

// Ambient tool/session activity. Actor and phase come only from the
// presence validator's projection; every other input field is dropped.
export function cleanActivity(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const id = own(input, 'id');
    const at = own(input, 'at');
    if (own(input, 'kind') !== 'activity' || !isSafeId(id) || !isUtcTimestamp(at)) return null;
    const fields = cleanActivityFields(input);
    if (!fields || typeof fields !== 'object') return null;
    const { actor, phase } = fields;
    if (typeof actor !== 'string' || typeof phase !== 'string') return null;
    return { id, at, kind: 'activity', actor, phase };
  } catch {
    return null;
  }
}

function chronological(a, b) {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Integer in [0, max]. Non-numeric input uses the fallback; 0 means none.
export function clampLimit(limit, fallback, max) {
  const value = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : fallback;
  return Math.min(max, Math.max(0, value));
}

// Latest `limit` records, oldest first. slice(-0) would return everything.
export function latest(records, limit) {
  return limit > 0 ? records.slice(-limit) : [];
}

// Drop invalid and duplicate ids, sort oldest first, keep the latest `limit`.
export function cleanList(list, clean, limit) {
  if (!Array.isArray(list)) return [];
  const seen = new Map();
  for (const item of list.slice(-10000)) {
    const record = clean(item);
    if (record && !seen.has(record.id)) seen.set(record.id, record);
  }
  return latest([...seen.values()].sort(chronological), limit);
}

export const FEED_LIMIT = 100;
export const ACTIVITY_LIMIT = 64;

// Clean an {events, patches, activity} feed. Each board is validated with its
// own cleaner and bounded separately, so activity can never displace events.
export function cleanFeed(input, limit = FEED_LIMIT, activityLimit = ACTIVITY_LIMIT) {
  const source = input && typeof input === 'object' ? input : {};
  const n = clampLimit(limit, FEED_LIMIT, 1000);
  return {
    events: cleanList(own(source, 'events'), cleanEvent, n),
    patches: cleanList(own(source, 'patches'), cleanPatch, n),
    activity: cleanList(own(source, 'activity'), cleanActivity, clampLimit(activityLimit, ACTIVITY_LIMIT, 1000)),
  };
}

export { chronological as compareRecords };
