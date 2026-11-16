// Chrome capture of the Wizard's cast at seed 16. The Cowboy passes twice,
// the Wizard CPU summons a Wizard in lane 1 in round 2, the Cowboy answers
// with a Sheriff in lane 1 in round 3, and the clash is captured.
// This is Playwright code for `playwright-cli run-code`; it is not a Node
// module. From the repository root:
//
//   npm run build
//   (cd dist && python3 -m http.server 48179 --bind 127.0.0.1) &
//   npx -y @playwright/cli@latest open --browser=chrome
//   npx -y @playwright/cli@latest run-code --filename=scripts/wizard-capture.js
//
// The page clock is paused and stepped, so every run captures the same
// moments. Screenshots go to docs/evidence/wizard-cast/ under the directory
// `open` was run from. Returns what the page showed at each capture.
async page => {
  const PAGE = "http://127.0.0.1:48179/cowboys-vs-wizards-board-duel.html?seed=16";
  const OUT = "docs/evidence/wizard-cast/";
  const STEP = 40;
  const shown = () => page.evaluate(() => ({
    lanes: [...document.querySelectorAll("#match .match-slot")].map((node) => node.getAttribute("aria-label")).slice(0, 2),
    canEndPhase: !document.querySelector('#match [data-action="end-phase"]').disabled,
  }));
  const problems = [];
  page.on("pageerror", (error) => problems.push(String(error)));
  page.on("console", (message) => {
    // The local file server has no favicon; that 404 is not a page problem.
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) problems.push(message.text());
  });
  await page.clock.install();

  // One play-through per camera. `shots` maps a file name to [milliseconds
  // after the round-3 End phase click, optional clip rectangle].
  async function play(view, [width, height], shots) {
    await page.setViewportSize({width, height});
    await page.goto(PAGE + (view ? "&closeup=" + view : ""));
    await page.waitForSelector("#match .match-hand .card-front", {timeout: 60000});
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 40));
    const untilInput = async () => {
      for (let waited = 0; waited < 20000; waited += STEP) {
        if ((await shown()).canEndPhase) return;
        await page.clock.runFor(STEP);
      }
      throw new Error("the Cowboy's phase never came");
    };
    for (const round of [1, 2, 3]) {
      await untilInput();
      if (round === 3) {
        await page.click('#match .match-hand [data-card-id^="cowboy-sheriff"]');
        await page.click('#match .match-slot[data-side="cowboy"][data-slot="0"]');
        await page.click('#match [data-action="confirm"]');
        await page.clock.runFor(STEP);
        await untilInput();
      }
      await page.click('#match [data-action="end-phase"]');
    }
    const seen = {view: view || "board camera", size: `${width} x ${height}`};
    let now = 0;
    for (const [name, [at, clip]] of Object.entries(shots).sort((a, b) => a[1][0] - b[1][0])) {
      await page.clock.runFor(at - now);
      now = at;
      await page.screenshot({path: OUT + name + ".png", ...(clip ? {clip} : {})});
      seen[name] = (await shown()).lanes;
    }
    return seen;
  }

  // The clash starts about 400 ms after the round-3 End phase click. The
  // Wizard's cue from there: staff raised by 500 ms, thrust from 720, bolt
  // released at 900, impact at 1100, back to idle at 1600.
  const CLASH = 400;
  const hand = (x, y) => ({x, y, width: 520, height: 520});
  const runs = [
    await play("", [1440, 900], {
      "board-idle": [CLASH - 200], "board-windup": [CLASH + 500], "board-release": [CLASH + 940],
      "board-flight": [CLASH + 1020], "board-impact": [CLASH + 1140], "board-recovered": [CLASH + 1700],
    }),
    await play("wizard-0", [1440, 900], {
      "close-idle": [CLASH - 200], "close-windup": [CLASH + 500], "close-thrust": [CLASH + 820],
      "close-release": [CLASH + 940], "close-recovery": [CLASH + 1340],
    }),
    // Twice the size, clipped to the staff hand.
    await play("wizard-0", [2880, 1800], {
      "hand-idle": [CLASH - 200, hand(1450, 610)], "hand-windup": [CLASH + 500, hand(1280, 440)], "hand-thrust": [CLASH + 1080, hand(1490, 760)],
    }),
  ];
  return {runs, problems};
}
