// node --test tests/match/night-shift-server.test.js
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { cleanActivity, cleanEvent, cleanFeed, cleanPatch } from '../../src/ui/night-shift-events.js';
import { ACTIVITY_ACTORS, ACTIVITY_PHASES, cleanActivityFields } from '../../src/ui/night-shift-presence.js';
import { ACTIVITY_KEEP, readActivity, readEvents, recordActivity, recordEvent } from '../../scripts/saloon-journal.mjs';
import { startSaloon } from '../../scripts/night-shift-saloon.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const journalUrl = pathToFileURL(path.join(here, '../../scripts/saloon-journal.mjs')).href;
const AT = '2026-11-21T18:30:00Z';
const tempRoots = [];
const tempRoot = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'night-shift-'));
  tempRoots.push(dir);
  return dir;
};
after(() => tempRoots.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const eventsDir = (root) => path.join(root, '.artifacts', 'night-shift-saloon', 'events');
const activityDir = (root) => path.join(root, '.artifacts', 'night-shift-saloon', 'activity');
const second = (i) => new Date(Date.UTC(2026, 10, 21, 0, 0, 0) + i * 1000).toISOString();

// Canonical presence values from src/ui/night-shift-presence.js.
const AMBIENT = Object.freeze({ actor: 'sheriff', phase: 'PreToolUse' });

test('ambient fixture uses canonical presence values the real validator accepts', () => {
  assert.ok(ACTIVITY_ACTORS.includes(AMBIENT.actor));
  assert.ok(ACTIVITY_PHASES.includes(AMBIENT.phase));
  assert.deepEqual(cleanActivityFields(AMBIENT), AMBIENT);
  for (const actor of ACTIVITY_ACTORS) for (const phase of ACTIVITY_PHASES) {
    const input = { id: 'a-1', at: AT, kind: 'activity', actor, phase };
    assert.deepEqual(cleanActivity(input), input, `${actor}/${phase}`);
  }
  for (const bad of [{ actor: 'kiro', phase: 'PreToolUse' }, { actor: 'sheriff', phase: 'tool' },
    { actor: 'Sheriff', phase: 'PreToolUse' }, { actor: 'sheriff', phase: 'pretooluse' }]) {
    assert.equal(cleanActivity({ id: 'a-1', at: AT, kind: 'activity', ...bad }), null, JSON.stringify(bad));
  }
});

test('cleanEvent keeps allowlisted fields and returns a new object', () => {
  const input = { id: 'e-1', at: AT, kind: 'cast', card: 'dust-devil', field: 'attack', before: 3, after: 4,
    prompt: 'secret', path: '/Users/x', session: 'abc' };
  const event = cleanEvent(input);
  assert.deepEqual(event, { id: 'e-1', at: AT, kind: 'cast', card: 'dust-devil', field: 'attack', before: 3, after: 4 });
  assert.notEqual(event, input);
  assert.deepEqual(cleanEvent({ id: 'e-2', at: AT, kind: 'bell', note: 'hi' }), { id: 'e-2', at: AT, kind: 'bell' });
  assert.deepEqual(cleanEvent({ id: 'e-3', at: AT, kind: 'block', rule: 'tasks' }), { id: 'e-3', at: AT, kind: 'block', rule: 'tasks' });
  assert.deepEqual(cleanEvent({ id: 'e-4', at: AT, kind: 'wanted', boss: 'dragon' }), { id: 'e-4', at: AT, kind: 'wanted', boss: 'dragon' });
  assert.equal(cleanEvent({ id: 'e-5', at: AT, kind: 'cast', card: 'a', field: 'stars', before: 0, after: 12 }).after, 12);
});

test('cleanEvent rejects malformed input', () => {
  const base = { id: 'e-1', at: AT, kind: 'cast', card: 'dust-devil', field: 'health', before: 2, after: 5 };
  const bad = [
    null, 'job', [], {},
    { ...base, id: 'E-1' }, { ...base, id: 'x'.repeat(65) }, { ...base, id: '../e' },
    { ...base, at: '2026-02-30T00:00:00Z' }, { ...base, at: '2026-11-21T18:30:00+01:00' }, { ...base, at: 'yesterday' },
    { ...base, kind: 'shell' }, { ...base, field: 'mana' }, { ...base, card: 'Dust Devil' }, { ...base, card: '../x' },
    { ...base, before: 2, after: 2 }, { ...base, after: 13 }, { ...base, before: -1 }, { ...base, after: 4.5 }, { ...base, after: '5' },
    { id: 'e-1', at: AT, kind: 'block', rule: 'other' },
    { id: 'e-1', at: AT, kind: 'wanted', boss: 'Rm -rf' },
    Object.create({ id: 'e-1', at: AT, kind: 'job' }),
  ];
  for (const input of bad) assert.equal(cleanEvent(input), null, JSON.stringify(input));
});

test('cleanPatch requires a full lowercase commit', () => {
  const patch = { id: 'p-1', at: AT, kind: 'patch', card: 'a', field: 'attack', before: 1, after: 2, commit: 'a'.repeat(40) };
  assert.deepEqual(cleanPatch({ ...patch, extra: 1 }), patch);
  assert.equal(cleanPatch({ ...patch, commit: 'A'.repeat(40) }), null);
  assert.equal(cleanPatch({ ...patch, commit: 'abc1234' }), null);
});

test('recordEvent never persists raw keys or extra data and dedupes retries', () => {
  const root = tempRoot();
  const facts = { kind: 'cast', card: 'dust-devil', field: 'attack', before: 3, after: 4, at: AT,
    command: 'rm -rf /', token: 'sk-secret' };
  const first = recordEvent(root, facts, 'session-abc/Users/me');
  const retry = recordEvent(root, { ...facts, at: '2026-11-21T18:31:00Z' }, 'session-abc/Users/me');
  const distinct = recordEvent(root, { ...facts, before: 4, after: 5 }, 'session-abc/Users/me');
  assert.match(first.id, /^e-[0-9a-f]{24}$/);
  assert.deepEqual(retry, first);
  assert.notEqual(distinct.id, first.id);
  const files = fs.readdirSync(eventsDir(root));
  assert.equal(files.length, 2);
  for (const name of files) {
    const text = fs.readFileSync(path.join(eventsDir(root), name), 'utf8');
    for (const raw of ['session', 'Users', 'rm -rf', 'sk-secret', 'command', 'token']) assert.ok(!text.includes(raw), raw);
  }
  assert.deepEqual(readEvents(root).map((e) => e.id).sort(), [first.id, distinct.id].sort());
});

test('recordEvent never throws on bad facts or storage', () => {
  const root = tempRoot();
  assert.equal(recordEvent(root, { kind: 'nope' }, 'k'), null);
  assert.equal(recordEvent(root, null, 'k'), null);
  assert.equal(recordEvent(path.join(root, 'missing', '\0bad'), { kind: 'job' }, 'k'), null);
  fs.writeFileSync(path.join(root, '.artifacts'), 'not a directory');
  assert.equal(recordEvent(root, { kind: 'job' }, 'k'), null);
  assert.deepEqual(readEvents(root), []);
});

test('readEvents ignores partial, foreign, oversized and symlinked files', () => {
  const root = tempRoot();
  const kept = recordEvent(root, { kind: 'bell', at: AT }, 'one');
  const dir = eventsDir(root);
  fs.writeFileSync(path.join(dir, 'e-aaaaaaaaaaaaaaaaaaaaaaaa.json'), '{"id":"e-aaaa');
  fs.writeFileSync(path.join(dir, `.${kept.id}.1.tmp`), JSON.stringify(kept));
  fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify({ ...kept, id: 'notes' }));
  fs.writeFileSync(path.join(dir, 'e-bbbbbbbbbbbbbbbbbbbbbbbb.json'), JSON.stringify({ ...kept, id: 'e-bbbbbbbbbbbbbbbbbbbbbbbb', pad: 'x'.repeat(2000) }));
  fs.writeFileSync(path.join(dir, 'e-cccccccccccccccccccccccc.json'), JSON.stringify({ ...kept, id: 'e-other' }));
  const outside = path.join(root, 'outside.json');
  fs.writeFileSync(outside, JSON.stringify({ ...kept, id: 'e-dddddddddddddddddddddddd' }));
  fs.symlinkSync(outside, path.join(dir, 'e-dddddddddddddddddddddddd.json'));
  assert.deepEqual(readEvents(root), [kept]);
});

