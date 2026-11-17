import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateManifest, writeBuildIdentity } from "../../scripts/write-build-identity.mjs";
import { verifyLive } from "../../scripts/verify-build-identity.mjs";

const COMMIT = "a".repeat(40);
const OTHER = "b".repeat(40);
const HTML = "<!doctype html><title>fixture</title>";
const HTML_SHA = createHash("sha256").update(HTML).digest("hex");
const writer = fileURLToPath(new URL("../../scripts/write-build-identity.mjs", import.meta.url));
const quiet = { log() {}, delayMs: 1, timeoutMs: 500 };

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "build-identity-"));
  writeFileSync(join(dir, "index.html"), HTML);
  return dir;
}

test("writes a manifest with the exact commit, ISO time and index.html digest", async () => {
  const dir = tempDir();
  try {
    const now = new Date("2026-11-20T10:00:00.000Z");
    await writeBuildIdentity({ dir, commit: COMMIT, now });
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "build.json"), "utf8")),
      { version: 1, commit: COMMIT, builtAt: "2026-11-20T10:00:00.000Z", indexHtmlSha256: HTML_SHA });
  } finally { rmSync(dir, { recursive: true }); }
});

test("rejects an invalid commit, digest or timestamp", async () => {
  const dir = tempDir();
  try {
    for (const commit of ["abc", "A".repeat(40), "g".repeat(40), undefined])
      await assert.rejects(writeBuildIdentity({ dir, commit }), /commit/);
    const good = { version: 1, commit: COMMIT, builtAt: "2026-11-20T10:00:00Z", indexHtmlSha256: HTML_SHA };
    assert.ok(validateManifest(good));
    assert.throws(() => validateManifest({ ...good, indexHtmlSha256: "xyz" }), /indexHtmlSha256/);
    assert.throws(() => validateManifest({ ...good, builtAt: "yesterday" }), /builtAt/);
    assert.throws(() => validateManifest({ ...good, builtAt: "2026-13-45T10:00:00Z" }), /builtAt/);
    assert.throws(() => validateManifest({ ...good, extra: "/Users/me" }), /keys/);
  } finally { rmSync(dir, { recursive: true }); }
});

test("CLI needs --commit or GITHUB_SHA and takes no other environment", () => {
  const dir = tempDir();
  try {
    const env = { PATH: process.env.PATH };
    assert.notEqual(spawnSync(process.execPath, [writer, "--dir", dir], { env }).status, 0);
    assert.equal(spawnSync(process.execPath, [writer, "--dir", dir], { env: { ...env, GITHUB_SHA: COMMIT } }).status, 0);
    assert.equal(JSON.parse(readFileSync(join(dir, "build.json"), "utf8")).commit, COMMIT);
    assert.notEqual(spawnSync(process.execPath, [writer, "--dir", dir, "--commit", "short"], { env }).status, 0);
  } finally { rmSync(dir, { recursive: true }); }
});

async function serve(routes) {
  const hits = [];
  const server = createServer((request, response) => {
    const path = request.url.split("?")[0];
    hits.push({ path, query: request.url.split("?")[1] });
    const body = typeof routes[path] === "function" ? routes[path](hits.length) : routes[path];
    if (body === undefined) { response.statusCode = 404; return response.end("no"); }
    response.end(body);
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${server.address().port}/site`, hits, close: () => new Promise(done => server.close(done)) };
}

const manifestFor = (commit, sha) => JSON.stringify({ version: 1, commit, builtAt: "2026-11-20T10:00:00.000Z", indexHtmlSha256: sha });

test("live check passes when manifest commit and served HTML match the expected release", async () => {
  const site = await serve({ "/site/build.json": manifestFor(COMMIT, HTML_SHA), "/site/index.html": HTML });
  try {
    const manifest = await verifyLive({ ...quiet, url: site.url, commit: COMMIT, htmlSha256: HTML_SHA, attempts: 2 });
    assert.equal(manifest.commit, COMMIT);
    assert.ok(site.hits.every(hit => hit.query.startsWith("cb=")), "requests are cache-busted");
  } finally { await site.close(); }
});

test("live check fails on wrong commit, wrong served HTML, 404 and invalid JSON, after the attempt budget", async () => {
  const cases = {
    "wrong commit": { "/site/build.json": manifestFor(OTHER, HTML_SHA), "/site/index.html": HTML },
    "manifest claims the right digest but HTML differs": { "/site/build.json": manifestFor(COMMIT, HTML_SHA), "/site/index.html": HTML + "tampered" },
    "wrong digest": { "/site/build.json": manifestFor(COMMIT, "0".repeat(64)), "/site/index.html": HTML },
    "404": {},
    "invalid JSON": { "/site/build.json": "{not json", "/site/index.html": HTML },
  };
  for (const [name, routes] of Object.entries(cases)) {
    const site = await serve(routes);
    try {
      await assert.rejects(verifyLive({ ...quiet, url: site.url, commit: COMMIT, htmlSha256: HTML_SHA, attempts: 3 }), /after 3 attempts/, name);
      assert.ok(site.hits.filter(hit => hit.path === "/site/build.json").length === 3, `${name}: stops at the budget`);
    } finally { await site.close(); }
  }
});

test("retries until the new release propagates, then passes", async () => {
  const site = await serve({
    "/site/build.json": count => manifestFor(count < 3 ? OTHER : COMMIT, HTML_SHA),
    "/site/index.html": HTML,
  });
  try {
    await verifyLive({ ...quiet, url: site.url, commit: COMMIT, htmlSha256: HTML_SHA, attempts: 5 });
    assert.equal(site.hits.filter(hit => hit.path === "/site/build.json").length, 3);
  } finally { await site.close(); }
});

test("rejects bad expectations and non-https remote URLs before any request", async () => {
  await assert.rejects(verifyLive({ ...quiet, url: "https://example.test/", commit: "short", htmlSha256: HTML_SHA }), /commit/);
  await assert.rejects(verifyLive({ ...quiet, url: "https://example.test/", commit: COMMIT, htmlSha256: "x" }), /sha256/);
  await assert.rejects(verifyLive({ ...quiet, url: "http://example.test/", commit: COMMIT, htmlSha256: HTML_SHA }), /https/);
});
