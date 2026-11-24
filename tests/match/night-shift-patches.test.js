// Morning patch notes from real temporary Git repositories.
// Run: node --test tests/match/night-shift-patches.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PATCH_LIMITS, readMainPatches } from "../../scripts/saloon-patches.mjs";

const CARDS = ".kiro/specs/duel-card-pipeline/cards";
const BASE = Date.UTC(2026, 10, 1, 12) / 1000;
const FIELDS = ["after", "at", "before", "card", "commit", "field", "id", "kind"];

const at = (hour) => new Date((BASE + hour * 3600) * 1000).toISOString();
const view = (patches) => patches.map(({ id, ...rest }) => rest);
const note = (hour, card, field, before, after, commit) => ({ at: at(hour), kind: "patch", card, field, before, after, commit });

function setupEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!key.startsWith("GIT_")) env[key] = value;
  return {
    ...env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Saloon Test",
    GIT_AUTHOR_EMAIL: "saloon@example.invalid",
    GIT_COMMITTER_NAME: "Saloon Test",
    GIT_COMMITTER_EMAIL: "saloon@example.invalid",
    LC_ALL: "C",
    ...extra,
  };
}

function git(cwd, args, hour) {
  const date = hour === undefined ? {} : { GIT_AUTHOR_DATE: `@${BASE + hour * 3600} +0000`, GIT_COMMITTER_DATE: `@${BASE + hour * 3600} +0000` };
  const result = spawnSync("git", args, { cwd, env: setupEnv(date), encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.error ?? result.stderr}`);
  return result.stdout.trim();
}

function tempDir(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "saloon-patches-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function newRepo(t) {
  const dir = join(tempDir(t), "repo");
  mkdirSync(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  return dir;
}

function put(repo, path, value) {
  const file = join(repo, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value)}\n`);
}

const putCard = (repo, slug, stats) => put(repo, `${CARDS}/${slug}.json`, { type: slug, ...stats });

function commit(repo, hour, message = `hour ${hour}`) {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "--allow-empty", "-m", message], hour);
  return git(repo, ["rev-parse", "HEAD"]);
}

function merge(repo, branch, hour) {
  git(repo, ["merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch], hour);
  return git(repo, ["rev-parse", "HEAD"]);
}

// c0 adds two cards, c1 changes Billy's attack, c2 changes the Skeleton's stars.
function threeCommitRepo(t) {
  const repo = newRepo(t);
  putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: 2 });
  putCard(repo, "wizard-skeleton", { stars: 1, health: 3, attack: 2 });
  const c0 = commit(repo, 0);
  putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: 1 });
  const c1 = commit(repo, 6);
  putCard(repo, "wizard-skeleton", { stars: 2, health: 3, attack: 2 });
  const c2 = commit(repo, 13);
  return { repo, c0, c1, c2 };
}

function objectFiles(repo) {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
  return walk(join(repo, ".git", "objects")).sort();
}

