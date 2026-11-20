// Stages the whole GitHub Pages tree in dist/web/, the same way locally and in .github/workflows/pages.yml.
// Usage: node scripts/stage-pages.mjs [--commit <40 hex>]
//   /            the graybox game (Play opens Showdown's Camp), from scripts/build-graybox.mjs --hosted
//   /graybox/    the same index.html bytes (and lane chunk, while one exists) for existing links
//   /showdown/   the full Showdown reference page, from prototypes/showdown/build.mjs
//   /3d/         the earlier illustrated 3D build with its models, from scripts/build.mjs --web
//   /build.json  with --commit: the release identity of /index.html (scripts/write-build-identity.mjs)
// dist/web/ is deleted first, so nothing from an earlier layout survives.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {cp, mkdir, readFile, rm, stat} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = new URL("../dist/web/", import.meta.url);
const args = process.argv.slice(2);
const commit = args[0] === "--commit" ? args[1] : undefined;
if (args.length && (args.length !== 2 || commit === undefined)) {
  console.error("usage: node scripts/stage-pages.mjs [--commit <40 hex>]");
  process.exit(2);
}
const run = (...cmd) => {
  console.log(`$ node ${cmd.join(" ")}`);
  const result = spawnSync(process.execPath, cmd, {cwd: root, stdio: "inherit"});
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const exists = (url) => stat(url).then(() => true, () => false);

await rm(web, {recursive: true, force: true});
run("scripts/build.mjs", "--web");
run("scripts/build-graybox.mjs", "--hosted");
run("prototypes/showdown/build.mjs");
await mkdir(new URL("showdown/", web), {recursive: true});
await cp(new URL("../dist/showdown.html", import.meta.url), new URL("showdown/index.html", web));
await mkdir(new URL("graybox/", web), {recursive: true});
await cp(new URL("index.html", web), new URL("graybox/index.html", web));
if (await exists(new URL("chunks/", web))) await cp(new URL("chunks/", web), new URL("graybox/chunks/", web), {recursive: true});
if (commit !== undefined) run("scripts/write-build-identity.mjs", "--commit", commit, "--dir", "dist/web");
const digest = createHash("sha256").update(await readFile(new URL("index.html", web))).digest("hex");
console.log(`Staged dist/web/ (/, /graybox/, /showdown/, /3d/); index.html sha256 ${digest}`);
