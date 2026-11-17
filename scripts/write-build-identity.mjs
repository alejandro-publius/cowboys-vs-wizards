// Writes dist/web/build.json: the commit, build time and index.html digest of one web build.
// Usage: node scripts/write-build-identity.mjs [--commit <40 hex>] [--dir dist/web]
// Without --commit the commit must come from GITHUB_SHA. Nothing else is read from the environment.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
export const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function validateManifest(manifest) {
  const keys = ["version", "commit", "builtAt", "indexHtmlSha256"];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("build identity must be a JSON object");
  if (Object.keys(manifest).sort().join() !== [...keys].sort().join()) throw new Error(`build identity keys must be exactly ${keys.join(", ")}`);
  if (manifest.version !== 1) throw new Error("build identity version must be 1");
  if (typeof manifest.commit !== "string" || !COMMIT_PATTERN.test(manifest.commit)) throw new Error("commit must be 40 lowercase hex characters");
  if (typeof manifest.indexHtmlSha256 !== "string" || !DIGEST_PATTERN.test(manifest.indexHtmlSha256)) throw new Error("indexHtmlSha256 must be 64 lowercase hex characters");
  if (typeof manifest.builtAt !== "string" || !TIME_PATTERN.test(manifest.builtAt) || Number.isNaN(Date.parse(manifest.builtAt))) throw new Error("builtAt must be an ISO 8601 UTC timestamp");
  return manifest;
}

export async function writeBuildIdentity({ dir, commit, now = new Date() }) {
  if (typeof commit !== "string" || !COMMIT_PATTERN.test(commit)) throw new Error("commit must be 40 lowercase hex characters");
  const html = await readFile(join(dir, "index.html"));
  const manifest = validateManifest({
    version: 1,
    commit,
    builtAt: now.toISOString(),
    indexHtmlSha256: createHash("sha256").update(html).digest("hex"),
  });
  await writeFile(join(dir, "build.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    if (name !== "--commit" && name !== "--dir") throw new Error(`unknown argument: ${name}`);
    if (argv[i + 1] === undefined) throw new Error(`${name} needs a value`);
    options[name.slice(2)] = argv[i + 1];
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const commit = options.commit ?? process.env.GITHUB_SHA;
    if (!commit) throw new Error("pass --commit or set GITHUB_SHA");
    const dir = resolve(options.dir ?? "dist/web");
    const manifest = await writeBuildIdentity({ dir, commit });
    console.log(`Wrote ${join(options.dir ?? "dist/web", "build.json")}: commit ${manifest.commit}, index.html sha256 ${manifest.indexHtmlSha256}`);
  } catch (error) {
    console.error(`write-build-identity: ${error.message}`);
    process.exit(1);
  }
}
