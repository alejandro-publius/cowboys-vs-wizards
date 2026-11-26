// Build the portable ESM entry for the Crew dashboard. React is supplied by Crew.
import {build} from "esbuild";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const dir = new URL("./", import.meta.url);
const out = new URL("ui/index.mjs", dir);
const {outputFiles} = await build({
  absWorkingDir: fileURLToPath(dir), entryPoints: ["src/crew.mjs"], bundle: true, format: "esm",
  target: "es2022", external: ["react"], loader: {".css": "text"}, write: false,
  banner: {js: "// Built by apps/replay-room/build.mjs from src/. Edit the source and rebuild."},
});
const content = outputFiles[0].text;
if (process.argv.includes("--check")) {
  if (await readFile(out, "utf8") !== content) throw new Error("Replay Room dashboard bundle is stale. Run node apps/replay-room/build.mjs.");
} else {
  await mkdir(new URL("ui/", dir), {recursive: true});
  await writeFile(out, content);
}
