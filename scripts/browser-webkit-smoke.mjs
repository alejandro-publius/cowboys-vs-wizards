// WebKit smoke check of a served web build, through Playwright's WebKit (the
// engine behind Safari; a desktop build, not Safari on an iPhone). It builds
// and serves nothing itself:
//
//   npm run build -- --web && python3 -m http.server 8123 -d dist/web
//   npx -y playwright-core@1.64.1 install webkit        (once)
//   npx -y -p playwright-core@1.64.1 node scripts/browser-webkit-smoke.mjs http://127.0.0.1:8123/ [--out-dir PATH]
//
// Playwright is not a project dependency. npx fetches the pinned version and
// puts its command on PATH; the script loads the library from beside it.
//
// Steps, in order: the title menu appears; a match starts with
// ?mode=match&deck=starter&seed=0; the board has a WebGL 2 context or the
// fallback is shown; a card is chosen, a lane picked and a troop summoned; no
// console errors. A step is "seen" only when the page showed it. A step that
// failed, or was never reached, is "not seen". Screenshots and result.json go
// to .artifacts/webkit-smoke/ (ignored by git). Exit status 1 unless every
// step was seen.
import {execFileSync} from "node:child_process";
import {mkdir, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {existsSync} from "node:fs";
import {createRequire} from "node:module";
import {fileURLToPath, pathToFileURL} from "node:url";

const RUN = "npx -y -p playwright-core@1.64.1 node scripts/browser-webkit-smoke.mjs <served page URL>";
// npx -p puts <cache>/node_modules/.bin on PATH; the library is one level up.
const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
if (!bin) {
  console.error(`playwright-core is not on PATH. Run this check as:\n  ${RUN}`);
  process.exit(2);
}
const {webkit} = createRequire(pathToFileURL(path.join(bin, "..", "x.js")))("playwright-core");

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--out-dir");
const outDir = path.resolve(at < 0 ? path.join(root, ".artifacts/webkit-smoke") : args[at + 1] ?? "");
const given = args.find((arg, i) => !arg.startsWith("--") && (at < 0 || i !== at + 1));
if (!given || (at >= 0 && !args[at + 1])) {
  console.error(`usage: ${RUN} [--out-dir PATH]`);
  process.exit(2);
}
const menuUrl = new URL(given);
menuUrl.search = "";
const matchUrl = new URL(menuUrl);
matchUrl.search = "?mode=match&deck=starter&seed=0";

const WAIT = 90000;
const steps = [];
const consoleErrors = [];
let browser;
try {
  browser = await webkit.launch();
} catch (error) {
  console.error(`${error.message}\nWebKit did not start. Install it once with: npx -y playwright-core@1.64.1 install webkit`);
  process.exit(2);
}
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`uncaught: ${error.message}`));
await mkdir(outDir, {recursive: true});

// Runs one step. `look` returns a detail string when the page showed the
// step, or throws. After a failure the remaining steps are not attempted.
let stopped = false;
async function step(name, look) {
  const record = {name, seen: false, detail: "not reached: an earlier step was not seen"};
  steps.push(record);
  if (stopped) return;
  try {
    record.detail = await look();
    record.seen = true;
  } catch (error) {
    record.detail = error.message.split("\n")[0];
    stopped = true;
  }
  record.screenshot = `${String(steps.length).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  await page.screenshot({path: path.join(outDir, record.screenshot)}).catch(() => delete record.screenshot);
}
const text = (selector) => page.locator(selector).first().textContent();

await step("title menu appears", async () => {
  await page.goto(menuUrl.href, {waitUntil: "load", timeout: WAIT});
  await page.locator("#menu-play").waitFor({state: "visible", timeout: WAIT});
  return `Play button visible: "${(await text("#menu-play")).trim()}"`;
});

let webgl = "not checked";
await step("match starts with seed 0", async () => {
  await page.goto(matchUrl.href, {waitUntil: "load", timeout: WAIT});
  // Either the match takes input or the page gave up on WebGL and shows its fallback.
  await page.waitForFunction(() => document.getElementById("match")?.dataset.status === "accepting_input"
    || document.getElementById("fallback")?.hidden === false, null, {timeout: WAIT});
  const cards = await page.locator("#match .match-hand [data-card-id]").count();
  if (!cards) throw new Error("no match hand: the page showed its fallback instead of a match");
  return `status accepting_input, ${cards} cards in hand`;
});

await step("3D board has WebGL 2 or the fallback is shown", async () => {
  const seen = await page.evaluate(() => {
    if (document.getElementById("fallback")?.hidden === false) return {kind: "fallback"};
    const canvas = document.querySelector("#stage canvas");
    const gl = canvas?.getContext("webgl2");
    if (!gl) return {kind: "none"};
    return {kind: "webgl2", version: gl.getParameter(gl.VERSION), lost: gl.isContextLost(), width: canvas.width, height: canvas.height};
  });
  webgl = seen.kind;
  if (seen.kind === "none" || seen.lost) throw new Error(`no working WebGL 2 context and no fallback (${JSON.stringify(seen)})`);
  return seen.kind === "fallback" ? "fallback shown" : `WebGL 2 context: ${seen.version}, canvas ${seen.width}x${seen.height}`;
});

const slot = '#match .match-slot[data-side="cowboy"]';
await step("card chosen", async () => {
  const card = page.locator('#match .match-hand [data-card-id^="cowboy-sheriff"]:not([disabled])').first();
  await card.click({timeout: WAIT});
  await page.locator('#match .match-hand [aria-pressed="true"]').waitFor({timeout: WAIT});
  return `selected ${await card.getAttribute("data-card-id")}`;
});
await step("lane picked", async () => {
  const lane = page.locator(`${slot}:not([disabled])`).first();
  const label = await lane.getAttribute("aria-label");
  await lane.click({timeout: WAIT});
  await page.locator('#match [data-action="confirm"]:not([disabled])').waitFor({state: "visible", timeout: WAIT});
  return `picked "${label}"; Confirm is enabled`;
});
await step("troop summoned", async () => {
  await page.locator('#match [data-action="confirm"]').click({timeout: WAIT});
  await page.waitForFunction((selector) => [...document.querySelectorAll(selector)].some((node) => /^Sheriff \d\/\d/.test(node.textContent))
    && document.getElementById("match").dataset.status === "accepting_input", slot, {timeout: WAIT});
  return (await page.locator(slot).allTextContents()).join(" | ");
});
await step("no console errors", async () => {
  if (consoleErrors.length) throw new Error(`${consoleErrors.length} console error(s): ${consoleErrors[0]}`);
  return "0 console errors";
});

const git = (...a) => {
  try {
    return execFileSync("git", a, {cwd: root, encoding: "utf8"}).trim();
  } catch {
    return null;
  }
};
const result = {
  check: "Playwright WebKit on a desktop; not Safari on an iPhone",
  date: new Date().toISOString(),
  commit: git("rev-parse", "HEAD"),
  url: matchUrl.href,
  browser: {name: "webkit", version: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent).catch(() => null)},
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  viewport: "1440x900",
  webgl,
  steps,
  consoleErrors,
};
await writeFile(path.join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
await browser.close();

for (const {name, seen, detail} of steps) console.log(`${seen ? "seen    " : "NOT SEEN"}  ${name}: ${detail}`);
const seen = steps.filter((each) => each.seen).length;
console.log(`WebKit ${result.browser.version}: seen ${seen} of ${steps.length} steps; result in ${path.relative(root, outDir)}/result.json`);
process.exit(seen === steps.length ? 0 : 1);
