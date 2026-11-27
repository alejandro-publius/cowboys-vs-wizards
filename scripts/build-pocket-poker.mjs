import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const poker = new URL("../experiments/boot-hill-poker/", import.meta.url);
const hostedScripts = /<script type="importmap">[^<]*<\/script>\s*<script type="module" src="\.\/app\.js"><\/script>/;

export async function buildPocketPoker() {
  const [html, bundle] = await Promise.all([
    readFile(new URL("index.html", poker), "utf8"),
    build({entryPoints: [fileURLToPath(new URL("app.js", poker))], bundle: true, write: false,
      format: "iife", target: "es2022", minify: true, supported: {"inline-script": false}}),
  ]);
  assert.match(html, hostedScripts, "Expected the hosted Poker import map and app.js entry");
  return html.replace(hostedScripts, () => `<script>${bundle.outputFiles[0].text}</script>`);
}
