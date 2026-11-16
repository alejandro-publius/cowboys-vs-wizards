// Chrome capture of the Sheriff at seed 0: summon in lane 1, then the clash.
// This is Playwright code for `playwright-cli run-code`; it is not a Node
// module. From the repository root:
//
//   npm run build
//   (cd dist && python3 -m http.server 48178 --bind 127.0.0.1) &
//   npx -y @playwright/cli@latest open --browser=chrome
//   npx -y @playwright/cli@latest run-code --filename=scripts/sheriff-capture.js
//
// The page clock is paused and stepped, so every run captures the same
// moments. Screenshots (1440 x 900) go to docs/evidence/sheriff-integration/
// under the directory `open` was run from. Returns what the page showed.
async page => {
  const PAGE = "http://127.0.0.1:48178/cowboys-vs-wizards-board-duel.html?seed=0";
  const OUT = "docs/evidence/sheriff-integration/";
  const LANES = "#match .match-slot";
  const shown = () => page.evaluate((lanes) => ({
    lanes: [...document.querySelectorAll(lanes)].map((node) => node.getAttribute("aria-label")).slice(0, 2),
    canEndPhase: !document.querySelector('#match [data-action="end-phase"]').disabled,
  }), LANES);
  const problems = [];
  page.on("pageerror", (error) => problems.push(String(error)));
  page.on("console", (message) => {
    // The local file server has no favicon; that 404 is not a page problem.
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) problems.push(message.text());
  });
  await page.setViewportSize({width: 1440, height: 900});
  await page.clock.install();

  // One play-through per camera. `shots` maps a file name to milliseconds
  // after the summon is confirmed, or after End phase for the clash.
  async function play(view, summonShots, clashShots) {
    await page.goto(PAGE + (view ? "&closeup=" + view : ""));
    await page.waitForSelector('#match .match-hand [data-card-id^="cowboy-sheriff"]', {timeout: 60000});
    await page.click('#match .match-hand [data-card-id^="cowboy-sheriff"]');
    await page.click(LANES + '[data-side="cowboy"][data-slot="0"]');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 40));
    const seen = {view: view || "board camera"};
    const step = async (shots, total) => {
      let now = 0;
      for (const [name, at] of Object.entries(shots).sort((a, b) => a[1] - b[1])) {
        await page.clock.runFor(at - now);
        now = at;
        await page.screenshot({path: OUT + name + ".png"});
        seen[name] = (await shown()).lanes;
      }
      await page.clock.runFor(total - now);
    };
    await page.click('#match [data-action="confirm"]');
    await step(summonShots, 1500);
    seen.afterSummon = await shown();
    await page.click('#match [data-action="end-phase"]');
    await step(clashShots, 4700);
    seen.afterClash = (await shown()).lanes;
    return seen;
  }

  // At seed 0 the Wizard answers with a Skeleton in lane 1 and the clash
  // starts 2760 ms after End phase. The Sheriff's cue: hand on the revolver
  // at 290 ms, aimed at 680, shot at 800, impact at 890, holstered at 1360.
  const CLASH = 2760;
  const runs = [
    await play("cowboy-0",
      {"summon-fall": 200, "summon-landing": 440, "idle": 1400},
      {"windup-reach": CLASH + 270, "windup-aimed": CLASH + 760, "fire-close": CLASH + 810, "recover": CLASH + 1150}),
    await play("cowboy-0-wide",
      {},
      {"before-impact": CLASH + 850, "impact": CLASH + 910}),
    await play("",
      {"board-view": 1400},
      {}),
  ];
  return {runs, problems};
}
