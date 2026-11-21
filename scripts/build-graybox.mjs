import {build} from "esbuild";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {grayboxBuildLabel} from "./graybox-build-label.mjs";
import {verifiedForBuild} from "./outrider-gate.mjs";

const root = new URL("../", import.meta.url);
const file = (name) => new URL(name, root);
const read = (name) => readFile(file(name), "utf8");
// --hosted: the Pages copy at the site root (dist/web/index.html; scripts/stage-pages.mjs adds the
// /graybox/ alias). It is the same single offline file as the other builds: the graybox game is
// Showdown only (issue 143 slice 3), so no lane chunk exists and none is fetched.
const hosted = process.argv.includes("--hosted");
const output = process.argv.includes("--outrider-fixture") ? ".artifacts/outrider-fixture/graybox.html"
  : hosted || process.argv.includes("--web") ? "dist/web/index.html" : "dist/cowboys-vs-wizards-board-duel.html";
// K-087: the page's public build label (commit, "+local" if uncommitted), so the Camp's playtest report can say
// which build each duel was finished under. Null without git: the report then says the build is not identified.
const label = grayboxBuildLabel(fileURLToPath(root));
// K-011: the Outrider turns the gate verifies now, from this tree (scripts/outrider-gate.mjs). Stale or missing = none,
// and the page builds without any Outrider control. --outrider-fixture <dir> builds a test page from a fixture
// directory, written only under .artifacts/ so it is never staged or shipped.
const fixtureAt = process.argv.indexOf("--outrider-fixture");
const fixture = fixtureAt >= 0 ? process.argv[fixtureAt + 1] : null;
const outrider = await verifiedForBuild(fixture ? {dir: `${fixture}/decision`, receiptPath: `${fixture}/receipt.json`,
  curated: JSON.parse(await read(`${fixture}/curated.json`))} : {});
const options = {absWorkingDir: fileURLToPath(root), bundle: true, write: false, platform: "browser", target: "es2022", minify: true,
  define: {__CVW_GRAYBOX_BUILD__: JSON.stringify(label), __CVW_OUTRIDER__: JSON.stringify({cases: outrider.cases, camp: outrider.camp}),
    __CVW_OUTRIDER_LEDGER__: JSON.stringify(outrider.ledger)}};
const [template, style, showdownStyle, replayStyle, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  read("src/ui/showdown.css"),
  read("apps/replay-room/src/room.css"),
  build({...options, entryPoints: ["src/app.js"]}),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
// A Pages tree built before slice 3 may still hold the old lane chunk; drop it so it is never staged.
if (hosted) await rm(file("dist/web/chunks/"), {recursive: true, force: true});
await mkdir(new URL("./", file(output)), {recursive: true});
// The build receipt for the Ledger's Outrider section: exactly what this page was given. Kept under .artifacts/
// (ignored) so it is never staged to the site.
await mkdir(file(".artifacts/outrider-ledger/"), {recursive: true});
await writeFile(file(`.artifacts/outrider-ledger/${output.replace(/[/.]/g, "_")}.json`), `${JSON.stringify({build: label, gate: outrider.note, camp: outrider.camp,
  output, linked: outrider.cases.map((c) => c.id), ledger: outrider.ledger}, null, 2)}\n`);
await writeFile(file(output), template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}\n${replayStyle}`).replace("@@SCRIPT@@", () => script));
console.log(`Built ${output} (graybox, build ${label ?? "not identified"}); Outrider gate: ${outrider.note}`);
