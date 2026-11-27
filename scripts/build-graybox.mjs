import {build} from "esbuild";
import {pagePreview} from "./showdown-page-preview.mjs";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {grayboxBuildLabel} from "./graybox-build-label.mjs";
import {verifiedForBuild} from "./outrider-gate.mjs";
import {buildSaloonTable} from "./build-saloon-table.mjs";
import {buildPocketPoker} from "./build-pocket-poker.mjs";

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
// --hosted stages the graybox fallback. --diorama --contest builds the illustrated contest entry.
// Both are single-file builds of the same Showdown rules and Camp.
const hosted = process.argv.includes("--hosted");
const diorama = process.argv.includes("--diorama") && !hosted;
const contest = diorama && process.argv.includes("--contest");
const saloonBook = contest && process.argv.includes("--saloon-book");
const output = saloonBook ? "dist/Showdown_Field_Guide.html" : diorama ? "dist/cowboys-vs-wizards-showdown-3d.html" : process.argv.includes("--outrider-fixture") ? ".artifacts/outrider-fixture/graybox.html"
  : hosted || process.argv.includes("--web") ? "dist/web/index.html" : "dist/cowboys-vs-wizards-board-duel.html";
// K-087: the page's public build label (commit, "+local" if uncommitted), so the Camp's playtest report can say
// which build each duel was finished under. Null without git: the report then says the build is not identified.
const label = grayboxBuildLabel(fileURLToPath(root), diorama ? "illustrated" : "graybox");
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
const panorama = diorama ? await artwork("assets/scenes/showdown-storybook.webp") : "";
const [titleFont, fontLicense] = diorama ? await Promise.all([
  readFile(file("assets/fonts/barlow-condensed/BarlowCondensed-Black.woff2"), "base64"),
  read("assets/fonts/barlow-condensed/OFL.txt"),
]) : ["", ""];
const frontier = diorama ? await Promise.all(Object.entries({
  title: "showdown-title", camp: "showdown-camp", billy: "billy-poses", wizard: "actors/wizard-wizard",
}).map(async ([view, scene]) => {
  const image = await readFile(file(`assets/scenes/${scene}.webp`), "base64");
  return `--frontier-${view}:url("data:image/webp;base64,${image}");`;
})) : [];
if (panorama) frontier.push(`--frontier-panorama:url("${panorama}");`);
const options = {absWorkingDir: fileURLToPath(root), bundle: true, write: false, platform: "browser", target: "es2022", minify: true,
  // Escape the child document's markup inside Showdown's own inline script.
  banner: diorama ? {js: `globalThis.__CVW_POCKET_POKER__=${JSON.stringify(await buildPocketPoker()).replace(/</g, "\\u003c")};`} : {},
  define: {__CVW_GRAYBOX_BUILD__: JSON.stringify(label), __CVW_OUTRIDER__: JSON.stringify({cases: outrider.cases, camp: outrider.camp}),
    __CVW_OUTRIDER_LEDGER__: JSON.stringify(outrider.ledger), __CVW_DIORAMA__: JSON.stringify(diorama), __CVW_CONTEST__: JSON.stringify(contest),
    __CVW_DIORAMA_ATLAS__: JSON.stringify(atlas), __CVW_HAS_PANORAMA__: JSON.stringify(Boolean(panorama))}};
const [template, style, showdownStyle, replayStyle, boardStyle, boardLicense, bundle] = await Promise.all([
  read("src/ui/graybox.html"),
  read("src/ui/graybox.css"),
  read("src/ui/showdown.css"),
  read("apps/replay-room/src/room.css"),
  diorama ? Promise.all([
    read("src/ui/showdown-3d/frontier.css"),
    read("src/ui/showdown-3d/title-opening.css"),
    read("src/ui/showdown-3d/board.css"),
    read("src/ui/showdown-3d/table.css"),
    read("src/ui/showdown-3d/character-book.css"),
    read("src/ui/showdown-3d/outpost.css"),
    read("src/ui/showdown-3d/saloon-tables.css"),
    read("src/ui/showdown-3d/saloon-play-tables.css"),
    read("src/ui/showdown-3d/saloon-room.css"),
  ]).then(parts => [`:root{${frontier.join("")}}`, ...parts].join("\n")) : "",
  diorama ? read("src/ui/showdown-3d/graphics/THREE-LICENSE") : "",
  (diorama ? buildSaloonTable : build)({...options, entryPoints: ["src/app.js"]}),
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
const preview = diorama
  ? pagePreview("", "Cowboys vs. Wizards: Showdown", "Ride the six-stop Trail in a haunted Western card game. Scout the Graveyard Dragon, hunt it and bring its card back to your deck.")
  : pagePreview("graybox/", "Showdown | Lightweight board", "Play the lightweight Cowboys vs. Wizards board. Take on the Trail, build your deck, and hunt the Lantern Wraith and the Graveyard Dragon.");
const pageTemplate = saloonBook ? template.replace("<body>", '<body data-entry-room="saloon">') : template;
await writeFile(file(output), pageTemplate.replace("@@PAGE_PREVIEW@@", () => preview).replace("@@STYLE@@", () => `${style}\n${showdownStyle}\n${replayStyle}\n${boardStyle}`)
  .replace("Cowboys vs. Wizards | Graybox", diorama ? "Cowboys vs. Wizards" : "Cowboys vs. Wizards | Graybox")
  .replace("@@TITLE_FONT@@", () => `data:font/woff2;base64,${titleFont}`)
  .replace("@@TITLE_NAME@@", diorama ? ' <span class="title-showdown">Showdown</span>' : "")
  .replace("@@TITLE_STAGE@@", diorama ? '<div class="opening-stage" aria-hidden="true"><i class="opening-billy"></i><i class="opening-wizard"></i></div><details class="opening-more"><summary data-title-more aria-label="More" title="More">•••</summary></details>' : "")
  .replace("@@SCRIPT@@", () => script + (boardLicense ? `\n/*\n${boardLicense}\n${fontLicense}\n*/` : "")));
console.log(`Built ${output} (${diorama ? "3D diorama" : "graybox"}, build ${label ?? "not identified"}); Outrider gate: ${outrider.note}`);
