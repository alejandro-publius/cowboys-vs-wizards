// One local release cycle for the illustrated Showdown build.
import {execFile} from "node:child_process";
import {createHash, randomUUID} from "node:crypto";
import {copyFile, mkdir, readFile, readlink, rename, rm, symlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const preview = path.join(root, ".artifacts/showdown-preview");
const current = path.join(preview, "current");
const lock = path.join(preview, "lock");
const id = randomUUID();
const run = path.join(preview, "runs", id);
const checkout = path.join(root, ".worktrees", "showdown-preview-" + id);
const html = "dist/cowboys-vs-wizards-showdown-3d.html";
const spec = ".kiro/specs/showdown-preview-maintenance";
const worktrees = [];
const node = process.execPath;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = async (args, cwd = root) => (await exec("git", args, {cwd, timeout: 30000})).stdout.trim();

async function command(executable, args, label, timeout = 120000, cwd = checkout) {
  let output, status = 0;
  try {
    output = await exec(executable, args, {cwd, timeout, maxBuffer: 4 * 1024 * 1024});
  } catch (error) {
    output = error;
    status = typeof error.code === "number" ? error.code : -1;
  }
  await writeFile(path.join(run, label + ".log"), (output.stdout ?? "") + (output.stderr ?? ""));
  return status;
}

async function readCurrent() {
  try {
    await readlink(current);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const record = JSON.parse(await readFile(path.join(current, "build.json"), "utf8"));
  if (!/^[a-f0-9]{40}$/.test(record.revision) ||
    hash(await readFile(path.join(current, "index.html"))) !== record.sha256) {
    throw new Error("The current preview digest or revision is invalid.");
  }
  return record;
}

async function ancestor(a, b) {
  try {
    await git(["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch (error) {
    if (error.code === 1) return false;
    throw error;
  }
}

async function sourceFor(head, published) {
  if (!published || await ancestor(published.revision, head)) return head;
  if (await ancestor(head, published.revision)) return published.revision;
  throw new Error("The preview and the checkout have diverged. Integrate the accepted preview before updating.");
}

export const REPAIR_AGENT_OWNERS = Object.freeze({
  "showdown-preview-maintainer": "src/ui/showdown-3d/gallery.js",
  "showdown-camp-maintainer": "src/app.js",
});

export async function verifyRepairAgentFence(candidate, task) {
  const expectedFile = REPAIR_AGENT_OWNERS[task.agent];
  if (!expectedFile || expectedFile !== task.file) {
    throw new Error(`Repair agent ${task.agent} is not pinned to ${task.file}.`);
  }
  const profilePath = path.join(candidate, ".kiro", "agents", `${task.agent}.json`);
  let profile;
  try {
    profile = JSON.parse(await readFile(profilePath, "utf8"));
  } catch {
    throw new Error(`Missing or invalid Kiro agent profile for ${task.agent}.`);
  }
  const tools = Array.isArray(profile?.tools) ? profile.tools : [];
  if (!tools.some((t) => t === "write" || t === "fs_write") ||
      tools.some((t) => t === "shell" || t === "execute_bash" || t === "*" || t === "@builtin")) {
    throw new Error(`Repair agent ${task.agent} must allow writes without shell tools.`);
  }
  const rules = Array.isArray(profile?.permissions?.rules) ? profile.permissions.rules : [];
  const allowedWrites = rules
    .filter((r) => r?.capability === "fs_write" && r?.effect === "allow")
    .flatMap((r) => Array.isArray(r.match) ? r.match : []);
  if (allowedWrites.length !== 1 || allowedWrites[0] !== task.file) {
    throw new Error(`Repair agent ${task.agent} fs_write allowlist must be [${task.file}].`);
  }
}

export async function repairsFrom(candidate) {
  const tasks = JSON.parse(await readFile(path.join(candidate, spec, "repairs.json"), "utf8"));
  const wording = await readFile(path.join(candidate, spec, "requirements.md"), "utf8");
  const requirements = new Map([...wording.matchAll(/^- \*\*(PM\d+)\.\*\* (.+)$/gm)]
    .map(([, id, statement]) => [id, statement]));
  for (const field of ["id", "requirement", "check", "file", "agent"]) {
    if (new Set(tasks.map((task) => task[field])).size !== tasks.length) {
      throw new Error("Repair cases must use distinct " + field + " values.");
    }
  }
  const out = [];
  for (const task of tasks) {
    const statement = requirements.get(task.requirement);
    if (!statement || !/^[a-z0-9-]+$/.test(task.id) || !/^[a-z0-9-]+$/.test(task.agent) ||
      !/^src(?:\/[a-z0-9-]+)+\.js$/.test(task.file) || !task.check || !task.commit) {
      throw new Error("Invalid preview repair case: " + task.id);
    }
    await verifyRepairAgentFence(candidate, task);
    out.push([task.check, {...task, statement}]);
  }
  return new Map(out);
}

async function addCheckout(directory, revision, dependencies = false) {
  await git(["worktree", "add", "--detach", directory, revision]);
  worktrees.push(directory);
  if (!dependencies) return;
  await mkdir(path.join(directory, "node_modules"));
  for (const dependency of ["esbuild", "three"]) {
    await symlink(path.join(root, "node_modules", dependency), path.join(directory, "node_modules", dependency), "dir");
  }
}

async function verify(revision, label, tasks) {
  const nodeStatus = await command(node, ["--test", "tests/match/showdown-3d-presentation.test.js"], label + "-node");
  if (nodeStatus) throw new Error(label + ": Showdown presentation tests failed.");
  const buildStatus = await command(node, ["scripts/build-graybox.mjs", "--diorama"], label + "-build");
  if (buildStatus) throw new Error(label + ": the illustrated build failed.");
  const folder = path.join(run, label);
  const browserStatus = await command(node, ["scripts/browser-showdown-singularity.mjs", html, folder,
    "--check-maintenance"], label + "-chrome");
  const receipt = JSON.parse(await readFile(path.join(folder, "singularity.json"), "utf8"));
  const sha256 = hash(await readFile(path.join(checkout, html)));
  if (receipt.schema !== "showdown-singularity-receipt/1" || receipt.revision !== revision ||
    receipt.page.sha256 !== sha256 || !receipt.page.buildLabelInHtml) {
    throw new Error(label + ": the browser check examined a different build.");
  }
  for (const name of tasks.keys()) {
    if (receipt.checks.filter((check) => check.name === name).length !== 1) {
      throw new Error(label + ": exactly one browser check must run for " + name);
    }
  }
  const failures = receipt.checks.filter((check) => !check.pass);
  if (receipt.pass && browserStatus === 0 && !failures.length) {
    return {pass: true, sha256, count: receipt.checks.length};
  }
  if (browserStatus !== 1 || !failures.length || failures.some((check) => !tasks.has(check.name))) {
    throw new Error(label + ": Chrome reported an issue outside the declared repair cases.");
  }
  return {pass: false, failures};
}

async function repair(base, task, failure) {
  const directory = checkout + "-" + task.id;
  await addCheckout(directory, base);
  const prompt = [
    "Repair " + task.requirement + " in the current Showdown build.",
    task.statement,
    "You may edit only " + task.file + ". Do not change the spec, tests, game rules or art. Do not commit.",
    "Browser check: " + failure.name,
    "Observed: " + JSON.stringify(failure.detail),
  ].join("\n");
  const status = await command(process.env.KIRO_PREVIEW_CLI ?? "kiro-cli", ["chat", "--v3",
    "--no-interactive", "--trust-workspace", "--agent", task.agent,
    "--model", "claude-sonnet-5.5", "--trust-tools", "fs_read,grep,glob,list_directory", prompt],
    "kiro-" + task.id, 180000, directory);
  if (status) throw new Error(task.requirement + ": Kiro stopped before proposing a repair.");
  const touched = await git(["status", "--porcelain", "--untracked-files=all"], directory);
  if (await git(["rev-parse", "HEAD"], directory) !== base || touched !== "M " + task.file) {
    throw new Error(task.requirement + ": Kiro did not produce exactly one edit to " + task.file);
  }
  await git(["diff", "--check"], directory);
  await git(["add", "--", task.file], directory);
  await git(["-c", "commit.gpgsign=false", "commit", "-m", task.commit], directory);
  return git(["rev-parse", "HEAD"], directory);
}

async function promote(revision, verified, repairedCases) {
  // Copy into a new directory first. The symlink swap is the only operation a player sees.
  const directory = path.join(preview, "builds", revision + "-" + verified.sha256.slice(0, 12));
  await mkdir(directory, {recursive: true});
  const manifest = {revision, sha256: verified.sha256, browserChecks: verified.count,
    repaired: repairedCases.length > 0, repairedCases};
  await copyFile(path.join(checkout, html), path.join(directory, "index.html"));
  if (hash(await readFile(path.join(directory, "index.html"))) !== manifest.sha256) {
    throw new Error("The preview copy did not match the verified build.");
  }
  await writeFile(path.join(directory, "build.json"), JSON.stringify(manifest, null, 2) + "\n");
  await git(["update-ref", "refs/kiro/showdown-preview/" + revision, revision]);
  const next = path.join(run, "current");
  // The link's target is relative to where it will live after the rename.
  await symlink(path.relative(preview, directory), next, "dir");
  await rename(next, current);
  return manifest;
}

async function runPreviewCycle() {
  await mkdir(preview, {recursive: true});
  await mkdir(lock);
  try {
    await mkdir(run, {recursive: true});
    const published = await readCurrent();
    const head = await git(["rev-parse", "HEAD"]);
    const base = await sourceFor(head, published);
    await mkdir(path.dirname(checkout), {recursive: true});
    await addCheckout(checkout, base, true);
    const tasks = await repairsFrom(checkout);
    let revision = base;
    let outcome = await verify(base, "baseline", tasks);
    const repairedCases = [];
    if (!outcome.pass) {
      const failing = outcome.failures.map((failure) => ({failure, task: tasks.get(failure.name)}));
      console.log("Routing " + failing.map(({task}) => task.requirement).join(", ") + " to Kiro.");
      const repairs = await Promise.allSettled(failing.map(({task, failure}) => repair(base, task, failure)));
      const errors = repairs.filter((result) => result.status === "rejected");
      if (errors.length) throw new Error(errors.map(({reason}) => reason.message).join("\n"));
      for (const [index, result] of repairs.entries()) {
        await git(["-c", "commit.gpgsign=false", "cherry-pick", result.value], checkout);
        repairedCases.push(failing[index].task.requirement);
      }
      revision = await git(["rev-parse", "HEAD"], checkout);
      outcome = await verify(revision, "candidate", tasks);
      if (!outcome.pass) throw new Error("The combined candidate still fails a declared check.");
    }
    if (published?.revision === revision && published.sha256 === outcome.sha256) {
      console.log(JSON.stringify({status: "current", ...published}));
    } else {
      console.log(JSON.stringify({status: "updated", ...await promote(revision, outcome, repairedCases)}));
    }
    const cleanup = await Promise.allSettled(worktrees.map((directory) => git(["worktree", "remove", directory])));
    for (const [index, result] of cleanup.entries()) {
      if (result.status === "rejected") console.error("Checkout retained at " + path.relative(root, worktrees[index]));
    }
  } catch (error) {
    console.error(error.message);
    for (const directory of worktrees) console.error("Candidate retained at " + path.relative(root, directory));
    console.error("Run output: " + path.relative(root, run));
    process.exitCode = 1;
  } finally {
    await rm(lock, {recursive: true});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runPreviewCycle();
}
