// Card-face visibility check of a served web build, in Playwright WebKit or Chromium.
// Target: the earlier illustrated build (lane duel, 3D board), built by `npm run build:art -- --web`
// and published at /3d/. The graybox build (`npm run build`) is Showdown only since #143 slice 3
// and has none of the lane screens this script drives.
//
//   npm run build:art -- --web && python3 -m http.server 8123 -d dist/web   (illustrated build; /3d/ on Pages)
//   npx -y -p playwright-core@1.64.1 node scripts/browser-card-face-check.mjs http://127.0.0.1:8123/ [--browser webkit|chromium] [--out-dir PATH]
//
// Why it exists: the WebKit smoke check passed all its steps while every hand card
// was drawn as a blank tan rectangle. DOM presence, a loaded image, or a working
// click does not show a card face. This check looks at the rendered pixels.
//
// For each card face it screenshots the page, takes the middle of the face's
// on-screen box, and compares that patch's mean color (overall and in a 2x2 grid) with three references:
// the card's own art (read from the face's computed background), the shared card
// back, and the tan edge-slice gradient. The face counts as visible only when the
// art is the nearest reference. Checked states: the opening hand, a hovered card,
// a selected card, the hand after a summon, and the art viewer front and flipped.
// Screenshots and result.json go to .artifacts/card-face-check/<browser>/ (ignored
// by git). Exit 1 if any state fails, 2 if the browser or page could not be run.
// Playwright is not a project dependency; npx supplies it.
import {mkdir, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const RUN = "npx -y -p playwright-core@1.64.1 node scripts/browser-card-face-check.mjs <served page URL> [--browser webkit|chromium] [--out-dir PATH]";
const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
if (!bin) {
  console.error(`playwright-core is not on PATH. Run this check as:\n  ${RUN}`);
  process.exit(2);
}
const playwright = createRequire(pathToFileURL(path.join(bin, "..", "x.js")))("playwright-core");

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at < 0 ? null : args[at + 1] ?? "";
};
const browserName = option("--browser") ?? "webkit";
const outOption = option("--out-dir");
const given = args.find((arg, i) => !arg.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!given || !playwright[browserName] || !["webkit", "chromium"].includes(browserName) || outOption === "") {
  console.error(`usage: ${RUN}`);
  process.exit(2);
}
const outDir = path.resolve(outOption ?? path.join(root, ".artifacts/card-face-check", browserName));
const matchUrl = new URL(given);
matchUrl.search = "?mode=match&deck=starter&seed=0";

const WAIT = 90000;
const SETTLE = 800;
let browser;
try {
  browser = await playwright[browserName].launch();
} catch (error) {
  console.error(`${error.message}\n${browserName} did not start. Install it once with: npx -y playwright-core@1.64.1 install ${browserName}`);
  process.exit(2);
}
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`uncaught: ${error.message}`));
await mkdir(outDir, {recursive: true});

// Runs in the page: classifies the middle of each given box in a screenshot.
function classifyInPage({shot, boxes}) {
  const load = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image did not load"));
    image.src = src;
  });
  // Mean colors of the middle 40% of a source rectangle: one overall mean and a 2x2 grid.
  // The mean is steady under the card's tilt; the grid tells art from a back of similar color.
  const GRID = 2;
  // Drawn at 32x32 and averaged here: canvas downscaling straight to 1 or 2 pixels samples
  // points in WebKit instead of averaging.
  const sample = (image, x, y, w, h, cells) => {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d", {willReadFrequently: true});
    context.imageSmoothingQuality = "high";
    context.drawImage(image, x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4, 0, 0, size, size);
    const data = context.getImageData(0, 0, size, size).data;
    const per = size / cells;
    const out = [];
    for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
      const sum = [0, 0, 0];
      for (let py = cy * per; py < (cy + 1) * per; py++) for (let px = cx * per; px < (cx + 1) * per; px++) {
        for (let c = 0; c < 3; c++) sum[c] += data[(py * size + px) * 4 + c];
      }
      out.push(...sum.map((v) => v / (per * per)));
    }
    return out;
  };
  const mean = (image, x, y, w, h) => ({one: sample(image, x, y, w, h, 1), grid: sample(image, x, y, w, h, GRID)});
  const rms = (a, b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0) / (a.length / 3));
  const distance = (a, b) => rms(a.one, b.one) + rms(a.grid, b.grid);
  return (async () => {
    const screen = await load(shot);
    const urlOf = (value) => (/url\((["']?)(.*?)\1\)/.exec(value) ?? [])[2];
    const backUrl = urlOf(getComputedStyle(document.getElementById("match")).getPropertyValue("--card-back"));
    const backImage = await load(backUrl);
    const back = mean(backImage, 0, 0, backImage.naturalWidth, backImage.naturalHeight);
    const tan = [0xc9, 0xa8, 0x78];
    const slice = {one: tan, grid: Array.from({length: GRID * GRID * 3}, (_, i) => tan[i % 3])};
    const results = [];
    for (const box of boxes) {
      const artImage = await load(box.art);
      const art = mean(artImage, 0, 0, artImage.naturalWidth, artImage.naturalHeight);
      const seen = mean(screen, box.x, box.y, box.w, box.h);
      const want = box.expect === "back" ? back : art;
      const d = {expected: distance(seen, want), art: distance(seen, art), back: distance(seen, back), slice: distance(seen, slice)};
      const others = box.expect === "back" ? [d.art, d.slice] : [d.back, d.slice];
      results.push({label: box.label, expect: box.expect, seen: seen.one.map(Math.round), d: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Math.round(v)])),
        visible: d.expected < 0.9 * Math.min(...others)});
    }
    return results;
  })();
}

