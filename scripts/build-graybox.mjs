import {build} from "esbuild";
import {createHash} from "node:crypto";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const root = new URL("../", import.meta.url);
const file = (name) => new URL(name, root);
const read = (name) => readFile(file(name), "utf8");
// --hosted: the Pages copy at /graybox/. The page is the same single file, except that the lane duel
// (src/graybox.js, reached only by the lane modes) becomes a separate script that app.js's existing
// dynamic import fetches on demand, so Showdown never downloads it. Only dist/web/graybox/ is written.
const hosted = process.argv.includes("--hosted");
const output = hosted ? "dist/web/graybox/index.html" : process.argv.includes("--web") ? "dist/web/index.html" : "dist/cowboys-vs-wizards-board-duel.html";
const options = {absWorkingDir: fileURLToPath(root), bundle: true, write: false, platform: "browser", target: "es2022", minify: true};
let lanes = null;
if (hosted) {
  const [code] = (await build({...options, entryPoints: ["src/graybox.js"], format: "esm"})).outputFiles;
  lanes = {name: `chunks/lanes-${createHash("sha256").update(code.contents).digest("hex").slice(0, 8)}.js`, code: code.contents};
}
// Resolved against the page URL, so the build works under any base path (…/graybox/).
const lanesExternal = {name: "lanes-external", setup(b) {
  b.onResolve({filter: /^\.\/graybox\.js$/}, (args) => args.importer.endsWith("src/app.js") ? {path: `./${lanes.name}`, external: true} : undefined);
}};
const [template, style, showdownStyle, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  read("src/ui/showdown.css"),
  build({...options, entryPoints: ["src/app.js"], ...(hosted ? {plugins: [lanesExternal]} : {})}),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
if (hosted) {
  if (!script.includes(`import("./${lanes.name}")`)) throw new Error("src/app.js no longer imports ./graybox.js dynamically");
  await rm(file("dist/web/graybox/chunks/"), {recursive: true, force: true});
  await mkdir(file("dist/web/graybox/chunks/"), {recursive: true});
  await writeFile(file(`dist/web/graybox/${lanes.name}`), lanes.code);
}
await mkdir(new URL("./", file(output)), {recursive: true});
await writeFile(file(output), template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}`).replace("@@SCRIPT@@", () => script));
console.log(`Built ${output} (graybox${hosted ? `, lane duel in ${lanes.name}` : ""})`);
