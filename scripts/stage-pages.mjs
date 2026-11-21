// Stages the whole GitHub Pages tree in dist/web/, the same way locally and in .github/workflows/pages.yml.
// Usage: node scripts/stage-pages.mjs [--commit <40 hex>]
//   /            the graybox game (Play opens Showdown's Camp), from scripts/build-graybox.mjs --hosted
//   /graybox/    the same index.html bytes, for existing links (the graybox build is one file, no chunks)
//   /showdown/   the full Showdown reference page, from prototypes/showdown/build.mjs
//   /3d/         a static redirect to the game at ../ for old links: no script, no assets. The earlier
//                illustrated 3D lane build is retired and nothing from it is staged.
//   /build.json  with --commit: the release identity of /index.html (scripts/write-build-identity.mjs)
// dist/web/ is deleted first, so nothing from an earlier layout survives.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {cp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
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
// Old /3d/ links (including ?mode=demo) land on the game one level up. Relative, so it works under any base path.
const REDIRECT_3D = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=../">
<link rel="canonical" href="../">
<title>Cowboys vs. Wizards | Moved</title>
</head>
<body>
<p>The earlier illustrated 3D build has been retired. <a href="../">Play Cowboys vs. Wizards: Showdown</a>.</p>
</body>
</html>
`;

await rm(web, {recursive: true, force: true});
run("scripts/build-graybox.mjs", "--hosted");
run("prototypes/showdown/build.mjs");
await mkdir(new URL("showdown/", web), {recursive: true});
await cp(new URL("../dist/showdown.html", import.meta.url), new URL("showdown/index.html", web));
await mkdir(new URL("graybox/", web), {recursive: true});
await cp(new URL("index.html", web), new URL("graybox/index.html", web));
await mkdir(new URL("3d/", web), {recursive: true});
await writeFile(new URL("3d/index.html", web), REDIRECT_3D);
if (commit !== undefined) run("scripts/write-build-identity.mjs", "--commit", commit, "--dir", "dist/web");
const digest = createHash("sha256").update(await readFile(new URL("index.html", web))).digest("hex");
console.log(`Staged dist/web/ (/, /graybox/, /showdown/, /3d/ redirect); index.html sha256 ${digest}`);
