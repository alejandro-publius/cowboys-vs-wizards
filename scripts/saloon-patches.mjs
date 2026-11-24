// Morning patch notes for the Night Shift saloon.
//
// readMainPatches(root) reads local Git history only and returns the card stat
// changes that landed on main, oldest first:
//   {id, at, kind: "patch", card, field, before, after, commit}
//
// Rules:
// - The tip is refs/remotes/origin/main, else refs/heads/main. HEAD, the working
//   tree, tags and every other branch are never read, so an unmerged feature or a
//   scratch balance proposal cannot produce a note.
// - Only main's first-parent chain is walked. Each commit, merges included, is
//   compared with its own first parent. A commit made on a side branch shows up
//   only through the merge that brought it into main, with the merge's hash.
// - Only an in-place modification of .kiro/specs/duel-card-pipeline/cards/<slug>.json
//   counts, and only for a top-level attack, health or stars value that is an
//   integer in the card validator's range on both sides and differs. <slug> is
//   lowercase ASCII letters and digits in hyphen-separated words, at most 48
//   characters. Additions, deletions, renames, other paths and unchanged values
//   are ignored. One record per changed stat.
// - `at` is the main commit's committer time. It says when the commit was made,
//   not when or whether it was deployed.
// - Missing Git, missing main or a failed or timed-out Git call give []. A
//   shallow boundary commit has no local parent and gives nothing. In a partial
//   clone, only card blobs already present locally are read: lazy fetching is
//   disabled (GIT_NO_LAZY_FETCH, protocol.allow=never) and absent blobs are
//   skipped, never fetched. Nothing here throws or writes.
// - A complete result is cached per repository and main tip, so repeated live
//   polls cost one rev-parse until main moves. Shallow or partial results are
//   not cached.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { dirname } from "node:path";

export const PATCH_LIMITS = Object.freeze({
  scanCommits: 400, // first-parent main commits walked
  patchCommits: 24, // most recent card-modifying commits kept
  filesPerCommit: 32,
  patches: 64, // records returned (most recent kept)
  blobBytes: 64 * 1024,
  logBytes: 2 * 1024 * 1024,
  callMs: 3000,
  totalMs: 6000,
  cacheEntries: 8, // repository and tip pairs kept in memory
});

export const PATCH_FIELDS = Object.freeze(["attack", "health", "stars"]);

// The ranges scripts/sync-card-specs.mjs accepts for a troop today: attack 0 or
// more (0 only for Showdown-only troops), health 1 to 5, stars 1 or more.
export const PATCH_RANGES = Object.freeze({
  attack: Object.freeze([0, Number.MAX_SAFE_INTEGER]),
  health: Object.freeze([1, 5]),
  stars: Object.freeze([1, Number.MAX_SAFE_INTEGER]),
});

