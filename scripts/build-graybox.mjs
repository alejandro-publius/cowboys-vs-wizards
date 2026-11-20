import {build} from "esbuild";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {grayboxBuildLabel} from "./graybox-build-label.mjs";

const root = new URL("../", import.meta.url);
const file = (name) => new URL(name, root);
const read = (name) => readFile(file(name), "utf8");
// --hosted: the Pages copy at the site root (dist/web/index.html; scripts/stage-pages.mjs adds the
// /graybox/ alias). It is the same single offline file as the other builds: the graybox game is
// Showdown only (issue 143 slice 3), so no lane chunk exists and none is fetched.
const hosted = process.argv.includes("--hosted");
const output = hosted || process.argv.includes("--web") ? "dist/web/index.html" : "dist/cowboys-vs-wizards-board-duel.html";
// K-087: the page's public build label (commit, "+local" if uncommitted), so the Camp's playtest report can say
// which build each duel was finished under. Null without git: the report then says the build is not identified.
const label = grayboxBuildLabel(fileURLToPath(root));
const options = {absWorkingDir: fileURLToPath(root), bundle: true, write: false, platform: "browser", target: "es2022", minify: true,
  define: {__CVW_GRAYBOX_BUILD__: JSON.stringify(label)}};
const [template, style, showdownStyle, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  read("src/ui/showdown.css"),
  build({...options, entryPoints: ["src/app.js"]}),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
// A Pages tree built before slice 3 may still hold the old lane chunk; drop it so it is never staged.
if (hosted) await rm(file("dist/web/chunks/"), {recursive: true, force: true});
await mkdir(new URL("./", file(output)), {recursive: true});
await writeFile(file(output), template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}`).replace("@@SCRIPT@@", () => script));
console.log(`Built ${output} (graybox, build ${label ?? "not identified"})`);