test("a true merge appears with its merge hash and an unmerged candidate stays off main", (t) => {
  const repo = newRepo(t);
  putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: 2 });
  putCard(repo, "wizard-skeleton", { stars: 1, health: 3, attack: 2 });
  commit(repo, 0);
  putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: 1 });
  const direct = commit(repo, 6);

  git(repo, ["checkout", "-q", "-b", "feature"]);
  putCard(repo, "wizard-skeleton", { stars: 2, health: 3, attack: 2 });
  const sideCommit = commit(repo, 8);

  git(repo, ["checkout", "-q", "-b", "candidate", "main"]);
  putCard(repo, "cowboy-billy", { stars: 5, health: 5, attack: 1 });
  const candidate = commit(repo, 9);

  git(repo, ["checkout", "-q", "main"]);
  const merged = merge(repo, "feature", 13);

  // Leave the unmerged candidate checked out with a dirty stat edit, and point
  // look-alike refs at it. None of them is main.
  git(repo, ["checkout", "-q", "candidate"]);
  putCard(repo, "cowboy-billy", { stars: 5, health: 5, attack: 9 });
  git(repo, ["branch", "origin/main", candidate]);
  git(repo, ["tag", "main", candidate]);

  const patches = readMainPatches(repo);
  assert.deepEqual(view(patches), [
    note(6, "cowboy-billy", "attack", 2, 1, direct),
    note(13, "wizard-skeleton", "stars", 1, 2, merged),
  ]);
  const commits = patches.map((patch) => patch.commit);
  assert.ok(!commits.includes(sideCommit), "the side-branch commit is reported through its merge only");
  assert.ok(!commits.includes(candidate), "the unmerged candidate gives no note");

  for (const patch of patches) {
    assert.deepEqual(Object.keys(patch).sort(), FIELDS);
    assert.match(patch.id, /^patch-[0-9a-f]{12}-(attack|health|stars)-[0-9a-f]{10}$/);
    assert.match(patch.commit, /^[0-9a-f]{40}$/);
  }
  assert.equal(new Set(patches.map((patch) => patch.id)).size, patches.length);
  assert.deepEqual(readMainPatches(repo), patches, "ids and records are stable across reads");
});

test("a side-branch tweak to a card that is new to main is not a patch", (t) => {
  const repo = newRepo(t);
  putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: 2 });
  commit(repo, 0);
  git(repo, ["checkout", "-q", "-b", "imp"]);
  putCard(repo, "wizard-imp", { stars: 1, health: 1, attack: 2 });
  commit(repo, 1);
  putCard(repo, "wizard-imp", { stars: 1, health: 1, attack: 3 });
  commit(repo, 2);
  git(repo, ["checkout", "-q", "main"]);
  merge(repo, "imp", 3);
  assert.deepEqual(readMainPatches(repo), []);
});

test("refs/remotes/origin/main is preferred over a local main that is ahead", (t) => {
  const { repo, c1 } = threeCommitRepo(t);
  git(repo, ["update-ref", "refs/remotes/origin/main", c1]);
  assert.deepEqual(view(readMainPatches(repo)), [note(6, "cowboy-billy", "attack", 2, 1, c1)]);
});

test("introductions, renames, deletions, drafts, other paths, bad slugs and non-stat edits are ignored", (t) => {
  const repo = newRepo(t);
  const longSlug = `wizard-${"a".repeat(42)}`; // 49 characters
  putCard(repo, "cowboy-billy", { name: "Billy", stars: 5, health: 4, attack: 3, showdown: { attack: 1 } });
  putCard(repo, "wizard-skeleton", { stars: 1, health: 3, attack: 2 });
  putCard(repo, "wizard-old", { stars: 2, health: 2, attack: 2 });
  putCard(repo, "wizard-moved", { stars: 2, health: 2, attack: 2 });
  putCard(repo, "wizard-half", { stars: 2, health: 2, attack: 2 });
  putCard(repo, "wizard-imp2", { stars: 1, health: 1, attack: 0 });
  putCard(repo, longSlug, { stars: 1, health: 1, attack: 1 });
  put(repo, `${CARDS}/drafts/cowboy-billy.json`, { stars: 5, health: 4, attack: 3 });
  put(repo, `${CARDS}/cowboy-billy.draft.json`, { stars: 5, health: 4, attack: 3 });
  put(repo, "src/game/cowboy-billy.json", { stars: 5, health: 4, attack: 3 });
  commit(repo, 0);

  putCard(repo, "wizard-new", { stars: 1, health: 1, attack: 1 });
  commit(repo, 1, "introduction");

  rmSync(join(repo, `${CARDS}/wizard-old.json`));
  rmSync(join(repo, `${CARDS}/wizard-moved.json`));
  putCard(repo, "wizard-renamed", { stars: 2, health: 2, attack: 3 });
  commit(repo, 2, "deletion and rename with a stat change");

  put(repo, `${CARDS}/drafts/cowboy-billy.json`, { stars: 5, health: 4, attack: 1 });
  put(repo, `${CARDS}/cowboy-billy.draft.json`, { stars: 5, health: 4, attack: 1 });
  put(repo, "src/game/cowboy-billy.json", { stars: 5, health: 4, attack: 1 });
  putCard(repo, longSlug, { stars: 1, health: 1, attack: 2 });
  commit(repo, 3, "drafts, other paths and an over-long slug");

  putCard(repo, "cowboy-billy", { name: "William", stars: 5, health: 4, attack: 3, showdown: { attack: 2 } });
  putCard(repo, "wizard-skeleton", { stars: 1, health: 9, attack: "3" });
  putCard(repo, "wizard-half", { stars: 2, health: 2, attack: 2.5 });
  commit(repo, 4, "non-stat, nested, out-of-range and non-integer edits");

  putCard(repo, "cowboy-billy", { name: "William", stars: 5, health: 3, attack: 4, showdown: { attack: 2 } });
  putCard(repo, "wizard-imp2", { stars: 1, health: 1, attack: 1 });
  const real = commit(repo, 8, "two Billy stats and a digit slug");

  assert.deepEqual(view(readMainPatches(repo)), [
    note(8, "cowboy-billy", "attack", 3, 4, real),
    note(8, "cowboy-billy", "health", 4, 3, real),
    note(8, "wizard-imp2", "attack", 0, 1, real),
  ]);
});