// Reads the on-screen box and art URL of each face matching a selector.
const readFaces = (selector) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((card) => {
  const face = card.querySelector(".front-face");
  // The card element's layout box, not the face's: WebKit reports the face's 3D-projected box a few pixels off.
  const rect = card.getBoundingClientRect();
  const art = /url\((["']?)(.*?)\1\)/.exec(getComputedStyle(face).backgroundImage)?.[2];
  return {id: card.dataset.cardId ?? card.getAttribute("aria-label"), x: rect.x, y: rect.y, w: rect.width, h: rect.height, art};
}), selector);

const states = [];
// Screenshots, then classifies `boxes` [{label, x, y, w, h, art, expect}].
async function judge(name, boxes) {
  await page.waitForTimeout(SETTLE);
  const file = `${String(states.length + 1).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  const buffer = await page.screenshot({path: path.join(outDir, file)});
  const shot = `data:image/png;base64,${buffer.toString("base64")}`;
  const cards = await page.evaluate(classifyInPage, {shot, boxes});
  const visible = cards.length > 0 && cards.every((card) => card.visible);
  states.push({name, visible, screenshot: file, cards});
  return visible;
}
const toBoxes = (faces, expect = "art", only) => faces.filter((f) => !only || f.id === only).map((f) => ({...f, label: f.id, expect}));
const hand = '#match .match-hand [data-card-id]';

let blocker = null;
try {
  await page.goto(matchUrl.href, {waitUntil: "load", timeout: WAIT});
  await page.waitForFunction(() => document.getElementById("match")?.dataset.status === "accepting_input", null, {timeout: WAIT});
  await page.locator(hand).first().waitFor({state: "visible", timeout: WAIT});
  await page.mouse.move(5, 5);

  await judge("opening hand", toBoxes(await readFaces(hand)));

  const card = page.locator('#match .match-hand [data-card-id^="cowboy-sheriff"]:not([disabled])').first();
  const sheriff = await card.getAttribute("data-card-id");
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await judge("hovered card", toBoxes(await readFaces(hand), "art", sheriff));

  await card.click({timeout: WAIT});
  await page.locator('#match .match-hand [aria-pressed="true"]').waitFor({timeout: WAIT});
  await page.mouse.move(5, 5);
  await judge("selected card", toBoxes(await readFaces(hand), "art", sheriff));

  const lane = page.locator('#match .match-slot[data-side="cowboy"]:not([disabled])').first();
  await lane.click({timeout: WAIT});
  await page.locator('#match [data-action="confirm"]:not([disabled])').waitFor({state: "visible", timeout: WAIT});
  await page.locator('#match [data-action="confirm"]').click({timeout: WAIT});
  await page.waitForFunction(() => /^Sheriff \d\/\d/.test(document.querySelector('#match .match-slot[data-side="cowboy"]')?.textContent ?? "")
    && document.getElementById("match").dataset.status === "accepting_input", null, {timeout: WAIT});
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1500);
  await judge("hand after summon", toBoxes(await readFaces(hand)));

  await page.locator('#match [data-action="view-art"]').click({timeout: WAIT});
  await page.locator(".card-viewer .card-preview").waitFor({state: "visible", timeout: WAIT});
  await page.waitForTimeout(SETTLE);
  const viewer = await page.evaluate(() => {
    const preview = document.querySelector(".card-viewer .card-preview");
    const rect = preview.getBoundingClientRect();
    const art = /url\((["']?)(.*?)\1\)/.exec(getComputedStyle(preview.querySelector(".front-face")).backgroundImage)?.[2];
    return {id: "viewer", x: rect.x, y: rect.y, w: rect.width, h: rect.height, art};
  });
  await judge("art viewer front", toBoxes([viewer]));
  await page.locator('[data-action="flip-art"]').click({timeout: WAIT});
  await judge("art viewer flipped", toBoxes([viewer], "back"));
} catch (error) {
  blocker = error.message.split("\n")[0];
}
if (!blocker && consoleErrors.length) blocker = `${consoleErrors.length} console error(s): ${consoleErrors[0]}`;

const result = {
  check: `Playwright ${browserName} on a desktop; not Safari on an iPhone`,
  date: new Date().toISOString(),
  url: matchUrl.href,
  browser: {name: browserName, version: browser.version()},
  viewport: "1440x900",
  blocker,
  states,
  consoleErrors,
};
await writeFile(path.join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
await browser.close();

for (const state of states) {
  console.log(`${state.visible ? "visible    " : "NOT VISIBLE"}  ${state.name}`);
  for (const card of state.cards) console.log(`             ${card.label}: expect ${card.expect}, mean ${card.seen}, distance ${JSON.stringify(card.d)}${card.visible ? "" : "  <- not the expected face"}`);
}
if (blocker) console.error(`BLOCKED: ${blocker}`);
const failed = states.filter((state) => !state.visible).length;
console.log(`${browserName} ${result.browser.version}: ${states.length - failed} of ${states.length} states show the card face; result in ${path.relative(root, outDir)}/result.json`);
process.exit(blocker && !states.length ? 2 : failed || blocker || states.length < 6 ? 1 : 0);
