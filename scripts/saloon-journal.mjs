// Local Night Shift journal. Hooks call recordEvent (headline decisions) or
// recordActivity (ambient tool/session noise) with sanitized facts; the
// loopback server calls readEvents and readActivity. Storage lives in ignored
// sibling directories under .artifacts/night-shift-saloon/, one file per
// record:
//   events/   e-<hash>.json  headlines, never pruned
//   activity/ a-<hash>.json  ambient, pruned to the latest ACTIVITY_KEEP
//
// Concurrency: each record has a deterministic id (hash of kind, payload and
// the caller's stable key). The file is written to a private temp name and
// then hard-linked into place; link() fails with EEXIST when the record
// already exists, so duplicates from retries or other processes are dropped
// and readers never see a partial file. Raw keys and unknown fields are never
// written: only the allowlisted object from the board's cleaner reaches disk.
// Pruning only unlinks whole files, so readers and racing pruners see either
// a complete record or none, and ENOENT from a racing unlink is ignored.

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVITY_LIMIT, FEED_LIMIT, clampLimit, cleanActivity, cleanEvent, compareRecords, latest,
} from '../src/ui/night-shift-events.js';

const BASE = ['.artifacts', 'night-shift-saloon'];
const MAX_BYTES = 1024;
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const PROBE = { id: 'probe', at: '2000-01-01T00:00:00Z' };

// Ambient retention: once more than ACTIVITY_HIGH files exist, the oldest are
// unlinked down to ACTIVITY_KEEP. The gap means pruning runs about once per
// 64 writes instead of on every write.
export const ACTIVITY_KEEP = 192;
const ACTIVITY_HIGH = 256;

const EVENTS = { dir: 'events', prefix: 'e', clean: cleanEvent, file: /^e-[0-9a-f]{24}\.json$/ };
const ACTIVITY = { dir: 'activity', prefix: 'a', clean: cleanActivity, file: /^a-[0-9a-f]{24}\.json$/ };

// Returns the board directory, creating it if asked. Refuses any symlinked
// or non-directory component below root.
function boardDir(root, board, create) {
  let dir = path.resolve(root);
  for (const segment of [...BASE, board.dir]) {
    dir = path.join(dir, segment);
    let stat;
    try {
      stat = fs.lstatSync(dir);
    } catch (error) {
      if (error.code !== 'ENOENT' || !create) return null;
      try {
        fs.mkdirSync(dir, { mode: 0o700 });
      } catch (raced) {
        if (raced.code !== 'EEXIST') throw raced; // another process created it
      }
      stat = fs.lstatSync(dir);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
  }
  return dir;
}

function readOne(board, file) {
  let fd;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
    fd = fs.openSync(file, fs.constants.O_RDONLY | NOFOLLOW);
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (size > MAX_BYTES) return null;
    const record = board.clean(JSON.parse(buffer.toString('utf8', 0, size)));
    return record && `${record.id}.json` === path.basename(file) ? record : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
}

// Every valid record on the board with its file name, oldest first, plus the
// names of matching files that failed validation.
function scan(dir, board) {
  const records = [];
  const invalid = [];
  for (const name of fs.readdirSync(dir)) {
    if (!board.file.test(name)) continue;
    const record = readOne(board, path.join(dir, name));
    if (record) records.push(record);
    else invalid.push(name);
  }
  return { records: records.sort(compareRecords), invalid };
}

function unlinkQuiet(file) {
  try { fs.unlinkSync(file); } catch { /* raced with another pruner */ }
}

function prune(dir, board, keep, high) {
  const names = fs.readdirSync(dir).filter((name) => board.file.test(name));
  if (names.length <= high) return;
  const { records, invalid } = scan(dir, board);
  for (const name of invalid) unlinkQuiet(path.join(dir, name));
  for (const record of records.slice(0, Math.max(0, records.length - keep))) {
    unlinkQuiet(path.join(dir, `${record.id}.json`));
  }
}

// Synchronous, best effort, never throws. Returns the stored (or already
// stored) record, or null when the facts are invalid or storage is unavailable.
function record(root, board, facts, stableKey) {
  let temp = null;
  try {
    if (!facts || typeof facts !== 'object') return null;
    const probe = board.clean({ ...facts, ...PROBE });
    if (!probe) return null;
    const { id: _id, at: _at, ...payload } = probe;
    const key = typeof stableKey === 'string' && stableKey ? stableKey : randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(JSON.stringify([key, Object.entries(payload)]))
      .digest('hex').slice(0, 24);
    const at = typeof facts.at === 'string' && board.clean({ ...payload, id: PROBE.id, at: facts.at })
      ? facts.at
      : new Date().toISOString();
    const clean = board.clean({ ...payload, id: `${board.prefix}-${hash}`, at });
    if (!clean) return null;
    const dir = boardDir(root, board, true);
    if (!dir) return null;
    const target = path.join(dir, `${clean.id}.json`);
    temp = path.join(dir, `.${clean.id}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
    const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
    try {
      fs.writeSync(fd, JSON.stringify(clean));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.linkSync(temp, target);
    } catch (error) {
      if (error.code !== 'EEXIST') return null;
      return readOne(board, target) ?? clean;
    }
    if (board === ACTIVITY) {
      try { prune(dir, board, ACTIVITY_KEEP, ACTIVITY_HIGH); } catch { /* retry on a later write */ }
    }
    return clean;
  } catch {
    return null;
  } finally {
    if (temp) unlinkQuiet(temp);
  }
}

function read(root, board, limit) {
  try {
    if (limit === 0) return [];
    const dir = boardDir(root, board, false);
    if (!dir) return [];
    return latest(scan(dir, board).records, limit);
  } catch {
    return [];
  }
}

export function recordEvent(root, facts, stableKey) {
  return record(root, EVENTS, facts, stableKey);
}

export function recordActivity(root, facts, stableKey) {
  return record(root, ACTIVITY, facts, stableKey);
}

// Latest `limit` valid headline events (at most 1000), oldest first.
// limit 0 yields []; missing storage yields [].
export function readEvents(root, limit = FEED_LIMIT) {
  return read(root, EVENTS, clampLimit(limit, FEED_LIMIT, 1000));
}

// Latest `limit` valid activity samples (at most ACTIVITY_KEEP), oldest first.
export function readActivity(root, limit = ACTIVITY_LIMIT) {
  return read(root, ACTIVITY, clampLimit(limit, ACTIVITY_LIMIT, ACTIVITY_KEEP));
}
