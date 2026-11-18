import {build} from "esbuild";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const root = new URL("../", import.meta.url);
const file = (name) => new URL(name, root);
const read = (name) => readFile(file(name), "utf8");
const output = process.argv.includes("--web") ? "dist/web/index.html" : "dist/cowboys-vs-wizards-board-duel.html";
const [template, style, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  build({
    absWorkingDir: fileURLToPath(root), entryPoints: ["src/graybox.js"], bundle: true, write: false,
    platform: "browser", target: "es2022", minify: true,
  }),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
await mkdir(new URL("./", file(output)), {recursive: true});
await writeFile(file(output), template.replace("@@STYLE@@", () => style).replace("@@SCRIPT@@", () => script));
console.log(`Built ${output} (graybox)`);
