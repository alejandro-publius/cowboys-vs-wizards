import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";
import { installFrameSampler } from "./capture-clock.mjs";
import { actScene, prepareScene, verifyScene } from "./scenes.mjs";
import { SCENE_FRAMES } from "./timeline.mjs";

const FPS = 60;
const viewport = { width: 1280, height: 720 };
const require = createRequire(import.meta.url);

function chromiumLauncher() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE).chromium;
  for (const name of ["playwright", "playwright-core"]) {
    try {
      require.resolve(name);
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND") continue;
      throw error;
    }
    return require(name).chromium;
  }
  throw new Error("Set PLAYWRIGHT_MODULE to your installed playwright or playwright-core package.");
}

async function advance(cdp, frame) {
  // Chromium's budget is measured in microseconds. Round absolute sample times to avoid drift.
  const micros = (n) => Math.round(n * 1_000_000 / FPS);
  await Promise.all([
    once(cdp, "Emulation.virtualTimeBudgetExpired", { signal: AbortSignal.timeout(30_000) }),
    cdp.send("Emulation.setVirtualTimePolicy", {
      policy: "advance",
      budget: (micros(frame) - micros(frame - 1)) / 1000,
      maxVirtualTimeTaskStarvationCount: 100,
    }),
  ]);
}

async function encode(frames, destination) {
  const child = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", "-pix_fmt", "yuv420p",
    "-fps_mode", "passthrough", "-video_track_timescale", "60000", "-movflags", "+faststart",
    destination,
  ], { stdio: ["pipe", "ignore", "inherit"] });
  const finished = once(child, "close").then(([code, signal]) => {
    if (code !== 0) throw new Error(`ffmpeg exited with ${signal ?? code}`);
  });
  try {
    // pipeline pulls the next browser frame only as the encoder's input accepts data.
    await Promise.all([finished, pipeline(frames, child.stdin)]);
  } finally {
    child.kill();
    await finished.catch(() => {});
  }
}

async function capture(browser, id, baseUrl, out) {
  const total = SCENE_FRAMES[id];
  const work = join(out, `.${id}.capture`);
  await mkdir(work); // Exclusive per scene; an incomplete attempt never becomes a published clip.
  let context;
  let watchdog;
  let frame = 0;
  const sourceFrames = new Set();
  try {
    context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const page = await context.newPage();
    const options = { page, baseUrl };
    const cdp = await context.newCDPSession(page);
    await page.addInitScript(installFrameSampler);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
    await prepareScene(id, options);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
    await page.evaluate(() => window.trailerSampler.start());

    async function* frames() {
      for (; frame < total; frame++) {
        watchdog.refresh();
        if (frame > 0) await advance(cdp, frame);
        await actScene(id, frame, options);
        await page.evaluate((time) => window.trailerSampler.sample(time), frame * 1000 / FPS);
        const shot = await cdp.send("Page.captureScreenshot", {
          format: "jpeg", quality: 96, fromSurface: true, captureBeyondViewport: false,
        });
        const jpeg = Buffer.from(shot.data, "base64");
        sourceFrames.add(createHash("sha256").update(jpeg).digest("hex"));
        if ((frame + 1) % FPS === 0) console.log(`${id}: sampled ${frame + 1}/${total} frames`);
        yield jpeg;
      }
    }
    watchdog = setTimeout(() => {
      context.close({ reason: `${id} timed out at frame ${frame}` }).catch(() => {});
    }, 60_000);
    const filename = id + ".mp4";
    await encode(frames(), join(work, filename));
    const verification = await verifyScene(id, options);
    if (verification === false) throw new Error("Scene verification failed");
    const manifest = {
      scene: id, file: filename, ...viewport, fps: FPS, frames: frame,
      distinctSourceFrames: sourceFrames.size, verification,
    };
    const receipt = id + ".json";
    await writeFile(join(work, receipt), JSON.stringify(manifest, null, 2) + "\n");
    await rm(join(out, receipt), { force: true });
    await rename(join(work, filename), join(out, filename));
    await rename(join(work, receipt), join(out, receipt));
    console.log(`${id}: ${frame} frames -> ${join(out, filename)}`);
  } catch (error) {
    throw new Error(`${id}, frame ${frame}: ${error.message}`, { cause: error });
  } finally {
    clearTimeout(watchdog);
    try { await context?.close(); } finally { await rm(work, { recursive: true, force: true }); }
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    site: { type: "string" }, out: { type: "string" }, scene: { type: "string" },
  } });
  if (!values.site || !values.out) throw new Error("Usage: capture.mjs --site <HTTP root> --out <clips directory> [--scene <id>]");
  const url = new URL(values.site);
  if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash) throw new Error("--site must be an HTTP(S) root URL");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  const ids = values.scene === undefined ? Object.keys(SCENE_FRAMES) : [values.scene];
  for (const id of ids) {
    if (!Object.hasOwn(SCENE_FRAMES, id)) throw new Error("Unknown scene: " + id);
  }
  const out = resolve(values.out);
  await mkdir(out, { recursive: true });
  const browser = await chromiumLauncher().launch({
    headless: true, executablePath: process.env.CHROME_PATH || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--run-all-compositor-stages-before-draw"],
  });
  try {
    for (const id of ids) await capture(browser, id, url.href, out);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