export const CARD_SLUG = /^(?=.{1,48}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
const CARD_PATH = /^\.kiro\/specs\/duel-card-pipeline\/cards\/([^/]+)\.json$/;
const MAIN_REFS = ["refs/remotes/origin/main", "refs/heads/main"];
const OID = /^[0-9a-f]{40}$/;
const REGULAR_FILE = new Set(["100644", "100755"]);
const GLOBAL_ARGS = [
  "--no-replace-objects",
  "-c", "protocol.allow=never", // no transport at all, so a lazy fetch cannot reach a remote
  "-c", "core.quotePath=true",
  "-c", "core.fsmonitor=false",
  "-c", "log.showSignature=false",
  "-c", "color.ui=never",
];

const cache = new Map();

export function readMainPatches(root) {
  try {
    return collect(root);
  } catch {
    return [];
  }
}

function collect(root) {
  if (typeof root !== "string" || root === "") return [];
  const top = realpathSync(root);
  const deadline = Date.now() + PATCH_LIMITS.totalMs;
  const env = gitEnv(top);
  const git = (args, options) => runGit(top, env, args, deadline, options);

  const tip = resolveMain(git);
  if (!tip) return [];

  const key = `${top}\0${tip}`;
  const cached = cache.get(key);
  if (cached) return copy(cached);

  const { patches, complete } = scan(git, tip);
  if (complete) {
    cache.delete(key);
    cache.set(key, copy(patches));
    while (cache.size > PATCH_LIMITS.cacheEntries) cache.delete(cache.keys().next().value);
  }
  return patches;
}

function copy(patches) {
  return patches.map((patch) => ({ ...patch }));
}

function scan(git, tip) {
  const failed = { patches: [], complete: false };
  const shallow = git(["rev-parse", "--is-shallow-repository"]);
  if (shallow === null) return failed;

  const log = git([
    "log", "--first-parent", "--full-history", "--sparse",
    `--max-count=${PATCH_LIMITS.scanCommits}`,
    "--diff-merges=first-parent", "-r", "--raw", "--no-renames", "--no-abbrev",
    "--no-ext-diff", "--no-textconv", "--no-color", "--no-notes",
    "--format=C %H %ct %P",
    tip, "--", CARD_DIR,
  ], { maxBuffer: PATCH_LIMITS.logBytes });
  if (log === null) return failed;

  const commits = selectCommits(parseLog(log));
  const read = commits.length === 0 ? { blobs: new Map(), complete: true } : readBlobs(git, commits);
  if (read === null) return failed;

  const patches = [];
  for (const commit of commits.reverse()) {
    const at = new Date(commit.time * 1000).toISOString();
    for (const change of commit.changes) {
      const before = parseCard(read.blobs.get(change.before));
      const after = parseCard(read.blobs.get(change.after));
      if (!before || !after) continue;
      for (const field of PATCH_FIELDS) {
        if (!Object.hasOwn(before, field) || !Object.hasOwn(after, field)) continue;
        const was = before[field];
        const now = after[field];
        if (!inRange(field, was) || !inRange(field, now) || was === now) continue;
        patches.push({ id: patchId(commit.oid, change.slug, field), at, kind: "patch", card: change.slug, field, before: was, after: now, commit: commit.oid });
      }
    }
  }
  return { patches: patches.slice(-PATCH_LIMITS.patches), complete: read.complete && shallow.trim() === "false" };
}

function inRange(field, value) {
  const [min, max] = PATCH_RANGES[field];
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function gitEnv(top) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("GIT_")) env[key] = value;
  }
  return {
    ...env,
    GIT_CEILING_DIRECTORIES: dirname(top),
    GIT_NO_LAZY_FETCH: "1", // Git 2.44+; older Git relies on protocol.allow=never
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PROTOCOL_FROM_USER: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
}

// Text calls return a string. Binary calls omit `encoding` and return a Buffer;
// some Node versions reject encoding: "buffer".
function runGit(cwd, env, args, deadline, { input, maxBuffer = PATCH_LIMITS.logBytes, binary = false } = {}) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const options = {
    cwd,
    env,
    maxBuffer,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
    timeout: Math.min(remaining, PATCH_LIMITS.callMs),
    killSignal: "SIGKILL",
    windowsHide: true,
  };
  if (input !== undefined) options.input = input;
  if (!binary) options.encoding = "utf8";
  const result = spawnSync("git", [...GLOBAL_ARGS, ...args], options);
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

// Falls through to the next ref when one is absent or does not name a commit.
function resolveMain(git) {
  for (const ref of MAIN_REFS) {
    const out = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    const oid = typeof out === "string" ? out.trim() : "";
    if (OID.test(oid)) return oid;
  }
  return null;
}

