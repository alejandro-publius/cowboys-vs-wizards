// Standalone offline page: node prototypes/showdown/build.mjs
// Writes dist/showdown.html (dist/ is a generated build, not committed).
import {build} from "esbuild";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const here = new URL("./", import.meta.url);
const out = new URL("../../dist/showdown.html", import.meta.url);
const [template, style, bundle] = await Promise.all([
  readFile(new URL("index.html", here), "utf8"),
  readFile(new URL("style.css", here), "utf8"),
  build({entryPoints: [fileURLToPath(new URL("main.js", here))], bundle: true, write: false, platform: "browser", target: "es2022", minify: true}),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
await mkdir(new URL("./", out), {recursive: true});
await writeFile(out, template.replace("@@STYLE@@", () => style).replace("@@SCRIPT@@", () => script));
console.log("Built dist/showdown.html");