test('readEvents refuses a symlinked journal directory', () => {
  const root = tempRoot();
  const elsewhere = tempRoot();
  recordEvent(elsewhere, { kind: 'job', at: AT }, 'k');
  fs.symlinkSync(path.join(elsewhere, '.artifacts'), path.join(root, '.artifacts'));
  assert.deepEqual(readEvents(root), []);
  assert.equal(recordEvent(root, { kind: 'job' }, 'k2'), null);
});

test('readEvents is bounded and chronological, and survives journal recreation', () => {
  const root = tempRoot();
  for (let i = 0; i < 105; i += 1) {
    const at = new Date(Date.UTC(2026, 10, 21, 0, 0, 0) + i * 1000).toISOString();
    recordEvent(root, { kind: 'job', at }, `job-${i}`);
  }
  const events = readEvents(root);
  assert.equal(events.length, 100);
  assert.equal(events[0].at, '2026-11-21T00:00:05.000Z');
  assert.deepEqual(events.map((e) => e.at), events.map((e) => e.at).slice().sort());
  assert.deepEqual(readEvents(root), events, 'reading again after a restart returns the same events');
  fs.rmSync(path.join(root, '.artifacts'), { recursive: true });
  assert.deepEqual(readEvents(root), []);
  assert.ok(recordEvent(root, { kind: 'bell', at: AT }, 'after-reset'));
  assert.equal(readEvents(root).length, 1);
});

