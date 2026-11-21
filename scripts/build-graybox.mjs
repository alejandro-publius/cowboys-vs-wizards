import {build} from "esbuild";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {grayboxBuildLabel} from "./graybox-build-label.mjs";
import {verifiedForBuild} from "./outrider-gate.mjs";

const root = new URL("../", import.meta.url);
const file = (name) => new URL(name, root);
const read = (name) => readFile(file(name), "utf8");
const artwork = async (name) => {
  try {
    return "data:image/webp;base64," + await readFile(file(name), "base64");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return "";
  }
};
// --hosted: the Pages copy at the site root (dist/web/index.html; scripts/stage-pages.mjs adds the
// /graybox/ alias). It is the same single offline file as the other builds: the graybox game is
// Showdown only (issue 143 slice 3), so no lane chunk exists and none is fetched.
const hosted = process.argv.includes("--hosted");
const diorama = process.argv.includes("--diorama") && !hosted;
const output = diorama ? "dist/cowboys-vs-wizards-showdown-3d.html" : process.argv.includes("--outrider-fixture") ? ".artifacts/outrider-fixture/graybox.html"
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
const atlas = diorama ? await readFile(file("assets/cards/showdown-diorama.webp"), "base64").catch((error) => {
  if (error.code === "ENOENT") return "";
  throw error;
}) : "";
const paintings = diorama ? Object.fromEntries(await Promise.all(Object.entries({
  "cowboy-sheriff": "sheriff", "cowboy-billy": "billy", "cowboy-mounted-billy": "mounted-billy",
  "cowboy-deadeye": "deadeye", "wizard-skeleton": "skeleton", "wizard-wizard": "wizard",
  "wizard-dragon": "dragon", "wizard-singularity": "singularity",
}).map(async ([id,name]) => {
  const revised = await artwork(`assets/cards/${name}-storybook.webp`);
  return [id, revised || await artwork(`assets/cards/${name}-card.webp`)];
}))) : {};
if (diorama) {
  const gatling = await artwork("assets/cards/gatling-storybook.webp");
  if (gatling) paintings["cowboy-gatling-crew"] = gatling;
}
const panorama = diorama ? await artwork("assets/scenes/showdown-storybook.webp") : "";
const poses = diorama ? await artwork("assets/scenes/showdown-poses.webp") : "";
const billyPoses = diorama ? await artwork("assets/scenes/billy-poses.webp") : "";
const frontier = diorama ? await Promise.all(["title", "camp"].map(async (view) => {
  const image = await readFile(file(`assets/scenes/showdown-${view}.webp`), "base64");
  return `--frontier-${view}:url("data:image/webp;base64,${image}");`;
})) : [];
if (panorama) frontier.push(`--frontier-panorama:url("${panorama}");`);
const options = {absWorkingDir: fileURLToPath(root), bundle: true, write: false, platform: "browser", target: "es2022", minify: true,
  define: {__CVW_GRAYBOX_BUILD__: JSON.stringify(label), __CVW_OUTRIDER__: JSON.stringify({cases: outrider.cases, camp: outrider.camp}),
    __CVW_OUTRIDER_LEDGER__: JSON.stringify(outrider.ledger), __CVW_DIORAMA__: JSON.stringify(diorama),
    __CVW_DIORAMA_ATLAS__: JSON.stringify(atlas), __CVW_TABLE_ILLUSTRATIONS__: JSON.stringify(paintings),
    __CVW_HAS_PANORAMA__: JSON.stringify(Boolean(panorama)), __CVW_DUEL_POSES__: JSON.stringify(poses),
    __CVW_BILLY_POSES__: JSON.stringify(billyPoses)}};
const [template, style, showdownStyle, boardStyle, boardLicense, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  read("src/ui/showdown.css"),
  diorama ? Promise.all([
    read("src/ui/showdown-3d/frontier.css"),
    read("src/ui/showdown-3d/board.css"),
    read("src/ui/showdown-3d/table.css"),
  ]).then(parts => [`:root{${frontier.join("")}}`, ...parts].join("\n")) : "",
  diorama ? read("src/ui/showdown-3d/graphics/THREE-LICENSE") : "",
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
await writeFile(file(output), template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}\n${boardStyle}`)
  .replace("Cowboys vs. Wizards | Graybox", diorama ? "Cowboys vs. Wizards" : "Cowboys vs. Wizards | Graybox")
  .replace("@@SCRIPT@@", () => script + (boardLicense ? `\n/*\n${boardLicense}\n*/` : "")));
console.log(`Built ${output} (${diorama ? "3D diorama" : "graybox"}, build ${label ?? "not identified"}); Outrider gate: ${outrider.note}`);
