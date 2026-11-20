// Checks a deployed site against the release it should be serving.
// Usage: node scripts/verify-build-identity.mjs --url <site base> --commit <40 hex> --html-sha256 <64 hex>
//        [--alias graybox/]... [--attempts 8] [--delay-ms 5000] [--timeout-ms 10000]
// The expected commit and digest come from the caller. The live build.json is only data to compare:
// it is parsed as JSON, never executed, and no URL inside it is followed. The live index.html is
// fetched and hashed independently, so a matching manifest alone does not pass. Each --alias names a
// directory under the site base (such as graybox/) whose index.html must be the same release bytes.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMIT_PATTERN, DIGEST_PATTERN, validateManifest } from "./write-build-identity.mjs";

async function fetchBytes(url, timeoutMs) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url.split("?")[0]} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// An alias is one or more plain path segments ending in "/": no scheme, query, "..", "." or leading "/".
const ALIAS_PATTERN = /^(?:[a-z0-9][a-z0-9-]*\/)+$/;

async function checkOnce(base, expected, timeoutMs, attempt, aliases) {
  const bust = `?cb=${Date.now()}-${attempt}`;
  const manifest = validateManifest(JSON.parse((await fetchBytes(base + "build.json" + bust, timeoutMs)).toString("utf8")));
  if (manifest.commit !== expected.commit) throw new Error(`live manifest commit ${manifest.commit} is not the expected ${expected.commit}`);
  if (manifest.indexHtmlSha256 !== expected.htmlSha256) throw new Error(`live manifest digest ${manifest.indexHtmlSha256} is not the expected ${expected.htmlSha256}`);
  const live = createHash("sha256").update(await fetchBytes(base + "index.html" + bust, timeoutMs)).digest("hex");
  if (live !== expected.htmlSha256) throw new Error(`live index.html digest ${live} is not the expected ${expected.htmlSha256}`);
  for (const alias of aliases) {
    const digest = createHash("sha256").update(await fetchBytes(base + alias + "index.html" + bust, timeoutMs)).digest("hex");
    if (digest !== expected.htmlSha256) throw new Error(`live ${alias}index.html digest ${digest} is not the expected ${expected.htmlSha256}`);
  }
  return manifest;
}

export async function verifyLive({ url, commit, htmlSha256, aliases = [], attempts = 8, delayMs = 5000, timeoutMs = 10000, log = console.log, sleep = ms => new Promise(done => setTimeout(done, ms)) }) {
  if (!COMMIT_PATTERN.test(commit ?? "")) throw new Error("expected commit must be 40 lowercase hex characters");
  if (!DIGEST_PATTERN.test(htmlSha256 ?? "")) throw new Error("expected html sha256 must be 64 lowercase hex characters");
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) throw new Error("attempts must be an integer from 1 to 20");
  if (!Array.isArray(aliases) || !aliases.every(alias => typeof alias === "string" && ALIAS_PATTERN.test(alias))) throw new Error("each alias must be a relative directory such as graybox/");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname))) throw new Error("url must be https (http only for localhost)");
  const base = parsed.origin + parsed.pathname.replace(/\/?$/, "/");
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const manifest = await checkOnce(base, { commit, htmlSha256 }, timeoutMs, attempt, aliases);
      log(`Verified ${base}: commit ${manifest.commit}, index.html sha256 ${manifest.indexHtmlSha256}${aliases.length ? ` (also ${aliases.join(", ")})` : ""} (attempt ${attempt})`);
      return manifest;
    } catch (error) {
      last = error;
      log(`Attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw new Error(`live site did not match the expected release after ${attempts} attempts: ${last.message}`);
}

function parseArgs(argv) {
  const names = { "--alias": "aliases", "--url": "url", "--commit": "commit", "--html-sha256": "htmlSha256", "--attempts": "attempts", "--delay-ms": "delayMs", "--timeout-ms": "timeoutMs" };
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    if (!key) throw new Error(`unknown argument: ${argv[i]}`);
    if (argv[i + 1] === undefined) throw new Error(`${argv[i]} needs a value`);
    if (key === "aliases") { (options.aliases ??= []).push(argv[i + 1]); continue; }
    options[key] = ["attempts", "delayMs", "timeoutMs"].includes(key) ? Number(argv[i + 1]) : argv[i + 1];
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await verifyLive(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`verify-build-identity: ${error.message}`);
    process.exit(1);
  }
}
