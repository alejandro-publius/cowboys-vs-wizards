import {build} from "esbuild";
import {createHash} from "node:crypto";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const root = new URL("../", import.meta.url);
const file = (name) => new URL(name, root);
const read = (name) => readFile(file(name), "utf8");
// --hosted: the Pages copy at the site root (dist/web/index.html; scripts/stage-pages.mjs adds the
// /graybox/ alias). It is the same single file as the offline build. While src/app.js still loads
// the lane duel with import("./graybox.js"), that module becomes a separate chunks/lanes-<hash>.js
// fetched only by the lane modes; once src/app.js no longer imports it, no lane chunk is written.
const hosted = process.argv.includes("--hosted");
const output = hosted || process.argv.includes("--web") ? "dist/web/index.html" : "dist/cowboys-vs-wizards-board-duel.html";
const options = {absWorkingDir: fileURLToPath(root), bundle: true, write: false, platform: "browser", target: "es2022", minify: true};
const splitLanes = hosted && /import\(\s*["']\.\/graybox\.js["']\s*\)/.test(await read("src/app.js"));
let lanes = null;
if (splitLanes) {
  const [code] = (await build({...options, entryPoints: ["src/graybox.js"], format: "esm"})).outputFiles;
  lanes = {name: `chunks/lanes-${createHash("sha256").update(code.contents).digest("hex").slice(0, 8)}.js`, code: code.contents};
}
// Resolved against the page URL, so the build works under any base path.
const lanesExternal = {name: "lanes-external", setup(b) {
  b.onResolve({filter: /^\.\/graybox\.js$/}, (args) => args.importer.endsWith("src/app.js") ? {path: `./${lanes.name}`, external: true} : undefined);
}};
const [template, style, showdownStyle, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  read("src/ui/showdown.css"),
  build({...options, entryPoints: ["src/app.js"], ...(splitLanes ? {plugins: [lanesExternal]} : {})}),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
if (hosted) await rm(file("dist/web/chunks/"), {recursive: true, force: true});
if (splitLanes) {
  if (!script.includes(`import("./${lanes.name}")`)) throw new Error("src/app.js no longer imports ./graybox.js dynamically");
  await mkdir(file("dist/web/chunks/"), {recursive: true});
  await writeFile(file(`dist/web/${lanes.name}`), lanes.code);
}
await mkdir(new URL("./", file(output)), {recursive: true});
await writeFile(file(output), template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}`).replace("@@SCRIPT@@", () => script));
console.log(`Built ${output} (graybox${lanes ? `, lane duel in ${lanes.name}` : ""})`);
