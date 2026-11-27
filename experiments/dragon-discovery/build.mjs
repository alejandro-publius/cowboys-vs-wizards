// Package the existing single-file illustrated game with a local moderator, outside the Pages tree.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const here = path => new URL(path, import.meta.url);
const read = path => readFile(here(path), "utf8");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
execFileSync(process.execPath, [fileURLToPath(here("../../scripts/build-graybox.mjs")), "--diorama", "--contest"],
  {cwd: here("../../"), stdio: "inherit"});
const [game, observer, template, bundle] = await Promise.all([
  read("../../dist/cowboys-vs-wizards-showdown-3d.html"), read("./observer.js"), read("./index.html"),
  build({entryPoints: [fileURLToPath(here("./moderator.js"))], bundle: true, write: false, target: "es2022"}),
]);
const gameEnd = /<\/body>\s*<\/html>\s*$/;
if (!gameEnd.test(game)) throw new Error("Expected the illustrated game document");
const participant = game.replace(gameEnd, () => `<script>${observer}</script></body></html>`);
const moderator = bundle.outputFiles[0].text;
const page = template.replace("@@BUILD@@", sha(game)).replace("@@INSTRUMENT@@", sha(participant + moderator + template))
  .replace("@@SCRIPT@@", () => moderator.replace(/<\/script/gi, "<\\/script"))
  .replace("@@GAME@@", () => JSON.stringify(participant).replaceAll("<", "\\u003c"));
const out = here("../../dist/g10/index.html");
await mkdir(new URL(".", out), {recursive: true});
await writeFile(out, page);
console.log(`Local study: ${out.href}\nGame HTML SHA-256: ${sha(game)}`);