test('concurrent duplicate records from separate processes store one event', async () => {
  const root = tempRoot();
  const code = `import { recordEvent } from ${JSON.stringify(journalUrl)};
    const e = recordEvent(${JSON.stringify(root)}, { kind: 'wanted', boss: 'dragon', at: ${JSON.stringify(AT)} }, 'same-key');
    process.stdout.write(e ? e.id : 'null');`;
  const run = promisify(execFile);
  const outputs = await Promise.all(Array.from({ length: 8 }, () =>
    run(process.execPath, ['--input-type=module', '-e', code])));
  const ids = new Set(outputs.map((o) => o.stdout));
  assert.equal(ids.size, 1);
  assert.ok(![...ids][0].startsWith('null'));
  assert.deepEqual(fs.readdirSync(eventsDir(root)), [`${[...ids][0]}.json`]);
});

test('cleanActivity projects only id, at, kind and the presence validator fields', () => {
  const input = { id: 'a-1', at: AT, kind: 'activity', ...AMBIENT,
    prompt: 'secret prompt', tool: 'shell', command: 'rm -rf /', token: 'sk-secret', path: '/Users/me' };
  assert.deepEqual(cleanActivityFields(input), { actor: 'sheriff', phase: 'PreToolUse' });
  const record = cleanActivity(input);
  assert.deepEqual(record, { id: 'a-1', at: AT, kind: 'activity', actor: 'sheriff', phase: 'PreToolUse' });
  assert.deepEqual(Object.keys(record).sort(), ['actor', 'at', 'id', 'kind', 'phase']);
  assert.notEqual(record, input);
  const badActor = { ...input, actor: '../Users/me', prompt: 'x' };
  assert.equal(cleanActivityFields(badActor), null);
  assert.equal(cleanActivity(badActor), null);
  for (const bad of [{ ...input, kind: 'job' }, { ...input, id: 'A-1' }, { ...input, at: 'now' }, null, []]) {
    assert.equal(cleanActivity(bad), null, JSON.stringify(bad));
  }
});