test("only the most recent card-modifying commits are read", (t) => {
  const repo = newRepo(t);
  putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: 2 });
  commit(repo, 0);
  const changes = [];
  for (let index = 1; index <= PATCH_LIMITS.patchCommits + 3; index += 1) {
    putCard(repo, "cowboy-billy", { stars: 5, health: 4, attack: index % 2 === 1 ? 1 : 2 });
    changes.push(commit(repo, index));
  }
  const patches = readMainPatches(repo);
  assert.deepEqual(patches.map((patch) => patch.commit), changes.slice(-PATCH_LIMITS.patchCommits));
});

test("no main branch, no repository or a bad root gives no notes", (t) => {
  const dir = tempDir(t);
  assert.deepEqual(readMainPatches(dir), [], "not a repository");
  assert.deepEqual(readMainPatches(join(dir, "missing")), [], "missing path");
  assert.deepEqual(readMainPatches(""), []);
  assert.deepEqual(readMainPatches(42), []);
  assert.deepEqual(readMainPatches(undefined), []);

  const { repo } = threeCommitRepo(t);
  mkdirSync(join(repo, "sub"));
  assert.deepEqual(readMainPatches(join(repo, "sub")), [], "a parent repository is not discovered");
  writeFileSync(join(repo, "file.txt"), "x");
  assert.deepEqual(readMainPatches(join(repo, "file.txt")), [], "a file is not a root");

  git(repo, ["branch", "-q", "-m", "main", "trunk"]);
  assert.deepEqual(readMainPatches(repo), [], "no main ref");
});

test("a shallow clone reports only what its local history proves", (t) => {
  const { repo, c2 } = threeCommitRepo(t);
  const parent = tempDir(t);
  const depth1 = join(parent, "depth1");
  const depth2 = join(parent, "depth2");
  git(parent, ["clone", "-q", "--depth", "1", `file://${repo}`, depth1]);
  git(parent, ["clone", "-q", "--depth", "2", `file://${repo}`, depth2]);
  assert.deepEqual(readMainPatches(depth1), []);
  assert.deepEqual(view(readMainPatches(depth2)), [note(13, "wizard-skeleton", "stars", 1, 2, c2)]);
});

// Missing objects reachable from `rev`, listed without lazy fetching.
function missingObjects(repo, rev) {
  const out = git(repo, ["-c", "protocol.allow=never", "rev-list", "--objects", "--no-object-names", "--missing=print", rev]);
  return new Set(out.split("\n").filter((line) => line.startsWith("?")).map((line) => line.slice(1)));
}

