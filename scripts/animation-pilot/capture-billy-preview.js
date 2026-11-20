// Deterministic frame capture of the Billy preview (Playwright code for `playwright-cli run-code`).
// From the repository root, after `node scripts/animation-pilot/build-billy-preview.mjs`:
//   (cd .artifacts/billy-pilot/preview && python3 -m http.server 48179 --bind 127.0.0.1) &
//   npx -y @playwright/cli@latest open --browser=chrome
//   npx -y @playwright/cli@latest run-code --filename=scripts/animation-pilot/capture-billy-preview.js
//   ffmpeg -y -framerate 30 -i .artifacts/billy-pilot/frames/f%04d.png -c:v libx264 -pix_fmt yuv420p .artifacts/billy-pilot/billy-pilot-preview.mp4
// The page runs with ?capture=1, so every run advances by exactly 1/30 s per frame.
// Frames go to .artifacts/billy-pilot/frames/ and the command's stdout (console problems, teardown, per-frame log) is saved with
//   ... run-code --filename=... > .artifacts/billy-pilot/run-output.txt
// Frames are written under the directory `open` was run from.
async page => {
  const OUT = ".artifacts/billy-pilot/frames-v2/";
  const problems = [];
  page.on("pageerror", (error) => problems.push("pageerror: " + String(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) problems.push("console.error: " + message.text());
  });
  await page.setViewportSize({width: 1280, height: 720});
  await page.goto("http://127.0.0.1:48179/index.html?capture=1");
  await page.waitForSelector("body[data-ready='1']", {timeout: 120000});
  const total = await page.evaluate(() => window.__pilot.TOTAL);
  const frames = Math.round(total * 30);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(() => window.__pilot.advance(1000 / 30));
    await page.screenshot({path: OUT + "f" + String(i).padStart(4, "0") + ".png"});
  }
  const log = await page.evaluate(() => JSON.stringify(window.__pilot.log));
  const teardown = await page.evaluate(() => window.__pilot.teardown());
  return {frames, problems, teardown, log: JSON.parse(log)};
}
