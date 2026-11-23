// Loopback-only, read-only Night Shift saloon server.
//   node scripts/night-shift-saloon.mjs [--port 4179]
// GET /                   -> dist/cowboys-vs-wizards-showdown-3d.html
// GET /night-shift/events -> {events, patches, activity}
// Nothing else is served. No CORS; Host and Origin must be this loopback port.
// Each board is read and bounded separately: ambient activity never shares a
// list or a limit with headline events or patches.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readActivity, readEvents } from './saloon-journal.mjs';
import { readMainPatches } from './saloon-patches.mjs';
import { ACTIVITY_LIMIT, FEED_LIMIT, cleanList, cleanPatch } from '../src/ui/night-shift-events.js';

export const DEFAULT_PORT = 4179;
const HOST = '127.0.0.1';
const LOOPBACK_NAMES = ['127.0.0.1', 'localhost', '[::1]'];
const BUILD = path.join('dist', 'cowboys-vs-wizards-showdown-3d.html');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;

// readMainPatches returns [] when there is no main history and caches by the
// main SHA. Any other failure is a real bug and surfaces as a 500.
async function readFeed(root) {
  const patches = await readMainPatches(root);
  return {
    events: readEvents(root, FEED_LIMIT),
    patches: cleanList(patches, cleanPatch, FEED_LIMIT),
    activity: readActivity(root, ACTIVITY_LIMIT),
  };
}

function readBuild(root) {
  let fd;
  try {
    const file = path.join(root, BUILD);
    if (!fs.lstatSync(file).isFile()) return null;
    fd = fs.openSync(file, fs.constants.O_RDONLY | NOFOLLOW);
    return fs.readFileSync(fd);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), ...extra });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

function allowedHosts(port) {
  return new Set(LOOPBACK_NAMES.map((name) => `${name}:${port}`));
}

// Rejects DNS rebinding (Host) and cross-site browser requests (Origin,
// Sec-Fetch-Site). Requests without Origin, like curl or a top-level page
// load, are allowed when Host matches.
function trusted(req, port) {
  const hosts = allowedHosts(port);
  const host = String(req.headers.host ?? '').toLowerCase();
  if (!hosts.has(host)) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) return false;
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

export function createSaloonServer({ root = ROOT } = {}) {
  const server = http.createServer((req, res) => {
    const port = server.address()?.port;
    if (!trusted(req, port)) return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden\n');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'text/plain; charset=utf-8', 'Read only\n', { Allow: 'GET, HEAD' });
    }
    let pathname;
    try {
      pathname = new URL(req.url, 'http://saloon.invalid').pathname;
    } catch {
      return send(res, 400, 'text/plain; charset=utf-8', 'Bad request\n');
    }
    if (pathname === '/night-shift/events') {
      return readFeed(root).then(
        (feed) => send(res, 200, 'application/json; charset=utf-8', JSON.stringify(feed)),
        () => send(res, 500, 'text/plain; charset=utf-8', 'Saloon feed unavailable\n'),
      );
    }
    if (pathname === '/') {
      const html = readBuild(root);
      if (html) return send(res, 200, 'text/html; charset=utf-8', html);
      return send(res, 503, 'text/plain; charset=utf-8',
        `The illustrated Showdown build is missing (${BUILD}).\n` +
        'Build it first, then reload this page. /night-shift/events still works.\n');
    }
    return send(res, 404, 'text/plain; charset=utf-8', 'Not found\n');
  });
  return server;
}

// Starts on the loopback interface. port 0 picks a free port (for tests).
export function startSaloon({ root = ROOT, port = DEFAULT_PORT } = {}) {
  const server = createSaloonServer({ root });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      server.off('error', reject);
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://${HOST}:${actual}/?saloon=live` });
    });
  });
}

function parsePort(argv) {
  const index = argv.indexOf('--port');
  const inline = argv.find((arg) => arg.startsWith('--port='));
  const raw = inline ? inline.slice(7) : index >= 0 ? argv[index + 1] : undefined;
  if (raw === undefined) return DEFAULT_PORT;
  const port = /^\d{1,5}$/.test(raw) ? Number(raw) : NaN;
  if (!(port >= 0 && port <= 65535)) throw new Error(`Invalid --port ${raw}; use 0-65535.`);
  return port;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes('--help')) {
      console.log('Usage: node scripts/night-shift-saloon.mjs [--port 4179]');
      process.exit(0);
    }
    const { url } = await startSaloon({ port: parsePort(process.argv.slice(2)) });
    if (!readBuild(ROOT)) console.warn(`Note: ${BUILD} is missing; / will explain until it is built.`);
    console.log(`Night Shift saloon (loopback, read only): ${url}`);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? 'Port in use; try --port 0 or another port.' : error.message);
    process.exit(1);
  }
}
