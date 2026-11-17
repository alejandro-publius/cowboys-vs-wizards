// Builds the isolated Billy preview into .artifacts/billy-pilot/preview/ (ignored by git).
// Run from the repo root: node scripts/animation-pilot/build-billy-preview.mjs
// Copies the existing models read-only; the originals in assets/models are never modified.
import {build} from "esbuild";
import {copyFileSync, mkdirSync, writeFileSync} from "node:fs";
import {arenaModelNames, perimeterModelNames} from "../../src/render/model-assets.js";

const out = ".artifacts/billy-pilot/preview/";
mkdirSync(out + "models", {recursive: true});
for (const name of [...arenaModelNames, ...perimeterModelNames]) copyFileSync(`assets/models/${name}.glb`, `${out}models/${name}.glb`);
await build({entryPoints: ["scripts/animation-pilot/billy-preview.js"], bundle: true, outfile: out + "preview.js", platform: "browser",
  target: "es2022", format: "esm", loader: {".webp": "dataurl"}, minify: false, logLevel: "warning"});
writeFileSync(out + "index.html", `<!doctype html><meta charset="utf-8"><title>Billy sourced idle pilot (preview)</title>
<style>body{margin:0;background:#111;color:#f3e7c9;font:14px/1.3 ui-monospace,Menlo,monospace}#stage{position:relative;width:1280px;height:720px}
canvas{display:block;width:1280px;height:720px}.bar{position:absolute;left:0;right:0;padding:6px 10px;background:#000a}
#top{top:0}#bot{bottom:0;display:flex;justify-content:space-between}#state{color:#ffd37a}</style>
<div id="stage"><div class="bar" id="top"><span id="state"></span> &nbsp; <span id="time"></span></div>
<div class="bar" id="bot"><span>Left: existing board camera · Billy A (slot 0) attacks, Billy B (slot 2) idles 0.8 s out of phase</span><span>Right: existing closeUp camera, Billy A</span></div></div>
<div id="hud" hidden></div><script type="module" src="./preview.js"></script>`);
console.log("built " + out);