// Lines: "C <commit> <committer-unix> <parents...>" then raw diff lines
// ":<old-mode> <new-mode> <old-oid> <new-oid> <status>\t<path>".
function parseLog(text) {
  const commits = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("C ")) {
      const [, oid, time, ...parents] = line.split(" ");
      const parent = parents.find((value) => value !== "") ?? null;
      const valid = OID.test(oid) && /^\d{1,12}$/.test(time) && (parent === null || OID.test(parent));
      current = valid ? { oid, time: Number(time), parent, changes: [] } : null;
      if (current) commits.push(current);
      continue;
    }
    if (!current || !line.startsWith(":")) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const [oldMode, newMode, before, after, status] = line.slice(1, tab).split(" ");
    const match = CARD_PATH.exec(line.slice(tab + 1));
    if (!match || !CARD_SLUG.test(match[1]) || status !== "M") continue;
    if (!REGULAR_FILE.has(oldMode) || !REGULAR_FILE.has(newMode) || !OID.test(before) || !OID.test(after)) continue;
    current.changes.push({ slug: match[1], before, after });
  }
  return commits;
}

// Newest first: the most recent card-modifying commits that have a first parent
// in local history (a shallow boundary has none and proves nothing).
function selectCommits(commits) {
  const selected = [];
  for (const commit of commits) {
    if (!commit.parent || commit.time <= 0 || commit.changes.length === 0) continue;
    commit.changes.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    commit.changes = commit.changes.slice(0, PATCH_LIMITS.filesPerCommit);
    selected.push(commit);
    if (selected.length >= PATCH_LIMITS.patchCommits) break;
  }
  return selected;
}

// Returns {blobs, complete} or null. Presence is checked first with
// `rev-list --missing=print`, which never lazy-fetches, over the card folder of
// each selected commit and its parent. Only present blobs reach cat-file, so a
// partial clone neither fetches nor fails on an absent blob; it is skipped and
// the result is marked incomplete.
function readBlobs(git, commits) {
  const wanted = new Set(commits.flatMap((commit) => commit.changes.flatMap((change) => [change.before, change.after])));
  const folders = [...new Set(commits.flatMap((commit) => [commit.oid, commit.parent]))].map((oid) => `${oid}:${CARD_DIR}`);
  const listed = git(["rev-list", "--objects", "--no-object-names", "--missing=print", "--stdin"], {
    input: `${folders.join("\n")}\n`,
    maxBuffer: PATCH_LIMITS.logBytes,
  });
  if (listed === null) return null;
  const present = new Set(listed.split("\n").filter((line) => wanted.has(line)));
  const complete = present.size === wanted.size;

  const check = present.size === 0 ? "" : git(["cat-file", "--batch-check"], { input: `${[...present].join("\n")}\n` });
  if (check === null) return null;
  const small = [];
  for (const line of check.split("\n")) {
    const [oid, type, size] = line.split(" ");
    if (OID.test(oid) && type === "blob" && /^\d+$/.test(size) && Number(size) <= PATCH_LIMITS.blobBytes) small.push(oid);
  }
  const blobs = new Map();
  if (small.length === 0) return { blobs, complete };
  const batch = git(["cat-file", "--batch"], {
    input: `${small.join("\n")}\n`,
    binary: true,
    maxBuffer: small.length * (PATCH_LIMITS.blobBytes + 128) + 1024,
  });
  if (batch === null) return null;
  let pos = 0;
  while (pos < batch.length) {
    const newline = batch.indexOf(10, pos);
    if (newline < 0) break;
    const [oid, type, size] = batch.toString("utf8", pos, newline).split(" ");
    pos = newline + 1;
    if (type === "missing" || type === "ambiguous") continue;
    const length = Number(size);
    if (!Number.isSafeInteger(length) || length < 0 || pos + length > batch.length) break;
    if (type === "blob" && OID.test(oid)) blobs.set(oid, batch.toString("utf8", pos, pos + length));
    pos += length + 1;
  }
  return { blobs, complete };
}

function parseCard(text) {
  if (typeof text !== "string") return null;
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function patchId(commit, card, field) {
  const digest = createHash("sha256").update(`${commit}\0${card}\0${field}`).digest("hex").slice(0, 10);
  return `patch-${commit.slice(0, 12)}-${field}-${digest}`;
}
