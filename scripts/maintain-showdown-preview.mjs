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
const repairFile = "src/ui/showdown-3d/gallery.js";
const repairCheck = "stopping the troop reel clears the active replay";
const node = process.execPath;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = async (args, cwd = root) => (await exec("git", args, {cwd, timeout: 30000})).stdout.trim();

async function command(executable, args, label, timeout = 120000) {
  let output, status = 0;
  try {
    output = await exec(executable, args, {cwd: checkout, timeout, maxBuffer: 4 * 1024 * 1024});
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

async function verify(revision, label) {
  const nodeStatus = await command(node, ["--test", "tests/match/showdown-3d-presentation.test.js"], label + "-node");
  if (nodeStatus) throw new Error(label + ": Showdown presentation tests failed.");
  const buildStatus = await command(node, ["scripts/build-graybox.mjs", "--diorama"], label + "-build");
  if (buildStatus) throw new Error(label + ": the illustrated build failed.");
  const folder = path.join(run, label);
  const browserStatus = await command(node, ["scripts/browser-showdown-singularity.mjs", html, folder,
    "--check-reel-stop"], label + "-chrome");
  const receipt = JSON.parse(await readFile(path.join(folder, "singularity.json"), "utf8"));
  const sha256 = hash(await readFile(path.join(checkout, html)));
  if (receipt.schema !== "showdown-singularity-receipt/1" || receipt.revision !== revision ||
    receipt.page.sha256 !== sha256 || !receipt.page.buildLabelInHtml) {
    throw new Error(label + ": the browser check examined a different build.");
  }
  if (receipt.pass && browserStatus === 0) return {pass: true, sha256, count: receipt.checks.length};
  const failure = receipt.checks.filter((check) => !check.pass);
  if (browserStatus === 1 && failure.length === 1 && failure[0].name === repairCheck) {
    return {pass: false, check: failure[0].name, observed: failure[0].detail};
  }
  throw new Error(label + ": Chrome reported an issue outside this repair scope.");
}

async function repair(base, failure) {
  const prompt = [
    "Fix this reproduced issue in the current Showdown gallery.",
    "While Watch all troops is playing a troop attack, clicking Stop reel must clear the active board replay immediately and restore the selected card model.",
    "The gallery must still open both Singularity preview buttons afterward.",
    "Use the existing helpers in src/ui/showdown-3d/gallery.js, the only file this task may write.",
    "Do not change the artwork, combat or test files. Do not commit.",
    "Observed by the browser: " + JSON.stringify(failure.observed),
  ].join("\n");
  const status = await command(process.env.KIRO_PREVIEW_CLI ?? "kiro-cli", ["chat", "--v3",
    "--no-interactive", "--trust-workspace", "--agent", "showdown-preview-maintainer",
    "--model", "claude-sonnet-5.5", "--trust-tools", "fs_read,grep,glob,list_directory", prompt], "kiro", 180000);
  if (status) throw new Error("Kiro stopped before proposing a repair.");
  const touched = await git(["status", "--porcelain", "--untracked-files=all"], checkout);
  if (await git(["rev-parse", "HEAD"], checkout) !== base || touched !== "M " + repairFile) {
    throw new Error("Kiro did not produce exactly one working-tree edit to the gallery.");
  }
  await git(["diff", "--check"], checkout);
  await git(["add", "--", repairFile], checkout);
  await git(["-c", "commit.gpgsign=false", "commit", "-m", "Stop the active Showdown gallery reel"], checkout);
  return git(["rev-parse", "HEAD"], checkout);
}

async function promote(revision, verified, repaired) {
  // Copy into a new directory first. The symlink swap is the only operation a player sees.
  const directory = path.join(preview, "builds", revision + "-" + verified.sha256.slice(0, 12));
  await mkdir(directory, {recursive: true});
  const manifest = {revision, sha256: verified.sha256, browserChecks: verified.count, repaired};
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

await mkdir(preview, {recursive: true});
await mkdir(lock);
let added = false;
try {
  await mkdir(run, {recursive: true});
  const published = await readCurrent();
  const head = await git(["rev-parse", "HEAD"]);
  const base = await sourceFor(head, published);
  await mkdir(path.dirname(checkout), {recursive: true});
  await git(["worktree", "add", "--detach", checkout, base]);
  added = true;
  await mkdir(path.join(checkout, "node_modules"));
  for (const dependency of ["esbuild", "three"]) {
    await symlink(path.join(root, "node_modules", dependency), path.join(checkout, "node_modules", dependency), "dir");
  }
  let revision = base;
  let outcome = await verify(base, "baseline");
  const repaired = !outcome.pass;
  if (repaired) {
    console.log("Detected in Chrome: " + outcome.check);
    revision = await repair(base, outcome);
    outcome = await verify(revision, "candidate");
    if (!outcome.pass) throw new Error("The candidate still fails the original reproduction.");
  }
  if (published?.revision === revision && published.sha256 === outcome.sha256) {
    console.log(JSON.stringify({status: "current", ...published}));
  } else {
    console.log(JSON.stringify({status: "updated", ...await promote(revision, outcome, repaired)}));
  }
  try {
    await git(["worktree", "remove", checkout]);
    added = false;
  } catch {
    console.error("Preview is ready. Checkout retained at " + path.relative(root, checkout));
  }
} catch (error) {
  console.error(error.message);
  if (added) console.error("Candidate retained at " + path.relative(root, checkout));
  console.error("Run output: " + path.relative(root, run));
  process.exitCode = 1;
} finally {
  await rm(lock, {recursive: true});
}