test('activity and headline events live on independent boards', () => {
  const root = tempRoot();
  const headline = recordEvent(root, { kind: 'block', rule: 'tasks', at: AT }, 'decision');
  assert.equal(recordEvent(root, { kind: 'activity', ...AMBIENT, at: AT }, 'k'), null, 'events board rejects activity');
  assert.equal(recordActivity(root, { kind: 'block', rule: 'tasks', at: AT }, 'k'), null, 'activity board rejects headlines');
  assert.equal(cleanEvent({ id: 'a-1', at: AT, kind: 'activity', ...AMBIENT }), null);
  const ambient = recordActivity(root, { kind: 'activity', ...AMBIENT, at: AT, prompt: 'secret prompt', tool: 'shell' }, 'tool-1');
  assert.match(ambient.id, /^a-[0-9a-f]{24}$/);
  assert.deepEqual(recordActivity(root, { kind: 'activity', ...AMBIENT, at: second(5) }, 'tool-1'), ambient, 'retry dedupes');
  assert.deepEqual(readEvents(root), [headline]);
  assert.deepEqual(readActivity(root), [ambient]);
  assert.deepEqual(fs.readdirSync(eventsDir(root)), [`${headline.id}.json`]);
  assert.deepEqual(fs.readdirSync(activityDir(root)), [`${ambient.id}.json`]);
  const text = fs.readFileSync(path.join(activityDir(root), `${ambient.id}.json`), 'utf8');
  for (const raw of ['secret', 'prompt', 'shell', 'tool-1']) assert.ok(!text.includes(raw), raw);
  const feed = cleanFeed({ events: [headline, ambient], patches: [ambient], activity: [headline, ambient] });
  assert.deepEqual(feed, { events: [headline], patches: [], activity: [ambient] });
});

test('activity retention is bounded and never displaces headline events', () => {
  const root = tempRoot();
  const headlines = [];
  for (let i = 0; i < 400; i += 1) {
    if (i % 100 === 0) headlines.push(recordEvent(root, { kind: 'bell', at: second(i) }, `bell-${i}`));
    assert.ok(recordActivity(root, { kind: 'activity', ...AMBIENT, at: second(i) }, `tool-${i}`), `write ${i}`);
  }
  const files = fs.readdirSync(activityDir(root));
  assert.ok(files.length >= 128 && files.length <= 256, `kept ${files.length} files`);
  assert.deepEqual(readEvents(root), headlines, 'headlines are never pruned');
  const recent = readActivity(root);
  assert.equal(recent.length, 64);
  assert.equal(recent.at(-1).at, second(399));
  const all = readActivity(root, 10000);
  assert.ok(all.length <= ACTIVITY_KEEP);
  assert.deepEqual(all.map((a) => a.at), all.map((a) => a.at).slice().sort());
});

test('limit zero returns nothing and bad limits fall back to the default', () => {
  const root = tempRoot();
  for (let i = 0; i < 3; i += 1) {
    recordEvent(root, { kind: 'job', at: second(i) }, `job-${i}`);
    recordActivity(root, { kind: 'activity', ...AMBIENT, at: second(i) }, `tool-${i}`);
  }
  assert.deepEqual(readEvents(root, 0), []);
  assert.deepEqual(readActivity(root, 0), []);
  assert.equal(readEvents(root, 1).length, 1);
  assert.equal(readEvents(root, -5).length, 0);
  assert.equal(readEvents(root, 'all').length, 3);
  assert.equal(readActivity(root, Number.NaN).length, 3);
  const feed = cleanFeed({ events: readEvents(root), activity: readActivity(root) }, 0, 0);
  assert.deepEqual(feed, { events: [], patches: [], activity: [] });
});