test("a partial clone reads present blobs only and fetches nothing", (t) => {
  const { repo, c0, c1, c2 } = threeCommitRepo(t);
  git(repo, ["config", "uploadpack.allowFilter", "true"]);
  git(repo, ["config", "uploadpack.allowAnySHA1InWant", "true"]);
  // Blob ids come from the full source repository, never from the clone.
  const blob = (rev, slug) => git(repo, ["rev-parse", `${rev}:${CARDS}/${slug}.json`]);
  const billy = [blob(c0, "cowboy-billy"), blob(c1, "cowboy-billy")];
  const skeleton = [blob(c1, "wizard-skeleton"), blob(c2, "wizard-skeleton")];
  const cardBlobs = [...billy, ...skeleton];

  const clone = join(tempDir(t), "partial");
  git(dirname(clone), ["clone", "-q", "--no-checkout", "--filter=blob:none", `file://${repo}`, clone]);
  // Git records a partial clone on the promisor remote; extensions.partialClone
  // is not written by every version (absent on Apple Git 2.39.5).
  assert.equal(git(clone, ["config", "remote.origin.promisor"]), "true", "origin is a promisor remote");
  assert.equal(git(clone, ["config", "remote.origin.partialclonefilter"]), "blob:none", "the clone filters blobs");
  assert.deepEqual(cardBlobs.filter((oid) => !missingObjects(clone, c2).has(oid)), [], "no card blob is present yet");

  const untouched = objectFiles(clone);
  assert.deepEqual(readMainPatches(clone), [], "absent blobs give no notes");
  assert.deepEqual(objectFiles(clone), untouched, "the reader fetched nothing");
  assert.deepEqual(cardBlobs.filter((oid) => !missingObjects(clone, c2).has(oid)), [], "every card blob is still absent");

  // Test setup only: fetch exactly the two Skeleton blobs. Billy's stay absent.
  git(clone, ["fetch", "-q", "--no-tags", "--no-write-fetch-head", "origin", ...skeleton]);
  const afterSetup = missingObjects(clone, c2);
  assert.deepEqual(skeleton.filter((oid) => afterSetup.has(oid)), [], "setup made the Skeleton blobs local");
  assert.deepEqual(billy.filter((oid) => !afterSetup.has(oid)), [], "setup left Billy's blobs absent");

  const fetched = objectFiles(clone);
  assert.deepEqual(view(readMainPatches(clone)), [note(13, "wizard-skeleton", "stars", 1, 2, c2)], "only the local Skeleton change qualifies");
  assert.deepEqual(objectFiles(clone), fetched, "the reader fetched nothing");
  assert.deepEqual([...missingObjects(clone, c2)].sort(), [...afterSetup].sort(), "the same objects are still absent");
});

test("a complete result is cached by main tip and rescanned when main moves", (t) => {
  const { repo, c1, c2 } = threeCommitRepo(t);
  const first = readMainPatches(repo);
  assert.deepEqual(view(first), [
    note(6, "cowboy-billy", "attack", 2, 1, c1),
    note(13, "wizard-skeleton", "stars", 1, 2, c2),
  ]);

  // Remove the loose blob behind c1's note. A rescan could no longer prove it.
  const blob = git(repo, ["rev-parse", `${c1}:${CARDS}/cowboy-billy.json`]);
  const loose = join(repo, ".git", "objects", blob.slice(0, 2), blob.slice(2));
  assert.ok(existsSync(loose));
  rmSync(loose);
  first[0].after = 99; // callers cannot change the cached copy
  assert.deepEqual(view(readMainPatches(repo)), [
    note(6, "cowboy-billy", "attack", 2, 1, c1),
    note(13, "wizard-skeleton", "stars", 1, 2, c2),
  ], "same tip: served from the cache, not rescanned");

  const tip = git(repo, ["commit-tree", `${c2}^{tree}`, "-p", c2, "-m", "empty"], 20);
  git(repo, ["update-ref", "refs/heads/main", tip]);
  assert.deepEqual(view(readMainPatches(repo)), [note(13, "wizard-skeleton", "stars", 1, 2, c2)], "new tip: rescanned");
});