function request(port, { method = 'GET', pathname = '/', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname,
      headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('loopback saloon server', () => {
let saloon;
let serverRoot;
before(async () => {
  serverRoot = tempRoot();
  fs.mkdirSync(path.join(serverRoot, 'dist'));
  fs.writeFileSync(path.join(serverRoot, 'dist', 'cowboys-vs-wizards-showdown-3d.html'), '<!doctype html><title>Showdown</title>');
  fs.writeFileSync(path.join(serverRoot, 'dist', 'other.html'), 'secret build');
  fs.writeFileSync(path.join(serverRoot, 'package.json'), '{"secret":true}');
  recordEvent(serverRoot, { kind: 'block', rule: 'balancer', at: AT }, 'srv');
  recordActivity(serverRoot, { kind: 'activity', ...AMBIENT, at: AT, prompt: 'secret prompt', tool: 'shell' }, 'srv-tool');
  saloon = await startSaloon({ root: serverRoot, port: 0 });
});
after(() => new Promise((resolve) => saloon.server.close(resolve)));

test('server binds loopback on an ephemeral port with a live startup URL', () => {
  assert.equal(saloon.server.address().address, '127.0.0.1');
  assert.ok(saloon.port > 0);
  assert.equal(saloon.url, `http://127.0.0.1:${saloon.port}/?saloon=live`);
});

test('GET / serves only the illustrated build with no-store and no CORS', async () => {
  const res = await request(saloon.port, { pathname: '/?saloon=live' });
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/html/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.match(res.body, /Showdown/);
});

test('GET /night-shift/events returns separate {events, patches, activity} boards', async () => {
  const res = await request(saloon.port, { pathname: '/night-shift/events',
    headers: { origin: `http://127.0.0.1:${saloon.port}`, 'sec-fetch-site': 'same-origin' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  const body = JSON.parse(res.body);
  assert.deepEqual(Object.keys(body).sort(), ['activity', 'events', 'patches']);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].rule, 'balancer');
  assert.deepEqual(body.activity, readActivity(serverRoot));
  assert.equal(body.activity.length, 1);
  assert.deepEqual(Object.keys(body.activity[0]).sort(), ['actor', 'at', 'id', 'kind', 'phase']);
  assert.ok(Array.isArray(body.patches));
  assert.deepEqual(body.patches, [], 'a root with no main history has no patches');
  for (const patch of body.patches) assert.deepEqual(cleanPatch(patch), patch);
  for (const raw of ['secret', 'prompt', 'shell', 'srv-tool']) assert.ok(!res.body.includes(raw), raw);
});

test('server is read only and serves no other paths', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await request(saloon.port, { method, pathname: '/night-shift/events' });
    assert.equal(res.status, 405, method);
  }
  for (const pathname of ['/dist/other.html', '/package.json', '/../package.json', '/%2e%2e/package.json',
    '/cowboys-vs-wizards-showdown-3d.html', '/night-shift/events/', '/.artifacts/night-shift-saloon/events']) {
    const res = await request(saloon.port, { pathname });
    assert.equal(res.status, 404, pathname);
    assert.ok(!res.body.includes('secret'), pathname);
  }
});

test('server rejects foreign Host and cross-origin browser requests', async () => {
  const port = saloon.port;
  const forbidden = [
    { host: `evil.example:${port}` },
    { host: '127.0.0.1:1' },
    { host: `localhost:${port}`, origin: 'http://evil.example' },
    { origin: `http://localhost:${port}` },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' },
  ];
  for (const headers of forbidden) {
    const res = await request(port, { pathname: '/night-shift/events', headers });
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.ok(!res.body.includes('balancer'));
  }
  const local = await request(port, { pathname: '/night-shift/events',
    headers: { host: `localhost:${port}`, origin: `http://localhost:${port}` } });
  assert.equal(local.status, 200);
});

test('missing build gets a friendly 503 while events still work', async () => {
  const root = tempRoot();
  const bare = await startSaloon({ root, port: 0 });
  try {
    const page = await request(bare.port);
    assert.equal(page.status, 503);
    assert.match(page.body, /build is missing/);
    const feed = await request(bare.port, { pathname: '/night-shift/events' });
    assert.equal(feed.status, 200);
    assert.deepEqual(JSON.parse(feed.body), { events: [], patches: [], activity: [] });
  } finally {
    await new Promise((resolve) => bare.server.close(resolve));
  }
});
});
